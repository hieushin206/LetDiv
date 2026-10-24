/* =========================================================
   dot-hoc.js - Trang "Đợt học" của admin
   ---------------------------------------------------------
   Mỗi khóa học chia thành nhiều ĐỢT HỌC. Đợt học gồm: tên, giảng viên phụ trách
   (chọn trong số giảng viên đã phân công cho khóa), ngày bắt đầu, ngày kết thúc.
   Các đợt của cùng khóa có thể nối tiếp, xen kẽ hay học trước - tùy admin chọn ngày.

   - Học viên được phân vào đợt ở trang "Đơn hàng".
   - Bài học / bài tập do giảng viên tạo sẵn trên KHÓA HỌC; giảng viên chọn đợt nào được hiển thị bài học đó.
     Học viên chỉ thấy bài học của đợt mình, giảng viên chỉ thấy bài nộp của học viên trong đợt.
   - Xóa đợt: chỉ khi đợt không còn học viên; đợt chỉ bị gỡ khỏi danh sách hiển thị, bài học vẫn còn trên khóa học.
   ========================================================= */
function initBatchPage() {
  const $ = (id) => document.getElementById(id);
  const FIELDS = ["courseId", "name", "instructor", "startDate", "endDate"];
  const PAGE_SIZE = 10;
  const state = {
    keyword: "",
    courseId: "",
    status: "all",
    page: 1,
    editingId: null,
  };

  const STATUS_LABEL = {
    upcoming: "Sắp diễn ra",
    running: "Đang diễn ra",
    ended: "Đã kết thúc",
  };
  const STATUS_BADGE = {
    upcoming: "badge-warning",
    running: "badge-success",
    ended: "badge-muted",
  };

  const accounts = AuthStore.getAccounts();
  const nameOf = (username) => {
    const a = accounts.find((x) => x.usernameKey === username);
    return a ? a.fullName : username;
  };

  // "2026-10-14" -> "14/10/2026"
  const fmt = (d) => (d ? d.split("-").reverse().join("/") : "—");

  function courseOptions(selected, withAll) {
    const list = Store.getCourses(false).sort((a, b) =>
      a.name.localeCompare(b.name, "vi"),
    );
    return (
      (withAll
        ? '<option value="">Tất cả khóa học</option>'
        : '<option value="">— Chọn khóa học —</option>') +
      list
        .map(
          (c) =>
            '<option value="' +
            c.id +
            '"' +
            (c.id === selected ? " selected" : "") +
            ">" +
            UI.esc(c.name) +
            "</option>",
        )
        .join("")
    );
  }

  /* ---------- Danh sách ---------- */
  function getFiltered() {
    const kw = UI.normalize(state.keyword);
    return Store.getBatches().filter((b) => {
      if (state.courseId && b.courseId !== state.courseId) return false;
      if (state.status !== "all" && Store.batchStatus(b) !== state.status)
        return false;
      if (!kw) return true;
      const course = Store.getCourse(b.courseId);
      return UI.normalize(
        b.name + " " + (course ? course.name : "") + " " + nameOf(b.instructor),
      ).includes(kw);
    });
  }

  function renderTabs() {
    const all = Store.getBatches().filter(
      (b) => !state.courseId || b.courseId === state.courseId,
    );
    const count = (s) => all.filter((b) => Store.batchStatus(b) === s).length;
    $("status-tabs").innerHTML = [
      ["all", "Tất cả", all.length],
      ["upcoming", "Sắp diễn ra", count("upcoming")],
      ["running", "Đang diễn ra", count("running")],
      ["ended", "Đã kết thúc", count("ended")],
    ]
      .map(
        (t) =>
          '<button class="tab ' +
          (state.status === t[0] ? "active" : "") +
          '" data-status="' +
          t[0] +
          '">' +
          t[1] +
          '<span class="count">' +
          t[2] +
          "</span></button>",
      )
      .join("");
  }

  function render() {
    renderTabs();
    const list = getFiltered();
    if (Store.getBatches().length === 0) {
      $("list-area").innerHTML =
        '<div class="empty-state"><i class="fa-regular fa-calendar"></i><h3>Chưa có đợt học nào</h3><p>Bấm "Tạo đợt học" để chia khóa học thành các đợt.</p></div>';
      $("pager").innerHTML = "";
      return;
    }
    if (list.length === 0) {
      $("list-area").innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><h3>Không tìm thấy đợt học</h3><p>Hãy thử đổi bộ lọc hoặc từ khóa.</p></div>';
      $("pager").innerHTML = "";
      return;
    }
    const pages = Math.ceil(list.length / PAGE_SIZE);
    if (state.page > pages) state.page = pages;
    const rows = list.slice(
      (state.page - 1) * PAGE_SIZE,
      state.page * PAGE_SIZE,
    );

    $("list-area").innerHTML =
      '<div class="table-wrap"><table class="data-table" style="min-width: 900px"><thead><tr><th>Đợt học</th><th>Khóa học</th><th>Giảng viên</th><th>Thời gian</th><th>Trạng thái</th><th class="num">Học viên</th><th class="actions"></th></tr></thead><tbody>' +
      rows
        .map((b) => {
          const course = Store.getCourse(b.courseId);
          const st = Store.batchStatus(b);
          return (
            '<tr><td><div class="cell-title">' +
            UI.esc(b.name) +
            '</div><div class="cell-sub mono">' +
            b.id +
            "</div></td>" +
            '<td><div class="clamp-2" style="max-width:260px">' +
            UI.esc(course ? course.name : "(khóa đã gỡ)") +
            "</div></td>" +
            "<td>" +
            UI.esc(nameOf(b.instructor)) +
            "</td>" +
            "<td>" +
            fmt(b.startDate) +
            " → " +
            fmt(b.endDate) +
            "</td>" +
            '<td><span class="badge ' +
            STATUS_BADGE[st] +
            '">' +
            STATUS_LABEL[st] +
            "</span></td>" +
            '<td class="num"><button class="btn btn-outline btn-sm" data-students="' +
            b.id +
            '"><i class="fa-solid fa-users"></i> ' +
            Store.batchSize(b.id) +
            "</button></td>" +
            '<td class="actions"><button class="icon-btn" title="Sửa" data-edit="' +
            b.id +
            '"><i class="fa-regular fa-pen-to-square"></i></button>' +
            '<button class="icon-btn danger" title="Xóa" data-del="' +
            b.id +
            '"><i class="fa-regular fa-trash-can"></i></button></td></tr>'
          );
        })
        .join("") +
      "</tbody></table></div>";
    UI.pager($("pager"), list.length, state.page, PAGE_SIZE, (p) => {
      state.page = p;
      render();
    });
  }

  /* ---------- Form tạo / sửa ---------- */
  // Giảng viên chọn được = giảng viên đã phân công cho khóa học đang chọn
  function renderInstructorOptions(courseId, selected) {
    const keys = courseId ? Store.courseInstructors(courseId) : [];
    if (keys.length === 0) {
      $("f-instructor").innerHTML =
        '<option value="">— Chưa có giảng viên —</option>';
      $("h-instructor").textContent = courseId
        ? "Khóa học chưa có giảng viên. Hãy phân công ở trang Khóa học trước."
        : "Chọn khóa học trước.";
      return;
    }
    $("h-instructor").textContent =
      "Chọn trong số giảng viên đã phân công cho khóa học.";
    $("f-instructor").innerHTML =
      '<option value="">— Chọn giảng viên —</option>' +
      keys
        .map(
          (k) =>
            '<option value="' +
            UI.esc(k) +
            '"' +
            (k === selected ? " selected" : "") +
            ">" +
            UI.esc(nameOf(k)) +
            "</option>",
        )
        .join("");
  }

  function openForm(id) {
    UI.clearErrors(FIELDS);
    state.editingId = id || null;
    const b = id ? Store.getBatch(id) : null;
    $("batch-modal-title").textContent = b
      ? "Sửa đợt học " + b.id
      : "Tạo đợt học";
    const courseId = b ? b.courseId : state.courseId;
    $("f-courseId").innerHTML = courseOptions(courseId, false);
    $("f-courseId").disabled = !!b; // khóa học của đợt không đổi được
    renderInstructorOptions(courseId, b ? b.instructor : "");
    $("f-name").value = b
      ? b.name
      : courseId
        ? Store.nextBatchName(courseId)
        : "";
    $("f-startDate").value = b ? b.startDate : "";
    $("f-endDate").value = b ? b.endDate : "";
    $("e-endDate").textContent = "";
    range.sync();
    UI.openModal("batch-modal");
    (b ? $("f-name") : $("f-courseId")).focus();
  }

  // Ngày kết thúc không được nhỏ hơn ngày bắt đầu: chặn ngay trên ô chọn ngày, gõ tay sai thì báo lỗi + tự sửa
  const range = linkDateRange($("f-startDate"), $("f-endDate"), (msg) => {
    $("e-endDate").textContent = msg;
  });

  $("f-courseId").addEventListener("change", (e) => {
    const courseId = e.target.value;
    renderInstructorOptions(courseId, "");
    if (courseId) $("f-name").value = Store.nextBatchName(courseId);
  });

  function save() {
    const data = {
      courseId: $("f-courseId").value,
      name: $("f-name").value,
      instructor: $("f-instructor").value,
      startDate: $("f-startDate").value,
      endDate: $("f-endDate").value,
    };
    const errors = Store.validateBatch(data, state.editingId);
    UI.showErrors(errors, FIELDS);
    if (Object.keys(errors).length > 0) return;

    if (state.editingId) {
      Store.updateBatch(state.editingId, data);
      UI.toast("Đã cập nhật đợt học.");
    } else {
      const batch = Store.addBatch(data);
      if (!batch) return UI.toast("Không lưu được đợt học.", "error");
      UI.toast("Đã tạo " + batch.name + ".");
    }
    UI.closeModal("batch-modal");
    render();
  }

  /* ---------- Học viên của đợt ---------- */
  function openStudents(id) {
    const b = Store.getBatch(id);
    if (!b) return;
    const course = Store.getCourse(b.courseId);
    $("students-title").textContent =
      b.name + " - " + (course ? course.name : "");
    const rows = Store.get("classes").filter((k) => k.batchId === id);
    $("students-body").innerHTML =
      '<div class="info-box" style="margin-bottom:16px"><div class="info-line"><span>Giảng viên</span><span>' +
      UI.esc(nameOf(b.instructor)) +
      "</span></div>" +
      '<div class="info-line"><span>Thời gian</span><span>' +
      fmt(b.startDate) +
      " → " +
      fmt(b.endDate) +
      "</span></div>" +
      '<div class="info-line"><span>Số học viên</span><span>' +
      rows.length +
      "</span></div></div>" +
      (rows.length === 0
        ? '<div class="empty-state"><i class="fa-solid fa-user-graduate"></i><h3>Đợt chưa có học viên</h3><p>Phân học viên vào đợt ở trang <b>Đơn hàng</b> (chi tiết đơn → chọn đợt học).</p></div>'
        : '<table class="mini-table"><thead><tr><th>Học viên</th><th>Mã đơn</th><th>Ngày phân đợt</th><th class="actions"></th></tr></thead><tbody>' +
          rows
            .map((k) => {
              const s = Store.getStudent(k.studentId);
              return (
                "<tr><td><b>" +
                UI.esc(s ? s.name : k.studentId) +
                '</b><div class="cell-sub">' +
                k.studentId +
                (s ? " · " + UI.esc(s.email) : "") +
                "</div></td>" +
                '<td class="mono">' +
                k.orderId +
                "</td><td>" +
                UI.date(k.assignedAt) +
                "</td>" +
                '<td class="actions"><button class="btn btn-outline btn-sm" data-unassign="' +
                k.orderId +
                "|" +
                k.courseId +
                '"><i class="fa-solid fa-user-minus"></i> Gỡ khỏi đợt</button></td></tr>'
              );
            })
            .join("") +
          "</tbody></table>");
    $("students-modal").dataset.batch = id;
    UI.openModal("students-modal");
  }

  $("students-body").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-unassign]");
    if (!btn) return;
    const [orderId, courseId] = btn.dataset.unassign.split("|");
    const yes = await UI.confirm({
      title: "Gỡ học viên khỏi đợt?",
      message:
        "Học viên sẽ trở về <b>chưa phân đợt</b> và chưa vào học được cho tới khi bạn phân lại. Bài nộp đã có của học viên vẫn được giữ.",
      okText: "Gỡ khỏi đợt",
      danger: true,
    });
    if (!yes) return;
    Store.unassignClass(orderId, courseId);
    UI.toast("Đã gỡ học viên khỏi đợt.", "info");
    openStudents($("students-modal").dataset.batch);
    render();
  });

  /* ---------- Xóa đợt ---------- */
  async function remove(id) {
    const b = Store.getBatch(id);
    if (!b) return;
    const size = Store.batchSize(id);
    if (size > 0) {
      return UI.toast(
        "Đợt còn " +
          size +
          " học viên. Hãy chuyển họ sang đợt khác (trang Đơn hàng) hoặc gỡ khỏi đợt trước khi xóa.",
        "error",
      );
    }
    const lessons = LearningStore.getLessons(id).length;
    const yes = await UI.confirm({
      title: "Xóa đợt học?",
      message:
        "Xóa <b>" +
        UI.esc(b.name) +
        "</b>" +
        (lessons
          ? ". Đợt này đang được hiển thị <b>" +
            lessons +
            " bài học</b>; các bài học vẫn còn trên khóa học, chỉ bỏ hiển thị ở đợt này."
          : "?"),
      okText: "Xóa đợt học",
      danger: true,
    });
    if (!yes) return;
    LearningStore.removeBatchContent(id);
    Store.deleteBatch(id);
    UI.toast("Đã xóa đợt học.");
    render();
  }

  /* ---------- Sự kiện ---------- */
  $("filter-course").innerHTML = courseOptions("", true);
  $("filter-course").addEventListener("change", (e) => {
    state.courseId = e.target.value;
    state.page = 1;
    render();
  });
  $("search").addEventListener(
    "input",
    UI.debounce((e) => {
      state.keyword = e.target.value;
      state.page = 1;
      render();
    }, 200),
  );
  $("status-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-status]");
    if (!tab) return;
    state.status = tab.dataset.status;
    state.page = 1;
    render();
  });
  $("list-area").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    const stu = e.target.closest("[data-students]");
    if (edit) openForm(edit.dataset.edit);
    else if (del) remove(del.dataset.del);
    else if (stu) openStudents(stu.dataset.students);
  });
  $("btn-add").addEventListener("click", () => openForm(null));
  $("btn-save").addEventListener("click", save);

  render();
}

initBatchPage();
