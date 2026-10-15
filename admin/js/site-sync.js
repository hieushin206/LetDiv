/* =========================================================
   site-sync.js - Đồng bộ KHÓA HỌC giữa file HTML của website và trang Admin
   ---------------------------------------------------------
   Nguồn danh sách khóa học = các khối .inner-box trong courses/course.html
   (mỗi khối: ảnh, tên, đường dẫn tới trang chi tiết). Giá lấy từ trang chi tiết
   (khối .inner-price). Mỗi lần mở trang Admin, SiteSync.run() đọc lại file HTML:

     - THÊM 1 khối khóa học mới trong HTML  -> admin tự có khóa học mới
       (chưa có danh mục: vào trang Danh mục để thêm vào danh mục).
     - SỬA tên / ảnh / giá trong HTML        -> admin cập nhật theo.
     - XÓA khối khỏi HTML                    -> khóa học VẪN GIỮ trong admin (không còn mục "Đã gỡ khỏi website").
       Muốn khóa không hiện trên website thì dùng công tắc Hiển thị / Đang ẩn ở trang Khóa học.

   Chiều ngược lại (admin sửa -> website đổi theo) do assets/js/course-sync.js đảm nhiệm.

   Cách tránh ghi đè lẫn nhau: mỗi khóa lưu "ảnh chụp" htmlSnap = giá trị lần đọc HTML trước.
   Chỉ khi giá trị trong HTML THAY ĐỔI so với ảnh chụp thì HTML mới ghi đè lên admin;
   còn lại giữ nguyên chỉnh sửa của admin.

   Cần chạy qua máy chủ (Live Server...). Mở file trực tiếp (file://) trình duyệt không cho đọc nên bỏ qua.
   ========================================================= */
