/* =========================================================
   my-courses.js - Trang "Khóa học đã mua" (account/my-courses.html)
   Hiển thị các khóa học nằm trong đơn hàng ĐÃ THANH TOÁN THÀNH CÔNG
   (đơn "Hoàn thành"). Đơn bị hủy không tính.
   ========================================================= */
function initMyCoursesPage() {
  const user = Account.requireStudent();
  if (!user) return;
  Account.renderSide(user, "courses");

  const $ = (id) => document.getElementById(id);
  const esc = (t) => CartUI.esc(t);

  const orders = user.studentId ? Store.ordersOfStudent(user.studentId) : [];
  const purchased = user.studentId
    ? Store.purchasedCourses(user.studentId)
    : [];
  const spent = Store.sumTotal(Store.completedOrders(orders));

  function dateText(iso) {
    const d = new Date(iso);
    return (
      String(d.getDate()).padStart(2, "0") +
      "/" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "/" +
      d.getFullYear()
    );
  }

  /* ---------- Thống kê ---------- */
  $("mc-stats").innerHTML =
    '<div class="acc-stat"><div class="ic"><i class="fa-solid fa-book-open"></i></div><div><small>Khóa học đã mua</small><b>' +
    purchased.length +
    "</b></div></div>" +
    '<div class="acc-stat"><div class="ic green"><i class="fa-solid fa-receipt"></i></div><div><small>Đơn đã thanh toán</small><b>' +
    Store.completedOrders(orders).length +
    "</b></div></div>" +
    '<div class="acc-stat"><div class="ic violet"><i class="fa-solid fa-wallet"></i></div><div><small>Tổng đã thanh toán</small><b>' +
    formatVnd(spent) +
    "</b></div></div>";


  /* ---------- Danh sách khóa học ---------- */
  // Đã được admin phân vào lớp của giảng viên cho khóa này (theo đơn mua) chưa?
  function isAssigned(it) {
    return !!Store.classOf(it.orderId, it.courseId);
  }

  function cardHtml(it) {
    const course = Store.getCourse(it.courseId);
    const href = course && course.href ? "/" + course.href : "";
    // Nút "Vào học" mở khu vực học tập (student) đúng khóa này
    const learnHref = course
      ? "/student/index.html?page=hoc-tap&course=" + encodeURIComponent(it.courseId)
      : "";
    return (
      '<div class="mc-card"><div class="mc-thumb"><img src="' +
      esc(CartUI.img(it.image)) +
      '" alt="">' +
      '<span class="mc-paid"><i class="fa-solid fa-circle-check"></i> Đã thanh toán</span></div>' +
      '<div class="mc-body"><div class="mc-cat">' +
      esc(it.categoryName || "Khóa học") +
      "</div>" +
      '<h3 class="mc-name">' +
      (href
        ? '<a href="' + esc(href) + '">' + esc(it.name) + "</a>"
        : esc(it.name)) +
      "</h3>" +
      '<div class="mc-meta"><div><i class="fa-solid fa-chalkboard-user"></i> ' +
      esc(it.instructor) +
      "</div>" +
      '<div><i class="fa-regular fa-calendar"></i> Mua ngày ' +
      dateText(it.date) +
      "</div>" +
      '<div><i class="fa-solid fa-hashtag"></i> Mã đơn ' +
      esc(it.orderId) +
      "</div></div>" +
      '<div class="mc-foot"><span class="mc-price">' +
      formatVnd(it.price) +
      "</span>" +
      (learnHref
        ? // Chưa được admin phân lớp: nút vẫn bấm được nhưng chỉ báo thông báo, không cho vào trang student
          '<a class="mc-btn" href="' +
          (isAssigned(it) ? esc(learnHref) : "#") +
          '"' +
          (isAssigned(it) ? "" : ' data-noclass="' + esc(it.name) + '"') +
          '><i class="fa-solid fa-play"></i> Vào học</a>'
        : '<span class="mc-btn disabled">Sắp có</span>') +
      "</div></div></div>"
    );
  }

  function render(keyword) {
    const kw = (keyword || "").trim().toLowerCase();
    const list = kw
      ? purchased.filter(
          (it) =>
            (it.name + " " + it.instructor).toLowerCase().indexOf(kw) >= 0,
        )
      : purchased;

    if (purchased.length === 0) {
      $("mc-list").innerHTML =
        '<div class="mc-empty"><div class="ic"><i class="fa-solid fa-graduation-cap"></i></div><h3>Bạn chưa mua khóa học nào</h3>' +
        "<p>Các khóa học bạn đã thanh toán thành công sẽ hiện ở đây.</p>" +
        '<a class="acc-btn primary" href="/courses/course.html"><i class="fa-solid fa-book-open"></i> Khám phá khóa học</a></div>';
      $("mc-toolbar").classList.add("hidden");
      return;
    }
    if (list.length === 0) {
      $("mc-list").innerHTML =
        '<div class="mc-empty"><div class="ic"><i class="fa-solid fa-magnifying-glass"></i></div><h3>Không tìm thấy khóa học</h3><p>Hãy thử từ khóa khác.</p></div>';
      return;
    }
    $("mc-list").innerHTML =
      '<div class="mc-grid">' + list.map(cardHtml).join("") + "</div>";
  }

  $("mc-search").addEventListener("input", (e) => render(e.target.value));

  // Bấm "Vào học" khi chưa được phân lớp: báo thông báo và chặn không cho sang trang student
  $("mc-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-noclass]");
    if (!btn) return;
    e.preventDefault();
    CartUI.toast(
      'Bạn chưa được phân vào đợt học của khóa "' + btn.dataset.noclass + '". Vui lòng chờ admin phân đợt rồi quay lại nhé.',
      "error",
    );
  });
  render("");
}

// Chạy khi header-auth.js đã sẵn sàng (kể cả khi file này được gắn TRƯỚC header-auth.js)
(function (run) {
  if (typeof AuthReady === "function") AuthReady(run);
  else
    window.addEventListener("load", function () {
      AuthReady(run);
    });
})(initMyCoursesPage);
