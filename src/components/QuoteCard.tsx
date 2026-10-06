import { motion } from "motion/react";
import { Share2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Quote } from "@/lib/backend/types";
import { shareText } from "@/lib/share";
import { useToasts } from "@/store/toast";
import { hapticTap } from "@/lib/haptics";

export function QuoteCard({ quote, compact }: { quote: Quote; compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const push = useToasts((s) => s.push);
  const text = i18n.language === "en" ? quote.text_en : quote.text_ru;

  const share = async () => {
    void hapticTap();
    const res = await shareText(`«${text}» — ${quote.author}`);
    if (res === "copied") push(t("common.copied"), "success");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="glass relative overflow-hidden p-6"
    >
      {/* Decorative: fully inside the card bounds, purely visual */}
      <Sparkles
        className="absolute right-3 top-3 text-accent opacity-20"
        size={44}
        aria-hidden
      />
      <p
        className={
          compact
            ? "text-[15px] font-medium leading-relaxed text-[var(--aq-foreground)]"
            : "text-xl font-medium leading-relaxed text-[var(--aq-foreground)]"
        }
      >
        «{text}»
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-[var(--aq-secondary)]">— {quote.author}</span>
        <button
          onClick={() => void share()}
          aria-label={t("common.share")}
          className="flex h-11 w-11 items-center justify-center rounded-full text-accent transition-colors hover:bg-accent/10"
        >
          <Share2 size={19} />
        </button>
      </div>
    </motion.div>
  );
}
