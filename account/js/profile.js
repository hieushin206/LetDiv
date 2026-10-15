/* =========================================================
   profile.js - Trang chỉnh sửa hồ sơ (account/profile.html)
   - Sửa: họ tên, email, số điện thoại
   - Không sửa được: mã khách hàng, tên tài khoản
   - Đổi mật khẩu: nhập mật khẩu cũ + 2 lần mật khẩu mới
   ========================================================= */
function initProfilePage() {
  const user = Account.requireLogin();
  if (!user) return;
  Account.renderSide(user, "profile");

  const $ = (id) => document.getElementById(id);
  const form = $("profile-form");
  const pwForm = $("pw-form");

  // Nhãn "Mã khách hàng" chỉ đúng với khách hàng; giảng viên / admin là "Mã tài khoản"
  $("lb-code").textContent =
    user.role === "customer" ? "Mã khách hàng" : "Mã tài khoản";

  /* ---------- Hiển thị lỗi dưới từng ô ---------- */
  function setError(input, message) {
    const field = input.closest(".acc-field");
    field.classList.toggle("invalid", !!message);
    field.querySelector(".acc-error").textContent = message || "";
  }
  function clearErrors(f) {
    f.querySelectorAll("input").forEach((i) => setError(i, ""));
  }
  function showAlert(box, type, message) {
    const icon = {
      success: "fa-circle-check",
      error: "fa-circle-exclamation",
      info: "fa-circle-info",
    }[type];
    box.innerHTML =
      '<div class="acc-alert ' +
      type +
      '"><i class="fa-solid ' +
      icon +
      '"></i><span></span></div>';
    box.querySelector("span").textContent = message;
  }
  // Gõ lại thì xóa lỗi của ô đó
  document
    .querySelectorAll(".acc-input input")
    .forEach((i) => i.addEventListener("input", () => setError(i, "")));

  /* ---------- Điền thông tin hiện tại ---------- */
  const inputs = {
    fullName: $("p-fullName"),
    email: $("p-email"),
    phone: $("p-phone"),
  };
  function fillForm(u) {
    $("p-code").value = u.code || "—";
    $("p-username").value = u.username;
    inputs.fullName.value = u.fullName;
    inputs.email.value = u.email;
    inputs.phone.value = u.phone || "";
  }
  fillForm(user);

  /* ---------- Lưu hồ sơ ---------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearErrors(form);
    $("profile-alert").innerHTML = "";
    const oldName = AuthStore.currentUser().fullName; // <-- THÊM: nhớ tên cũ
    const res = AuthStore.updateProfile({
      fullName: inputs.fullName.value,
      email: inputs.email.value,
      phone: inputs.phone.value,
    });

    if (!res.ok) {
      if (res.errors) {
        let first = null;
        Object.keys(inputs).forEach((name) => {
          if (res.errors[name]) {
            setError(inputs[name], res.errors[name]);
            if (!first) first = inputs[name];
          }
        });
        if (first) first.focus();
      } else {
        showAlert($("profile-alert"), "error", res.error);
      }
      return;
    }
    // THÊM: giảng viên đổi tên thì đổi luôn tên trên các khóa học của họ
    if (
      res.user.role === "instructor" &&
      typeof LearningStore !== "undefined"
    ) {
      LearningStore.renameInstructor(oldName, res.user.fullName);
    }
    fillForm(res.user);
    Account.renderSide(res.user, "profile");
    Account.refreshHeader(res.user);
    showAlert($("profile-alert"), "success", "Đã cập nhật hồ sơ thành công.");
    CartUI.toast("Đã lưu thông tin hồ sơ.");
  });

  $("p-reset").addEventListener("click", () => {
    clearErrors(form);
    $("profile-alert").innerHTML = "";
    fillForm(AuthStore.currentUser());
  });

  /* ---------- Đổi mật khẩu ---------- */
  const pw = { old: $("pw-old"), new1: $("pw-new"), new2: $("pw-new2") };

  function togglePwForm(open) {
    pwForm.classList.toggle("hidden", !open);
    $("btn-open-pw").classList.toggle("hidden", open);
    $("pw-alert").innerHTML = "";
    if (open) pw.old.focus();
    else {
      pwForm.reset();
      clearErrors(pwForm);
    }
  }
  $("btn-open-pw").addEventListener("click", () => togglePwForm(true));
  $("pw-cancel").addEventListener("click", () => togglePwForm(false));

  // Nút con mắt hiện / ẩn mật khẩu
  pwForm.querySelectorAll(".acc-eye").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.innerHTML =
        '<i class="fa-regular ' + (show ? "fa-eye-slash" : "fa-eye") + '"></i>';
    });
  });

  pwForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearErrors(pwForm);
    $("pw-alert").innerHTML = "";

    const res = AuthStore.changePassword(
      pw.old.value,
      pw.new1.value,
      pw.new2.value,
    );
    if (!res.ok) {
      if (res.errors) {
        const map = {
          oldPassword: pw.old,
          newPassword: pw.new1,
          confirmPassword: pw.new2,
        };
        let first = null;
        Object.keys(map).forEach((name) => {
          if (res.errors[name]) {
            setError(map[name], res.errors[name]);
            if (!first) first = map[name];
          }
        });
        if (first) first.focus();
      } else {
        showAlert($("pw-alert"), "error", res.error);
      }
      return;
    }
    togglePwForm(false);
    showAlert(
      $("pw-alert"),
      "success",
      "Đổi mật khẩu thành công. Lần đăng nhập sau hãy dùng mật khẩu mới.",
    );
    CartUI.toast("Đã đổi mật khẩu.");
  });
}

// Chạy khi header-auth.js đã sẵn sàng (kể cả khi file này được gắn TRƯỚC header-auth.js)
(function (run) {
  if (typeof AuthReady === "function") AuthReady(run);
  else
    window.addEventListener("load", function () {
      AuthReady(run);
    });
})(initProfilePage);
