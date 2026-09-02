---
name: nextjs-stack-guidelines
description: "Hub stack guidelines dla tego projektu (Next.js 15 App Router + React 19 + TypeScript + Tailwind v3 + shadcn/ui + Drizzle/Postgres + next-intl). Konwencje RSC vs Client Component, i18n routing, Server Actions vs Route Handlers, Drizzle queries, env.ts, testy Jest/RTL/jest-axe, Storybook. Uzywaj na poczatku kazdej rozmowy o implementacji w tym repo, przy 'jak to zrobic w Next', 'dodaj strone', 'dodaj tabele', 'dodaj komponent'."
---

# Stack Guidelines — Next.js 15 + Drizzle + next-intl

Ten skill jest **pierwszym przystankiem** przy implementacji w tym repo. Opisuje konwencje, ktore
faktycznie obowiazuja w kodzie (nie ogolne best practices z internetu). Gdy kod i ten dokument
sie rozjada — **kod ma racje**, zaktualizuj dokument.

## Detekcja stacku

Jestes w tym projekcie gdy: `next.config.ts` + `drizzle.config.ts` + `src/app/[locale]/` + `messages/*.json`.
To **aplikacja webowa** (SSR/RSC na Vercelu). Nie ma React Native, Expo, Supabase ani Sentry —
jesli propozycja rozwiazania zaklada ktoregos z nich, jest bledna dla tego repo.

## Mapa repo

| Sciezka | Co tam jest |
|---|---|
| `src/app/[locale]/(main)`, `(header)`, `(dashboard)` | Route groups. Strony + kolokowane `_components/`, `_actions.ts` |
| `src/app/api/<endpoint>/route.ts` | Route handlers (POST/GET), rate limiting, walidacja Zod |
| `src/app/action/index.ts` | Server actions wspoldzielone |
| `src/components/` | Komponenty globalne; `src/components/ui/<nazwa>/` = shadcn (new-york, lucide) |
| `src/db/` | `schema.ts` (Drizzle), `index.ts` (klient `db`), `aliases.ts`, `seed.ts`, `generate-embeddings.ts` |
| `src/lib/` | `queries.ts` (`server-only`), `redis.ts`, `resend.ts`, `consts.ts`, `utilities.ts` (`cn`) |
| `src/i18n/` | `routing.ts`, `navigation.ts`, `request.ts`, `config.ts` |
| `src/hooks/` | Hooki klienckie (`use-*.ts`) |
| `messages/` | `pl.json` (default), `en.json`, `ru.json`, `uk.json` |
| `drizzle/` | Wygenerowane migracje SQL |
| `content/` | MDX: `posts/`, `terms/` |

## Zasady, ktore lamie sie najczesciej

### 1. RSC domyslnie, `'use client'` tylko gdy trzeba
Server Component to default. `'use client'` dodajesz **wylacznie** gdy komponent uzywa stanu, efektow,
event handlerow, `window`/`document` lub hooka klienckiego. Fetch danych rob w Server Component przez
`@/lib/queries` — nie przez `useEffect` + `fetch` do wlasnego API.

### 2. i18n: nigdy `next/link` ani `next/navigation` bezposrednio
```ts
// DOBRZE — locale-aware
import { Link, useRouter, usePathname, redirect } from '@/i18n/navigation';
// ZLE — gubi prefix locale, psuje /mapa vs /map rewrite z middleware.ts
import Link from 'next/link';
```
Teksty: `useTranslations()` w Client Component, `await getTranslations()` w Server Component.
**Kazdy nowy string dodajesz do WSZYSTKICH czterech plikow w `messages/`** — brak klucza w jednym
locale to runtime error next-intl, nie fallback.

PL jest locale domyslnym bez prefixu (`/mapa/...`), pozostale z prefixem (`/en/map/...`).
`src/middleware.ts` ma reczne rewrite'y dla `/mapa/**` i redirect 301 z `/map/**` — przy dodawaniu
lokalizowanych sciezek sprawdz, czy nie trzeba tam wpisu.

