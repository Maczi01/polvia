---
title: "Slug jako publiczny adres: jedna reguła przed backfillem, push pyta o truncate, notNull odsłania inserty"
date: 2026-11-01
category: database-issues
severity: high
stack:
  - Drizzle
  - Postgres
  - Supabase
tags:
  - slug
  - backfill
  - drizzle-kit-push
  - unique-constraint
  - notNull
  - slugify
status: verified
last_verified: 2026-11-01
---

# Slug jako publiczny adres: jedna reguła przed backfillem, push pyta o truncate, notNull odsłania inserty

## Symptomy

Wdrożenie kolumny `services.slug` (adres profilu `/firma/<slug>`) na produkcyjnej bazie ze 179 wpisami:

- **Rozjazd reguł.** Seed zapisywał bazę slugu lokalizacji (`multi-cook-warszawa`), backfill liczył slug z nazwy (`multi-cook`), a `db:add` brał jawny `slug` z JSON. Po `db:reset` adresy, które poszły już do outreachu i do Google, zmieniłyby się.
- **Dwa formaty.** Zod przyjmował `^[a-z0-9-]+$`, a middleware `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Slug `abc-` przechodził zapis, a profil dawał 404.
- **`npx drizzle-kit push`** pyta: *„You're about to add services_slug_unique unique constraint to the table, which contains 179 items… Do you want to truncate services table?”*
- **Dry-run backfillu** pokazał `easy-warsztat-samochodowy-or-avtoservis`: znak `|` w nazwie slugify zamienia na `or`.
- **Zmiana na `.unique().notNull()`** dała `TS2769: Property 'slug' is missing` w trzech insertach: `dashboard/_actions.ts`, `add-it-deweloper.ts`, `seed-example.ts`. Dodawanie firmy z dashboardu po cichu tworzyło wpis bez adresu.

## Root Cause

Slug był traktowany jak szczegół techniczny, a jest **publicznym, niezmiennym identyfikatorem**. Każda ścieżka zapisu liczyła go po swojemu. `slugify` ma `charMap`, które zamienia symbole na słowa (`|` daje `or`, `&` daje `and`). Pytanie `push` o truncate to domyślny prompt drizzle-kit przy dodawaniu `UNIQUE` do niepustej tabeli. Nie znaczy, że truncate jest potrzebny.

## Rozwiązanie

1. **Jedna reguła i jeden format, zanim ruszy backfill na produkcji:**
   - `createServiceSlugAllocator` (`src/db/service-slugs.ts`) liczy slug z `name`, z sufiksami `-2`, `-3`. Używają go seed, backfill i `db:add` (`planNewServiceSlug` z zajętymi slugami z bazy).
   - Format jest w `src/lib/service-slug-format.ts`, module bez zależności, importowanym przez zod i middleware.
   - Test: `serviceSlugBase(x)` zawsze przechodzi `isValidServiceSlug`. Nazwa bez liter daje `firma`.
2. **`push`: zawsze „No, add the constraint without truncating”.** Nowa kolumna ma same `NULL`, a `NULL` nie łamie `UNIQUE` w Postgresie. „Yes” kasuje wszystkie wpisy.
3. **Backfill: najpierw `--dry-run`, przejrzeć listę.** Brzydkie slugi poprawiać zmianą nazwy, bo slug zawsze liczy się z nazwy: w seedzie (`|` zamienione na `–`) i jednorazowo w bazie.

   ```sql
   -- SQL Editor w Supabase (psql na Windowsie: patrz Kontekst)
   UPDATE services SET name = 'EASY Warsztat Samochodowy – Автосервис',
                       slug = 'easy-warsztat-samochodowy-avtoservis'
   WHERE slug = 'easy-warsztat-samochodowy-or-avtoservis';
   -- + polska nazwa w services_translations
   ```
4. **`.notNull()` dopiero, gdy typecheck przechodzi.** Zmiana typu wymusza `slug` w każdym `insert(servicesTable)`, więc kompilator wylistuje ścieżki zapisu bez adresu. Napraw je, potem drugi `push`.

## Komendy diagnostyczne

```bash
npm run db:backfill-slugs -- --dry-run       # lista "slug <- nazwa" bez zapisu
npx tsc --noEmit                             # po .notNull(): wszystkie inserty bez slugu
```

```sql
SELECT count(*) FROM services WHERE slug IS NULL;
SELECT slug FROM services WHERE slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$';   -- 0 wierszy
```

## Zapobieganie

- Kolumna publicznego adresu (slug, handle) ma jedną funkcję przydziału i jeden predykat formatu, wspólne dla wszystkich ścieżek zapisu i dla walidacji w routingu. Ustal je przed pierwszym zapisem na produkcji.
- Dry-run backfillu publicznych identyfikatorów zawsze przegląda człowiek. Szukaj `-or-`, `-and-` i zdublowanych nazw z `-2`.
- Prompt `drizzle-kit push` o truncate przy `UNIQUE` na nowej kolumnie: zawsze „No”.
- Dodając nullowalną kolumnę „na czas backfillu”, od razu sprawdź `.notNull()` w typecheck. Pokaże inserty, które będą produkować `NULL` po backfillu.

## Powiązane

- `docs/solutions/database-issues/2026-08-22-drizzle-generate-nieuzywalny-snapshoty.md`: dlaczego `push`, a nie `generate`.
- `docs/completed/strona-firmy-premium/strona-firmy-premium-podsumowanie.md` (otwarte: slug w dashboardzie, potem `notNull`).
- `docs/completed/strona-firmy-premium/review-faza-1.md` (#5, #6).

## Kontekst

Drizzle 0.39, drizzle-kit `push` na produkcyjnej bazie Supabase (`DATABASE_URL` = produkcja). Slugi: `slugify` w trybie strict.

**psql na Windowsie z URL Supabase:**
- parametr `?pgbouncer=true` jest nieznany dla libpq,
- bez `PGCLIENTENCODING=UTF8` cyrylica i półpauza zapisują się w kodowaniu Windows,
- jednorazowy SQL prościej wykonać w SQL Editorze Supabase.

Commity: `16f505b` (reguła i format), `b98c497` (nazwy warsztatów).
