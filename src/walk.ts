// matchWalk() — cold-path companion to match() / compile().
//
// Unlike compileRules() which classifies every pattern up front and returns a
// specialised dispatcher, matchWalk walks the pattern tree on every call with
// zero closure allocation. Slower than compile() when the rules are reused
// (each call pays the walk cost), but *faster* on a true cold path where rules
// are rebuilt per call — there's nothing to amortise.
//
// Use this when you can't hoist rules: rules derived from user input, config
// loaded per request, one-off matches inside a factory. If you *can* hoist,
// use match() / compile() / matcher() — they'll stay ahead on the hot path.

import {
  PATTERN,
  isP,
  isSelect,
  type PArray,
  type PArrayIncludes,
  type PArrayOf,
  type PBetween,
  type PBigintBetween,
  type PBigintGt,
  type PBigintGte,
  type PBigintLt,
  type PBigintLte,
  type PEndsWith,
  type PEndsWithStr,
  type PGt,
  type PGte,
  type PIncludesStr,
  type PInstanceOf,
  type PIntersection,
  type PLengthStr,
  type PLt,
  type PLte,
  type PMap,
  type PMaxLengthStr,
  type PMinLengthStr,
  type PNot,
  type POptional,
  type PPattern,
  type PRegex,
  type PSelect,
  type PSet,
  type PStartsWith,
  type PStartsWithStr,
  type PTuple,
  type PUnion,
  type PWhen,
} from "./p.ts";
import { collectSelects } from "./compile.ts";
import type { Rule } from "./types.ts";

