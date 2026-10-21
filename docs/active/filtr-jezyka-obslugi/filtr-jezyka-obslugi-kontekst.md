# Kontekst: Filtr języka obsługi + białoruski

**Branch:** `feature/filtr-jezyka-obslugi`
**Ostatnia aktualizacja:** 2026-10-21

## Źródła

- Requirements doc: [docs/brainstorms/2026-10-18-filtr-jezyka-obslugi-requirements.md](../../brainstorms/2026-10-18-filtr-jezyka-obslugi-requirements.md)
- Plan techniczny: [docs/plans/2026-10-18-001-feat-filtr-jezyka-obslugi-plan.md](../../plans/2026-10-18-001-feat-filtr-jezyka-obslugi-plan.md)

> Designerski kontekst pominięty: plan ma `design_md: null`, `figma_spec: null`,
> `figma_screens: {}` (brak `docs/DESIGN.md` i mockupów — buildery bazują na wzorcach repo).

## Kluczowe pliki

### Filtrowanie i liczniki (warstwa danych)
- `src/lib/service-coverage.ts` — `CoverageFilters`, `splitServicesByCoverage` (predykat `matching`)
- `src/lib/result-counts.ts` — `countCardsByCategory`, `countVisibleCards`, `countListCards`
- `src/lib/map-metadata.ts` — `buildMapMetadataPath` (canonical tylko z pathname — R9 już spełnione)
- `src/types/index.ts` — `PartialService.languages: string[]`
- `src/lib/queries.ts` — `getServices` już zwraca `languages`

### Stan i UI mapy
- `src/app/[locale]/(main)/_components/map-page-client.tsx` — hub stanu, `useQueryState('query')`, liczniki
- `src/app/[locale]/(main)/_components/services-client-component.tsx` — `coverageFilters`, `filteredEmbeddingResults` (luka: ręczny filtr), `mapServices`
- `src/app/[locale]/(main)/_components/filter-component.tsx` — `navigateWithFilters`, `resetAllFilters`, `hasActiveFilters`, `SelectScrollable` lokalizacji
- `src/app/[locale]/(main)/_components/mobile-filter-modal.tsx` — kontrolowany arkusz (`clearCategories` czyści tylko kategorię — nie zmieniać)
- `src/app/[locale]/(main)/map/[[...slug]]/page.tsx` — `parseMapSlug`, legacy redirect (zachowuje `query/place/view`)
- `src/components/ui/select/select.tsx` — prymitywy `Select*`
- `src/components/ui/count-badge/count-badge.tsx` — licznik do reużycia
- `src/components/language-switcher.tsx` — kopiuje wszystkie query params (R8 bez zmian)
- `src/app/[locale]/layout.tsx` — `NuqsAdapter`

### Języki i białoruski
- `src/lib/add-business/form-limits.ts` — dziś `LANGUAGE_CODES = ['pl','uk','en','ru']`
- `src/lib/add-business/draft-schema.ts` — `llmDraftSchema`, `DRAFT_JSON_SCHEMA` (enum), `businessDraftSchema`
- `src/lib/add-business/llm-draft.ts` — tekst reguły `LANGUAGES — … (kody pl, uk, en, ru)`
- `src/lib/add-business/owner-edits-schema.ts`, `submission-emails.ts`, `preview.ts`, `types.ts`
- `src/app/[locale]/(header)/add-business/_components/business-card-preview/business-card-preview.tsx` — mapa flag + **`hasLocale(LANGUAGE_CODES, locale)` jako locale treści (pułapka)**
- `src/app/[locale]/(header)/add-business/_components/draft-editor/generated-summary.tsx` — to samo nadużycie
- `src/app/[locale]/(header)/add-business/_components/draft-editor/languages-field.tsx`, `draft-values.ts`
- `src/app/[locale]/(main)/_components/service-card/service-card.tsx` — `LANGUAGE_FLAGS` z angielskimi altami (ma już `be`)
- `src/app/[locale]/(dashboard)/dashboard/_components/add-service-form.tsx`, `service-form.tsx` — lokalne tablice języków
- `src/app/[locale]/(dashboard)/dashboard/_service-schema.ts` — `z.array(z.string())` (przyjmuje `be`)
- `src/db/schema.ts` — `languages varchar(5)[]` bez constraintu (brak migracji)
- `public/icons/by.svg` — 512×512, okrągła maska jak `pl.svg`
- `messages/*.json` — `addBusiness.languages.*`, `addBusiness.confirmationEmail.languages.*`, `MapCard.languages`
- `.claude/skills/dodaj/references/klasyfikacja.md` — sekcja `languages` (zmiana ręczna operatora)

