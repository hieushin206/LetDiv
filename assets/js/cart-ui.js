/* =========================================================
   cart-ui.js - Giao diện giỏ hàng: số trên icon + sidebar bên phải
   ---------------------------------------------------------
   Các màn hình trong sidebar:
     cart     : danh sách khóa học, mã khuyến mãi, tổng tiền
     checkout : chọn phương thức thanh toán, xác nhận (giả lập)
     success  : thanh toán thành công
     (hoặc thông báo "cần đăng nhập" / "chỉ khách hàng mới mua được")

   Cần nạp sau: cart-store.js. CSS: assets/css/user-cart.css
   ========================================================= */
const CartUI = {
  built: false,
  view: "cart",
  promoCode: "", // mã khuyến mãi đang áp dụng
  promoMsg: "", // thông báo dưới ô nhập mã
  promoMsgType: "", // "ok" | "err"
  payment: "",
  busy: false,
  lastOrder: null,

  /* ---------- Tiện ích ---------- */
  esc(text) {
    const div = document.createElement("div");
    div.textContent = String(text == null ? "" : text);
    return div.innerHTML.replace(/"/g, "&quot;");
  },

  // Ảnh khóa học: "assets/images/..." (tính từ thư mục gốc) hoặc ảnh admin tải lên (data:)
  img(path) {
    if (!path) return "/assets/images/LetDiv.webp";
    return /^(data:|https?:|\/)/.test(path) ? path : "/" + path;
  },

  courseLink(course) {
    return course.href ? "/" + course.href : "#";
  },

  toast(message, type) {
    let box = document.getElementById("uc-toast-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "uc-toast-box";
      document.body.appendChild(box);
    }
    const icon = { success: "fa-circle-check", error: "fa-circle-exclamation", info: "fa-circle-info" }[type || "success"];
    const el = document.createElement("div");
    el.className = "uc-toast uc-toast-" + (type || "success");
    el.innerHTML = '<i class="fa-solid ' + icon + '"></i><span>' + this.esc(message) + "</span>";
    box.appendChild(el);
    setTimeout(() => el.classList.add("hide"), 3000);
    setTimeout(() => el.remove(), 3400);
  },

  /* ---------- Số lượng trên icon giỏ hàng ---------- */
  refreshBadge() {
    const n = AuthStore.currentUser() ? CartStore.count() : 0;
    document.querySelectorAll(".cart-badge").forEach((badge) => {
      badge.textContent = n > 99 ? "99+" : n;
      badge.classList.add("show"); // luôn hiện số, kể cả 0 hoặc chưa đăng nhập
      badge.classList.toggle("zero", n === 0); // 0 thì màu xám
    });
  },

  /* ---------- Dựng khung sidebar (chỉ 1 lần) ---------- */
  build() {
    if (this.built) return;
    this.built = true;

    const overlay = document.createElement("div");
    overlay.className = "cart-overlay";
    overlay.addEventListener("click", () => this.close());

    const drawer = document.createElement("aside");
    drawer.className = "cart-drawer";
    drawer.setAttribute("aria-label", "Giỏ hàng");
    drawer.addEventListener("click", (e) => this.onClick(e));
    drawer.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.id === "cd-promo") {
        e.preventDefault();
        this.applyPromo();
      }
    });

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    this.overlay = overlay;
    this.drawer = drawer;

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen()) this.close();
    });
    window.addEventListener("cart:changed", () => {
      this.refreshBadge();
      if (this.isOpen() && this.view === "cart" && !this.busy) this.render();
    });
  },

  isOpen() {
    return this.drawer && this.drawer.classList.contains("open");
  },

  open(view) {
    this.build();
    this.view = view || "cart";
    this.render();
    this.overlay.classList.add("open");
    this.drawer.classList.add("open");
    document.body.classList.add("cart-open");
  },

  close() {
    if (!this.built || this.busy) return;
    this.overlay.classList.remove("open");
    this.drawer.classList.remove("open");
    document.body.classList.remove("cart-open");
  },

  /* ---------- Thêm khóa học vào giỏ (gọi từ nút "Thêm Vào Giỏ") ---------- */
  addToCart(courseId) {
    const res = CartStore.add(courseId);
    if (res.ok) {
      this.toast("Đã thêm \"" + res.course.name + "\" vào giỏ hàng.");
      this.refreshBadge();
      this.open("cart");
      return res;
    }
    if (res.needLogin) {
      this.toast(res.error, "info");
      this.openLogin();
    } else if (res.duplicate) {
      this.open("cart");
    } else {
      this.toast(res.error, "error");
    }
    return res;
  },

  // Mở hộp thoại đăng nhập có sẵn ở header (nếu trang không có thì chuyển sang trang đăng nhập)
  openLogin() {
    this.close();
    if (window.jQuery && document.getElementById("loginModal")) {
      window.jQuery("#loginModal").modal("show");
    } else {
      location.href = "/auth/login.html?next=" + encodeURIComponent(location.pathname);
    }
  },

  /* ---------- Vẽ nội dung theo màn hình ---------- */
  render() {
    const user = AuthStore.currentUser();
    if (!user) return this.renderMessage("fa-lock", "Bạn chưa đăng nhập", "Hãy đăng nhập để thêm khóa học vào giỏ hàng và thanh toán.", '<button class="cd-btn-pay" data-act="login"><i class="fa-solid fa-right-to-bracket"></i> Đăng nhập ngay</button>');
    if (!CartStore.canBuy()) {
      return this.renderMessage("fa-user-shield", "Tài khoản không có giỏ hàng", "Chỉ tài khoản có quyền Khách hàng mới mua được khóa học.", "");
    }
    if (this.view === "success") return this.renderSuccess();
    if (this.view === "checkout" && CartStore.count() > 0) return this.renderCheckout();
    this.view = "cart";
    this.renderCart();
  },

  head(title, backButton) {
    return (
      '<div class="cd-head">' +
      (backButton ? '<button class="cd-back" data-act="back" aria-label="Quay lại"><i class="fa-solid fa-arrow-left"></i></button>' : "") +
      '<h3><i class="fa-solid fa-cart-shopping"></i> ' + title + "</h3>" +
      '<button class="cd-close" data-act="close" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button></div>'
    );
  },

  renderMessage(icon, title, text, extra) {
    this.drawer.innerHTML =
      this.head("Giỏ hàng") +
      '<div class="cd-body"><div class="cd-empty"><div class="cd-empty-icon"><i class="fa-solid ' + icon + '"></i></div>' +
      "<h4>" + title + "</h4><p>" + text + "</p>" + extra + "</div></div>";
  },

  // Tính tiền (tạm tính, giảm giá, tổng) và kiểm tra lại mã khuyến mãi đang áp dụng
  calc(courses) {
    const subtotal = CartStore.subtotal(courses);
    let discount = 0;
    if (this.promoCode) {
      const check = Store.validatePromo(this.promoCode, subtotal);
      if (check.valid) {
        discount = check.discount;
      } else {
        // Mã không còn hợp lệ (vd: giỏ giảm xuống dưới mức tối thiểu)
        this.promoMsg = check.message;
        this.promoMsgType = "err";
        this.promoCode = "";
      }
    }
    return { subtotal: subtotal, discount: discount, total: subtotal - discount };
  },

  summaryHtml(sum) {
    return (
      '<div class="cd-sum"><div><span>Tạm tính</span><b>' + formatVnd(sum.subtotal) + "</b></div>" +
      (sum.discount > 0 ? '<div class="cd-discount"><span>Giảm giá (' + this.esc(this.promoCode) + ")</span><b>- " + formatVnd(sum.discount) + "</b></div>" : "") +
      '<div class="cd-total"><span>Tổng cộng</span><b>' + formatVnd(sum.total) + "</b></div></div>"
    );
  },

  renderCart() {
    const courses = CartStore.items();
    if (courses.length === 0) {
      this.promoCode = "";
      this.promoMsg = "";
      this.drawer.innerHTML =
        this.head("Giỏ hàng") +
        '<div class="cd-body"><div class="cd-empty"><div class="cd-empty-icon"><i class="fa-solid fa-cart-arrow-down"></i></div>' +
        "<h4>Giỏ hàng đang trống</h4><p>Hãy chọn khóa học phù hợp và thêm vào giỏ nhé!</p>" +
        '<a class="cd-btn-pay" href="/courses/course.html"><i class="fa-solid fa-book-open"></i> Xem các khóa học</a></div></div>';
      return;
    }

    const sum = this.calc(courses);
    const itemsHtml = courses
      .map(
        (c) =>
          '<div class="cd-item"><a href="' + this.esc(this.courseLink(c)) + '"><img src="' + this.esc(this.img(c.image)) + '" alt=""></a>' +
          '<div class="cd-info"><a class="cd-name" href="' + this.esc(this.courseLink(c)) + '">' + this.esc(c.name) + "</a>" +
          '<div class="cd-ins"><i class="fa-solid fa-chalkboard-user"></i> ' + this.esc(c.instructor) + "</div>" +
          '<div class="cd-price">' + formatVnd(c.price) + (c.oldPrice > c.price ? "<del>" + formatVnd(c.oldPrice) + "</del>" : "") + "</div></div>" +
          '<button class="cd-remove" data-remove="' + this.esc(c.id) + '" title="Xóa khỏi giỏ" aria-label="Xóa khỏi giỏ"><i class="fa-regular fa-trash-can"></i></button></div>'
      )
      .join("");

    const promoBox = this.promoCode
      ? '<div class="cd-promo-applied"><i class="fa-solid fa-ticket"></i> Mã <b>' + this.esc(this.promoCode) + '</b> đã được áp dụng<button data-act="remove-promo" title="Bỏ mã">Bỏ</button></div>'
      : '<div class="cd-promo"><input type="text" id="cd-promo" placeholder="Nhập mã khuyến mãi" autocomplete="off"><button data-act="apply-promo">Áp dụng</button></div>';
    const promoMsg = this.promoMsg ? '<div class="cd-promo-msg ' + this.promoMsgType + '">' + this.esc(this.promoMsg) + "</div>" : "";

    this.drawer.innerHTML =
      this.head("Giỏ hàng <span class=\"cd-count\">" + courses.length + "</span>") +
      '<div class="cd-body">' + itemsHtml + "</div>" +
      '<div class="cd-foot">' + promoBox + promoMsg + this.summaryHtml(sum) +
      '<button class="cd-btn-pay" data-act="to-checkout"><i class="fa-solid fa-credit-card"></i> Thanh toán tất cả (' + courses.length + " khóa học)</button></div>";
    this.promoMsg = ""; // chỉ hiện 1 lần
  },

  paymentIcon(name) {
    const n = String(name).toLowerCase();
    if (n.indexOf("momo") >= 0) return "fa-wallet";
    if (n.indexOf("vnpay") >= 0) return "fa-qrcode";
    if (n.indexOf("visa") >= 0 || n.indexOf("master") >= 0) return "fa-credit-card";
    return "fa-building-columns";
  },

  renderCheckout() {
    const courses = CartStore.items();
    const sum = this.calc(courses);
    if (!this.payment || PAYMENT_METHODS.indexOf(this.payment) < 0) this.payment = PAYMENT_METHODS[0];

    const listHtml = courses
      .map((c) => '<div class="cd-line"><span>' + this.esc(c.name) + "</span><b>" + formatVnd(c.price) + "</b></div>")
      .join("");
    const payHtml = PAYMENT_METHODS.map(
      (m) =>
        '<label class="cd-pay ' + (m === this.payment ? "active" : "") + '"><input type="radio" name="cd-payment" value="' + this.esc(m) + '"' + (m === this.payment ? " checked" : "") + ">" +
        '<i class="fa-solid ' + this.paymentIcon(m) + '"></i><span>' + this.esc(m) + "</span></label>"
    ).join("");

    this.drawer.innerHTML =
      this.head("Thanh toán", true) +
      '<div class="cd-body"><h4 class="cd-sub">Khóa học (' + courses.length + ")</h4>" + listHtml +
      '<h4 class="cd-sub">Phương thức thanh toán</h4><div class="cd-pays">' + payHtml + "</div>" +
      '<p class="cd-note"><i class="fa-solid fa-circle-info"></i> Đây là website demo: thanh toán được giả lập, không trừ tiền thật.</p></div>' +
      '<div class="cd-foot">' + this.summaryHtml(sum) +
      '<button class="cd-btn-pay" data-act="confirm-pay"><i class="fa-solid fa-lock"></i> Xác nhận thanh toán ' + formatVnd(sum.total) + "</button></div>";

    this.drawer.querySelectorAll('input[name="cd-payment"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        this.payment = radio.value;
        this.drawer.querySelectorAll(".cd-pay").forEach((l) => l.classList.toggle("active", l.querySelector("input").checked));
      });
    });
  },

  renderSuccess() {
    const o = this.lastOrder;
    if (!o) {
      this.view = "cart";
      return this.renderCart();
    }
    const items = o.items.map((it) => '<div class="cd-line"><span>' + this.esc(it.name) + "</span><b>" + formatVnd(it.price) + "</b></div>").join("");
    this.drawer.innerHTML =
      this.head("Giỏ hàng") +
      '<div class="cd-body"><div class="cd-success"><div class="cd-success-icon"><i class="fa-solid fa-check"></i></div>' +
      "<h4>Thanh toán thành công!</h4>" +
      "<p>Mã đơn hàng <b>" + this.esc(o.id) + "</b> · " + this.esc(o.payment) + "</p>" +
      '<div class="cd-success-list">' + items + '<div class="cd-line cd-total"><span>Đã thanh toán</span><b>' + formatVnd(o.total) + "</b></div></div>" +
      '<a class="cd-btn-pay" href="/account/my-courses.html"><i class="fa-solid fa-graduation-cap"></i> Xem khóa học đã mua</a>' +
      '<button class="cd-btn-ghost" data-act="close">Tiếp tục xem khóa học</button></div></div>';
  },

  /* ---------- Xử lý bấm nút trong sidebar ---------- */
  applyPromo() {
    const input = document.getElementById("cd-promo");
    const code = input ? input.value.trim() : "";
    const check = Store.validatePromo(code, CartStore.subtotal());
    if (check.valid) {
      this.promoCode = check.promo.code;
      this.promoMsg = check.message;
      this.promoMsgType = "ok";
    } else {
      this.promoMsg = check.message;
      this.promoMsgType = "err";
    }
    this.renderCart();
  },

  pay() {
    if (this.busy) return;
    this.busy = true;
    const btn = this.drawer.querySelector('[data-act="confirm-pay"]');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý thanh toán...';
    }
    // Giả lập chờ cổng thanh toán xử lý
    setTimeout(() => {
      const res = CartStore.checkout({ payment: this.payment, promoCode: this.promoCode });
      this.busy = false;
      if (!res.ok) {
        this.toast(res.error, "error");
        this.view = "cart";
        this.render();
        return;
      }
      this.lastOrder = res.order;
      this.promoCode = "";
      this.view = "success";
      this.refreshBadge();
      this.render();
    }, 1400);
  },

  onClick(e) {
    const removeBtn = e.target.closest("[data-remove]");
    if (removeBtn) {
      CartStore.remove(removeBtn.dataset.remove); // sự kiện cart:changed sẽ vẽ lại
      return;
    }
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "close") this.close();
    else if (act === "login") this.openLogin();
    else if (act === "apply-promo") this.applyPromo();
    else if (act === "remove-promo") {
      this.promoCode = "";
      this.renderCart();
    } else if (act === "to-checkout") {
      this.view = "checkout";
      this.render();
    } else if (act === "back") {
      this.view = "cart";
      this.render();
    } else if (act === "confirm-pay") this.pay();
  },
};
