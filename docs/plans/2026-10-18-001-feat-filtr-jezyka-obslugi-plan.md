---
title: 'feat: Filtr języka obsługi na mapie i liście + białoruski jako język obsługi'
type: feat
status: completed
date: 2026-10-18
origin: docs/brainstorms/2026-10-18-filtr-jezyka-obslugi-requirements.md
design_md: null
figma_spec: null
figma_screens: {}
---

# feat: Filtr języka obsługi na mapie i liście + białoruski

## Przegląd

Nowa, trzecia oś filtra mapy/listy — język obsługi (`?lang=pl|uk|ru|en|be`) — obok kategorii i
zasięgu. Filtr zawęża piny, listę, wyniki semantyczne i wszystkie liczniki; dropdown z endonimami,
flagami i licznikami na desktopie oraz w mobilnym arkuszu. Przy okazji `be` staje się pełnoprawnym
językiem obsługi w „Dodaj firmę", dashboardzie i na kartach, z flagą biało-czerwono-białą.

## Ujęcie problemu

Użytkownik bez polskiego musi znaleźć firmę, która obsłuży go w jego języku. Dane (`languages`)
istnieją i karty pokazują flagi, ale filtrować się nie da (zob. źródło:
docs/brainstorms/2026-10-18-filtr-jezyka-obslugi-requirements.md). Białoruski jest „w połowie":
karta zna `be`, formularze nie.

## Śledzenie wymagań

| Wymaganie | Unit |
|---|---|
| R1 oś ortogonalna, koniunkcja | U2, U3 |
| R2 single-select + „Dowolny język" | U4 |
| R3 opcje pl/uk/ru/en/be | U1, U4 |
| R4 endonimy, etykiety ×4 locale | U1, U4 |
| R5 liczniki per język, zera widoczne | U2, U4 |
| R6 dopasowanie „zawiera" | U2 |
| R7 `?lang=`, udostępnialny, „wstecz" | U3 |
| R8 przetrwanie zmiany locale | U3 (weryfikacja; kod już to robi) |
| R9 canonical bez `?lang` | U2 (test regresyjny; kod już to robi) |
| R10 niepoprawna wartość = brak filtra | U3 |
| R11 brak auto-włączania | U3 |
| R12 spójność pinów/listy/liczników | U2, U3 |
| R13 „Usuń filtry" czyści język | U4 |
| R14 mobilny arkusz | U4 |
| R15 dropdown obok lokalizacji | U4 |
| R16 `be` w formularzach | U1 |
| R17 nazwa białoruskiego ×4 locale | U1 |
| R18 flaga biało-czerwono-biała | U1 |

## Granice scope'u

Bez zmian względem źródła: język w ścieżce/SEO, multi-select, przegląd flag 🇷🇺/🇬🇧 jako znaczników
języka, backfill `be` w `data/services/`, flagi na pinach, sortowanie zamiast filtrowania,
białoruski jako locale UI. Dodatkowo: przycisk „wyczyść kategorie" w mobilnym arkuszu
(`clearCategories`) celowo czyści tylko kategorię — nie zmieniamy go.

## Kontekst i research

### Relevantny kod i wzorce

- `src/lib/service-coverage.ts` — `CoverageFilters` + `splitServicesByCoverage`: jedyne miejsce
  filtrowania; predykat `matching` stosuje query i kategorię do obu kubełków (local/online).
- `src/lib/result-counts.ts` — `countCardsByCategory` (podmienia kategorię, liczy karty),
  `countVisibleCards`; oba idą przez `splitServicesByCoverage`.
- `src/app/[locale]/(main)/_components/map-page-client.tsx` — hub stanu: `useQueryState('query')`
  rozlewany do obu wywołań liczników. Wzorzec dla `lang`.
- `services-client-component.tsx` — `coverageFilters` z `initialFilters` + `query`;
  `filteredEmbeddingResults` ręcznie powtarza filtr lokalizacji/kategorii (luka — patrz U3).
- `filter-component.tsx` — `navigateWithFilters` (pushState zachowuje `window.location.search`),
  `resetAllFilters`, `hasActiveFilters`; `ButtonCategory` z `CountBadge`.
