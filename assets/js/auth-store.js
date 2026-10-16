/* =========================================================
   auth-store.js - Đăng ký / đăng nhập / quên mật khẩu (giả lập)
   ---------------------------------------------------------
   - Toàn bộ dữ liệu lưu bằng localStorage => TẮT TRÌNH DUYỆT HAY TẮT MÁY
     VẪN CÒN (khác với sessionStorage hoặc biến JS sẽ mất khi đóng tab).
   - Mật khẩu KHÔNG lưu dạng chữ thường mà lưu dạng băm (hash) + salt.
     Lưu ý: đây chỉ là đồ án website tĩnh, không có server nên không thể
     bảo mật thật sự. Đừng dùng mật khẩu thật của bạn để thử.
   - Khi đăng ký, tài khoản cũng được thêm vào danh sách "Học viên" của
     trang admin (dùng chung Store trong admin/js/store.js).

   PHÂN QUYỀN (mới): mỗi tài khoản có trường role:
     customer   : Khách hàng (mặc định khi đăng ký)
     instructor : Giảng viên (chỉ admin tạo / đổi quyền)
     admin      : Quản trị viên
   Tài khoản admin mặc định (tạo tự động lần đầu): admin / Admin@123

   3 nhóm dữ liệu trong localStorage:
     letdiv_accounts      : danh sách tài khoản đã đăng ký
     letdiv_current_user  : người đang đăng nhập (lưu bằng sessionStorage => đóng tab / thoát trình duyệt là tự đăng xuất)
     letdiv_reset_codes   : mã xác nhận quên mật khẩu (giả lập gửi email)
   ========================================================= */

const AUTH_KEYS = {
  accounts: "letdiv_accounts",
  session: "letdiv_current_user",
  resets: "letdiv_reset_codes",
};

// Các quyền (vai trò) trong hệ thống và trang mở ra sau khi đăng nhập
const AUTH_ROLES = {
  customer: "Khách hàng",
  instructor: "Giảng viên",
  admin: "Admin",
};
const AUTH_ROLE_HOME = {
  admin: "/admin/index.html",
  instructor: "/instructor/index.html",
  customer: "/index.html",
};

// Tài khoản admin mặc định (chỉ tạo khi hệ thống chưa có admin nào)
const DEFAULT_ADMIN = {
  username: "admin",
  fullName: "Quản trị viên",
  email: "admin@letdiv.vn",
  phone: "0900000000",
  password: "Admin@123",
};

const RESET_CODE_MINUTES = 5; // mã hết hạn sau 5 phút
const RESEND_SECONDS = 30; // chờ 30 giây mới được gửi lại mã
const MAX_CODE_ATTEMPTS = 5; // nhập sai tối đa 5 lần

