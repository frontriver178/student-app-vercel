const urlParams = new URLSearchParams(window.location.search);
const studentId = urlParams.get('id');

const nameEl = document.getElementById('student-name');
const gradeEl = document.getElementById('student-grade');
const subjectEl = document.getElementById('student-subject');
const memoEl = document.getElementById('student-memo');
const tbody = document.getElementById('record-table-body');
const dateInput = document.getElementById('record-date');
const teacherInput = document.getElementById('record-teacher');
const contentInput = document.getElementById('record-content');
const addBtn = document.getElementById('record-add');
const charCount = document.getElementById('char-count');

let student;

// 編集中の記録IDを保持する変数
let editingRecordId = null;

// 文字数カウンターの更新
contentInput.addEventListener('input', () => {
  const count = contentInput.value.length;
  charCount.textContent = `${count}/200文字`;
});

// 日付をフォーマットする関数
function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function renderRecord(record) {
  const tr = document.createElement('tr');
  const dateCell = document.createElement('td');
  const teacherCell = document.createElement('td');
  const contentCell = document.createElement('td');
  
  dateCell.textContent = formatDate(record.date);
  teacherCell.textContent = record.teacher || '-';
  contentCell.textContent = record.content;
  contentCell.className = 'content-cell';
  
  tr.appendChild(dateCell);
  tr.appendChild(teacherCell);
  tr.appendChild(contentCell);
  tbody.appendChild(tr);
}

function renderRecords(records) {
  tbody.innerHTML = ''; // テーブルをクリア
  // 日付の新しい順にソート
  records.sort((a, b) => new Date(b.date) - new Date(a.date));
  records.forEach(renderRecord);
}

// 生徒情報と指導記録を表示する関数
async function displayStudentInfo() {
    if (!studentId) {
        alert('生徒IDが指定されていません');
        return;
    }

    try {
        const response = await fetch(`/students/${studentId}`);
        const student = await response.json();

        // 生徒情報を表示
        nameEl.textContent = student.name;
        gradeEl.textContent = student.grade;
        subjectEl.textContent = student.subject;
        if (memoEl) memoEl.textContent = student.memo || '';

        // 指導記録を表示
        const recordsList = document.getElementById('records-list');
        if (student.records && student.records.length > 0) {
            // 日付で降順にソート
            const sortedRecords = [...student.records].sort((a, b) => 
                new Date(b.date) - new Date(a.date)
            );

            recordsList.innerHTML = sortedRecords.map(record => `
                <div class="record-item">
                    <div class="record-header">
                        <div class="record-date">${formatDate(record.date)}</div>
                        <div class="record-teacher">担当講師: ${record.teacher}</div>
                    </div>
                    <div class="record-content">${record.content}</div>
                    <div class="record-actions">
                        <button class="edit-button" onclick="location.href='record-edit.html?studentId=${studentId}&recordId=${record.id}'">
                            編集
                        </button>
                        <button class="delete-button" onclick="deleteRecord('${record.id}')">
                            削除
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            recordsList.innerHTML = '<p>指導記録がありません。</p>';
        }

    } catch (error) {
        console.error('Error:', error);
        alert('生徒情報の取得に失敗しました');
    }
}

// 指導記録を追加する関数
async function addRecord() {
    const content = document.getElementById('record-content').value.trim();
    const teacher = document.getElementById('record-teacher').value.trim();

    if (!content || !teacher) {
        alert('指導内容と担当講師を入力してください');
        return;
    }

    try {
        const response = await fetch(`/students/${studentId}/records`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content,
                teacher
            })
        });

        if (response.ok) {
            // 入力フィールドをクリア
            document.getElementById('record-content').value = '';
            document.getElementById('record-teacher').value = '';
            // 指導記録を更新
            displayStudentInfo();
        } else {
            alert('指導記録の追加に失敗しました');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('指導記録の追加に失敗しました');
    }
}

// 指導記録を編集する関数
async function editRecord(recordId) {
    try {
        const response = await fetch(`/students/${studentId}/records/${recordId}`);
        const record = await response.json();

        // 編集フォームを表示
        const editForm = document.getElementById('edit-form');
        editForm.classList.add('active');

        // フォームに現在の値を設定
        document.getElementById('edit-content').value = record.content;
        document.getElementById('edit-teacher').value = record.teacher;

        // 編集中の記録IDを保存
        editingRecordId = recordId;

        // 編集フォームまでスクロール
        editForm.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error:', error);
        alert('指導記録の取得に失敗しました');
    }
}

// 編集をキャンセルする関数
function cancelEdit() {
    const editForm = document.getElementById('edit-form');
    editForm.classList.remove('active');
    document.getElementById('edit-content').value = '';
    document.getElementById('edit-teacher').value = '';
    editingRecordId = null;
}

// 指導記録を更新する関数
async function updateRecord() {
    if (!editingRecordId) return;

    const content = document.getElementById('edit-content').value.trim();
    const teacher = document.getElementById('edit-teacher').value.trim();

    if (!content || !teacher) {
        alert('指導内容と担当講師を入力してください');
        return;
    }

    try {
        const response = await fetch(`/students/${studentId}/records/${editingRecordId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content,
                teacher
            })
        });

        if (response.ok) {
            // 編集フォームを非表示
            cancelEdit();
            // 指導記録を更新
            displayStudentInfo();
        } else {
            alert('指導記録の更新に失敗しました');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('指導記録の更新に失敗しました');
    }
}

// 指導記録を削除する関数
async function deleteRecord(recordId) {
    if (!confirm('この指導記録を削除してもよろしいですか？')) {
        return;
    }

    try {
        const response = await fetch(`/students/${studentId}/records/${recordId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // 指導記録を更新
            displayStudentInfo();
        } else {
            alert('指導記録の削除に失敗しました');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('指導記録の削除に失敗しました');
    }
}

// ページ読み込み時に実行
window.onload = displayStudentInfo;

// addBtnが存在する場合のみイベントリスナーを設定
if (addBtn) {
    addBtn.onclick = addRecord;
}
