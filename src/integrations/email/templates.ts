import { brand } from "../../config/brand";

export type AuthEmailKind =
  | "verify-email"
  | "reset-password"
  | "password-changed"
  | "existing-account";
export type EmailLocale = "en" | "my";

interface Copy {
  subject: string;
  heading: string;
  body: string;
  button: string;
  note: string;
}

// Burmese text is a starter draft. Please have a native speaker review it.
const COPY: Record<EmailLocale, Record<AuthEmailKind, Copy>> = {
  en: {
    "verify-email": {
      subject: "Verify your email address",
      heading: "Confirm your email",
      body: "Hi {name}, thanks for creating an account with {brand}. Please confirm your email address to finish setting up.",
      button: "Verify email",
      note: "This link expires in 24 hours. If you didn't create an account, you can ignore this email.",
    },
    "reset-password": {
      subject: "Reset your password",
      heading: "Reset your password",
      body: "Hi {name}, we received a request to reset the password for your {brand} account.",
      button: "Choose a new password",
      note: "This link expires in 1 hour and works once. If you didn't request it, you can ignore this email and your password will not change.",
    },
    "password-changed": {
      subject: "Your password was changed",
      heading: "Password changed",
      body: "Hi {name}, the password for your {brand} account was just changed. If this was you, no action is needed.",
      button: "Reset password",
      note: "If it wasn't you, reset your password now and contact us at {email}.",
    },
    "existing-account": {
      subject: "Sign-up attempt with your email",
      heading: "Someone tried to create an account",
      body: "Hi {name}, a sign-up was attempted with this email address, but you already have an account with {brand}. If it was you, just sign in, or reset your password if you forgot it.",
      button: "Sign in",
      note: "If this wasn't you, you can safely ignore this email.",
    },
  },
  my: {
    "verify-email": {
      subject: "သင့်အီးမေးလ်ကို အတည်ပြုပါ",
      heading: "အီးမေးလ် အတည်ပြုရန်",
      body: "မင်္ဂလာပါ {name}၊ {brand} တွင် အကောင့်ဖွင့်သည့်အတွက် ကျေးဇူးတင်ပါသည်။ စတင်အသုံးပြုရန် သင့်အီးမေးလ်ကို အတည်ပြုပေးပါ။",
      button: "အီးမေးလ် အတည်ပြုရန်",
      note: "ဤလင့်ခ်သည် ၂၄ နာရီအတွင်း သက်တမ်းကုန်ပါမည်။ သင် အကောင့်မဖွင့်ခဲ့ပါက ဤအီးမေးလ်ကို လျစ်လျူရှုနိုင်ပါသည်။",
    },
    "reset-password": {
      subject: "စကားဝှက် ပြန်လည်သတ်မှတ်ရန်",
      heading: "စကားဝှက် ပြန်လည်သတ်မှတ်ရန်",
      body: "မင်္ဂလာပါ {name}၊ သင်၏ {brand} အကောင့်အတွက် စကားဝှက် ပြန်လည်သတ်မှတ်ရန် တောင်းဆိုမှု ရရှိပါသည်။",
      button: "စကားဝှက်အသစ် ရွေးရန်",
      note: "ဤလင့်ခ်သည် ၁ နာရီအတွင်း သက်တမ်းကုန်ပြီး တစ်ကြိမ်သာ သုံးနိုင်ပါသည်။ သင် မတောင်းဆိုခဲ့ပါက ဤအီးမေးလ်ကို လျစ်လျူရှုနိုင်ပြီး သင့်စကားဝှက် မပြောင်းလဲပါ။",
    },
    "password-changed": {
      subject: "သင့်စကားဝှက် ပြောင်းလဲသွားပါပြီ",
      heading: "စကားဝှက် ပြောင်းလဲပြီး",
      body: "မင်္ဂလာပါ {name}၊ သင်၏ {brand} အကောင့် စကားဝှက်ကို ယခုပင် ပြောင်းလဲလိုက်ပါသည်။ သင်ကိုယ်တိုင် ပြောင်းခဲ့ပါက ဘာမျှ လုပ်ရန်မလိုပါ။",
      button: "စကားဝှက် ပြန်လည်သတ်မှတ်ရန်",
      note: "သင်မဟုတ်ပါက စကားဝှက်ကို ယခုပင် ပြန်လည်သတ်မှတ်ပြီး {email} သို့ ဆက်သွယ်ပါ။",
    },
    "existing-account": {
      subject: "သင့်အီးမေးလ်ဖြင့် အကောင့်ဖွင့်ရန် ကြိုးစားမှု",
      heading: "တစ်စုံတစ်ဦးက အကောင့်ဖွင့်ရန် ကြိုးစားခဲ့သည်",
      body: "မင်္ဂလာပါ {name}၊ ဤအီးမေးလ်ဖြင့် အကောင့်ဖွင့်ရန် ကြိုးစားခဲ့သော်လည်း သင့်တွင် {brand} အကောင့် ရှိပြီးဖြစ်ပါသည်။ သင်ကိုယ်တိုင်ဖြစ်ပါက အကောင့်ဝင်ပါ၊ စကားဝှက်မေ့ပါက ပြန်လည်သတ်မှတ်ပါ။",
      button: "အကောင့်ဝင်ရန်",
      note: "သင်မဟုတ်ပါက ဤအီးမေးလ်ကို လျစ်လျူရှုနိုင်ပါသည်။",
    },
  },
};

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

export function renderAuthEmail(input: {
  kind: AuthEmailKind;
  locale: EmailLocale;
  name: string;
  url: string;
}) {
  const copy = COPY[input.locale][input.kind];
  const vars = {
    name: input.name || (input.locale === "my" ? "မိတ်ဆွေ" : "there"),
    brand: brand.name,
    email: brand.contact.email,
  };

  const heading = fill(copy.heading, vars);
  const body = fill(copy.body, vars);
  const note = fill(copy.note, vars);
  const subject = `${fill(copy.subject, vars)} · ${brand.name}`;

  const text = [heading, "", body, "", `${copy.button}: ${input.url}`, "", note].join("\n");

  const html = `<!doctype html>
<html lang="${input.locale}">
<body style="margin:0;background:#FAF9F6;font-family:Inter,Arial,'Noto Sans Myanmar',sans-serif;color:#20211F;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E8E6DF;border-radius:12px;">
        <tr><td style="padding:32px;">
          <div style="font-family:Georgia,serif;font-size:24px;font-weight:600;padding-bottom:20px;">${escapeHtml(brand.name)}</div>
          <div style="font-family:Georgia,serif;font-size:22px;font-weight:600;padding-bottom:12px;">${escapeHtml(heading)}</div>
          <p style="font-size:15px;line-height:1.7;margin:0 0 24px;">${escapeHtml(body)}</p>
          <a href="${escapeHtml(input.url)}" style="display:inline-block;background:#47745B;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">${escapeHtml(copy.button)}</a>
          <p style="font-size:13px;line-height:1.7;color:#73756F;margin:24px 0 0;">${escapeHtml(note)}</p>
          <p style="font-size:12px;line-height:1.6;color:#73756F;margin:16px 0 0;word-break:break-all;">${escapeHtml(input.url)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}