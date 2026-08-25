const { WebSocketServer, WebSocket } = require('ws');

const { pool } = require('../config/db');
const esp32 = require('./esp32.service');

const {
  openAlert,
  resolveAlert,
  logResolvedEvent,
} = require('./alert.service');

let wss;
let pollingTimer = null;

const DEVICE_ID = Number(
  process.env.DEVICE_ID || 1
);

const POLL_INTERVAL_MS = Number(
  process.env.POLL_INTERVAL_MS || 5000
);

const TANK_CAPACITY_ML = Number(
  process.env.TANK_CAPACITY_ML || 5000
);

const LOW_TANK_THRESHOLD_PERCENT = Number(
  process.env.LOW_TANK_THRESHOLD_PERCENT || 20
);

const LOW_TANK_THRESHOLD_ML =
  (TANK_CAPACITY_ML *
    LOW_TANK_THRESHOLD_PERCENT) /
  100;


// =====================================================
// PREVIOUS STATES
// =====================================================

let previousHardwareOnline = null;

let previousLeakDetected = false;
let previousDryTank = false;
let previousLowTank = false;


// =====================================================
// INITIALIZE WEBSOCKET
// =====================================================

function initWebSocket(server) {

  wss = new WebSocketServer({
    server,
    path: '/ws',
  });


  wss.on(
    'connection',
    (ws, req) => {

      console.log(
        '[WS] Client connected:',
        req.socket.remoteAddress
      );


      ws.send(
        JSON.stringify({
          type: 'connected',
          message: 'Cloud live feed active',
        })
      );


      ws.on(
        'close',
        () => {
          console.log(
            '[WS] Client disconnected'
          );
        }
      );


      ws.on(
        'error',
        (error) => {
          console.error(
            '[WS] Client error:',
            error.message
          );
        }
      );

    }
  );


  // Prevent duplicate pollers
  if (!pollingTimer) {

    pollingTimer = setInterval(
      () => {

        pollAndBroadcast()
          .catch((error) => {

            console.error(
              '[WS] Poll error:',
              error.message
            );

          });

      },

      POLL_INTERVAL_MS
    );


    // First poll immediately
    pollAndBroadcast()
      .catch((error) => {

        console.error(
          '[WS] Initial cloud telemetry poll failed:',
          error.message
        );

      });
  }


  console.log(
    `[WS] Cloud telemetry polling every ${POLL_INTERVAL_MS}ms`
  );
}


// =====================================================
// BROADCAST
// =====================================================

function broadcast(payload) {

  if (!wss) {
    return;
  }


  const data =
    JSON.stringify(payload);


  wss.clients.forEach(
    (client) => {

      if (
        client.readyState ===
        WebSocket.OPEN
      ) {

        client.send(data);
      }

    }
  );
}


// =====================================================
// POLL LATEST CLOUD TELEMETRY
// =====================================================

async function pollAndBroadcast() {

  try {

    const status =
      await esp32.getStatus();


    // IMPORTANT:
    // Do NOT force online = true.
    // esp32.service determines freshness from
    // the ESP32 telemetry timestamp.

    const online =
      status.deviceOnline === true ||
      status.device_online === true;


    console.log(
      `[WS] Cloud status | Online=${online} | Ward=${status.activeWard} | Flow=${status.flowRateLpm} | Tank=${status.tankLevelMl}`
    );


    // =================================================
    // DEVICE ONLINE
    // =================================================

    if (online) {

      await handleDeviceOnline(
        status
      );


      await evaluateLeakCondition(
        status
      );

      await evaluateDryTankCondition(
        status
      );

      await evaluateLowTankCondition(
        status
      );


      broadcast({
        type: 'status',

        data: {
          ...status,

          deviceOnline:
            true,

          device_online:
            true,

          stale:
            false,
        },
      });


      return;
    }


    // =================================================
    // DEVICE OFFLINE / STALE
    // =================================================

    await handleEsp32Offline(
      new Error(
        'ESP32 telemetry is stale.'
      )
    );


    broadcast({
      type: 'status',

      data: {
        ...status,

        deviceOnline:
          false,

        device_online:
          false,

        stale:
          true,
      },
    });

  } catch (error) {

    await handleEsp32Offline(
      error
    );
  }
}


// =====================================================
// HANDLE ONLINE DEVICE
// =====================================================

async function handleDeviceOnline(
  status
) {

  await markDeviceOnline();


  // ESP32 recovered from offline state
  if (
    previousHardwareOnline === false
  ) {

    const resolution =
      await resolveAlert(
        'esp32_offline',
        DEVICE_ID
      );


    if (
      resolution.resolved
    ) {

      const recoveryEvent =
        await logResolvedEvent(
          'esp32_online',
          'info',
          'ESP32 cloud connection restored. Live telemetry is available.',
          DEVICE_ID
        );


      broadcast({
        type:
          'device_online',

        message:
          'ESP32 cloud connection restored.',

        deviceOnline:
          true,

        alert:
          recoveryEvent,
      });
    }
  }


  previousHardwareOnline =
    true;


  /*
   * IMPORTANT:
   *
   * DO NOT call saveSensorLog() here.
   *
   * The physical ESP32 already sends telemetry to:
   *
   * POST /api/device/esp32/telemetry
   *
   * That route writes sensor_logs.
   *
   * Re-inserting the same data here would:
   * - duplicate readings
   * - make old data look fresh
   * - break offline detection
   */
}


// =====================================================
// MARK DEVICE ONLINE
// =====================================================

