/* =========================================================
   student-ui.js - Hàm giao diện dùng chung cho các trang học viên
   (dùng cùng UI trong admin/js/ui.js: toast, modal, hộp xác nhận, định dạng...)
   ========================================================= */
const SUI = {
  // Chỉ khách hàng (học viên) đang đăng nhập mới được vào. Sai thì đưa về trang đúng quyền
  requireStudent() {
    const user = AuthStore.currentUser();
    const top = window.top || window;
    if (!user) {
      top.location.replace("/auth/login.html?next=" + encodeURIComponent("/student/index.html"));
      return null;
    }
    if (user.role !== "customer" || !user.studentId) {
      top.location.replace(AuthStore.homeFor(user));
      return null;
    }
    return user;
  },

  // Báo cho khung ngoài (student/index.html) biết trang đang mở để menu bên trái sáng đúng mục
  notifyNav(page) {
    if (window.parent !== window) window.parent.postMessage({ type: "letdiv-student-page", page: page }, "*");
  },

  query(name) {
    return new URLSearchParams(location.search).get(name) || "";
  },

  setQuery(params) {
    const q = new URLSearchParams();
    Object.keys(params).forEach((k) => params[k] && q.set(k, params[k]));
    history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q.toString() : ""));
  },

  safeUrl(url) {
    return /^https?:\/\//i.test(String(url || "").trim()) ? String(url).trim() : "";
  },

  shortUrl(url) {
    return String(url).replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
  },

  dueText(str) {
    return UI.dateTime(new Date(str).toISOString());
  },

  // Còn bao lâu / đã quá hạn
  dueBadge(row) {
    if (row.submitted) return "";
    const diff = new Date(row.a.dueDate).getTime() - Date.now();
    if (diff < 0) return '<span class="badge badge-danger no-dot">Quá hạn</span>';
    const hours = Math.ceil(diff / 3600000);
    return '<span class="badge ' + (hours <= 72 ? "badge-warning" : "badge-info") + ' no-dot">' + (hours < 24 ? "Còn " + hours + " giờ" : "Còn " + Math.ceil(hours / 24) + " ngày") + "</span>";
  },

  // Trạng thái bài tập của học viên: Chưa nộp / Chờ chấm / Đã chấm
  assignBadge(row) {
    let html;
    if (row.key === "graded") html = '<span class="badge badge-success">Đã chấm</span>';
    else if (row.key === "pending") html = '<span class="badge badge-warning">Chờ chấm</span>';
    else html = '<span class="badge badge-muted">Chưa nộp</span>';
    return html;
  },

  scoreText(row) {
    return row.graded ? '<span class="score-pill">' + row.sub.score + " / " + row.a.maxScore + "</span>" : '<span class="text-muted">—</span>';
  },

  // Thanh tiến độ
  progressBar(p) {
    return '<div class="progress ' + (p.status === "done" ? "green" : "") + '"><span style="width:' + p.percent + '%"></span></div>';
  },

  statusBadge(p) {
    if (p.total === 0) return '<span class="badge badge-muted no-dot">Sắp có nội dung</span>';
    return p.status === "done" ? '<span class="badge badge-success">Hoàn thành</span>' : '<span class="badge badge-info">Đang học</span>';
  },

  // Link video YouTube -> link nhúng. Video khác chỉ hiện nút mở tab mới
  videoEmbed(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      let id = "";
      if (host === "youtu.be") id = u.pathname.slice(1);
      else if (host === "youtube.com" && u.pathname === "/watch") id = u.searchParams.get("v") || "";
      else if (host === "youtube.com" && u.pathname.indexOf("/embed/") === 0) id = u.pathname.split("/")[2];
      return /^[\w-]{6,20}$/.test(id) ? "https://www.youtube-nocookie.com/embed/" + id : "";
    } catch (e) {
      return "";
    }
  },

  // "5 phút trước", "3 giờ trước", "2 ngày trước", cũ hơn thì hiện ngày
  ago(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "Vừa xong";
    if (min < 60) return min + " phút trước";
    if (min < 1440) return Math.floor(min / 60) + " giờ trước";
    if (min < 10080) return Math.floor(min / 1440) + " ngày trước";
    return UI.date(iso);
  },

  noCourseHtml() {
    return (
      '<div class="card"><div class="empty-state"><i class="fa-solid fa-graduation-cap"></i><h3>Bạn chưa có khóa học nào</h3>' +
      "<p>Chỉ khóa học thuộc đơn hàng đã <b>thanh toán thành công</b> mới có quyền học. Khóa học trong giỏ hàng hoặc đơn đã hủy không được tính.</p>" +
      '<a class="btn btn-primary" style="margin-top:12px" href="/courses/course.html" target="_top"><i class="fa-solid fa-book-open"></i> Khám phá khóa học</a></div></div>'
    );
  },
};
