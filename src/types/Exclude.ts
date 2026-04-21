// DeepExclude<T, Pat> — what's left of T after a rule matches Pat.
//
// The naive `Exclude<T, NarrowedBy<T, Pat>>` is broken for discriminated
// unions: `Exclude` only removes exact subtypes, so
//   `Exclude<{k:"a"|"b"; x:number}, {k:"a"}>`
// yields `{k:"a"|"b"; x:number}` (not a subtype-match, so nothing is removed).
//
// The fix: before excluding, *distribute* T so that every member has singleton
// values on the keys constrained by Pat. That turns the above into
//   `Exclude<{k:"a";x:number}|{k:"b";x:number}, {k:"a";x:number}>`
// which correctly leaves `{k:"b";x:number}`.
//
// We fold over every shared `keyof Pat & keyof T` so multi-discriminant unions
// (e.g. `{kind; stage}`) are split fully, not just on the first key TS picks.
// The fold walks a tuple — the expensive part is union→tuple conversion,
// which is bounded to reasonable sizes (≤ ~12 shared keys) before TS bail-out.

import type { UnionToIntersection, Simplify } from "./Helpers.ts";
import type { NarrowedBy } from "./Narrow.ts";

export type DeepExclude<T, Pat> = Exclude<
  DistributeMatchingUnion<T, Pat>,
  NarrowedBy<DistributeMatchingUnion<T, Pat>, Pat>
>;

/**
 * Expand T's union so each member has singleton values on the keys Pat cares
 * about. Primitives, arrays, and values that don't share any key with Pat
 * are returned untouched.
 */
type DistributeMatchingUnion<T, Pat> =
  T extends unknown ?
    Pat extends object ?
      T extends object ?
        [keyof T & keyof Pat] extends [never] ?
          T
        : FoldSplit<T, UnionToTuple<keyof T & keyof Pat>>
      : T
    : T
  : never;

/** Sequentially split T by each key in the tuple; each step is a full union expansion. */
type FoldSplit<T, KeyTuple> =
  KeyTuple extends readonly [infer Head, ...infer Tail] ?
    Head extends keyof T ?
      FoldSplit<SplitKey<T, Head>, Tail>
    : T
  : T;

/**
 * Split T on one key: emit one variant per value of T[K], keeping the other
 * slots unchanged. `Simplify` flattens `Omit & {K:V}` for readable errors.
 */
type SplitKey<T, K extends keyof T> =
  T[K] extends infer V ?
    V extends T[K] ?
      Simplify<Omit<T, K> & { [P in K & PropertyKey]: V }>
    : never
  : never;

/**
 * Union→tuple via the classic "last member" trick. Produces a tuple in
 * reverse-declaration order; order is irrelevant for a fold. Bounded by TS's
 * conditional-type recursion limit (~50 members at the time of writing).
 */
type UnionToTuple<U, Acc extends readonly unknown[] = []> =
  [U] extends [never] ? Acc : UnionToTuple<Exclude<U, LastOfUnion<U>>, [LastOfUnion<U>, ...Acc]>;

type LastOfUnion<U> =
  UnionToIntersection<U extends unknown ? (x: U) => void : never> extends (x: infer L) => void ? L
  : never;
