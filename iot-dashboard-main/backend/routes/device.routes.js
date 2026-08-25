const express = require('express');

const { pool } = require('../config/db');

const {
  authenticate,
  requireRole,
} = require('../middleware/auth');

const {
  logActivity,
  getRequestIp,
} = require('../services/activity.service');

const router = express.Router();

const DEVICE_ID = 1;


// ============================================================
// CLOUD DEVICE CONFIGURATION
// ============================================================

const ESP32_DEVICE_KEY =
  process.env.ESP32_DEVICE_KEY || '';

const DEVICE_ONLINE_WINDOW_SECONDS =
  Number(
    process.env.DEVICE_ONLINE_WINDOW_SECONDS || 20
  );


// ============================================================
// ASYNC HANDLER
// ============================================================

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(
      handler(req, res, next)
    ).catch(next);
  };
}


// ============================================================
// ESP32 AUTHENTICATION
// ============================================================

function authenticateESP32(
  req,
  res,
  next
) {

  const suppliedKey =
    req.headers['x-device-key'];


  if (!ESP32_DEVICE_KEY) {

    console.error(
      '[ESP32 Cloud] ESP32_DEVICE_KEY is not configured.'
    );

    return res.status(500).json({
      success: false,
      error:
        'ESP32 authentication is not configured.',
    });
  }


  if (
    !suppliedKey ||
    suppliedKey !== ESP32_DEVICE_KEY
  ) {

    console.warn(
      '[ESP32 Cloud] Unauthorized ESP32 request.'
    );

    return res.status(401).json({
      success: false,
      error:
        'Unauthorized ESP32 device.',
    });
  }


  next();
}


// ============================================================
// EXISTING CONTROL ACTION AUDIT
// ============================================================

async function logAction(
  userId,
  actionType,
  targetWard,
  result,
  notes = null
) {

  await pool.query(
    `
    INSERT INTO control_actions
    (
      device_id,
      user_id,
      action_type,
      target_ward,
      result,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      DEVICE_ID,
      userId,
      actionType,
      targetWard,
      result,
      notes,
    ]
  );
}


// ============================================================
// CREATE CLOUD COMMAND
// ============================================================

async function enqueueCommand({
  commandType,
  wardNumber = null,
  commandValue = null,
}) {

  const [rows] =
    await pool.query(
      `
      INSERT INTO device_commands
      (
        device_id,
        command_type,
        ward_number,
        command_value,
        status
      )
      VALUES (?, ?, ?, ?, 'pending')
      RETURNING *
      `,
      [
        DEVICE_ID,
        commandType,
        wardNumber,
        commandValue,
      ]
    );


  if (!rows || rows.length === 0) {

    throw new Error(
      'Failed to create device command.'
    );
  }


  console.log(
    `[Cloud Command] Created #${rows[0].id} -> ${commandType}`
  );


  return rows[0];
}


// ============================================================
// NORMALIZE SENSOR LOG ROW
// ============================================================

function normalizeSensorRow(
  row = {}
) {

  return {

    tankLevelMl:
      Number(
        row.tank_level_ml ?? 0
      ),

    flowRateLpm:
      Number(
        row.flow_rate_lpm ?? 0
      ),

    ward1Ml:
      Number(
        row.ward1_ml ?? 0
      ),

    ward2Ml:
      Number(
        row.ward2_ml ?? 0
      ),

    ward3Ml:
      Number(
        row.ward3_ml ?? 0
      ),

    activeWard:
      Number(
        row.active_ward ?? 0
      ),

    streetLight:
      Boolean(
        row.street_light
      ),

    leakDetected:
      Boolean(
        row.leak_detected
      ),

    dryTank:
      Boolean(
        row.dry_tank
      ),

    timestamp:
      row.recorded_at ??
      new Date().toISOString(),
  };
}


// ============================================================
// CHECK DEVICE ONLINE
// ============================================================

