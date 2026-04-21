// Data-driven entry point — match(value, rules) and compile(rules).

import { compileRules } from "./compile.ts";
import { trackMatch } from "./dev.ts";
import type { CompiledFn, Rule } from "./types.ts";

// Cache keyed on rules array identity. Lets hoisted `const RULES = [...]` hit
// the fast path; cold inline usage misses and triggers the dev warning.
const compiledCache = new WeakMap<ReadonlyArray<Rule<unknown, unknown>>, (v: unknown) => unknown>();

/**
 * Data-driven dispatch — matches `value` against each rule in order and runs
 * the first rule whose `with` matches. For the hot path, hoist `rules` to
 * module scope; the compiled dispatcher is cached on the array identity, so
 * inline rebuilds miss the cache (and trigger a dev warning).
 *
 * @example
 * ```ts
 * import { P, match, type Rule } from "matchigo";
 *
 * type Event = { kind: "click"; x: number } | { kind: "key"; key: string };
 *
 * const RULES: ReadonlyArray<Rule<Event, string>> = [
 *   { with: { kind: "click" }, then: (e) => `click@${e.x}` },
 *   { with: { kind: "key", key: "Escape" }, then: () => "escape" },
 *   { with: { kind: "key" }, then: (e) => `key:${e.key}` },
 * ];
 *
 * match({ kind: "key", key: "a" } as Event, RULES); // "key:a"
 * ```
 */
export function match<T, R>(value: T, rules: ReadonlyArray<Rule<T, R>>): R {
  const key = rules as ReadonlyArray<Rule<unknown, unknown>>;
  let fn = compiledCache.get(key);
  trackMatch(!!fn);
  if (!fn) {
    fn = compileRules(key);
    compiledCache.set(key, fn);
  }
  return fn(value) as R;
}

/**
 * Compiles `rules` once and returns a callable dispatcher. Use this when you
 * want to separate compile-time from call-time, or when the rules array
 * identity changes per call but its content doesn't (match() keys its cache
 * on array identity, so a rebuilt array misses it — compile() doesn't care).
 *
 * @example
 * ```ts
 * import { P, compile } from "matchigo";
 *
 * const classify = compile<number, string>([
 *   { with: 0, then: () => "zero" },
 *   { with: P.negative, then: () => "negative" },
 *   { with: P.positive, then: () => "positive" },
 * ]);
 *
 * classify(-3); // "negative"
 * ```
 */
export function compile<T, R>(rules: ReadonlyArray<Rule<T, R>>): CompiledFn<T, R> {
  const fn = compileRules(rules as ReadonlyArray<Rule<unknown, unknown>>);
  const callable = ((v: T) => fn(v) as R) as CompiledFn<T, R>;
  callable.run = callable;
  return callable;
}
