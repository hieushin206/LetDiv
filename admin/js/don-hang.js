/* =========================================================
   don-hang.js - Trang "Đơn hàng"
   Chức năng: danh sách + lọc (trạng thái, chưa phân đợt, ngày, từ khóa),
   xem chi tiết, PHÂN HỌC VIÊN VÀO ĐỢT HỌC (mỗi đợt có giảng viên + ngày học), hủy đơn.
   - Khách mua khóa học là thanh toán thành công ngay: đơn tự động "Hoàn thành"
     (không còn trạng thái "Chờ xác nhận", không tạo đơn thủ công ở đây).
   - Sau khi mua, admin chọn 1 ĐỢT HỌC của khóa (tạo ở trang "Đợt học") để đưa học viên vào.
     Giảng viên chỉ thấy học viên trong các đợt của mình; bài học / bài tập riêng từng đợt.
   Đơn hàng lưu SNAPSHOT tại thời điểm mua nên sửa/xóa khóa học
   hay đổi tên học viên về sau không làm sai lịch sử.
   ========================================================= */
function initOrderPage() {
  const $ = (id) => document.getElementById(id);
  const state = { status: "all", search: "", from: "", to: "", page: 1 };
  const PAGE_SIZE = 10;
  let openId = ""; // đơn đang mở trong cửa sổ chi tiết

  // Mở từ trang tổng quan: don-hang.html?status=unassigned
  const qs = new URLSearchParams(location.search).get("status");
  if (qs && (ORDER_STATUS[qs] || qs === "unassigned")) state.status = qs;

  // Tên hiển thị của giảng viên từ tên đăng nhập
  const accounts = AuthStore.getAccounts();
  function nameOf(username) {
    const a = accounts.find((x) => x.usernameKey === username);
    return a ? a.fullName : username;
  }

  // Chuỗi ISO -> "YYYY-MM-DD" theo giờ địa phương (để so sánh với ô chọn ngày)
  function dayOf(iso) {
    const d = new Date(iso);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // Đơn hoàn thành còn khóa chưa được phân lớp
  function hasUnassigned(o) {
    return o.status === "completed" && o.items.some((it) => !Store.classOf(o.id, it.courseId));
  }

  /* ---------- Danh sách ---------- */
  function getFiltered() {
    let list = Store.get("orders");
    if (state.status === "unassigned") list = list.filter(hasUnassigned);
    else if (state.status !== "all") list = list.filter((o) => o.status === state.status);
    const kw = UI.normalize(state.search);
    if (kw) {
      list = list.filter((o) => {
        const text = o.id + " " + o.studentName + " " + o.studentEmail + " " + o.items.map((i) => i.name).join(" ");
        return UI.normalize(text).includes(kw);
      });
    }
    if (state.from) list = list.filter((o) => dayOf(o.createdAt) >= state.from);
    if (state.to) list = list.filter((o) => dayOf(o.createdAt) <= state.to);
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function renderTabs() {
    const all = Store.get("orders");
    const tabs = [{ key: "all", label: "Tất cả", count: all.length }]
      .concat(Object.keys(ORDER_STATUS).map((k) => ({ key: k, label: ORDER_STATUS[k], count: all.filter((o) => o.status === k).length })))
      .concat([{ key: "unassigned", label: "Chưa phân đợt", count: all.filter(hasUnassigned).length }]);
    $("status-tabs").innerHTML = tabs
      .map((t) => '<button class="tab ' + (state.status === t.key ? "active" : "") + '" data-status="' + t.key + '">' + t.label + '<span class="count">' + t.count + "</span></button>")
      .join("");
  }

  // Ô "Lớp học" trong bảng
  function classBadge(o) {
    if (o.status !== "completed") return '<span class="text-muted">—</span>';
    const done = o.items.filter((it) => Store.classOf(o.id, it.courseId)).length;
    if (done === o.items.length) return '<span class="badge badge-success">Đã phân đợt</span>';
    return '<span class="badge badge-warning">' + (done === 0 ? "Chưa phân đợt" : "Phân đợt " + done + "/" + o.items.length) + "</span>";
  }

  function render() {
    renderTabs();
    const list = getFiltered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const items = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    if (list.length === 0) {
      $("list-area").innerHTML = '<div class="empty-state"><i class="fa-solid fa-receipt"></i><h3>Không có đơn hàng phù hợp</h3><p>Hãy thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p></div>';
    } else {
      $("list-area").innerHTML =
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Mã đơn</th><th>Học viên</th><th>Khóa học</th><th>Ngày đặt</th><th class="num">Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th><th>Đợt học</th><th class="num">Chi tiết</th></tr></thead><tbody>' +
        items
          .map((o) => {
            const first = UI.esc(o.items[0].name);
            const more = o.items.length > 1 ? '<div class="cell-sub">+ ' + (o.items.length - 1) + " khóa học khác</div>" : "";
            const promo = o.promoCode ? '<div class="cell-sub text-discount"><i class="fa-solid fa-ticket"></i> ' + UI.esc(o.promoCode) + "</div>" : "";
            return (
              '<tr><td><b>' + o.id + "</b></td>" +
              '<td><div class="cell-title">' + UI.esc(o.studentName) + '</div><div class="cell-sub">' + o.studentId + "</div></td>" +
              '<td style="max-width: 240px"><div>' + first + "</div>" + more + "</td>" +
              "<td>" + UI.date(o.createdAt) + '<div class="cell-sub">' + UI.time(o.createdAt) + "</div></td>" +
              '<td class="num"><div class="price">' + UI.money(o.total) + "</div>" + promo + "</td>" +
              '<td class="cell-sub" style="color:inherit">' + UI.esc(o.payment) + "</td>" +
              "<td>" + UI.orderBadge(o.status) + "</td>" +
              "<td>" + classBadge(o) + "</td>" +
              '<td class="actions"><button class="btn btn-outline btn-sm" data-detail="' + o.id + '"><i class="fa-regular fa-eye"></i> Xem</button></td></tr>'
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

  /* ---------- Chi tiết đơn hàng ---------- */
  // "2026-10-14" -> "14/10/2026"
  const fmtDay = (d) => (d ? d.split("-").reverse().join("/") : "—");

  // Nhãn 1 đợt: "Đợt 1 · Tùng ViO · 14/10/2026 - 14/04/2027"
  function batchLabel(b) {
    return b.name + " · " + nameOf(b.instructor) + " · " + fmtDay(b.startDate) + " - " + fmtDay(b.endDate);
  }

  // Ô phân đợt của 1 khóa học trong đơn
  function classCell(o, it, index) {
    if (o.status !== "completed") return '<span class="text-muted">—</span>';
    const rec = Store.classOf(o.id, it.courseId);
    const batches = Store.getBatches(it.courseId);
    if (batches.length === 0) {
      return '<span class="text-muted">Khóa học chưa có đợt học.<br>Hãy tạo ở trang <b>Đợt học</b>.</span>';
    }
    const cur = rec ? Store.getBatch(rec.batchId) : null;
    return (
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><select data-class-sel="' + index + '" style="min-width:230px;max-width:100%;width:auto">' +
      (cur ? "" : '<option value="">— Chọn đợt học —</option>') +
      batches.map((b) => '<option value="' + b.id + '"' + (cur && cur.id === b.id ? " selected" : "") + ">" + UI.esc(batchLabel(b)) + "</option>").join("") +
      '</select><button class="btn btn-primary btn-sm" data-assign="' + index + '"><i class="fa-solid fa-calendar-check"></i> ' + (cur ? "Đổi đợt" : "Phân đợt") + "</button></div>" +
      (cur
        ? '<div class="cell-sub" style="margin-top:4px"><i class="fa-solid fa-circle-check" style="color:#0b8f68"></i> Đang ở <b>' + UI.esc(cur.name) + "</b> (" + UI.esc(nameOf(cur.instructor)) + ") · " + UI.date(rec.assignedAt) + "</div>"
        : '<div class="cell-sub" style="margin-top:4px;color:#b57600">Chưa phân đợt</div>')
    );
  }

  function openDetail(id) {
    const o = Store.getOrder(id);
    if (!o) return;
    openId = id;
    $("detail-title").innerHTML = "Đơn hàng " + o.id + " " + UI.orderBadge(o.status);

    const student = Store.getStudent(o.studentId);
    const itemsHtml = o.items
      .map((it, i) => {
        return (
          "<tr><td>" + (i + 1) + "</td><td><b>" + UI.esc(it.name) + '</b><div class="cell-sub">' + UI.esc(it.categoryName || "—") + "</div></td>" +
          '<td class="num">' + UI.money(it.price) + "</td><td>" + classCell(o, it, i) + "</td></tr>"
        );
      })
      .join("");

    const historyHtml = o.history
      .map((h) => '<li class="t-' + h.status + '"><b>' + ORDER_STATUS[h.status] + '</b><div class="t-time">' + UI.dateTime(h.at) + "</div></li>")
      .join("");

    const canCancel = Store.allowedNextStatuses(o.status).includes("cancelled");
    const updateHtml = canCancel
      ? '<div class="status-update"><span class="label">Thao tác:</span><button class="btn btn-outline btn-sm" style="color:var(--color-seven)" id="btn-cancel-order" data-id="' + o.id + '"><i class="fa-solid fa-ban"></i> Hủy đơn hàng</button></div>'
      : '<div class="note" style="margin-top: 18px"><i class="fa-solid fa-lock"></i><span>Đơn hàng đã hủy là trạng thái cuối, không thể thay đổi.</span></div>';

    $("detail-body").innerHTML =
      '<div class="info-grid">' +
      '<div class="info-box"><h4>Học viên</h4>' +
      '<div class="info-line"><span>Họ tên</span><span>' + UI.esc(o.studentName) + "</span></div>" +
      '<div class="info-line"><span>Mã học viên</span><span>' + o.studentId + "</span></div>" +
      '<div class="info-line"><span>Email</span><span>' + UI.esc(o.studentEmail) + "</span></div>" +
      (student && student.status === "disabled" ? '<div class="info-line"><span>Tài khoản</span><span style="color:#e03131">Đã vô hiệu hóa</span></div>' : "") +
      "</div>" +
      '<div class="info-box"><h4>Thông tin đơn hàng</h4>' +
      '<div class="info-line"><span>Ngày đặt</span><span>' + UI.dateTime(o.createdAt) + "</span></div>" +
      '<div class="info-line"><span>Thanh toán</span><span>' + UI.esc(o.payment) + "</span></div>" +
      '<div class="info-line"><span>Mã khuyến mãi</span><span>' + (o.promoCode ? UI.esc(o.promoCode) : "Không dùng") + "</span></div>" +
      "</div></div>" +
      '<h4 class="section-title">Khóa học đã mua &amp; đợt học</h4>' +
      '<table class="mini-table"><thead><tr><th style="width:36px">#</th><th>Khóa học</th><th class="num">Giá lúc mua</th><th>Đợt học</th></tr></thead><tbody>' + itemsHtml + "</tbody></table>" +
      '<div class="total-box">' +
      '<div class="info-line"><span>Tạm tính</span><span>' + UI.money(o.subtotal) + "</span></div>" +
      '<div class="info-line"><span>Giảm giá' + (o.promoCode ? " (" + UI.esc(o.promoCode) + ")" : "") + '</span><span class="text-discount">- ' + UI.money(o.discount) + "</span></div>" +
      '<div class="info-line grand"><span style="color:inherit;font-weight:700">Tổng thanh toán</span><span>' + UI.money(o.total) + "</span></div></div>" +
      '<h4 class="section-title">Lịch sử trạng thái</h4><ul class="timeline">' + historyHtml + "</ul>" +
      updateHtml;

    UI.openModal("detail-modal");
  }

  $("detail-body").addEventListener("click", async (e) => {
    // --- Phân lớp / đổi lớp cho 1 khóa học trong đơn ---
    const assign = e.target.closest("[data-assign]");
    if (assign) {
      const o = Store.getOrder(openId);
      const it = o.items[Number(assign.dataset.assign)];
      const sel = $("detail-body").querySelector('[data-class-sel="' + assign.dataset.assign + '"]');
      const res = Store.assignClass(o.id, it.courseId, sel.value);
      if (!res.ok) return UI.toast(res.error, "error");
      UI.toast("Đã phân " + o.studentName + " vào " + Store.getBatch(sel.value).name + ".");
      openDetail(o.id); // vẽ lại chi tiết
      render(); // cập nhật danh sách + số "Chưa phân lớp"
      return;
    }

    // --- Hủy đơn hàng ---
    const cancel = e.target.closest("#btn-cancel-order");
    if (!cancel) return;
    const id = cancel.dataset.id;
    const yes = await UI.confirm({
      title: "Hủy đơn hàng " + id + "?",
      message: "Đơn hàng sẽ chuyển sang <b>Đã hủy</b>, không còn được tính vào doanh thu, học viên được gỡ khỏi đợt học và <b>không thể hoàn tác</b>.",
      okText: "Hủy đơn hàng",
      danger: true,
    });
    if (!yes) return;
    const res = Store.updateOrderStatus(id, "cancelled");
    if (!res.ok) return UI.toast(res.error, "error");
    UI.toast("Đã hủy đơn " + id + ".");
    openDetail(id);
    render();
  });

  /* ---------- Sự kiện bộ lọc ---------- */
  $("status-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-status]");
    if (!tab) return;
    state.status = tab.dataset.status;
    state.page = 1;
    render();
  });
  $("search").addEventListener(
    "input",
    UI.debounce((e) => {
      state.search = e.target.value;
      state.page = 1;
      render();
    }, 200)
  );
  $("date-from").addEventListener("change", (e) => {
    state.from = e.target.value;
    state.page = 1;
    render();
  });
  $("date-to").addEventListener("change", (e) => {
    state.to = e.target.value;
    state.page = 1;
    render();
  });
  $("btn-clear").addEventListener("click", () => {
    state.status = "all";
    state.search = state.from = state.to = "";
    state.page = 1;
    $("search").value = $("date-from").value = $("date-to").value = "";
    render();
  });
  $("list-area").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-detail]");
    if (btn) openDetail(btn.dataset.detail);
  });

  render();
}

initOrderPage();
