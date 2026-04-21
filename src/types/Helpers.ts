// Type-level folklore — shared utilities used across the types/ barrel.
// Every alias here is a well-known TS technique (circa 2018+); the code below
// is our own implementation, written to keep naming consistent with the rest
// of the library and to bound recursion where TS 5/6 bail-outs hurt.

/**
 * Fold a union into an intersection via function-parameter contravariance.
 * For `U = A | B`, distributing through `(x: U) => void` produces
 * `((x: A) => void) | ((x: B) => void)`, whose resulting intersection has
 * parameter type `A & B`.
 */
export type UnionToIntersection<U> =
  (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

/** Force TS to display nested intersections as a single flat object. */
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** True when T is a union of two or more distinct members. */
export type IsUnion<T, U = T> =
  T extends unknown ?
    [U] extends [T] ?
      false
    : true
  : false;

/** True when T is a fixed-length tuple, as opposed to an open-ended array. */
export type IsTuple<T> =
  T extends readonly [] ? true
  : T extends readonly [unknown, ...unknown[]] ? true
  : T extends readonly [...unknown[], unknown] ? true
  : false;

/** Static tuple length as a number literal. */
export type Length<T extends readonly unknown[]> = T["length"];

/**
 * Bounded decrement for numeric literals. Indexed lookup is stable across
 * TS 5.4+ and TS 6.0. Extend this array if deeper recursion is ever needed
 * (it costs compile time, not runtime).
 */
export type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8];

/** Conventional `any`-detector; rarely needed but cheap to keep here. */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Flatten the first level of a tagged union into a record keyed by its
 * discriminant value. Used by Exclude.ts to pivot on `kind`-like fields.
 */
export type GroupByKey<U, K extends PropertyKey> = UnionToIntersection<
  U extends unknown ?
    K extends keyof U ?
      U[K] extends PropertyKey ?
        { readonly [P in U[K]]: U }
      : never
    : never
  : never
>;
