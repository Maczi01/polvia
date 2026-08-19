# Kontekst: Zasięg usługi (lokalna / online / hybryda)

**Branch:** `feature/online-service-coverage`
**Ostatnia aktualizacja:** 2026-08-19

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
| `drizzle/` | Migracja **wyłącznie** przez `npm run drizzle:generate` — nigdy ręcznie |
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
| `src/app/[locale]/(dashboard)/dashboard/_actions.ts` | `serviceSchema` — `coverage`, opcjonalne współrzędne, walidacja krzyżowa |
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
- **Wartości enuma w Zod** → `_actions.ts:23`: `categoryValues = categoryEnum.enumValues`.
  `coverage` czerpiemy identycznie — bez ręcznego duplikatu listy.
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
- **Migracje:** `npm run drizzle:generate` → `npm run drizzle:push` (albo `npx tsx sequential-migrate.ts`).
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
