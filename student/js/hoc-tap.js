/* =========================================================
   hoc-tap.js - Trang "Học tập" (học viên)
   Giao diện học trực tuyến: danh sách chương / bài học bên trái, nội dung bên phải.
   - Chỉ học viên SỞ HỮU khóa học (đơn hoàn thành) mới mở được nội dung.
   - Đánh dấu hoàn thành lưu theo từng học viên (không dùng chung tiến độ).
   - Mở thẳng một bài: hoc-tap.html?course=KH014&lesson=BH100
   ========================================================= */
function initLearnPage() {
  const user = SUI.requireStudent();
  if (!user) return;
  SUI.notifyNav("hoc-tap.html");
  const $ = (id) => document.getElementById(id);
  const sid = user.studentId;
  const state = { courseId: "", lessonId: "" };
  const collapsed = {}; // chương đang thu gọn

  const owned = StudentStore.ownedCourses(sid);
  if (owned.length === 0) {
    $("learn-area").style.display = "none";
    $("no-course").innerHTML = SUI.noCourseHtml();
    return;
  }

  // Khóa học muốn học: ?course=... (phải sở hữu), không có thì lấy khóa học gần nhất
  const wanted = SUI.query("course");
  if (wanted && !owned.some((c) => c.courseId === wanted)) {
    $("learn-area").style.display = "none";
    $("no-course").innerHTML =
      '<div class="card" style="margin:20px"><div class="empty-state"><i class="fa-solid fa-lock"></i><h3>Bạn chưa sở hữu khóa học này</h3>' +
      "<p>Chỉ học viên đã mua khóa học (đơn hàng hoàn thành) mới được xem nội dung học tập.</p>" +
      '<a class="btn btn-primary" style="margin-top:12px" href="khoa-hoc-cua-toi.html">Về khóa học của tôi</a></div></div>';
    return;
  }
  state.courseId = wanted || StudentStore.recentCourses(sid, 1)[0].courseId;
  state.lessonId = SUI.query("lesson");

  $("course-select").innerHTML = owned.map((c) => '<option value="' + c.courseId + '"' + (c.courseId === state.courseId ? " selected" : "") + ">" + UI.esc(c.name) + "</option>").join("");

  const lessonsOf = () => StudentStore.visibleLessons(state.courseId);

  // Bài học đang chọn: hợp lệ thì giữ, không thì lấy bài "tiếp tục học"
  function pickLesson() {
    const lessons = lessonsOf();
    if (!lessons.some((l) => l.id === state.lessonId)) {
      const next = StudentStore.continueLesson(sid, state.courseId);
      state.lessonId = next ? next.id : "";
    }
  }

  /* ---------- Cột bên trái: tiến độ + chương + bài học ---------- */
  function renderSide() {
    const c = owned.find((x) => x.courseId === state.courseId);
    const set = StudentStore.doneSet(sid);
    const p = StudentStore.courseProgress(sid, state.courseId, set);
    $("ls-head").innerHTML =
      '<div class="cell-title">' + UI.esc(c.name) + '</div><div class="cell-sub">GV: ' + UI.esc(c.instructor) + "</div>" + (c.batch ? '<div class="cell-sub">' + UI.esc(c.batch.name) + " · " + c.batch.range + "</div>" : "") + SUI.progressBar(p) +
      '<div class="cell-sub">' + p.done + "/" + p.total + " bài học · <b>" + p.percent + "%</b> " + (p.status === "done" && p.total ? "· Hoàn thành 🎉" : "") + "</div>";

    const chapters = StudentStore.chaptersOf(state.courseId);
    if (chapters.length === 0) {
      $("ls-body").innerHTML = '<div class="empty-state" style="padding:30px 16px"><i class="fa-regular fa-file-lines"></i><h3>Chưa có bài học</h3></div>';
      return;
    }
    $("ls-body").innerHTML = chapters
      .map((g, gi) => {
        const doneCount = g.lessons.filter((l) => set.has(l.id)).length;
        return (
          '<div class="chap ' + (collapsed[gi] ? "collapsed" : "") + '"><div class="chap-title" data-chap="' + gi + '"><div>' + UI.esc(g.title) + "</div><span>" + doneCount + "/" + g.lessons.length + " <i class=\"fa-solid fa-chevron-down\"></i></span></div>" +
          g.lessons
            .map(
              (l) =>
                '<div class="lesson-item ' + (set.has(l.id) ? "done" : "") + (l.id === state.lessonId ? " active" : "") + '" data-lesson="' + l.id + '"><span class="li-check">' + (set.has(l.id) ? '<i class="fa-solid fa-check"></i>' : "") + "</span>" +
                '<div><div class="li-title">Bài ' + l.order + ": " + UI.esc(l.title) + '</div><div class="li-sub">' + (l.videoUrl ? "Có video" : "Bài đọc") + (StudentStore.assignmentsOfLesson(l.id).length ? " · có bài tập" : "") + "</div></div></div>"
            )
            .join("") +
          "</div>"
        );
      })
      .join("");
  }

  /* ---------- Nội dung bài học ---------- */
  function renderMain() {
    const lessons = lessonsOf();
    const lesson = lessons.find((l) => l.id === state.lessonId);
    if (!lesson) {
      $("lesson-main").innerHTML = '<div class="empty-state"><i class="fa-regular fa-file-lines"></i><h3>Giảng viên chưa đăng bài học</h3><p>Hãy quay lại sau khi khóa học có nội dung.</p></div>';
      return;
    }
    StudentStore.recordVisit(sid, state.courseId, lesson.id); // nhớ vị trí học gần nhất
    const idx = lessons.findIndex((l) => l.id === lesson.id);
    const prev = lessons[idx - 1];
    const next = lessons[idx + 1];
    const done = StudentStore.isDone(sid, lesson.id);
    const video = SUI.safeUrl(lesson.videoUrl);
    const embed = video ? SUI.videoEmbed(video) : "";
    const image = SUI.safeUrl(lesson.imageUrl);
    const assigns = StudentStore.assignmentsOfLesson(lesson.id);
    const subs = StudentStore.mySubmissions(sid);

    $("lesson-main").innerHTML =
      (lesson.chapter ? '<div class="lm-chapter">' + UI.esc(lesson.chapter) + "</div>" : "") +
      "<h1>Bài " + lesson.order + ": " + UI.esc(lesson.title) + "</h1>" +
      '<div class="lm-meta"><span><i class="fa-solid fa-hashtag"></i> Mã bài học: <b>' + lesson.id + "</b></span><span><i class=\"fa-solid fa-book\"></i> Mã khóa học: <b>" + lesson.courseId + "</b></span>" +
      "<span>" + (done ? '<span class="badge badge-success">Đã hoàn thành</span>' : '<span class="badge badge-muted">Chưa hoàn thành</span>') + "</span></div>" +
      (lesson.description ? '<p style="margin-bottom:16px;color:#495057">' + UI.esc(lesson.description) + "</p>" : "") +
      (image ? '<img class="lm-image" src="' + UI.esc(image) + '" alt="Ảnh minh họa">' : "") +
      (embed
        ? '<div class="video-box"><iframe src="' + UI.esc(embed) + '" allowfullscreen loading="lazy" title="Video bài học"></iframe></div>'
        : video
          ? '<div class="video-link-card"><i class="fa-brands fa-youtube"></i><div style="flex:1"><div class="cell-title">Video bài học</div><div class="cell-sub">' + UI.esc(SUI.shortUrl(video)) + '</div></div><a class="btn btn-outline btn-sm" href="' + UI.esc(video) + '" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Mở video</a></div>'
          : "") +
      '<div class="lesson-text pre-text">' + (UI.esc(lesson.content) || '<span class="text-muted">Giảng viên chưa đăng nội dung văn bản cho bài học này.</span>') + "</div>" +
      '<div class="lesson-actions">' +
      '<button class="btn btn-outline" data-go="' + (prev ? prev.id : "") + '"' + (prev ? "" : " disabled") + '><i class="fa-solid fa-chevron-left"></i> Bài trước</button>' +
      '<button class="btn ' + (done && next ? "btn-primary" : "btn-outline") + '" data-go="' + (next ? next.id : "") + '"' + (next ? "" : " disabled") + '>Bài tiếp theo <i class="fa-solid fa-chevron-right"></i></button>' +
      '<span class="spacer"></span>' +
      '<button class="btn btn-done ' + (done ? "is-done" : "") + '" id="btn-done">' + (done ? '<i class="fa-solid fa-circle-check"></i> Đã hoàn thành (bấm để bỏ đánh dấu)' : '<i class="fa-regular fa-circle-check"></i> Đánh dấu hoàn thành') + "</button></div>" +
      (assigns.length
        ? '<div class="lesson-assign"><h3><i class="fa-solid fa-list-check" style="color:var(--color-one)"></i> Bài tập của bài học (' + assigns.length + ")</h3>" +
          assigns
            .map((a) => {
              const row = StudentStore.buildRow(a, lesson, owned.find((c) => c.courseId === state.courseId), subs.find((s) => s.assignmentId === a.id));
              return (
                '<div class="la-item"><div class="la-info"><div class="cell-title">' + UI.esc(a.title) + '</div><div class="cell-sub">Hạn nộp: ' + SUI.dueText(a.dueDate) + "</div></div>" +
                SUI.assignBadge(row) + " " + SUI.dueBadge(row) + '<a class="btn btn-primary btn-sm" href="bai-tap-cua-toi.html?assignment=' + a.id + '">Mở bài tập</a></div>'
              );
            })
            .join("") + "</div>"
        : "");
  }

  function showLesson(id) {
    state.lessonId = id;
    SUI.setQuery({ course: state.courseId, lesson: state.lessonId });
    renderSide();
    renderMain();
    window.scrollTo(0, 0);
  }

  /* ---------- Sự kiện ---------- */
  $("course-select").addEventListener("change", (e) => {
    state.courseId = e.target.value;
    state.lessonId = "";
    pickLesson();
    showLesson(state.lessonId);
  });

  $("ls-body").addEventListener("click", (e) => {
    const chap = e.target.closest("[data-chap]");
    if (chap) {
      const gi = chap.dataset.chap;
      collapsed[gi] = !collapsed[gi];
      chap.parentElement.classList.toggle("collapsed", !!collapsed[gi]);
      return;
    }
    const item = e.target.closest("[data-lesson]");
    if (item) showLesson(item.dataset.lesson);
  });

  $("lesson-main").addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go && go.dataset.go) return showLesson(go.dataset.go);
    if (e.target.closest("#btn-done")) {
      const now = !StudentStore.isDone(sid, state.lessonId);
      const res = StudentStore.setLessonDone(sid, state.lessonId, now);
      if (!res.ok) return UI.toast(res.error, "error");
      const p = StudentStore.courseProgress(sid, state.courseId);
      UI.toast(now ? (p.status === "done" ? "Chúc mừng! Bạn đã hoàn thành khóa học 🎉" : "Đã đánh dấu hoàn thành bài học.") : "Đã bỏ đánh dấu hoàn thành.", now ? "success" : "info");
      renderSide();
      // Vẽ lại phần nút/huy hiệu nhưng không cuộn lại đầu trang
      const y = window.scrollY;
      renderMain();
      window.scrollTo(0, y);
    }
  });

  pickLesson();
  showLesson(state.lessonId);
}

initLearnPage();
