# CLAUDE.md

Ten plik jest instrukcją dla Claude Code (claude.ai/code) przy pracy w tym repozytorium.

## Tech Stack

- **Next.js 15.1** (App Router, RSC) — `next.config.ts`, dev z `--turbo`
- **React 19** + **TypeScript 5** (`strict`)
- **Tailwind CSS 3** (`tailwind.config.ts` — **nie v4**, brak `@theme`) + **shadcn/ui** (style `new-york`, ikony `lucide`)
- **Drizzle ORM 0.39** + **Postgres** (pgvector przez docker-compose lokalnie) + `drizzle-kit`
- **next-intl 4** — 4 locale: `pl` (domyślny, bez prefiksu), `en`, `ru`, `uk`
- **Redis** (`ioredis` + `@upstash/ratelimit`) do rate limitingu
- **Jest 29** + Testing Library + `jest-axe`, **Storybook 8**
- MDX (`content/posts`, `content/terms`), Mapbox, OpenAI (embeddingi), Resend + nodemailer
- Hosting: **Vercel**

> `package.json` ma `"name": "abroad-services"` — to pozostałość po forku, projekt to **polvia**.

## Komendy

```bash
# Development
npm run dev              # Next dev (turbo) na :3000
npm run storybook        # Storybook na :6006

# Quality gate — w tej kolejności
npx tsc --noEmit         # typecheck (NIE MA skryptu npm)
npx jest <ścieżka>       # testy (NIE MA skryptu "npm test")
npx next lint            # lint całości
npx eslint <plik> --fix  # lint jednego pliku

# Produkcja
npm run build            # build Next (najcięższy krok — na koniec)
npm start

# Baza (lokalnie)
docker-compose up -d             # Postgres + pgvector
npx tsx sequential-migrate.ts    # aplikacja migracji z drizzle/
npm run drizzle:push             # zaaplikuj schema na bazę — TO JEST WŁAŚCIWA DROGA
npm run drizzle:generate         # NIE UŻYWAJ (patrz niżej) — snapshoty w drizzle/ są rozjechane
npm run db:seed                  # seed danych
npm run db:reset                 # drop + push + seed — NISZCZY dane lokalne
npm run db:embeddings            # regeneracja embeddingów OpenAI
```

**Znane odchylenia od czystego stanu repo (stan 2026-08-22):** `npx tsc --noEmit` i `npx jest` są zielone. `npx next lint` zwraca zero **błędów**, ale dziesiątki preegzystujących **warningów** (`no-explicit-any`, `no-console`, `no-unused-vars`) — osiągalny próg to zero błędów, nie zero warningów. Pre-commit hook husky jest w całości zakomentowany.

**Katalog `drizzle/` jest martwy.** Snapshoty w `drizzle/meta` rozjechały się ze schematem po forku `abroad-services`: najnowszy zna 2 z 4 enumów, nie zna tabeli `service_locations`, `_journal` kończy się na `0013` przy istniejącej migracji `0014`, a `drizzle/0000` ma błąd składni. `drop-migrate-seed` w `package.json` woła `drizzle:generate` i dlatego nie działał nigdy — używaj `db:reset`. Pełny rozbiór: `docs/solutions/database-issues/2026-08-22-drizzle-generate-nieuzywalny-snapshoty.md`.

## Struktura

```
src/
├── app/
│   ├── [locale]/            # route groups: (main), (header), (dashboard), blog, terms, cookies, thanks
│   │   ├── **/_components/  # komponenty kolokowane z routem
│   │   └── **/_actions.ts   # Server Actions ('use server')
│   ├── api/**/route.ts      # route handlers (kontakt, newsletter, licznik klików, services)
│   ├── action/index.ts      # współdzielone Server Actions
│   ├── globals.css          # Tailwind + zmienne CSS motywu
│   ├── robots.ts, sitemap.ts
├── components/              # komponenty globalne; ui/<nazwa>/ = shadcn
├── db/                      # schema.ts, index.ts (klient `db`), aliases.ts, seed.ts, generate-embeddings.ts
├── hooks/                   # hooki klienckie (use-*.ts)
├── i18n/                    # routing.ts, navigation.ts, request.ts, config.ts
├── lib/                     # queries.ts ('server-only'), redis.ts, resend.ts, consts.ts, utilities.ts (cn)
├── types/                   # wspólne typy
└── middleware.ts            # next-intl + ręczne rewrite'y /mapa/**, redirect 301 /map/**

messages/                    # pl.json (domyślny), en.json, ru.json, uk.json
content/                     # MDX: posts/, terms/
drizzle/                     # wygenerowane migracje SQL
env.ts                       # @t3-oss/env-nextjs (server / client / runtimeEnv)
docs/                        # pipeline dev-* (patrz .claude/docs/dev-pipeline.md)
```

