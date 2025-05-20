-- 塾アカウント
CREATE TABLE schools (
    id SERIAL PRIMARY KEY,
    school_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 生徒
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    grade INTEGER NOT NULL,
    subject VARCHAR(255),
    memo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 指導記録
CREATE TABLE records (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    content TEXT NOT NULL,
    teacher VARCHAR(255)
);

-- 参考書進捗
CREATE TABLE textbooks (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    total_pages INTEGER,
    current_page INTEGER,
    progress INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 管理者（必要なら）
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 塾アカウント（パスワードは「testpass」をbcryptでハッシュ化した例）
INSERT INTO schools (school_id, name, password_hash) VALUES
  ('naseva', 'ナセバ進学予備校', '$2b$10$E5OImHLs8jhhW3hwK68nke8JkiQwcIAjQQJM6MAJBobYvY4tY1bZu'),
  ('front', 'コンソメ塾', '$2b$10$E5OImHLs8jhhW3hwK68nke8JkiQwcIAjQQJM6MAJBobYvY4tY1bZu');

-- 生徒
INSERT INTO students (school_id, name, grade, subject, memo) VALUES
  (1, '表川知由', 3, '大阪大学', 'メモメモメオも萌え萌え萌え萌え'),
  (1, '山田太郎', 2, '京都大学', ''),
  (2, '佐藤花子', 1, '東京大学', 'がんばれ！');

-- 指導記録
INSERT INTO records (student_id, date, content, teacher) VALUES
  (1, '2025-05-19 16:32:18', 'うんこ', 'ちんこ'),
  (1, '2025-05-19 16:38:21', 'おしっこを飲みたい', 'ヒカキン'),
  (1, '2025-05-19 16:38:28', 'うんち', 'ヒカキン'),
  (2, '2025-05-20 10:00:00', '英語長文演習', '田中先生');

-- 参考書進捗
INSERT INTO textbooks (student_id, title, total_pages, current_page, progress) VALUES
  (1, '青チャート', 300, 237, 79),
  (2, '赤本', 200, 50, 25),
  (3, 'ターゲット1900', 400, 100, 25);

-- 管理者
INSERT INTO admins (username, password_hash) VALUES
  ('admin', '$2b$10$E5OImHLs8jhhW3hwK68nke8JkiQwcIAjQQJM6MAJBobYvY4tY1bZu'); 