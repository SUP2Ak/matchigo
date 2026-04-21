# FAQ — matchigo

> _English version: [FAQ.md](./FAQ.md)_

Réponses anticipées aux critiques classiques et questions récurrentes sur le design, les benchmarks et les compromis. Si quelque chose ici est faux ou injuste, ouvre une issue — je préfère corriger que rester défendu par un doc périmé.

---

## Benchmarks

### « Tu gagnes juste parce que tu caches. Cache ts-pattern aussi et ton avance disparaît. »

Réponse courte : **tu ne peux pas cacher ts-pattern de la manière dont matchigo est caché**, parce que son API ne le permet pas.

Le point d'entrée de ts-pattern, c'est `match(value).with(...).otherwise(...)`. **La valeur est liée en premier** — avant que la moindre règle soit définie. Résultat : chaque site d'appel construit une chaîne de closures fraîche autour de _cette_ valeur. Pas d'objet règles à extraire, pas d'étape de compile à hoister, pas de fonction à pré-construire et réutiliser. Le matcher et l'input sont fusionnés par design.

matchigo fait l'inverse : `compile(rules)` retourne une fonction classique qui prend la valeur. Les règles vivent indépendamment de n'importe quel input, donc elles peuvent être construites une fois au chargement du module et appelées des millions de fois. Ce n'est pas un « tour de cache » ajouté par-dessus — c'est toute l'architecture. ts-pattern _pourrait_ ajouter une API équivalente, mais ça serait une autre bibliothèque.

Pour l'honnêteté complète, le bench fait aussi tourner matchigo en mode **inline** (règles reconstruites à chaque appel — l'anti-pattern qu'il warn contre). Même là, matchigo bat ts-pattern sur chaque scénario parce que le code de parcours est plus simple et qu'il alloue moins. Et `matchWalk()` est un point d'entrée cold-path dédié qui ne cache rien par design — il reste ~4× plus rapide que ts-pattern inline.

La vraie phrase honnête : les gains hoistés de matchigo viennent en partie du cache, mais **la comparaison inline-vs-inline reste une victoire matchigo**. Voir le scénario F du bench — c'est la ligne apples-to-apples pour cette critique.

### « Les micro-benchmarks ne veulent rien dire. Une vraie app ne le verra jamais. »

Largement vrai, et le README le dit d'entrée : si tu n'es pas CPU-bound sur le dispatch, le `switch` natif suffit et n'importe quelle lib de matching (ts-pattern compris) suffit. Les scénarios ici répondent à une question plus étroite : _quand le dispatch apparaît sur un flame graph, quelle option est la plus rapide ?_ Pour la plupart des apps, la réponse est indifférente. Pour des edge workers, des boucles chaudes, des routeurs de requêtes, et des petits backends VPS, ça compte parfois.

### « Tes scénarios sont cherry-pickés pour avantager matchigo. »

L'écart (3.8×–89×) est en soi une preuve contre le cherry-picking — si le bench était biaisé, tu verrais un cluster serré du genre « matchigo gagne par 20× ». Le bas de l'intervalle, c'est le dispatch littéral simple où ts-pattern est suffisamment proche pour que ça n'ait pas d'importance en pratique. Le haut, c'est l'empilement d'intersection et les formes imbriquées, où le style « closure par règle » de ts-pattern se cumule mal.

Le code de chaque scénario est dans [`bench/scenarios.ts`](./bench/scenarios.ts). Si tu trouves un scénario irréaliste (trop de règles, forme de données bizarre), ouvre une issue avec un scénario qui te semblerait plus juste et je l'ajouterai à la suite.

### « Tu utilises mitata mal / les nanosecondes c'est du bruit. »

`measure()` de mitata est utilisé avec `min_cpu_time: 250ms` par challenger, 4 itérations de warmup et 12–128 samples. Le runner fait aussi 200 itérations de warmup à la main avant la mesure pour sortir le JIT de son tiering bas. Les chiffres rapportés sont `avg` (pas `min`) sur l'ensemble des samples. Si c'est encore trop bruité à ton goût, les `p50`/`p99` bruts sont dans [`bench/bench-report.bun.md`](./bench/bench-report.bun.md) — la dispersion intra-scénario est cohérente avec un effet réel.

### « Tu as tourné les benchs sur Node et Deno aussi ? »

Actuellement seuls les chiffres Bun 1.2 sont publiés dans le README. Le runner détecte le runtime et écrit un rapport séparé (`bench-report.{bun,node,deno}.md`). Ajouter Node et Deno est sur la liste — les PRs sont bienvenues si tu veux proposer des chiffres pour un autre runtime.

### « `match-iz` est plus loin que ce que j'aurais cru. Tu l'utilises mal ? »