const SiteSync = {
  // Đường dẫn gốc website tính từ trang admin hiện tại (admin/pages/x.html -> ../../)
  rootUrl() {
    return new URL("../../", location.href);
  },

  // "/project/courses/a.html" -> "courses/a.html" (đúng dạng trường href lưu trong Store)
  toSitePath(href, base) {
    if (!href || /^(data:|https?:)/i.test(href)) return href || "";
    const u = new URL(href, base);
    const root = this.rootUrl().pathname;
    return u.pathname.startsWith(root) ? u.pathname.slice(root.length) : u.pathname.replace(/^\//, "");
  },

  vnd(text) {
    return Number(String(text || "").replace(/\D/g, "")) || 0;
  },

  clean(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  },

  // Đọc các khối khóa học trong trang danh sách khóa học
  parseCatalog(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const found = [];
    const seen = new Set();
    doc.querySelectorAll(".inner-box").forEach((box) => {
      const link = box.querySelector(".content a[href]") || box.querySelector(".img a[href]");
      const img = box.querySelector(".img img");
      if (!link || !/\.html?$/i.test(link.getAttribute("href"))) return;
      const href = this.toSitePath(link.getAttribute("href"), baseUrl);
      if (seen.has(href)) return;
      seen.add(href);
      found.push({
        href: href,
        name: this.clean(link.textContent),
        image: img ? this.toSitePath(img.getAttribute("src"), baseUrl) : "",
      });
    });
    return found;
  },

  // Đọc giá + mô tả ngắn từ trang chi tiết (null nếu không đọc được)
  async fetchDetail(href) {
    try {
      const url = new URL(href, this.rootUrl());
      const res = await fetch(url.href, { cache: "no-store" });
      if (!res.ok) return null;
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const priceBox = doc.querySelector(".inner-price .price");
      if (!priceBox) return null;
      const del = priceBox.querySelector("del");
      const main = Array.from(priceBox.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join("");
      const intro = doc.querySelector(".inner-content > p");
      return { price: this.vnd(main), oldPrice: del ? this.vnd(del.textContent) : 0, description: intro ? this.clean(intro.textContent).slice(0, 300) : "" };
    } catch (e) {
      return null;
    }
  },

  // Chạy đồng bộ. Trả về { ok, changed, added, updated, removed, restored }
  async run() {
    const result = { ok: false, changed: false, added: 0, updated: 0, removed: 0, restored: 0 };
    let found;
    try {
      const url = new URL("courses/course.html", this.rootUrl());
      const res = await fetch(url.href, { cache: "no-store" });
      if (!res.ok) return result;
      found = this.parseCatalog(await res.text(), url.href);
    } catch (e) {
      return result; // mở bằng file:// hoặc không có mạng nội bộ: bỏ qua, admin vẫn dùng dữ liệu đang có
    }
    if (found.length === 0) return result; // đọc lỗi thì không động vào dữ liệu

    const details = await Promise.all(found.map((f) => this.fetchDetail(f.href)));
    const list = Store.get("courses");
    const now = new Date().toISOString();
    const byHref = {};
    list.forEach((c) => {
      if (c.href) byHref[c.href.toLowerCase()] = c;
    });

    found.forEach((f, i) => {
      const d = details[i];
      const html = { name: f.name, image: f.image };
      if (d) {
        html.price = d.price;
        html.oldPrice = d.oldPrice;
      }
      const course = byHref[f.href.toLowerCase()];

      // --- Khối mới trong HTML -> khóa học mới ---
      if (!course) {
        const item = {
          id: Store.nextId("KH", list, 3),
          name: f.name,
          image: f.image,
          price: d ? d.price : 0,
          oldPrice: d ? d.oldPrice : 0,
          categoryId: "",
          instructor: "",
          instructors: [],
          description: d ? d.description : "",
          status: "active",
          deleted: false,
          href: f.href,
          createdAt: now,
          htmlSnap: Object.assign({ oldPrice: 0, price: 0 }, html),
        };
        list.push(item);
        byHref[f.href.toLowerCase()] = item;
        result.added++;
        return;
      }

      // --- Khóa từng bị đánh dấu "đã gỡ" (dữ liệu cũ) mà khối vẫn có trong HTML -> khôi phục ---
      if (course.deleted) {
        course.deleted = false;
        course.siteRemoved = false;
        delete course.deletedAt;
        course.status = course.statusBeforeRemoval || "active"; // trở về đúng trạng thái trước khi bị gỡ
        delete course.statusBeforeRemoval;
        result.restored++;
      }

      // --- Cập nhật theo HTML (chỉ field mà HTML vừa thay đổi) ---
      if (!course.htmlSnap) {
        course.htmlSnap = Object.assign({}, html); // lần đầu: chỉ ghi nhớ, giữ nguyên chỉnh sửa của admin
        return;
      }
      let touched = false;
      Object.keys(html).forEach((field) => {
        if (html[field] !== course.htmlSnap[field]) {
          course[field] = html[field];
          course.htmlSnap[field] = html[field];
          touched = true;
        }
      });
      if (touched) result.updated++;
    });

    // --- Không còn tự "gỡ" khóa học khi khối bị xóa khỏi HTML ---
    // Khóa nào còn sót cờ deleted từ phiên bản cũ (khối không còn trong HTML) -> hiện lại ở trạng thái ẩn để admin tự quyết định
    list.forEach((c) => {
      if (c.deleted) {
        c.deleted = false;
        c.siteRemoved = false;
        delete c.deletedAt;
        c.status = "hidden";
        delete c.statusBeforeRemoval;
        result.restored++;
      }
    });

    result.ok = true;
    result.changed = result.added + result.updated + result.removed + result.restored > 0;
    // Luôn ghi lại: lần đầu cần lưu ảnh chụp htmlSnap cho các khóa cũ
    Store.set("courses", list);
    return result;
  },

  // Thông báo ngắn gọn về kết quả đồng bộ
  describe(r) {
    const parts = [];
    if (r.added) parts.push(r.added + " khóa học mới");
    if (r.updated) parts.push(r.updated + " khóa học được cập nhật");
    if (r.removed) parts.push(r.removed + " khóa học đã bị gỡ");
    if (r.restored) parts.push(r.restored + " khóa học quay lại");
    return "Đồng bộ từ trang khóa học: " + parts.join(", ") + ".";
  },
};
