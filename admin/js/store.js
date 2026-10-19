/* =========================================================
   store.js - Lớp dữ liệu dùng chung cho toàn bộ trang quản trị
   ---------------------------------------------------------
   - Website tĩnh nên toàn bộ dữ liệu lưu trong localStorage.
   - Mỗi nhóm dữ liệu là 1 mảng JSON lưu dưới 1 key riêng.
   - Mọi quy tắc nghiệp vụ (xóa mềm, không xóa danh mục đang dùng,
     lưu snapshot đơn hàng, kiểm tra mã khuyến mãi...) nằm ở đây
     để các trang dùng chung => số liệu luôn thống nhất.

   Cần load sau seed-data.js và trước các file js của từng trang.
   ========================================================= */

const KEYS = {
  courses: "letdiv_courses",
  categories: "letdiv_categories",
  students: "letdiv_students",
  orders: "letdiv_orders",
  promos: "letdiv_promos",
  classes: "letdiv_classes", // phân học viên vào lớp của giảng viên
  images: "letdiv_images", // thư viện ảnh khóa học do admin tải lên
  batches: "letdiv_batches", // đợt học của từng khóa học (có giảng viên + ngày bắt đầu / kết thúc)
  migrated3: "letdiv_migrated_v3",
  seeded: "letdiv_seeded_v1",
  migrated: "letdiv_migrated_v2",
  migrated4: "letdiv_migrated_v4", // dọn dữ liệu mẫu (học viên / đơn hàng / mã khuyến mãi giả) còn sót trong trình duyệt
};