Les deux points d'entrée sont mesurés : `against(handlers)` (la forme hoistée / pré-compilée) et `match(value, handlers)` (la forme inline). `against()` est la bonne manière d'utiliser match-iz sur un hot path et c'est ce que représentent les lignes « [hoisted] ». L'écart est réel — le style de handlers de match-iz alloue plus par règle et fait plus d'introspection runtime. Ce n'est pas un bug dans la façon dont le bench l'appelle.

---

## Choix de design

### « Pourquoi ne pas forker ts-pattern et ajouter `compile()` ? »

Parce que ce qui rend ts-pattern ergonomique — l'API chaînée value-first — est exactement ce qui empêche la compilation. Hoister des règles demande qu'elles existent comme données indépendantes de toute valeur. La chaîne de ts-pattern est construite _autour_ de la valeur. Ajouter une étape de compile demanderait une API parallèle en forme de matchigo — ce qui est déjà matchigo.

### « Pourquoi à la fois `match()` et `matcher()` ? »

Même moteur, ergonomies différentes.

- `match(value, rules)` — data-driven. Les règles sont un tableau plain. Bon quand elles viennent d'un config, d'une table, ou de code généré.
- `matcher()` — chaîné. Meilleure inférence pour l'exhaustivité et `select`, se lit plus près d'un `switch`. Bon quand les règles sont statiques au site d'appel.

Sous le capot, les deux partagent le même chemin de compilation et les mêmes classes de dispatcher. Choisir entre les deux est un choix de style, pas de perf.

### « Pourquoi un `matchWalk()` séparé plutôt qu'un auto-détect dans `match()` ? »

Parce que l'heuristique « est-ce que je compile ? » est vraiment difficile à faire bien en runtime, et se tromper coûte cher des deux côtés :

- Compiler trop tôt → les appels cold-path paient la compile à chaque premier appel.
- Compiler trop tard → les appels hot-path font le walk à chaque fois pour toujours.

Séparer les APIs rend la décision explicite : si tu _sais_ que tes règles sont cold (reconstruites à chaque appel), choisis `matchWalk`. Si tu _sais_ qu'elles sont chaudes (module-level ou cachées), choisis `match` / `compile`. Le warning dev-mode attrape l'erreur classique (appeler `match` avec des règles inline), ce qui couvre le cas cold accidentel. Faire deviner la lib ajouterait de l'overhead aux deux chemins.

### « Pourquoi les warnings dev existent ? C'est pas juste du shaming ? »

Parce que l'erreur de perf la plus fréquente avec n'importe quel matcher, c'est de reconstruire les règles à chaque appel, et le failure mode est silencieux — ton code marche, il est juste 10–50× plus lent qu'il devrait. Le warning est émis **une fois par site d'appel, en dev uniquement, et peut être silencé** avec `silenceWarnings()`. En prod (`NODE_ENV=production`), c'est un no-op. L'objectif est de rendre visible une erreur que sans profiler tu ne verrais pas.

### « Pourquoi pas auto-exhaustive sur chaque `match()` ? »

L'exhaustivité est une garantie du système de types, pas du runtime. `.exhaustive()` sur l'API chaînée est l'endroit où TypeScript prouve que chaque variant est traité. L'API data-driven (`match(value, rules)`) ne peut pas toujours inférer ça statiquement parce que `rules` peut venir de n'importe où. Si tu veux l'exhaustivité avec le style data-driven, utilise `compile<T, R>(rules)` avec un littéral `Rule[]` entièrement typé — le système de types attrape toujours les variants manquants.

### « Pourquoi `matcherWalk()` est plus lent que `matcher()` quand les deux sont hoistés ? »

Parce que `matcherWalk` fait un walk de l'arbre de pattern à chaque appel — pas de raccourci Map O(1) pour le dispatch littéral, pas de classes de dispatcher spécialisées. C'est tout le principe : pas d'étape de compile veut dire rien à amortir. Quand tu le reconstruis à chaque appel, le walk bat la compile ; quand tu le hoistes, la compile gagne parce que son coût amorti tombe à zéro et que le dispatcher spécialisé prend le relais.

---

## Features / parité

### « Est-ce que matchigo supporte X qu'a ts-pattern ? »

La plupart des primitives du hot path : oui. La forme de builder chaînable (`P.string.startsWith("x").includes("y")`) : non — matchigo utilise `P.intersection(P.startsWith("x"), P.includesStr("y"))` à la place, ce qui se lit un peu plus maladroit mais compile vers la même pile d'intersection. Si tu tiens spécifiquement au style chaînable, ts-pattern est le meilleur choix.

