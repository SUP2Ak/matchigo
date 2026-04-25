// Dev-only cold-path instrumentation.
// Resolution policy (evaluated ONCE at module load → zero runtime cost):
//
//   1. NODE_ENV — matches "production", "prod" (case-insensitive) → off.
//   2. Else default → on (verbose dev).
//
// Programmatic override: silenceWarnings() at startup mutes everything.
// No NODE_ENV at all? Dev mode is ON. The counters still cost only a few `++`
// ops per call; the console.warn only ever fires ONCE per counter per process.

const DEV: boolean = (() => {
  try {
    if (typeof process === "undefined" || !process?.env) return true;
    const node = (process.env.NODE_ENV ?? "").toLowerCase();
    if (node === "production" || node === "prod") return false;
    return true;
  } catch {
    return true;
  }
})();

let matchCalls = 0;
let matchMisses = 0;
let matcherInstances = 0;
let warnedMatch = false;
let warnedMatcher = false;

const THRESHOLD_MATCH = 500;
const THRESHOLD_MATCHER = 1000;
const MISS_RATIO = 0.9;

export function trackMatch(cacheHit: boolean): void {
  if (!DEV || warnedMatch) return;
  matchCalls++;
  if (!cacheHit) matchMisses++;
  if (matchCalls === THRESHOLD_MATCH && matchMisses / matchCalls > MISS_RATIO) {
    console.warn(
      `[matchigo] ⚠  cold-path detected: ${matchMisses}/${matchCalls} calls to ` +
        `match(value, rules) received a fresh 'rules' reference each time.\n` +
        `  You're recompiling the rules on every call. Fix:\n` +
        `    • Hoist rules out of the hot function:\n` +
        `        const RULES = [...] as const;\n` +
        `        match(value, RULES);\n` +
        `    • Or compile once with compile():\n` +
        `        const dispatch = compile([...]);\n` +
        `        dispatch(value);\n` +
        `  Silence: silenceWarnings() — or set NODE_ENV=production.`,
    );
    warnedMatch = true;
  }
}

export function trackMatcher(): void {
  if (!DEV || warnedMatcher) return;
  matcherInstances++;
  if (matcherInstances === THRESHOLD_MATCHER) {
    console.warn(
      `[matchigo] ⚠  matcher() instantiated ${THRESHOLD_MATCHER}+ times.\n` +
        `  If you're building it inside a hot function, hoist it:\n` +
        `      const classify = matcher<T, R>()\n` +
        `        .with(...)\n` +
        `        .otherwise(...);   // builds + compiles once\n` +
        `      classify(value);      // reused hot path\n` +
        `  Silence: silenceWarnings() — or set NODE_ENV=production.`,
    );
    warnedMatcher = true;
  }
}

export function silenceWarnings(): void {
  warnedMatch = true;
  warnedMatcher = true;
}

export function __resetDevCounters(): void {
  matchCalls = 0;
  matchMisses = 0;
  matcherInstances = 0;
  warnedMatch = false;
  warnedMatcher = false;
}

export function __isDev(): boolean {
  return DEV;
}
