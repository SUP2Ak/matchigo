# FAQ — matchigo

> _Version française : [FAQ.fr.md](./FAQ.fr.md)_

Pre-answered critiques and common questions about the design, benchmarks, and trade-offs. If something here is wrong or unfair, open an issue — I'd rather fix it than be defended by a stale doc.

---

## Benchmarks

### "You only win because you cache. Cache ts-pattern too and your gap disappears."

Short answer: **you can't cache ts-pattern the way you cache matchigo**, because its API doesn't let you.

ts-pattern's entry point is `match(value).with(...).otherwise(...)`. The **value is bound first** — before any rule is defined. That means every call site constructs a fresh chain of closures around that specific value. There's no "rules object" to extract, no compile step to hoist, no function to pre-build and reuse. The matcher and the input are fused by design.

matchigo is the opposite: `compile(rules)` returns a plain function that takes the value. Rules live independently of any specific input, so they can be built once at module load and called millions of times. This is not a "caching trick" layered on top — it's the whole architecture. ts-pattern could add a similar API, but it would be a different library.

For completeness, the bench also runs matchigo in fully **inline mode** (rules rebuilt every call — the anti-pattern it warns about). Even there, matchigo is faster than ts-pattern on every scenario because the pattern-walking code is simpler and allocation is lower. And `matchWalk()` is a dedicated cold-path entry that does zero caching by design — still ~4× faster than ts-pattern inline.

So the honest statement is: matchigo's hoisted wins come partly from caching, but the **inline-vs-inline comparison is also a matchigo win**. See scenario F in the bench — that row is the apples-to-apples one for this critique.

### "Micro-benchmarks are meaningless. A real app will never notice."

Largely true, and the README says so up front: if you're not CPU-bound on dispatch, native `switch` is fine and any match lib (ts-pattern included) is fine. The scenarios here exist to answer a narrower question: _when dispatch does show up on a flame graph, what's the fastest option?_ For most apps, the answer doesn't matter. For edge workers, hot inner loops, request routers, and small VPS backends, it sometimes does.

### "Your scenarios are cherry-picked to make matchigo look good."

The spread (3.8×–89×) is itself the evidence against cherry-picking — if the bench was tuned, you'd expect a tight cluster of "matchigo wins by 20×". The low end is simple literal dispatch where ts-pattern is close enough to not matter in practice. The high end is intersection stacking and nested shapes, where ts-pattern's closure-per-rule style compounds badly.

Every scenario's code is in [`bench/scenarios.ts`](./bench/scenarios.ts). If you think a scenario is unrealistic (e.g. too many rules, unrealistic data shape), open an issue with a scenario you think would be fairer and I'll add it to the suite.

### "You're using mitata wrong / ns numbers are noise."

mitata's `measure()` is used with `min_cpu_time: 250ms` per contender, 4 warmup iterations, and 12–128 samples. The runner also does 200 hand-warmup iterations before measurement to get the JIT out of the baseline tier. Reported numbers are `avg` (not `min`) across samples. If that's still too noisy for your taste, the raw `p50`/`p99` is in [`bench/bench-report.bun.md`](./bench/bench-report.bun.md) — the spread within scenarios is consistent with the effect size being real.

### "Did you run the benchmarks on Node and Deno too?"

Currently only Bun 1.2 numbers are published in the README. The bench runner detects the runtime and writes a separate report file (`bench-report.{bun,node,deno}.md`). Running on Node and Deno is on the list — PRs welcome if you want to submit numbers for another runtime.

### "`match-iz` is further behind than I'd expect. Are you using it wrong?"

Both entry points are measured: `against(handlers)` (the hoisted/pre-compiled form) and `match(value, handlers)` (the inline form). `against()` is the right way to use match-iz on a hot path and is what the "[hoisted]" rows represent. The gap is real — match-iz's handler style allocates more per rule and does more runtime introspection. It's not a bug in how the bench calls it.

---

## Design choices

### "Why not fork ts-pattern and add `compile()`?"

Because the thing that makes ts-pattern ergonomic — value-first chained API — is the same thing that prevents compilation. Hoisting rules requires the rules to exist as data independent of any specific value. ts-pattern's chain is built _around_ the value. Adding a compile step would require a parallel API shaped like matchigo's, which is what matchigo already is.

### "Why both `match()` and `matcher()`?"

They're the same engine with different ergonomics.

- `match(value, rules)` — data-driven. Rules are a plain array. Good when rules come from config, a table, or generated code.
- `matcher()` — chained. Better type inference for exhaustiveness and select, reads closer to `switch`. Good when rules are static at the call site.

Under the hood, both share the same compile path and the same dispatcher classes. Picking between them is a style choice, not a perf choice.

### "Why a separate `matchWalk()` instead of making `match()` auto-detect?"

Because the "should I compile?" heuristic is genuinely hard to get right at runtime, and getting it wrong is expensive either way:

