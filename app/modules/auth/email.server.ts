import nodemailer from "nodemailer";

type SendEmailBody = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(body: SendEmailBody) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Verify SMTP connection configuration
  await transporter.verify();

  const email = await transporter.sendMail({
    from: `"The Better Handbook" <${process.env.EMAIL_USER}>`,
    to: body.to,
    subject: body.subject,
    html: body.html,
    text: body.text,
  });

  return email;
}
