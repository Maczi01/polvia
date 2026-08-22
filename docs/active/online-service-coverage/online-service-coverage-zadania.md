# Zadania: Zasięg usługi (lokalna / online / hybryda)

**Branch:** `feature/online-service-coverage`
**Ostatnia aktualizacja:** 2026-08-22

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

### U5. Logika kubelkowania jako czysta funkcja

**Delegate to:** `feature-builder-web-data` - **Naklad:** M - **Zaleznosci:** U1, U4
**Wymagania:** R4, R5, R6

- [x] Stworz `src/lib/service-coverage.ts` - `splitServicesByCoverage(services, filters, alreadyShown)`
- [x] Regula 1: filtr kategorii i tekstu stosuje sie do **obu** kubelkow
- [x] Regula 2: kubelek lokalny - `coverage !== 'online'` **i** przechodzi filtr geograficzny
- [x] Regula 3: kubelek online - `coverage !== 'local'`, **bez** filtra geograficznego
- [x] Regula 4: dedupe - usun z online to, co jest w liscie lokalnej **lub** w `embeddingResults`
- [x] Regula 5: `onlineOnly === true` -> lista lokalna pusta, online bez odejmowania geograficznego
- [x] **Nie** dodano `import 'server-only'`
- [x] **Nie** dodano wlasnego sortowania
- [x] Komentarz przy funkcji: czwarta sekcja listy musi dopisac sie do `alreadyShown`
- [x] `services-client-component.tsx` - filtrowanie zastapione wywolaniem funkcji
- [x] Zachowana 1:1 semantyka filtrow tekstowych i geograficznych (w tym priorytet miasta)
- [x] Stworz `src/lib/service-coverage.test.ts` - **16 scenariuszy**
- [x] `Test:` brak filtrow - `hybrid` z Warszawy **tylko** w liscie lokalnej
- [x] `Test:` filtr `pomorskie` - `hybrid` z Warszawy **tylko** w sekcji online
- [x] `Test:` filtr `pomorskie` - `hybrid` z Gdanska **tylko** w liscie lokalnej
- [x] `Test:` `online` nigdy w liscie lokalnej, niezaleznie od filtra geograficznego
- [x] `Test:` `local` nigdy w sekcji online
- [x] `Test:` wpis z `embeddingResults` nieobecny w sekcji online (oraz: inny wpis go nie usuwa)
- [x] `Test:` kategoria `law` + wpis `online` w `law` -> obecny w sekcji online
- [x] `Test:` kategoria `law` + wpis `online` w `health` -> nieobecny w obu kubelkach
- [x] `Test:` `onlineOnly: true` -> lista lokalna pusta, online zawiera `online` i `hybrid`
- [x] `Test:` `onlineOnly: true` + filtr `pomorskie` -> filtr geograficzny nie zaweza online
- [x] `Test:` pusta lista wejsciowa -> oba kubelki puste
- [x] `Test:` zachowanie kolejnosci wejsciowej (sortowanie pochodzi z zapytania)
- [x] `Weryfikacja:` `npx jest service-coverage` - **16/16 PASS**
- [x] `Weryfikacja:` `npx tsc --noEmit` - **0 bledow**
- [x] `Weryfikacja:` `npx next lint` - **0 bledow**
- [x] `Weryfikacja:` `grep -c "server-only" src/lib/service-coverage.ts` -> **0**

Commit: `c567f3d`

#### Znalezisko: funkcja wolana dwa razy, zeby uniknac cyklu

`localResults` **nie moze** zalezec od wynikow semantycznych, bo jego dlugosc steruje fetchem
embeddingow (`services-client-component.tsx`). Zaleznosc w druga strone dalaby cykl
`localResults -> fetch -> embeddingResults -> localResults`.

Dlatego `splitServicesByCoverage` jest wolana dwa razy: raz bez `alreadyShown` (lista lokalna,
zasila trigger fetchu), raz z `alreadyShown` (sekcja online). Czesc `onlineResults` z pierwszego
wywolania jest odrzucana. Koszt to dwa przejscia po ~140 elementach - nieporownywalnie taniej
niz powtorzenie reguly deduplikacji w komponencie, gdzie nie mialaby testow.

