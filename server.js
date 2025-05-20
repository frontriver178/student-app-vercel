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
  if (!token) return res.status(401).json({ error: '未ログイン' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.schoolId = payload.schoolId;
    next();
  } catch (err) {
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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

// 生徒データ関連のエンドポイント
app.get('/students', ensureLoggedIn, async (req, res) => {
  try {
    // req.schoolIdはschool_id（文字列）なので、まずschoolsテーブルからidを取得
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id')
      .eq('school_id', req.schoolId)
      .maybeSingle();
    if (schoolError || !school) {
      return res.status(400).json({ error: '塾情報が見つかりません' });
    }
    const schoolDbId = school.id;
    // studentsテーブルから該当塾の生徒を取得
    const { data: students, error } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', schoolDbId);
    if (error) throw error;
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

const filePath = './public/students.json';
const schoolsFilePath = './public/schools.json';

// 生徒データを読み込む関数
function loadStudents() {
    try {
        if (!fs.existsSync(filePath)) {
            // ファイルが存在しない場合は空の配列を保存
            fs.writeFileSync(filePath, JSON.stringify([], null, 2));
            return [];
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading students:', error);
        return [];
    }
}

// 生徒データを保存する関数
function saveStudents(students) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(students, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving students:', error);
        throw error;
    }
}

// 塾アカウントを読み込む関数
function loadSchools() {
    try {
        if (!fs.existsSync(schoolsFilePath)) {
            fs.writeFileSync(schoolsFilePath, JSON.stringify([], null, 2));
            return [];
        }
        const data = fs.readFileSync(schoolsFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading schools:', error);
        return [];
    }
}

// 塾アカウントを保存する関数
function saveSchools(schools) {
    try {
        fs.writeFileSync(schoolsFilePath, JSON.stringify(schools, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving schools:', error);
        throw error;
    }
}

// 特定の生徒を取得
app.get('/students/:id', (req, res) => {
    try {
        const students = loadStudents();
        const student = students.find(s => s.id === req.params.id);
        if (student) {
            res.json(student);
        } else {
            res.status(404).json({ error: '生徒が見つかりません' });
        }
    } catch (error) {
        console.error('Error in GET /students/:id:', error);
        res.status(500).json({ error: '生徒データの取得に失敗しました' });
    }
});

// 新しい生徒を追加（schoolIdを付与）
app.post('/students', (req, res) => {
    try {
        const students = loadStudents();
        const { name, grade, subject, memo, schoolId } = req.body;
        console.log('POST /students body:', req.body);
        if (!name || !grade || !subject || !schoolId) {
            console.log('Missing fields:', { name, grade, subject, schoolId });
            return res.status(400).json({ error: '全ての項目を入力してください' });
        }
        const student = {
            id: Date.now().toString(),
            name,
            grade,
            subject,
            memo: memo || '',
            schoolId,
            records: [],
            textbooks: []
        };
        students.push(student);
        saveStudents(students);
        res.json(student);
    } catch (error) {
        console.error('Error in POST /students:', error);
        res.status(500).json({ error: '生徒の追加に失敗しました' });
    }
});

// 生徒削除（schoolIdチェック）
app.delete('/students/:id', (req, res) => {
    try {
        const students = loadStudents();
        const { id } = req.params;
        const { schoolId } = req.query;
        const index = students.findIndex(s => s.id === id && s.schoolId === schoolId);
        if (index === -1) {
            return res.status(404).json({ error: '生徒が見つかりません' });
        }
        students.splice(index, 1);
        saveStudents(students);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: '生徒の削除に失敗しました' });
    }
});

// 生徒情報を更新（schoolIdチェック）
app.put('/students/:id', (req, res) => {
    const studentId = req.params.id;
    const updatedData = req.body;
    try {
        const students = loadStudents();
        const index = students.findIndex(s => s.id === studentId && s.schoolId === updatedData.schoolId);
        if (index === -1) {
            return res.status(404).json({ error: '生徒が見つかりません' });
        }
        const updatedStudent = {
            ...students[index],
            ...updatedData,
            id: studentId,
            records: students[index].records || [],
            textbooks: students[index].textbooks || [],
            schoolId: students[index].schoolId
        };
        students[index] = updatedStudent;
        saveStudents(students);
        res.json(updatedStudent);
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(500).json({ error: '生徒情報の更新に失敗しました' });
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