function isDeviceOnline(
  recordedAt
) {

  if (!recordedAt) {
    return false;
  }


  const recorded =
    new Date(recordedAt).getTime();

  const now =
    Date.now();


  if (
    Number.isNaN(recorded)
  ) {

    return false;
  }


  const ageSeconds =
    (now - recorded) / 1000;


  return (
    ageSeconds >= 0 &&
    ageSeconds <=
      DEVICE_ONLINE_WINDOW_SECONDS
  );
}


// ============================================================
// ============================================================
// ESP32 CLOUD API
// ============================================================
// ============================================================


// ============================================================
// GET /api/device/esp32/command
//
// ESP32 asks:
// "Do I have any pending command?"
// ============================================================

router.get(
  '/esp32/command',

  authenticateESP32,

  asyncHandler(
    async (req, res) => {

      const [rows] =
        await pool.query(
          `
          SELECT *
          FROM device_commands
          WHERE device_id = ?
            AND status = 'pending'
          ORDER BY created_at ASC
          LIMIT 1
          `,
          [
            DEVICE_ID,
          ]
        );


      // --------------------------------------------
      // No command
      // --------------------------------------------

      if (
        !rows ||
        rows.length === 0
      ) {

        return res.json({
          success: true,
          command: null,
        });
      }


      const command =
        rows[0];


      // --------------------------------------------
      // Mark command as picked
      // --------------------------------------------

      const [updated] =
        await pool.query(
          `
          UPDATE device_commands

          SET
            status = 'picked',
            picked_at = CURRENT_TIMESTAMP

          WHERE id = ?
            AND status = 'pending'

          RETURNING *
          `,
          [
            command.id,
          ]
        );


      // Another request may have taken it
      if (
        !updated ||
        updated.length === 0
      ) {

        return res.json({
          success: true,
          command: null,
        });
      }


      const picked =
        updated[0];


      console.log(
        `[ESP32 Cloud] Command #${picked.id} picked by ESP32`
      );


      return res.json({

        success: true,

        command: {

          id:
            Number(
              picked.id
            ),

          type:
            picked.command_type,

          ward:
            picked.ward_number === null
              ? null
              : Number(
                  picked.ward_number
                ),

          value:
            picked.command_value,
        },
      });
    }
  )
);


// ============================================================
// POST /api/device/esp32/complete
//
// ESP32 sends:
//
// {
//   "id": 12,
//   "success": true,
//   "result": "Ward 1 opened"
// }
// ============================================================

router.post(
  '/esp32/complete',

  authenticateESP32,

  asyncHandler(
    async (req, res) => {

      const commandId =
        Number(
          req.body.id
        );

      const success =
        req.body.success !== false;

      const result =
        req.body.result
          ? String(
              req.body.result
            )
          : null;


      if (
        !Number.isFinite(
          commandId
        ) ||
        commandId <= 0
      ) {

        return res.status(400).json({
          success: false,
          error:
            'Valid command id is required.',
        });
      }


      const finalStatus =
        success
          ? 'completed'
          : 'failed';


      const [rows] =
        await pool.query(
          `
          UPDATE device_commands

          SET
            status = ?,
            completed_at = CURRENT_TIMESTAMP,
            result = ?

          WHERE id = ?
            AND device_id = ?

          RETURNING *
          `,
          [
            finalStatus,
            result,
            commandId,
            DEVICE_ID,
          ]
        );


      if (
        !rows ||
        rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          error:
            'Command not found.',
        });
      }


      console.log(
        `[ESP32 Cloud] Command #${commandId} -> ${finalStatus}`
      );


      return res.json({
        success: true,
        commandId,
        status:
          finalStatus,
      });
    }
  )
);


// ============================================================
// POST /api/device/esp32/telemetry
//
// ESP32 periodically sends live hardware data.
// ============================================================

