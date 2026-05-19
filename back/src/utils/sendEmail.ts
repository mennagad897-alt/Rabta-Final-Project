import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

// Fallback to ensure environment variables are loaded
dotenv.config();

interface EmailOptions {
  email: string;
  subject: string;
  message?: string;
  html?: string;
}

const sendEmail = async (options: EmailOptions) => {
  // Debug log to verify env variables are loaded (without exposing the raw password)
  console.log("Email Auth Check -> USER:", process.env.EMAIL_USER, "| PASS EXISTS:", !!process.env.EMAIL_PASS);

  // 1) Create a transporter with debug flags enabled
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    logger: true, // Logs every step of the SMTP handshake to the terminal
    debug: true   // Shows detailed error codes (e.g. 535 Auth Failed)
  });

  // 2) Define the email options
  const mailOptions = {
    from: 'Rabta App <hello@rabta.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html
  };

  // 3) Actually send the email
  await transporter.sendMail(mailOptions);
};

export default sendEmail;
