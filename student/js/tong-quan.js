/* =========================================================
   tong-quan.js - Trang "Tổng quan" của học viên
   Mọi con số lấy từ dữ liệu của tài khoản đang đăng nhập (đơn hàng, tiến độ,
   bài tập, bài nộp) - không có số liệu nhập cố định.
   ========================================================= */
function initStudentDashboard() {
  const user = SUI.requireStudent();
  if (!user) return;
  SUI.notifyNav("tong-quan.html");
  const $ = (id) => document.getElementById(id);
  const sid = user.studentId;

  $("greeting").textContent = "Xin chào " + user.fullName + "! Chúc bạn một buổi học hiệu quả.";

  const owned = StudentStore.ownedCourses(sid);
  if (owned.length === 0) {
    $("content").innerHTML = SUI.noCourseHtml();
    return;
  }

  const doneSet = StudentStore.doneSet(sid);
  const progress = {};
  owned.forEach((c) => (progress[c.courseId] = StudentStore.courseProgress(sid, c.courseId, doneSet)));
  const rows = StudentStore.assignmentsOf(sid);
  const results = StudentStore.resultRows(sid);

  /* ---------- Bốn thẻ thống kê ---------- */
  const todo = rows.filter((r) => !r.submitted); // chưa nộp
  const soon = todo.filter((r) => !r.overdue && new Date(r.a.dueDate).getTime() - Date.now() <= 3 * 86400000);
  const cards = [
    { icon: "fa-book-open", color: "ic-blue", label: "Khóa học đã mua", value: owned.length, sub: owned.filter((c) => progress[c.courseId].status === "done").length + " khóa đã hoàn thành" },
    { icon: "fa-circle-check", color: "ic-green", label: "Bài học đã hoàn thành", value: StudentStore.totalLessonsDone(sid), sub: "Trên " + owned.reduce((t, c) => t + progress[c.courseId].total, 0) + " bài học" },
    { icon: "fa-hourglass-half", color: "ic-amber", label: "Bài tập chưa nộp", value: todo.length, sub: soon.length + " bài sắp đến hạn (≤ 3 ngày)" },
    { icon: "fa-star", color: "ic-violet", label: "Bài tập đã được chấm", value: results.filter((r) => r.graded).length, sub: results.filter((r) => !r.graded).length + " bài đang chờ chấm" },
  ];
  $("stat-grid").innerHTML = cards
    .map((c) => '<div class="stat-card"><div class="stat-icon ' + c.color + '"><i class="fa-solid ' + c.icon + '"></i></div><div><div class="stat-label">' + c.label + '</div><div class="stat-value">' + c.value + '</div><div class="stat-sub">' + c.sub + "</div></div></div>")
    .join("");

  /* ---------- Khóa học học gần đây (3 khóa) ---------- */
  const recent = StudentStore.recentCourses(sid, 3);

  // Banner "Tiếp tục học" cho khóa học gần nhất
  const top = recent[0];
  const topLesson = StudentStore.continueLesson(sid, top.courseId);
  $("continue-box").innerHTML =
    '<div class="continue-card"><img src="' + UI.esc(UI.img(top.image)) + '" alt="">' +
    '<div class="cc-info"><small>' + (top.studiedAt ? "Bài học đang học gần nhất" : "Bắt đầu học thôi") + "</small>" +
    "<h2>" + UI.esc(topLesson ? topLesson.title : top.name) + "</h2><p>" + UI.esc(top.name) + " · tiến độ " + progress[top.courseId].percent + "%</p></div>" +
    (topLesson
      ? '<a class="btn" href="' + StudentStore.learnUrl(top.courseId, topLesson.id) + '"><i class="fa-solid fa-play"></i> Tiếp tục học</a>'
      : '<a class="btn" href="khoa-hoc-cua-toi.html">Xem khóa học</a>') +
    "</div>";

  $("recent-courses").innerHTML = recent
    .map((c) => {
      const p = progress[c.courseId];
      const lesson = StudentStore.continueLesson(sid, c.courseId);
      return (
        '<div class="mini-course"><img src="' + UI.esc(UI.img(c.image)) + '" alt=""><div class="mc-info"><div class="cell-title" title="' + UI.esc(c.name) + '">' + UI.esc(c.name) + "</div>" +
        '<div class="cell-sub">' + (c.studiedAt ? "Học " + SUI.ago(c.studiedAt).toLowerCase() : "Mua ngày " + UI.date(c.boughtAt)) + " · " + p.done + "/" + p.total + " bài</div>" + SUI.progressBar(p) + "</div>" +
        (lesson ? '<a class="btn btn-primary btn-sm" href="' + StudentStore.learnUrl(c.courseId, lesson.id) + '">Tiếp tục học</a>' : '<span class="badge badge-muted no-dot">Sắp có</span>') + "</div>"
      );
    })
    .join("");

  /* ---------- Bài tập sắp đến hạn ---------- */
  // Chưa nộp, còn nhận bài: bài chưa quá hạn xếp trước (hạn gần nhất lên đầu), sau đó là bài quá hạn nhưng vẫn nhận nộp muộn
  const due = todo
    .slice()
    .sort((x, y) => (x.overdue - y.overdue) || new Date(x.a.dueDate) - new Date(y.a.dueDate))
    .slice(0, 5);
  $("due-list").innerHTML = due.length
    ? due
        .map(
          (r) =>
            '<a class="due-item" href="bai-tap-cua-toi.html?assignment=' + r.a.id + '"><span class="di-ic"><i class="fa-solid fa-list-check"></i></span>' +
            '<div class="di-info"><div class="cell-title">' + UI.esc(r.a.title) + '</div><div class="cell-sub">' + UI.esc(r.course.name) + " · hạn " + SUI.dueText(r.a.dueDate) + "</div></div>" +
            SUI.dueBadge(r) + "</a>"
        )
        .join("")
    : '<div class="empty-state" style="padding: 26px"><i class="fa-regular fa-face-smile"></i><h3>Không có bài tập nào cần nộp</h3><p>Bạn đã hoàn thành hết bài tập hiện có.</p></div>';

  /* ---------- Tiến độ từng khóa học ---------- */
  $("progress-list").innerHTML = owned
    .map((c) => {
      const p = progress[c.courseId];
      return (
        '<div class="prog-row"><div class="bar-top"><span title="' + UI.esc(c.name) + '">' + UI.esc(c.name) + "</span><span>" + p.done + "/" + p.total + " bài · <b>" + p.percent + "%</b></span></div>" + SUI.progressBar(p) + "</div>"
      );
    })
    .join("");

  /* ---------- Hoạt động gần đây ---------- */
  const icons = { lesson: "fa-circle-check", submit: "fa-paper-plane", grade: "fa-star", order: "fa-cart-shopping" };
  const acts = StudentStore.activities(sid, 8);
  $("activity-list").innerHTML = acts.length
    ? acts
        .map(
          (a) =>
            '<a class="act-item act-' + a.type + '" href="' + a.href + '"><span class="act-ic"><i class="fa-solid ' + icons[a.type] + '"></i></span><div><div class="act-text">' + UI.esc(a.text) + '</div><div class="act-time">' + SUI.ago(a.at) + "</div></div></a>"
        )
        .join("")
    : '<div class="empty-state" style="padding: 26px"><i class="fa-regular fa-clock"></i><h3>Chưa có hoạt động</h3></div>';
}

initStudentDashboard();