- Compile too eagerly → cold-path callers pay the compile cost on every first call.
- Compile too lazily → hot-path callers do the tree walk forever.

Splitting the APIs makes the decision explicit: if you _know_ your rules are cold (rebuilt per call), pick `matchWalk`. If you _know_ they're hot (module-level or cached), pick `match` / `compile`. The dev-mode warning catches the common mistake (calling `match` with inline rules), which covers the accidental cold case. Making the library guess would add overhead to both paths.

### "Why do the dev warnings exist? Isn't that just shaming users?"

Because the single most common perf mistake with any matcher library is rebuilding rules per call, and the failure mode is silent — your code works, it's just 10–50× slower than it should be. The warning fires **once per call site, dev-only, and can be silenced** with `silenceWarnings()`. In production (`NODE_ENV=production`) it's a no-op. The goal is to surface a mistake users couldn't otherwise see without a profiler.

### "Why not auto-exhaustive on every `match()`?"

Exhaustiveness is a type-system guarantee, not a runtime one. `.exhaustive()` on the chained API is where TypeScript proves every variant is handled. The data-driven API (`match(value, rules)`) can't always infer that statically because `rules` may come from anywhere. If you want exhaustiveness with the data-driven style, use `compile<T, R>(rules)` with a fully-typed `Rule[]` literal — the type system will still catch missing arms.

### "Why is `matcherWalk()` slower than `matcher()` when both are hoisted?"

Because `matcherWalk` is doing a pattern-tree walk on every call — no O(1) Map shortcut for literal dispatch, no specialized dispatcher classes. That's the whole point: no compile step means nothing to amortize. When you rebuild it per call, the walk beats the compile; when you hoist it, the compile wins because the amortized cost drops to zero and the specialized dispatcher takes over.

---

## Features / parity

### "Does matchigo support X that ts-pattern has?"

Most hot-path primitives: yes. Chainable builder form (`P.string.startsWith("x").includes("y")`): no — matchigo uses `P.intersection(P.startsWith("x"), P.includesStr("y"))` instead, which reads a bit more awkwardly but compiles to the same intersection stack. If you need the chainable style specifically, ts-pattern is the better fit.

The "[Compared to ts-pattern](./README.md#compared-to-ts-pattern)" section in the README lists the gaps explicitly.

### "What about async handlers?"

matchigo doesn't wrap anything. If your handler returns a Promise, the matcher returns a Promise. No implicit awaiting, no async dispatch layer.

```ts
const handle = matcher<Event, Promise<Result>>()
  .with({ kind: "click" }, async (e) => await processClick(e))
  .exhaustive();

await handle(event);
```

### "Do you support P.when on nested paths?"

