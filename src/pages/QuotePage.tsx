import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { QuoteCard } from "@/components/QuoteCard";
import { useQuotes, quoteOfDay } from "@/hooks/useData";
import type { QuoteCategory } from "@/lib/backend/types";
import { cn } from "@/lib/utils";

const CATEGORIES: (QuoteCategory | "all")[] = [
  "all",
  "motivation",
  "discipline",
  "love",
  "confidence",
];

export default function QuotePage() {
  const { t, i18n } = useTranslation();
  const quotes = useQuotes();
  const [category, setCategory] = useState<QuoteCategory | "all">("all");
  const [query, setQuery] = useState("");

  const today = useMemo(() => quoteOfDay(quotes.data ?? []), [quotes.data]);
  const feed = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (quotes.data ?? [])
      .filter((item) => category === "all" || item.category === category)
      .filter((item) => {
        if (!q) return true;
        const haystack = `${item.text_ru} ${item.text_en} ${item.author}`.toLowerCase();
        return haystack.includes(q);
      });
  }, [quotes.data, category, query]);

  return (
    <div className="space-y-5">
      <h1 className="text-[28px] font-semibold">{t("quote.title")}</h1>

      {today && (
        <section aria-label={t("quote.today")}>
          <h2 className="mb-2 px-1 text-sm font-medium text-[var(--aq-secondary)]">
            {t("quote.today")}
          </h2>
          <QuoteCard quote={today} />
        </section>
      )}

      {/* Category tabs: one scrollable row — nothing escapes the pill */}
      <div
        className="glass-pill flex max-w-full gap-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={t("quote.title")}
      >
        {CATEGORIES.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "min-h-[40px] shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors",
              category === c
                ? "bg-accent text-white"
                : "text-[var(--aq-secondary)] hover:bg-black/5 dark:hover:bg-white/10",
            )}
          >
            {c === "all" ? t("quote.all") : t(`quote.cat_${c}`)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--aq-secondary)]"
          size={18}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("quote.search")}
          aria-label={t("quote.search")}
          className="h-[52px] w-full rounded-field bg-white/80 pl-11 pr-4 text-[16px] text-[var(--aq-foreground)] shadow-field outline-none placeholder:text-[var(--aq-secondary)] focus-visible:ring-[3px] focus-visible:ring-[var(--aq-ring)] dark:bg-white/10"
        />
      </div>

      <div className="space-y-3">
        {feed.length === 0 ? (
          <div className="glass p-8 text-center text-sm text-[var(--aq-secondary)]">
            {t("quote.nothing")}
          </div>
        ) : (
          feed.map((q) => <QuoteCard key={q.id} quote={q} compact />)
        )}
      </div>
    </div>
  );
}
