/* =========================================================
   account-common.js - Dùng chung cho các trang trong thư mục /account
   - requireLogin(): chưa đăng nhập thì chuyển sang trang đăng nhập
   - renderAccountSide(): vẽ thẻ thông tin + menu bên trái
   ========================================================= */
const Account = {
  // Trả về người dùng đang đăng nhập, hoặc chuyển trang nếu chưa đăng nhập
  requireLogin() {
    const user = AuthStore.currentUser();
    if (!user) {
      location.replace(
        "/auth/login.html?next=" + encodeURIComponent(location.pathname),
      );
      return null;
    }
    return user;
  },
  // Dùng cho trang CHỈ của học viên: Instructor / Admin bị chuyển về trang của họ
  requireStudent() {
    const user = this.requireLogin();
    if (!user) return null;
    if (user.role !== "customer") {
      location.replace(AuthStore.homeFor(user));
      return null;
    }
    return user;
  },
  initials(name) {
    const p = name.trim().split(/\s+/);
    return (
      p.length > 1 ? p[0][0] + p[p.length - 1][0] : p[0].slice(0, 2)
    ).toUpperCase();
  },

  // active: "profile" | "courses"
  renderSide(user, active) {
    const box = document.getElementById("acc-side");
    if (!box) return;

    // Mục chỉ dành cho học viên (role "customer"). Bài tập & điểm xem trong trang Student.
    const studentLinks =
      user.role === "customer"
        ? '<a href="/account/my-courses.html" class="' +
          (active === "courses" ? "active" : "") +
          '"><i class="fa-solid fa-graduation-cap"></i> Khóa học đã mua</a>'
        : "";

    box.innerHTML =
      '<div class="acc-card acc-user"><div class="acc-user-cover"></div>' +
      '<div class="acc-avatar"></div><h3></h3><div class="acc-email"></div>' +
      '<div class="acc-tags"><span class="acc-tag acc-role"></span><span class="acc-tag acc-code"></span></div></div>' +
      '<nav class="acc-nav">' +
      '<a href="/account/profile.html" class="' +
      (active === "profile" ? "active" : "") +
      '"><i class="fa-regular fa-id-card"></i> Hồ sơ cá nhân</a>' +
      studentLinks +
      '<a href="#" class="acc-out"><i class="fa-solid fa-right-from-bracket"></i> Thoát</a></nav>';

    // textContent để không chèn HTML từ dữ liệu người dùng
    box.querySelector(".acc-avatar").textContent = this.initials(user.fullName);
    box.querySelector("h3").textContent = user.fullName;
    box.querySelector(".acc-email").textContent = user.email;
    const role = box.querySelector(".acc-role");
    role.textContent = AuthStore.roleLabel(user.role);
    role.classList.add("role-" + user.role);
    const code = box.querySelector(".acc-code");
    if (user.code) code.textContent = user.code;
    else code.remove();
    box.querySelector(".acc-out").addEventListener("click", (e) => {
      e.preventDefault();
      siteLogout();
    });
  },

  // Cập nhật tên / email trong menu user ở header sau khi sửa hồ sơ (không cần tải lại trang)
  refreshHeader(user) {
    const set = (sel, text) => {
      const el = document.querySelector(".header " + sel);
      if (el) el.textContent = text;
    };
    set(".ud-fullname", user.fullName);
    set(".ud-email", user.email);
    set(".ud-avatar", this.initials(user.fullName));
  },
};
