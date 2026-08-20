# Zadania: Zasięg usługi (lokalna / online / hybryda)

**Branch:** `feature/online-service-coverage`
**Ostatnia aktualizacja:** 2026-08-21

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

- [x] `src/db/schema.ts` — `coverageEnum = pgEnum('coverage', ['local', 'online', 'hybrid'])` + typ `Coverage`
- [x] `src/db/schema.ts` — kolumna `coverage` na `servicesTable`, `notNull().default('local')`
- [x] `src/db/schema.ts` — zdejmij `notNull()` z `serviceLocationsTable.latitude` i `longitude`
- [x] `src/db/schema.ts` — **zachowaj** indeksy `idx_location_latitude` / `idx_location_longitude`
- [x] `src/types/index.ts` — `Service.latitude: number | null`, `Service.longitude: number | null`
- [x] `src/types/index.ts` — `Service.coverage: Coverage`; typ `Coverage` inferowany ze schematu Drizzle
- [x] `src/lib/queries.ts` — `coverage` do selecta w `getServices`
- [x] `src/lib/queries.ts` — `coverage` do selecta w `getMostPopular` (zduplikowany select — oba pokryte)
- [x] `src/lib/queries.ts` — **nie zmieniono** `innerJoin` na `leftJoin` (decyzja 2 w kontekście — potwierdzona)
- [x] Stwórz `src/db/schema.test.ts` — guard na wartości `coverageEnum`
- [x] Przejrzyj pełną listę błędów z `npx tsc --noEmit` — 15 błędów w 5 plikach, rozbiór niżej
- [x] `Test:` typ `Coverage` przyjmuje `'local' | 'online' | 'hybrid'` i odrzuca inne wartości — **4/4 PASS**
- [x] `Weryfikacja:` `npx tsc --noEmit` — **0 błędów**
- [x] `Weryfikacja:` `npx jest` — **95/95 PASS** (3 suity)
- [x] `Weryfikacja:` `npx next lint` — **0 błędów** (same preegzystujące warningi)
- [x] Zastosuj zmianę schematu na bazie — **`npx drizzle-kit push`, nie `generate`** (uzasadnienie niżej)
- [x] `Operator:` `npx drizzle-kit push` — `[✓] Changes applied`, zero pytań, zero propozycji destrukcyjnych
- [x] `Operator:` potwierdzono w bazie: enum `coverage` (`local`/`online`/`hybrid`), kolumna `NOT NULL DEFAULT 'local'::coverage`, `latitude`/`longitude` nullowalne, `slug` nadal `NOT NULL`, 127 istniejących usług = `local`, oba indeksy na współrzędnych przetrwały
- [x] ~~`Weryfikacja:` `git diff --stat drizzle/`~~ — **nie dotyczy**, w tym repo nie powstaje plik migracji

Commit: `f7e7b87` (kod), zmiana schematu zaaplikowana przez `push`

#### Dlaczego `drizzle:generate` jest w tym repo nieużywalny — sprostowanie planu

Plan zakładał `schema.ts` → `drizzle:generate` → `drizzle:push`, zgodnie z `CLAUDE.md`.
**Ta ścieżka w tym repo nie działa.** Ustalone empirycznie:

1. `npm run drizzle:generate` woła **przedawniony** `drizzle-kit generate:pg` (drizzle-kit 0.30.5) —
   nie generuje nic, tylko wypisuje ostrzeżenie o deprecacji. Skrypt jest martwy.
2. `npx drizzle-kit generate` startuje, ale **snapshoty są w stanie ruiny**:
   - `drizzle/meta/0013_snapshot.json` (najnowszy) zna **dwa** enumy: `category` i `county`.
     `schema.ts` ma cztery. Stąd trzy pytania „create or rename" (`coverage`, `status`, `voivodeship`).
   - `_journal.json` kończy się na `0013`, a `0014_add_services_id_sequence.sql` dopisano **ręcznie,
     bez snapshotu**.
   - Snapshot nie zna tabeli `service_locations` — czyli głównej tabeli aplikacji.
   - Jako kandydata do przemianowania Drizzle proponował `services_translations_alias`, co **nie jest
     tabelą** — to nazwa aliasu z `src/db/aliases.ts`, która wyciekła do snapshotu.
   - `drizzle/0000_opposite_dark_beast.sql` ma **błąd składni**: `'grocery', 'grocery' 'transport'`
     (brak przecinka), więc nigdy nie zaaplikował się czysto.
   - `county` to relikt po forku `abroad-services` — enum z hrabstwami irlandzkimi
     (Antrim, Armagh, Dublin, Galway…), zastąpiony przez `voivodeship`.
