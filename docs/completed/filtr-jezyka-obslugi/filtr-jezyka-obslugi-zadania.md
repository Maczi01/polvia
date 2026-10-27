# Zadania: Filtr języka obsługi + białoruski

**Branch:** `feature/filtr-jezyka-obslugi`
**Ostatnia aktualizacja:** 2026-10-27

## Źródła

- Requirements doc: [docs/brainstorms/2026-10-18-filtr-jezyka-obslugi-requirements.md](../../brainstorms/2026-10-18-filtr-jezyka-obslugi-requirements.md)
- Plan techniczny: [docs/plans/2026-10-18-001-feat-filtr-jezyka-obslugi-plan.md](../../plans/2026-10-18-001-feat-filtr-jezyka-obslugi-plan.md)

## Legenda

- Bez prefiksu — zadanie implementacyjne
- `Test:` — scenariusz testowy (przeniesiony z planu technicznego)
- `Weryfikacja:` — kryterium automatyczne (CLI); odznaczane przez `/dev-docs-review` po PASS
- `Operator:` — krok wymagający człowieka; **nie** odznaczany automatycznie

> Projekt nie ma `.env.e2e`, więc scenariusze przeglądarkowe są krokami `Operator:`, nie `[E2E]`.

---

## Faza 1 — Języki obsługi i białoruski

### U1. Moduł języków + `be` w formularzach i na kartach

**Delegate to:** `feature-builder-web-fullstack` · **Nakład:** M · **Zależności:** brak
**Wymagania:** R3, R4, R16, R17, R18

- [x] Stwórz `src/lib/languages.ts` (bez importów runtime'owych): kody pl, uk, ru, en, be w tej kolejności, typ, guard, ścieżka flagi i endonim per kod
- [x] `src/lib/add-business/form-limits.ts` — reeksport z `languages.ts` zamiast własnej listy
- [x] `business-card-preview.tsx` i `generated-summary.tsx` — locale treści przez `locales`/`Locale` z `@/i18n/config`; mapa flag z `languages.ts`
- [x] `languages-field.tsx` — lista z modułu (jeśli ma własną)
- [x] `src/lib/add-business/llm-draft.ts` — reguła `LANGUAGES` w prompcie wymienia `be`
- [x] `submission-emails.ts` — nazwa `be` w mailu potwierdzającym
- [x] `service-card.tsx` — mapa flag z `languages.ts`, alt z tłumaczeń
- [x] Dashboard: opcja `be` w `add-service-form.tsx` i `service-form.tsx`
- [x] `public/icons/by.svg` → flaga biało-czerwono-biała (512×512, okrągła maska jak `pl.svg`)
- [x] `messages/{pl,en,ru,uk}.json` — `addBusiness.languages.be`, `addBusiness.confirmationEmail.languages.be`
- [x] Grep wszystkich miejsc renderujących flagi/listy języków — żadne nie zostaje z własną listą bez `be`
- [x] `Test:` guard akceptuje pl/uk/ru/en/be, odrzuca `de`, `''`, `PL`
- [x] `Test:` każdy kod ma ścieżkę flagi i niepusty endonim
- [x] `Test:` `owner-edits-schema` przyjmuje `['be']`; `'de'` dalej odrzucone
- [x] `Test:` podgląd karty z `['pl','be']` — dwie flagi z alt z tłumaczeń; opisy wg locale strony (brak indeksowania `descriptions['be']`)
- [x] `Test:` karta usługi z `be` — alt przetłumaczony; `jest-axe` bez naruszeń
- [x] `Test:` mail potwierdzający wymienia białoruski w języku maila
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [x] `Weryfikacja:` testy `src/lib/languages`, `src/lib/add-business`, podglądu karty i karty usługi przechodzą
- [x] `Weryfikacja:` grep — `be` w `addBusiness.languages` we wszystkich czterech `messages/*.json`
- [ ] `Operator:` dopisać `be` do sekcji `languages` w `.claude/skills/dodaj/references/klasyfikacja.md`
- [ ] `Operator:` wizualna akceptacja nowej flagi `by.svg`

## Do poprawy po review fazy 1

Raport: [review-faza-1.md](review-faza-1.md) — ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 3 × P2).
P2 #1–#2 naprawić przed fazą 2: filtr zależy od poprawnych kodów w bazie.

