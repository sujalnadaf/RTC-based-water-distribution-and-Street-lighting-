const { Pool } = require('pg');
require('dotenv').config();

const pgPool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',

  ssl:
    process.env.DB_SSL === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : false,

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});


// =====================================================
// MYSQL ? -> POSTGRESQL $1, $2, $3...
// =====================================================

function convertPlaceholders(sql) {
  let index = 0;

  return sql.replace(
    /\?/g,
    () => `$${++index}`
  );
}


// =====================================================
// DETECT QUERIES THAT RETURN ROWS
// =====================================================

function queryReturnsRows(sql) {

  const normalized =
    String(sql)
      .trim()
      .toLowerCase();


  // Normal SELECT
  if (
    normalized.startsWith('select')
  ) {
    return true;
  }


  // PostgreSQL INSERT/UPDATE/DELETE ... RETURNING
  if (
    /\breturning\b/i.test(sql)
  ) {
    return true;
  }


  return false;
}


// =====================================================
// MYSQL-COMPATIBLE DATABASE WRAPPER
// =====================================================

const pool = {

  async query(
    sql,
    params = []
  ) {

    const convertedSql =
      convertPlaceholders(sql);


    const result =
      await pgPool.query(
        convertedSql,
        params
      );


    // -------------------------------------------------
    // SELECT or ... RETURNING *
    //
    // Allows:
    //
    // const [rows] = await pool.query(...)
    // rows[0].id
    // -------------------------------------------------

    if (
      queryReturnsRows(
        convertedSql
      )
    ) {

      return [
        result.rows,
        result.fields,
      ];
    }


    // -------------------------------------------------
    // INSERT / UPDATE / DELETE without RETURNING
    //
    // Keep old MySQL compatibility.
    // -------------------------------------------------

    return [
      {
        affectedRows:
          result.rowCount,

        rowCount:
          result.rowCount,

        rows:
          result.rows,
      },

      result.fields,
    ];
  },


  // ===================================================
  // TRANSACTION / CONNECTION SUPPORT
  // ===================================================

  async getConnection() {

    const client =
      await pgPool.connect();


    return {

      query: async (
        sql,
        params = []
      ) => {

        const convertedSql =
          convertPlaceholders(sql);


        const result =
          await client.query(
            convertedSql,
            params
          );


        if (
          queryReturnsRows(
            convertedSql
          )
        ) {

          return [
            result.rows,
            result.fields,
          ];
        }


        return [
          {
            affectedRows:
              result.rowCount,

            rowCount:
              result.rowCount,

            rows:
              result.rows,
          },

          result.fields,
        ];
      },


      release: () => {
        client.release();
      },
    };
  },
};


// =====================================================
// DATABASE CONNECTION TEST
// =====================================================

async function testConnection() {

  let client;


  try {

    client =
      await pgPool.connect();


    const result =
      await client.query(
        'SELECT NOW() AS current_time'
      );


    console.log(
      '[DB] PostgreSQL connected successfully:',
      result.rows[0].current_time
    );

  } catch (err) {

    console.error(
      '[DB] PostgreSQL connection failed:',
      err.message
    );


    process.exit(1);

  } finally {

    if (client) {
      client.release();
    }
  }
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  pool,
  testConnection,
  pgPool,
};