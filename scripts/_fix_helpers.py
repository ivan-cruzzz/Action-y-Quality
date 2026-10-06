import pathlib
import re
p = pathlib.Path("src/lib/backend/supabase.ts")
s = p.read_text(encoding="utf-8")

# restore annotation
s = s.replace("export const supabaseBackend = {", "export const supabaseBackend: Backend = {")

helpers = [
    ("_setHabitLogOnline", "(habitId: string, userId: string, date: string, done: boolean)"),
    ("_setMoodOnline", "(userId: string, date: string, mood: number, note?: string)"),
    ("_createPlanOnline", '(p: Parameters<Backend["createPlan"]>[0])'),
    ("_updatePlanOnline", "(id: string, patch: Record<string, unknown>)"),
]

for helper, sig in helpers:
    # replace call sites: this._X( -> _X(
    s = s.replace("await this." + helper + "(", "await " + helper + "(")

for helper, sig in helpers:
    m = re.search(r"\n  async " + helper + r"\(" + re.escape(sig) + r"\) \{\n(.*?)\n  \},", s, re.S)
    if not m:
        raise SystemExit("helper not found: " + helper)
    body = m.group(1)
    s = s[: m.start()] + "\n" + s[m.end():]
    func = "\nasync function " + helper + sig + " {\n" + body + "\n}\n"
    s = s.replace(
        "export const supabaseBackend: Backend = {",
        func + "\nexport const supabaseBackend: Backend = {",
        1,
    )

p.write_text(s, encoding="utf-8")
print("helpers extracted")
