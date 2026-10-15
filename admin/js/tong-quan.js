/* =========================================================
   tong-quan.js - Trang "Tổng quan"
   Mọi số liệu lấy từ cùng nguồn dữ liệu với các trang quản lý
   (Store) nên luôn thống nhất với trang Khóa học, Đơn hàng...
   ========================================================= */
function initDashboard() {
  const $ = (id) => document.getElementById(id);

  const courses = Store.getCourses(false); // chỉ khóa học chưa xóa
  const students = Store.get("students");
  const orders = Store.get("orders");
  const completed = Store.completedOrders(orders);
  const revenue = Store.sumTotal(completed); // chỉ tính đơn hoàn thành
  const unassigned = Store.unassignedItems(); // lượt mua chưa được phân lớp

  // Ngày hôm nay
  $("today-text").textContent =
    "Hôm nay là " + new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) + ". Chúc bạn một ngày làm việc hiệu quả!";

  // Cảnh báo học viên đã mua nhưng chưa được phân vào lớp giảng viên
  if (unassigned.length > 0) {
    $("pending-alert").innerHTML =
      '<div class="alert-bar"><i class="fa-solid fa-bell"></i><span>Có <b>' + unassigned.length +
      ' lượt mua khóa học</b> chưa được phân vào đợt học.</span><a href="don-hang.html?status=unassigned">Phân đợt ngay</a></div>';
  }

  /* ---------- 4 thẻ thống kê ---------- */
  const cards = [
    { icon: "fa-book-open", color: "ic-blue", label: "Tổng số khóa học", value: courses.length, sub: courses.filter((c) => c.status === "active").length + " đang hiển thị" },
    { icon: "fa-user-graduate", color: "ic-green", label: "Học viên đã đăng ký", value: students.length, sub: students.filter((s) => s.status === "active").length + " đang hoạt động" },
    { icon: "fa-cart-shopping", color: "ic-amber", label: "Tổng số đơn hàng", value: orders.length, sub: unassigned.length + " chờ phân đợt · " + orders.filter((o) => o.status === "cancelled").length + " đã hủy" },
    { icon: "fa-sack-dollar", color: "ic-violet", label: "Doanh thu (mô phỏng)", value: UI.money(revenue), money: true, sub: "Từ " + completed.length + " đơn hoàn thành" },
  ];
  $("stat-grid").innerHTML = cards
    .map((c) => {
      return (
        '<div class="stat-card"><div class="stat-icon ' + c.color + '"><i class="fa-solid ' + c.icon + '"></i></div><div>' +
        '<div class="stat-label">' + c.label + '</div><div class="stat-value ' + (c.money ? "money" : "") + '">' + c.value + "</div>" +
        '<div class="stat-sub">' + c.sub + "</div></div></div>"
      );
    })
    .join("");

  /* ---------- Đơn hàng gần đây (5 đơn mới nhất) ---------- */
  const recent = orders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  if (recent.length === 0) {
    $("recent-orders").innerHTML = '<div class="empty-state"><i class="fa-solid fa-receipt"></i><h3>Chưa có đơn hàng</h3></div>';
  } else {
    $("recent-orders").innerHTML =
      '<table class="data-table" style="min-width: 520px"><thead><tr><th>Mã đơn</th><th>Học viên</th><th class="num">Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>' +
      recent
        .map((o) => {
          return (
            "<tr><td><b>" + o.id + '</b><div class="cell-sub">' + UI.date(o.createdAt) + "</div></td>" +
            '<td><div class="cell-title">' + UI.esc(o.studentName) + '</div><div class="cell-sub">' + UI.esc(o.items[0].name) + (o.items.length > 1 ? " +" + (o.items.length - 1) : "") + "</div></td>" +
            '<td class="num price">' + UI.money(o.total) + "</td><td>" + UI.orderBadge(o.status) + "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>";
  }

  /* ---------- Khóa học nổi bật = bán chạy nhất (đơn hoàn thành) ---------- */
  const top = Store.courseSales(completed).slice(0, 5);
  if (top.length === 0) {
    $("top-courses").innerHTML = '<div class="empty-state"><i class="fa-solid fa-trophy"></i><h3>Chưa có dữ liệu bán hàng</h3></div>';
  } else {
    $("top-courses").innerHTML = top
      .map((c, i) => {
        return (
          '<li class="rank-item"><span class="rank-num">' + (i + 1) + "</span>" +
          '<img class="thumb" src="' + UI.esc(UI.img(c.image)) + '" alt="">' +
          '<div class="rank-info"><div class="cell-title" title="' + UI.esc(c.name) + '">' + UI.esc(c.name) + '</div><div class="cell-sub">' + UI.esc(c.categoryName) + "</div></div>" +
          '<div class="rank-value">' + c.count + " lượt<small>" + UI.money(c.revenue) + "</small></div></li>"
        );
      })
      .join("");
  }
}

initDashboard();

// Đồng bộ khóa học từ file HTML của website; có thay đổi thì tải lại 1 lần để số liệu khớp
SiteSync.run().then((r) => {
  if (r.changed) location.reload();
});