- [x] 🟠 [important] **`src/app/[locale]/(dashboard)/dashboard/_components/add-service-form.tsx:41`, `service-form.tsx:61`** — lista języków nie jest sprawdzana pod kątem kompletności (`satisfies` na tablicy), skopiowana w dwóch plikach, kolejność ≠ kanoniczna; `Record<ServiceLanguage, string>` z etykietami + `SERVICE_LANGUAGES.map(...)`, jedna definicja → `_components/language-options.ts` (+ test)
- [x] 🟠 [important] **`src/app/[locale]/(dashboard)/dashboard/_service-schema.ts:41, :120`** — `z.array(z.string())` + `as string[]` wpuszcza do bazy dowolny kod; `z.array(z.enum(SERVICE_LANGUAGES))` bez rzutowania (+ test: `be` przyjęte, `de` odrzucone) → `filter(isText)` zamiast `as`; zapis z nieznanym kodem odrzucany błędem walidacji
- [x] 🟠 [important] **`src/lib/add-business/llm-draft.test.ts`** — brak testu, że odpowiedź modelu z `['be','be']` daje w szkicu `['be']` (schema + `normalizeLanguages`)
- [x] 🟡 [nit] **`draft-editor.test.tsx`** — test: checkbox białoruskiego z przetłumaczoną etykietą, zaznaczenie wkłada `be` do FormData
- [x] 🟡 [nit] **`generated-summary.tsx:25`** — test regresji: tagi wybierane po locale strony, nie po języku obsługi → nowy `generated-summary.test.tsx`
- [x] 🟡 [nit] **`service-card.tsx:623`** — deduplikacja kodów (`['be','be']` → zduplikowany `key`) + test `languages: []` → `toServiceLanguages` w `src/lib/languages.ts`; sekcja ukryta też gdy wszystkie kody są nieznane
- [ ] 🟡 [nit] **`submission-emails.test.ts`** — usunąć słabą asercję `not.toMatch(/: pl, be$/m)` (pozytywne `toContain` wystarcza) — NIE ROBIONE: usunięcie asercji = osłabienie testu (reguła repo)
- [ ] 🟡 [nit] **`service-card.tsx:184`** — rozważyć neutralną przestrzeń `Languages.*` zamiast `addBusiness.languages` (decyzja przy U4)
- [ ] 🟡 [nit] **`src/lib/languages.ts` / `form-limits.ts` / `draft-schema.ts:31`** — dwie nazwy jednej listy; kandydat na późniejszy rename (dług, nie teraz)
- [ ] 🟡 [nit] **`src/db/service-input-schema.ts:124`** — `db:add` przyjmuje dowolny kod; poza scope fazy, do rozważenia
- [ ] 🟡 [nit] **`src/app/[locale]/(dashboard)/dashboard/_service-schema.ts`** — (odkryte przy poprawkach) `serviceSchema` używa `as [string, ...string[]]` dla enumów, `parseRawServiceData` ma `formData.get(x) as string` dla pozostałych pól (klasa problemu z learned patterns `z.coerce`/FormData); poza scope, osobne zadanie

---

## Faza 2 — Logika filtra

### U2. Predykat języka i liczniki per język

**Delegate to:** `feature-builder-web-data` · **Nakład:** S · **Zależności:** U1
**Wymagania:** R1, R5, R6, R9, R12

> Test-first — po jednym teście na zachowanie, pionowo.