router.post(
  '/esp32/telemetry',

  authenticateESP32,

  asyncHandler(
    async (req, res) => {

      const data =
        req.body || {};


      // --------------------------------------------
      // Support multiple field names
      // --------------------------------------------

      const tankLevelMl =
        Number(
          data.tankLevel ??
          data.tankLevelMl ??
          data.tank ??
          0
        );


      const flowRateLpm =
        Number(
          data.flowRate ??
          data.flowRateLpm ??
          data.flow ??
          0
        );


      const ward1Ml =
        Number(
          data.ward1 ??
          data.ward1Ml ??
          data.w1 ??
          0
        );


      const ward2Ml =
        Number(
          data.ward2 ??
          data.ward2Ml ??
          data.w2 ??
          0
        );


      const ward3Ml =
        Number(
          data.ward3 ??
          data.ward3Ml ??
          data.w3 ??
          0
        );


      const activeWard =
        Number(
          data.activeWard ??
          data.ward ??
          0
        );


      const streetLight =
        Boolean(
          data.streetLight ??
          data.light ??
          false
        );


      const leakDetected =
        Boolean(
          data.leakDetected ??
          data.leak ??
          false
        );


      const dryTank =
        Boolean(
          data.dryTank ??
          data.dry ??
          false
        );


      // --------------------------------------------
      // Insert live sensor log
      // --------------------------------------------

      await pool.query(
        `
        INSERT INTO sensor_logs
        (
          device_id,
          tank_level_ml,
          flow_rate_lpm,
          ward1_ml,
          ward2_ml,
          ward3_ml,
          active_ward,
          street_light,
          leak_detected,
          dry_tank,
          recorded_at
        )

        VALUES
        (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          CURRENT_TIMESTAMP
        )
        `,
        [
          DEVICE_ID,

          tankLevelMl,
          flowRateLpm,

          ward1Ml,
          ward2Ml,
          ward3Ml,

          activeWard,

          streetLight,

          leakDetected,
          dryTank,
        ]
      );


      // --------------------------------------------
      // Update device online status
      // --------------------------------------------

      await pool.query(
        `
        UPDATE devices

        SET
          is_online = TRUE,
          last_seen_at =
            CURRENT_TIMESTAMP

        WHERE id = ?
        `,
        [
          DEVICE_ID,
        ]
      );


      console.log(
        `[ESP32 Cloud] Telemetry received | Tank=${tankLevelMl}mL | Flow=${flowRateLpm}L/min | Ward=${activeWard}`
      );


      return res.json({
        success: true,
        receivedAt:
          new Date().toISOString(),
      });
    }
  )
);


// ============================================================
// ============================================================
// DASHBOARD DEVICE INFORMATION
// ============================================================
// ============================================================


// ============================================================
// GET /api/device/status
//
// Dashboard reads latest cloud telemetry.
// No longer directly contacts local ESP32 IP.
// ============================================================

router.get(
  '/status',

  authenticate,

  requireRole(
    'user',
    'operator'
  ),

  asyncHandler(
    async (req, res) => {

      const [rows] =
        await pool.query(
          `
          SELECT *
          FROM sensor_logs

          WHERE device_id = ?

          ORDER BY recorded_at DESC

          LIMIT 1
          `,
          [
            DEVICE_ID,
          ]
        );


      if (
        !rows ||
        rows.length === 0
      ) {

        return res
          .status(503)
          .json({

            deviceOnline:
              false,

            device_online:
              false,

            stale:
              true,

            error:
              'No ESP32 telemetry is available yet.',
          });
      }


      const latest =
        rows[0];


      const online =
        isDeviceOnline(
          latest.recorded_at
        );


      const normalized =
        normalizeSensorRow(
          latest
        );


      return res.json({

        ...normalized,

        deviceOnline:
          online,

        device_online:
          online,

        stale:
          !online,

        ...(online
          ? {}
          : {
              error:
                'ESP32 telemetry is stale. Showing last known reading.',
            }),
      });
    }
  )
);


// ============================================================
// GET /api/device/history?hours=24
// ============================================================

