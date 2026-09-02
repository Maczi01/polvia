# Pipeline dev-* — dokumentacja (web / Next.js)

Data adaptacji: 2026-08-19
Źródło: compound-engineering-plugin, zaadaptowane z wariantu mobile (Expo) na stack **Next.js 15 App Router + React 19 + TypeScript + Tailwind v3 + shadcn/ui + Drizzle ORM/Postgres + next-intl**.

---

## Pipeline — przegląd

```
/dev-ideate → /dev-brainstorm → /dev-plan → /dev-docs → /dev-docs-execute ↔ /dev-docs-review → /dev-docs-complete → /dev-compound
                                                                                                                        ↓
                                                       dev-autopilot-wf (orkiestruje execute↔review→complete→compound)
                                                                                                          /dev-compound-refresh
```

Skille `dev-*` mogą być wywoływane programowo przez inne skille i agenty (bez `disable-model-invocation`).
Każdy skill działa BEZ argumentów (wyciąga kontekst z sesji). Argumenty są opcjonalne.

### Faza implementacji jako Dynamic Workflows

Część pipeline'u jest zaimplementowana jako **Dynamic Workflows** — deterministyczne orkiestratory w JavaScript w `.claude/workflows/*.js` (suffix `-wf`, żeby uniknąć kolizji nazw ze skillami). Orkiestrator trzyma plan i sterowanie w kodzie, a buildery i reviewerzy to **leaf-agenci** wołani przez `agentType`.

| Workflow | Plik | Co robi |
|----------|------|---------|
| `dev-autopilot-wf` | `.claude/workflows/dev-autopilot-wf.js` | Autonomiczny pipeline: bootstrap → per faza (execute → review → adversarial verify → fix) → complete → compound. Stan w `docs/active/<zadanie>/.autopilot-state.json`. |
| `dev-docs-execute-wf` | `.claude/workflows/dev-docs-execute-wf.js` | Wykonanie JEDNEJ fazy: planner czyta Implementation Units z `docs/plans/`, buildery `feature-builder-web-*` implementują je przez `agentType`, potem walidacja + commit + aktualizacja dokumentacji. |
| `dev-docs-review-wf` | `.claude/workflows/dev-docs-review-wf.js` | Code review jednej fazy: 6 reviewerów równolegle (+ E2E) → dedup → adversarial verify każdego P1/P2 → scribe zapisuje raport + bookkeeping checkboxów `Weryfikacja:` → severity gate. |
| `dev-docs-complete-wf` | `.claude/workflows/dev-docs-complete-wf.js` | Archiwizacja: `docs/active/<zadanie>` → `docs/completed/`, podsumowanie, aktualizacja dokumentacji projektu. |
| `dev-compound-wf` | `.claude/workflows/dev-compound-wf.js` | Dokumentuje rozwiązane problemy z sesji do `docs/solutions/` (tryb compact) i ocenia rule-worthy do `.claude/rules/learned-patterns.md`. |

**Git walidujesz w sesji PRZED odpaleniem autopilota** — workflow nie pyta o branch switch.

Skille fazy discovery/planowania (`/dev-ideate`, `/dev-brainstorm`, `/dev-plan`, `/dev-docs`, `/dev-docs-update`, `/dev-compound-refresh`) pozostają zwykłymi skillami — nie mają wariantu `-wf`.

---

## Skille i workflowy — co robi każdy

### Faza discovery

#### `/dev-ideate`
**Cel:** Generowanie pomysłów na ulepszenia projektu.
**Jak działa:** 4 agenty skanują projekt z różnych perspektyw (tech debt, UX, performance, product), potem Devil's Advocate filtruje słabe pomysły.
**Output:** `docs/ideation/YYYY-MM-DD-topic-ideation.md`
**Następny krok:** `/dev-brainstorm [wybrany pomysł]`

#### `/dev-brainstorm`
**Cel:** Walidacja i doprecyzowanie pomysłu — CO budować.
**Jak działa:** Interaktywny dialog, jedno pytanie na raz, pressure test. Scope: SEO/metadata, SSR/RSC, Core Web Vitals, cache i rewalidacja, i18n (4 locale), WCAG, rate limiting.
**Output:** `docs/brainstorms/YYYY-MM-DD-topic-requirements.md`
**Następny krok:** `/dev-plan`

### Faza planowania

#### `/dev-plan`
**Cel:** Planowanie techniczne — JAK budować.
**Jak działa:** Szuka requirements doc w `docs/brainstorms/`, skanuje repo (agenty research), tworzy Implementation Units. Każdy IU ma `Delegate to:` (builder web) i scenariusze `[E2E]` do weryfikacji w przeglądarce.
**Output:** `docs/plans/YYYY-MM-DD-NNN-type-name-plan.md`
**Następny krok:** `/dev-docs`

#### `/dev-docs`
**Cel:** Struktura zarządzania zadaniem do implementacji.
**Output:** `docs/active/[nazwa]/` z: plan.md, kontekst.md, zadania.md + branch `feature/[nazwa]`
**Następny krok:** `dev-autopilot-wf docs/active/[nazwa]` lub `/dev-docs-execute docs/active/[nazwa]`

