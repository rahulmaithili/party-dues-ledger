"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// =============================================
// NODEMAILER TRANSPORTER
// Gmail credentials from .env file (MAIL_USER, MAIL_PASS)
// =============================================
function createTransporter() {
  const user = process.env.MAIL_USER || "";
  const pass = process.env.MAIL_PASS || "";
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });
}

// =============================================
// HELPER: Professional HTML Email Template
// =============================================
function buildOtpEmail(userName, otp, companyName, companyLogoUrl) {
  const logoHtml = companyLogoUrl
    ? `<img src="${companyLogoUrl}" alt="${companyName}" style="max-height:60px;max-width:180px;object-fit:contain;margin-bottom:12px;">`
    : `<h2 style="color:#10B981;margin:0;font-size:22px;font-weight:800;font-family:Arial,sans-serif;">${companyName}</h2>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Password Reset OTP</title>
</head>
<body style="margin:0;padding:0;background:#0F172A;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:40px 0;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#0F172A;border:1px solid #1E293B;border-radius:16px;overflow:hidden;max-width:96%;box-shadow:0 20px 40px rgba(0,0,0,0.4);">
        <!-- HEADER -->
        <tr>
          <td align="center" style="padding:30px 40px 20px;background:#1E293B;border-bottom:1px solid #334155;">
            ${logoHtml}
          </td>
        </tr>
        <!-- BODY -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#94A3B8;font-size:15px;margin:0 0 8px 0;">Hello,</p>
            <h2 style="color:#F1F5F9;font-size:18px;font-weight:700;margin:0 0 20px 0;">${userName}</h2>
            <p style="color:#94A3B8;font-size:14px;line-height:1.7;margin:0 0 28px 0;">
              We received a request to reset your password on <strong style="color:#F1F5F9;">${companyName}</strong>.<br>
              Use the OTP below to complete your password reset. This code is valid for <strong style="color:#F59E0B;">10 minutes only</strong>.
            </p>
            <!-- OTP BOX -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background:#020617;border:1px solid rgba(16,185,129,0.25);border-radius:12px;padding:28px 20px;">
                  <p style="color:#64748B;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px 0;">Your One-Time Password</p>
                  <p style="color:#10B981;font-size:36px;font-weight:900;letter-spacing:10px;font-family:monospace,Courier,sans-serif;margin:0;">${otp}</p>
                </td>
              </tr>
            </table>
            <p style="color:#475569;font-size:13px;margin:28px 0 0 0;">
              If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </p>
          </td>
        </tr>
        <!-- FOOTER -->
        <tr>
          <td style="padding:20px 40px;background:#020617;border-top:1px solid #1E293B;text-align:center;">
            <p style="color:#334155;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            <p style="color:#334155;font-size:11px;margin:4px 0 0 0;">This is an automated security email. Please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// =============================================
// FUNCTION 1: Send OTP Email
// Called when user clicks "Forgot Password"
// =============================================
exports.requestPasswordReset = functions.https.onCall(async (data, context) => {
  const email = (data.email || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    throw new functions.https.HttpsError("invalid-argument", "Valid email is required.");
  }

  // Check user exists in our Firestore users collection
  const userSnap = await db.collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (userSnap.empty) {
    throw new functions.https.HttpsError("not-found", "No account found with this email address.");
  }

  const userData = userSnap.docs[0].data();
  const userName = userData.name || "User";

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Save OTP to Firestore
  await db.collection("passwordResets").add({
    email,
    otp,
    expiresAt,
    used: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Get company profile for branding
  let companyName = "Mr.Rahul ERP";
  let companyLogoUrl = "";
  try {
    const cpSnap = await db.collection("companyProfile").limit(1).get();
    if (!cpSnap.empty) {
      const cp = cpSnap.docs[0].data();
      companyName = cp.companyName || companyName;
      companyLogoUrl = cp.companyLogo || "";
    }
  } catch (e) {}

  // Send email
  const transporter = createTransporter();
  const fromEmail = process.env.MAIL_USER || "noreply@example.com";

  await transporter.sendMail({
    from: `"${companyName}" <${fromEmail}>`,
    to: email,
    subject: `Password Reset OTP - ${companyName}`,
    html: buildOtpEmail(userName, otp, companyName, companyLogoUrl)
  });

  functions.logger.info(`OTP sent to ${email}`);

  return { success: true, message: "A 6-digit OTP has been sent to your email." };
});

// =============================================
// FUNCTION 2: Verify OTP & Reset Password
// Called when user submits OTP + new password
// =============================================
exports.resetPasswordWithOtp = functions.https.onCall(async (data, context) => {
  const email = (data.email || "").trim().toLowerCase();
  const otp = (data.otp || "").trim();
  const newPassword = data.newPassword || "";

  if (!email || !otp || !newPassword) {
    throw new functions.https.HttpsError("invalid-argument", "Email, OTP, and new password are required.");
  }

  if (newPassword.length < 6) {
    throw new functions.https.HttpsError("invalid-argument", "Password must be at least 6 characters.");
  }

  // Find matching unused OTP
  const snap = await db.collection("passwordResets")
    .where("email", "==", email)
    .where("otp", "==", otp)
    .where("used", "==", false)
    .orderBy("expiresAt", "desc")
    .limit(1)
    .get();

  if (snap.empty) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid OTP. Please check and try again.");
  }

  const record = snap.docs[0];
  const recordData = record.data();

  // Check expiry
  if (Date.now() > recordData.expiresAt) {
    await record.ref.update({ used: true });
    throw new functions.https.HttpsError("deadline-exceeded", "OTP has expired. Please request a new one.");
  }

  // Get Firebase Auth user by email
  let authUser;
  try {
    authUser = await admin.auth().getUserByEmail(email);
  } catch (e) {
    throw new functions.https.HttpsError("not-found", "Account not found in authentication system.");
  }

  // Reset password using Firebase Admin SDK
  await admin.auth().updateUser(authUser.uid, { password: newPassword });

  // Also update passwordHash in our Firestore users collection
  const userSnap = await db.collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (!userSnap.empty) {
    // Simple hash (same as frontend)
    let hash = 0;
    for (let i = 0; i < newPassword.length; i++) {
      const char = newPassword.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const passwordHash = Math.abs(hash).toString(16);
    await userSnap.docs[0].ref.update({ passwordHash });
  }

  // Mark OTP as used
  await record.ref.update({ used: true });

  functions.logger.info(`Password reset successful for ${email}`);

  return { success: true, message: "Password has been reset successfully. You can now log in." };
});
