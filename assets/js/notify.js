/* =========================================================
   notify.js - Chuông thông báo (fa-bell trong .cart-bell) cho 3 trang:
   admin/index.html, instructor/index.html, student/index.html
   ---------------------------------------------------------
   Gắn:  <script src="/assets/js/notify.js" data-role="admin|instructor|student"></script>
   (đặt SAU các file seed-data, store, auth-store, learning-store)

   Thông báo được SUY RA từ dữ liệu có sẵn (không lưu trùng):
     admin      : lượt mua đã thanh toán nhưng CHƯA được phân vào đợt học
     instructor : học viên nộp bài tập thuộc các đợt của giảng viên
                  (học viên bị vô hiệu hóa không được tính)
     student    : có bài tập mới được giao, hoặc bài tập sắp hết hạn (< 48 giờ, chưa nộp)
   Chỉ có 1 dữ liệu riêng được lưu: danh sách mã thông báo ĐÃ XEM của từng tài khoản.

   Cách hoạt động:
   - Icon chuông hiện số thông báo CHƯA XEM (ẩn khi = 0).
   - Bấm chuông: hiện danh sách, mới nhất ở trên, kèm thời gian nhận.
     Chỉ thấy tối đa 5 thông báo, còn lại cuộn chuột để xem.
   - Thông báo chưa xem có nền đậm hơn. Mở chuông là coi như đã xem:
     số trên icon biến mất, lần mở sau các thông báo đó có nền bình thường.
   - Bấm 1 thông báo: chuyển trang trong khung nội dung tới nơi liên quan.
   ========================================================= */
