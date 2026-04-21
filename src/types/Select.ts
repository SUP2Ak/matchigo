// SelectedArg<Pat, T> — what the handler receives when a pattern uses P.select().
//
// Our model is deliberately flat: walk the pattern alongside the corresponding
// subtree of T, collecting each P.select() as a `[Label, Value]` pair (label
// is `undefined` for anonymous, a string literal otherwise). The handler
// signature is then one of three shapes, matching the runtime in compile.ts:
//
//   • zero selects               → handler gets the full matched value (T)
//   • exactly one anonymous      → handler gets the selected value
//   • any labelled / many        → handler gets a record keyed by label
//                                  (with "$0" used for stray anonymous slots)
//
// Pattern walking is bounded by Depth to stop deep trees from blowing TS.
// Unhandled cases (combinators, refinements) degrade to "no selects here"
// — the runtime is permissive enough that this stays a type-level lossiness,
// never a runtime inconsistency.

import type { PArray, PArrayIncludes, PArrayOf, PSelect, PTuple } from "../p.ts";
import type { Prev, Simplify } from "./Helpers.ts";
import type { NarrowedBy } from "./Narrow.ts";

export type SelectedArg<Pat, T, Depth extends number = 6> =
  CollectSelects<Pat, T, Depth> extends infer Selects ?
    [Selects] extends [never] ? T
    : SoleAnonymousValue<Selects> extends infer Only ?
      [Only] extends [never] ?
        SelectRecord<Selects>
      : Only
    : SelectRecord<Selects>
  : T;

type CollectSelects<Pat, T, Depth extends number> =
  [Depth] extends [0] ? never
  : Pat extends PSelect<infer L, infer SubPat> ?
    [SubPat] extends [undefined] ?
      [L, T]
    : [L, NarrowedBy<T, SubPat, Prev[Depth]>]
  : Pat extends PTuple<infer Items> ?
    T extends readonly unknown[] ?
      CollectFromTupleSlots<Items, T, Prev[Depth]>
    : never
  : Pat extends PArray<infer Item> | PArrayOf<infer Item> | PArrayIncludes<infer Item> ?
    T extends readonly (infer Elem)[] ?
      CollectSelects<Item, Elem, Prev[Depth]>
    : never
  : Pat extends readonly unknown[] ?
    T extends readonly unknown[] ?
      CollectFromTupleSlots<Pat, T, Prev[Depth]>
    : never
  : Pat extends object ?
    T extends object ?
      CollectFromObject<Pat, T, Prev[Depth]>
    : never
  : never;

type CollectFromObject<Pat, T, Depth extends number> = {
  [K in keyof Pat & keyof T]: CollectSelects<Pat[K], T[K], Depth>;
}[keyof Pat & keyof T];

type CollectFromTupleSlots<
  Pat extends readonly unknown[],
  T extends readonly unknown[],
  Depth extends number,
> = {
  [K in keyof Pat]: K extends keyof T ? CollectSelects<Pat[K], T[K], Depth> : never;
}[number];

/**
 * If the entire union of selects is a single anonymous pair `[undefined, V]`,
 * return V. Otherwise return never so the caller falls through to the record
 * shape. Wrapping Selects in `[...]` prevents distributive matching so a union
 * of two tuples won't spuriously match.
 */
type SoleAnonymousValue<Selects> = [Selects] extends [[undefined, infer V]] ? V : never;

type SelectRecord<Selects> = Simplify<{
  [L in LabelOf<Selects>]: ValueForLabel<Selects, L>;
}>;

type LabelOf<Selects> =
  Selects extends readonly [infer L, unknown] ?
    L extends string ?
      L
    : "$0"
  : never;

type ValueForLabel<Selects, L extends string> =
  Extract<Selects, readonly [L extends "$0" ? undefined : L, unknown]> extends (
    readonly [unknown, infer V]
  ) ?
    V
  : never;
