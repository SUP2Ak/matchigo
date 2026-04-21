import { describe, expect, test } from "bun:test";
import { P, compile, isMatching, match, matchWalk, matcher, matcherWalk } from "../src/index.ts";

describe("literal matching", () => {
  test("basic match", () => {
    expect(
      match<string, string>("admin", [
        { with: "admin", then: "Admin" },
        { with: "user", then: "User" },
        { otherwise: "Unknown" },
      ]),
    ).toBe("Admin");
  });

  test("array as union shorthand", () => {
    expect(
      match<string, string>("root", [
        { with: ["admin", "root", "superuser"], then: "Admin" },
        { otherwise: "Unknown" },
      ]),
    ).toBe("Admin");
  });

  test("throws on non-exhaustive", () => {
    expect(() => match<string, string>("x", [{ with: "admin", then: "Admin" }])).toThrow(
      "Non-exhaustive",
    );
  });
});

describe("P primitives", () => {
  test("P.string/number/boolean", () => {
    const f = compile<unknown, string>([
      { with: P.string, then: "str" },
      { with: P.number, then: "num" },
      { with: P.boolean, then: "bool" },
      { otherwise: "other" },
    ]);
    expect(f("hello")).toBe("str");
    expect(f(42)).toBe("num");
    expect(f(true)).toBe("bool");
    expect(f(null)).toBe("other");
  });

  test("P.nullish / P.defined", () => {
    const f = compile<unknown, string>([
      { with: P.nullish, then: "nope" },
      { with: P.defined, then: "yes" },
    ]);
    expect(f(null)).toBe("nope");
    expect(f(undefined)).toBe("nope");
    expect(f(0)).toBe("yes");
  });

  test("P.union", () => {
    expect(
      match<string, string>("b", [
        { with: P.union("a", "b", "c"), then: "abc" },
        { otherwise: "none" },
      ]),
    ).toBe("abc");
  });

  test("P.not + P.optional", () => {
    const f = compile<unknown, string>([
      { with: P.not(P.nullish), then: "here" },
      { otherwise: "gone" },
    ]);
    expect(f(1)).toBe("here");
    expect(f(null)).toBe("gone");

    const g = compile<unknown, string>([
      { with: P.optional(P.string), then: "ok" },
      { otherwise: "no" },
    ]);
    expect(g(undefined)).toBe("ok");
    expect(g("x")).toBe("ok");
    expect(g(1)).toBe("no");
  });
});

describe("number refinements", () => {
  test("between / gt / gte / lt / lte", () => {
    const f = compile<number, string>([
      { with: P.between(0, 10), then: "0-10" },
      { with: P.gt(100), then: "big" },
      { with: P.lt(0), then: "neg" },
      { otherwise: "other" },
    ]);
    expect(f(5)).toBe("0-10");
    expect(f(0)).toBe("0-10");
    expect(f(150)).toBe("big");
    expect(f(-1)).toBe("neg");
    expect(f(50)).toBe("other");
  });

  test("positive / negative / integer / finite", () => {
    const f = compile<number, string>([
      { with: P.negative, then: "-" },
      { with: P.integer, then: "int" },
      { with: P.finite, then: "fin" },
      { otherwise: "other" },
    ]);
    expect(f(-5)).toBe("-");
    expect(f(3)).toBe("int");
    expect(f(3.14)).toBe("fin");
    expect(f(Infinity)).toBe("other");
  });
});

describe("string refinements", () => {
  test("regex / startsWith / endsWith", () => {
    const f = compile<string, string>([
      { with: P.regex(/^user-\d+$/), then: "user-id" },
      { with: P.startsWithStr("admin:"), then: "admin-ns" },
      { with: P.endsWithStr(".json"), then: "json-file" },
      { otherwise: "other" },
    ]);
    expect(f("user-42")).toBe("user-id");
    expect(f("admin:root")).toBe("admin-ns");
    expect(f("config.json")).toBe("json-file");
    expect(f("hello")).toBe("other");
  });
});

