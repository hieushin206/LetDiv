/* =========================================================
   ql-bai-hoc.js - Quản lý bài học (Chức năng 1)
   Chọn khóa học + ĐỢT HỌC; bài học thuộc riêng từng đợt (đợt khác không bị ảnh hưởng).
   Xem danh sách, thêm, sửa, xóa (có xác nhận),
   tìm theo tên, sắp xếp theo thứ tự, ẩn/hiện, sang trang Bài tập.
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

  // Khóa học + đợt đang chọn: lấy từ ?course=...&batch=... (nếu thuộc quyền của giảng viên)
  const fromUrl = Ins.param("course");
  const state = {
    courseId: courses.some((c) => c.id === fromUrl) ? fromUrl : courses[0].id,
    batchId: "",
    keyword: "",
    status: "all",
    sortDir: "asc",
    page: 1,
    editingId: null,
  };

  function currentCourse() {
    return courses.find((c) => c.id === state.courseId);
  }

  function currentBatch() {
    return Store.getBatch(state.batchId);
  }

  // Đổi khóa -> chọn đợt: ưu tiên đợt trên địa chỉ, rồi đợt đang diễn ra, rồi đợt đầu tiên
  function pickBatch(preferred) {
    const list = Ins.batches(state.courseId);
    const found = list.find((b) => b.id === preferred) || list.find((b) => Store.batchStatus(b) === "running") || list[0];
    state.batchId = found ? found.id : "";
    $("batch-select").innerHTML = list.length ? Ins.batchOptions(list, state.batchId) : '<option value="">— Chưa có đợt học —</option>';
    $("batch-select").disabled = list.length === 0;
    $("btn-add").disabled = list.length === 0;
  }

  $("course-select").innerHTML = Ins.courseOptions(courses, state.courseId);
  pickBatch(Ins.param("batch"));

  /* ---------- Hiển thị danh sách ---------- */
  function render() {
    if (!state.batchId) {
      $("status-tabs").innerHTML = "";
      $("list-area").innerHTML = Ins.noBatchHtml();
      $("pager").innerHTML = "";
      return;
    }
    const lessons = LearningStore.getLessons(state.batchId);
    const assignments = LearningStore.getAssignmentsOfBatches([state.batchId]);

    // Tab lọc trạng thái
    const counts = { all: lessons.length, visible: lessons.filter((l) => l.status === "visible").length, hidden: lessons.filter((l) => l.status === "hidden").length };
    const tabs = [["all", "Tất cả"], ["visible", "Đang hiển thị"], ["hidden", "Đã ẩn"]];
    $("status-tabs").innerHTML = tabs
      .map((t) => '<button class="tab ' + (state.status === t[0] ? "active" : "") + '" data-tab="' + t[0] + '">' + t[1] + '<span class="count">' + counts[t[0]] + "</span></button>")
      .join("");

    // Lọc theo tên + trạng thái, sắp theo thứ tự
    const kw = UI.normalize(state.keyword);
    let list = lessons.filter((l) => (state.status === "all" || l.status === state.status) && (!kw || UI.normalize(l.name).indexOf(kw) >= 0));
    if (state.sortDir === "desc") list = list.slice().reverse();

    if (lessons.length === 0) {
      $("list-area").innerHTML = '<div class="empty-state"><i class="fa-solid fa-list-ol"></i><h3>Đợt học này chưa có bài học</h3><p>Bấm "Thêm bài học" để tạo bài đầu tiên.</p></div>';
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
      "<th>Bài học</th><th>Video</th><th>Bài tập</th><th>Hiển thị</th><th class=\"actions\"></th></tr></thead><tbody>" +
      rows
        .map((l) => {
          const count = assignments.filter((a) => a.lessonId === l.id).length;
          return (
            '<tr class="' + (l.status === "hidden" ? "row-off" : "") + '">' +
            '<td><span class="order-pill">Bài ' + l.order + "</span></td>" +
            '<td><div class="cell-title">' + UI.esc(l.name) + '</div><div class="cell-sub clamp-2 cell-wide">' + UI.esc(l.description || "Chưa có mô tả") + '</div><div class="cell-sub mono">' + UI.esc(l.id) + "</div></td>" +
            "<td>" + (l.videoUrl ? '<a class="icon-btn" href="' + UI.esc(l.videoUrl) + '" target="_blank" rel="noopener noreferrer" title="Mở video trong tab mới"><i class="fa-solid fa-circle-play"></i></a>' : '<span class="text-muted">—</span>') + "</td>" +
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
    $("f-course").value = currentCourse().name + " · " + currentBatch().name;
    $("f-name").value = lesson ? lesson.name : "";
    $("f-description").value = lesson ? lesson.description : "";
    $("f-content").value = lesson ? lesson.content : "";
    $("f-videoUrl").value = lesson ? lesson.videoUrl : "";
    $("f-order").value = lesson ? lesson.order : LearningStore.getLessons(state.batchId).length + 1;
    $("f-status").value = lesson ? lesson.status : "visible";
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

    if (state.editingId) {
      LearningStore.updateLesson(state.editingId, data);
      UI.toast("Đã cập nhật bài học.");
    } else {
      LearningStore.addLesson(currentBatch(), data);
      UI.toast("Đã thêm bài học mới.");
    }
    UI.closeModal("lesson-modal");
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
    pickBatch("");
    Ins.setParam("course", state.courseId);
    Ins.setParam("batch", state.batchId);
    render();
  });
  $("batch-select").addEventListener("change", (e) => {
    state.batchId = e.target.value;
    state.page = 1;
    state.status = "all";
    Ins.setParam("batch", state.batchId);
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
    if (sort) {
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      render();
    } else if (edit) openForm(edit.dataset.edit);
    else if (del) remove(del.dataset.del);
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

  render();
}

initLessonPage();
