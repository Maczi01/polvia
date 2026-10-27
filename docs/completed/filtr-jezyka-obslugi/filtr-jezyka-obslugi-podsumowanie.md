# Filtr języka obsługi — podsumowanie

Data ukończenia: 2026-10-27
Branch: `feature/filtr-jezyka-obslugi` — zmergowany do `master` jako `af573f4` (push 2026-10-27)
Requirements: `docs/brainstorms/2026-10-18-filtr-jezyka-obslugi-requirements.md`
Plan techniczny: `docs/plans/2026-10-18-001-feat-filtr-jezyka-obslugi-plan.md`
Status: kod gotowy i na `master`. Gate na zmergowanym `master`: tsc 0, jest 110 suit / 1262 testy
(`--runInBand`), lint 0 błędów. `npm run build` nieuruchomiony (dev server użytkownika działał).
**Część ręcznych sprawdzeń operatora i drobne follow-upy są otwarte** (niżej). Zadanie
zarchiwizowane z decyzji usera.

## Co zostało dostarczone

Użytkownik bez polskiego znajduje firmy, które obsłużą go w jego języku:

1. **Filtr języka obsługi** na mapie i liście — trzecia, niezależna oś obok kategorii i zasięgu,
   w query paramie `?lang=pl|uk|ru|en|be` (ta sama nazwa we wszystkich locale). Zawęża piny,
   listę, wyniki semantyczne i wszystkie liczniki. Link udostępnialny, „wstecz" cofa zmianę,
   filtr przeżywa zmianę języka strony i klik kategorii. Nieznana wartość = brak filtra.
