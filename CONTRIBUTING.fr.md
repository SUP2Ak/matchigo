# Contribuer à matchigo

Merci d'envisager une contribution. Quelques règles gardent le projet sain — merci de les lire avant d'ouvrir une PR.

> 🇬🇧 English version : [CONTRIBUTING.md](./CONTRIBUTING.md) (la version faisant foi).

## Langue

**Les titres de PR, les descriptions, les messages de commit, les commentaires de code et les discussions doivent être en anglais.** Je suis francophone moi-même, mais l'anglais garde le projet accessible à tout le monde. Les issues aussi — le français est ok en DM/Discord, pas sur le tracker.

Cette page est traduite pour faciliter la lecture, mais **la version anglaise fait foi** en cas de divergence, et **ta PR doit être rédigée en anglais**.

## Avant d'ouvrir une PR

1. **Fork** le repo et crée une branche à partir de `main`.
2. **Utilise Bun** comme gestionnaire de paquets — `bun install`, pas `npm`/`pnpm`/`yarn`. Le lockfile est `bun.lock` ; mélanger les gestionnaires provoque des conflits "frozen file" / intégrité inutiles que je ne déboguerai pas pour toi.
3. **Format, typecheck, tests en local** :

   ```sh
   bun install
   bun run format       # ou format:check si tu ne veux rien écrire
   bun run typecheck
   bun run test
   bun run build
   ```

   La CI tourne les mêmes checks sur chaque PR — si un seul plante, la PR ne merge pas.

4. **Si le changement touche le moteur** (`src/compile.ts`, `src/walk.ts`, `src/match.ts`, `src/matcher.ts`, `src/p.ts`, `src/types/**`), lance le bench et inclus le delta :

   ```sh
   bun run bench
   ```

   Le pitch de matchigo c'est la perf. Un changement qui régresse le hot path a besoin d'une bonne raison.

## Scope d'une PR

- **Une feature / un fix par PR.** Ne mélange pas un refactor sans rapport avec un bug fix.
- **Petit et ciblé > gros et étalé.** Si un changement touche plus de ~300 lignes sur des fichiers non liés, split-le. Les grosses PR prennent une éternité à review et cachent les régressions.
- **Décris ce qui change et pourquoi** dans le corps de la PR. Des benchmarks, des screenshots de cas qui cassent, ou un test qui reproduit le bug rendent la review 10× plus rapide.
- **Pas de reformatage opportuniste.** Prettier tourne en CI — ne mélange pas "j'ai tout reformaté" avec un vrai changement de logique.

## Tests

- Tout changement runtime doit avoir un test dans [`tests/runtime.test.ts`](./tests/runtime.test.ts).
- Tout changement type-level (nouveau `P.*`, nouveau comportement de narrowing) doit avoir une assertion dans [`tests/types.test.ts`](./tests/types.test.ts).
- N'affaiblis pas un test existant pour faire passer un changement. Si un test est faux, explique pourquoi dans la PR et corrige-le explicitement.

## Style de commit

Suis [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/) :

```
<type>(<scope>): <résumé court>

[body optionnel]

[footer optionnel]
```

- **Types autorisés** : `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style`.
- **Scope** correspond à la zone touchée — typiquement : `compile`, `walk`, `match`, `matcher`, `p`, `types`, `bench`, `docs`, `ci`.
- **Résumé** : présent, impératif, en minuscules, pas de point final. `feat(compile): add PBigInt family`, pas `added` / `adds` / `Added.`.
- **Pas de gitmoji ni d'emojis décoratifs** dans les messages de commit — `feat(compile):` suffit.
- **Breaking changes** : ajoute `!` après le scope (ex. `feat(p)!: ...`) et un footer `BREAKING CHANGE:` qui explique la migration.
- Résumé ≤ 72 caractères ; l'histoire complète va dans le corps de la PR, pas dans l'en-tête du commit.

> Rappel : le commit lui-même reste en anglais, même si la PR est discutée en français ailleurs.

Exemples :

```
feat(walk): add matcherWalk() chained builder
fix(compile): narrow PBigInt handler param when value is bigint literal
perf(match): skip rebuild guard when rules array is reference-stable
docs(readme): document cold-path entry points
```

## Ce sur quoi je vais pousser back

- Ajouter des dépendances. matchigo est zéro-dep et je veux que ça le reste.
- Des features "nice to have" qui régressent le hot path. Prouve que ça paie son coût.
- De nouvelles primitives `P.*` sans cas d'usage clair que le JS natif / les primitives existantes ne couvriraient pas.
- Des breaking changes sans note de migration.

## Signaler un bug

Ouvre une issue avec :
- Version de matchigo, runtime (Bun/Node/Deno) + version, version TS.
- Une reproduction **minimale** — idéalement un test qui plante à coller dans `tests/runtime.test.ts`.
- Ce que tu attendais vs. ce qui s'est passé.

> L'issue elle-même reste en anglais, même si on en discute ensuite en français.

## Sécurité

Si tu trouves quelque chose lié à la sécurité, n'ouvre pas d'issue publique — email-moi d'abord. Voir les métadonnées du repo pour le contact.

---

Merci d'être arrivé jusqu'ici. Les PR qui suivent ce qui est au-dessus mergent vite.
