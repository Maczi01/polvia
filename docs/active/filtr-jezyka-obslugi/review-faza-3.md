# Review fazy 3 — U3: stan `?lang` w mapie, liście i wynikach semantycznych

**Branch:** `feature/filtr-jezyka-obslugi`
**Commit:** `7557ce5`
**Data:** 2026-10-21

## Werdykt

⚠️ **KONTYNUUJ Z ZASTRZEŻENIAMI** — 0 × P1, 1 × P2, 11 × P3.

Parser `?lang` żyje w jednym miejscu (`useQueryState('lang'` tylko w `use-language-filter.ts`),
ręczna kopia reguły lokalizacji/kategorii dla wyników semantycznych zastąpiona czystą
`filterSemanticResults`, memoizacja liczników poprawna, redirect legacy bezpieczny. Wszystkie 5
zaplanowanych scenariuszy pokryte realnymi asercjami (piny sprawdzane po markerach mapy, nie po
kartach listy), istniejące testy nieosłabione. Jedyny P2 to regresja w efekcie wyszukiwania
semantycznego.

## Perspektywy

| Agent | P1 | P2 | P3 | Uwagi |
|---|---|---|---|---|
| Security (`security-sentinel`) | 0 | 0 | 1 | redirect: ścieżka tylko z `buildMapUrl` (biała lista), `lang` w query kodowany przez `URLSearchParams` (CRLF → `%0D%0A`), tablice odrzucane przez `typeof === 'string'`, `redirect()` przed streamowaniem (brak soft-404) |
| Performance (`performance-oracle`) | 0 | 1 | 3 | `countFilters` memoizowany, liczniki nie liczą się przy hover/pan; P2 w efekcie semantycznym |
| Architektura + TS (`kieran-typescript-reviewer`) | 0 | 0 | 8 | jeden parser, `services-client-component` −12 linii; odchylenia od planu zaakceptowane |
| Scenariusze + testy | 0 | 0 | 10 | 5/5 scenariuszy, 82/82 testów w 4 suite'ach |
| E2E (chrome-devtools) | — | — | — | pominięty: `Weryfikacja:` fazy 3 tylko CLI; scenariusze przeglądarkowe to `Operator:` (brak `.env.e2e`) |

## Findings (po deduplikacji)

### 🟠 P2-important

1. **`src/app/[locale]/(main)/_components/services-client-component.tsx:157-208`** — zmiana `?lang`
   przy aktywnym zapytaniu kasuje wyniki semantyczne i nie pobiera ich ponownie. Zweryfikowane
   przez orkiestratora w kodzie: efekt zależy od `localResults.length` (l.206), który zmienia się
   przy zmianie języka → efekt rusza → `setEmbeddingResults([])` (l.166) → klucz deduplikacji
   `${searchInput}-${selectedCategory}-${selectedCounty}` (l.160) bez zmian → gałąź `else`, brak
   zapytania. Scenariusz: „prawnik" + wybór `uk` → wyniki semantyczne znikają do zmiany frazy. Gdy
   długość listy przypadkiem się nie zmieni, efekt nie rusza i wyniki są poprawnie filtrowane —
   to samo działanie, dwa wyniki. Poprawka: `language` w kluczu (ponowne zapytanie z nowym
   `excludeIds`) + test komponentu.

### 🟡 P3-nit — kod

2. **`services-client-component.tsx` / `buildSemanticSearchParams`** — API semantyczne nie dostaje
   języka: serwer zwraca top-N bez filtra, `filterSemanticResults` po stronie klienta odrzuca
   większość (dla `be` często wszystko). Przy `?lang` krótsza lista lokalna częściej odpala
   semantykę (`semantic-search-trigger.ts:48`, max +1 zapytanie na frazę — akceptowalne). Parametr
   `lang` w `/api/services` — poza scope (zbieżne z wpisem z U3).
3. **`map-page-client.tsx:58-62`** — `languageCounts` liczone, nieużywane: ostrzeżenie lintu i 5
   przebiegów na klawisz bez efektu. Znika w U4 (zadanie już dopisane do U4).
4. **`src/app/[locale]/(main)/map/[[...slug]]/page.tsx:121-128`** — `lang` doklejany do
   `newUrl.query` po `buildMapUrl` (wiedza o parametrach mapy w dwóch miejscach), bez walidacji
   (śmieci przenoszone do URL-a docelowego), bez testu. Lepiej: `lang` jako parametr
   `buildMapUrl`, przepuszczany tylko gdy `isServiceLanguage`. Drugi redirect legacy (`/_/`,
   l.101-105) nadal gubi `lang` — niespójność.
