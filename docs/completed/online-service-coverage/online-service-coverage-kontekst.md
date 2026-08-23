# Kontekst: Zasięg usługi (lokalna / online / hybryda)

**Branch:** `feature/online-service-coverage`
**Ostatnia aktualizacja:** 2026-08-22

## Źródła

- Requirements doc: [docs/brainstorms/2026-08-19-uslugi-online-zasieg-requirements.md](../../brainstorms/2026-08-19-uslugi-online-zasieg-requirements.md)
- Plan techniczny: [docs/plans/2026-08-19-001-feat-online-service-coverage-plan.md](../../plans/2026-08-19-001-feat-online-service-coverage-plan.md)

> Sekcja „Designerski kontekst" pominięta świadomie: plan techniczny ma `design_md: null`,
> `figma_spec: null`, `figma_screens: {}`. Feature to w większości reuse istniejących komponentów
> (`SectionHeader`, `Badge`, `ButtonCategory`, `EmptyState`), więc buildery UI pracują na wzorcach
> z repo. Brak `docs/DESIGN.md` w projekcie — do utworzenia przed następnym większym UI feature'em.

## Powiązane pliki

### Warstwa danych

| Plik | Rola w zadaniu |
|---|---|
| `src/db/schema.ts` | Nowy `coverageEnum`; `coverage` na `servicesTable`; zdjęcie `notNull` z `latitude`/`longitude` |
| `drizzle/` | **Nie dotyka tego zadania.** Katalog jest martwy — schemat aplikujemy `npx drizzle-kit push` |
| `src/lib/queries.ts` | `coverage` do selektów w `getServices` **i** `getMostPopular` (zduplikowane selecty) |
| `src/types/index.ts` | `Service.latitude`/`longitude` → `number \| null`; nowe `Service.coverage` |
| `src/db/seed.ts` | R12 — backfill zasięgu; wpisy referencyjne `online` i `hybrid` |

### Warstwa URL

| Plik | Rola w zadaniu |
|---|---|
| `src/lib/slug-mappings.ts` | `COVERAGE_ONLINE_SLUG`, `isOnlineSlug`; `online` **nie** wchodzi do `CATEGORY_SLUGS` |
| `src/lib/map-slug-parser.ts` | `MapFilters.onlineOnly`; `online` w slocie lokalizacji, maks. 2 segmenty bez zmian |
| `src/lib/map-url-builder.ts` | `buildMapUrl` wypełnia ten sam slot co county/city |

### UI

| Plik | Rola w zadaniu |
|---|---|
| `src/lib/service-coverage.ts` | **Nowy** — czysta funkcja kubełkowania (R4, R5, R6) |
| `src/app/[locale]/(main)/_components/services-client-component.tsx` | 681 linii; podmiana filtrowania na wywołanie funkcji kubełkowania |
| `src/app/[locale]/(main)/_components/map-list/map-list.tsx` | Trzecia sekcja wzorcem sekcji embeddingów |
| `src/app/[locale]/(main)/_components/filter-component.tsx` | Chip „Online"; `resetAllFilters` musi zerować `onlineOnly` |
| `src/app/[locale]/(main)/_components/mobile-filter-modal.tsx` | Ładowany dynamicznie (`ssr: false`) — łatwo pominąć |
| `src/app/[locale]/(main)/_components/overview-map/utility.ts` | Filtrowanie w `createPoints` |
| `src/app/[locale]/(main)/_components/overview-map/overview-map.tsx` | Empty state przy `points.length === 0` |
| `src/app/[locale]/(main)/_components/service-card/service-card.tsx` | 666 linii; badge zasięgu + naprawa gardów |
| `src/app/[locale]/(main)/_components/marker-popup.tsx` | Te same założenia o współrzędnych |
| `messages/{pl,en,ru,uk}.json` | Każdy nowy klucz w **czterech** plikach |

### Dashboard

| Plik | Rola w zadaniu |
|---|---|
| `src/app/[locale]/(dashboard)/dashboard/_service-schema.ts` | **Nowy w U2** — `serviceSchema`, `parseRawServiceData`; czysty, testowalny bez bazy |
| `src/app/[locale]/(dashboard)/dashboard/_actions.ts` | Server Actions; `coverage` w insercie i update'cie |
| `src/app/[locale]/(dashboard)/dashboard/_components/service-form.tsx` | Select zasięgu; warunkowa gwiazdka przy współrzędnych |
| `src/app/[locale]/(dashboard)/dashboard/_components/services-table.tsx` | Kolumna zasięgu |

