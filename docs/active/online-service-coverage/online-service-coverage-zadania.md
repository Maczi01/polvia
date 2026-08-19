# Zadania: Zasięg usługi (lokalna / online / hybryda)

**Branch:** `feature/online-service-coverage`
**Ostatnia aktualizacja:** 2026-08-19

## Źródła

- Requirements doc: [docs/brainstorms/2026-08-19-uslugi-online-zasieg-requirements.md](../../brainstorms/2026-08-19-uslugi-online-zasieg-requirements.md)
- Plan techniczny: [docs/plans/2026-08-19-001-feat-online-service-coverage-plan.md](../../plans/2026-08-19-001-feat-online-service-coverage-plan.md)

## Legenda

- Bez prefiksu — zadanie implementacyjne
- `Test:` — scenariusz testowy (przeniesiony z planu technicznego)
- `Weryfikacja:` — kryterium automatyczne (CLI); odznaczane przez `/dev-docs-review` po PASS
- `Operator:` — krok wymagający człowieka; **nie** odznaczany automatycznie

> Projekt nie ma `.env.e2e`, więc scenariusze przeglądarkowe są krokami `Operator:`, nie `[E2E]`.
> Utworzenie `.env.e2e` wskazującego na dedykowaną bazę testową zamieniłoby je na automatyczne.

---

## Faza 0 — Odblokowanie weryfikacji

### U0. Czysty baseline typecheck

**Delegate to:** `feature-builder-web-ui` · **Nakład:** S · **Zależności:** brak

> Warunek sensowności całej weryfikacji. Dopóki te 2 błędy istnieją, `npx tsc --noEmit` zawsze
> failuje i żaden checkbox `Weryfikacja:` w tym planie nie da się domknąć.

- [x] Stwórz `src/components/ui/badge/index.ts` — re-eksport publicznego API z `badge.tsx`
- [x] Stwórz `src/components/ui/button/index.ts` — re-eksport publicznego API z `button.tsx`
- [x] Nie modyfikuj plików testowych — brakuje pliku produkcyjnego, nie test jest zły
- [x] `Test:` `button.test.tsx` przechodzi bez zmian w pliku testowym — **8/8 zielone**
- [x] `Weryfikacja:` `npx tsc --noEmit` kończy się zerem błędów — **PASS (exit 0)**
- [x] `Weryfikacja:` `npx eslint` na zmienionych plikach — zero błędów
- [x] `Test:` `badge.test.tsx` przechodzi — **83/83**; jedna zmiana w pliku testowym, uzasadniona niżej
- [x] `Weryfikacja:` `npx jest src/components/ui/badge src/components/ui/button` — **91/91 PASS**

#### U0 okazał się większy, niż założono w planie — zrealizowany, 1 pozycja otwarta

Założenie planu („2 brakujące barrele → czysty typecheck") było **błędne**. Brakujący `index.ts`
maskował niespójność API komponentu `Badge`: cały suite `badge.test.tsx` nie startował
(nierozwiązany moduł), więc 50 failujących testów było ukryte, nie nieistniejące.

**Źródło niespójności** (`badge.tsx`, stan przed zmianą):

1. `BadgeProps.label` był **wymagany**, a implementacja miała dla niego default `label = 'empty'` —
   default na wymaganym propie to martwy kod.
2. `Badge` renderował **wyłącznie `label`** w wewnętrznym `<span>` i **ignorował `children`**
   (jawne JSX children wygrywają z `props.children` przy `{...props}`).
3. Klasy wariantu były na `div`, tekst w `<span>` — testy asercjonują klasy tła na elemencie
   **zawierającym tekst**.
4. Brak `role="status"` i `tabIndex` — wymaganych przez testy ARIA i keyboard.

**Bug produkcyjny naprawiony po drodze:** `src/app/[locale]/(header)/pricing/page.tsx:39` renderuje
`<Badge>{t('recommended')}</Badge>`. Bez `label` i z ignorowanymi `children` użytkownik widział
na stronie cennika napis **„Empty"** zamiast „Polecane". Teraz renderuje poprawny tekst.

**Decyzja (użytkownik):** API oparte na `children`, jak w shadcn/ui. `label` pozostaje
**opcjonalnym override'em z priorytetem nad `children`** — dzięki temu wszystkie cztery produkcyjne
call site'y używające `label=` (`services-table.tsx:84`, `service-card.tsx:436`, `service-card.tsx:562`,
`popular-services-card.tsx:90`) zachowują **identyczne wyjście**, bez żadnej zmiany w tych plikach.

