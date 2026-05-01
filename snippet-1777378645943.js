// backend/src/config/db.js
import pg from 'pg';
import Redis from 'ioredis';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const query = (text, params) => pool.query(text, params);

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export default pool;