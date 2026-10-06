import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Crown, DatabaseBackup, Download, KeyRound, Languages, LogOut, Moon, Palette, Bell } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { backend, type ThemeSetting } from "@/lib/backend";
import { useAuth } from "@/store/auth";
import { useToasts } from "@/store/toast";
import { applyAccent, applyTheme } from "@/lib/theme";
import { SEASONS, applySeason, storedSeason, type SeasonKey } from "@/lib/seasons";
import { enableNotifications, areNotificationsEnabled } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const THEMES: ThemeSetting[] = ["system", "light", "dark"];
const ACCENTS = ["#EC6FA0", "#8B5CF6", "#F97316", "#10B981", "#3AA7E8"];

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** PWA install: the site opens in its own window, like a native app. */
function useAppInstall() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const mq = window.matchMedia("(display-mode: standalone)");
    const sync = () => setStandalone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      mq.removeEventListener("change", sync);
    };
  }, []);

  const install = async (): Promise<"accepted" | "dismissed" | null> => {
    if (!promptEvent) return null;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setPromptEvent(null);
    return outcome;
  };

  return { canInstall: !!promptEvent, standalone, install };
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const push = useToasts((s) => s.push);
  const profile = useAuth((s) => s.profile);
  const setProfile = useAuth((s) => s.setProfile);
  const signInWithKey = useAuth((s) => s.signInWithKey);
  const signOut = useAuth((s) => s.signOut);
  const { canInstall, standalone, install } = useAppInstall();
  const [keyOpen, setKeyOpen] = useState(false);
  const [key, setKey] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [season, setSeason] = useState<SeasonKey | null>(storedSeason());
  const backupRef = useRef<HTMLInputElement>(null);

  const isPremium = profile?.role === "premium" || profile?.role === "admin";
  const [notifOn, setNotifOn] = useState(false);

  useEffect(() => {
    void areNotificationsEnabled().then(setNotifOn);
  }, []);

  const setTheme = async (theme: ThemeSetting) => {
    if (!profile) return;
    applyTheme(theme);
    setProfile(await backend.updateProfile(profile.id, { theme }));
  };

  const setLocale = async (locale: "ru" | "en") => {
    if (!profile) return;
    i18n.changeLanguage(locale);
    localStorage.setItem("aq.locale", locale);
    setProfile(await backend.updateProfile(profile.id, { locale }));
  };

  const setAccent = async (accent: string | null) => {
    if (!profile) return;
    setProfile(await backend.updateProfile(profile.id, { accent }));
    applyAccent(accent);
  };

  const setBlobHue = async (hue: number) => {
    if (!profile) return;
    setProfile(await backend.updateProfile(profile.id, { blob_hue: hue }));
  };

  const toggleNotifications = async (on: boolean) => {
    if (!on) {
      setNotifOn(false);
      return;
    }
    const res = await enableNotifications();
    if (res === "denied") push(t("settings.notifDenied"), "error");
    else if (res === "demo") push(t("settings.notifDemo"), "info");
    else push(t("settings.notifEnabled"), "success");
    setNotifOn(res === "granted");
  };

  const submitKey = async () => {
    if (!key.trim() || keyBusy) return;
    setKeyBusy(true);
    setKeyError(null);
    try {
      await signInWithKey(key);
      const role = useAuth.getState().profile?.role ?? "user";
      push(t("settings.keyOk", { role: t(`profile.role_${role}`) }), "success");
      setKeyOpen(false);
      setKey("");
    } catch {
      setKeyError(t("settings.keyWrong"));
    } finally {
      setKeyBusy(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-5">
      <h1 className="text-[28px] font-semibold">{t("settings.title")}</h1>

      {/* Key entry (bot-issued keys for Telegram / MAX) */}
      <Card className="flex items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-medium">
            <KeyRound size={18} /> {t("settings.keyEntry")}
          </p>
          <p className="mt-0.5 text-sm text-[var(--aq-secondary)]">
            {t("settings.keyEntryHint")}
          </p>
        </div>
        <Button size="sm" onClick={() => setKeyOpen(true)}>
          {t("common.continue")}
        </Button>
      </Card>
      <Sheet open={keyOpen} onClose={() => setKeyOpen(false)} title={t("settings.keyEntry")}>
        <div className="space-y-4">
          <input
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setKeyError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitKey();
            }}
            placeholder={t("settings.keyPh")}
            aria-label={t("settings.keyPh")}
            autoFocus
            className={cn(
              "h-[52px] w-full rounded-field bg-white/80 px-4 text-[16px] shadow-field outline-none",
              "placeholder:text-[var(--aq-secondary)] dark:bg-white/10",
              keyError && "text-[#E5484D]",
            )}
          />
          {keyError && (
            <p className="text-sm text-[#E5484D]" role="alert">
              {keyError}
            </p>
          )}
          <Button className="w-full" onClick={() => void submitKey()} disabled={keyBusy || !key.trim()}>
            {t("common.continue")}
          </Button>
        </div>
      </Sheet>

      <Card className="space-y-4">
        <CardTitle className="flex items-center gap-2">
          <Moon size={18} /> {t("settings.appearance")}
        </CardTitle>
        <div className="flex items-center justify-between">
          <span>{t("settings.theme")}</span>
          <div className="glass-pill flex gap-1 p-1">
            {THEMES.map((th) => (
              <button
                key={th}
                onClick={() => void setTheme(th)}
                aria-pressed={profile.theme === th}
                className={cn(
                  "min-h-[38px] rounded-full px-4 text-sm font-medium transition-colors",
                  profile.theme === th ? "bg-accent text-white" : "text-[var(--aq-secondary)]",
                )}
              >
                {t(`settings.${th}`)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Languages size={18} /> {t("settings.language")}
        </span>
        <div className="glass-pill flex gap-1 p-1">
          {(["ru", "en"] as const).map((l) => (
            <button
              key={l}
              onClick={() => void setLocale(l)}
              aria-pressed={i18n.language === l}
              className={cn(
                "min-h-[38px] rounded-full px-4 text-sm font-medium uppercase transition-colors",
                i18n.language === l ? "bg-accent text-white" : "text-[var(--aq-secondary)]",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </Card>

      {/* Premium */}
      <Card className="space-y-4">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Crown size={18} className="text-[#F97316]" /> {t("settings.premiumSection")}
          </span>
          <span className="rounded-full bg-accent/12 px-3 py-1 text-xs font-medium text-accent">
            {isPremium ? t("common.premium") : t("common.free")}
          </span>
        </CardTitle>

        {!isPremium ? (
          <Button className="w-full" onClick={() => navigate("/paywall")}>
            {t("common.upgrade")}
          </Button>
        ) : (
          <>
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm text-[var(--aq-secondary)]">
                <Palette size={15} /> {t("settings.accentColor")}
              </p>
              <div className="flex gap-2.5">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    aria-label={c}
                    aria-pressed={profile.accent === c}
                    onClick={() => void setAccent(profile.accent === c ? null : c)}
                    className={cn(
                      "h-9 w-9 rounded-full transition-transform",
                      profile.accent === c &&
                        "scale-110 ring-2 ring-accent ring-offset-2 ring-offset-white dark:ring-offset-[#0E2A44]",
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm text-[var(--aq-secondary)]">{t("extra.season")}</p>
              <div className="flex gap-2.5">
                {SEASONS.map((sn) => (
                  <button
                    key={sn.key}
                    aria-label={t(sn.labelKey)}
                    aria-pressed={season === sn.key}
                    onClick={() => {
                      setSeason(sn.key);
                      applySeason(sn.key);
                    }}
                    className={cn(
                      "h-9 w-9 rounded-full transition-transform",
                      season === sn.key &&
                        "scale-110 ring-2 ring-accent ring-offset-2 ring-offset-white dark:ring-offset-[#2A1220]",
                    )}
                    style={{ background: sn.accent }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm text-[var(--aq-secondary)]">{t("settings.blobLook")}</p>
              <input
                type="range"
                min={0}
                max={360}
                value={profile.blob_hue ?? 205}
                onChange={(e) => void setBlobHue(Number(e.target.value))}
                className="w-full accent-[var(--aq-accent)]"
                aria-label={t("settings.blobLook")}
              />
            </div>
          </>
        )}
      </Card>

      {/* Install as an app (PWA) */}
      {canInstall && !standalone && (
        <Card className="flex items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <Download size={18} /> {t("settings.installApp")}
            </p>
            <p className="mt-0.5 text-sm text-[var(--aq-secondary)]">
              {t("settings.installHint")}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() =>
              void install().then((outcome) => {
                if (outcome === "accepted") push(t("settings.appInstalled"), "success");
              })
            }
          >
            {t("common.activate")}
          </Button>
        </Card>
      )}

      <Card className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Bell size={18} /> {t("settings.enableNotifications")}
        </span>
        <Switch
          checked={notifOn}
          onCheckedChange={(v) => void toggleNotifications(v)}
          label={t("settings.notifications")}
        />
      </Card>

      <Card className="space-y-3">
        <CardTitle>{t("settings.about")}</CardTitle>
        <p className="text-sm text-[var(--aq-secondary)]">{t("settings.aboutText")}</p>
      </Card>

      {backend.mode === "demo" && (
        <Card className="space-y-3">
          <CardTitle className="flex items-center gap-2">
            <DatabaseBackup size={18} /> {t("extra.backup")}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="glass"
              className="flex-1"
              onClick={() => {
                const db = localStorage.getItem("aq.demo.v1") ?? "{}";
                const blob = new Blob([db], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "aq-backup.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              {t("extra.backup_export")}
            </Button>
            <Button size="sm" variant="glass" className="flex-1" onClick={() => backupRef.current?.click()}>
              {t("extra.backup_import")}
            </Button>
            <input
              ref={backupRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void f.text().then((text) => {
                  try {
                    JSON.parse(text);
                    localStorage.setItem("aq.demo.v1", text);
                    push(t("extra.backup_done"), "success");
                    window.setTimeout(() => location.reload(), 800);
                  } catch {
                    push(t("extra.backup_fail"), "error");
                  }
                });
                e.target.value = "";
              }}
            />
          </div>
        </Card>
      )}

      <Button
        variant="danger"
        className="w-full"
        onClick={() => void signOut()}
      >
        <LogOut size={17} /> {t("auth.signOut")}
      </Button>
    </div>
  );
}