## Decyzje techniczne

1. **`src/lib/languages.ts` bez importów runtime'owych** — kody (kolejność pl, uk, ru, en, be),
   typ, guard, flagi, endonimy. `form-limits.ts` reeksportuje jako `LANGUAGE_CODES`/`LanguageCode`.
2. **Język obsługi ≠ locale treści** — `LocalizedText` ma tylko pl/uk/en/ru; podgląd karty i
   podsumowanie przechodzą na `Locale` z `@/i18n/config`. W tym samym unicie co rozszerzenie typu.
3. **`language` w `CoverageFilters`** (nullable) + warunek w `matching` — liczniki, piny i lista
   dostają filtr przez istniejący przepływ. Bez nowego typu-parasola.
4. **Eksportowany `matchesLanguage`** reużyty w `filteredEmbeddingResults`.
5. **`countCardsByLanguage`** — lustro `countCardsByCategory`, wszystkie 5 kodów, zera włącznie.
6. **nuqs `parseAsStringLiteral` + `history: 'push'`** w jednym hooku (`src/hooks/use-language-filter.ts`);
   shallow domyślne (filtrowanie po stronie klienta).
7. **`?lang=xx` zostaje w URL-u, filtr nieaktywny**; bez `notFound()`.
8. **Legacy redirect** w `page.tsx` zachowuje `lang`.
9. **Endonimy jako stałe**; tłumaczone tylko `MapPage.languageFilter`, `MapPage.anyLanguage` i nazwa
   `be` w `addBusiness.*`.
10. **`LanguageSelect`** na prymitywach `Select*` (nie `SelectScrollable`), z `CountBadge`; jedna
    implementacja dla desktopu i arkusza.

## Wiedza instytucjonalna (do przestrzegania)

- nuqs w Jeście: `NuqsTestingAdapter` z `searchParams`, render w `await act(async …)`; nowa ścieżka
  importu nuqs wymaga wpisu w `moduleNameMapper` (`docs/solutions/testing-issues/2026-09-27-…`).
- Ścieżki `npx jest` z `\[locale\]` / `\(main\)` escapowane; sprawdzaj liczbę `Test Suites:`.
- Niepoprawny param nie woła `notFound()` (soft-404, `docs/solutions/deployment-issues/2026-08-22-…`).
- Prefiks locale nigdy na sztywno — `localePathPrefix()` / `localizedMapBasePath()`.
- Gate (`tsc`/`jest`/`lint`/`build`) przy zatrzymanym dev serverze.
- React 19: mockowane akcje „w locie" rozwiązuj przed końcem testu (testy add-business).

## Zależności

- Brak nowych paczek; brak zmian schematu bazy.
- U2 ← U1 (typ języka), U3 ← U2 (predykat, liczniki), U4 ← U3 (hook, `languageCounts`).
- Brak `.env.e2e` → weryfikacja przeglądarkowa ręczna (`Operator:`).

## Postęp

### Faza 1 — U1 (2026-10-19) → `feature-builder-web-fullstack` → completed