La section « [Comparaison avec ts-pattern](./README.fr.md#comparaison-avec-ts-pattern) » du README liste les écarts explicitement.

### « Les handlers async ? »

matchigo ne wrap rien. Si ton handler retourne une Promise, le matcher retourne une Promise. Pas d'await implicite, pas de couche de dispatch async.

```ts
const handle = matcher<Event, Promise<Result>>()
  .with({ kind: "click" }, async (e) => await processClick(e))
  .exhaustive();

await handle(event);
```

### « Tu supportes P.when sur des chemins imbriqués ? »

Oui — les guards peuvent être attachés à n'importe quel niveau d'imbrication via `P.when(fn)` ou avec le champ `when:` sur une règle data-driven. Voir la [section Guards du README](./README.fr.md#guards).

### « Pourquoi pas `P.shape()` / `P.record()` / `P.partial()` ? »

- `P.shape()` — les objets plain sont déjà la syntaxe de forme (`{ kind: "user", age: P.number }`), pas besoin de wrapper.
- `P.partial()` — couvert par `P.optional(pattern)` champ par champ.
- `P.record(keyPattern, valuePattern)` — manque vraiment. C'est un vrai écart vs ts-pattern, reconnu dans la [section comparaison](./README.fr.md#ce-que-ts-pattern-a-et-pas-matchigo). Contournement : `P.when(obj => Object.values(obj).every(...))`. Je l'ajouterai s'il y a de la demande — ouvre une issue.

### « Pourquoi pas de `rest()` / destructuration spread sur objets/arrays ? »

`match-iz` embarque `rest()` pour capturer les « autres clés » d'un objet ou la fin d'un array. C'est ergonomique en code FP JS, mais ça alloue un nouvel objet/array à **chaque dispatch** pour stocker les clés capturées — c'est une allocation garantie sur le hot path, exactement la chose que matchigo est fait pour éviter.

Pas au roadmap. Si tu as besoin de destructuration style `rest()`, `match-iz` colle mieux à ce style de code.

### « Pourquoi pas de handlers valeur (JSX <Spinner /> directement) »

`match-iz` te laisse passer une valeur pré-construite (genre un élément React) comme handler, sans fonction wrappante. Ça a l'air d'être un gain d'ergonomie propre. Ça ne l'est pas — et voici pourquoi matchigo ne suivra pas.

Le JSX est **évalué eagerly**. `<Spinner/>` est compilé en `jsx("Spinner", {})`, qui s'exécute dès que la ligne est atteinte. Si tu fais :

```tsx
// API hypothétique à handler valeur — À NE PAS FAIRE, même dans les libs qui l'autorisent
match(state, [
  [{ status: "idle" },    <EmptyState />],    // alloué à chaque render
  [{ status: "loading" }, <Spinner />],       // alloué à chaque render
  [{ status: "error" },   ({ m }) => <ErrorPanel msg={m} />],
  [{ status: "ok" },      ({ d }) => <List items={d} />],
]);
```

…chaque appel de `match()` alloue `<EmptyState/>` **et** `<Spinner/>` comme VNodes, peu importe la branche qui matche. Dans un composant qui re-render souvent, c'est 2 VNodes jetés au GC par appel, à chaque appel.

Wrapper le handler dans `() => <X/>` en fait un thunk — le JSX n'est évalué qu'à l'intérieur de la branche effectivement sélectionnée. Zéro allocation pour les branches non matchées. matchigo impose ça par design : les handlers sont toujours des fonctions.

L'API « handler valeur » n'est pas un gain d'ergonomie une fois qu'on regarde le coût. C'est un piège que la plupart des users ne verraient pas avant qu'un profiler le signale. Garder les handlers function-only est volontaire, non-négociable, et documenté dans la [section JSX du README](./README.fr.md#utiliser-matchigo-en-jsx--ui).

### « Vas-tu livrer un point d'entrée frontend (`matchigo/ui`, adapters React/Vue/Svelte) ? »

Pas pour la v1.0. Le core gère déjà le JSX / les render functions proprement — voir la [section JSX](./README.fr.md#utiliser-matchigo-en-jsx--ui). Un point d'entrée UI dédié ne vaudrait son poids que s'il y avait un gain ergonomique concret au-delà de ce que `() => <X/>` apporte déjà, et je n'en vois pas aujourd'hui.

Si la demande apparaît post-launch (issues, cas d'usage concrets), j'envisagerais un `matchigo/ui` framework-agnostic — un seul point d'entrée, pas trois adapters. Vue et Svelte ont leurs propres idiomes (`v-if`, `{#if}`, computed refs / stores) qui sont l'outil naturel dans ces écosystèmes ; je ne vais pas les dupliquer.

---

## Adoption / risque

### « C'est prêt pour la prod ? »

Le moteur est couvert par les tests runtime dans [`tests/runtime.test.ts`](./tests/runtime.test.ts) et l'API publiée est petite et stable. C'est une bibliothèque pre-1.0 faite par une seule personne. Si ton équipe a besoin d'une grosse base de mainteneurs, d'une communauté solide, et d'années de kilomètres en prod, prends ts-pattern — c'est fait pour ça, et changer plus tard coûte quelques heures.

### « Le bus factor ? »

Un. C'est un risque réel, pas caché. Contre-mesures : le code est petit, la surface d'API est petite, les tests couvrent le moteur, et tout est MIT — si j'arrête de maintenir, le fork reste viable.

### « Le coût en taille de bundle ? »

Petit et tree-shakeable. matchigo est publié en ESM avec des modules séparés (`p.ts`, `match.ts`, `walk.ts`, etc.) pour que les bundlers puissent drop les entrées inutilisées. Si tu importes seulement `matcher`, `matchWalk` et ses dépendances ne sont pas embarquées. Les octets exacts dépendent de ton bundler — mesure avec ton propre outillage.

### « Ça marche sur Node / Deno / Bun / navigateur ? »

Oui aux quatre. Zéro dépendance runtime, pas d'API spécifique à Node, pas d'imports dynamiques sur le hot path. Le seul code environment-aware est la garde des warnings dev (lit `process.env.NODE_ENV` si dispo, no-op sinon).

### « Ça demande un build step ? »

Non. Le source est en TypeScript, et `dist/` livre le JS compilé + les `.d.ts`. Importer depuis `matchigo` marche dans n'importe quel setup qui sait résoudre un package npm.

---

## Meta

### « Pourquoi avoir fait matchigo au lieu de juste prendre ts-pattern ? »

Deux raisons, une plate et une perso.

La plate : j'ai croisé un vrai cas où le pattern matching explosait sur un flame graph. Chemin de dispatch chaud, des millions d'appels, et le coût par appel de ts-pattern était vraiment mesurable — le genre de truc qui n'a aucune importance dans 95 % des apps mais qui en a sur des backends serrés, des edge workers, ou des boucles internes chaudes. Le reste de la FAQ martèle ce point (« la plupart des apps n'en ont pas besoin ») parce que je suis d'accord avec. Mais quand tu es dans les 5 % restants, tu veux une option plus proche du `switch` natif mais qui garde une vraie API.

La perso : sur la même codebase je voulais aussi le gain en lisibilité du matching chaîné — formes imbriquées, guards, exhaustivité qui évolue avec les types — là où le `switch` natif ne suffisait plus. Le natif était rapide mais illisible. ts-pattern était lisible mais lent (sur ce cas précis). matchigo existe parce que je ne voulais pas lâcher un des deux, et parce que j'aime plus écrire des petites libs que de contourner celles des autres.

### « Pourquoi "matchigo" ? C'est quoi ce suffixe `-igo` ? »

Ça fait partie d'une petite famille d'utilitaires `-igo` que je maintiens. Le premier, c'était [classigo](https://github.com/SUP2Ak/classigo) — une alternative à `classnames` / `clsx` que j'ai écrite parce que ces deux-là avaient des perfs suffisamment mauvaises sur un de mes projets pour que ça ressorte au profiling. Je fais pas mal de SCSS modules côté front (le front n'est pas mon terrain de jouissance — apprendre Tailwind et compagnie, ça m'emmerde, c'est pas mon domaine ; et j'aime bien avoir du contrôle sur ce que je ship), donc un class-builder plus léger payait vite.

classigo, honnêtement, c'est un petit truc — trois fois rien en termes de code. Mais c'est open source et c'est la lignée : petit, focalisé, orienté perf, MIT. matchigo, c'est la même philosophie transposée au pattern matching. Le suffixe `-igo` est juste un marqueur de famille. Rien de plus profond.

Si tu veux te faire un avis sur le style de code qui a mené à matchigo, classigo se lit vite : <https://github.com/SUP2Ak/classigo>.

### « Pourquoi FR + EN ? »

Je suis francophone et je maintiens les deux versions en parallèle. L'EN est la source de vérité pour l'exactitude technique — les changements atterrissent là d'abord, la FR suit. Si tu repères une dérive, l'EN fait foi.

### « Comment je propose un scénario de bench, un bug, ou une feature ? »

Ouvre une issue ou une PR. Pour les benchs spécifiquement : un scénario dans [`bench/scenarios.ts`](./bench/scenarios.ts) qui fait un point juste (de préférence un où matchigo ne gagne pas évidemment — ce sont les plus utiles). Pour les bugs : un repro minimal. Pour les features : explique le use case d'abord ; la lib reste petite par défaut, et toute nouvelle primitive doit justifier sa place.
