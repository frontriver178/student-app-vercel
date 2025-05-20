import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // 例: /api/textbooks?student_id=1
    const { student_id } = req.query;
    if (!student_id) {
      return res.status(400).json({ error: 'student_id is required' });
    }
    const { rows } = await pool.query(
      'SELECT * FROM textbooks WHERE student_id = $1',
      [student_id]
    );
    res.status(200).json(rows);
  } else if (req.method === 'POST') {
    // 例: { student_id, title, total_pages, current_page, progress }
    const { student_id, title, total_pages, current_page, progress } = req.body;
    if (!student_id || !title) {
      return res.status(400).json({ error: 'student_id, title are required' });
    }
    const result = await pool.query(
      'INSERT INTO textbooks (student_id, title, total_pages, current_page, progress) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [student_id, title, total_pages, current_page, progress]
    );
    res.status(201).json(result.rows[0]);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 