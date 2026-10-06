import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Hand, ArrowRight, Frown, Annoyed, Meh, Smile, Laugh } from "lucide-react";
import { MoodBlob, MOOD_STYLES, DEFAULT_MOOD } from "@/components/MoodBlob";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";
import { useSetMood, useTodayMood } from "@/hooks/useData";
import { hapticTap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const STRIP_ICONS = [Frown, Annoyed, Meh, Smile, Laugh];

export default function MoodCheckIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const profile = useAuth((s) => s.profile);
  const userId = useAuth((s) => s.user?.id);
  const today = useTodayMood(userId);
  const setMood = useSetMood(userId);
  const mood = today.data?.mood ?? DEFAULT_MOOD;
  const savedRef = useRef(today.data?.mood != null);

  // Persist the default once when the screen opens without a check-in today.
  useEffect(() => {
    if (today.isSuccess && today.data == null && !savedRef.current) {
      savedRef.current = true;
      setMood.mutate({ mood: DEFAULT_MOOD });
    }
  }, [today.isSuccess, today.data, setMood]);

  const [note, setNote] = useState(today.data?.note ?? "");

  const select = (next: number) => {
    if (next === mood) return;
    void hapticTap();
    savedRef.current = true;
    setMood.mutate({ mood: next, note: note.trim() || undefined });
  };

  const saveNote = () => {
    savedRef.current = true;
    setMood.mutate({ mood, note: note.trim() });
  };

  const style = MOOD_STYLES[mood] ?? MOOD_STYLES[DEFAULT_MOOD];
  const label = t(`mood.m_${mood}`);

  const onSwipe = (_e: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x < -50) select(Math.min(5, mood + 1));
    else if (info.offset.x > 50) select(Math.max(1, mood - 1));
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Full-screen mood gradient, crossfaded with a spring on change */}
      {Object.keys(MOOD_STYLES).map((k) => {
        const m = Number(k);
        const s = MOOD_STYLES[m];
        return (
          <motion.div
            key={m}
            className="absolute inset-0 -z-10"
            style={{ background: `linear-gradient(180deg, ${s.bg[0]} 0%, ${s.bg[1]} 100%)` }}
            initial={false}
            animate={{ opacity: m === mood ? 1 : 0 }}
            transition={
              reduced ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 18, mass: 0.9 }
            }
            aria-hidden
          />
        );
      })}

      <motion.div
        className="flex min-h-dvh flex-col items-center px-6 pb-10 pt-14 text-center"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        dragSnapToOrigin
        onDragEnd={onSwipe}
      >
        <p className="text-sm" style={{ color: style.inkSoft }}>
          {t("mood.greeting", { name: profile?.name || "" })}
        </p>
        <h1
          className="mt-3 whitespace-pre-line text-[32px] font-semibold leading-tight sm:text-[38px]"
          style={{ color: style.inkStrong }}
        >
          {t("mood.title")}
        </h1>

        <motion.div
          className="mt-2"
          key={mood}
          initial={{ scale: 0.96 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
        >
          <MoodBlob mood={mood} hue={profile?.blob_hue ?? null} />
        </motion.div>

        <motion.p
          key={`label-${mood}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="text-[32px] font-semibold"
          style={{ color: style.label }}
        >
          {label}
        </motion.p>

        <Button
          variant="glass"
          size="lg"
          className="mt-6 px-10"
          style={{
            /* «Белое стекло» по ТЗ — независимо от темы поверх яркого градиента */
            background: "rgba(255,255,255,0.85)",
            borderColor: "rgba(255,255,255,0.6)",
          }}
          onClick={() => {
            void hapticTap();
            navigate("/");
          }}
        >
          <span className="flex items-center gap-2 text-[#0B2540]">
            {t("common.continue")} <ArrowRight size={18} />
          </span>
        </Button>

        <p className="mt-5 flex items-center gap-2 text-sm" style={{ color: style.inkSoft }}>
          <Hand size={16} /> {t("mood.hint")}
        </p>

        {/* Journal note */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          rows={2}
          placeholder={t("extra.journal_note")}
          aria-label={t("extra.journal_note")}
          className="glass mt-5 w-full max-w-sm resize-none rounded-field p-4 text-[15px] text-[var(--aq-foreground)] outline-none placeholder:text-[var(--aq-secondary)]"
        />

        {/* Bottom glass strip with 5 mood icons; swipes switch the mood */}
        <motion.div
          className="glass-pill mt-auto flex items-center gap-1.5 px-3 py-2.5 shadow-glass"
          style={{
            background: "rgba(255,255,255,0.82)",
            borderColor: "rgba(255,255,255,0.6)",
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          dragSnapToOrigin
          onDragEnd={onSwipe}
          role="group"
          aria-label={t("a11y.moodStrip")}
        >
          {STRIP_ICONS.map((Icon, i) => {
            const value = i + 1;
            const active = mood === value;
            return (
              <motion.button
                key={value}
                whileTap={{ scale: 0.9 }}
                animate={{ scale: active ? 1.25 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                onClick={() => select(value)}
                aria-label={t(`mood.m_${value}`)}
                aria-pressed={active}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                  active
                    ? "bg-white text-[#0B2540] shadow-lg"
                    : "text-[#0B2540]/75 hover:bg-white/60",
                )}
              >
                <Icon size={22} />
              </motion.button>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}
