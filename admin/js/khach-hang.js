/* =========================================================
   khach-hang.js - Trang "Học viên & tài khoản" của admin
   Chức năng: danh sách, tìm kiếm, lọc theo trạng thái và quyền,
   xem chi tiết (khóa học đã mua, lịch sử đơn), vô hiệu hóa / kích hoạt,
   THÊM TÀI KHOẢN với quyền tùy chọn (khách hàng / giảng viên / admin)
   và ĐỔI QUYỀN cho tài khoản đã có.
   QUY TẮC: không xóa tài khoản, chỉ vô hiệu hóa để giữ lịch sử đơn hàng.

   Mỗi dòng trong bảng là 1 "row" gộp từ 2 nguồn:
     - Store "students"      : hồ sơ học viên (mã HV001...) - có thể là dữ liệu mẫu chưa có tài khoản
     - AuthStore accounts    : tài khoản đăng nhập (có quyền). Giảng viên / admin không có
                               hồ sơ học viên nên được thêm vào bảng với mã TK001...
   ========================================================= */
function initStudentPage() {
  const $ = (id) => document.getElementById(id);

  // Chỉ admin mới được dùng trang này (nếu mở trực tiếp bằng đường dẫn)
  if (!AuthStore.isAdmin()) {
    document.querySelector(".page").innerHTML =
      '<div class="no-access"><i class="fa-solid fa-user-lock"></i><h2>Bạn không có quyền truy cập</h2><p>Vui lòng đăng nhập bằng tài khoản admin.</p></div>';
    return;
  }
  const me = AuthStore.currentUser();

  const state = { search: "", status: "all", role: "all", page: 1 };
  const PAGE_SIZE = 10;
  const CREATE_FIELDS = ["fullName", "username", "email", "phone", "password"];
  const ROLE_BADGE = { customer: "badge-info", instructor: "badge-violet", admin: "badge-danger" };
  const ROLE_NOTE = {
    customer: "Khách hàng: mua khóa học, có mã khách hàng (HV...). Đăng nhập xong ở lại trang chủ.",
    instructor: "Giảng viên: đăng nhập xong được chuyển vào trang giảng viên (instructor).",
    admin: "Admin: toàn quyền, đăng nhập xong được chuyển vào trang quản trị này.",
  };

  const isMe = (row) => !!row.account && row.account.usernameKey === me.username.toLowerCase();

  /* ---------- Gộp dữ liệu thành các dòng ---------- */
  function buildRows() {
    const accounts = AuthStore.getAccounts();
    const rows = [];
    Store.get("students").forEach((s) => {
      const acc = accounts.find((a) => a.studentId === s.id) || null;
      rows.push({
        key: s.id,
        code: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        createdAt: s.createdAt,
        status: s.status === "disabled" || (acc && AuthStore.isDisabled(acc)) ? "disabled" : "active",
        studentId: s.id,
        account: acc,
        role: acc ? AuthStore.roleOf(acc) : "customer",
      });
    });
    accounts
      .filter((a) => !a.studentId)
      .forEach((a) => {
        rows.push({
          key: "TK:" + a.usernameKey,
          code: a.code || "—",
          name: a.fullName,
          email: a.email,
          phone: a.phone,
          createdAt: a.createdAt,
          status: AuthStore.isDisabled(a) ? "disabled" : "active",
          studentId: "",
          account: a,
          role: AuthStore.roleOf(a),
        });
      });
    return rows;
  }

  function findRow(key) {
    return buildRows().find((r) => r.key === key);
  }

  // Thống kê mua hàng của từng học viên (chỉ đơn hoàn thành)
  function getBuyStats() {
    const map = {};
    Store.completedOrders().forEach((o) => {
      if (!map[o.studentId]) map[o.studentId] = { courses: 0, spent: 0 };
      map[o.studentId].courses += o.items.length;
      map[o.studentId].spent += o.total;
    });
    return map;
  }

  function getFiltered() {
    let list = buildRows();
    if (state.status !== "all") list = list.filter((r) => r.status === state.status);
    if (state.role !== "all") list = list.filter((r) => r.role === state.role);
    const kw = UI.normalize(state.search);
    if (kw) {
      list = list.filter((r) => UI.normalize(r.code + " " + r.name + " " + r.email + " " + r.phone + " " + (r.account ? r.account.username : "")).includes(kw));
    }
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // mới nhất trước
  }

  /* ---------- Thống kê + tab trạng thái ---------- */
  function renderStats() {
    const all = buildRows();
    const count = (fn) => all.filter(fn).length;
    const cards = [
      { icon: "fa-users", color: "ic-blue", label: "Tổng tài khoản", value: all.length },
      { icon: "fa-user-graduate", color: "ic-green", label: "Khách hàng", value: count((r) => r.role === "customer") },
      { icon: "fa-chalkboard-user", color: "ic-violet", label: "Giảng viên", value: count((r) => r.role === "instructor") },
      { icon: "fa-user-shield", color: "ic-red", label: "Admin", value: count((r) => r.role === "admin") },
    ];
    $("stat-grid").innerHTML = cards
      .map((c) => '<div class="stat-card"><div class="stat-icon ' + c.color + '"><i class="fa-solid ' + c.icon + '"></i></div><div><div class="stat-label">' + c.label + '</div><div class="stat-value">' + c.value + "</div></div></div>")
      .join("");

    // Các tab trạng thái đếm theo QUYỀN đang lọc (chọn "Giảng viên" thì chỉ đếm giảng viên)
    const scoped = state.role === "all" ? all : all.filter((r) => r.role === state.role);
    const scopedCount = (fn) => scoped.filter(fn).length;
    const tabs = [
      { key: "all", label: "Tất cả", count: scoped.length },
      { key: "active", label: "Hoạt động", count: scopedCount((r) => r.status === "active") },
      { key: "disabled", label: "Đã vô hiệu hóa", count: scopedCount((r) => r.status === "disabled") },
    ];
    $("status-tabs").innerHTML = tabs
      .map((t) => '<button class="tab ' + (state.status === t.key ? "active" : "") + '" data-status="' + t.key + '">' + t.label + '<span class="count">' + t.count + "</span></button>")
      .join("");
  }

  function statusBadge(r) {
    return r.status === "active" ? '<span class="badge badge-success">Hoạt động</span>' : '<span class="badge badge-danger">Đã vô hiệu hóa</span>';
  }

  function roleBadge(r) {
    return '<span class="badge ' + ROLE_BADGE[r.role] + '">' + AuthStore.roleLabel(r.role) + "</span>";
  }

  /* ---------- Bảng danh sách ---------- */
  function render() {
    renderStats();
    const list = getFiltered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const items = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    if (list.length === 0) {
      $("list-area").innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-slash"></i><h3>Không tìm thấy tài khoản</h3><p>Hãy thử đổi từ khóa hoặc bộ lọc.</p></div>';
    } else {
      const stats = getBuyStats();
      $("list-area").innerHTML =
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Mã</th><th>Người dùng</th><th>Quyền</th><th>Ngày tạo</th><th class="num">Khóa đã mua</th><th class="num">Tổng chi tiêu</th><th>Trạng thái</th><th class="num">Thao tác</th></tr></thead><tbody>' +
        items
          .map((r) => {
            const st = stats[r.studentId] || { courses: 0, spent: 0 };
            const off = r.status !== "active";
            const self = isMe(r);
            const username = r.account ? "@" + r.account.username : "Chưa có tài khoản đăng nhập";
            const roleBtn = r.account && !self ? '<button class="icon-btn" title="Đổi quyền" data-role="' + r.key + '"><i class="fa-solid fa-user-gear"></i></button>' : "";
            const lockBtn = self
              ? ""
              : off
                ? '<button class="icon-btn success" title="Kích hoạt lại" data-toggle="' + r.key + '"><i class="fa-solid fa-lock-open"></i></button>'
                : '<button class="icon-btn danger" title="Vô hiệu hóa" data-toggle="' + r.key + '"><i class="fa-solid fa-user-lock"></i></button>';
            return (
              '<tr class="' + (off ? "row-off" : "") + '"><td><b>' + UI.esc(r.code) + "</b></td>" +
              '<td><div class="user-cell"><span class="avatar ' + (off ? "off" : "") + '">' + UI.esc(UI.initials(r.name)) + '</span><div><div class="cell-title">' + UI.esc(r.name) + (self ? '<span class="me-tag">Bạn</span>' : "") +
              '</div><div class="cell-sub">' + UI.esc(r.email) + '</div><div class="cell-user-name">' + UI.esc(username) + "</div></div></div></td>" +
              "<td>" + roleBadge(r) + "</td>" +
              "<td>" + UI.date(r.createdAt) + '</td><td class="num">' + st.courses + '</td><td class="num price">' + UI.money(st.spent) + "</td>" +
              "<td>" + statusBadge(r) + "</td>" +
              '<td class="actions"><button class="icon-btn" title="Xem chi tiết" data-detail="' + r.key + '"><i class="fa-regular fa-eye"></i></button>' +
              roleBtn + lockBtn + "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>";
    }
    UI.pager($("pager"), list.length, state.page, PAGE_SIZE, (p) => {
      state.page = p;
      render();
    });
  }

  /* ---------- Chi tiết ---------- */
  // Đợt học của 1 khóa đã mua: "Đợt 1 (giảng viên)" hoặc "Chưa phân đợt"
  function classText(it) {
    const rec = Store.classOf(it.orderId, it.courseId);
    const batch = rec ? Store.getBatch(rec.batchId) : null;
    if (!batch) return '<span class="badge badge-warning no-dot">Chưa phân đợt</span>';
    const acc = AuthStore.getAccounts().find((a) => a.usernameKey === batch.instructor);
    return UI.esc(batch.name) + '<div class="cell-sub">' + UI.esc(acc ? acc.fullName : batch.instructor) + "</div>";
  }

  function openDetail(key) {
    const r = findRow(key);
    if (!r) return;
    const orders = r.studentId ? Store.ordersOfStudent(r.studentId) : [];
    const purchased = r.studentId ? Store.purchasedCourses(r.studentId) : [];
    const spent = Store.sumTotal(Store.completedOrders(orders));

    $("detail-title").innerHTML = "Tài khoản " + UI.esc(r.code) + " " + statusBadge(r);

    let buyHtml = "";
    if (r.studentId) {
      const purchasedHtml =
        purchased.length === 0
          ? '<div class="text-muted" style="padding: 8px 0">Chưa mua khóa học nào (đơn hoàn thành).</div>'
          : '<table class="mini-table"><thead><tr><th>Khóa học</th><th>Đơn</th><th>Ngày mua</th><th>Đợt học</th><th class="num">Giá</th></tr></thead><tbody>' +
            purchased.map((it) => "<tr><td><b>" + UI.esc(it.name) + "</b></td><td>" + it.orderId + "</td><td>" + UI.date(it.date) + "</td><td>" + classText(it) + '</td><td class="num">' + UI.money(it.price) + "</td></tr>").join("") +
            "</tbody></table>";
      const ordersHtml =
        orders.length === 0
          ? ""
          : '<h4 class="section-title">Lịch sử đơn hàng (' + orders.length + ')</h4><table class="mini-table"><thead><tr><th>Mã đơn</th><th>Ngày đặt</th><th>Thanh toán</th><th class="num">Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>' +
            orders.map((o) => "<tr><td><b>" + o.id + "</b></td><td>" + UI.date(o.createdAt) + "</td><td>" + UI.esc(o.payment) + '</td><td class="num">' + UI.money(o.total) + "</td><td>" + UI.orderBadge(o.status) + "</td></tr>").join("") +
            "</tbody></table>";
      buyHtml =
        '<div class="info-grid" style="grid-template-columns: repeat(3, 1fr)">' +
        '<div class="info-box"><h4>Ngày tạo</h4><b>' + UI.date(r.createdAt) + "</b></div>" +
        '<div class="info-box"><h4>Khóa đã mua</h4><b>' + purchased.length + " khóa học</b></div>" +
        '<div class="info-box"><h4>Tổng chi tiêu</h4><b>' + UI.money(spent) + "</b></div></div>" +
        '<h4 class="section-title" style="margin-top:0">Khóa học đã mua</h4>' + purchasedHtml + ordersHtml;
    } else {
      buyHtml = '<div class="info-grid" style="grid-template-columns: repeat(2, 1fr)"><div class="info-box"><h4>Ngày tạo</h4><b>' + UI.date(r.createdAt) +
        '</b></div><div class="info-box"><h4>Mua hàng</h4><b>Không áp dụng</b></div></div><div class="text-muted">Tài khoản ' + AuthStore.roleLabel(r.role).toLowerCase() + " không có hồ sơ học viên nên không có lịch sử mua khóa học.</div>";
    }

    const accountInfo = r.account
      ? '<div class="info-box"><h4>Tài khoản đăng nhập</h4><b>' + UI.esc(r.account.username) + "</b></div>"
      : '<div class="info-box"><h4>Tài khoản đăng nhập</h4><b>Chưa có (dữ liệu mẫu)</b></div>';

    $("detail-body").innerHTML =
      '<div class="user-cell" style="margin-bottom: 18px"><span class="avatar lg ' + (r.status !== "active" ? "off" : "") + '">' + UI.esc(UI.initials(r.name)) + "</span>" +
      '<div><h3 style="font-size:20px">' + UI.esc(r.name) + " " + roleBadge(r) + '</h3><div class="text-muted"><i class="fa-regular fa-envelope"></i> ' + UI.esc(r.email) +
      (r.phone ? ' &nbsp; <i class="fa-solid fa-phone"></i> ' + UI.esc(r.phone) : "") + "</div></div></div>" +
      '<div class="info-grid" style="grid-template-columns: repeat(2, 1fr); margin-bottom: 14px">' + accountInfo +
      '<div class="info-box"><h4>Quyền</h4><b>' + AuthStore.roleLabel(r.role) + "</b></div></div>" + buyHtml;

    const self = isMe(r);
    $("detail-footer").innerHTML =
      (self
        ? ""
        : '<button class="btn ' + (r.status === "active" ? "btn-outline" : "btn-success") + '" id="btn-toggle" data-key="' + r.key + '">' +
          (r.status === "active" ? '<i class="fa-solid fa-user-lock"></i> Vô hiệu hóa tài khoản' : '<i class="fa-solid fa-lock-open"></i> Kích hoạt lại') + "</button>") +
      '<span class="spacer"></span><button class="btn btn-primary" data-close>Đóng</button>';
    // Nút "Đóng" được tạo động nên cần gắn lại sự kiện
    $("detail-footer").querySelector("[data-close]").addEventListener("click", () => UI.closeModal("detail-modal"));

    UI.openModal("detail-modal");
  }

  /* ---------- Vô hiệu hóa / kích hoạt ---------- */
  async function toggleStatus(key) {
    const r = findRow(key);
    if (!r) return false;
    const disabling = r.status === "active";
    if (disabling) {
      const yes = await UI.confirm({
        title: "Vô hiệu hóa tài khoản?",
        message: "Tài khoản <b>" + UI.esc(r.name) + "</b> sẽ bị khóa và không đăng nhập được. Lịch sử đơn hàng vẫn được giữ nguyên và bạn có thể kích hoạt lại bất cứ lúc nào.",
        okText: "Vô hiệu hóa",
        danger: true,
      });
      if (!yes) return false;
    }
    if (r.account) {
      const res = AuthStore.setDisabled(r.account.username, disabling);
      if (!res.ok) {
        UI.toast(res.error, "error");
        return false;
      }
    } else {
      Store.setStudentStatus(r.studentId, disabling ? "disabled" : "active"); // học viên mẫu chưa có tài khoản
    }
    UI.toast(disabling ? "Đã vô hiệu hóa tài khoản " + r.code + "." : "Đã kích hoạt lại tài khoản " + r.code + ".", disabling ? "info" : "success");
    return true;
  }

  /* ---------- Thêm tài khoản ---------- */
  function updateRoleNote() {
    $("role-note").innerHTML = '<i class="fa-solid fa-circle-info"></i><span>' + ROLE_NOTE[$("f-role").value] + "</span>";
  }

  function openCreate() {
    $("create-form").reset();
    $("f-role").value = "instructor"; // admin thường tạo tài khoản giảng viên nhất
    $("f-password").type = "password";
    $("pw-eye").innerHTML = '<i class="fa-regular fa-eye"></i>';
    UI.clearErrors(CREATE_FIELDS);
    updateRoleNote();
    UI.openModal("create-modal");
    $("f-fullName").focus();
  }

  function saveCreate() {
    UI.clearErrors(CREATE_FIELDS);
    const res = AuthStore.createAccount({
      role: $("f-role").value,
      fullName: $("f-fullName").value,
      username: $("f-username").value,
      email: $("f-email").value,
      phone: $("f-phone").value,
      password: $("f-password").value,
    });
    if (!res.ok) {
      if (res.errors) UI.showErrors(res.errors, CREATE_FIELDS);
      else UI.toast(res.error, "error");
      return;
    }
    UI.closeModal("create-modal");
    UI.toast("Đã tạo tài khoản " + AuthStore.roleLabel(res.account.role).toLowerCase() + " \"" + res.account.username + "\".");
    state.page = 1;
    render();
  }

  /* ---------- Đổi quyền ---------- */
  let roleTarget = null;

  function openRoleModal(key) {
    const r = findRow(key);
    if (!r || !r.account) return;
    roleTarget = r.account.username;
    $("role-body").innerHTML =
      '<div class="user-cell" style="margin-bottom:14px"><span class="avatar">' + UI.esc(UI.initials(r.name)) + "</span><div><div class=\"cell-title\">" + UI.esc(r.name) +
      '</div><div class="cell-sub">@' + UI.esc(r.account.username) + " · " + UI.esc(r.code) + "</div></div></div>" +
      '<div class="form-group"><label for="role-select">Quyền mới</label><select id="role-select">' +
      Object.keys(AUTH_ROLES).map((k) => '<option value="' + k + '"' + (k === r.role ? " selected" : "") + ">" + AUTH_ROLES[k] + "</option>").join("") +
      '</select></div><div class="role-note" id="role-select-note"></div>';
    const sel = $("role-select");
    const note = () => ($("role-select-note").innerHTML = '<i class="fa-solid fa-circle-info"></i><span>' + ROLE_NOTE[sel.value] + "</span>");
    sel.addEventListener("change", note);
    note();
    UI.openModal("role-modal");
  }

  function saveRole() {
    const role = $("role-select").value;
    const res = AuthStore.setRole(roleTarget, role);
    if (!res.ok) {
      UI.toast(res.error, "error");
      return;
    }
    UI.closeModal("role-modal");
    UI.toast("Đã đổi quyền của \"" + roleTarget + "\" thành " + AuthStore.roleLabel(role) + ".");
    render();
  }

  /* ---------- Sự kiện ---------- */
  $("search").addEventListener(
    "input",
    UI.debounce((e) => {
      state.search = e.target.value;
      state.page = 1;
      render();
    }, 200)
  );
  $("role-filter").addEventListener("change", (e) => {
    state.role = e.target.value;
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
  $("list-area").addEventListener("click", async (e) => {
    const detail = e.target.closest("[data-detail]");
    if (detail) return openDetail(detail.dataset.detail);
    const role = e.target.closest("[data-role]");
    if (role) return openRoleModal(role.dataset.role);
    const toggle = e.target.closest("[data-toggle]");
    if (toggle && (await toggleStatus(toggle.dataset.toggle))) render();
  });
  $("detail-footer").addEventListener("click", async (e) => {
    const btn = e.target.closest("#btn-toggle");
    if (!btn) return;
    const key = btn.dataset.key;
    if (await toggleStatus(key)) {
      openDetail(key);
      render();
    }
  });
  $("btn-create").addEventListener("click", openCreate);
  $("btn-save-create").addEventListener("click", saveCreate);
  $("create-form").addEventListener("submit", (e) => e.preventDefault());
  $("create-form").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveCreate();
    }
  });
  $("f-role").addEventListener("change", updateRoleNote);
  $("btn-save-role").addEventListener("click", saveRole);
  $("pw-eye").addEventListener("click", () => {
    const input = $("f-password");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    input.classList.toggle("pw-visible", show);
    $("pw-eye").innerHTML = '<i class="fa-regular ' + (show ? "fa-eye-slash" : "fa-eye") + '"></i>';
  });

  render();
}

initStudentPage();
