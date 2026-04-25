# matchigo

> Pattern matching rapide et data-driven pour TypeScript — façon Rust, compilé paresseusement, exhaustivité typée.

[![npm](https://img.shields.io/npm/v/matchigo.svg)](https://www.npmjs.com/package/matchigo)
[![downloads](https://img.shields.io/npm/dw/matchigo.svg)](https://www.npmjs.com/package/matchigo)
[![bundle size](https://img.shields.io/bundlephobia/minzip/matchigo.svg)](https://bundlephobia.com/package/matchigo)
[![CI](https://github.com/SUP2Ak/matchigo/actions/workflows/ci.yml/badge.svg)](https://github.com/SUP2Ak/matchigo/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/npm/l/matchigo.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-%3E%3D5.4-blue.svg)](https://www.typescriptlang.org/)

> _English version: [README.md](./README.md)_

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
  .exhaustive();                       // exhaustivité vérifiée à la compilation

area({ kind: "circle", r: 2 });        // 12.566…
```

## Pourquoi matchigo ?

matchigo a une **surface plus réduite que ts-pattern** et une **API plus riche que match-iz**. Sur les fonctionnalités partagées, matchigo compile les règles en amont pour que le chemin chaud reste proche d'un `switch` natif.

| | matchigo | ts-pattern | match-iz |
| :--- | :---: | :---: | :---: |
| API chaînée (`.with(...).exhaustive()`)        | ✅ | ✅ | ❌ |
| API data-driven (`match(v, rules)`)            | ✅ | ❌ | ✅ |
| Exhaustivité à la compilation                  | ✅ | ✅ | ❌ |
| Chemin chaud pré-compilé (`compile()` / builder mis en cache) | ✅ | ❌ | ✅ (`against()`) |
| Dispatch O(1) par `Map` sur littéraux          | ✅ | ❌ | ❌ |
| Avertissements dev en cas de mésusage          | ✅ | ❌ | ❌ |

**Ligne directrice sur les mesures comparables** — sur son chemin chaud, matchigo tourne à ~2× un `switch` natif sur littéraux simples, **3,8×–90× plus vite que ts-pattern**, **~5×–30× plus vite que match-iz** sur les neuf scénarios de dispatch unique mesurés (voir [Benchmarks](#benchmarks) pour le détail). Sur un _vrai cold path_ (règles reconstruites à chaque appel), matchigo embarque [`matchWalk()`](#matchwalk-pour-les-vrais-cold-paths) qui est ~**4× plus rapide que ts-pattern inline** — donc matchigo gagne dans les deux régimes, à condition de choisir le bon point d'entrée. Voir aussi [comparaison avec ts-pattern](#comparaison-avec-ts-pattern) pour le tableau des fonctionnalités.

## Installation

```sh
bun add matchigo
# ou
npm i matchigo
# ou
pnpm add matchigo
```

Requiert TypeScript **≥ 5.4** (développé et testé avec TS 6.0). Aucune dépendance runtime.

## Deux APIs, un seul moteur

matchigo expose une API **chaînée** (`matcher()`) et une API **data-driven** (`match()` / `compile()`). Elles partagent le même compilateur — choisissez celle qui lit le mieux dans votre code.

### Chaînée — expressive, exhaustive

```ts
import { P, matcher } from "matchigo";

type Role = "admin" | "user" | "guest";

const label = matcher<Role, string>()
  .with("admin", () => "A")
  .with("user",  () => "U")
  .with("guest", () => "G")
  .exhaustive();                // erreur TS si une variante manque
```

### Data-driven — déclarative, portable

```ts
import { P, compile } from "matchigo";

const label = compile<Role, string>([
  { with: "admin", then: "A" },
  { with: "user",  then: "U" },
  { with: "guest", then: "G" },
]);

label("admin"); // "A"
```

`compile()` renvoie une fonction réutilisable. `match(value, rules)` est un raccourci one-shot avec un cache interne indexé sur l'identité du tableau `rules`.

### `matchWalk()` — pour les vrais cold paths

`match()` / `compile()` / `matcher()` compilent une fois et dispatchent pas cher — idéal quand tu peux réutiliser les règles. Quand tu ne peux vraiment pas (règles dérivées d'un input user, générées à chaque appel, etc.), utilise `matchWalk()` à la place :

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

`matchWalk` saute complètement la compilation : il walk l'arbre de patterns à chaque appel avec zéro allocation. Même sémantique que `match()` — même forme de règles, même support des `P.*`, même `P.select`. Sur un vrai cold path, il est ~4× plus rapide que ts-pattern ; quand tu peux hoist, `match()` / `compile()` / `matcher()` restent plus rapides. Prends l'outil qui colle à ton usage.

Tu préfères le style chaîné ? `matcherWalk()` est le pendant chaîné — même surface d'API que `matcher()`, mais dispatche via `matchWalk`, donc pas d'étape de compilation :

```ts
import { P, matcherWalk } from "matchigo";

function classify(role: string, banned: Set<string>) {
  return matcherWalk<string, string>()
    .with(P.when((r) => banned.has(r)), "Banned")
    .with("admin", "Admin")
    .otherwise("Other")(role);
}
```

Sur un cold path, `matcherWalk()` tombe à ~**45 ns** (nouveau builder par appel) contre ~270 ns pour `matcher()` cold — ~6× plus rapide. Hoisté il tombe à ~**14 ns** sur un dispatch à 5 littéraux, encore ~2× plus lent que `matcher()` parce qu'il fait un tree-walk à chaque appel (pas de Map O(1)). À utiliser quand tu veux l'API chaînée ET le comportement cold-path ; utilise `matcher()` si tu peux hoist et que tu es sur le hot path.

## Fonctionnalités

### Primitives

```ts
P.string  P.number  P.boolean  P.bigint  P.symbol  P.function
P.nullish       // null | undefined
P.defined       // tout sauf null/undefined
P.nonNullable   // alias de P.defined (parité ts-pattern)
P.any           // matche toujours
```

### Combinateurs

```ts
P.union("a", "b", "c")      // l'un de
P.not(P.nullish)            // négation
P.optional(P.string)        // P.string | undefined
P.intersection(P.number, P.positive, P.integer)
P.when((v) => v.length > 0) // prédicat libre
```

### Vérifications d'instance

```ts
P.instanceOf(Date)
P.instanceOf(Error)
```

### Raffinements string

```ts
P.regex(/^user-\d+$/)
P.startsWithStr("admin:")
P.endsWithStr(".json")
P.includesStr("@")                      // sous-chaîne
P.minLengthStr(3)                       // v.length >= 3
P.maxLengthStr(10)                      // v.length <= 10
P.lengthStr(5)                          // v.length === 5
```

### Raffinements numériques

```ts
P.between(0, 10)    P.gt(0)    P.gte(0)    P.lt(100)    P.lte(100)
P.positive          P.negative
P.integer           P.finite
```

### Raffinements bigint

```ts
P.bigintGt(0n)      P.bigintGte(0n)     P.bigintLt(100n)    P.bigintLte(100n)
P.bigintBetween(0n, 100n)
P.bigintPositive    P.bigintNegative
```

### Patterns sur tableaux

```ts
P.array(P.number)                       // chaque élément est un nombre
P.arrayOf(P.string, { min: 1, max: 5 }) // longueur contrainte
P.arrayIncludes(P.number)               // au moins un élément matche
P.tuple(P.number, P.string)             // longueur exacte + par slot
P.startsWith(1, 2)                      // préfixe
P.endsWith(9)                           // suffixe
```

### Patterns Map & Set

```ts
P.map(P.string, P.number)   // Map dont chaque clé matche P.string et chaque valeur P.number
P.set(P.string)             // Set dont chaque élément matche P.string
```

Les deux matchent quand **chaque** entrée/élément satisfait le pattern interne (mêmes sémantiques que ts-pattern).

### Matching de forme (façon Rust)

```ts
match<U, string>(user, [
  { with: { profile: { verified: true } }, then: "ok" },
  { otherwise: "no" },
]);
```

### Guards

```ts
// Chaînée — surcharge à 3 arguments, le guard ne restreint pas le type
matcher<number, string>()
  .with(P.number, (n) => n >= 65, "Senior")
  .with(P.number, (n) => n >= 18, "Adult")
  .otherwise("Young");

// Data-driven — `when` explicite
match<number, string>(n, [
  { with: P.number, when: (n) => n >= 65, then: "Senior" },
  { with: P.number, when: (n) => n >= 18, then: "Adult" },
  { otherwise: "Young" },
]);
```

### `P.select` — extraire des valeurs matchées

```ts
// un seul select anonyme — passé directement au handler
match<User, string>(user, [
  {
    with: { kind: "user", name: P.select() },
    then: (name: string) => `hi ${name}`,
  },
  { otherwise: "?" },
]);

// plusieurs selects étiquetés — passés dans un objet
match<User, string>(user, [
  {
    with: { name: P.select("n"), age: P.select("a") },
    then: ({ n, a }: { n: string; a: number }) => `${n}-${a}`,
  },
  { otherwise: "?" },
]);

// sélection + raffinement en une étape — le pattern contraint le match
// et restreint le type de la valeur extraite
match<User, string>(user, [
  {
    with: { age: P.select(P.number) },         // anonyme, restreint à number
    then: (age: number) => `${age}ans`,
  },
  {
    with: { tags: P.select("t", P.array(P.string)) },  // étiqueté + raffiné
    then: ({ t }: { t: string[] }) => t.join(","),
  },
  { otherwise: "?" },
]);
```

### `isMatching` — prédicat autonome

```ts
import { P, isMatching } from "matchigo";

const isAdult = (v: unknown) => isMatching({ age: P.gte(18) }, v);

users.filter(isAdult);
```

Même langage de pattern que `match()` — pas de handler, pas d'extraction, pas d'exception. Utile dans `.filter`, `.some`, type guards, etc. Pour du filtrage en chemin chaud, compilez plutôt une règle unique (plus rapide parce que le pattern est pré-classifié).

### Exhaustivité (au niveau des types)

```ts
type Shape = { kind: "circle" } | { kind: "square" };

const f = matcher<Shape, number>()
  .with({ kind: "circle" }, () => 1)
  .exhaustive();  // ❌ erreur : non-exhaustif, { kind: "square" } manque
```

Si une variante manque, `.exhaustive()` renvoie un type `ExhaustiveError<Rem>` (qui n'est pas une fonction) — donc l'appel échoue au site d'appel, pas au runtime.

## Utiliser matchigo en JSX / UI

matchigo s'insère naturellement pour rendre un état discriminé (loading / error / ok, états d'auth, étapes d'un wizard). Pas de point d'entrée spécial — l'API habituelle suffit, avec une réserve : **n'utilise pas `match(value, rules)` inline dans le corps d'un render**. Le tableau de règles est réalloué à chaque render, ce qui rate le cache de compile. Soit tu hoist le matcher au module scope, soit tu utilises `matchWalk` pour le cas inline. Les handlers restent des fonctions pour que le JSX ne soit construit que pour la branche qui matche réellement.

**Le mieux — hoist au module scope** (exhaustivité à la compilation, dispatch O(1) sur littéraux quand applicable) :

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

**Si tu as vraiment besoin des règles inline** (render one-off, règles calculées depuis les props, etc.) — utilise `matchWalk`, conçu pour ce cold path :

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

N'utilise pas `match(state, [...])` inline dans le corps d'un composant — c'est le [cold-path anti-pattern](#anti-patterns). L'avertissement dev le signalera.

> **Pourquoi `() => <X/>` et pas `<X/>` direct ?** JSX est eager — `<Spinner/>` est compilé en un appel `jsx("Spinner", {})` qui alloue un VNode immédiatement. Si le handler était l'élément brut, chaque branche allouerait son élément à chaque render, même celles non sélectionnées. Le thunk `() =>` défère cette allocation à la branche matchée uniquement. C'est 3 caractères de lazy evaluation, pas un papercut. C'est pour ça que matchigo ne livre pas de variante « handler valeur » — voir l'[entrée FAQ](./FAQ.fr.md#pourquoi-pas-de-handlers-valeur-spinner--directement) pour le détail.

Ça marche pareil pour les render functions Vue, les props de composant Svelte, Solid, Preact, etc.

## Performance

### Pourquoi c'est rapide

1. **Les patterns sont compilés une fois.** `matcher()` et `compile()` parcourent vos règles, classent chaque pattern (littéral vs. sentinelle vs. forme vs. guard) et construisent un dispatcher spécialisé. Les appels suivants ne font plus que du travail de table ou de branchement.
2. **Chemin rapide O(1) sur littéraux.** Quand *tous* les `with` sont des littéraux (ou des tableaux de littéraux) sans guard ni `select`, le compilateur émet un lookup `Map<value, result>`. Zéro parcours de pattern, zéro appel de fonction.
3. **Les chemins de `select` sont pré-calculés.** On parcourt l'arbre du pattern une fois pour collecter chaque position de `P.select()`, puis au runtime on ne fait qu'un `readPath(value, path)` — pas de re-parcours par appel.
4. **Compilation paresseuse.** Le builder chaîné repousse la compilation au premier appel, donc construire un matcher est quasi gratuit ; le coût est amorti sur l'usage réel.
5. **Pas de proxies, pas de classes sur le chemin chaud.** Les patterns sont de simples objets `{ [Symbol]: tag, …data }`. Le compilateur les consomme et les jette.

### Avertissements dev

matchigo émet un `console.warn` **une seule fois** quand il détecte un mésusage qui casse le cache :
- Reconstruire `rules` à chaque appel de `match(value, rules)` (l'anti-pattern « cold-path inline »).
- Créer des milliers d'instances distinctes de `matcher()` (typiquement, le builder est dans une boucle chaude).

Les avertissements sont **actifs par défaut** et ne se déclenchent qu'une fois par processus. Appelle `silenceWarnings()` dans ton point d'entrée de production pour les désactiver. Aucune lecture d'env, aucun compteur, aucun formatage de string après ça.

```ts
import { silenceWarnings } from "matchigo";
silenceWarnings(); // à appeler une fois au démarrage pour tout désactiver
```

## Benchmarks

Mesuré avec [mitata](https://github.com/evanwashere/mitata). Chaque contender est étiqueté `[hoisted]` (construit une fois, réutilisé — l'usage réaliste) ou `[inline]` (reconstruit à chaque appel — l'anti-pattern, mesuré quand même pour l'honnêteté). ts-pattern n'a pas d'API de hoist par design, donc il est uniquement inline.

Les tables complètes par scénario sont auto-générées et vivent à côté du code du bench, donc elles restent à jour avec les chiffres :

- [`bench/bench-report.bun.md`](./bench/bench-report.bun.md) — run Bun (EN)
- [`bench/bench-report.bun.fr.md`](./bench/bench-report.bun.fr.md) — run Bun (FR)

Reproduire localement :

```sh
bun run bench          # Bun
bun run bench:node     # Node ≥ 22 avec --experimental-strip-types
bun run bench:deno     # Deno
```

Chaque runtime produit son propre `bench-report.<runtime>.md` et `bench-report.<runtime>.fr.md`.

## Comparaison avec ts-pattern

matchigo n'est pas un remplacement plug-and-play de ts-pattern. ts-pattern est la référence en largeur de surface ; matchigo est le noyau plus restreint et plus rapide. Être honnête sur l'écart est le cœur du sujet — « on est plus rapide » serait creux si c'était juste parce qu'on en fait moins.

### Ce que matchigo a et pas ts-pattern

- **`compile(rules)`** — pré-compile un tableau de règles en fonction réutilisable. ts-pattern est inline only ; la closure du matcher est reconstruite à chaque site d'appel.
- **`match(value, rules)`** — point d'entrée data-driven avec cache indexé sur l'identité du tableau. Utile quand les règles viennent d'une source de données (config, table, générateur).
- **`matchWalk(value, rules)`** — point d'entrée cold-path dédié qui saute complètement la compilation. ~4× plus rapide que ts-pattern inline sur un dispatch sur 5 littéraux.
- **Dispatch O(1) par `Map` sur littéraux** — quand tous les `with` sont des littéraux (ou tableaux de littéraux) sans guard ni select, le compilateur émet un lookup `Map<value, result>` au lieu d'une chaîne de `if`.
- **Sucre tableau-comme-union** — `.with(["admin","root"], ...)` est un raccourci pour `P.union("admin","root")`.
- **Avertissements dev en cas de mésusage** — un warning one-shot quand vous cassez le cache (règles reconstruites dans une boucle, matcher créé par appel). Coût nul en production avec `NODE_ENV=production`.

### Ce que ts-pattern a et pas matchigo

- **Builders chaînables string/number** — `P.string.minLength(3).maxLength(10)` / `P.number.positive().int()`. Sucre ergonomique que je n'ai pas porté. Équivalent matchigo : `P.intersection(P.minLengthStr(3), P.maxLengthStr(10))`, `P.intersection(P.positive, P.integer)`.
- **`P.record(keyPattern, valuePattern)`** — « n'importe quel objet dont toutes les valeurs matchent le pattern P ». Utile pour les dicts libres type `Record<string, User>`. Pas encore livré dans matchigo ; contournement possible via un guard `P.when(obj => Object.values(obj).every(...))`.
- **Patterns tuple variadiques (`...P.array(P.number)`)** — patterns type `[P.string, ...P.array(P.number), P.string]`. ts-pattern gère le variadique au milieu ; matchigo ne le fait pas. Si tu as besoin de ça, prends ts-pattern.

### Ce que `match-iz` a et pas matchigo (et n'aura pas)

- **Destructuration `rest()`** — capturer « toutes les autres clés » d'un objet ou la fin d'un array. Sympa en code FP JS-idiomatique, mais ça alloue un nouvel objet/array à chaque dispatch — ça tue le fast path. **Non-goal assumé.**
- **Handlers valeur (`.with(pattern, <Spinner/>)`)** — renvoyer un élément React/Vue/Svelte pré-construit au lieu d'une fonction. Ça a l'air ergonomique mais ça force **l'évaluation eager** de chaque branche à chaque appel, même celles non sélectionnées. `() => <Spinner/>` dans matchigo est strictement meilleur : c'est un thunk lazy. **Non-goal assumé.** Voir la [FAQ](./FAQ.fr.md#pourquoi-pas-de-handlers-valeur-spinner--directement) pour la trace perf.

C'est toute la liste des vrais écarts. Tout le reste que ts-pattern propose — `P.map`, `P.set`, raffinements de longueur string, raffinements bigint, `P.array.includes`, `P.nonNullable`, `isMatching`, `P.select(subPattern)` — est supporté.

### Ce qui est équivalent

- **Exhaustivité** — les deux utilisent une soustraction de type à la `Exclude` ; le `DeepExclude` de matchigo distribue les unions multi-clés de la même manière que celui de ts-pattern.
- **`P.select()`** — matchigo supporte toutes les signatures de ts-pattern : `P.select()`, `P.select("name")`, `P.select(subPattern)`, `P.select("name", subPattern)`. Internes différents (matchigo pré-calcule les chemins ; ts-pattern utilise un symbole + walker par record), surface d'appel identique.
- **`isMatching`** — prédicat standalone, même signature que ts-pattern.
- **Gardes de type primitives** (`P.string`, `P.number`, `P.bigint`, …), **combinateurs** (`P.union`, `P.not`, `P.optional`, `P.intersection`), **`instanceOf`**, **patterns tuple/array/Map/Set**, **raffinements string/number/bigint**.

Les écarts délibérés sont le builder chaînable, `P.record`, et les tuples à variadique central — tout le reste est à parité ou plus rapide. Le gain n'est réel que parce que je suis resté étroit.

## Anti-patterns

**Ne reconstruisez pas les règles à chaque appel de `match()`.** `match()` cache les règles compilées sur l'identité du tableau. Un nouveau tableau à chaque appel → cache miss → recompilation complète → ~90× plus lent que `switch` natif et plus lent que ts-pattern inline. Vous avez deux bonnes options : hoist les règles, ou passez à `matchWalk()`. Les avertissements dev attrapent ce pattern quand ils peuvent.

```ts
// ❌ Cold path — nouveau tableau à chaque appel, cache miss, recompilation complète
function classify(v: string) {
  return match<string, string>(v, [
    { with: "admin", then: "A" },
    { otherwise: "X" },
  ]);
}

// ✅ Option 1 — hoist et compile (le plus rapide si réutilisé)
const classify = compile<string, string>([
  { with: "admin", then: "A" },
  { otherwise: "X" },
]);

// ✅ Option 2 — point d'entrée cold-path data-driven (quand tu ne peux vraiment pas hoist)
function classify(v: string) {
  return matchWalk<string, string>(v, [
    { with: "admin", then: "A" },
    { otherwise: "X" },
  ]);
}

// ✅ Option 3 — point d'entrée cold-path chaîné (même idée, API chaînée)
function classify(v: string) {
  return matcherWalk<string, string>()
    .with("admin", "A")
    .otherwise("X")(v);
}
```

Le builder a le même souci dans une boucle chaude :

```ts
// ❌
items.map((v) =>
  matcher<string, string>().with("a", "A").otherwise("?")(v)
);

// ✅
const f = matcher<string, string>().with("a", "A").otherwise("?");
items.map(f);
```

## Référence API

### `match<T, R>(value, rules): R`
Match data-driven one-shot. Les règles sont cachées par identité de tableau via `WeakMap` — appeler de façon répétée avec les mêmes `rules` est sûr. Utilise le chemin compilé (`matcher()` / `compile()` partagent le même moteur).

### `matchWalk<T, R>(value, rules): R`
Frère cold-path de `match()`. Walk l'arbre de patterns à chaque appel avec zéro allocation — pas de compilation, pas de cache. À utiliser quand les règles sont vraiment reconstruites à chaque appel. Plus lent que `match()` quand les règles sont hoistées ; plus rapide que toutes les autres libs en mode inline.

### `compile<T, R>(rules): CompiledFn<T, R>`
Compile les règles en amont. Renvoie une fonction réutilisable avec `.run(value)` comme alias.

### `matcher<T, R>(): Matcher<T, R>`
Builder chaîné. `.with(pattern, then)` ou `.with(pattern, guard, then)`. Terminez par `.otherwise(result)` ou `.exhaustive()`.

### `matcherWalk<T, R>(): Matcher<T, R>`
Pendant chaîné de `matcher()` qui dispatche via `matchWalk` — pas d'étape de compilation, pas de cache. Même surface `.with` / `.otherwise` / `.exhaustive`. À utiliser quand vous voulez l'API chaînée sur un cold path. Légèrement plus lent que `matcher()` quand hoisté (walk à chaque appel) ; bien plus rapide quand le builder est reconstruit par appel (~6× vs `matcher()` cold).

### `silenceWarnings(): void`
Désactive les avertissements dev pour le processus courant.

### Exports de types
`Pattern`, `Rule`, `NarrowedBy`, `InferPattern`, `CompiledFn`, `ExhaustiveError`, `Matcher`.

### Référence complète
La référence API auto-générée (tous les exports, toutes les signatures, tous les paramètres de type) est publiée sur **https://sup2ak.github.io/matchigo/** — construite depuis le source via TypeDoc et redéployée à chaque push sur `main`. Utilise-la si tu as besoin de la forme exacte d'un type comme `NarrowedBy<T, Pat>` ou `Matcher<T, R>` sans aller lire le source.

> La référence est générée en anglais (les types et signatures sont en anglais dans le code par convention — voir CONTRIBUTING). L'UI TypeDoc reste la même, peu importe la langue.

## Contribuer

Lis [CONTRIBUTING.fr.md](./CONTRIBUTING.fr.md) avant d'ouvrir une PR — les PR doivent être rédigées en anglais, ciblées sur une seule feature/fix, et doivent passer `format:check`, `typecheck`, et `test` en local. Le repo utilise Bun comme gestionnaire de paquets ; les autres lockfiles sont refusés par la CI.

## Licence

MIT
