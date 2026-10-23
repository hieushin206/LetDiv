/* =========================================================
   seed-data.js - Dữ liệu mẫu cho trang quản trị LetDiv
   - Chỉ chạy 1 lần đầu tiên (khi localStorage còn trống).
   - 20 khóa học lấy đúng từ các trang trong thư mục /courses.
   - Đơn hàng, học viên, khuyến mãi được sinh ngẫu nhiên nhưng
     "cố định" (dùng bộ sinh số giả ngẫu nhiên có seed) và luôn
     tính theo ngày hôm nay nên biểu đồ báo cáo luôn có số liệu.
   ========================================================= */

// Danh sách ảnh có sẵn trong website để chọn khi thêm/sửa khóa học
const PRESET_IMAGES = [
  { file: "assets/images/lo-trinh-fullstack-1024x576.webp", label: "Lộ trình Full Stack" },
  { file: "assets/images/khoa-hoc-backend.webp", label: "Backend" },
  { file: "assets/images/khoa-hoc-lap-trinh-frontend.png", label: "Frontend" },
  { file: "assets/images/combo-react-react-native-nextjs-1024x576.webp", label: "Combo React - NextJS - React Native" },
  { file: "assets/images/combo-javascript-html-css-1024x576.webp", label: "Combo JavaScript - HTML - CSS" },
  { file: "assets/images/khoa-hoc-lap-trinh-co-ban-1024x576.webp", label: "Lập trình cơ bản" },
  { file: "assets/images/khoa-hoc-javascript.jpg", label: "JavaScript" },
  { file: "assets/images/khoa-hoc-typescript-thumbnail-1024x577.webp", label: "TypeScript" },
  { file: "assets/images/khoa-hoc-nodejs-1024x576.webp", label: "NodeJS" },
  { file: "assets/images/khoa-hoc-thuat-toan-cau-truc-du-lieu-1024x576.webp", label: "Thuật toán & Cấu trúc dữ liệu" },
  { file: "assets/images/khoa-hoc-react.png", label: "React" },
  { file: "assets/images/khoa-hoc-react-native.jpg", label: "React Native" },
  { file: "assets/images/khoa-hoc-nextjs-1024x576.webp", label: "NextJS" },
  { file: "assets/images/khoa-hoc-lap-trinh-huong-doi-tuong-1024x576.webp", label: "Lập trình hướng đối tượng" },
  { file: "assets/images/khoa-hoc-mysql-1024x576.webp", label: "MySQL" },
  { file: "assets/images/anh-nen-khoa-hoc-git.webp", label: "Git & GitHub" },
  { file: "assets/images/khoa-hoc-html-css.jpg", label: "HTML & CSS" },
];

const SEED_INSTRUCTORS = ["Tùng ViO", "Lê Quang Huy", "Nguyễn Minh Khoa", "Trần Thị Thu Hà", "Phạm Đức Anh"];