2. **Dropdown** „Język obsługi": endonimy z flagami i licznikami, „Dowolny język", język z 0
   wyników klikalny. Desktop — wariant kompaktowy (flaga + kod, glob dla „Dowolny"); arkusz
   mobilny — pełny. „Usuń filtry" czyści też język.
3. **Białoruski (`be`)** jako pełnoprawny język obsługi: „Dodaj firmę" (z LLM), dashboard, karty,
   mail potwierdzający; flaga biało-czerwono-biała.
4. **Naprawione przy okazji (preegzystujące):** lista selecta w arkuszu mobilnym renderowała się
   pod arkuszem — **filtr lokalizacji na mobile był bezużyteczny**; wyniki semantyczne znikały po
   zmianie miasta; dashboard przyjmował dowolny string jako język.

## Kluczowe decyzje

- **Query param, nie segment ścieżki** — `parseMapSlug` ma 2 sloty; ścieżka = nowy parser,
  rewrite'y, sitemap i cienkie strony SEO przy 31 wpisach.
- **Język obsługi ≠ locale treści** — `src/lib/languages.ts` (5 kodów) osobno od `locales`
  (`@/i18n/config`, 4 locale). `LocalizedText` nie ma `be`.
- **Jeden predykat** `matchesLanguage` w `splitServicesByCoverage`; wyniki semantyczne przez
  `filterSemanticResults` — zero kopii reguły (lekcja PR #27).
- **Jeden parser** `?lang` w `useLanguageFilter` (`parseAsStringLiteral`, `history: 'push'`).
- **Endonimy** w dropdownie (stałe), tłumaczone tylko etykiety; nazwa dostępna wyzwalacza
  „Język obsługi: {endonim}" (WCAG 2.5.3).
- **`semanticSearchKey`** z typem wymuszającym komplet osi `CoverageFilters`.

## Główne pliki

- Nowe: `src/lib/languages.ts`, `src/lib/semantic-search-key.ts`,
  `src/hooks/use-language-filter.ts`, `src/hooks/use-semantic-search.ts`,
  `src/app/[locale]/(main)/_components/language-select/`,
  `src/app/[locale]/(dashboard)/dashboard/_components/language-options.ts` (+ testy).
- Zmienione: `src/lib/service-coverage.ts`, `src/lib/result-counts.ts`, `map-page-client.tsx`,
  `services-client-component.tsx` (678 → 554 linii), `filter-component.tsx`,
  `mobile-filter-modal.tsx`, `select-scrollable.tsx`, `service-card.tsx`, add-business
  (`form-limits.ts`, `llm-draft.ts`, `submission-emails.ts`, podgląd karty), `_service-schema.ts`,
  `public/icons/by.svg`, `messages/*.json`, `setupAfterEnv.ts` (stuby Pointer Capture).

## Wnioski

- **Każda oś filtra musi być w kluczu deduplikacji efektu semantycznego** — efekt reaguje na
  długość listy lokalnej, więc oś spoza klucza czyści wyniki bez ponownego zapytania. Teraz pilnuje
  tego kompilator (`satisfies Record<keyof CoverageFilters, …>`).
- **Zdarzenia z portali (Radix Select) bąbelkują przez drzewo React** do handlerów `onKeyDown`
  dialogu — handler musi filtrować po `containerRef.contains(target)`. Z-index listy w portalu
  trzeba podnieść ponad arkusz lokalnie (`contentClassName`).
- **jsdom nie widzi warstw ani szerokości** — 4 review × 4 agentów nie złapały listy pod arkuszem
  ani obciętego paska; złapała je dopiero przeglądarka (chrome-devtools). Testy „desktop"
  sprawdzały w rzeczywistości select z zamkniętego arkusza (stoi wcześniej w DOM).
- **Async w efekcie = `AbortController`** — wyścig odpowiedzi semantycznych istniał wcześniej, ale
  dopiero częstsze zapytania (nowe osie) uczyniły go łatwym do trafienia.
- **Dwa dev servery na jednym `.next`** — stary proces z 19.10 zwracał 500 przez tydzień; nowy
  wylądował na :3001. Sprawdzać `Get-NetTCPConnection`, nie tylko odpowiedź HTTP.
- **Testy `AddBusinessFlow` flaky przy równoległym `npx jest` pod obciążeniem** — przy
  `--runInBand` zielone.

## Follow-upy (otwarte)

### Ręczne sprawdzenia operatora
- [ ] Dopisać `be` do sekcji `languages` w `.claude/skills/dodaj/references/klasyfikacja.md`.
- [ ] Akceptacja wizualna flagi `public/icons/by.svg` (w dropdownie wygląda poprawnie).
- [ ] Desktop: `/mapa?lang=ru` → klik „Prawne" → `/mapa/prawne?lang=ru`; wybór „English" →
  `?lang=en`, „wstecz" przywraca stan.
- [ ] Przełączenie języka strony na `uk` przy `?lang=ru` → filtr działa.
- [ ] `/mapa?lang=xx` → pełna lista, 200, zero błędów konsoli.
- [ ] `/uk/map` — etykiety po ukraińsku; „Беларуская" → wyniki lub empty state, reset czyści język.

### Bugi preegzystujące (odkryte, poza scope)
- [ ] `messages/en.json`, `ru.json`, `uk.json` — brak klucza najwyższego poziomu `serviceWrapper`
  (jest tylko w `pl.json`) — potencjalny runtime error na en/ru/uk.
- [ ] `map/[[...slug]]/page.tsx:111-113` — `query`/`place` `as string`: powtórzone `?query=` w
  legacy URL → 500.
- [ ] Flaky `AddBusinessFlow › limit wysylek…` przy równoległym `npx jest`.
- [ ] `_service-schema.ts` — `as [string, ...string[]]` dla enumów i `formData.get(x) as string`.
- [ ] `route.ts:47` — limit `excludeIds` 2000 znaków → 400 i cicho znikające wyniki semantyczne.

### Drobne usprawnienia
- [ ] `lang` (i miasto) jako parametr `/api/services` — dziś filtr po stronie klienta, limit
  wyników semantycznych zapełniają inne języki; refetch zużywa limit 30/min szybciej.
- [ ] Pasek desktopowy przy 768 px — „Wybierz lokalizację" lekko obcięte (122 px); wydzielenie
  paska z `filter-component.tsx` (547 linii).
- [ ] Redirect legacy w `page.tsx`: `lang` jako parametr `buildMapUrl` z walidacją; drugi redirect
  (`/_/`) gubi `lang`.
- [ ] Testy: reset przy slugu kategorii + `?lang` (realne `window.location`), `/mapa/online?lang=en`,
  R8 przełącznika locale, endonimy na `uk`.
- [ ] Porządki: `hasActiveFilters` jako `boolean`, kolejność importów `@/hooks`, fixtures do
  `tests/fixtures/`, alias `renderWithServices`, dwie nazwy listy kodów (`LANGUAGE_CODES` /
  `SERVICE_LANGUAGES`), `db:add` przyjmuje dowolny kod, normalizacja `query` w 16 przebiegach
  liczników.
- [ ] Dotyk: sprawdzić na urządzeniu, czy tap w opcję nie „przelatuje" do overlaya arkusza.
