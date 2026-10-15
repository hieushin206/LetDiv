/* =========================================================
   bai-tap-cua-toi.js - Trang "Bài tập của tôi" (học viên)
   Bài tập do giảng viên giao ở các bài học thuộc khóa học đã mua.
   Học viên dán đường dẫn bài làm (GitHub / CodePen) rồi bấm "Nộp bài".
   Trạng thái: Chưa nộp / Chờ chấm / Đã chấm. Không có đóng nộp bài / nộp muộn: nộp và nộp lại được đến khi giảng viên chấm.
   Dữ liệu bài nộp dùng chung với trang giảng viên => giảng viên thấy ngay.
   Mở thẳng một bài: bai-tap-cua-toi.html?assignment=BT001
   ========================================================= */
function initMyAssignmentsPage() {
  const user = SUI.requireStudent();
  if (!user) return;
  SUI.notifyNav("bai-tap-cua-toi.html");
  const $ = (id) => document.getElementById(id);
  const sid = user.studentId;
  const state = { tab: "all", search: "", course: SUI.query("course"), page: 1 };
  const PAGE_SIZE = 8;
  let openId = "";

  const owned = StudentStore.ownedCourses(sid);
  if (owned.length === 0) {
    $("main-card").style.display = "none";
    $("no-course").innerHTML = SUI.noCourseHtml();
    return;
  }
  $("filter-course").innerHTML =
    '<option value="">Tất cả khóa học</option>' + owned.map((c) => '<option value="' + c.courseId + '"' + (c.courseId === state.course ? " selected" : "") + ">" + UI.esc(c.name) + "</option>").join("");

  const allRows = () => StudentStore.assignmentsOf(sid);

  // Bộ lọc: tất cả / chưa nộp / chờ chấm / đã chấm / quá hạn hoặc nộp muộn
  const TABS = [
    { key: "all", label: "Tất cả", test: () => true },
    { key: "none", label: "Chưa nộp", test: (r) => !r.submitted },
    { key: "pending", label: "Chờ chấm", test: (r) => r.key === "pending" },
    { key: "graded", label: "Đã chấm", test: (r) => r.key === "graded" },
    { key: "late", label: "Quá hạn chưa nộp", test: (r) => StudentStore.needsAttention(r) },
  ];

  function getFiltered(rows) {
    let list = rows;
    if (state.course) list = list.filter((r) => r.course.courseId === state.course);
    const kw = UI.normalize(state.search);
    if (kw) list = list.filter((r) => UI.normalize(r.a.title + " " + r.lesson.title).includes(kw));
    return list;
  }

  function render() {
    const rows = getFiltered(allRows());
    $("tabs").innerHTML = TABS.map((t) => '<button class="tab ' + (state.tab === t.key ? "active" : "") + '" data-tab="' + t.key + '">' + t.label + '<span class="count">' + rows.filter(t.test).length + "</span></button>").join("");

    const tab = TABS.find((t) => t.key === state.tab);
    const list = rows
      .filter(tab.test)
      .sort((x, y) => (x.submitted - y.submitted) || new Date(x.a.dueDate) - new Date(y.a.dueDate)); // bài chưa nộp lên trước
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const items = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    if (list.length === 0) {
      $("list-area").innerHTML = '<div class="empty-state"><i class="fa-solid fa-list-check"></i><h3>Không có bài tập phù hợp</h3><p>' + (allRows().length ? "Hãy đổi bộ lọc hoặc từ khóa." : "Giảng viên chưa giao bài tập nào trong các khóa học của bạn.") + "</p></div>";
    } else {
      $("list-area").innerHTML =
        '<div class="table-wrap"><table class="data-table" style="min-width: 1100px"><thead><tr><th>Bài tập</th><th>Khóa học</th><th>Giảng viên</th><th>Hạn nộp</th><th>Thời gian nộp</th><th>Trạng thái</th><th class="num">Điểm</th><th class="num">Thao tác</th></tr></thead><tbody>' +
        items
          .map(
            (r) =>
              '<tr><td><div class="cell-title">' + UI.esc(r.a.title) + '</div><div class="cell-sub">Bài ' + r.lesson.order + ": " + UI.esc(r.lesson.title) + "</div></td>" +
              '<td style="max-width:200px">' + UI.esc(r.course.name) + "</td><td>" + UI.esc(r.instructor) + "</td>" +
              "<td>" + SUI.dueText(r.a.dueDate) + '<div style="margin-top:3px">' + SUI.dueBadge(r) + "</div></td>" +
              "<td>" + (r.sub ? UI.dateTime(r.sub.submittedAt) : '<span class="text-muted">—</span>') + "</td>" +
              "<td>" + SUI.assignBadge(r) + "</td>" +
              '<td class="num">' + SUI.scoreText(r) + "</td>" +
              '<td class="actions"><button class="btn ' + (r.canSubmit ? "btn-primary" : "btn-outline") + ' btn-sm" data-open="' + r.a.id + '">' + (!r.submitted ? "Nộp bài" : r.graded ? "Xem" : "Mở") + "</button></td></tr>"
          )
          .join("") +
        "</tbody></table></div>";
    }
    UI.pager($("pager"), list.length, state.page, PAGE_SIZE, (p) => {
      state.page = p;
      render();
    });
  }

  /* ---------- Chi tiết bài tập + form nộp ---------- */
  function openAssign(id) {
    const r = StudentStore.getAssignmentRow(sid, id);
    if (!r) return UI.toast("Không tìm thấy bài tập (hoặc bạn chưa sở hữu khóa học).", "error");
    openId = id;
    const url = r.sub ? SUI.safeUrl(r.sub.link) : "";
    $("assign-title").innerHTML = UI.esc(r.a.title) + " " + SUI.assignBadge(r);

    let status = "";
    if (r.submitted) {
      status =
        '<h4 class="section-title">Bài đã nộp</h4><div class="info-box">' +
        '<div class="info-line"><span>Đường dẫn</span><span>' + (url ? '<a class="link-chip" href="' + UI.esc(url) + '" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>' + UI.esc(SUI.shortUrl(url)) + "</span></a>" : "Không hợp lệ") + "</span></div>" +
        '<div class="info-line"><span>Thời gian nộp</span><span>' + UI.dateTime(r.sub.submittedAt) + "</span></div>" +
        ((r.sub.history || []).length ? '<div class="info-line"><span>Số lần nộp lại</span><span>' + r.sub.history.length + "</span></div>" : "") + "</div>" +
        (r.graded
          ? '<h4 class="section-title">Kết quả</h4><div class="info-box"><div class="info-line"><span>Điểm</span><span>' + SUI.scoreText(r) + '</span></div><div class="info-line"><span>Ngày chấm</span><span>' + UI.dateTime(r.sub.gradedAt) + "</span></div></div>" +
            '<div class="feedback-box" style="margin-top:12px"><b>Nhận xét của giảng viên:</b><br>' + (UI.esc(r.sub.feedback) || "(Không có nhận xét)") + "</div>"
          : "");
    }

    let form = "";
    if (r.canSubmit) {
      form =
        '<div class="submit-box"><label class="label">' + (r.submitted ? "Nộp lại bài (thay thế bản đã nộp)" : "Đường dẫn bài làm") + ' <span class="req">*</span></label>' +
        '<div class="row-inline"><input type="text" id="sub-link" placeholder="https://github.com/ten-ban/ten-bai-tap" value="' + (r.submitted ? UI.esc(r.sub.link) : "") + '"><button class="btn btn-primary" id="btn-submit"><i class="fa-solid fa-paper-plane"></i> ' + (r.submitted ? "Nộp lại" : "Nộp bài") + "</button></div>" +
        '<div class="error-text" id="sub-error"></div>' +
        '<div class="hint">Chỉ nhận đường dẫn bắt đầu bằng http:// hoặc https://. Không cần tải tệp lên.</div></div>';
    } else if (r.graded) {
      form = '<div class="note" style="margin-top:16px"><i class="fa-solid fa-lock"></i><span>Bài đã được chấm điểm nên không thể nộp lại.</span></div>';
    }

    $("assign-body").innerHTML =
      '<div class="info-grid"><div class="info-box"><h4>Thông tin</h4>' +
      '<div class="info-line"><span>Khóa học</span><span>' + UI.esc(r.course.name) + "</span></div>" +
      '<div class="info-line"><span>Bài học</span><span><a href="' + StudentStore.learnUrl(r.course.courseId, r.lesson.id) + '" style="color:var(--color-one)">Bài ' + r.lesson.order + ": " + UI.esc(r.lesson.title) + "</a></span></div>" +
      '<div class="info-line"><span>Giảng viên</span><span>' + UI.esc(r.instructor) + "</span></div></div>" +
      '<div class="info-box"><h4>Hạn nộp & điểm</h4><div class="info-line"><span>Hạn nộp</span><span>' + SUI.dueText(r.a.dueDate) + "</span></div>" +
      '<div class="info-line"><span>Điểm tối đa</span><span>' + r.a.maxScore + "</span></div>" +
      "</div></div>" +
      '<h4 class="section-title" style="margin-top:0">Đề bài</h4><div class="info-box pre-text">' + UI.esc(r.a.prompt) + "</div>" +
      (r.a.guide ? '<h4 class="section-title">Hướng dẫn của giảng viên</h4><div class="info-box pre-text">' + UI.esc(r.a.guide) + "</div>" : "") +
      status + form;

    UI.openModal("assign-modal");
    if (r.canSubmit) {
      const input = $("sub-link");
      input.addEventListener("keydown", (e) => e.key === "Enter" && $("btn-submit").click());
      $("btn-submit").addEventListener("click", () => submit(id));
    }
  }

  function submit(id) {
    const link = $("sub-link").value;
    const res = StudentStore.submit(sid, id, link);
    if (!res.ok) {
      $("sub-error").textContent = res.error;
      return;
    }
    UI.toast("Nộp bài thành công!", "success");
    openAssign(id); // vẽ lại với trạng thái mới
    render();
  }

  /* ---------- Sự kiện ---------- */
  $("tabs").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (!t) return;
    state.tab = t.dataset.tab;
    state.page = 1;
    render();
  });
  $("search").addEventListener("input", UI.debounce((e) => { state.search = e.target.value; state.page = 1; render(); }, 200));
  $("filter-course").addEventListener("change", (e) => { state.course = e.target.value; state.page = 1; render(); });
  $("list-area").addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) openAssign(b.dataset.open);
  });

  render();
  const wanted = SUI.query("assignment");
  if (wanted) openAssign(wanted);
}

initMyAssignmentsPage();