---

### U6. Sekcja "Dostepne online" + filtr "Online" + i18n

**Delegate to:** `feature-builder-web-ui` - **Naklad:** L - **Zaleznosci:** U4, U5
**Wymagania:** R4, R6, R7, R10

- [x] `map-list.tsx` - trzecia sekcja wzorcem sekcji embeddingow
- [x] `map-list.tsx` - `SectionHeader` z ikona `Globe`, tytul z licznikiem
- [x] `map-list.tsx` - **`onlineResults` dopisane do `allServices`**, wspolny `cardIndex`
- [x] `map-list.tsx` - kolejnosc: lokalna -> online -> embeddingi
- [x] `map-list.tsx` - sekcja online tylko przy `onlineResults.length > 0`
- [x] `map-list.tsx` - `EmptyState` uwzglednia wyniki online w `hasRecommendations`
- [x] `services-client-component.tsx` - `onlineResults` przekazane do `MapList`
- [x] `filter-component.tsx` - chip "Online" komponentem `ButtonCategory`, poza scrollowanym rzedem
- [x] `filter-component.tsx` - nawigacja przez `buildMapUrl` + `localizeMapPath` + `pushState`
- [x] `filter-component.tsx` - **`resetAllFilters` zeruje `onlineOnly`**
- [x] `filter-component.tsx` - `hasActiveFilters` uwzglednia `onlineOnly`
- [x] `filter-component.tsx` - synchronizacja z `initialFilters.onlineOnly` (back/forward)
- [x] `mobile-filter-modal.tsx` - chip "Online" (ladowany dynamicznie - nie pominiety)
- [x] `messages/pl.json` - 5 nowych kluczy
- [x] `messages/en.json` - te same klucze
- [x] `messages/ru.json` - te same klucze
- [x] `messages/uk.json` - te same klucze
- [x] Nowa ikona `public/icons/online.svg` w stylu pozostalych
- [x] Stworz `map-list.test.tsx` - **7 scenariuszy**
- [x] `Test:` `onlineResults` niepuste -> naglowek sekcji obecny, karty wyrenderowane
- [x] `Test:` `onlineResults` puste -> naglowek sekcji **nieobecny**
- [x] `Test:` sekcja online widoczna nawet bez wynikow lokalnych
- [x] `Test:` trzy sekcje naraz -> kazda usluga dokladnie raz, brak kolizji refow
- [x] `Test:` kolejnosc sekcji: lokalne -> online -> semantyczne
- [x] `Test:` wszystkie kubelki puste -> `EmptyState`, bez naglowkow sekcji
- [x] `Test:` asercja `jest-axe` bez naruszen przy trzech sekcjach
- [x] `Weryfikacja:` `npx jest` - **163/163 PASS** (8 suit)
- [x] `Weryfikacja:` `npx tsc --noEmit` - **0 bledow**
- [x] `Weryfikacja:` `npx next lint` - **0 bledow**
- [x] `Weryfikacja:` kazdy nowy klucz i18n obecny w **4** plikach `messages/*.json`
- [x] `Operator:` `/mapa/pomorskie` -> sekcja "Dostepne online" z FotoDoKarty — potwierdzone przez curl na dev serverze
- [ ] `Operator:` klik chipa "Online" -> URL `/mapa/online`, lista tylko `online` i `hybrid`
- [ ] `Operator:` klik "Prawne" + "Online" -> URL `/mapa/prawne/online`
- [ ] `Operator:` klik "Resetuj" -> URL wraca na `/mapa`, chip nieaktywny
- [ ] `Operator:` ten sam przeplyw na `/en/map/online` - tytul przetlumaczony

Commit: `27d8ec7` (U6), `112913a` (infrastruktura testowa)

#### Odblokowanie testow komponentow - dwie luki srodowiska

Repo mialo dotad testy tylko dla `Badge` i `Button`, ktore nie dotykaly ani ikon, ani listy
wirtualizowanej. Pierwszy test `MapList` odslonil dwie blokady, obie naprawione w `112913a`:

