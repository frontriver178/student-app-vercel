// URLから生徒IDを取得
const urlParams = new URLSearchParams(window.location.search);
const studentId = urlParams.get('id');

// 進捗率に応じて色を返す関数
function getProgressColor(progress) {
    if (progress <= 30) return '#ff4444'; // 赤色
    if (progress <= 70) return '#ffbb33'; // 黄色
    return '#00C851'; // 緑色
}

// 生徒情報と参考書進捗を表示する関数
async function displayTextbookProgress() {
    if (!studentId) {
        alert('生徒IDが指定されていません');
        return;
    }

    try {
        const response = await fetch(`/students/${studentId}`);
        const student = await response.json();

        // 生徒情報を表示
        document.getElementById('student-name').textContent = student.name;
        document.getElementById('student-grade').textContent = student.grade;
        document.getElementById('student-subject').textContent = student.subject;

        // 参考書リストを表示
        const textbookList = document.getElementById('textbook-list');
        if (student.textbooks && student.textbooks.length > 0) {
            textbookList.innerHTML = student.textbooks.map(textbook => {
                const progress = textbook.progress || 0;
                const progressColor = getProgressColor(progress);
                return `
                    <div class="textbook-item">
                        <div class="textbook-header">
                            <div class="textbook-title">${textbook.title}</div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%; background-color: ${progressColor}"></div>
                        </div>
                        <div class="progress-text">
                            ${progress}%
                        </div>
                        <div class="textbook-actions">
                            <div class="update-progress-form">
                                <div class="progress-input-group">
                                    <input type="number" id="progress-${textbook.id}" 
                                           min="0" max="100" 
                                           value="${progress}">
                                    <span>%</span>
                                </div>
                                <button class="update-button" onclick="updateProgress('${textbook.id}')">
                                    進捗更新
                                </button>
                            </div>
                            <button class="delete-button" onclick="deleteTextbook('${textbook.id}')">
                                削除
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            textbookList.innerHTML = '<p>参考書が登録されていません。</p>';
        }

    } catch (error) {
        console.error('Error:', error);
        alert('生徒情報の取得に失敗しました');
    }
}

// 新しい参考書を追加する関数
async function addTextbook() {
    const title = document.getElementById('textbook-title').value.trim();

    if (!title) {
        alert('参考書名を入力してください');
        return;
    }

    try {
        const response = await fetch(`/students/${studentId}/textbooks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                progress: 0
            })
        });

        if (response.ok) {
            // 入力フィールドをクリア
            document.getElementById('textbook-title').value = '';
            // 参考書リストを更新
            displayTextbookProgress();
        } else {
            alert('参考書の追加に失敗しました');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('参考書の追加に失敗しました');
    }
}

// 進捗を更新する関数
async function updateProgress(textbookId) {
    const progress = parseInt(document.getElementById(`progress-${textbookId}`).value);

    if (progress < 0 || progress > 100) {
        alert('進捗は0から100の間で入力してください');
        return;
    }

    try {
        const response = await fetch(`/students/${studentId}/textbooks/${textbookId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                progress
            })
        });

        if (response.ok) {
            // 参考書リストを更新
            displayTextbookProgress();
        } else {
            alert('進捗の更新に失敗しました');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('進捗の更新に失敗しました');
    }
}

// 参考書を削除する関数
async function deleteTextbook(textbookId) {
    if (!confirm('この参考書を削除してもよろしいですか？')) {
        return;
    }

    try {
        const response = await fetch(`/students/${studentId}/textbooks/${textbookId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // 参考書リストを更新
            displayTextbookProgress();
        } else {
            alert('参考書の削除に失敗しました');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('参考書の削除に失敗しました');
    }
}

// ページ読み込み時に実行
window.onload = displayTextbookProgress; 