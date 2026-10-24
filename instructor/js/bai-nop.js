/* =========================================================
   bai-nop.js - Xem bài nộp và chấm điểm (Chức năng 3)
   Địa chỉ trang: bai-nop.html?assignment=BT001
   - Tìm học viên, lọc chờ chấm / đã chấm
   - Mở link bài làm ở tab mới (không chạy code của học viên)
   - Nhập điểm 0..điểm tối đa + nhận xét, lưu, chấm lại
   ========================================================= */
function initSubmissionPage() {
  if (!Ins.boot()) return;
  const $ = (id) => document.getElementById(id);
  const PAGE_SIZE = 10;

  // Bài tập phải thuộc khóa học giảng viên phụ trách
  const assignment = LearningStore.getAssignment(Ins.param("assignment"));
  const course = assignment ? LearningStore.ownCourse(Ins.user, assignment.courseId) : null;
  const lessonOfAssignment = assignment ? LearningStore.getLesson(assignment.lessonId) : null;
  if (!assignment || !course || !lessonOfAssignment) {
    $("main-area").innerHTML =
      '<div class="card"><div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><h3>Không tìm thấy bài tập</h3><p>Bài tập không tồn tại hoặc không thuộc khóa học bạn phụ trách.</p>' +
      '<a class="btn btn-primary" href="ql-bai-hoc.html">Về danh sách bài học</a></div></div>';
    return;
  }
  const lesson = LearningStore.getLesson(assignment.lessonId);
  Ins.remember("ql-bai-tap.html?lesson=" + assignment.lessonId);

  $("btn-back").href = "ql-bai-tap.html?lesson=" + assignment.lessonId;
  $("crumb").innerHTML =
    '<a href="ql-bai-hoc.html?course=' +
    course.id +
    '">' +
    UI.esc(course.name) +
    '</a><i class="fa-solid fa-chevron-right"></i>' +
    '<a href="ql-bai-tap.html?lesson=' +
    assignment.lessonId +
    '">' +
    UI.esc(lesson ? "Bài " + lesson.order + ": " + lesson.name : "Bài học") +
    '</a><i class="fa-solid fa-chevron-right"></i><span>' +
    UI.esc(assignment.name) +
    "</span>";
  $("as-text").textContent = assignment.name;

  // Các đợt của tôi đang hiển thị bài học này: chỉ học viên của các đợt đó nộp / được chấm bài
  const shownBatches = Ins.batches(course.id).filter((b) => (lessonOfAssignment.batchIds || []).includes(b.id));
  const fromUrlBatch = Ins.param("batch");
  const state = { keyword: "", filter: "all", page: 1, gradingId: null, batchId: shownBatches.some((b) => b.id === fromUrlBatch) ? fromUrlBatch : "" };

  $("filter-batch").innerHTML =
    '<option value="">Tất cả đợt (' + shownBatches.length + ")</option>" + Ins.batchOptions(shownBatches, state.batchId);
  $("filter-batch").disabled = shownBatches.length === 0;

  // Số học viên cần nộp bài: học viên của đợt đang chọn (hoặc tất cả đợt đang hiển thị bài học)
  function totalStudentsNow() {
    const ids = state.batchId ? [state.batchId] : shownBatches.map((b) => b.id);
    return ids.reduce((t, id) => t + LearningStore.batchStudentCount(id), 0);
  }

  // Ghép bài nộp + học viên + kết quả thành các dòng để hiển thị
  function buildRows() {
    const results = LearningStore.resultMap();
    return LearningStore.getSubmissionsOfAssignment(assignment.id, Ins.user, state.batchId).map((s) => {
      const st = Store.getStudent(s.studentId);
      return {
        sub: s,
        result: results[s.id] || null,
        name: st ? st.name : s.studentId,
        email: st ? st.email : "",
      };
    });
  }

  /* ---------- Khối thông tin + thẻ thống kê ---------- */
  function renderTop(rows) {
    const graded = rows.filter((r) => r.result);
    const avg = graded.length
      ? Math.round(
          (graded.reduce((t, r) => t + r.result.score, 0) / graded.length) *
            100,
        ) / 100
      : null;

    $("stat-grid").innerHTML = [
      {
        icon: "fa-inbox",
        color: "ic-blue",
        label: "Đã nộp bài",
        value: rows.length,
        sub: "trên " + totalStudentsNow() + " học viên " + (state.batchId ? "của đợt" : "các đợt đang hiển thị"),
      },
      {
        icon: "fa-hourglass-half",
        color: "ic-amber",
        label: "Chờ chấm",
        value: rows.length - graded.length,
        sub: "cần chấm",
      },
      {
        icon: "fa-circle-check",
        color: "ic-green",
        label: "Đã chấm",
        value: graded.length,
        sub: "bài đã có điểm",
      },
      {
        icon: "fa-star",
        color: "ic-violet",
        label: "Điểm trung bình",
        value: avg === null ? "—" : avg,
        sub: "thang điểm " + assignment.maxScore,
      },
    ]
      .map(
        (c) =>
          '<div class="stat-card"><div class="stat-icon ' +
          c.color +
          '"><i class="fa-solid ' +
          c.icon +
          '"></i></div><div><div class="stat-label">' +
          c.label +
          '</div><div class="stat-value">' +
          c.value +
          '</div><div class="stat-sub">' +
          c.sub +
          "</div></div></div>",
      )
      .join("");

    $("info-strip").innerHTML =
      '<div><div class="lb">Hiển thị ở đợt</div><div class="vl">' +
      (shownBatches.length ? UI.esc(shownBatches.map((b) => b.name).join(", ")) : "Chưa chọn đợt nào") +
      "</div></div>" +
      '<div><div class="lb">Hạn nộp</div><div class="vl ' +
      (LearningStore.isOverdue(assignment) ? "overdue-text" : "") +
      '">' +
      formatLocalDateTime(assignment.deadline) +
      "</div></div>" +
      '<div><div class="lb">Điểm tối đa</div><div class="vl">' +
      assignment.maxScore +
      "</div></div>" +
      '<div><div class="lb">Đề bài</div><div class="vl" style="font-weight: 500; font-size: 13.5px">' +
      UI.esc(assignment.description) +
      "</div></div>";
  }

  /* ---------- Danh sách bài nộp ---------- */
  function render() {
    const rows = buildRows();
    renderTop(rows);

    const counts = {
      all: rows.length,
      pending: rows.filter((r) => !r.result).length,
      graded: rows.filter((r) => r.result).length,
    };
    $("status-tabs").innerHTML = [
      ["all", "Tất cả"],
      ["pending", "Chờ chấm"],
      ["graded", "Đã chấm"],
    ]
      .map(
        (t) =>
          '<button class="tab ' +
          (state.filter === t[0] ? "active" : "") +
          '" data-tab="' +
          t[0] +
          '">' +
          t[1] +
          '<span class="count">' +
          counts[t[0]] +
          "</span></button>",
      )
      .join("");

    const kw = UI.normalize(state.keyword);
    const list = rows.filter((r) => {
      if (state.filter === "pending" && r.result) return false;
      if (state.filter === "graded" && !r.result) return false;
      return (
        !kw ||
        UI.normalize(r.name + " " + r.email + " " + r.sub.studentId).indexOf(
          kw,
        ) >= 0
      );
    });

    if (rows.length === 0) {
      $("list-area").innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-inbox"></i><h3>Chưa có học viên nộp bài</h3><p>Bài nộp sẽ xuất hiện ở đây khi học viên gửi đường dẫn bài làm.</p></div>';
      $("pager").innerHTML = "";
      return;
    }
    if (list.length === 0) {
      $("list-area").innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><h3>Không tìm thấy bài nộp</h3><p>Hãy thử từ khóa hoặc bộ lọc khác.</p></div>';
      $("pager").innerHTML = "";
      return;
    }

    const pages = Math.ceil(list.length / PAGE_SIZE);
    if (state.page > pages) state.page = pages;
    const part = list.slice(
      (state.page - 1) * PAGE_SIZE,
      state.page * PAGE_SIZE,
    );

    $("list-area").innerHTML =
      '<div class="table-wrap"><table class="data-table" style="min-width: 860px"><thead><tr><th>Học viên</th><th>Bài làm</th><th>Thời gian nộp</th><th>Trạng thái chấm</th><th class="num">Điểm</th><th class="actions"></th></tr></thead><tbody>' +
      part
        .map((r) => {
          return (
            '<tr><td><div class="user-cell">' +
            Ins.avatar(r.name) +
            '<div><div class="cell-title">' +
            UI.esc(r.name) +
            '</div><div class="cell-sub">' +
            UI.esc(r.sub.studentId) +
            (r.email ? " · " + UI.esc(r.email) : "") +
            "</div></div></div></td>" +
            "<td>" +
            Ins.linkHtml(r.sub.link) +
            "</td>" +
            "<td>" +
            UI.dateTime(r.sub.submittedAt) +
            "</td>" +
            "<td>" +
            Ins.gradeBadge(!!r.result) +
            "</td>" +
            '<td class="num">' +
            (r.result
              ? Ins.scoreText(r.result.score, assignment.maxScore)
              : '<span class="text-muted">—</span>') +
            "</td>" +
            '<td class="actions"><button class="btn ' +
            (r.result ? "btn-outline" : "btn-primary") +
            ' btn-sm" data-grade="' +
            r.sub.id +
            '"><i class="fa-solid ' +
            (r.result ? "fa-pen" : "fa-check") +
            '"></i> ' +
            (r.result ? "Chấm lại" : "Chấm điểm") +
            "</button></td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>";

    UI.pager($("pager"), list.length, state.page, PAGE_SIZE, (p) => {
      state.page = p;
      render();
    });
  }

  /* ---------- Modal chấm điểm ---------- */
  function openGrade(subId) {
    const sub = LearningStore.getSubmission(subId);
    if (!sub) return;
    const st = Store.getStudent(sub.studentId);
    const result = LearningStore.getResult(subId);
    state.gradingId = subId;
    UI.clearErrors(["score", "comment"]);

    $("grade-title").textContent = result ? "Chấm lại bài" : "Chấm bài";
    $("g-student").innerHTML =
      Ins.avatar(st ? st.name : sub.studentId, "lg") +
      '<div><div class="cell-title" style="font-size: 16px">' +
      UI.esc(st ? st.name : sub.studentId) +
      '</div><div class="cell-sub">' +
      UI.esc(sub.studentId) +
      (st ? " · " + UI.esc(st.email) : "") +
      "</div></div>";
    $("g-assignment").textContent =
      assignment.name + "\n" + assignment.description;
    $("g-link").innerHTML =
      Ins.linkHtml(sub.link) +
      '<div class="hint">Nộp lúc ' +
      UI.dateTime(sub.submittedAt) +
      ". Link mở ở tab mới.</div>";
    $("g-range").textContent = "0 - " + assignment.maxScore;
    $("f-score").max = assignment.maxScore;
    $("f-score").value = result ? result.score : "";
    $("f-comment").value = result ? result.comment : "";
    $("g-graded-at").textContent = result
      ? "Đã chấm lúc " +
        UI.dateTime(result.gradedAt) +
        (result.gradedByName ? " bởi " + result.gradedByName : "") +
        "."
      : "";
    UI.openModal("grade-modal");
    $("f-score").focus();
  }

  function saveGrade() {
    const res = LearningStore.saveResult(Ins.user, state.gradingId, {
      score: $("f-score").value,
      comment: $("f-comment").value,
    });
    if (!res.ok) {
      if (res.errors) UI.showErrors(res.errors, ["score", "comment"]);
      else UI.toast(res.error, "error");
      return;
    }
    UI.closeModal("grade-modal");
    UI.toast("Đã lưu kết quả chấm.");
    render();
  }

  /* ---------- Sự kiện ---------- */
  $("search").addEventListener(
    "input",
    UI.debounce((e) => {
      state.keyword = e.target.value;
      state.page = 1;
      render();
    }, 200),
  );
  $("status-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (!tab) return;
    state.filter = tab.dataset.tab;
    state.page = 1;
    render();
  });
  $("list-area").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-grade]");
    if (btn) openGrade(btn.dataset.grade);
  });
  $("btn-save").addEventListener("click", saveGrade);
  $("filter-batch").addEventListener("change", (e) => {
    state.batchId = e.target.value;
    state.page = 1;
    Ins.setParam("batch", state.batchId);
    render();
  });

  render();
}

initSubmissionPage();