describe("shape matching", () => {
  type Shape =
    | { kind: "circle"; r: number }
    | { kind: "square"; s: number }
    | { kind: "tri"; a: number; b: number };

  test("discriminated union", () => {
    const area = matcher<Shape, number>()
      .with({ kind: "circle" }, (s) => Math.PI * s.r ** 2)
      .with({ kind: "square" }, (s) => s.s ** 2)
      .with({ kind: "tri" }, (s) => 0.5 * s.a * s.b)
      .exhaustive();
    expect(area({ kind: "circle", r: 2 })).toBeCloseTo(12.566);
    expect(area({ kind: "square", s: 5 })).toBe(25);
    expect(area({ kind: "tri", a: 3, b: 4 })).toBe(6);
  });

  test("nested shape", () => {
    type U = { profile: { verified: boolean; age: number } };
    expect(
      match<U, string>({ profile: { verified: true, age: 30 } }, [
        { with: { profile: { verified: true } }, then: "ok" },
        { otherwise: "no" },
      ]),
    ).toBe("ok");
  });
});

describe("array patterns", () => {
  test("P.array (all items)", () => {
    expect(
      match<unknown[], string>(
        [1, 2, 3],
        [{ with: P.array(P.number), then: "nums" }, { otherwise: "other" }],
      ),
    ).toBe("nums");
    expect(
      match<unknown[], string>(
        [1, "2"],
        [{ with: P.array(P.number), then: "nums" }, { otherwise: "other" }],
      ),
    ).toBe("other");
  });

  test("P.tuple (exact length)", () => {
    const f = compile<unknown[], string>([
      { with: P.tuple(P.number, P.string), then: "pair" },
      { otherwise: "other" },
    ]);
    expect(f([1, "x"])).toBe("pair");
    expect(f([1, "x", 2])).toBe("other"); // length mismatch
  });

  test("P.startsWith / P.endsWith", () => {
    const f = compile<unknown[], string>([
      { with: P.startsWith(1, 2), then: "12-prefix" },
      { with: P.endsWith(9), then: "ends-9" },
      { otherwise: "other" },
    ]);
    expect(f([1, 2, 3, 4])).toBe("12-prefix");
    expect(f([5, 6, 9])).toBe("ends-9");
    expect(f([])).toBe("other");
  });

  test("P.arrayOf with min/max", () => {
    const f = compile<unknown[], string>([
      { with: P.arrayOf(P.number, { min: 2, max: 4 }), then: "ok" },
      { otherwise: "no" },
    ]);
    expect(f([1])).toBe("no");
    expect(f([1, 2])).toBe("ok");
    expect(f([1, 2, 3, 4])).toBe("ok");
    expect(f([1, 2, 3, 4, 5])).toBe("no");
  });
});

describe("guards", () => {
  test("when() as 3-arg overload in matcher", () => {
    const bucket = matcher<number, string>()
      .with(P.number, (n) => n >= 65, "Senior")
      .with(P.number, (n) => n >= 18, "Adult")
      .otherwise("Young");
    expect(bucket(70)).toBe("Senior");
    expect(bucket(25)).toBe("Adult");
    expect(bucket(10)).toBe("Young");
  });

  test("when in data-driven rule", () => {
    expect(
      match<number, string>(25, [
        { with: P.number, when: (n) => n >= 65, then: "S" },
        { with: P.number, when: (n) => n >= 18, then: "A" },
        { otherwise: "Y" },
      ]),
    ).toBe("A");
  });
});

describe("P.intersection", () => {
  test("combine constraints", () => {
    const f = compile<unknown, string>([
      { with: P.intersection(P.number, P.positive, P.integer), then: "pos-int" },
      { otherwise: "other" },
    ]);
    expect(f(5)).toBe("pos-int");
    expect(f(3.14)).toBe("other");
    expect(f(-1)).toBe("other");
  });
});

describe("P.instanceOf", () => {
  test("match by constructor", () => {
    class Foo {}
    class Bar {}
    const f = compile<unknown, string>([
      { with: P.instanceOf(Foo), then: "foo" },
      { with: P.instanceOf(Bar), then: "bar" },
      { otherwise: "other" },
    ]);
    expect(f(new Foo())).toBe("foo");
    expect(f(new Bar())).toBe("bar");
    expect(f({})).toBe("other");
  });
});

describe("P.select", () => {
  test("extract single unlabeled", () => {
    type U = { kind: "user"; name: string };
    expect(
      match<U, string>({ kind: "user", name: "alice" }, [
        {
          with: { kind: "user", name: P.select() },
          then: (name: string) => `hi ${name}`,
        },
        { otherwise: "?" },
      ]),
    ).toBe("hi alice");
  });

  test("extract multiple labeled", () => {
    type U = { name: string; age: number };
    const result = match<U, string>({ name: "bob", age: 30 }, [
      {
        with: { name: P.select("n"), age: P.select("a") },
        then: (sel: unknown) => {
          const s = sel as { n: string; a: number };
          return `${s.n}-${s.a}`;
        },
      },
      { otherwise: "?" },
    ]);
    expect(result).toBe("bob-30");
  });
});

