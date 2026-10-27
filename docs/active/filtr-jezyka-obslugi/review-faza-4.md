# Review fazy 4 — U4: dropdown języka (desktop, arkusz mobilny, „Usuń filtry")

**Branch:** `feature/filtr-jezyka-obslugi`
**Commit:** `2c1f500` (U4 + poprawki B1–B4 po review fazy 3)
**Data:** 2026-10-26

## Werdykt

⚠️ **KONTYNUUJ Z ZASTRZEŻENIAMI** — 0 × P1, 5 × P2, 15 × P3.

To ostatnia faza — **P2 naprawić przed merge**. Logika i testy są solidne: wszystkie 6
zaplanowanych scenariuszy + poprawka B1 pokryte realnymi asercjami (59/59 w 6 suite'ach,
`--runInBand`), przeniesione testy bez utraty asercji, `jest-axe` w każdym nowym teście
komponentu, `?lang` nigdy nie trafia surowy do DOM. Problemy skupiają się na zachowaniu UI w
arkuszu mobilnym i na wąskim desktopie — obszarach, których jsdom nie modeluje, a przeglądarka
nie była dostępna (dev server na :3000 zwraca 500).

## Perspektywy

| Agent | P1 | P2 | P3 | Uwagi |
|---|---|---|---|---|
| Security (`security-sentinel`) | 0 | 0 | 1 | tylko kody z `SERVICE_LANGUAGES` w `lang`/`src`; `/api/services` rate-limit 30/min/IP przed Zod i OpenAI; `semanticSearchKey` nie wysyłany; stuby tylko w Jeście |
| Performance (`performance-oracle`) | 0 | 1 | 3 | `coverageFilters` memoizowany — brak pętli efektu; Radix Select już w bundlu |
| Architektura + TS (`kieran-typescript-reviewer`) | 0 | 2 | 8 | API `LanguageSelect` czyste (null / sentinel, bez `as`); zmiana layoutu nie wycieka poza mapę |
| Scenariusze + a11y + testy | 0 | 2 | 5 | 6/6 scenariuszy; flagi `alt=""`, endonimy `lang`, licznik `aria-hidden` + `sr-only` |
| E2E (chrome-devtools) | — | — | — | pominięty: `Weryfikacja:` fazy 4 tylko CLI/grep; dev server :3000 zwraca 500 |

## Findings (po deduplikacji)

### 🟠 P2-important

1. **`src/app/[locale]/(main)/_components/mobile-filter-modal.tsx:99-104` — Escape w otwartym
   selekcie zamyka cały arkusz.** Zweryfikowane w kodzie: `handleKeyDown` na `role="dialog"` na
   Escape robi `stopPropagation()` + `onClose()`. Zdarzenia React bąbelkują przez portale wzdłuż
   drzewa komponentów, więc Escape z listy opcji (portal Radix) dociera do dialogu — Radix zamyka
   select, a arkusz zamyka się razem z nim. Ta sama pułapka dla Tab (trap focusu, l.105). Dotyczy
   też istniejącego selecta województw (preegzystujące), ale nowa kontrolka go powiela. Poprawka:
   ignorować zdarzenia, których `target` nie leży w `containerRef` (albo `event.defaultPrevented` /
   sprawdzenie otwartego selecta) + test.
2. **`src/components/ui/select/select.tsx:92` vs `mobile-filter-modal.tsx:123` — lista opcji
   prawdopodobnie renderuje się POD arkuszem** (pewność reviewera ~75%, wymaga przeglądarki).
   `SelectContent` ma `z-[105]`, portalowany do `body`; arkusz to `fixed z-[999]`, bez przodka
   tworzącego niższy kontekst stosu. Lista otworzyłaby się pod białym panelem, a tapnięcia trafiałyby
   w panel. Selekt województw w arkuszu używa tego samego `SelectContent` — ten sam problem
   (preegzystujący, nikt go nie zgłosił, więc potwierdzić w przeglądarce przed poprawką). Poprawka:
   `className` z `z-[1000]` na `SelectContent` dla selectów w arkuszu (nie globalnie).