3. Wynikiem `generate` byłaby migracja próbująca **utworzyć od zera** typy i tabele już istniejące
   w bazie — nieaplikowalna (`already exists`) i opisująca nieprawdę o stanie bazy.

`push` porównuje `schema.ts` z **żywą bazą**, nie ze snapshotem, więc zadziałał od razu i poprawnie.
Potwierdza to zresztą sam `package.json`: `db:reset` to `db:drop && drizzle:push && db:seed` —
projekt od początku żyje na `push`, a katalog `drizzle/` jest martwym balastem po forku.

**Wniosek dla kolejnych faz:** zmiany schematu w tym repo aplikujemy przez `npx drizzle-kit push`.
Nie generujemy plików migracji, dopóki `drizzle/` nie zostanie zresetowany (osobne zadanie).

#### Odchylenia od planu w U1 (wszystkie zgłoszone i zaakceptowane)

1. **`src/lib/map-utils.ts` — plik przeoczony w planie.** Nie było go w `Pliki:` żadnego unitu.
   Linia 7 **już** filtrowała `latitude != null && longitude != null` — autor przewidział
   nullowalność, tylko TypeScript nie zawęża typu przez zwykły `.filter()`. Poprawka to predykat
   typu, **zero zmiany zachowania**.
2. **`src/app/api/services/route.ts` — plan deklarował „bez zmian".** Deklaracja była zbyt mocna:
   brak `coverage` w selekcie **i** w przepisywanym ręcznie obiekcie (linia ~216) łamie współdzielony
   typ `PartialService`. Dodane w obu miejscach. **Zachowanie route'u bez zmian** — granica scope'u
   dotyczyła logiki, nie pól selecta. Doprecyzowane w planie technicznym.
3. **Poprawki kompilacyjne w plikach U7/U8 wchłonięte do U1** (decyzja użytkownika). Powód:
   „nullowalne współrzędne" nie da się zamknąć jako samodzielny zielony commit — zdjęcie `notNull`
   psuje kompilację u konsumentów. Alternatywą był czerwony typecheck przez całą Fazę 4, łamiący
   quality gate z `CLAUDE.md` i hałasujący hook Stop przy każdym kroku.

#### Co z tego wynika dla U7 i U8 — częściowo już zrobione

- **U7:** `createPoints` w `overview-map/utility.ts` **już filtruje brak współrzędnych** i ma typ
  `LocatedService`. U7 dokłada **wyłącznie** warunek `coverage !== 'online'` oraz empty state (R11).
  Komentarz w kodzie wskazuje miejsce.
- **U8:** gardy `!== undefined` → `!= null` w `service-card.tsx:251,286` **już naprawione**
  (to była regresja wprowadzana przez U1, więc musiała paść razem z nią). `marker-popup.tsx` ma
  early return bez współrzędnych. U8 dokłada badge zasięgu, ukrycie `navigateLink` (`:350` —
  **wciąż nietknięte**), characterization testy i asercje `jest-axe`.

---

## Faza 2 — Wejście danych

### U2. Zasięg w dashboardzie (formularz + Server Action + Zod)

**Delegate to:** `feature-builder-web-fullstack` · **Nakład:** M · **Zależności:** U1
**Wymagania:** R1, R9

> Najbardziej ryzykowny punkt planu. Pisany **test-first**: najpierw failujący test na puste
> `latitude` z `FormData` (oczekiwane `null`, nie `0`), potem poprawa schematu.

