/* =========================================================
   khoa-hoc-cua-toi.js - Danh sách khóa học do giảng viên phụ trách
   Chỉ xem: ảnh, tên, giá, số bài học, số học viên.
   (Thêm / sửa / xóa khóa học là quyền của Admin.)
   ========================================================= */
function initMyCourses() {
  if (!Ins.boot()) return;
  const $ = (id) => document.getElementById(id);
  const PAGE_SIZE = 8;

  const state = { keyword: "", view: "card", page: 1 };
  // Số liệu tính trên các ĐỢT HỌC mà giảng viên phụ trách của từng khóa
  const all = Ins.courses().map((c) => {
    const batches = Ins.batches(c.id);
    return {
      course: c,
      batches: batches.length,
      lessons: LearningStore.getLessonsOfBatches(batches.map((b) => b.id)).length,
      students: LearningStore.courseStudentCount(c.id, Ins.user),
    };
  });

  function filtered() {
    const kw = UI.normalize(state.keyword);
    if (!kw) return all;
    return all.filter((r) => UI.normalize(r.course.name + " " + r.course.id).indexOf(kw) >= 0);
  }

  function priceHtml(c) {
    return '<div class="price">' + UI.money(c.price) + "</div>" + (c.oldPrice > c.price ? '<div class="price-old">' + UI.money(c.oldPrice) + "</div>" : "");
  }

  function statusBadge(c) {
    return c.status === "active" ? '<span class="badge badge-success">Đang hiển thị</span>' : '<span class="badge badge-muted">Đang ẩn</span>';
  }

  function cardHtml(r) {
    const c = r.course;
    return (
      '<div class="course-card"><div class="cc-img"><img src="' + UI.esc(UI.img(c.image)) + '" alt="">' + statusBadge(c) + "</div>" +
      '<div class="cc-body"><div class="cc-title" title="' + UI.esc(c.name) + '">' + UI.esc(c.name) + "</div>" +
      '<div class="cc-meta"><span>' + UI.esc(c.id) + "</span></div>" +
      '<div class="cc-meta"><span><i class="fa-regular fa-calendar"></i> ' + r.batches + ' đợt học</span><span><i class="fa-solid fa-list-ol"></i> ' + r.lessons + ' bài học</span><span><i class="fa-solid fa-user-graduate"></i> ' + r.students + " học viên</span></div></div>" +
      '<div class="cc-foot">' + priceHtml(c) +
      '<div><a class="icon-btn" title="Xem học viên" href="hoc-vien.html?course=' + c.id + '"><i class="fa-solid fa-users"></i></a> ' +
      '<a class="btn btn-primary btn-sm" href="ql-bai-hoc.html?course=' + c.id + '"><i class="fa-regular fa-pen-to-square"></i> Bài học</a></div></div></div>'
    );
  }

  function tableHtml(rows) {
    return (
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Khóa học</th><th class="num">Giá bán</th><th class="num">Đợt học</th><th class="num">Số bài học</th><th class="num">Học viên</th><th class="actions"></th></tr></thead><tbody>' +
      rows
        .map((r) => {
          const c = r.course;
          return (
            '<tr><td><div class="user-cell"><img class="thumb" src="' + UI.esc(UI.img(c.image)) + '" alt="">' +
            '<div><div class="cell-title clamp-2 cell-wide">' + UI.esc(c.name) + '</div><div class="cell-sub">' + UI.esc(c.id) + "</div></div></div></td>" +
            '<td class="num">' + priceHtml(c) + "</td>" +
            '<td class="num">' + r.batches + '</td><td class="num">' + r.lessons + '</td><td class="num">' + r.students + "</td>" +
            '<td class="actions"><a class="icon-btn" title="Xem học viên" href="hoc-vien.html?course=' + c.id + '"><i class="fa-solid fa-users"></i></a>' +
            '<a class="icon-btn" title="Quản lý bài học" href="ql-bai-hoc.html?course=' + c.id + '"><i class="fa-regular fa-pen-to-square"></i></a></td></tr>'
          );
        })
        .join("") +
      "</tbody></table></div>"
    );
  }

  function render() {
    $("view-card").classList.toggle("active", state.view === "card");
    $("view-table").classList.toggle("active", state.view === "table");

    if (all.length === 0) {
      $("list-area").innerHTML = Ins.noCourseHtml();
      $("pager").innerHTML = "";
      return;
    }
    const list = filtered();
    if (list.length === 0) {
      $("list-area").innerHTML = '<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><h3>Không tìm thấy khóa học</h3><p>Hãy thử từ khóa khác.</p></div>';
      $("pager").innerHTML = "";
      return;
    }
    const pages = Math.ceil(list.length / PAGE_SIZE);
    if (state.page > pages) state.page = pages;
    const rows = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    $("list-area").innerHTML = state.view === "card" ? '<div class="course-grid">' + rows.map(cardHtml).join("") + "</div>" : tableHtml(rows);
    UI.pager($("pager"), list.length, state.page, PAGE_SIZE, (p) => {
      state.page = p;
      render();
    });
  }

  $("search").addEventListener(
    "input",
    UI.debounce((e) => {
      state.keyword = e.target.value;
      state.page = 1;
      render();
    }, 200)
  );
  $("view-card").addEventListener("click", () => {
    state.view = "card";
    render();
  });
  $("view-table").addEventListener("click", () => {
    state.view = "table";
    render();
  });

  render();
}

initMyCourses();
