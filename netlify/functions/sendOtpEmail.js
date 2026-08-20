const nodemailer = require("nodemailer");

exports.handler = async function (event, context) {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { to_email, to_name, otp, company_name } = body;

  if (!to_email || !otp) {
    return { statusCode: 400, body: JSON.stringify({ error: "email and otp are required" }) };
  }

  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_PASS = process.env.GMAIL_PASS;

  if (!GMAIL_USER || !GMAIL_PASS) {
    return { statusCode: 500, body: JSON.stringify({ error: "Email service not configured" }) };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_PASS }
  });

  const companyName = company_name || "Shiv Shakti Gas ERP";
  const userName = to_name || "User";

  const htmlEmail = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0F172A;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0F172A;border:1px solid #1E293B;border-radius:16px;overflow:hidden;max-width:95%;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
        <tr>
          <td align="center" style="padding:28px 40px 20px;background:linear-gradient(135deg,#1E293B,#0F172A);border-bottom:1px solid #334155;">
            <h2 style="color:#10B981;margin:0;font-size:20px;font-weight:800;font-family:Arial,sans-serif;letter-spacing:1px;">${companyName}</h2>
            <p style="color:#64748B;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;margin:4px 0 0;">Password Reset</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#94A3B8;font-size:15px;margin:0 0 6px;">Hello,</p>
            <h3 style="color:#F1F5F9;font-size:17px;font-weight:700;margin:0 0 20px;">${userName}</h3>
            <p style="color:#94A3B8;font-size:14px;line-height:1.7;margin:0 0 28px;">
              Aapne apne <strong style="color:#F1F5F9;">${companyName}</strong> account ka password reset request kiya hai.<br>
              Neeche diya gaya OTP use karein. Yeh <strong style="color:#F59E0B;">10 minute</strong> ke liye valid hai.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background:#020617;border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:30px 20px;">
                  <p style="color:#64748B;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px;">Your One-Time Password</p>
                  <p style="color:#10B981;font-size:40px;font-weight:900;letter-spacing:12px;font-family:Courier,monospace;margin:0;">${otp}</p>
                </td>
              </tr>
            </table>
            <p style="color:#475569;font-size:13px;margin:24px 0 0;line-height:1.6;">
              Agar aapne yeh request nahi ki, toh is email ko ignore karein. Aapka password safe hai.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 40px;background:#020617;border-top:1px solid #1E293B;text-align:center;">
            <p style="color:#334155;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            <p style="color:#334155;font-size:11px;margin:4px 0 0;">Yeh ek automated security email hai. Reply na karein.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"${companyName}" <${GMAIL_USER}>`,
      to: to_email,
      subject: `${otp} — Password Reset OTP | ${companyName}`,
      html: htmlEmail
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, message: "OTP email sent successfully" })
    };
  } catch (error) {
    console.error("Email send error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
