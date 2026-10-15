/* =========================================================
   shell.js - Khung student/index.html
   - Tô sáng mục menu bên trái.
   - Mở thẳng một trang con theo địa chỉ, ví dụ nút "Vào học":
       /student/index.html?page=hoc-tap&course=KH014
     (các tham số còn lại như course, lesson, assignment được chuyển cho trang con)
   - Khi trang con tự chuyển trang (VD: bấm "Tiếp tục học") nó báo lên đây để
     menu bên trái sáng đúng mục.
   ========================================================= */
(function () {
  const PAGES = ["tong-quan", "khoa-hoc-cua-toi", "hoc-tap", "bai-tap-cua-toi", "ket-qua-hoc-tap", "lich-su-don-hang"];
  const links = document.querySelectorAll(".side-bar .nav a");
  const frame = document.querySelector("iframe[name=content]");

  function setActive(page) {
    links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "pages/" + page));
  }

  links.forEach((a) =>
    a.addEventListener("click", () => {
      links.forEach((x) => x.classList.remove("active"));
      a.classList.add("active");
    })
  );

  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "letdiv-student-page") setActive(e.data.page);
  });

  // Mở trực tiếp trang con theo ?page=...
  const params = new URLSearchParams(location.search);
  const page = params.get("page");
  if (PAGES.indexOf(page) >= 0) {
    params.delete("page");
    const rest = params.toString();
    frame.src = "pages/" + page + ".html" + (rest ? "?" + rest : "");
    setActive(page + ".html");
  }
})();
