/* =========================================================
   cart-store.js - Giỏ hàng (lưu bằng localStorage)
   ---------------------------------------------------------
   - Mỗi tài khoản có 1 giỏ riêng:  letdiv_cart_<tên tài khoản>
     => đăng xuất / tắt trình duyệt / đăng nhập lại vẫn còn giỏ hàng.
   - Trong giỏ chỉ lưu MÃ khóa học (KH001...). Tên, giá, ảnh luôn lấy
     mới nhất từ Store (admin sửa giá thì giỏ cập nhật theo).
   - Thanh toán = tạo 1 đơn hàng trong Store (cùng dữ liệu với trang
     admin), nên admin nhìn thấy đơn và doanh thu ngay.

   Cần nạp sau: seed-data.js, store.js, auth-store.js
   ========================================================= */
const CART_PREFIX = "letdiv_cart_";

const CartStore = {
  // Khóa lưu giỏ của người đang đăng nhập (null nếu chưa đăng nhập)
  key() {
    const user = AuthStore.currentUser();
    return user ? CART_PREFIX + user.username.toLowerCase() : null;
  },

  readIds() {
    const key = this.key();
    if (!key) return [];
    try {
      const list = JSON.parse(localStorage.getItem(key));
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  },

  writeIds(ids) {
    const key = this.key();
    if (!key) return false;
    try {
      localStorage.setItem(key, JSON.stringify(ids));
    } catch (e) {
      console.error("Không ghi được giỏ hàng:", e);
      return false;
    }
    // Báo cho các phần khác trong cùng trang (số trên icon, sidebar, nút "Thêm vào giỏ")
    window.dispatchEvent(new CustomEvent("cart:changed"));
    return true;
  },

  // Chỉ tài khoản khách hàng (có hồ sơ học viên) mới mua được khóa học
  canBuy() {
    const user = AuthStore.currentUser();
    return !!user && user.role === "customer" && !!user.studentId;
  },

  // Khóa học còn bán được không (chưa xóa, đang hiển thị)
  isSellable(course) {
    return !!course && !course.deleted && course.status === "active";
  },

  // Khóa học khách đã mua (không mua lại được)
  isOwned(courseId) {
    const user = AuthStore.currentUser();
    if (!user || !user.studentId) return false;
    return Store.ownedCourseIds(user.studentId).includes(courseId);
  },

  has(courseId) {
    return this.readIds().includes(courseId);
  },

  /* Danh sách khóa học trong giỏ. Tự dọn các khóa không còn hợp lệ
     (admin đã ẩn / xóa, hoặc khách đã mua rồi). */
  items() {
    const ids = this.readIds();
    const courses = [];
    ids.forEach((id) => {
      const c = Store.getCourse(id);
      if (this.isSellable(c) && !this.isOwned(id)) courses.push(c);
    });
    if (courses.length !== ids.length) {
      const key = this.key();
      if (key) localStorage.setItem(key, JSON.stringify(courses.map((c) => c.id)));
    }
    return courses;
  },

  count() {
    return this.items().length;
  },

  subtotal(courses) {
    return (courses || this.items()).reduce((sum, c) => sum + c.price, 0);
  },

  add(courseId) {
    const user = AuthStore.currentUser();
    if (!user) return { ok: false, needLogin: true, error: "Vui lòng đăng nhập để thêm khóa học vào giỏ hàng." };
    if (!this.canBuy()) return { ok: false, error: "Chỉ tài khoản khách hàng mới có thể mua khóa học." };

    const course = Store.getCourse(courseId);
    if (!this.isSellable(course)) return { ok: false, error: "Khóa học này hiện không được bán." };
    if (this.isOwned(courseId)) return { ok: false, error: "Bạn đã mua khóa học này rồi." };

    const ids = this.readIds();
    if (ids.includes(courseId)) return { ok: false, duplicate: true, error: "Khóa học này đã có trong giỏ hàng." };
    ids.push(courseId);
    if (!this.writeIds(ids)) return { ok: false, error: "Không lưu được giỏ hàng (bộ nhớ trình duyệt đầy hoặc bị chặn)." };
    return { ok: true, course: course };
  },

  remove(courseId) {
    this.writeIds(this.readIds().filter((id) => id !== courseId));
  },

  clear() {
    this.writeIds([]);
  },

  /*
   * Thanh toán tất cả khóa học trong giỏ.
   * options: { payment: "Ví MoMo", promoCode: "WELCOME10" }
   * Đây là giả lập: coi như thanh toán thành công ngay => đơn "Hoàn thành".
   */
  checkout(options) {
    const user = AuthStore.currentUser();
    if (!user) return { ok: false, error: "Vui lòng đăng nhập để thanh toán." };
    if (!this.canBuy()) return { ok: false, error: "Chỉ tài khoản khách hàng mới có thể thanh toán." };

    const courses = this.items();
    if (courses.length === 0) return { ok: false, error: "Giỏ hàng đang trống." };

    const res = Store.createOrder({
      studentId: user.studentId,
      courseIds: courses.map((c) => c.id),
      promoCode: (options && options.promoCode) || "",
      payment: (options && options.payment) || PAYMENT_METHODS[0],
      status: "completed",
    });
    if (!res.ok) return res;

    this.clear();
    return res;
  },
};

// Khi giỏ thay đổi ở tab khác thì tab này cũng cập nhật theo
window.addEventListener("storage", (e) => {
  if (e.key && e.key.indexOf(CART_PREFIX) === 0) window.dispatchEvent(new CustomEvent("cart:changed"));
});