### 3. Env tylko przez `env.ts`
```ts
import { env } from '@/../env';   // @t3-oss/env-nextjs + Zod
```
Zero `process.env.X` w kodzie aplikacji. Nowa zmienna = wpis w `server`/`client` **oraz** w `runtimeEnv`.

### 4. Drizzle: query w `src/lib/queries.ts`, nie w komponencie
`queries.ts` ma `import 'server-only'` — to granica warstwy. Komponent wola funkcje query, nie `db`.
Zmiana schematu: edytuj `src/db/schema.ts` → `npm run drizzle:generate` (plik w `drizzle/`) →
`npm run drizzle:push` na lokalnym Postgresie z docker-compose. **Nigdy nie edytuj wygenerowanego SQL recznie.**
Zero konkatenacji user inputu do `sql` — parametryzowane wyrazenia Drizzle albo `sql` z placeholderami.

### 5. Server Action vs Route Handler
- **Server Action** (`_actions.ts` z `'use server'`) — mutacja wywolywana z formularza/komponentu tego repo. Zawsze: walidacja Zod na wejsciu + `revalidatePath` po mutacji.
- **Route Handler** (`src/app/api/**/route.ts`) — endpoint dla zewnetrznych konsumentow (webhook, fetch z klienta, cron). Zawsze: walidacja Zod + rate limiting przez `@/lib/redis`.

Wzorzec rate limitingu jest juz w `src/app/api/submit-contact-query/route.ts` — kopiuj go, nie wymyslaj nowego.

### 6. Tailwind v3 (nie v4) + shadcn
`tailwind.config.ts` istnieje i obowiazuje (v3 — brak `@theme`, brak CSS-first config).
Klasy warunkowe przez `cn()` z **`@/lib/utilities`**.

> **Gotcha:** `components.json` deklaruje alias `utils: "@/lib/utils"`, ale plik nazywa sie
> `utilities.ts`. Kod dodany przez `npx shadcn add` bedzie mial zly import — popraw na `@/lib/utilities`.

### 7. Komponent = folder gdy ma testy/stories
```
src/components/ui/badge/
  badge.tsx           # cva + VariantProps + cn
  badge.test.tsx      # Jest + RTL + jest-axe (expect.extend(toHaveNoViolations))
  badge.stories.tsx   # Storybook 8
```
Komponenty kolokowane z routem ida do `_components/` przy tej stronie.

### 8. Formatowanie i importy
Prettier: `singleQuote`, `tabWidth: 4`, `printWidth: 100`, `arrowParens: 'avoid'`, `trailingComma: 'all'`.
ESLint wymusza `simple-import-sort` (importy sortowane automatycznie), `unicorn`, `tailwindcss`,
`eslint-plugin-drizzle`, `no-console: warn`. Nie obchodz regul — popraw kod.

## Komendy walidacji

```bash
npx tsc --noEmit           # typecheck (brak skryptu npm)
npx jest <sciezka>         # testy (brak skryptu "test" w package.json!)
npx next lint              # lint calosci
npx eslint <plik> --fix    # lint pojedynczego pliku
npm run build              # pelny build Next (najciezszy, na koniec)
npm run storybook          # Storybook na :6006
```

Baza lokalna: `docker-compose up -d` → `npx tsx sequential-migrate.ts` → `npm run db:seed`.
`npm run db:reset` = drop + push + seed (**niszczy dane lokalne**).

## Czego w tym repo nie ma — nie proponuj

| Brak | Zamiast tego |
|---|---|
| Supabase, RLS | Drizzle + Postgres, autoryzacja w kodzie |
| Sentry | `no-console: warn`; brak zewnetrznego error trackingu (jesli potrzebny — decyzja produktowa, nie side-effect refaktoru) |
| Playwright / Cypress | E2E przez chrome-devtools MCP (`feature-tester-web-e2e`) |
| skrypt `npm test` | `npx jest` |
| Tailwind v4 | v3 + `tailwind.config.ts` |
| Auth provider | Dashboard nie ma dzis warstwy auth — nie zakladaj `session`/`user` bez sprawdzenia |
