/* =========================================================
   tong-quan.js - Trang "Tổng quan" của giảng viên
   Chỉ thống kê các khóa học mà giảng viên đang đăng nhập phụ trách.
   ========================================================= */
function initDashboard() {
  if (!Ins.boot()) return;
  const $ = (id) => document.getElementById(id);

  const courses = Ins.courses();
  const courseIds = courses.map((c) => c.id);
  const myBatches = Ins.batches(); // các đợt học tôi phụ trách
  const lessons = LearningStore.getLessonsOfBatches(myBatches.map((b) => b.id));
  const enrolls = LearningStore.enrollments(courseIds, Ins.user);
  const active = enrolls.filter((e) => e.status === "completed");
  const studentCount = new Set(active.map((e) => e.studentId)).size;
  const pendingSubs = LearningStore.pendingSubmissions(Ins.user);

  // Lời chào + ngày hôm nay
  $("today-text").textContent =
    "Xin chào " + Ins.user.fullName + "! Hôm nay là " +
    new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) + ".";

  // Cảnh báo bài chờ chấm: dẫn tới bài tập đầu tiên đang có bài chờ
  if (pendingSubs.length > 0) {
    const firstAssignment = pendingSubs[0].assignmentId;
    $("pending-alert").innerHTML =
      '<div class="alert-bar"><i class="fa-solid fa-bell"></i><span>Có <b>' + pendingSubs.length +
      ' bài nộp</b> của học viên đang chờ bạn chấm.</span><a href="bai-nop.html?assignment=' + firstAssignment + '">Chấm ngay</a></div>';
  }

  /* ---------- 4 thẻ thống kê ---------- */
  const cards = [
    { icon: "fa-book-open", color: "ic-blue", label: "Khóa học phụ trách", value: courses.length, sub: myBatches.length + " đợt học · " + myBatches.filter((b) => Store.batchStatus(b) === "running").length + " đang diễn ra" },
    { icon: "fa-user-graduate", color: "ic-green", label: "Học viên đang học", value: studentCount, sub: active.length + " lượt đăng ký" },
    { icon: "fa-list-ol", color: "ic-amber", label: "Tổng số bài học", value: lessons.length, sub: lessons.filter((l) => l.status === "hidden").length + " bài đang ẩn" },
    { icon: "fa-hourglass-half", color: "ic-violet", label: "Bài nộp chờ chấm", value: pendingSubs.length, sub: pendingSubs.length ? "Cần chấm sớm" : "Đã chấm hết" },
  ];
  $("stat-grid").innerHTML = cards
    .map((c) => {
      return (
        '<div class="stat-card"><div class="stat-icon ' + c.color + '"><i class="fa-solid ' + c.icon + '"></i></div><div>' +
        '<div class="stat-label">' + c.label + '</div><div class="stat-value">' + c.value + "</div>" +
        '<div class="stat-sub">' + c.sub + "</div></div></div>"
      );
    })
    .join("");

  /* ---------- Học viên đăng ký gần đây (6 lượt mới nhất) ---------- */
  const recent = enrolls.slice(0, 6);
  if (recent.length === 0) {
    $("recent-students").innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-graduate"></i><h3>Chưa có học viên đăng ký</h3></div>';
  } else {
    $("recent-students").innerHTML =
      '<table class="data-table" style="min-width: 520px"><thead><tr><th>Học viên</th><th>Khóa học</th><th>Ngày đăng ký</th><th>Trạng thái</th></tr></thead><tbody>' +
      recent
        .map((e) => {
          return (
            '<tr><td><div class="user-cell">' + Ins.avatar(e.studentName) + '<div><div class="cell-title">' + UI.esc(e.studentName) + '</div><div class="cell-sub">' + UI.esc(e.studentId) + "</div></div></div></td>" +
            '<td><div class="clamp-2 cell-wide">' + UI.esc(e.courseName) + "</div></td>" +
            "<td>" + UI.date(e.date) + "</td><td>" + Ins.enrollBadge(e.status) + "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";
  }

  /* ---------- Khóa học nhiều học viên nhất ---------- */
  const ranked = courses
    .map((c) => ({ course: c, count: LearningStore.courseStudentCount(c.id, Ins.user) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  if (ranked.length === 0 || ranked[0].count === 0) {
    $("top-courses").innerHTML = '<div class="empty-state"><i class="fa-solid fa-trophy"></i><h3>Chưa có dữ liệu học viên</h3></div>';
  } else {
    $("top-courses").innerHTML = ranked
      .map((r, i) => {
        const c = r.course;
        return (
          '<li class="rank-item"><span class="rank-num">' + (i + 1) + "</span>" +
          '<img class="thumb" src="' + UI.esc(UI.img(c.image)) + '" alt="">' +
          '<div class="rank-info"><div class="cell-title" title="' + UI.esc(c.name) + '">' + UI.esc(c.name) + '</div><div class="cell-sub">' + UI.esc(Store.categoryName(c.categoryId)) + "</div></div>" +
          '<div class="rank-value">' + r.count + " học viên</div></li>"
        );
      })
      .join("");
  }

  /* ---------- Danh sách khóa học đang phụ trách ---------- */
  if (courses.length === 0) {
    $("my-courses").innerHTML = Ins.noCourseHtml();
  } else {
    $("my-courses").innerHTML =
      '<table class="data-table" style="min-width: 480px"><thead><tr><th>Khóa học</th><th class="num">Bài học</th><th class="num">Học viên</th><th class="actions"></th></tr></thead><tbody>' +
      courses
        .map((c) => {
          return (
            '<tr><td><div class="user-cell"><img class="thumb" style="width: 64px; height: 40px" src="' + UI.esc(UI.img(c.image)) + '" alt="">' +
            '<div><div class="cell-title clamp-2 cell-wide">' + UI.esc(c.name) + '</div><div class="cell-sub">' + UI.esc(Store.categoryName(c.categoryId)) + "</div></div></div></td>" +
            '<td class="num">' + LearningStore.getLessonsOfBatches(myBatches.filter((b) => b.courseId === c.id).map((b) => b.id)).length + '</td><td class="num">' + LearningStore.courseStudentCount(c.id, Ins.user) + "</td>" +
            '<td class="actions"><a class="icon-btn" title="Quản lý bài học" href="ql-bai-hoc.html?course=' + c.id + '"><i class="fa-regular fa-pen-to-square"></i></a></td></tr>'
          );
        })
        .join("") +
      "</tbody></table>";
  }

  /* ---------- Bài học vừa được cập nhật (5 bài mới nhất) ---------- */
  const latest = lessons.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
  if (latest.length === 0) {
    $("recent-lessons").innerHTML = '<div class="empty-state"><i class="fa-solid fa-list-ol"></i><h3>Chưa có bài học</h3></div>';
  } else {
    $("recent-lessons").innerHTML = latest
      .map((l) => {
        const c = courses.find((x) => x.id === l.courseId);
        const b = Store.getBatch(l.batchId);
        return (
          '<li class="rank-item"><span class="rank-num">' + l.order + "</span>" +
          '<div class="rank-info"><div class="cell-title" title="' + UI.esc(l.name) + '">' + UI.esc(l.name) + '</div><div class="cell-sub">' + UI.esc((c ? c.name : "") + (b ? " · " + b.name : "")) + "</div></div>" +
          '<div class="rank-value" style="font-weight: 600; font-size: 13px">' + UI.date(l.updatedAt) + "<small>" + UI.time(l.updatedAt) + "</small></div></li>"
        );
      })
      .join("");
  }
}

initDashboard();
