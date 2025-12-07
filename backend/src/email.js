require('dotenv').config();

// Minimal email helper module.
// This file no longer contains carrier gateway attempts, Resend usage, or Firebase logic.
// It exposes a simple `sendVerificationEmail` that will send an email via Gmail SMTP
// if `GMAIL_USER`/`GMAIL_PASSWORD` are configured in the environment; otherwise it
// logs the code for development.

const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASSWORD
    }
  });
}

const sendVerificationEmail = async (email, code) => {
  const subject = 'Verify Your Socially Account';
  const text = `Your Socially verification code is: ${code}. This code expires in 10 minutes.`;

  if (!transporter) {
    console.log('Email transporter not configured. Development mode:');
    console.log(`Would send email to ${email} — ${text}`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject,
      text
    });
    console.log('Verification email sent to', email);
    return true;
  } catch (err) {
    console.error('Error sending verification email:', err && err.message ? err.message : err);
    return false;
  }
};

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

module.exports = { sendVerificationEmail, generateVerificationCode };

