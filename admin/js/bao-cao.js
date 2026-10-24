/* =========================================================
   bao-cao.js - Trang "Báo cáo"
   Tất cả số liệu được TÍNH từ dữ liệu đơn hàng / học viên trong
   localStorage (không nhập tay). Doanh thu và lượt bán chỉ tính
   đơn HOÀN THÀNH. Biểu đồ vẽ bằng div + CSS, không cần thư viện.
   ========================================================= */
function initReportPage() {
  const $ = (id) => document.getElementById(id);

  // Rút gọn số tiền cho nhãn biểu đồ: 123.400.000 -> "123,4 tr"
  function shortMoney(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(".", ",") + " tỷ";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " tr";
    if (n >= 1e3) return Math.round(n / 1e3) + " k";
    return String(n);
  }

  // Vẽ biểu đồ cột: items = [{ label, value, text }]
  function drawBars(chartEl, labelEl, items, colorClass) {
    const max = Math.max(1, ...items.map((i) => i.value));
    chartEl.innerHTML = items
      .map((i) => '<div class="chart-col"><div class="chart-val">' + i.text + '</div><div class="chart-bar ' + (colorClass || "") + '" style="height:' + Math.round((i.value / max) * 85) + '%"></div></div>')
      .join("");
    labelEl.innerHTML = items.map((i) => "<span>" + i.label + "</span>").join("");
  }

  /* ---------- Bộ lọc ngày ---------- */
  const RANGE_MSG = "Ngày kết thúc không được nhỏ hơn ngày bắt đầu.";
  // Ô kết thúc có min = ngày bắt đầu; gõ tay sai thì báo lỗi và tự sửa lại cho hợp lệ
  const range = linkDateRange($("date-from"), $("date-to"), (msg) => {
    $("e-range").textContent = msg;
  }, () => render());

  // "YYYY-MM-DD" theo giờ địa phương từ chuỗi ISO / Date
  function dayStr(d) {
    d = new Date(d);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  const fmtDay = (s) => s.split("-").reverse().join("/");

  // Mặc định: từ ngày 1 của tháng cách đây 5 tháng đến hôm nay (= 6 tháng gần nhất)
  function setDefaultRange() {
    const now = new Date();
    $("date-from").value = dayStr(new Date(now.getFullYear(), now.getMonth() - 5, 1));
    $("date-to").value = dayStr(now);
    range.sync();
  }

  // Các cột của biểu đồ: theo NGÀY nếu khoảng lọc <= 31 ngày, ngược lại theo THÁNG
  function buildBuckets(from, to) {
    const a = parseDay(from);
    const b = parseDay(to);
    const days = Math.round((b - a) / 86400000) + 1;
    const list = [];
    if (days <= 31) {
      for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
        const k = dayStr(d);
        list.push({ key: k, label: k.slice(8) + "/" + k.slice(5, 7), unit: "day" });
      }
    } else {
      for (let d = new Date(a.getFullYear(), a.getMonth(), 1); d <= b; d.setMonth(d.getMonth() + 1)) {
        list.push({ key: monthKey(d), label: String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear(), unit: "month" });
      }
    }
    return list;
  }

  function render() {
    const from = $("date-from").value;
    const to = $("date-to").value;
    // Phải chọn đủ 2 ngày và ngày kết thúc không nhỏ hơn ngày bắt đầu
    let error = "";
    if (!from || !to) error = "Vui lòng chọn đủ ngày bắt đầu và ngày kết thúc.";
    else if (to < from) error = RANGE_MSG;
    $("e-range").textContent = error;
    if (error) return; // giữ nguyên số liệu của lần lọc hợp lệ gần nhất

    const months = buildBuckets(from, to); // mỗi phần tử = 1 cột biểu đồ (ngày hoặc tháng)
    const unit = months[0].unit;
    const unitName = unit === "day" ? "ngày" : "tháng";
    const bucketKey = unit === "day" ? (iso) => dayStr(iso) : (iso) => monthKey(iso);
    const keys = months.map((m) => m.key);
    const inRange = (iso) => {
      const d = dayStr(iso);
      return d >= from && d <= to;
    };
    $("revenue-title").textContent = "Doanh thu theo " + unitName + " (" + fmtDay(from) + " - " + fmtDay(to) + ")";

    // Chỉ lấy đơn / học viên nằm trong khoảng ngày đã chọn
    const orders = Store.get("orders").filter((o) => inRange(o.createdAt));
    const completed = Store.completedOrders(orders);
    const students = Store.get("students").filter((s) => inRange(s.createdAt));

    /* ----- 4 chỉ số tổng ----- */
    const revenue = Store.sumTotal(completed);
    const cards = [
      { icon: "fa-sack-dollar", color: "ic-violet", label: "Doanh thu", value: UI.money(revenue), money: true },
      { icon: "fa-circle-check", color: "ic-green", label: "Đơn hoàn thành", value: completed.length },
      { icon: "fa-receipt", color: "ic-amber", label: "Giá trị TB / đơn", value: UI.money(completed.length ? Math.round(revenue / completed.length) : 0), money: true },
      { icon: "fa-user-plus", color: "ic-blue", label: "Học viên mới", value: students.length },
    ];
    $("stat-grid").innerHTML = cards
      .map((c) => '<div class="stat-card"><div class="stat-icon ' + c.color + '"><i class="fa-solid ' + c.icon + '"></i></div><div><div class="stat-label">' + c.label + '</div><div class="stat-value ' + (c.money ? "money" : "") + '">' + c.value + "</div></div></div>")
      .join("");

    /* ----- Doanh thu theo tháng ----- */
    const byMonth = {};
    keys.forEach((k) => (byMonth[k] = { revenue: 0, orders: 0 }));
    completed.forEach((o) => {
      const k = bucketKey(o.createdAt);
      if (byMonth[k]) {
        byMonth[k].revenue += o.total;
        byMonth[k].orders += 1;
      }
    });
    drawBars($("revenue-chart"), $("revenue-labels"), months.map((m) => ({ label: m.label, value: byMonth[m.key].revenue, text: shortMoney(byMonth[m.key].revenue) })), "");

    $("revenue-table").innerHTML =
      '<table class="mini-table"><thead><tr><th>' + (unit === "day" ? "Ngày" : "Tháng") + '</th><th class="num">Đơn hoàn thành</th><th class="num">Doanh thu</th><th class="num">So với ' + unitName + ' trước</th></tr></thead><tbody>' +
      months
        .map((m, i) => {
          const cur = byMonth[m.key].revenue;
          const prev = i > 0 ? byMonth[months[i - 1].key].revenue : 0;
          let growth = '<span class="text-muted">—</span>';
          if (i > 0 && prev > 0) {
            const pct = Math.round(((cur - prev) / prev) * 100);
            growth = '<b style="color:' + (pct >= 0 ? "#0b8f68" : "#e03131") + '">' + (pct >= 0 ? "▲ +" : "▼ ") + pct + "%</b>";
          }
          return "<tr><td><b>" + m.label + '</b></td><td class="num">' + byMonth[m.key].orders + '</td><td class="num">' + UI.money(cur) + '</td><td class="num">' + growth + "</td></tr>";
        })
        .join("") +
      '</tbody><tfoot><tr><td><b>Tổng</b></td><td class="num"><b>' + completed.length + '</b></td><td class="num"><b>' + UI.money(revenue) + '</b></td><td></td></tr></tfoot></table>';

    /* ----- Đơn hàng theo trạng thái (tất cả trạng thái) ----- */
    const colors = { completed: "green", cancelled: "red" };
    $("status-box").innerHTML = Object.keys(ORDER_STATUS)
      .map((k) => {
        const count = orders.filter((o) => o.status === k).length;
        const pct = orders.length ? Math.round((count / orders.length) * 100) : 0;
        return (
          '<div class="bar-row"><div class="bar-top"><span>' + UI.orderBadge(k) + "</span><span><b>" + count + "</b> đơn · " + pct + '%</span></div><div class="progress ' + colors[k] + '"><span style="width:' + pct + '%"></span></div></div>'
        );
      })
      .join("") + '<div class="hint" style="margin-top:14px">Tổng ' + orders.length + " đơn hàng từ " + fmtDay(from) + " đến " + fmtDay(to) + ".</div>";

    /* ----- Khóa học bán chạy nhất ----- */
    const top = Store.courseSales(completed).slice(0, 5);
    $("top-courses").innerHTML = top.length
      ? top
          .map((c, i) => '<li class="rank-item"><span class="rank-num">' + (i + 1) + '</span><div class="rank-info"><div class="cell-title" title="' + UI.esc(c.name) + '">' + UI.esc(c.name) + '</div></div><div class="rank-value">' + c.count + " lượt<small>" + UI.money(c.revenue) + "</small></div></li>")
          .join("")
      : '<div class="empty-state" style="padding:20px"><h3>Chưa có dữ liệu</h3></div>';

    /* ----- Học viên đăng ký mới theo tháng ----- */
    const stuByMonth = {};
    keys.forEach((k) => (stuByMonth[k] = 0));
    students.forEach((s) => {
      const k = bucketKey(s.createdAt);
      if (k in stuByMonth) stuByMonth[k] += 1;
    });
    drawBars($("student-chart"), $("student-labels"), months.map((m) => ({ label: m.label, value: stuByMonth[m.key], text: stuByMonth[m.key] })), "green");
  }

  $("btn-reset").addEventListener("click", () => {
    setDefaultRange();
    render();
  });
  setDefaultRange();
  render();
}

initReportPage();
