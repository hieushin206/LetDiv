/* =========================================================
   role-guard.js - Bảo vệ trang theo quyền (admin / giảng viên)
   ---------------------------------------------------------
   Cách dùng: đặt trong <head> của trang cần bảo vệ, ví dụ
     <script src="/assets/js/role-guard.js" data-role="admin"></script>
     <script src="/assets/js/role-guard.js" data-role="instructor,admin"></script>
   - Chưa đăng nhập        -> chuyển tới trang đăng nhập
   - Đăng nhập sai quyền   -> chuyển về trang đúng quyền của mình
   - Đúng quyền            -> hiện trang + thêm menu "Thoát" vào header
   Lưu ý: website tĩnh nên đây chỉ là chặn ở giao diện (không phải bảo mật thật).
   ========================================================= */
(function () {
  const me = document.currentScript;
  const allowed = (me.getAttribute("data-role") || "admin").split(",").map((s) => s.trim());

  // Ẩn trang cho tới khi kiểm tra xong (tránh nháy nội dung admin với người không có quyền)
  document.documentElement.style.visibility = "hidden";

  const FILES = [
    { src: "/admin/js/seed-data.js", loaded: () => typeof buildSeedData !== "undefined" },
    { src: "/admin/js/store.js", loaded: () => typeof Store !== "undefined" },
    { src: "/assets/js/auth-store.js", loaded: () => typeof AuthStore !== "undefined" },
  ];

  function load(list, done) {
    if (list.length === 0) return done();
    if (list[0].loaded()) return load(list.slice(1), done);
    const s = document.createElement("script");
    s.src = list[0].src;
    s.async = false;
    s.onload = () => load(list.slice(1), done);
    s.onerror = () => {
      console.error("Không nạp được " + list[0].src);
      document.documentElement.style.visibility = "visible";
    };
    document.head.appendChild(s);
  }

  // Thêm menu người dùng (tên, quyền, về trang chủ, thoát) vào header của trang admin / giảng viên
  function addUserMenu(user) {
    const style = document.createElement("style");
    style.textContent =
      ".rg-wrap{position:relative}" +
      ".rg-menu{display:none;position:absolute;right:0;top:calc(100% + 12px);width:230px;background:#fff;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:hidden;z-index:5000;text-align:left}" +
      ".rg-wrap.open .rg-menu{display:block}" +
      ".rg-info{padding:14px 16px;background:#f4f7fb;border-bottom:1px solid #e6eaf0}" +
      ".rg-info b{display:block;color:#172554;font-size:14.5px}" +
      ".rg-info small{color:#868e96;font-size:12.5px;display:block;word-break:break-all}" +
      ".rg-info span{display:inline-block;margin-top:6px;font-size:11px;font-weight:700;color:#fff;background:#fa5252;border-radius:20px;padding:2px 9px}" +
      ".rg-info span.instructor{background:#f59f00}" +
      ".rg-menu a{display:flex;align-items:center;gap:10px;padding:12px 16px;font-weight:600;font-size:14px;color:#343a40;text-decoration:none}" +
      ".rg-menu a:hover{background:#f4f7fb;color:#228be6}" +
      ".rg-menu a.rg-out{color:#fa5252}.rg-menu a.rg-out:hover{background:#fff0f0;color:#e03131}";
    document.head.appendChild(style);

    const btn = document.querySelector(".header .btn-user");
    if (!btn) return;
    const wrap = document.createElement("div");
    wrap.className = "rg-wrap";
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);

    const menu = document.createElement("div");
    menu.className = "rg-menu";
    menu.innerHTML =
      '<div class="rg-info"><b></b><small></small><span></span></div>' +
      '<a href="/index.html"><i class="fa-solid fa-house"></i> Về trang chủ</a>' +
      '<a href="/account/profile.html"><i class="fa-regular fa-id-card"></i> Hồ sơ của tôi</a>' +
      '<a href="#" class="rg-out"><i class="fa-solid fa-right-from-bracket"></i> Thoát</a>';
    menu.querySelector("b").textContent = user.fullName;
    menu.querySelector("small").textContent = user.email;
    const tag = menu.querySelector("span");
    tag.textContent = AuthStore.roleLabel(user.role);
    tag.className = user.role;
    wrap.appendChild(menu);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      wrap.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) wrap.classList.remove("open");
    });
    menu.querySelector(".rg-out").addEventListener("click", (e) => {
      e.preventDefault();
      AuthStore.logout();
      location.href = "/auth/login.html";
    });
  }

  function check() {
    const user = AuthStore.currentUser();
    if (!user) {
      location.replace("/auth/login.html?next=" + encodeURIComponent(location.pathname));
      return;
    }
    if (allowed.indexOf(user.role) < 0) {
      location.replace(AuthStore.homeFor(user));
      return;
    }
    document.documentElement.style.visibility = "visible";
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => addUserMenu(user));
    else addUserMenu(user);
  }

  load(FILES, check);
})();
