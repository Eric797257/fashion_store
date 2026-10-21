import { createSmtpProvider } from "./smtp";
import type { EmailMessage, EmailProvider } from "./types";

let provider: EmailProvider | undefined;

/** Sends one email. Throws if delivery fails. */
export async function sendEmail(message: EmailMessage): Promise<void> {
    provider ??= createSmtpProvider();
    await provider.send(message);
}

export type { EmailMessage } from "./types";