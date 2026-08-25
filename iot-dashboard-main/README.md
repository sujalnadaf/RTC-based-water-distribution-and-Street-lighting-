# Industrial IoT Dashboard
### RTC-Based Water Distribution & Street Lighting System — Web Control Platform

A production-ready, role-based web dashboard for the ESP32-powered water distribution
and street lighting mega project. Built as the software layer on top of the existing
firmware (`/status`, `/valve`, `/light`, `/refill` endpoints).

---

## 1. Architecture

```
┌────────────┐      Wi-Fi LAN      ┌──────────────┐      REST + WS      ┌───────────────┐
│   ESP32    │ ───────────────────▶│   Backend    │────────────────────▶│   Frontend    │
│ (firmware) │◀─────────────────── │ Node/Express │◀────────────────────│  Next.js App  │
└────────────┘   HTTP GET polling  └──────┬───────┘    JWT-authed calls └───────────────┘
                                           │
                                     ┌─────▼─────┐
                                     │   MySQL   │
                                     │ (history, │
                                     │ users,    │
                                     │ schedules)│
                                     └───────────┘
```

- **Backend** polls the ESP32's `/status` endpoint every few seconds, persists
  readings to MySQL, and pushes live updates to all connected browsers over WebSocket.
- **Frontend** (Next.js) renders the live dashboard, subscribes to the WebSocket feed,
  and calls the REST API for control actions, history, schedules, and report exports.
- **Two roles** are enforced end-to-end (JWT claim + middleware, not just UI hiding):
  - `user` — read-only dashboard access.
  - `operator` — full hardware control (valves, street light, refill, schedules).

---

## 2. Folder Structure

```
iot-dashboard/
├── backend/
│   ├── config/db.js               MySQL pool
│   ├── middleware/auth.js         JWT auth + role-based access control
│   ├── routes/                    auth, device, schedule, export routes
│   ├── services/
│   │   ├── esp32.service.js       Talks to the ESP32 REST API
│   │   └── websocket.service.js   Polls ESP32, persists logs, broadcasts live data
│   ├── utils/
│   │   ├── scheduler.js           Cron job enforcing distribution schedules
│   │   └── seedUsers.js           Creates default operator/user accounts
│   ├── sql/schema.sql             Full MySQL schema + seed data
│   ├── server.js                  Express + WebSocket entrypoint
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   └── dashboard/schedule/page.tsx
│   ├── components/                TankGauge, FlowChart, ValveControl, etc.
│   ├── context/                   AuthContext, ThemeContext
│   ├── lib/                       api.ts, useLiveSocket.ts
│   └── package.json
└── docs/
    ├── API.md
    └── DEPLOYMENT.md
```

---

## 3. Feature Checklist

| Feature | Status |
|---|---|
| Live dashboard (tank, flow, wards, light) | ✅ WebSocket push every poll cycle |
| Tank gauge (animated) | ✅ `TankGauge.tsx` |
| Flow rate | ✅ live card |
| Remaining water / consumption | ✅ derived from tank level |
| Ward consumption | ✅ `WardConsumption.tsx` |
| Street light status + control | ✅ `StreetLightCard.tsx` |
| Leak & dry-tank detection | ✅ surfaced via `AlertBanner.tsx` + DB `alerts` table |
| Real-time charts | ✅ Chart.js in `FlowChart.tsx` |
| Operator login | ✅ JWT, `/login` |
| Schedule water distribution | ✅ `schedule` routes + cron `scheduler.js` |
| Export PDF / Excel | ✅ `pdfkit` / `exceljs` in `export.routes.js` |
| Dark / light theme | ✅ `ThemeContext.tsx` |
| Responsive design | ✅ Tailwind mobile-first grid |
| Role-based access control | ✅ enforced in middleware, not just UI |
| Notification system | ✅ `react-hot-toast` + WebSocket alert push |

---

## 4. Quick Start

See **`docs/DEPLOYMENT.md`** for the full step-by-step guide. Summary:

```bash
# 1. Database
mysql -u root -p < backend/sql/schema.sql

# 2. Backend
cd backend
cp .env.example .env   # edit DB + ESP32_IP + JWT_SECRET
npm install
npm run seed            # creates demo operator/user accounts
npm run dev

# 3. Frontend
cd ../frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Visit `http://localhost:3000` → sign in with a seeded account.

---

## 5. Demo Accounts (created by `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Operator | operator@iot.local | Operator@123 |
| Viewer (User) | viewer@iot.local | Viewer@123 |

**Change these before any real deployment.**
