# Kontekst: Filtr języka obsługi + białoruski

**Branch:** `feature/filtr-jezyka-obslugi`
**Ostatnia aktualizacja:** 2026-10-19

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
