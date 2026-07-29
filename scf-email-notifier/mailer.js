// nodemailer 封装：默认走网易企业邮箱 SMTP（smtp.qiye.163.com:465 SSL）。
// 账号 + 授权码从环境变量读，不写在代码里。

const nodemailer = require("nodemailer");

function makeTransport(env) {
  return nodemailer.createTransport({
    host: env.SMTP_HOST || "smtp.qiye.163.com",
    port: Number(env.SMTP_PORT || 465),
    secure: Number(env.SMTP_PORT || 465) === 465, // 465=SSL, 587=STARTTLS
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

async function send(env, { to, cc, subject, html, attachments }) {
  const transporter = makeTransport(env);
  return transporter.sendMail({
    from: env.SMTP_USER,     // 与登录账号一致，否则易被拒收/判 spam
    to, cc, subject, html,
    attachments,             // [{ filename, content: Buffer }]
  });
}

module.exports = { send };
