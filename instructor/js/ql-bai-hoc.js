/* =========================================================
   ql-bai-hoc.js - Quản lý bài học (Chức năng 1)
   MÔ HÌNH: bài học thuộc KHÓA HỌC (giảng viên tạo sẵn 1 lần).
   Muốn học viên của đợt nào thấy bài học thì chỉ cần CHỌN ĐỢT đó cho bài học
   (ô "Hiển thị ở đợt học" trong form, hoặc nút chọn nhanh ở từng dòng).
   - Học viên chỉ thấy bài học của đợt mình được phân vào.
   - Giảng viên chỉ thấy bài nộp của học viên thuộc các đợt mình phụ trách.
   Xem danh sách, thêm, sửa, xóa (có xác nhận), tìm theo tên, sắp xếp theo thứ tự,
   lọc theo đợt, ẩn/hiện, sang trang Bài tập.
   ========================================================= */
function initLessonPage() {
  if (!Ins.boot()) return;
  const $ = (id) => document.getElementById(id);
  const FIELDS = ["name", "description", "content", "videoUrl", "order"];
  const PAGE_SIZE = 8;

  const courses = Ins.courses();
  if (courses.length === 0) {
    document.querySelector(".card").innerHTML = Ins.noCourseHtml();
    $("btn-add").disabled = true;
    return;
  }

  // Khóa học đang chọn: lấy từ ?course=... (nếu thuộc quyền của giảng viên); đợt lọc: ?batch=...
  const fromUrl = Ins.param("course");
  const state = {
    courseId: courses.some((c) => c.id === fromUrl) ? fromUrl : courses[0].id,
    batchFilter: "", // "" = tất cả, "none" = chưa hiển thị ở đợt nào, hoặc mã đợt
    keyword: "",
    status: "all",
    sortDir: "asc",
    page: 1,
    editingId: null,
    quickId: null, // bài học đang chọn nhanh đợt
  };

  function currentCourse() {
    return courses.find((c) => c.id === state.courseId);
  }

  // Các đợt giảng viên được chọn cho khóa đang xem
  function myBatchesOfCourse() {
    return Ins.batches(state.courseId);
  }

  function fillBatchFilter(preferred) {
    const list = myBatchesOfCourse();
    const valid = preferred === "none" || list.some((b) => b.id === preferred);
    state.batchFilter = valid ? preferred : "";
    $("filter-batch").innerHTML =
      '<option value="">Tất cả đợt học</option>' +
      list.map((b) => '<option value="' + b.id + '"' + (b.id === state.batchFilter ? " selected" : "") + ">" + UI.esc(Ins.batchLabel(b)) + "</option>").join("") +
      '<option value="none"' + (state.batchFilter === "none" ? " selected" : "") + ">Chưa hiển thị ở đợt nào</option>";
  }

  $("course-select").innerHTML = Ins.courseOptions(courses, state.courseId);
  fillBatchFilter(Ins.param("batch"));

  /* ---------- Hộp chọn đợt (dùng cho form + chọn nhanh) ---------- */
  function renderBatchChecks(containerId, selectedIds) {
    const list = myBatchesOfCourse();
    const box = $(containerId);
    if (list.length === 0) {
      box.innerHTML = '<div class="batch-empty">Bạn chưa có đợt học nào ở khóa này. Admin cần tạo đợt học (trang Đợt học) và chọn bạn phụ trách. Bạn vẫn tạo bài học trước, chọn đợt sau.</div>';
      return;
    }
    const picked = new Set(selectedIds || []);
    box.innerHTML = list
      .map(
        (b) =>
          '<label class="batch-check"><input type="checkbox" value="' + b.id + '"' + (picked.has(b.id) ? " checked" : "") + "><span>" + UI.esc(b.name) +
          " " + Ins.batchStatusBadge(b) + "<small>" + Ins.day(b.startDate) + " - " + Ins.day(b.endDate) + " · " + LearningStore.batchStudentCount(b.id) + " học viên</small></span></label>",
      )
      .join("");
  }

  function checkedBatches(containerId) {
    return Array.from($(containerId).querySelectorAll("input[type=checkbox]:checked")).map((c) => c.value);
  }

  // Chip các đợt (của giảng viên) đang hiển thị bài học
  function batchChips(lesson) {
    const mine = myBatchesOfCourse();
    const names = mine.filter((b) => (lesson.batchIds || []).includes(b.id)).map((b) => b.name);
    if (names.length === 0) return '<span class="text-muted">Chưa chọn đợt</span>';
    return '<div class="batch-chips">' + names.map((n) => '<span class="batch-chip">' + UI.esc(n) + "</span>").join("") + "</div>";
  }

  /* ---------- Hiển thị danh sách ---------- */
  function render() {
    const lessons = LearningStore.getLessonsOfCourse(state.courseId);
    const assignments = lessons.length ? LearningStore.read("assignments").filter((a) => a.courseId === state.courseId) : [];
    const mineIds = new Set(myBatchesOfCourse().map((b) => b.id));

    // Tab lọc trạng thái
    const counts = { all: lessons.length, visible: lessons.filter((l) => l.status === "visible").length, hidden: lessons.filter((l) => l.status === "hidden").length };
    const tabs = [["all", "Tất cả"], ["visible", "Đang hiển thị"], ["hidden", "Đã ẩn"]];
    $("status-tabs").innerHTML = tabs
      .map((t) => '<button class="tab ' + (state.status === t[0] ? "active" : "") + '" data-tab="' + t[0] + '">' + t[1] + '<span class="count">' + counts[t[0]] + "</span></button>")
      .join("");

    // Lọc theo tên + trạng thái + đợt, sắp theo thứ tự
    const kw = UI.normalize(state.keyword);
    let list = lessons.filter((l) => {
      if (state.status !== "all" && l.status !== state.status) return false;
      if (kw && UI.normalize(l.name).indexOf(kw) < 0) return false;
      const ids = l.batchIds || [];
      if (state.batchFilter === "none") return !ids.some((id) => mineIds.has(id));
      if (state.batchFilter) return ids.includes(state.batchFilter);
      return true;
    });
    if (state.sortDir === "desc") list = list.slice().reverse();

    if (lessons.length === 0) {
      $("list-area").innerHTML = '<div class="empty-state"><i class="fa-solid fa-list-ol"></i><h3>Khóa học này chưa có bài học</h3><p>Bấm "Thêm bài học" để tạo bài đầu tiên, rồi chọn đợt học để hiển thị.</p></div>';
      $("pager").innerHTML = "";
      return;
    }
    if (list.length === 0) {
      $("list-area").innerHTML = '<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><h3>Không tìm thấy bài học</h3><p>Hãy thử từ khóa hoặc bộ lọc khác.</p></div>';
      $("pager").innerHTML = "";
      return;
    }

    const pages = Math.ceil(list.length / PAGE_SIZE);
    if (state.page > pages) state.page = pages;
    const rows = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    $("list-area").innerHTML =
      '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th><button class="th-sort" data-sort title="Đổi chiều sắp xếp">Thứ tự <i class="fa-solid ' + (state.sortDir === "asc" ? "fa-arrow-up-short-wide" : "fa-arrow-down-wide-short") + '"></i></button></th>' +
      '<th>Bài học</th><th>Video</th><th>Hiển thị ở đợt</th><th>Bài tập</th><th>Hiển thị</th><th class="actions"></th></tr></thead><tbody>' +
      rows
        .map((l) => {
          const count = assignments.filter((a) => a.lessonId === l.id).length;
          return (
            '<tr class="' + (l.status === "hidden" ? "row-off" : "") + '">' +
            '<td><span class="order-pill">Bài ' + l.order + "</span></td>" +
            '<td><div class="cell-title">' + UI.esc(l.name) + '</div><div class="cell-sub clamp-2 cell-wide">' + UI.esc(l.description || "Chưa có mô tả") + '</div><div class="cell-sub mono">' + UI.esc(l.id) + "</div></td>" +
            "<td>" + (l.videoUrl ? '<a class="icon-btn" href="' + UI.esc(l.videoUrl) + '" target="_blank" rel="noopener noreferrer" title="Mở video trong tab mới"><i class="fa-solid fa-circle-play"></i></a>' : '<span class="text-muted">—</span>') + "</td>" +
            "<td>" + batchChips(l) + '<div style="margin-top:6px"><button class="btn btn-outline btn-sm" data-batches="' + l.id + '"><i class="fa-regular fa-calendar-check"></i> Chọn đợt</button></div></td>' +
            '<td><a class="btn btn-outline btn-sm" href="ql-bai-tap.html?lesson=' + l.id + '"><i class="fa-solid fa-list-check"></i> Quản lý bài tập (' + count + ")</a></td>" +
            '<td><label class="switch" title="Ẩn / hiện bài học"><input type="checkbox" data-toggle="' + l.id + '"' + (l.status === "visible" ? " checked" : "") + '><span class="slider"></span></label></td>' +
            '<td class="actions"><button class="icon-btn" title="Sửa" data-edit="' + l.id + '"><i class="fa-regular fa-pen-to-square"></i></button>' +
            '<button class="icon-btn danger" title="Xóa" data-del="' + l.id + '"><i class="fa-regular fa-trash-can"></i></button></td></tr>'
          );
        })
        .join("") +
      "</tbody></table></div>";

    UI.pager($("pager"), list.length, state.page, PAGE_SIZE, (p) => {
      state.page = p;
      render();
    });
  }

  /* ---------- Modal thêm / sửa ---------- */
  function openForm(id) {
    UI.clearErrors(FIELDS);
    state.editingId = id || null;
    const lesson = id ? LearningStore.getLesson(id) : null;
    $("lesson-modal-title").textContent = lesson ? "Sửa bài học" : "Thêm bài học";
    $("f-id").value = lesson ? lesson.id : "(tự động tạo khi lưu)";
    $("f-course").value = currentCourse().name;
    $("f-name").value = lesson ? lesson.name : "";
    $("f-description").value = lesson ? lesson.description : "";
    $("f-content").value = lesson ? lesson.content : "";
    $("f-videoUrl").value = lesson ? lesson.videoUrl : "";
    $("f-order").value = lesson ? lesson.order : LearningStore.getLessonsOfCourse(state.courseId).length + 1;
    $("f-status").value = lesson ? lesson.status : "visible";
    renderBatchChecks("f-batches", lesson ? lesson.batchIds : []);
    UI.openModal("lesson-modal");
    $("f-name").focus();
  }

  function save() {
    const data = {
      name: $("f-name").value,
      description: $("f-description").value,
      content: $("f-content").value,
      videoUrl: $("f-videoUrl").value,
      order: Number($("f-order").value),
      status: $("f-status").value,
    };
    const errors = LearningStore.validateLesson(data);
    UI.showErrors(errors, FIELDS);
    if (Object.keys(errors).length > 0) return;

    const chosen = checkedBatches("f-batches");
    if (state.editingId) {
      const old = LearningStore.getLesson(state.editingId);
      // Chỉ đổi các đợt thuộc quyền mình, giữ nguyên đợt do giảng viên khác phụ trách
      data.batchIds = LearningStore.mergeBatchIds(Ins.user, state.courseId, old ? old.batchIds : [], chosen);
      LearningStore.updateLesson(state.editingId, data);
      UI.toast("Đã cập nhật bài học.");
    } else {
      data.batchIds = LearningStore.mergeBatchIds(Ins.user, state.courseId, [], chosen);
      LearningStore.addLesson(currentCourse(), data);
      UI.toast("Đã thêm bài học mới.");
    }
    UI.closeModal("lesson-modal");
    render();
  }

  /* ---------- Chọn nhanh đợt hiển thị ---------- */
  function openQuickBatches(id) {
    const lesson = LearningStore.getLesson(id);
    if (!lesson) return;
    state.quickId = id;
    $("batch-modal-title").textContent = "Hiển thị bài \"" + lesson.name + "\" ở đợt nào?";
    renderBatchChecks("q-batches", lesson.batchIds);
    $("btn-save-batches").disabled = myBatchesOfCourse().length === 0;
    UI.openModal("batch-modal");
  }

  function saveQuickBatches() {
    const lesson = LearningStore.getLesson(state.quickId);
    if (!lesson) return;
    const merged = LearningStore.mergeBatchIds(Ins.user, state.courseId, lesson.batchIds, checkedBatches("q-batches"));
    LearningStore.setLessonBatches(lesson.id, merged);
    UI.closeModal("batch-modal");
    UI.toast("Đã cập nhật đợt hiển thị của bài học.");
    render();
  }

  async function remove(id) {
    const lesson = LearningStore.getLesson(id);
    if (!lesson) return;
    const impact = LearningStore.lessonImpact(id);
    let extra = "";
    if (impact.assignments > 0) {
      extra = "<br><br>Bài học này có <b>" + impact.assignments + " bài tập</b> và <b>" + impact.submissions + " bài nộp</b>. Tất cả sẽ bị xóa theo.";
    }
    const shown = (lesson.batchIds || []).length;
    if (shown > 0) extra += "<br><br>Bài học đang hiển thị ở <b>" + shown + " đợt học</b>; học viên của các đợt đó sẽ không còn thấy bài này.";
    const yes = await UI.confirm({
      title: "Xóa bài học?",
      message: "Bạn có chắc muốn xóa bài <b>" + UI.esc(lesson.name) + "</b>? Thao tác này không thể hoàn tác." + extra,
      okText: "Xóa bài học",
      danger: true,
    });
    if (yes) {
      LearningStore.deleteLesson(id);
      UI.toast("Đã xóa bài học.");
      render();
    }
  }

  /* ---------- Sự kiện ---------- */
  $("course-select").addEventListener("change", (e) => {
    state.courseId = e.target.value;
    state.page = 1;
    state.status = "all";
    fillBatchFilter("");
    Ins.setParam("course", state.courseId);
    Ins.setParam("batch", "");
    render();
  });
  $("filter-batch").addEventListener("change", (e) => {
    state.batchFilter = e.target.value;
    state.page = 1;
    Ins.setParam("batch", state.batchFilter);
    render();
  });
  $("search").addEventListener(
    "input",
    UI.debounce((e) => {
      state.keyword = e.target.value;
      state.page = 1;
      render();
    }, 200)
  );
  $("status-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (!tab) return;
    state.status = tab.dataset.tab;
    state.page = 1;
    render();
  });
  $("list-area").addEventListener("click", (e) => {
    const sort = e.target.closest("[data-sort]");
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    const bat = e.target.closest("[data-batches]");
    if (sort) {
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      render();
    } else if (edit) openForm(edit.dataset.edit);
    else if (del) remove(del.dataset.del);
    else if (bat) openQuickBatches(bat.dataset.batches);
  });
  $("list-area").addEventListener("change", (e) => {
    const box = e.target.closest("[data-toggle]");
    if (!box) return;
    LearningStore.setLessonStatus(box.dataset.toggle, box.checked ? "visible" : "hidden");
    UI.toast(box.checked ? "Đã hiển thị bài học." : "Đã ẩn bài học.", "info");
    render();
  });
  $("btn-add").addEventListener("click", () => openForm(null));
  $("btn-save").addEventListener("click", save);
  $("btn-save-batches").addEventListener("click", saveQuickBatches);

  render();
}

initLessonPage();