1. **`lucide-react` publikuje ESM** dla warunku `browser` wybieranego przez jsdom, a `next/jest`
   wyklucza `node_modules` z transformacji -> `Cannot use import statement outside a module`.
   Ustawienie `transformIgnorePatterns` **nie dziala** - `next/jest` nadpisuje ten klucz.
   Rozwiazanie: `moduleNameMapper` na build CJS samej biblioteki (ikony renderuja sie normalnie).
2. **jsdom nie implementuje `ResizeObserver`**, a `virtua` konstruuje go przy renderze kazdego
   elementu -> `ResizeObserver is not a constructor`. Stub w `setupAfterEnv.ts`.

To nie obejscia blokad, a brakujace czesci srodowiska - bez nich testu nie da sie uruchomic.

#### Znalezisko z weryfikacji w przegladarce — banner nad lista (commit `2562300`)

Testy jednostkowe przechodzily, a feature **nie dzialal** w najczestszym przypadku. Na `/mapa`
bez filtra sekcja "Dostepne online" nie renderowala sie w ogole — nie dlatego, ze kubelek byl
pusty (FotoDoKarty tam nalezy), ale dlatego, ze przy **139 wynikach lokalnych** naglowek sekcji
siedzi na pozycji ~140, a `virtua` wirtualizuje liste i renderuje kilkadziesiat pierwszych
elementow. R4 ("widoczna zawsze") byla spelniona strukturalnie i niespelniona w praktyce.

Zadna asercja jednostkowa nie mogla tego wychwycic — w tescie kubelek mial 1-2 elementy.

**Rozwiazanie (decyzja uzytkownika):** kompaktowy banner nad lista, renderowany **poza `VList`**,
wiec nigdy nie wypada z okna wirtualizacji. Przycisk przewija do pierwszej karty sekcji przez
istniejacy `scrollToIndex`, a NIE nawiguje do `/mapa/online` — nawigacja czyscilaby aktywny filtr
wojewodztwa (jeden slot sciezki), a chcemy zostawic uzytkownika w kontekscie.

Widoczny tylko gdy sa **jednoczesnie** wyniki lokalne i online: bez lokalnych sekcja jest juz na
gorze, wiec banner bylby szumem.

Potwierdzone na zywo (`curl` na dev serverze):

| URL | Banner | Sekcja w HTML |
|---|---|---|
| `/mapa` | "Dostepnych online: 1" | brak (zakopana) |
| `/mapa/pomorskie` | "Dostepnych online: 5" | obecna (5) |
| `/mapa/online` | brak (poprawnie) | obecna (5) |

Pierwszy wiersz byl wczesniej **calkowicie niewidoczny**.

#### Weryfikacja regul kubelkowania na zywych danych

`curl` na dev serverze potwierdzil R5 i R6 na prawdziwej bazie:

| URL | Sekcja online | Dlaczego tyle |
|---|---|---|
| `/mapa/pomorskie` | 5 | FotoDoKarty + 4 hybrydy, zadna nie jest w pomorskim |
| `/mapa/zachodniopomorskie` | 4 | Dobra Ksiegowa (Stargard) wpadla do listy **lokalnej** — dedupe dziala w obie strony |
| `/mapa/online` | 5 | `onlineOnly`: lista lokalna pusta |
| `/mapa/prawne/online` | brak sekcji | zadna usluga zdalna nie jest w kategorii `law` |

#### Bug preegzystujacy: soft-404 na calej trasie mapy — poza scope'em

**Kazdy** bledny URL mapy zwraca **HTTP 200** z trescia not-found: `/mapa/bzdura`,
`/mapa/prawne/bzdura`, `/mapa/a/b/c`, a takze `/en/map/bzdura`. Przyczyna to
`NextResponse.rewrite` w `src/middleware.ts` (naglowek `x-middleware-rewrite` w odpowiedzi) —
`notFound()` renderuje strone, ale status zostaje 200.

