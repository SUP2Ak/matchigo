// NarrowedBy<T, Pat, Depth> — the handler-param type for a `.with(pattern, fn)`.
//
// Given an input type T (the remaining, not-yet-matched subset) and a pattern
// Pat, compute the subset of T that reaches the handler.
//
// Top level splits on four structural cases:
//   1. P.* sentinels              → NarrowByPTag (tag dispatch on [PATTERN])
//   2. Inline readonly array      → Extract<T, U> (literal union shorthand)
//   3. Plain object shape         → ObjectNarrow (per-member)
//   4. Literal primitive fallback → Pat if assignable to T
//
// NarrowByPTag then dispatches on the unique string tag carried by each P.*
// value ("string", "number", "union", ...). Tags that narrow to the same
// target (e.g. "regex" / "startsWithStr" → string) are grouped together.

import {
  type PArray,
  type PArrayIncludes,
  type PArrayOf,
  type PEndsWith,
  type PInstanceOf,
  type PIntersection,
  type PMap,
  type PNot,
  type POptional,
  PATTERN,
  type PPattern,
  type PSet,
  type PStartsWith,
  type PTuple,
  type PUnion,
} from "../p.ts";
import type { Prev, Simplify } from "./Helpers.ts";

// biome-ignore lint/suspicious/noExplicitAny: generic ctor bound
type AnyCtor = abstract new (...args: any[]) => any;

export type NarrowedBy<T, Pat, Depth extends number = 6> =
  Pat extends PPattern ? NarrowByPTag<T, Pat, Depth>
  : Pat extends readonly (infer U)[] ? Extract<T, U>
  : Pat extends object ? ObjectNarrow<T, Pat, Prev[Depth]>
  : Pat extends T ? Pat
  : never;

// Tag families — grouping the string tags that narrow to the same output type
// keeps NarrowByPTag flat and readable.
type StringFamilyTag =
  | "string"
  | "regex"
  | "startsWithStr"
  | "endsWithStr"
  | "minLengthStr"
  | "maxLengthStr"
  | "lengthStr"
  | "includesStr";

type NumberFamilyTag =
  | "number"
  | "between"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "positive"
  | "negative"
  | "integer"
  | "finite";

type BigIntFamilyTag =
  | "bigint"
  | "bigintGt"
  | "bigintGte"
  | "bigintLt"
  | "bigintLte"
  | "bigintBetween"
  | "bigintPositive"
  | "bigintNegative";

type ArrayShapeTag = "array" | "arrayOf" | "arrayIncludes" | "startsWith" | "endsWith";

type ArrayShapePattern =
  | PArray<unknown>
  | PArrayOf<unknown>
  | PArrayIncludes<unknown>
  | PStartsWith<readonly unknown[]>
  | PEndsWith<readonly unknown[]>;

/**
 * Dispatch on the unique string tag carried by each P.* sentinel.
 * Flat ternary chain — each arm narrows on the tag and produces the target type.
 */
type NarrowByPTag<T, Pat extends PPattern, Depth extends number> =
  Pat[typeof PATTERN] extends infer Tag ?
    // always-match sentinels
    Tag extends "any" | "select" | "when" ? T
    : // primitive-typeof refinements
    Tag extends StringFamilyTag ? Extract<T, string>
    : Tag extends NumberFamilyTag ? Extract<T, number>
    : Tag extends BigIntFamilyTag ? Extract<T, bigint>
    : Tag extends "boolean" ? Extract<T, boolean>
    : Tag extends "symbol" ? Extract<T, symbol>
    : // biome-ignore lint/complexity/noBannedTypes: generic function narrow
    Tag extends "function" ? Extract<T, Function>
    : Tag extends "nullish" ? Extract<T, null | undefined>
    : Tag extends "defined" ? Exclude<T, null | undefined>
    : // combinators
    Tag extends "union" ?
      Pat extends PUnion<infer U> ?
        Extract<T, U[number]>
      : never
    : Tag extends "not" ?
      Pat extends PNot<infer Inner> ?
        Exclude<T, NarrowedBy<T, Inner, Prev[Depth]>>
      : never
    : Tag extends "optional" ?
      Pat extends POptional<infer Inner> ?
        NarrowedBy<T, Inner, Prev[Depth]> | undefined
      : never
    : Tag extends "intersection" ?
      Pat extends PIntersection<infer Parts> ?
        IntersectNarrow<T, Parts, Prev[Depth]>
      : never
    : // instance check
    Tag extends "instanceOf" ?
      Pat extends PInstanceOf<infer Ctor> ?
        Ctor extends AnyCtor ?
          Extract<T, InstanceType<Ctor>>
        : T
      : never
    : // tuples narrow element-wise; other array-shape patterns narrow to readonly unknown[]
    Tag extends "tuple" ?
      Pat extends PTuple<infer Items> ?
        Extract<T, TupleNarrow<Items, Prev[Depth]>>
      : never
    : Tag extends ArrayShapeTag ?
      Pat extends ArrayShapePattern ?
        Extract<T, readonly unknown[]>
      : never
    : // Map / Set collections
    Tag extends "map" ?
      // biome-ignore lint/suspicious/noExplicitAny: generic Map narrow
      Pat extends PMap<unknown, unknown> ?
        Extract<T, Map<any, any>>
      : never
    : Tag extends "set" ?
      // biome-ignore lint/suspicious/noExplicitAny: generic Set narrow
      Pat extends PSet<unknown> ?
        Extract<T, Set<any>>
      : never
    : never
  : never;

type IntersectNarrow<T, Parts extends readonly unknown[], Depth extends number> =
  Parts extends readonly [infer Head, ...infer Tail] ?
    IntersectNarrow<NarrowedBy<T, Head, Depth>, Tail, Depth>
  : T;

type TupleNarrow<Items extends readonly unknown[], Depth extends number> = {
  [K in keyof Items]: NarrowedBy<unknown, Items[K], Depth>;
};

/**
 * Object narrowing — for each union member of T, check that every shared key
 * with Pat narrows to something non-never; if so, keep that member and narrow
 * the overlapping slots. If any member fails all-keys-match, it's dropped.
 *
 * This differs from `Extract<T, DeepPartial<Pat>>` (what we had): we walk T's
 * members explicitly and preserve unmatched properties verbatim, instead of
 * relying on structural assignability which drops properties Pat didn't
 * mention.
 */
type ObjectNarrow<T, Pat, Depth extends number> =
  [Depth] extends [0] ? Extract<T, object>
  : T extends object ?
    T extends unknown ?
      AllKeysCompatible<T, Pat, Depth> extends true ?
        Simplify<{
          [K in keyof T]: K extends keyof Pat ? NarrowedBy<T[K], Pat[K], Depth> : T[K];
        }>
      : never
    : never
  : never;

type AllKeysCompatible<T, Pat, Depth extends number> =
  [AnyKeyFails<T, Pat, Depth>] extends [never] ? true
  : true extends AnyKeyFails<T, Pat, Depth> ? false
  : true;

type AnyKeyFails<T, Pat, Depth extends number> = {
  [K in keyof Pat & keyof T]: [NarrowedBy<T[K], Pat[K], Depth>] extends [never] ? true : false;
}[keyof Pat & keyof T];

/** Given a pattern, report what it narrows from `unknown`. */
export type InferPattern<Pat> = NarrowedBy<unknown, Pat>;