### SEO

| Plik | Rola w zadaniu |
|---|---|
| `src/app/sitemap.ts` | `/mapa/online` + `/en/map/online`; **bez** kombinacji kategoria×online |
| `src/app/[locale]/(main)/map/[[...slug]]/page.tsx` | `onlineOnly` w `titleSuffix`, `canonical`, `languages` |

### Odblokowanie weryfikacji

| Plik | Rola w zadaniu |
|---|---|
| `src/components/ui/badge/index.ts` | **Nowy** barrel — naprawia błąd typecheck |
| `src/components/ui/button/index.ts` | **Nowy** barrel — naprawia błąd typecheck |

## Wzorce do naśladowania

- **Trzecia sekcja listy** → `map-list.tsx:263` (sekcja `embeddingResults`): `SectionHeader`
  + pętla po usługach + `cardIndex++`. Ten sam wzorzec, ta sama tablica `allServices`.
- **Nawigacja filtra** → `filter-component.tsx:110` (`handleCategoryClick`) i `navigateWithFilters`:
  `buildMapUrl` + `localizeMapPath` + `window.history.pushState` bez nawigacji.
- **Wartości enuma w Zod** → `_service-schema.ts`: `coverageValues = coverageEnum.enumValues`
  (wydzielone z `_actions.ts` w U2). Bez ręcznego duplikatu listy.
- **Dodatkowe oznaczenie na karcie** → `VerifiedBadge` (`service-card.tsx:401`) jako wzorzec
  umiejscowienia badge'a zasięgu.
- **Kształt testu** → `src/components/ui/badge/badge.test.tsx`: Jest + RTL + `jest-axe`
  z `expect.extend(toHaveNoViolations)`.
- **Empty state** → `src/app/[locale]/(main)/_components/map-list/empty-state.tsx`.
- **Kształt enuma** → `statusEnum` / `categoryEnum` w `src/db/schema.ts`.

## Decyzje techniczne

Pełne uzasadnienia w planie technicznym, sekcja „Kluczowe decyzje techniczne". Skrót:

1. **`coverage` na `servicesTable`, nie na `serviceLocationsTable`** — zasięg opisuje ofertę firmy,
   nie punkt. Firma z dwoma biurami obsługująca zdalnie ma jeden zasięg i dwa piny.
2. **`innerJoin` w `getServices` zostaje** — requirements doc zakładał `leftJoin`, planowanie
   ustaliło, że jest niepotrzebny: `service_locations` niesie wymagany `slug` i `city` z R9,
   więc wiersz lokalizacji istnieje zawsze. Nullowalne są tylko współrzędne.
3. **`openingHours` zostaje `notNull`** — dla wpisu zdalnego `{}`; `getTodayHours` zwraca wtedy
   `null`, a karta renderuje blok godzin pod `{todayHours && (...)}` (`service-card.tsx:480`).
   Zero migracji, zero zmiany w karcie.
4. **Bez zmian w `/api/services`** — sekcja online buduje się klienckim filtrem z listy, którą
   komponent już ma. Wyniki embeddingowe wchodzą tylko do reguły deduplikacji.
5. **Logika kubełkowania jako czysta funkcja w `src/lib/`** — nie inline w komponencie na 681 linii.
   Bez `import 'server-only'` (używa jej Client Component).
6. **Dedupe względem listy lokalnej ∪ `embeddingResults`** — inaczej usługa zdalna wyciągnięta
   przez semantic search pokaże się dwa razy na jednym ekranie.
7. **`online` w slocie lokalizacji URL, nie trzeci segment** — `parseMapSlug` zostaje przy limicie
   2 segmentów. `/mapa/pomorskie/online` odpada istniejącą ścieżką; nie dopisywać reguły odrzucania.
8. **Piny wyklucza się w `createPoints`, nie w `MapFilters`** — clustering, `bounds` i `supercluster`
   bez zmian. `hybrid` dostaje pin automatycznie, bez wyjątku w kodzie.
