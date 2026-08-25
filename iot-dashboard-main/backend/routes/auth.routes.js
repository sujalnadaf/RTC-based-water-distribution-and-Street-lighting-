const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.',
      });
    }

    const [rows] = await pool.query(
      `SELECT
         id,
         name,
         email,
         password_hash,
         role,
         is_active
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const user = rows[0];

    if (!user || !user.is_active) {
      await logActivity({
        actorName: email || 'Unknown user',
        actorRole: 'unknown',
        actionType: 'login_failed',
        category: 'authentication',
        description:
          'Login attempt failed because the account was invalid or inactive.',
        severity: 'warning',
        result: 'failed',
        targetType: 'user_account',
        targetId: email || null,
        ipAddress: getRequestIp(req),
      });

      return res.status(401).json({
        error: 'Invalid credentials.',
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!validPassword) {
      await logActivity({
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
        actionType: 'login_failed',
        category: 'authentication',
        description: `${user.name} entered an invalid password.`,
        severity: 'warning',
        result: 'failed',
        targetType: 'user',
        targetId: user.id,
        ipAddress: getRequestIp(req),
      });

      return res.status(401).json({
        error: 'Invalid credentials.',
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '8h',
      }
    );

    await pool.query(
      `UPDATE users
       SET last_login_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [user.id]
    );

    await logActivity({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      actionType: 'user_login',
      category: 'authentication',
      description: `${user.name} signed in successfully.`,
      severity: 'success',
      result: 'success',
      targetType: 'user',
      targetId: user.id,
      metadata: {
        email: user.email,
      },
      ipAddress: getRequestIp(req),
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);

    return res.status(500).json({
      error: 'Login failed.',
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  return res.json({
    user: req.user,
  });
});

// POST /api/auth/register
// Only an operator can create user/operator accounts.
router.post(
  '/register',
  authenticate,
  requireRole('operator'),
  async (req, res) => {
    try {
      const name = req.body.name?.trim();
      const email = req.body.email?.trim().toLowerCase();
      const password = String(req.body.password || '');
      const role = req.body.role;

      if (
        !name ||
        !email ||
        !password ||
        !['user', 'operator'].includes(role)
      ) {
        return res.status(400).json({
          error:
            'Name, email, password, and a valid role are required.',
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
           created_at`,
        [
          name,
          email,
          passwordHash,
          role,
        ]
      );

      const createdUser = result.rows[0];

      await logActivity({
        user: req.user,
        actionType: 'user_created',
        category: 'user',
        description:
          `${req.user.name} created a ${role} account for ${name}.`,
        severity: 'success',
        result: 'success',
        targetType: 'user',
        targetId: createdUser.id,
        metadata: {
          createdUserId: createdUser.id,
          createdUserName: createdUser.name,
          createdUserEmail: createdUser.email,
          createdUserRole: createdUser.role,
        },
        ipAddress: getRequestIp(req),
      });

      return res.status(201).json(createdUser);
    } catch (err) {
      if (err.code === '23505') {
        await logActivity({
          user: req.user,
          actionType: 'user_creation_failed',
          category: 'user',
          description:
            'User creation failed because the email already exists.',
          severity: 'warning',
          result: 'failed',
          targetType: 'user_email',
          targetId:
            req.body.email?.trim().toLowerCase() || null,
          ipAddress: getRequestIp(req),
        });

        return res.status(409).json({
          error: 'A user with this email already exists.',
        });
      }

      console.error('[Auth] Registration error:', err);

      await logActivity({
        user: req.user,
        actionType: 'user_creation_failed',
        category: 'user',
        description:
          'User account creation failed because of an internal error.',
        severity: 'warning',
        result: 'failed',
        targetType: 'user_email',
        targetId:
          req.body.email?.trim().toLowerCase() || null,
        metadata: {
          error: err.message,
        },
        ipAddress: getRequestIp(req),
      });

      return res.status(500).json({
        error: 'Registration failed.',
      });
    }
  }
);

module.exports = router;