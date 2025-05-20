const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const isEdit = !!id;

const formTitle = document.getElementById('form-title');
const nameInput = document.getElementById('student-name');
const gradeInput = document.getElementById('student-grade');
const subjectInput = document.getElementById('student-subject');
const memoInput = document.getElementById('student-memo');
const saveButton = document.getElementById('save-button');
const cancelButton = document.getElementById('cancel-button');
const schoolId = localStorage.getItem('schoolId');

// 編集モードの場合、既存のデータを読み込む
if (isEdit) {
  formTitle.textContent = '生徒情報編集';
  fetch('/students')
    .then(res => res.json())
    .then(students => {
      const student = students.find(s => s.id === id);
      if (student) {
        nameInput.value = student.name || '';
        gradeInput.value = student.grade || '';
        subjectInput.value = student.subject || '';
        memoInput.value = student.memo || '';
      }
    });
}

// 保存ボタンの処理
saveButton.onclick = async () => {
  const student = {
    name: nameInput.value.trim(),
    grade: gradeInput.value.trim(),
    subject: subjectInput.value.trim(),
    memo: memoInput ? memoInput.value.trim() : "",
    schoolId: schoolId
  };

  if (!student.name || !student.grade || !student.subject) {
    alert('名前、学年、志望校は必須項目です。');
    return;
  }

  try {
    if (isEdit) {
      // 編集時はPUT
      await fetch(`/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
      });
    } else {
      // 新規追加時はPOST
      await fetch('/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
      });
    }
    window.location.href = 'index.html';
  } catch (error) {
    alert('保存に失敗しました。');
    console.error('Error:', error);
  }
};

// キャンセルボタンの処理
cancelButton.onclick = () => {
  if (confirm('入力内容は保存されません。よろしいですか？')) {
    window.location.href = 'index.html';
  }
}; 