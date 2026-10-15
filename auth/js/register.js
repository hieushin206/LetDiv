/* =========================================================
   register.js - Trang đăng ký (auth/register.html)
   ========================================================= */
function initRegisterPage() {
  // Đã đăng nhập rồi thì không cần đăng ký nữa
  if (AuthStore.currentUser()) {
    location.replace("/index.html");
    return;
  }

  const form = document.querySelector(".section-one form");
  form.setAttribute("novalidate", ""); // tắt kiểm tra mặc định của trình duyệt, dùng kiểm tra riêng

  // tên trường (khớp với AuthStore.validateRegister) -> id ô nhập trong register.html
  const FIELD_IDS = {
    fullName: "full-name",
    username: "account",
    email: "email",
    phone: "phone",
    password: "password",
    confirmPassword: "confirm-password",
  };
  const inputs = {};
  Object.keys(FIELD_IDS).forEach((name) => {
    inputs[name] = form.querySelector("#" + FIELD_IDS[name]);
    // Gõ lại thì xóa lỗi của ô đó
    inputs[name].addEventListener("input", () => AuthUI.clearError(inputs[name]));
  });
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    AuthUI.clearAll(form);

    const data = {};
    Object.keys(inputs).forEach((name) => (data[name] = inputs[name].value));

    const res = AuthStore.register(data);

    if (!res.ok) {
      if (res.errors) {
        let first = null;
        Object.keys(FIELD_IDS).forEach((name) => {
          if (res.errors[name]) {
            AuthUI.setError(inputs[name], res.errors[name]);
            if (!first) first = inputs[name];
          }
        });
        if (first) first.focus();
      } else {
        AuthUI.showAlert(form, "error", res.error);
      }
      return;
    }

    // Thành công: báo và chuyển sang trang đăng nhập
    button.disabled = true;
    AuthUI.showAlert(form, "success", "Đăng ký thành công! Đang chuyển đến trang đăng nhập...");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      location.href = "/auth/login.html?registered=1&username=" + encodeURIComponent(res.account.username);
    }, 1500);
  });
}

// Chạy khi header-auth.js đã sẵn sàng (kể cả khi file này được gắn TRƯỚC header-auth.js)
(function (run) {
  if (typeof AuthReady === "function") AuthReady(run);
  else window.addEventListener("load", function () { AuthReady(run); });
})(initRegisterPage);

