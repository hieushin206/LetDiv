/* =========================================================
   ui.js - Các hàm giao diện dùng chung cho các trang quản trị
   (định dạng tiền/ngày, modal, thông báo, hộp xác nhận, phân trang)
   ========================================================= */

const UI = {
  /* ---------- Định dạng ---------- */
  money(n) {
    return Number(n || 0).toLocaleString("vi-VN") + " đ";
  },

  date(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  },

  time(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  },

  dateTime(iso) {
    return this.time(iso) + " - " + this.date(iso);
  },

  // Chống chèn HTML khi in dữ liệu người dùng nhập vào innerHTML
  esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  // Bỏ dấu + chữ thường để tìm kiếm tiếng Việt không phân biệt dấu
  normalize(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "d")
      .toLowerCase()
      .trim();
  },

  // Đường dẫn ảnh: ảnh của website lưu dạng "assets/images/..." (tính từ thư mục gốc)
  // còn trang admin nằm ở admin/pages/ nên cần thêm "../../"
  img(path) {
    if (!path) return "";
    if (/^(data:|https?:|\/)/.test(path)) return path;
    return "../../" + path;
  },

  initials(name) {
    const parts = String(name).trim().split(/\s+/);
    return (parts[parts.length - 1][0] || "?").toUpperCase();
  },

  // Badge trạng thái đơn hàng
  orderBadge(status) {
    const cls = { completed: "badge-success", cancelled: "badge-danger" }[status] || "badge-muted";
    return '<span class="badge ' + cls + '">' + (ORDER_STATUS[status] || status) + "</span>";
  },

  debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  },

  /* ---------- Thông báo nhỏ (toast) ---------- */
  toast(message, type) {
    let box = document.getElementById("toast-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "toast-box";
      document.body.appendChild(box);
    }
    const icon = { success: "fa-circle-check", error: "fa-circle-exclamation", info: "fa-circle-info" }[type || "success"];
    const el = document.createElement("div");
    el.className = "toast toast-" + (type || "success");
    el.innerHTML = '<i class="fa-solid ' + icon + '"></i><span>' + this.esc(message) + "</span>";
    box.appendChild(el);
    setTimeout(() => el.classList.add("hide"), 2800);
    setTimeout(() => el.remove(), 3200);
  },

  /* ---------- Modal ---------- */
  openModal(id) {
    document.getElementById(id).classList.add("open");
    document.body.classList.add("modal-open");
  },

  closeModal(id) {
    document.getElementById(id).classList.remove("open");
    if (!document.querySelector(".modal-overlay.open")) document.body.classList.remove("modal-open");
  },

  // Gắn sự kiện đóng modal: bấm nền mờ, nút có data-close, phím Esc
  bindModals() {
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("mousedown", (e) => {
        if (e.target === overlay && !overlay.hasAttribute("data-static")) this.closeModal(overlay.id);
      });
      overlay.querySelectorAll("[data-close]").forEach((btn) => {
        btn.addEventListener("click", () => this.closeModal(overlay.id));
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const opened = document.querySelectorAll(".modal-overlay.open");
      if (opened.length) this.closeModal(opened[opened.length - 1].id);
    });
  },

  /*
   * Hộp thoại xác nhận (trả về Promise<boolean>)
   * options: { title, message (HTML - nhớ UI.esc dữ liệu người dùng), okText, danger, hideCancel }
   */
  confirm(options) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay open confirm-overlay";
      overlay.innerHTML =
        '<div class="modal-box modal-sm">' +
        '<div class="confirm-body">' +
        '<div class="confirm-icon ' + (options.danger ? "danger" : "info") + '"><i class="fa-solid ' + (options.icon || (options.danger ? "fa-triangle-exclamation" : "fa-circle-question")) + '"></i></div>' +
        "<h3>" + this.esc(options.title) + "</h3>" +
        "<p>" + options.message + "</p>" +
        "</div>" +
        '<div class="modal-footer center">' +
        (options.hideCancel ? "" : '<button class="btn btn-outline" data-act="no">Hủy</button>') +
        '<button class="btn ' + (options.danger ? "btn-danger" : "btn-primary") + '" data-act="yes">' + (options.okText || "Đồng ý") + "</button>" +
        "</div></div>";
      document.body.appendChild(overlay);
      document.body.classList.add("modal-open");

      const finish = (result) => {
        overlay.remove();
        if (!document.querySelector(".modal-overlay.open")) document.body.classList.remove("modal-open");
        document.removeEventListener("keydown", onKey);
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === "Escape") finish(false);
      };
      document.addEventListener("keydown", onKey);
      overlay.addEventListener("mousedown", (e) => {
        if (e.target === overlay) finish(false);
      });
      overlay.querySelector('[data-act="yes"]').addEventListener("click", () => finish(true));
      const no = overlay.querySelector('[data-act="no"]');
      if (no) no.addEventListener("click", () => finish(false));
    });
  },

  // Thông báo 1 nút "Đã hiểu"
  alert(title, message) {
    return this.confirm({ title: title, message: message, okText: "Đã hiểu", hideCancel: true, danger: true });
  },

  /* ---------- Phân trang ---------- */
  pager(container, total, page, size, onChange) {
    const pages = Math.max(1, Math.ceil(total / size));
    if (total <= size) {
      container.innerHTML = "";
      return;
    }
    const from = (page - 1) * size + 1;
    const to = Math.min(total, page * size);
    let html = '<span class="pager-info">Hiển thị ' + from + "–" + to + " / " + total + "</span><div class=\"pager-btns\">";
    html += '<button data-page="' + (page - 1) + '"' + (page === 1 ? " disabled" : "") + '><i class="fa-solid fa-chevron-left"></i></button>';
    for (let i = 1; i <= pages; i++) {
      html += '<button data-page="' + i + '" class="' + (i === page ? "active" : "") + '">' + i + "</button>";
    }
    html += '<button data-page="' + (page + 1) + '"' + (page === pages ? " disabled" : "") + '><i class="fa-solid fa-chevron-right"></i></button></div>';
    container.innerHTML = html;
    container.querySelectorAll("button[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => onChange(Number(btn.dataset.page)));
    });
  },

  /* ---------- Hiển thị lỗi cho form ---------- */
  // errors: { tenTruong: "thông báo" } - mỗi input có id "f-tenTruong", chỗ báo lỗi id "e-tenTruong"
  showErrors(errors, fields) {
    fields.forEach((name) => {
      const input = document.getElementById("f-" + name);
      const msg = document.getElementById("e-" + name);
      if (input) input.classList.toggle("invalid", !!errors[name]);
      if (msg) msg.textContent = errors[name] || "";
    });
    const first = fields.find((name) => errors[name]);
    if (first) {
      const el = document.getElementById("f-" + first);
      if (el) el.focus();
    }
  },

  clearErrors(fields) {
    this.showErrors({}, fields);
  },

  /* ---------- Thu nhỏ ảnh tải lên để tiết kiệm localStorage ---------- */
  resizeImage(file, maxWidth, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => callback(null);
      img.src = e.target.result;
    };
    reader.onerror = () => callback(null);
    reader.readAsDataURL(file);
  },

  /* ---------- Đồng bộ menu bên trái của trang admin/index.html ---------- */
  notifyParent() {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "letdiv-admin-page", page: location.pathname.split("/").pop() }, "*");
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  UI.bindModals();
  UI.notifyParent();
});
