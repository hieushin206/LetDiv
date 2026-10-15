/* =========================================================
   khuyen-mai.js - Trang "Khuyến mãi"
   Quy tắc kiểm tra mã (hợp lệ, thời hạn, đơn tối thiểu, số lượng)
   nằm trong Store.validatePromo - trang giỏ hàng của học viên
   chỉ cần gọi hàm này để tính lại tổng tiền.
   ========================================================= */
function initPromoPage() {
  const $ = (id) => document.getElementById(id);
  const FIELDS = ["code", "value", "minOrder", "quantity", "startDate", "endDate"];
  const STATE_BADGE = { running: "badge-success", upcoming: "badge-info", expired: "badge-danger", soldout: "badge-warning", off: "badge-muted" };
  let editingCode = null;
  let search = "";

  function render() {
    const kw = UI.normalize(search);
    let list = Store.get("promos");
    if (kw) list = list.filter((p) => UI.normalize(p.code + " " + p.description).includes(kw));

    if (list.length === 0) {
      $("list-area").innerHTML = '<div class="empty-state"><i class="fa-solid fa-ticket"></i><h3>Chưa có mã khuyến mãi</h3><p>Bấm "Thêm mã khuyến mãi" để tạo mã mới.</p></div>';
      return;
    }
    $("list-area").innerHTML =
      '<div class="table-wrap"><table class="data-table" style="min-width: 900px"><thead><tr><th>Mã</th><th>Giá trị giảm</th><th>Đơn tối thiểu</th><th>Thời gian áp dụng</th><th>Đã dùng</th><th>Trạng thái</th><th>Bật/Tắt</th><th class="num">Thao tác</th></tr></thead><tbody>' +
      list
        .map((p) => {
          const used = Store.promoUsage(p.code);
          const st = Store.promoState(p);
          const pct = p.quantity > 0 ? Math.min(100, Math.round((used / p.quantity) * 100)) : 0;
          const usedHtml =
            used + (p.quantity > 0 ? " / " + p.quantity : " / ∞") +
            (p.quantity > 0 ? '<div class="progress mini-progress ' + (pct >= 100 ? "red" : "") + '"><span style="width:' + pct + '%"></span></div>' : "");
          return (
            '<tr><td><span class="promo-code">' + UI.esc(p.code) + '</span><div class="cell-sub" style="margin-top:4px">' + UI.esc(p.description) + "</div></td>" +
            '<td class="price">' + (p.type === "percent" ? p.value + "%" : UI.money(p.value)) + "</td>" +
            "<td>" + (p.minOrder > 0 ? UI.money(p.minOrder) : '<span class="text-muted">Không</span>') + "</td>" +
            "<td>" + formatDay(p.startDate) + " → " + formatDay(p.endDate) + "</td>" +
            "<td>" + usedHtml + "</td>" +
            '<td><span class="badge ' + STATE_BADGE[st.key] + '">' + st.label + "</span></td>" +
            '<td><label class="switch"><input type="checkbox" data-toggle="' + UI.esc(p.code) + '"' + (p.active ? " checked" : "") + '><span class="slider"></span></label></td>' +
            '<td class="actions"><button class="icon-btn" title="Sửa" data-edit="' + UI.esc(p.code) + '"><i class="fa-solid fa-pen"></i></button>' +
            '<button class="icon-btn danger" title="Xóa" data-delete="' + UI.esc(p.code) + '"><i class="fa-regular fa-trash-can"></i></button></td></tr>'
          );
        })
        .join("") +
      "</tbody></table></div>";
  }

  /* ---------- Form ---------- */
  function updateValueLabel() {
    const percent = $("f-type").value === "percent";
    $("value-label").innerHTML = (percent ? "Giá trị giảm (%)" : "Giá trị giảm (đ)") + ' <span class="req">*</span>';
    $("f-value").step = percent ? "1" : "1000";
  }

  function openForm(code) {
    editingCode = code || null;
    UI.clearErrors(FIELDS);
    const p = code ? Store.getPromo(code) : null;
    $("promo-modal-title").textContent = p ? "Sửa mã " + p.code : "Thêm mã khuyến mãi";
    $("f-code").value = p ? p.code : "";
    $("f-code").readOnly = !!p; // không đổi mã vì các đơn hàng đang tham chiếu
    $("code-hint").textContent = p ? "Không thể đổi mã đã tạo (đơn hàng đang dùng mã này để tra cứu)." : "4-20 ký tự chữ/số, viết liền, không dấu.";
    $("f-description").value = p ? p.description : "";
    $("f-type").value = p ? p.type : "percent";
    $("f-value").value = p ? p.value : "";
    $("f-minOrder").value = p ? p.minOrder : 0;
    $("f-quantity").value = p ? p.quantity : 0;
    $("f-startDate").value = p ? p.startDate : Store.todayString();
    $("f-endDate").value = p ? p.endDate : "";
    $("f-active").checked = p ? p.active : true;
    updateValueLabel();
    UI.openModal("promo-modal");
    (p ? $("f-description") : $("f-code")).focus();
  }

  function saveForm() {
    const data = {
      code: $("f-code").value.trim().toUpperCase(),
      description: $("f-description").value,
      type: $("f-type").value,
      value: Number($("f-value").value) || 0,
      minOrder: Number($("f-minOrder").value) || 0,
      quantity: Number($("f-quantity").value) || 0,
      startDate: $("f-startDate").value,
      endDate: $("f-endDate").value,
      active: $("f-active").checked,
    };
    const errors = Store.validatePromoForm(data, editingCode);
    UI.showErrors(errors, FIELDS);
    if (Object.keys(errors).length) return;

    if (editingCode) Store.updatePromo(editingCode, data);
    else Store.addPromo(data);
    UI.closeModal("promo-modal");
    UI.toast(editingCode ? "Đã cập nhật mã khuyến mãi." : "Đã thêm mã khuyến mãi.");
    render();
  }

  /* ---------- Thử mã (giả lập giỏ hàng) ---------- */
  function testPromo() {
    const amount = Number($("t-amount").value) || 0;
    const r = Store.validatePromo($("t-code").value, amount);
    $("t-result").innerHTML =
      '<div class="test-result ' + (r.valid ? "ok" : "bad") + '"><i class="fa-solid ' + (r.valid ? "fa-circle-check" : "fa-circle-xmark") + '"></i> ' + UI.esc(r.message) +
      (r.valid
        ? '<div class="calc"><span>Tạm tính: <b>' + UI.money(amount) + "</b></span><span>Giảm: <b>- " + UI.money(r.discount) + "</b></span><span>Phải trả: <b>" + UI.money(r.total) + "</b></span></div>"
        : "") +
      "</div>";
  }

  /* ---------- Sự kiện ---------- */
  $("btn-add").addEventListener("click", () => openForm());
  $("btn-save").addEventListener("click", saveForm);
  $("f-type").addEventListener("change", updateValueLabel);
  $("btn-test").addEventListener("click", testPromo);
  $("t-code").addEventListener("keydown", (e) => {
    if (e.key === "Enter") testPromo();
  });
  $("search").addEventListener(
    "input",
    UI.debounce((e) => {
      search = e.target.value;
      render();
    }, 200)
  );

  $("list-area").addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit]");
    if (edit) return openForm(edit.dataset.edit);

    const del = e.target.closest("[data-delete]");
    if (!del) return;
    const code = del.dataset.delete;
    const yes = await UI.confirm({
      title: "Xóa mã khuyến mãi?",
      message: "Mã <b>" + UI.esc(code) + "</b> sẽ bị xóa. Mã đã được dùng trong đơn hàng sẽ không xóa được (chỉ tắt).",
      okText: "Xóa mã",
      danger: true,
    });
    if (!yes) return;
    const res = Store.deletePromo(code);
    if (res.ok) UI.toast("Đã xóa mã " + code + ".", "info");
    else await UI.alert("Không thể xóa mã", UI.esc(res.error));
    render();
  });
  $("list-area").addEventListener("change", (e) => {
    if (!e.target.dataset.toggle) return;
    Store.setPromoActive(e.target.dataset.toggle, e.target.checked);
    UI.toast(e.target.checked ? "Đã bật mã khuyến mãi." : "Đã tắt mã khuyến mãi.");
    render();
  });

  render();
}

initPromoPage();
