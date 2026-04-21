// Benchmark scenarios — single source of truth.
//
// Each contender name is suffixed with [hoisted] or [inline] so readers can
// see at a glance what's being compared. "hoisted" means the dispatcher is
// built once at module load and reused; "inline" means rules are rebuilt on
// every call (the idiomatic ts-pattern usage, and matchigo's anti-pattern).
//
// ts-pattern has no hoist API by design: `match(value).with(...)` takes the
// value first, so it can never be pre-compiled. It therefore only appears in
// [inline] rows — that's a fair reflection of its API, not an oversight.

import { P as TP, match as tsMatch } from "ts-pattern";
import {
  against as izAgainst,
  match as izMatch,
  otherwise as izOther,
  when as izWhen,
} from "match-iz";

import {
  P,
  compile,
  match as mgMatch,
  matchWalk as mgMatchWalk,
  matcher,
  matcherWalk,
} from "../src/index.ts";
import type { Rule } from "../src/index.ts";

/* -------------------------------------------------------------------------- */
/* Shared inputs                                                               */
/* -------------------------------------------------------------------------- */

const roleInputs = ["admin", "user", "guest", "moderator", "other"];
let ri = 0;
const nextRole = (): string => roleInputs[ri++ % roleInputs.length]!;

const altInputs = ["root", "guest", "superuser", "admin", "user", "other"];
let ai = 0;
const nextAlt = (): string => altInputs[ai++ % altInputs.length]!;

const ageInputs = [5, 18, 25, 12, 42, 17, 99, 70];
let gi = 0;
const nextAge = (): number => ageInputs[gi++ % ageInputs.length]!;

type Shape =
  | { kind: "circle"; r: number }
  | { kind: "square"; s: number }
  | { kind: "tri"; a: number; b: number };

const shapeInputs: Shape[] = [
  { kind: "circle", r: 3 },
  { kind: "square", s: 4 },
  { kind: "tri", a: 3, b: 4 },
  { kind: "circle", r: 1 },
  { kind: "square", s: 2 },
];
let si = 0;
const nextShape = (): Shape => shapeInputs[si++ % shapeInputs.length]!;

const users = Array.from({ length: 100 }, (_, i) => ({ age: i % 40 }));

// Scenario G — intersection stacking (number refinements)
const numInputs = [50, -3, 150, 3.14, 0, 42, 7.5, 99, 200, 10];
let ni = 0;
const nextNum = (): number => numInputs[ni++ % numInputs.length]!;

// Scenario H — deeply nested shape
type DeepEvent =
  | { kind: "click"; target: { page: { path: string; meta: { verified: boolean } } } }
  | { kind: "hover"; target: { page: { path: string; meta: { verified: boolean } } } }
  | { kind: "scroll"; target: { page: { path: string; meta: { verified: boolean } } } };
const deepInputs: DeepEvent[] = [
  { kind: "click", target: { page: { path: "/home", meta: { verified: true } } } },
  { kind: "hover", target: { page: { path: "/about", meta: { verified: false } } } },
  { kind: "scroll", target: { page: { path: "/contact", meta: { verified: true } } } },
  { kind: "click", target: { page: { path: "/blog", meta: { verified: false } } } },
];
let di = 0;
const nextDeep = (): DeepEvent => deepInputs[di++ % deepInputs.length]!;

// Scenario I — regex + string refinements
const strInputs = [
  "user-123",
  "admin@company.com",
  "hi",
  "a-very-long-identifier-here",
  "debug",
  "order-42",
  "",
  "x",
];
let sti = 0;
const nextStr = (): string => strInputs[sti++ % strInputs.length]!;

// Scenario J — P.not combinations on a mixed domain
const mixedInputs: unknown[] = ["hello", 42, null, undefined, true, 3.14, "bye", 0];
let mi = 0;
const nextMixed = (): unknown => mixedInputs[mi++ % mixedInputs.length]!;

/* -------------------------------------------------------------------------- */
/* Pre-built rules / matchers (hoisted path)                                   */
/* -------------------------------------------------------------------------- */

// Scenario A — simple literal
const roleRulesMg = [
  { with: "admin", then: "Admin" },
  { with: "user", then: "User" },
  { with: "guest", then: "Guest" },
  { with: "moderator", then: "Mod" },
  { otherwise: "Unknown" },
] as const satisfies ReadonlyArray<Rule<string, string>>;
const roleCompiledMg = compile<string, string>(roleRulesMg as never);
const roleMatcherMg = matcher<string, string>()
  .with("admin", "Admin")
  .with("user", "User")
  .with("guest", "Guest")
  .with("moderator", "Mod")
  .otherwise("Unknown");