Dla Google to soft-404, czyli indeksowalne smieci. **Nie pochodzi z U4** — parser odrzuca
prawidlowo, co potwierdza test jednostkowy `parseMapSlug(['pomorskie','online'])`. To osobny
problem w tej samej okolicy co U9 (SEO), do naprawy jako niezalezne zadanie.

#### Uwaga o asercji indeksow

`useMediaQuery` startuje od `false` i przelacza sie dopiero w efekcie, wiec pierwszy render idzie
sciezka desktopowa przez `virtua`. W jsdom kontener ma zerowa wysokosc, wiec zbior zamontowanych
elementow jest **niedeterministyczny** - pierwsza wersja testu sprawdzala `cardRefs.current.length`
i failowala losowo. Asercja celuje teraz w DOM (kazda usluga dokladnie raz) oraz w brak kolizji
wsrod *przypisanych* refow. Testujemy `MapList`, nie wirtualizacje `virtua`.

---

### U7. Mapa - piny tylko dla odwiedzalnych + empty state

**Delegate to:** `feature-builder-web-ui` - **Naklad:** M - **Zaleznosci:** U1, U5
**Wymagania:** R3, R11

- [x] `overview-map/utility.ts` - `createPoints` filtruje `coverage !== 'online'` **i** obecnosc wspolrzednych
- [x] `overview-map/utility.ts` - luzne `!= null` (lapie `null` i `undefined`)
- [x] `overview-map/utility.ts` - zawezenie przez predykat typu; **zero `!` i `as`**
- [x] `overview-map.tsx` - nakladka empty state gdy `isMobile && points.length === 0`
- [x] `overview-map.tsx` - na desktopie nakladki nie ma (lista jest obok)
- [x] Klucz `map_no_pins` w czterech plikach `messages/` (dodany w U6)
- [x] Stworz `overview-map/utility.test.ts` - **8 scenariuszy**
- [x] `Test:` wpis `coverage: 'online'` ze wspolrzednymi -> **nie** tworzy pinu
- [x] `Test:` wpis `coverage: 'hybrid'` ze wspolrzednymi -> tworzy pin
- [x] `Test:` wpis `coverage: 'local'` z `latitude: null` -> **nie** tworzy pinu, bez wyjatku
- [x] `Test:` wpis `coverage: 'local'` ze wspolrzednymi -> tworzy pin (regresja podstawowa)
- [x] `Test:` `createPoints([])` -> `[]`
- [x] `Test:` mieszana lista -> tylko wpisy odwiedzalne ze wspolrzednymi
- [x] `Test:` zachowanie kolejnosci wejsciowej
- [x] `Weryfikacja:` `npx jest overview-map` - **8/8 PASS**
- [x] `Weryfikacja:` `npx tsc --noEmit` - **0 bledow**
- [x] `Weryfikacja:` `npx next lint` - **0 bledow**
- [x] `Weryfikacja:` `grep -cE "latitude!|longitude!|as number" utility.ts` -> **0**
- [x] `Operator:` `/mapa` -> brak pinu dla FotoDoKarty (potwierdzone: 0 linkow `destination=null`)
- [ ] `Operator:` `/mapa/online` na mobile w widoku "mapa" -> empty state kierujacy do listy
- [ ] `Operator:` wpis `hybrid` ma pin i jest osiagalny przez filtr "Online"

Commit: `dc1150f`

#### Co U7 faktycznie zmienil

Do U7 przed pinem dla wpisu zdalnego chronila nas **wylacznie nullowalnosc wspolrzednych**.
Wpis `online`, ktory *ma* adres rejestrowy ze wspolrzednymi, dostawal pin. Dwa z osmiu testow
byly RED przed zmiana - dokladnie te, ktore wymagaja warunku na `coverage`. Teraz regula jest
strukturalna, a nie przypadkowa wlasciwosc danych.

---

### U8. Karta uslugi - oznaczenie zasiegu i null-safety adresu

**Delegate to:** `feature-builder-web-ui` - **Naklad:** L - **Zaleznosci:** U1
**Wymagania:** R9, R10

