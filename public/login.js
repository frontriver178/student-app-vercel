document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const errorDiv = document.getElementById('error');
  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    const schoolId = form.schoolId.value.trim();
    const password = form.password.value;

    if (!schoolId || !password) {
      errorDiv.textContent = '塾ID（または塾名）とパスワードを入力してください。';
      errorDiv.style.display = 'block';
      return false;
    }

    submitButton.disabled = true;
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, password })
      });

      if (!response.ok) {
        const data = await response.json();
        errorDiv.textContent = data.error || 'ログインに失敗しました。';
        errorDiv.style.display = 'block';
        return false;
      }

      const data = await response.json();
      localStorage.setItem('loggedIn', 'true');
      localStorage.setItem('schoolId', schoolId);
      window.location.href = 'main.html';
    } catch (error) {
      errorDiv.textContent = '通信エラーが発生しました。';
      errorDiv.style.display = 'block';
    } finally {
      submitButton.disabled = false;
    }
    return false;
  });
}); 