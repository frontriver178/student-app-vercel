// URLから生徒IDを取得
const urlParams = new URLSearchParams(window.location.search);
const studentId = urlParams.get('id');

// 生徒情報と記録を表示する関数
async function displayStudentProgress() {
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

        // 記録を日付順にソート
        const sortedRecords = student.records.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 記録を表示
        const progressList = document.getElementById('progress-list');
        progressList.innerHTML = sortedRecords.map(record => `
            <div class="progress-item">
                <div class="progress-date">${formatDate(record.date)}</div>
                <div class="progress-content">${record.content}</div>
                ${record.teacher ? `<div class="progress-teacher">講師: ${record.teacher}</div>` : ''}
            </div>
        `).join('');

    } catch (error) {
        console.error('Error:', error);
        alert('生徒情報の取得に失敗しました');
    }
}

// 日付をフォーマットする関数
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
}

// ページ読み込み時に実行
window.onload = displayStudentProgress; 