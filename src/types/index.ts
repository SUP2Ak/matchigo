// Public type surface — the only file the rest of src/ imports from.
// Sub-files (Pattern, Narrow, Exclude, Select, Helpers) are implementation
// details; they are re-exported here so consumers can `import type` any of
// them from the package entry if they ever need to.

import type { Pattern } from "./Pattern.ts";
import type { NarrowedBy } from "./Narrow.ts";
import type { DeepExclude } from "./Exclude.ts";
import type { SelectedArg } from "./Select.ts";

export type { Pattern } from "./Pattern.ts";
export type { NarrowedBy, InferPattern } from "./Narrow.ts";
export type { DeepExclude } from "./Exclude.ts";
export type { SelectedArg } from "./Select.ts";

/* -------------------------------------------------------------------------- */
/* Rules + fallback                                                           */
/* -------------------------------------------------------------------------- */

// Handler shape accepts either a scalar result or a unary function. The
// `(v: any) => R` branch is the typed-escape for P.select()-using handlers
// that receive an extracted value instead of the full matched type.
// biome-ignore lint/suspicious/noExplicitAny: handler arg is variable
type ThenFn<T, R> = R | ((v: T) => R) | ((v: any) => R);

export type Rule<T, R, _N = T> =
  | {
      with: Pattern<T>;
      when?: (v: T) => boolean;
      then: ThenFn<T, R>;
    }
  | { otherwise: R | ((v: T) => R) };

/* -------------------------------------------------------------------------- */
/* CompiledFn + Matcher + ExhaustiveError                                     */
/* -------------------------------------------------------------------------- */

export interface CompiledFn<T, R> {
  (value: T): R;
  run(value: T): R;
}

export type ExhaustiveError<Rem> = {
  readonly __error: "Non-exhaustive match";
  readonly __missing: Rem;
};

export interface Matcher<T, R, Rem = T> {
  // Two-arg overload: pattern + handler. Handler receives either the narrowed
  // value (no P.select) or the extracted selection (see SelectedArg).
  with<const Pat extends Pattern<Rem>>(
    pattern: Pat,
    then: R | ((v: SelectedArg<Pat, NarrowedBy<Rem, Pat>>) => R),
  ): Matcher<T, R, DeepExclude<Rem, Pat>>;

  // Three-arg overload: pattern + guard + handler. The guard can't narrow
  // at type level (predicates aren't type predicates), so Rem is preserved.
  with<const Pat extends Pattern<Rem>>(
    pattern: Pat,
    guard: (v: NarrowedBy<Rem, Pat>) => boolean,
    then: R | ((v: SelectedArg<Pat, NarrowedBy<Rem, Pat>>) => R),
  ): Matcher<T, R, Rem>;

  otherwise(result: R | ((v: Rem) => R)): CompiledFn<T, R>;

  exhaustive(): [Rem] extends [never] ? CompiledFn<T, R> : ExhaustiveError<Rem>;

  run(value: T): R;
  compile(): CompiledFn<T, R>;
}