3. **`src/app/[locale]/(main)/_components/services-client-component.tsx:100-152` — wyścig
   odpowiedzi semantycznych.** Zweryfikowane: `fetch` ma tylko `AbortSignal.timeout(8000)`, cleanup
   efektu nie przerywa zapytania w locie. Po B1 zmiana języka/miasta/online przy aktywnej frazie
   odpala nowe zapytanie — starsza, wolniejsza odpowiedź może przyjść ostatnia, nadpisać wyniki
   (ze starym `excludeIds`) i zgasić `isLoadingEmbeddings`, gdy nowe zapytanie jeszcze trwa.
   Preegzystujące, ale B1 robi to łatwym do trafienia; łamie regułę repo §13 (async w `useEffect` =
   `AbortController` w cleanup). Poprawka: `AbortController` w ref, abort w cleanup i przed każdym
   nowym fetchem, `AbortError` ignorowany (bez czyszczenia wyników) + test.
4. **`src/lib/semantic-search-key.ts:12-20` — lista osi wpisana ręcznie.** Dodanie pola do
   `CoverageFilters` nie wywoła błędu kompilacji przy braku w kluczu — dokładnie mechanizm regresji
   z fazy 3. Poprawka: obiekt osi z `satisfies Record<keyof Required<CoverageFilters>, unknown>`
   serializowany w stałej kolejności (kolejność `JSON.stringify` tablicy jest stabilna — nie problem).
5. **`src/app/[locale]/(main)/_components/filter-component.tsx:426` — ciasny pasek desktopowy przy
   `md` (768 px).** Z obliczenia (nie wizualnie): `w-1/3` z trzema kontrolkami `flex-1` i `gap-x-4`
   ≈ 72 px na kontrolkę — pole szukania, lokalizacja i „Українська" z flagą obcięte. Sprawdzić w
   przeglądarce przy 768–1024 px; prawdopodobna poprawka: kontrolka języka (lub układ `w-1/3`) od
   `lg`, poniżej układ jak dotąd.

### 🟡 P3-nit — UI / a11y

