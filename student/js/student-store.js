/* =========================================================
   student-store.js - Dữ liệu + quy tắc cho khu vực học viên (Student)
   ---------------------------------------------------------
   KHÔNG lưu trùng dữ liệu: gần như mọi thứ được SUY RA từ dữ liệu có sẵn,
   liên kết với nhau bằng MÃ (không dùng tên):
     Tài khoản  -> studentId (HV...)                 (AuthStore)
     Khóa học   -> courseId  (KH...)                 (Store - admin)
     Đơn hàng   -> orders[].studentId + items[].courseId   (Store - admin)
     Bài học    -> lessons[].courseId                (LearningStore - giảng viên tạo)
     Bài tập    -> assignments[].lessonId            (LearningStore)
     Bài nộp    -> submissions[].studentId + assignmentId  (LearningStore)
     Kết quả    -> kho letdiv_results của LearningStore (score, comment, gradedAt) do giảng viên chấm
   Chỉ có 2 nhóm dữ liệu MỚI, riêng cho từng học viên (localStorage):
     letdiv_progress    : bài học nào đã hoàn thành   [{ studentId, courseId, lessonId, completedAt }]
     letdiv_study_last  : bài học học gần nhất của mỗi khóa  { studentId: { courseId: { lessonId, at } } }

   QUY TẮC QUYỀN HỌC: chỉ đơn hàng "Hoàn thành" mới cấp quyền học.
   Khóa học trong giỏ hàng / đơn đã hủy KHÔNG có quyền học.
   ========================================================= */
const STUDENT_KEYS = {
  progress: "letdiv_progress",
  lastStudy: "letdiv_study_last",
};

/* ---------------------------------------------------------
   Lớp CHUYỂN ĐỔI: LearningStore (dùng chung với trang Instructor) lưu bài học /
   bài tập / bài nộp với tên trường riêng. Các trang student đã viết theo tên
   trường dưới đây nên chuyển đổi ở đúng 1 chỗ này, không phải sửa từng trang:
     bài học : name        -> title   (+ chapter, imageUrl mặc định rỗng)
     bài tập : name        -> title,  description -> prompt,  deadline -> dueDate
     bài nộp : thêm status ("pending" | "graded"), score, feedback, gradedAt, history
               (điểm + nhận xét lấy từ kho kết quả letdiv_results)
   --------------------------------------------------------- */
const LearnAdapter = {
  lesson(l) {
    return l ? Object.assign({}, l, { title: l.name, chapter: l.chapter || "", imageUrl: l.imageUrl || "" }) : null;
  },
  assignment(a) {
    return a ? Object.assign({}, a, { title: a.name, prompt: a.description, dueDate: a.deadline }) : null;
  },
  submission(s, results) {
    const r = (results || LearningStore.resultMap())[s.id];
    return Object.assign({}, s, {
      status: r ? "graded" : "pending",
      score: r ? r.score : null,
      feedback: r ? r.comment : "",
      gradedAt: r ? r.gradedAt : null,
      history: s.history || [],
    });
  },
};

