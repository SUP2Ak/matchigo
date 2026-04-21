// Markdown renderer for benchmark results.
// Consumes a ScenarioResult[] and produces one big Markdown document.

export interface ContenderResult {
  name: string;
  // avg ns/iter (from mitata stats.avg — already in ns)
  avg: number;
  min: number;
  p50: number;
  p99: number;
  samples: number;
  error?: string;
}

export interface ScenarioResult {
  id: string;
  title: string;
  description: string;
  titleFr?: string;
  descriptionFr?: string;
  contenders: ContenderResult[];
}

export interface RuntimeInfo {
  name: "bun" | "node" | "deno" | "unknown";
  version: string;
  platform: string;
  arch: string;
  cpu?: string;
}

export type Locale = "en" | "fr";

interface Strings {
  title: string;
  generatedOn: (when: string, rt: RuntimeInfo) => string;
  lead: string;
  slowdownHint: string;
  suffixHint: string;
  summary: string;
  colScenario: string;
  colWinner: string;
  colFastestMg: string;
  colMgSlowdown: string;
  scenarios: string;
  scenarioLabel: (id: string, title: string) => string;
  colRank: string;
  colContender: string;
  colAvg: string;
  colP50: string;
  colP99: string;
  colOps: string;
  colSlowdown: string;
  winnerMark: string;
  footer: string;
  consoleHeader: (rt: RuntimeInfo) => string;
  consoleSlower: (ratio: number) => string;
}

const I18N: Record<Locale, Strings> = {
  en: {
    title: "# matchigo — benchmark report",
    generatedOn: (when, rt) =>
      `_Generated ${when} on **${rt.name} ${rt.version}** (${rt.platform} ${rt.arch}${rt.cpu ? ` · ${rt.cpu}` : ""})._`,
    lead: "Numbers are **per-iteration wall time** measured with [mitata](https://github.com/evanwashere/mitata). Lower is better. `ops/s` is the derived throughput.",
    slowdownHint:
      "- **slowdown** — how much slower than the fastest contender in the same scenario (1.00× = winner).",
    suffixHint:
      "- Contenders are suffixed with `[hoisted]` (matcher/compiler built once, reused) or `[inline]` (built fresh per call).",
    summary: "## Summary",
    colScenario: "Scenario",
    colWinner: "Winner",
    colFastestMg: "Fastest matchigo",
    colMgSlowdown: "matchigo slowdown",
    scenarios: "## Scenarios",
    scenarioLabel: (id, title) => `### Scenario ${id} — ${title}`,
    colRank: "Rank",
    colContender: "Contender",
    colAvg: "avg",
    colP50: "p50",
    colP99: "p99",
    colOps: "ops/s",
    colSlowdown: "slowdown",
    winnerMark: "**1.00×** (winner)",
    footer: "_Run it yourself: `bun run bench` (or `bun run bench:node`, `bun run bench:deno`)._",
    consoleHeader: (rt) => `▶ matchigo bench — ${rt.name} ${rt.version}`,
    consoleSlower: (ratio) => ` (${ratio.toFixed(2)}× slower)`,
  },
  fr: {
    title: "# matchigo — rapport de benchmark",
    generatedOn: (when, rt) =>
      `_Généré le ${when} sur **${rt.name} ${rt.version}** (${rt.platform} ${rt.arch}${rt.cpu ? ` · ${rt.cpu}` : ""})._`,
    lead: "Les chiffres sont le **temps par itération** mesuré avec [mitata](https://github.com/evanwashere/mitata). Plus bas = mieux. `ops/s` est le débit dérivé.",
    slowdownHint:
      "- **slowdown** — combien de fois plus lent que le plus rapide du même scénario (1.00× = gagnant).",
    suffixHint:
      "- Les challengers sont suffixés `[hoisted]` (matcher/compiler construit une fois, réutilisé) ou `[inline]` (reconstruit à chaque appel).",
    summary: "## Résumé",
    colScenario: "Scénario",
    colWinner: "Gagnant",
    colFastestMg: "matchigo le plus rapide",
    colMgSlowdown: "slowdown matchigo",
    scenarios: "## Scénarios",
    scenarioLabel: (id, title) => `### Scénario ${id} — ${title}`,
    colRank: "Rang",
    colContender: "Challenger",
    colAvg: "avg",
    colP50: "p50",
    colP99: "p99",
    colOps: "ops/s",
    colSlowdown: "slowdown",
    winnerMark: "**1.00×** (gagnant)",
    footer:
      "_Pour tourner toi-même : `bun run bench` (ou `bun run bench:node`, `bun run bench:deno`)._",
    consoleHeader: (rt) => `▶ matchigo bench — ${rt.name} ${rt.version}`,
    consoleSlower: (ratio) => ` (${ratio.toFixed(2)}× plus lent)`,
  },
};