Yes — guards can be attached at any nesting level using `P.when(fn)` or by using the `when:` field on a data-driven rule. See the [Guards section in the README](./README.md#guards).

### "Why no `P.shape()` / `P.record()` / `P.partial()`?"

- `P.shape()` — plain objects are already the shape syntax (`{ kind: "user", age: P.number }`), so no wrapper is needed.
- `P.partial()` — covered by per-field `P.optional(pattern)`.
- `P.record(keyPattern, valuePattern)` — genuinely missing. It's a real gap vs ts-pattern, acknowledged in the [comparison section](./README.md#what-ts-pattern-has-that-matchigo-doesnt). Workaround: `P.when(obj => Object.values(obj).every(...))`. I'll add it if there's demand — open an issue.

### "Why no `rest()` / spread destructuring on objects/arrays?"

`match-iz` ships `rest()` to capture the "other keys" of an object or the tail of an array. It's ergonomic in FP JS code, but it allocates a fresh object/array on **every dispatch** to hold the captured keys — that's a guaranteed allocation on the hot path, which is the one thing matchigo is explicitly designed to avoid.

It's not on the roadmap. If you need `rest()`-style destructuring, `match-iz` is a better fit for that style of code.

### "Why no value handlers (JSX <Spinner /> directly)"

`match-iz` lets you pass a pre-built value (like a React element) as the handler, with no wrapping function. It looks like a clean ergonomic win. It isn't — and here's why matchigo won't follow.

JSX is **eagerly evaluated**. `<Spinner/>` compiles to `jsx("Spinner", {})`, which runs the moment the line is reached. If you do:

```tsx
// Hypothetical value-handler API — DON'T do this, even in libs that allow it
match(state, [
  [{ status: "idle" },    <EmptyState />],    // allocated every render
  [{ status: "loading" }, <Spinner />],       // allocated every render
  [{ status: "error" },   ({ m }) => <ErrorPanel msg={m} />],
  [{ status: "ok" },      ({ d }) => <List items={d} />],
]);
```

…every call to `match()` allocates `<EmptyState/>` **and** `<Spinner/>` as VNodes, regardless of which branch matches. In a component that re-renders often, that's 2 VNodes thrown in the GC per call, every call.

Wrapping the handler in `() => <X/>` makes it a thunk — the JSX is only evaluated inside the branch that's actually selected. Zero allocation for the unmatched branches. matchigo enforces this by design: handlers are functions, always.

The "value handler" API isn't an ergonomic win once you look at the cost. It's a footgun most users wouldn't spot until a profiler did. Keeping handlers function-only is intentional, non-negotiable, and documented in the [JSX section of the README](./README.md#using-matchigo-in-jsx--ui-code).

### "Will you ship a frontend-specific entry point (`matchigo/ui`, React/Vue/Svelte adapters)?"

Not for v1.0. The core already handles JSX / render functions cleanly — see the [JSX section](./README.md#using-matchigo-in-jsx--ui-code). A dedicated UI entry point would only earn its weight if there's a concrete ergonomic win beyond what `() => <X/>` already gives, and I don't see one today.

If demand shows up post-launch (issues, concrete use cases), I'd consider a framework-agnostic `matchigo/ui` — one entry point, not three adapters. Vue and Svelte have their own idioms (`v-if`, `{#if}`, computed refs / stores) that are the natural tool in those ecosystems; I won't duplicate them.

---

## Adoption / risk

### "Is this production-ready?"

The engine is covered by the runtime tests in [`tests/runtime.test.ts`](./tests/runtime.test.ts) and the published API is small and stable. It's a pre-1.0 library built by one person. If your team needs a big maintainer base, strong community, and years of production miles, pick ts-pattern — that's what it's for, and swapping later is a few hours of work. The README says this in ["When matchigo is the right pick"](./README.md#when-matchigo-is-the-right-pick-over-ts-pattern).

### "What's the bus factor?"

One. That's a real risk, not a hidden one. Counter-measures: the code is small, the API surface is small, the tests cover the engine, and the whole thing is MIT — if I stop maintaining it, forking is viable.

### "What's the bundle size cost?"

Small and tree-shakeable. matchigo ships as ESM with separate modules (`p.ts`, `match.ts`, `walk.ts`, etc.) so bundlers can drop unused entries. If you only import `matcher`, `matchWalk` and its dependencies don't ship. Exact byte counts depend on your bundler — measure with your own tooling.

### "Does it work in Node / Deno / Bun / browsers?"

Yes to all four. No runtime dependencies, no Node-specific APIs, no dynamic imports in the hot path. The only environment-aware code is the dev-warning gate (reads `process.env.NODE_ENV` if available, no-ops if not).

### "Does it need a build step?"

No. Source is TypeScript, and `dist/` ships compiled JS + `.d.ts`. Importing from `matchigo` works in any setup that can resolve npm packages.

---

## Meta

### "Why did you build matchigo instead of just using ts-pattern?"

Two reasons, one boring and one personal.

The boring one: I hit a real case where pattern matching showed up on a flame graph. A hot dispatch path, millions of calls, and ts-pattern's per-call cost was actually measurable — the kind of thing that doesn't matter in 95% of apps but does matter on tight backends, edge workers, or hot inner loops. The rest of the FAQ hammers this point ("most apps don't need this") because I agree with it. But when you're in the other 5%, you want an option closer to native `switch` that still has a real API.

The personal one: on the same codebase I wanted the readability win of chained matching — nested shapes, guards, exhaustiveness that evolves with the types — on a path where native `switch` wasn't cutting it. Native was fast but hard to read. ts-pattern was readable but slow (for that specific case). matchigo exists because I didn't want to compromise on either, and because I enjoy writing small libraries more than I enjoy working around other people's.

### "Why 'matchigo'? What's the `-igo` thing?"

It's part of a small family of `-igo` utilities I maintain. The first was [classigo](https://github.com/SUP2Ak/classigo) — a `classnames` / `clsx` alternative I wrote because those two had bad enough perf in one of my projects that it showed up in profiling. I do a lot of SCSS modules on the frontend (frontend isn't my favourite part of the stack — I don't especially want to learn Tailwind, and I like having control over what ships), so a leaner class-builder paid off.

classigo is honestly a tiny thing — three times nothing, as a codebase. But it's open source and it's the lineage: small, focused, perf-driven, MIT. matchigo is the same philosophy carried to pattern matching. The `-igo` suffix is just a family marker. Nothing deeper.

If you want to see the code style that led to this lib, classigo is a short read: <https://github.com/SUP2Ak/classigo>.

### "Why FR + EN docs?"

I'm French-speaking and I maintain both versions in parallel. EN is the source of truth for technical accuracy — changes land there first, FR mirrors after. If you spot a drift, EN is authoritative.

### "How do I contribute a benchmark scenario, bug report, or feature request?"

Open an issue or a PR. For benchmarks specifically: a scenario in [`bench/scenarios.ts`](./bench/scenarios.ts) that makes a fair point (preferably one where matchigo doesn't obviously win — those are the most useful). For bugs: a minimal repro. For features: explain the use case first; the library stays small by default, and new primitives need to earn their weight.
