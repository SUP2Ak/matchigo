# matchigo — rapport de benchmark

_Généré le 2026-04-21T16:57:59.765Z sur **bun 1.2.13** (win32 x64)._

Les chiffres sont le **temps par itération** mesuré avec [mitata](https://github.com/evanwashere/mitata). Plus bas = mieux. `ops/s` est le débit dérivé.

- **slowdown** — combien de fois plus lent que le plus rapide du même scénario (1.00× = gagnant).
- Les challengers sont suffixés `[hoisted]` (matcher/compiler construit une fois, réutilisé) ou `[inline]` (reconstruit à chaque appel).

## Résumé

| Scénario | Gagnant | matchigo le plus rapide | slowdown matchigo |
| :------- | :----- | ---------------: | ----------------: |
| A — Littéral simple (~5 chaînes) | native switch (3.63 ns) | matchigo compile() [hoisted] (7.63 ns) | 2.10× |
| B — Alternatives (a\|b\|c par règle) | matchigo compile() [hoisted] (10.30 ns) | matchigo compile() [hoisted] (10.30 ns) | **1.00×** (gagnant) |
| C — Guards (tranches d'âge) | native if/else (3.11 ns) | matchigo compile() [hoisted] (10.62 ns) | 3.42× |
| D — Shape matching (union discriminée) | native switch on kind (5.12 ns) | matchigo compile() [hoisted] (20.11 ns) | 3.93× |
| E — Débit : classification de 100 éléments | native map + ternary (189.75 ns) | matchigo matcher() + map [hoisted] (685.35 ns) | 3.61× |
| F — Vrai cold path — règles reconstruites à chaque appel | native switch (3.75 ns) | matchigo matcherWalk() [hoisted] (13.81 ns) | 3.68× |
| G — Empilement d'intersection (number raffiné) | native predicate (4.56 ns) | matchigo compile() [hoisted] (26.79 ns) | 5.87× |
| H — Forme profondément imbriquée (4 niveaux + discriminant) | native if/else chain (4.82 ns) | matchigo compile() [hoisted] (48.95 ns) | 10.16× |
| I — Raffinements de chaîne (regex + includes + length) | native if/else chain (32.85 ns) | matchigo matcher() [hoisted] (62.40 ns) | 1.90× |
| J — Négation (P.not sur domaine mixte) | native != null (3.47 ns) | matchigo compile() [hoisted] (9.59 ns) | 2.76× |

## Scénarios

### Scénario A — Littéral simple (~5 chaînes)

> Dispatch sur un petit ensemble de chaînes littérales. Les challengers hoistés pré-construisent leur dispatcher ; les inline reconstruisent à chaque appel. ts-pattern n'a pas d'API de hoist, donc seule sa forme inline est mesurée.

| Rang | Challenger | avg | p50 | p99 | ops/s | slowdown |
| ---: | :-------- | --: | --: | --: | ----: | -------: |
| 1 | native switch | 3.63 ns | 3.00 ns | 7.18 ns | 275.15 Mops/s | **1.00×** (gagnant) |
| 2 | **matchigo compile() [hoisted]** | 7.63 ns | 6.91 ns | 10.28 ns | 131.11 Mops/s | 2.10× |
| 3 | **matchigo matcher() [hoisted]** | 7.69 ns | 6.76 ns | 10.74 ns | 130.11 Mops/s | 2.11× |
| 4 | **matchigo match(v, rules) [inline]** | 11.15 ns | 9.57 ns | 15.26 ns | 89.66 Mops/s | 3.07× |
| 5 | **matchigo matcherWalk() [hoisted]** | 17.48 ns | 15.55 ns | 27.42 ns | 57.21 Mops/s | 4.81× |
| 6 | ts-pattern [inline] | 127.56 ns | 81.05 ns | 375.07 ns | 7.84 Mops/s | 35.10× |
| 7 | match-iz against() [hoisted] | 227.00 ns | 161.25 ns | 502.34 ns | 4.41 Mops/s | 62.46× |
| 8 | match-iz match() [inline] | 336.66 ns | 358.11 ns | 531.71 ns | 2.97 Mops/s | 92.63× |

### Scénario B — Alternatives (a|b|c par règle)

> Chaque règle accepte plusieurs valeurs (P.union / sucre tableau). Même découpage hoisted/inline que A.

| Rang | Challenger | avg | p50 | p99 | ops/s | slowdown |
| ---: | :-------- | --: | --: | --: | ----: | -------: |
| 1 | **matchigo compile() [hoisted]** | 10.30 ns | 9.59 ns | 15.26 ns | 97.07 Mops/s | **1.00×** (gagnant) |
| 2 | **matchigo matcher() [hoisted]** | 10.38 ns | 9.20 ns | 14.87 ns | 96.34 Mops/s | 1.01× |
| 3 | **matchigo match(v, rules) [inline]** | 15.25 ns | 14.92 ns | 18.68 ns | 65.59 Mops/s | 1.48× |
| 4 | match-iz against() [hoisted] | 192.12 ns | 129.03 ns | 523.90 ns | 5.21 Mops/s | 18.65× |
| 5 | match-iz match() [inline] | 263.42 ns | 179.25 ns | 468.53 ns | 3.80 Mops/s | 25.57× |
| 6 | ts-pattern [inline] | 610.09 ns | 623.17 ns | 830.22 ns | 1.64 Mops/s | 59.22× |

### Scénario C — Guards (tranches d'âge)

> Matching par prédicat, sensible à l'ordre (Senior → Adult → Young).

| Rang | Challenger | avg | p50 | p99 | ops/s | slowdown |
| ---: | :-------- | --: | --: | --: | ----: | -------: |
| 1 | native if/else | 3.11 ns | 2.95 ns | 5.22 ns | 322.05 Mops/s | **1.00×** (gagnant) |
| 2 | **matchigo compile() [hoisted]** | 10.62 ns | 9.16 ns | 14.97 ns | 94.18 Mops/s | 3.42× |
| 3 | **matchigo matcher() [hoisted]** | 11.55 ns | 10.06 ns | 14.97 ns | 86.59 Mops/s | 3.72× |
| 4 | **matchigo match(v, rules) [inline]** | 17.33 ns | 17.60 ns | 22.95 ns | 57.70 Mops/s | 5.58× |
| 5 | ts-pattern [inline] | 40.27 ns | 21.78 ns | 156.64 ns | 24.83 Mops/s | 12.97× |
| 6 | match-iz against() [hoisted] | 233.80 ns | 169.75 ns | 520.58 ns | 4.28 Mops/s | 75.30× |
| 7 | match-iz match() [inline] | 300.61 ns | 226.32 ns | 556.91 ns | 3.33 Mops/s | 96.81× |

### Scénario D — Shape matching (union discriminée)

> Types algébriques à la Rust : dispatch sur un champ `kind`. L'exhaustivité est vérifiée à la compilation pour matchigo et ts-pattern.

| Rang | Challenger | avg | p50 | p99 | ops/s | slowdown |
| ---: | :-------- | --: | --: | --: | ----: | -------: |
| 1 | native switch on kind | 5.12 ns | 4.71 ns | 7.84 ns | 195.30 Mops/s | **1.00×** (gagnant) |
| 2 | **matchigo compile() [hoisted]** | 20.11 ns | 19.78 ns | 33.15 ns | 49.73 Mops/s | 3.93× |
| 3 | **matchigo matcher().exhaustive() [hoisted]** | 20.52 ns | 20.09 ns | 31.18 ns | 48.74 Mops/s | 4.01× |
| 4 | **matchigo match(v, rules) [inline]** | 26.69 ns | 26.03 ns | 39.60 ns | 37.47 Mops/s | 5.21× |
| 5 | ts-pattern .exhaustive() [inline] | 132.48 ns | 81.96 ns | 389.21 ns | 7.55 Mops/s | 25.87× |
| 6 | match-iz against() [hoisted] | 250.73 ns | 184.20 ns | 556.01 ns | 3.99 Mops/s | 48.97× |
| 7 | match-iz match() [inline] | 338.53 ns | 361.77 ns | 527.15 ns | 2.95 Mops/s | 66.12× |

### Scénario E — Débit : classification de 100 éléments

> Application d'un matcher sur un tableau. Débit plutôt que latence par appel. Seule la forme hoistée réaliste est montrée pour les libs qui la supportent.

| Rang | Challenger | avg | p50 | p99 | ops/s | slowdown |
| ---: | :-------- | --: | --: | --: | ----: | -------: |
| 1 | native map + ternary | 189.75 ns | 153.88 ns | 451.29 ns | 5.27 Mops/s | **1.00×** (gagnant) |
| 2 | **matchigo matcher() + map [hoisted]** | 685.35 ns | 625.68 ns | 1.11 µs | 1.46 Mops/s | 3.61× |
| 3 | ts-pattern + map [inline] | 1.15 µs | 1.10 µs | 1.32 µs | 0.873 Mops/s | 6.04× |
| 4 | match-iz against() + map [hoisted] | 13.54 µs | 13.48 µs | 13.97 µs | 0.0739 Mops/s | 71.33× |
| 5 | match-iz match() + map [inline] | 19.01 µs | 18.54 µs | 20.31 µs | 0.0526 Mops/s | 100.20× |

### Scénario F — Vrai cold path — règles reconstruites à chaque appel

> Le vrai pire cas pour matchigo : tableau de règles frais / nouvelle instance de matcher à chaque appel, ce qui casse le cache WeakMap. ts-pattern et match-iz inline() paient toujours ce coût par design, donc ils sont inchangés. Ça isole « combien coûte l'étape de compile de matchigo quand on ne peut pas l'amortir ? » du coût de dispatch.

| Rang | Challenger | avg | p50 | p99 | ops/s | slowdown |
| ---: | :-------- | --: | --: | --: | ----: | -------: |
| 1 | native switch | 3.75 ns | 3.52 ns | 4.83 ns | 266.77 Mops/s | **1.00×** (gagnant) |
| 2 | **matchigo matcherWalk() [hoisted]** | 13.81 ns | 15.89 ns | 25.17 ns | 72.42 Mops/s | 3.68× |
| 3 | **matchigo matchWalk(v, rules) [cold, no compile]** | 25.54 ns | 15.94 ns | 177.17 ns | 39.15 Mops/s | 6.81× |
| 4 | **matchigo matcherWalk() [cold, new builder/call]** | 43.79 ns | 24.32 ns | 174.85 ns | 22.84 Mops/s | 11.68× |
| 5 | ts-pattern [inline] | 118.44 ns | 85.67 ns | 302.88 ns | 8.44 Mops/s | 31.60× |
| 6 | **matchigo compile() [cold, new fn/call]** | 272.86 ns | 201.59 ns | 464.09 ns | 3.66 Mops/s | 72.79× |
| 7 | **matchigo matcher() [cold, new builder/call]** | 278.16 ns | 226.39 ns | 484.38 ns | 3.60 Mops/s | 74.20× |
| 8 | match-iz match() [inline] | 338.67 ns | 361.77 ns | 529.20 ns | 2.95 Mops/s | 90.35× |
| 9 | **matchigo match(v, rules) [cold, new array/call]** | 360.37 ns | 256.71 ns | 632.32 ns | 2.77 Mops/s | 96.14× |

### Scénario G — Empilement d'intersection (number raffiné)

> Empile P.number & P.positive & P.integer & P.between(0, 100) pour raffiner un number via quatre étapes chaînées. ts-pattern utilise P.intersection ; match-iz retombe sur un prédicat écrit à la main.

| Rang | Challenger | avg | p50 | p99 | ops/s | slowdown |
| ---: | :-------- | --: | --: | --: | ----: | -------: |
| 1 | native predicate | 4.56 ns | 4.35 ns | 7.03 ns | 219.21 Mops/s | **1.00×** (gagnant) |
| 2 | **matchigo compile() [hoisted]** | 26.79 ns | 22.12 ns | 66.94 ns | 37.33 Mops/s | 5.87× |
| 3 | **matchigo matcher() [hoisted]** | 30.96 ns | 29.81 ns | 43.29 ns | 32.30 Mops/s | 6.79× |
| 4 | **matchigo match(v, rules) [inline]** | 33.58 ns | 32.01 ns | 54.61 ns | 29.78 Mops/s | 7.36× |
| 5 | **matchigo matchWalk(v, rules) [cold]** | 37.60 ns | 33.13 ns | 56.84 ns | 26.60 Mops/s | 8.24× |
| 6 | match-iz against() [hoisted] | 198.64 ns | 158.57 ns | 413.13 ns | 5.03 Mops/s | 43.54× |
| 7 | match-iz match() [inline] | 283.21 ns | 217.19 ns | 469.12 ns | 3.53 Mops/s | 62.08× |
| 8 | ts-pattern [inline] | 2.42 µs | 2.41 µs | 2.67 µs | 0.414 Mops/s | 529.63× |

### Scénario H — Forme profondément imbriquée (4 niveaux + discriminant)

> Le pattern descend sur quatre niveaux (kind → target → page → meta.verified). Mesure le coût du parcours récursif d'objet pendant le dispatch.

| Rang | Challenger | avg | p50 | p99 | ops/s | slowdown |
| ---: | :-------- | --: | --: | --: | ----: | -------: |
| 1 | native if/else chain | 4.82 ns | 3.93 ns | 8.42 ns | 207.52 Mops/s | **1.00×** (gagnant) |
| 2 | **matchigo compile() [hoisted]** | 48.95 ns | 47.78 ns | 65.45 ns | 20.43 Mops/s | 10.16× |
| 3 | **matchigo matcher() [hoisted]** | 49.32 ns | 49.02 ns | 54.71 ns | 20.28 Mops/s | 10.23× |
| 4 | **matchigo match(v, rules) [inline]** | 52.42 ns | 52.00 ns | 56.67 ns | 19.08 Mops/s | 10.88× |
| 5 | **matchigo matchWalk(v, rules) [cold]** | 82.18 ns | 77.54 ns | 110.86 ns | 12.17 Mops/s | 17.05× |
| 6 | ts-pattern [inline] | 266.38 ns | 236.50 ns | 515.87 ns | 3.75 Mops/s | 55.28× |
| 7 | match-iz against() [hoisted] | 388.29 ns | 405.32 ns | 593.16 ns | 2.58 Mops/s | 80.58× |
| 8 | match-iz match() [inline] | 530.97 ns | 525.29 ns | 693.99 ns | 1.88 Mops/s | 110.19× |

### Scénario I — Raffinements de chaîne (regex + includes + length)

> Cinq règles ordonnées qui mélangent P.regex, P.includesStr, P.minLengthStr et P.lengthStr. Exerce la famille de raffinements de chaîne ajoutée dans cette release.

| Rang | Challenger | avg | p50 | p99 | ops/s | slowdown |
| ---: | :-------- | --: | --: | --: | ----: | -------: |
| 1 | native if/else chain | 32.85 ns | 32.54 ns | 36.01 ns | 30.44 Mops/s | **1.00×** (gagnant) |
| 2 | **matchigo matcher() [hoisted]** | 62.40 ns | 61.52 ns | 77.64 ns | 16.03 Mops/s | 1.90× |
| 3 | **matchigo compile() [hoisted]** | 63.28 ns | 62.82 ns | 70.36 ns | 15.80 Mops/s | 1.93× |
| 4 | **matchigo match(v, rules) [inline]** | 65.20 ns | 65.19 ns | 73.07 ns | 15.34 Mops/s | 1.98× |
| 5 | **matchigo matchWalk(v, rules) [cold]** | 74.86 ns | 70.90 ns | 96.17 ns | 13.36 Mops/s | 2.28× |
| 6 | match-iz against() [hoisted] | 331.36 ns | 280.98 ns | 521.14 ns | 3.02 Mops/s | 10.09× |
| 7 | match-iz match() [inline] | 484.25 ns | 497.51 ns | 647.14 ns | 2.07 Mops/s | 14.74× |
| 8 | ts-pattern [inline] | 3.28 µs | 3.27 µs | 3.45 µs | 0.305 Mops/s | 99.88× |

### Scénario J — Négation (P.not sur domaine mixte)

> Dispatch à règle unique de P.not(P.nullish) sur un flux de types mélangés. Mesure le coût d'un raffinement négué comparé à un simple `!= null`.

| Rang | Challenger | avg | p50 | p99 | ops/s | slowdown |
| ---: | :-------- | --: | --: | --: | ----: | -------: |
| 1 | native != null | 3.47 ns | 3.15 ns | 6.37 ns | 288.42 Mops/s | **1.00×** (gagnant) |
| 2 | **matchigo compile() [hoisted]** | 9.59 ns | 9.28 ns | 14.38 ns | 104.32 Mops/s | 2.76× |
| 3 | **matchigo matcher() [hoisted]** | 11.38 ns | 10.89 ns | 17.26 ns | 87.91 Mops/s | 3.28× |
| 4 | **matchigo match(v, rules) [inline]** | 13.85 ns | 13.26 ns | 16.85 ns | 72.19 Mops/s | 4.00× |
| 5 | **matchigo matchWalk(v, rules) [cold]** | 23.54 ns | 21.31 ns | 64.94 ns | 42.48 Mops/s | 6.79× |
| 6 | match-iz against() [hoisted] | 151.93 ns | 119.51 ns | 334.01 ns | 6.58 Mops/s | 43.82× |
| 7 | match-iz match() [inline] | 211.66 ns | 156.08 ns | 422.53 ns | 4.72 Mops/s | 61.05× |
| 8 | ts-pattern [inline] | 271.79 ns | 230.35 ns | 472.14 ns | 3.68 Mops/s | 78.39× |

---

_Pour tourner toi-même : `bun run bench` (ou `bun run bench:node`, `bun run bench:deno`)._
