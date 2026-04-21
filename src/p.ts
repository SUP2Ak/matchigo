// Pattern sentinels — tagged objects using a unique Symbol to avoid collisions.
// All P.* values are plain data; no classes, no proxies.

export const PATTERN = Symbol("matchigo.P");

/* ---- Leaf sentinels ---- */

export type PAny = { readonly [PATTERN]: "any" };
export type PString = { readonly [PATTERN]: "string" };
export type PNumber = { readonly [PATTERN]: "number" };
export type PBoolean = { readonly [PATTERN]: "boolean" };
export type PBigint = { readonly [PATTERN]: "bigint" };
export type PSymbol = { readonly [PATTERN]: "symbol" };
export type PFunction = { readonly [PATTERN]: "function" };
export type PNullish = { readonly [PATTERN]: "nullish" };
export type PDefined = { readonly [PATTERN]: "defined" };

/* ---- Composed sentinels ---- */

export type PArray<Item> = { readonly [PATTERN]: "array"; readonly item: Item };
export type PUnion<Values extends readonly unknown[]> = {
  readonly [PATTERN]: "union";
  readonly values: Values;
};
export type PWhen<T> = {
  readonly [PATTERN]: "when";
  readonly fn: (v: T) => boolean;
};
export type PNot<Inner> = { readonly [PATTERN]: "not"; readonly inner: Inner };
export type POptional<Inner> = {
  readonly [PATTERN]: "optional";
  readonly inner: Inner;
};
export type PIntersection<Parts extends readonly unknown[]> = {
  readonly [PATTERN]: "intersection";
  readonly parts: Parts;
};

/* ---- Constructors ---- */

// biome-ignore lint/suspicious/noExplicitAny: ctor generic
export type PInstanceOf<C> = { readonly [PATTERN]: "instanceOf"; readonly ctor: C };

/* ---- String refinements ---- */

export type PRegex = { readonly [PATTERN]: "regex"; readonly re: RegExp };
export type PStartsWithStr = {
  readonly [PATTERN]: "startsWithStr";
  readonly s: string;
};
export type PEndsWithStr = {
  readonly [PATTERN]: "endsWithStr";
  readonly s: string;
};
export type PMinLengthStr = {
  readonly [PATTERN]: "minLengthStr";
  readonly n: number;
};
export type PMaxLengthStr = {
  readonly [PATTERN]: "maxLengthStr";
  readonly n: number;
};
export type PLengthStr = {
  readonly [PATTERN]: "lengthStr";
  readonly n: number;
};
export type PIncludesStr = {
  readonly [PATTERN]: "includesStr";
  readonly s: string;
};

/* ---- Number refinements ---- */

export type PBetween = {
  readonly [PATTERN]: "between";
  readonly min: number;
  readonly max: number;
};
export type PGt = { readonly [PATTERN]: "gt"; readonly n: number };
export type PGte = { readonly [PATTERN]: "gte"; readonly n: number };
export type PLt = { readonly [PATTERN]: "lt"; readonly n: number };
export type PLte = { readonly [PATTERN]: "lte"; readonly n: number };
export type PPositive = { readonly [PATTERN]: "positive" };
export type PNegative = { readonly [PATTERN]: "negative" };
export type PInteger = { readonly [PATTERN]: "integer" };
export type PFinite = { readonly [PATTERN]: "finite" };

/* ---- Bigint refinements ---- */

export type PBigintGt = { readonly [PATTERN]: "bigintGt"; readonly n: bigint };
export type PBigintGte = { readonly [PATTERN]: "bigintGte"; readonly n: bigint };
export type PBigintLt = { readonly [PATTERN]: "bigintLt"; readonly n: bigint };
export type PBigintLte = { readonly [PATTERN]: "bigintLte"; readonly n: bigint };
export type PBigintBetween = {
  readonly [PATTERN]: "bigintBetween";
  readonly min: bigint;
  readonly max: bigint;
};
export type PBigintPositive = { readonly [PATTERN]: "bigintPositive" };
export type PBigintNegative = { readonly [PATTERN]: "bigintNegative" };

/* ---- Array patterns ---- */

export type PTuple<Items extends readonly unknown[]> = {
  readonly [PATTERN]: "tuple";
  readonly items: Items;
};
export type PStartsWith<Items extends readonly unknown[]> = {
  readonly [PATTERN]: "startsWith";
  readonly items: Items;
};
export type PEndsWith<Items extends readonly unknown[]> = {
  readonly [PATTERN]: "endsWith";
  readonly items: Items;
};
export type PArrayOf<Item> = {
  readonly [PATTERN]: "arrayOf";
  readonly item: Item;
  readonly min?: number;
  readonly max?: number;
};
export type PArrayIncludes<Item> = {
  readonly [PATTERN]: "arrayIncludes";
  readonly item: Item;
};

/* ---- Map / Set patterns ---- */

export type PMap<K, V> = {
  readonly [PATTERN]: "map";
  readonly key: K;
  readonly value: V;
};
export type PSet<Item> = { readonly [PATTERN]: "set"; readonly item: Item };

/* ---- Select (extract) ---- */

