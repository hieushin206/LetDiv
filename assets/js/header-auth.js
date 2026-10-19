/* =========================================================
   header-auth.js - Gắn vào MỌI trang của website (trang khách)
   Việc nó làm:
   1. Tự nạp các file cần thiết (seed-data, store, auth-store, cart-store,
      cart-ui và 2 file CSS) => mỗi trang chỉ cần thêm 1 dòng <script>.
   2. Form đăng nhập trong modal ở header hoạt động được; đăng nhập xong
      chuyển trang theo quyền (admin / giảng viên / khách hàng).
   3. Đã đăng nhập: icon user đổi thành fa-user-check, bấm vào hiện menu:
        Chỉnh sửa hồ sơ | Khóa học đã mua | Thoát
   4. Icon giỏ hàng có số khóa học trong giỏ, bấm vào mở sidebar giỏ hàng.
   5. Nút "Thêm Vào Giỏ" ở trang chi tiết khóa học tự hoạt động.
   6. Cung cấp hàm AuthReady(callback) cho các trang login/register/
      forgot-password/account: callback chạy sau khi mọi thứ đã nạp xong.
   ========================================================= */
const AuthReadyQueue = [];
let authIsReady = false;

// Thư mục gốc của website, suy ra từ chính đường dẫn file này (…/assets/js/header-auth.js)
// => nạp đúng file dù trang nằm ở thư mục nào
const SITE_BASE = (function () {
  const el = document.currentScript;
  return el && el.src
    ? el.src.replace(/assets\/js\/header-auth\.js.*$/, "")
    : "/";
})();

// Lưới an toàn: khi code đăng nhập / đăng ký chưa nạp xong mà người dùng đã bấm nút,
// chặn việc gửi form (nếu không trình duyệt sẽ POST lên máy chủ => "This page isn't working")
document.addEventListener(
  "submit",
  function (e) {
    if (
      !authIsReady &&
      e.target.closest &&
      e.target.closest("#loginModal, .section-one, .login-modal")
    ) {
      e.preventDefault();
    }
  },
  true,
);

function AuthReady(callback) {
  if (authIsReady) callback();
  else AuthReadyQueue.push(callback);
}