**Wynik:** typecheck **0 błędów**, lint **0 błędów** (same preegzystujące warningi), testy **91/91**.
Commit: `c40d10c` — osobny od feature'a zasięgu, żeby dał się zrewertować niezależnie.

**Jedna zmiana w pliku testowym — decyzja użytkownika, uzasadnienie:**
`badge.test.tsx:111` oczekiwał dla wariantu `red` klas `bg-[#FDE8EC] border-[#F9C4CE]`, a kod ma
`bg-[#FFF0F0] border-[#F5D0D0]`. Asercje dla `green` (`:114`) i `orange` (`:117`) w tym samym teście
zgadzały się z kodem **co do znaku** — czyli paleta czerwonego została kiedyś świadomie zmieniona,
a test nie zaktualizowany. Zaktualizowano oczekiwany hex do obecnego tokenu. To **nie osłabienie
asercji** (nadal sprawdza konkretne klasy tła i obramowania), a alternatywą było cofnięcie palety,
czyli regresja wizualna w całej aplikacji.

**Uwaga a11y do rozważenia osobno:** kontrakt testów wymusił `role="status"` i `tabIndex={0}`
na **każdym** badge'u. `role="status"` to region live — czytnik ekranu zapowiada każdy badge jako
aktualizację; `tabIndex={0}` wstawia każdy badge w kolejność tabulacji. Na mapie karta usługi
ma do 3 badge'ów tagów, więc na liście wyników to dziesiątki przystanków klawiatury i regionów
live. Zaimplementowane zgodnie z testami, ale warte osobnego przeglądu — badge nie jest elementem
interaktywnym.

---

## Faza 1 — Fundament danych

### U1. `coverage` w schemacie + nullowalne współrzędne + typy + zapytania

**Delegate to:** `feature-builder-web-data` · **Nakład:** M · **Zależności:** U0
**Wymagania:** R1, R9

- [ ] `src/db/schema.ts` — `coverageEnum = pgEnum('coverage', ['local', 'online', 'hybrid'])`
- [ ] `src/db/schema.ts` — kolumna `coverage` na `servicesTable`, `notNull().default('local')`
- [ ] `src/db/schema.ts` — zdejmij `notNull()` z `serviceLocationsTable.latitude` i `longitude`
- [ ] `src/db/schema.ts` — **zachowaj** indeksy `idx_location_latitude` / `idx_location_longitude`
- [ ] Wygeneruj migrację: `npm run drizzle:generate` (plik w `drizzle/` — **nigdy** nie edytuj ręcznie)
- [ ] `src/types/index.ts` — `Service.latitude: number | null`, `Service.longitude: number | null`
- [ ] `src/types/index.ts` — `Service.coverage: Coverage`; typ `Coverage` inferowany ze schematu Drizzle
- [ ] `src/lib/queries.ts` — `coverage` do selecta w `getServices`
- [ ] `src/lib/queries.ts` — `coverage` do selecta w `getMostPopular` (**zduplikowany select — nie pomiń**)
- [ ] `src/lib/queries.ts` — **nie zmieniaj** `innerJoin` na `leftJoin` (decyzja 2 w kontekście)
- [ ] Stwórz `src/db/schema.test.ts` — guard na wartości `coverageEnum`
- [ ] Przejrzyj pełną listę błędów z `npx tsc --noEmit` i odnotuj miejsca zakładające `number` (mapa pracy dla U7, U8)
- [ ] `Test:` typ `Coverage` przyjmuje `'local' | 'online' | 'hybrid'` i odrzuca inne wartości
- [ ] `Weryfikacja:` `npx tsc --noEmit` — zero błędów po zaktualizowaniu wszystkich miejsc użycia
- [ ] `Weryfikacja:` `npx jest src/lib src/db` — testy przechodzą
- [ ] `Weryfikacja:` `npx next lint` — zero błędów (`eslint-plugin-drizzle` bez ostrzeżeń)
- [ ] `Weryfikacja:` `git diff --stat drizzle/` pokazuje wyłącznie nowy plik migracji, zero modyfikacji istniejących
- [ ] `Operator:` `npm run drizzle:push` (albo `npx tsx sequential-migrate.ts`) na lokalnej bazie dev
- [ ] `Operator:` potwierdź, że kolumna `coverage` istnieje i ma `'local'` dla wszystkich istniejących wierszy

