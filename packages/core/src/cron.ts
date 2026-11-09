// Minimal 5-field cron evaluator in a named timezone. Used by `mm tick` to decide
// which products are due, so a single scheduled task can run the whole machine.

type Field = Set<number>;

function parseField(f: string, min: number, max: number): Field {
  const out = new Set<number>();
  for (const part of f.split(",")) {
    const [range, stepStr] = part.split("/");
    const step = stepStr ? Number(stepStr) : 1;
    let lo = min;
    let hi = max;
    if (range !== "*") {
      const [a, b] = range.split("-").map(Number);
      lo = a;
      hi = b ?? (stepStr ? max : a);
    }
    if ([lo, hi, step].some((n) => Number.isNaN(n))) throw new Error(`Bad cron field "${f}"`);
    for (let v = lo; v <= hi; v += step) out.add(v === 7 && max === 6 ? 0 : v);
  }
  return out;
}

export interface Cron {
  minute: Field;
  hour: Field;
  dom: Field;
  month: Field;
  dow: Field;
  domStar: boolean;
  dowStar: boolean;
}

export function isCron(expr: string): boolean {
  return /^[\d*,\-/]+(\s+[\d*,\-/]+){4}$/.test(expr.trim());
}

export function parseCron(expr: string): Cron {
  const [mi, h, dom, mo, dow] = expr.trim().split(/\s+/);
  return {
    minute: parseField(mi, 0, 59),
    hour: parseField(h, 0, 23),
    dom: parseField(dom, 1, 31),
    month: parseField(mo, 1, 12),
    dow: parseField(dow, 0, 6),
    domStar: dom === "*",
    dowStar: dow === "*",
  };
}

function partsIn(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { minute: Number(p.minute), hour: Number(p.hour), dom: Number(p.day), month: Number(p.month), dow };
}

export function matches(c: Cron, date: Date, timeZone: string): boolean {
  const p = partsIn(date, timeZone);
  if (!c.minute.has(p.minute) || !c.hour.has(p.hour) || !c.month.has(p.month)) return false;
  // Standard cron: if both dom and dow are restricted, either may match.
  const domOk = c.dom.has(p.dom);
  const dowOk = c.dow.has(p.dow);
  if (c.domStar && c.dowStar) return true;
  if (c.domStar) return dowOk;
  if (c.dowStar) return domOk;
  return domOk || dowOk;
}

/** Most recent scheduled time at or before `now`, searching back up to `maxDays`. */
export function previousRun(expr: string, now: Date, timeZone = "Asia/Kolkata", maxDays = 62): Date | undefined {
  const c = parseCron(expr);
  const t = new Date(now);
  t.setUTCSeconds(0, 0);
  const limit = maxDays * 24 * 60;
  for (let i = 0; i <= limit; i++) {
    if (matches(c, t, timeZone)) return new Date(t);
    t.setUTCMinutes(t.getUTCMinutes() - 1);
  }
  return undefined;
}

/** Due if a scheduled time has passed since the last run (or it has never run). */
export function isDue(expr: string, lastRun: Date | undefined, now: Date, timeZone = "Asia/Kolkata"): boolean {
  if (!isCron(expr)) return false;
  const prev = previousRun(expr, now, timeZone);
  if (!prev) return false;
  return !lastRun || lastRun < prev;
}
