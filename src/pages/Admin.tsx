import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Ban, CircleCheck, Crown, Megaphone, Pencil, Plus, Send, Trash2, Users } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { FloatInput } from "@/components/ui/input";
import { useAuth } from "@/store/auth";
import { useToasts } from "@/store/toast";
import { backend, type Quote, type QuoteCategory, type Role } from "@/lib/backend";
import { useQuotes } from "@/hooks/useData";
import { cn } from "@/lib/utils";

const CATEGORIES: QuoteCategory[] = ["motivation", "discipline", "love", "confidence"];

interface QuoteDraft {
  id?: string;
  text_ru: string;
  text_en: string;
  author: string;
  category: QuoteCategory;
}

const emptyDraft: QuoteDraft = { text_ru: "", text_en: "", author: "", category: "motivation" };

export default function Admin() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const push = useToasts((s) => s.push);
  const profile = useAuth((s) => s.profile);

  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => backend.adminListUsers() });
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => backend.adminOverview(),
  });
  const quotes = useQuotes();

  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [bcTitle, setBcTitle] = useState("");
  const [bcBody, setBcBody] = useState("");

  const broadcasts = useQuery({
    queryKey: ["broadcasts"],
    queryFn: () => backend.listBroadcasts(),
    refetchInterval: 60_000,
  });

  const sendBroadcast = async () => {
    if (!profile || !bcTitle.trim() || !bcBody.trim()) return;
    await backend.createBroadcast(profile.id, { title: bcTitle.trim(), body: bcBody.trim() });
    void qc.invalidateQueries({ queryKey: ["broadcasts"] });
    push(t("admin.broadcastSent"), "success");
    setBcTitle("");
    setBcBody("");
  };

  const removeBroadcast = async (id: string) => {
    if (!window.confirm(t("admin.broadcastDelete"))) return;
    await backend.deleteBroadcast(id);
    void qc.invalidateQueries({ queryKey: ["broadcasts"] });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = users.data ?? [];
    if (!q) return list;
    return list.filter(
      (u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q),
    );
  }, [users.data, search]);

  if (profile?.role !== "admin") return <Navigate to="/" replace />;

  const updateUser = async (id: string, patch: { blocked?: boolean; role?: Role }) => {
    await backend.adminUpdateUser(id, patch);
    void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    void qc.invalidateQueries({ queryKey: ["admin", "overview"] });
  };

  const saveQuote = async () => {
    if (!draft || !draft.text_ru.trim() || !draft.text_en.trim()) return;
    const { id, ...rest } = draft;
    if (id) await backend.updateQuote(id, rest);
    else await backend.createQuote(rest);
    void qc.invalidateQueries({ queryKey: ["quotes"] });
    push(t("admin.quoteSaved"), "success");
    setDraft(null);
  };

  const deleteQuote = async (q: Quote) => {
    if (!window.confirm(t("habits.deleteConfirm"))) return;
    await backend.deleteQuote(q.id);
    void qc.invalidateQueries({ queryKey: ["quotes"] });
    push(t("admin.quoteDeleted"), "success");
  };

  const maxSignups = Math.max(1, ...(overview.data?.signupsByDay.map((d) => d.count) ?? [1]));
  const signupsTotal = (overview.data?.signupsByDay ?? []).reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-5">
      <h1 className="text-[28px] font-semibold">{t("admin.title")}</h1>

      {/* Overview */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <Users className="mx-auto text-accent" size={20} aria-hidden />
          <span className="mt-1 block text-2xl font-semibold">{signupsTotal}</span>
          <span className="text-xs text-[var(--aq-secondary)]">{t("admin.signups")}</span>
        </Card>
        <Card className="p-4 text-center">
          <CircleCheck className="mx-auto text-[#30A46C]" size={20} aria-hidden />
          <span className="mt-1 block text-2xl font-semibold">{overview.data?.dauToday ?? 0}</span>
          <span className="text-xs text-[var(--aq-secondary)]">{t("admin.dau")}</span>
        </Card>
        <Card className="p-4 text-center">
          <Crown className="mx-auto text-[#F97316]" size={20} aria-hidden />
          <span className="mt-1 block text-2xl font-semibold">
            {overview.data?.totalHabits ?? 0}
          </span>
          <span className="text-xs text-[var(--aq-secondary)]">{t("admin.totalHabits")}</span>
        </Card>
      </div>

      <Card>
        <CardTitle className="mb-3">{t("admin.signups")}</CardTitle>
        <div className="flex h-24 items-end gap-2" aria-hidden>
          {(overview.data?.signupsByDay ?? []).map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-accent/70"
                style={{ height: `${(d.count / maxSignups) * 72}px`, minHeight: 4 }}
              />
              <span className="text-[10px] text-[var(--aq-secondary)]">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Broadcast */}
      <Card className="space-y-3">
        <CardTitle className="flex items-center gap-2">
          <Megaphone size={18} className="text-accent" /> {t("admin.broadcast")}
        </CardTitle>
        <FloatInput label={t("admin.broadcastTitle")} value={bcTitle} onValueChange={setBcTitle} />
        <div className="relative">
          <textarea
            value={bcBody}
            onChange={(e) => setBcBody(e.target.value)}
            placeholder={t("admin.broadcastBody")}
            aria-label={t("admin.broadcastBody")}
            rows={3}
            className="w-full rounded-field bg-white/80 p-4 text-[16px] shadow-field outline-none placeholder:text-[var(--aq-secondary)] focus-visible:ring-[3px] focus-visible:ring-[var(--aq-ring)] dark:bg-white/10"
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => void sendBroadcast()}
            disabled={!bcTitle.trim() || !bcBody.trim()}
            className="gap-2"
          >
            <Send size={16} /> {t("admin.broadcastSend")}
          </Button>
        </div>
        <div className="space-y-2">
          {(broadcasts.data ?? []).map((b) => (
            <div
              key={b.id}
              className="flex items-start gap-3 rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.05]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{b.title}</p>
                <p className="text-sm text-[var(--aq-secondary)]">{b.body}</p>
                <p className="mt-1 text-xs text-[var(--aq-muted)]">
                  {new Date(b.created_at).toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <button
                onClick={() => void removeBroadcast(b.id)}
                aria-label={t("common.delete")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#E5484D] hover:bg-[#E5484D]/10"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {(broadcasts.data ?? []).length === 0 && (
            <p className="py-2 text-center text-sm text-[var(--aq-secondary)]">
              {t("admin.broadcastEmpty")}
            </p>
          )}
        </div>
      </Card>

      {/* Users */}
      <Card className="space-y-3">
        <CardTitle>{t("admin.users")}</CardTitle>
        <FloatInput label={t("admin.search")} value={search} onValueChange={setSearch} />
        <div className="space-y-2">
          {filtered.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center gap-2 rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.05]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {u.name} · <span className="text-[var(--aq-secondary)]">{u.email}</span>
                </p>
                <p className="text-xs text-[var(--aq-secondary)]">
                  {t("admin.role")}: {u.role}
                  {u.blocked ? " · ⛔" : ""}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="glass"
                  onClick={() =>
                    void updateUser(u.id, { role: u.role === "premium" ? "user" : "premium" })
                  }
                >
                  <Crown size={14} className={cn(u.role === "premium" && "text-[#F97316]")} />
                  {u.role === "premium" ? t("admin.revokePremium") : t("admin.grantPremium")}
                </Button>
                <Button
                  size="sm"
                  variant={u.blocked ? "primary" : "glass"}
                  onClick={() => void updateUser(u.id, { blocked: !u.blocked })}
                  aria-label={u.blocked ? t("admin.unblock") : t("admin.block")}
                >
                  {u.blocked ? <CircleCheck size={14} /> : <Ban size={14} />}
                  {u.blocked ? t("admin.unblock") : t("admin.block")}
                </Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-[var(--aq-secondary)]">
              {t("admin.empty")}
            </p>
          )}
        </div>
      </Card>

      {/* Quotes CRUD */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle>{t("admin.quotes")}</CardTitle>
          <Button size="sm" onClick={() => setDraft({ ...emptyDraft })} className="gap-1.5">
            <Plus size={15} /> {t("admin.addQuote")}
          </Button>
        </div>
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {(quotes.data ?? []).slice(0, 60).map((q) => (
            <div
              key={q.id}
              className="flex items-center gap-2 rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.05]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{q.text_ru}</p>
                <p className="truncate text-xs text-[var(--aq-secondary)]">
                  {q.author} · {t(`quote.cat_${q.category}`)}
                </p>
              </div>
              <button
                onClick={() => setDraft({ ...q })}
                aria-label={t("common.edit")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--aq-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => void deleteQuote(q)}
                aria-label={t("common.delete")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#E5484D] hover:bg-[#E5484D]/10"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? t("admin.editQuote") : t("admin.addQuote")}
      >
        {draft && (
          <div className="space-y-4">
            <FloatInput
              label={t("admin.textRu")}
              value={draft.text_ru}
              onValueChange={(v) => setDraft({ ...draft, text_ru: v })}
            />
            <FloatInput
              label={t("admin.textEn")}
              value={draft.text_en}
              onValueChange={(v) => setDraft({ ...draft, text_en: v })}
            />
            <FloatInput
              label={t("admin.author")}
              value={draft.author}
              onValueChange={(v) => setDraft({ ...draft, author: v })}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--aq-secondary)]">
                {t("admin.category")}
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, category: c })}
                    aria-pressed={draft.category === c}
                    className={cn(
                      "min-h-[44px] rounded-full px-4 text-sm font-medium",
                      draft.category === c
                        ? "bg-accent text-white"
                        : "bg-black/5 dark:bg-white/10",
                    )}
                  >
                    {t(`quote.cat_${c}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="glass" className="flex-1" onClick={() => setDraft(null)}>
                {t("common.cancel")}
              </Button>
              <Button className="flex-1" onClick={() => void saveQuote()}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