- [x] Stworz `service-card.test.tsx` z characterization testami
- [x] `service-card.tsx` - gardy `!== undefined` -> `!= null` (zrobione w U1)
- [x] `service-card.tsx` - `navigateLink` jest `null` bez wspolrzednych, link renderowany warunkowo
- [x] `service-card.tsx` - `actionButtonCount` liczy realna liczbe przyciskow
- [x] `service-card.tsx` - `Badge` zasiegu dla `online` i `hybrid`, tekst z i18n
- [x] `service-card.tsx` - wariant `aqua` jawnie, **nie** przez `mapCategoryToBadgeColor`
- [x] `service-card.tsx` - `coverage` dodane do destrukturyzacji propsow
- [x] `service-card.tsx` - potwierdzone testem, ze `addressParts` nie zostawia wiszacego przecinka
- [x] `marker-popup.tsx` - early return bez wspolrzednych (zrobione w U1)
- [x] Klucz `MapCard.coverage_online` w czterech plikach `messages/`
- [x] `Test:` `coverage: 'online'`, `street: null`, wspolrzedne `null` -> adres bez wiszacego przecinka
- [x] `Test:` `coverage: 'online'` -> link "Nawiguj" **nie** renderowany
- [x] `Test:` `coverage: 'online'` -> badge zasiegu obecny
- [x] `Test:` `coverage: 'hybrid'` -> badge **i** link nawigacji obecne
- [x] `Test:` `coverage: 'local'` -> badge **nieobecny**, link obecny (regresja)
- [x] `Test:` `openingHours: {}` -> bez wyjatku
- [x] `Test:` klik karty przy wspolrzednych `null` -> `handleFlyTo` **nie** wywolany
- [x] `Test:` `jest-axe` bez naruszen dla `local`, `online`, `hybrid`
- [x] `Test:` brak tekstu "null" w tresci karty bez wspolrzednych
- [x] `Weryfikacja:` `npx jest service-card` - **14/14 PASS**
- [x] `Weryfikacja:` `npx tsc --noEmit` - **0 bledow**
- [x] `Weryfikacja:` `npx next lint` - **0 bledow**
- [x] `Weryfikacja:` `grep -cE "latitude !== undefined|longitude !== undefined"` -> **0**
- [x] `Operator:` potwierdzone na dev serverze: badge "Online - cala Polska" renderuje sie na `/mapa/online` i `/mapa/pomorskie`, **zero** linkow `destination=null`

Commit: `af74e15`

#### Characterization testy zaplacily sie natychmiast

Pierwsza wersja zmiany wywalila render **wszystkich 14 testow naraz**: `coverage` NIE bylo
destrukturyzowane z propsow karty, wiec `coverage === 'online'` bylo ReferenceError. Bez testow
przed zmiana ten blad wyszedlby dopiero w przegladarce, jako pusta karta bez komunikatu.
Dokladnie powod, dla ktorego plan wymagal characterization przed dotknieciem pliku na 666 linii.

#### Bug preegzystujacy: godziny otwarcia NIGDY sie nie renderuja - poza scope'em

`getTodayHours` (`service-card.tsx:82-84`) buduje klucz z wielkiej litery:

```
const days = ['Sunday', 'Monday', 'Tuesday', ...];
const today = days[new Date().getDay()];
return openingHours[today] || null;
```

A dane w `seed.ts` i w bazie maja klucze **mala litera** (`monday`, `tuesday`, ...) - potwierdzone
zapytaniem do bazy w U1. Czyli `openingHours['Saturday']` nigdy nie trafia w `'saturday'`,
`todayHours` jest zawsze `null`, a blok godzin otwarcia **nie renderuje sie dla zadnej uslugi
w calej aplikacji**. Funkcja nigdy nie dzialala.

Wykryte przez fixture testowy uzywajacy kluczy zgodnych z baza. **Nie naprawiam w U8** - to
zmiana widoczna wizualnie na kazdej karcie w aplikacji, poza zasiegiem tego zadania, i wymaga
decyzji czy poprawic funkcje, czy dane. Usunalem z testow asercje o renderowaniu godzin, zeby
nie utrwalac zepsutego zachowania.

---

## Faza 5 — SEO

