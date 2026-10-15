/* =========================================================
   nav-highlight.js - Làm sáng mục menu bên trái của instructor/index.html
   - Mục đang xem được sáng (class "active")
   - "Quản lý bài học" có 2 mục con: Quản lý bài tập, Bài nộp.
     Mục con chỉ xổ ra khi đang ở nhóm này; mục cha sáng nhẹ ("parent-active")
   - Mục con cần tham số (?lesson=..., ?assignment=...) nên menu nhớ
     địa chỉ trang con gần nhất do trang trong iframe báo lên
   ========================================================= */
const navLinks = Array.from(document.querySelectorAll(".nav a"));
const lessonGroup = document.getElementById("nav-lessons");
const lessonLink = lessonGroup.querySelector("a:not([data-page])");
const subLinks = {
  "ql-bai-tap.html": lessonGroup.querySelector('[data-page="ql-bai-tap.html"]'),
  "bai-nop.html": lessonGroup.querySelector('[data-page="bai-nop.html"]'),
};
const LESSON_FLOW = ["ql-bai-hoc.html", "ql-bai-tap.html", "bai-nop.html"];

// Tên trang của 1 mục menu: mục con lấy từ data-page, mục thường lấy từ href
function keyOf(link) {
  return (
    link.dataset.page ||
    link.getAttribute("href").split("?")[0].split("/").pop()
  );
}

function setActiveByPage(page) {
  navLinks.forEach((l) => l.classList.remove("active", "parent-active"));
  const target = navLinks.find((l) => keyOf(l) === page);
  if (target) target.classList.add("active");
  if (page === "ql-bai-tap.html" || page === "bai-nop.html")
    lessonLink.classList.add("parent-active");
  lessonGroup.classList.toggle("open", LESSON_FLOW.indexOf(page) >= 0);
}

navLinks.forEach((link) => {
  link.addEventListener("click", function () {
    setActiveByPage(keyOf(this));
  });
});

window.addEventListener("message", (e) => {
  if (e.origin !== location.origin || !e.data) return;

  // Trang trong iframe vừa mở -> menu sáng đúng mục
  if (e.data.type === "letdiv-admin-page") setActiveByPage(e.data.page);

  // Trang con báo địa chỉ đầy đủ (kèm tham số) -> gắn vào mục con tương ứng để bấm được
  if (e.data.type === "letdiv-instructor-url") {
    const m = /^(ql-bai-tap|bai-nop)\.html\?[\w=&%.-]+$/.exec(
      String(e.data.url),
    );
    if (!m) return;
    const link = subLinks[m[1] + ".html"];
    link.setAttribute("href", "pages/" + e.data.url);
    link.classList.remove("disabled");
  }
});
