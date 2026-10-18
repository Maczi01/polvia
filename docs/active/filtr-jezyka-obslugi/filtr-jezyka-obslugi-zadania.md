# Zadania: Filtr języka obsługi + białoruski

**Branch:** `feature/filtr-jezyka-obslugi`
**Ostatnia aktualizacja:** 2026-10-19

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
- [ ] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [ ] `Weryfikacja:` testy `src/lib/languages`, `src/lib/add-business`, podglądu karty i karty usługi przechodzą
- [ ] `Weryfikacja:` grep — `be` w `addBusiness.languages` we wszystkich czterech `messages/*.json`
- [ ] `Operator:` dopisać `be` do sekcji `languages` w `.claude/skills/dodaj/references/klasyfikacja.md`
- [ ] `Operator:` wizualna akceptacja nowej flagi `by.svg`

---

## Faza 2 — Logika filtra

### U2. Predykat języka i liczniki per język

**Delegate to:** `feature-builder-web-data` · **Nakład:** S · **Zależności:** U1
**Wymagania:** R1, R5, R6, R9, R12

> Test-first — po jednym teście na zachowanie, pionowo.

- [ ] `src/lib/service-coverage.ts` — pole `language` (nullable) w `CoverageFilters`, eksportowany `matchesLanguage`, warunek w `matching`
- [ ] `src/lib/result-counts.ts` — `countCardsByLanguage` (lustro `countCardsByCategory`, wszystkie 5 kodów)
- [ ] `Test:` `language: 'ru'` zostawia tylko wpisy z `ru` w obu kubełkach
- [ ] `Test:` `language: null` = zachowanie sprzed zmiany
- [ ] `Test:` koniunkcja kategoria + miasto + język
- [ ] `Test:` `countCardsByLanguage` zwraca 5 kodów, `be: 0` gdy brak wpisów
- [ ] `Test:` `countCardsByLanguage` liczy karty, nie lokalizacje
- [ ] `Test:` `countCardsByCategory` z aktywnym językiem liczy tylko wpisy w tym języku
- [ ] `Test:` `buildMapMetadataPath` nie zawiera `lang` ani `?` (regresja R9)
- [ ] `Weryfikacja:` `npx jest src/lib/service-coverage src/lib/result-counts src/lib/map-metadata` przechodzi
- [ ] `Weryfikacja:` `npx tsc --noEmit` bez błędów

---

## Faza 3 — Stan `?lang`

### U3. `?lang` wpięty w mapę, listę i wyniki semantyczne

**Delegate to:** `feature-builder-web-ui` · **Nakład:** M · **Zależności:** U2
**Wymagania:** R1, R7, R8, R10, R11, R12

- [ ] Stwórz `src/hooks/use-language-filter.ts` — `useQueryState('lang', parseAsStringLiteral(kody).withOptions({ history: 'push' }))`
- [ ] `map-page-client.tsx` — język w `categoryCounts`/`totalCount`; `languageCounts` przekazywane w dół
- [ ] `services-client-component.tsx` — język w `coverageFilters`; `matchesLanguage` w `filteredEmbeddingResults`
- [ ] `map/[[...slug]]/page.tsx` — legacy redirect zachowuje `lang`
- [ ] Brak inicjalizacji z locale; niepoprawna wartość bez `notFound()`/redirectu
- [ ] `Test:` hook — `?lang=ru` → `'ru'`; `?lang=xx` → `null`; brak → `null`
- [ ] `Test:` `map-page-client` z `?lang=ru` — tylko wpisy z `ru` na liście i jako piny; liczniki kategorii = liczba kart
- [ ] `Test:` `?lang=xx` — pełna lista
- [ ] `Test:` wynik semantyczny bez wybranego języka nie pojawia się przy aktywnym `?lang`
- [ ] `Test:` locale `uk` bez `?lang` nie zawęża wyników
- [ ] `Weryfikacja:` testy `map-page-client` i `use-language-filter` przechodzą (ścieżki escapowane, liczba `Test Suites:` zgodna)
- [ ] `Weryfikacja:` `npx tsc --noEmit` bez błędów
- [ ] `Operator:` `/mapa?lang=ru` → tylko firmy z RU; klik „Prawne" → `/mapa/prawne?lang=ru`, filtr zachowany
- [ ] `Operator:` przełączenie strony na `uk` przy `?lang=ru` → `/uk/map…?lang=ru`, filtr działa
- [ ] `Operator:` `/mapa?lang=xx` → pełna lista, status 200, zero błędów konsoli

---

## Faza 4 — Kontrolka

### U4. Dropdown języka — desktop, mobilny arkusz, „Usuń filtry"

**Delegate to:** `feature-builder-web-ui` · **Nakład:** M · **Zależności:** U3
**Wymagania:** R2, R3, R4, R5, R13, R14, R15

- [ ] Stwórz `src/app/[locale]/(main)/_components/language-select/language-select.tsx` (kontrolowany, prymitywy `Select*`, „Dowolny język" + 5 języków: flaga, endonim, `CountBadge`, `sr-only` liczba)
- [ ] Stwórz `language-select.test.tsx` i `language-select.stories.tsx`
- [ ] `filter-component.tsx` — dropdown obok „Wybierz lokalizację"; `hasActiveFilters` i `resetAllFilters` uwzględniają język
- [ ] `mobile-filter-modal.tsx` — props: wybrany język, zmiana, liczniki; `clearCategories` bez zmian
- [ ] `messages/{pl,en,ru,uk}.json` — `MapPage.languageFilter`, `MapPage.anyLanguage`
- [ ] `Test:` 5 endonimów + „Dowolny język" z licznikami; nazwa dostępna zawiera liczbę; `jest-axe` bez naruszeń
- [ ] `Test:` wybór „Русский" → onChange `'ru'`; „Dowolny język" → `null`
- [ ] `Test:` język z licznikiem 0 klikalny (nie `disabled`)
- [ ] `Test:` `filter-component` — przy samym `?lang=ru` „Usuń filtry" aktywny; klik czyści `lang`
- [ ] `Test:` `mobile-filter-modal` — zmiana języka aktualizuje „pokaż wyniki"; „wyczyść kategorie" nie rusza języka
- [ ] `Test:` etykiety renderują się na `pl` i `uk`
- [ ] `Weryfikacja:` testy `language-select`, `filter-component`, `mobile-filter-modal` przechodzą (3 suites)
- [ ] `Weryfikacja:` `npx tsc --noEmit` bez błędów, `npx next lint` bez błędów
- [ ] `Weryfikacja:` grep — `languageFilter` i `anyLanguage` we wszystkich czterech `messages/*.json`
- [ ] `Operator:` desktop `/mapa` — wybór „English" → `?lang=en`, liczniki chipów maleją, „wstecz" przywraca stan
- [ ] `Operator:` mobile 390px — dropdown w arkuszu; „pokaż wyniki (N)" = lista
- [ ] `Operator:` `/uk/map` — etykiety po ukraińsku, endonimy bez zmian; „Беларуская 0" → empty state, reset czyści język

---

## Quality gate (przed merge)

- [ ] `Weryfikacja:` `npx tsc --noEmit` — 0 błędów
- [ ] `Weryfikacja:` `npx jest` — wszystkie testy zielone
- [ ] `Weryfikacja:` `npx next lint` — 0 błędów
- [ ] `Weryfikacja:` brak nowych `any`, `console.log`, sekretów poza `env.ts`
