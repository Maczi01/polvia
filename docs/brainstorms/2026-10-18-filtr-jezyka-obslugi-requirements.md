---
date: 2026-10-18
topic: filtr-jezyka-obslugi
---

# Filtr języka obsługi na mapie i liście usług

## Problem

Docelowy użytkownik polvii to imigrant, który **nie mówi po polsku** i musi znaleźć firmę
obsługującą go w jego języku. Wpis bez jego języka jest dla niego szumem — nie dogada się.

Dane już to wiedzą: każdy wpis ma listę języków obsługi, a karta pokazuje je jako flagi. Ale
filtrować po nich się nie da, więc użytkownik rosyjsko- czy angielskojęzyczny otwiera karty jedna
po drugiej i patrzy na flagi. Rozkład w `data/services/` (31 wpisów): pl ~29, uk ~22, ru ~10,
en ~9, be 0 — filtr realnie zawęża dla ru/en, dla uk mniej.

Przy okazji: **białoruski** jest dziś językiem „w połowie" — karta zna `be`, seed ma wpisy z `be`,
ale formularz „Dodaj firmę" i podgląd karty go nie oferują. Białorusini to istotna grupa
odbiorców w Polsce, więc `be` staje się pełnoprawnym językiem obsługi.

## Wymagania

**Filtr**

- R1. Język obsługi to trzecia, niezależna oś filtra — obok kategorii (branża) i zasięgu
  (local/online/hybrid). Łączy się z nimi koniunkcją: „Prawne + Warszawa + ru".
- R2. Wybór jednego języka naraz (single-select) plus opcja „Dowolny język" (stan domyślny,
  brak filtra).
- R3. Opcje: pl, uk, ru, en, be — wszystkie pięć, zawsze widoczne.
- R4. Nazwy języków w dropdownie to **endonimy**, identyczne we wszystkich locale: Polski,
  Українська, Русский, English, Беларуская. Etykiety wokół („Język obsługi", „Dowolny język")
  są tłumaczone na pl/en/ru/uk.
- R5. Przy każdym języku licznik wyników dla bieżących pozostałych filtrów (kategoria,
  lokalizacja, online), liczony tak samo jak liczniki kategorii (karty, nie lokalizacje).
  Język z wynikiem 0 pozostaje widoczny i klikalny — prowadzi do istniejącego empty state.
- R6. Wpis pasuje, gdy jego lista języków **zawiera** wybrany język.

**Stan i URL**

- R7. Wybrany język żyje w query paramie `?lang=<kod>` (np. `/mapa/prawne?lang=ru`), z tą samą
  nazwą we wszystkich locale — jak istniejące `?query=` / `?view=` / `?id=`. Link jest
  udostępnialny, działa „wstecz" przeglądarki.
- R8. Zmiana języka strony (przełącznik locale, także przekierowanie z zapamiętanej preferencji)
  zachowuje filtr.
- R9. Strony z `?lang=` nie są osobnymi stronami dla wyszukiwarek — canonical wskazuje URL bez
  parametru.
- R10. Nieznana/niepoprawna wartość `?lang=` jest traktowana jak brak filtra.
- R11. Filtr nigdy nie włącza się sam (np. z locale UI) — zmienia go wyłącznie użytkownik.

**Spójność widoku**

- R12. Wybrany język zawęża wszystko naraz: piny na mapie, listę, liczniki na chipach kategorii,
  licznik „Online" i przycisk „pokaż wyniki" w mobilnym arkuszu filtrów.
- R13. „Usuń filtry" czyści też język; przycisk jest aktywny, gdy wybrany jest sam język.
- R14. Ten sam filtr dostępny w mobilnym arkuszu filtrów (`mobile-filter-modal`).
- R15. Desktop: kompaktowy dropdown obok „Wybierz lokalizację" — nie kolejne chipy w pasku
  kategorii (pasek już się przewija).

**Białoruski**

- R16. `be` jest wybieralny wszędzie, gdzie wybiera się języki obsługi: formularz „Dodaj firmę"
  (edytor szkicu, podgląd karty, podsumowanie), formularze w dashboardzie.
- R17. Nazwa białoruskiego przetłumaczona we wszystkich czterech `messages/*.json` wszędzie,
  gdzie UI nazywa języki w języku strony (alt flagi, pola formularzy).