- [x] **Stwórz `_service-schema.ts`** — czysta warstwa walidacji, wydzielona z `_actions.ts`
- [x] `_service-schema.ts` — `coverageValues = coverageEnum.enumValues`; `coverage: z.enum(...)`
- [x] `_service-schema.ts` — `latitude` / `longitude` z wymaganych na opcjonalne
- [x] `_service-schema.ts` — puste wejście z `FormData` daje `null`, **nie `0`**
- [x] `_service-schema.ts` — `.superRefine()`: `coverage !== 'local'` → `city` wymagane
- [x] `_service-schema.ts` — `.superRefine()`: `coverage !== 'online'` → współrzędne wymagane
- [x] `coverage === 'online'` zapisuje `openingHours: {}` — **było już tak dla każdej nowej usługi**
- [x] Błędy walidacji trafiają w konkretne pole (`path: ['city']` / `['latitude']`)
- [x] `_actions.ts` — `coverage` w insercie **i** update'cie `servicesTable`
- [x] `_actions.ts` — `getServiceById`: `?? 0` → `?? null` na współrzędnych
- [x] `_actions.ts` — `coverage` w `getServicesForDashboard`
- [x] `service-form.tsx` — select zasięgu obok selecta kategorii, z podpowiedzią per wartość
- [x] `service-form.tsx` — warunkowe `required` i gwiazdki na współrzędnych i mieście
- [x] `service-form.tsx` — błędy walidacji przez `aria-describedby`
- [x] `service-form.tsx` — **nie** dodano `government` do lokalnej tablicy `categories`
- [x] `services-table.tsx` — kolumna Coverage (+ `colSpan` 10 → 11)
- [x] Stwórz `_service-schema.test.ts` — **15 scenariuszy**
- [x] `Test:` `coverage: 'online'` + `city` + puste współrzędne → przechodzi, współrzędne `null` (nie `0`)
- [x] `Test:` `coverage: 'online'` + puste `city` → odrzucone z błędem na polu `city`
- [x] `Test:` `coverage: 'local'` + puste `latitude` → odrzucone
- [x] `Test:` `coverage` nieobecny w `FormData` → domyślnie `'local'`
- [x] `Test:` `coverage: 'zdalnie'` → odrzucone
- [x] `Test:` `coverage: 'online'` → `openingHours` to `{}`
- [x] `Weryfikacja:` `npx jest` — **110/110 PASS**
- [x] `Weryfikacja:` `npx tsc --noEmit` — **0 błędów**
- [x] `Weryfikacja:` `npx next lint` — **0 błędów**
- [ ] `Operator:` dodaj wpis `online` przez formularz dashboardu — potwierdź zapis bez ulicy i współrzędnych

Commit: `25b3c08`

#### Odchylenia i znaleziska w U2

1. **Nowy plik `_service-schema.ts` — poza zadeklarowanymi `Pliki:`.** Powód wymuszony:
   `src/db/index.ts` tworzy klienta postgres **przy ładowaniu modułu**, więc zaimportowanie
   `_actions.ts` w teście otwierałoby połączenie z bazą. `@/db/schema` jest bezpieczny (tylko
   definicje tabel i enumów), więc czysta warstwa walidacji jest w pełni testowalna.
   Uboczna korzyść: `_actions.ts` schudł o ~100 linii.
2. **Bug ze współrzędnymi `0,0` był preegzystujący, nie wprowadzony tą zmianą.** `FormData.get()`
   zwraca `null` dla pola nieobecnego, `z.coerce.number()` zamienia to na `0` — czyli **już
   przed tym zadaniem** zgłoszenie bez współrzędnych dawało pin w Zatoce Gwinejskiej.
3. **`getServiceById` miał ten sam bug w drugą stronę:** `location?.latitude ?? 0` wstawiało `0`
   do formularza edycji, więc zapis utrwalał fałszywy pin. Naprawione na `?? null`.
4. **Współrzędne wymagane też dla `hybrid`, nie tylko `local`** — plan mówił tylko o `local`,
   ale `hybrid` ma pin na mapie (R3), więc bez współrzędnych byłby niespójny.
5. **`openingHours: {}` było już domyślne** dla każdej nowej usługi (`_actions.ts`), więc wymóg
   dla `online` spełnia się sam. Dashboard w ogóle nie ustawia godzin otwarcia.
6. **Builder `FormData` w teście musi podawać wszystkie pola jako `''`.** Wzorzec
   `z.string().optional().or(z.literal(''))`, użyty w tym repo dla każdego pola opcjonalnego,
   **nie przyjmuje `null`** — a `formData.get()` zwraca `null` dla pola pominiętego. Realny
   formularz renderuje wszystkie inputy, więc posyła `''`. Test był nierealistyczny, nie schemat.
   *Potencjalne hardening na przyszłość: te pola mogłyby tolerować `null`. Poza scope'em.*

---

### U3. Dane referencyjne w seedzie

**Delegate to:** `feature-builder-web-data` · **Nakład:** S · **Zależności:** U1
**Wymagania:** R12

> Dane wymagane przez scenariusze `Operator:` w U6 i U7. Deliverable buildera, nie operatora.

