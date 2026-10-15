/* =========================================================
   forgot-password.js - Trang quên mật khẩu (auth/forgot-password.html)
   3 bước trên cùng 1 trang:
     1. Nhập email (phải là email đã đăng ký)
     2. Nhập mã 6 số (giả lập "gửi email" - mã hiện trong hộp thư mô phỏng)
     3. Đặt mật khẩu mới
   Các form của bước 2, 3 được JS tự tạo, không cần sửa HTML.
   ========================================================= */
function initForgotPage() {
  const emailForm = document.querySelector(".section-one .inner-wrap form");
  const emailInput = emailForm.querySelector('input[type="email"]');
  emailForm.setAttribute("novalidate", "");

  /* ---------- Tạo giao diện các bước ---------- */
  emailForm.insertAdjacentHTML(
    "beforebegin",
    '<div class="fp-steps">' +
      '<div class="fp-step" data-step="1"><span>1</span>Nhập email</div>' +
      '<div class="fp-step" data-step="2"><span>2</span>Nhập mã</div>' +
      '<div class="fp-step" data-step="3"><span>3</span>Mật khẩu mới</div>' +
      "</div>"
  );

  emailForm.insertAdjacentHTML(
    "afterend",
    '<form id="fp-code-form" class="fp-hidden" novalidate>' +
      '<div class="fake-mail"><div class="fm-head"><i class="fa-regular fa-envelope"></i> Hộp thư mô phỏng · gửi tới <span id="fp-mail-to"></span></div>' +
      '<div class="fm-body">Mã xác nhận LetDiv của bạn là:<br><span class="fm-code" id="fp-mail-code"></span>' +
      '<div class="fm-note">Đây là website giả lập nên mã hiện ngay tại đây thay vì gửi email thật. Mã có hiệu lực 5 phút.</div></div></div>' +
      '<div class="form-group"><label for="fp-code">Mã xác nhận <span style="color: red">*</span></label>' +
      '<span class="icon"><i class="fa-solid fa-key"></i></span>' +
      '<input type="text" class="form-control code-input" id="fp-code" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="000000" /></div>' +
      '<div class="fp-timer" id="fp-timer">Mã hết hạn sau <b id="fp-countdown">05:00</b></div>' +
      '<button type="submit" class="button-change-color">Xác nhận mã</button>' +
      '<div class="fp-links"><button type="button" class="link-btn" id="fp-resend">Gửi lại mã</button> · ' +
      '<button type="button" class="link-btn" id="fp-change-email">Đổi email khác</button></div>' +
      "</form>" +
      '<form id="fp-pass-form" class="fp-hidden" novalidate>' +
      '<div class="form-group"><label for="fp-newpass">Mật khẩu mới <span style="color: red">*</span></label>' +
      '<span class="icon"><i class="fa-solid fa-lock"></i></span>' +
      '<input type="password" class="form-control" id="fp-newpass" placeholder="Tối thiểu 6 ký tự" /></div>' +
      '<div class="form-group"><label for="fp-confirm">Xác nhận mật khẩu mới <span style="color: red">*</span></label>' +
      '<span class="icon"><i class="fa-solid fa-lock"></i></span>' +
      '<input type="password" class="form-control" id="fp-confirm" /></div>' +
      '<button type="submit" class="button-change-color">Đổi mật khẩu</button>' +
      "</form>"
  );

  const codeForm = document.getElementById("fp-code-form");
  const passForm = document.getElementById("fp-pass-form");
  const codeInput = document.getElementById("fp-code");
  const newPass = document.getElementById("fp-newpass");
  const confirmPass = document.getElementById("fp-confirm");
  const resendBtn = document.getElementById("fp-resend");

  // Trạng thái đang xử lý
  const state = { email: "", code: "", mailCode: "", sentAt: 0, expiresAt: 0, timer: null };

  /* ---------- Chuyển bước ---------- */
  function showStep(step) {
    emailForm.classList.toggle("fp-hidden", step !== 1);
    codeForm.classList.toggle("fp-hidden", step !== 2);
    passForm.classList.toggle("fp-hidden", step !== 3);
    document.querySelectorAll(".fp-step").forEach((el) => {
      const n = Number(el.dataset.step);
      el.classList.toggle("active", n === step);
      el.classList.toggle("done", n < step);
      el.querySelector("span").textContent = n < step ? "✓" : n;
    });
    if (step !== 2) stopTimer();
  }

  /* ---------- Đồng hồ đếm ngược ---------- */
  function stopTimer() {
    clearInterval(state.timer);
    state.timer = null;
  }

  function tick() {
    const left = Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 1000));
    const m = String(Math.floor(left / 60)).padStart(2, "0");
    const s = String(left % 60).padStart(2, "0");
    const timerBox = document.getElementById("fp-timer");
    document.getElementById("fp-countdown").textContent = left > 0 ? m + ":" + s : "đã hết hạn";
    timerBox.classList.toggle("expired", left === 0);

    // Nút "Gửi lại mã" bị khóa trong 30 giây đầu
    const wait = Math.max(0, Math.ceil((state.sentAt + RESEND_SECONDS * 1000 - Date.now()) / 1000));
    resendBtn.disabled = wait > 0;
    resendBtn.textContent = wait > 0 ? "Gửi lại mã (" + wait + "s)" : "Gửi lại mã";
    if (left === 0 && wait === 0) stopTimer();
  }

  function startTimer() {
    stopTimer();
    tick();
    state.timer = setInterval(tick, 1000);
  }

  // Hiện mã trong "hộp thư mô phỏng" và bắt đầu đếm ngược
  function showSentCode(res) {
    state.email = res.email;
    state.mailCode = res.code;
    state.sentAt = res.sentAt;
    state.expiresAt = res.expiresAt;
    document.getElementById("fp-mail-to").textContent = res.email;
    document.getElementById("fp-mail-code").textContent = res.code;
    codeInput.value = "";
    AuthUI.clearAll(codeForm);
    showStep(2);
    startTimer();
    codeInput.focus();
  }

  /* ---------- Bước 1: nhập email ---------- */
  emailInput.addEventListener("input", () => AuthUI.clearError(emailInput));
  emailForm.addEventListener("submit", (e) => {
    e.preventDefault();
    AuthUI.clearAll(emailForm);
    const res = AuthStore.requestResetCode(emailInput.value);
    if (!res.ok) {
      // Vừa gửi mã cho đúng email này (bấm "Đổi email khác" rồi nhập lại) và mã còn hạn
      // -> quay lại bước nhập mã với mã cũ, không bắt chờ
      const same = state.email === AuthStore.normalizeEmail(emailInput.value);
      if (res.cooldown && same && Date.now() < state.expiresAt) {
        showSentCode({ email: state.email, code: state.mailCode, sentAt: state.sentAt, expiresAt: state.expiresAt });
        return;
      }
      AuthUI.setError(emailInput, res.error);
      return;
    }
    showSentCode(res);
  });

  /* ---------- Bước 2: nhập mã ---------- */
  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.replace(/\D/g, ""); // chỉ cho nhập số
    AuthUI.clearError(codeInput);
  });
  codeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    AuthUI.clearAll(codeForm);
    const code = codeInput.value.trim();
    if (code.length !== 6) {
      AuthUI.setError(codeInput, "Vui lòng nhập đủ 6 chữ số.");
      return;
    }
    const res = AuthStore.verifyResetCode(state.email, code);
    if (!res.ok) {
      AuthUI.setError(codeInput, res.error);
      return;
    }
    state.code = code;
    showStep(3);
    newPass.focus();
  });

  resendBtn.addEventListener("click", () => {
    const res = AuthStore.requestResetCode(state.email);
    if (!res.ok) {
      AuthUI.showAlert(codeForm, "error", res.error);
      return;
    }
    showSentCode(res);
    AuthUI.showAlert(codeForm, "info", "Đã gửi lại mã mới. Mã cũ không còn dùng được.");
  });

  document.getElementById("fp-change-email").addEventListener("click", () => {
    AuthUI.clearAll(emailForm);
    showStep(1);
    emailInput.focus();
  });

  /* ---------- Bước 3: đặt mật khẩu mới ---------- */
  [newPass, confirmPass].forEach((i) => i.addEventListener("input", () => AuthUI.clearError(i)));
  passForm.addEventListener("submit", (e) => {
    e.preventDefault();
    AuthUI.clearAll(passForm);

    let hasError = false;
    if (newPass.value.length < 6) {
      AuthUI.setError(newPass, "Mật khẩu tối thiểu 6 ký tự.");
      hasError = true;
    } else if (/\s/.test(newPass.value)) {
      AuthUI.setError(newPass, "Mật khẩu không được chứa khoảng trắng.");
      hasError = true;
    }
    if (confirmPass.value !== newPass.value) {
      AuthUI.setError(confirmPass, "Mật khẩu xác nhận không khớp.");
      hasError = true;
    }
    if (hasError) return;

    const res = AuthStore.resetPassword(state.email, state.code, newPass.value);
    if (!res.ok) {
      if (res.expired) {
        // Mã hết hạn / bị vô hiệu trong lúc đang đổi mật khẩu -> quay lại bước nhập mã
        showStep(2);
        AuthUI.showAlert(codeForm, "error", res.error);
        tick();
      } else {
        AuthUI.showAlert(passForm, "error", res.error);
      }
      return;
    }

    passForm.querySelector("button").disabled = true;
    AuthUI.showAlert(passForm, "success", "Đổi mật khẩu thành công! Đang chuyển đến trang đăng nhập...");
    setTimeout(() => {
      location.href = "/auth/login.html?reset=1&username=" + encodeURIComponent(res.username);
    }, 1800);
  });

  showStep(1);
}

// Chạy khi header-auth.js đã sẵn sàng (kể cả khi file này được gắn TRƯỚC header-auth.js)
(function (run) {
  if (typeof AuthReady === "function") AuthReady(run);
  else window.addEventListener("load", function () { AuthReady(run); });
})(initForgotPage);

