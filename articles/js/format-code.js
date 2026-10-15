document.querySelectorAll(".source-code").forEach((source) => {
  const pre = document.createElement("pre");
  const code = document.createElement("code");

  let text = source.textContent;

  // Xóa dòng trống đầu và cuối
  text = text.replace(/^\s*\n/, "").replace(/\n\s*$/, "");

  // Tìm số khoảng trắng nhỏ nhất ở đầu các dòng
  const lines = text.split("\n");
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => line.match(/^[ \t]*/)[0].length);

  const minIndent = Math.min(...indents);

  // Xóa phần thụt chung
  text = lines.map((line) => line.slice(minIndent)).join("\n");

  code.textContent = text;

  pre.appendChild(code);
  source.replaceWith(pre);
});