function testPattern(pat: unknown, v: unknown): boolean {
  // Primitives: null/undefined + anything non-object
  if (pat === null || pat === undefined) return Object.is(v, pat);
  if (typeof pat !== "object") return Object.is(v, pat);

  if (isP(pat)) {
    const tag = (pat as PPattern)[PATTERN];
    switch (tag) {
      case "any":
        return true;
      case "string":
        return typeof v === "string";
      case "number":
        return typeof v === "number";
      case "boolean":
        return typeof v === "boolean";
      case "bigint":
        return typeof v === "bigint";
      case "symbol":
        return typeof v === "symbol";
      case "function":
        return typeof v === "function";
      case "nullish":
        return v == null;
      case "defined":
        return v != null;
      case "when":
        return (pat as PWhen<unknown>).fn(v);
      case "union": {
        const values = (pat as PUnion<readonly unknown[]>).values;
        for (let i = 0; i < values.length; i++) {
          if (Object.is(v, values[i])) return true;
        }
        return false;
      }
      case "not":
        return !testPattern((pat as PNot<unknown>).inner, v);
      case "optional":
        return v === undefined || testPattern((pat as POptional<unknown>).inner, v);
      case "array": {
        if (!Array.isArray(v)) return false;
        const item = (pat as PArray<unknown>).item;
        for (let i = 0; i < v.length; i++) {
          if (!testPattern(item, v[i])) return false;
        }
        return true;
      }
      case "arrayOf": {
        if (!Array.isArray(v)) return false;
        const pa = pat as PArrayOf<unknown>;
        if (pa.min !== undefined && v.length < pa.min) return false;
        if (pa.max !== undefined && v.length > pa.max) return false;
        for (let i = 0; i < v.length; i++) {
          if (!testPattern(pa.item, v[i])) return false;
        }
        return true;
      }
      case "arrayIncludes": {
        if (!Array.isArray(v)) return false;
        const item = (pat as PArrayIncludes<unknown>).item;
        for (let i = 0; i < v.length; i++) {
          if (testPattern(item, v[i])) return true;
        }
        return false;
      }
      case "intersection": {
        const parts = (pat as PIntersection<readonly unknown[]>).parts;
        for (let i = 0; i < parts.length; i++) {
          if (!testPattern(parts[i], v)) return false;
        }
        return true;
      }
      case "instanceOf": {
        const ctor = (pat as PInstanceOf<unknown>).ctor as new (...args: never[]) => unknown;
        return v instanceof ctor;
      }
      case "regex":
        return typeof v === "string" && (pat as PRegex).re.test(v);
      case "startsWithStr":
        return typeof v === "string" && v.startsWith((pat as PStartsWithStr).s);
      case "endsWithStr":
        return typeof v === "string" && v.endsWith((pat as PEndsWithStr).s);
      case "minLengthStr":
        return typeof v === "string" && v.length >= (pat as PMinLengthStr).n;
      case "maxLengthStr":
        return typeof v === "string" && v.length <= (pat as PMaxLengthStr).n;
      case "lengthStr":
        return typeof v === "string" && v.length === (pat as PLengthStr).n;
      case "includesStr":
        return typeof v === "string" && v.includes((pat as PIncludesStr).s);
      case "between": {
        const { min, max } = pat as PBetween;
        return typeof v === "number" && v >= min && v <= max;
      }
      case "gt":
        return typeof v === "number" && v > (pat as PGt).n;
      case "gte":
        return typeof v === "number" && v >= (pat as PGte).n;
      case "lt":
        return typeof v === "number" && v < (pat as PLt).n;
      case "lte":
        return typeof v === "number" && v <= (pat as PLte).n;
      case "positive":
        return typeof v === "number" && v > 0;
      case "negative":
        return typeof v === "number" && v < 0;
      case "integer":
        return Number.isInteger(v);
      case "finite":
        return Number.isFinite(v);
      case "bigintGt":
        return typeof v === "bigint" && v > (pat as PBigintGt).n;
      case "bigintGte":
        return typeof v === "bigint" && v >= (pat as PBigintGte).n;
      case "bigintLt":
        return typeof v === "bigint" && v < (pat as PBigintLt).n;
      case "bigintLte":
        return typeof v === "bigint" && v <= (pat as PBigintLte).n;
      case "bigintBetween": {
        const { min, max } = pat as PBigintBetween;
        return typeof v === "bigint" && v >= min && v <= max;
      }
      case "bigintPositive":
        return typeof v === "bigint" && v > 0n;
      case "bigintNegative":
        return typeof v === "bigint" && v < 0n;
      case "tuple": {
        const items = (pat as PTuple<readonly unknown[]>).items;
        if (!Array.isArray(v) || v.length !== items.length) return false;
        for (let i = 0; i < items.length; i++) {
          if (!testPattern(items[i], v[i])) return false;
        }
        return true;
      }
      case "startsWith": {
        const items = (pat as PStartsWith<readonly unknown[]>).items;
        if (!Array.isArray(v) || v.length < items.length) return false;
        for (let i = 0; i < items.length; i++) {
          if (!testPattern(items[i], v[i])) return false;
        }
        return true;
      }
      case "endsWith": {
        const items = (pat as PEndsWith<readonly unknown[]>).items;
        if (!Array.isArray(v) || v.length < items.length) return false;
        const offset = v.length - items.length;
        for (let i = 0; i < items.length; i++) {
          if (!testPattern(items[i], v[offset + i])) return false;
        }
        return true;
      }
      case "map": {
        if (!(v instanceof Map)) return false;
        const pm = pat as PMap<unknown, unknown>;
        for (const [k, val] of v) {
          if (!testPattern(pm.key, k) || !testPattern(pm.value, val)) return false;
        }
        return true;
      }
      case "set": {
        if (!(v instanceof Set)) return false;
        const item = (pat as PSet<unknown>).item;
        for (const entry of v) {
          if (!testPattern(item, entry)) return false;
        }
        return true;
      }
      case "select": {
        // With a sub-pattern: match only if it matches. Without: match anything.
        // Extraction is handled by collectSelects in the caller.
        const sub = (pat as PSelect<string | undefined, unknown>).pattern;
        return sub === undefined ? true : testPattern(sub, v);
      }
      default: {
        const _exhaustive: never = tag;
        throw new Error(`Unknown P tag: ${String(_exhaustive)}`);
      }
    }
  }

  // Top-level array → union shorthand
  if (Array.isArray(pat)) {
    for (let i = 0; i < pat.length; i++) {
      if (Object.is(v, pat[i])) return true;
    }
    return false;
  }

  // Object shape — partial recursive match
  if (v === null || typeof v !== "object") return false;
  const po = pat as Record<string, unknown>;
  const vo = v as Record<string, unknown>;
  for (const k in po) {
    if (!testPattern(po[k], vo[k])) return false;
  }
  return true;
}

function readPath(value: unknown, path: ReadonlyArray<string | number>): unknown {
  let cur: unknown = value;
  for (let i = 0; i < path.length; i++) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string | number, unknown>)[path[i]!];
  }
  return cur;
}

function applyHandler(then: unknown, pattern: unknown, v: unknown): unknown {
  if (typeof then !== "function") return then;
  const fn = then as (a: unknown, b?: unknown) => unknown;

  // Fast path: no selects in this pattern
  if (!hasSelect(pattern)) return fn(v);

  const selects = collectSelects(pattern);
  if (selects.length === 1 && selects[0]!.label === undefined) {
    return fn(readPath(v, selects[0]!.path), v);
  }
  const out: Record<string, unknown> = {};
  for (const s of selects) {
    out[s.label ?? "$0"] = readPath(v, s.path);
  }
  return fn(out, v);
}

