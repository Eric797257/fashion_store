import "dotenv/config";
import { sendEmail } from "../src/integrations/email";

async function main() {
  await sendEmail({
    to: "test@example.test",
    subject: "Test email from the store",
    text: "If you can read this in Mailpit, email sending works.",
  });
  console.log("✅ Email handed to the SMTP server. Open http://localhost:8025 to see it.");
}

main().catch((err) => {
  console.error("❌ Email sending failed");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});