function pickTitle(s: ScenarioResult, locale: Locale): string {
  return locale === "fr" && s.titleFr ? s.titleFr : s.title;
}

function pickDescription(s: ScenarioResult, locale: Locale): string {
  return locale === "fr" && s.descriptionFr ? s.descriptionFr : s.description;
}

function fmtNs(ns: number): string {
  if (!Number.isFinite(ns)) return "—";
  if (ns < 1_000) return `${ns.toFixed(2)} ns`;
  if (ns < 1_000_000) return `${(ns / 1_000).toFixed(2)} µs`;
  if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(2)} ms`;
  return `${(ns / 1_000_000_000).toFixed(2)} s`;
}

type OpsUnit = "G" | "M" | "K" | "";

function pickOpsUnit(bestNs: number): OpsUnit {
  if (!Number.isFinite(bestNs) || bestNs <= 0) return "M";
  const ops = 1e9 / bestNs;
  if (ops >= 1e9) return "G";
  if (ops >= 1e6) return "M";
  if (ops >= 1e3) return "K";
  return "";
}

function fmtOpsIn(ns: number, unit: OpsUnit): string {
  if (!Number.isFinite(ns) || ns <= 0) return "—";
  const ops = 1e9 / ns;
  const divisor =
    unit === "G" ? 1e9
    : unit === "M" ? 1e6
    : unit === "K" ? 1e3
    : 1;
  const label =
    unit === "G" ? "Gops/s"
    : unit === "M" ? "Mops/s"
    : unit === "K" ? "Kops/s"
    : "ops/s";
  const n = ops / divisor;
  // Use more precision for small values so "0.30 Mops/s" doesn't collapse to "0.00".
  const precision =
    n < 0.1 ? 4
    : n < 1 ? 3
    : 2;
  return `${n.toFixed(precision)} ${label}`;
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function fmtRatio(ratio: number, winnerMark: string): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "—";
  if (ratio === 1) return winnerMark;
  return `${ratio.toFixed(2)}×`;
}

function renderScenarioTable(s: ScenarioResult, t: Strings, locale: Locale): string {
  const ok = s.contenders.filter((c) => !c.error && Number.isFinite(c.avg));
  const winner = ok.reduce<ContenderResult | null>(
    (best, c) => (best === null || c.avg < best.avg ? c : best),
    null,
  );
  const opsUnit = pickOpsUnit(winner?.avg ?? Number.POSITIVE_INFINITY);

  const lines: string[] = [];
  lines.push(t.scenarioLabel(s.id, pickTitle(s, locale)));
  lines.push("");
  lines.push(`> ${pickDescription(s, locale)}`);
  lines.push("");
  lines.push(
    `| ${t.colRank} | ${t.colContender} | ${t.colAvg} | ${t.colP50} | ${t.colP99} | ${t.colOps} | ${t.colSlowdown} |`,
  );
  lines.push("| ---: | :-------- | --: | --: | --: | ----: | -------: |");

  const sorted = [...s.contenders].sort((a, b) => {
    if (a.error && !b.error) return 1;
    if (!a.error && b.error) return -1;
    return a.avg - b.avg;
  });

  let rank = 0;
  for (const c of sorted) {
    const safeName = escapeCell(c.name);
    if (c.error) {
      lines.push(`| — | ${safeName} | ❌ error | — | — | — | — |`);
      continue;
    }
    rank++;
    const vsWinner = winner ? c.avg / winner.avg : NaN;
    const nameCell = c.name.startsWith("matchigo") ? `**${safeName}**` : safeName;
    lines.push(
      `| ${rank} | ${nameCell} | ${fmtNs(c.avg)} | ${fmtNs(c.p50)} | ${fmtNs(c.p99)} | ${fmtOpsIn(c.avg, opsUnit)} | ${fmtRatio(vsWinner, t.winnerMark)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderHeader(rt: RuntimeInfo, when: Date, t: Strings): string {
  const lines: string[] = [];
  lines.push(t.title);
  lines.push("");
  lines.push(t.generatedOn(when.toISOString(), rt));
  lines.push("");
  lines.push(t.lead);
  lines.push("");
  lines.push(t.slowdownHint);
  lines.push(t.suffixHint);
  lines.push("");
  return lines.join("\n");
}

function renderSummary(results: ScenarioResult[], t: Strings, locale: Locale): string {
  const lines: string[] = [];
  lines.push(t.summary);
  lines.push("");
  lines.push(`| ${t.colScenario} | ${t.colWinner} | ${t.colFastestMg} | ${t.colMgSlowdown} |`);
  lines.push("| :------- | :----- | ---------------: | ----------------: |");
  for (const s of results) {
    const titleCell = escapeCell(pickTitle(s, locale));
    const ok = s.contenders.filter((c) => !c.error && Number.isFinite(c.avg));
    if (ok.length === 0) {
      lines.push(`| ${s.id} — ${titleCell} | — | — | — |`);
      continue;
    }
    const winner = ok.reduce((a, b) => (a.avg < b.avg ? a : b));
    const mg = ok
      .filter((c) => c.name.startsWith("matchigo"))
      .reduce<ContenderResult | null>(
        (best, c) => (best === null || c.avg < best.avg ? c : best),
        null,
      );
    const mgCell = mg ? `${escapeCell(mg.name)} (${fmtNs(mg.avg)})` : "—";
    const ratioCell = mg && winner ? fmtRatio(mg.avg / winner.avg, t.winnerMark) : "—";
    lines.push(
      `| ${s.id} — ${titleCell} | ${escapeCell(winner.name)} (${fmtNs(winner.avg)}) | ${mgCell} | ${ratioCell} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function renderMarkdown(
  results: ScenarioResult[],
  runtime: RuntimeInfo,
  when: Date = new Date(),
  locale: Locale = "en",
): string {
  const t = I18N[locale];
  const parts: string[] = [];
  parts.push(renderHeader(runtime, when, t));
  parts.push(renderSummary(results, t, locale));
  parts.push(t.scenarios);
  parts.push("");
  for (const s of results) {
    parts.push(renderScenarioTable(s, t, locale));
  }
  parts.push("---");
  parts.push("");
  parts.push(t.footer);
  parts.push("");
  return parts.join("\n");
}

/* -------------------------------------------------------------------------- */
/* Console summary — compact, human-readable                                   */
/* -------------------------------------------------------------------------- */

export function renderConsoleSummary(
  results: ScenarioResult[],
  runtime: RuntimeInfo,
  locale: Locale = "en",
): string {
  const t = I18N[locale];
  const lines: string[] = [];
  lines.push("");
  lines.push(t.consoleHeader(runtime));
  lines.push("");
  for (const s of results) {
    const ok = s.contenders.filter((c) => !c.error && Number.isFinite(c.avg));
    if (ok.length === 0) continue;
    const winner = ok.reduce((a, b) => (a.avg < b.avg ? a : b));
    const opsUnit = pickOpsUnit(winner.avg);
    lines.push(`  [${s.id}] ${pickTitle(s, locale)}`);
    const sorted = [...ok].sort((a, b) => a.avg - b.avg);
    for (const c of sorted) {
      const tag = c === winner ? "🏆" : "  ";
      const ratio = c === winner ? "" : t.consoleSlower(c.avg / winner.avg);
      lines.push(
        `    ${tag} ${c.name.padEnd(38)} ${fmtNs(c.avg).padStart(10)} · ${fmtOpsIn(c.avg, opsUnit).padStart(14)}${ratio}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
