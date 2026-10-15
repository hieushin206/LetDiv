/* =========================================================
   khoa-hoc.js - Trang "Khóa học"
   Chức năng: danh sách (bảng / thẻ), tìm kiếm, lọc danh mục + trạng thái,
   sửa thông tin (tên, danh mục, giá, ảnh, mô tả), PHÂN CÔNG NHIỀU giảng viên cho 1 khóa học,
   bật/tắt hiển thị. Không có thêm / xóa khóa học trong admin: danh sách khóa học lấy từ file HTML
   của website (xem site-sync.js) - thêm / sửa / xóa khối khóa học trong HTML thì admin tự cập nhật.
   Giảng viên được chọn từ các tài khoản có quyền "Giảng viên" (AuthStore).
   Sửa tên / ảnh / giá hoặc ẩn khóa học ở đây thì các trang chính đổi theo (course-sync.js).
   ========================================================= */
function initCoursePage() {
  const FIELDS = ["name", "categoryId", "price", "oldPrice", "image"];
  let pendingImage = ""; // ảnh vừa chọn từ máy, chưa lưu vào thư viện
  const VIEW_KEY = "letdiv_admin_course_view";

  // Trạng thái bộ lọc hiện tại của trang
  const state = {
    search: "",
    category: "",
    status: "all", // all | active | hidden
    view: localStorage.getItem(VIEW_KEY) || "table",
    page: 1,
  };
  let editingId = null; // khóa học đang sửa

  const $ = (id) => document.getElementById(id);
  const listArea = $("list-area");

  /* ---------- Lọc dữ liệu ---------- */
  function getFiltered() {
    let list = Store.get("courses").filter((c) => !c.deleted);
    if (state.status === "active" || state.status === "hidden") list = list.filter((c) => c.status === state.status);
    if (state.category) list = list.filter((c) => c.categoryId === state.category);
    const kw = UI.normalize(state.search);
    if (kw) list = list.filter((c) => UI.normalize(c.name + " " + c.id + " " + c.instructor).includes(kw));
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // mới nhất trước
  }

  // Số lượt bán của từng khóa (tính từ đơn hoàn thành)
  function getSoldMap() {
    const map = {};
    Store.completedOrders().forEach((o) => o.items.forEach((it) => (map[it.courseId] = (map[it.courseId] || 0) + 1)));
    return map;
  }

  /* ---------- Hiển thị ---------- */
  function renderTabs() {
    const all = Store.get("courses");
    const alive = all.filter((c) => !c.deleted);
    const tabs = [
      { key: "all", label: "Tất cả", count: alive.length },
      { key: "active", label: "Đang hiển thị", count: alive.filter((c) => c.status === "active").length },
      { key: "hidden", label: "Đang ẩn", count: alive.filter((c) => c.status === "hidden").length },
    ];
    $("status-tabs").innerHTML = tabs
      .map((t) => '<button class="tab ' + (state.status === t.key ? "active" : "") + '" data-status="' + t.key + '">' + t.label + '<span class="count">' + t.count + "</span></button>")
      .join("");
  }

  function statusCell(c) {
    const on = c.status === "active";
    return (
      '<label class="switch-wrap"><span class="switch"><input type="checkbox" data-action="toggle" data-id="' + c.id + '"' + (on ? " checked" : "") + '><span class="slider"></span></span>' +
      "<span>" + (on ? "Hiển thị" : "Đang ẩn") + "</span></label>"
    );
  }

  function actionButtons(c) {
    return (
      '<button class="icon-btn" title="Sửa thông tin" data-action="edit" data-id="' + c.id + '"><i class="fa-solid fa-pen"></i></button>' +
      '<button class="icon-btn success" title="Phân công giảng viên" data-action="assign" data-id="' + c.id + '"><i class="fa-solid fa-user-plus"></i></button>'
    );
  }

  function priceHtml(c) {
    let html = '<div class="price">' + UI.money(c.price) + "</div>";
    if (c.oldPrice > c.price) html += '<div class="price-old">' + UI.money(c.oldPrice) + "</div>";
    return html;
  }

  function tableHtml(items, sold) {
    const rows = items
      .map((c) => {
        return (
          '<tr>' +
          '<td><img class="thumb" src="' + UI.esc(UI.img(c.image)) + '" alt=""></td>' +
          '<td><div class="cell-title">' + UI.esc(c.name) + '</div><div class="cell-sub">' + c.id + " · GV: " + UI.esc(c.instructor || "Chưa phân công") + "</div></td>" +
          '<td><span class="badge badge-info no-dot">' + UI.esc(Store.categoryName(c.categoryId)) + "</span></td>" +
          '<td class="num">' + priceHtml(c) + "</td>" +
          '<td class="num">' + (sold[c.id] || 0) + "</td>" +
          "<td>" + statusCell(c) + "</td>" +
          '<td class="actions">' + actionButtons(c) + "</td></tr>"
        );
      })
      .join("");
    return (
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Ảnh</th><th>Khóa học</th><th>Danh mục</th><th class="num">Giá</th><th class="num">Đã bán</th><th>Trạng thái</th><th class="num">Thao tác</th></tr></thead><tbody>' +
      rows + "</tbody></table></div>"
    );
  }

  function cardsHtml(items, sold) {
    return (
      '<div class="course-grid">' +
      items
        .map((c) => {
          return (
            '<div class="course-card">' +
            '<div class="cc-img"><img src="' + UI.esc(UI.img(c.image)) + '" alt=""><span class="badge badge-info no-dot">' + UI.esc(Store.categoryName(c.categoryId)) + "</span></div>" +
            '<div class="cc-body"><div class="cc-title">' + UI.esc(c.name) + "</div>" +
            '<div class="cc-meta"><span><i class="fa-solid fa-chalkboard-user"></i> ' + UI.esc(c.instructor || "Chưa phân công") + '</span><span><i class="fa-solid fa-cart-shopping"></i> ' + (sold[c.id] || 0) + " đã bán</span></div>" +
            "<div>" + priceHtml(c) + "</div></div>" +
            '<div class="cc-foot">' + statusCell(c) + "<div>" + actionButtons(c) + "</div></div></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function render() {
    renderTabs();
    $("view-table").classList.toggle("active", state.view === "table");
    $("view-card").classList.toggle("active", state.view === "card");

    const list = getFiltered();
    const size = state.view === "card" ? 9 : 8;
    const pages = Math.max(1, Math.ceil(list.length / size));
    if (state.page > pages) state.page = pages;
    const items = list.slice((state.page - 1) * size, state.page * size);

    if (list.length === 0) {
      listArea.innerHTML =
        '<div class="empty-state"><i class="fa-regular fa-folder-open"></i><h3>' +
        "Không tìm thấy khóa học" +
        "</h3><p>" + "Hãy thử đổi từ khóa hoặc bộ lọc." + "</p></div>";
    } else {
      const sold = getSoldMap();
      listArea.innerHTML = state.view === "card" ? cardsHtml(items, sold) : tableHtml(items, sold);
    }
    UI.pager($("pager"), list.length, state.page, size, (p) => {
      state.page = p;
      render();
    });
  }

  /* ---------- Form thêm / sửa ---------- */
  function fillSelects() {
    $("f-categoryId").innerHTML =
      '<option value="">— Chọn danh mục —</option>' +
      Store.get("categories").map((c) => '<option value="' + c.id + '">' + UI.esc(c.name) + "</option>").join("");

    $("filter-category").innerHTML =
      '<option value="">Tất cả danh mục</option>' +
      Store.get("categories").map((c) => '<option value="' + c.id + '">' + UI.esc(c.name) + "</option>").join("");
    $("filter-category").value = state.category;
  }

  /* ---------- Giảng viên: chọn nhiều từ tài khoản giảng viên ---------- */
  function instructorAccounts() {
    return AuthStore.getAccounts().filter((a) => AuthStore.roleOf(a) === "instructor");
  }

  // Khóa học cũ (dữ liệu mẫu) chỉ có tên giảng viên dạng chữ: tự chọn sẵn tài khoản trùng tên
  function currentInstructorKeys(c) {
    if (Array.isArray(c.instructors)) return c.instructors;
    const names = String(c.instructor || "").split(",").map((n) => UI.normalize(n));
    return instructorAccounts().filter((a) => names.includes(UI.normalize(a.fullName))).map((a) => a.usernameKey);
  }

  function renderInstructorPick(selected) {
    const accounts = instructorAccounts();
    if (accounts.length === 0) {
      $("f-instructors").innerHTML = '<div class="text-muted" style="padding:10px 12px">Chưa có tài khoản giảng viên. Hãy tạo ở trang <b>Học viên</b> (quyền Giảng viên) rồi quay lại phân công.</div>';
      return;
    }
    $("f-instructors").innerHTML = accounts
      .map((a) => {
        const off = AuthStore.isDisabled(a);
        const on = selected.includes(a.usernameKey);
        return (
          '<label class="pick-item ' + (off && !on ? "disabled" : "") + '"><input type="checkbox" value="' + UI.esc(a.usernameKey) + '"' + (on ? " checked" : "") + (off && !on ? " disabled" : "") + ">" +
          '<span class="pick-name"><div class="cell-title">' + UI.esc(a.fullName) + '</div><div class="cell-sub">' + UI.esc(a.username) + (off ? " · đã vô hiệu hóa" : "") + "</div></span></label>"
        );
      })
      .join("");
  }

  function pickedInstructors() {
    const accounts = instructorAccounts();
    return Array.from($("f-instructors").querySelectorAll("input:checked")).map((i) => accounts.find((a) => a.usernameKey === i.value)).filter(Boolean);
  }

  /* ---------- Ảnh khóa học: chọn từ thư viện, tải lên + đặt tên, xóa khỏi lựa chọn ---------- */
  function setImage(src) {
    $("f-image").value = src || "";
    $("image-preview").innerHTML = src ? '<img src="' + UI.esc(UI.img(src)) + '" alt="">' : '<i class="fa-regular fa-image"></i>';
    renderGallery();
  }

  // Lưới ảnh: ảnh có sẵn của website + ảnh admin đã tải lên (có nút × để xóa)
  function renderGallery() {
    const current = $("f-image").value;
    const preset = PRESET_IMAGES.map((p) => ({ src: p.file, name: p.label, mine: false }));
    const mine = Store.getImageLibrary().map((i) => ({ src: i.src, name: i.name, mine: true, id: i.id }));
    $("img-gallery").innerHTML = mine
      .concat(preset)
      .map((g) => {
        return (
          '<button type="button" class="gal-item ' + (g.src === current ? "selected" : "") + '" data-src="' + UI.esc(g.src) + '" title="' + UI.esc(g.name) + '">' +
          '<img src="' + UI.esc(UI.img(g.src)) + '" alt="">' +
          (g.mine ? '<span class="gal-tag">Của bạn</span><span class="gal-del" data-del="' + g.id + '" title="Xóa ảnh khỏi lựa chọn">×</span>' : "") +
          '<span class="gal-name">' + UI.esc(g.name) + "</span></button>"
        );
      })
      .join("");
  }

  function resetUpload() {
    pendingImage = "";
    $("up-name").value = "";
    $("up-file").textContent = "Chưa chọn ảnh";
    $("e-upload").textContent = "";
  }

  function updatePriceHint() {
    const v = Number($("f-price").value);
    $("price-hint").textContent = v > 0 ? "= " + UI.money(v) : "";
  }

  function openForm(id) {
    const c = Store.getCourse(id);
    if (!c) return;
    editingId = id;
    UI.clearErrors(FIELDS);
    fillSelects();
    $("course-modal-title").textContent = "Sửa khóa học " + c.id;
    $("f-name").value = c.name;
    $("f-categoryId").value = c.categoryId;
    $("f-price").value = c.price;
    $("f-oldPrice").value = c.oldPrice ? c.oldPrice : "";
    $("f-description").value = c.description;
    $("f-status").value = c.status;
    resetUpload();
    setImage(c.image);
    updatePriceHint();
    UI.openModal("course-modal");
    $("f-name").focus();
  }

  function saveForm() {
    const data = {
      name: $("f-name").value,
      categoryId: $("f-categoryId").value,
      price: Number($("f-price").value) || 0,
      oldPrice: Number($("f-oldPrice").value) || 0,
      image: $("f-image").value,
      description: $("f-description").value,
      status: $("f-status").value,
    };
    const errors = Store.validateCourse(data, editingId);
    UI.showErrors(errors, FIELDS);
    if (Object.keys(errors).length > 0) return;

    if (!Store.updateCourse(editingId, data)) {
      UI.toast("Không lưu được: bộ nhớ trình duyệt đã đầy. Hãy chọn ảnh nhỏ hơn.", "error");
      return;
    }
    UI.closeModal("course-modal");
    UI.toast("Đã cập nhật khóa học. Trang chính sẽ hiển thị thông tin mới.");
    render();
  }

  /* ---------- Phân công giảng viên (nút riêng, thay cho nút xóa) ---------- */
  let assigningId = null;

  function openAssign(id) {
    const c = Store.getCourse(id);
    if (!c) return;
    assigningId = id;
    $("assign-title").textContent = "Phân công giảng viên - " + c.name;
    renderInstructorPick(currentInstructorKeys(c));
    UI.openModal("assign-modal");
  }

  async function saveAssign() {
    const picked = pickedInstructors();
    const keys = picked.map((a) => a.usernameKey);

    // Giảng viên đang phụ trách đợt học của khóa này thì chưa gỡ được (đợt học cần giảng viên)
    const old = Store.courseInstructors(assigningId);
    const busy = old
      .filter((k) => !keys.includes(k))
      .map((k) => ({ key: k, batches: Store.getBatches(assigningId).filter((b) => b.instructor === k) }))
      .filter((x) => x.batches.length > 0);
    if (busy.length > 0) {
      const accounts = AuthStore.getAccounts();
      const text = busy
        .map((x) => {
          const a = accounts.find((u) => u.usernameKey === x.key);
          return (a ? a.fullName : x.key) + " (" + x.batches.map((b) => b.name).join(", ") + ")";
        })
        .join("; ");
      UI.toast("Chưa gỡ được: " + text + " đang phụ trách đợt học của khóa này. Hãy đổi giảng viên của đợt hoặc xóa đợt ở trang Đợt học trước.", "error");
      return;
    }

    Store.setCourseInstructors(assigningId, keys, picked.map((a) => a.fullName).join(", "));
    UI.closeModal("assign-modal");
    UI.toast(keys.length ? "Đã phân công " + keys.length + " giảng viên cho khóa học." : "Đã bỏ phân công giảng viên của khóa học.");
    render();
  }

  /* ---------- Sự kiện ---------- */
  $("btn-save").addEventListener("click", saveForm);
  $("f-price").addEventListener("input", updatePriceHint);

  $("btn-assign-save").addEventListener("click", saveAssign);

  // Bấm 1 ảnh trong lưới = chọn ảnh đó; bấm × = xóa ảnh (chỉ ảnh bạn đã tải lên) khỏi lựa chọn
  $("img-gallery").addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      const img = Store.getImageLibrary().find((i) => i.id === del.dataset.del);
      if (!img) return;
      const yes = await UI.confirm({
        title: "Xóa ảnh khỏi lựa chọn?",
        message: 'Ảnh <b>' + UI.esc(img.name) + "</b> sẽ không còn trong danh sách chọn. Khóa học đang dùng ảnh này vẫn giữ nguyên ảnh của nó.",
        okText: "Xóa ảnh",
        danger: true,
      });
      if (!yes) return;
      Store.deleteLibraryImage(img.id);
      if ($("f-image").value === img.src) setImage(""); // đang chọn ảnh vừa xóa thì bỏ chọn
      else renderGallery();
      UI.toast("Đã xóa ảnh khỏi lựa chọn.", "info");
      return;
    }
    const item = e.target.closest("[data-src]");
    if (item) setImage(item.dataset.src);
  });

  // Tải ảnh từ máy -> đặt tên -> "Lưu vào lựa chọn"
  $("btn-upload").addEventListener("click", () => $("file-input").click());
  $("file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      $("e-upload").textContent = "Vui lòng chọn tệp ảnh.";
      return;
    }
    UI.resizeImage(file, 640, (dataUrl) => {
      if (!dataUrl) {
        $("e-upload").textContent = "Không đọc được tệp ảnh này.";
        return;
      }
      pendingImage = dataUrl;
      $("e-upload").textContent = "";
      $("up-file").textContent = file.name;
      $("image-preview").innerHTML = '<img src="' + UI.esc(dataUrl) + '" alt="">'; // xem trước
      if (!$("up-name").value) $("up-name").value = file.name.replace(/\.[^.]+$/, "").slice(0, 40);
    });
  });
  $("btn-save-image").addEventListener("click", () => {
    const res = Store.addLibraryImage($("up-name").value, pendingImage);
    if (!res.ok) {
      $("e-upload").textContent = res.error;
      return;
    }
    resetUpload();
    setImage(res.image.src); // lưu xong tự chọn luôn ảnh này
    UI.toast("Đã lưu ảnh \"" + res.image.name + "\" vào lựa chọn.");
  });

  $("search").addEventListener(
    "input",
    UI.debounce((e) => {
      state.search = e.target.value;
      state.page = 1;
      render();
    }, 200)
  );
  $("filter-category").addEventListener("change", (e) => {
    state.category = e.target.value;
    state.page = 1;
    render();
  });
  $("status-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-status]");
    if (!tab) return;
    state.status = tab.dataset.status;
    state.page = 1;
    render();
  });
  [["view-table", "table"], ["view-card", "card"]].forEach(([id, view]) => {
    $(id).addEventListener("click", () => {
      state.view = view;
      state.page = 1;
      localStorage.setItem(VIEW_KEY, view);
      render();
    });
  });

  // Các nút trong bảng / thẻ (dùng 1 listener cho cả vùng - "event delegation")
  listArea.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.dataset.action === "edit") openForm(id);
    if (btn.dataset.action === "assign") openAssign(id);
  });

  listArea.addEventListener("change", (e) => {
    if (e.target.dataset.action !== "toggle") return;
    const status = e.target.checked ? "active" : "hidden";
    Store.setCourseStatus(e.target.dataset.id, status);
    UI.toast(status === "active" ? "Khóa học đã hiển thị trên website." : "Khóa học đã được ẩn khỏi các trang chính.");
    render();
  });

  fillSelects();
  render();

  // Đọc lại file HTML của website: khối khóa học thêm / sửa / xóa trong HTML thì danh sách ở đây tự cập nhật
  SiteSync.run().then((r) => {
    if (!r.changed) return;
    fillSelects();
    render();
    UI.toast(SiteSync.describe(r), "info");
  });
}

initCoursePage();
