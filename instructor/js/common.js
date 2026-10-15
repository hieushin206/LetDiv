/* =========================================================
   common.js - Hàm dùng chung cho các trang trong /instructor/pages
   Cần nạp sau: seed-data, store, auth-store, ui (của admin), learning-store
   ========================================================= */
const Ins = {
  user: null,

  // Gọi đầu tiên ở mỗi trang: kiểm tra đăng nhập + quyền. Trả về người dùng hoặc null (đã chuyển trang)
  boot() {
    this.user = LearningStore.requireInstructor();
    if (this.user)
      this.remember(location.pathname.split("/").pop() + location.search); // <-- THÊM
    return this.user;
  },

  // THÊM CẢ HÀM NÀY: báo địa chỉ trang (kèm tham số) cho menu bên ngoài
  remember(url) {
    if (window.parent !== window)
      window.parent.postMessage(
        { type: "letdiv-instructor-url", url: url },
        location.origin,
      );
  },
  courses() {
    return LearningStore.myCourses(this.user);
  },

  // Các đợt học giảng viên phụ trách (có thể lọc theo khóa)
  batches(courseId) {
    return LearningStore.myBatches(this.user).filter((b) => !courseId || b.courseId === courseId).sort((a, b) => a.startDate.localeCompare(b.startDate));
  },

  // "2026-10-14" -> "14/10/2026"
  day(d) {
    return d ? d.split("-").reverse().join("/") : "—";
  },

  // "Đợt 1 (14/10/2026 - 14/04/2027)"
  batchLabel(b) {
    return b.name + " (" + this.day(b.startDate) + " - " + this.day(b.endDate) + ")";
  },

  batchOptions(batches, selected) {
    return batches.map((b) => '<option value="' + b.id + '"' + (b.id === selected ? " selected" : "") + ">" + UI.esc(this.batchLabel(b)) + "</option>").join("");
  },

  batchStatusBadge(b) {
    const st = Store.batchStatus(b);
    const map = { upcoming: ["badge-warning", "Sắp diễn ra"], running: ["badge-success", "Đang diễn ra"], ended: ["badge-muted", "Đã kết thúc"] }[st];
    return '<span class="badge ' + map[0] + '">' + map[1] + "</span>";
  },

  noBatchHtml() {
    return (
      '<div class="empty-state"><i class="fa-regular fa-calendar"></i><h3>Chưa có đợt học nào do bạn phụ trách</h3>' +
      "<p>Admin cần tạo đợt học (trang Đợt học) và chọn bạn là giảng viên phụ trách thì bạn mới quản lý được bài học, bài tập.</p></div>"
    );
  },

  // Lấy tham số trên thanh địa chỉ: ?course=KH001
  param(name) {
    return new URLSearchParams(location.search).get(name) || "";
  },

  // Cập nhật tham số trên địa chỉ mà không tải lại trang
  setParam(name, value) {
    const url = new URL(location.href);
    url.searchParams.set(name, value);
    history.replaceState(null, "", url);
  },

  /* ---------- Thành phần giao diện nhỏ ---------- */
  avatar(name, extraClass) {
    return (
      '<span class="avatar ' +
      (extraClass || "") +
      '">' +
      UI.esc(UI.initials(name || "?")) +
      "</span>"
    );
  },

  lessonBadge(status) {
    return status === "visible"
      ? '<span class="badge badge-success">Đang hiển thị</span>'
      : '<span class="badge badge-muted">Đã ẩn</span>';
  },

  gradeBadge(graded) {
    return graded
      ? '<span class="badge badge-success">Đã chấm</span>'
      : '<span class="badge badge-warning">Chờ chấm</span>';
  },

  enrollBadge(status) {
    const map = {
      completed: ["badge-success", "Đang học"],
      cancelled: ["badge-danger", "Đã hủy"],
    };
    const m = map[status] || ["badge-muted", status];
    return '<span class="badge ' + m[0] + '">' + m[1] + "</span>";
  },

  // Rút gọn đường dẫn để hiển thị trong bảng: github.com/abc/xyz...
  shortUrl(url) {
    return String(url || "")
      .replace(/^https?:\/\/(www\.)?/, "")
      .replace(/\/$/, "");
  },

  // Link mở TAB MỚI. Chỉ tạo thẻ <a> khi là http/https (chặn javascript: ...)
  linkHtml(url) {
    if (!url) return '<span class="text-muted">—</span>';
    if (!isHttpUrl(url)) return UI.esc(url);
    return (
      '<a class="link-cell" href="' +
      UI.esc(url) +
      '" target="_blank" rel="noopener noreferrer" title="' +
      UI.esc(url) +
      '"><i class="fa-solid fa-arrow-up-right-from-square"></i> ' +
      UI.esc(this.shortUrl(url)) +
      "</a>"
    );
  },

  scoreText(score, max) {
    return (
      '<span class="score-pill">' + score + "<small>/" + max + "</small></span>"
    );
  },

  // Thông báo khi giảng viên chưa phụ trách khóa học nào
  noCourseHtml() {
    return (
      '<div class="empty-state"><i class="fa-solid fa-book-open"></i><h3>Bạn chưa phụ trách khóa học nào</h3>' +
      "<p>Admin cần phân công bạn vào khóa học (trang Khóa học của admin) thì khóa học mới hiện ở đây.</p></div>"
    );
  },

  // Dựng <option> từ danh sách khóa học
  courseOptions(courses, selected) {
    return courses
      .map(
        (c) =>
          '<option value="' +
          c.id +
          '"' +
          (c.id === selected ? " selected" : "") +
          ">" +
          UI.esc(c.name) +
          "</option>",
      )
      .join("");
  },
};