// 20 khóa học thật của website
const SEED_COURSES = [
  {
    "key": "full-stack-chuan",
    "name": "Khóa Học Full Stack (Chuẩn Kỹ Sư)",
    "img": "assets/images/lo-trinh-fullstack-1024x576.webp",
    "price": 35500000,
    "old": 38000000,
    "ins": "Tùng ViO",
    "href": "courses/full-stack-chuan.html",
    "desc": "Khóa học Full Stack dành cho người mới bắt đầu. Hệ thống kiến thức và bài tập toàn diện (kết hợp cả Frontend và Backend) từ cơ bản đến nâng cao.",
    "hidden": false
  },
  {
    "key": "full-stack-gon",
    "name": "Khóa Học Full Stack (Rút Gọn)",
    "img": "assets/images/lo-trinh-fullstack-1024x576.webp",
    "price": 28000000,
    "old": 30000000,
    "ins": "Tùng ViO",
    "href": "courses/full-stack-gon.html",
    "desc": "Khóa học Full Stack Rút Gọn dành cho người mới bắt đầu. Hệ thống kiến thức và bài tập toàn diện (kết hợp cả Frontend và Backend) từ cơ bản đến nâng cao.",
    "hidden": false
  },
  {
    "key": "back-end-chuan",
    "name": "Khóa Học Backend (Chuẩn Kỹ Sư)",
    "img": "assets/images/khoa-hoc-backend.webp",
    "price": 30000000,
    "old": 32000000,
    "ins": "Lê Quang Huy",
    "href": "courses/back-end-chuan.html",
    "desc": "Khóa học Backend dành cho người mới bắt đầu. Hệ thống bài tập khoa học đa dạng từ cơ bản đến nâng cao.",
    "hidden": false
  },
  {
    "key": "back-end-gon",
    "name": "Khóa Học Backend (Rút Gọn)",
    "img": "assets/images/khoa-hoc-backend.webp",
    "price": 23000000,
    "old": 24800000,
    "ins": "Lê Quang Huy",
    "href": "courses/back-end-gon.html",
    "desc": "Khóa học Backend Rút Gọn dành cho người mới bắt đầu. Hệ thống bài tập khoa học đa dạng từ cơ bản đến nâng cao.",
    "hidden": false
  },
  {
    "key": "frontend-chuan",
    "name": "Khóa Học Frontend (Chuẩn Kỹ Sư)",
    "img": "assets/images/khoa-hoc-lap-trinh-frontend.png",
    "price": 26000000,
    "old": 28000000,
    "ins": "Nguyễn Minh Khoa",
    "href": "courses/frontend-chuan.html",
    "desc": "Khóa học Frontend (Chuẩn Kỹ Sư) toàn diện dành cho người mới bắt đầu. Hệ thống bài tập khoa học đa dạng từ cơ bản đến nâng cao.",
    "hidden": false
  },
  {
    "key": "frontend-gon",
    "name": "Khóa Học Frontend (Rút Gọn)",
    "img": "assets/images/khoa-hoc-lap-trinh-frontend.png",
    "price": 19000000,
    "old": 21000000,
    "ins": "Nguyễn Minh Khoa",
    "href": "courses/frontend-gon.html",
    "desc": "Khóa học Frontend (Chuẩn Kỹ Sư) toàn diện dành cho người mới bắt đầu. Hệ thống bài tập khoa học đa dạng từ cơ bản đến nâng cao.",
    "hidden": false
  },
  {
    "key": "combo-web-app",
    "name": "React, NextJS, React Native – Lập Trình Web, App Toàn Diện",
    "img": "assets/images/combo-react-react-native-nextjs-1024x576.webp",
    "price": 18600000,
    "old": 19500000,
    "ins": "Tùng ViO",
    "href": "courses/combo-web-app.html",
    "desc": "Combo Khóa học React, NextJS, và React Native toàn diện! Lộ trình thực chiến làm chủ công nghệ, xây dựng và triển khai ứng dụng web, và di động chuyên nghiệp từ con số 0.",
    "hidden": false
  },
  {
    "key": "combo-nenWeb",
    "name": "JavaScript, HTML & CSS – Làm Chủ Nền Tảng Lập Trình Web",
    "img": "assets/images/combo-javascript-html-css-1024x576.webp",
    "price": 11500000,
    "old": 13000000,
    "ins": "Nguyễn Minh Khoa",
    "href": "courses/combo-nenWeb.html",
    "desc": "Khóa học JavaScript, HTML & CSS dành cho người mới bắt đầu muốn học làm web từ con số 0. Sau khóa học, bạn sẽ đủ tự tin để tự làm website cho riêng mình hoặc tiếp tục học các công nghệ nâng cao hơn.",
    "hidden": false
  },
  {
    "key": "newbie",
    "name": "Khoá Học Lập Trình Cho Người Mới",
    "img": "assets/images/khoa-hoc-lap-trinh-co-ban-1024x576.webp",
    "price": 2500000,
    "old": 3000000,
    "ins": "Trần Thị Thu Hà",
    "href": "courses/newbie.html",
    "desc": "Khóa học này sẽ giúp bạn nắm được những khái niệm cơ bản nhất cho đến các kỹ thuật nâng cao: bao gồm cài đặt môi trường lập trình, cú pháp, cấu trúc dữ liệu, và các giải thuật phổ biến.",
    "hidden": false
  },
  {
    "key": "JavaScript",
    "name": "Khóa Học JavaScript",
    "img": "assets/images/khoa-hoc-javascript.jpg",
    "price": 9400000,
    "old": 10000000,
    "ins": "Nguyễn Minh Khoa",
    "href": "courses/JavaScript.html",
    "desc": "Khóa học toàn diện giúp bạn nắm vững kiến thức JavaScript từ A đến Z, tự tin làm chủ mọi dự án!",
    "hidden": false
  },
  {
    "key": "TypeScript",
    "name": "Khóa Học TypeScript",
    "img": "assets/images/khoa-hoc-typescript-thumbnail-1024x577.webp",
    "price": 3500000,
    "old": 4000000,
    "ins": "Nguyễn Minh Khoa",
    "href": "courses/TypeScript.html",
    "desc": "Khóa học TypeScript từ cơ bản đến nâng cao. Nắm vững toàn bộ hệ thống kiểu tĩnh (static typing), giúp viết code an toàn và tối ưu hóa dự án. Nâng cao kỹ năng qua các bài tập thực tế cùng project cuối môn. Được hỗ trợ 1-1 bởi giảng viên giàu kinh nghiệm thực chiến.",
    "hidden": true
  },
  {
    "key": "NodeJS",
    "name": "Khóa Học NodeJS",
    "img": "assets/images/khoa-hoc-nodejs-1024x576.webp",
    "price": 9400000,
    "old": 10500000,
    "ins": "Lê Quang Huy",
    "href": "courses/NodeJS.html",
    "desc": "Khóa học backend NodeJS sẽ trang bị cho bạn kiến thức toàn diện để xây dựng một ứng dụng web từ con số 0. Bạn sẽ học cách sử dụng NodeJS để quản lý server, kết nối cơ sở dữ liệu MySQL và áp dụng mô hình MVC chuyên nghiệp.",
    "hidden": false
  },
  {
    "key": "Algorithm",
    "name": "Khóa Học Thuật Toán & Cấu Trúc Dữ Liệu",
    "img": "assets/images/khoa-hoc-thuat-toan-cau-truc-du-lieu-1024x576.webp",
    "price": 5500000,
    "old": 6000000,
    "ins": "Trần Thị Thu Hà",
    "href": "courses/Algorithm.html",
    "desc": "Khóa học Thuật Toán & Cấu Trúc Dữ Liệu sẽ giúp bạn nắm vững các kỹ thuật tối ưu hóa hiệu suất và giải quyết vấn đề phức tạp trong lập trình, tự tin vượt qua các vòng phỏng vấn kỹ thuật tại các công ty công nghệ hàng đầu.",
    "hidden": false
  },
  {
    "key": "React",
    "name": "Khóa Học React",
    "img": "assets/images/khoa-hoc-react.png",
    "price": 7600000,
    "old": 8200000,
    "ins": "Nguyễn Minh Khoa",
    "href": "courses/React.html",
    "desc": "Khóa Học React từ cơ bản đến nâng cao. Nắm vững kiến thức React đầy đủ, từ nền tảng đến chuyên sâu. Nâng cao kỹ năng qua các bài tập thực tế, project cuối môn. Được hỗ trợ 1-1 bởi giảng viên có nhiều kinh nghiệm thực chiến.",
    "hidden": false
  },
  {
    "key": "React-Native",
    "name": "Khóa Học React Native (IOS & Android)",
    "img": "assets/images/khoa-hoc-react-native.jpg",
    "price": 8800000,
    "old": 9300000,
    "ins": "Nguyễn Minh Khoa",
    "href": "courses/React-Native.html",
    "desc": "Khóa Học React Native từ cơ bản đến nâng cao giúp bạn tự tin xây dựng ứng dụng di động đa nền tảng đáp ứng mọi nhu cầu. Mở ra cơ hội việc làm hấp dẫn đầy tiềm năng dành cho bạn!",
    "hidden": false
  },
  {
    "key": "NextJS",
    "name": "Khóa Học NextJS",
    "img": "assets/images/khoa-hoc-nextjs-1024x576.webp",
    "price": 7000000,
    "old": 7500000,
    "ins": "Nguyễn Minh Khoa",
    "href": "courses/NextJS.html",
    "desc": "Khóa học Next.js sẽ giúp bạn làm chủ App Router và các tính năng mới nhất trong phiên bản Next.js 16. Học cách xây dựng ứng dụng web hiệu suất cao với thư viện Redux, tối ưu SEO, và triển khai nhanh chóng trên các nền tảng cloud như Vercel.",
    "hidden": false
  },
  {
    "key": "OOP",
    "name": "Khóa Học Lập Trình Hướng Đối Tượng",
    "img": "assets/images/khoa-hoc-lap-trinh-huong-doi-tuong-1024x576.webp",
    "price": 2500000,
    "old": 3000000,
    "ins": "Trần Thị Thu Hà",
    "href": "courses/OOP.html",
    "desc": "Khóa học Lập trình Hướng Đối Tượng (OOP) giúp bạn nắm vững các nguyên lý OOP từ cơ bản đến nâng cao chỉ trong vòng 1 tháng. Học OOP là bước đầu quan trọng để trở thành lập trình viên chuyên nghiệp trong tương lai.",
    "hidden": false
  },
  {
    "key": "MySQL",
    "name": "Khóa Học MySQL",
    "img": "assets/images/khoa-hoc-mysql-1024x576.webp",
    "price": 4900000,
    "old": 5600000,
    "ins": "Lê Quang Huy",
    "href": "courses/MySQL.html",
    "desc": "Khóa học MySQL giúp bạn nắm vững các kỹ năng quản lý cơ sở dữ liệu quan hệ: từ cài đặt cho đến viết các câu lệnh truy vấn SQL và tối ưu hóa hiệu suất. Đây là nền tảng quan trọng cho việc phát triển ứng dụng và xử lý dữ liệu hiệu quả.",
    "hidden": false
  },
  {
    "key": "Git-GitHub",
    "name": "Khóa Học Git & GitHub",
    "img": "assets/images/anh-nen-khoa-hoc-git.webp",
    "price": 3100000,
    "old": 4000000,
    "ins": "Trần Thị Thu Hà",
    "href": "courses/Git-GitHub.html",
    "desc": "Chinh phục kiến thức Git toàn diện từ A đến Z. Hệ thống bài giảng chi tiết, bám sát thực tế, giúp bạn nắm vững kiến thức Git từ cơ bản đến nâng cao.",
    "hidden": false
  },
  {
    "key": "HTML-CSS",
    "name": "Khóa Học HTML & CSS",
    "img": "assets/images/khoa-hoc-html-css.jpg",
    "price": 5200000,
    "old": 5600000,
    "ins": "Nguyễn Minh Khoa",
    "href": "courses/HTML-CSS.html",
    "desc": "Khóa học Lập trình HTML & CSS từ Cơ Bản đến Nâng Cao giúp nắm vững kiến thức HTML & CSS một cách bài bản, tự tin xây dựng các trang web đẹp mắt, ấn tượng và hiển thị tốt trên nhiều thiết bị khác nhau.",
    "hidden": false
  }
];

function buildSeedData() {
  const today = new Date();
  const DAY = 24 * 60 * 60 * 1000;

  /* ---------- Khóa học ---------- */
  const courses = SEED_COURSES.map((c, i) => {
    return {
      id: "KH" + String(i + 1).padStart(3, "0"),
      name: c.name,
      image: c.img,
      price: c.price,
      oldPrice: c.old,
      instructor: c.ins,
      description: c.desc,
      status: c.hidden ? "hidden" : "active",
      deleted: false,
      href: c.href,
      createdAt: new Date(today.getTime() - (280 - i * 9) * DAY).toISOString(),
    };
  });

  return { courses };
}
