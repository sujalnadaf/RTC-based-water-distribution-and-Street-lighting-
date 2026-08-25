const { pool } = require('../config/db');

const DEVICE_ID = 1;

/**
 * Writes an activity event without allowing logging failures
 * to crash the main operation.
 */
async function logActivity({
  user = null,
  userId = null,
  actorName = null,
  actorRole = null,
  actionType,
  category = 'system',
  description,
  severity = 'info',
  result = 'success',
  targetType = null,
  targetId = null,
  metadata = {},
  ipAddress = null,
  deviceId = DEVICE_ID,
}) {
  try {
    const resolvedUserId =
      userId ?? user?.id ?? null;

    const resolvedActorName =
      actorName ??
      user?.name ??
      (resolvedUserId ? 'Authenticated User' : 'System');

    const resolvedActorRole =
      actorRole ??
      user?.role ??
      (resolvedUserId ? 'user' : 'system');

    await pool.query(
      `INSERT INTO activity_logs
        (
          device_id,
          user_id,
          actor_name,
          actor_role,
          action_type,
          category,
          description,
          severity,
          result,
          target_type,
          target_id,
          metadata,
          ip_address
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deviceId,
        resolvedUserId,
        resolvedActorName,
        resolvedActorRole,
        actionType,
        category,
        description,
        severity,
        result,
        targetType,
        targetId !== null
          ? String(targetId)
          : null,
        JSON.stringify(metadata ?? {}),
        ipAddress,
      ]
    );

    return true;
  } catch (error) {
    console.error(
      '[Activity] Failed to write activity log:',
      error.message
    );

    return false;
  }
}

function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  return (
    req.ip ??
    req.socket?.remoteAddress ??
    null
  );
}

module.exports = {
  logActivity,
  getRequestIp,
};