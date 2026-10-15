const navLinks = document.querySelectorAll(".nav a");

function setActive(link) {
  navLinks.forEach((item) => item.classList.remove("active"));
  if (link) link.classList.add("active");
}

navLinks.forEach((link) => {
  link.addEventListener("click", function () {
    setActive(this);
  });
});

// Khi trang bên trong iframe tự chuyển trang (VD: bấm "Xem tất cả" ở Tổng quan)
// nó gửi tên trang lên đây để menu bên trái sáng đúng mục.
window.addEventListener("message", (e) => {
  if (!e.data || e.data.type !== "letdiv-admin-page") return;
  setActive(document.querySelector('.nav a[href$="' + e.data.page + '"]'));
});
