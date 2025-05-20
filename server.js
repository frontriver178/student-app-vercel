import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

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

// セッション設定
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 // 24時間
  }
}));

// リクエストログ（動作確認用）
app.use((req, res, next) => {
  console.log(`▶ ${req.method} ${req.url}  sessionID=${req.sessionID}  schoolId=${req.session.schoolId}`);
  next();
});

// ミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 認証チェック用ミドルウェア
const ensureLoggedIn = (req, res, next) => {
  if (req.session.schoolId) {
    return next();
  }
  return res.status(401).send('ログインが必要です');
};

const ensureLoggedInRedirect = (req, res, next) => {
  if (req.session.schoolId) {
    return next();
  }
  return res.redirect('/login.html');
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
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('データベースエラーが発生しました');
    }

    if (!school) {
      console.log('No matching school found');
      return res.status(400).send('ログインに失敗しました');
    }

    const passwordMatch = await bcrypt.compare(password, school.password);
    if (!passwordMatch) {
      console.log('Password does not match');
      return res.status(400).send('ログインに失敗しました');
    }

    // セッション再生成
    req.session.regenerate(err => {
      if (err) {
        console.error('Session regenerate error:', err);
        return res.status(500).send('セッション再生成に失敗しました');
      }

      // 新しいセッションに学校IDをセット
      req.session.schoolId = school.schoolId;

      // 保存してからJSONレスポンスを返す
      req.session.save(err => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).send('セッション保存に失敗しました');
        }
        res.json({ 
          success: true,
          sessionId: req.sessionID,
          schoolId: req.session.schoolId
        });
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'ログイン処理中にエラーが発生しました', error: String(error), stack: error.stack });
  }
});

app.get('/auth/status', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    schoolId: req.session.schoolId,
    loggedIn: !!req.session.schoolId
  });
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login.html'));
});

// 生徒データ関連のエンドポイント
app.get('/students', ensureLoggedIn, (req, res) => {
    try {
        console.log('GET /students called, schoolId:', req.session.schoolId);
        const students = loadStudents();
        console.log('Loaded students:', students);
        const filtered = students.filter(s => s.schoolId === req.session.schoolId);
        console.log('Filtered students:', filtered);
        res.json(filtered);
    } catch (error) {
        console.error('Error in GET /students:', error);
        res.status(500).json({ error: '生徒データの取得に失敗しました' });
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
app.get('/schools', (req, res) => {
    try {
        const schools = loadSchools();
        res.json(schools);
    } catch (error) {
        res.status(500).json({ error: '塾アカウントの取得に失敗しました' });
    }
});

// 塾アカウント新規発行
app.post('/schools', async (req, res) => {
    try {
        const schools = loadSchools();
        const { schoolId, password, name } = req.body;
        if (!schoolId || !password || !name) {
            return res.status(400).json({ error: '全ての項目を入力してください' });
        }
        if (schools.find(s => s.schoolId === schoolId)) {
            return res.status(400).json({ error: '同じ塾IDが既に存在します' });
        }
        // パスワードをハッシュ化
        const hash = await bcrypt.hash(password, 10);
        const newSchool = { schoolId, password: hash, name };
        schools.push(newSchool);
        saveSchools(schools);
        res.json(newSchool);
    } catch (error) {
        res.status(500).json({ error: '塾アカウントの発行に失敗しました' });
    }
});

// 塾アカウント削除
app.delete('/schools/:schoolId', (req, res) => {
    try {
        const schools = loadSchools();
        const idx = schools.findIndex(s => s.schoolId === req.params.schoolId);
        if (idx === -1) {
            return res.status(404).json({ error: '塾IDが見つかりません' });
        }
        schools.splice(idx, 1);
        saveSchools(schools);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: '塾アカウントの削除に失敗しました' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Vercel用のエクスポート
export default app;
