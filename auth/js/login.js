/* =========================================================
   login.js - Trang đăng nhập (auth/login.html)
   Đăng nhập xong chuyển trang theo quyền:
     admin -> /admin/index.html | giảng viên -> /instructor/index.html
     khách hàng -> trang đang xem dở (?next=...) hoặc trang chủ
   ========================================================= */
function initLoginPage() {
  // Đã đăng nhập rồi thì không cần đăng nhập lại
  const current = AuthStore.currentUser();
  if (current) {
    goAfterLogin(current); // hàm này nằm trong header-auth.js
    return;
  }

  // Trang này có 2 form đăng nhập (form của trang và form trong modal ở header).
  // Form của trang nằm trong .section-one
  const form = document.querySelector(".section-one form");
  const params = new URLSearchParams(location.search);

  // Vừa đăng ký / vừa đổi mật khẩu xong thì hiện thông báo và điền sẵn tên tài khoản
  if (params.get("registered")) {
    AuthUI.showAlert(form, "success", "Đăng ký thành công! Hãy đăng nhập để tiếp tục.");
  } else if (params.get("reset")) {
    AuthUI.showAlert(form, "success", "Đổi mật khẩu thành công! Hãy đăng nhập bằng mật khẩu mới.");
  } else if (params.get("next")) {
    AuthUI.showAlert(form, "info", "Vui lòng đăng nhập để tiếp tục.");
  }
  if (params.get("username")) {
    form.querySelector('input[type="text"]').value = params.get("username");
    form.querySelector('input[type="password"]').focus();
  }

  AuthUI.bindLoginForm(form, (user) => goAfterLogin(user));
}

// Chạy khi header-auth.js đã sẵn sàng (kể cả khi file này được gắn TRƯỚC header-auth.js)
(function (run) {
  if (typeof AuthReady === "function") AuthReady(run);
  else window.addEventListener("load", function () { AuthReady(run); });
})(initLoginPage);