// Mua hàng là thanh toán thành công ngay nên đơn luôn "Hoàn thành" (không còn "Chờ xác nhận")
const ORDER_STATUS = {
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const PAYMENT_METHODS = [
  "Chuyển khoản ngân hàng",
  "Ví MoMo",
  "VNPay",
  "Thẻ Visa / Mastercard",
];

/* ---------- Hàm tiện ích thuần (không phụ thuộc localStorage) ---------- */

// "2026-10-10" -> Date (giờ địa phương, 00:00:00)
function parseDay(str) {
  const p = String(str).split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

// Số tiền giảm của 1 mã khuyến mãi với tổng tiền subtotal
function calcDiscount(promo, subtotal) {
  let discount = 0;
  if (promo.type === "percent")
    discount = Math.round((subtotal * promo.value) / 100);
  else discount = promo.value;
  return Math.min(discount, subtotal); // không giảm quá tổng tiền
}

// Khóa tháng dạng "2026-10" để gom nhóm theo tháng
function monthKey(date) {
  const d = new Date(date);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

/* =========================================================
   Đối tượng Store
   ========================================================= */
const Store = {
  /* ---------- Đọc / ghi localStorage ---------- */
  get(name) {
    try {
      return JSON.parse(localStorage.getItem(KEYS[name])) || [];
    } catch (e) {
      return [];
    }
  },

  // Trả về true nếu ghi thành công (có thể lỗi khi bộ nhớ đầy)
  set(name, list) {
    try {
      localStorage.setItem(KEYS[name], JSON.stringify(list));
      return true;
    } catch (e) {
      console.error("Không ghi được localStorage:", e);
      return false;
    }
  },

  // Lần đầu truy cập: nạp danh mục + khóa học của website (không còn học viên / đơn hàng / khuyến mãi mẫu)
  init() {
    if (!localStorage.getItem(KEYS.seeded)) this.seedBase();
    this.migrate();
  },

  // Dữ liệu cũ trong trình duyệt: đơn "Chờ xác nhận" -> "Hoàn thành" (chạy 1 lần duy nhất)
  migrate() {
    // v4: xóa dữ liệu mẫu cũ còn lại trong trình duyệt (chạy 1 lần duy nhất)
    if (!localStorage.getItem(KEYS.migrated4)) {
      this.purgeDemoData();
      localStorage.setItem(KEYS.migrated4, "1");
    }
    // v3: học viên phải được phân vào ĐỢT HỌC -> bỏ các phân lớp cũ chưa có đợt (học viên sẽ về "chưa phân đợt")
    if (!localStorage.getItem(KEYS.migrated3)) {
      this.set(
        "classes",
        this.get("classes").filter((k) => k.batchId),
      );
      localStorage.setItem(KEYS.migrated3, "1");
    }
    if (localStorage.getItem(KEYS.migrated)) return;
    const orders = this.get("orders");
    let changed = false;
    orders.forEach((o) => {
      const hasPending =
        o.status === "pending" ||
        (o.history || []).some((h) => h.status === "pending");
      if (!hasPending) return;
      const cancelled = (o.history || []).find((h) => h.status === "cancelled");
      if (o.status === "pending") o.status = "completed";
      o.history = [{ status: "completed", at: o.createdAt }];
      if (cancelled) o.history.push(cancelled);
      changed = true;
    });
    if (changed) this.set("orders", orders);
    localStorage.setItem(KEYS.migrated, "1");
  },

  // Lần đầu: chỉ nạp danh mục + khóa học; học viên, đơn hàng, khuyến mãi, đợt học đều để trống
  seedBase() {
    const data = buildSeedData();
    this.set("categories", data.categories);
    this.set("courses", data.courses);
    this.set("students", []);
    this.set("promos", []);
    this.set("orders", []);
    this.set("classes", []);
    this.set("batches", []);
    localStorage.setItem(KEYS.seeded, "1");
    localStorage.setItem(KEYS.migrated, "1");
    localStorage.setItem(KEYS.migrated3, "1");
    localStorage.setItem(KEYS.migrated4, "1");
  },

  // Xóa dữ liệu mẫu cũ trong trình duyệt đã từng nạp bản có dữ liệu mẫu:
  //  - học viên mẫu = hồ sơ học viên KHÔNG có tài khoản đăng nhập nào gắn với (học viên thật đều có tài khoản)
  //  - kèm đơn hàng, phân lớp của họ và 6 mã khuyến mãi mẫu
  purgeDemoData() {
    let accounts = [];
    try {
      accounts = JSON.parse(localStorage.getItem("letdiv_accounts")) || [];
    } catch (e) {}
    const real = new Set(accounts.map((a) => a.studentId).filter(Boolean));
    const students = this.get("students");
    const demo = new Set(
      students.filter((s) => !real.has(s.id)).map((s) => s.id),
    );
    if (demo.size > 0) {
      this.set(
        "students",
        students.filter((s) => !demo.has(s.id)),
      );
      this.set(
        "orders",
        this.get("orders").filter((o) => !demo.has(o.studentId)),
      );
      this.set(
        "classes",
        this.get("classes").filter((k) => !demo.has(k.studentId)),
      );
    }
    const demoCodes = [
      "WELCOME10",
      "HOCVIEN200",
      "LETDIV20",
      "SUMMER15",
      "NAMMOI500",
      "FLASH5",
    ];
    this.set(
      "promos",
      this.get("promos").filter(
        (p) => !demoCodes.includes(String(p.code).toUpperCase()),
      ),
    );
  },

  // Sinh mã mới: nextId("KH", list, 3) -> "KH021"
  nextId(prefix, list, pad) {
    let max = 0;
    list.forEach((item) => {
      const n = parseInt(String(item.id).slice(prefix.length), 10);
      if (n > max) max = n;
    });
    return prefix + String(max + 1).padStart(pad, "0");
  },

  /* =======================================================
     DANH MỤC
     ======================================================= */
  getCategory(id) {
    return this.get("categories").find((c) => c.id === id);
  },

  categoryName(id) {
    const c = this.getCategory(id);
    return c ? c.name : "Chưa phân loại";
  },

  validateCategory(data, ignoreId) {
    const errors = {};
    const name = (data.name || "").trim();
    if (name.length < 2) errors.name = "Tên danh mục tối thiểu 2 ký tự.";
    else if (name.length > 40) errors.name = "Tên danh mục tối đa 40 ký tự.";
    else {
      const key = name.toLowerCase();
      const dup = this.get("categories").some(
        (c) => c.id !== ignoreId && c.name.toLowerCase() === key,
      );
      if (dup) errors.name = "Tên danh mục đã tồn tại.";
    }
    return errors;
  },

  addCategory(data) {
    const list = this.get("categories");
    const item = {
      id: this.nextId("DM", list, 2),
      name: data.name.trim(),
      description: (data.description || "").trim(),
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    this.set("categories", list);
    return item;
  },

  updateCategory(id, data) {
    const list = this.get("categories");
    const item = list.find((c) => c.id === id);
    if (!item) return false;
    item.name = data.name.trim();
    item.description = (data.description || "").trim();
    return this.set("categories", list);
  },

  // Số khóa học dùng danh mục (tính cả khóa đã xóa mềm nếu withDeleted = true)
  countCoursesInCategory(id, withDeleted) {
    return this.get("courses").filter(
      (c) => c.categoryId === id && (withDeleted || !c.deleted),
    ).length;
  },

  // Các khóa học (chưa xóa) thuộc 1 danh mục
  getCoursesInCategory(id) {
    return this.get("courses").filter((c) => !c.deleted && c.categoryId === id);
  },

  // Đưa khóa học vào danh mục (categoryId = "" nghĩa là gỡ khỏi danh mục -> "Chưa phân loại")
  moveCourseToCategory(courseId, categoryId) {
    if (categoryId && !this.getCategory(categoryId)) return false;
    const list = this.get("courses");
    const item = list.find((c) => c.id === courseId);
    if (!item) return false;
    item.categoryId = categoryId;
    return this.set("courses", list);
  },

  // QUY TẮC: không xóa danh mục khi vẫn còn khóa học đang dùng
  deleteCategory(id) {
    const using = this.countCoursesInCategory(id, false);
    if (using > 0) {
      return {
        ok: false,
        error:
          "Danh mục đang có " +
          using +
          " khóa học. Hãy chuyển các khóa học sang danh mục khác trước khi xóa.",
      };
    }
    // Khóa học đã xóa mềm không còn hiển thị -> gỡ liên kết để khi khôi phục sẽ là "Chưa phân loại"
    const courses = this.get("courses");
    courses.forEach((c) => {
      if (c.categoryId === id) c.categoryId = "";
    });
    this.set("courses", courses);
    this.set(
      "categories",
      this.get("categories").filter((c) => c.id !== id),
    );
    return { ok: true };
  },

  /* =======================================================
     KHÓA HỌC  (xóa = xóa mềm: chỉ đánh dấu deleted = true)
     ======================================================= */
  // Mặc định chỉ lấy khóa học chưa bị xóa
  getCourses(withDeleted) {
    const list = this.get("courses");
    return withDeleted ? list : list.filter((c) => !c.deleted);
  },

  getCourse(id) {
    return this.get("courses").find((c) => c.id === id);
  },

  validateCourse(data, ignoreId) {
    const errors = {};
    const name = (data.name || "").trim();
    if (name.length < 3) errors.name = "Tên khóa học tối thiểu 3 ký tự.";
    else {
      const key = name.toLowerCase();
      const dup = this.getCourses(false).some(
        (c) => c.id !== ignoreId && c.name.toLowerCase() === key,
      );
      if (dup) errors.name = "Đã có khóa học trùng tên.";
    }
    if (!data.categoryId || !this.getCategory(data.categoryId))
      errors.categoryId = "Vui lòng chọn danh mục.";
    if (!(data.price > 0)) errors.price = "Giá phải lớn hơn 0.";
    if (data.oldPrice && data.oldPrice < data.price)
      errors.oldPrice = "Giá gốc phải lớn hơn hoặc bằng giá bán.";
    if (!data.image) errors.image = "Vui lòng chọn hoặc tải lên ảnh khóa học.";
    return errors;
  },

  addCourse(data) {
    const list = this.get("courses");
    const item = {
      id: this.nextId("KH", list, 3),
      name: data.name.trim(),
      image: data.image,
      price: data.price,
      oldPrice: data.oldPrice || 0,
      categoryId: data.categoryId,
      instructor: (data.instructor || "").trim(),
      instructors: data.instructors || [],
      description: (data.description || "").trim(),
      status: data.status === "hidden" ? "hidden" : "active",
      deleted: false,
      href: "",
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    return this.set("courses", list) ? item : null;
  },

  updateCourse(id, data) {
    const list = this.get("courses");
    const item = list.find((c) => c.id === id);
    if (!item) return false;
    item.name = data.name.trim();
    item.image = data.image;
    item.price = data.price;
    item.oldPrice = data.oldPrice || 0;
    item.categoryId = data.categoryId;
    // Chỉ đổi giảng viên khi được truyền vào (phân công giảng viên có nút riêng, không làm mất khi sửa thông tin)
    if (Array.isArray(data.instructors)) {
      item.instructors = data.instructors;
      item.instructor = (data.instructor || "").trim();
    }
    item.description = (data.description || "").trim();
    item.status = data.status === "hidden" ? "hidden" : "active";
    return this.set("courses", list);
  },

  // Phân công giảng viên cho khóa học: instructors = tên đăng nhập, instructorText = chuỗi tên để hiển thị
  setCourseInstructors(id, instructors, instructorText) {
    const list = this.get("courses");
    const item = list.find((c) => c.id === id);
    if (!item) return false;
    item.instructors = instructors;
    item.instructor = instructorText;
    return this.set("courses", list);
  },

  /* =======================================================
     THƯ VIỆN ẢNH KHÓA HỌC (ảnh admin tải lên + đặt tên)
     Mỗi ảnh: { id, name, src (dữ liệu ảnh), createdAt }. Hiện trong ô chọn ảnh khi sửa khóa học.
     Ảnh có sẵn của website (PRESET_IMAGES) không nằm ở đây nên không xóa được.
     ======================================================= */
  getImageLibrary() {
    return this.get("images");
  },

  validateLibraryImage(name, src) {
    const text = (name || "").trim();
    if (!src) return "Vui lòng chọn ảnh từ máy.";
    if (text.length < 2) return "Tên ảnh tối thiểu 2 ký tự.";
    if (text.length > 40) return "Tên ảnh tối đa 40 ký tự.";
    const key = text.toLowerCase();
    const dup =
      this.getImageLibrary().some((i) => i.name.toLowerCase() === key) ||
      (typeof PRESET_IMAGES !== "undefined" &&
        PRESET_IMAGES.some((p) => p.label.toLowerCase() === key));
    return dup ? "Đã có ảnh trùng tên, hãy đặt tên khác." : "";
  },

  addLibraryImage(name, src) {
    const err = this.validateLibraryImage(name, src);
    if (err) return { ok: false, error: err };
    const list = this.getImageLibrary();
    const item = {
      id: this.nextId("IMG", list, 3),
      name: name.trim(),
      src: src,
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    if (!this.set("images", list))
      return {
        ok: false,
        error:
          "Bộ nhớ trình duyệt đã đầy. Hãy xóa bớt ảnh hoặc chọn ảnh nhỏ hơn.",
      };
    return { ok: true, image: item };
  },

  // Xóa ảnh khỏi lựa chọn. Khóa học đang dùng ảnh này vẫn giữ nguyên ảnh của nó
  deleteLibraryImage(id) {
    return this.set(
      "images",
      this.getImageLibrary().filter((i) => i.id !== id),
    );
  },

  setCourseStatus(id, status) {
    const list = this.get("courses");
    const item = list.find((c) => c.id === id);
    if (!item) return false;
    item.status = status;
    return this.set("courses", list);
  },

  // Xóa mềm: giữ nguyên dữ liệu, chỉ ẩn khỏi hệ thống
  deleteCourse(id) {
    const list = this.get("courses");
    const item = list.find((c) => c.id === id);
    if (!item) return false;
    item.deleted = true;
    item.deletedAt = new Date().toISOString();
    item.status = "hidden";
    return this.set("courses", list);
  },

  // Khôi phục: khóa học quay lại nhưng ở trạng thái "ẩn" để admin kiểm tra lại
  restoreCourse(id) {
    const list = this.get("courses");
    const item = list.find((c) => c.id === id);
    if (!item) return false;
    item.deleted = false;
    delete item.deletedAt;
    item.status = "hidden";
    return this.set("courses", list);
  },

  /* =======================================================
     HỌC VIÊN  (không xóa, chỉ vô hiệu hóa)
     ======================================================= */
  getStudent(id) {
    return this.get("students").find((s) => s.id === id);
  },

  setStudentStatus(id, status) {
    const list = this.get("students");
    const item = list.find((s) => s.id === id);
    if (!item) return false;
    item.status = status;
    return this.set("students", list);
  },

  // Dùng cho trang đăng ký của website: tạo tài khoản học viên mới
  registerStudent(data) {
    const list = this.get("students");
    const email = (data.email || "").trim().toLowerCase();
    if (list.some((s) => s.email.toLowerCase() === email))
      return { ok: false, error: "Email đã được đăng ký." };
    const item = {
      id: this.nextId("HV", list, 3),
      name: data.name.trim(),
      email: email,
      phone: (data.phone || "").trim(),
      status: "active",
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    this.set("students", list);
    return { ok: true, student: item };
  },

  // Các đơn hàng của 1 học viên (mới nhất trước)
  ordersOfStudent(studentId) {
    return this.get("orders")
      .filter((o) => o.studentId === studentId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  // Khóa học học viên đã mua = các mục trong đơn HOÀN THÀNH
  purchasedCourses(studentId) {
    const result = [];
    this.ordersOfStudent(studentId).forEach((o) => {
      if (o.status !== "completed") return;
      o.items.forEach((it) =>
        result.push({ ...it, orderId: o.id, date: o.createdAt }),
      );
    });
    return result;
  },

  // Các khóa học học viên đã sở hữu (để chặn mua trùng)
  ownedCourseIds(studentId) {
    const ids = [];
    this.ordersOfStudent(studentId).forEach((o) => {
      if (o.status === "cancelled") return;
      o.items.forEach((it) => ids.push(it.courseId));
    });
    return ids;
  },

  /* =======================================================
     ĐỢT HỌC + LỚP HỌC: mỗi khóa học có nhiều ĐỢT HỌC. Đợt học có: tên, giảng viên phụ trách
     (phải được phân công cho khóa), ngày bắt đầu, ngày kết thúc (các đợt có thể nối tiếp, xen kẽ hay
     học trước - tùy admin). Sau khi khách mua khóa học, admin phân học viên vào 1 đợt học.
     Bài học / bài tập / bài nộp thuộc từng đợt nên thêm - sửa - xóa ở đợt này không ảnh hưởng đợt khác.
     Bản ghi phân lớp: { orderId, courseId, studentId, batchId, instructor (= giảng viên của đợt), assignedAt }
     Giảng viên chỉ thấy / chấm bài của học viên trong các đợt của mình.
     ======================================================= */
  // Bản ghi phân lớp của 1 khóa trong 1 đơn
  classOf(orderId, courseId) {
    return (
      this.get("classes").find(
        (k) => k.orderId === orderId && k.courseId === courseId,
      ) || null
    );
  },

  // Lớp hiện tại của học viên với 1 khóa học (theo đơn chưa hủy)
  classOfStudent(studentId, courseId) {
    return (
      this.get("classes").find(
        (k) => k.studentId === studentId && k.courseId === courseId,
      ) || null
    );
  },

  // Giảng viên (tên đăng nhập) được phân công cho khóa học
  courseInstructors(courseId) {
    const c = this.getCourse(courseId);
    return c && Array.isArray(c.instructors) ? c.instructors : [];
  },

  // Phân (hoặc đổi) học viên vào 1 ĐỢT HỌC của khóa. Trả về { ok, error? }
  assignClass(orderId, courseId, batchId) {
    const order = this.getOrder(orderId);
    if (!order) return { ok: false, error: "Không tìm thấy đơn hàng." };
    if (order.status !== "completed")
      return { ok: false, error: "Chỉ phân đợt cho đơn hàng đã hoàn thành." };
    if (!order.items.some((it) => it.courseId === courseId))
      return { ok: false, error: "Đơn hàng không có khóa học này." };
    const batch = this.getBatch(batchId);
    if (!batch) return { ok: false, error: "Vui lòng chọn đợt học." };
    if (batch.courseId !== courseId)
      return { ok: false, error: "Đợt học này không thuộc khóa học đã mua." };

    const list = this.get("classes").filter(
      (k) => !(k.orderId === orderId && k.courseId === courseId),
    );
    list.push({
      orderId: orderId,
      courseId: courseId,
      studentId: order.studentId,
      batchId: batch.id,
      instructor: batch.instructor,
      assignedAt: new Date().toISOString(),
    });
    return this.set("classes", list)
      ? { ok: true }
      : { ok: false, error: "Không lưu được." };
  },

  unassignClass(orderId, courseId) {
    return this.set(
      "classes",
      this.get("classes").filter(
        (k) => !(k.orderId === orderId && k.courseId === courseId),
      ),
    );
  },

  // Khi gỡ 1 giảng viên khỏi khóa học: các học viên trong lớp của họ trở về "chưa phân lớp". Trả về số học viên bị ảnh hưởng
  removeClassesOfInstructor(courseId, username) {
    const key = String(username).toLowerCase();
    const list = this.get("classes");
    const keep = list.filter(
      (k) => !(k.courseId === courseId && k.instructor === key),
    );
    this.set("classes", keep);
    return list.length - keep.length;
  },

  // Số học viên (đơn chưa hủy) trong lớp của 1 giảng viên ở 1 khóa
  classSize(courseId, username) {
    const key = String(username).toLowerCase();
    return this.get("classes").filter(
      (k) => k.courseId === courseId && k.instructor === key,
    ).length;
  },

  // Các lượt mua (đơn hoàn thành) chưa được phân lớp: [{ order, item }]
  unassignedItems() {
    const result = [];
    this.completedOrders().forEach((o) => {
      o.items.forEach((it) => {
        if (!this.classOf(o.id, it.courseId))
          result.push({ order: o, item: it });
      });
    });
    return result;
  },

  /* =======================================================
     ĐỢT HỌC (batches): { id, courseId, name, instructor, startDate, endDate, createdAt }
     startDate / endDate dạng "YYYY-MM-DD".
     ======================================================= */
  getBatches(courseId) {
    return this.get("batches")
      .filter((b) => !courseId || b.courseId === courseId)
      .sort(
        (a, b) =>
          a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
      );
  },

  getBatch(id) {
    return this.get("batches").find((b) => b.id === id) || null;
  },

  // Đợt của 1 giảng viên (tên đăng nhập)
  batchesOfInstructor(username) {
    const key = String(username).toLowerCase();
    return this.getBatches().filter((b) => b.instructor === key);
  },

  // Sắp diễn ra / Đang diễn ra / Đã kết thúc (so với hôm nay)
  batchStatus(b) {
    const d = new Date();
    const today =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");
    if (today < b.startDate) return "upcoming";
    if (today > b.endDate) return "ended";
    return "running";
  },

  // Số học viên đã được phân vào đợt
  batchSize(batchId) {
    return this.get("classes").filter((k) => k.batchId === batchId).length;
  },

  nextBatchName(courseId) {
    return "Đợt " + (this.getBatches(courseId).length + 1);
  },

  validateBatch(data, ignoreId) {
    const errors = {};
    const course = this.getCourse(data.courseId);
    if (!course || course.deleted) errors.courseId = "Vui lòng chọn khóa học.";
    const name = (data.name || "").trim();
    if (name.length < 2) errors.name = "Tên đợt tối thiểu 2 ký tự.";
    else if (name.length > 40) errors.name = "Tên đợt tối đa 40 ký tự.";
    else if (
      this.getBatches(data.courseId).some(
        (b) => b.id !== ignoreId && b.name.toLowerCase() === name.toLowerCase(),
      )
    )
      errors.name = "Khóa học này đã có đợt trùng tên.";
    const key = String(data.instructor || "").toLowerCase();
    if (!key) errors.instructor = "Vui lòng chọn giảng viên phụ trách.";
    else if (course && !this.courseInstructors(data.courseId).includes(key))
      errors.instructor = "Giảng viên này chưa được phân công cho khóa học.";
    const okDate = (s) =>
      /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !isNaN(new Date(s));
    if (!okDate(data.startDate))
      errors.startDate = "Vui lòng chọn ngày bắt đầu.";
    if (!okDate(data.endDate)) errors.endDate = "Vui lòng chọn ngày kết thúc.";
    if (!errors.startDate && !errors.endDate && data.endDate < data.startDate)
      errors.endDate = "Ngày kết thúc không được nhỏ hơn ngày bắt đầu.";
    return errors;
  },

  addBatch(data) {
    const list = this.get("batches");
    const item = {
      id: this.nextId("DT", list, 3),
      courseId: data.courseId,
      name: data.name.trim(),
      instructor: String(data.instructor).toLowerCase(),
      startDate: data.startDate,
      endDate: data.endDate,
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    return this.set("batches", list) ? item : null;
  },

  // Khóa học của đợt không đổi được. Đổi giảng viên thì học viên trong đợt theo giảng viên mới.
  updateBatch(id, data) {
    const list = this.get("batches");
    const item = list.find((b) => b.id === id);
    if (!item) return false;
    item.name = data.name.trim();
    item.instructor = String(data.instructor).toLowerCase();
    item.startDate = data.startDate;
    item.endDate = data.endDate;
    this.set("batches", list);
    const classes = this.get("classes");
    classes.forEach((k) => {
      if (k.batchId === id) k.instructor = item.instructor;
    });
    return this.set("classes", classes);
  },

  // Chỉ xóa được đợt chưa có học viên (bài học / bài tập của đợt do LearningStore.removeBatchContent dọn)
  deleteBatch(id) {
    if (this.batchSize(id) > 0)
      return {
        ok: false,
        error:
          "Đợt học còn học viên. Hãy chuyển học viên sang đợt khác trước khi xóa.",
      };
    this.set(
      "batches",
      this.get("batches").filter((b) => b.id !== id),
    );
    return { ok: true };
  },

  /* =======================================================
     KHUYẾN MÃI
     ======================================================= */
  getPromo(code) {
    const key = String(code || "")
      .trim()
      .toUpperCase();
    return this.get("promos").find((p) => p.code === key);
  },

  // Số lần mã đã dùng = số đơn (chưa hủy) có áp mã đó => luôn khớp với đơn hàng
  promoUsage(code) {
    return this.get("orders").filter(
      (o) => o.promoCode === code && o.status !== "cancelled",
    ).length;
  },

  // Trạng thái hiển thị của mã
  promoState(p) {
    const today = parseDay(this.todayString());
    if (!p.active) return { key: "off", label: "Tạm tắt" };
    if (today < parseDay(p.startDate))
      return { key: "upcoming", label: "Sắp diễn ra" };
    if (today > parseDay(p.endDate))
      return { key: "expired", label: "Hết hạn" };
    if (p.quantity > 0 && this.promoUsage(p.code) >= p.quantity)
      return { key: "soldout", label: "Hết lượt" };
    return { key: "running", label: "Đang hoạt động" };
  },

  // Mã dành cho tất cả khách hàng hay chỉ định? (mã cũ chưa có trường audience => coi là tất cả)
  promoAudience(p) {
    return p.audience === "specific" ? "specific" : "all";
  },

  // Mã này có dùng được cho học viên studentId không?
  promoAppliesTo(p, studentId) {
    if (this.promoAudience(p) === "all") return true;
    return !!studentId && (p.studentIds || []).includes(studentId);
  },

  // Các mã khách hàng được xem / dùng: mã cho tất cả + mã chỉ định cho riêng khách này.
  // Bỏ mã admin đã tắt. Mã đang chạy xếp trước.
  promosForStudent(studentId) {
    const order = { running: 0, upcoming: 1, soldout: 2, expired: 3 };
    return this.get("promos")
      .filter((p) => p.active && this.promoAppliesTo(p, studentId))
      .map((p) => ({ promo: p, state: this.promoState(p) }))
      .sort(
        (a, b) =>
          order[a.state.key] - order[b.state.key] ||
          a.promo.endDate.localeCompare(b.promo.endDate),
      );
  },

  todayString() {
    const d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  },

  validatePromoForm(data, ignoreCode) {
    const errors = {};
    const code = (data.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4,20}$/.test(code))
      errors.code =
        "Mã gồm 4-20 ký tự chữ hoặc số, không dấu, không khoảng trắng.";
    else if (code !== ignoreCode && this.getPromo(code))
      errors.code = "Mã khuyến mãi đã tồn tại.";

    if (data.type === "percent") {
      if (!(data.value >= 1 && data.value <= 100))
        errors.value = "Phần trăm giảm phải từ 1 đến 100.";
    } else if (!(data.value >= 1000)) {
      errors.value = "Số tiền giảm tối thiểu 1.000 đ.";
    }
    if (data.minOrder < 0) errors.minOrder = "Đơn tối thiểu không được âm.";
    if (data.quantity < 0)
      errors.quantity = "Số lượng không được âm (nhập 0 nếu không giới hạn).";
    if (!data.startDate) errors.startDate = "Chọn ngày bắt đầu.";
    if (!data.endDate) errors.endDate = "Chọn ngày kết thúc.";
    else if (data.startDate && data.endDate < data.startDate)
      errors.endDate = "Ngày kết thúc không được nhỏ hơn ngày bắt đầu.";
    if (
      data.audience === "specific" &&
      !(data.studentIds && data.studentIds.length > 0)
    )
      errors.audience = "Hãy chọn ít nhất 1 khách hàng được dùng mã.";
    return errors;
  },

  addPromo(data) {
    const list = this.get("promos");
    list.push({
      code: data.code.trim().toUpperCase(),
      description: (data.description || "").trim(),
      type: data.type,
      value: data.value,
      minOrder: data.minOrder || 0,
      quantity: data.quantity || 0,
      startDate: data.startDate,
      endDate: data.endDate,
      active: !!data.active,
      audience: data.audience === "specific" ? "specific" : "all",
      studentIds:
        data.audience === "specific"
          ? Array.from(new Set(data.studentIds || []))
          : [],
    });
    return this.set("promos", list);
  },

  // Khi sửa không đổi mã vì các đơn hàng đang tham chiếu mã này
  updatePromo(code, data) {
    const list = this.get("promos");
    const item = list.find((p) => p.code === code);
    if (!item) return false;
    item.description = (data.description || "").trim();
    item.type = data.type;
    item.value = data.value;
    item.minOrder = data.minOrder || 0;
    item.quantity = data.quantity || 0;
    item.startDate = data.startDate;
    item.endDate = data.endDate;
    item.active = !!data.active;
    item.audience = data.audience === "specific" ? "specific" : "all";
    item.studentIds =
      item.audience === "specific"
        ? Array.from(new Set(data.studentIds || []))
        : [];
    return this.set("promos", list);
  },

  setPromoActive(code, active) {
    const list = this.get("promos");
    const item = list.find((p) => p.code === code);
    if (!item) return false;
    item.active = active;
    return this.set("promos", list);
  },

  // Mã đã được dùng trong đơn hàng thì không xóa (chỉ tắt) để giữ lịch sử
  deletePromo(code) {
    const usedInOrders = this.get("orders").filter(
      (o) => o.promoCode === code,
    ).length;
    if (usedInOrders > 0) {
      return {
        ok: false,
        error:
          "Mã đã xuất hiện trong " +
          usedInOrders +
          " đơn hàng nên không thể xóa. Bạn có thể tắt mã để ngừng áp dụng.",
      };
    }
    this.set(
      "promos",
      this.get("promos").filter((p) => p.code !== code),
    );
    return { ok: true };
  },

  /*
   * KIỂM TRA MÃ KHUYẾN MÃI (trang giỏ hàng của học viên cũng gọi hàm này)
   * Trả về { valid, message, discount, total, promo }
   * Kiểm tra: tồn tại -> đang bật -> đúng đối tượng -> thời hạn -> đơn tối thiểu -> số lượng
   * studentId: học viên đang dùng mã (bắt buộc với mã chỉ định cho khách hàng cụ thể)
   */
  validatePromo(code, subtotal, studentId) {
    const fail = (message) => ({
      valid: false,
      message: message,
      discount: 0,
      total: subtotal,
      promo: null,
    });
    const key = String(code || "")
      .trim()
      .toUpperCase();
    if (!key) return fail("Vui lòng nhập mã khuyến mãi.");

    const p = this.getPromo(key);
    if (!p) return fail("Mã khuyến mãi không tồn tại.");
    if (!p.active) return fail("Mã khuyến mãi đang tạm tắt.");
    if (!this.promoAppliesTo(p, studentId)) {
      return fail(
        studentId
          ? "Mã khuyến mãi này không dành cho tài khoản của bạn."
          : "Mã này chỉ dành cho khách hàng được chỉ định. Hãy chọn khách hàng để thử.",
      );
    }

    const today = parseDay(this.todayString());
    if (today < parseDay(p.startDate))
      return fail(
        "Mã chưa đến thời gian áp dụng (từ " + formatDay(p.startDate) + ").",
      );
    if (today > parseDay(p.endDate))
      return fail("Mã đã hết hạn vào " + formatDay(p.endDate) + ".");
    if (subtotal < p.minOrder)
      return fail(
        "Đơn hàng cần tối thiểu " + formatVnd(p.minOrder) + " để dùng mã này.",
      );
    if (p.quantity > 0 && this.promoUsage(p.code) >= p.quantity)
      return fail("Mã đã hết lượt sử dụng.");

    const discount = calcDiscount(p, subtotal);
    return {
      valid: true,
      message: "Áp dụng thành công, giảm " + formatVnd(discount) + ".",
      discount: discount,
      total: subtotal - discount,
      promo: p,
    };
  },

  /* =======================================================
     ĐƠN HÀNG
     ======================================================= */
  getOrder(id) {
    return this.get("orders").find((o) => o.id === id);
  },

  // Chuyển trạng thái nào là hợp lệ: Đã hủy là trạng thái cuối
  allowedNextStatuses(current) {
    if (current === "completed") return ["cancelled"]; // hoàn tiền / hủy sau khi hoàn thành
    return [];
  },

  /*
   * Tạo đơn hàng. QUY TẮC: lưu SNAPSHOT (tên, giá, danh mục... tại thời điểm mua)
   * để sau này sửa/xóa khóa học, đổi tên học viên cũng không làm sai lịch sử.
   * input: { studentId, courseIds: [...], promoCode, payment, status }
   */
  createOrder(input) {
    const student = this.getStudent(input.studentId);
    if (!student) return { ok: false, error: "Vui lòng chọn học viên." };
    if (student.status !== "active")
      return { ok: false, error: "Tài khoản học viên đang bị vô hiệu hóa." };
    if (!input.courseIds || input.courseIds.length === 0)
      return { ok: false, error: "Vui lòng chọn ít nhất 1 khóa học." };

    const owned = this.ownedCourseIds(student.id);
    const items = [];
    for (const id of input.courseIds) {
      const c = this.getCourse(id);
      if (!c || c.deleted || c.status !== "active")
        return { ok: false, error: "Khóa học " + id + " hiện không được bán." };
      if (owned.includes(id))
        return { ok: false, error: 'Học viên đã mua khóa "' + c.name + '".' };
      items.push({
        courseId: c.id,
        name: c.name,
        price: c.price,
        categoryId: c.categoryId,
        categoryName: this.categoryName(c.categoryId),
        instructor: c.instructor,
        image: c.image,
      });
    }

    const subtotal = items.reduce((sum, it) => sum + it.price, 0);
    let promoCode = "";
    let discount = 0;
    if (input.promoCode && input.promoCode.trim()) {
      const check = this.validatePromo(input.promoCode, subtotal, student.id);
      if (!check.valid) return { ok: false, error: check.message };
      promoCode = check.promo.code;
      discount = check.discount;
    }

    const orders = this.get("orders");
    const now = new Date().toISOString();
    // Thanh toán thành công là đơn hoàn thành ngay (đã duyệt tự động)
    const status = "completed";
    const history = [{ status: "completed", at: now }];

    const order = {
      id: this.nextId("DH", orders, 4),
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      items: items,
      subtotal: subtotal,
      promoCode: promoCode,
      discount: discount,
      total: subtotal - discount,
      payment: input.payment || PAYMENT_METHODS[0],
      status: status,
      createdAt: now,
      updatedAt: now,
      history: history,
    };
    orders.push(order);
    this.set("orders", orders);
    return { ok: true, order: order };
  },

  updateOrderStatus(id, newStatus) {
    const orders = this.get("orders");
    const order = orders.find((o) => o.id === id);
    if (!order) return { ok: false, error: "Không tìm thấy đơn hàng." };
    if (!this.allowedNextStatuses(order.status).includes(newStatus)) {
      return {
        ok: false,
        error:
          'Không thể chuyển từ "' +
          ORDER_STATUS[order.status] +
          '" sang "' +
          ORDER_STATUS[newStatus] +
          '".',
      };
    }
    const now = new Date().toISOString();
    order.status = newStatus;
    order.updatedAt = now;
    order.history.push({ status: newStatus, at: now });
    this.set("orders", orders);
    // Đơn đã hủy thì học viên không còn trong lớp nào của đơn đó
    if (newStatus === "cancelled")
      this.set(
        "classes",
        this.get("classes").filter((k) => k.orderId !== id),
      );
    return { ok: true, order: order };
  },

  /* =======================================================
     THỐNG KÊ - dùng chung cho Tổng quan và Báo cáo
     QUY TẮC DOANH THU: chỉ tính đơn HOÀN THÀNH.
     ======================================================= */
  completedOrders(orders) {
    return (orders || this.get("orders")).filter(
      (o) => o.status === "completed",
    );
  },

  sumTotal(orders) {
    return orders.reduce((sum, o) => sum + o.total, 0);
  },

  // Doanh thu của 1 dòng hàng sau khi chia đều giảm giá của đơn
  // => tổng doanh thu các khóa học luôn bằng tổng doanh thu đơn hàng
  lineRevenue(order, item) {
    if (!order.subtotal) return 0;
    return Math.round((item.price * order.total) / order.subtotal);
  },

  // Thống kê theo khóa học (từ đơn hoàn thành), bán nhiều nhất trước
  courseSales(orders) {
    const map = {};
    orders.forEach((o) => {
      o.items.forEach((it) => {
        if (!map[it.courseId])
          map[it.courseId] = {
            courseId: it.courseId,
            name: it.name,
            image: it.image,
            categoryName: it.categoryName,
            count: 0,
            revenue: 0,
          };
        map[it.courseId].count += 1;
        map[it.courseId].revenue += this.lineRevenue(o, it);
      });
    });
    return Object.values(map).sort(
      (a, b) => b.count - a.count || b.revenue - a.revenue,
    );
  },

  // Thống kê theo danh mục (nhóm theo mã danh mục, hiển thị tên hiện tại nếu còn)
  categorySales(orders) {
    const map = {};
    orders.forEach((o) => {
      o.items.forEach((it) => {
        const key = it.categoryId || it.categoryName;
        if (!map[key]) {
          const current = this.getCategory(it.categoryId);
          map[key] = {
            key: key,
            name: current ? current.name : it.categoryName || "Chưa phân loại",
            count: 0,
            revenue: 0,
          };
        }
        map[key].count += 1;
        map[key].revenue += this.lineRevenue(o, it);
      });
    });
    return Object.values(map).sort(
      (a, b) => b.count - a.count || b.revenue - a.revenue,
    );
  },

  // Danh sách n tháng gần nhất (cũ -> mới): [{ key: "2026-05", label: "05/2026", start: Date }]
  lastMonths(n) {
    const result = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({
        key: monthKey(d),
        label:
          String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear(),
        start: d,
      });
    }
    return result;
  },
};

/* ---------- Định dạng dùng chung trong store ---------- */
function formatVnd(n) {
  return Number(n || 0).toLocaleString("vi-VN") + " đ";
}
// "2026-10-10" -> "10/10/2026"
function formatDay(str) {
  const p = String(str).split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

Store.init();
