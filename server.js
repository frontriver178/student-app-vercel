import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3004;

// __dirname polyfill for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabaseクライアントの初期化
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// JWT認証ミドルウェア
function ensureLoggedIn(req, res, next) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;
  console.log('ensureLoggedIn: token =', token);
  if (!token) return res.status(401).json({ error: '未ログイン' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    console.log('ensureLoggedIn: payload =', payload);
    req.schoolId = payload.schoolId;
    next();
  } catch (err) {
    console.error('ensureLoggedIn: JWT verify error', err);
    return res.status(401).json({ error: '認証エラー' });
  }
}

const ensureLoggedInRedirect = (req, res, next) => {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;
  if (!token) return res.redirect('/login.html');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.schoolId = payload.schoolId;
    next();
  } catch (err) {
    return res.redirect('/login.html');
  }
};

// ルーティング
app.get('/', ensureLoggedInRedirect, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

// 認証関連のエンドポイント
app.post('/auth/login', async (req, res) => {
  const { schoolId, password } = req.body;
  try {
    console.log('Login attempt for schoolId:', schoolId);
    // Supabaseから学校データを取得
    const { data: school, error } = await supabase
      .from('schools')
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle();
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'データベースエラーが発生しました', details: error });
    }
    if (!school) {
      console.log('No matching school found');
      return res.status(401).json({ error: 'ログインに失敗しました（塾IDまたはパスワードが間違っています）' });
    }
    const passwordMatch = await bcrypt.compare(password, school.password);
    if (!passwordMatch) {
      console.log('Password does not match');
      return res.status(401).json({ error: 'ログインに失敗しました（塾IDまたはパスワードが間違っています）' });
    }
    // JWT発行
    const token = jwt.sign({ schoolId: school.school_id }, JWT_SECRET, { expiresIn: '1d' });
    res.setHeader('Set-Cookie', cookie.serialize('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 60 * 24 // 1日
    }));
    res.json({ success: true, schoolId: school.school_id });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'ログイン処理中にエラーが発生しました',
      details: String(error),
      stack: error.stack 
    });
  }
});

app.get('/auth/status', (req, res) => {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;
  if (!token) return res.json({ loggedIn: false });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ loggedIn: true, schoolId: payload.schoolId });
  } catch (err) {
    res.json({ loggedIn: false });
  }
});

app.get('/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', cookie.serialize('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0
  }));
  res.redirect('/login.html');
});

