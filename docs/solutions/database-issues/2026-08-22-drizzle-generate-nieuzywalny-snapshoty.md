---
title: "drizzle-kit generate nieużywalny — martwy skrypt npm i snapshoty w ruinie"
date: 2026-08-22
category: database-issues
severity: high
stack:
  - Drizzle ORM
  - drizzle-kit
  - Postgres
tags:
  - migracje
  - drizzle-kit
  - snapshots
  - schema
  - fork
status: verified
last_verified: 2026-08-22
---

# drizzle-kit generate nieużywalny — martwy skrypt npm i snapshoty w ruinie

## Symptomy

Procedura zmiany schematu opisana w `CLAUDE.md` (`schema.ts` → `drizzle:generate` →
`drizzle:push`) nie działa na żadnym etapie.

**1. Skrypt npm nic nie robi:**

```
$ npm run drizzle:generate
> drizzle-kit generate:pg
This command is deprecated, please use updated 'generate' command
```

Żaden plik migracji nie powstaje — tylko ostrzeżenie o deprecacji.

**2. Poprawna komenda zadaje lawinę pytań:**

```
$ npx drizzle-kit generate
Is coverage enum created or renamed from another enum?
❯ + coverage          create enum
  ~ county › coverage rename enum
```

Po odpowiedzi to samo pytanie dla `status`, potem dla `voivodeship`, a następnie:

```
Is service_locations table created or renamed from another table?
❯ + service_locations                               create table
  ~ contact_submissions › service_locations         rename table
  ~ services_translations_alias › service_locations rename table
```

Drizzle nie zna **głównej tabeli aplikacji** i proponuje przemianowanie na nią aliasu Drizzle.

## Root Cause

Katalog `drizzle/` jest martwym balastem po forku (`package.json` ma `"name": "abroad-services"`).
Snapshoty rozjechały się ze schematem tak dalece, że `generate` traktuje istniejącą bazę jako
pustą:

- `drizzle/meta/0013_snapshot.json` (najnowszy) zna **2 z 4** enumów: `category` i `county`.
  Brakuje `status` i `voivodeship`, bo powstały przez `push`, który nie tworzy snapshotów.
- `_journal.json` kończy się na `0013`, a `0014_add_services_id_sequence.sql` dopisano
  **ręcznie, bez snapshotu**.
- Snapshot nie zna tabeli `service_locations`.
- Do snapshotu wyciekł **alias Drizzle** (`services_translations_alias` z `src/db/aliases.ts`)
  jako kandydat na tabelę.
- `drizzle/0000_opposite_dark_beast.sql` ma **błąd składni**: `'grocery', 'grocery' 'transport'`
  (brak przecinka), więc nigdy nie zaaplikował się czysto.
- Enum `county` to relikt po forku — hrabstwa irlandzkie (`Antrim`, `Armagh`, `Dublin`,
  `Galway`…), zastąpione przez `voivodeship`.

Wynikiem `generate` byłaby migracja próbująca **utworzyć od zera** typy i tabele już istniejące
w bazie: nieaplikowalna (`already exists`) i opisująca nieprawdę o jej stanie.

## Rozwiązanie

**Zmiany schematu aplikuj przez `push`, nie `generate`:**

```bash
npx drizzle-kit push
```

`push` porównuje `schema.ts` z **żywą bazą**, nie ze snapshotem, więc generuje dokładnie
potrzebne `ALTER`-y i działa od razu, bez pytań:

```
[✓] Pulling schema from database...
[✓] Changes applied
```

Potwierdzenie, że projekt od początku żyje na `push`, jest w samym `package.json`:

```json
"db:reset": "npm run db:drop && npm run drizzle:push && npm run db:seed"
```

`db:reset` **nie woła** `generate`.

**Zawsze weryfikuj wynik zapytaniem do bazy**, nie ufaj komunikatowi `Changes applied`:

```sql
SELECT e.enumlabel FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
 WHERE t.typname = 'coverage' ORDER BY e.enumsortorder;

SELECT column_name, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name = 'services' AND column_name = 'coverage';

SELECT indexname FROM pg_indexes
 WHERE tablename = 'service_locations' AND indexname LIKE '%itude%';
```

## Komendy diagnostyczne

```bash
# Ktore enumy zna najnowszy snapshot (a ktorych nie)
node -e "const s=require('./drizzle/meta/0013_snapshot.json'); console.log(Object.keys(s.enums||{}))"

# Czy journal zgadza sie z plikami migracji
node -e "const j=require('./drizzle/meta/_journal.json'); console.log(j.entries.length, j.entries.at(-1).tag)"
ls drizzle/*.sql | wc -l

# Ktore typy w ogole powstaly przez migracje
grep -rn "CREATE TYPE" drizzle/*.sql
```

## Zapobieganie

- **`drizzle-kit generate` wymaga prawdziwego TTY** — pytania o rename/create obsługuje
  biblioteka promptów, której nie da się nakarmić przez `printf '\n' |`, a `--help` nie
  ma flagi nieinteraktywnej. W środowisku bez TTY komenda po prostu zawiesza się na pytaniu.
- **Jeśli `generate` pyta o rename, ZATRZYMAJ SIĘ i przeczytaj opcje.** Wybór
  `~ county › coverage rename enum` wygenerowałby `ALTER TYPE county RENAME TO coverage` —
  destrukcyjnie i semantycznie błędnie. Domyślnie podświetlona jest opcja `create`, ale nie
  wolno klikać Enter w ciemno.
- Reset katalogu `drizzle/` (nowy baseline snapshotu zgodny z żywą bazą) to osobne zadanie.
  Dopóki go nie ma, nie generujemy migracji.

## Powiązane

- `docs/solutions/testing-issues/2026-08-22-testy-komponentow-esm-i-resizeobserver.md` —
  druga luka narzędziowa odkryta w tej samej sesji

## Kontekst

Odkryte przy dodawaniu kolumny `coverage` i zdejmowaniu `notNull` ze współrzędnych w zadaniu
`online-service-coverage`. `drizzle-kit` 0.30.5, `drizzle-orm` 0.39.

`CLAUDE.md` opisuje procedurę `generate` → `push` oraz regułę „nigdy nie edytuj wygenerowanego
SQL w `drizzle/`" — oba zdania są mylące, dopóki katalog nie zostanie zresetowany.
