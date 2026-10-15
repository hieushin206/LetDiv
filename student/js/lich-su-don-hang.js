/* =========================================================
   lich-su-don-hang.js - Trang "Lịch sử đơn hàng" (học viên)
   Chỉ hiện đơn của học viên đang đăng nhập: tìm theo mã, lọc theo trạng thái, xem chi tiết.
   QUY TẮC: chỉ đơn "Hoàn thành" mới cấp quyền học - đơn đã hủy thì không.
   Đồ án không có cổng thanh toán thật và không lưu thông tin thẻ.
   ========================================================= */
function initOrderHistoryPage() {
  const user = SUI.requireStudent();
  if (!user) return;
  SUI.notifyNav("lich-su-don-hang.html");
  const $ = (id) => document.getElementById(id);
  const sid = user.studentId;
  const state = { tab: "all", search: "", page: 1 };
  const PAGE_SIZE = 8;

  const orders = Store.ordersOfStudent(sid); // mới nhất trước
  if (orders.length === 0) {
    $("main-card").innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-receipt"></i><h3>Bạn chưa có đơn hàng nào</h3><p>Hãy chọn khóa học, thêm vào giỏ và thanh toán để bắt đầu học.</p><a class="btn btn-primary" style="margin-top:12px" href="/courses/course.html" target="_top">Đến cửa hàng</a></div>';
    return;
  }

  const TABS = [{ key: "all", label: "Tất cả" }].concat(Object.keys(ORDER_STATUS).map((k) => ({ key: k, label: ORDER_STATUS[k] })));

  function render() {
    $("tabs").innerHTML = TABS.map((t) => '<button class="tab ' + (state.tab === t.key ? "active" : "") + '" data-tab="' + t.key + '">' + t.label + '<span class="count">' + (t.key === "all" ? orders.length : orders.filter((o) => o.status === t.key).length) + "</span></button>").join("");

    let list = orders;
    if (state.tab !== "all") list = list.filter((o) => o.status === state.tab);
    const kw = state.search.trim().toLowerCase();
    if (kw) list = list.filter((o) => o.id.toLowerCase().includes(kw));
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const items = list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    $("list-area").innerHTML = items.length
      ? '<div class="table-wrap"><table class="data-table" style="min-width: 960px"><thead><tr><th>Mã đơn</th><th>Ngày đặt</th><th>Khóa học</th><th class="num">Tổng tiền</th><th>Mã giảm giá</th><th>Thanh toán</th><th>Trạng thái</th><th class="num">Chi tiết</th></tr></thead><tbody>' +
        items
          .map(
            (o) =>
              "<tr><td><b>" + o.id + "</b></td><td>" + UI.date(o.createdAt) + '<div class="cell-sub">' + UI.time(o.createdAt) + "</div></td>" +
              '<td style="max-width:260px"><div>' + UI.esc(o.items[0].name) + "</div>" + (o.items.length > 1 ? '<div class="cell-sub">+ ' + (o.items.length - 1) + " khóa học khác</div>" : "") + "</td>" +
              '<td class="num"><div class="price">' + UI.money(o.total) + "</div>" + (o.discount ? '<div class="cell-sub text-discount">Giảm ' + UI.money(o.discount) + "</div>" : "") + "</td>" +
              "<td>" + (o.promoCode ? '<span class="promo-code" style="font-size:12px;padding:2px 8px">' + UI.esc(o.promoCode) + "</span>" : '<span class="text-muted">—</span>') + "</td>" +
              "<td>" + UI.esc(o.payment) + "</td><td>" + UI.orderBadge(o.status) + '</td><td class="actions"><button class="btn btn-outline btn-sm" data-open="' + o.id + '">Xem</button></td></tr>'
          )
          .join("") +
        "</tbody></table></div>"
      : '<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><h3>Không tìm thấy đơn hàng</h3><p>Hãy thử đổi mã đơn hoặc trạng thái.</p></div>';
    UI.pager($("pager"), list.length, state.page, PAGE_SIZE, (p) => {
      state.page = p;
      render();
    });
  }

  function openOrder(id) {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    $("order-title").innerHTML = "Đơn hàng " + o.id + " " + UI.orderBadge(o.status);
    const hint = {
      completed: "Đơn đã thanh toán thành công — bạn có thể vào học các khóa học bên dưới.",
      cancelled: "Đơn đã hủy nên không được cấp quyền học.",
    }[o.status];
    $("order-body").innerHTML =
      '<div class="info-grid"><div class="info-box"><h4>Thông tin đơn hàng</h4>' +
      '<div class="info-line"><span>Mã đơn hàng</span><span>' + o.id + "</span></div>" +
      '<div class="info-line"><span>Ngày đặt</span><span>' + UI.dateTime(o.createdAt) + "</span></div>" +
      '<div class="info-line"><span>Thanh toán</span><span>' + UI.esc(o.payment) + "</span></div>" +
      '<div class="info-line"><span>Mã giảm giá</span><span>' + (o.promoCode ? UI.esc(o.promoCode) : "Không dùng") + "</span></div></div>" +
      '<div class="info-box"><h4>Trạng thái</h4><div class="note" style="margin-bottom:8px"><i class="fa-solid fa-circle-info"></i><span>' + hint + "</span></div>" +
      '<ul class="timeline">' + o.history.map((h) => '<li class="t-' + h.status + '"><b>' + ORDER_STATUS[h.status] + '</b><div class="t-time">' + UI.dateTime(h.at) + "</div></li>").join("") + "</ul></div></div>" +
      '<h4 class="section-title" style="margin-top:0">Khóa học trong đơn</h4>' +
      '<table class="mini-table"><thead><tr><th>Khóa học</th><th>Giảng viên</th><th class="num">Giá</th>' + (o.status === "completed" ? '<th class="num"></th>' : "") + "</tr></thead><tbody>" +
      o.items
        .map(
          (it) =>
            "<tr><td><b>" + UI.esc(it.name) + "</b></td><td>" + UI.esc(o.status === "completed" ? StudentStore.instructorLabel(o.studentId, it.courseId) : it.instructor || "—") + '</td><td class="num">' + UI.money(it.price) + "</td>" +
            (o.status === "completed" ? '<td class="num"><a class="btn btn-primary btn-sm" href="' + StudentStore.learnUrl(it.courseId) + '"><i class="fa-solid fa-play"></i> Vào học</a></td>' : "") + "</tr>"
        )
        .join("") +
      "</tbody></table>" +
      '<div class="total-box"><div class="info-line"><span>Tạm tính</span><span>' + UI.money(o.subtotal) + "</span></div>" +
      '<div class="info-line"><span>Giảm giá</span><span class="text-discount">- ' + UI.money(o.discount) + "</span></div>" +
      '<div class="info-line grand"><span style="color:inherit;font-weight:700">Tổng thanh toán</span><span>' + UI.money(o.total) + "</span></div></div>";
    UI.openModal("order-modal");
  }

  $("tabs").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (!t) return;
    state.tab = t.dataset.tab;
    state.page = 1;
    render();
  });
  $("search").addEventListener("input", UI.debounce((e) => { state.search = e.target.value; state.page = 1; render(); }, 200));
  $("list-area").addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) openOrder(b.dataset.open);
  });

  render();
}

initOrderHistoryPage();