async function markDeviceOnline() {

  await pool.query(
    `
    UPDATE devices

    SET
      is_online = TRUE

    WHERE id = ?
    `,
    [
      DEVICE_ID,
    ]
  );
}


// =====================================================
// MARK DEVICE OFFLINE
// =====================================================

async function markDeviceOffline() {

  await pool.query(
    `
    UPDATE devices

    SET
      is_online = FALSE

    WHERE id = ?
    `,
    [
      DEVICE_ID,
    ]
  );
}


// =====================================================
// HANDLE ESP32 OFFLINE
// =====================================================

async function handleEsp32Offline(
  error
) {

  await markDeviceOffline()
    .catch(
      (databaseError) => {

        console.error(
          '[WS] Failed to update offline device state:',
          databaseError.message
        );

      }
    );


  const result =
    await openAlert(
      'esp32_offline',
      'warning',
      'ESP32 cloud telemetry is unavailable or stale.',
      DEVICE_ID
    )
      .catch(
        (databaseError) => {

          console.error(
            '[Alerts] Failed to create ESP32 offline alert:',
            databaseError.message
          );


          return {
            created: false,
            alert: null,
          };

        }
      );


  previousHardwareOnline =
    false;


  broadcast({
    type:
      'device_offline',

    severity:
      'warning',

    message:
      'ESP32 hardware is offline. Showing last known cloud data.',

    deviceOnline:
      false,

    device_online:
      false,

    stale:
      true,

    error:
      error.message,

    alert:
      result.alert,
  });


  if (
    result.created
  ) {

    broadcast({
      type: 'alert',

      alertType:
        'esp32_offline',

      severity:
        'warning',

      message:
        'ESP32 hardware is offline.',

      alert:
        result.alert,
    });
  }
}


// =====================================================
// LEAK CONDITION
// =====================================================

async function evaluateLeakCondition(
  status
) {

  const detected =
    status.leakDetected === true;


  if (detected) {

    const result =
      await openAlert(
        'leak_detected',
        'critical',
        'Leak detected: water flow was measured while all ward valves should be closed.',
        DEVICE_ID
      );


    if (
      result.created
    ) {

      broadcast({
        type:
          'alert',

        alertType:
          'leak_detected',

        severity:
          'critical',

        message:
          'Leak detected.',

        alert:
          result.alert,
      });
    }

  } else if (
    previousLeakDetected
  ) {

    const result =
      await resolveAlert(
        'leak_detected',
        DEVICE_ID
      );


    if (
      result.resolved
    ) {

      const event =
        await logResolvedEvent(
          'leak_cleared',
          'info',
          'Leak condition cleared.',
          DEVICE_ID
        );


      broadcast({
        type:
          'alert_resolved',

        alertType:
          'leak_detected',

        message:
          'Leak condition cleared.',

        alert:
          event,
      });
    }
  }


  previousLeakDetected =
    detected;
}


// =====================================================
// DRY TANK CONDITION
// =====================================================

async function evaluateDryTankCondition(
  status
) {

  const detected =
    status.dryTank === true;


  if (detected) {

    const result =
      await openAlert(
        'dry_tank',
        'critical',
        'Dry-tank condition detected. Water distribution must remain stopped.',
        DEVICE_ID
      );


    if (
      result.created
    ) {

      broadcast({
        type:
          'alert',

        alertType:
          'dry_tank',

        severity:
          'critical',

        message:
          'Dry-tank condition detected.',

        alert:
          result.alert,
      });
    }

  } else if (
    previousDryTank
  ) {

    const result =
      await resolveAlert(
        'dry_tank',
        DEVICE_ID
      );


    if (
      result.resolved
    ) {

      const event =
        await logResolvedEvent(
          'dry_tank_cleared',
          'info',
          'Dry-tank condition cleared.',
          DEVICE_ID
        );


      broadcast({
        type:
          'alert_resolved',

        alertType:
          'dry_tank',

        message:
          'Dry-tank condition cleared.',

        alert:
          event,
      });
    }
  }


  previousDryTank =
    detected;
}


// =====================================================
// LOW TANK CONDITION
// =====================================================

async function evaluateLowTankCondition(
  status
) {

  const tankLevelMl =
    Number(
      status.tankLevelMl || 0
    );


  const lowTank =
    status.dryTank !== true &&
    tankLevelMl > 0 &&
    tankLevelMl <=
      LOW_TANK_THRESHOLD_ML;


  if (lowTank) {

    const result =
      await openAlert(
        'low_tank',
        'warning',
        `Tank level is below ${LOW_TANK_THRESHOLD_PERCENT}% (${Math.round(
          LOW_TANK_THRESHOLD_ML
        )} mL).`,
        DEVICE_ID
      );


    if (
      result.created
    ) {

      broadcast({
        type:
          'alert',

        alertType:
          'low_tank',

        severity:
          'warning',

        message:
          `Tank level is below ${LOW_TANK_THRESHOLD_PERCENT}%.`,

        alert:
          result.alert,
      });
    }

  } else if (
    previousLowTank
  ) {

    const result =
      await resolveAlert(
        'low_tank',
        DEVICE_ID
      );


    if (
      result.resolved
    ) {

      const event =
        await logResolvedEvent(
          'tank_level_normal',
          'info',
          'Tank level returned above the low-level threshold.',
          DEVICE_ID
        );


      broadcast({
        type:
          'alert_resolved',

        alertType:
          'low_tank',

        message:
          'Tank level returned to normal.',

        alert:
          event,
      });
    }
  }


  previousLowTank =
    lowTank;
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  initWebSocket,
  broadcast,
};