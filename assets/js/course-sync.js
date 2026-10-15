/* =========================================================
   course-sync.js - Áp dụng chỉnh sửa khóa học của ADMIN lên các trang chính
   (trang chủ, danh sách khóa học, trang chi tiết khóa học).
   ---------------------------------------------------------
   Được header-auth.js nạp và gọi trên mọi trang. Với mỗi khóa học trong Store:
   - Khóa bị ẨN (admin tắt hiển thị): khối khóa học biến mất khỏi trang chủ + trang khóa học;
     trang chi tiết hiện thông báo và nút "Thêm Vào Giỏ" bị vô hiệu hóa.
   - Admin sửa TÊN / ẢNH / GIÁ: các khối và trang chi tiết đổi theo.
   Chỉ ghi đè khi giá trị khác với bản đã đọc từ file HTML (course.htmlSnap), nên nội dung
   trong file HTML được giữ nguyên nếu admin chưa chỉnh gì.
   (Chiều ngược lại - sửa file HTML thì admin cập nhật - do admin/js/site-sync.js làm.)
   ========================================================= */
const CourseSync = (function () {
  function pathOf(href) {
    try {
      return new URL(href, location.href).pathname.toLowerCase();
    } catch (e) {
      return "";
    }
  }

  // Tìm khóa học ứng với 1 đường dẫn (khớp phần đuôi: courses/react.html)
  function findCourse(courses, href) {
    const path = pathOf(href);
    if (!path) return null;
    return courses.find((c) => c.href && path.endsWith("/" + c.href.toLowerCase())) || null;
  }

  // Giá trị admin đã sửa so với bản đọc từ HTML?
  function changed(c, field) {
    return !!c.htmlSnap && c[field] !== c.htmlSnap[field];
  }

  // Đường dẫn ảnh tính từ gốc website (ảnh tải lên là dữ liệu base64 thì giữ nguyên)
  function imgSrc(src) {
    if (!src) return "";
    return /^(data:|https?:|\/)/i.test(src) ? src : "/" + src;
  }

  function money(n) {
    return Number(n).toLocaleString("vi-VN") + " đ";
  }

  /* ---------- Khối khóa học ở trang chủ + trang danh sách ---------- */
  function applyBlocks(courses) {
    document.querySelectorAll(".inner-box").forEach((box) => {
      const link = box.querySelector(".content a[href]") || box.querySelector(".img a[href]");
      if (!link) return;
      const c = findCourse(courses, link.getAttribute("href"));
      if (!c) return;

      if (c.deleted || c.status === "hidden") {
        box.style.display = "none"; // khóa học bị ẩn: biến mất khỏi trang
        return;
      }
      if (changed(c, "name")) {
        const nameLink = box.querySelector(".content a[href]");
        if (nameLink) nameLink.textContent = c.name;
      }
      if (changed(c, "image")) {
        const img = box.querySelector(".img img");
        if (img) img.src = imgSrc(c.image);
      }
    });
  }

  /* ---------- Trang chi tiết khóa học ---------- */
  function applyDetail(courses) {
    const priceBox = document.querySelector(".inner-price .price");
    if (!priceBox) return; // không phải trang chi tiết
    const c = findCourse(courses, location.pathname);
    if (!c) return;

    if (changed(c, "name")) {
      const h1 = document.querySelector(".inner-content h1");
      if (h1) h1.textContent = c.name;
    }
    if (changed(c, "image")) {
      const img = document.querySelector(".inner-images img");
      if (img) img.src = imgSrc(c.image);
    }
    if (changed(c, "price") || changed(c, "oldPrice")) {
      // Cấu trúc gốc: "7.600.000 đ<span class="price-del"><del>8.200.000 đ</del></span>"
      let text = Array.from(priceBox.childNodes).find((n) => n.nodeType === 3);
      if (!text) {
        text = document.createTextNode("");
        priceBox.insertBefore(text, priceBox.firstChild);
      }
      text.nodeValue = money(c.price);
      let del = priceBox.querySelector(".price-del");
      if (c.oldPrice > c.price) {
        if (!del) {
          del = document.createElement("span");
          del.className = "price-del";
          priceBox.appendChild(del);
        }
        del.innerHTML = "<del>" + money(c.oldPrice) + "</del>";
      } else if (del) {
        del.remove();
      }
    }

    // Khóa học bị ẩn: báo rõ trên trang và không cho thêm vào giỏ
    if (c.deleted || c.status === "hidden") {
      const bar = document.createElement("div");
      bar.style.cssText = "background:#fff4dc;color:#8a5a00;text-align:center;padding:12px 16px;font-weight:600";
      bar.textContent = "Khóa học này hiện tạm ngừng nhận đăng ký.";
      const first = document.querySelector(".section-one");
      if (first && first.parentNode) first.parentNode.insertBefore(bar, first);

      const btn = document.querySelector(".inner-price .cart");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Tạm ngừng đăng ký";
        btn.addEventListener(
          "click",
          (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
          },
          true,
        );
      }
    }
  }

  function apply() {
    if (typeof Store === "undefined") return;
    const courses = Store.getCourses(true);
    applyBlocks(courses);
    applyDetail(courses);
  }

  return { apply: apply };
})();
