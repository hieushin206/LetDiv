/* =========================================================
   my-vouchers.js - Trang "Mã giảm giá" (account/my-vouchers.html)
   Hiển thị các mã khách hàng được dùng: mã cho TẤT CẢ khách hàng
   + mã admin chỉ định riêng cho tài khoản này. Bấm để sao chép nhanh.
   ========================================================= */
function initMyVouchersPage() {
  const user = Account.requireStudent();
  if (!user) return;
  Account.renderSide(user, "vouchers");

  const $ = (id) => document.getElementById(id);
  const esc = (t) => CartUI.esc(t);

  function dayText(str) {
    const p = String(str).split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  // Còn bao nhiêu ngày đến hết hạn (hôm nay = 0)
  function daysLeft(p) {
    if (!p.endDate) return Infinity; // không giới hạn thời gian
    return Math.round(
      (parseDay(p.endDate) - parseDay(Store.todayString())) / 86400000,
    );
  }

  function cardHtml(item) {
    const p = item.promo;
    const key = item.state.key;
    const usedByMe = Store.promoUsedByStudent(p.code, user.studentId);
    const usable = key === "running" && !usedByMe;
    const used = Store.promoUsage(p.code);
    const value =
      p.type === "percent" ? "-" + p.value + "%" : "-" + formatVnd(p.value);
    const conds = [];
    if (p.minOrder > 0) conds.push("Đơn tối thiểu " + formatVnd(p.minOrder));
    if (p.quantity > 0)
      conds.push("Còn " + Math.max(0, p.quantity - used) + " lượt");
    if (Store.promoAudience(p) === "specific") conds.push("Dành riêng cho bạn");
    conds.push("Mỗi khách dùng 1 lần");

    let timeText = Store.promoUnlimited(p)
      ? "Không giới hạn thời gian"
      : p.startDate && p.endDate
        ? "Từ " + dayText(p.startDate) + " đến " + dayText(p.endDate)
        : p.startDate
          ? "Từ " + dayText(p.startDate)
          : "Đến " + dayText(p.endDate);
    let note = "";
    if (usedByMe) note = "Bạn đã dùng mã này";
    else if (key === "running") {
      const d = daysLeft(p);
      note = d === 0 ? "Hết hạn hôm nay" : d <= 3 ? "Còn " + d + " ngày" : "";
    } else if (key === "upcoming" && p.startDate)
      note = "Bắt đầu " + dayText(p.startDate);
    else if (key === "upcoming") note = "Sắp diễn ra";
    else if (key === "expired") note = "Đã hết hạn";
    else if (key === "soldout") note = "Đã hết lượt";

    return (
      '<div class="vc-card' +
      (usable ? "" : " disabled") +
      '">' +
      '<div class="vc-left"><b>' +
      esc(value) +
      "</b><span>" +
      (p.type === "percent" ? "Giảm giá" : "Giảm tiền") +
      "</span></div>" +
      '<div class="vc-body">' +
      '<div class="vc-code-row"><span class="vc-code">' +
      esc(p.code) +
      "</span>" +
      (note
        ? '<span class="vc-note ' +
          (usedByMe ? "soldout" : key) +
          '">' +
          esc(note) +
          "</span>"
        : "") +
      "</div>" +
      (p.description
        ? '<div class="vc-desc">' + esc(p.description) + "</div>"
        : "") +
      '<div class="vc-meta"><i class="fa-regular fa-clock"></i> ' +
      esc(timeText) +
      "</div>" +
      (conds.length
        ? '<div class="vc-meta"><i class="fa-solid fa-circle-info"></i> ' +
          esc(conds.join(" · ")) +
          "</div>"
        : "") +
      "</div>" +
      '<div class="vc-action"><button type="button" class="vc-copy" data-copy="' +
      esc(p.code) +
      '"' +
      (usable ? "" : " disabled") +
      '><i class="fa-regular fa-copy"></i> <span>Sao chép</span></button></div>' +
      "</div>"
    );
  }

  const list = Store.promosForStudent(user.studentId);
  const isUsable = (x) =>
    x.state.key === "running" &&
    !Store.promoUsedByStudent(x.promo.code, user.studentId);
  const usableCount = list.filter(isUsable).length;
  const privateCount = list.filter(
    (x) => Store.promoAudience(x.promo) === "specific" && isUsable(x),
  ).length;

  $("vc-stats").innerHTML =
    '<div class="acc-stat"><div class="ic"><i class="fa-solid fa-ticket"></i></div><div><small>Mã dùng được</small><b>' +
    usableCount +
    "</b></div></div>" +
    '<div class="acc-stat"><div class="ic violet"><i class="fa-solid fa-gift"></i></div><div><small>Mã dành riêng cho bạn</small><b>' +
    privateCount +
    "</b></div></div>" +
    '<div class="acc-stat"><div class="ic green"><i class="fa-solid fa-users"></i></div><div><small>Mã cho mọi khách hàng</small><b>' +
    list.filter((x) => Store.promoAudience(x.promo) === "all" && isUsable(x))
      .length +
    "</b></div></div>";

  if (list.length === 0) {
    $("vc-list").innerHTML =
      '<div class="mc-empty"><div class="ic"><i class="fa-solid fa-ticket"></i></div><h3>Hiện chưa có mã giảm giá</h3>' +
      "<p>Khi có chương trình khuyến mãi mới, mã sẽ hiện ở đây.</p>" +
      '<a class="acc-btn primary" href="/courses/course.html"><i class="fa-solid fa-book-open"></i> Xem khóa học</a></div>';
    return;
  }
  $("vc-list").innerHTML =
    '<div class="vc-grid">' + list.map(cardHtml).join("") + "</div>";

  /* ---------- Sao chép nhanh ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext)
      return navigator.clipboard.writeText(text);
    // Dự phòng cho trang chạy http (không phải localhost) hoặc trình duyệt cũ
    return new Promise((resolve, reject) => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy") ? resolve() : reject();
      } catch (err) {
        reject(err);
      }
      document.body.removeChild(ta);
    });
  }

  $("vc-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn || btn.disabled) return;
    const code = btn.dataset.copy;
    copyText(code).then(
      () => {
        CartUI.toast(
          'Đã sao chép mã "' +
            code +
            '". Dán vào ô khuyến mãi ở giỏ hàng để dùng.',
        );
        btn.classList.add("copied");
        btn.querySelector("span").textContent = "Đã sao chép";
        btn.querySelector("i").className = "fa-solid fa-check";
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.querySelector("span").textContent = "Sao chép";
          btn.querySelector("i").className = "fa-regular fa-copy";
        }, 1800);
      },
      () =>
        CartUI.toast(
          "Không sao chép được, hãy bôi đen và sao chép mã thủ công: " + code,
          "error",
        ),
    );
  });
}

// Chạy khi header-auth.js đã sẵn sàng
(function (run) {
  if (typeof AuthReady === "function") AuthReady(run);
  else
    window.addEventListener("load", function () {
      AuthReady(run);
    });
})(initMyVouchersPage);