/* ---------- Hàm băm mật khẩu (cyrb53 - đồng bộ, không cần thư viện) ---------- */
function cyrb53(str, seed) {
  let h1 = 0xdeadbeef ^ (seed || 0);
  let h2 = 0x41c6ce57 ^ (seed || 0);
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function hashPassword(password, salt) {
  return (
    cyrb53(salt + ":" + password, 1).toString(16) +
    cyrb53(password + ":" + salt, 2).toString(16)
  );
}

function makeSalt() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const AuthStore = {
  /* ---------- Đọc / ghi localStorage ---------- */
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
      console.error("Không ghi được localStorage:", e);
      return false;
    }
  },

  // Xin trình duyệt giữ dữ liệu lâu dài (không tự xóa khi thiếu dung lượng)
  init() {
    if (navigator.storage && navigator.storage.persist)
      navigator.storage.persist();
    this.migrate();
    this.ensureDefaultAdmin();
  },

  // Tài khoản đăng ký từ phiên bản cũ chưa có "role" => mặc định là khách hàng
  migrate() {
    const accounts = this.getAccounts();
    let changed = false;
    accounts.forEach((a) => {
      if (!AUTH_ROLES[a.role]) {
        a.role = "customer";
        changed = true;
      }
    });
    if (changed) this.write(AUTH_KEYS.accounts, accounts);
  },

  // Chưa có admin nào thì tạo 1 admin mặc định để còn đăng nhập vào trang quản trị
  ensureDefaultAdmin() {
    const accounts = this.getAccounts();
    if (accounts.some((a) => a.role === "admin")) return;
    let username = DEFAULT_ADMIN.username;
    let email = DEFAULT_ADMIN.email;
    let n = 1;
    while (
      accounts.some(
        (a) => a.usernameKey === username.toLowerCase() || a.email === email,
      )
    ) {
      n++;
      username = DEFAULT_ADMIN.username + n;
      email = "admin" + n + "@letdiv.vn";
    }
    const salt = makeSalt();
    accounts.push({
      username: username,
      usernameKey: username.toLowerCase(),
      fullName: DEFAULT_ADMIN.fullName,
      email: email,
      phone: DEFAULT_ADMIN.phone,
      salt: salt,
      passwordHash: hashPassword(DEFAULT_ADMIN.password, salt),
      role: "admin",
      code: this.nextStaffCode(accounts),
      studentId: "",
      createdAt: new Date().toISOString(),
    });
    this.write(AUTH_KEYS.accounts, accounts);
  },

  // Mã cho tài khoản nhân sự (giảng viên / admin không có mã học viên): TK001, TK002...
  nextStaffCode(accounts) {
    let max = 0;
    accounts.forEach((a) => {
      const m = /^TK(\d+)$/.exec(a.code || "");
      if (m && Number(m[1]) > max) max = Number(m[1]);
    });
    return "TK" + String(max + 1).padStart(3, "0");
  },

  roleOf(account) {
    return AUTH_ROLES[account.role] ? account.role : "customer";
  },

  roleLabel(role) {
    return AUTH_ROLES[role] || AUTH_ROLES.customer;
  },

  // Trang chủ của từng quyền (nhận vào user hoặc tên quyền)
  homeFor(userOrRole) {
    const role =
      typeof userOrRole === "string"
        ? userOrRole
        : userOrRole && userOrRole.role;
    return AUTH_ROLE_HOME[role] || AUTH_ROLE_HOME.customer;
  },

  // Mã hiển thị của tài khoản: khách hàng = mã học viên (HV001), nhân sự = TK001
  codeOf(account) {
    return account.studentId || account.code || "";
  },

  findByUsername(username) {
    const key = String(username || "")
      .trim()
      .toLowerCase();
    return this.getAccounts().find((a) => a.usernameKey === key);
  },

  findByStudentId(studentId) {
    if (!studentId) return undefined;
    return this.getAccounts().find((a) => a.studentId === studentId);
  },

  getAccounts() {
    return this.read(AUTH_KEYS.accounts, []);
  },

  normalizeEmail(email) {
    return String(email || "")
      .trim()
      .toLowerCase();
  },

  findByEmail(email) {
    const key = this.normalizeEmail(email);
    return this.getAccounts().find((a) => a.email === key);
  },

  /* =======================================================
     ĐĂNG KÝ
     ======================================================= */
  // Trả về object lỗi: { tenTruong: "thông báo" } (rỗng nếu hợp lệ)
  validateRegister(data) {
    const errors = {};
    const accounts = this.getAccounts();

    const fullName = (data.fullName || "").trim();
    if (fullName.length < 2)
      errors.fullName = "Vui lòng nhập họ và tên (tối thiểu 2 ký tự).";
    else if (fullName.length > 50)
      errors.fullName = "Họ và tên tối đa 50 ký tự.";

    const username = (data.username || "").trim();
    if (!/^[A-Za-z0-9_.]{4,20}$/.test(username)) {
      errors.username =
        "Tài khoản gồm 4-20 ký tự: chữ không dấu, số, dấu _ hoặc dấu chấm.";
    } else if (accounts.some((a) => a.usernameKey === username.toLowerCase())) {
      errors.username = "Tên tài khoản này đã có người sử dụng.";
    }

    const email = this.normalizeEmail(data.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      errors.email = "Email không hợp lệ.";
    else if (accounts.some((a) => a.email === email))
      errors.email = "Email này đã được đăng ký.";

    const phone = (data.phone || "").replace(/\s+/g, "");
    if (!/^(0|\+84)\d{9}$/.test(phone))
      errors.phone = "Số điện thoại không hợp lệ (VD: 0986348952).";

    const password = data.password || "";
    if (password.length < 6) errors.password = "Mật khẩu tối thiểu 6 ký tự.";
    else if (password.length > 50)
      errors.password = "Mật khẩu tối đa 50 ký tự.";
    else if (/\s/.test(password))
      errors.password = "Mật khẩu không được chứa khoảng trắng.";

    if (!data.confirmPassword)
      errors.confirmPassword = "Vui lòng nhập lại mật khẩu.";
    else if (data.confirmPassword !== password)
      errors.confirmPassword = "Mật khẩu xác nhận không khớp.";

    return errors;
  },

  register(data) {
    const errors = this.validateRegister(data);
    if (Object.keys(errors).length > 0) return { ok: false, errors: errors };

    const fullName = data.fullName.trim();
    const email = this.normalizeEmail(data.email);
    const phone = data.phone.replace(/\s+/g, "");

    // Thêm vào danh sách "Học viên" của admin để admin nhìn thấy
    let studentId = "";
    if (typeof Store !== "undefined") {
      const res = Store.registerStudent({
        name: fullName,
        email: email,
        phone: phone,
      });
      if (!res.ok) return { ok: false, errors: { email: res.error } };
      studentId = res.student.id;
    }

    const salt = makeSalt();
    const accounts = this.getAccounts();
    const account = {
      username: data.username.trim(),
      usernameKey: data.username.trim().toLowerCase(),
      fullName: fullName,
      email: email,
      phone: phone,
      salt: salt,
      passwordHash: hashPassword(data.password, salt),
      role: "customer", // đăng ký công khai luôn là khách hàng
      studentId: studentId,
      createdAt: new Date().toISOString(),
    };
    accounts.push(account);
    if (!this.write(AUTH_KEYS.accounts, accounts)) {
      return {
        ok: false,
        error:
          "Không lưu được tài khoản: bộ nhớ trình duyệt đã đầy hoặc bị chặn.",
      };
    }
    return { ok: true, account: account };
  },

  /* =======================================================
     ĐĂNG NHẬP (bằng tên tài khoản HOẶC email)
     ======================================================= */
  login(identifier, password) {
    const key = String(identifier || "")
      .trim()
      .toLowerCase();
    const account = this.getAccounts().find((a) => a.usernameKey === key);
    if (!account)
      return {
        ok: false,
        field: "identifier",
        error: "Tài khoản không tồn tại.",
      };
    if (hashPassword(password || "", account.salt) !== account.passwordHash) {
      return { ok: false, field: "password", error: "Mật khẩu không đúng." };
    }
    if (this.isDisabled(account)) {
      return {
        ok: false,
        error: "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.",
      };
    }

    // Session chỉ lưu tên tài khoản + giờ đăng nhập; thông tin còn lại luôn đọc mới từ
    // danh sách tài khoản => admin đổi quyền / người dùng sửa hồ sơ là có hiệu lực ngay
    const loginAt = new Date().toISOString();
    // Lưu bằng sessionStorage: đóng tab / thoát trình duyệt thì phiên đăng nhập tự mất (tự đăng xuất)
    try {
      sessionStorage.setItem(
        AUTH_KEYS.session,
        JSON.stringify({ username: account.username, loginAt: loginAt }),
      );
      localStorage.removeItem(AUTH_KEYS.session); // xóa phiên kiểu cũ (nếu còn) để không bị đăng nhập lại
    } catch (e) {
      console.error("Không lưu được phiên đăng nhập:", e);
    }
    return { ok: true, user: this.toUser(account, loginAt) };
  },

  // Chuyển 1 tài khoản thành object "người dùng" gọn để các trang sử dụng
  toUser(account, loginAt) {
    return {
      username: account.username,
      fullName: account.fullName,
      email: account.email,
      phone: account.phone,
      role: this.roleOf(account),
      studentId: account.studentId || "",
      code: this.codeOf(account),
      loginAt: loginAt || "",
    };
  },

  // Admin có thể vô hiệu hóa học viên => không cho đăng nhập
  isDisabled(account) {
    if (account.disabled) return true; // nhân sự (không có hồ sơ học viên) bị khóa
    if (typeof Store === "undefined" || !account.studentId) return false;
    const s = Store.getStudent(account.studentId);
    return !!s && s.status === "disabled";
  },

  // Người đang đăng nhập (null nếu chưa đăng nhập hoặc tài khoản không còn hợp lệ)
  currentUser() {
    let session = null;
    try {
      session = JSON.parse(sessionStorage.getItem(AUTH_KEYS.session));
    } catch (e) {}
    localStorage.removeItem(AUTH_KEYS.session); // phiên kiểu cũ lưu ở localStorage không còn được dùng
    if (!session || !session.username) return null;
    const account = this.getAccounts().find(
      (a) => a.usernameKey === session.username.toLowerCase(),
    );
    if (!account || this.isDisabled(account)) {
      this.logout();
      return null;
    }
    return this.toUser(account, session.loginAt);
  },

  logout() {
    sessionStorage.removeItem(AUTH_KEYS.session);
    localStorage.removeItem(AUTH_KEYS.session);
  },

  /* =======================================================
     HỒ SƠ CÁ NHÂN + ĐỔI MẬT KHẨU (người đang đăng nhập)
     Không cho sửa: mã khách hàng, tên tài khoản.
     ======================================================= */
  validatePassword(password) {
    if (!password || password.length < 6) return "Mật khẩu tối thiểu 6 ký tự.";
    if (password.length > 50) return "Mật khẩu tối đa 50 ký tự.";
    if (/\s/.test(password)) return "Mật khẩu không được chứa khoảng trắng.";
    return "";
  },

  updateProfile(data) {
    const me = this.currentUser();
    if (!me) return { ok: false, error: "Bạn chưa đăng nhập." };

    const errors = {};
    const accounts = this.getAccounts();

    const fullName = (data.fullName || "").trim();
    if (fullName.length < 2)
      errors.fullName = "Vui lòng nhập họ và tên (tối thiểu 2 ký tự).";
    else if (fullName.length > 50)
      errors.fullName = "Họ và tên tối đa 50 ký tự.";

    const email = this.normalizeEmail(data.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      errors.email = "Email không hợp lệ.";
    else if (
      accounts.some(
        (a) => a.usernameKey !== me.username.toLowerCase() && a.email === email,
      )
    ) {
      errors.email = "Email này đã được đăng ký cho tài khoản khác.";
    } else if (
      typeof Store !== "undefined" &&
      Store.get("students").some(
        (s) => s.id !== me.studentId && String(s.email).toLowerCase() === email,
      )
    ) {
      errors.email = "Email này đã được đăng ký cho tài khoản khác.";
    }

    const phone = (data.phone || "").replace(/\s+/g, "");
    if (!/^(0|\+84)\d{9}$/.test(phone))
      errors.phone = "Số điện thoại không hợp lệ (VD: 0986348952).";

    if (Object.keys(errors).length > 0) return { ok: false, errors: errors };

    const account = accounts.find(
      (a) => a.usernameKey === me.username.toLowerCase(),
    );
    account.fullName = fullName;
    account.email = email;
    account.phone = phone;
    if (!this.write(AUTH_KEYS.accounts, accounts))
      return {
        ok: false,
        error: "Không lưu được hồ sơ: bộ nhớ trình duyệt đã đầy hoặc bị chặn.",
      };

    // Đồng bộ sang danh sách "Học viên" của admin
    if (typeof Store !== "undefined" && account.studentId) {
      const students = Store.get("students");
      const s = students.find((x) => x.id === account.studentId);
      if (s) {
        s.name = fullName;
        s.email = email;
        s.phone = phone;
        Store.set("students", students);
      }
    }
    return { ok: true, user: this.currentUser() };
  },

  changePassword(oldPassword, newPassword, confirmPassword) {
    const me = this.currentUser();
    if (!me) return { ok: false, error: "Bạn chưa đăng nhập." };
    const accounts = this.getAccounts();
    const account = accounts.find(
      (a) => a.usernameKey === me.username.toLowerCase(),
    );

    const errors = {};
    if (!oldPassword) errors.oldPassword = "Vui lòng nhập mật khẩu cũ.";
    else if (hashPassword(oldPassword, account.salt) !== account.passwordHash)
      errors.oldPassword = "Mật khẩu cũ không đúng.";

    const pwError = this.validatePassword(newPassword);
    if (pwError) errors.newPassword = pwError;
    else if (newPassword === oldPassword)
      errors.newPassword = "Mật khẩu mới phải khác mật khẩu cũ.";

    if (!confirmPassword)
      errors.confirmPassword = "Vui lòng nhập lại mật khẩu mới.";
    else if (confirmPassword !== newPassword)
      errors.confirmPassword = "Mật khẩu nhập lại không khớp.";

    if (Object.keys(errors).length > 0) return { ok: false, errors: errors };

    account.salt = makeSalt();
    account.passwordHash = hashPassword(newPassword, account.salt);
    if (!this.write(AUTH_KEYS.accounts, accounts))
      return { ok: false, error: "Không lưu được mật khẩu mới." };
    return { ok: true };
  },

  /* =======================================================
     QUẢN TRỊ TÀI KHOẢN (chỉ admin) - dùng ở admin/pages/khach-hang.html
     Lưu ý: đây là website tĩnh nên việc kiểm tra quyền chỉ mang tính
     minh họa (không có server để bảo mật thật).
     ======================================================= */
  isAdmin() {
    const me = this.currentUser();
    return !!me && me.role === "admin";
  },

  // Tạo hồ sơ học viên (HV###) cho tài khoản chưa có - cần để mua khóa học
  ensureStudent(account) {
    if (account.studentId || typeof Store === "undefined")
      return account.studentId || "";
    const res = Store.registerStudent({
      name: account.fullName,
      email: account.email,
      phone: account.phone,
    });
    return res.ok ? res.student.id : "";
  },

  // Admin tạo tài khoản với quyền tùy chọn. data: { fullName, username, email, phone, password, role }
  createAccount(data) {
    if (!this.isAdmin())
      return { ok: false, error: "Chỉ quản trị viên mới được tạo tài khoản." };
    const role = AUTH_ROLES[data.role] ? data.role : "customer";
    const errors = this.validateRegister({
      ...data,
      confirmPassword: data.password,
    });
    if (Object.keys(errors).length > 0) return { ok: false, errors: errors };

    const fullName = data.fullName.trim();
    const email = this.normalizeEmail(data.email);
    const phone = data.phone.replace(/\s+/g, "");
    const accounts = this.getAccounts();

    let studentId = "";
    if (role === "customer" && typeof Store !== "undefined") {
      const res = Store.registerStudent({
        name: fullName,
        email: email,
        phone: phone,
      });
      if (!res.ok) return { ok: false, errors: { email: res.error } };
      studentId = res.student.id;
    }

    const salt = makeSalt();
    const account = {
      username: data.username.trim(),
      usernameKey: data.username.trim().toLowerCase(),
      fullName: fullName,
      email: email,
      phone: phone,
      salt: salt,
      passwordHash: hashPassword(data.password, salt),
      role: role,
      code: studentId ? "" : this.nextStaffCode(accounts),
      studentId: studentId,
      createdAt: new Date().toISOString(),
    };
    accounts.push(account);
    if (!this.write(AUTH_KEYS.accounts, accounts))
      return {
        ok: false,
        error:
          "Không lưu được tài khoản: bộ nhớ trình duyệt đã đầy hoặc bị chặn.",
      };
    return { ok: true, account: account };
  },

  countActiveAdmins() {
    return this.getAccounts().filter(
      (a) => this.roleOf(a) === "admin" && !this.isDisabled(a),
    ).length;
  },

  // Đổi quyền: khách hàng / giảng viên / admin
  setRole(username, role) {
    if (!this.isAdmin())
      return { ok: false, error: "Chỉ quản trị viên mới được đổi quyền." };
    if (!AUTH_ROLES[role]) return { ok: false, error: "Quyền không hợp lệ." };
    const me = this.currentUser();
    if (me.username.toLowerCase() === String(username).toLowerCase()) {
      return { ok: false, error: "Bạn không thể tự đổi quyền của chính mình." };
    }
    const accounts = this.getAccounts();
    const account = accounts.find(
      (a) => a.usernameKey === String(username).toLowerCase(),
    );
    if (!account) return { ok: false, error: "Không tìm thấy tài khoản." };
    if (
      this.roleOf(account) === "admin" &&
      role !== "admin" &&
      this.countActiveAdmins() <= 1
    ) {
      return {
        ok: false,
        error: "Hệ thống phải còn ít nhất 1 admin đang hoạt động.",
      };
    }
    account.role = role;
    // Chuyển về khách hàng mà chưa có hồ sơ học viên thì tạo luôn (để có mã khách hàng)
    if (role === "customer" && !account.studentId)
      account.studentId = this.ensureStudent(account);
    if (!this.write(AUTH_KEYS.accounts, accounts))
      return { ok: false, error: "Không lưu được thay đổi." };
    return { ok: true, account: account };
  },

  // Khóa / mở khóa tài khoản
  setDisabled(username, disabled) {
    if (!this.isAdmin())
      return {
        ok: false,
        error: "Chỉ quản trị viên mới được khóa / mở khóa tài khoản.",
      };
    const me = this.currentUser();
    if (
      disabled &&
      me.username.toLowerCase() === String(username).toLowerCase()
    ) {
      return {
        ok: false,
        error: "Bạn không thể tự khóa tài khoản của chính mình.",
      };
    }
    const accounts = this.getAccounts();
    const account = accounts.find(
      (a) => a.usernameKey === String(username).toLowerCase(),
    );
    if (!account) return { ok: false, error: "Không tìm thấy tài khoản." };
    if (
      disabled &&
      this.roleOf(account) === "admin" &&
      this.countActiveAdmins() <= 1
    ) {
      return {
        ok: false,
        error: "Hệ thống phải còn ít nhất 1 admin đang hoạt động.",
      };
    }
    if (account.studentId && typeof Store !== "undefined") {
      Store.setStudentStatus(
        account.studentId,
        disabled ? "disabled" : "active",
      );
    } else {
      account.disabled = !!disabled;
      this.write(AUTH_KEYS.accounts, accounts);
    }
    return { ok: true };
  },

  /* =======================================================
     QUÊN MẬT KHẨU (giả lập gửi mã qua email)
     Bước 1: nhập đúng email đã đăng ký -> tạo mã 6 số
     Bước 2: nhập đúng mã (còn hạn, tối đa 5 lần sai)
     Bước 3: đặt mật khẩu mới
     ======================================================= */
  requestResetCode(email) {
    const key = this.normalizeEmail(email);
    if (!key) return { ok: false, error: "Vui lòng nhập email." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(key))
      return { ok: false, error: "Email không hợp lệ." };

    const account = this.findByEmail(key);
    if (!account)
      return { ok: false, error: "Email này chưa được đăng ký tài khoản." };
    if (this.isDisabled(account))
      return {
        ok: false,
        error: "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.",
      };

    const resets = this.read(AUTH_KEYS.resets, {});
    const old = resets[key];
    if (old) {
      const wait = Math.ceil(
        (old.sentAt + RESEND_SECONDS * 1000 - Date.now()) / 1000,
      );
      if (wait > 0)
        return {
          ok: false,
          cooldown: wait,
          error: "Vui lòng đợi " + wait + " giây rồi gửi lại mã.",
        };
    }

    // Mã 6 chữ số ngẫu nhiên
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();
    resets[key] = {
      code: code,
      sentAt: now,
      expiresAt: now + RESET_CODE_MINUTES * 60 * 1000,
      attempts: 0,
    };
    this.write(AUTH_KEYS.resets, resets);
    console.log("[Giả lập email] Mã xác nhận gửi tới " + key + ": " + code);
    return {
      ok: true,
      email: key,
      code: code,
      sentAt: now,
      expiresAt: now + RESET_CODE_MINUTES * 60 * 1000,
    };
  },

  verifyResetCode(email, code) {
    const key = this.normalizeEmail(email);
    const resets = this.read(AUTH_KEYS.resets, {});
    const rec = resets[key];
    const again = ' Hãy bấm "Gửi lại mã".';

    if (!rec)
      return {
        ok: false,
        expired: true,
        error:
          "Chưa có mã nào được gửi cho email này hoặc mã đã được dùng." + again,
      };
    if (Date.now() > rec.expiresAt) {
      delete resets[key];
      this.write(AUTH_KEYS.resets, resets);
      return { ok: false, expired: true, error: "Mã đã hết hạn." + again };
    }
    if (rec.attempts >= MAX_CODE_ATTEMPTS) {
      return {
        ok: false,
        expired: true,
        error: "Bạn đã nhập sai quá " + MAX_CODE_ATTEMPTS + " lần." + again,
      };
    }
    if (String(code || "").trim() !== rec.code) {
      rec.attempts += 1;
      this.write(AUTH_KEYS.resets, resets);
      const left = MAX_CODE_ATTEMPTS - rec.attempts;
      return {
        ok: false,
        error:
          left > 0
            ? "Mã không đúng. Bạn còn " + left + " lần thử."
            : "Bạn đã nhập sai quá " + MAX_CODE_ATTEMPTS + " lần." + again,
      };
    }
    return { ok: true };
  },

  resetPassword(email, code, newPassword) {
    // Kiểm tra lại mã 1 lần nữa để không ai bỏ qua bước nhập mã được
    const check = this.verifyResetCode(email, code);
    if (!check.ok) return check;

    if (!newPassword || newPassword.length < 6)
      return { ok: false, error: "Mật khẩu tối thiểu 6 ký tự." };
    if (newPassword.length > 50)
      return { ok: false, error: "Mật khẩu tối đa 50 ký tự." };
    if (/\s/.test(newPassword))
      return { ok: false, error: "Mật khẩu không được chứa khoảng trắng." };

    const key = this.normalizeEmail(email);
    const accounts = this.getAccounts();
    const account = accounts.find((a) => a.email === key);
    if (!account) return { ok: false, error: "Không tìm thấy tài khoản." };

    account.salt = makeSalt();
    account.passwordHash = hashPassword(newPassword, account.salt);
    if (!this.write(AUTH_KEYS.accounts, accounts))
      return { ok: false, error: "Không lưu được mật khẩu mới." };

    // Mã chỉ dùng được 1 lần
    const resets = this.read(AUTH_KEYS.resets, {});
    delete resets[key];
    this.write(AUTH_KEYS.resets, resets);
    return { ok: true, username: account.username };
  },
};

AuthStore.init();

/* =========================================================
   AuthUI - hàm hiển thị lỗi / thông báo dùng chung cho các form
   ========================================================= */
const AuthUI = {
  setError(input, message) {
    this.clearError(input);
    input.classList.add("auth-invalid");
    const div = document.createElement("div");
    div.className = "auth-error";
    div.textContent = message;
    input.insertAdjacentElement("afterend", div);
  },

  clearError(input) {
    input.classList.remove("auth-invalid");
    const next = input.nextElementSibling;
    if (next && next.classList.contains("auth-error")) next.remove();
  },

  showAlert(form, type, message) {
    this.clearAlert(form);
    const div = document.createElement("div");
    div.className = "auth-alert " + type; // type: error | success | info
    div.textContent = message;
    form.insertBefore(div, form.firstChild);
  },

  clearAlert(form) {
    const old = form.querySelector(":scope > .auth-alert");
    if (old) old.remove();
  },

  clearAll(form) {
    this.clearAlert(form);
    form.querySelectorAll(".auth-invalid").forEach((i) => this.clearError(i));
  },

  // Gắn xử lý cho 1 form đăng nhập (dùng cho trang login và modal ở header)
  bindLoginForm(form, onSuccess) {
    const idInput = form.querySelector('input[type="text"]');
    const pwInput = form.querySelector('input[type="password"]');
    form.setAttribute("novalidate", "");

    [idInput, pwInput].forEach((input) =>
      input.addEventListener("input", () => this.clearError(input)),
    );

    form.addEventListener("submit", (e) => {
      e.preventDefault(); // không cho form tải lại trang
      this.clearAll(form);

      let hasError = false;
      if (!idInput.value.trim()) {
        this.setError(idInput, "Vui lòng nhập tài khoản.");
        hasError = true;
      }
      if (!pwInput.value) {
        this.setError(pwInput, "Vui lòng nhập mật khẩu.");
        hasError = true;
      }
      if (hasError) return;

      const res = AuthStore.login(idInput.value, pwInput.value);
      if (!res.ok) {
        if (res.field === "identifier") this.setError(idInput, res.error);
        else if (res.field === "password") this.setError(pwInput, res.error);
        else this.showAlert(form, "error", res.error);
        return;
      }
      onSuccess(res.user);
    });
  },
};