router.get(
  '/history',

  authenticate,

  requireRole(
    'user',
    'operator'
  ),

  asyncHandler(
    async (req, res) => {

      const requestedHours =
        Number(
          req.query.hours
        );


      const hours =
        Math.min(
          Math.max(
            Number.isFinite(
              requestedHours
            )
              ? requestedHours
              : 24,

            1
          ),

          720
        );


      const [rows] =
        await pool.query(
          `
          SELECT
            tank_level_ml,
            flow_rate_lpm,
            ward1_ml,
            ward2_ml,
            ward3_ml,
            active_ward,
            street_light,
            leak_detected,
            dry_tank,
            recorded_at

          FROM sensor_logs

          WHERE device_id = ?

            AND recorded_at >=
              CURRENT_TIMESTAMP -
              (? * INTERVAL '1 hour')

          ORDER BY recorded_at ASC
          `,
          [
            DEVICE_ID,
            hours,
          ]
        );


      return res.json(
        rows
      );
    }
  )
);


// ============================================================
// GET /api/device/wards
// ============================================================

router.get(
  '/wards',

  authenticate,

  requireRole(
    'user',
    'operator'
  ),

  asyncHandler(
    async (req, res) => {

      const [wards] =
        await pool.query(
          `
          SELECT *

          FROM wards

          WHERE device_id = ?

          ORDER BY ward_number
          `,
          [
            DEVICE_ID,
          ]
        );


      return res.json(
        wards
      );
    }
  )
);


// ============================================================
// GET /api/device/alerts
// ============================================================

router.get(
  '/alerts',

  authenticate,

  requireRole(
    'user',
    'operator'
  ),

  asyncHandler(
    async (req, res) => {

      const [rows] =
        await pool.query(
          `
          SELECT *

          FROM alerts

          WHERE device_id = ?

          ORDER BY created_at DESC

          LIMIT 100
          `,
          [
            DEVICE_ID,
          ]
        );


      return res.json(
        rows
      );
    }
  )
);


// ============================================================
// GET /api/device/details
// ============================================================

router.get(
  '/details',

  authenticate,

  requireRole(
    'user',
    'operator'
  ),

  asyncHandler(
    async (req, res) => {

      const [rows] =
        await pool.query(
          `
          SELECT
            id,
            name,
            device_type,
            location,
            ip_address,
            firmware_version,
            is_online,
            last_seen_at,
            created_at

          FROM devices

          WHERE id = ?

          LIMIT 1
          `,
          [
            DEVICE_ID,
          ]
        );


      if (
        rows.length === 0
      ) {

        return res
          .status(404)
          .json({
            error:
              'Device record not found.',
          });
      }


      return res.json(
        rows[0]
      );
    }
  )
);


// ============================================================
// ============================================================
// OPERATOR HARDWARE CONTROLS
// ============================================================
// ============================================================


// ============================================================
// POST /api/device/valve
//
// Dashboard queues:
// { ward: 1-3, state: true/false }
// ============================================================

router.post(
  '/valve',

  authenticate,

  requireRole(
    'operator'
  ),

  asyncHandler(
    async (req, res) => {

      const ward =
        Number(
          req.body.ward
        );

      const state =
        req.body.state;


      if (
        ![1, 2, 3].includes(
          ward
        )
      ) {

        return res
          .status(400)
          .json({
            error:
              'ward must be 1, 2, or 3.',
          });
      }


      if (
        typeof state !==
        'boolean'
      ) {

        return res
          .status(400)
          .json({
            error:
              'state must be true or false.',
          });
      }


      const actionType =
        state
          ? 'valve_open'
          : 'valve_close';


      try {

        const command =
          await enqueueCommand({

            commandType:
              'valve',

            wardNumber:
              ward,

            commandValue:
              state
                ? '1'
                : '0',
          });


        await logAction(
          req.user.id,
          actionType,
          ward,
          'success',
          `Cloud command queued as #${command.id}`
        );


        await logActivity({

          user:
            req.user,

          actionType:
            state
              ? 'valve_opened'
              : 'valve_closed',

          category:
            'water',

          description:
            `Ward ${ward} ${
              state
                ? 'OPEN'
                : 'CLOSE'
            } command was queued by ${req.user.name}.`,

          severity:
            'success',

          result:
            'success',

          targetType:
            'ward_valve',

          targetId:
            ward,

          metadata: {

            ward,

            state,

            commandId:
              command.id,

            transport:
              'cloud_queue',
          },

          ipAddress:
            getRequestIp(
              req
            ),
        });


        return res.json({

          success:
            true,

          queued:
            true,

          ward,

          state,

          commandId:
            command.id,
        });

      } catch (err) {

        console.error(
          '[Device] Valve command queue failed:',
          err.message
        );


        await logAction(
          req.user.id,
          actionType,
          ward,
          'failed',
          err.message
        ).catch(() => {});


        return res
          .status(500)
          .json({
            success:
              false,

            error:
              'Failed to queue valve command.',
          });
      }
    }
  )
);


