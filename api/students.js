import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // 例: /api/students?school_id=1
    const { school_id } = req.query;
    if (!school_id) {
      return res.status(400).json({ error: 'school_id is required' });
    }
    try {
      const { rows } = await pool.query(
        'SELECT * FROM students WHERE school_id = $1 ORDER BY grade DESC, name ASC',
        [school_id]
      );
      res.status(200).json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else if (req.method === 'POST') {
    // 例: { name, grade, subject, memo, school_id }
    const { name, grade, subject, memo, school_id } = req.body;
    if (!name || !grade || !school_id) {
      return res.status(400).json({ error: 'name, grade, school_id are required' });
    }
    try {
      const result = await pool.query(
        'INSERT INTO students (school_id, name, grade, subject, memo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [school_id, name, grade, subject, memo]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 