export type PSelect<Label extends string | undefined = undefined, Pat = undefined> = {
  readonly [PATTERN]: "select";
  readonly label: Label;
  readonly pattern: Pat;
};

/* ---- Union of all ---- */

export type PPattern =
  | PAny
  | PString
  | PNumber
  | PBoolean
  | PBigint
  | PSymbol
  | PFunction
  | PNullish
  | PDefined
  | PArray<unknown>
  | PUnion<readonly unknown[]>
  | PWhen<unknown>
  | PNot<unknown>
  | POptional<unknown>
  | PIntersection<readonly unknown[]>
  | PInstanceOf<unknown>
  | PRegex
  | PStartsWithStr
  | PEndsWithStr
  | PMinLengthStr
  | PMaxLengthStr
  | PLengthStr
  | PIncludesStr
  | PBetween
  | PGt
  | PGte
  | PLt
  | PLte
  | PPositive
  | PNegative
  | PInteger
  | PFinite
  | PBigintGt
  | PBigintGte
  | PBigintLt
  | PBigintLte
  | PBigintBetween
  | PBigintPositive
  | PBigintNegative
  | PTuple<readonly unknown[]>
  | PStartsWith<readonly unknown[]>
  | PEndsWith<readonly unknown[]>
  | PArrayOf<unknown>
  | PArrayIncludes<unknown>
  | PMap<unknown, unknown>
  | PSet<unknown>
  | PSelect<string | undefined, unknown>;

/* ---- The P export ---- */

const pDefined: PDefined = { [PATTERN]: "defined" };

/**
 * Pattern builders and sentinels. Use these inside a rule's `with` to match
 * by type, shape, refinement, or predicate. `P.*` calls allocate — keep
 * patterns hoisted where possible so the compile-once design pays off.
 *
 * @example
 * ```ts
 * import { P, matcher } from "matchigo";
 *
 * const kind = matcher<unknown, string>()
 *   .with(P.string, () => "string")
 *   .with(P.number, () => "number")
 *   .with(P.array(P.any), () => "array")
 *   .with({ kind: P.union("a", "b") }, () => "tagged")
 *   .otherwise(() => "other");
 * ```
 */