const roleMatcherWalkMg = matcherWalk<string, string>()
  .with("admin", "Admin")
  .with("user", "User")
  .with("guest", "Guest")
  .with("moderator", "Mod")
  .otherwise("Unknown");
const roleAgainstIz = izAgainst(
  izWhen("admin", "Admin"),
  izWhen("user", "User"),
  izWhen("guest", "Guest"),
  izWhen("moderator", "Mod"),
  izOther("Unknown"),
);

// Scenario B — alternatives
const altRulesMg = [
  { with: ["admin", "root", "superuser"], then: "Admin" },
  { with: ["user", "guest"], then: "User" },
  { otherwise: "Unknown" },
] as const satisfies ReadonlyArray<Rule<string, string>>;
const altCompiledMg = compile<string, string>(altRulesMg as never);
const altMatcherMg = matcher<string, string>()
  .with(["admin", "root", "superuser"] as const, "Admin")
  .with(["user", "guest"] as const, "User")
  .otherwise("Unknown");
const altAgainstIz = izAgainst(
  izWhen(["admin", "root", "superuser"], "Admin"),
  izWhen(["user", "guest"], "User"),
  izOther("Unknown"),
);

// Scenario C — guards
const ageRulesMg = [
  { with: P.number, when: (n: number) => n >= 65, then: "Senior" },
  { with: P.number, when: (n: number) => n >= 18, then: "Adult" },
  { otherwise: "Young" },
] as const satisfies ReadonlyArray<Rule<number, string>>;
const ageCompiledMg = compile<number, string>(ageRulesMg as never);
const ageMatcherMg = matcher<number, string>()
  .with(P.number, (n) => n >= 65, "Senior")
  .with(P.number, (n) => n >= 18, "Adult")
  .otherwise("Young");
const ageAgainstIz = izAgainst(
  izWhen((x: number) => x >= 65, "Senior"),
  izWhen((x: number) => x >= 18, "Adult"),
  izOther("Young"),
);

// Scenario D — shape matching (discriminated union)
const shapeRulesMg = [
  {
    with: { kind: "circle" },
    then: (s: Shape) => Math.PI * (s as { kind: "circle"; r: number }).r ** 2,
  },
  {
    with: { kind: "square" },
    then: (s: Shape) => (s as { kind: "square"; s: number }).s ** 2,
  },
  {
    with: { kind: "tri" },
    then: (s: Shape) => {
      const t = s as { kind: "tri"; a: number; b: number };
      return 0.5 * t.a * t.b;
    },
  },
] as const satisfies ReadonlyArray<Rule<Shape, number>>;
const shapeCompiledMg = compile<Shape, number>(shapeRulesMg as never);
const shapeMatcherMg = matcher<Shape, number>()
  .with({ kind: "circle" }, (s) => Math.PI * s.r ** 2)
  .with({ kind: "square" }, (s) => s.s ** 2)
  .with({ kind: "tri" }, (s) => 0.5 * s.a * s.b)
  .exhaustive();
const shapeAgainstIz = izAgainst(
  izWhen({ kind: "circle" }, (s) => Math.PI * (s as { kind: "circle"; r: number }).r ** 2),
  izWhen({ kind: "square" }, (s) => (s as { kind: "square"; s: number }).s ** 2),
  izWhen({ kind: "tri" }, (s) => {
    const t = s as { kind: "tri"; a: number; b: number };
    return 0.5 * t.a * t.b;
  }),
);

// Scenario E — throughput (map over 100 items)
const userAgeMatcherMg = matcher<{ age: number }, string>()
  .with(P.any, (u: { age: number }) => u.age >= 18, "Adult")
  .otherwise("Young");
const userAgeAgainstIz = izAgainst(
  izWhen((x: { age: number }) => x.age >= 18, "Adult"),
  izOther("Young"),
);