### Faza implementacji

#### `dev-autopilot-wf docs/active/[nazwa]`
**Cel:** Automatyczne wykonanie WSZYSTKICH faz z review i naprawami.
**Jak działa:** Czyta plan, buduje `PlanState` i kolejkę faz. Per faza: `dev-docs-execute-wf` → `dev-docs-review-wf` → (przy P1/P2) cykl fix. Po wszystkich fazach: `dev-docs-complete-wf` + `dev-compound-wf`.
**Bootstrap:** rozgrzewka cache `jest` (self-skip, gdy brak jest) + środowisko E2E (gdy istnieje `.env.e2e` — patrz `.claude/templates/e2e-env/README.md`).
**Output:** Kod + archiwum w `docs/completed/` + wpis w `docs/solutions/`
**Stop conditions:** P1 po cyklu fix (limit cykli fix = 1), błąd typecheck/testów/buildu, git conflict, środowisko E2E niegotowe przy istniejącym `.env.e2e`.

#### `/dev-docs-execute docs/active/[nazwa]` (workflow: `dev-docs-execute-wf`)
**Cel:** Wykonanie jednej fazy implementacji.
**Jak działa:** Planner czyta IU z planu. Każdy IU delegowany przez `agentType` do buildera z pola `Delegate to:` (`feature-builder-web-ui` | `feature-builder-web-data` | `feature-builder-web-fullstack`). Dla IU UI/fullstack doklejany jest mandatory kontekst designerski. Po zakończeniu: System-Wide Test Check, aktualizacja checkboxów, incremental commits.
**Walidacja:** `npx tsc --noEmit` → `npx jest <ścieżki>` → `npx next lint`; `npm run build` gdy faza dotyka routingu, metadanych, `next.config.ts` lub granicy server/client.

#### `/dev-docs-review docs/active/[nazwa] [numer-fazy]` (workflow: `dev-docs-review-wf`)
**Cel:** Code review wykonanej fazy.
**Jak działa:** 6 reviewerów równolegle (Security, Performance, Architecture, TypeScript, Spec-compliance, Simplicity) + osobny agent E2E. Potem dedup → adversarial verify każdego P1/P2 → scribe zapisuje raport i robi bookkeeping checkboxów `Weryfikacja:` → severity gate: P1 (blokuje) / P2 (zastrzeżenia) / P3 (OK).
**Weryfikacja E2E:** Agent `feature-tester-web-e2e` — **chrome-devtools MCP** w prawdziwej przeglądarce (Playwright/Cypress nie są zainstalowane). Preflight: dev server na `:3000` (`curl` → 200/307) + `docker ps` dla bazy. Asercje po roli i dostępnej nazwie ze snapshotu drzewa dostępności; błąd JS w konsoli = fail. Scenariusze i18n weryfikowane na ≥2 locale.
**Output:** `docs/active/[nazwa]/review-faza-X.md` + checkboxy do poprawy w zadaniach

#### `/dev-docs-update docs/active/[nazwa]`
**Cel:** Zapisanie stanu pracy przed resetem kontekstu (kompaktowanie).
**Output:** Zaktualizowana dokumentacja + WIP commit

### Faza zamknięcia

#### `/dev-docs-complete [nazwa]` (workflow: `dev-docs-complete-wf`)
**Cel:** Archiwizacja ukończonego zadania.
**Output:** `docs/completed/[nazwa]/` z podsumowaniem
**Następny krok:** `/dev-compound`

### Knowledge capture

#### `/dev-compound` (workflow: `dev-compound-wf`)
**Cel:** Dokumentowanie rozwiązanego problemu do bazy wiedzy.
**Output:** `docs/solutions/[category]/YYYY-MM-DD-title.md` + opcjonalnie reguła w `.claude/rules/learned-patterns.md`
**Kategorie:** build-errors, runtime-errors, database-issues, auth-issues, ui-bugs, performance-issues, typescript-errors, deployment-issues, testing-issues

#### `/dev-compound-refresh`
**Cel:** Przegląd aktualności bazy wiedzy (Keep / Update / Replace / Archive), utrzymanie `learned-patterns.md` (limit ~50 reguł).

---

## Agenty — kto co robi

### Buildery web (używane przez `dev-docs-execute-wf`)

| Agent | Rola | Wybierany gdy IU dotyka |
|-------|------|------------------------|
| `feature-builder-web-ui` | Server/Client Components, Tailwind v3 + shadcn, next-intl, Storybook, dostępność (jest-axe) | `*.tsx` w `src/app/**`, `src/components/**`, `src/hooks/**`, `messages/*.json` |
| `feature-builder-web-data` | Schema Drizzle + migracje, queries (`server-only`), Server Actions, route handlers z rate limitingiem, Zod, `env.ts` | `src/db/**`, `src/lib/**`, `src/app/api/**/route.ts`, `_actions.ts`, `drizzle/**` |
| `feature-builder-web-fullstack` | Feature cross-layer (formularz + Server Action, CRUD end-to-end) | Mix UI i danych, gdy podział byłby sztuczny |

