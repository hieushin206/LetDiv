/* =========================================================
   danh-muc.js - Trang "Danh mục"
   QUY TẮC: không xóa danh mục khi vẫn còn khóa học sử dụng
   (kiểm tra trong Store.deleteCategory).
   Mỗi danh mục xem được các khóa học bên trong và thêm / gỡ khóa học.
   Tab "Chưa phân loại": liệt kê khóa học chưa có danh mục để thêm nhanh vào danh mục.
   Nút "Lượt mua": chi tiết lượt mua của danh mục nằm ở khóa học nào (tính theo danh mục HIỆN TẠI của khóa học).
   ========================================================= */
function initCategoryPage() {
  const $ = (id) => document.getElementById(id);
  const FIELDS = ["name"];
  const STYLES = [
    ["ic-blue", "fa-layer-group"],
    ["ic-green", "fa-server"],
    ["ic-amber", "fa-palette"],
    ["ic-violet", "fa-seedling"],
    ["ic-red", "fa-mobile-screen"],
  ];
  let editingId = null;
  let viewingCat = null; // danh mục đang mở trong cửa sổ "Khóa học"
  let view = "all"; // all = các danh mục | uncat = khóa học chưa phân loại

  // Khóa học chưa phân loại = chưa có danh mục, hoặc danh mục của nó đã bị xóa
  function isUncategorized(c) {
    return !c.categoryId || !Store.getCategory(c.categoryId);
  }

  // Danh mục hiện tại của 1 lượt mua: theo khóa học hiện tại (admin có thể đã chuyển khóa sang danh mục khác)
  function categoryOfItem(it) {
    const c = Store.getCourse(it.courseId);
    const id = c ? c.categoryId : it.categoryId;
    return id && Store.getCategory(id) ? id : "";
  }

  // Thống kê lượt mua: byCourse[courseId] và byCat[categoryId] (id rỗng = chưa phân loại)
  function buildSales() {
    const byCourse = {};
    const byCat = {};
    Store.completedOrders().forEach((o) => {
      o.items.forEach((it) => {
        const rev = Store.lineRevenue(o, it);
        const cid = categoryOfItem(it);
        const c = (byCourse[it.courseId] = byCourse[it.courseId] || { count: 0, revenue: 0 });
        const k = (byCat[cid] = byCat[cid] || { count: 0, revenue: 0 });
        c.count++;
        c.revenue += rev;
        k.count++;
        k.revenue += rev;
      });
    });
    return { byCourse: byCourse, byCat: byCat };
  }
  function render() {
    const cats = Store.get("categories");
    const sales = buildSales();
    const uncat = Store.getCourses(false).filter(isUncategorized);

    // Cảnh báo + tab lọc "Chưa phân loại"
    $("uncat-alert").innerHTML =
      uncat.length > 0 && view === "all"
        ? '<div class="alert-bar"><i class="fa-solid fa-triangle-exclamation"></i><span>Có <b>' + uncat.length + ' khóa học</b> chưa được phân loại.</span><a href="#" id="go-uncat">Xem ngay</a></div>'
        : "";
    $("cat-tabs").innerHTML = [["all", "Tất cả danh mục", cats.length], ["uncat", "Chưa phân loại", uncat.length]]
      .map((t) => '<button class="tab ' + (view === t[0] ? "active" : "") + '" data-view="' + t[0] + '">' + t[1] + '<span class="count">' + t[2] + "</span></button>")
      .join("");
    $("cat-grid").style.display = view === "all" ? "" : "none";
    $("uncat-panel").style.display = view === "uncat" ? "" : "none";
    if (view === "uncat") renderUncat(uncat, cats, sales);

    if (cats.length === 0) {
      $("cat-grid").innerHTML = '<div class="card empty-state" style="grid-column:1/-1"><i class="fa-solid fa-tags"></i><h3>Chưa có danh mục</h3><p>Bấm "Thêm danh mục" để bắt đầu.</p></div>';
      return;
    }
    $("cat-grid").innerHTML = cats
      .map((c, i) => {
        const style = STYLES[i % STYLES.length];
        return (
          '<div class="card cat-card"><div class="cat-top"><div class="cat-icon ' + style[0] + '"><i class="fa-solid ' + style[1] + '"></i></div>' +
          "<div><h3>" + UI.esc(c.name) + '</h3><div class="cell-sub">' + c.id + "</div></div></div>" +
          "<p>" + (UI.esc(c.description) || '<span class="text-muted">Chưa có mô tả</span>') + "</p>" +
          '<div class="cat-stats"><div><b>' + Store.countCoursesInCategory(c.id, false) + "</b><span>Khóa học</span></div>" +
          "<div><b>" + (sales.byCat[c.id] ? sales.byCat[c.id].count : 0) + "</b><span>Lượt mua</span></div></div>" +
          '<div class="cat-actions"><button class="btn btn-outline btn-sm" data-courses="' + c.id + '"><i class="fa-solid fa-list"></i> Khóa học</button>' +
          '<button class="btn btn-outline btn-sm" data-sales="' + c.id + '"><i class="fa-solid fa-receipt"></i> Lượt mua</button>' +
          '<button class="btn btn-outline btn-sm" data-edit="' + c.id + '"><i class="fa-solid fa-pen"></i> Sửa</button>' +
          '<button class="btn btn-outline btn-sm" style="color:var(--color-seven)" data-delete="' + c.id + '"><i class="fa-regular fa-trash-can"></i> Xóa</button></div></div>'
        );
      })
      .join("");
  }

  function openForm(id) {
    editingId = id || null;
    UI.clearErrors(FIELDS);
    const c = id ? Store.getCategory(id) : null;
    $("cat-modal-title").textContent = c ? "Sửa danh mục " + c.id : "Thêm danh mục mới";
    $("f-name").value = c ? c.name : "";
    $("f-description").value = c ? c.description : "";
    UI.openModal("cat-modal");
    $("f-name").focus();
  }

  $("btn-add").addEventListener("click", () => openForm());
  $("btn-save").addEventListener("click", () => {
    const data = { name: $("f-name").value, description: $("f-description").value };
    const errors = Store.validateCategory(data, editingId);
    UI.showErrors(errors, FIELDS);
    if (Object.keys(errors).length) return;
    if (editingId) Store.updateCategory(editingId, data);
    else Store.addCategory(data);
    UI.closeModal("cat-modal");
    UI.toast(editingId ? "Đã cập nhật danh mục." : "Đã thêm danh mục mới.");
    render();
  });
  $("f-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("btn-save").click();
  });

  /* ---------- Tab "Chưa phân loại": thêm nhanh khóa học vào danh mục ---------- */
  function renderUncat(uncat, cats, sales) {
    if (uncat.length === 0) {
      $("uncat-panel").innerHTML = '<div class="card empty-state"><i class="fa-solid fa-circle-check"></i><h3>Tất cả khóa học đã được phân loại</h3><p>Khóa học mới (thêm từ file HTML) chưa có danh mục sẽ hiện ở đây.</p></div>';
      return;
    }
    const options = '<option value="">— Chọn danh mục —</option>' + cats.map((c) => '<option value="' + c.id + '">' + UI.esc(c.name) + "</option>").join("");
    $("uncat-panel").innerHTML =
      '<div class="card"><div class="card-head"><h2>Khóa học chưa phân loại (' + uncat.length + ')</h2></div><div class="table-wrap"><table class="data-table" style="min-width: 760px"><thead><tr><th>Ảnh</th><th>Khóa học</th><th class="num">Lượt mua</th><th>Thêm vào danh mục</th></tr></thead><tbody>' +
      uncat
        .map((c) => {
          const s = sales.byCourse[c.id];
          return (
            '<tr><td><img class="thumb" src="' + UI.esc(UI.img(c.image)) + '" alt=""></td>' +
            '<td><div class="cell-title">' + UI.esc(c.name) + '</div><div class="cell-sub">' + c.id + " · GV: " + UI.esc(c.instructor || "Chưa phân công") + "</div></td>" +
            '<td class="num"><b>' + (s ? s.count : 0) + "</b></td>" +
            '<td><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><select data-uncat-sel="' + c.id + '" style="min-width:180px;width:auto">' + options + "</select>" +
            '<button class="btn btn-primary btn-sm" data-uncat-add="' + c.id + '"><i class="fa-solid fa-plus"></i> Thêm</button></div></td></tr>'
          );
        })
        .join("") +
      "</tbody></table></div></div>";
  }

  /* ---------- Chi tiết lượt mua của 1 danh mục: nằm ở khóa học nào ---------- */
  function renderSales(catId) {
    const cat = Store.getCategory(catId);
    if (!cat) return;
    $("sales-title").textContent = "Chi tiết lượt mua - " + cat.name;

    // Các lượt mua (đơn hoàn thành) thuộc danh mục này, gom theo khóa học
    const rows = {};
    const purchases = [];
    Store.completedOrders().forEach((o) => {
      o.items.forEach((it) => {
        if (categoryOfItem(it) !== catId) return;
        const r = (rows[it.courseId] = rows[it.courseId] || { courseId: it.courseId, name: it.name, count: 0, revenue: 0 });
        r.count++;
        r.revenue += Store.lineRevenue(o, it);
        purchases.push({ order: o, item: it });
      });
    });
    // Khóa đang thuộc danh mục nhưng chưa có lượt mua vẫn hiện (0 lượt)
    Store.getCoursesInCategory(catId).forEach((c) => {
      if (!rows[c.id]) rows[c.id] = { courseId: c.id, name: c.name, count: 0, revenue: 0 };
    });
    const list = Object.values(rows).sort((a, b) => b.count - a.count || b.revenue - a.revenue);
    const total = list.reduce((s, r) => s + r.count, 0);
    const revenue = list.reduce((s, r) => s + r.revenue, 0);
    const bought = list.filter((r) => r.count > 0).length;

    const recent = purchases.sort((a, b) => new Date(b.order.createdAt) - new Date(a.order.createdAt)).slice(0, 10);

    $("sales-body").innerHTML =
      '<div class="info-box" style="margin-bottom:18px"><div class="info-line"><span>Tổng lượt mua</span><span>' + total + "</span></div>" +
      '<div class="info-line"><span>Doanh thu</span><span>' + UI.money(revenue) + "</span></div>" +
      '<div class="info-line"><span>Khóa học có lượt mua</span><span>' + bought + " / " + list.length + "</span></div></div>" +
      '<h4 class="section-title" style="margin-top:0">Lượt mua theo từng khóa học</h4>' +
      (list.length === 0
        ? '<div class="text-muted">Danh mục chưa có khóa học.</div>'
        : '<table class="mini-table"><thead><tr><th>Khóa học</th><th class="num">Lượt mua</th><th style="width:150px">Tỉ lệ</th><th class="num">Doanh thu</th></tr></thead><tbody>' +
          list
            .map((r) => {
              const pct = total ? Math.round((r.count / total) * 100) : 0;
              return (
                "<tr><td><b>" + UI.esc(r.name) + '</b><div class="cell-sub">' + r.courseId + "</div></td>" +
                '<td class="num"><b>' + r.count + "</b></td>" +
                '<td><div style="height:6px;background:#e9ecef;border-radius:6px"><div style="width:' + pct + '%;height:6px;background:var(--color-one);border-radius:6px"></div></div><div class="cell-sub">' + pct + "%</div></td>" +
                '<td class="num">' + UI.money(r.revenue) + "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table>") +
      '<h4 class="section-title">Các lượt mua gần đây</h4>' +
      (recent.length === 0
        ? '<div class="text-muted">Chưa có lượt mua nào.</div>'
        : '<table class="mini-table"><thead><tr><th>Ngày</th><th>Mã đơn</th><th>Học viên</th><th>Khóa học</th><th class="num">Giá</th></tr></thead><tbody>' +
          recent
            .map((p) => "<tr><td>" + UI.date(p.order.createdAt) + '</td><td class="mono">' + p.order.id + "</td><td>" + UI.esc(p.order.studentName) + "</td><td>" + UI.esc(p.item.name) + '</td><td class="num">' + UI.money(Store.lineRevenue(p.order, p.item)) + "</td></tr>")
            .join("") +
          "</tbody></table>");
  }

  /* ---------- Khóa học trong danh mục ---------- */
  function renderCourses() {
    const cat = Store.getCategory(viewingCat);
    if (!cat) return;
    $("cc-title").textContent = "Khóa học trong danh mục \"" + cat.name + "\"";
    const inCat = Store.getCoursesInCategory(cat.id);
    const courseSales = buildSales().byCourse;
    $("cc-count").textContent = inCat.length + " khóa học";

    // Ô chọn: các khóa học (chưa xóa) chưa thuộc danh mục này
    const others = Store.getCourses(false)
      .filter((c) => c.categoryId !== cat.id)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
    $("cc-select").innerHTML = others.length
      ? '<option value="">— Chọn khóa học để thêm —</option>' + others.map((c) => '<option value="' + c.id + '">' + UI.esc(c.name) + " (đang ở: " + UI.esc(Store.categoryName(c.categoryId)) + ")</option>").join("")
      : '<option value="">Không còn khóa học nào để thêm</option>';
    $("cc-add").disabled = others.length === 0;

    $("cc-list").innerHTML = inCat.length
      ? '<div class="table-wrap"><table class="data-table" style="min-width: 560px"><thead><tr><th>Ảnh</th><th>Khóa học</th><th class="num">Giá</th><th class="num">Lượt mua</th><th>Hiển thị</th><th class="actions"></th></tr></thead><tbody>' +
        inCat
          .map((c) => {
            return (
              '<tr><td><img class="thumb" src="' + UI.esc(UI.img(c.image)) + '" alt=""></td>' +
              '<td><div class="cell-title">' + UI.esc(c.name) + '</div><div class="cell-sub">' + c.id + " · GV: " + UI.esc(c.instructor || "Chưa phân công") + "</div></td>" +
              '<td class="num price">' + UI.money(c.price) + "</td>" +
              '<td class="num"><b>' + (courseSales[c.id] ? courseSales[c.id].count : 0) + "</b></td>" +
              "<td>" + (c.status === "active" ? '<span class="badge badge-success">Hiển thị</span>' : '<span class="badge badge-muted">Đang ẩn</span>') + "</td>" +
              '<td class="actions"><button class="icon-btn danger" title="Gỡ khỏi danh mục" data-remove="' + c.id + '"><i class="fa-solid fa-link-slash"></i></button></td></tr>'
            );
          })
          .join("") +
        "</tbody></table></div>"
      : '<div class="empty-state"><i class="fa-regular fa-folder-open"></i><h3>Danh mục chưa có khóa học</h3><p>Chọn một khóa học ở ô phía trên rồi bấm "Thêm".</p></div>';
  }

  $("cc-add").addEventListener("click", () => {
    const id = $("cc-select").value;
    if (!id) return UI.toast("Hãy chọn khóa học cần thêm.", "error");
    if (Store.moveCourseToCategory(id, viewingCat)) UI.toast("Đã thêm khóa học vào danh mục.");
    else UI.toast("Không thêm được khóa học.", "error");
    renderCourses();
    render();
  });
  $("cc-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    const course = Store.getCourse(btn.dataset.remove);
    const yes = await UI.confirm({
      title: "Gỡ khóa học khỏi danh mục?",
      message: "Khóa học <b>" + UI.esc(course.name) + "</b> sẽ chuyển sang <b>Chưa phân loại</b>. Bạn có thể thêm lại vào danh mục khác bất cứ lúc nào.",
      okText: "Gỡ khỏi danh mục",
      danger: true,
    });
    if (!yes) return;
    Store.moveCourseToCategory(course.id, "");
    UI.toast("Đã gỡ khóa học khỏi danh mục.", "info");
    renderCourses();
    render();
  });

  // Chuyển giữa "Tất cả danh mục" và "Chưa phân loại"
  $("cat-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-view]");
    if (!tab) return;
    view = tab.dataset.view;
    render();
  });
  $("uncat-alert").addEventListener("click", (e) => {
    if (!e.target.closest("#go-uncat")) return;
    e.preventDefault();
    view = "uncat";
    render();
  });
  // Thêm nhanh khóa học chưa phân loại vào danh mục đã chọn
  $("uncat-panel").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-uncat-add]");
    if (!btn) return;
    const id = btn.dataset.uncatAdd;
    const catId = $("uncat-panel").querySelector('[data-uncat-sel="' + id + '"]').value;
    if (!catId) return UI.toast("Hãy chọn danh mục cho khóa học.", "error");
    Store.moveCourseToCategory(id, catId);
    UI.toast('Đã thêm "' + Store.getCourse(id).name + '" vào danh mục ' + Store.categoryName(catId) + ".");
    render();
  });

  $("cat-grid").addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit]");
    if (edit) return openForm(edit.dataset.edit);

    const salesBtn = e.target.closest("[data-sales]");
    if (salesBtn) {
      renderSales(salesBtn.dataset.sales);
      return UI.openModal("sales-modal");
    }

    const list = e.target.closest("[data-courses]");
    if (list) {
      viewingCat = list.dataset.courses;
      renderCourses();
      return UI.openModal("cc-modal");
    }

    const del = e.target.closest("[data-delete]");
    if (!del) return;
    const cat = Store.getCategory(del.dataset.delete);

    // Báo trước nếu danh mục đang được dùng
    const using = Store.countCoursesInCategory(cat.id, false);
    if (using > 0) {
      await UI.alert("Không thể xóa danh mục", "Danh mục <b>" + UI.esc(cat.name) + "</b> đang có <b>" + using + " khóa học</b>. Hãy chuyển các khóa học sang danh mục khác (hoặc xóa chúng) trước.");
      return;
    }
    const yes = await UI.confirm({
      title: "Xóa danh mục?",
      message: "Danh mục <b>" + UI.esc(cat.name) + "</b> sẽ bị xóa vĩnh viễn.",
      okText: "Xóa danh mục",
      danger: true,
    });
    if (!yes) return;
    const res = Store.deleteCategory(cat.id);
    if (res.ok) UI.toast("Đã xóa danh mục.", "info");
    else UI.toast(res.error, "error");
    render();
  });

  render();

  // Khóa học thêm / sửa / xóa trong file HTML của website thì số liệu ở đây tự cập nhật
  SiteSync.run().then((r) => {
    if (!r.changed) return;
    render();
    UI.toast(SiteSync.describe(r), "info");
  });
}

initCategoryPage();