// Scenario G — intersection stacking (number refinements)
const intRulesMg = [
  {
    with: P.intersection(P.number, P.positive, P.integer, P.between(0, 100)),
    then: "ok",
  },
  { with: P.number, then: "num-reject" },
  { otherwise: "other" },
] as const satisfies ReadonlyArray<Rule<number, string>>;
const intCompiledMg = compile<number, string>(intRulesMg as never);
const intMatcherMg = matcher<number, string>()
  .with(P.intersection(P.number, P.positive, P.integer, P.between(0, 100)), () => "ok")
  .with(P.number, () => "num-reject")
  .otherwise("other");
const intAgainstIz = izAgainst(
  izWhen(
    (x: number) => typeof x === "number" && x > 0 && Number.isInteger(x) && x >= 0 && x <= 100,
    "ok",
  ),
  izWhen((x: number) => typeof x === "number", "num-reject"),
  izOther("other"),
);

// Scenario H — deeply nested shape
const deepRulesMg = [
  {
    with: {
      kind: "click",
      target: { page: { meta: { verified: true } } },
    },
    then: "click-verified",
  },
  {
    with: {
      kind: "click",
      target: { page: { meta: { verified: false } } },
    },
    then: "click-unverified",
  },
  {
    with: { kind: "hover" },
    then: "hover",
  },
  { otherwise: "other" },
] as const satisfies ReadonlyArray<Rule<DeepEvent, string>>;
const deepCompiledMg = compile<DeepEvent, string>(deepRulesMg as never);
const deepMatcherMg = matcher<DeepEvent, string>()
  .with({ kind: "click", target: { page: { meta: { verified: true } } } }, () => "click-verified")
  .with(
    { kind: "click", target: { page: { meta: { verified: false } } } },
    () => "click-unverified",
  )
  .with({ kind: "hover" }, () => "hover")
  .otherwise("other");
const deepAgainstIz = izAgainst(
  izWhen({ kind: "click", target: { page: { meta: { verified: true } } } }, () => "click-verified"),
  izWhen(
    { kind: "click", target: { page: { meta: { verified: false } } } },
    () => "click-unverified",
  ),
  izWhen({ kind: "hover" }, () => "hover"),
  izOther("other"),
);

// Scenario I — regex + string refinements
const userRe = /^user-\d+$/;
const orderRe = /^order-\d+$/;
const strRulesMg = [
  { with: P.regex(userRe), then: "user-id" },
  { with: P.regex(orderRe), then: "order-id" },
  { with: P.includesStr("@"), then: "email-ish" },
  { with: P.minLengthStr(20), then: "long" },
  { with: P.lengthStr(0), then: "empty" },
  { otherwise: "other" },
] as const satisfies ReadonlyArray<Rule<string, string>>;
const strCompiledMg = compile<string, string>(strRulesMg as never);
const strMatcherMg = matcher<string, string>()
  .with(P.regex(userRe), () => "user-id")
  .with(P.regex(orderRe), () => "order-id")
  .with(P.includesStr("@"), () => "email-ish")
  .with(P.minLengthStr(20), () => "long")
  .with(P.lengthStr(0), () => "empty")
  .otherwise("other");
const strAgainstIz = izAgainst(
  izWhen((s: string) => userRe.test(s), "user-id"),
  izWhen((s: string) => orderRe.test(s), "order-id"),
  izWhen((s: string) => s.includes("@"), "email-ish"),
  izWhen((s: string) => s.length >= 20, "long"),
  izWhen((s: string) => s.length === 0, "empty"),
  izOther("other"),
);

// Scenario J — P.not nested
const notRulesMg = [
  { with: P.not(P.nullish), then: "defined" },
  { otherwise: "null" },
] as const satisfies ReadonlyArray<Rule<unknown, string>>;
const notCompiledMg = compile<unknown, string>(notRulesMg as never);
const notMatcherMg = matcher<unknown, string>()
  .with(P.not(P.nullish), () => "defined")
  .otherwise("null");
const notAgainstIz = izAgainst(
  izWhen((v: unknown) => v != null, "defined"),
  izOther("null"),
);

/* -------------------------------------------------------------------------- */
/* Scenario definitions                                                        */
/* -------------------------------------------------------------------------- */

export interface Contender {
  name: string;
  fn: () => unknown;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  titleFr?: string;
  descriptionFr?: string;
  contenders: Contender[];
}

