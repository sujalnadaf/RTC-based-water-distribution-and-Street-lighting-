const express = require('express');
const bcrypt = require('bcryptjs');

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

// All user-management routes are operator-only.
router.use(authenticate, requireRole('operator'));

// GET /api/users
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || '')
      .trim()
      .toLowerCase();

    const role = String(req.query.role || '').trim();

    const conditions = [];
    const values = [];

    if (search) {
      conditions.push(
        `(LOWER(name) LIKE ? OR LOWER(email) LIKE ?)`
      );

      values.push(`%${search}%`, `%${search}%`);
    }

    if (role && ['user', 'operator'].includes(role)) {
      conditions.push('role = ?');
      values.push(role);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const [rows] = await pool.query(
      `SELECT
         id,
         name,
         email,
         role,
         is_active,
         last_login_at,
         created_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC`,
      values
    );

    return res.json(rows);
  })
);

// GET /api/users/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID.',
      });
    }

    const [rows] = await pool.query(
      `SELECT
         id,
         name,
         email,
         role,
         is_active,
         last_login_at,
         created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    return res.json(rows[0]);
  })
);

// POST /api/users
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = req.body.role;

    if (
      !name ||
      !email ||
      password.length < 8 ||
      !['user', 'operator'].includes(role)
    ) {
      return res.status(400).json({
        error:
          'Name, valid email, password of at least 8 characters, and role are required.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const [result] = await pool.query(
        `INSERT INTO users
          (
            name,
            email,
            password_hash,
            role,
            is_active
          )
         VALUES (?, ?, ?, ?, TRUE)
         RETURNING
           id,
           name,
           email,
           role,
           is_active,
           last_login_at,
           created_at`,
        [name, email, passwordHash, role]
      );

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'A user with this email already exists.',
        });
      }

      throw error;
    }
  })
);

// PATCH /api/users/:id
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID.',
      });
    }

    const fields = [];
    const values = [];

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();

      if (!name) {
        return res.status(400).json({
          error: 'Name cannot be empty.',
        });
      }

      fields.push('name = ?');
      values.push(name);
    }

    if (req.body.email !== undefined) {
      const email = String(req.body.email)
        .trim()
        .toLowerCase();

      if (!email) {
        return res.status(400).json({
          error: 'Email cannot be empty.',
        });
      }

      fields.push('email = ?');
      values.push(email);
    }

    if (req.body.role !== undefined) {
      const role = req.body.role;

      if (!['user', 'operator'].includes(role)) {
        return res.status(400).json({
          error: 'Role must be user or operator.',
        });
      }

      // Prevent an operator from removing their own operator role.
      if (
        userId === req.user.id &&
        role !== 'operator'
      ) {
        return res.status(400).json({
          error:
            'You cannot remove your own operator role.',
        });
      }

      fields.push('role = ?');
      values.push(role);
    }

    if (req.body.isActive !== undefined) {
      const isActive = Boolean(req.body.isActive);

      if (userId === req.user.id && !isActive) {
        return res.status(400).json({
          error:
            'You cannot deactivate your own account.',
        });
      }

      fields.push('is_active = ?');
      values.push(isActive);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        error: 'No valid fields were supplied.',
      });
    }

    values.push(userId);

    try {
      const [result] = await pool.query(
        `UPDATE users
         SET ${fields.join(', ')}
         WHERE id = ?
         RETURNING
           id,
           name,
           email,
           role,
           is_active,
           last_login_at,
           created_at`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found.',
        });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'A user with this email already exists.',
        });
      }

      throw error;
    }
  })
);

// PATCH /api/users/:id/password
router.patch(
  '/:id/password',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    const password = String(req.body.password || '');

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error:
          'Password must contain at least 8 characters.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `UPDATE users
       SET password_hash = ?
       WHERE id = ?
       RETURNING id`,
      [passwordHash, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    return res.json({
      success: true,
      message: 'Password updated successfully.',
    });
  })
);

// DELETE /api/users/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID.',
      });
    }

    if (userId === req.user.id) {
      return res.status(400).json({
        error:
          'You cannot delete your own account.',
      });
    }

    const [result] = await pool.query(
      `DELETE FROM users
       WHERE id = ?
       RETURNING id`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    return res.json({
      success: true,
      deletedId: result.rows[0].id,
    });
  })
);

module.exports = router;