const StudentStore = {
  /* ---------- Đọc / ghi ---------- */
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },

  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  },

  /* =======================================================
     KHÓA HỌC ĐÃ MUA (suy ra từ đơn hàng hoàn thành, không trùng lặp)
     ======================================================= */
  // Ngày đơn hàng chuyển sang "Hoàn thành"
  completionDate(order) {
    const done = (order.history || []).filter((h) => h.status === "completed").pop();
    return done ? done.at : order.updatedAt || order.createdAt;
  },

  // Giảng viên phụ trách học viên ở 1 khóa = giảng viên của ĐỢT HỌC mà admin đã phân; chưa phân thì báo rõ
  instructorLabel(studentId, courseId) {
    const rec = Store.classOfStudent(studentId, courseId);
    if (!rec) return "Chưa được phân đợt học";
    const acc = AuthStore.getAccounts().find((a) => a.usernameKey === rec.instructor);
    return acc ? acc.fullName : rec.instructor;
  },

  // Đợt học của học viên ở 1 khóa: { id, name, range: "14/10/2026 - 14/04/2027", status } hoặc null
  batchOf(studentId, courseId) {
    const rec = Store.classOfStudent(studentId, courseId);
    const b = rec && rec.batchId ? Store.getBatch(rec.batchId) : null;
    if (!b) return null;
    const d = (s) => s.split("-").reverse().join("/");
    return { id: b.id, name: b.name, range: d(b.startDate) + " - " + d(b.endDate), status: Store.batchStatus(b) };
  },

  // Học viên đang đăng nhập (các trang student chỉ làm việc với chính học viên này)
  currentStudentId() {
    const u = AuthStore.currentUser();
    return u ? u.studentId : "";
  },

  ownedCourses(studentId) {
    const map = {};
    Store.ordersOfStudent(studentId).forEach((o) => {
      if (o.status !== "completed") return;
      const at = this.completionDate(o);
      o.items.forEach((it) => {
        const prev = map[it.courseId];
        if (prev && new Date(prev.boughtAt) <= new Date(at)) return; // mỗi khóa chỉ 1 dòng
        const live = Store.getCourse(it.courseId); // ưu tiên dữ liệu hiện tại, thiếu thì dùng bản lưu lúc mua
        map[it.courseId] = {
          courseId: it.courseId,
          name: live ? live.name : it.name,
          image: live ? live.image : it.image,
          instructor: this.instructorLabel(studentId, it.courseId),
          batch: this.batchOf(studentId, it.courseId),
          description: live ? live.description : "",
          href: live ? live.href : "",
          orderId: o.id,
          boughtAt: at,
          price: it.price,
        };
      });
    });
    return Object.values(map);
  },

  owns(studentId, courseId) {
    return this.ownedCourses(studentId).some((c) => c.courseId === courseId);
  },

  getOwned(studentId, courseId) {
    return this.ownedCourses(studentId).find((c) => c.courseId === courseId);
  },

  /* =======================================================
     BÀI HỌC (do giảng viên tạo - học viên chỉ thấy bài đang "hiển thị")
     ======================================================= */
  // Chỉ lấy bài học của ĐỢT mà học viên được phân vào (chưa phân đợt thì chưa có bài học nào)
  visibleLessons(courseId, studentId) {
    const rec = Store.classOfStudent(studentId || this.currentStudentId(), courseId);
    if (!rec || !rec.batchId) return [];
    return LearningStore.getLessons(rec.batchId).map(LearnAdapter.lesson).filter((l) => l.status === "visible");
  },

  // Nhóm bài học theo "chương học". Bài không ghi chương thuộc nhóm chung
  chaptersOf(courseId) {
    const groups = [];
    const index = {};
    this.visibleLessons(courseId).forEach((l) => {
      const name = (l.chapter || "").trim();
      if (!(name in index)) {
        index[name] = groups.length;
        groups.push({ name: name, title: name || "Nội dung khóa học", lessons: [] });
      }
      groups[index[name]].lessons.push(l);
    });
    return groups;
  },

  /* =======================================================
     TIẾN ĐỘ HỌC (riêng từng học viên)
     ======================================================= */
  doneSet(studentId) {
    const set = new Set();
    this.read(STUDENT_KEYS.progress, []).forEach((p) => {
      if (p.studentId === studentId) set.add(p.lessonId);
    });
    return set;
  },

  isDone(studentId, lessonId) {
    return this.doneSet(studentId).has(lessonId);
  },

  // Đánh dấu / bỏ đánh dấu hoàn thành. Chỉ học viên sở hữu khóa học mới được thực hiện
  setLessonDone(studentId, lessonId, done) {
    const lesson = this.getLesson(lessonId);
    if (!lesson || lesson.status !== "visible") return { ok: false, error: "Bài học không khả dụng." };
    if (!LearningStore.inBatch(studentId, lesson.batchId)) return { ok: false, error: "Bài học này không thuộc đợt học của bạn." };
    const list = this.read(STUDENT_KEYS.progress, []);
    const idx = list.findIndex((p) => p.studentId === studentId && p.lessonId === lessonId);
    if (done && idx < 0) list.push({ studentId: studentId, courseId: lesson.courseId, lessonId: lessonId, completedAt: new Date().toISOString() });
    if (!done && idx >= 0) list.splice(idx, 1);
    return this.write(STUDENT_KEYS.progress, list) ? { ok: true } : { ok: false, error: "Không lưu được tiến độ." };
  },

  // { done, total, percent, status: "learning" | "done" }
  courseProgress(studentId, courseId, doneSet) {
    const set = doneSet || this.doneSet(studentId);
    const lessons = this.visibleLessons(courseId, studentId);
    const done = lessons.filter((l) => set.has(l.id)).length;
    const total = lessons.length;
    return {
      done: done,
      total: total,
      percent: total ? Math.round((done / total) * 100) : 0,
      status: total > 0 && done === total ? "done" : "learning",
    };
  },

  totalLessonsDone(studentId) {
    const set = this.doneSet(studentId);
    let n = 0;
    this.ownedCourses(studentId).forEach((c) => {
      n += this.visibleLessons(c.courseId, studentId).filter((l) => set.has(l.id)).length;
    });
    return n;
  },

  /* ---------- Học gần nhất ---------- */
  recordVisit(studentId, courseId, lessonId) {
    const log = this.read(STUDENT_KEYS.lastStudy, {});
    log[studentId] = log[studentId] || {};
    log[studentId][courseId] = { lessonId: lessonId, at: new Date().toISOString() };
    this.write(STUDENT_KEYS.lastStudy, log);
  },

  lastVisit(studentId, courseId) {
    const log = this.read(STUDENT_KEYS.lastStudy, {});
    return (log[studentId] || {})[courseId] || null;
  },

  // Bài học để "Tiếp tục học": bài học gần nhất; nếu bài đó đã xong thì sang bài kế tiếp
  continueLesson(studentId, courseId) {
    const lessons = this.visibleLessons(courseId, studentId);
    if (lessons.length === 0) return null;
    const set = this.doneSet(studentId);
    const last = this.lastVisit(studentId, courseId);
    if (last) {
      const i = lessons.findIndex((l) => l.id === last.lessonId);
      if (i >= 0) return set.has(lessons[i].id) && lessons[i + 1] ? lessons[i + 1] : lessons[i];
    }
    return lessons.find((l) => !set.has(l.id)) || lessons[0];
  },

  // Địa chỉ trang học (từ các trang nằm trong student/pages)
  learnUrl(courseId, lessonId) {
    return "hoc-tap.html?course=" + encodeURIComponent(courseId) + (lessonId ? "&lesson=" + encodeURIComponent(lessonId) : "");
  },

  // Khóa học học gần đây (chưa học thì xếp theo ngày mua)
  recentCourses(studentId, limit) {
    return this.ownedCourses(studentId)
      .map((c) => {
        const last = this.lastVisit(studentId, c.courseId);
        return { ...c, studiedAt: last ? last.at : null, sortAt: last ? last.at : c.boughtAt };
      })
      .sort((a, b) => new Date(b.sortAt) - new Date(a.sortAt))
      .slice(0, limit);
  },

  /* =======================================================
     BÀI TẬP + BÀI NỘP + KẾT QUẢ
     ======================================================= */
  mySubmissions(studentId) {
    const results = LearningStore.resultMap();
    return LearningStore.read("submissions")
      .filter((s) => s.studentId === studentId)
      .map((s) => LearnAdapter.submission(s, results));
  },

  // Tra cứu 1 bài học / 1 bài tập / các bài tập của 1 bài học (đã chuyển sang tên trường của student)
  getLesson(id) {
    return LearnAdapter.lesson(LearningStore.getLesson(id));
  },
  getAssignment(id) {
    return LearnAdapter.assignment(LearningStore.getAssignment(id));
  },
  assignmentsOfLesson(lessonId) {
    return LearningStore.getAssignmentsOfLesson(lessonId).map(LearnAdapter.assignment);
  },

  // Gom thông tin 1 bài tập của học viên
  buildRow(a, lesson, course, sub) {
    const due = new Date(a.dueDate).getTime();
    return {
      a: a,
      lesson: lesson,
      course: course,
      instructor: course.instructor,
      sub: sub || null,
      submitted: !!sub,
      graded: !!sub && sub.status === "graded",
      key: !sub ? "none" : sub.status === "graded" ? "graded" : "pending", // chưa nộp / chờ chấm / đã chấm
      // Không có "đóng nộp bài" / "nộp muộn": nộp và nộp lại được cho đến khi được chấm điểm.
      // overdue chỉ để nhắc: quá hạn mà chưa nộp
      overdue: Date.now() > due,
      canSubmit: !(sub && sub.status === "graded"),
    };
  },

  // Bài tập thuộc các khóa học đã mua (bài học đang hiển thị), hạn nộp gần nhất trước
  assignmentsOf(studentId) {
    const subs = this.mySubmissions(studentId);
    const rows = [];
    this.ownedCourses(studentId).forEach((c) => {
      this.visibleLessons(c.courseId, studentId).forEach((l) => {
        this.assignmentsOfLesson(l.id).forEach((a) => {
          rows.push(this.buildRow(a, l, c, subs.find((s) => s.assignmentId === a.id)));
        });
      });
    });
    return rows.sort((x, y) => new Date(x.a.dueDate) - new Date(y.a.dueDate));
  },

  getAssignmentRow(studentId, assignmentId) {
    return this.assignmentsOf(studentId).find((r) => r.a.id === assignmentId);
  },

  // Quá hạn mà chưa nộp
  needsAttention(row) {
    return !row.submitted && row.overdue;
  },

  // Nộp bài (kiểm tra quyền học + chặn nộp lại bài đã chấm, phần còn lại do LearningStore.submitWork kiểm tra)
  submit(studentId, assignmentId, link) {
    const a = this.getAssignment(assignmentId);
    if (!a) return { ok: false, error: "Không tìm thấy bài tập." };
    const lesson = this.getLesson(a.lessonId);
    if (!lesson || lesson.status !== "visible") return { ok: false, error: "Bài tập này hiện không khả dụng." };
    if (!LearningStore.inBatch(studentId, lesson.batchId)) return { ok: false, error: "Bài tập này không thuộc đợt học của bạn." };
    const existing = this.mySubmissions(studentId).find((s) => s.assignmentId === assignmentId);
    if (existing && existing.status === "graded") return { ok: false, error: "Bài đã được chấm điểm nên không thể nộp lại." };
    return LearningStore.submitWork(studentId, assignmentId, link);
  },

  // Các bài đã nộp (chờ chấm + đã chấm) kèm đề bài; mới nộp trước
  resultRows(studentId) {
    const rows = [];
    this.mySubmissions(studentId).forEach((s) => {
      const a = this.getAssignment(s.assignmentId);
      const lesson = a ? this.getLesson(a.lessonId) : null;
      const course = lesson ? Store.getCourse(lesson.courseId) : null;
      if (!a || !lesson || !course) return;
      rows.push(this.buildRow(a, lesson, { courseId: course.id, name: course.name, instructor: this.instructorLabel(studentId, course.id) }, s));
    });
    return rows.sort((x, y) => new Date(y.sub.gradedAt || y.sub.submittedAt) - new Date(x.sub.gradedAt || x.sub.submittedAt));
  },

  // Điểm trung bình quy về thang 10 (null nếu chưa có bài nào được chấm)
  averageScore(rows) {
    const graded = rows.filter((r) => r.graded);
    if (graded.length === 0) return null;
    const sum = graded.reduce((t, r) => t + (r.sub.score / r.a.maxScore) * 10, 0);
    return Math.round((sum / graded.length) * 100) / 100;
  },

  /* =======================================================
     HOẠT ĐỘNG GẦN ĐÂY (suy ra từ dữ liệu: mua khóa, học bài, nộp bài, nhận điểm)
     ======================================================= */
  activities(studentId, limit) {
    const items = [];
    Store.ordersOfStudent(studentId).forEach((o) => {
      if (o.status !== "completed") return;
      items.push({ type: "order", at: this.completionDate(o), text: "Mua khóa học: " + o.items.map((i) => i.name).join(", "), href: "khoa-hoc-cua-toi.html" });
    });
    this.read(STUDENT_KEYS.progress, []).forEach((p) => {
      if (p.studentId !== studentId) return;
      const l = this.getLesson(p.lessonId);
      if (l) items.push({ type: "lesson", at: p.completedAt, text: 'Hoàn thành bài "' + l.title + '"', href: this.learnUrl(l.courseId, l.id) });
    });
    this.mySubmissions(studentId).forEach((s) => {
      const a = this.getAssignment(s.assignmentId);
      if (!a) return;
      items.push({ type: "submit", at: s.submittedAt, text: 'Nộp bài tập "' + a.title + '"', href: "bai-tap-cua-toi.html?assignment=" + a.id });
      if (s.status === "graded") {
        items.push({ type: "grade", at: s.gradedAt, text: 'Nhận điểm ' + s.score + "/" + a.maxScore + ' cho bài "' + a.title + '"', href: "ket-qua-hoc-tap.html?submission=" + s.id });
      }
    });
    return items.sort((x, y) => new Date(y.at) - new Date(x.at)).slice(0, limit);
  },
};