(function () {
  // Thứ tự nạp rất quan trọng: file sau dùng đồ của file trước
  const DEPENDENCIES = [
    {
      src: "admin/js/seed-data.js",
      loaded: () => typeof buildSeedData !== "undefined",
    },
    { src: "admin/js/store.js", loaded: () => typeof Store !== "undefined" },
    {
      src: "assets/js/auth-store.js",
      loaded: () => typeof AuthStore !== "undefined",
    },
    {
      src: "assets/js/cart-store.js",
      loaded: () => typeof CartStore !== "undefined",
    },
    {
      src: "assets/js/cart-ui.js",
      loaded: () => typeof CartUI !== "undefined",
    },
    {
      // Sidebar menu bên trái khi màn hình dưới 992px (bấm icon navbar-icon)
      src: "assets/js/mobile-nav.js",
      loaded: () => typeof MobileNav !== "undefined",
    },
    {
      // Áp dụng chỉnh sửa khóa học của admin (tên, ảnh, giá, ẩn/hiện) lên trang chính
      src: "assets/js/course-sync.js",
      loaded: () => typeof CourseSync !== "undefined",
    },
  ];
  const STYLES = [
    { id: "auth-extra-css", href: "auth/css/auth-extra.css" },
    { id: "user-cart-css", href: "assets/css/user-cart.css" },
    { id: "mobile-nav-css", href: "assets/css/mobile-nav.css" },
  ];

  // Nạp lần lượt từng file JS còn thiếu (đúng thứ tự)
  function loadScripts(list, done) {
    if (list.length === 0) return done();
    const item = list[0];
    if (item.loaded()) return loadScripts(list.slice(1), done);
    const script = document.createElement("script");
    script.src = SITE_BASE + item.src;
    script.async = false;
    script.onload = () => loadScripts(list.slice(1), done);
    script.onerror = () => {
      console.error(
        "Không nạp được " +
          script.src +
          " (kiểm tra lại đường dẫn / thư mục gốc của server).",
      );
      const bar = document.createElement("div");
      bar.style.cssText =
        "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#c92a2a;color:#fff;padding:10px 16px;font:14px sans-serif";
      bar.textContent =
        "Lỗi: không nạp được " +
        script.src +
        ". Hãy kiểm tra lại đường dẫn file và mở website từ thư mục gốc của project.";
      document.body.appendChild(bar);
    };
    document.head.appendChild(script);
  }

  function loadCss() {
    STYLES.forEach((s) => {
      if (document.getElementById(s.id)) return;
      const link = document.createElement("link");
      link.id = s.id;
      link.rel = "stylesheet";
      link.href = SITE_BASE + s.href;
      document.head.appendChild(link);
    });
  }

  /* ---------- Chuyển trang sau khi đăng nhập ---------- */
  // Chỉ chấp nhận đường dẫn nội bộ (chặn kiểu next=https://trang-la.com)
  function safeNext() {
    const next = new URLSearchParams(location.search).get("next");
    if (
      !next ||
      next.charAt(0) !== "/" ||
      next.charAt(1) === "/" ||
      next.indexOf("/auth/") === 0
    )
      return "";
    return next;
  }

  function goAfterLogin(user) {
    // admin -> trang admin, giảng viên -> trang giảng viên
    if (user.role !== "customer") {
      location.href = AuthStore.homeFor(user);
      return;
    }
    const next = safeNext();
    if (next) location.href = next;
    else if (location.pathname.indexOf("/auth/") === 0)
      location.href = "/index.html";
    else location.reload();
  }
  window.goAfterLogin = goAfterLogin; // login.js cũng dùng hàm này

  function logout() {
    AuthStore.logout();
    // Đang ở trang chỉ dành cho người đã đăng nhập thì về trang chủ, ngược lại tải lại trang
    if (location.pathname.indexOf("/account/") === 0)
      location.href = "/index.html";
    else location.reload();
  }
  window.siteLogout = logout;

  /* ---------- Icon user trên header ---------- */
  function renderHeader() {
    const box = document.querySelector(".header .login");
    const user = AuthStore.currentUser();
    if (!box || !user) return;

    const isStaff = user.role !== "customer";
    box.innerHTML =
      '<div class="user-menu">' +
      '<button type="button" class="btn user-btn" title="Tài khoản của tôi" aria-label="Tài khoản của tôi"><i class="fa-solid fa-user-check"></i></button>' +
      '<div class="user-dropdown">' +
      '<div class="ud-info"><span class="ud-avatar"></span><div class="ud-text"><b class="ud-fullname"></b><small class="ud-email"></small>' +
      '<span class="ud-tags"><span class="ud-role"></span><span class="ud-code"></span></span></div></div>' +
      (isStaff
        ? '<a href="' +
          AuthStore.homeFor(user) +
          '" class="ud-item"><i class="fa-solid fa-gauge-high"></i> <span class="ud-dash"></span></a>'
        : "") +
      '<a href="/account/profile.html" class="ud-item"><i class="fa-regular fa-id-card"></i> Chỉnh sửa hồ sơ</a>' +
      (isStaff
        ? ""
        : '<a href="/account/my-courses.html" class="ud-item"><i class="fa-solid fa-graduation-cap"></i> Khóa học đã mua</a>' +
          '<a href="/account/my-vouchers.html" class="ud-item"><i class="fa-solid fa-ticket"></i> Mã giảm giá</a>') +
      '<a href="#" class="ud-item ud-logout"><i class="fa-solid fa-right-from-bracket"></i> Thoát</a>' +
      "</div></div>";

    // Dùng textContent để tránh chèn HTML từ dữ liệu người dùng
    const parts = user.fullName.trim().split(/\s+/);
    box.querySelector(".ud-avatar").textContent = (
      parts.length > 1
        ? parts[0][0] + parts[parts.length - 1][0]
        : parts[0].slice(0, 2)
    ).toUpperCase();
    box.querySelector(".ud-fullname").textContent = user.fullName;
    box.querySelector(".ud-email").textContent = user.email;
    box.querySelector(".ud-role").textContent = AuthStore.roleLabel(user.role);
    box.querySelector(".ud-role").classList.add("role-" + user.role);
    if (user.code) box.querySelector(".ud-code").textContent = user.code;
    else box.querySelector(".ud-code").remove();
    if (isStaff)
      box.querySelector(".ud-dash").textContent =
        user.role === "admin" ? "Vào trang quản trị" : "Vào trang giảng viên";

    const menu = box.querySelector(".user-menu");
    box.querySelector(".user-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) menu.classList.remove("open");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") menu.classList.remove("open");
    });
    box.querySelector(".ud-logout").addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  /* ---------- Icon giỏ hàng + số lượng ---------- */
  function setupCartIcon() {
    const link = document.querySelector(".header .cart-shop a");
    if (!link) return;
    link.setAttribute("href", "#");
    link.setAttribute("aria-label", "Giỏ hàng");
    link.classList.add("cart-link");
    if (!link.querySelector(".cart-badge")) {
      const badge = document.createElement("span");
      badge.className = "cart-badge";
      badge.textContent = "0";
      link.appendChild(badge);
    }
    link.addEventListener("click", (e) => {
      e.preventDefault();
      CartUI.open("cart");
    });
    CartUI.refreshBadge();
  }

  /* ---------- Nút "Thêm Vào Giỏ" ở trang chi tiết khóa học ---------- */
  // Tìm khóa học của trang hiện tại bằng đường dẫn (khớp với trường href trong Store)
  function currentCourse() {
    const path = location.pathname.toLowerCase();
    return Store.getCourses(true).find(
      (c) => c.href && path.endsWith("/" + c.href.toLowerCase()),
    );
  }

  function bindAddToCartButton() {
    const btn = document.querySelector(".inner-price .cart");
    if (!btn) return;
    const course = currentCourse();
    if (!course) return;

    function sync() {
      const user = AuthStore.currentUser();
      btn.classList.remove("is-owned", "in-cart");
      btn.disabled = false;
      if (user && CartStore.canBuy() && CartStore.isOwned(course.id)) {
        btn.innerHTML =
          '<i class="fa-solid fa-circle-check"></i> Bạn đã sở hữu khóa học này';
        btn.classList.add("is-owned");
        btn.disabled = true;
      } else if (user && CartStore.canBuy() && CartStore.has(course.id)) {
        btn.innerHTML =
          '<i class="fa-solid fa-cart-shopping"></i> Đã trong giỏ - Xem giỏ hàng';
        btn.classList.add("in-cart");
      } else {
        btn.textContent = "Thêm Vào Giỏ";
      }
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      if (btn.classList.contains("in-cart")) CartUI.open("cart");
      else CartUI.addToCart(course.id);
    });
    window.addEventListener("cart:changed", sync);
    sync();
  }

  /* ---------- Form đăng nhập trong modal ở header ---------- */
  function bindModalLogin() {
    const form = document.querySelector("#loginModal form");
    if (!form) return;
    AuthUI.bindLoginForm(form, (user) => {
      if (window.jQuery) window.jQuery("#loginModal").modal("hide");
      goAfterLogin(user);
    });
  }

  function start() {
    loadCss();
    renderHeader();
    setupCartIcon();
    bindModalLogin();
    bindAddToCartButton();
    if (typeof CourseSync !== "undefined") CourseSync.apply();
    authIsReady = true;
    AuthReadyQueue.forEach((cb) => cb());
  }

  // Đợi trang dựng xong rồi mới chạy (phòng khi header-auth.js đặt trong <head>)
  function boot() {
    loadScripts(DEPENDENCIES, start);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