// Cheap one-pass scan so we skip collectSelects for the common no-select case.
function hasSelect(pat: unknown): boolean {
  if (pat === null || pat === undefined) return false;
  if (typeof pat !== "object") return false;
  if (isSelect(pat)) return true;
  if (isP(pat)) {
    const tag = (pat as PPattern)[PATTERN];
    switch (tag) {
      case "array":
      case "arrayOf":
      case "arrayIncludes":
        return hasSelect((pat as PArray<unknown>).item);
      case "tuple":
      case "startsWith":
      case "endsWith":
        return (pat as PTuple<readonly unknown[]>).items.some(hasSelect);
      case "not":
      case "optional":
        return hasSelect((pat as PNot<unknown>).inner);
      case "intersection":
        return (pat as PIntersection<readonly unknown[]>).parts.some(hasSelect);
      default:
        return false;
    }
  }
  if (Array.isArray(pat)) return pat.some(hasSelect);
  const po = pat as Record<string, unknown>;
  for (const k in po) if (hasSelect(po[k])) return true;
  return false;
}

/**
 * Cold-path companion to {@link match}. Walks the pattern tree on every call
 * with zero closure allocation. Slower than compile() on a hot path, faster
 * when rules genuinely change per call (user input, per-request config,
 * one-off factory matches). If you can hoist, prefer match()/matcher().
 *
 * @example
 * ```ts
 * import { P, matchWalk } from "matchigo";
 *
 * function classify(value: unknown, thresholds: { hi: number; lo: number }) {
 *   return matchWalk<unknown, string>(value, [
 *     { with: P.when((n: number) => n > thresholds.hi), then: () => "hi" },
 *     { with: P.when((n: number) => n < thresholds.lo), then: () => "lo" },
 *     { otherwise: () => "mid" },
 *   ]);
 * }
 * ```
 */
export function matchWalk<T, R>(value: T, rules: ReadonlyArray<Rule<T, R>>): R {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]!;
    if ("otherwise" in rule) {
      const o = rule.otherwise;
      return (typeof o === "function" ? (o as (v: T) => R)(value) : o) as R;
    }
    if (!testPattern(rule.with, value)) continue;
    if (rule.when && !rule.when(value)) continue;
    return applyHandler(rule.then, rule.with, value) as R;
  }
  throw new Error("Non-exhaustive match");
}

/**
 * Standalone predicate — returns true if `value` matches `pattern`, false
 * otherwise. Same pattern language as match()/matchWalk(); no select
 * extraction, no handler, no throw. Useful inside filters or as a cheap gate.
 *
 * @example
 * ```ts
 * import { P, isMatching } from "matchigo";
 *
 * const users = [{ age: 10 }, { age: 20 }, { age: 30 }];
 * users.filter((u) => isMatching({ age: P.gte(18) }, u));
 * // [{ age: 20 }, { age: 30 }]
 * ```
 */
export function isMatching<T = unknown>(pattern: unknown, value: T): boolean {
  return testPattern(pattern, value);
}

// Chained builder that dispatches through matchWalk — same API as matcher()
// but with no compile step, no cache. Useful on cold paths where you want
// the chained style but rules genuinely change per call site.
class MatcherWalkImpl {
  private rules: Rule<unknown, unknown>[] = [];

  with(pattern: unknown, a: unknown, b?: unknown): MatcherWalkImpl {
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
    return this.build();
  }

  exhaustive(): (v: unknown) => unknown {
    return this.build();
  }

  run(value: unknown): unknown {
    return matchWalk(value, this.rules);
  }

  build(): (v: unknown) => unknown {
    const rules = this.rules;
    const callable = ((v: unknown) => matchWalk(v, rules)) as ((v: unknown) => unknown) & {
      run: (v: unknown) => unknown;
    };
    callable.run = callable;
    return callable;
  }
}

/**
 * Chained cold-path variant of {@link matcher}. Same chained API, no compile
 * step, no cache — dispatches through {@link matchWalk} on every call. Use
 * when you want the chained style but the rules truly change per call site.
 *
 * @example
 * ```ts
 * import { P, matcherWalk } from "matchigo";
 *
 * function validate(value: unknown, max: number) {
 *   return matcherWalk<unknown, string>()
 *     .with(P.string, (s) => s.slice(0, max))
 *     .with(P.number, (n) => String(Math.min(n, max)))
 *     .otherwise(() => "invalid")
 *     .run(value);
 * }
 * ```
 */
export function matcherWalk<T, R>(): import("./types.ts").Matcher<T, R> {
  return new MatcherWalkImpl() as unknown as import("./types.ts").Matcher<T, R>;
}