describe("compile() and matcher().compile()", () => {
  test("compile returns reusable fn", () => {
    const classify = compile<string, string>([
      { with: "admin", then: "A" },
      { with: "user", then: "U" },
      { otherwise: "X" },
    ]);
    expect(classify("admin")).toBe("A");
    expect(classify.run("user")).toBe("U");
    expect(classify("other")).toBe("X");
  });

  test("matcher().compile() fast-path literal Map", () => {
    const f = matcher<string, string>().with("a", "A").with("b", "B").with("c", "C").otherwise("?");
    expect(f("a")).toBe("A");
    expect(f("b")).toBe("B");
    expect(f("z")).toBe("?");
  });
});

describe("exhaustiveness runtime", () => {
  test("throws if no otherwise and no match", () => {
    const f = compile<string, string>([{ with: "a", then: "A" }]);
    expect(() => f("b")).toThrow("Non-exhaustive");
  });
});

describe("matchWalk() — cold-path parity with match()", () => {
  // Parity: walk and compile must agree on every shape of rule we support.
  // If these ever diverge, the two code paths have drifted.

  test("literals + otherwise", () => {
    const rules = [
      { with: "admin", then: "A" },
      { with: "user", then: "U" },
      { otherwise: "X" },
    ] as const;
    for (const v of ["admin", "user", "guest"]) {
      expect(matchWalk<string, string>(v, rules as never)).toBe(
        match<string, string>(v, rules as never),
      );
    }
  });

  test("array-as-union sugar", () => {
    const rules = [{ with: ["admin", "root"], then: "A" }, { otherwise: "X" }] as const;
    for (const v of ["admin", "root", "guest"]) {
      expect(matchWalk<string, string>(v, rules as never)).toBe(
        match<string, string>(v, rules as never),
      );
    }
  });

  test("shape matching + guards", () => {
    type Shape = { kind: "circle"; r: number } | { kind: "square"; s: number };
    const rules = [
      {
        with: { kind: "circle" },
        when: (s: Shape) => (s as { r: number }).r > 5,
        then: "big-circle",
      },
      { with: { kind: "circle" }, then: "small-circle" },
      { with: { kind: "square" }, then: "square" },
    ] as const;
    const inputs: Shape[] = [
      { kind: "circle", r: 10 },
      { kind: "circle", r: 1 },
      { kind: "square", s: 3 },
    ];
    for (const v of inputs) {
      expect(matchWalk<Shape, string>(v, rules as never)).toBe(
        match<Shape, string>(v, rules as never),
      );
    }
  });

  test("P.select anonymous — handler receives extracted value", () => {
    type User = { name: string; age: number };
    const rules = [
      {
        with: { name: P.select() },
        then: (name: string) => `hi ${name}`,
      },
      { otherwise: "?" },
    ] as const;
    expect(matchWalk<User, string>({ name: "ana", age: 30 }, rules as never)).toBe("hi ana");
  });

  test("P.select labeled — handler receives record", () => {
    type User = { name: string; age: number };
    const rules = [
      {
        with: { name: P.select("n"), age: P.select("a") },
        then: ({ n, a }: { n: string; a: number }) => `${n}-${a}`,
      },
      { otherwise: "?" },
    ] as const;
    expect(matchWalk<User, string>({ name: "ana", age: 30 }, rules as never)).toBe("ana-30");
  });

  test("throws on non-exhaustive", () => {
    expect(() => matchWalk<string, string>("x", [{ with: "a", then: "A" }] as never)).toThrow(
      "Non-exhaustive",
    );
  });

  test("no compile cache — distinct arrays still work", () => {
    // This is the whole point of matchWalk: rebuilding the rules array
    // on every call must work correctly, regardless of identity.
    for (let i = 0; i < 3; i++) {
      expect(
        matchWalk<string, string>("admin", [{ with: "admin", then: "A" }, { otherwise: "?" }]),
      ).toBe("A");
    }
  });
});