- [x] `src/db/seed.ts` — przejrzano opisy pod kątem „online", „zdalnie", „w całej Polsce", „Remote service across Poland"
- [x] `src/db/seed.ts` — `seedService` przyjmuje opcjonalny `coverage`, domyślnie `'local'`
- [x] `src/db/seed.ts` — cztery wpisy oznaczone `coverage: 'hybrid'`: `biuro-precyzja`, `dobra-ksiegowa`, `nikitas`, `ark-biuro-rachunkowe`
- [x] `src/db/seed.ts` — wpis `coverage: 'hybrid'` **poza Mazowszem**: `dobra-ksiegowa` (Stargard, `zachodniopomorskie`)
- [x] `src/db/seed.ts` — wpis `coverage: 'online'`: FotoDoKarty, Warszawa, bez ulicy, bez współrzędnych, kategoria `others`, `openingHours: {}`
- [x] `src/db/seed.ts` — wpisy `local` bez zmian (kolumna ma default)
- [x] ~~utrzymaj idempotentność~~ — **wymóg oparty na błędnym założeniu, patrz niżej**
- [x] `Weryfikacja:` `npx tsc --noEmit` — **0 błędów**
- [x] `Weryfikacja:` `grep -c "coverage: 'online'" src/db/seed.ts` → **1**
- [x] `Weryfikacja:` `grep -c "coverage: 'hybrid'" src/db/seed.ts` → **4**
- [x] `Weryfikacja:` `npx jest` — **110/110 PASS**, `npx next lint` — **0 błędów**
- [x] `Operator:` `npm run db:reset` — wykonane za zgodą użytkownika; seed przeszedł do końca
- [x] `Operator:` potwierdzono w bazie: **135 `local` / 4 `hybrid` / 1 `online`**; FotoDoKarty jako `online` bez ulicy i bez współrzędnych, `openingHours` = `{}`; Dobra Księgowa (Stargard) jako `hybrid` w `zachodniopomorskim`; niezmiennik „`local`/`hybrid` mają współrzędne" — **zero naruszeń**
- [ ] `Operator:` `npm run db:embeddings` — **wymagane po resecie**: drop usunął wszystkie embeddingi,
      więc semantic search jest teraz w devie martwy dla wszystkich 140 usług (koszt OpenAI)

Commit: `0702eeb`

#### Sprostowanie: seed nigdy nie był idempotentny

Wymóg „utrzymaj idempotentność (`onConflictDoNothing` / upsert)" z planu opierał się na błędnym
założeniu. W `src/db/seed.ts` (3447 linii) **nie ma ani jednego** `delete`, `TRUNCATE` czy
`onConflictDoNothing` — tylko zwykłe `db.insert(...)`. Seed zakłada świeżą bazę i opiera się na
`db:drop` przed sobą: `db:reset` = `db:drop && drizzle:push && db:seed`.

Ponieważ `serviceLocationsTable.slug` jest `unique`, **powtórne `npm run db:seed` na zapełnionej
bazie wywali się** na naruszeniu unikalności — nie stworzy duplikatów, ale i nie przejdzie.
Doklejanie idempotencji do 3447 linii byłoby osobnym, dużym zadaniem, więc korygujemy wymóg
zamiast go realizować.

**Konsekwencja praktyczna:** żeby dane referencyjne U3 znalazły się w bazie, potrzebny jest
`npm run db:reset`, który **niszczy lokalne dane**. Nie uruchamiam tego bez wyraźnej zgody.
Jeśli dodałeś ręcznie jakiekolwiek wpisy przez dashboard — zostaną utracone.

---

## Faza 3 — Warstwa URL

### U4. Slug `online` w parserze i builderze URL

**Delegate to:** `feature-builder-web-data` · **Nakład:** M · **Zależności:** brak (równolegle z Fazą 1–2)
**Wymagania:** R7, R8

> Czyste funkcje — pisz **test-first**, jeden przypadek na raz (tracer bullets).
> Regresja w parserze objawia się jako 404 na produkcji.

