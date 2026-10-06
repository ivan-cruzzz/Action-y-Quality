import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Cloud, ListChecks, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatInput } from "@/components/ui/input";
import { backend } from "@/lib/backend";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/lib/haptics";

const GOALS = ["discipline", "health", "focus", "mood", "energy"] as const;

export default function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profile = useAuth((s) => s.profile);
  const setProfile = useAuth((s) => s.setProfile);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);

  const finish = async () => {
    if (!profile) return;
    const updated = await backend.updateProfile(profile.id, {
      name: name.trim() || profile.name,
      goals,
      onboarded: true,
    });
    setProfile(updated);
    void hapticTap();
    navigate("/mood", { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <p className="mb-6 text-sm text-[var(--aq-secondary)]">
        {t("onboarding.step", { n: step + 1 })}
      </p>

      {step === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="glass w-full max-w-sm space-y-5 p-6"
        >
          <h1 className="text-2xl font-semibold">{t("onboarding.nameTitle")}</h1>
          <p className="text-[var(--aq-secondary)]">{t("onboarding.nameSub")}</p>
          <FloatInput
            label={t("auth.name")}
            value={name}
            onValueChange={(v) => {
              setName(v);
              setNameError(null);
            }}
            error={nameError}
            autoFocus
          />
          <Button
            className="w-full"
            onClick={() => {
              if (!name.trim()) {
                setNameError(t("auth.nameRequired"));
                return;
              }
              setStep(1);
            }}
          >
            {t("common.continue")}
          </Button>
        </motion.div>
      )}

      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="glass w-full max-w-sm space-y-5 p-6"
        >
          <h1 className="text-2xl font-semibold">{t("onboarding.goalsTitle")}</h1>
          <p className="text-[var(--aq-secondary)]">{t("onboarding.goalsSub")}</p>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => {
              const active = goals.includes(g);
              return (
                <motion.button
                  key={g}
                  whileTap={{ scale: 0.95 }}
                  onClick={() =>
                    setGoals((prev) => (active ? prev.filter((x) => x !== g) : [...prev, g]))
                  }
                  aria-pressed={active}
                  className={cn(
                    "min-h-[44px] rounded-full px-5 py-2.5 text-[15px] font-medium transition-colors",
                    active
                      ? "bg-accent text-white"
                      : "bg-black/5 text-[var(--aq-foreground)] dark:bg-white/10",
                  )}
                >
                  {t(`onboarding.goal_${g}`)}
                </motion.button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <Button variant="glass" onClick={() => setStep(0)}>
              {t("common.back")}
            </Button>
            <Button className="flex-1" onClick={() => setStep(2)}>
              {t("common.continue")}
            </Button>
          </div>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="glass w-full max-w-sm space-y-5 p-6"
        >
          <h1 className="text-2xl font-semibold">{t("onboarding.ritualTitle")}</h1>
          <ul className="space-y-4">
            <li className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <Cloud size={22} />
              </span>
              {t("onboarding.ritual_1")}
            </li>
            <li className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <ListChecks size={22} />
              </span>
              {t("onboarding.ritual_2")}
            </li>
            <li className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <BarChart3 size={22} />
              </span>
              {t("onboarding.ritual_3")}
            </li>
          </ul>
          <div className="flex gap-3">
            <Button variant="glass" onClick={() => setStep(1)}>
              {t("common.back")}
            </Button>
            <Button className="flex-1" onClick={() => void finish()}>
              {t("onboarding.finish")}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
