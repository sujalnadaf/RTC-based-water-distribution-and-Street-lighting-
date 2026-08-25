/**
 * ESP32 CLOUD SERVICE
 *
 * Cloud architecture:
 *
 * Dashboard / Scheduler
 *        ↓
 * Node.js / Render
 *        ↓
 * device_commands table
 *        ↓
 * ESP32 polls Render
 *        ↓
 * Relay / Light / Refill command
 *
 *
 * Telemetry:
 *
 * ESP32
 *   ↓
 * POST /api/device/esp32/telemetry
 *   ↓
 * sensor_logs
 *   ↓
 * Dashboard
 */

const { pool } = require('../config/db');


// =====================================================
// CONFIGURATION
// =====================================================

const DEVICE_ID =
  Number(
    process.env.DEVICE_ID || 1
  );

const DEVICE_ONLINE_WINDOW_SECONDS =
  Number(
    process.env.DEVICE_ONLINE_WINDOW_SECONDS || 20
  );


// =====================================================
// NORMALIZE STATUS
// =====================================================

function normalizeStatus(raw = {}) {

  return {

    // -----------------------------------------
    // TANK LEVEL
    // -----------------------------------------

    tankLevelMl: Number(
      raw.tank ??
      raw.tankLevel ??
      raw.tankLevelMl ??
      raw.tank_level_ml ??
      0
    ),


    // -----------------------------------------
    // FLOW RATE
    // -----------------------------------------

    flowRateLpm: Number(
      raw.flow ??
      raw.flowRate ??
      raw.flowRateLpm ??
      raw.flow_rate_lpm ??
      0
    ),


    // -----------------------------------------
    // WARD CONSUMPTION
    // -----------------------------------------

    ward1Ml: Number(
      raw.w1 ??
      raw.ward1 ??
      raw.ward1Ml ??
      raw.ward1_ml ??
      0
    ),

    ward2Ml: Number(
      raw.w2 ??
      raw.ward2 ??
      raw.ward2Ml ??
      raw.ward2_ml ??
      0
    ),

    ward3Ml: Number(
      raw.w3 ??
      raw.ward3 ??
      raw.ward3Ml ??
      raw.ward3_ml ??
      0
    ),


    // -----------------------------------------
    // ACTIVE WARD
    // -----------------------------------------

    activeWard: Number(
      raw.ward ??
      raw.activeWard ??
      raw.active_ward ??
      0
    ),


    // -----------------------------------------
    // STREET LIGHT
    // -----------------------------------------

    streetLight: Boolean(
      raw.light ??
      raw.streetLight ??
      raw.street_light ??
      false
    ),


    // -----------------------------------------
    // LIGHT MODE
    // -----------------------------------------

    lightMode:
      raw.lightMode ??
      raw.light_mode ??
      'auto',


    // -----------------------------------------
    // LEAK
    // -----------------------------------------

    leakDetected: Boolean(
      raw.leak ??
      raw.leakDetected ??
      raw.leak_detected ??
      false
    ),


    // -----------------------------------------
    // DRY TANK
    // -----------------------------------------

    dryTank: Boolean(
      raw.dry ??
      raw.dryTank ??
      raw.dry_tank ??
      false
    ),


    // -----------------------------------------
    // RTC
    // -----------------------------------------

    rtc:
      raw.rtc ??
      null,


    // -----------------------------------------
    // TIMESTAMP
    // -----------------------------------------

    timestamp:
      raw.recorded_at ??
      raw.timestamp ??
      new Date().toISOString(),
  };
}


// =====================================================
// CHECK IF DEVICE IS ONLINE
// =====================================================

function isDeviceOnline(
  recordedAt
) {

  if (!recordedAt) {

    return false;
  }


  const recordedTime =
    new Date(
      recordedAt
    ).getTime();


  if (
    Number.isNaN(
      recordedTime
    )
  ) {

    return false;
  }


  const ageSeconds =
    (
      Date.now() -
      recordedTime
    ) / 1000;


  return (
    ageSeconds >= 0 &&
    ageSeconds <=
      DEVICE_ONLINE_WINDOW_SECONDS
  );
}


// =====================================================
// CREATE CLOUD COMMAND
// =====================================================

async function enqueueCommand({

  commandType,

  wardNumber = null,

  commandValue = null,

}) {

  console.log(
    `[ESP32 Cloud] Queueing command -> ${commandType}`
  );


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

      VALUES
      (
        ?, ?, ?, ?, 'pending'
      )

      RETURNING *
      `,
      [
        DEVICE_ID,

        commandType,

        wardNumber,

        commandValue,
      ]
    );


  if (
    !rows ||
    rows.length === 0
  ) {

    throw new Error(
      'Failed to queue ESP32 command.'
    );
  }


  const command =
    rows[0];


  console.log(
    `[ESP32 Cloud] Command #${command.id} queued successfully`
  );


  return command;
}


// =====================================================
// GET LATEST ESP32 STATUS
//
// No local IP communication.
// Reads latest ESP32 telemetry from database.
// =====================================================