// 生徒一覧取得
app.get('/students', ensureLoggedIn, async (req, res) => {
  try {
    console.log('GET /students called with schoolId:', req.schoolId);
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id')
      .eq('school_id', req.schoolId)
      .maybeSingle();
    if (schoolError || !school) {
      console.error('School lookup error:', schoolError);
      return res.status(400).json({ error: '塾情報が見つかりません' });
    }
    const schoolDbId = school.id;
    const { data: students, error } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', schoolDbId);
    if (error) throw error;
    res.json(students || []);
  } catch (error) {
    console.error('GET /students error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// 生徒追加
app.post('/students', ensureLoggedIn, async (req, res) => {
  try {
    const { name, grade, subject, memo } = req.body;
    if (!name || !grade || !subject) {
      return res.status(400).json({ error: '全ての項目を入力してください' });
    }
    // schoolIdはJWTから取得
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id')
      .eq('school_id', req.schoolId)
      .maybeSingle();
    if (schoolError || !school) {
      return res.status(400).json({ error: '塾情報が見つかりません' });
    }
    const schoolDbId = school.id;
    const { data, error } = await supabase
      .from('students')
      .insert([{ school_id: schoolDbId, name, grade, subject, memo }])
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('POST /students error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// 生徒削除
app.delete('/students/:id', ensureLoggedIn, async (req, res) => {
  try {
    const studentId = req.params.id;
    // schoolIdはJWTから取得
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id')
      .eq('school_id', req.schoolId)
      .maybeSingle();
    if (schoolError || !school) {
      return res.status(400).json({ error: '塾情報が見つかりません' });
    }
    const schoolDbId = school.id;
    // 生徒が該当塾のものかチェック
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, school_id')
      .eq('id', studentId)
      .maybeSingle();
    if (studentError || !student || student.school_id !== schoolDbId) {
      return res.status(404).json({ error: '生徒が見つかりません' });
    }
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /students error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// 生徒情報更新
app.put('/students/:id', ensureLoggedIn, async (req, res) => {
  try {
    const studentId = req.params.id;
    const updatedData = req.body;
    // schoolIdはJWTから取得
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id')
      .eq('school_id', req.schoolId)
      .maybeSingle();
    if (schoolError || !school) {
      return res.status(400).json({ error: '塾情報が見つかりません' });
    }
    const schoolDbId = school.id;
    // 生徒が該当塾のものかチェック
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, school_id')
      .eq('id', studentId)
      .maybeSingle();
    if (studentError || !student || student.school_id !== schoolDbId) {
      return res.status(404).json({ error: '生徒が見つかりません' });
    }
    const { data, error } = await supabase
      .from('students')
      .update(updatedData)
      .eq('id', studentId)
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('PUT /students error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// 指導記録を追加
app.post('/students/:id/records', (req, res) => {
    try {
        const students = loadStudents();
        const student = students.find(s => s.id === req.params.id);
        if (student) {
            const record = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                content: req.body.content,
                teacher: req.body.teacher
            };
            student.records.push(record);
            saveStudents(students);
            res.json(record);
        } else {
            res.status(404).json({ error: '生徒が見つかりません' });
        }
    } catch (error) {
        console.error('Error in POST /students/:id/records:', error);
        res.status(500).json({ error: '指導記録の追加に失敗しました' });
    }
});

// 参考書を追加
app.post('/students/:id/textbooks', (req, res) => {
    try {
        const students = loadStudents();
        const student = students.find(s => s.id === req.params.id);
        if (student) {
            const textbook = {
                id: Date.now().toString(),
                title: req.body.title,
                totalPages: req.body.totalPages,
                currentPage: req.body.currentPage || 0
            };
            student.textbooks.push(textbook);
            saveStudents(students);
            res.json(textbook);
        } else {
            res.status(404).json({ error: '生徒が見つかりません' });
        }
    } catch (error) {
        console.error('Error in POST /students/:id/textbooks:', error);
        res.status(500).json({ error: '参考書の追加に失敗しました' });
    }
});

// 参考書の進捗を更新
app.patch('/students/:studentId/textbooks/:textbookId', (req, res) => {
    const { studentId, textbookId } = req.params;
    const { progress } = req.body;

    const students = loadStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) {
        return res.status(404).json({ error: '生徒が見つかりません' });
    }

    const textbook = student.textbooks.find(t => t.id === textbookId);
    if (!textbook) {
        return res.status(404).json({ error: '参考書が見つかりません' });
    }

    textbook.progress = progress;
    saveStudents(students);
    res.json(textbook);
});

// 参考書を削除
app.delete('/students/:studentId/textbooks/:textbookId', (req, res) => {
    const { studentId, textbookId } = req.params;

    const students = loadStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) {
        return res.status(404).json({ error: '生徒が見つかりません' });
    }

    const textbookIndex = student.textbooks.findIndex(t => t.id === textbookId);
    if (textbookIndex === -1) {
        return res.status(404).json({ error: '参考書が見つかりません' });
    }

    // 参考書を削除
    student.textbooks.splice(textbookIndex, 1);
    saveStudents(students);
    res.status(204).send(); // 削除成功時は204 No Contentを返す
});

// 特定の指導記録を取得
app.get('/students/:studentId/records/:recordId', (req, res) => {
    const { studentId, recordId } = req.params;
    const students = loadStudents();
    const student = students.find(s => s.id === studentId);
    
    if (!student) {
        return res.status(404).json({ error: '生徒が見つかりません' });
    }

    const record = student.records.find(r => r.id === recordId);
    if (!record) {
        return res.status(404).json({ error: '指導記録が見つかりません' });
    }

    res.json(record);
});

// 指導記録を更新
app.put('/students/:studentId/records/:recordId', (req, res) => {
    const { studentId, recordId } = req.params;
    const { content, teacher } = req.body;

    const students = loadStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) {
        return res.status(404).json({ error: '生徒が見つかりません' });
    }

    const record = student.records.find(r => r.id === recordId);
    if (!record) {
        return res.status(404).json({ error: '指導記録が見つかりません' });
    }

    record.content = content;
    record.teacher = teacher;
    saveStudents(students);
    res.json(record);
});

// 指導記録を削除
app.delete('/students/:studentId/records/:recordId', (req, res) => {
    const { studentId, recordId } = req.params;

    const students = loadStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) {
        return res.status(404).json({ error: '生徒が見つかりません' });
    }

    const recordIndex = student.records.findIndex(r => r.id === recordId);
    if (recordIndex === -1) {
        return res.status(404).json({ error: '指導記録が見つかりません' });
    }

    student.records.splice(recordIndex, 1);
    saveStudents(students);
    res.status(204).send();
});

// 塾アカウント一覧取得
app.get('/schools', async (req, res) => {
  try {
    const { data, error } = await supabase.from('schools').select('school_id, name');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// 塾アカウント新規発行
app.post('/schools', async (req, res) => {
  try {
    console.log('POST /schools リクエストボディ:', req.body);
    const { school_id, password, name } = req.body;
    
    // バリデーション
    if (!school_id || !password || !name) {
      console.log('バリデーションエラー:', { school_id, name, password: '***' });
      return res.status(400).json({ error: '全ての項目を入力してください' });
    }

    // 既存の塾IDチェック
    const { data: existingSchool, error: checkError } = await supabase
      .from('schools')
      .select('school_id')
      .eq('school_id', school_id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('既存塾チェックエラー:', checkError);
      throw checkError;
    }

    if (existingSchool) {
      return res.status(400).json({ error: '同じ塾IDが既に存在します' });
    }

    // パスワードをハッシュ化
    const hash = await bcrypt.hash(password, 10);

    // 新規塾を追加
    const { data, error } = await supabase
      .from('schools')
      .insert([{ school_id, password: hash, name }])
      .select('school_id, name')
      .single();

    if (error) {
      console.error('Supabase挿入エラー:', error);
      throw error;
    }

    console.log('塾アカウント作成成功:', { school_id: data.school_id, name: data.name });
    res.json(data);
  } catch (error) {
    console.error('POST /schools エラー詳細:', error);
    res.status(500).json({ 
      error: '塾アカウントの発行に失敗しました',
      details: String(error),
      code: error.code
    });
  }
});

// 塾アカウント削除
app.delete('/schools/:school_id', async (req, res) => {
  try {
    const { school_id } = req.params;
    if (!school_id) {
      return res.status(400).json({ error: 'school_id is required' });
    }
    const { error } = await supabase.from('schools').delete().eq('school_id', school_id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Vercel用のエクスポート
export default app;