export const scenarios: Scenario[] = [
  {
    id: "A",
    title: "Simple literal (~5 string literals)",
    titleFr: "Littéral simple (~5 chaînes)",
    description:
      "Dispatch on a small set of string literals. Hoisted contenders pre-build their dispatcher; inline contenders rebuild on every call. ts-pattern has no hoist API, so only its inline form is measured.",
    descriptionFr:
      "Dispatch sur un petit ensemble de chaînes littérales. Les challengers hoistés pré-construisent leur dispatcher ; les inline reconstruisent à chaque appel. ts-pattern n'a pas d'API de hoist, donc seule sa forme inline est mesurée.",
    contenders: [
      {
        name: "native switch",
        fn: () => {
          const v = nextRole();
          switch (v) {
            case "admin":
              return "Admin";
            case "user":
              return "User";
            case "guest":
              return "Guest";
            case "moderator":
              return "Mod";
            default:
              return "Unknown";
          }
        },
      },
      {
        name: "matchigo compile() [hoisted]",
        fn: () => roleCompiledMg(nextRole()),
      },
      {
        name: "matchigo matcher() [hoisted]",
        fn: () => roleMatcherMg(nextRole()),
      },
      {
        name: "matchigo matcherWalk() [hoisted]",
        fn: () => roleMatcherWalkMg(nextRole()),
      },
      {
        name: "match-iz against() [hoisted]",
        fn: () => roleAgainstIz(nextRole()),
      },
      {
        name: "matchigo match(v, rules) [inline]",
        fn: () => mgMatch<string, string>(nextRole(), roleRulesMg as never),
      },
      {
        name: "ts-pattern [inline]",
        fn: () => {
          const v = nextRole();
          return tsMatch(v)
            .with("admin", () => "Admin")
            .with("user", () => "User")
            .with("guest", () => "Guest")
            .with("moderator", () => "Mod")
            .otherwise(() => "Unknown");
        },
      },
      {
        name: "match-iz match() [inline]",
        fn: () => {
          const v = nextRole();
          return izMatch(v)(
            izWhen("admin", "Admin"),
            izWhen("user", "User"),
            izWhen("guest", "Guest"),
            izWhen("moderator", "Mod"),
            izOther("Unknown"),
          );
        },
      },
    ],
  },
  {
    id: "B",
    title: "Alternatives (a|b|c per rule)",
    titleFr: "Alternatives (a|b|c par règle)",
    description:
      "Each rule accepts multiple values (P.union / array sugar). Same hoisted/inline split as A.",
    descriptionFr:
      "Chaque règle accepte plusieurs valeurs (P.union / sucre tableau). Même découpage hoisted/inline que A.",
    contenders: [
      {
        name: "matchigo compile() [hoisted]",
        fn: () => altCompiledMg(nextAlt()),
      },
      {
        name: "matchigo matcher() [hoisted]",
        fn: () => altMatcherMg(nextAlt()),
      },
      {
        name: "match-iz against() [hoisted]",
        fn: () => altAgainstIz(nextAlt()),
      },
      {
        name: "matchigo match(v, rules) [inline]",
        fn: () => mgMatch<string, string>(nextAlt(), altRulesMg as never),
      },
      {
        name: "ts-pattern [inline]",
        fn: () => {
          const v = nextAlt();
          return tsMatch(v)
            .with(TP.union("admin", "root", "superuser"), () => "Admin")
            .with(TP.union("user", "guest"), () => "User")
            .otherwise(() => "Unknown");
        },
      },
      {
        name: "match-iz match() [inline]",
        fn: () => {
          const v = nextAlt();
          return izMatch(v)(
            izWhen(["admin", "root", "superuser"], "Admin"),
            izWhen(["user", "guest"], "User"),
            izOther("Unknown"),
          );
        },
      },
    ],
  },
  {
    id: "C",
    title: "Guards (age buckets)",
    titleFr: "Guards (tranches d'âge)",
    description: "Predicate-based, order-sensitive matching (Senior → Adult → Young).",
    descriptionFr: "Matching par prédicat, sensible à l'ordre (Senior → Adult → Young).",
    contenders: [
      {
        name: "native if/else",
        fn: () => {
          const n = nextAge();
          if (n >= 65) return "Senior";
          if (n >= 18) return "Adult";
          return "Young";
        },
      },
      {
        name: "matchigo compile() [hoisted]",
        fn: () => ageCompiledMg(nextAge()),
      },
      {
        name: "matchigo matcher() [hoisted]",
        fn: () => ageMatcherMg(nextAge()),
      },
      {
        name: "match-iz against() [hoisted]",
        fn: () => ageAgainstIz(nextAge()),
      },
      {
        name: "matchigo match(v, rules) [inline]",
        fn: () => mgMatch<number, string>(nextAge(), ageRulesMg as never),
      },
      {
        name: "ts-pattern [inline]",
        fn: () => {
          const n = nextAge();
          return tsMatch(n)
            .when(
              (x) => x >= 65,
              () => "Senior",
            )
            .when(
              (x) => x >= 18,
              () => "Adult",
            )
            .otherwise(() => "Young");
        },
      },
      {
        name: "match-iz match() [inline]",
        fn: () => {
          const n = nextAge();
          return izMatch(n)(
            izWhen((x: number) => x >= 65, "Senior"),
            izWhen((x: number) => x >= 18, "Adult"),
            izOther("Young"),
          );
        },
      },
    ],
  },
  {
    id: "D",
    title: "Shape matching (discriminated union)",
    titleFr: "Shape matching (union discriminée)",
    description:
      "Rust-like algebraic types: dispatch on a `kind` field. Exhaustiveness is enforced at compile time for matchigo and ts-pattern.",
    descriptionFr:
      "Types algébriques à la Rust : dispatch sur un champ `kind`. L'exhaustivité est vérifiée à la compilation pour matchigo et ts-pattern.",
    contenders: [
      {
        name: "native switch on kind",
        fn: () => {
          const s = nextShape();
          switch (s.kind) {
            case "circle":
              return Math.PI * s.r ** 2;
            case "square":
              return s.s ** 2;
            case "tri":
              return 0.5 * s.a * s.b;
          }
        },
      },
      {
        name: "matchigo compile() [hoisted]",
        fn: () => shapeCompiledMg(nextShape()),
      },
      {
        name: "matchigo matcher().exhaustive() [hoisted]",
        fn: () => shapeMatcherMg(nextShape()),
      },
      {
        name: "match-iz against() [hoisted]",
        fn: () => shapeAgainstIz(nextShape()),
      },
      {
        name: "matchigo match(v, rules) [inline]",
        fn: () => mgMatch<Shape, number>(nextShape(), shapeRulesMg as never),
      },
      {
        name: "ts-pattern .exhaustive() [inline]",
        fn: () => {
          const s = nextShape();
          return tsMatch(s)
            .with({ kind: "circle" }, (c) => Math.PI * c.r ** 2)
            .with({ kind: "square" }, (q) => q.s ** 2)
            .with({ kind: "tri" }, (t) => 0.5 * t.a * t.b)
            .exhaustive();
        },
      },
      {
        name: "match-iz match() [inline]",
        fn: () => {
          const s = nextShape();
          return izMatch(s)(
            izWhen(
              { kind: "circle" },
              (c) => Math.PI * (c as { kind: "circle"; r: number }).r ** 2,
            ),
            izWhen({ kind: "square" }, (q) => (q as { kind: "square"; s: number }).s ** 2),
            izWhen({ kind: "tri" }, (t) => {
              const x = t as { kind: "tri"; a: number; b: number };
              return 0.5 * x.a * x.b;
            }),
          );
        },
      },
    ],
  },
  {
    id: "E",
    title: "Throughput: classify 100 items",
    titleFr: "Débit : classification de 100 éléments",
    description:
      "Map a matcher across an array. Throughput over per-call latency. Only the realistic hoisted form is shown for libs that support it.",
    descriptionFr:
      "Application d'un matcher sur un tableau. Débit plutôt que latence par appel. Seule la forme hoistée réaliste est montrée pour les libs qui la supportent.",
    contenders: [
      {
        name: "native map + ternary",
        fn: () => users.map((u) => (u.age >= 18 ? "Adult" : "Young")),
      },
      {
        name: "matchigo matcher() + map [hoisted]",
        fn: () => users.map((u) => userAgeMatcherMg(u)),
      },
      {
        name: "match-iz against() + map [hoisted]",
        fn: () => users.map((u) => userAgeAgainstIz(u)),
      },
      {
        name: "ts-pattern + map [inline]",
        fn: () =>
          users.map((u) =>
            tsMatch(u)
              .when(
                (x) => x.age >= 18,
                () => "Adult",
              )
              .otherwise(() => "Young"),
          ),
      },
      {
        name: "match-iz match() + map [inline]",
        fn: () =>
          users.map((u) =>
            izMatch(u)(
              izWhen((x: { age: number }) => x.age >= 18, "Adult"),
              izOther("Young"),
            ),
          ),
      },
    ],
  },
  {
    id: "F",
    title: "True cold path — rules rebuilt on every call",
    titleFr: "Vrai cold path — règles reconstruites à chaque appel",
    description:
      "The real worst case for matchigo: a fresh rules array / new matcher instance on every call, defeating the WeakMap cache. ts-pattern and match-iz inline() always pay this cost by design, so they appear unchanged. This isolates 'how much does matchigo's compile step cost when you can't amortise it?' from the dispatch cost.",
    descriptionFr:
      "Le vrai pire cas pour matchigo : tableau de règles frais / nouvelle instance de matcher à chaque appel, ce qui casse le cache WeakMap. ts-pattern et match-iz inline() paient toujours ce coût par design, donc ils sont inchangés. Ça isole « combien coûte l'étape de compile de matchigo quand on ne peut pas l'amortir ? » du coût de dispatch.",
    contenders: [
      {
        name: "native switch",
        fn: () => {
          const v = nextRole();
          switch (v) {
            case "admin":
              return "Admin";
            case "user":
              return "User";
            case "guest":
              return "Guest";
            case "moderator":
              return "Mod";
            default:
              return "Unknown";
          }
        },
      },
      {
        name: "matchigo match(v, rules) [cold, new array/call]",
        fn: () =>
          mgMatch<string, string>(nextRole(), [
            { with: "admin", then: "Admin" },
            { with: "user", then: "User" },
            { with: "guest", then: "Guest" },
            { with: "moderator", then: "Mod" },
            { otherwise: "Unknown" },
          ] as never),
      },
      {
        name: "matchigo matchWalk(v, rules) [cold, no compile]",
        fn: () =>
          mgMatchWalk<string, string>(nextRole(), [
            { with: "admin", then: "Admin" },
            { with: "user", then: "User" },
            { with: "guest", then: "Guest" },
            { with: "moderator", then: "Mod" },
            { otherwise: "Unknown" },
          ] as never),
      },
      {
        name: "matchigo compile() [cold, new fn/call]",
        fn: () => {
          const f = compile<string, string>([
            { with: "admin", then: "Admin" },
            { with: "user", then: "User" },
            { with: "guest", then: "Guest" },
            { with: "moderator", then: "Mod" },
            { otherwise: "Unknown" },
          ] as never);
          return f(nextRole());
        },
      },
      {
        name: "matchigo matcher() [cold, new builder/call]",
        fn: () => {
          const f = matcher<string, string>()
            .with("admin", "Admin")
            .with("user", "User")
            .with("guest", "Guest")
            .with("moderator", "Mod")
            .otherwise("Unknown");
          return f(nextRole());
        },
      },
      {
        name: "matchigo matcherWalk() [hoisted]",
        fn: () => roleMatcherWalkMg(nextRole()),
      },
      {
        name: "matchigo matcherWalk() [cold, new builder/call]",
        fn: () => {
          const f = matcherWalk<string, string>()
            .with("admin", "Admin")
            .with("user", "User")
            .with("guest", "Guest")
            .with("moderator", "Mod")
            .otherwise("Unknown");
          return f(nextRole());
        },
      },
      {
        name: "ts-pattern [inline]",
        fn: () => {
          const v = nextRole();
          return tsMatch(v)
            .with("admin", () => "Admin")
            .with("user", () => "User")
            .with("guest", () => "Guest")
            .with("moderator", () => "Mod")
            .otherwise(() => "Unknown");
        },
      },
      {
        name: "match-iz match() [inline]",
        fn: () => {
          const v = nextRole();
          return izMatch(v)(
            izWhen("admin", "Admin"),
            izWhen("user", "User"),
            izWhen("guest", "Guest"),
            izWhen("moderator", "Mod"),
            izOther("Unknown"),
          );
        },
      },
    ],
  },
  {
    id: "G",
    title: "Intersection stacking (refined number)",
    titleFr: "Empilement d'intersection (number raffiné)",
    description:
      "Stacks P.number & P.positive & P.integer & P.between(0, 100) to narrow a number through four chained refinements. ts-pattern uses P.intersection; match-iz falls back to a hand-written predicate.",
    descriptionFr:
      "Empile P.number & P.positive & P.integer & P.between(0, 100) pour raffiner un number via quatre étapes chaînées. ts-pattern utilise P.intersection ; match-iz retombe sur un prédicat écrit à la main.",
    contenders: [
      {
        name: "native predicate",
        fn: () => {
          const n = nextNum();
          if (typeof n === "number" && n > 0 && Number.isInteger(n) && n >= 0 && n <= 100) {
            return "ok";
          }
          if (typeof n === "number") return "num-reject";
          return "other";
        },
      },
      {
        name: "matchigo compile() [hoisted]",
        fn: () => intCompiledMg(nextNum()),
      },
      {
        name: "matchigo matcher() [hoisted]",
        fn: () => intMatcherMg(nextNum()),
      },
      {
        name: "match-iz against() [hoisted]",
        fn: () => intAgainstIz(nextNum()),
      },
      {
        name: "matchigo match(v, rules) [inline]",
        fn: () => mgMatch<number, string>(nextNum(), intRulesMg as never),
      },
      {
        name: "matchigo matchWalk(v, rules) [cold]",
        fn: () => mgMatchWalk<number, string>(nextNum(), intRulesMg as never),
      },
      {
        name: "ts-pattern [inline]",
        fn: () => {
          const n = nextNum();
          return tsMatch(n)
            .with(
              TP.intersection(
                TP.number,
                TP.number.positive(),
                TP.number.int(),
                TP.number.between(0, 100),
              ),
              () => "ok",
            )
            .with(TP.number, () => "num-reject")
            .otherwise(() => "other");
        },
      },
      {
        name: "match-iz match() [inline]",
        fn: () => {
          const n = nextNum();
          return izMatch(n)(
            izWhen(
              (x: number) =>
                typeof x === "number" && x > 0 && Number.isInteger(x) && x >= 0 && x <= 100,
              "ok",
            ),
            izWhen((x: number) => typeof x === "number", "num-reject"),
            izOther("other"),
          );
        },
      },
    ],
  },
  {
    id: "H",
    title: "Deeply nested shape (4 levels + discriminant)",
    titleFr: "Forme profondément imbriquée (4 niveaux + discriminant)",
    description:
      "Pattern walks four levels deep (kind → target → page → meta.verified). Tests the cost of recursive object traversal during dispatch.",
    descriptionFr:
      "Le pattern descend sur quatre niveaux (kind → target → page → meta.verified). Mesure le coût du parcours récursif d'objet pendant le dispatch.",
    contenders: [
      {
        name: "native if/else chain",
        fn: () => {
          const e = nextDeep();
          if (e.kind === "click" && e.target.page.meta.verified === true) return "click-verified";
          if (e.kind === "click" && e.target.page.meta.verified === false)
            return "click-unverified";
          if (e.kind === "hover") return "hover";
          return "other";
        },
      },
      {
        name: "matchigo compile() [hoisted]",
        fn: () => deepCompiledMg(nextDeep()),
      },
      {
        name: "matchigo matcher() [hoisted]",
        fn: () => deepMatcherMg(nextDeep()),
      },
      {
        name: "match-iz against() [hoisted]",
        fn: () => deepAgainstIz(nextDeep()),
      },
      {
        name: "matchigo match(v, rules) [inline]",
        fn: () => mgMatch<DeepEvent, string>(nextDeep(), deepRulesMg as never),
      },
      {
        name: "matchigo matchWalk(v, rules) [cold]",
        fn: () => mgMatchWalk<DeepEvent, string>(nextDeep(), deepRulesMg as never),
      },
      {
        name: "ts-pattern [inline]",
        fn: () => {
          const e = nextDeep();
          return tsMatch(e)
            .with(
              {
                kind: "click",
                target: { page: { meta: { verified: true } } },
              },
              () => "click-verified",
            )
            .with(
              {
                kind: "click",
                target: { page: { meta: { verified: false } } },
              },
              () => "click-unverified",
            )
            .with({ kind: "hover" }, () => "hover")
            .otherwise(() => "other");
        },
      },
      {
        name: "match-iz match() [inline]",
        fn: () => {
          const e = nextDeep();
          return izMatch(e)(
            izWhen(
              { kind: "click", target: { page: { meta: { verified: true } } } },
              () => "click-verified",
            ),
            izWhen(
              { kind: "click", target: { page: { meta: { verified: false } } } },
              () => "click-unverified",
            ),
            izWhen({ kind: "hover" }, () => "hover"),
            izOther("other"),
          );
        },
      },
    ],
  },
  {
    id: "I",
    title: "String refinements (regex + includes + length)",
    titleFr: "Raffinements de chaîne (regex + includes + length)",
    description:
      "Five ordered rules that mix P.regex, P.includesStr, P.minLengthStr and P.lengthStr. Exercises the string-refinement family added in this release.",
    descriptionFr:
      "Cinq règles ordonnées qui mélangent P.regex, P.includesStr, P.minLengthStr et P.lengthStr. Exerce la famille de raffinements de chaîne ajoutée dans cette release.",
    contenders: [
      {
        name: "native if/else chain",
        fn: () => {
          const s = nextStr();
          if (userRe.test(s)) return "user-id";
          if (orderRe.test(s)) return "order-id";
          if (s.includes("@")) return "email-ish";
          if (s.length >= 20) return "long";
          if (s.length === 0) return "empty";
          return "other";
        },
      },
      {
        name: "matchigo compile() [hoisted]",
        fn: () => strCompiledMg(nextStr()),
      },
      {
        name: "matchigo matcher() [hoisted]",
        fn: () => strMatcherMg(nextStr()),
      },
      {
        name: "match-iz against() [hoisted]",
        fn: () => strAgainstIz(nextStr()),
      },
      {
        name: "matchigo match(v, rules) [inline]",
        fn: () => mgMatch<string, string>(nextStr(), strRulesMg as never),
      },
      {
        name: "matchigo matchWalk(v, rules) [cold]",
        fn: () => mgMatchWalk<string, string>(nextStr(), strRulesMg as never),
      },
      {
        name: "ts-pattern [inline]",
        fn: () => {
          const s = nextStr();
          return tsMatch(s)
            .with(TP.string.regex(userRe), () => "user-id")
            .with(TP.string.regex(orderRe), () => "order-id")
            .with(TP.string.includes("@"), () => "email-ish")
            .with(TP.string.minLength(20), () => "long")
            .with(TP.string.length(0), () => "empty")
            .otherwise(() => "other");
        },
      },
      {
        name: "match-iz match() [inline]",
        fn: () => {
          const s = nextStr();
          return izMatch(s)(
            izWhen((x: string) => userRe.test(x), "user-id"),
            izWhen((x: string) => orderRe.test(x), "order-id"),
            izWhen((x: string) => x.includes("@"), "email-ish"),
            izWhen((x: string) => x.length >= 20, "long"),
            izWhen((x: string) => x.length === 0, "empty"),
            izOther("other"),
          );
        },
      },
    ],
  },
  {
    id: "J",
    title: "Negation (P.not on mixed domain)",
    titleFr: "Négation (P.not sur domaine mixte)",
    description:
      "Single-rule dispatch of P.not(P.nullish) over a mixed-type stream. Measures the cost of a negated refinement compared to a raw `!= null` check.",
    descriptionFr:
      "Dispatch à règle unique de P.not(P.nullish) sur un flux de types mélangés. Mesure le coût d'un raffinement négué comparé à un simple `!= null`.",
    contenders: [
      {
        name: "native != null",
        fn: () => (nextMixed() != null ? "defined" : "null"),
      },
      {
        name: "matchigo compile() [hoisted]",
        fn: () => notCompiledMg(nextMixed()),
      },
      {
        name: "matchigo matcher() [hoisted]",
        fn: () => notMatcherMg(nextMixed()),
      },
      {
        name: "match-iz against() [hoisted]",
        fn: () => notAgainstIz(nextMixed()),
      },
      {
        name: "matchigo match(v, rules) [inline]",
        fn: () => mgMatch<unknown, string>(nextMixed(), notRulesMg as never),
      },
      {
        name: "matchigo matchWalk(v, rules) [cold]",
        fn: () => mgMatchWalk<unknown, string>(nextMixed(), notRulesMg as never),
      },
      {
        name: "ts-pattern [inline]",
        fn: () => {
          const v = nextMixed();
          return tsMatch(v)
            .with(TP.not(TP.nullish), () => "defined")
            .otherwise(() => "null");
        },
      },
      {
        name: "match-iz match() [inline]",
        fn: () => {
          const v = nextMixed();
          return izMatch(v)(
            izWhen((x: unknown) => x != null, "defined"),
            izOther("null"),
          );
        },
      },
    ],
  },
];