5. **`src/hooks/use-language-filter.ts:16`** — typ zwracany `UseQueryStateReturn<…>` ujawnia nuqs;
   akceptowalne, rozważyć alias przy U4.
6. **`map-page-client.test.tsx`** — 367 linii (> 300); nowy blok `describe` do osobnego pliku.
7. **`use-language-filter.test.tsx:10`** — typ helpera nieczytelny; `RenderHookResult<…>`.
8. **`services-client-component.tsx:23`, `map-page-client.tsx:8`** — kolejność importów `@/hooks`
   (pliki już wcześniej odbiegały od `simple-import-sort`).
9. **`filter-component.tsx:344`** — `?query` zapisywany przy każdym klawiszu bez debounce, ~20
   przebiegów liczników na klawisz. OK przy setkach usług; zbieżne z odłożonym punktem z fazy 2.

### 🟡 P3-nit — testy

10. Brak testów komponentu: `totalCount` przy `?lang`; `/mapa/online?lang=en` (sekcja online i jej
    licznik); pusty wynik z językiem (`?lang=be` → empty state `role="status"`).
11. Brak testów: redirect legacy z `lang`; R8 (przełącznik locale zachowuje `?lang` —
    `language-switcher.tsx` nie ma pliku testowego); hook dla `?lang=RU` i `?lang=` (oba → `null`,
    zgodnie z R10). R7 sprawdzony przez `history === 'push'`, bez realnego kroku Wstecz.
12. Ścieżka semantyczna w komponencie testowana tylko przez wyekstrahowaną funkcję — wpięcie
    jednolinijkowe (nit; P2 #1 wymaga jednak testu komponentu).

### ⚪ Info (preegzystujące, nietknięte przez commit)

- `page.tsx:111-113` — `searchParams.query as string` / `place as string`: przy
  `?category=x&query=a&query=b` `query` jest tablicą → `query.trim()` w `map-url-builder.ts:86`
  rzuca → 500. Poprawka: ten sam guard `typeof === 'string'` co dla `lang`.
- `page.tsx:92, :102` — komentarz obiecuje 301, `redirect()` w Server Component daje 307
  (`permanentRedirect()` dla 301).
- Ten sam mechanizm co P2 #1 prawdopodobnie dotyczy zmiany **miasta** (`city` też nie jest w
  kluczu deduplikacji, a zmienia `localResults.length`) — sprzed fazy 3.
- `service-coverage.ts:146` — `filters.category ?? ''` powtarza normalizację ze
  `splitServicesByCoverage`; drobna duplikacja, akceptowalna.

## Odchylenia od planu

- `filterSemanticResults` wyekstrahowane do `src/lib/service-coverage.ts` zamiast samego
  `matchesLanguage` w `filteredEmbeddingResults` — zaakceptowane (jeden predykat, lekcja PR #27),
  z 4 testami; brief na to pozwalał.
- Test hooka `.tsx` zamiast `.ts` — wymuszone wrapperem JSX.
- `languageCounts` liczone, nie przekazane w dół — świadomie (brief: bez zmian w
  `filter-component`/`mobile-filter-modal` w U3); podpięcie dopisane do zadań U4.
- Zmiany w `src/lib/**` z poprawek po review fazy 2 w tym samym commicie.
- `Delegate to: feature-builder-web-ui` — zgodne z kategorią plików IU-3 (poprawki `src/lib/**` z
  fazy 2 dołączone świadomie przez orkiestratora).

## Bookkeeping checkboxów Weryfikacja:

- Odznaczone automatycznie (CLI/grep): 2
- Odznaczone na podstawie Agent 5 E2E (chrome-devtools): 0
- Pozostawione dla operatora (Manual): 0
- Niejasne (P3): 0
- Failujące (P2): 0

### Szczegóły

- [x] CLI: testy `map-page-client` i `use-language-filter` → PASS (2/2 suites, 17/17 testów;
  `npx jest "src/app/\[locale\]/\(main\)/_components/map-page-client" src/hooks/use-language-filter`)
- [x] CLI: `npx tsc --noEmit` bez błędów → PASS (exit 0)

Kroki `Operator:` fazy 3 (`/mapa?lang=ru`, przełączenie locale, `/mapa?lang=xx`) bez zmian —
poza bookkeepingiem, czekają na ręczną weryfikację.
