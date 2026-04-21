# Contributing to matchigo

Thanks for considering a contribution. A few guidelines keep the project healthy — please read them before opening a PR.

> 🇫🇷 Version française : [CONTRIBUTING.fr.md](./CONTRIBUTING.fr.md). PRs must still be written in English (see below).

## Language

**PR titles, descriptions, commit messages, code comments, and discussion must be in English.** I'm francophone myself, but English keeps the project accessible to everyone. Open issues in English too — French is fine in DMs/Discord, not on the tracker.

## Before you open a PR

1. **Fork** the repo and create a branch off `main`.
2. **Use Bun** as your package manager — `bun install`, not `npm`/`pnpm`/`yarn`. The lockfile is `bun.lock`; mixing managers causes spurious "frozen file" / integrity conflicts that I won't debug for you.
3. **Format, typecheck, and test locally**:

   ```sh
   bun install
   bun run format       # or format:check if you don't want to write
   bun run typecheck
   bun run test
   bun run build
   ```

   CI runs the same gates on every PR — if one fails, the PR won't merge.

4. **If the change touches the engine** (`src/compile.ts`, `src/walk.ts`, `src/match.ts`, `src/matcher.ts`, `src/p.ts`, `src/types/**`), run the bench and include the delta:

   ```sh
   bun run bench
   ```

   matchigo's pitch is perf. A change that regresses the hot path needs a good reason.

## PR scope

- **One feature / one fix per PR.** Don't bundle an unrelated refactor into a bug fix.
- **Small and focused beats big and sprawling.** If a change touches more than ~300 lines across unrelated files, split it. Giant PRs take forever to review and hide regressions.
- **Describe what changed and why** in the PR body. Benchmarks, screenshots of failing cases, or a test that reproduces the bug make review 10× faster.
- **No drive-by reformatting.** Prettier runs as part of CI — don't mix "I reformatted everything" with actual logic changes.

## Tests

- Every runtime-facing change needs a test in [`tests/runtime.test.ts`](./tests/runtime.test.ts).
- Every type-level change (new `P.*`, new narrowing behaviour) needs an assertion in [`tests/types.test.ts`](./tests/types.test.ts).
- Don't weaken existing tests to make a change pass. If a test is wrong, explain why in the PR and fix it explicitly.

## Commit style

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

- **Allowed types**: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style`.
- **Scope** should match the area touched — most often: `compile`, `walk`, `match`, `matcher`, `p`, `types`, `bench`, `docs`, `ci`.
- **Summary**: present-tense imperative, lowercase, no trailing period. `feat(compile): add PBigInt family`, not `added` / `adds` / `Added.`.
- **No gitmoji or decorative emojis** in commit messages — `feat(compile):` is enough.
- **Breaking changes**: add `!` after the scope (e.g. `feat(p)!: ...`) and a `BREAKING CHANGE:` footer explaining the migration.
- Keep the summary ≤ 72 chars; put the longer story in the PR body, not the commit header.

Examples:

```
feat(walk): add matcherWalk() chained builder
fix(compile): narrow PBigInt handler param when value is bigint literal
perf(match): skip rebuild guard when rules array is reference-stable
docs(readme): document cold-path entry points
```

## What I'll push back on

- Adding dependencies. matchigo is zero-dep and I'd like to keep it that way.
- Features that exist to be "nice to have" but regress the hot path. Prove it pays for itself.
- New `P.*` primitives without a clear use case that native JS / existing primitives can't cover.
- Breaking changes without a migration note.

## Reporting bugs

Open an issue with:
- matchigo version, runtime (Bun/Node/Deno) + version, TS version.
- A **minimal** reproduction — ideally a failing test case I can paste into `tests/runtime.test.ts`.
- What you expected vs. what happened.

## Security

If you find something security-relevant, don't open a public issue — email me first. See the repo metadata for contact.

---

Thanks for reading this far. PRs that follow the above tend to merge quickly.
