const tableBody = document.getElementById('schools-table-body');
const addButton = document.getElementById('add-button');
const nameInput = document.getElementById('school-name');
const idInput = document.getElementById('school-id');
const pwInput = document.getElementById('school-password');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');

async function loadSchools() {
  errorMessage.textContent = '';
  successMessage.textContent = '';
  try {
    const res = await fetch('/schools');
    const schools = await res.json();
    tableBody.innerHTML = '';
    schools.forEach(school => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${school.name}</td>
        <td>${school.school_id}</td>
        <td>${school.password}</td>
        <td><button class="delete-button" onclick="deleteSchool('${school.school_id}')">削除</button></td>
      `;
      tableBody.appendChild(tr);
    });
  } catch (err) {
    errorMessage.textContent = '一覧の取得に失敗しました。';
  }
}

window.onload = loadSchools;

addButton.onclick = async () => {
  const name = nameInput.value.trim();
  const schoolId = idInput.value.trim();
  const password = pwInput.value.trim();
  errorMessage.textContent = '';
  successMessage.textContent = '';

  if (!name || !schoolId || !password) {
    errorMessage.textContent = '全ての項目を入力してください。';
    return;
  }

  try {
    const res = await fetch('/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, school_id: schoolId, password })
    });
    if (res.ok) {
      successMessage.textContent = '塾アカウントを発行しました。';
      nameInput.value = idInput.value = pwInput.value = '';
      await loadSchools();
    } else {
      const data = await res.json();
      errorMessage.textContent = data.error || '発行に失敗しました。';
    }
  } catch (err) {
    errorMessage.textContent = '通信エラーが発生しました。';
  }
};

window.deleteSchool = async (schoolId) => {
  if (!confirm('本当に削除しますか？')) return;
  errorMessage.textContent = '';
  successMessage.textContent = '';
  try {
    const res = await fetch(`/schools/${schoolId}`, { method: 'DELETE' });
    if (res.ok) {
      successMessage.textContent = '削除しました。';
      await loadSchools();
    } else {
      const data = await res.json();
      errorMessage.textContent = data.error || '削除に失敗しました。';
    }
  } catch (err) {
    errorMessage.textContent = '通信エラーが発生しました。';
  }
}; 