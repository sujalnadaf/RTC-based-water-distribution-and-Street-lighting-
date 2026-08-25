const express = require('express');

const { pool } = require('../config/db');
const {
  authenticate,
  requireRole,
} = require('../middleware/auth');

const router = express.Router();

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// Both viewers and operators may view activity history.
router.use(
  authenticate,
  requireRole('user', 'operator')
);

// GET /api/activity
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || '')
      .trim()
      .toLowerCase();

    const category = String(
      req.query.category || ''
    ).trim();

    const severity = String(
      req.query.severity || ''
    ).trim();

    const result = String(
      req.query.result || ''
    ).trim();

    const requestedDays = Number(req.query.days);

    const days = Math.min(
      Math.max(
        Number.isFinite(requestedDays)
          ? requestedDays
          : 30,
        1
      ),
      365
    );

    const requestedLimit = Number(req.query.limit);

    const limit = Math.min(
      Math.max(
        Number.isFinite(requestedLimit)
          ? requestedLimit
          : 200,
        1
      ),
      500
    );

    const conditions = [
      `created_at >=
       CURRENT_TIMESTAMP - (? * INTERVAL '1 day')`,
    ];

    const values = [days];

    if (search) {
      conditions.push(
        `(
          LOWER(COALESCE(actor_name, '')) LIKE ?
          OR LOWER(action_type) LIKE ?
          OR LOWER(description) LIKE ?
          OR LOWER(COALESCE(target_type, '')) LIKE ?
          OR LOWER(COALESCE(target_id, '')) LIKE ?
        )`
      );

      const pattern = `%${search}%`;

      values.push(
        pattern,
        pattern,
        pattern,
        pattern,
        pattern
      );
    }

    const allowedCategories = [
      'authentication',
      'water',
      'lighting',
      'schedule',
      'user',
      'device',
      'report',
      'system',
    ];

    if (allowedCategories.includes(category)) {
      conditions.push('category = ?');
      values.push(category);
    }

    const allowedSeverities = [
      'info',
      'success',
      'warning',
      'critical',
    ];

    if (allowedSeverities.includes(severity)) {
      conditions.push('severity = ?');
      values.push(severity);
    }

    if (['success', 'failed'].includes(result)) {
      conditions.push('result = ?');
      values.push(result);
    }

    values.push(limit);

    const [rows] = await pool.query(
      `SELECT
         id,
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
         ip_address,
         created_at
       FROM activity_logs
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ?`,
      values
    );

    return res.json(rows);
  })
);

// GET /api/activity/summary
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT
         COUNT(*)::INTEGER AS total,
         COUNT(*) FILTER (
           WHERE severity = 'critical'
         )::INTEGER AS critical,
         COUNT(*) FILTER (
           WHERE severity = 'warning'
         )::INTEGER AS warnings,
         COUNT(*) FILTER (
           WHERE result = 'success'
         )::INTEGER AS successful,
         COUNT(*) FILTER (
           WHERE result = 'failed'
         )::INTEGER AS failed,
         COUNT(*) FILTER (
           WHERE created_at >= CURRENT_DATE
         )::INTEGER AS today
       FROM activity_logs`
    );

    return res.json(
      rows[0] ?? {
        total: 0,
        critical: 0,
        warnings: 0,
        successful: 0,
        failed: 0,
        today: 0,
      }
    );
  })
);

// DELETE /api/activity
// Operator only: clear old logs.
router.delete(
  '/',
  requireRole('operator'),
  asyncHandler(async (req, res) => {
    const requestedDays = Number(req.query.olderThanDays);

    const olderThanDays = Math.min(
      Math.max(
        Number.isFinite(requestedDays)
          ? requestedDays
          : 90,
        30
      ),
      3650
    );

    const [result] = await pool.query(
      `DELETE FROM activity_logs
       WHERE created_at <
         CURRENT_TIMESTAMP - (? * INTERVAL '1 day')
       RETURNING id`,
      [olderThanDays]
    );

    const deletedRows =
      result.rows ??
      result ??
      [];

    return res.json({
      success: true,
      deletedCount: Array.isArray(deletedRows)
        ? deletedRows.length
        : 0,
    });
  })
);

module.exports = router;