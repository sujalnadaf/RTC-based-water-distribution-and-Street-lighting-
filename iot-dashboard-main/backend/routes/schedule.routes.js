const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const DEVICE_ID = 1;

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// ============================================================
// GET /api/schedule
// User and Operator can view schedules
// ============================================================

router.get(
  '/',
  authenticate,
  requireRole('user', 'operator'),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT
         s.*,
         u.name AS created_by_name
       FROM schedules s
       JOIN users u
         ON u.id = s.created_by
       WHERE s.device_id = ?
       ORDER BY s.start_time`,
      [DEVICE_ID]
    );

    return res.json(rows);
  })
);

// ============================================================
// POST /api/schedule
// Operator only
// ============================================================

router.post(
  '/',
  authenticate,
  requireRole('operator'),
  asyncHandler(async (req, res) => {
    const wardNumber = Number(req.body.wardNumber);
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;

    const daysMask =
      req.body.daysMask ||
      'MON,TUE,WED,THU,FRI,SAT,SUN';

    const quotaMl =
      Number(req.body.quotaMl || 1500);

    if (
      ![1, 2, 3].includes(wardNumber) ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        error:
          'wardNumber (1-3), startTime, and endTime are required.',
      });
    }

    if (!Number.isFinite(quotaMl) || quotaMl <= 0) {
      return res.status(400).json({
        error: 'quotaMl must be a positive number.',
      });
    }

    const [rows] = await pool.query(
      `INSERT INTO schedules
        (
          device_id,
          ward_number,
          start_time,
          end_time,
          days_mask,
          quota_ml,
          created_by
        )
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING
         id,
         device_id,
         ward_number,
         start_time,
         end_time,
         days_mask,
         quota_ml,
         is_active,
         created_by,
         created_at`,
      [
        DEVICE_ID,
        wardNumber,
        startTime,
        endTime,
        daysMask,
        quotaMl,
        req.user.id,
      ]
    );

    if (!rows || rows.length === 0) {
      return res.status(500).json({
        error: 'Failed to create schedule.',
      });
    }

    return res.status(201).json(rows[0]);
  })
);

// ============================================================
// PATCH /api/schedule/:id
// Operator only
// ============================================================

router.patch(
  '/:id',
  authenticate,
  requireRole('operator'),
  asyncHandler(async (req, res) => {
    const scheduleId = Number(req.params.id);

    if (
      !Number.isInteger(scheduleId) ||
      scheduleId <= 0
    ) {
      return res.status(400).json({
        error: 'Invalid schedule ID.',
      });
    }

    const {
      startTime,
      endTime,
      daysMask,
      quotaMl,
      isActive,
    } = req.body;

    const fields = [];
    const values = [];

    if (startTime) {
      fields.push('start_time = ?');
      values.push(startTime);
    }

    if (endTime) {
      fields.push('end_time = ?');
      values.push(endTime);
    }

    if (daysMask) {
      fields.push('days_mask = ?');
      values.push(daysMask);
    }

    if (quotaMl !== undefined) {
      const parsedQuota = Number(quotaMl);

      if (
        !Number.isFinite(parsedQuota) ||
        parsedQuota <= 0
      ) {
        return res.status(400).json({
          error: 'quotaMl must be a positive number.',
        });
      }

      fields.push('quota_ml = ?');
      values.push(parsedQuota);
    }

    if (isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(Boolean(isActive));
    }

    if (fields.length === 0) {
      return res.status(400).json({
        error: 'No fields to update.',
      });
    }

    values.push(scheduleId, DEVICE_ID);

    const [rows] = await pool.query(
      `UPDATE schedules
       SET ${fields.join(', ')}
       WHERE id = ?
         AND device_id = ?
       RETURNING
         id,
         device_id,
         ward_number,
         start_time,
         end_time,
         days_mask,
         quota_ml,
         is_active,
         created_by,
         created_at`,
      values
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        error: 'Schedule not found.',
      });
    }

    return res.json({
      success: true,
      schedule: rows[0],
    });
  })
);

// ============================================================
// DELETE /api/schedule/:id
// Operator only
// ============================================================

router.delete(
  '/:id',
  authenticate,
  requireRole('operator'),
  asyncHandler(async (req, res) => {
    const scheduleId = Number(req.params.id);

    if (
      !Number.isInteger(scheduleId) ||
      scheduleId <= 0
    ) {
      return res.status(400).json({
        error: 'Invalid schedule ID.',
      });
    }

    const [rows] = await pool.query(
      `DELETE FROM schedules
       WHERE id = ?
         AND device_id = ?
       RETURNING id`,
      [scheduleId, DEVICE_ID]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        error: 'Schedule not found.',
      });
    }

    return res.json({
      success: true,
      deletedId: rows[0].id,
    });
  })
);

module.exports = router;