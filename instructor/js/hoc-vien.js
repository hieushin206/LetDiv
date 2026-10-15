/* =========================================================
   hoc-vien.js - Học viên thuộc các khóa học của giảng viên
   Chỉ XEM: không sửa tài khoản / mật khẩu, không xóa (quyền của Admin).
   ========================================================= */
function initStudentPage() {
  if (!Ins.boot()) return;
  const $ = (id) => document.getElementById(id);
  const PAGE_SIZE = 10;

  const courses = Ins.courses();
  const courseIds = courses.map((c) => c.id);
  const all = LearningStore.enrollments(courseIds, Ins.user);

  const fromUrl = Ins.param("course");
  const state = { keyword: "", courseId: courses.some((c) => c.id === fromUrl) ? fromUrl : "", batchId: "", status: "", page: 1 };

  $("filter-course").innerHTML = '<option value="">Tất cả khóa học của tôi</option>' + Ins.courseOptions(courses, state.courseId);

  // Lọc theo đợt học: các đợt của khóa đang chọn (hoặc tất cả đợt của tôi)
  function renderBatchFilter() {
    const list = Ins.batches(state.courseId);
    if (!list.some((b) => b.id === state.batchId)) state.batchId = "";
    $("filter-batch").innerHTML = '<option value="">Tất cả đợt học</option>' + Ins.batchOptions(list, state.batchId);
  }
  renderBatchFilter();

  function filtered() {
    const kw = UI.normalize(state.keyword);
    return all.filter((e) => {
      if (state.courseId && e.courseId !== state.courseId) return false;
      if (state.batchId && e.batchId !== state.batchId) return false;
      if (state.status && e.status !== state.status) return false;
      return !kw || UI.normalize(e.studentName + " " + e.studentEmail).indexOf(kw) >= 0;
    });
  }

  function render() {
    if (courses.length === 0) {
      $("list-area").innerHTML = Ins.noCourseHtml();
      $("pager").innerHTML = "";
      return;
    }
    const list = filtered();
    if (list.length === 0) {
      $("list-area").innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-graduate"></i><h3>Không có học viên phù hợp</h3><p>Hãy thử từ khóa hoặc bộ lọc khác.</p></div>';
      $("pager").innerHTML = "";
      return;
    }
    const pages = Math.ceil(list.length / PAGE_SIZE);
    if (state.page > pages) state.page = pages;
    const rows = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    $("list-area").innerHTML =
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Mã HV</th><th>Học viên</th><th>Khóa học</th><th>Đợt học</th><th>Ngày đăng ký</th><th>Trạng thái</th><th class="actions"></th></tr></thead><tbody>' +
      rows
        .map((e) => {
          return (
            '<tr><td class="mono"><b>' + UI.esc(e.studentId) + "</b></td>" +
            '<td><div class="user-cell">' + Ins.avatar(e.studentName) + '<div><div class="cell-title">' + UI.esc(e.studentName) + '</div><div class="cell-sub">' + UI.esc(e.studentEmail) + "</div></div></div></td>" +
            '<td><div class="clamp-2 cell-wide">' + UI.esc(e.courseName) + "</div></td>" +
            "<td>" + UI.esc(e.batchName || "—") + "</td>" +
            "<td>" + UI.date(e.date) + '<div class="cell-sub">' + UI.time(e.date) + "</div></td>" +
            "<td>" + Ins.enrollBadge(e.status) + "</td>" +
            '<td class="actions"><button class="icon-btn" title="Xem chi tiết" data-detail="' + e.studentId + '"><i class="fa-regular fa-eye"></i></button></td></tr>'
          );
        })
        .join("") +
      "</tbody></table></div>";

    UI.pager($("pager"), list.length, state.page, PAGE_SIZE, (p) => {
      state.page = p;
      render();
    });
  }

  /* ---------- Chi tiết 1 học viên (chỉ trong phạm vi khóa học của giảng viên) ---------- */
  function openDetail(studentId) {
    const st = Store.getStudent(studentId);
    const mine = all.filter((e) => e.studentId === studentId);
    if (mine.length === 0) return;
    const name = st ? st.name : mine[0].studentName;
    const email = st ? st.email : mine[0].studentEmail;

    // Bài tập của các khóa học thuộc giảng viên mà học viên này đã nộp
    const results = LearningStore.resultMap();
    const assignments = LearningStore.getAssignmentsOfBatches(Ins.batches().map((b) => b.id));
    const works = [];
    assignments.forEach((a) => {
      const sub = LearningStore.submissionOf(studentId, a.id);
      if (sub) works.push({ a: a, sub: sub, result: results[sub.id] || null });
    });
    const graded = works.filter((w) => w.result);
    const avg = graded.length ? Math.round((graded.reduce((t, w) => t + w.result.score, 0) / graded.length) * 100) / 100 : "—";

    $("detail-body").innerHTML =
      '<div class="user-cell" style="margin-bottom: 18px">' + Ins.avatar(name, "lg") + '<div><h3 style="font-size: 20px">' + UI.esc(name) + '</h3><div class="cell-sub">' + UI.esc(studentId) + "</div></div></div>" +
      '<div class="info-grid"><div class="info-box"><h4>Thông tin liên hệ</h4>' +
      '<div class="info-line"><span>Mã học viên</span><span>' + UI.esc(studentId) + "</span></div>" +
      '<div class="info-line"><span>Họ tên</span><span>' + UI.esc(name) + "</span></div>" +
      '<div class="info-line"><span>Email</span><span>' + UI.esc(email) + "</span></div></div>" +
      '<div class="info-box"><h4>Học tập trong phạm vi của bạn</h4>' +
      '<div class="info-line"><span>Số khóa học</span><span>' + new Set(mine.map((m) => m.courseId)).size + "</span></div>" +
      '<div class="info-line"><span>Bài đã nộp</span><span>' + works.length + "</span></div>" +
      '<div class="info-line"><span>Điểm trung bình</span><span>' + avg + "</span></div></div></div>" +
      '<h4 class="section-title">Khóa học &amp; đợt học (của bạn)</h4>' +
      '<table class="mini-table"><thead><tr><th>Khóa học</th><th>Đợt học</th><th>Ngày đăng ký</th><th>Mã đơn</th><th>Trạng thái</th></tr></thead><tbody>' +
      mine.map((m) => "<tr><td>" + UI.esc(m.courseName) + "</td><td>" + UI.esc(m.batchName || "—") + "</td><td>" + UI.date(m.date) + '</td><td class="mono">' + UI.esc(m.orderId) + "</td><td>" + Ins.enrollBadge(m.status) + "</td></tr>").join("") +
      "</tbody></table>" +
      '<h4 class="section-title">Bài tập đã nộp</h4>' +
      (works.length === 0
        ? '<div class="text-muted">Học viên chưa nộp bài tập nào.</div>'
        : '<table class="mini-table"><thead><tr><th>Bài tập</th><th>Nộp lúc</th><th>Trạng thái</th><th class="num">Điểm</th></tr></thead><tbody>' +
          works
            .map((w) => "<tr><td>" + UI.esc(w.a.name) + "</td><td>" + UI.dateTime(w.sub.submittedAt) + "</td><td>" + Ins.gradeBadge(!!w.result) + '</td><td class="num">' + (w.result ? w.result.score + "/" + w.a.maxScore : "—") + "</td></tr>")
            .join("") +
          "</tbody></table>");
    UI.openModal("detail-modal");
  }

  /* ---------- Sự kiện ---------- */
  $("search").addEventListener(
    "input",
    UI.debounce((e) => {
      state.keyword = e.target.value;
      state.page = 1;
      render();
    }, 200)
  );
  $("filter-batch").addEventListener("change", (e) => {
    state.batchId = e.target.value;
    state.page = 1;
    render();
  });
  $("filter-course").addEventListener("change", (e) => {
    state.courseId = e.target.value;
    renderBatchFilter();
    state.page = 1;
    render();
  });
  $("filter-status").addEventListener("change", (e) => {
    state.status = e.target.value;
    state.page = 1;
    render();
  });
  $("list-area").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-detail]");
    if (btn) openDetail(btn.dataset.detail);
  });

  render();
}

initStudentPage();