- R18. Znacznik białoruskiego to flaga **biało-czerwono-biała**, zastępująca obecną
  czerwono-zieloną `public/icons/by.svg` — w filtrze, na kartach i w formularzu.

## Kryteria sukcesu

- Użytkownik bez polskiego, wybierając swój język, widzi na mapie, liście i licznikach
  wyłącznie firmy, które obsługują go w tym języku — liczba na chipie zgadza się z liczbą kart.
- Link `/mapa/prawne?lang=ru` wysłany znajomemu otwiera ten sam widok; po przełączeniu strony na
  `uk` filtr dalej działa.
- Właściciel firmy obsługującej po białorusku może to zaznaczyć w „Dodaj firmę", a wpis pojawia
  się w filtrze `be` z flagą biało-czerwono-białą.

## Granice scope'u

- Język w ścieżce URL / osobne strony SEO („prawnik po ukraińsku") — nie teraz; przy 31 wpisach
  dałoby cienkie strony.
- Wybór kilku języków naraz (`uk` LUB `ru`).
- Przegląd flag jako znaczników języków ogólnie (🇷🇺 dla rosyjskiego, 🇬🇧 dla angielskiego) —
  znany temat, osobna decyzja.
- Uzupełnianie `be` w istniejących wpisach `data/services/`.
- Flagi języków na pinach mapy.
- Sortowanie/podbijanie wpisów w języku użytkownika zamiast filtrowania.
- Białoruski jako locale UI (piąty `messages/be.json`).

## Kluczowe decyzje

- **Twardy filtr, nie sortowanie**: użytkownik bez polskiego nic nie zyska z wpisu, z którym
  się nie dogada.
- **Query param, nie segment ścieżki**: `parseMapSlug` ma maks. 2 segmenty, a `online` już dzieli
  slot z county/city; ścieżka oznaczałaby nowy parser, rewrite'y, sitemap i slugi ×4 locale dla
  cienkich stron.
- **`?lang=` wszędzie, bez tłumaczenia nazwy**: wszystkie istniejące parametry są angielskie i
  wspólne; przełącznik locale kopiuje query 1:1 (`language-switcher.tsx`), więc filtr przetrwa
  zmianę języka bez dodatkowego kodu. Ryzyko pomylenia z locale UI dotyczy tylko developerów.
- **pl w opcjach mimo ~29/31**: kompletność i symetria z formularzem; licznik uczciwie pokaże,
  że prawie nic nie odpada.
- **Endonimy**: użytkownik bez polskiego rozpozna swój język także na wersji pl — tak jak w
  przełączniku języka strony.
- **Liczniki przy językach, zera widoczne**: spójne z licznikami kategorii; ukrywanie zer
  schowałoby `be` do pierwszego wpisu i lista skakałaby przy zmianie filtrów.
- **Flaga biało-czerwono-biała**: flaga diaspory białoruskiej w Polsce, której ten feature
  służy. Świadomie zajmowane stanowisko — w Polsce mainstreamowe.

## Zależności / Założenia

- Lista języków wpisu jest dostępna po stronie klienta razem z resztą danych usług (dziś:
  `PartialService.languages`) — filtrowanie odbywa się tam, gdzie kategoria i zasięg.

## Otwarte pytania

### Do rozwiązania przed planowaniem

(brak)

### Odroczone do planowania

- [Dotyczy R1, R12][Techniczne] Jak rozszerzyć `CoverageFilters` o język, żeby liczniki
  (`result-counts.ts`), piny i lista czytały jeden wspólny stan filtrów.
- [Dotyczy R16][Techniczne] Gdzie ma żyć lista kodów języków dostępna dla klienta — dziś
  `LANGUAGE_CODES` siedzi w `add-business/form-limits.ts`; kandydat: `src/lib/languages.ts`
  z reeksportem. Dwie mapy flag (`service-card.tsx`, `business-card-preview.tsx`) do scalenia.
- [Dotyczy R16][Techniczne] Czy pipeline LLM w „Dodaj firmę" (`llm-draft.ts`,
  `normalizeLanguages`) i schemat dashboardu (`z.array(z.string())`) potrzebują zmian dla `be`.
- [Dotyczy R10][Techniczne] Zachowanie przy `?lang=xx`: cicha normalizacja vs. usunięcie
  parametru z URL-a.

## Następne kroki

→ `/dev-plan` do planowania technicznego implementacji
