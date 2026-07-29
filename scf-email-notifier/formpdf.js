// 用飞书记录字段直接生成《布展申请表》PDF（不可编辑），返回 Buffer 作邮件附件。
// 直接画 PDF，避免 docx→pdf 需要的排版引擎（SCF 里装不了）。
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { tsToDateStr } = require("./feishu");

const FONT_PATH = path.join(__dirname, "assets", "NotoSansSC.ttf");
const VENUES = ["展厅", "15号楼一楼走廊", "16号楼一楼走廊", "学院一楼花园中庭"];

function cnDate(ts) {
  const s = tsToDateStr(ts);
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${y}年${m}月${d}日`;
}

// 返回 Promise<Buffer>
function renderPdf(rec) {
  return new Promise((resolve, reject) => {
    const f = rec.fields || {};
    const venue = f["场地"] || "";
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.registerFont("cn", FONT_PATH);
    doc.font("cn");

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const L = doc.page.margins.left;
    const W = doc.page.width - doc.page.margins.left - doc.page.margins.right; // 内容宽
    const col = W / 6;

    // 标题
    doc.fontSize(17).text("湖州师范大学艺术学院展厅使用登记表", L, 55, { width: W, align: "center" });

    let y = 95;
    const lineH = 30;
    const F = 10.5; // 正文字号

    // 值单元格自动缩字号：从 max 逐档缩小，直到文本能在一行内放下（最低 min）
    function fitSize(text, maxW, max, min) {
      let s = max;
      while (s > min) { doc.fontSize(s); if (doc.widthOfString(text) <= maxW) break; s -= 0.5; }
      return s;
    }

    // 画一个单元格：边框 + 文本；label 单元格加灰底；opts.fit=true 时值文本自动缩放不换行
    function cell(x, w, h, text, opts = {}) {
      if (opts.fill) { doc.save().rect(x, y, w, h).fill("#F2F2F2").restore(); }
      doc.lineWidth(0.7).rect(x, y, w, h).stroke("#000");
      if (text) {
        const base = opts.size || F;
        const size = opts.fit ? fitSize(text, w - 8, base, 6) : base;
        doc.fillColor("#000").fontSize(size);
        const ty = y + (h - size) / 2 - 1;
        doc.text(text, x + 4, ty, { width: w - 8, align: opts.align || "left", lineBreak: false });
      }
    }

    // Row A: 展览名称 | 值(2) | 展览班级 | 值(2)
    cell(L,           col,     lineH, "展览名称", { align: "center", fill: true });
    cell(L + col,     col * 2, lineH, f["展览名称"] || "", { fit: true });
    cell(L + col * 3, col,     lineH, "展览班级", { align: "center", fill: true });
    cell(L + col * 4, col * 2, lineH, f["班级"] || "", { fit: true });
    y += lineH;

    // Row B: 指导教师 | 值 | 布展日期 | 值 | 撤展日期 | 值
    const rowB = [
      ["指导教师", true], [f["指导教师"] || "", false],
      ["布展日期", true], [cnDate(f["布展日期"]), false],
      ["撤展日期", true], [cnDate(f["撤展日期"]), false],
    ];
    rowB.forEach(([t, isLabel], i) => cell(L + col * i, col, lineH, t, { align: isLabel ? "center" : "left", fill: isLabel, fit: !isLabel }));
    y += lineH;

    // Row C: 联系人姓名 | 值 | 联系人电话 | 值 | 联系人邮箱 | 值
    const rowC = [
      ["联系人姓名", true], [f["联系人姓名"] || "", false],
      ["联系人电话", true], [(f["电话"] || "").toString(), false],
      ["联系人邮箱", true], [(f["邮箱"] || "").toString(), false],
    ];
    rowC.forEach(([t, isLabel], i) => cell(L + col * i, col, lineH, t, { align: isLabel ? "center" : "left", fill: isLabel, size: 9, fit: !isLabel }));
    y += lineH;

    // Row D: 展览场地 | 复选框(5)
    cell(L, col, lineH, "展览场地", { align: "center", fill: true });
    cell(L + col, col * 5, lineH, "");
    // 在场地单元格里画复选框
    let cx = L + col + 8;
    const boxY = y + lineH / 2 - 5;
    doc.fontSize(9.5);
    VENUES.forEach((v) => {
      doc.lineWidth(0.8).rect(cx, boxY, 10, 10).stroke("#000");
      if (v === venue) { // 打勾
        doc.lineWidth(1.2).moveTo(cx + 2, boxY + 5).lineTo(cx + 4, boxY + 8).lineTo(cx + 8.5, boxY + 1.5).stroke("#000");
      }
      doc.fillColor("#000").text(v, cx + 14, y + lineH / 2 - 6, { lineBreak: false });
      cx += 14 + doc.widthOfString(v) + 18;
    });
    y += lineH;

    // Row E: 指导教师意见 | 大空框(5)
    const boxH = 120;
    cell(L, col, boxH, "", { fill: true });
    doc.fontSize(F).fillColor("#000").text("指导\n教师\n意见", L + 4, y + boxH / 2 - 24, { width: col - 8, align: "center" });
    cell(L + col, col * 5, boxH, "");
    doc.fontSize(F).text("签名：", L + col * 5, y + boxH - 42, { width: col - 8, align: "left" });
    doc.text("年      月      日", L + col + 8, y + boxH - 22, { align: "right", width: col * 5 - 16 });
    y += boxH;

    // 备注
    y += 14;
    doc.fontSize(9).fillColor("#000");
    doc.text("备注：（1）艺术学院展厅开展期间的安全问题由申请使用部门负责落实，学院对此不负责。", L, y, { width: W });
    doc.text("（2）请展览联系人履行提醒班级同学如期撤展的职责。", L + 24, doc.y + 2, { width: W - 24 });
    doc.text("（3）若发现某班级三次未如期撤展，该班级后续的布展申请会被驳回。", L + 24, doc.y + 2, { width: W - 24 });

    doc.end();
  });
}

async function buildFormPdf(rec) {
  const buffer = await renderPdf(rec);
  const safeName = ((rec.fields && rec.fields["展览名称"]) || "预约").replace(/[\\/:*?"<>|]/g, "");
  return { buffer, filename: `布展申请表-${safeName}.pdf` };
}

module.exports = { buildFormPdf };