9. **Sortowanie w sekcji online przychodzi darmo** — `getServices` już sortuje po `priority`
   i `clicks`; kubełkowanie tylko filtruje, zachowując kolejność. Nie dodawać własnego sortowania.
10. **`Weryfikacja:` wyłącznie CLI** — brak `.env.e2e`, więc scenariusze przeglądarkowe są
    `[Manual]` w `Operator checklist`.

## Zależności

### Techniczne

- **Lokalna baza:** `docker-compose up -d` (Postgres + pgvector).
- **Schemat na bazie:** `npx drizzle-kit push`. **NIE** `drizzle:generate` — skrypt jest martwy,
  a snapshoty w `drizzle/meta` w ruinie (rozbiór w `zadania.md`, U1).
- **OpenAI API:** `npm run db:embeddings` dla nowych wpisów — inaczej nie wyjdą w semantic search.
- **Brak `.env.e2e`** — automatyczne E2E niedostępne w tym projekcie.

### Sekwencjonowanie

```
U0 ──► U1 ──┬──► U2 ──► (dashboard gotowy)
            ├──► U3 ──► (dane referencyjne)
            ├──► U5 ──┬──► U6 ──► U9
            │         └──► U7
            └──► U8

U4 ─────────┴──► (niezależny, może iść równolegle z Fazą 1–2; wymagany przez U5, U6, U9)
```

## Baseline weryfikacji (zmierzony 2026-08-20, po U0)

Fakty ustalone przez faktyczne uruchomienie, nie założone. Istotne dla każdego kolejnego unitu.

- **`npx tsc --noEmit` → 0 błędów.** Czysty baseline osiągnięty w U0.
- **`npx jest` → 91/91, ale tylko 2 suity w całym repo:** `badge` i `button`. Poza nimi projekt
  **nie ma żadnych testów**. Każdy plik testowy w tym planie (`service-coverage.test.ts`,
  `map-slug-parser.test.ts`, `map-url-builder.test.ts`, `sitemap.test.ts`, testy komponentów)
  będzie **pierwszym testem w swoim obszarze** — nie ma lokalnego wzorca do skopiowania poza
  `badge.test.tsx`.
- **`npx next lint` → exit 0, ale dziesiątki preegzystujących warningów** (`no-explicit-any`,
  `no-console`, `no-unused-vars`) m.in. w `src/lib/queries.ts`, `src/lib/scripts.ts`,
  `src/types/index.ts`. Osiągalny próg to **zero błędów**, nie zero warningów — checkboxy
  `Weryfikacja:` są tak sformułowane celowo. Nie traktować warningów jako blokady, ale też
  nie dodawać nowych.
- **`jest-axe` nie sprawdza realnie kontrastu.** jsdom nie implementuje `canvas.getContext`,
  więc reguła `color-contrast` nie wykonuje się — 16 testów kontrastu w `badge.test.tsx`
  przechodzi próżno. Asercje `jest-axe` w nowych testach mają wartość dla struktury i ARIA,
  **nie dla kontrastu kolorów**. Kontrast wymaga weryfikacji w przeglądarce (krok `Operator:`).

## Dziennik wykonania

### U0 — czysty baseline typecheck (commit `c40d10c`, docs `18a9c1e`)

Założenie planu było błędne: brakujące barrele maskowały niespójność API `Badge`, nie tylko brak
modułu. Rozstrzygnięcie: `children` jako główne API (shadcn/ui), `label` jako opcjonalny override
z priorytetem — cztery produkcyjne call site'y zachowały identyczne wyjście. Naprawiony bug
produkcyjny: `pricing/page.tsx` pokazywał „Empty" zamiast przetłumaczonego tekstu.
Dług do przeglądu: `role="status"` + `tabIndex={0}` na każdym badge'u (wymóg testów).

### U1 — `coverage` + nullowalne współrzędne (commit `f7e7b87`)

**Potwierdzone w kodzie:** decyzja 2 z tego dokumentu (`innerJoin` zostaje) okazała się słuszna —
nie było potrzeby ruszania joinów. Decyzja 3 (`openingHours` bez migracji) też się utrzymała.

