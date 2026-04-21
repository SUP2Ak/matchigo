// Type-only tests — must compile with `tsc --noEmit`, never actually run.
// The top-level guard `if (__NEVER__)` blocks runtime execution while leaving
// the bodies visible to the type-checker. `@ts-expect-error` lines mark
// intentional type errors: if TS ever stops flagging them, the directive
// itself becomes an error → test fails.

import { P, match, matcher } from "../src/index.ts";

// Opaque runtime false. TS narrows this as `boolean`, so both branches are
// type-checked; `Math.random() < -1` is always false → runtime skip.
const __NEVER__: boolean = Math.random() < -1;

if (__NEVER__) {
  /* Discriminated union — exhaustive matcher returns CompiledFn. */
  {
    type Shape = { kind: "circle"; r: number } | { kind: "square"; s: number };

    const area = matcher<Shape, number>()
      .with({ kind: "circle" }, (s) => Math.PI * s.r ** 2)
      .with({ kind: "square" }, (s) => s.s ** 2)
      .exhaustive();

    const _ok: number = area({ kind: "circle", r: 2 });
    void _ok;
  }

  /* Non-exhaustive matcher → exhaustive() returns ExhaustiveError (not callable). */
  {
    type Shape = { kind: "circle"; r: number } | { kind: "square"; s: number };

    const partial = matcher<Shape, number>()
      .with({ kind: "circle" }, (s) => s.r)
      .exhaustive();

    // @ts-expect-error ExhaustiveError is not callable
    partial({ kind: "square", s: 5 });
    void partial;
  }

  /* Handler param narrows according to pattern. */
  {
    const pick = matcher<string | number, string>()
      .with(P.string, (s) => {
        const _str: string = s;
        return _str;
      })
      .with(P.number, (n) => {
        const _num: number = n;
        return String(_num);
      })
      .exhaustive();
    void pick;
  }

  /* Literal pattern narrows exact type. */
  {
    type Role = "admin" | "user" | "guest";
    const f = matcher<Role, string>()
      .with("admin", () => "A")
      .with("user", () => "U")
      .with("guest", () => "G")
      .exhaustive();
    const _r: string = f("admin");
    void _r;
  }

  /* Guard overload does NOT narrow — Rem stays the same. */
  {
    type Role = "admin" | "user";
    const _m = matcher<Role, string>()
      .with("admin", () => true, "A")
      .with("admin", () => "A") // remaining still includes "admin" after guarded .with
      .with("user", () => "U")
      .exhaustive();
    void _m;
  }

  /* data-driven match() accepts heterogeneous patterns. */
  {
    const r: string = match<unknown, string>("x", [
      { with: P.string, then: (s: unknown) => String(s) },
      { with: P.number, then: (n: unknown) => String(n) },
      { otherwise: "?" },
    ]);
    void r;
  }

  /* DeepExclude — exhaustive over a three-variant discriminant. */
  {
    type Shape3 =
      | { kind: "circle"; r: number }
      | { kind: "square"; s: number }
      | { kind: "triangle"; a: number; b: number };

    const ok3 = matcher<Shape3, number>()
      .with({ kind: "circle" }, (s) => s.r)
      .with({ kind: "square" }, (s) => s.s)
      .with({ kind: "triangle" }, (s) => s.a * s.b)
      .exhaustive();
    const _n3: number = ok3({ kind: "circle", r: 1 });
    void _n3;

    // Missing "triangle" → ExhaustiveError, not callable.
    const partial3 = matcher<Shape3, number>()
      .with({ kind: "circle" }, (s) => s.r)
      .with({ kind: "square" }, (s) => s.s)
      .exhaustive();
    // @ts-expect-error missing triangle variant
    partial3({ kind: "triangle", a: 1, b: 2 });
  }

  /* DeepExclude — union on a non-discriminant field (the old-code-was-broken case). */
  {
    type User = { kind: "user"; role: "admin" | "guest" | "member" };

    // All three role values covered → should be exhaustive. Under the old
    // `Exclude<Rem, NarrowedBy<...>>`, this would incorrectly still be
    // non-exhaustive because `{kind:"user",role:"admin"}` is not an exact
    // subtype of User with the full role union.
    const handleAllRoles = matcher<User, string>()
      .with({ kind: "user", role: "admin" }, () => "a")
      .with({ kind: "user", role: "guest" }, () => "g")
      .with({ kind: "user", role: "member" }, () => "m")
      .exhaustive();
    const _s: string = handleAllRoles({ kind: "user", role: "admin" });
    void _s;
  }
} // end of __NEVER__ guard