- [x] `src/lib/service-coverage.ts` — pole `language` (nullable) w `CoverageFilters`, eksportowany `matchesLanguage`, warunek w `matching`
- [x] `src/lib/result-counts.ts` — `countCardsByLanguage` (lustro `countCardsByCategory`, wszystkie 5 kodów)
- [x] `Test:` `language: 'ru'` zostawia tylko wpisy z `ru` w obu kubełkach
- [x] `Test:` `language: null` = zachowanie sprzed zmiany
- [x] `Test:` koniunkcja kategoria + miasto + język
- [x] `Test:` `countCardsByLanguage` zwraca 5 kodów, `be: 0` gdy brak wpisów
- [x] `Test:` `countCardsByLanguage` liczy karty, nie lokalizacje
- [x] `Test:` `countCardsByCategory` z aktywnym językiem liczy tylko wpisy w tym języku
- [x] `Test:` `buildMapMetadataPath` nie zawiera `lang` ani `?` (regresja R9)
- [x] `Weryfikacja:` `npx jest src/lib/service-coverage src/lib/result-counts src/lib/map-metadata` przechodzi
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów

## Do poprawy po review fazy 2

Raport: [review-faza-2.md](review-faza-2.md) — ✅ gotowe do kontynuacji (0 × P1, 0 × P2, 10 × P3).
Wskazówki 🧭 dla U3 przenieść do promptu buildera fazy 3.

- [x] 🟡 [nit] **`src/lib/service-coverage.ts:159-161`** — kolejność w `&&`: `matchesCategory`/`matchesLanguage` przed drogim `matchesQuery` (te same wyniki, mniej normalizacji w licznikach)
- [x] 🟡 [nit] **`src/lib/result-counts.ts:59-65`** — docstring `countCardsByLanguage`: wyniki semantyczne nie są liczone (jak w `countCardsByCategory`)
- [x] 🟡 [nit] **`src/lib/service-coverage.test.ts:379`** — testy `onlineOnly: true` + `language` oraz `query` + `language`
- [x] 🟡 [nit] **`src/lib/result-counts.test.ts:157`** — wpis `hybrid` w katalogu `countCardsByLanguage` → katalog rozszerzony lokalnie w nowym teście (dopisanie do wspólnego złamałoby istniejące asercje)
- [x] 🟡 [nit] **`src/lib/map-metadata.test.ts:57`** — komentarz: test R9 pilnuje kontraktu (`MapFilters` bez języka), dziś nie może failować
- [x] 🟡 [nit] **`src/lib/service-coverage.test.ts:436-438`** — `matchesLanguage(service(...), undefined)` zamiast zmiennej `bezJezyka` → jawne `undefined` to błąd `unicorn/no-useless-undefined`; zostaje obiekt, przemianowany na `filtersWithoutLanguage` z komentarzem
- [x] 🟡 [nit] **`result-counts.test.ts:196`, `service-coverage.test.ts:415`** — dwie nowe linie > 100 znaków (Prettier)
- [ ] 🟡 [nit] **`src/lib/result-counts.ts`** — normalizacja `query` powtarzana w 16 przebiegach; filtr po query raz przy wzroście N (nie teraz)
- [x] 🧭 [U3] parser `?lang` przez `parseAsStringLiteral(SERVICE_LANGUAGES)` / `isServiceLanguage`, nigdy `as` (R10)
- [x] 🧭 [U3] `countCardsByLanguage` w osobnym `useMemo` (`[services, currentFilters, searchInput]`), `language` w stanie filtrów; rozważyć `useDeferredValue(searchInput)` → `useMemo` zrobione; `useDeferredValue` pominięty (opcjonalny)
- [ ] 🟡 [nit] **wyszukiwanie semantyczne + `?lang`** — (odkryte w U3) API `/api/services` nie dostaje języka, wynik filtrowany po stronie klienta: limit wyników semantycznych może się zapełnić wpisami, które potem odpadną; krótsza lista lokalna przy `?lang` częściej odpala semantykę. Do rozważenia: parametr `lang` w API (poza scope)

---

## Faza 3 — Stan `?lang`

### U3. `?lang` wpięty w mapę, listę i wyniki semantyczne

