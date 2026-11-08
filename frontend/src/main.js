// Catch module-loading failures as well as startup errors, so the page is never blank.
try {
    await import('./app/controller.js');
} catch (error) {
    const app = document.querySelector('#app');
    app.innerHTML = '<main class="boot-error"><div class="card pad"><h1>Không tải được giao diện Lac Hong</h1><p role="alert"></p><p>Hãy kiểm tra máy chủ đang chạy, sau đó tải lại trang bằng Ctrl+F5.</p><button type="button" class="btn primary">Tải lại trang</button></div></main>';
    app.querySelector('[role="alert"]').textContent = error.message;
    app.querySelector('button').addEventListener('click', () => location.reload());
    console.error('LAC HONG UNIVERSITY: không khởi động được giao diện', error);
}
