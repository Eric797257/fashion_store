"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";

export function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useTranslations("TwoFactor");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked. The codes stay visible and can be downloaded instead.
    }
  }

  function download() {
    const blob = new Blob([`${brand.name} backup codes\n\n${codes.join("\n")}\n`], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">{t("backupTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("backupBody")}</p>

      <ul className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-secondary p-4 font-mono text-sm sm:grid-cols-2">
        {codes.map((code) => (
          <li key={code} className="select-all">
            {code}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? t("copied") : t("copy")}
        </Button>
        <Button type="button" variant="outline" onClick={download}>
          {t("download")}
        </Button>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-1 size-4 accent-[var(--primary)]"
        />
        {t("savedCheck")}
      </label>

      <Button
        type="button"
        disabled={!saved}
        onClick={onDone}
        className="bg-primary text-primary-foreground hover:bg-primary-hover"
      >
        {t("done")}
      </Button>
    </div>
  );
}