(function () {
  const script = document.currentScript;
  const ROLE = (script && script.dataset.role) || "admin";
  const MAX_VISIBLE = 5; // số thông báo thấy được cùng lúc, còn lại cuộn
  const MAX_ITEMS = 50; // số thông báo tối đa giữ trong danh sách
  const SOON_HOURS = 48; // bài tập còn dưới số giờ này thì báo "sắp hết hạn"
  const READ_KEY = "letdiv_notif_read";

  const bell = document.querySelector(".cart-bell");
  if (!bell) return;
  const btn = bell.querySelector(".btn-bell");
  const frame = document.querySelector("iframe[name=content]");

  // Các file dữ liệu do role-guard.js nạp (seed-data, store, auth-store) nên chưa chắc đã có ngay khi file này chạy.
  // Đợi đủ rồi mới dựng chuông; learning-store.js chưa có thì tự nạp (đúng 1 lần, không nạp trùng).
  function ready(cb) {
    let tries = 0;
    (function wait() {
      if (typeof Store !== "undefined" && typeof AuthStore !== "undefined") {
        if (typeof LearningStore !== "undefined") return cb();
        const el = document.createElement("script");
        el.src = "/assets/js/learning-store.js";
        el.onload = cb;
        document.head.appendChild(el);
        return;
      }
      if (++tries < 200) setTimeout(wait, 50); // tối đa ~10 giây
    })();
  }

  function main() {

  /* ---------- Người dùng + trạng thái đã xem ---------- */
  function currentUser() {
    try {
      return AuthStore.currentUser();
    } catch (e) {
      return null;
    }
  }
  function userKey() {
    const u = currentUser();
    return ROLE + ":" + (u ? String(u.username).toLowerCase() : "guest");
  }
  function readSet() {
    try {
      const all = JSON.parse(localStorage.getItem(READ_KEY)) || {};
      return new Set(all[userKey()] || []);
    } catch (e) {
      return new Set();
    }
  }
  function saveRead(set) {
    try {
      const all = JSON.parse(localStorage.getItem(READ_KEY)) || {};
      all[userKey()] = Array.from(set).slice(-500); // chỉ nhớ 500 mã gần nhất
      localStorage.setItem(READ_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  /* ---------- Tạo danh sách thông báo theo từng quyền ---------- */
  function forAdmin() {
    return Store.unassignedItems().map(function (x) {
      return {
        id: "order:" + x.order.id + ":" + x.item.courseId,
        icon: "fa-cart-shopping",
        title: "Đơn " + x.order.id + " chưa phân đợt",
        text: (x.order.studentName || x.order.studentId) + " đã mua khóa " + x.item.name,
        time: x.order.createdAt,
        url: "pages/don-hang.html?status=unassigned",
      };
    });
  }

  function forInstructor() {
    const user = currentUser();
    if (!user) return [];
    const batches = LearningStore.myBatches(user);
    const batchName = {};
    batches.forEach(function (b) {
      batchName[b.id] = b.name;
    });
    const assignments = {};
    const lessons = {};
    LearningStore.getLessonsOfBatches(batches.map(function (b) { return b.id; })).forEach(function (l) {
      lessons[l.id] = l;
    });
    LearningStore.getAssignmentsOfBatches(batches.map(function (b) { return b.id; })).forEach(function (a) {
      assignments[a.id] = a;
    });
    const list = [];
    LearningStore.read("submissions").forEach(function (s) {
      const a = assignments[s.assignmentId];
      // isMyStudent đã loại học viên bị vô hiệu hóa / không thuộc đợt của giảng viên
      if (!a || !LearningStore.isMyStudentOfLesson(user, lessons[a.lessonId], s.studentId)) return;
      const st = Store.getStudent(s.studentId);
      const bId = LearningStore.batchIdOfStudent(s.studentId, a.courseId);
      list.push({
        id: "sub:" + s.id + ":" + s.submittedAt, // nộp lại => thông báo mới
        icon: "fa-inbox",
        title: (st ? st.name : s.studentId) + " đã nộp bài",
        text: a.name + " · " + (batchName[bId] || ""),
        time: s.submittedAt,
        url: "pages/bai-nop.html?assignment=" + encodeURIComponent(a.id),
      });
    });
    return list;
  }

  function forStudent() {
    const user = currentUser();
    if (!user || !user.studentId) return [];
    const now = Date.now();
    const list = [];
    LearningStore.assignmentsForStudent(user.studentId).forEach(function (x) {
      const a = x.assignment;
      // 1) Bài tập mới được giao
      list.push({
        id: "new:" + a.id,
        icon: "fa-list-check",
        title: "Bài tập mới được giao",
        text: a.name + (x.courseName ? " · " + x.courseName : ""),
        time: a.createdAt,
        url: "pages/bai-tap-cua-toi.html",
      });
      // 2) Sắp hết hạn nộp (chưa nộp, còn dưới 48 giờ)
      const due = new Date(a.deadline).getTime();
      if (!x.submission && due > now && due - now <= SOON_HOURS * 3600000) {
        const left = Math.max(1, Math.round((due - now) / 3600000));
        list.push({
          id: "due:" + a.id + ":" + a.deadline,
          icon: "fa-hourglass-half",
          title: "Sắp hết hạn nộp bài",
          text: a.name + " · còn khoảng " + left + " giờ",
          time: new Date(due - SOON_HOURS * 3600000).toISOString(), // lúc bắt đầu "sắp hết hạn"
          url: "pages/bai-tap-cua-toi.html",
        });
      }
    });
    return list;
  }

  function build() {
    let list = [];
    try {
      list = ROLE === "admin" ? forAdmin() : ROLE === "instructor" ? forInstructor() : forStudent();
    } catch (e) {
      console.error("Không tạo được thông báo:", e);
    }
    const now = Date.now();
    return list
      .filter(function (n) { return n.time && new Date(n.time).getTime() <= now; }) // chưa tới giờ thì chưa báo
      .sort(function (a, b) { return new Date(b.time) - new Date(a.time); }) // mới nhất trước
      .slice(0, MAX_ITEMS);
  }

  /* ---------- Hiển thị ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtTime(iso) {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    let rel;
    if (min < 1) rel = "Vừa xong";
    else if (min < 60) rel = min + " phút trước";
    else if (min < 1440) rel = Math.floor(min / 60) + " giờ trước";
    else if (min < 43200) rel = Math.floor(min / 1440) + " ngày trước";
    else rel = "";
    const abs = pad(d.getHours()) + ":" + pad(d.getMinutes()) + " " + pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
    return abs + (rel ? " · " + rel : "");
  }

  // Huy hiệu số thông báo chưa xem trên icon
  const badge = document.createElement("span");
  badge.className = "notif-badge";
  badge.style.display = "none";
  bell.style.position = "relative";
  btn.appendChild(badge);

  // Hộp danh sách (dùng position: fixed để không bị cắt bởi header / iframe)
  const box = document.createElement("div");
  box.className = "notif-box";
  box.innerHTML = '<div class="notif-head">Thông báo</div><div class="notif-list"></div>';
  document.body.appendChild(box);
  const listEl = box.querySelector(".notif-list");

  let items = [];
  let unreadIds = new Set();

  function refreshBadge() {
    items = build();
    const read = readSet();
    unreadIds = new Set(items.filter(function (n) { return !read.has(n.id); }).map(function (n) { return n.id; }));
    const count = unreadIds.size;
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.style.display = count > 0 ? "" : "none";
  }

  function renderList() {
    if (items.length === 0) {
      listEl.innerHTML = '<div class="notif-empty"><i class="fa-regular fa-bell-slash"></i>Chưa có thông báo nào</div>';
      return;
    }
    listEl.innerHTML = items
      .map(function (n, i) {
        return (
          '<a href="#" class="notif-item' + (unreadIds.has(n.id) ? " unread" : "") + '" data-i="' + i + '">' +
          '<span class="notif-icon"><i class="fa-solid ' + n.icon + '"></i></span>' +
          '<span class="notif-body"><span class="notif-title">' + esc(n.title) + "</span>" +
          '<span class="notif-text">' + esc(n.text) + "</span>" +
          '<span class="notif-time">' + esc(fmtTime(n.time)) + "</span></span></a>"
        );
      })
      .join("");
  }

  function place() {
    const r = btn.getBoundingClientRect();
    const w = Math.min(360, window.innerWidth - 16);
    let left = r.right - w;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    box.style.width = w + "px";
    box.style.left = left + "px";
    box.style.top = r.bottom + 8 + "px";
  }

  function open() {
    refreshBadge();
    renderList(); // vẽ trước (còn nền "chưa xem"), rồi mới đánh dấu đã xem
    place();
    box.classList.add("show");
    listEl.scrollTop = 0;
    // Mở chuông = đã xem: ẩn số trên icon, lần mở sau nền các thông báo này sẽ nhạt lại
    const read = readSet();
    items.forEach(function (n) { read.add(n.id); });
    saveRead(read);
    badge.style.display = "none";
  }
  function close() {
    box.classList.remove("show");
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    box.classList.contains("show") ? close() : open();
  });
  document.addEventListener("click", function (e) {
    if (!box.contains(e.target) && !bell.contains(e.target)) close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });
  window.addEventListener("resize", function () {
    if (box.classList.contains("show")) place();
  });

  // Bấm vào 1 thông báo: mở trang liên quan trong khung nội dung
  listEl.addEventListener("click", function (e) {
    const a = e.target.closest(".notif-item");
    if (!a) return;
    e.preventDefault();
    const n = items[Number(a.dataset.i)];
    close();
    if (n && n.url && frame) frame.src = n.url;
  });

  // Cập nhật số khi dữ liệu đổi (trang con ghi localStorage), khi quay lại tab, và mỗi phút
  window.addEventListener("storage", function () {
    refreshBadge();
    if (box.classList.contains("show")) renderList();
  });
  window.addEventListener("focus", refreshBadge);
  setInterval(refreshBadge, 60000);

  refreshBadge();
  }

  ready(main);
})();
