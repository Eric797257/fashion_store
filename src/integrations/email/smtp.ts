import nodemailer from "nodemailer";
import type { EmailMessage, EmailProvider } from "./types";

export function createSmtpProvider(): EmailProvider {
    const port = Number(process.env.SMTP_PORT ?? 1025);

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? "localhost",
        port,
        secure: port === 465,
        auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" }
            : undefined,
    });

    const from = process.env.EMAIL_FROM ?? "Brand Store <no-reply@example.com>";

    return {
        async send(message: EmailMessage) {
            await transporter.sendMail({
                from,
                to: message.to,
                subject: message.subject,
                text: message.text,
                html: message.html,
            });
        },
    };
}