- [x] `slug-mappings.ts` — `COVERAGE_ONLINE_SLUG = 'online'` + predykat `isOnlineSlug(segment)`
- [x] `slug-mappings.ts` — `online` **nie** wchodzi do `CATEGORY_SLUGS` (nie jest kategorią)
- [x] `map-slug-parser.ts` — `MapFilters` zyskuje **wymagane** `onlineOnly: boolean` (bez stanu `undefined`)
- [x] `map-slug-parser.ts` — `parseSingleSegment`: `online` sprawdzany przed county i city
- [x] `map-slug-parser.ts` — `parseTwoSegments`: drugi segment `online` → `{ category, onlineOnly: true }`
- [x] `map-slug-parser.ts` — **nie** dopisano reguły odrzucania dla `/mapa/pomorskie/online`
- [x] `map-url-builder.ts` — `onlineOnly` wypełnia slot county/city, z priorytetem nad nimi
- [x] Rozstrzygnięte: wybór „Online" **czyści** województwo i miasto — jeden slot ścieżki
- [x] Zaktualizowano 4 miejsca budujące `MapFilters` (`map-page-client.tsx` ×2, `filter-component.tsx` ×2)
- [x] Stwórz `src/lib/map-slug-parser.test.ts`
- [x] Stwórz `src/lib/map-url-builder.test.ts`
- [x] `Test:` `parseMapSlug(['online'], 'pl')` → `onlineOnly: true`, kategoria/county/city `null`
- [x] `Test:` `parseMapSlug(['prawne', 'online'], 'pl')` → `category: 'law'`, `onlineOnly: true`
- [x] `Test:` `parseMapSlug(['law', 'online'], 'en')` → `category: 'law'`, `onlineOnly: true`
- [x] `Test:` `parseMapSlug(['pomorskie', 'online'], 'pl')` → `success: false`, redirect na `basePath`
- [x] `Test:` `parseMapSlug(['online', 'pomorskie'], 'pl')` → `success: false`
- [x] `Test:` `parseMapSlug(['online', 'prawne', 'pomorskie'], 'pl')` → `success: false` (>2 segmenty)
- [x] `Test:` `parseMapSlug(undefined, 'pl')` → `onlineOnly: false` (regresja: wartość domyślna)
- [x] `Test:` `buildMapUrl({ onlineOnly: true }, 'pl')` → `pathname: '/map/online'`
- [x] `Test:` `buildMapUrl({ category: 'law', onlineOnly: true }, 'pl')` → `pathname: '/map/prawne/online'`
- [x] `Test:` round-trip dla każdego locale — 4 kombinacje filtrów × 4 locale
- [x] `Test:` `isOnlineSlug` nie koliduje z `CATEGORY_SLUGS`, `COUNTY_SLUGS`, `CITY_SLUGS`
- [x] `Test:` regresje na istniejących trasach (kategoria sama, województwo samo, kategoria + województwo)
- [x] `Weryfikacja:` `npx jest map-slug-parser map-url-builder` — **30/30 PASS**
- [x] `Weryfikacja:` `npx tsc --noEmit` — **0 błędów**
- [x] `Weryfikacja:` `npx next lint` — **0 błędów**
- [x] `Weryfikacja:` pełny `npx jest` — **140/140 PASS** (6 suit)

Commit: `1dc0c67`

#### Rozstrzygnięcia i odchylenia w U4

1. **`onlineOnly` czyści województwo i miasto** — odroczone pytanie z planu („uzgodnij z U6").
   Uzasadnienie: zasięg i lokalizacja dzielą **jeden slot ścieżki** (`/mapa/{tu}`), więc są
   wzajemnie wykluczające. Wybór „Online" oznacza rezygnację z zawężenia geograficznego.
   **To nie koliduje z R5** — tam sekcja online jest widoczna przy aktywnym filtrze województwa,
   ale to zachowanie *sekcji listy*, nie filtra `onlineOnly`. Dwie różne rzeczy.
2. **`onlineOnly` jako wymagany boolean, nie opcjonalny** — odroczone pytanie z planu.
   Opcjonalne pole dawałoby trzeci stan (`undefined`) bez znaczenia semantycznego. Zasięg
   regionalny jest poza scope'em, więc nie budujemy pod niego abstrakcji.
3. **`/mapa/pomorskie/online` odpada bez nowego kodu** — potwierdzone testem. `parseTwoSegments`
   wymaga kategorii jako pierwszego segmentu, więc przekierowuje na `basePath`. Przewidywanie
   z planu okazało się trafne.
4. **`filter-component.tsx` dotknięty minimalnie** — U4 dodaje wyłącznie *przenoszenie* flagi
   (`initialFilters?.onlineOnly ?? false` do `onFiltersChange` i `buildMapUrl`), żeby zmiana
   kategorii nie gubiła aktywnego zasięgu w URL-u. Bez tego `/mapa/online` + klik kategorii
   dawałoby `/mapa/prawne`, cicho tracąc filtr. Interaktywny chip zostaje w U6.

#### Bug preegzystujący znaleziony po drodze — poza scope'em

`filter-component.tsx` hardkoduje prefiks `/en` dla **każdego** locale niebędącego `pl`:
`const basePath = locale === 'pl' ? '' : '/en'` (w `navigateWithFilters`) oraz
`locale === 'pl' ? '/mapa' : '/en/map'` (w `resetAllFilters`). Na `ru` i `uk` nawigacja filtrem
przepisuje URL na `/en/...`, czyli **przełącza użytkownikowi język**. Nie naprawiam tutaj —
nie należy do zasięgu i wymaga decyzji, czy użyć `localizeMapPath` z prawidłowym prefiksem.

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
