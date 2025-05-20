console.log('app.js loaded');
let tableBody;
let recentRecordsList;

// 認証状態を確認する関数
async function checkAuth() {
  try {
    const response = await fetch('/auth/status');
    const data = await response.json();
    console.log('Auth status:', data);
    return data.loggedIn && data.schoolId;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}

window.onload = async () => {
  console.log('window.onload start');
  
  // localStorageとセッションの両方をチェック
  if (!localStorage.getItem('loggedIn') || !localStorage.getItem('schoolId')) {
    console.log('not logged in (localStorage), redirecting to login.html');
    document.body.style.display = 'none';
    window.location.href = 'login.html';
    return;
  }

  // セッションの認証状態を確認
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) {
    console.log('not logged in (session), redirecting to login.html');
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('schoolId');
    document.body.style.display = 'none';
    window.location.href = 'login.html';
    return;
  }

  document.body.style.display = 'block';
  tableBody = document.getElementById('student-table-body');
  recentRecordsList = document.getElementById('recent-records-list');
  console.log('tableBody:', tableBody);
  console.log('recentRecordsList:', recentRecordsList);
  if (!tableBody) {
    console.error('student-table-bodyが見つかりません');
    return;
  }
  if (!recentRecordsList) {
    console.error('recent-records-listが見つかりません');
    return;
  }
  // ログアウトボタンのイベント設定
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.onclick = async () => {
      console.log('logoutButton clicked');
      await fetch('/auth/logout');
      localStorage.removeItem('loggedIn');
      localStorage.removeItem('schoolId');
      document.body.style.display = 'none';
      window.location.href = 'login.html';
    };
  } else {
    console.error('logoutButtonが見つかりません');
  }
  loadStudents();
};

const nameInput = document.getElementById('student-name');
const gradeInput = document.getElementById('student-grade');
const subjectInput = document.getElementById('student-subject');
const memoInput = document.getElementById('student-memo');
const buttonAdd = document.getElementById('add-button');

const schoolId = localStorage.getItem('schoolId');
console.log('schoolId:', schoolId);

function addStudentToTable(student) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${student.name}</td>
    <td>${student.grade}</td>
    <td>${student.subject}</td>
    <td>
      <button class="edit-button" onclick="location.href='student-form.html?id=${student.id}'">
        生徒情報
      </button>
      <button class="detail-button" onclick="location.href='student.html?id=${student.id}'">
        指導記録
      </button>
      <button class="progress-button" onclick="location.href='textbook-progress.html?id=${student.id}'">
        進捗管理
      </button>
      <button class="delete-button" onclick="deleteStudent('${student.id}')">
        削除
      </button>
    </td>
  `;
  tableBody.appendChild(tr);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

function updateRecentRecords(students) {
  console.log('updateRecentRecords called');
  // 全生徒の記録を取得して日付順にソート
  const allRecords = students.flatMap(student => 
    student.records.map(record => ({
      ...record,
      studentName: student.name,
      studentId: student.id
    }))
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  // 最新の10件を表示
  const recentRecords = allRecords.slice(0, 10);
  
  if (!recentRecordsList) {
    console.error('recent-records-listが見つかりません');
    return;
  }
  recentRecordsList.innerHTML = recentRecords.map(record => `
    <div class="record-item" onclick="location.href='student.html?id=${record.studentId}'" style="cursor: pointer;">
      <div class="student-name">${record.studentName}</div>
      <div class="record-date">${formatDate(record.date)}</div>
      <div class="record-content">${record.content}</div>
      ${record.teacher ? `<div class="teacher-name">講師: ${record.teacher}</div>` : ''}
    </div>
  `).join('');
  console.log('recentRecordsList updated');
}

function loadStudentsSorted(students) {
  // 学年の降順（高い順）→名前のあいうえお順
  students.sort((a, b) => {
    // 学年を数値として比較（降順）
    const gradeA = parseInt(a.grade, 10);
    const gradeB = parseInt(b.grade, 10);
    if (gradeA !== gradeB) {
      return gradeB - gradeA; // 高い順
    }
    // 学年が同じ場合は名前のあいうえお順
    return a.name.localeCompare(b.name, 'ja');
  });
  tableBody.innerHTML = '';
  students.forEach(addStudentToTable);
  updateRecentRecords(students);
}

async function loadStudents() {
  try {
    console.log('loadStudents called');
    console.log('schoolId:', schoolId);
    const res = await fetch('/students');
    if (!res.ok) {
      const errorText = await res.text();
      console.error('API error response:', errorText);
      throw new Error('API response not ok');
    }
    const students = await res.json();
    console.log('students:', students);
    loadStudentsSorted(students);
  } catch (error) {
    console.error('Error loading students:', error);
    alert('生徒データの読み込みに失敗しました');
  }
}

// 追加ボタンのイベントリスナーを設定（ボタンが存在する場合のみ）
if (buttonAdd) {
  buttonAdd.onclick = async () => {
    const student = {
      name: nameInput.value.trim(),
      grade: gradeInput.value.trim(),
      subject: subjectInput.value.trim(),
      schoolId: schoolId
    };
    console.log('add student:', student);
    if (!student.name || !student.grade || !student.subject) {
      alert('名前、学年、志望校を入力してください');
      return;
    }
    try {
      const response = await fetch('/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '生徒の追加に失敗しました');
      }
      nameInput.value = gradeInput.value = subjectInput.value = '';
      if (memoInput) memoInput.value = '';
      await loadStudents();
    } catch (error) {
      console.error('Error:', error);
      alert(error.message || '生徒の追加に失敗しました');
    }
  };
}

// 生徒を削除する関数
async function deleteStudent(studentId) {
  if (!confirm('この生徒を削除してもよろしいですか？\n※関連するすべての記録と参考書情報も削除されます。')) {
    return;
  }

  try {
    const response = await fetch(`/students/${studentId}?schoolId=${encodeURIComponent(schoolId)}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      // 削除成功時は一覧を更新
      await loadStudents();
    } else {
      const error = await response.json();
      alert(error.error || '生徒の削除に失敗しました');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('生徒の削除に失敗しました');
  }
}