6. **`language-select.tsx:71`** — `aria-label="Język obsługi"` nadpisuje treść wyzwalacza: część
   czytników nie ogłasza wybranego języka, a widoczny tekst („Dowolny język") nie jest w nazwie
   dostępnej (WCAG 2.5.3 *label in name*). Rozważyć `aria-labelledby` = ukryta etykieta + wartość.
7. **`mobile-filter-modal.tsx:128`** — na dotyku tap w opcję Radix może „przelecieć" do overlaya
   (`onClick={onClose}`) i zamknąć arkusz; jsdom tego nie modeluje (niska pewność, sprawdzić na
   urządzeniu).
8. Focus wyzwalacza przez `focus:ring-1`, nie `focus-visible` — widoczny, akceptowalne.

### 🟡 P3-nit — kod

9. **`filter-component.tsx`** — 547 linii (+23); pasek desktopowy (l.424-500) do wydzielenia
   (`desktop-filter-bar/`) — dług, nie blokuje.
10. **`services-client-component.tsx:205-209`** — `searchInput`, `selectedCategory`,
    `selectedCounty` w zależnościach efektu nadmiarowe wobec `coverageFilters`.
11. **`filter-component.tsx:319`** — `hasActiveFilters` typu unii, nie `boolean` (`Boolean(...)`);
    wzorzec preegzystujący, teraz rozszerzony.
12. **`map-page-client.tsx:38-62`, `language-select.tsx`** — `languageCounts` przeliczane i z nową
    tożsamością przy każdym klawiszu, `LanguageSelect` niememoizowany (5 `<Image>` w ukrytych
    itemach Radix). OK przy setkach usług; zbieżne z odłożonym punktem z fazy 2.
13. **`services-client-component.tsx:163-197`** — refetch przy zmianie miasta/języka zużywa
    wspólny limit 30/min szybciej; po 429 brak wyników semantycznych bez komunikatu. Język i miasto
    nie trafiają do API (zbieżne z istniejącym nitem „`lang` w API").

### 🟡 P3-nit — testy

14. **`filter-component.tsx:154` vs `:168`** — reset przy jednoczesnym slugu kategorii i `?lang`
    bez testu; żaden test nie sprawdza realnego `window.location.search` (testowy adapter nuqs nie
    dotyka `window.location`; poprawność zależy od kolejności flush nuqs vs `pushState`).
15. **`map-page-client.language.test.tsx:212-224`** — `global.fetch` i `AbortSignal.timeout`
    nadpisane bez przywrócenia — przeciek stanu między testami.
16. Scenariusz 6 na `uk` sprawdza tylko etykiety wyzwalacza, nie endonimy na liście.
17. **`map-page-client.test.tsx`** — alias `renderWithServices` + wrapper `renderMapPage` z innym
    podpisem; wołać fixture wprost.
18. **`map-page-client.fixtures.tsx`** — leży w `_components/` zamiast `tests/fixtures/`
    (coding-rules §2); nazwa poza `testMatch` — działa.
19. **`language-select.stories.tsx`** — tytuł `map/languageSelect` vs konwencja `component/...`;
    brak story bez `counts`.
20. Scenariusz „pokaż wyniki" przeniesiony z `mobile-filter-modal.test.tsx` do integracyjnego
    `map-page-client.language.test.tsx` — rozsądne (licznik liczy rodzic), odnotowane.

### ⚪ Info

- `route.ts:47` — limit `excludeIds` 2000 znaków: przy kategorii + opisowej frazie i ≥ ~54 wynikach
  lokalnych zapytanie dostaje 400 i wyniki semantyczne cicho znikają (preegzystujące).
- Flagi `.svg` przez `next/image` serwowane bez optymalizacji (brak `dangerouslyAllowSVG`) —
  poprawnie, lazy loading w zamkniętym dropdownie OK.

## Odchylenia od planu

- Pliki spoza `Pliki:` IU-4, wszystkie uzasadnione: `src/lib/semantic-search-key.ts` (+test) —
  poprawka P2 z fazy 3; `map-page-client.fixtures.tsx` + `map-page-client.language.test.tsx` —
  podział testów (B4); `setupAfterEnv.ts` — stuby Pointer Capture dla Radix w jsdom.
- Zmiana układu desktopu (`w-1/4` → `w-1/3`, `w-3/4` → `w-2/3`) — nieprzewidziana w planie;
  `FilterComponent` używa tylko mapa, więc nie wycieka na inne route'y; patrz P2 #5.
- Mobile: kontrolka tylko w arkuszu (nie w górnym pasku) — decyzja buildera zgodna z planem
  („minimum wg R14 to arkusz").
- `Delegate to: feature-builder-web-ui` — zgodne z kategorią plików (poprawka `src/lib/**`
  dołączona świadomie przez orkiestratora).

## Bookkeeping checkboxów Weryfikacja:

- Odznaczone automatycznie (CLI/grep): 3
- Odznaczone na podstawie Agent 5 E2E (chrome-devtools): 0
- Pozostawione dla operatora (Manual): 0
- Niejasne (P3): 0
- Failujące (P2): 0

### Szczegóły

- [x] CLI: testy `language-select`, `filter-component`, `mobile-filter-modal` → PASS (3/3 suites,
  33/33 testów, `--runInBand`)
- [x] CLI: `npx tsc --noEmit` bez błędów, `npx next lint` bez błędów → PASS (exit 0; 0 błędów lintu)
- [x] Grep: `languageFilter` i `anyLanguage` we wszystkich czterech `messages/*.json` → PASS

Kroki `Operator:` fazy 4 (desktop `?lang=en` + Wstecz, mobile 390 px, `/uk/map` + `be` 0) bez
zmian — czekają na restart dev servera i ręczną weryfikację. Dopisano do nich sprawdzenie P2 #1,
#2, #5.
