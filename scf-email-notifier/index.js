// SCF 入口：定时触发（推荐 5 分钟一次）。
// 逻辑：拉全表 → 过滤「状态=已确认 且 审批邮件已发≠true 且 有邮箱」→ 逐条发信 → 成功后回写「审批邮件已发=true」。
// 幂等：任何一步失败，标记保持 false，下一轮自动重试。

const feishu = require("./feishu");
const mailer = require("./mailer");
const { buildFormPdf } = require("./formpdf");

function buildMail(rec) {
  const f = rec.fields || {};
  const name        = f["联系人姓名"] || "同学";
  const exhibition  = f["展览名称"]   || "";
  const venue       = f["场地"]       || "";
  const start       = feishu.tsToDateStr(f["布展日期"]);
  const end         = feishu.tsToDateStr(f["撤展日期"]);
  const teacher     = f["指导教师"]   || "";

  const subject = `【展厅预约】"${exhibition}" 已通过审核`;
  const html = `
    <p>${name} 你好：</p>
    <p>你提交的展览预约已通过管理员审核，当前状态：<b>已确认</b>。</p>
    <table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd">
      <tr><td>展览名称</td><td>${exhibition}</td></tr>
      <tr><td>场地</td><td>${venue}</td></tr>
      <tr><td>布展日期</td><td>${start}</td></tr>
      <tr><td>撤展日期</td><td>${end}</td></tr>
      <tr><td>指导教师</td><td>${teacher}</td></tr>
    </table>
    <p>如需调整或取消，请直接回复此邮件。</p>
  `;
  return { subject, html };
}

exports.main_handler = async () => {
  const env = process.env;
  const token = await feishu.getToken(env);
  const all = await feishu.listAllRecords(env, token);

  const pending = all.filter(r => {
    const f = r.fields || {};
    const status = f["状态"];
    const sent   = f["审批邮件已发"] === true;
    const email  = (f["邮箱"] || "").toString().trim();
    return status === "已确认" && !sent && email;
  });

  let ok = 0, fail = 0;
  for (const r of pending) {
    const to = r.fields["邮箱"].toString().trim();
    try {
      const { subject, html } = buildMail(r);
      const { buffer, filename } = await buildFormPdf(r); // 生成填好的《布展申请表》PDF
      await mailer.send(env, {
        to,
        cc: env.NOTIFY_CC || undefined, // 可选：抄送管理员自己
        subject, html,
        attachments: [{ filename, content: buffer }],
      });
      await feishu.updateRecord(env, token, r.record_id, { "审批邮件已发": true });
      ok++;
      console.log(`[OK] ${r.record_id} → ${to}`);
    } catch (e) {
      fail++;
      console.error(`[FAIL] ${r.record_id} → ${to}: ${e.message}`);
    }
  }

  const summary = `扫描 ${all.length} 条，待发 ${pending.length}，成功 ${ok}，失败 ${fail}`;
  console.log(summary);
  return { ok: true, summary };
};
