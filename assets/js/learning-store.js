/* =========================================================
   learning-store.js - Dữ liệu học tập dùng chung
   ---------------------------------------------------------
   File này được 2 phía cùng dùng nên kết quả luôn đồng bộ:
     - Trang Giảng viên (/instructor): quản lý bài học, bài tập, chấm điểm
     - Trang Học viên (/student): nộp bài, xem điểm

   4 nhóm dữ liệu lưu trong localStorage (mỗi nhóm là 1 mảng JSON):
     letdiv_lessons      : bài học      (id, courseId, name, order, status...)
     letdiv_assignments  : bài tập      (baiTap)       - gắn với bài học + khóa học
     letdiv_submissions  : bài nộp      (baiNop)       - học viên nộp đường dẫn
     letdiv_results      : kết quả chấm (ketQuaBaiTap) - điểm + nhận xét
   Thêm 1 nhóm nhỏ: letdiv_instructor_profiles (ảnh, giới thiệu, chuyên môn).

   Cần nạp SAU: admin/js/seed-data.js, admin/js/store.js, assets/js/auth-store.js
   ========================================================= */

const LEARN_KEYS = {
  lessons: "letdiv_lessons",
  assignments: "letdiv_assignments",
  submissions: "letdiv_submissions",
  results: "letdiv_results",
  profiles: "letdiv_instructor_profiles",
  seeded: "letdiv_learning_seeded_v1",
  batchMigrated: "letdiv_learning_batches_v3", // đã dọn dữ liệu cũ chưa có đợt học
};

const LESSON_STATUS = { visible: "Đang hiển thị", hidden: "Đã ẩn" };
const DEFAULT_MAX_SCORE = 10;

