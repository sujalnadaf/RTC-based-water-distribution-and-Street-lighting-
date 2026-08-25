require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { testConnection } = require('./config/db');
const { initWebSocket } = require('./services/websocket.service');
const { startScheduler } = require('./utils/scheduler');

const authRoutes = require('./routes/auth.routes');
const deviceRoutes = require('./routes/device.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const exportRoutes = require('./routes/export.routes');
const userRoutes = require('./routes/user.routes');
const activityRoutes = require('./routes/activity.routes');

const app = express();


// =====================================================
// SECURITY
// =====================================================

app.use(helmet());


// =====================================================
// CORS CONFIGURATION
//
// Supports multiple origins from .env:
//
// CORS_ORIGIN=http://localhost:3000,https://iot-dashboard-fawn-ten.vercel.app
// =====================================================

const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  'http://localhost:3000'
)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);


console.log('[CORS] Allowed origins:', allowedOrigins);


app.use(
  cors({
    origin: function (origin, callback) {

      // Allow requests without browser Origin header.
      // ESP32, Postman, server-to-server requests, etc.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(
        `[CORS] Blocked request from: ${origin}`
      );

      return callback(
        new Error('Not allowed by CORS')
      );
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Device-Key',
    ],
  })
);


// =====================================================
// BODY PARSER
// =====================================================

app.use(
  express.json({
    limit: '1mb',
  })
);


// =====================================================
// RATE LIMITING
// =====================================================

const controlLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error: 'Too many device requests. Please try again shortly.',
  },
});

app.use(
  '/api/device',
  controlLimiter
);


// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
  '/api/health',
  (req, res) => {

    res.json({
      status: 'ok',
      service: 'water-iot-backend',
      time: new Date().toISOString(),
    });

  }
);


// =====================================================
// API ROUTES
// =====================================================

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  '/api/device',
  deviceRoutes
);

app.use(
  '/api/schedule',
  scheduleRoutes
);

app.use(
  '/api/export',
  exportRoutes
);

app.use(
  '/api/users',
  userRoutes
);

app.use(
  '/api/activity',
  activityRoutes
);


// =====================================================
// 404 HANDLER
// =====================================================

app.use(
  (req, res) => {

    res.status(404).json({
      error: 'Route not found.',
      path: req.originalUrl,
    });

  }
);


// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use(
  (err, req, res, next) => {

    console.error(
      '[Server Error]',
      err.message
    );

    // CORS errors
    if (
      err.message ===
      'Not allowed by CORS'
    ) {

      return res.status(403).json({
        error: 'Origin not allowed.',
      });

    }


    res.status(500).json({
      error: 'Internal server error.',
    });

  }
);


// =====================================================
// HTTP SERVER
// =====================================================

const server =
  http.createServer(app);


// =====================================================
// WEBSOCKET
// =====================================================

initWebSocket(server);


// =====================================================
// PORT
// =====================================================

const PORT =
  Number(
    process.env.PORT || 5000
  );


// =====================================================
// START SERVER
// =====================================================

(async () => {

  try {

    // -----------------------------------------
    // Test Supabase/PostgreSQL
    // -----------------------------------------

    await testConnection();

    console.log(
      '[Database] Connection successful'
    );


    // -----------------------------------------
    // Start RTC / distribution scheduler
    // -----------------------------------------

    startScheduler();

    console.log(
      '[Scheduler] Started'
    );


    // -----------------------------------------
    // Start Express server
    // -----------------------------------------

    server.listen(
      PORT,
      '0.0.0.0',
      () => {

        console.log(
          '======================================'
        );

        console.log(
          '[Server] Water IoT backend started'
        );

        console.log(
          `[Server] Port: ${PORT}`
        );

        console.log(
          `[Server] Health: /api/health`
        );

        console.log(
          `[Server] Device API: /api/device`
        );

        console.log(
          `[Server] WebSocket: /ws`
        );

        console.log(
          '======================================'
        );

      }
    );

  } catch (error) {

    console.error(
      '[Startup] Server failed to start:',
      error
    );

    process.exit(1);

  }

})();