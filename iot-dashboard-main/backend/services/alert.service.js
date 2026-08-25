const { pool } = require('../config/db');

const DEVICE_ID = 1;

/**
 * Creates an alert only when another unresolved alert of the same
 * type does not already exist.
 *
 * Returns:
 * {
 *   created: boolean,
 *   alert: object | null
 * }
 */
async function openAlert(
  alertType,
  severity,
  message,
  deviceId = DEVICE_ID
) {
  const [existingRows] = await pool.query(
    `SELECT
       id,
       device_id,
       alert_type,
       severity,
       message,
       is_resolved,
       created_at,
       resolved_at
     FROM alerts
     WHERE device_id = ?
       AND alert_type = ?
       AND is_resolved = FALSE
     ORDER BY created_at DESC
     LIMIT 1`,
    [deviceId, alertType]
  );

  if (existingRows.length > 0) {
    return {
      created: false,
      alert: existingRows[0],
    };
  }

  const [result] = await pool.query(
    `INSERT INTO alerts
      (
        device_id,
        alert_type,
        severity,
        message,
        is_resolved
      )
     VALUES (?, ?, ?, ?, FALSE)
     RETURNING
       id,
       device_id,
       alert_type,
       severity,
       message,
       is_resolved,
       created_at,
       resolved_at`,
    [deviceId, alertType, severity, message]
  );

  const alert =
    result.rows?.[0] ??
    result[0] ??
    null;

  return {
    created: true,
    alert,
  };
}

/**
 * Resolves all currently open alerts of the specified type.
 */
async function resolveAlert(
  alertType,
  deviceId = DEVICE_ID
) {
  const [result] = await pool.query(
    `UPDATE alerts
     SET
       is_resolved = TRUE,
       resolved_at = CURRENT_TIMESTAMP
     WHERE device_id = ?
       AND alert_type = ?
       AND is_resolved = FALSE
     RETURNING
       id,
       device_id,
       alert_type,
       severity,
       message,
       is_resolved,
       created_at,
       resolved_at`,
    [deviceId, alertType]
  );

  const rows = result.rows ?? result;

  return {
    resolved: Array.isArray(rows) && rows.length > 0,
    alerts: Array.isArray(rows) ? rows : [],
  };
}

/**
 * Adds an information event that is already resolved.
 *
 * This is used for history events such as:
 * - ESP32 reconnected
 * - leak condition cleared
 * - dry-tank condition cleared
 */
async function logResolvedEvent(
  alertType,
  severity,
  message,
  deviceId = DEVICE_ID
) {
  const [result] = await pool.query(
    `INSERT INTO alerts
      (
        device_id,
        alert_type,
        severity,
        message,
        is_resolved,
        resolved_at
      )
     VALUES (?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)
     RETURNING
       id,
       device_id,
       alert_type,
       severity,
       message,
       is_resolved,
       created_at,
       resolved_at`,
    [deviceId, alertType, severity, message]
  );

  return result.rows?.[0] ?? result[0] ?? null;
}

module.exports = {
  openAlert,
  resolveAlert,
  logResolvedEvent,
};