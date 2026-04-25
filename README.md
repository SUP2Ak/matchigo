# matchigo

> Fast, data-driven pattern matching for TypeScript — Rust-like, lazy-compiled, type-safe exhaustiveness.

[![npm](https://img.shields.io/npm/v/matchigo.svg)](https://www.npmjs.com/package/matchigo)
[![downloads](https://img.shields.io/npm/dw/matchigo.svg)](https://www.npmjs.com/package/matchigo)
[![bundle size](https://img.shields.io/bundlephobia/minzip/matchigo.svg)](https://bundlephobia.com/package/matchigo)
[![CI](https://github.com/SUP2Ak/matchigo/actions/workflows/ci.yml/badge.svg)](https://github.com/SUP2Ak/matchigo/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/npm/l/matchigo.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-%3E%3D5.4-blue.svg)](https://www.typescriptlang.org/)

> _Version française : [README.fr.md](./README.fr.md)_

```ts
import { P, matcher } from "matchigo";

type Shape =
  | { kind: "circle"; r: number }
  | { kind: "square"; s: number }
  | { kind: "tri";    a: number; b: number };

const area = matcher<Shape, number>()
  .with({ kind: "circle" }, (s) => Math.PI * s.r ** 2)
  .with({ kind: "square" }, (s) => s.s ** 2)
  .with({ kind: "tri"    }, (s) => 0.5 * s.a * s.b)
  .exhaustive();                       // compile-time exhaustiveness

area({ kind: "circle", r: 2 });        // 12.566…
```

## Why matchigo?

matchigo has a **smaller surface than ts-pattern** and a **bigger API than match-iz**. Where features overlap, matchigo compiles rules up-front so the hot path stays close to native `switch`.

| | matchigo | ts-pattern | match-iz |
| :--- | :---: | :---: | :---: |
| Chained API (`.with(...).exhaustive()`)        | ✅ | ✅ | ❌ |
| Data-driven API (`match(v, rules)`)            | ✅ | ❌ | ✅ |
| Compile-time exhaustiveness                    | ✅ | ✅ | ❌ |
| Pre-compiled hot path (`compile()` / cached builder) | ✅ | ❌ | ✅ (`against()`) |
| O(1) literal Map dispatch                      | ✅ | ❌ | ❌ |
| Dev-time mis-use warnings                      | ✅ | ❌ | ❌ |

**Bottom line on measured overlap** — on its hot path, matchigo is ~2× native `switch` on simple literals, **3.8×–90× faster than ts-pattern**, **~5×–30× faster than match-iz** across the nine single-dispatch scenarios we bench (see [Benchmarks](#benchmarks) for the table). On a _true cold path_ (rules rebuilt every call), matchigo ships a dedicated [`matchWalk()`](#matchwalk-for-true-cold-paths) that's ~**4× faster than ts-pattern inline** — so matchigo wins in both regimes, provided you pick the right entry point. See also [compared to ts-pattern](#compared-to-ts-pattern) for the feature-parity picture.

## Do you even need a pattern matching library?

Maybe not — and that's fine. A match lib is a nice abstraction but concretely it's **a dependency, a learning curve, and a bus-factor risk**. That's why `native switch` / `native if/else` appear in every benchmark here: you deserve to see the real baseline before adding a new mental model to your project.

**Start here: can you refactor without a lib?** Most "ugly switch with nested if/else" problems are actually "this function does too much" problems. Extract the handlers, use early returns, and the switch regains its dignity:

```ts
// ❌ Before
switch (event.kind) {
  case "click":
    if (event.target.verified) {
      if (event.target.path.startsWith("/admin")) { /* 20 lines */ }
      else                                        { /* 15 lines */ }
    }
    break;
}

// ✅ After — zero dep, zero learning, zero ns lost
function handleClick(e: ClickEvent) {
  if (!e.target.verified)                 return handleUnverified(e);
  if (e.target.path.startsWith("/admin")) return handleAdminClick(e);
  return handleRegularClick(e);
}
switch (event.kind) {
  case "click":  return handleClick(event);
  case "hover":  return handleHover(event);
}
```

If this solves your readability problem, **stop here**. No lib needed, and native dispatch is ~100× faster than any pattern matching library anyway.

### When a pattern matching lib is worth it

- **Compile-time exhaustiveness** — a typed guarantee that every variant is handled, enforced by CI as your types evolve.
- **Destructuring + narrowing in one step** — `{ kind: "user", age: P.select(P.gte(18)) }` reads better than nested guards.
- **Data-driven dispatch** — rules from config, DB, or user input. Not doable cleanly with `switch`.
- **Nested shape matching** — 3+ levels of discriminant traversal gets painful in pure `if/else`.

If none of those apply, native is probably still your friend.

### When matchigo is the right pick over ts-pattern

ts-pattern is the sensible default for most projects — mature, widely known, excellent docs, huge community. Reach for matchigo specifically when:

- **You're building a rules engine or data-driven router** — `match(value, rules)` / `compile(rules)` exist for exactly this. ts-pattern has no hoist API.
- **You profiled your backend and dispatch is actually costing CPU** — hot endpoints, small servers (edge workers, t3.micro, tight containers), complex patterns (intersection, deep nested). Measured gap is 3.8×–89× on the scenarios we bench.
- **You want a cold-path-safe chained API** — `matcherWalk()` is ~6× faster than `matcher()` rebuilt-per-call. ts-pattern has no equivalent.

Otherwise, **ts-pattern is fine, and switching is cheap**. Don't pre-optimise for imagined load — swap to matchigo later in a couple of days if you measure a real bottleneck.

### Happy to be wrong

If any of the above is misleading for your use case, or you think I'm overstating / understating something, open an issue or a discussion. I'd rather correct the README than sound right. Experience reports ("I tried X for Y, it went badly / well because Z") are especially welcome — they make this doc better for the next reader.

## Install

```sh
bun add matchigo
# or
npm i matchigo
# or
pnpm add matchigo
```

Requires TypeScript **≥ 5.4** (developed & tested against TS 6.0). Zero runtime dependencies.

## Two APIs, one engine

matchigo ships both a **chained** (`matcher()`) and a **data-driven** (`match()` / `compile()`) API. They share the same compiler — pick whichever reads better for your code.

### Chained — expressive, exhaustive

```ts
import { P, matcher } from "matchigo";

type Role = "admin" | "user" | "guest";

const label = matcher<Role, string>()
  .with("admin", () => "A")
  .with("user",  () => "U")
  .with("guest", () => "G")
  .exhaustive();                // TS error if a variant is missing
```

### Data-driven — declarative, portable

```ts
import { P, compile } from "matchigo";

const label = compile<Role, string>([
  { with: "admin", then: "A" },
  { with: "user",  then: "U" },
  { with: "guest", then: "G" },
]);

label("admin"); // "A"
```

`compile()` returns a reusable function. `match(value, rules)` is a one-shot convenience with an internal cache keyed on the `rules` array identity.

### `matchWalk()` — for true cold paths

`match()` / `compile()` / `matcher()` compile once, dispatch cheap — great when you can reuse the rules. When you really can't (rules derived from request input, generated per call, etc.), use `matchWalk()` instead:

```ts
import { P, matchWalk } from "matchigo";

function classify(role: string, banned: Set<string>) {
  return matchWalk<string, string>(role, [
    { with: P.when((r) => banned.has(r)), then: "Banned" },
    { with: "admin", then: "Admin" },
    { otherwise: "Other" },
  ]);
}
```

`matchWalk` skips compilation entirely: it walks the pattern tree with zero allocation per call. Same semantics as `match()` — same rules shape, same `P.*` support, same `P.select`. On a true cold path it's ~4× faster than ts-pattern; when you can hoist, `match()` / `compile()` / `matcher()` are still faster. Pick the tool matching your use case.

Prefer the chained style? `matcherWalk()` is the chained sibling — same API surface as `matcher()`, but dispatches through `matchWalk` so there's no compile step:

```ts
import { P, matcherWalk } from "matchigo";

function classify(role: string, banned: Set<string>) {
  return matcherWalk<string, string>()
    .with(P.when((r) => banned.has(r)), "Banned")
    .with("admin", "Admin")
    .otherwise("Other")(role);
}
```

On a cold path `matcherWalk()` lands at ~**45 ns** (new builder per call) vs ~270 ns for `matcher()` cold — ~6× faster. When hoisted it lands at ~**14 ns** on a 5-literal dispatch, still ~2× slower than the compile-path `matcher()` because it does a tree walk on every call (no O(1) Map). Use it when you want the chained API AND the cold-path behaviour; use `matcher()` when you can hoist and dispatch is on the hot path.

## Features

### Primitives

```ts
P.string  P.number  P.boolean  P.bigint  P.symbol  P.function
P.nullish       // null | undefined
P.defined       // everything except null/undefined
P.nonNullable   // alias of P.defined (ts-pattern parity)
P.any           // always matches
```

### Combinators

```ts
P.union("a", "b", "c")      // any of
P.not(P.nullish)            // negate
P.optional(P.string)        // P.string | undefined
P.intersection(P.number, P.positive, P.integer)
P.when((v) => v.length > 0) // free-form predicate
```

### Instance checks

```ts
P.instanceOf(Date)
P.instanceOf(Error)
```

### String refinements

```ts
P.regex(/^user-\d+$/)
P.startsWithStr("admin:")
P.endsWithStr(".json")
P.includesStr("@")                      // substring match
P.minLengthStr(3)                       // v.length >= 3
P.maxLengthStr(10)                      // v.length <= 10
P.lengthStr(5)                          // v.length === 5
```

### Number refinements

```ts
P.between(0, 10)    P.gt(0)    P.gte(0)    P.lt(100)    P.lte(100)
P.positive          P.negative
P.integer           P.finite
```

### Bigint refinements

```ts
P.bigintGt(0n)      P.bigintGte(0n)     P.bigintLt(100n)    P.bigintLte(100n)
P.bigintBetween(0n, 100n)
P.bigintPositive    P.bigintNegative
```

### Array patterns

```ts
P.array(P.number)                       // every item is a number
P.arrayOf(P.string, { min: 1, max: 5 }) // length-constrained
P.arrayIncludes(P.number)               // at least one item matches
P.tuple(P.number, P.string)             // exact length + per-slot
P.startsWith(1, 2)                      // prefix match
P.endsWith(9)                           // suffix match
```

### Map & Set patterns

```ts
P.map(P.string, P.number)   // Map where every key matches P.string and value matches P.number
P.set(P.string)             // Set where every item matches P.string
```

Both match when **every** entry/item satisfies the inner pattern (same semantics as ts-pattern).

### Shape matching (Rust-like)

```ts
match<U, string>(user, [
  { with: { profile: { verified: true } }, then: "ok" },
  { otherwise: "no" },
]);
```

### Guards

```ts
// Chained — 3-arg overload, guard does not narrow
matcher<number, string>()
  .with(P.number, (n) => n >= 65, "Senior")
  .with(P.number, (n) => n >= 18, "Adult")
  .otherwise("Young");

// Data-driven — explicit `when`
match<number, string>(n, [
  { with: P.number, when: (n) => n >= 65, then: "Senior" },
  { with: P.number, when: (n) => n >= 18, then: "Adult" },
  { otherwise: "Young" },
]);
```

### `P.select` — extract matched values

```ts
// single unlabeled select — passed as the handler argument
match<User, string>(user, [
  {
    with: { kind: "user", name: P.select() },
    then: (name: string) => `hi ${name}`,
  },
  { otherwise: "?" },
]);

// multiple labeled selects — passed as an object
match<User, string>(user, [
  {
    with: { name: P.select("n"), age: P.select("a") },
    then: ({ n, a }: { n: string; a: number }) => `${n}-${a}`,
  },
  { otherwise: "?" },
]);

// select + refine in one step — the pattern both constrains the match
// and narrows the type of the extracted value
match<User, string>(user, [
  {
    with: { age: P.select(P.number) },         // anonymous, refined to number
    then: (age: number) => `${age}y`,
  },
  {
    with: { tags: P.select("t", P.array(P.string)) },  // labeled + refined
    then: ({ t }: { t: string[] }) => t.join(","),
  },
  { otherwise: "?" },
]);
```

### `isMatching` — standalone predicate

```ts
import { P, isMatching } from "matchigo";

const isAdult = (v: unknown) => isMatching({ age: P.gte(18) }, v);

users.filter(isAdult);
```

Same pattern language as `match()` — no handler, no extraction, no throw. Useful inside `.filter`, `.some`, type guards, etc. For hot filters, compile a one-rule matcher instead (it's faster because the pattern is pre-classified).

### Exhaustiveness (type-level)

```ts
type Shape = { kind: "circle" } | { kind: "square" };

const f = matcher<Shape, number>()
  .with({ kind: "circle" }, () => 1)
  .exhaustive();  // ❌ compile error: non-exhaustive, missing { kind: "square" }
```

If a variant is missing, `.exhaustive()` returns an `ExhaustiveError<Rem>` type (not a function) — so calling it fails at the call site, not at runtime.

## Using matchigo in JSX / UI code

matchigo is a natural fit for rendering discriminated-union state (loading / error / ok, auth states, wizard steps). No special entry point — the regular API works, with one caveat: **don't use `match(value, rules)` inline in a render body**. The rules array is re-allocated on every render, which misses the compile cache. Either hoist the matcher at module scope, or use `matchWalk` for the inline case. Handlers stay as functions so JSX is only built for the branch that actually matches.

**Best — hoist at module scope** (compile-time exhaustiveness, O(1) literal dispatch when applicable):

```tsx
type Load<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: T };

const renderLoad = matcher<Load<User[]>, JSX.Element>()
  .with({ status: "idle" }, () => <EmptyState />)
  .with({ status: "loading" }, () => <Spinner />)
  .with({ status: "error" }, ({ message }) => <ErrorPanel msg={message} />)
  .with({ status: "ok" }, ({ data }) => <List items={data} />)
  .exhaustive();

function UserList({ state }: { state: Load<User[]> }) {
  return renderLoad(state);
}
```

**If you really need the rules inline** (one-off render, rules computed from props, etc.) — use `matchWalk`, which is designed for this cold path:

```tsx
function UserList({ state }: { state: Load<User[]> }) {
  return matchWalk(state, [
    [{ status: "idle" }, () => <EmptyState />],
    [{ status: "loading" }, () => <Spinner />],
    [{ status: "error" }, ({ message }) => <ErrorPanel msg={message} />],
    [{ status: "ok" }, ({ data }) => <List items={data} />],
  ]);
}
```

Don't use `match(state, [...])` inline in a component body — that's the [cold-path anti-pattern](#anti-patterns). The dev-mode warning will flag it.

> **Why `() => <X/>` and not `<X/>` directly?** JSX is eager — `<Spinner/>` is compiled to a `jsx("Spinner", {})` call that allocates a VNode immediately. If the handler were the bare element, every branch's element would be allocated on every render, including unused ones. The `() =>` thunk defers that allocation to the matched branch only. It's 3 characters of lazy evaluation, not a papercut. This is why matchigo doesn't ship a "value handler" variant — see the [FAQ entry](./FAQ.md#why-no-value-handlers-jsx-spinner--directly) for details.

Works the same for Vue render functions, Svelte component props, Solid, Preact, etc.

## Performance

### Why it's fast

1. **Patterns compile once.** `matcher()` and `compile()` walk your rules, classify each pattern (literal vs. sentinel vs. shape vs. guard), and build a specialized dispatcher. Subsequent calls are pure table/branch work.
2. **O(1) literal fast path.** When *every* `with` is a literal (or an array of literals) with no guard or `select`, the compiler emits a `Map<value, result>` lookup. No pattern traversal. No function calls.
3. **`select` paths are pre-baked.** We walk the pattern tree once to collect every `P.select()` position, then at call time we just `readPath(value, path)` — no tree re-walk per call.
4. **Lazy compile.** The chained builder defers compilation until the first call, so building a matcher is effectively free; the cost is amortized over actual usage.
5. **No proxies, no classes in the hot path.** Patterns are plain `{ [Symbol]: tag, …data }` objects. The compiler consumes them and discards them.

### Dev-mode warnings

matchigo emits a `console.warn` **once** when it detects misuse that defeats caching:
- Reconstructing `rules` on every `match(value, rules)` call (the "cold-path inline" anti-pattern).
- Creating thousands of distinct `matcher()` instances (usually means the builder is inside a hot loop).

Warnings are controlled by `NODE_ENV` (`production`/`prod` disables them). The check happens once at module load, so **production has zero cost** — no env reads, no counters, no string formatting.

```ts
import { silenceWarnings } from "matchigo";
silenceWarnings(); // disable programmatically
```

## Benchmarks

Measured with [mitata](https://github.com/evanwashere/mitata). Each contender is tagged `[hoisted]` (built once, reused — the realistic usage) or `[inline]` (rebuilt every call — the anti-pattern, still measured for honesty). ts-pattern has no hoist API by design, so it's inline-only.

Full per-scenario tables are auto-generated and live alongside the bench code so they stay in sync with the numbers:

- [`bench/bench-report.bun.md`](./bench/bench-report.bun.md) — Bun run (EN)
- [`bench/bench-report.bun.fr.md`](./bench/bench-report.bun.fr.md) — Bun run (FR)

Reproduce locally:

```sh
bun run bench          # Bun
bun run bench:node     # Node ≥ 22 with --experimental-strip-types
bun run bench:deno     # Deno
```

Each runtime produces its own `bench-report.<runtime>.md` and `bench-report.<runtime>.fr.md`.

## Compared to ts-pattern

matchigo is not a drop-in replacement for ts-pattern. ts-pattern is the reference for breadth; matchigo is the narrower, faster core. Being honest about the gap is the whole point — "we're faster" would be a hollow claim if we simply did less.

### What matchigo has that ts-pattern doesn't

- **`compile(rules)`** — pre-compile a rules array into a reusable function. ts-pattern is inline-only; the matcher closure is reconstructed on every call site.
- **`match(value, rules)`** — data-driven entry point with identity-keyed rule caching. Useful when rules come from data (config, tables, generators).
- **`matchWalk(value, rules)`** — dedicated cold-path entry point that skips compilation entirely. ~4× faster than ts-pattern inline on a 5-literal dispatch.
- **O(1) literal Map dispatch** — when every `with` is a literal (or literal array) with no guard/select, the compiler emits a `Map<value, result>` lookup instead of a branch chain.
- **Array-as-union sugar** — `.with(["admin","root"], ...)` is shorthand for `P.union("admin","root")`.
- **Dev-time misuse warnings** — one-shot warn when you defeat caching (rebuilding rules in a loop, creating matchers per call). Zero production cost when `NODE_ENV=production`.

### What ts-pattern has that matchigo doesn't

- **Chainable string/number builders** — `P.string.minLength(3).maxLength(10)` / `P.number.positive().int()`. Ergonomic sugar I haven't ported. Equivalent in matchigo: `P.intersection(P.minLengthStr(3), P.maxLengthStr(10))`, `P.intersection(P.positive, P.integer)`.
- **`P.record(keyPattern, valuePattern)`** — "any object whose values all match pattern P". Useful for `Record<string, User>`-style freeform dicts. Not shipped in matchigo yet; workaround is a `P.when(obj => Object.values(obj).every(...))` guard.
- **Variadic tuple patterns (`...P.array(P.number)`)** — patterns like `[P.string, ...P.array(P.number), P.string]`. ts-pattern handles the middle-variadic shape; matchigo doesn't. If you need this, ts-pattern is the fit.

### What `match-iz` has that matchigo doesn't (and won't)

- **`rest()` destructuring** — capturing "all the other keys" of an object or tail of an array. Nice in JS-idiomatic FP code, but allocates a new object/array on every dispatch — kills the fast path. **Intentional non-goal.**
- **Value handlers (`.with(pattern, <Spinner/>)`)** — returning a pre-built React/Vue/Svelte element instead of a function. Looks ergonomic but forces **eager evaluation** of every branch's element on every call, even unused ones. matchigo's `() => <Spinner/>` is strictly better: it's a lazy thunk. **Intentional non-goal.** See the [FAQ](./FAQ.md#why-no-value-handlers-jsx-spinner--directly) for the perf trace.

That's the whole list of real gaps. Everything else ts-pattern offers — `P.map`, `P.set`, string-length refinements, bigint refinements, `P.array.includes`, `P.nonNullable`, `isMatching`, `P.select(subPattern)` — is supported.

### What's equivalent

- **Exhaustiveness** — both use `Exclude`-style type subtraction; matchigo's `DeepExclude` distributes multi-key unions the same way ts-pattern's does.
- **`P.select()`** — matchigo supports every ts-pattern signature: `P.select()`, `P.select("name")`, `P.select(subPattern)`, `P.select("name", subPattern)`. Different internals (matchigo pre-bakes paths; ts-pattern uses a symbol + record walker), identical call surface.
- **`isMatching`** — standalone predicate, same signature as ts-pattern.
- **Primitive guards** (`P.string`, `P.number`, `P.bigint`, …), **combinators** (`P.union`, `P.not`, `P.optional`, `P.intersection`), **instance checks**, **tuple/array/Map/Set patterns**, **string/number/bigint refinements**.

The deliberate gaps are the chainable builder, `P.record`, and variadic-middle tuples — everything else is at parity or faster. The win is real only because I stayed narrow.

## Anti-patterns

**Don't rebuild rules on every call of `match()`.** `match()` caches compiled rules on the `rules` array identity. A new array every call → cache miss → full re-compile → ~90× native `switch` and slower than ts-pattern inline. You have two good options: hoist the rules, or switch to `matchWalk()`. Dev-mode warnings flag this pattern when they can.

```ts
// ❌ Cold path — new rules array on every call, cache miss, full re-compile
function classify(v: string) {
  return match<string, string>(v, [
    { with: "admin", then: "A" },
    { otherwise: "X" },
  ]);
}

// ✅ Option 1 — hoist and compile (fastest when reused)
const classify = compile<string, string>([
  { with: "admin", then: "A" },
  { otherwise: "X" },
]);

// ✅ Option 2 — data-driven cold-path entry point (when you genuinely can't hoist)
function classify(v: string) {
  return matchWalk<string, string>(v, [
    { with: "admin", then: "A" },
    { otherwise: "X" },
  ]);
}

// ✅ Option 3 — chained cold-path entry point (same idea, chained API)
function classify(v: string) {
  return matcherWalk<string, string>()
    .with("admin", "A")
    .otherwise("X")(v);
}
```

The builder version has the same issue inside a hot loop:

```ts
// ❌
items.map((v) =>
  matcher<string, string>().with("a", "A").otherwise("?")(v)
);

// ✅
const f = matcher<string, string>().with("a", "A").otherwise("?");
items.map(f);
```

## API reference

### `match<T, R>(value, rules): R`
Data-driven one-shot match. Rules are cached by array identity via `WeakMap` — safe to call with the same `rules` repeatedly. Uses the compile path (`matcher()` / `compile()` share the same engine).

### `matchWalk<T, R>(value, rules): R`
Cold-path sibling of `match()`. Walks the pattern tree on every call with zero allocation — no compile, no cache. Use when rules are genuinely rebuilt per call. Slower than `match()` when rules are hoisted; faster than every other library in inline form.

### `compile<T, R>(rules): CompiledFn<T, R>`
Compile rules up-front. Returns a reusable function with `.run(value)` as an alias.

### `matcher<T, R>(): Matcher<T, R>`
Chained builder. `.with(pattern, then)` or `.with(pattern, guard, then)`. Terminate with `.otherwise(result)` or `.exhaustive()`.

### `matcherWalk<T, R>(): Matcher<T, R>`
Chained sibling of `matcher()` that dispatches through `matchWalk` — no compile step, no cache. Same `.with` / `.otherwise` / `.exhaustive` surface. Use when you want the chained API on a cold path. Slightly slower than `matcher()` when hoisted (walks on every call); much faster when the builder is rebuilt per call (~6× vs `matcher()` cold).

### `silenceWarnings(): void`
Disables dev-time warnings for the current process.

### Type exports
`Pattern`, `Rule`, `NarrowedBy`, `InferPattern`, `CompiledFn`, `ExhaustiveError`, `Matcher`.

### Full reference
The complete auto-generated API reference (every export, every signature, every type parameter) lives at **https://sup2ak.github.io/matchigo/** — built from the source via TypeDoc and redeployed on every push to `main`. Use it if you need the exact shape of a type like `NarrowedBy<T, Pat>` or `Matcher<T, R>` without reading the source.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR — PRs must be in English, scoped to a single feature/fix, and must pass `format:check`, `typecheck`, and `test` locally. The repo uses Bun as its package manager; other lockfiles are rejected in CI.

## License

MIT