- `src/lib/languages.ts`: `SERVICE_LANGUAGES` (pl, uk, ru, en, be), `ServiceLanguage`,
  `isServiceLanguage`, `LANGUAGE_FLAG_PATHS`, `LANGUAGE_ENDONYMS`. `form-limits.ts` reeksportuje
  jako `LANGUAGE_CODES`/`LanguageCode` — schematy Zod (`llmDraftSchema`, `businessDraftSchema`,
  enum `DRAFT_JSON_SCHEMA`, `owner-edits-schema`) przyjęły `be` automatycznie.
- `business-card-preview.tsx`, `generated-summary.tsx`: locale treści przez `locales` z
  `@/i18n/config` — `descriptions['be']` nigdy nie jest indeksowane.
- `service-card.tsx`: lokalna mapa flag usunięta; `languages.filter(isServiceLanguage)`, alt z
  `addBusiness.languages` (jedno źródło nazw języków na stronę). Nieznane kody (np. `de` w seedzie)
  pomijane jak wcześniej.
- `submission-emails.ts`: lokalny guard zastąpiony `isServiceLanguage`.
- Dashboard: opcja `be` z etykietą „Belarusian" (dashboard nie ma i18n — spójnie z resztą).
- `by.svg`: biało-czerwono-biała, kolory `#eee`/`#d80027` jak `pl.svg`/`ru.svg`.
- messages ×4: `addBusiness.languages.be`, `addBusiness.confirmationEmail.languages.be`.
- Świadomie BEZ `be` (to locale stron, nie języki obsługi): `src/components/language-switcher.tsx`,
  `LANGUAGES` w `src/db/add-service.ts`.

**Walidacja orkiestratora:** `npx tsc --noEmit` exit 0; `npx jest` 104/104 suites, 1169/1169
testów; `npx next lint` 0 błędów (preegzystujące warningi). `npm run build` NIE uruchomiony —
dev server na :3000 aktywny (learned pattern: build nadpisuje `.next`).

**Odchylenia:** brak zmiany scope'u. Prettier nie przeformatował plików, które już wcześniej nie
przechodziły (CRLF) — tylko zmienione fragmenty.

**Dług odnotowany (poza scope):** angielskie alty flag w `language-switcher.tsx`.

### Review fazy 1 (2026-10-20) — ⚠️ kontynuuj z zastrzeżeniami

Raport: `review-faza-1.md`. 4 perspektywy (security, performance, architektura/TS, scenariusze);
E2E pominięte — faza 1 nie ma checkboxów przeglądarkowych. 0 × P1, 3 × P2, 10 × P3.

- Security i performance czyste: granice Zod ścisłe, mail to plain text, klient bez zoda/drizzle.
- P2: dashboard (lista języków bez sprawdzenia kompletności i zduplikowana; schema przyjmuje
  dowolny string + `as`), brak testu `be` w ścieżce LLM.
- **Wniosek dla fazy 2:** filtr dopasowuje dokładne kody, więc dashboard musi przestać wpuszczać do
  bazy kody spoza `SERVICE_LANGUAGES` — P2 #1–#2 przed U2.
- Wszystkie 3 `Weryfikacja:` fazy 1 odznaczone (tsc exit 0; 35/35 suites, 460 testów; grep ×4).

### Poprawki po review fazy 1 (2026-10-20) → `feature-builder-web-fullstack` → completed

- Dashboard: `_components/language-options.ts` — `Record<ServiceLanguage, string>` (angielskie
  etykiety) + `LANGUAGE_OPTIONS` z `SERVICE_LANGUAGES.map`; oba formularze z jednej definicji,
  kolejność kanoniczna.
- `_service-schema.ts`: `z.array(z.enum(SERVICE_LANGUAGES))`, `getAll('languages').filter(isText)`
  zamiast `as`. **Decyzja:** zapis z nieznanym kodem → odrzucony błędem walidacji (spójnie z
  `category`/`coverage`). Wczytanie starych wierszy (np. `de`) działa — `ServiceEditData.languages`
  zostaje `string[]`; nieznany kod nie ma checkboxa, więc znika z bazy przy następnym zapisie.