**Delegate to:** `feature-builder-web-ui` · **Nakład:** M · **Zależności:** U2
**Wymagania:** R1, R7, R8, R10, R11, R12

- [x] Stwórz `src/hooks/use-language-filter.ts` — `useQueryState('lang', parseAsStringLiteral(kody).withOptions({ history: 'push' }))`
- [x] `map-page-client.tsx` — język w `categoryCounts`/`totalCount`; `languageCounts` przekazywane w dół
- [x] `services-client-component.tsx` — język w `coverageFilters`; `matchesLanguage` w `filteredEmbeddingResults`
- [x] `map/[[...slug]]/page.tsx` — legacy redirect zachowuje `lang`
- [x] Brak inicjalizacji z locale; niepoprawna wartość bez `notFound()`/redirectu
- [x] `Test:` hook — `?lang=ru` → `'ru'`; `?lang=xx` → `null`; brak → `null`
- [x] `Test:` `map-page-client` z `?lang=ru` — tylko wpisy z `ru` na liście i jako piny; liczniki kategorii = liczba kart
- [x] `Test:` `?lang=xx` — pełna lista
- [x] `Test:` wynik semantyczny bez wybranego języka nie pojawia się przy aktywnym `?lang`
- [x] `Test:` locale `uk` bez `?lang` nie zawęża wyników
- [x] `Weryfikacja:` testy `map-page-client` i `use-language-filter` przechodzą (ścieżki escapowane, liczba `Test Suites:` zgodna)
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [ ] `Operator:` `/mapa?lang=ru` → tylko firmy z RU; klik „Prawne" → `/mapa/prawne?lang=ru`, filtr zachowany
- [ ] `Operator:` przełączenie strony na `uk` przy `?lang=ru` → `/uk/map…?lang=ru`, filtr działa
- [ ] `Operator:` `/mapa?lang=xx` → pełna lista, status 200, zero błędów konsoli

## Do poprawy po review fazy 3

Raport: [review-faza-3.md](review-faza-3.md) — ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 1 × P2, 11 × P3).
P2 naprawić przed U4 lub razem z U4 (ten sam obszar: filtr języka zmieniany z kontrolki).

