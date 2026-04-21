// Chained builder — matcher<T, R>().with(...).exhaustive() / .otherwise(...)

import { compileRules } from "./compile.ts";
import { trackMatcher } from "./dev.ts";
import type { CompiledFn, Matcher, Rule } from "./types.ts";

class MatcherImpl {
  private rules: Rule<unknown, unknown>[] = [];
  private cached?: (v: unknown) => unknown;

  with(pattern: unknown, a: unknown, b?: unknown): MatcherImpl {
    this.cached = undefined;
    if (b !== undefined) {
      this.rules.push({
        with: pattern,
        when: a as (v: unknown) => boolean,
        then: b,
      });
    } else {
      this.rules.push({ with: pattern, then: a });
    }
    return this;
  }

  otherwise(result: unknown): (v: unknown) => unknown {
    this.rules.push({ otherwise: result });
    this.cached = undefined;
    return this.compile();
  }

  exhaustive(): (v: unknown) => unknown {
    return this.compile();
  }

  run(value: unknown): unknown {
    if (!this.cached) this.cached = compileRules(this.rules);
    return this.cached(value);
  }

  compile(): (v: unknown) => unknown {
    if (!this.cached) this.cached = compileRules(this.rules);
    const fn = this.cached;
    const callable = ((v: unknown) => fn(v)) as ((v: unknown) => unknown) & {
      run: (v: unknown) => unknown;
    };
    callable.run = callable;
    return callable;
  }
}

/**
 * Chained builder. Each `.with()` appends a rule; `.exhaustive()` closes the
 * chain and returns a callable dispatcher. Rules compile once on
 * `.exhaustive()` / `.otherwise()`, so hoist the result to module scope to
 * keep the hot path allocation-free.
 *
 * @example
 * ```ts
 * import { P, matcher } from "matchigo";
 *
 * type Shape =
 *   | { kind: "circle"; r: number }
 *   | { kind: "square"; s: number };
 *
 * const area = matcher<Shape, number>()
 *   .with({ kind: "circle" }, (s) => Math.PI * s.r ** 2)
 *   .with({ kind: "square" }, (s) => s.s ** 2)
 *   .exhaustive(); // compile-time exhaustiveness check
 *
 * area({ kind: "circle", r: 2 }); // 12.566…
 * ```
 */
export function matcher<T, R>(): Matcher<T, R> {
  trackMatcher();
  return new MatcherImpl() as unknown as Matcher<T, R>;
}

export type { CompiledFn, Matcher };
