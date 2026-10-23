/* =========================================================
   khoa-hoc-cua-toi.js - Trang "Khóa học của tôi" (học viên)
   Danh sách khóa học SUY RA từ đơn hàng đã thanh toán thành công.
   Khóa học đang trong giỏ / đơn đã hủy không xuất hiện.
   Tìm kiếm, lọc theo trạng thái học tập, sắp xếp, tiếp tục học, xem toàn bộ chương và bài học.
   ========================================================= */
function initMyCoursesPage() {
  const user = SUI.requireStudent();
  if (!user) return;
  SUI.notifyNav("khoa-hoc-cua-toi.html");
  const $ = (id) => document.getElementById(id);
  const sid = user.studentId;
  const state = { search: "", status: "", sort: "bought-desc" };

  const owned = StudentStore.ownedCourses(sid);
  if (owned.length === 0) {
    $("main-card").style.display = "none";
    $("no-course").innerHTML = SUI.noCourseHtml();
    return;
  }

  const doneSet = StudentStore.doneSet(sid);
  const list = owned.map((c) => ({
    ...c,
    prog: StudentStore.courseProgress(sid, c.courseId, doneSet),
    next: StudentStore.continueLesson(sid, c.courseId),
  }));

  function getFiltered() {
    let items = list;
    const kw = UI.normalize(state.search);
    if (kw) items = items.filter((c) => UI.normalize(c.name).includes(kw));
    if (state.status) items = items.filter((c) => c.prog.status === state.status);
    const by = {
      "bought-desc": (a, b) => new Date(b.boughtAt) - new Date(a.boughtAt),
      "bought-asc": (a, b) => new Date(a.boughtAt) - new Date(b.boughtAt),
      "progress-desc": (a, b) => b.prog.percent - a.prog.percent,
      "progress-asc": (a, b) => a.prog.percent - b.prog.percent,
    }[state.sort];
    return items.slice().sort(by);
  }

  function render() {
    const items = getFiltered();
    if (items.length === 0) {
      $("list-area").innerHTML = '<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><h3>Không tìm thấy khóa học</h3><p>Hãy thử đổi từ khóa hoặc bộ lọc.</p></div>';
      return;
    }
    $("list-area").innerHTML =
      '<div class="sc-grid">' +
      items
        .map((c) => {
          const p = c.prog;
          return (
            '<div class="sc-card"><div class="sc-img"><img src="' + UI.esc(UI.img(c.image)) + '" alt="">' + SUI.statusBadge(p) + "</div>" +
            '<div class="sc-body"><div class="sc-title">' + UI.esc(c.name) + "</div>" +
            '<div class="sc-meta"><div><i class="fa-solid fa-chalkboard-user"></i> ' + UI.esc(c.instructor) + '</div>' + (c.batch ? '<div><i class="fa-regular fa-calendar"></i> ' + UI.esc(c.batch.name) + " · " + c.batch.range + "</div>" : "") + '<div><i class="fa-regular fa-calendar"></i> Ngày mua: ' + UI.date(c.boughtAt) + "</div></div>" +
            '<div class="sc-prog"><div class="top"><span>Tiến độ: <b>' + p.percent + "%</b></span><span>" + p.done + "/" + p.total + " bài học</span></div>" + SUI.progressBar(p) + "</div></div>" +
            '<div class="sc-foot">' +
            (c.next ? '<a class="btn btn-primary btn-sm" href="' + StudentStore.learnUrl(c.courseId, c.next.id) + '"><i class="fa-solid fa-play"></i> ' + (p.status === "done" ? "Học lại" : "Tiếp tục học") + "</a>" : '<span class="btn btn-outline btn-sm" style="opacity:.6;cursor:default">Chưa có bài học</span>') +
            '<button class="btn btn-outline btn-sm" data-detail="' + c.courseId + '"><i class="fa-regular fa-eye"></i> Chi tiết</button></div></div>'
          );
        })
        .join("") +
      "</div>";
  }

  /* ---------- Chi tiết khóa học + toàn bộ chương / bài học ---------- */
  function openDetail(courseId) {
    const c = list.find((x) => x.courseId === courseId);
    if (!c) return;
    const set = StudentStore.doneSet(sid);
    const p = StudentStore.courseProgress(sid, courseId, set);
    const chapters = StudentStore.chaptersOf(courseId);
    $("course-title").textContent = c.name;
    $("course-body").innerHTML =
      '<div class="info-grid"><div class="info-box"><h4>Thông tin khóa học</h4>' +
      '<div class="info-line"><span>Giảng viên</span><span>' + UI.esc(c.instructor) + "</span></div>" +
      '<div class="info-line"><span>Ngày mua</span><span>' + UI.date(c.boughtAt) + "</span></div>" +
      '<div class="info-line"><span>Mã đơn hàng</span><span>' + UI.esc(c.orderId) + "</span></div></div>" +
      '<div class="info-box"><h4>Tiến độ học</h4><div class="info-line"><span>Hoàn thành</span><span>' + p.done + " / " + p.total + " bài (" + p.percent + "%)</span></div>" +
      '<div style="margin: 8px 0">' + SUI.progressBar(p) + '</div><div class="info-line"><span>Trạng thái</span><span>' + (p.total === 0 ? "Sắp có nội dung" : p.status === "done" ? "Hoàn thành" : "Đang học") + "</span></div></div></div>" +
      (c.description ? '<h4 class="section-title" style="margin-top:0">Giới thiệu</h4><p class="pre-text">' + UI.esc(c.description) + "</p>" : "") +
      '<h4 class="section-title">Chương và bài học (' + p.total + " bài)</h4>" +
      (chapters.length
        ? chapters
            .map(
              (g) =>
                '<div class="chap-list" style="margin-bottom:12px"><div class="cl-title"><span>' + UI.esc(g.title) + "</span><span>" + g.lessons.filter((l) => set.has(l.id)).length + "/" + g.lessons.length + "</span></div>" +
                g.lessons
                  .map(
                    (l) =>
                      '<a class="cl-lesson ' + (set.has(l.id) ? "done" : "") + '" href="' + StudentStore.learnUrl(courseId, l.id) + '"><span class="cl-ic">' + (set.has(l.id) ? '<i class="fa-solid fa-check"></i>' : "") + "</span><span>Bài " + l.order + ": " + UI.esc(l.title) + "</span></a>"
                  )
                  .join("") +
                "</div>"
            )
            .join("")
        : '<div class="text-muted">Giảng viên chưa đăng bài học nào cho khóa học này.</div>');
    $("course-footer").innerHTML =
      '<button class="btn btn-outline" data-close>Đóng</button>' +
      (c.next ? '<a class="btn btn-primary" href="' + StudentStore.learnUrl(courseId, c.next.id) + '"><i class="fa-solid fa-play"></i> ' + (p.status === "done" ? "Học lại" : "Tiếp tục học") + "</a>" : "");
    $("course-footer").querySelector("[data-close]").addEventListener("click", () => UI.closeModal("course-modal"));
    UI.openModal("course-modal");
  }

  $("search").addEventListener("input", UI.debounce((e) => { state.search = e.target.value; render(); }, 200));
  $("filter-status").addEventListener("change", (e) => { state.status = e.target.value; render(); });
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("list-area").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-detail]");
    if (btn) openDetail(btn.dataset.detail);
  });

  render();
}

initMyCoursesPage();