---

## Faza 2 — Wejście danych

### U2. Zasięg w dashboardzie (formularz + Server Action + Zod)

**Delegate to:** `feature-builder-web-fullstack` · **Nakład:** M · **Zależności:** U1
**Wymagania:** R1, R9

> Najbardziej ryzykowny punkt planu. Pisany **test-first**: najpierw failujący test na puste
> `latitude` z `FormData` (oczekiwane `null`, nie `0`), potem poprawa schematu.

- [ ] `_actions.ts` — `coverageValues = coverageEnum.enumValues`; `coverage: z.enum(coverageValues)`
- [ ] `_actions.ts` — `latitude` / `longitude` z wymaganych na opcjonalne
- [ ] `_actions.ts` — puste wejście z `FormData` daje `null`, **nie `0`** (`z.coerce.number()` na `''` → `0`)
- [ ] `_actions.ts` — `.superRefine()`: `coverage !== 'local'` → `city` wymagane
- [ ] `_actions.ts` — `.superRefine()`: `coverage === 'local'` → współrzędne wymagane
- [ ] `_actions.ts` — `coverage === 'online'` zapisuje `openingHours: {}`
- [ ] `_actions.ts` — błędy walidacji trafiają w konkretne pole, nie w błąd ogólny
- [ ] `service-form.tsx` — select zasięgu obok selecta kategorii
- [ ] `service-form.tsx` — gwiazdka „*" przy `Latitude`/`Longitude` warunkowa albo usunięta
- [ ] `service-form.tsx` — błędy walidacji przez `aria-describedby`
- [ ] `service-form.tsx` — **nie** dodawaj `government` do lokalnej tablicy `categories` (poza scope'em)
- [ ] `services-table.tsx` — kolumna zasięgu
- [ ] Stwórz `src/app/[locale]/(dashboard)/dashboard/_actions.test.ts`
- [ ] `Test:` `coverage: 'online'` + `city: 'Warszawa'` + puste współrzędne → walidacja przechodzi, współrzędne `null` (nie `0`)
- [ ] `Test:` `coverage: 'online'` + puste `city` → walidacja odrzuca z błędem na polu `city`
- [ ] `Test:` `coverage: 'local'` + puste `latitude` → walidacja odrzuca
- [ ] `Test:` `coverage` nieobecny w `FormData` → domyślnie `'local'`
- [ ] `Test:` `coverage: 'zdalnie'` (wartość spoza enuma) → walidacja odrzuca
- [ ] `Test:` `coverage: 'online'` → zapisany `openingHours` to `{}`
- [ ] `Weryfikacja:` `npx jest src/app/[locale]/(dashboard)` — wszystkie testy przechodzą
- [ ] `Weryfikacja:` `npx tsc --noEmit` — zero błędów
- [ ] `Weryfikacja:` `npx next lint` — zero błędów
- [ ] `Operator:` dodaj FotoDoKarty przez formularz dashboardu (`coverage: online`, Warszawa, bez ulicy i współrzędnych) — zapis bez błędu

### U3. Dane referencyjne w seedzie

**Delegate to:** `feature-builder-web-data` · **Nakład:** S · **Zależności:** U1
**Wymagania:** R12

> Dane wymagane przez scenariusze `Operator:` w U6 i U7. Deliverable buildera, nie operatora.

- [ ] `src/db/seed.ts` — przejrzyj opisy pod kątem „online", „zdalnie", „w całej Polsce", „Remote service across Poland" (m.in. okolice linii 3167, 3354, 3370, 3407)
- [ ] `src/db/seed.ts` — nadaj znalezionym wpisom `coverage: 'hybrid'` (mają biura **i** obsługują zdalnie)
- [ ] `src/db/seed.ts` — dodaj wpis `coverage: 'online'`: FotoDoKarty, Warszawa, bez ulicy, bez współrzędnych, kategoria `others`, `openingHours: {}`
- [ ] `src/db/seed.ts` — dodaj wpis `coverage: 'hybrid'` **poza Mazowszem** (do weryfikacji dedupe w obie strony)
- [ ] `src/db/seed.ts` — utrzymaj idempotentność (`onConflictDoNothing` / upsert, bez zależności od ID z bazy)
- [ ] `src/db/seed.ts` — wpisy `local` zostają bez zmian (kolumna ma default)
- [ ] `Weryfikacja:` `npx tsc --noEmit` — zero błędów
- [ ] `Weryfikacja:` `grep -c "coverage: 'online'" src/db/seed.ts` zwraca ≥ 1
- [ ] `Weryfikacja:` `grep -c "coverage: 'hybrid'" src/db/seed.ts` zwraca ≥ 2
- [ ] `Operator:` `npm run db:seed` na bazie dev przechodzi bez błędu
- [ ] `Operator:` powtórny `npm run db:seed` bez duplikatów (potwierdzenie idempotentności)
- [ ] `Operator:` `npm run db:embeddings` — regeneracja obejmuje nowe wpisy

---

## Faza 3 — Warstwa URL

### U4. Slug `online` w parserze i builderze URL

**Delegate to:** `feature-builder-web-data` · **Nakład:** M · **Zależności:** brak (równolegle z Fazą 1–2)
**Wymagania:** R7, R8

> Czyste funkcje — pisz **test-first**, jeden przypadek na raz (tracer bullets).
> Regresja w parserze objawia się jako 404 na produkcji.

- [ ] `slug-mappings.ts` — `COVERAGE_ONLINE_SLUG = 'online'` + predykat `isOnlineSlug(segment)`
- [ ] `slug-mappings.ts` — `online` **nie** wchodzi do `CATEGORY_SLUGS` (nie jest kategorią)
- [ ] `map-slug-parser.ts` — `MapFilters` zyskuje `onlineOnly: boolean`
- [ ] `map-slug-parser.ts` — `parseSingleSegment`: sprawdzaj `online` przed county i city (jawna kolejność)
- [ ] `map-slug-parser.ts` — `parseTwoSegments`: drugi segment `online` → `{ category, onlineOnly: true }`
- [ ] `map-slug-parser.ts` — **nie** dopisuj reguły odrzucania dla `/mapa/pomorskie/online` (odpada istniejącą ścieżką)
- [ ] `map-url-builder.ts` — `onlineOnly` wypełnia slot county/city; ustal kolejność gałęzi
- [ ] Uzgodnij z U6, czy wybór „Online" czyści województwo (URL i UI muszą się zgadzać)
- [ ] Zaktualizuj wszystkie miejsca budujące `MapFilters` (typecheck je wskaże)
- [ ] Stwórz `src/lib/map-slug-parser.test.ts`
- [ ] Stwórz `src/lib/map-url-builder.test.ts`
- [ ] `Test:` `parseMapSlug(['online'], 'pl')` → `onlineOnly: true`, kategoria/county/city `null`
- [ ] `Test:` `parseMapSlug(['prawne', 'online'], 'pl')` → `category: 'law'`, `onlineOnly: true`
- [ ] `Test:` `parseMapSlug(['law', 'online'], 'en')` → `category: 'law'`, `onlineOnly: true`
- [ ] `Test:` `parseMapSlug(['pomorskie', 'online'], 'pl')` → `success: false`, redirect na `basePath`
- [ ] `Test:` `parseMapSlug(['online', 'pomorskie'], 'pl')` → `success: false`
- [ ] `Test:` `parseMapSlug(['online', 'prawne', 'pomorskie'], 'pl')` → `success: false` (>2 segmenty)
- [ ] `Test:` `parseMapSlug(undefined, 'pl')` → `onlineOnly: false` (regresja: wartość domyślna)
- [ ] `Test:` `buildMapUrl({ onlineOnly: true }, 'pl')` → `pathname: '/map/online'`
- [ ] `Test:` `buildMapUrl({ category: 'law', onlineOnly: true }, 'pl')` → `pathname: '/map/prawne/online'`
- [ ] `Test:` round-trip dla każdego locale: `parseMapSlug(buildMapUrl(f).pathname.split('/'))` zwraca `f`
- [ ] `Test:` `isOnlineSlug` nie koliduje z `CATEGORY_SLUGS`, `COUNTY_SLUGS`, `CITY_SLUGS`
- [ ] `Weryfikacja:` `npx jest src/lib/map-slug-parser.test.ts src/lib/map-url-builder.test.ts` — wszystkie przechodzą
- [ ] `Weryfikacja:` `npx tsc --noEmit` — zero błędów (w tym miejsca budujące `MapFilters`)
- [ ] `Weryfikacja:` `npx next lint` — zero błędów

---

## Faza 4 — UI odkrywania

### U5. Logika kubełkowania jako czysta funkcja

**Delegate to:** `feature-builder-web-data` · **Nakład:** M · **Zależności:** U1, U4
**Wymagania:** R4, R5, R6

> Test-first. Reguła dedupe ma najwięcej nieoczywistych przypadków — pokryj ją najpierw.

- [ ] Stwórz `src/lib/service-coverage.ts` — funkcja przyjmuje listę, filtry i `embeddingResults`, zwraca `{ localResults, onlineResults }`
- [ ] Reguła 1: filtr kategorii i tekstu stosuje się do **obu** kubełków (zasięg ortogonalny)
- [ ] Reguła 2: kubełek lokalny — `coverage !== 'online'` **i** przechodzi filtr geograficzny
- [ ] Reguła 3: kubełek online — `coverage !== 'local'`, **bez** filtra geograficznego
- [ ] Reguła 4: dedupe — usuń z kubełka online wszystko, czego `id` jest w kubełku lokalnym **lub** w `embeddingResults`
- [ ] Reguła 5: `onlineOnly === true` → kubełek lokalny pusty, online bez odejmowania geograficznego
- [ ] **Nie** dodawaj `import 'server-only'` (funkcja używana przez Client Component)
- [ ] **Nie** dodawaj własnego sortowania — `getServices` już sortuje po `priority` i `clicks`
- [ ] Komentarz przy funkcji: czwarta sekcja listy musi dopisać się do zbioru odejmowanego
- [ ] `services-client-component.tsx` — zastąp rozproszone filtrowanie wywołaniem funkcji; `frontendFilteredServices` → `localResults`
- [ ] Zachowaj 1:1 semantykę istniejących filtrów tekstowych i geograficznych
- [ ] Stwórz `src/lib/service-coverage.test.ts`
- [ ] `Test:` brak filtrów — wpis `hybrid` z Warszawy trafia **tylko** do listy lokalnej
- [ ] `Test:` filtr `pomorskie` — wpis `hybrid` z Warszawy trafia **tylko** do sekcji online
- [ ] `Test:` filtr `pomorskie` — wpis `hybrid` z Gdańska trafia **tylko** do listy lokalnej
- [ ] `Test:` wpis `online` nigdy nie trafia do listy lokalnej, niezależnie od filtra geograficznego
- [ ] `Test:` wpis `local` nigdy nie trafia do sekcji online
- [ ] `Test:` wpis obecny w `embeddingResults` nie pojawia się w sekcji online
- [ ] `Test:` filtr kategorii `law` + wpis `online` w `law` → obecny w sekcji online
- [ ] `Test:` filtr kategorii `law` + wpis `online` w `health` → nieobecny w obu kubełkach
- [ ] `Test:` `onlineOnly: true` → lista lokalna pusta, sekcja online zawiera `online` i `hybrid`
- [ ] `Test:` `onlineOnly: true` + filtr `pomorskie` → filtr geograficzny nie zawęża sekcji online
- [ ] `Test:` pusta lista wejściowa → oba kubełki puste, bez wyjątku
- [ ] `Weryfikacja:` `npx jest src/lib/service-coverage.test.ts` — wszystkie testy przechodzą
- [ ] `Weryfikacja:` `npx tsc --noEmit` — zero błędów
- [ ] `Weryfikacja:` `npx next lint` — zero błędów
- [ ] `Weryfikacja:` `grep -c "server-only" src/lib/service-coverage.ts` zwraca `0`

### U6. Sekcja „Dostępne online" + filtr „Online" + i18n

**Delegate to:** `feature-builder-web-ui` · **Nakład:** L · **Zależności:** U4, U5
**Wymagania:** R4, R6, R7, R10

- [ ] `map-list.tsx` — trzecia sekcja w `renderServiceCards()` wzorcem sekcji embeddingów (`:263`)
- [ ] `map-list.tsx` — `SectionHeader` z ikoną `lucide` (`Globe` / `Wifi`), tytuł z `useTranslations('MapList')`, licznik w tytule
- [ ] `map-list.tsx` — **dodaj `onlineResults` do `allServices`** (`:108`) i utrzymaj wspólny `cardIndex`
- [ ] `map-list.tsx` — kolejność sekcji: lokalna → online → embeddingi
- [ ] `map-list.tsx` — sekcja online tylko przy `onlineResults.length > 0`
- [ ] `services-client-component.tsx` — przekaż `onlineResults` do `MapList`
- [ ] `filter-component.tsx` — chip „Online" komponentem `ButtonCategory`
- [ ] `filter-component.tsx` — nawigacja przez `buildMapUrl` + `localizeMapPath` + `window.history.pushState`
- [ ] `filter-component.tsx` — **`resetAllFilters` zeruje `onlineOnly`**
- [ ] `mobile-filter-modal.tsx` — chip „Online" (ładowany dynamicznie, `ssr: false` — łatwo pominąć)
- [ ] Import nawigacji wyłącznie z `@/i18n/navigation` — nigdy `next/link` ani `next/navigation`
- [ ] `messages/pl.json` — klucze: tytuł sekcji, podtytuł, etykieta chipa
- [ ] `messages/en.json` — te same klucze
- [ ] `messages/ru.json` — te same klucze
- [ ] `messages/uk.json` — te same klucze
- [ ] Stwórz `src/app/[locale]/(main)/_components/map-list/map-list.test.tsx`
- [ ] `Test:` `onlineResults` niepuste → nagłówek sekcji obecny, karty wyrenderowane
- [ ] `Test:` `onlineResults` puste → nagłówek sekcji **nieobecny**
- [ ] `Test:` trzy sekcje jednocześnie → `cardIndex` unikalny, `cardRefs` bez dziur
- [ ] `Test:` wszystkie kubełki puste → `EmptyState`, bez nagłówków sekcji
- [ ] `Test:` asercja `jest-axe` bez naruszeń dla widoku z trzema sekcjami
- [ ] `Weryfikacja:` `npx jest src/app/[locale]/(main)` — wszystkie testy przechodzą, w tym `jest-axe`
- [ ] `Weryfikacja:` `npx tsc --noEmit` — zero błędów
- [ ] `Weryfikacja:` `npx next lint` — zero błędów
- [ ] `Weryfikacja:` dla każdego nowego klucza i18n `grep -l "<klucz>" messages/*.json` zwraca 4 pliki
- [ ] `Operator:` `/mapa/pomorskie` → sekcja „Dostępne online w całej Polsce" z FotoDoKarty, zero błędów w konsoli
- [ ] `Operator:` klik chipa „Online" → URL `/mapa/online`, lista tylko `online` i `hybrid`
- [ ] `Operator:` klik „Prawne" + „Online" → URL `/mapa/prawne/online`, wyniki zawężone po obu osiach
- [ ] `Operator:` klik „Resetuj" → URL wraca na `/mapa`, chip „Online" nieaktywny
- [ ] `Operator:` ten sam przepływ na `/en/map/online` — tytuł przetłumaczony, brak surowych kluczy i18n

### U7. Mapa — piny tylko dla odwiedzalnych + empty state

**Delegate to:** `feature-builder-web-ui` · **Nakład:** M · **Zależności:** U1, U5
**Wymagania:** R3, R11

- [ ] `overview-map/utility.ts` — `createPoints` filtruje: `latitude != null && longitude != null` **i** `coverage !== 'online'`
- [ ] `overview-map/utility.ts` — użyj luźnego `!= null` (łapie `null` i `undefined`)
- [ ] `overview-map/utility.ts` — zawężaj przez filtrowanie przed mapowaniem; **zakaz `!` i `as`**
- [ ] `overview-map.tsx` — empty state gdy `points.length === 0` i `currentView === 'map'` (mobile)
- [ ] `overview-map.tsx` — na desktopie (`both`) mapa zostaje widoczna obok listy
- [ ] Wykorzystaj istniejący `map-list/empty-state.tsx`
- [ ] `messages/{pl,en,ru,uk}.json` — klucze komunikatu empty state (cztery pliki)
- [ ] Stwórz `src/app/[locale]/(main)/_components/overview-map/utility.test.ts`
- [ ] `Test:` wpis `coverage: 'online'` ze współrzędnymi (adres rejestrowy) → **nie** tworzy pinu
- [ ] `Test:` wpis `coverage: 'hybrid'` ze współrzędnymi → tworzy pin
- [ ] `Test:` wpis `coverage: 'local'` z `latitude: null` → **nie** tworzy pinu, bez wyjątku
- [ ] `Test:` wpis `coverage: 'local'` ze współrzędnymi → tworzy pin (regresja podstawowa)
- [ ] `Test:` `createPoints([])` → `[]`
- [ ] `Test:` mieszana lista → długość wyniku równa liczbie wpisów odwiedzalnych ze współrzędnymi
- [ ] `Weryfikacja:` `npx jest src/app/[locale]/(main)/_components/overview-map` — wszystkie testy przechodzą
- [ ] `Weryfikacja:` `npx tsc --noEmit` — zero błędów
- [ ] `Weryfikacja:` `npx next lint` — zero błędów
- [ ] `Weryfikacja:` `grep -nE "latitude!|longitude!|as number" src/app/[locale]/(main)/_components/overview-map/utility.ts` nie zwraca trafień
- [ ] `Operator:` `/mapa` → brak pinu pod Al. Solidarności w Warszawie dla FotoDoKarty
- [ ] `Operator:` `/mapa/online` na mobile w widoku „mapa" → empty state z odesłaniem do listy
- [ ] `Operator:` wpis `hybrid` ma pin i jednocześnie jest osiągalny przez filtr „Online"

### U8. Karta usługi — oznaczenie zasięgu i null-safety adresu

**Delegate to:** `feature-builder-web-ui` · **Nakład:** L · **Zależności:** U1
**Wymagania:** R9, R10

> Zacznij od characterization testów obecnej karty (adres, godziny, link nawigacji) na wpisie
> `local` ze współrzędnymi. 666 linii i wiele ścieżek warunkowych — siatka bezpieczeństwa jest
> tańsza niż debugowanie regresji.

- [ ] Stwórz `src/app/[locale]/(main)/_components/service-card/service-card.test.tsx` z characterization testami
- [ ] `service-card.tsx:251` — zmień gard `latitude !== undefined` na `!= null`
- [ ] `service-card.tsx:286` — zmień gard `latitude !== undefined` na `!= null`
- [ ] `service-card.tsx:350` — `navigateLink` nie renderuje się bez współrzędnych (dziś dałby `destination=null,null`)
- [ ] `service-card.tsx` — `Badge` zasięgu dla `coverage === 'online' | 'hybrid'`, tekst z i18n
- [ ] `service-card.tsx` — **nie** dopisuj zasięgu do `mapCategoryToBadgeColor` (to mapowanie kategorii); osobna, jawna wartość wariantu
- [ ] `service-card.tsx` — umiejscowienie badge'a wzorcem `VerifiedBadge` (`:401`)
- [ ] `service-card.tsx` — potwierdź testem, że `addressParts` (`:332`) nie zostawia wiszącego przecinka bez `street`
- [ ] `marker-popup.tsx` — przejrzyj pod kątem tych samych założeń o współrzędnych
- [ ] `messages/{pl,en,ru,uk}.json` — klucz tekstu badge'a zasięgu (cztery pliki)
- [ ] `Test:` `coverage: 'online'`, `street: null`, współrzędne `null` → adres „Warszawa" bez wiszącego przecinka
- [ ] `Test:` `coverage: 'online'` → link „Nawiguj" (Google Maps) **nie** renderowany
- [ ] `Test:` `coverage: 'online'` → badge zasięgu obecny
- [ ] `Test:` `coverage: 'hybrid'` → badge zasięgu obecny **i** link nawigacji obecny
- [ ] `Test:` `coverage: 'local'` → badge zasięgu **nieobecny**, link nawigacji obecny (regresja)
- [ ] `Test:` `openingHours: {}` → blok godzin nieobecny, bez wyjątku
- [ ] `Test:` klik karty przy współrzędnych `null` → `handleFlyTo` **nie** wywołany
- [ ] `Test:` asercja `jest-axe` bez naruszeń dla wariantów `local`, `online`, `hybrid`
- [ ] `Weryfikacja:` `npx jest src/app/[locale]/(main)/_components/service-card` — wszystkie testy przechodzą
- [ ] `Weryfikacja:` `npx tsc --noEmit` — zero błędów
- [ ] `Weryfikacja:` `npx next lint` — zero błędów
- [ ] `Weryfikacja:` `grep -nE "latitude !== undefined|longitude !== undefined" src/app/[locale]/(main)/_components/service-card/service-card.tsx` nie zwraca trafień

---

## Faza 5 — SEO

### U9. Sitemap i metadata dla `/mapa/online`

**Delegate to:** `feature-builder-web-fullstack` · **Nakład:** M · **Zależności:** U4, U6
**Wymagania:** R8

- [ ] `sitemap.ts` — dodaj `/mapa/online` i `/en/map/online` mirrorem sekcji „4. Kategorie map" (`:134`)
- [ ] `sitemap.ts` — **utrzymaj konwencję**: kategorie emitowane tylko dla `pl` i `en`, nie dla `ru`/`uk`
- [ ] `sitemap.ts` — **bez** kombinacji `/mapa/{kategoria}/online` (thin content, granica scope'u)
- [ ] `page.tsx` — `onlineOnly` wpływa na `titleSuffix`
- [ ] `page.tsx` — `onlineOnly` wpływa na `canonical`
- [ ] `page.tsx` — `onlineOnly` przekazany do `buildMapUrl` w pętli `languageUrls` (`:74`)
- [ ] `page.tsx` — tłumaczenie segmentu z i18n, nie hardkodowane
- [ ] `messages/{pl,en,ru,uk}.json` — klucz tytułu (cztery pliki)
- [ ] Stwórz `src/app/sitemap.test.ts`
- [ ] `Test:` `sitemap()` zwraca wpis kończący się na `/mapa/online` oraz `/en/map/online`
- [ ] `Test:` `sitemap()` **nie** zwraca żadnego URL-a `/mapa/{kategoria}/online`
- [ ] `Test:` `sitemap()` nie zawiera duplikatów URL-i
- [ ] `Weryfikacja:` `npx jest src/app/sitemap.test.ts` — testy przechodzą
- [ ] `Weryfikacja:` `npx tsc --noEmit` — zero błędów
- [ ] `Weryfikacja:` `npx next lint` — zero błędów
- [ ] `Weryfikacja:` `npm run build` kończy się sukcesem (najcięższy krok — na końcu)
- [ ] `Operator:` `/sitemap.xml` na dev serverze zawiera `/mapa/online`
- [ ] `Operator:` `/mapa/online` ma własny `<title>` różny od `/mapa`
- [ ] `Operator:` `/mapa/online` ma `rel=canonical` na siebie i `hreflang` dla 4 locale
- [ ] `Operator:` `/mapa/prawne/online` ma tytuł zawierający kategorię i oznaczenie online

---

## Domknięcie zadania

- [ ] `CLAUDE.md` — usuń wzmiankę o 2 błędach typecheck z sekcji „Znane odchylenia od czystego stanu repo"
- [ ] `CLAUDE.md` — dopisz `coverage` jako drugą oś obok kategorii (żeby kolejne sesje nie proponowały „kategorii online")
- [ ] `Weryfikacja:` pełny quality gate: `npx tsc --noEmit`, `npx jest`, `npx next lint` — wszystko zielone
- [ ] `Operator:` przegląd logów Vercela po wdrożeniu pod kątem wyjątków z `map/[[...slug]]` (nowy slug w parserze = najbardziej prawdopodobne źródło 500-tek)
- [ ] `/dev-compound` — zapisz wzorzec „ortogonalny wymiar zamiast nowej wartości enuma" do `docs/solutions/`
