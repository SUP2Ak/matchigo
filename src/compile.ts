// Rule compiler — turns patterns into specialised dispatcher functions.
//
// Pipeline:
//  1. compilePattern()  : recursively turn a pattern (primitive / P.* / shape)
//                          into a `test: (v) => boolean` predicate,
//                          plus a fast flag `isLiteral` for the Map O(1) path.
//  2. collectSelects()  : walk the pattern and record every P.select() position
//                          (path + optional label) so the handler can receive
//                          extracted values.
//  3. compileRules()    : classify rules → Map (literals) + ordered loop
//                          (complex) + optional fallback. Return a dispatcher.

import {
  PATTERN,
  isP,
  isSelect,
  type PPattern,
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
  type PRegex,
  type PSelect,
  type PSet,
  type PStartsWith,
  type PStartsWithStr,
  type PTuple,
  type PUnion,
  type PWhen,
} from "./p.ts";
import type { Rule } from "./types.ts";

/* -------------------------------------------------------------------------- */
/* Compiled pattern                                                           */
/* -------------------------------------------------------------------------- */

export interface CompiledPattern {
  test: (v: unknown) => boolean;
  isLiteral: boolean;
  literalValue?: unknown;
}

export function compilePattern(pattern: unknown): CompiledPattern {
  if (isP(pattern)) return compilePPattern(pattern);

  // Array at the top level → shorthand for P.union
  if (Array.isArray(pattern)) {
    const set = new Set<unknown>(pattern);
    return { test: (v) => set.has(v), isLiteral: false };
  }

  // Object shape — partial recursive match
  if (pattern !== null && typeof pattern === "object") {
    const entries = Object.entries(pattern as Record<string, unknown>).map(
      ([k, sub]) => [k, compilePattern(sub).test] as const,
    );
    return {
      test: (v) => {
        if (v === null || typeof v !== "object") return false;
        const o = v as Record<string, unknown>;
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i]!;
          if (!e[1](o[e[0]])) return false;
        }
        return true;
      },
      isLiteral: false,
    };
  }

  // Primitive literal
  return { test: (v) => Object.is(v, pattern), isLiteral: true, literalValue: pattern };
}

