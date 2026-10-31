'use strict';

// server/src/db/pool.js
// Create this file ONLY if the project does not already have one.
// Ask the teammate who set up the database before you fill it in.

const { Pool } = require('pg');

// index.js already loads dotenv, but calling it here too is harmless
// and lets small scripts use this file alone.
require('dotenv').config();

// The "pg" library needs the password to be a string. If it is missing,
// we warn early so the error message is easy to understand.
if (!process.env.DB_PASSWORD) {
  console.warn('[db] DB_PASSWORD is empty. Fill it in server/.env.');
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'unicollab',
});

// Without this handler, an error on an idle connection would crash the server.
pool.on('error', (error) => {
  console.error('[db] Unexpected error on an idle connection:', error.message);
});

module.exports = pool;