- [x] 🟠 [important] **`src/app/[locale]/(main)/_components/services-client-component.tsx:157-208`** — zmiana `?lang` przy aktywnym zapytaniu kasuje wyniki semantyczne (`setEmbeddingResults([])`, l.166) i nie pobiera ich ponownie: klucz deduplikacji (l.160) nie zawiera języka. Dodać `language` do klucza + test komponentu („prawnik" + zmiana języka → wyniki semantyczne ponownie pobrane i przefiltrowane) → `src/lib/semantic-search-key.ts` (wszystkie osie, w tym miasto i `onlineOnly`) + test komponentu (bez poprawki pada)
- [ ] 🟡 [nit] **`src/app/[locale]/(main)/map/[[...slug]]/page.tsx:121-128`** — `lang` jako parametr `buildMapUrl` (nie doklejany po), przepuszczany tylko gdy `isServiceLanguage`; drugi redirect legacy (`/_/`, l.101-105) też zachowuje `lang`; test
- [ ] 🟡 [nit] **testy komponentu** — `totalCount` przy `?lang`; `/mapa/online?lang=en`; `?lang=be` bez wpisów → empty state — częściowo: empty state `?lang=be` i „Pokaż N wyników" przy `?lang` zrobione; `/mapa/online?lang=en` dalej bez testu komponentu
- [ ] 🟡 [nit] **testy** — hook dla `?lang=RU` i `?lang=` (→ `null`); R8 (przełącznik locale zachowuje `?lang`, `language-switcher.tsx` bez testów) — hook zrobiony; R8 dalej bez testu
- [x] 🟡 [nit] **`map-page-client.test.tsx`** — 367 linii; blok `describe` języka do osobnego pliku → `map-page-client.language.test.tsx` + `map-page-client.fixtures.tsx` (190 linii)
- [x] 🟡 [nit] **`use-language-filter.test.tsx:10`** — `RenderHookResult<…>` zamiast nieczytelnego `ReturnType<typeof renderHook<…>>`
- [x] 🟡 [nit] **`use-language-filter.ts:16`** — alias typu stanu w hooku, żeby kontrolka (U4) nie importowała typów nuqs (decyzja przy U4) → `export type LanguageFilterState`
- [ ] 🟡 [nit] **`services-client-component.tsx:23`, `map-page-client.tsx:8`** — kolejność importów `@/hooks`
- [ ] 🟡 [nit] **`page.tsx:111-113`** — (preegzystujące) `query`/`place` `as string`: powtórzone `?query=a&query=b` w legacy URL → 500; guard `typeof === 'string'`
- [x] 🟡 [nit] **semantyka + zmiana miasta** — (preegzystujące) `city` też nie jest w kluczu deduplikacji efektu semantycznego; ten sam mechanizm co P2 — naprawić razem → w `semanticSearchKey`
- [ ] 🟡 [nit] **`messages/en.json`, `ru.json`, `uk.json`** — (preegzystujące, odkryte w U4) klucz najwyższego poziomu `serviceWrapper` tylko w `pl.json` — potencjalny runtime error na en/ru/uk
- [ ] 🟡 [nit] **testy `AddBusinessFlow` („limit wysylek…")** — flaky przy równoległym `npx jest` pod obciążeniem (1 fail), zielone przy `--runInBand` (110/110); prawdopodobnie ten sam objaw co niezidentyfikowane faile z review fazy 1 — ustabilizować timing

---

## Faza 4 — Kontrolka

### U4. Dropdown języka — desktop, mobilny arkusz, „Usuń filtry"

**Delegate to:** `feature-builder-web-ui` · **Nakład:** M · **Zależności:** U3
**Wymagania:** R2, R3, R4, R5, R13, R14, R15

- [x] `map-page-client.tsx` — przekaż `languageCounts` do `<FilterComponent>` (wyliczone w U3, dziś nieużyte → ostrzeżenie lintu); `FilterComponentProps.languageCounts` → dalej do `MobileFilterModal` jak `categoryCounts`; `useLanguageFilter()` w `FilterComponent`
- [x] Stwórz `src/app/[locale]/(main)/_components/language-select/language-select.tsx` (kontrolowany, prymitywy `Select*`, „Dowolny język" + 5 języków: flaga, endonim, `CountBadge`, `sr-only` liczba)
- [x] Stwórz `language-select.test.tsx` i `language-select.stories.tsx`
- [x] `filter-component.tsx` — dropdown obok „Wybierz lokalizację"; `hasActiveFilters` i `resetAllFilters` uwzględniają język
- [x] `mobile-filter-modal.tsx` — props: wybrany język, zmiana, liczniki; `clearCategories` bez zmian
- [x] `messages/{pl,en,ru,uk}.json` — `MapPage.languageFilter`, `MapPage.anyLanguage`
- [x] `Test:` 5 endonimów + „Dowolny język" z licznikami; nazwa dostępna zawiera liczbę; `jest-axe` bez naruszeń
- [x] `Test:` wybór „Русский" → onChange `'ru'`; „Dowolny język" → `null`
- [x] `Test:` język z licznikiem 0 klikalny (nie `disabled`)
- [x] `Test:` `filter-component` — przy samym `?lang=ru` „Usuń filtry" aktywny; klik czyści `lang`
- [x] `Test:` `mobile-filter-modal` — zmiana języka aktualizuje „pokaż wyniki"; „wyczyść kategorie" nie rusza języka
- [x] `Test:` etykiety renderują się na `pl` i `uk`
- [x] `Weryfikacja:` testy `language-select`, `filter-component`, `mobile-filter-modal` przechodzą (3 suites)
- [x] `Weryfikacja:` `npx tsc --noEmit` bez błędów, `npx next lint` bez błędów
- [x] `Weryfikacja:` grep — `languageFilter` i `anyLanguage` we wszystkich czterech `messages/*.json`
- [ ] `Operator:` desktop `/mapa` — wybór „English" → `?lang=en`, liczniki chipów maleją, „wstecz" przywraca stan
- [x] `Operator:` mobile 390px — dropdown w arkuszu; „pokaż wyniki (N)" = lista; **lista opcji nad arkuszem (P2 #2), Escape w otwartym selekcie nie zamyka arkusza (P2 #1)** — sprawdzone 2026-10-26 przez orkiestratora (chrome-devtools, 375 px, :3001): dropdown w arkuszu ✓, wartość „Русский" z `?lang=ru` ✓, „Resetuj" aktywny przy samym `?lang` ✓, Escape ✓; lista opcji pod arkuszem ✗ (P2 #2); po poprawce 2026-10-27: lista języka i lokalizacji nad arkuszem ✓
- [ ] `Operator:` `/uk/map` — etykiety po ukraińsku, endonimy bez zmian; „Беларуская 0" → empty state, reset czyści język
- [x] `Operator:` desktop 768–1024 px — trzy kontrolki (szukaj, lokalizacja, język) czytelne, nieobcięte (P2 #5) — sprawdzone 2026-10-27 (chrome-devtools, :3001): 1024 i 1440 OK; przy 768 „Wybierz lokalizację" nadal lekko obcięte (122 px) → P3 niżej

## Do poprawy po review fazy 4

Raport: [review-faza-4.md](review-faza-4.md) — ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 5 × P2, 15 × P3).
Ostatnia faza — **P2 naprawić przed merge**. #2 i #5 najpierw potwierdzić w przeglądarce (wymaga działającego dev servera).

- [x] 🟠 [important] **`src/app/[locale]/(main)/_components/mobile-filter-modal.tsx:99-104`** — Escape (i Tab) z otwartej listy selecta bąbelkuje przez portal do `onKeyDown` dialogu → zamyka cały arkusz; ignorować zdarzenia spoza `containerRef` + test (dotyczy też selecta województw) → filtr `containerRef.contains(target)`; 2 testy (failowały bez poprawki); **potwierdzone w przeglądarce** (Escape zamyka listę, arkusz zostaje)
- [x] 🟠 [important] **`src/components/ui/select/select.tsx:92` vs `mobile-filter-modal.tsx:123`** — lista opcji (`z-[105]`, portal) pod arkuszem (`z-[999]`) — **POTWIERDZONE w przeglądarce** (375 px, hit-test trafia w arkusz, zrzut `e2e-faza4-mobile-select-pod-arkuszem.png`); dotyczy też selecta województw → **filtr lokalizacji na mobile dziś bezużyteczny (preegzystujące)**; `z-[1000]` na `SelectContent` selectów w arkuszu (lokalnie, nie globalnie) → **NAPRAWIONE 2026-10-27:** `contentClassName` w `SelectScrollable` i `LanguageSelect`, stała `SHEET_SELECT_CONTENT_CLASS = 'z-[1000]'` w arkuszu; w przeglądarce obie listy (język, lokalizacja) nad arkuszem i klikalne — zrzut `e2e-faza4-po-poprawce-mobile-lista-nad-arkuszem.png`
- [x] 🟠 [important] **`src/app/[locale]/(main)/_components/services-client-component.tsx:100-152`** — brak `AbortController`: starsza odpowiedź semantyczna nadpisuje nowszą i gasi loading; abort w cleanup i przed nowym fetchem, `AbortError` ignorowany + test (reguła §13) → hook `src/hooks/use-semantic-search.ts` (abort w ref, timeout 8 s na tym samym kontrolerze), 5 testów; komponent 678 → 554 linii
- [x] 🟠 [important] **`src/lib/semantic-search-key.ts:12-20`** — osie wpisane ręcznie; wymusić kompletność `satisfies Record<keyof Required<CoverageFilters>, unknown>` (nowa oś bez klucza = błąd kompilacji) → `satisfies Record<keyof CoverageFilters, unknown>`, sprawdzone `tsc` na kopii typu (brak i nadmiar = błąd)
- [x] 🟠 [important] **`src/app/[locale]/(main)/_components/filter-component.tsx:426`** — **POTWIERDZONE w przeglądarce, szerzej niż zakładano:** lokalizacja/język 72 px przy 768, 100 px przy 1024, lokalizacja obcięta nawet przy 1440 (147 px), zrzut `e2e-faza4-desktop-768.png`. **Decyzja użytkownika (2026-10-26): kompaktowy wyzwalacz języka** — w stanie zamkniętym flaga + krótki kod (🌐 dla „Dowolny"), naturalna szerokość ~80 px; rozwinięta lista bez zmian (endonimy + liczniki) → **NAPRAWIONE 2026-10-27:** `LanguageSelect variant="compact"` w pasku (96 px, flaga + kod, glob dla „Dowolny"), lewy blok `w-1/2 xl:w-2/5`; zmierzone w przeglądarce: szukaj/lokalizacja 122 / 186 / 219 px przy 768 / 1024 / 1440 — zrzut `e2e-faza4-po-poprawce-desktop-1440.png`
- [x] 🟡 [nit] **`language-select.tsx:71`** — `aria-label` nadpisuje wybraną wartość w nazwie dostępnej (WCAG 2.5.3); `aria-labelledby` = etykieta + wartość → nazwa dostępna „Język obsługi: {endonim}" w obu wariantach (+ `title`)
- [ ] 🟡 [nit] **testy** — reset przy slugu kategorii + `?lang` (realne `window.location.search`); endonimy na liście w scenariuszu `uk` — (`global.fetch` przywracany po teście: zrobione)
- [x] 🟡 [nit] **`services-client-component.tsx:205-209`** — nadmiarowe zależności efektu obok `coverageFilters` → zależności hooka `[filters, localResults, locale]`
- [ ] 🟡 [nit] **`filter-component.tsx:319`** — `hasActiveFilters` jako `boolean`
- [ ] 🟡 [nit] **`filter-component.tsx`** — 547 linii; wydzielić pasek desktopowy (`desktop-filter-bar/`) — dług
- [ ] 🟡 [nit] **`language-select.stories.tsx`** — tytuł wg konwencji `component/...`, story bez `counts`; `map-page-client.fixtures.tsx` → `tests/fixtures/`; alias `renderWithServices` — stories: tytuł `component/languageSelect` + `WithoutCounts` zrobione; fixtures i alias `renderWithServices` otwarte
- [ ] 🟡 [nit] **`filter-component.tsx` @768 px** — (po poprawce P2 #5) „Wybierz lokalizację" lekko obcięte przy 122 px; szerszy lewy blok zjadłby przewijany pasek kategorii — do rozważenia przy wydzieleniu paska desktopowego
- [ ] 🟡 [nit] **dotyk** — tap w opcję może przelecieć do overlaya (`onClick={onClose}`) — sprawdzić na urządzeniu
- [ ] 🟡 [nit] **limit `/api/services`** — refetch przy zmianie miasta/języka zużywa 30/min szybciej; 429 bez komunikatu (zbieżne z „`lang` w API")

---

## Quality gate (przed merge)

- [x] `Weryfikacja:` `npx tsc --noEmit` — 0 błędów — PASS na zmergowanym master `af573f4` (2026-10-27)
- [x] `Weryfikacja:` `npx jest` — wszystkie testy zielone — PASS na zmergowanym master `af573f4` (2026-10-27)
- [x] `Weryfikacja:` `npx next lint` — 0 błędów — PASS na zmergowanym master `af573f4` (2026-10-27)
- [x] `Weryfikacja:` brak nowych `any`, `console.log`, sekretów poza `env.ts` — PASS na zmergowanym master `af573f4` (2026-10-27)