- `mobile-filter-modal.tsx` — komponent kontrolowany (props `onlineOnly`, `categoryCounts`,
  `totalCount`).
- `src/components/ui/select/select.tsx` — prymitywy shadcn/Radix `Select*`;
  `select-scrollable.tsx` jest skrojony pod województwa (nie naginać).
- `src/components/ui/count-badge/count-badge.tsx` — licznik do reużycia w wierszach dropdownu.
- `src/lib/map-metadata.ts` `buildMapMetadataPath` — canonical/alternates tylko z pathname.
- `src/components/language-switcher.tsx` — kopiuje wszystkie query params przy zmianie locale.
- Lekkie moduły stałych dla klienta: `src/lib/coverage.ts`, `weekdays.ts`, `categories.ts`.

### Wiedza instytucjonalna

- Jeden wspólny predykat zamiast kopii (PR #27, `matchesLocation`): rozjazd 29 pinów vs 14 wyników
  wziął się z trzech kopii reguły lokalizacji. Język = jedna eksportowana funkcja.
- `docs/solutions/testing-issues/2026-09-27-montowanie-map-page-client-esm-only-i-next-dynamic.md`
  — nuqs w Jeście: `NuqsTestingAdapter` z `searchParams`; nowa ścieżka importu nuqs (np.
  `nuqs/server`) wymaga wpisu w `moduleNameMapper`; render w `await act(async …)`.
- `docs/solutions/deployment-issues/2026-08-22-soft-404-notfound-podczas-streamowania.md` —
  niepoprawny `?lang` nie może wołać `notFound()` w `page.tsx`.
- `docs/solutions/testing-issues/2026-10-11-jest-wzorzec-sciezki-z-route-group.md` — escapuj
  `\[locale\]` i `\(main\)` w ścieżkach `npx jest`.
- `docs/solutions/build-errors/2026-08-23-jest-worker-exceptions-rywalizacja-o-next.md` — gate przy
  zatrzymanym dev serverze.
- Reguła CLAUDE.md „Stałe dla komponentów klienckich" — lista języków w module bez zależności.

### Referencje zewnętrzne

Brak — repo ma silne lokalne wzorce (oś `coverage`, nuqs dla `query`).

## Kluczowe decyzje techniczne

- **Jeden moduł `src/lib/languages.ts`** (bez importów runtime'owych): kody języków obsługi w
  kolejności wyświetlania (pl, uk, ru, en, be), typ, type guard, ścieżki flag, endonimy.
  `form-limits.ts` reeksportuje go jako dotychczasowe `LANGUAGE_CODES`/`LanguageCode`, więc
  importerzy add-business nie zmieniają importów.
- **Rozdzielenie „język obsługi" od „locale treści"**: `business-card-preview.tsx` i
  `generated-summary.tsx` używają dziś `LANGUAGE_CODES` jako zbioru locale opisów/tagów
  (`LocalizedText` ma tylko pl/uk/en/ru). Po dodaniu `be` przechodzą na `locales`/`Locale` z
  `@/i18n/config`. Musi to być w tym samym unicie co rozszerzenie typu — inaczej typecheck czerwony.
- **Filtr w `CoverageFilters`, nie obok**: dodajemy pole `language` (nullable) do istniejącego typu
  i warunek do predykatu `matching`. Wszystkie liczniki dostają język „za darmo", a piny i lista
  już czytają kubełki z `splitServicesByCoverage`. Nie wprowadzamy nowego typu-parasola — byłby to
  rename bez zysku.
- **Predykat języka eksportowany** (`matchesLanguage`) i reużyty w `filteredEmbeddingResults` —
  wyniki semantyczne nie mogą obchodzić filtra.
- **`countCardsByLanguage`** — lustro `countCardsByCategory`: podmienia `language` na liczony,
  zwraca rekord dla wszystkich pięciu kodów (zera włącznie).
- **nuqs: `useQueryState('lang', parseAsStringLiteral(<kody>).withOptions({ history: 'push' }))`**
  — parser daje R10 (nieznana wartość → `null`), `push` daje R7 („wstecz"). Domyślne `shallow`
  zostaje — filtrowanie jest w całości po stronie klienta. Import z `nuqs` (już zmapowany w Jeście).
- **Jedno źródło odczytu `lang`**: hook (np. `useLanguageFilter`) w `src/hooks/`, używany przez
  `map-page-client`, `services-client-component` i `filter-component` — żeby parser i opcje nie
  rozjechały się w trzech miejscach.
- **Niepoprawny `?lang=xx` zostaje w URL-u, filtr nieaktywny** (cicha normalizacja). Czyszczenie URL
  wymagałoby efektu po montażu bez wartości dla użytkownika.
- **Legacy redirect w `page.tsx`** (stare `?category=`/`?county=`) — dopisać `lang` do zachowywanych
  parametrów obok `query/place/view` (tania spójność).
- **Endonimy jako stałe, etykiety w `messages`**: nowe klucze `MapPage.languageFilter`,
  `MapPage.anyLanguage` (×4); nazwa białoruskiego jako `addBusiness.languages.be` i
  `addBusiness.confirmationEmail.languages.be` (×4).
- **Flagi**: jedna mapa w `languages.ts`; `service-card.tsx` i `business-card-preview.tsx` z niej
  korzystają; alt z tłumaczeń (dziś `service-card` ma zahardkodowane angielskie alty).
  `public/icons/by.svg` zastąpiony biało-czerwono-białą flagą w tym samym formacie (512×512,
  okrągła maska jak `pl.svg`).

## Otwarte pytania

### Rozwiązane podczas planowania

- Rozszerzyć `CoverageFilters` czy nowy typ? → rozszerzyć (decyzja wyżej).
- Gdzie lista kodów dostępna dla klienta? → `src/lib/languages.ts` + reeksport w `form-limits.ts`.
- Czy pipeline LLM wymaga zmian? → `normalizeLanguages` nie; enum w `DRAFT_JSON_SCHEMA` i
  `llmDraftSchema` rośnie automatycznie z listy kodów; tekst promptu (`llm-draft.ts`, linia
  `LANGUAGES — … (kody pl, uk, en, ru)`) trzeba dopisać o `be`.
- Schemat dashboardu? → `z.array(z.string())` przyjmuje `be`; zmieniają się tylko lokalne tablice
  opcji w `add-service-form.tsx` i `service-form.tsx`.
- Baza / `db:add`? → `varchar(5)[]` bez constraintu, `service-input-schema.ts` przyjmuje `be`. Brak
  zmian schematu, brak `drizzle-kit push`.
- `?lang=xx` → cicha normalizacja (decyzja wyżej).
- Canonical → `buildMapMetadataPath` używa tylko pathname; wystarczy test regresyjny.
- Przełącznik locale → kopiuje query; R8 bez zmian w kodzie.

### Odroczone do implementacji

- Dokładny kształt hooka `lang` i nazwy helperów — po dotknięciu kodu.
- Czy shallow update nuqs jest widoczny dla `useSearchParams` w przełączniku locale (Next 15) —
  na tym samym polega dziś `?query=`; potwierdzić w przeglądarce (Operator checklist U3).
- Pozycja dropdownu w mobilnym górnym pasku `filter-component.tsx` (czy tylko w arkuszu) — zależy od
  szerokości po wpięciu; minimum wg R14 to arkusz.
- Brak `docs/DESIGN.md` — buildery UI bazują na wzorcach repo (`SelectScrollable`, `CountBadge`).
  Utworzyć przed kolejnym większym feature'em UI.

## Implementation Units

- [x] **Unit 1: Moduł języków obsługi + białoruski w formularzach i na kartach**

**Cel:** Jedno źródło prawdy o językach obsługi (z `be`), białoruski wybieralny w „Dodaj firmę" i
dashboardzie, flaga biało-czerwono-biała, karty używają wspólnej mapy flag.

**Wymagania:** R3, R4 (endonimy), R16, R17, R18

**Zależności:** Brak

**Pliki:**
- Stwórz: `src/lib/languages.ts`
- Test (unit): `src/lib/languages.test.ts`
- Modyfikuj: `src/lib/add-business/form-limits.ts` (reeksport zamiast własnej listy)
- Modyfikuj: `src/lib/add-business/llm-draft.ts` (tekst reguły LANGUAGES w prompcie)
- Modyfikuj: `src/lib/add-business/submission-emails.ts` (jeśli mapuje nazwy języków po typie)
- Modyfikuj: `src/app/[locale]/(header)/add-business/_components/business-card-preview/business-card-preview.tsx` (mapa flag z modułu; locale treści przez `@/i18n/config`)
- Modyfikuj: `src/app/[locale]/(header)/add-business/_components/draft-editor/generated-summary.tsx` (locale treści przez `@/i18n/config`)
- Modyfikuj: `src/app/[locale]/(header)/add-business/_components/draft-editor/languages-field.tsx` (jeśli ma własną listę)
- Modyfikuj: `src/app/[locale]/(main)/_components/service-card/service-card.tsx` (mapa flag z modułu, alt z tłumaczeń)
- Modyfikuj: `src/app/[locale]/(dashboard)/dashboard/_components/add-service-form.tsx`, `service-form.tsx` (opcja `be`)
- Modyfikuj: `public/icons/by.svg` (flaga biało-czerwono-biała)
- Modyfikuj: `messages/pl.json`, `en.json`, `ru.json`, `uk.json` (`addBusiness.languages.be`, `addBusiness.confirmationEmail.languages.be`)
- Test (unit): `src/lib/add-business/form-limits.test.ts`, `owner-edits-schema.test.ts`, `submission-emails.test.ts`, `business-card-preview.test.tsx`, `src/app/[locale]/(main)/_components/service-card/service-card.test.tsx`

**Delegate to:** feature-builder-web-fullstack

**Skills in play:** nextjs-stack-guidelines, security

**Podejście:**
- `languages.ts` bez importów runtime'owych: kody w kolejności pl, uk, ru, en, be; typ; guard;
  ścieżka flagi per kod; endonim per kod (Polski, Українська, Русский, English, Беларуская).
- Rozszerzenie typu i przejście `business-card-preview`/`generated-summary` na `Locale` w jednym
  unicie (inaczej typecheck czerwony).
- Dashboard: tablice opcji mogą brać kody z modułu; etykiety jak dziś.
- Nazwa białoruskiego w języku strony we wszystkich miejscach, gdzie UI nazywa języki (pole
  formularza, alt flagi, mail potwierdzający).

**Notatka wykonawcza:** Zacznij od testu `languages.ts` (kody, guard odrzuca `de`/`''`), potem
rozszerz typ i daj typecheckowi wskazać wszystkie miejsca do poprawy.

**Wzorce do naśladowania:**
- `src/lib/coverage.ts`, `src/lib/weekdays.ts` — lekki moduł stałych reeksportowany przez schemat.
- `business-card-preview.tsx` — alt flagi z `t('languages.<kod>')`.

**Scenariusze testowe:**
- [Unit] Guard akceptuje pl/uk/ru/en/be, odrzuca `de`, `''`, `PL`.
- [Unit] Każdy kod ma ścieżkę flagi i niepusty endonim.
- [Unit] `owner-edits-schema` przyjmuje `languages: ['be']`; `'de'` dalej odrzucone.
- [Unit] Podgląd karty z `languages: ['pl','be']` renderuje dwie flagi z alt z tłumaczeń; opisy
  dalej wybierane po locale strony (brak indeksowania `descriptions['be']`).
- [Unit] Karta usługi z `be` renderuje flagę z alt przetłumaczonym (nie „Belarusian" na pl), test
  `jest-axe` przechodzi.
- [Unit] Mail potwierdzający wymienia białoruski w języku maila.

**Weryfikacja:**
- `npx tsc --noEmit` bez błędów.
- `npx jest src/lib/languages src/lib/add-business` oraz testy kart przechodzą.
- Grep: `be` obecne w `addBusiness.languages` we wszystkich czterech `messages/*.json`.

**Operator checklist:**
- [ ] Dopisać `be` do reguły języków w `.claude/skills/dodaj/references/klasyfikacja.md` (sekcja
  `languages`) — plik skilla, poza zakresem builderów.
- [ ] Wizualna akceptacja nowej flagi `by.svg` (proporcje, okrągła maska jak pozostałe).

- [x] **Unit 2: Predykat języka i liczniki per język**

**Cel:** Język staje się częścią `CoverageFilters`; wszystkie kubełki i liczniki go respektują;
nowy licznik per język.

**Wymagania:** R1, R5, R6, R9, R12

**Zależności:** Unit 1

**Pliki:**
- Modyfikuj: `src/lib/service-coverage.ts` (pole `language`, eksportowany `matchesLanguage`, warunek w `matching`)
- Modyfikuj: `src/lib/result-counts.ts` (`countCardsByLanguage`)
- Test (unit): `src/lib/service-coverage.test.ts`, `src/lib/result-counts.test.ts`, `src/lib/map-metadata.test.ts`

**Delegate to:** feature-builder-web-data

**Skills in play:** nextjs-stack-guidelines, security

**Podejście:**
- `language` opcjonalne/nullable w `CoverageFilters` — istniejące wywołania bez zmian.
- `matchesLanguage(service, null)` = true; inaczej `languages` zawiera kod.
- `countCardsByLanguage(services, filters)` — dla każdego kodu podmienia `language` i liczy karty
  jak `countCardsByCategory` (grupowanie po firmie, oba kubełki wg tej samej definicji).

**Notatka wykonawcza:** Test-first — po jednym teście na zachowanie, pionowo.

**Wzorce do naśladowania:**
- `countCardsByCategory` i jego testy; fabryka `service()` w `service-coverage.test.ts`.

**Scenariusze testowe:**
- [Unit] `language: 'ru'` zostawia tylko wpisy z `ru` w obu kubełkach (local i online).
- [Unit] `language: null` = zachowanie sprzed zmiany (snapshot liczności na istniejących fixtures).
- [Unit] Koniunkcja: kategoria + miasto + język zawęża do przecięcia.
- [Unit] `countCardsByLanguage` zwraca wszystkie pięć kodów, `be: 0` gdy brak wpisów.
- [Unit] `countCardsByLanguage` liczy karty, nie lokalizacje (firma z 3 punktami = 1).
- [Unit] `countCardsByCategory` z aktywnym językiem liczy tylko wpisy w tym języku.
- [Unit] `buildMapMetadataPath` nie zawiera `lang` ani `?` niezależnie od filtrów (regresja R9).

**Weryfikacja:**
- `npx jest src/lib/service-coverage src/lib/result-counts src/lib/map-metadata` przechodzi.
- `npx tsc --noEmit` bez błędów.

- [x] **Unit 3: Stan `?lang` wpięty w mapę, listę i wyniki semantyczne**

**Cel:** Wartość `?lang` z URL-a zawęża piny, listę, wyniki semantyczne i liczniki — zanim istnieje
kontrolka (działa przez ręczne wpisanie `?lang=ru`).

**Wymagania:** R1, R7, R8, R10, R11, R12

**Zależności:** Unit 2

**Pliki:**
- Stwórz: `src/hooks/use-language-filter.ts`
- Test (unit): `src/hooks/use-language-filter.test.ts`
- Modyfikuj: `src/app/[locale]/(main)/_components/map-page-client.tsx` (język w `categoryCounts`/`totalCount`, nowe `languageCounts` przekazywane w dół)
- Modyfikuj: `src/app/[locale]/(main)/_components/services-client-component.tsx` (język w `coverageFilters`; `matchesLanguage` w `filteredEmbeddingResults`)
- Modyfikuj: `src/app/[locale]/(main)/map/[[...slug]]/page.tsx` (legacy redirect zachowuje `lang`)
- Test (unit): `src/app/[locale]/(main)/_components/map-page-client.test.tsx`

**Delegate to:** feature-builder-web-ui

**Skills in play:** nextjs-stack-guidelines

**Podejście:**
- Hook opakowuje `useQueryState('lang', parseAsStringLiteral(kody).withOptions({ history: 'push' }))`
  — jedno miejsce parsera.
- Brak jakiejkolwiek inicjalizacji z locale (R11).
- Niepoprawna wartość nie woła `notFound()` ani redirectu.

**Wzorce do naśladowania:**
- `useQueryState('query')` w `map-page-client.tsx`; `src/hooks/use-view-state.ts`.
- `map-page-client.test.tsx` — `NuqsTestingAdapter` z `searchParams`, render w `act`.

**Scenariusze testowe:**
- [Unit] Hook: `?lang=ru` → `'ru'`; `?lang=xx` → `null`; brak param → `null`.
- [Unit] `map-page-client` z `?lang=ru` renderuje tylko wpisy z `ru` na liście i jako piny;
  liczniki kategorii zgodne z liczbą kart na liście.
- [Unit] `?lang=xx` renderuje pełną listę (jak bez filtra).
- [Unit] Wynik semantyczny bez wybranego języka nie pojawia się przy aktywnym `?lang`.
- [Unit] Locale `uk` bez `?lang` nie zawęża wyników (R11).

**Weryfikacja:**
- `npx jest "src/app/\[locale\]/\(main\)/_components/map-page-client" src/hooks/use-language-filter` przechodzi (liczba `Test Suites:` zgodna).
- `npx tsc --noEmit` bez błędów.

**Operator checklist:** *(brak `.env.e2e` — scenariusze przeglądarkowe ręczne)*
- [ ] [Manual] `/mapa?lang=ru` → lista i piny tylko firm z flagą RU; klik kategorii „Prawne" →
  URL `/mapa/prawne?lang=ru`, filtr zachowany.
- [ ] [Manual] Przełącz język strony na `uk` przy `?lang=ru` → URL `/uk/map…?lang=ru`, filtr działa.
- [ ] [Manual] `/mapa?lang=xx` → pełna lista, status 200, zero błędów konsoli.

- [x] **Unit 4: Kontrolka języka — desktop, mobilny arkusz, „Usuń filtry"**

**Cel:** Użytkownik wybiera język z dropdownu (endonimy, flagi, liczniki), także w mobilnym arkuszu;
„Usuń filtry" go czyści.

**Wymagania:** R2, R3, R4, R5, R13, R14, R15

**Zależności:** Unit 3

**Pliki:**
- Stwórz: `src/app/[locale]/(main)/_components/language-select/language-select.tsx`
- Stwórz: `src/app/[locale]/(main)/_components/language-select/language-select.test.tsx`
- Stwórz: `src/app/[locale]/(main)/_components/language-select/language-select.stories.tsx`
- Modyfikuj: `src/app/[locale]/(main)/_components/filter-component.tsx` (dropdown obok lokalizacji; `hasActiveFilters` i `resetAllFilters` uwzględniają język)
- Modyfikuj: `src/app/[locale]/(main)/_components/mobile-filter-modal.tsx` (nowe props: wybrany język, zmiana, liczniki)
- Modyfikuj: `messages/pl.json`, `en.json`, `ru.json`, `uk.json` (`MapPage.languageFilter`, `MapPage.anyLanguage`)
- Test (unit): `filter-component.test.tsx`, `mobile-filter-modal.test.tsx`

**Delegate to:** feature-builder-web-ui

**Skills in play:** nextjs-stack-guidelines

**Podejście:**
- `LanguageSelect` kontrolowany (wartość, onChange, liczniki), na prymitywach `Select*` z
  `src/components/ui/select/select.tsx`. Opcja „Dowolny język" + pięć języków: flaga, endonim,
  `CountBadge`, `sr-only` z liczbą (jak `ButtonCategory`). Zera widoczne i klikalne.
- Ten sam komponent w pasku desktop i w arkuszu mobilnym — jedna implementacja.
- `resetAllFilters` ustawia język na `null` obok `query`/`id`; `hasActiveFilters` true przy samym
  języku. `clearCategories` w arkuszu bez zmian.
- Endonimy nie są tłumaczone; tłumaczone są tylko etykieta kontrolki i „Dowolny język".

**Wzorce do naśladowania:**
- `SelectScrollable` (wygląd i rozmiar obok niego), `ButtonCategory` + `CountBadge`.
- `count-badge.test.tsx`, `badge.test.tsx` — wzorzec testu z `jest-axe`.

**Scenariusze testowe:**
- [Unit] `LanguageSelect` pokazuje „Dowolny język" + 5 endonimów z licznikami; nazwa dostępna
  zawiera liczbę; `jest-axe` bez naruszeń.
- [Unit] Wybór „Русский" woła onChange z `'ru'`; „Dowolny język" z `null`.
- [Unit] Język z licznikiem 0 jest klikalny (nie `disabled`).
- [Unit] `filter-component`: przy samym `?lang=ru` „Usuń filtry" aktywny; klik czyści `lang`.
- [Unit] `mobile-filter-modal`: zmiana języka aktualizuje licznik „pokaż wyniki"; „wyczyść
  kategorie" nie rusza języka.
- [Unit] Etykiety renderują się na `pl` i `uk` (klucze obecne).

**Weryfikacja:**
- `npx jest "src/app/\[locale\]/\(main\)/_components/(language-select|filter-component|mobile-filter-modal)"` przechodzi (3 suites).
- `npx tsc --noEmit` bez błędów, `npx next lint` bez błędów.
- Grep: `languageFilter` i `anyLanguage` obecne we wszystkich czterech `messages/*.json`.

**Operator checklist:** *(brak `.env.e2e`)*
- [ ] [Manual] Desktop `/mapa`: dropdown obok „Wybierz lokalizację", wybór „English" → `?lang=en`,
  liczniki chipów maleją, „wstecz" przywraca stan bez filtra.
- [ ] [Manual] Mobile (390px): arkusz filtrów ma dropdown; „pokaż wyniki (N)" zgadza się z listą.
- [ ] [Manual] `/uk/map`: etykiety po ukraińsku, endonimy bez zmian; „Беларуская 0" klikalne →
  empty state, jego reset czyści też język.

## Wpływ systemowy

- **Graf interakcji:** `navigateWithFilters` (pushState z zachowaniem `search`), `popstate` w
  `map-page-client` (odtwarza filtry ścieżki — `lang` odtwarza nuqs), przełącznik locale, legacy
  redirect w `page.tsx`, middleware (rewrite `/mapa` i 301 `/map` zachowują query).
- **Propagacja błędów:** brak nowych ścieżek błędów — niepoprawna wartość degraduje do braku filtra.
- **Ryzyka cyklu życia stanu:** dwa mechanizmy historii (ręczny `pushState` dla ścieżki, nuqs dla
  query) — sprawdzić, że klik kategorii po wyborze języka nie gubi `lang` i odwrotnie (Operator U3).
- **Parytet surface API:** `filteredEmbeddingResults` (semantyka) i `mapServices` muszą używać tego
  samego predykatu co lista; formularz dashboardu i „Dodaj firmę" muszą mieć tę samą listę kodów.
- **Pokrycie integracyjne:** zgodność licznika chipu z liczbą kart przy aktywnym języku —
  `map-page-client.test.tsx` + ręczna weryfikacja w przeglądarce.

## Ryzyka i zależności

- **Rozszerzenie `LanguageCode` łamie indeksowanie `LocalizedText`** — zaadresowane w U1 (jeden
  atomowy unit z konsumentami).
- **Shallow nuqs vs `useSearchParams` w przełączniku locale** — założenie oparte na działającym
  `?query=`; weryfikacja ręczna w U3.
- **Brak E2E harnessu** (`.env.e2e`) — weryfikacja przeglądarkowa ręczna; ryzyko regresji w
  nietestowanych komponentach (lekcja z `MobileBottomMarkerCard`) — grep po wszystkich miejscach
  renderujących flagi/listę języków w U1.

## Dokumentacja / Notatki operacyjne

- Po wdrożeniu: `/dev-compound` dla wzorca „filtr w query param nuqs + liczniki per wartość" — brak
  takiego wpisu w `docs/solutions/`.
- Brak zmian schematu bazy i migracji.

## Źródła i referencje

- **Dokument źródłowy:** [docs/brainstorms/2026-10-18-filtr-jezyka-obslugi-requirements.md](../brainstorms/2026-10-18-filtr-jezyka-obslugi-requirements.md)
- Wzorzec osi: [docs/plans/2026-08-19-001-feat-online-service-coverage-plan.md](2026-08-19-001-feat-online-service-coverage-plan.md)
- Powiązany kod: `src/lib/service-coverage.ts`, `src/lib/result-counts.ts`, `filter-component.tsx`, `mobile-filter-modal.tsx`, `src/lib/add-business/form-limits.ts`
- Powiązane PR: #27 (wspólny predykat lokalizacji), commit 4145abf (CountBadge)