async function getStatus() {

  try {

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

      throw new Error(
        'No ESP32 telemetry available.'
      );
    }


    const latest =
      rows[0];


    const normalized =
      normalizeStatus(
        latest
      );


    const online =
      isDeviceOnline(
        latest.recorded_at
      );


    console.log(
      `[ESP32 Cloud] Latest status -> Ward=${normalized.activeWard} | Flow=${normalized.flowRateLpm} | Tank=${normalized.tankLevelMl} | Online=${online}`
    );


    return {

      ...normalized,

      deviceOnline:
        online,

      device_online:
        online,

      stale:
        !online,
    };

  } catch (error) {

    console.error(
      '[ESP32 Cloud] Status failed:',
      error.message
    );


    throw error;
  }
}


// =====================================================
// VALVE CONTROL
//
// Used by:
// - scheduler.js
// - any existing backend code
//
// state:
// true / 1 / open = OPEN
// false / 0 / close = CLOSE
// =====================================================

async function setValve(
  wardNumber,
  state
) {

  const ward =
    Number(
      wardNumber
    );


  // -----------------------------------------
  // Validate ward
  // -----------------------------------------

  if (
    ![
      1,
      2,
      3,
    ].includes(
      ward
    )
  ) {

    throw new Error(
      `Invalid ward number: ${wardNumber}`
    );
  }


  // -----------------------------------------
  // Normalize state
  // -----------------------------------------

  const open =
    state === true ||
    state === 1 ||
    state === '1' ||
    state === 'open' ||
    state === 'on' ||
    state === 'true';


  const commandValue =
    open
      ? '1'
      : '0';


  console.log(
    `[ESP32 Cloud] Valve ${ward} -> ${
      open
        ? 'OPEN'
        : 'CLOSE'
    }`
  );


  try {

    const command =
      await enqueueCommand({

        commandType:
          'valve',

        wardNumber:
          ward,

        commandValue,
      });


    return {

      success:
        true,

      queued:
        true,

      commandId:
        command.id,

      ward,

      state:
        open,

      transport:
        'cloud_queue',
    };

  } catch (error) {

    console.error(
      `[ESP32 Cloud] Valve ${ward} queue failed:`,
      error.message
    );


    throw error;
  }
}


// =====================================================
// STREET LIGHT CONTROL
//
// mode:
// on
// off
// auto
// =====================================================

async function setLight(
  mode
) {

  let normalizedMode =
    String(
      mode || 'auto'
    ).toLowerCase();


  if (
    ![
      'on',
      'off',
      'auto',
    ].includes(
      normalizedMode
    )
  ) {

    normalizedMode =
      'auto';
  }


  console.log(
    `[ESP32 Cloud] Street light -> ${normalizedMode}`
  );


  try {

    const command =
      await enqueueCommand({

        commandType:
          'light',

        commandValue:
          normalizedMode,
      });


    return {

      success:
        true,

      queued:
        true,

      commandId:
        command.id,

      mode:
        normalizedMode,

      transport:
        'cloud_queue',
    };

  } catch (error) {

    console.error(
      '[ESP32 Cloud] Light command queue failed:',
      error.message
    );


    throw error;
  }
}


// =====================================================
// REFILL TANK
// =====================================================

async function refillTank() {

  console.log(
    '[ESP32 Cloud] Refill command'
  );


  try {

    const command =
      await enqueueCommand({

        commandType:
          'refill',

        commandValue:
          '1',
      });


    return {

      success:
        true,

      queued:
        true,

      commandId:
        command.id,

      transport:
        'cloud_queue',
    };

  } catch (error) {

    console.error(
      '[ESP32 Cloud] Refill command queue failed:',
      error.message
    );


    throw error;
  }
}


// =====================================================
// GET COMMAND STATUS
//
// Optional helper.
// Useful for debugging and future command confirmation.
// =====================================================

async function getCommandStatus(
  commandId
) {

  const id =
    Number(
      commandId
    );


  if (
    !Number.isFinite(id) ||
    id <= 0
  ) {

    throw new Error(
      'Invalid command id.'
    );
  }


  const [rows] =
    await pool.query(
      `
      SELECT *

      FROM device_commands

      WHERE id = ?
        AND device_id = ?

      LIMIT 1
      `,
      [
        id,
        DEVICE_ID,
      ]
    );


  if (
    !rows ||
    rows.length === 0
  ) {

    return null;
  }


  return rows[0];
}


// =====================================================
// GET PENDING COMMAND COUNT
//
// Useful for diagnostics.
// =====================================================

async function getPendingCommandCount() {

  const [rows] =
    await pool.query(
      `
      SELECT COUNT(*) AS count

      FROM device_commands

      WHERE device_id = ?
        AND status = 'pending'
      `,
      [
        DEVICE_ID,
      ]
    );


  return Number(
    rows?.[0]?.count ?? 0
  );
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

  getStatus,

  setValve,

  setLight,

  refillTank,

  normalizeStatus,

  enqueueCommand,

  getCommandStatus,

  getPendingCommandCount,
};