- `src/lib/languages.ts`: nowy `toServiceLanguages(codes)` — dedup + odrzucenie nieznanych kodów,
  kolejność pierwszego wystąpienia. Używany przez kartę; **faza 2 może go użyć do sanityzacji**.
- Karta: sekcja języków ukryta, gdy po filtrze lista pusta (wcześniej `['de']` dawał pusty
  nagłówek).
- Nowe testy: `language-options.test.ts`, `generated-summary.test.tsx`, przypadki w
  `_service-schema.test.ts`, `llm-draft.test.ts`, `draft-editor.test.tsx`, `service-card.test.tsx`,
  `languages.test.ts`.
- Celowo NIE: usunięcie asercji w `submission-emails.test.ts` (osłabienie testu), namespace
  `Languages.*` (decyzja przy U4), rename `LANGUAGE_CODES`, `service-input-schema.ts`.

**Walidacja orkiestratora:** `npx tsc --noEmit` exit 0; `npx jest` 106/106 suites, 1187/1187;
`npx next lint` 0 błędów. Build pominięty (dev server :3000).

### Faza 2 — U2 (2026-10-20) → `feature-builder-web-data` → completed

- `src/lib/service-coverage.ts`: `CoverageFilters.language?: ServiceLanguage | null`; eksportowany
  `matchesLanguage(item, language)` (brak języka → true, inaczej `languages.includes`); warunek w
  predykacie `matching` — obowiązuje w obu kubełkach (local/online).
- `src/lib/result-counts.ts`: `countCardsByLanguage(services, filters): Record<ServiceLanguage, number>`
  — podmienia język na liczony i liczy przez `countVisibleCards` (ta sama definicja karty co lista).
  Literał `{ pl: 0, … be: 0 }` zamiast `Object.fromEntries` (bez `as`; nowy kod w
  `SERVICE_LANGUAGES` = błąd typecheckera).
- `countCardsByCategory`/`countVisibleCards` respektują język bez zmian w kodzie (przez
  `splitServicesByCoverage`) — potwierdzone testami. Test R9 w `map-metadata.test.ts`: canonical bez
  `?`/`lang` dla wszystkich locale.
- **Kontrakt dla U3:** `?lang` z URL-a zawęzić do `ServiceLanguage | null` (parser nuqs /
  `isServiceLanguage`) przed włożeniem do `CoverageFilters.language`; `matchesLanguage` dołożyć w
  `filteredEmbeddingResults` (semantyka nie przechodzi przez `splitServicesByCoverage`).

**Walidacja orkiestratora:** `npx tsc --noEmit` exit 0 (błąd TS2353 zgłoszony przez hook Stop był
stanem RED w trakcie test-first — zniknął po implementacji); `npx jest` 106/106 suites, 1201/1201;
`npx next lint` 0 błędów. Build pominięty (dev server :3000).

**Odchylenia:** brak. Testy liczników z aktywnym językiem i R9 były zielone od razu (zachowanie
dziedziczone przez istniejący przepływ) — brak fazy RED dla nich, odnotowane przez buildera.

### Review fazy 2 (2026-10-20) — ✅ gotowe do kontynuacji

Raport: `review-faza-2.md`. 4 perspektywy (security, performance, architektura/TS, scenariusze);
E2E pominięte — czysta warstwa danych. 0 × P1, 0 × P2, 10 × P3.

- Security czyste: najgorszy efekt nieznanego kodu to pusta lista; rekord liczników kluczowany tylko
  stałą listą; wejście już po `isPublicService`.
- Performance: ~16 liniowych przebiegów na zmianę filtra, przy ~350–400 wierszach < 5 ms —
  single-pass przedwczesny. Tani nit: tanie predykaty przed `matchesQuery`.
- `languages` jest per usługa (`servicesTable`), nie per lokalizacja — zgrupowana karta nie może
  pasować „przez jedną lokalizację".
