require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function seed() {
  try {
    const operatorEmail =
      process.env.SEED_OPERATOR_EMAIL || 'operator@iot.local';
    const operatorPassword =
      process.env.SEED_OPERATOR_PASSWORD || 'Operator@123';

    const userEmail =
      process.env.SEED_USER_EMAIL || 'viewer@iot.local';
    const userPassword =
      process.env.SEED_USER_PASSWORD || 'Viewer@123';

    const operatorHash = await bcrypt.hash(operatorPassword, 10);
    const userHash = await bcrypt.hash(userPassword, 10);

    // Operator
    await pool.query(
      `
      INSERT INTO users
      (name,email,password_hash,role)
      VALUES ($1,$2,$3,'operator')
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash
      `,
      [
        'System Operator',
        operatorEmail,
        operatorHash,
      ]
    );

    // Viewer
    await pool.query(
      `
      INSERT INTO users
      (name,email,password_hash,role)
      VALUES ($1,$2,$3,'user')
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash
      `,
      [
        'Read-Only Viewer',
        userEmail,
        userHash,
      ]
    );

    console.log('Seed completed successfully.');
    console.log(
      `Operator : ${operatorEmail} / ${operatorPassword}`
    );
    console.log(
      `Viewer   : ${userEmail} / ${userPassword}`
    );

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();