// ============================================================
// POST /api/device/light
//
// { mode: 'on' | 'off' | 'auto' }
// ============================================================

router.post(
  '/light',

  authenticate,

  requireRole(
    'operator'
  ),

  asyncHandler(
    async (req, res) => {

      const mode =
        String(
          req.body.mode || ''
        ).toLowerCase();


      if (
        ![
          'on',
          'off',
          'auto',
        ].includes(
          mode
        )
      ) {

        return res
          .status(400)
          .json({
            error:
              "mode must be 'on', 'off', or 'auto'.",
          });
      }


      try {

        const command =
          await enqueueCommand({

            commandType:
              'light',

            commandValue:
              mode,
          });


        await logAction(
          req.user.id,
          `light_${mode}`,
          null,
          'success',
          `Cloud command queued as #${command.id}`
        );


        await logActivity({

          user:
            req.user,

          actionType:
            `street_light_${mode}`,

          category:
            'lighting',

          description:
            `Street-light ${mode.toUpperCase()} command was queued by ${req.user.name}.`,

          severity:
            'success',

          result:
            'success',

          targetType:
            'street_light',

          targetId:
            'main',

          metadata: {

            mode,

            commandId:
              command.id,

            transport:
              'cloud_queue',
          },

          ipAddress:
            getRequestIp(
              req
            ),
        });


        return res.json({

          success:
            true,

          queued:
            true,

          mode,

          commandId:
            command.id,
        });

      } catch (err) {

        console.error(
          '[Device] Light command queue failed:',
          err.message
        );


        return res
          .status(500)
          .json({
            success:
              false,

            error:
              'Failed to queue street-light command.',
          });
      }
    }
  )
);


// ============================================================
// POST /api/device/refill
// ============================================================

router.post(
  '/refill',

  authenticate,

  requireRole(
    'operator'
  ),

  asyncHandler(
    async (req, res) => {

      try {

        const command =
          await enqueueCommand({

            commandType:
              'refill',

            commandValue:
              '1',
          });


        await logAction(
          req.user.id,
          'refill',
          null,
          'success',
          `Cloud command queued as #${command.id}`
        );


        await logActivity({

          user:
            req.user,

          actionType:
            'tank_refilled',

          category:
            'water',

          description:
            `Main tank refill command was queued by ${req.user.name}.`,

          severity:
            'success',

          result:
            'success',

          targetType:
            'tank',

          targetId:
            'main',

          metadata: {

            capacityMl:
              5000,

            commandId:
              command.id,

            transport:
              'cloud_queue',
          },

          ipAddress:
            getRequestIp(
              req
            ),
        });


        return res.json({

          success:
            true,

          queued:
            true,

          message:
            'Tank refill command queued.',

          commandId:
            command.id,
        });

      } catch (err) {

        console.error(
          '[Device] Refill queue failed:',
          err.message
        );


        return res
          .status(500)
          .json({
            success:
              false,

            error:
              'Failed to queue refill command.',
          });
      }
    }
  )
);


// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports =
  router;