### Tester E2E (używany przez `dev-docs-review-wf`)

| Agent | Rola |
|-------|------|
| `feature-tester-web-e2e` | Weryfikuje scenariusze `Weryfikacja:` w przeglądarce przez **chrome-devtools MCP**: nawigacja, interakcje, formularze, i18n, błędy konsoli, dostępność, visual diff ze screenami referencyjnymi (bez auto pixel-diff). |

### Research (używane przez `/dev-plan`)

| Agent | Rola |
|-------|------|
| `repo-research-analyst` | Skanuje strukturę repo, konwencje, wzorce |
| `learnings-researcher` | Szuka w `docs/solutions/` powiązanych rozwiązań |
| `best-practices-researcher` | Best practices online |
| `framework-docs-researcher` | Dokumentacja frameworków (Next.js, React, Drizzle, next-intl, Tailwind) |

### Review (używane przez `dev-docs-review-wf`)

| Agent | Rola |
|-------|------|
| `security-sentinel` | Autoryzacja w Server Actions/route handlerach, SQL injection w Drizzle, XSS/MDX, SSRF, rate limiting, sekrety w `env.ts`, `NEXT_PUBLIC_` |
| `performance-oracle` | N+1 w Drizzle, indeksy, cache/`revalidate`, bundle, granica RSC/Client, `next/dynamic` |
| `kieran-typescript-reviewer` | Type safety, brak `any`/`as`/`!`, discriminated unions, explicit return types |
| `architecture-strategist` | Warstwy App Routera, granice server/client, coupling, circular deps |
| `spec-flow-analyzer` | Zgodność ze spec/IU: under-implementation, scope creep, błędna implementacja |
| `code-simplicity-reviewer` | YAGNI, redundancja, uproszczenia |

---

## Struktura katalogów

```
docs/
├── brainstorms/              ← requirements docs z /dev-brainstorm
├── plans/                    ← plany techniczne z /dev-plan
├── ideation/                 ← pomysły z /dev-ideate
├── decisions/                ← decyzje architektoniczne projektu
├── active/                   ← aktywne zadania z /dev-docs
│   └── [nazwa-zadania]/
│       ├── [nazwa]-plan.md
│       ├── [nazwa]-kontekst.md
│       └── [nazwa]-zadania.md
├── completed/                ← zarchiwizowane z /dev-docs-complete
│   └── [nazwa-zadania]/
│       └── + [nazwa]-podsumowanie.md
└── solutions/                ← rozwiązane problemy z /dev-compound
    ├── build-errors/
    ├── runtime-errors/
    ├── database-issues/
    ├── auth-issues/
    ├── ui-bugs/
    ├── performance-issues/
    ├── typescript-errors/
    ├── deployment-issues/
    ├── testing-issues/
    └── _archived/
```

---

## Typowe scenariusze użycia

### 1. Nowy feature od zera
```
/dev-ideate                              ← „co można poprawić?"
/dev-brainstorm filtry usług             ← doprecyzuj wybrany pomysł
/dev-plan                                ← plan techniczny (IU z Delegate to: builder web)
/dev-docs                                ← struktura zadań
/dev-docs-execute docs/active/filtry     ← faza 1
/dev-docs-review docs/active/filtry 1    ← review (6 reviewerów + E2E w przeglądarce)
/dev-docs-complete filtry                ← archiwizacja
```

### 2. Bugfix z dokumentacją
```
/bugfix [opis bugu]                      ← root cause → fix
/dev-compound                            ← udokumentuj do docs/solutions/
```

### 3. Szybki feature (bez pełnego pipeline'u)
```
[rozmowa + plan mode]
/dev-docs
/dev-docs-execute docs/active/nazwa
/dev-docs-complete nazwa
```

### 4. Maintenance bazy wiedzy
```
/dev-compound-refresh                    ← przejrzyj wszystkie docs/solutions/
/dev-compound-refresh database-issues     ← tylko jedna kategoria
```

### 5. Pełny autopilot
```
/dev-brainstorm → /dev-plan → /dev-docs
[zwaliduj git/branch w sesji]            ← autopilot nie pyta o branch switch
[opcjonalnie: setup .env.e2e]            ← .claude/templates/e2e-env/README.md
dev-autopilot-wf docs/active/nazwa
```

---

## Skille stackowe i pomocnicze

| Skill | Kiedy |
|-------|-------|
| `nextjs-stack-guidelines` | **Pierwszy przystanek** przy implementacji — konwencje repo (RSC/Client, i18n, Drizzle, env.ts, Tailwind v3, testy) |
| `security` | Audyt bezpieczeństwa (OWASP, autoryzacja, sekrety, SSRF) |
| `code-review` | Review PR / fazy z klasyfikacją problemów |
| `code-quality` | Audyt jakości: architektura, performance, prostota, wzorce |
| `bugfix` | Systematyczna naprawa buga (root cause przed fixem) |
| `gemini` | Druga opinia AI przez Gemini CLI (wymaga zainstalowanego `gemini`) |
| `zroastuj-mnie` | Krytyczny przegląd bez owijania w bawełnę |
