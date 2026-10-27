# Review fazy 2 — U2: predykat języka i liczniki per język

**Branch:** `feature/filtr-jezyka-obslugi`
**Commit:** `b8f4f9a`
**Data:** 2026-10-20

## Werdykt

✅ **GOTOWE DO KONTYNUACJI** — 0 × P1, 0 × P2, 10 × P3.

Reguła języka żyje w jednym eksportowanym predykacie (`matchesLanguage`), dołożonym do wspólnego
`matching` — oba kubełki i wszystkie liczniki dostają filtr jednym przepływem (lekcja z PR #27
zachowana). Brak `any`/`as`/`!`, jawne typy zwracane, wszystkie 8 zaplanowanych scenariuszy pokryte
realnymi asercjami, żaden istniejący test nie osłabiony.

## Perspektywy

| Agent | P1 | P2 | P3 | Uwagi |
|---|---|---|---|---|
| Security (`security-sentinel`) | 0 | 0 | 1 | `.includes` na tablicy stringów — najgorszy wynik nieznanego kodu to pusta lista; rekord kluczowany wyłącznie stałą listą (brak prototype pollution); wejście już przefiltrowane `isPublicService` |
| Performance (`performance-oracle`) | 0 | 0 | 2 | ~16 liniowych przebiegów na zmianę filtra (10 kategorii + 5 języków + suma); przy ~350–400 wierszach < 5 ms; single-pass przedwczesny |
| Architektura + TS (`kieran-typescript-reviewer`) | 0 | 0 | 5 | nazwa `CoverageFilters` OK (już wcześniej trzymała osie niezwiązane z zasięgiem); literał `Record<ServiceLanguage, number>` wymusza komplet kluczy |
| Scenariusze + testy | 0 | 0 | 5 | 8/8 scenariuszy; test zgodności licznika z liczbą wyrenderowanych kart (`buildListRows`) |
| E2E (chrome-devtools) | — | — | — | pominięty: faza 2 to czysta warstwa danych, checkboxy `Weryfikacja:` tylko CLI |

## Findings (po deduplikacji)

### 🟡 P3-nit — kod

1. **`src/lib/service-coverage.ts:159-161`** — `matchesQuery` (najdroższy: buduje i normalizuje
   pola przy każdym wywołaniu) liczony przed tanimi `matchesCategory`/`matchesLanguage`. Zamiana
   kolejności w `&&` = te same wyniki, 5–10× mniej normalizacji w licznikach. Jedna linia.
2. **`src/lib/result-counts.ts:59-65`** — docstring `countCardsByLanguage` nie mówi (w
   przeciwieństwie do `countCardsByCategory`), że wyniki semantyczne nie są liczone. Dopisać przed
   U3, żeby nikt ich nie dołożył do licznika.
3. **`src/lib/result-counts.ts`** — 16 przebiegów powtarza normalizację `query`, która nie zależy
   od kategorii ani języka. Przy wzroście N: filtr po query raz, potem liczniki per klucz. **Nie
   teraz** — odnotowane na przyszłość.

### 🟡 P3-nit — wskazówki dla U3 (nie wymagają zmian w fazie 2)

4. Parser `?lang` musi zawężać przez `parseAsStringLiteral(SERVICE_LANGUAGES)` / `isServiceLanguage`
   — nigdy `as ServiceLanguage` (inaczej `?lang=xx` = zero wyników zamiast braku filtra, łamie R10).
5. `countCardsByLanguage` w osobnym `useMemo` z zależnościami `[services, currentFilters,
   searchInput]`; `language` trzymać wewnątrz stanu filtrów (stabilne zależności). Rozważyć
   `useDeferredValue(searchInput)` dla wszystkich liczników — nuqs aktualizuje `query` przy każdym
   klawiszu.

### 🟡 P3-nit — testy

6. **`service-coverage.test.ts:379`** — brak testu `onlineOnly: true` + `language` (lokalny kubełek
   pusty, online zawężony językiem) oraz `query` + `language`. Poprawne z konstrukcji (jeden
   predykat), ale nie zablokowane testem.
7. **`result-counts.test.ts:157`** — katalog `countCardsByLanguage` bez wpisu `hybrid` (hybryda
   spoza miasta ląduje w kubełku online).
8. **`map-metadata.test.ts:57-71`** — test R9 nie może dziś failować (`MapFilters` nie ma pola
   języka); pilnuje kontraktu na przyszłość. Komentarz, który to mówi wprost.
9. **`service-coverage.test.ts:436-438`** — zmienna `bezJezyka: CoverageFilters = {}` istnieje tylko
   po to, by przekazać `undefined`; czytelniej `matchesLanguage(service(...), undefined)`.
10. **`result-counts.test.ts:196`, `service-coverage.test.ts:415`** — dwie nowe linie > 100 znaków
    (Prettier). Pozostałe uwagi Prettiera w tych plikach preegzystujące.

### ⚪ Info

- `result-counts.test.ts` — test „zgadza się z liczbą kart" idzie tą samą ścieżką co implementacja
  (`countVisibleCards` → `splitServicesByCoverage`); wartość dają sąsiednie testy z twardymi
  liczbami. Pomocniczy, nie do usunięcia.
- Hybryda z lokalizacjami w obu kubełkach liczy się jako 2 karty — preegzystujące, zgodne z tym, co
  renderuje lista (test zgodności to egzekwuje).
- `languages` jest per usługa (`servicesTable`), nie per lokalizacja — zgrupowana karta nie może
  pasować „przez jedną lokalizację".
- `getServices` zwraca `results as Service[]`; pełna publiczna lista (z e-mailem i telefonem) trafia
  do klienta — oba preegzystujące, diff nie pogarsza.
- Liczby: przy obecnych ~350–400 wierszach lokalizacji koszt liczników pomijalny; przy 100× N
  (~40k) 100–300 ms na klawisz — wtedy punkt 3 i paginacja po stronie serwera.

## Odchylenia od planu

- Brak istotnych. Wszystkie pliki i scenariusze z IU-2 zrealizowane; pliki testowe z planu istnieją.
- `Delegate to: feature-builder-web-data` zgodne z kategorią plików (wyłącznie `src/lib/**`).
- Scenariusz „`language: null` = zachowanie sprzed zmiany" zrealizowany nowym katalogiem 4 wpisów
  (z `[]` i `['de']`) zamiast snapshotu liczności na istniejących fixtures — mocniejszy wariant.
- Testy liczników z aktywnym językiem i R9 bez fazy RED (zachowanie dziedziczone) — zgłoszone
  przez buildera.

## Bookkeeping checkboxów Weryfikacja:

- Odznaczone automatycznie (CLI/grep): 2
- Odznaczone na podstawie Agent 5 E2E (chrome-devtools): 0
- Pozostawione dla operatora (Manual): 0
- Niejasne (P3): 0
- Failujące (P2): 0

### Szczegóły

- [x] CLI: `npx jest src/lib/service-coverage src/lib/result-counts src/lib/map-metadata` → PASS
  (3/3 suites, 71/71 testów)
- [x] CLI: `npx tsc --noEmit` bez błędów → PASS (exit 0)
