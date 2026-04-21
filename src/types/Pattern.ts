// Pattern<T, Depth> — the shape of a valid pattern for a value of type T.
//
// A pattern is either a sentinel (any P.*), or a value whose structure matches
// T. Structural patterns mirror T recursively; the recursion is bounded by
// `Depth` so deeply nested shapes don't push TS past its conditional-type
// bail-out.
//
// Depth hits zero → we fall back to `unknown` for the inner slot. This mirrors
// ts-pattern's compromise (they cut at 5 levels): precise at realistic nesting,
// permissive at the bottom. Users can extend `Prev` in Helpers.ts if they
// genuinely need deeper narrowing.

import type { PPattern } from "../p.ts";
import type { IsTuple, Prev } from "./Helpers.ts";

export type Pattern<T, Depth extends number = 6> = PPattern | SpecificPattern<T, Depth>;

type SpecificPattern<T, Depth extends number> =
  [Depth] extends [0] ? unknown
  : IsTuple<T> extends true ? TuplePattern<T, Prev[Depth]>
  : T extends readonly (infer Item)[] ? readonly Pattern<Item, Prev[Depth]>[]
  : T extends object ? ObjectPattern<T, Prev[Depth]>
  : // Primitive: accept the literal value itself *or* an array of T as
    // the union-shorthand (`.with(["admin","root"], ...)`). The runtime
    // treats a top-level array as sugar for `P.union(...xs)`.
    T | readonly T[];

type TuplePattern<T, Depth extends number> =
  T extends readonly unknown[] ? { readonly [K in keyof T]: Pattern<T[K], Depth> } : never;

// Distribute over unions so `{kind:"a"} | {kind:"b"}` yields
// `ObjectPattern<{kind:"a"}> | ObjectPattern<{kind:"b"}>`. Writing a pattern
// then assigns into whichever branch matches structurally.
type ObjectPattern<T, Depth extends number> =
  T extends unknown ? { readonly [K in keyof T]?: Pattern<T[K], Depth> } : never;
