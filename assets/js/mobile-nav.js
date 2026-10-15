/* =========================================================
   mobile-nav.js - Sidebar menu bên trái cho màn hình < 992px
   ---------------------------------------------------------
   Dưới 992px, CSS ẩn .navbar-menu và hiện icon .navbar-icon (3 gạch).
   Khi bấm icon, file này dựng 1 sidebar trượt từ trái sang, bên trong có
   ĐẦY ĐỦ các mục của .navbar-menu (Trang Chủ, Khóa Học, Tin Tức, Giới Thiệu,
   nút Tư Vấn Ngay...). Nội dung được sao chép từ chính header của trang nên
   thêm / sửa menu ở header thì sidebar tự cập nhật theo.
   Đóng sidebar: bấm nền mờ, bấm nút X, bấm phím Esc, bấm 1 mục menu,
   hoặc khi kéo rộng màn hình lên từ 992px trở lên.
   ========================================================= */
const MobileNav = (function () {
  const BREAKPOINT = 992;
  let drawer = null;
  let overlay = null;

  function build() {
    if (drawer) return;
    overlay = document.createElement("div");
    overlay.className = "mnav-overlay";
    drawer = document.createElement("aside");
    drawer.className = "mnav-drawer";
    drawer.setAttribute("aria-label", "Menu điều hướng");
    drawer.innerHTML =
      '<div class="mnav-head"><span class="mnav-title">Menu</span>' +
      '<button type="button" class="mnav-close" aria-label="Đóng menu"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="mnav-body"></div>';
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    overlay.addEventListener("click", close);
    drawer.querySelector(".mnav-close").addEventListener("click", close);
    // Bấm vào link / nút trong sidebar thì đóng sidebar (link vẫn chuyển trang bình thường)
    drawer.addEventListener("click", function (e) {
      if (e.target.closest("a, button.button, .inner-btn button")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= BREAKPOINT) close();
    });
  }

  // Sao chép menu hiện tại của header (giữ nguyên mục đang active)
  function fill() {
    const menu = document.querySelector(".header .navbar-menu");
    const body = drawer.querySelector(".mnav-body");
    body.innerHTML = "";
    if (!menu) return;
    const copy = menu.cloneNode(true);
    copy.removeAttribute("id");
    body.appendChild(copy);
  }

  function open() {
    build();
    fill();
    overlay.classList.add("show");
    drawer.classList.add("show");
    document.body.classList.add("mnav-lock");
  }

  function close() {
    if (!drawer) return;
    overlay.classList.remove("show");
    drawer.classList.remove("show");
    document.body.classList.remove("mnav-lock");
  }

  function init() {
    // Lắng nghe ở document để hoạt động cả khi header được dựng lại bằng JS
    document.addEventListener("click", function (e) {
      const icon = e.target.closest(".header .navbar-icon");
      if (!icon) return;
      e.preventDefault();
      if (drawer && drawer.classList.contains("show")) close();
      else open();
    });
  }

  init();
  return { open: open, close: close };
})();
