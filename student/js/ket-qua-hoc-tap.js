/* =========================================================
   ket-qua-hoc-tap.js - Trang "Kết quả học tập" (học viên)
   Chỉ hiện kết quả của học viên đang đăng nhập.
   Điểm lấy trực tiếp từ bài nộp do giảng viên chấm - học viên chỉ XEM, không sửa được.
   Bài chưa chấm hiện "—", không có điểm giả.
   Mở thẳng một kết quả: ket-qua-hoc-tap.html?submission=BN001
   ========================================================= */
function initResultsPage() {
  const user = SUI.requireStudent();
  if (!user) return;
  SUI.notifyNav("ket-qua-hoc-tap.html");
  const $ = (id) => document.getElementById(id);
  const sid = user.studentId;
  const state = { course: "", status: "", page: 1 };
  const PAGE_SIZE = 8;

  const rows = StudentStore.resultRows(sid);

  /* ---------- Thẻ thống kê ---------- */
  const avg = StudentStore.averageScore(rows);
  const cards = [
    { icon: "fa-star", color: "ic-green", label: "Bài tập đã được chấm", value: rows.filter((r) => r.graded).length },
    { icon: "fa-chart-line", color: "ic-blue", label: "Điểm trung bình (thang 10)", value: avg === null ? "—" : avg },
    { icon: "fa-hourglass-half", color: "ic-amber", label: "Bài đang chờ chấm", value: rows.filter((r) => !r.graded).length },
  ];
  $("stat-grid").innerHTML = cards
    .map((c) => '<div class="stat-card"><div class="stat-icon ' + c.color + '"><i class="fa-solid ' + c.icon + '"></i></div><div><div class="stat-label">' + c.label + '</div><div class="stat-value">' + c.value + "</div></div></div>")
    .join("");

  if (rows.length === 0) {
    $("list-area").innerHTML = '<div class="empty-state"><i class="fa-solid fa-chart-line"></i><h3>Bạn chưa nộp bài tập nào</h3><p>Kết quả sẽ hiện ở đây sau khi bạn nộp bài và giảng viên chấm điểm.</p><a class="btn btn-primary" style="margin-top:12px" href="bai-tap-cua-toi.html">Đến bài tập của tôi</a></div>';
    $("filter-course").style.display = "none";
    $("filter-status").style.display = "none";
    return;
  }

  const courses = {};
  rows.forEach((r) => (courses[r.course.courseId] = r.course.name));
  $("filter-course").innerHTML = '<option value="">Tất cả khóa học</option>' + Object.keys(courses).map((id) => '<option value="' + id + '">' + UI.esc(courses[id]) + "</option>").join("");

  function render() {
    let list = rows;
    if (state.course) list = list.filter((r) => r.course.courseId === state.course);
    if (state.status) list = list.filter((r) => r.key === state.status);
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const items = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    $("list-area").innerHTML = items.length
      ? '<div class="table-wrap"><table class="data-table" style="min-width: 820px"><thead><tr><th>Bài tập</th><th>Khóa học</th><th class="num">Điểm</th><th>Trạng thái</th><th>Ngày chấm</th><th class="num">Chi tiết</th></tr></thead><tbody>' +
        items
          .map(
            (r) =>
              '<tr style="cursor:pointer" data-open="' + r.sub.id + '"><td><div class="cell-title">' + UI.esc(r.a.title) + '</div><div class="cell-sub">Bài ' + r.lesson.order + ": " + UI.esc(r.lesson.title) + "</div></td>" +
              "<td>" + UI.esc(r.course.name) + '</td><td class="num">' + SUI.scoreText(r) + "</td><td>" + SUI.assignBadge(r) + "</td>" +
              "<td>" + (r.graded ? UI.date(r.sub.gradedAt) : '<span class="text-muted">—</span>') + '</td><td class="actions"><button class="btn btn-outline btn-sm" data-open="' + r.sub.id + '">Xem</button></td></tr>'
          )
          .join("") +
        "</tbody></table></div>"
      : '<div class="empty-state"><i class="fa-solid fa-filter"></i><h3>Không có kết quả phù hợp</h3></div>';
    UI.pager($("pager"), list.length, state.page, PAGE_SIZE, (p) => {
      state.page = p;
      render();
    });
  }

  /* ---------- Chi tiết 1 kết quả ---------- */
  function openResult(subId) {
    const r = rows.find((x) => x.sub.id === subId);
    if (!r) return;
    const url = SUI.safeUrl(r.sub.link);
    $("result-title").innerHTML = UI.esc(r.a.title) + " " + SUI.assignBadge(r);
    $("result-body").innerHTML =
      '<div class="info-grid"><div class="info-box"><h4>Bài tập</h4>' +
      '<div class="info-line"><span>Khóa học</span><span>' + UI.esc(r.course.name) + "</span></div>" +
      '<div class="info-line"><span>Giảng viên</span><span>' + UI.esc(r.instructor) + "</span></div>" +
      '<div class="info-line"><span>Hạn nộp</span><span>' + SUI.dueText(r.a.dueDate) + "</span></div></div>" +
      '<div class="info-box"><h4>Kết quả</h4><div class="info-line"><span>Điểm</span><span>' + (r.graded ? '<span class="score-pill">' + r.sub.score + " / " + r.a.maxScore + "</span>" : "Chưa được chấm") + "</span></div>" +
      '<div class="info-line"><span>Ngày chấm</span><span>' + (r.graded ? UI.dateTime(r.sub.gradedAt) : "—") + "</span></div>" +
      '<div class="info-line"><span>Thời gian nộp</span><span>' + UI.dateTime(r.sub.submittedAt) + "</span></div></div></div>" +
      '<h4 class="section-title" style="margin-top:0">Đề bài</h4><div class="info-box pre-text">' + UI.esc(r.a.prompt) + "</div>" +
      '<h4 class="section-title">Bài làm đã nộp</h4>' + (url ? '<a class="link-chip" style="max-width:100%" href="' + UI.esc(url) + '" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>' + UI.esc(SUI.shortUrl(url)) + "</span></a>" : '<span class="text-muted">Đường dẫn không hợp lệ</span>') +
      '<h4 class="section-title">Nhận xét của giảng viên</h4>' +
      (r.graded ? '<div class="feedback-box">' + (UI.esc(r.sub.feedback) || "(Giảng viên không để lại nhận xét)") + "</div>" : '<div class="note"><i class="fa-solid fa-hourglass-half"></i><span>Giảng viên chưa chấm bài này nên chưa có điểm và nhận xét.</span></div>');
    UI.openModal("result-modal");
  }

  $("filter-course").addEventListener("change", (e) => { state.course = e.target.value; state.page = 1; render(); });
  $("filter-status").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; render(); });
  $("list-area").addEventListener("click", (e) => {
    const row = e.target.closest("[data-open]");
    if (row) openResult(row.dataset.open);
  });

  render();
  const wanted = SUI.query("submission");
  if (wanted) openResult(wanted);
}

initResultsPage();