/* ---------- Hàm tiện ích thuần ---------- */
// Bỏ dấu + chữ thường: so sánh / tìm kiếm tiếng Việt
function learnNorm(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

function isHttpUrl(text) {
  try {
    const u = new URL(String(text).trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch (e) {
    return false;
  }
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Date -> "2026-10-20T23:59" (đúng định dạng của <input type="datetime-local">)
function toLocalInput(d) {
  return (
    d.getFullYear() +
    "-" +
    pad2(d.getMonth() + 1) +
    "-" +
    pad2(d.getDate()) +
    "T" +
    pad2(d.getHours()) +
    ":" +
    pad2(d.getMinutes())
  );
}

// "2026-10-20T23:59" -> "23:59 - 20/10/2026"
function formatLocalDateTime(str) {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d)) return "—";
  return (
    pad2(d.getHours()) +
    ":" +
    pad2(d.getMinutes()) +
    " - " +
    pad2(d.getDate()) +
    "/" +
    pad2(d.getMonth() + 1) +
    "/" +
    d.getFullYear()
  );
}

// Bộ sinh số giả ngẫu nhiên có seed (để dữ liệu mẫu luôn giống nhau)
function learnRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Nội dung bài học mẫu ---------- */
const LESSON_TEMPLATES = {
  default: [
    "Giới thiệu khóa học",
    "Kiến thức nền tảng",
    "Thực hành cơ bản",
    "Dự án nhỏ",
    "Tổng kết và ôn tập",
  ],
};
const SEED_COMMENTS = [
  "Làm tốt, bố cục rõ ràng.",
  "Cần bổ sung kiểm tra dữ liệu email.",
  "Code sạch, nên đặt tên biến rõ nghĩa hơn.",
  "Hoàn thành đủ yêu cầu của đề bài.",
  "Giao diện chưa responsive, hãy bổ sung media query.",
];

const LearningStore = {
  /* =======================================================
     Đọc / ghi localStorage
     ======================================================= */
  read(name) {
    try {
      return (
        JSON.parse(localStorage.getItem(LEARN_KEYS[name])) ||
        (name === "profiles" ? {} : [])
      );
    } catch (e) {
      return name === "profiles" ? {} : [];
    }
  },

  write(name, data) {
    try {
      localStorage.setItem(LEARN_KEYS[name], JSON.stringify(data));
      return true;
    } catch (e) {
      console.error("Không ghi được localStorage:", e);
      return false;
    }
  },

  nextId(prefix, list, pad) {
    let max = 0;
    list.forEach((item) => {
      const n = parseInt(String(item.id).slice(prefix.length), 10);
      if (n > max) max = n;
    });
    return prefix + String(max + 1).padStart(pad, "0");
  },

  // Bài học / bài tập giờ thuộc từng ĐỢT HỌC. Dữ liệu cũ (chưa có đợt) được dọn 1 lần duy nhất.
  // Không còn nạp dữ liệu mẫu: giảng viên tự tạo, hoặc admin chọn "tạo bài học mẫu / sao chép" khi tạo đợt.
  init() {
    if (typeof Store === "undefined") return;
    if (localStorage.getItem(LEARN_KEYS.batchMigrated)) return;
    const lessons = this.read("lessons").filter((l) => l.batchId);
    const keepAssign = this.read("assignments").filter((a) => a.batchId);
    const ids = new Set(keepAssign.map((a) => a.id));
    const subs = this.read("submissions").filter((s) => ids.has(s.assignmentId));
    const subIds = new Set(subs.map((s) => s.id));
    this.write("lessons", lessons);
    this.write("assignments", keepAssign);
    this.write("submissions", subs);
    this.write("results", this.read("results").filter((r) => subIds.has(r.submissionId)));
    localStorage.setItem(LEARN_KEYS.batchMigrated, "1");
  },

  /* =======================================================
     QUYỀN + PHẠM VI DỮ LIỆU CỦA GIẢNG VIÊN
     - Khóa học "do giảng viên phụ trách" = khóa học mà admin đã phân công cho
       giảng viên đó (course.instructors chứa tên đăng nhập). 1 khóa có thể có nhiều giảng viên.
     - ĐỢT HỌC "của tôi" = đợt mà admin đặt giảng viên này phụ trách (Store.batches).
       Bài học / bài tập thuộc từng đợt nên đợt này thêm - sửa - xóa không ảnh hưởng đợt khác.
     - Học viên "của tôi" = học viên mà admin đã phân vào các đợt của giảng viên (Store.classes).
     Admin xem thử trang giảng viên thì thấy tất cả.
     ======================================================= */
  requireInstructor() {
    const go = (url) => (window.top || window).location.replace(url);
    const user = AuthStore.currentUser();
    if (!user) {
      go(
        "/auth/login.html?next=" + encodeURIComponent("/instructor/index.html"),
      );
      return null;
    }
    if (user.role !== "instructor" && user.role !== "admin") {
      go(AuthStore.homeFor(user));
      return null;
    }
    return user;
  },

  myCourses(user) {
    const all = Store.getCourses(false);
    if (user.role === "admin") return all;
    const me = String(user.username).toLowerCase();
    return all.filter((c) => Array.isArray(c.instructors) && c.instructors.includes(me));
  },

  // Các đợt học giảng viên phụ trách (admin xem thử thì thấy tất cả)
  myBatches(user) {
    return user.role === "admin" ? Store.getBatches() : Store.batchesOfInstructor(user.username);
  },

  // Trả về đợt nếu thuộc quyền giảng viên, ngược lại undefined
  ownBatch(user, batchId) {
    return this.myBatches(user).find((b) => b.id === batchId);
  },

  // Học viên có đang học trong đợt này không?
  inBatch(studentId, batchId) {
    return Store.get("classes").some((k) => k.studentId === studentId && k.batchId === batchId);
  },

  // Học viên có thuộc 1 đợt của giảng viên này không? (admin: luôn đúng)
  isMyStudent(user, batchId, studentId) {
    if (user.role === "admin") return true;
    if (this.isStudentDisabled(studentId)) return false; // tài khoản bị vô hiệu hóa => không hiện ở trang giảng viên
    const batch = Store.getBatch(batchId);
    return !!batch && batch.instructor === String(user.username).toLowerCase() && this.inBatch(studentId, batchId);
  },

  // Học viên có đang bị admin vô hiệu hóa không?
  isStudentDisabled(studentId) {
    const s = Store.getStudent(studentId);
    return !!s && s.status === "disabled";
  },

  // Số học viên của 1 đợt (không tính học viên bị vô hiệu hóa)
  batchStudentCount(batchId) {
    return new Set(Store.get("classes").filter((k) => k.batchId === batchId && !this.isStudentDisabled(k.studentId)).map((k) => k.studentId)).size;
  },

  myCourseIds(user) {
    return this.myCourses(user).map((c) => c.id);
  },

  // Trả về khóa học nếu thuộc quyền giảng viên, ngược lại undefined
  ownCourse(user, courseId) {
    return this.myCourses(user).find((c) => c.id === courseId);
  },

  /* =======================================================
     HỌC VIÊN ĐĂNG KÝ (lấy từ đơn hàng của admin)
     ======================================================= */
  // Mỗi dòng = 1 học viên x 1 khóa học (kèm đợt học), mới nhất trước.
  // Truyền user (giảng viên) để chỉ lấy học viên thuộc các đợt của người đó.
  enrollments(courseIds, user) {
    const set = new Set(courseIds);
    const rows = [];
    Store.get("orders").forEach((o) => {
      o.items.forEach((it) => {
        if (!set.has(it.courseId)) return;
        const rec = Store.classOf(o.id, it.courseId);
        if (user && !(rec && this.isMyStudent(user, rec.batchId, o.studentId))) return;
        const s = Store.getStudent(o.studentId);
        const batch = rec ? Store.getBatch(rec.batchId) : null;
        rows.push({
          batchId: rec ? rec.batchId : "",
          batchName: batch ? batch.name : "",
          orderId: o.id,
          studentId: o.studentId,
          studentName: s ? s.name : o.studentName,
          studentEmail: s ? s.email : o.studentEmail,
          courseId: it.courseId,
          courseName: it.name,
          date: o.createdAt,
          status: o.status, // completed | cancelled
        });
      });
    });
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  // Học viên đã thanh toán (đơn hoàn thành) - dùng để đếm và cho phép nộp bài
  activeEnrollments(courseIds, user) {
    return this.enrollments(courseIds, user).filter((r) => r.status === "completed");
  },

  // Số học viên của khóa (truyền user để chỉ đếm học viên thuộc các đợt của giảng viên đó)
  courseStudentCount(courseId, user) {
    return new Set(this.activeEnrollments([courseId], user).map((r) => r.studentId)).size;
  },

  /* =======================================================
     BÀI HỌC  (lessons)
     Mỗi bài học thuộc 1 ĐỢT HỌC (batchId). Thứ tự luôn liền mạch 1..n trong mỗi đợt:
     thêm / sửa / xóa xong hệ thống tự đánh số lại (chỉ trong đợt đó).
     ======================================================= */
  getLessons(batchId) {
    return this.read("lessons")
      .filter((l) => l.batchId === batchId)
      .sort((a, b) => a.order - b.order);
  },

  getLessonsOfBatches(batchIds) {
    const set = new Set(batchIds);
    return this.read("lessons").filter((l) => set.has(l.batchId));
  },

  getLesson(id) {
    return this.read("lessons").find((l) => l.id === id);
  },

  validateLesson(data) {
    const errors = {};
    const name = (data.name || "").trim();
    if (name.length < 3) errors.name = "Tên bài học tối thiểu 3 ký tự.";
    else if (name.length > 120) errors.name = "Tên bài học tối đa 120 ký tự.";
    if ((data.description || "").length > 300)
      errors.description = "Mô tả tối đa 300 ký tự.";
    if ((data.content || "").length > 5000)
      errors.content = "Nội dung tối đa 5000 ký tự.";
    const video = (data.videoUrl || "").trim();
    if (video && !isHttpUrl(video))
      errors.videoUrl =
        "Đường dẫn video phải bắt đầu bằng http:// hoặc https://";
    if (!(Number.isInteger(data.order) && data.order >= 1))
      errors.order = "Thứ tự phải là số nguyên từ 1 trở lên.";
    return errors;
  },

  // Đặt bài học vào đúng vị trí rồi đánh số lại 1..n
  _place(all, batchId, item, wantedOrder) {
    const others = all
      .filter((l) => l.batchId === batchId && l.id !== item.id)
      .sort((a, b) => a.order - b.order);
    const pos = Math.min(
      Math.max(1, wantedOrder || others.length + 1),
      others.length + 1,
    );
    others.splice(pos - 1, 0, item);
    others.forEach((l, i) => (l.order = i + 1));
  },

  addLesson(batch, data) {
    const all = this.read("lessons");
    const now = new Date().toISOString();
    const item = {
      id: this.nextId("BH", all, 3),
      batchId: batch.id,
      courseId: batch.courseId,
      name: data.name.trim(),
      description: (data.description || "").trim(),
      content: (data.content || "").trim(),
      videoUrl: (data.videoUrl || "").trim(),
      order: data.order,
      status: data.status === "hidden" ? "hidden" : "visible",
      createdAt: now,
      updatedAt: now,
    };
    all.push(item);
    this._place(all, batch.id, item, data.order);
    return this.write("lessons", all) ? item : null;
  },

  updateLesson(id, data) {
    const all = this.read("lessons");
    const item = all.find((l) => l.id === id);
    if (!item) return false;
    item.name = data.name.trim();
    item.description = (data.description || "").trim();
    item.content = (data.content || "").trim();
    item.videoUrl = (data.videoUrl || "").trim();
    item.status = data.status === "hidden" ? "hidden" : "visible";
    item.updatedAt = new Date().toISOString();
    this._place(all, item.batchId, item, data.order);
    return this.write("lessons", all);
  },

  setLessonStatus(id, status) {
    const all = this.read("lessons");
    const item = all.find((l) => l.id === id);
    if (!item) return false;
    item.status = status;
    item.updatedAt = new Date().toISOString();
    return this.write("lessons", all);
  },

  // Cho hộp thoại xác nhận xóa: bài học kéo theo bao nhiêu bài tập / bài nộp
  lessonImpact(id) {
    const assignments = this.read("assignments").filter(
      (a) => a.lessonId === id,
    );
    const ids = new Set(assignments.map((a) => a.id));
    const submissions = this.read("submissions").filter((s) =>
      ids.has(s.assignmentId),
    );
    return { assignments: assignments.length, submissions: submissions.length };
  },

  // Xóa bài học + toàn bộ bài tập, bài nộp, kết quả chấm của bài học đó
  deleteLesson(id) {
    const all = this.read("lessons");
    const item = all.find((l) => l.id === id);
    if (!item) return false;
    this.read("assignments")
      .filter((a) => a.lessonId === id)
      .forEach((a) => this.deleteAssignment(a.id));
    const rest = all.filter((l) => l.id !== id);
    rest
      .filter((l) => l.batchId === item.batchId)
      .sort((a, b) => a.order - b.order)
      .forEach((l, i) => (l.order = i + 1));
    return this.write("lessons", rest);
  },

  /* =======================================================
     BÀI TẬP  (assignments / baiTap)
     ======================================================= */
  getAssignment(id) {
    return this.read("assignments").find((a) => a.id === id);
  },

  getAssignmentsOfLesson(lessonId) {
    return this.read("assignments")
      .filter((a) => a.lessonId === lessonId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  getAssignmentsOfBatches(batchIds) {
    const set = new Set(batchIds);
    return this.read("assignments").filter((a) => set.has(a.batchId));
  },

  isOverdue(a) {
    return !!a.deadline && new Date(a.deadline) < new Date();
  },

  // Không có "đóng nộp bài" và không có "nộp muộn": học viên nộp / nộp lại được cho đến
  // khi giảng viên chấm điểm. "Hạn nộp" chỉ để nhắc thời gian, không chặn nộp.
  canSubmit(a) {
    return !!a;
  },

  validateAssignment(data, ignoreId) {
    const errors = {};
    const name = (data.name || "").trim();
    if (name.length < 3) errors.name = "Tên bài tập tối thiểu 3 ký tự.";
    else if (name.length > 120) errors.name = "Tên bài tập tối đa 120 ký tự.";
    if ((data.description || "").trim().length < 10)
      errors.description = "Đề bài tối thiểu 10 ký tự.";
    else if (data.description.length > 3000)
      errors.description = "Đề bài tối đa 3000 ký tự.";
    if ((data.guide || "").length > 2000)
      errors.guide = "Hướng dẫn tối đa 2000 ký tự.";
    if (!data.deadline || isNaN(new Date(data.deadline)))
      errors.deadline = "Vui lòng chọn hạn nộp.";
    if (
      !(
        Number.isInteger(data.maxScore) &&
        data.maxScore >= 1 &&
        data.maxScore <= 10
      )
    ) {
      errors.maxScore = "Điểm tối đa là số nguyên từ 1 đến 10.";
    } else if (ignoreId) {
      // Không hạ điểm tối đa xuống thấp hơn điểm đã chấm
      const subIds = new Set(
        this.read("submissions")
          .filter((s) => s.assignmentId === ignoreId)
          .map((s) => s.id),
      );
      const over = this.read("results").filter(
        (r) => subIds.has(r.submissionId) && r.score > data.maxScore,
      ).length;
      if (over > 0)
        errors.maxScore =
          "Đã có " +
          over +
          " bài được chấm điểm cao hơn mức này. Hãy chấm lại trước.";
    }
    return errors;
  },

  addAssignment(lesson, data) {
    const all = this.read("assignments");
    const item = {
      id: this.nextId("BT", all, 3),
      batchId: lesson.batchId, // bài tập thuộc đúng đợt của bài học
      courseId: lesson.courseId,
      lessonId: lesson.id,
      name: data.name.trim(),
      description: data.description.trim(),
      guide: (data.guide || "").trim(),
      deadline: data.deadline,
      maxScore: data.maxScore,
      createdAt: new Date().toISOString(),
    };
    all.push(item);
    return this.write("assignments", all) ? item : null;
  },

  updateAssignment(id, data) {
    const all = this.read("assignments");
    const item = all.find((a) => a.id === id);
    if (!item) return false;
    item.name = data.name.trim();
    item.description = data.description.trim();
    item.guide = (data.guide || "").trim();
    item.deadline = data.deadline;
    item.maxScore = data.maxScore;
    return this.write("assignments", all);
  },

  assignmentImpact(id) {
    return {
      submissions: this.read("submissions").filter((s) => s.assignmentId === id)
        .length,
    };
  },

  // Xóa bài tập + các bài nộp + kết quả chấm liên quan
  deleteAssignment(id) {
    const subs = this.read("submissions");
    const gone = new Set(
      subs.filter((s) => s.assignmentId === id).map((s) => s.id),
    );
    this.write(
      "results",
      this.read("results").filter((r) => !gone.has(r.submissionId)),
    );
    this.write(
      "submissions",
      subs.filter((s) => s.assignmentId !== id),
    );
    return this.write(
      "assignments",
      this.read("assignments").filter((a) => a.id !== id),
    );
  },

  /* =======================================================
     BÀI NỘP (submissions / baiNop) + KẾT QUẢ (results / ketQuaBaiTap)
     ======================================================= */
  getSubmission(id) {
    return this.read("submissions").find((s) => s.id === id);
  },

  // Truyền user (giảng viên) để chỉ lấy bài nộp của học viên thuộc đợt của người đó
  getSubmissionsOfAssignment(assignmentId, user) {
    const a = user ? this.getAssignment(assignmentId) : null;
    return this.read("submissions")
      .filter((s) => s.assignmentId === assignmentId)
      .filter((s) => !user || (a && this.isMyStudent(user, a.batchId, s.studentId)))
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  },

  submissionOf(studentId, assignmentId) {
    return this.read("submissions").find(
      (s) => s.studentId === studentId && s.assignmentId === assignmentId,
    );
  },

  getResult(submissionId) {
    return this.read("results").find((r) => r.submissionId === submissionId);
  },

  // Bản đồ submissionId -> kết quả (đọc 1 lần cho cả danh sách, nhanh hơn)
  resultMap() {
    const map = {};
    this.read("results").forEach((r) => (map[r.submissionId] = r));
    return map;
  },

  validateLink(link) {
    const text = (link || "").trim();
    if (!text) return "Vui lòng nhập đường dẫn bài làm.";
    if (!isHttpUrl(text))
      return "Đường dẫn phải bắt đầu bằng http:// hoặc https:// (VD: link GitHub, CodePen).";
    if (text.length > 300) return "Đường dẫn tối đa 300 ký tự.";
    return "";
  },

  // HỌC VIÊN nộp / cập nhật bài. Trả về { ok, error?, submission? }
  submitWork(studentId, assignmentId, link) {
    const a = this.getAssignment(assignmentId);
    if (!a) return { ok: false, error: "Không tìm thấy bài tập." };
    // Chỉ học viên thuộc ĐÚNG đợt của bài tập mới nộp được (đợt khác thì không)
    if (!this.inBatch(studentId, a.batchId))
      return {
        ok: false,
        error: "Bài tập này không thuộc đợt học của bạn.",
      };
    const err = this.validateLink(link);
    if (err) return { ok: false, error: err };

    const subs = this.read("submissions");
    let sub = subs.find(
      (s) => s.studentId === studentId && s.assignmentId === assignmentId,
    );
    if (sub && this.getResult(sub.id))
      return { ok: false, error: "Bài đã được chấm điểm nên không thể sửa." };
    if (sub) {
      // Nộp lại: lưu bản cũ vào history rồi ghi đè bản mới
      sub.history = (sub.history || []).concat([
        { link: sub.link, submittedAt: sub.submittedAt },
      ]);
      sub.link = link.trim();
      sub.submittedAt = new Date().toISOString();
    } else {
      sub = {
        id: this.nextId("BN", subs, 4),
        studentId: studentId,
        assignmentId: assignmentId,
        link: link.trim(),
        submittedAt: new Date().toISOString(),
      };
      subs.push(sub);
    }
    return this.write("submissions", subs)
      ? { ok: true, submission: sub }
      : { ok: false, error: "Không lưu được bài nộp." };
  },

  validateResult(data, maxScore) {
    const errors = {};
    if (data.score === "" || data.score === null || isNaN(Number(data.score)))
      errors.score = "Vui lòng nhập điểm.";
    else if (Number(data.score) < 0 || Number(data.score) > maxScore)
      errors.score = "Điểm phải từ 0 đến " + maxScore + ".";
    if ((data.comment || "").length > 500)
      errors.comment = "Nhận xét tối đa 500 ký tự.";
    return errors;
  },

  // GIẢNG VIÊN lưu điểm (lần đầu hoặc chấm lại). Chỉ chấm được bài thuộc khóa của mình.
  saveResult(user, submissionId, data) {
    const sub = this.getSubmission(submissionId);
    if (!sub) return { ok: false, error: "Không tìm thấy bài nộp." };
    const a = this.getAssignment(sub.assignmentId);
    if (!a || !this.ownBatch(user, a.batchId))
      return {
        ok: false,
        error: "Bạn không phụ trách đợt học của bài tập này.",
      };

    if (!this.isMyStudent(user, a.batchId, sub.studentId))
      return { ok: false, error: "Học viên này không thuộc đợt học của bạn." };

    const errors = this.validateResult(data, a.maxScore);
    if (Object.keys(errors).length > 0) return { ok: false, errors: errors };

    const results = this.read("results");
    const now = new Date().toISOString();
    let r = results.find((x) => x.submissionId === submissionId);
    if (!r) {
      r = { submissionId: submissionId };
      results.push(r);
    }
    r.score = Math.round(Number(data.score) * 100) / 100;
    r.comment = (data.comment || "").trim();
    r.gradedBy = user.username;
    r.gradedByName = user.fullName;
    r.gradedAt = now;
    return this.write("results", results)
      ? { ok: true, result: r }
      : { ok: false, error: "Không lưu được kết quả." };
  },

  /* =======================================================
     THỐNG KÊ
     ======================================================= */
  // Thống kê 1 bài tập: số bài nộp, đã chấm, chờ chấm, điểm trung bình
  assignmentStats(assignmentId, user) {
    const subs = this.getSubmissionsOfAssignment(assignmentId, user);
    const map = this.resultMap();
    const graded = subs.filter((s) => map[s.id]);
    const sum = graded.reduce((t, s) => t + map[s.id].score, 0);
    return {
      submitted: subs.length,
      graded: graded.length,
      pending: subs.length - graded.length,
      avg: graded.length ? sum / graded.length : null,
    };
  },

  // Các bài nộp chờ chấm thuộc những đợt học của giảng viên (mới nộp trước)
  pendingSubmissions(user) {
    const batchOf = {};
    this.getAssignmentsOfBatches(this.myBatches(user).map((b) => b.id)).forEach((a) => (batchOf[a.id] = a.batchId));
    const map = this.resultMap();
    return this.read("submissions")
      .filter((s) => batchOf[s.assignmentId] && !map[s.id])
      .filter((s) => this.isMyStudent(user, batchOf[s.assignmentId], s.studentId))
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  },

  /* =======================================================
     PHÍA HỌC VIÊN: bài tập của các khóa đã mua
     ======================================================= */
  // Bài tập của (các) đợt học mà học viên được phân vào
  assignmentsForStudent(studentId) {
    const purchased = Store.purchasedCourses(studentId);
    const names = {};
    purchased.forEach((p) => (names[p.courseId] = p.name));
    const batchIds = Store.get("classes").filter((k) => k.studentId === studentId && k.batchId).map((k) => k.batchId);
    const lessons = {};
    this.getLessonsOfBatches(batchIds).forEach((l) => (lessons[l.id] = l));
    const results = this.resultMap();
    const mySubs = this.read("submissions").filter(
      (s) => s.studentId === studentId,
    );

    return this.getAssignmentsOfBatches(batchIds)
      .filter(
        (a) => lessons[a.lessonId] && lessons[a.lessonId].status === "visible",
      ) // bài học ẩn thì không hiện
      .map((a) => {
        const sub = mySubs.find((s) => s.assignmentId === a.id) || null;
        return {
          assignment: a,
          lesson: lessons[a.lessonId],
          courseName: names[a.courseId],
          submission: sub,
          result: sub ? results[sub.id] || null : null,
        };
      })
      .sort(
        (x, y) =>
          new Date(x.assignment.deadline) - new Date(y.assignment.deadline),
      );
  },

  // Giảng viên đổi họ tên => cập nhật tên hiển thị trong danh sách giảng viên của khóa học
  // (quyền với khóa học dựa trên tên đăng nhập nên không bị mất khi đổi tên)
  renameInstructor(oldName, newName) {
    if (oldName === newName) return;
    const courses = Store.get("courses");
    let changed = false;
    courses.forEach((c) => {
      const names = String(c.instructor || "").split(",").map((n) => n.trim());
      const i = names.findIndex((n) => learnNorm(n) === learnNorm(oldName));
      if (i >= 0) {
        names[i] = newName;
        c.instructor = names.filter(Boolean).join(", ");
        changed = true;
      }
    });
    if (changed) Store.set("courses", courses);
  },

  /* =======================================================
     NỘI DUNG CỦA ĐỢT HỌC (dùng khi admin tạo / xóa đợt)
     ======================================================= */
  // Tạo sẵn vài bài học + bài tập mẫu cho 1 đợt 
  seedBatchContent(batch) {
    const course = Store.getCourse(batch.courseId);
    const names = LESSON_TEMPLATES.default;
    names.forEach((name, i) => {
      const lesson = this.addLesson(batch, {
        name: name,
        description: 'Nội dung bài "' + name + '"' + (course ? " thuộc khóa học " + course.name : "") + ".",
        content: "Mục tiêu bài học:\n- Nắm khái niệm chính của bài.\n- Làm theo ví dụ trong video.\n- Tự thực hành lại sau khi học xong.",
        videoUrl: "",
        order: i + 1,
        status: "visible",
      });
      if (lesson && (i === 1 || i === 3)) {
        const dl = new Date(batch.startDate + "T23:59");
        dl.setDate(dl.getDate() + 14 * (i === 1 ? 1 : 3));
        this.addAssignment(lesson, {
          name: "Bài tập: " + name,
          description: 'Thực hành theo nội dung bài "' + name + '". Đưa mã nguồn lên GitHub hoặc CodePen rồi nộp đường dẫn.',
          guide: "Xem lại video bài giảng và làm theo từng bước trong phần nội dung bài học.",
          deadline: toLocalInput(dl),
          maxScore: DEFAULT_MAX_SCORE,
        });
      }
    });
  },

  // Sao chép bài học + bài tập từ đợt cũ sang đợt mới (bản sao độc lập, không chép bài nộp / điểm)
  copyBatchContent(fromBatchId, toBatch) {
    this.getLessons(fromBatchId).forEach((l) => {
      const copy = this.addLesson(toBatch, {
        name: l.name,
        description: l.description,
        content: l.content,
        videoUrl: l.videoUrl,
        order: l.order,
        status: l.status,
      });
      if (!copy) return;
      this.getAssignmentsOfLesson(l.id).forEach((a) => {
        this.addAssignment(copy, {
          name: a.name,
          description: a.description,
          guide: a.guide,
          deadline: a.deadline,
          maxScore: a.maxScore,
        });
      });
    });
  },

  // Xóa toàn bộ bài học, bài tập, bài nộp, điểm của 1 đợt (khi admin xóa đợt)
  removeBatchContent(batchId) {
    this.getLessons(batchId).forEach((l) => this.deleteLesson(l.id));
  },
};

LearningStore.init();