- **Wskazówki dla U3:** parser `?lang` bez `as` (R10); `countCardsByLanguage` w osobnym `useMemo`;
  `useDeferredValue(searchInput)` do rozważenia.
- Obie `Weryfikacja:` fazy 2 odznaczone (3/3 suites, 71 testów; tsc exit 0).

### Faza 3 — U3 (2026-10-21) → `feature-builder-web-ui` → completed

- `src/hooks/use-language-filter.ts`: `useLanguageFilter()` →
  `useQueryState('lang', parseAsStringLiteral(SERVICE_LANGUAGES).withOptions({ history: 'push' }))`,
  zwraca `[ServiceLanguage | null, setLanguage]`. Jedyne miejsce parsera; bez wartości domyślnej i
  bez odczytu locale (R10, R11).
- `map-page-client.tsx`: wspólny `countFilters = { ...currentFilters, query, language }` dla
  `categoryCounts`, `totalCount` i nowego `languageCounts` (osobny `useMemo`). `languageCounts`
  jeszcze nieprzekazany — **U4 podpina do `FilterComponent` → `MobileFilterModal`**.
- `services-client-component.tsx`: język w `coverageFilters`; ręczna kopia filtra embeddingów
  zastąpiona czystą `filterSemanticResults(results, filters)` w `src/lib/service-coverage.ts`
  (lokalizacja + kategoria + język, bez tekstu; 4 testy). Plik −12 linii.
- Piny zawężone językiem przez `filteredServices` (lokalne + online + semantyczne) — test:
  `?lang=ru` → 2 z 4 pinów.
- `page.tsx`: legacy redirect zachowuje `lang`.
- `?lang` przeżywa klik kategorii (`navigateWithFilters` zachowuje `location.search`) — test.
  `resetAllFilters` też zachowuje search → **U4 musi jawnie `setLanguage(null)`**.
- Poprawki po review fazy 2: B1–B5, B7 zrobione; B6 inaczej (jawne `undefined` = błąd lintu
  `unicorn/no-useless-undefined`); B4 przez lokalnie rozszerzony katalog (wspólny złamałby
  istniejące asercje). `useDeferredValue` pominięty (opcjonalny).
- Odkryte: semantyczne API nie dostaje języka — limit wyników może się zapełnić wpisami, które
  potem odpadną (nit w zadaniach, poza scope).

**Walidacja orkiestratora:** `npx tsc --noEmit` exit 0; `npx jest` 107/107 suites, 1219/1219;
`npx next lint` 0 błędów (1 nowe ostrzeżenie: nieużyte `languageCounts` — znika w U4). Build
pominięty (dev server :3000).

### Review fazy 3 (2026-10-21) — ⚠️ kontynuuj z zastrzeżeniami

Raport: `review-faza-3.md`. 4 perspektywy; E2E pominięte (tylko CLI w `Weryfikacja:`).
0 × P1, 1 × P2, 11 × P3.

- **P2 (zweryfikowany w kodzie):** efekt semantyczny w `services-client-component.tsx` zależy od
  `localResults.length`, ale klucz deduplikacji nie zawiera języka — zmiana `?lang` przy aktywnej
  frazie czyści wyniki semantyczne i ich nie pobiera. Prawdopodobnie ten sam błąd sprzed fazy 3
  dla zmiany miasta. Naprawić przed/razem z U4.
- Security czyste: redirect legacy same-origin, `lang` kodowany przez `URLSearchParams`, brak
  soft-404. Preegzystujące: powtórzone `?query=` w legacy URL → 500.
- Memoizacja liczników poprawna (`countFilters` memoizowany; hover/pan nie przeliczają).
- Wniosek ogólny: każda nowa oś filtra musi trafić do klucza deduplikacji efektu semantycznego —
  kandydat na `/dev-compound` po zakończeniu zadania.
- Obie `Weryfikacja:` fazy 3 odznaczone (2/2 suites, 17 testów; tsc exit 0).