export const P = {
  // Leaves
  any: { [PATTERN]: "any" } as PAny,
  string: { [PATTERN]: "string" } as PString,
  number: { [PATTERN]: "number" } as PNumber,
  boolean: { [PATTERN]: "boolean" } as PBoolean,
  bigint: { [PATTERN]: "bigint" } as PBigint,
  symbol: { [PATTERN]: "symbol" } as PSymbol,
  function: { [PATTERN]: "function" } as PFunction,
  nullish: { [PATTERN]: "nullish" } as PNullish,
  defined: pDefined,
  // Alias: same predicate as `defined`, kept for ts-pattern parity.
  nonNullable: pDefined,

  // Composers
  array: <Item>(item: Item): PArray<Item> => ({ [PATTERN]: "array", item }),
  /**
   * Literal union — matches if the value is strictly equal (`Object.is`) to
   * any of the given values. Apply it on a discriminant field to narrow a
   * tagged union: `{ kind: P.union("a", "b") }`.
   *
   * @example
   * ```ts
   * { with: P.union("GET", "POST", "PUT"), then: () => "http-verb" }
   * ```
   */
  union: <const Values extends readonly unknown[]>(...values: Values): PUnion<Values> => ({
    [PATTERN]: "union",
    values,
  }),
  /**
   * Arbitrary predicate — escape hatch when `P.*` doesn't cover your check.
   * Runs on every call; keep the predicate cheap (no allocation, no I/O) and
   * prefer narrower `P.*` when one applies.
   *
   * @example
   * ```ts
   * { with: { age: P.when((n: number) => n >= 18) }, then: () => "adult" }
   * ```
   */
  when: <T>(fn: (v: T) => boolean): PWhen<T> => ({ [PATTERN]: "when", fn }),
  not: <Inner>(inner: Inner): PNot<Inner> => ({ [PATTERN]: "not", inner }),
  optional: <Inner>(inner: Inner): POptional<Inner> => ({
    [PATTERN]: "optional",
    inner,
  }),
  /**
   * Requires every sub-pattern to match the same value. Handy for layering
   * refinements: `P.intersection(P.string, P.minLengthStr(3))`.
   *
   * @example
   * ```ts
   * { with: P.intersection(P.string, P.regex(/^[A-Z]/)), then: () => "capitalized" }
   * ```
   */
  intersection: <const Parts extends readonly unknown[]>(
    ...parts: Parts
  ): PIntersection<Parts> => ({ [PATTERN]: "intersection", parts }),

  // Constructors
  // biome-ignore lint: ctor generic
  instanceOf: <C extends new (...args: never[]) => unknown>(ctor: C): PInstanceOf<C> => ({
    [PATTERN]: "instanceOf",
    ctor,
  }),

  // String refinements
  regex: (re: RegExp): PRegex => ({ [PATTERN]: "regex", re }),
  startsWithStr: (s: string): PStartsWithStr => ({
    [PATTERN]: "startsWithStr",
    s,
  }),
  endsWithStr: (s: string): PEndsWithStr => ({ [PATTERN]: "endsWithStr", s }),
  minLengthStr: (n: number): PMinLengthStr => ({ [PATTERN]: "minLengthStr", n }),
  maxLengthStr: (n: number): PMaxLengthStr => ({ [PATTERN]: "maxLengthStr", n }),
  lengthStr: (n: number): PLengthStr => ({ [PATTERN]: "lengthStr", n }),
  includesStr: (s: string): PIncludesStr => ({ [PATTERN]: "includesStr", s }),

  // Number refinements
  between: (min: number, max: number): PBetween => ({
    [PATTERN]: "between",
    min,
    max,
  }),
  gt: (n: number): PGt => ({ [PATTERN]: "gt", n }),
  gte: (n: number): PGte => ({ [PATTERN]: "gte", n }),
  lt: (n: number): PLt => ({ [PATTERN]: "lt", n }),
  lte: (n: number): PLte => ({ [PATTERN]: "lte", n }),
  positive: { [PATTERN]: "positive" } as PPositive,
  negative: { [PATTERN]: "negative" } as PNegative,
  integer: { [PATTERN]: "integer" } as PInteger,
  finite: { [PATTERN]: "finite" } as PFinite,

  // Bigint refinements
  bigintGt: (n: bigint): PBigintGt => ({ [PATTERN]: "bigintGt", n }),
  bigintGte: (n: bigint): PBigintGte => ({ [PATTERN]: "bigintGte", n }),
  bigintLt: (n: bigint): PBigintLt => ({ [PATTERN]: "bigintLt", n }),
  bigintLte: (n: bigint): PBigintLte => ({ [PATTERN]: "bigintLte", n }),
  bigintBetween: (min: bigint, max: bigint): PBigintBetween => ({
    [PATTERN]: "bigintBetween",
    min,
    max,
  }),
  bigintPositive: { [PATTERN]: "bigintPositive" } as PBigintPositive,
  bigintNegative: { [PATTERN]: "bigintNegative" } as PBigintNegative,

  // Array patterns
  tuple: <const Items extends readonly unknown[]>(...items: Items): PTuple<Items> => ({
    [PATTERN]: "tuple",
    items,
  }),
  startsWith: <const Items extends readonly unknown[]>(...items: Items): PStartsWith<Items> => ({
    [PATTERN]: "startsWith",
    items,
  }),
  endsWith: <const Items extends readonly unknown[]>(...items: Items): PEndsWith<Items> => ({
    [PATTERN]: "endsWith",
    items,
  }),
  arrayOf: <Item>(item: Item, opts?: { min?: number; max?: number }): PArrayOf<Item> => ({
    [PATTERN]: "arrayOf",
    item,
    ...(opts?.min !== undefined ? { min: opts.min } : {}),
    ...(opts?.max !== undefined ? { max: opts.max } : {}),
  }),
  arrayIncludes: <Item>(item: Item): PArrayIncludes<Item> => ({
    [PATTERN]: "arrayIncludes",
    item,
  }),

  // Map / Set patterns
  map: <K, V>(key: K, value: V): PMap<K, V> => ({ [PATTERN]: "map", key, value }),
  set: <Item>(item: Item): PSet<Item> => ({ [PATTERN]: "set", item }),

  /**
   * Extract the matched value into the handler. Overloads:
   * - `P.select()` — extract the value at this position.
   * - `P.select("label")` — labelled extract; handler receives `{ [label]: ... }`.
   * - `P.select(subPattern)` — extract only if `subPattern` also matches.
   * - `P.select("label", subPattern)` — labelled + refined.
   *
   * A lone string arg is treated as a label (ts-pattern convention). To match
   * a literal string and extract it, use `P.intersection("literal", P.select())`.
   *
   * @example
   * ```ts
   * matcher<{ user: { id: number } }, number>()
   *   .with({ user: { id: P.select() } }, (id) => id)
   *   .exhaustive();
   * ```
   */
  select: selectImpl,
} as const;

function selectImpl(): PSelect<undefined, undefined>;
function selectImpl<L extends string>(label: L): PSelect<L, undefined>;
function selectImpl<SubPat>(pattern: SubPat): PSelect<undefined, SubPat>;
function selectImpl<L extends string, SubPat>(label: L, pattern: SubPat): PSelect<L, SubPat>;
function selectImpl(arg1?: unknown, arg2?: unknown): PSelect<string | undefined, unknown> {
  if (arguments.length === 0) {
    return { [PATTERN]: "select", label: undefined, pattern: undefined };
  }
  if (arguments.length === 1) {
    if (typeof arg1 === "string") {
      return { [PATTERN]: "select", label: arg1, pattern: undefined };
    }
    return { [PATTERN]: "select", label: undefined, pattern: arg1 };
  }
  return { [PATTERN]: "select", label: arg1 as string, pattern: arg2 };
}

/* ---- Type guards ---- */

export function isP(v: unknown): v is PPattern {
  return typeof v === "object" && v !== null && PATTERN in (v as object);
}

export function isSelect(v: unknown): v is PSelect {
  return isP(v) && (v as PPattern)[PATTERN] === "select";
}
