// SCF 入口：每天定时（推荐 cron `0 0 9 * * ? *`，北京时间早 9 点一次）。
// 逻辑：拉全表 → 过滤「布展日期 = 今天+3 且 状态=已确认 且 前三天邮件已发≠true 且 有邮箱」
//       → 复用 formpdf 生成填好的《布展申请表》PDF → 发给班长（联系人邮箱）→ 回写「前三天邮件已发=true」。
// 幂等：任何一步失败，标记保持 false，明天同一时段再扫（窗口只有目标日当天，见下）。
// 注意：窗口是「布展日 - 3」当天。若某天定时整体没跑成，第二天目标日已过，这条会漏发——
//       靠每天准点触发 + 回写幂等把漏发概率压到很低；真漏了在飞书里一眼可见、可手动补。
//
// 与 index.js（每 5 分钟：确认信 + 驳回信）是两个独立部署：同一份 zip，
// 换 handler 入口（daily.main_handler）+ 换定时触发器（每天 9 点）即可。

const feishu = require("./feishu");
const mailer = require("./mailer");
const { buildFormPdf } = require("./formpdf");

function buildReminderMail(rec) {
  const f = rec.fields || {};
  const name        = f["联系人姓名"] || "同学";
  const exhibition  = f["展览名称"]   || "";
  const venue       = f["场地"]       || "";
  const start       = feishu.tsToDateStr(f["布展日期"]);
  const end         = feishu.tsToDateStr(f["撤展日期"]);

  const subject = `【展厅预约】"${exhibition}" 将于 3 天后布展，请填写《登记表》`;
  const html = `
    <p>${name} 你好：</p>
    <p>你预约的展览将于 <b>3 天后（${start}）</b> 布展。附件是根据你的预约信息填好的《布展申请表》，请打印后交指导教师手写签名，布展当天带到展厅备查。</p>
    <table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd">
      <tr><td>展览名称</td><td>${exhibition}</td></tr>
      <tr><td>场地</td><td>${venue}</td></tr>
      <tr><td>布展日期</td><td>${start}</td></tr>
      <tr><td>撤展日期</td><td>${end}</td></tr>
    </table>
    <p>如需调整或取消，请直接回复此邮件。</p>
  `;
  return { subject, html };
}

exports.main_handler = async () => {
  const env = process.env;
  const token = await feishu.getToken(env);
  const all = await feishu.listAllRecords(env, token);

  // 目标布展日 = 今天+3（北京时间，YYYY-MM-DD）。tsToDateStr 内部已加 8 小时时区偏移。
  const target = feishu.tsToDateStr(Date.now() + 3 * 86400000);

  const pending = all.filter(r => {
    const f = r.fields || {};
    const status = f["状态"];
    const sent   = f["前三天邮件已发"] === true;
    const email  = (f["邮箱"] || "").toString().trim();
    const setup  = feishu.tsToDateStr(f["布展日期"]);
    return status === "已确认" && !sent && email && setup === target;
  });

  let ok = 0, fail = 0;
  for (const r of pending) {
    const to = r.fields["邮箱"].toString().trim();
    try {
      const { subject, html } = buildReminderMail(r);
      const { buffer, filename } = await buildFormPdf(r); // 复用现成《布展申请表》PDF 生成
      await mailer.send(env, {
        to,
        cc: env.NOTIFY_CC || undefined, // 可选：抄送管理员自己
        subject, html,
        attachments: [{ filename, content: buffer }],
      });
      await feishu.updateRecord(env, token, r.record_id, { "前三天邮件已发": true });
      ok++;
      console.log(`[OK] ${r.record_id} → ${to}`);
    } catch (e) {
      fail++;
      console.error(`[FAIL] ${r.record_id} → ${to}: ${e.message}`);
    }
  }

  const summary = `扫描 ${all.length} 条，目标布展日 ${target}，待发 ${pending.length}，成功 ${ok}，失败 ${fail}`;
  console.log(summary);
  return { ok: true, summary };
};