describe("P.string refinements — length + includes", () => {
  const rules = [
    { with: P.lengthStr(0), then: "empty" },
    { with: P.maxLengthStr(2), then: "short" },
    { with: P.minLengthStr(10), then: "long" },
    { with: P.includesStr("@"), then: "email-ish" },
    { otherwise: "medium" },
  ] as const;

  test("compile() — every branch", () => {
    const f = compile<string, string>(rules as never);
    expect(f("")).toBe("empty");
    expect(f("hi")).toBe("short");
    expect(f("an-actually-long-string")).toBe("long");
    expect(f("a@b")).toBe("email-ish");
    expect(f("medium")).toBe("medium");
  });

  test("matchWalk() parity", () => {
    expect(matchWalk<string, string>("", rules as never)).toBe("empty");
    expect(matchWalk<string, string>("a@b", rules as never)).toBe("email-ish");
  });
});

describe("P.bigint refinements", () => {
  const rules = [
    { with: P.bigintBetween(1n, 100n), then: "small" },
    { with: P.bigintGte(1_000_000n), then: "big" },
    { with: P.bigintNegative, then: "neg" },
    { with: P.bigintPositive, then: "pos" },
    { otherwise: "zero" },
  ] as const;

  test("compile() — every branch", () => {
    const f = compile<bigint, string>(rules as never);
    expect(f(50n)).toBe("small");
    expect(f(5_000_000n)).toBe("big");
    expect(f(-1n)).toBe("neg");
    expect(f(500n)).toBe("pos");
    expect(f(0n)).toBe("zero");
  });

  test("matchWalk() parity", () => {
    expect(matchWalk<bigint, string>(-10n, rules as never)).toBe("neg");
    expect(matchWalk<bigint, string>(50n, rules as never)).toBe("small");
  });
});

describe("P.arrayIncludes", () => {
  test("matches when at least one element matches", () => {
    const f = compile<unknown[], string>([
      { with: P.arrayIncludes(P.number), then: "has-number" },
      { otherwise: "no-number" },
    ]);
    expect(f(["a", "b", 3])).toBe("has-number");
    expect(f(["a", "b"])).toBe("no-number");
  });

  test("matchWalk() parity", () => {
    expect(
      matchWalk<unknown[], string>([1, 2, 3], [
        { with: P.arrayIncludes(P.string), then: "has-str" },
        { otherwise: "no-str" },
      ] as never),
    ).toBe("no-str");
  });
});

describe("P.map / P.set", () => {
  test("P.map — match all entries", () => {
    const m = new Map<string, number>([
      ["a", 1],
      ["b", 2],
    ]);
    expect(
      match<unknown, string>(m, [
        { with: P.map(P.string, P.number), then: "ok" },
        { otherwise: "no" },
      ]),
    ).toBe("ok");
    const bad = new Map<string, unknown>([["a", "x"]]);
    expect(
      match<unknown, string>(bad, [
        { with: P.map(P.string, P.number), then: "ok" },
        { otherwise: "no" },
      ]),
    ).toBe("no");
  });

  test("P.set — match all items", () => {
    expect(
      match<unknown, string>(new Set([1, 2, 3]), [
        { with: P.set(P.number), then: "nums" },
        { otherwise: "other" },
      ]),
    ).toBe("nums");
    expect(
      match<unknown, string>(new Set([1, "x"]), [
        { with: P.set(P.number), then: "nums" },
        { otherwise: "other" },
      ]),
    ).toBe("other");
  });

  test("matchWalk() parity for P.map", () => {
    expect(
      matchWalk<unknown, string>(new Map([["a", 1]]), [
        { with: P.map(P.string, P.number), then: "ok" },
        { otherwise: "no" },
      ] as never),
    ).toBe("ok");
  });
});

describe("P.nonNullable", () => {
  test("alias of P.defined", () => {
    const f = compile<unknown, string>([
      { with: P.nullish, then: "null" },
      { with: P.nonNullable, then: "val" },
    ]);
    expect(f(null)).toBe("null");
    expect(f(undefined)).toBe("null");
    expect(f(0)).toBe("val");
    expect(f("")).toBe("val");
  });
});

