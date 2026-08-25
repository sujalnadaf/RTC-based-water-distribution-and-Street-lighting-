-- ============================================================
-- RTC-Based Water Distribution & Street Lighting System
-- Database schema (MySQL 8+)
-- ============================================================

CREATE DATABASE IF NOT EXISTS water_iot_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE water_iot_db;

-- ------------------------------------------------------------
-- Users & Roles (RBAC: 'user' = read-only, 'operator' = full control)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('user','operator') NOT NULL DEFAULT 'user',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL
);

-- ------------------------------------------------------------
-- Devices (supports multiple ESP32 nodes if the project scales)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  device_key    VARCHAR(64)  NOT NULL UNIQUE,      -- e.g. 'esp32-main'
  name          VARCHAR(100) NOT NULL DEFAULT 'ESP32 Main Controller',
  ip_address    VARCHAR(45)  NOT NULL,
  tank_capacity_ml INT NOT NULL DEFAULT 5000,
  is_online     BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at  TIMESTAMP NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Live/point-in-time sensor snapshots (polled every ~5-10s)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sensor_logs (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  device_id         INT NOT NULL,
  tank_level_ml     INT NOT NULL,
  flow_rate_lpm     DECIMAL(6,2) NOT NULL DEFAULT 0,
  ward1_ml          INT NOT NULL DEFAULT 0,
  ward2_ml          INT NOT NULL DEFAULT 0,
  ward3_ml          INT NOT NULL DEFAULT 0,
  active_ward       TINYINT NOT NULL DEFAULT 0,   -- 0 = none, 1/2/3 = ward
  street_light      BOOLEAN NOT NULL DEFAULT FALSE,
  light_mode        ENUM('auto','manual_on','manual_off') NOT NULL DEFAULT 'auto',
  leak_detected     BOOLEAN NOT NULL DEFAULT FALSE,
  dry_tank          BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  INDEX idx_device_time (device_id, recorded_at)
);

-- ------------------------------------------------------------
-- Ward master data
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wards (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  device_id     INT NOT NULL,
  ward_number   TINYINT NOT NULL,          -- 1, 2, 3
  ward_name     VARCHAR(100) NOT NULL,     -- e.g. "Ward 1 - North Colony"
  valve_gpio    VARCHAR(10),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_device_ward (device_id, ward_number)
);

-- ------------------------------------------------------------
-- Distribution schedules (operator-defined, time-based)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedules (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  device_id     INT NOT NULL,
  ward_number   TINYINT NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  days_mask     VARCHAR(20) NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI,SAT,SUN',
  quota_ml      INT NOT NULL DEFAULT 1500,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    INT NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ------------------------------------------------------------
-- Manual control / audit trail (every operator action is logged)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS control_actions (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  device_id     INT NOT NULL,
  user_id       INT NOT NULL,
  action_type   ENUM('valve_open','valve_close','light_on','light_off','light_auto','refill') NOT NULL,
  target_ward   TINYINT NULL,
  result        ENUM('success','failed') NOT NULL DEFAULT 'success',
  notes         VARCHAR(255),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ------------------------------------------------------------
-- Alerts (leak, dry-tank, offline device, etc.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  device_id     INT NOT NULL,
  alert_type    ENUM('leak','dry_tank','device_offline','low_level') NOT NULL,
  severity      ENUM('info','warning','critical') NOT NULL DEFAULT 'warning',
  message       VARCHAR(255) NOT NULL,
  is_resolved   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at   TIMESTAMP NULL,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  INDEX idx_device_resolved (device_id, is_resolved)
);

-- ------------------------------------------------------------
-- Seed data
-- ------------------------------------------------------------
INSERT INTO devices (device_key, name, ip_address, tank_capacity_ml)
VALUES ('esp32-main', 'ESP32 Main Controller', '192.168.1.50', 5000)
ON DUPLICATE KEY UPDATE ip_address = VALUES(ip_address);

INSERT INTO wards (device_id, ward_number, ward_name, valve_gpio) VALUES
 (1, 1, 'Ward 1 - North Colony', 'GPIO25'),
 (1, 2, 'Ward 2 - East Colony',  'GPIO26'),
 (1, 3, 'Ward 3 - South Colony', 'GPIO27')
ON DUPLICATE KEY UPDATE ward_name = VALUES(ward_name);

-- Default operator: email operator@iot.local / password: Operator@123 (bcrypt hash, CHANGE IN PRODUCTION)
-- Default user:     email viewer@iot.local   / password: Viewer@123
-- Password hashes are generated at first run by backend/utils/seedUsers.js (see docs/DEPLOYMENT.md)