### U9. Sitemap i metadata dla `/mapa/online`

**Delegate to:** `feature-builder-web-fullstack` - **Naklad:** M - **Zaleznosci:** U4, U6
**Wymagania:** R8

- [x] `sitemap.ts` - `/mapa/online` i `/en/map/online`, priorytet 0.7
- [x] `sitemap.ts` - **utrzymana konwencja**: kategorie tylko dla `pl` i `en`, bez `ru`/`uk`
- [x] `sitemap.ts` - **bez** kombinacji `/mapa/{kategoria}/online` (thin content)
- [x] `page.tsx` - `onlineOnly` wplywa na `titleSuffix`
- [x] `page.tsx` - `onlineOnly` wplywa na `canonical`
- [x] `page.tsx` - `onlineOnly` przekazany do `buildMapUrl` w petli `languageUrls`
- [x] `page.tsx` - etykieta z i18n (`MapPage.Categories.Online`), nie hardkodowana
- [x] Stworz `src/app/sitemap.test.ts` - **8 scenariuszy**
- [x] `Test:` sitemap zwraca wpisy konczace sie na `/mapa/online` oraz `/en/map/online`
- [x] `Test:` sitemap **nie** zwraca zadnego URL-a `/{mapa|map}/{cokolwiek}/online`
- [x] `Test:` sitemap nie zawiera duplikatow URL-i
- [x] `Test:` wpis online ma metadane jak pozostale trasy mapy
- [x] `Test:` regresje - strony glowne, mapa, wszystkie kategorie (pl i en), wszystkie wojewodztwa
- [x] `Test:` konwencja utrzymana - zero URL-i `/ru/map/` i `/uk/map/`
- [x] `Weryfikacja:` `npx jest sitemap` - **8/8 PASS**
- [x] `Weryfikacja:` `npx tsc --noEmit` - **0 bledow**
- [x] `Weryfikacja:` `npx next lint` - **0 bledow**
- [x] `Weryfikacja:` `npm run build` - **przechodzi**
- [x] `Operator:` `/sitemap.xml` zawiera `/mapa/online` i `/en/map/online`
- [x] `Operator:` `/mapa/online` ma wlasny `<title>` rozny od `/mapa`
- [x] `Operator:` `/mapa/online` ma `rel=canonical` na siebie i `hreflang` dla 4 locale
- [x] `Operator:` `/mapa/prawne/online` ma tytul zawierajacy kategorie i oznaczenie online

Commit: `b2de5bb`

#### Potwierdzenie na dev serverze

| URL | `<title>` |
|---|---|
| `/mapa` | Mapa Uslug - Polvia |
| `/mapa/online` | Mapa Uslug - Polvia - **Online** |
| `/mapa/prawne/online` | Mapa Uslug - Polvia - **Prawne, Online** |
| `/en/map/online` | Services Map - Polvia - **Online** |

`hreflang` dla czterech locale, z poprawnymi slugami kategorii per jezyk:
`/mapa/prawne/online`, `/en/map/law/online`, `/ru/map/pravovye/online`,
`/uk/map/pravovi/online`. Slug `online` identyczny wszedzie, zgodnie z R8.

**Uwaga:** `canonical` wskazuje na `http://localhost:3000`, bo tak ustawiony jest
`NEXT_PUBLIC_SITE_URL` w `.env` — to konfiguracja lokalna, nie blad.

#### Znalezisko: `sitemap.ts` czyta `process.env` bezposrednio

`src/app/sitemap.ts:7` uzywa `process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.polvia.pl'`,
wbrew regule z `CLAUDE.md` ("Zero `process.env` w kodzie aplikacji, wylacznie przez `env.ts`").
Preegzystujace, poza scope'em U9 — odnotowane.

---

## Domknięcie zadania