function compilePPattern(p: PPattern): CompiledPattern {
  const tag = p[PATTERN];
  switch (tag) {
    case "any":
      return { test: () => true, isLiteral: false };
    case "string":
      return { test: (v) => typeof v === "string", isLiteral: false };
    case "number":
      return { test: (v) => typeof v === "number", isLiteral: false };
    case "boolean":
      return { test: (v) => typeof v === "boolean", isLiteral: false };
    case "bigint":
      return { test: (v) => typeof v === "bigint", isLiteral: false };
    case "symbol":
      return { test: (v) => typeof v === "symbol", isLiteral: false };
    case "function":
      return { test: (v) => typeof v === "function", isLiteral: false };
    case "nullish":
      return { test: (v) => v == null, isLiteral: false };
    case "defined":
      return { test: (v) => v != null, isLiteral: false };
    case "when": {
      const fn = (p as PWhen<unknown>).fn;
      return { test: (v) => fn(v), isLiteral: false };
    }
    case "union": {
      const set = new Set<unknown>((p as PUnion<readonly unknown[]>).values);
      return { test: (v) => set.has(v), isLiteral: false };
    }
    case "not": {
      const inner = compilePattern((p as PNot<unknown>).inner).test;
      return { test: (v) => !inner(v), isLiteral: false };
    }
    case "optional": {
      const inner = compilePattern((p as POptional<unknown>).inner).test;
      return { test: (v) => v === undefined || inner(v), isLiteral: false };
    }
    case "array": {
      const inner = compilePattern((p as PArray<unknown>).item).test;
      return {
        test: (v) => Array.isArray(v) && v.every(inner),
        isLiteral: false,
      };
    }
    case "arrayOf": {
      const pa = p as PArrayOf<unknown>;
      const inner = compilePattern(pa.item).test;
      const { min, max } = pa;
      return {
        test: (v) => {
          if (!Array.isArray(v)) return false;
          if (min !== undefined && v.length < min) return false;
          if (max !== undefined && v.length > max) return false;
          return v.every(inner);
        },
        isLiteral: false,
      };
    }
    case "arrayIncludes": {
      const inner = compilePattern((p as PArrayIncludes<unknown>).item).test;
      return {
        test: (v) => Array.isArray(v) && v.some(inner),
        isLiteral: false,
      };
    }
    case "intersection": {
      const parts = (p as PIntersection<readonly unknown[]>).parts.map(
        (q) => compilePattern(q).test,
      );
      return { test: (v) => parts.every((t) => t(v)), isLiteral: false };
    }
    case "instanceOf": {
      const ctor = (p as PInstanceOf<unknown>).ctor as new (...args: never[]) => unknown;
      return { test: (v) => v instanceof ctor, isLiteral: false };
    }
    case "regex": {
      const re = (p as PRegex).re;
      return {
        test: (v) => typeof v === "string" && re.test(v),
        isLiteral: false,
      };
    }
    case "startsWithStr": {
      const s = (p as PStartsWithStr).s;
      return {
        test: (v) => typeof v === "string" && v.startsWith(s),
        isLiteral: false,
      };
    }
    case "endsWithStr": {
      const s = (p as PEndsWithStr).s;
      return {
        test: (v) => typeof v === "string" && v.endsWith(s),
        isLiteral: false,
      };
    }
    case "minLengthStr": {
      const n = (p as PMinLengthStr).n;
      return {
        test: (v) => typeof v === "string" && v.length >= n,
        isLiteral: false,
      };
    }
    case "maxLengthStr": {
      const n = (p as PMaxLengthStr).n;
      return {
        test: (v) => typeof v === "string" && v.length <= n,
        isLiteral: false,
      };
    }
    case "lengthStr": {
      const n = (p as PLengthStr).n;
      return {
        test: (v) => typeof v === "string" && v.length === n,
        isLiteral: false,
      };
    }
    case "includesStr": {
      const s = (p as PIncludesStr).s;
      return {
        test: (v) => typeof v === "string" && v.includes(s),
        isLiteral: false,
      };
    }
    case "between": {
      const { min, max } = p as PBetween;
      return {
        test: (v) => typeof v === "number" && v >= min && v <= max,
        isLiteral: false,
      };
    }
    case "gt": {
      const n = (p as PGt).n;
      return {
        test: (v) => typeof v === "number" && v > n,
        isLiteral: false,
      };
    }
    case "gte": {
      const n = (p as PGte).n;
      return {
        test: (v) => typeof v === "number" && v >= n,
        isLiteral: false,
      };
    }
    case "lt": {
      const n = (p as PLt).n;
      return {
        test: (v) => typeof v === "number" && v < n,
        isLiteral: false,
      };
    }
    case "lte": {
      const n = (p as PLte).n;
      return {
        test: (v) => typeof v === "number" && v <= n,
        isLiteral: false,
      };
    }
    case "positive":
      return {
        test: (v) => typeof v === "number" && v > 0,
        isLiteral: false,
      };
    case "negative":
      return {
        test: (v) => typeof v === "number" && v < 0,
        isLiteral: false,
      };
    case "integer":
      return { test: (v) => Number.isInteger(v), isLiteral: false };
    case "finite":
      return { test: (v) => Number.isFinite(v), isLiteral: false };

    case "bigintGt": {
      const n = (p as PBigintGt).n;
      return {
        test: (v) => typeof v === "bigint" && v > n,
        isLiteral: false,
      };
    }
    case "bigintGte": {
      const n = (p as PBigintGte).n;
      return {
        test: (v) => typeof v === "bigint" && v >= n,
        isLiteral: false,
      };
    }
    case "bigintLt": {
      const n = (p as PBigintLt).n;
      return {
        test: (v) => typeof v === "bigint" && v < n,
        isLiteral: false,
      };
    }
    case "bigintLte": {
      const n = (p as PBigintLte).n;
      return {
        test: (v) => typeof v === "bigint" && v <= n,
        isLiteral: false,
      };
    }
    case "bigintBetween": {
      const { min, max } = p as PBigintBetween;
      return {
        test: (v) => typeof v === "bigint" && v >= min && v <= max,
        isLiteral: false,
      };
    }
    case "bigintPositive":
      return {
        test: (v) => typeof v === "bigint" && v > 0n,
        isLiteral: false,
      };
    case "bigintNegative":
      return {
        test: (v) => typeof v === "bigint" && v < 0n,
        isLiteral: false,
      };

    case "tuple": {
      const items = (p as PTuple<readonly unknown[]>).items.map((q) => compilePattern(q).test);
      return {
        test: (v) => {
          if (!Array.isArray(v) || v.length !== items.length) return false;
          for (let i = 0; i < items.length; i++) {
            if (!items[i]!(v[i])) return false;
          }
          return true;
        },
        isLiteral: false,
      };
    }
    case "startsWith": {
      const items = (p as PStartsWith<readonly unknown[]>).items.map((q) => compilePattern(q).test);
      return {
        test: (v) => {
          if (!Array.isArray(v) || v.length < items.length) return false;
          for (let i = 0; i < items.length; i++) {
            if (!items[i]!(v[i])) return false;
          }
          return true;
        },
        isLiteral: false,
      };
    }
    case "endsWith": {
      const items = (p as PEndsWith<readonly unknown[]>).items.map((q) => compilePattern(q).test);
      return {
        test: (v) => {
          if (!Array.isArray(v) || v.length < items.length) return false;
          const offset = v.length - items.length;
          for (let i = 0; i < items.length; i++) {
            if (!items[i]!(v[offset + i])) return false;
          }
          return true;
        },
        isLiteral: false,
      };
    }

    case "map": {
      const pm = p as PMap<unknown, unknown>;
      const keyTest = compilePattern(pm.key).test;
      const valTest = compilePattern(pm.value).test;
      return {
        test: (v) => {
          if (!(v instanceof Map)) return false;
          for (const [k, val] of v) {
            if (!keyTest(k) || !valTest(val)) return false;
          }
          return true;
        },
        isLiteral: false,
      };
    }
    case "set": {
      const itemTest = compilePattern((p as PSet<unknown>).item).test;
      return {
        test: (v) => {
          if (!(v instanceof Set)) return false;
          for (const item of v) {
            if (!itemTest(item)) return false;
          }
          return true;
        },
        isLiteral: false,
      };
    }

    case "select": {
      // With a sub-pattern: match only if the sub-pattern matches.
      // Without: match anything. Extraction happens via collectSelects().
      const sub = (p as PSelect<string | undefined, unknown>).pattern;
      if (sub === undefined) return { test: () => true, isLiteral: false };
      const inner = compilePattern(sub).test;
      return { test: (v) => inner(v), isLiteral: false };
    }

    default: {
      const _exhaustive: never = tag;
      throw new Error(`Unknown P tag: ${String(_exhaustive)}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* P.select() path collection                                                 */
/* -------------------------------------------------------------------------- */

export type SelectPath = {
  label: string | undefined;
  path: ReadonlyArray<string | number>;
};

export function collectSelects(
  pattern: unknown,
  path: ReadonlyArray<string | number> = [],
): SelectPath[] {
  if (isSelect(pattern)) {
    const head: SelectPath = { label: pattern.label, path };
    const sub = (pattern as PSelect<string | undefined, unknown>).pattern;
    if (sub === undefined) return [head];
    // Nested selects inside select(subPattern) are still reachable — walk in.
    return [head, ...collectSelects(sub, path)];
  }
  if (isP(pattern)) {
    // Walk into composed P.* that can contain sub-patterns
    const tag = (pattern as PPattern)[PATTERN];
    switch (tag) {
      case "array":
      case "arrayOf":
      case "arrayIncludes":
        return collectSelects((pattern as PArray<unknown>).item, [...path, 0]);
      case "tuple":
      case "startsWith":
      case "endsWith":
        return (pattern as PTuple<readonly unknown[]>).items.flatMap((p, i) =>
          collectSelects(p, [...path, i]),
        );
      case "not":
      case "optional":
        return collectSelects((pattern as PNot<unknown>).inner, path);
      case "intersection":
        return (pattern as PIntersection<readonly unknown[]>).parts.flatMap((p) =>
          collectSelects(p, path),
        );
      default:
        // map/set have no meaningful readPath for select (collection-level),
        // so we drop selects inside them. Match-by-content still works; only
        // the extraction degrades to "no select here".
        return [];
    }
  }
  if (Array.isArray(pattern)) {
    return pattern.flatMap((p, i) => collectSelects(p, [...path, i]));
  }
  if (pattern !== null && typeof pattern === "object") {
    return Object.entries(pattern as Record<string, unknown>).flatMap(([k, v]) =>
      collectSelects(v, [...path, k]),
    );
  }
  return [];
}

function readPath(value: unknown, path: ReadonlyArray<string | number>): unknown {
  let cur: unknown = value;
  for (let i = 0; i < path.length; i++) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string | number, unknown>)[path[i]!];
  }
  return cur;
}

/* -------------------------------------------------------------------------- */
/* Dispatcher compilation                                                     */
/* -------------------------------------------------------------------------- */

type InternalRule = {
  test: (v: unknown) => boolean;
  guard?: (v: unknown) => boolean;
  thenFn: (v: unknown) => unknown;
};

function resolveThen(then: unknown, selects: SelectPath[]): (v: unknown) => unknown {
  if (typeof then !== "function") return () => then;
  const fn = then as (v: unknown, selected?: unknown) => unknown;
  if (selects.length === 0) return (v) => fn(v);
  if (selects.length === 1 && selects[0]!.label === undefined) {
    const path = selects[0]!.path;
    return (v) => fn(readPath(v, path), v);
  }
  // Multiple selects, or labeled → pass {label: value}
  return (v) => {
    const out: Record<string, unknown> = {};
    for (const s of selects) {
      const key = s.label ?? "$0";
      out[key] = readPath(v, s.path);
    }
    return fn(out as unknown, v);
  };
}

export function compileRules(
  rules: ReadonlyArray<Rule<unknown, unknown>>,
): (v: unknown) => unknown {
  const literalMap = new Map<unknown, (v: unknown) => unknown>();
  const complex: InternalRule[] = [];
  let fallback: ((v: unknown) => unknown) | undefined;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]!;
    if ("otherwise" in rule) {
      fallback = resolveThen(rule.otherwise, []);
      continue;
    }
    const pattern = rule.with;
    const selects = collectSelects(pattern);
    const compiled = compilePattern(pattern);
    const thenFn = resolveThen(rule.then, selects);
    const guard = rule.when as ((v: unknown) => boolean) | undefined;

    // Fast-path: primitive literal, no guard, no selects → Map O(1)
    if (
      compiled.isLiteral &&
      !guard &&
      selects.length === 0 &&
      !literalMap.has(compiled.literalValue)
    ) {
      literalMap.set(compiled.literalValue, thenFn);
      continue;
    }
    complex.push({ test: compiled.test, guard, thenFn });
  }

  const hasMap = literalMap.size > 0;
  const hasComplex = complex.length > 0;

  if (hasMap && !hasComplex) {
    return (v) => {
      const hit = literalMap.get(v);
      if (hit) return hit(v);
      if (fallback) return fallback(v);
      throw new Error("Non-exhaustive match");
    };
  }
  if (!hasMap && hasComplex) {
    return (v) => {
      for (let i = 0; i < complex.length; i++) {
        const r = complex[i]!;
        if (r.test(v) && (!r.guard || r.guard(v))) return r.thenFn(v);
      }
      if (fallback) return fallback(v);
      throw new Error("Non-exhaustive match");
    };
  }
  return (v) => {
    const hit = literalMap.get(v);
    if (hit) return hit(v);
    for (let i = 0; i < complex.length; i++) {
      const r = complex[i]!;
      if (r.test(v) && (!r.guard || r.guard(v))) return r.thenFn(v);
    }
    if (fallback) return fallback(v);
    throw new Error("Non-exhaustive match");
  };
}
