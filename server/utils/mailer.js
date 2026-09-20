const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host:   process.env.MAIL_HOST,
    port:   Number(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});

const FROM   = `"SahakarConnect" <${process.env.MAIL_USER}>`;
const CLIENT = process.env.CLIENT_URL || 'http://localhost:5173';

const wrap = (body) => `
<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F1FAF8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1FAF8;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:12px;border:1px solid #DDE6E4;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#0F766E,#14A098);padding:26px 36px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">🔧 SahakarConnect</p>
          </td>
        </tr>
        <tr><td style="padding:36px 36px 28px;">${body}</td></tr>
        <tr>
          <td style="padding:16px 36px;border-top:1px solid #DDE6E4;background:#F4F7F6;text-align:center;">
            <p style="margin:0;font-size:11px;color:#aaa;">
              If you didn't request this, you can safely ignore this email.<br/>
              © ${new Date().getFullYear()} SahakarConnect · All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const btn = (href, label) =>
    `<a href="${href}" style="display:inline-block;padding:12px 30px;
      background:linear-gradient(135deg,#0F766E,#14A098);color:#fff;font-weight:700;
      font-size:15px;border-radius:8px;text-decoration:none;">${label}</a>`;

const sendVerificationEmail = async (email, name, token) => {
    const link = `${CLIENT}/verify-email/${token}`;
    const body = `
      <h2 style="margin:0 0 8px;font-size:22px;color:#1a1a1a;">Verify your email</h2>
      <p style="margin:0 0 24px;color:#555;line-height:1.65;">
        Hi <strong>${name}</strong>, welcome to SahakarConnect!<br/>
        Click below to verify your email. This link expires in <strong>24 hours</strong>.
      </p>
      ${btn(link, 'Verify Email')}
      <p style="margin:20px 0 0;font-size:12px;color:#999;">
        Or copy:<br/><a href="${link}" style="color:#0F766E;word-break:break-all;">${link}</a>
      </p>`;
    await transporter.sendMail({ from: FROM, to: email, subject: 'Verify your SahakarConnect email', html: wrap(body) });
};

const sendPasswordResetEmail = async (email, name, token) => {
    const link = `${CLIENT}/reset-password/${token}`;
    const body = `
      <h2 style="margin:0 0 8px;font-size:22px;color:#1a1a1a;">Reset your password</h2>
      <p style="margin:0 0 24px;color:#555;line-height:1.65;">
        Hi <strong>${name}</strong>,<br/>
        We received a password reset request. This link expires in <strong>1 hour</strong>.
      </p>
      ${btn(link, 'Reset Password')}
      <p style="margin:20px 0 0;font-size:12px;color:#999;">
        Or copy:<br/><a href="${link}" style="color:#0F766E;word-break:break-all;">${link}</a>
      </p>`;
    await transporter.sendMail({ from: FROM, to: email, subject: 'Reset your SahakarConnect password', html: wrap(body) });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
