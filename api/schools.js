import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // 全塾一覧
    const { rows } = await pool.query('SELECT id, school_id, name FROM schools');
    res.status(200).json(rows);
  } else if (req.method === 'POST') {
    // 新規塾アカウント作成
    const { school_id, name, password } = req.body;
    if (!school_id || !name || !password) {
      return res.status(400).json({ error: 'school_id, name, password are required' });
    }
    const hash = await bcrypt.hash(password, 10);
    try {
      const result = await pool.query(
        'INSERT INTO schools (school_id, name, password_hash) VALUES ($1, $2, $3) RETURNING id, school_id, name',
        [school_id, name, hash]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 