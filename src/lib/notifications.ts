/** Local notifications for habit reminders (Capacitor); no-op/demo on web. */

export type NotifResult = "granted" | "denied" | "demo";

export async function enableNotifications(): Promise<NotifResult> {
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return "denied";
    return "granted";
  } catch {
    return "demo";
  }
}

export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const perm = await LocalNotifications.checkPermissions();
    return perm.display === "granted";
  } catch {
    return false;
  }
}

/**
 * Schedules a repeating local notification for one habit.
 * `days` uses the app convention: 0 = Monday … 6 = Sunday.
 */
export async function scheduleHabitReminder(
  id: string,
  title: string,
  time: string,
  days: number[],
): Promise<void> {
  if (!days.length) return;
  const [hh, mm] = time.split(":").map(Number);
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id: hashId(id) }] });
    await LocalNotifications.schedule({
      notifications: days.map((day) => ({
        id: hashId(id) + day,
        title: "Action & Quality",
        body: title,
        schedule: {
          on: { weekday: jsWeekday(day), hour: hh, minute: mm },
          allowWhileIdle: true,
        },
      })),
    });
  } catch {
    /* web or permission missing */
  }
}

export async function cancelHabitReminder(id: string): Promise<void> {
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const notifications = Array.from({ length: 7 }, (_, day) => ({ id: hashId(id) + day }));
    await LocalNotifications.cancel({ notifications });
  } catch {
    /* ignore */
  }
}

/** Capacitor ids are int32. */
function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 1_000_000;
}

/** App weekday (0=Mon) → JS weekday (1=Sun..7=Sat as Capacitor expects). */
function jsWeekday(appDay: number): number {
  return ((appDay + 1) % 7) + 1;
}
