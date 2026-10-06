import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Crown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/ui/confetti";
import { backend } from "@/lib/backend";
import { useAuth } from "@/store/auth";
import { useToasts } from "@/store/toast";

const FEATURES = ["f_habits", "f_stats", "f_accent", "f_blob", "f_export"] as const;

export default function Paywall() {
  const { t } = useTranslation();
  const push = useToasts((s) => s.push);
  const profile = useAuth((s) => s.profile);
  const setProfile = useAuth((s) => s.setProfile);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const already = profile?.role === "premium" || profile?.role === "admin";

  const activate = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const updated = await backend.grantPremium(profile.id);
      setProfile(updated);
      setDone(true);
      push(t("paywall.activated"), "success");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Confetti fire={done ? 1 : 0} />
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F97316] text-white shadow-[0_12px_32px_rgba(249,115,22,0.4)]">
          <Crown size={30} />
        </div>
        <h1 className="text-2xl font-semibold">{t("paywall.title")}</h1>
        <p className="max-w-xs text-[var(--aq-secondary)]">{t("paywall.subtitle")}</p>
      </Card>

      <Card className="space-y-3">
        {FEATURES.map((f) => (
          <div key={f} className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Check size={15} strokeWidth={3} />
            </span>
            <span>{t(`paywall.${f}`)}</span>
          </div>
        ))}
      </Card>

      <Button size="lg" className="w-full" onClick={() => void activate()} disabled={busy || done || already}>
        {already ? t("common.premium") : t("paywall.activate")}
      </Button>
      <p className="text-center text-xs text-[var(--aq-secondary)]">{t("paywall.note")}</p>
    </div>
  );
}
