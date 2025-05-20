// URLから生徒IDと記録IDを取得
const urlParams = new URLSearchParams(window.location.search);
const studentId = urlParams.get('studentId');
const recordId = urlParams.get('recordId');

// 生徒情報と記録情報を表示する関数
async function displayRecordInfo() {
    if (!studentId || !recordId) {
        alert('生徒IDまたは記録IDが指定されていません');
        window.location.href = 'index.html';
        return;
    }

    try {
        // 生徒情報を取得
        const studentResponse = await fetch(`/students/${studentId}`);
        if (!studentResponse.ok) {
            throw new Error('生徒情報の取得に失敗しました');
        }
        const student = await studentResponse.json();

        // 生徒情報を表示
        document.getElementById('student-name').textContent = student.name;
        document.getElementById('student-grade').textContent = student.grade;
        document.getElementById('student-subject').textContent = student.subject;

        // 記録情報を取得
        const recordResponse = await fetch(`/students/${studentId}/records/${recordId}`);
        if (!recordResponse.ok) {
            throw new Error('記録情報の取得に失敗しました');
        }
        const record = await recordResponse.json();

        // 記録情報をフォームに設定
        document.getElementById('record-content').value = record.content;
        document.getElementById('record-teacher').value = record.teacher;

    } catch (error) {
        console.error('Error:', error);
        alert(error.message || '情報の取得に失敗しました');
        window.location.href = `student.html?id=${studentId}`;
    }
}

// 記録を更新する関数
async function updateRecord() {
    if (!studentId || !recordId) {
        alert('生徒IDまたは記録IDが指定されていません');
        return;
    }

    const content = document.getElementById('record-content').value.trim();
    const teacher = document.getElementById('record-teacher').value.trim();

    if (!content || !teacher) {
        alert('指導内容と担当講師を入力してください');
        return;
    }

    try {
        const response = await fetch(`/students/${studentId}/records/${recordId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content,
                teacher
            })
        });

        if (!response.ok) {
            throw new Error('記録の更新に失敗しました');
        }

        // 更新成功後、生徒詳細ページに戻る
        goBack();
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || '指導記録の更新に失敗しました');
    }
}

// 前のページに戻る関数
function goBack() {
    window.location.href = `student.html?id=${studentId}`;
}

// ページ読み込み時に実行
window.onload = displayRecordInfo; 