- [ ] `CLAUDE.md` — usuń wzmiankę o 2 błędach typecheck z sekcji „Znane odchylenia od czystego stanu repo"
- [ ] `CLAUDE.md` — dopisz `coverage` jako drugą oś obok kategorii (żeby kolejne sesje nie proponowały „kategorii online")
- [x] `Weryfikacja:` pełny quality gate — **tsc 0, jest 197/197 (11 suit), lint 0 błędów, `npm run build` przechodzi**
- [ ] `Operator:` przegląd logów Vercela po wdrożeniu pod kątem wyjątków z `map/[[...slug]]` (nowy slug w parserze = najbardziej prawdopodobne źródło 500-tek)
- [ ] `/dev-compound` — zapisz wzorzec „ortogonalny wymiar zamiast nowej wartości enuma" do `docs/solutions/`

---

## Znaleziska niezależne od tego zadania

Wszystkie **preegzystujące**, żadne nie pochodzi z zadania `online-service-coverage`.

### Naprawione (2026-08-22, na życzenie użytkownika)

| # | Problem | Commit | Efekt |
|---|---|---|---|
| 2 | Hardkodowany prefiks `/en` dla każdego locale ≠ `pl` (3 miejsca) | `99e1a8a` | Klik filtra na `ru`/`uk` już nie przełącza języka. Warunek wyciągnięty do `localePathPrefix()` / `localizedMapBasePath()`, żeby nie powstała czwarta kopia |
| 3 | Błędne URL-e mapy zwracały HTTP 200 z treścią 404 (soft-404) | `f9a1340` | 6 błędnych URL-i → 308 na poprawną dla locale ścieżkę bazową; 8 poprawnych → 200 bez zmian |
| 4 | Martwy `drizzle:generate` + myląca procedura w `CLAUDE.md` | `b1c0b60` | Skrypt faktycznie startuje; `CLAUDE.md` opisuje `push` i ostrzega przed `rename`; dopisana sekcja o zasięgu jako drugiej osi |

Mechanizm soft-404 okazał się inny, niż zakładałem: **nie** rewrite w middleware, a
`notFound()` odpalone po rozpoczęciu streamowania (`<Suspense>` w catch-all). Nagłówki są
wtedy już wysłane ze statusem 200. Pełny rozbiór:
`docs/solutions/deployment-issues/2026-08-22-soft-404-notfound-podczas-streamowania.md`.

### Otwarte — do decyzji

| # | Problem | Gdzie | Skutek |
|---|---|---|---|
| 1 | `getTodayHours` buduje klucz z wielkiej litery (`'Saturday'`), dane mają małą (`'saturday'`) | `service-card.tsx:82-84` | **Godziny otwarcia nigdy się nie renderują** — dla żadnej z 140 usług. Świadomie odłożone: naprawa zmieni wygląd wszystkich kart |
| 5 | `role="status"` + `tabIndex={0}` na **każdym** badge'u | `badge.tsx` (wymóg istniejących testów) | Dziesiątki przystanków tabulacji i regionów live na liście wyników. Badge nie jest interaktywny |
| 6 | `process.env` czytany bezpośrednio | `sitemap.ts:7` | Wbrew regule z `CLAUDE.md` („wyłącznie przez `env.ts`"). Kosmetyczne |
| 7 | Cztery źródła prawdy o kategoriach; `government` osiągalne w UI, ale **niezapisywalne** | `schema.ts`, `consts.ts`, `slug-mappings.ts`, `service-form.tsx` | Kategoria widoczna w filtrach i URL-ach, której nie da się przypisać żadnej usłudze |
| 8 | `next/link` zamiast `@/i18n/navigation` | `service-card.tsx:8` | Wbrew regule i18n z `CLAUDE.md` — gubi prefiks locale |
| 9 | `map/not-found.tsx` to relikt po forku | `map/not-found.tsx` | Strona 404 mapy pokazuje **SVG Irlandii**, tekst „businesses across Ireland" i stopkę **„© Qolie. All rights reserved."** — nazwę obcej firmy |
| 10 | `drop-migrate-seed` woła `drizzle:generate` | `package.json:17` | Skrypt nie działał **nigdy**: drop → nic nie wygenerowane → seed na pustej bazie. Właściwy odpowiednik to `db:reset` |

Pozycja 9 jest widoczna dla użytkownika i dotyczy cudzej marki — warta uwagi wyżej, niż
sugeruje numer.