**Path alias:** `@/*` → `src/*`. `env.ts` leży w korzeniu (import `@/../env` albo relatywnie).

## Kluczowe wzorce

### Server vs Client Component
Server Component to domyślny wybór. `'use client'` dodawaj **wyłącznie** gdy komponent używa stanu, efektów, event handlerów lub DOM. Dane pobieraj w Server Component przez funkcje z `@/lib/queries` — nie przez `useEffect` + `fetch` do własnego API.

### i18n — nigdy `next/link` ani `next/navigation`
```ts
// DOBRZE — locale-aware
import { Link, useRouter, usePathname, redirect } from '@/i18n/navigation';
// ŹLE — gubi prefiks locale i psuje rewrite'y z middleware.ts
import Link from 'next/link';
```
Teksty: `useTranslations()` (client) / `await getTranslations()` (server). **Każdy nowy klucz dodaj do wszystkich czterech plików `messages/`** — brak klucza w jednym locale to runtime error, nie fallback.

### Warstwa danych
Query mieszkają w `src/lib/queries.ts` (i siostrzanych modułach) z `import 'server-only'` — to granica warstwy. Komponent woła funkcję query, nie `db`. Zmiana schematu: `src/db/schema.ts` → **`npx drizzle-kit push`**. `push` porównuje schemat z żywą bazą, więc działa poprawnie. **Nie używaj `drizzle:generate`** — snapshoty w `drizzle/` są rozjechane i `generate` wyprodukuje migrację tworzącą od zera obiekty już istniejące w bazie. Jeśli `generate` zapyta o `rename`, zatrzymaj się: wybór `rename` jest destrukcyjny. **Nigdy nie edytuj SQL w `drizzle/` ręcznie.**

### Zasięg usługi to druga oś, nie kategoria

`servicesTable` ma **dwie niezależne osie** opisu wpisu:

- `category` (`categoryEnum`) — **branża**: co firma robi (prawne, zdrowie, finansowe…)
- `coverage` (`coverageEnum`) — **zasięg**: jak obsługuje klienta
  - `local` — tylko na miejscu; ma pin na mapie
  - `online` — tylko zdalnie, brak punktu obsługi; **nie ma pinu**, współrzędne opcjonalne
  - `hybrid` — punkt obsługi **oraz** obsługa zdalna; ma pin i wchodzi do wyników online

**Nie dodawaj `online` jako wartości `categoryEnum`.** Kolumna kategorii jest jednowartościowa, więc prawnik obsługujący zdalnie musiałby zniknąć z filtra „Prawne". Zasięg jest ortogonalny: filtruje się niezależnie i ma własny slug URL (`/mapa/online`, `/mapa/prawne/online`).

Konsekwencje w kodzie: `serviceLocationsTable.latitude`/`longitude` są **nullowalne**; mapa pokazuje piny tylko dla wpisów odwiedzalnych (`createPoints`); wyniki dzieli czysta funkcja `src/lib/service-coverage.ts`.

### Mutacje
- **Server Action** (`_actions.ts` z `'use server'`) — mutacja z UI tego repo. Zawsze: walidacja Zod + sprawdzenie uprawnień + `revalidatePath` po zapisie.
- **Route handler** (`src/app/api/**/route.ts`) — endpoint dla zewnętrznych konsumentów. Zawsze: walidacja Zod + rate limiting (wzorzec: `src/app/api/submit-contact-query/route.ts`).

Server Action jest publicznym endpointem POST — **nie ma RLS, kod jest jedyną bramką autoryzacji.**

### Zmienne środowiskowe
Wyłącznie przez `env.ts`. Zero `process.env` w kodzie aplikacji. Nowa zmienna = wpis w `server`/`client` **oraz** w `runtimeEnv`. Sekret nigdy w `client` ani za prefiksem `NEXT_PUBLIC_`.

### Styling
Klasy warunkowe przez `cn()` z **`@/lib/utilities`**. Warianty przez `cva`. Tokeny (`bg-primary`) nad hexami.