**Skala skutków nullowalności:** 15 błędów typecheck w 5 plikach. Dwa z nich były poza planem
(`src/lib/map-utils.ts` — przeoczony; `src/app/api/services/route.ts` — objęty zbyt mocno
sformułowaną granicą scope'u). Pozostałe 10 w plikach U7/U8, wchłonięte do U1 decyzją użytkownika,
bo „nullowalne współrzędne" nie da się zamknąć jako samodzielny zielony commit.

**Reguła na przyszłość:** zmiana nullowalności kolumny jest z natury cross-cutting. Przy kolejnym
takim ruchu planować ją jako jeden unit razem z konsumentami, nie rozbijać na fazy — inaczej repo
nie kompiluje się między commitami, `git bisect` traci sens, a quality gate z `CLAUDE.md` blokuje
commitowanie.

**Zmiana schematu zaaplikowana przez `npx drizzle-kit push`** — nie przez migrację. Potwierdzone
zapytaniem do bazy: enum `coverage` w poprawnej kolejności, kolumna `NOT NULL DEFAULT 'local'`,
współrzędne nullowalne, `slug` nadal `NOT NULL` (co potwierdza decyzję 2), 127 istniejących usług
= `local`, oba indeksy na współrzędnych na miejscu.

**Odkrycie o skali projektu, nie tylko tego zadania: katalog `drizzle/` jest martwy.**
`generate` jest w tym repo nieużywalny — pełny rozbiór w `zadania.md`. Najkrócej: najnowszy snapshot
zna 2 z 4 enumów, nie zna tabeli `service_locations`, `_journal` kończy się na `0013` przy istniejącej
migracji `0014`, do snapshotu wyciekł alias Drizzle jako „tabela", a `0000` ma błąd składni.
`county` to relikt po forku `abroad-services` (hrabstwa irlandzkie). Projekt żyje na `push` —
widać to w `db:reset`. **`CLAUDE.md` opisuje ścieżkę `generate` → `push`, która nie działa** —
do sprostowania, inaczej każda kolejna sesja powtórzy ten sam objazd.

### U2 + U3 — Faza 2 (commity `25b3c08`, `0702eeb`)

**Wydzielono `_service-schema.ts`** — czysta warstwa walidacji. Wymuszone testowalnością:
`src/db/index.ts` tworzy klienta postgres przy ładowaniu modułu, więc `_actions.ts` nie da się
zaimportować w teście bez otwierania połączenia. `@/db/schema` jest bezpieczny.

**Dwa bugi ze współrzędnymi `0,0` — oba preegzystujące, nie wprowadzone tą zmianą:**
`z.coerce.number()` zamieniał `null` i `''` z `FormData` na `0` (zgłoszenie bez współrzędnych →
pin w Zatoce Gwinejskiej), a `getServiceById` robił `?? 0`, więc formularz edycji utrwalał
fałszywy pin. Oba naprawione.

**Współrzędne wymagane też dla `hybrid`** — plan mówił tylko o `local`, ale `hybrid` ma pin (R3).

**`openingHours: {}` było już domyślne** dla każdej nowej usługi — decyzja 3 potwierdzona w kodzie.

**Reguła o testach w tym repo:** wzorzec `z.string().optional().or(z.literal(''))`, użyty dla
każdego pola opcjonalnego, **nie przyjmuje `null`**, a `formData.get()` zwraca `null` dla pola
pominiętego. Builder `FormData` w teście musi podawać wszystkie pola jako `''`, bo tak zachowuje
się realny formularz. Dotyczy każdego przyszłego testu tego schematu.

**Seed nigdy nie był idempotentny** — zero `delete`/`TRUNCATE`/`onConflictDoNothing` w 3447 liniach.
Opiera się na `db:drop`. Powtórne `db:seed` na zapełnionej bazie wywali się na unikalnym `slug`.
Wymóg z planu skorygowany, nie zrealizowany.

### U4 — warstwa URL (commit `1dc0c67`)

Rozstrzygnięte dwa odroczone pytania: `onlineOnly` **czyści** województwo i miasto (dzielą jeden
slot ścieżki, więc są wzajemnie wykluczające) i jest **wymaganym** booleanem, bez stanu `undefined`.
To nie koliduje z R5 — tam sekcja online jest widoczna przy aktywnym filtrze województwa, ale to
zachowanie *sekcji listy*, nie filtra `onlineOnly`. Dwie różne rzeczy, łatwe do pomylenia.

Nowy bug preegzystujący: `filter-component.tsx` hardkoduje prefiks `/en` dla każdego locale poza
`pl` (dwa miejsca), więc na `ru` i `uk` klik filtra **przełącza użytkownikowi język**. Poza scope'em.

### U5 + U6 — kubełkowanie i sekcja listy (commity `c567f3d`, `27d8ec7`, `112913a`)

**Ograniczenie, które kształtuje kod:** `localResults` nie może zależeć od wyników semantycznych,
bo jego długość steruje fetchem embeddingów — powstałby cykl. Dlatego
`splitServicesByCoverage` jest wołana **dwa razy**: raz bez odejmowania (lista lokalna), raz
z odejmowaniem (sekcja online). Nie „optymalizować" tego do jednego wywołania.

**Testy komponentów były w tym repo niemożliwe do uruchomienia.** Dwie luki środowiska, obie
naprawione w `112913a`: `lucide-react` publikuje ESM dla warunku `browser` (a `next/jest` nadpisuje
`transformIgnorePatterns`, więc pomaga tylko `moduleNameMapper` na build CJS), oraz jsdom nie ma
`ResizeObserver`, którego wymaga `virtua`. Każdy przyszły test komponentu korzysta z tych napraw.

**Reguła na przyszłość dla testów listy:** `useMediaQuery` startuje od `false`, więc pierwszy render
idzie ścieżką desktopową przez `virtua`, a w jsdom kontener ma zerową wysokość — zbiór zamontowanych
elementów jest **niedeterministyczny**. Nie asercjonować długości `cardRefs`; celować w DOM.

## Pułapki (świadome, udokumentowane)

- **`z.coerce.number()` na pustym stringu daje `0`, nie `null`** — najbardziej prawdopodobne źródło
  cichego buga. Wpis zdalny ze współrzędnymi `0,0` dostałby pin w Zatoce Gwinejskiej i przeszedłby
  wszystkie testy typów. U2 pisany test-first.
- **`null !== undefined` jest `true`** — gardy w `service-card.tsx:251,286` przepuszczą `null`
  po U1. To regresja wprowadzana przez ten plan, nie problem preegzystujący. U8 ją zamyka.
- **Zakaz `!` i `as` przy nullowalnych współrzędnych** — zgodnie z `coding-rules.md`. Zawężać
  przez filtrowanie przed mapowaniem, nie przez asercję.
- **`cardIndex` wspólny dla trzech sekcji** — rozjechanie psuje refy, scroll i rozwijanie kart.
- **`resetAllFilters` musi zerować `onlineOnly`** — inaczej „Resetuj" zostawi aktywny filtr,
  a URL rozjedzie się ze stanem.
- **Klucz i18n brakujący w jednym locale to runtime error, nie fallback** — każdy nowy klucz
  do czterech plików.
- **Sitemapa emituje kategorie tylko dla `pl` i `en`** — utrzymać tę konwencję, nie „naprawiać"
  jej po cichu w U9.

## Znane długi techniczne (poza zakresem, nie naprawiamy)

- **Cztery źródła prawdy o kategoriach, już rozjechane:** `categoryEnum` w `schema.ts` (13),
  `categories` w `src/lib/consts.ts` (14, z `government`), `CATEGORY_KEYS` w `slug-mappings.ts`
  (14, z `government`), lokalna tablica w `service-form.tsx:17` (13). Kategoria `government`
  jest osiągalna w UI i w URL-ach, ale **niezapisywalna** — nie istnieje w enumie.
  **Nie wolno dodać zasięgu piątym takim źródłem** — `coverage` czerpiemy z `coverageEnum.enumValues`.
- **`getServices` i `getMostPopular` mają zduplikowane selecty** — kolumnę dodać w obu.
- **`services-client-component.tsx` (681 linii) i `service-card.tsx` (666 linii)** przekraczają
  próg 300 z `coding-rules.md`. Ten plan ich nie refaktoruje, ale wyprowadza nową logikę
  do `src/lib/`, żeby nie pogłębiać problemu.
- **`docs/solutions/` jest puste** — brak wiedzy instytucjonalnej do wykorzystania.
  Pierwszy wpis po `/dev-compound`.
