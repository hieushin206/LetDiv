/* =========================================================
   ql-bai-tap.js - Quản lý bài tập của 1 bài học (Chức năng 2)
   Thêm, sửa đề bài + hạn nộp, xóa, xem số bài nộp / chờ chấm,
   Địa chỉ trang: ql-bai-tap.html?lesson=BH001
   ========================================================= */
function initAssignmentPage() {
  if (!Ins.boot()) return;
  const $ = (id) => document.getElementById(id);
  const FIELDS = ["name", "description", "guide", "deadline", "maxScore"];

  // Bài học phải thuộc khóa học mà giảng viên phụ trách (bài học thuộc khóa, đợt chỉ quyết định hiển thị)
  const lesson = LearningStore.getLesson(Ins.param("lesson"));
  const course = lesson ? LearningStore.ownCourse(Ins.user, lesson.courseId) : null;
  if (!lesson || !course) {
    $("main-card").innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><h3>Không tìm thấy bài học</h3><p>Bài học không tồn tại hoặc không thuộc khóa học bạn phụ trách.</p>' +
      '<a class="btn btn-primary" href="ql-bai-hoc.html">Về danh sách bài học</a></div>';
    $("btn-add").disabled = true;
    return;
  }

  const back = "ql-bai-hoc.html?course=" + course.id;
  $("btn-back").href = back;
  const shownIn = Ins.batches(course.id)
    .filter((b) => (lesson.batchIds || []).includes(b.id))
    .map((b) => b.name);
  $("crumb").innerHTML =
    '<a href="' + back + '">' + UI.esc(course.name) + '</a><i class="fa-solid fa-chevron-right"></i><span>Bài ' + lesson.order + ": " + UI.esc(lesson.name) + "</span>";
  $("lesson-text").textContent =
    "Các bài tập của bài học \"" + lesson.name + "\". " +
    (shownIn.length ? "Đang hiển thị ở: " + shownIn.join(", ") + "." : "Bài học chưa được chọn đợt nào nên học viên chưa thấy.");

  let editingId = null;

  /* ---------- Hiển thị danh sách ---------- */
  function render() {
    const list = LearningStore.getAssignmentsOfLesson(lesson.id);
    if (list.length === 0) {
      $("list-area").innerHTML = '<div class="empty-state"><i class="fa-solid fa-list-check"></i><h3>Bài học chưa có bài tập</h3><p>Bấm "Thêm bài tập" để giao bài cho học viên.</p></div>';
      return;
    }
    $("list-area").innerHTML =
      '<div class="table-wrap"><table class="data-table" style="min-width: 760px"><thead><tr><th>Bài tập</th><th>Hạn nộp</th><th class="num">Đã nộp</th><th class="num">Chờ chấm</th><th class="num">Điểm tối đa</th><th class="actions"></th></tr></thead><tbody>' +
      list
        .map((a) => {
          const st = LearningStore.assignmentStats(a.id, Ins.user);
          const overdue = LearningStore.isOverdue(a);
          return (
            "<tr><td><div class=\"cell-title\">" + UI.esc(a.name) + '</div><div class="cell-sub clamp-2 cell-wide">' + UI.esc(a.description) + '</div><div class="cell-sub mono">' + UI.esc(a.id) + "</div></td>" +
            '<td><span class="' + (overdue ? "overdue-text" : "") + '">' + formatLocalDateTime(a.deadline) + "</span></td>" +
            '<td class="num"><b>' + st.submitted + "</b></td>" +
            '<td class="num">' + (st.pending > 0 ? '<span class="badge badge-warning no-dot">' + st.pending + "</span>" : "0") + "</td>" +
            '<td class="num">' + a.maxScore + "</td>" +
            '<td class="actions"><a class="icon-btn success" title="Xem bài nộp" href="bai-nop.html?assignment=' + a.id + '"><i class="fa-solid fa-inbox"></i></a>' +
            '<button class="icon-btn" title="Sửa" data-edit="' + a.id + '"><i class="fa-regular fa-pen-to-square"></i></button>' +
            '<button class="icon-btn danger" title="Xóa" data-del="' + a.id + '"><i class="fa-regular fa-trash-can"></i></button></td></tr>'
          );
        })
        .join("") +
      "</tbody></table></div>";
  }

  /* ---------- Modal thêm / sửa ---------- */
  function openForm(id) {
    UI.clearErrors(FIELDS);
    editingId = id || null;
    const a = id ? LearningStore.getAssignment(id) : null;
    $("as-modal-title").textContent = a ? "Sửa bài tập" : "Thêm bài tập";
    $("f-id").value = a ? a.id : "(tự động tạo khi lưu)";
    $("f-lesson").value = "Bài " + lesson.order + ": " + lesson.name;
    $("f-name").value = a ? a.name : "";
    $("f-description").value = a ? a.description : "";
    $("f-guide").value = a ? a.guide : "";
    // Mặc định hạn nộp = 7 ngày sau, 23:59
    const defaultDeadline = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    defaultDeadline.setHours(23, 59, 0, 0);
    $("f-deadline").value = a ? a.deadline : toLocalInput(defaultDeadline);
    $("f-maxScore").value = a ? a.maxScore : DEFAULT_MAX_SCORE;
    UI.openModal("as-modal");
    $("f-name").focus();
  }

  function save() {
    const data = {
      name: $("f-name").value,
      description: $("f-description").value,
      guide: $("f-guide").value,
      deadline: $("f-deadline").value,
      maxScore: Number($("f-maxScore").value),
    };
    const errors = LearningStore.validateAssignment(data, editingId);
    UI.showErrors(errors, FIELDS);
    if (Object.keys(errors).length > 0) return;

    if (editingId) {
      LearningStore.updateAssignment(editingId, data);
      UI.toast("Đã cập nhật bài tập.");
    } else {
      LearningStore.addAssignment(lesson, data);
      UI.toast("Đã thêm bài tập mới.");
    }
    UI.closeModal("as-modal");
    render();
  }

  async function remove(id) {
    const a = LearningStore.getAssignment(id);
    if (!a) return;
    const impact = LearningStore.assignmentImpact(id);
    const extra = impact.submissions > 0 ? "<br><br>Có <b>" + impact.submissions + " bài nộp</b> (kèm điểm và nhận xét) sẽ bị xóa theo." : "";
    const yes = await UI.confirm({
      title: "Xóa bài tập?",
      message: "Bạn có chắc muốn xóa bài tập <b>" + UI.esc(a.name) + "</b>?" + extra,
      okText: "Xóa bài tập",
      danger: true,
    });
    if (yes) {
      LearningStore.deleteAssignment(id);
      UI.toast("Đã xóa bài tập.");
      render();
    }
  }

  /* ---------- Sự kiện ---------- */
  $("list-area").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    if (edit) openForm(edit.dataset.edit);
    else if (del) remove(del.dataset.del);
  });
  $("btn-add").addEventListener("click", () => openForm(null));
  $("btn-save").addEventListener("click", save);

  render();
}

initAssignmentPage();