> **Gotcha:** `components.json` deklaruje alias `utils: "@/lib/utils"`, ale plik nazywa się `utilities.ts` — kod z `npx shadcn add` będzie miał zły import.

### Komponenty i testy
Komponent z testem/stories = folder: `nazwa/nazwa.tsx`, `nazwa.test.tsx`, `nazwa.stories.tsx`. Wzorzec bazowy testu: `src/components/ui/badge/badge.test.tsx` (Jest + RTL + `jest-axe` z `expect.extend(toHaveNoViolations)`). Komponent używany przez jeden route → `_components/` przy tym route.

### Formatowanie i lint
Prettier: `singleQuote`, `tabWidth: 4`, `printWidth: 100`, `arrowParens: 'avoid'`, `trailingComma: 'all'`.
ESLint wymusza `simple-import-sort`, `unicorn`, `tailwindcss`, `eslint-plugin-drizzle`, `jsx-a11y`, `no-console: warn`. Nie obchodź reguł — popraw kod.

## Standardy kodu

### Error handling
```typescript
// Guard clauses na górze
if (!input) return { error: { code: 'BAD_INPUT', message: 'Brak danych' } };
if (!authorized) return { error: { code: 'FORBIDDEN', message: 'Brak uprawnień' } };

// Happy path na końcu
return { data };
```
Zero pustych `catch {}`. Typowane błędy, nie stringi. Format odpowiedzi API: `{ data, error: { code, message } }`. Surowy błąd bazy nigdy nie leci do klienta.

### Type safety
Bez `any`, bez `as` (poza narrowingiem DOM), bez `!`. Explicit return types dla eksportowanych funkcji. Zod na granicach systemu. Typy wierszy inferuj ze schematu Drizzle (`InferSelectModel`), nie pisz ręcznie.

### Dostępność
Semantyczny HTML najpierw, ARIA gdy konieczne. Widoczny `focus-visible`, `aria-describedby` dla błędów walidacji, `aria-live` dla dynamicznych komunikatów. Każdy test komponentu ma asercję `jest-axe`.

## Czego w tym repo NIE MA — nie proponuj

| Brak | Zamiast tego |
|------|--------------|
| Supabase, RLS | Drizzle + Postgres, autoryzacja w kodzie serwerowym |
| Sentry / error tracking | logi Vercela i dev servera; `no-console: warn` |
| React Query / TanStack Query | dane z Server Component przez `@/lib/queries` |
| Playwright / Cypress | E2E przez chrome-devtools MCP (`feature-tester-web-e2e`) |
| skrypt `npm test`, `npm run typecheck` | `npx jest`, `npx tsc --noEmit` |
| Tailwind v4 | v3 + `tailwind.config.ts` |
| React Native / Expo | to aplikacja webowa |
| warstwa auth w dashboardzie | **nie istnieje dziś** — nie zakładaj `session`/`user` bez sprawdzenia |

## Pipeline dev-* i skille

Repo ma zainstalowany pipeline compound-engineering: `/dev-ideate` → `/dev-brainstorm` → `/dev-plan` → `/dev-docs` → `/dev-docs-execute` ↔ `/dev-docs-review` → `/dev-docs-complete` → `/dev-compound`, plus `dev-autopilot-wf` jako orkiestrator.

- **Pełna mapa:** `.claude/docs/dev-pipeline.md`
- **Konwencje stacku (pierwszy przystanek przy implementacji):** skill `nextjs-stack-guidelines`
- **Reguły kodowania (ładowane automatycznie):** `.claude/rules/coding-rules.md`
- **Wnioski z rozwiązanych problemów:** `.claude/rules/learned-patterns.md` + `docs/solutions/`
- **Hooki Stop:** typecheck (`stop-build-check-enhanced.sh`) + obsługa błędów (`error-handling-reminder.sh`), podłączone w `.claude/settings.json`

## Quality gate (przed commitem)

1. `npx tsc --noEmit` — zero błędów
2. `npx jest` — wszystkie testy przechodzą
3. `npx next lint` — zero błędów
4. Brak nowych `any`, brak `console.log`, brak sekretów poza `env.ts`
5. Każda nowa funkcja publiczna ma test (happy path + error case)
6. Nowy klucz tłumaczenia obecny we wszystkich `messages/*.json`

Nie commituj, dopóki użytkownik o to nie poprosi.
