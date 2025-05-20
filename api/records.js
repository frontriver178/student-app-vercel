import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // 例: /api/records?student_id=1
    const { student_id } = req.query;
    if (!student_id) {
      return res.status(400).json({ error: 'student_id is required' });
    }
    const { rows } = await pool.query(
      'SELECT * FROM records WHERE student_id = $1 ORDER BY date DESC',
      [student_id]
    );
    res.status(200).json(rows);
  } else if (req.method === 'POST') {
    // 例: { student_id, content, teacher }
    const { student_id, content, teacher } = req.body;
    if (!student_id || !content) {
      return res.status(400).json({ error: 'student_id, content are required' });
    }
    const result = await pool.query(
      'INSERT INTO records (student_id, content, teacher) VALUES ($1, $2, $3) RETURNING *',
      [student_id, content, teacher]
    );
    res.status(201).json(result.rows[0]);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 