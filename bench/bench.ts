// Benchmark runner — works on Bun, Node (>= 22 with --experimental-strip-types),
// and Deno. Uses mitata's programmatic `measure()` so we can collect raw stats
// and render our own Markdown report.

import { measure } from "mitata";
import { scenarios } from "./scenarios.ts";
import {
  renderConsoleSummary,
  renderMarkdown,
  type ContenderResult,
  type RuntimeInfo,
  type ScenarioResult,
} from "./report.ts";

/* -------------------------------------------------------------------------- */
/* Runtime detection                                                           */
/* -------------------------------------------------------------------------- */

declare const Bun: { version: string } | undefined;
declare const Deno: { version: { deno: string }; build: { os: string; arch: string } } | undefined;

function detectRuntime(): RuntimeInfo {
  const g = globalThis as unknown as {
    Bun?: { version: string };
    Deno?: {
      version: { deno: string };
      build: { os: string; arch: string };
    };
    process?: {
      version: string;
      platform: string;
      arch: string;
      versions?: { node?: string; bun?: string };
    };
  };

  if (g.Bun) {
    return {
      name: "bun",
      version: g.Bun.version,
      platform: g.process?.platform ?? "unknown",
      arch: g.process?.arch ?? "unknown",
    };
  }
  if (g.Deno) {
    return {
      name: "deno",
      version: g.Deno.version.deno,
      platform: g.Deno.build.os,
      arch: g.Deno.build.arch,
    };
  }
  if (g.process?.versions?.node) {
    return {
      name: "node",
      version: g.process.versions.node,
      platform: g.process.platform,
      arch: g.process.arch,
    };
  }
  return {
    name: "unknown",
    version: "?",
    platform: "?",
    arch: "?",
  };
}

/* -------------------------------------------------------------------------- */
/* File / stdout helpers (runtime-agnostic)                                    */
/* -------------------------------------------------------------------------- */

async function writeTextFile(path: string, data: string): Promise<void> {
  const g = globalThis as unknown as {
    Bun?: { write(path: string, data: string): Promise<number> };
    Deno?: { writeTextFile(path: string, data: string): Promise<void> };
  };
  if (g.Bun) {
    await g.Bun.write(path, data);
    return;
  }
  if (g.Deno) {
    await g.Deno.writeTextFile(path, data);
    return;
  }
  const fs = await import("node:fs/promises");
  await fs.writeFile(path, data, "utf8");
}

/* -------------------------------------------------------------------------- */
/* Run                                                                         */
/* -------------------------------------------------------------------------- */

async function runOne(name: string, fn: () => unknown): Promise<ContenderResult> {
  try {
    // Warm up so JITs don't poison the first samples.
    for (let i = 0; i < 200; i++) fn();

    const stats = await measure(fn, {
      min_samples: 12,
      max_samples: 128,
      warmup_samples: 4,
      min_cpu_time: 250_000_000, // 250 ms per contender
    });

    return {
      name,
      avg: stats.avg,
      min: stats.min,
      p50: stats.p50,
      p99: stats.p99,
      samples: stats.ticks,
    };
  } catch (err) {
    return {
      name,
      avg: NaN,
      min: NaN,
      p50: NaN,
      p99: NaN,
      samples: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  const runtime = detectRuntime();

  // Silence the dev warning noise from matchigo for the inline / cold-path
  // scenario — the whole *point* of that scenario is to show the penalty, we
  // don't need matchigo to lecture us while we measure it.
  const mg = await import("../src/index.ts");
  mg.silenceWarnings();

  process.stdout?.write?.(
    `▶ matchigo bench — ${runtime.name} ${runtime.version} (${runtime.platform} ${runtime.arch})\n`,
  );
  process.stdout?.write?.(
    `  ${scenarios.length} scenarios, ${scenarios.reduce((n, s) => n + s.contenders.length, 0)} contenders total\n\n`,
  );

  const results: ScenarioResult[] = [];
  for (const s of scenarios) {
    process.stdout?.write?.(`  [${s.id}] ${s.title}\n`);
    const cResults: ContenderResult[] = [];
    for (const c of s.contenders) {
      process.stdout?.write?.(`      · ${c.name.padEnd(40)} `);
      const r = await runOne(c.name, c.fn);
      cResults.push(r);
      if (r.error) {
        process.stdout?.write?.(`ERROR: ${r.error}\n`);
      } else {
        process.stdout?.write?.(`${r.avg.toFixed(2).padStart(10)} ns/iter\n`);
      }
    }
    results.push({
      id: s.id,
      title: s.title,
      description: s.description,
      titleFr: s.titleFr,
      descriptionFr: s.descriptionFr,
      contenders: cResults,
    });
  }

  // Console summary
  process.stdout?.write?.(renderConsoleSummary(results, runtime));

  // Markdown files — one per runtime × locale.
  const when = new Date();
  const enPath = `bench/bench-report.${runtime.name}.md`;
  const frPath = `bench/bench-report.${runtime.name}.fr.md`;
  await writeTextFile(enPath, renderMarkdown(results, runtime, when, "en"));
  await writeTextFile(frPath, renderMarkdown(results, runtime, when, "fr"));
  process.stdout?.write?.(`\n✓ Wrote ${enPath}\n`);
  process.stdout?.write?.(`✓ Wrote ${frPath}\n`);
}

main().catch((err) => {
  console.error(err);
  const g = globalThis as unknown as {
    process?: { exit(code: number): never };
    Deno?: { exit(code: number): never };
  };
  if (g.process?.exit) g.process.exit(1);
  if (g.Deno?.exit) g.Deno.exit(1);
});