describe("P.select(subPattern) — select AND refine", () => {
  test("P.select(subPat) anonymous — narrows and extracts", () => {
    type U = { kind: "num"; v: unknown } | { kind: "str"; v: unknown };
    const r = match<U, string>({ kind: "num", v: 42 }, [
      {
        with: { kind: "num", v: P.select(P.number) },
        then: (n: number) => `n=${n}`,
      },
      { otherwise: "?" },
    ]);
    expect(r).toBe("n=42");

    const miss = match<U, string>({ kind: "num", v: "oops" }, [
      {
        with: { kind: "num", v: P.select(P.number) },
        then: (n: number) => `n=${n}`,
      },
      { otherwise: "?" },
    ]);
    expect(miss).toBe("?");
  });

  test("P.select(label, subPat) — labeled + refined", () => {
    const r = match<{ age: unknown }, string>({ age: 20 }, [
      {
        with: { age: P.select("a", P.number) },
        then: ({ a }: { a: number }) => `age=${a}`,
      },
      { otherwise: "?" },
    ]);
    expect(r).toBe("age=20");
  });

  test("matchWalk() parity for P.select(subPat)", () => {
    const r = matchWalk<{ v: unknown }, string>({ v: "hi" }, [
      {
        with: { v: P.select(P.string) },
        then: (s: string) => `s=${s}`,
      },
      { otherwise: "?" },
    ] as never);
    expect(r).toBe("s=hi");
  });
});

describe("isMatching — standalone predicate", () => {
  test("basic predicates", () => {
    expect(isMatching(P.string, "hello")).toBe(true);
    expect(isMatching(P.string, 42)).toBe(false);
    expect(isMatching(P.minLengthStr(3), "hi")).toBe(false);
    expect(isMatching(P.minLengthStr(3), "hello")).toBe(true);
  });

  test("shape matching", () => {
    expect(isMatching({ kind: "a" }, { kind: "a", x: 1 })).toBe(true);
    expect(isMatching({ kind: "a" }, { kind: "b" })).toBe(false);
  });

  test("composed patterns", () => {
    const pat = P.intersection(P.number, P.positive, P.integer);
    expect(isMatching(pat, 5)).toBe(true);
    expect(isMatching(pat, 5.5)).toBe(false);
    expect(isMatching(pat, -1)).toBe(false);
  });
});

describe("matcherWalk() — chained builder backed by matchWalk", () => {
  test("basic chained dispatch with otherwise", () => {
    const f = matcherWalk<string, string>()
      .with("admin", "Admin")
      .with("user", "User")
      .otherwise("Unknown");

    expect(f("admin")).toBe("Admin");
    expect(f("user")).toBe("User");
    expect(f("other")).toBe("Unknown");
  });

  test("guard overload (3-arg)", () => {
    const f = matcherWalk<number, string>()
      .with(P.number, (n) => n >= 65, "Senior")
      .with(P.number, (n) => n >= 18, "Adult")
      .otherwise("Young");

    expect(f(70)).toBe("Senior");
    expect(f(25)).toBe("Adult");
    expect(f(10)).toBe("Young");
  });

  test("P.select anonymous — handler receives extracted value", () => {
    const f = matcherWalk<{ kind: string; name: string }, string>()
      .with({ kind: "user", name: P.select() }, (n: string) => `hi ${n}`)
      .otherwise("?");

    expect(f({ kind: "user", name: "Ana" })).toBe("hi Ana");
    expect(f({ kind: "guest", name: "Bob" })).toBe("?");
  });

  test(".exhaustive() on discriminated union", () => {
    type Shape = { kind: "circle"; r: number } | { kind: "square"; s: number };

    const area = matcherWalk<Shape, number>()
      .with({ kind: "circle" }, (c: { r: number }) => Math.PI * c.r ** 2)
      .with({ kind: "square" }, (q: { s: number }) => q.s ** 2)
      .exhaustive() as (v: Shape) => number;

    expect(area({ kind: "circle", r: 2 })).toBeCloseTo(Math.PI * 4);
    expect(area({ kind: "square", s: 3 })).toBe(9);
  });

  test("throws when non-exhaustive at runtime", () => {
    const f = matcherWalk<string, string>().with("admin", "Admin").exhaustive() as unknown as (
      v: string,
    ) => string;

    expect(() => f("other")).toThrow("Non-exhaustive match");
  });

  test("parity with matchWalk(v, rules)", () => {
    const rules = [
      { with: P.number, when: (n: number) => n >= 18, then: "Adult" },
      { otherwise: "Young" },
    ] as const;

    const f = matcherWalk<number, string>()
      .with(P.number, (n) => n >= 18, "Adult")
      .otherwise("Young");

    for (const n of [10, 17, 18, 42, 99]) {
      expect(f(n)).toBe(matchWalk<number, string>(n, rules as never));
    }
  });
});
