# Plan: Filtr języka obsługi + białoruski jako język obsługi

**Branch:** `feature/filtr-jezyka-obslugi`
**Ostatnia aktualizacja:** 2026-10-18

## Źródła

- Requirements doc: [docs/brainstorms/2026-10-18-filtr-jezyka-obslugi-requirements.md](../../brainstorms/2026-10-18-filtr-jezyka-obslugi-requirements.md)
- Plan techniczny: [docs/plans/2026-10-18-001-feat-filtr-jezyka-obslugi-plan.md](../../plans/2026-10-18-001-feat-filtr-jezyka-obslugi-plan.md)

## Podsumowanie wykonawcze

Użytkownik polvii bez polskiego musi znaleźć firmę, która obsłuży go w jego języku. Kolumna
`languages` jest wypełniona, a karty pokazują flagi, ale filtrować się nie da. Dodajemy trzecią,
niezależną oś filtra mapy/listy — język obsługi w `?lang=` — z dropdownem (endonimy, flagi,
liczniki) na desktopie i w mobilnym arkuszu. Przy okazji białoruski (`be`) staje się pełnoprawnym
językiem obsługi z flagą biało-czerwono-białą.

## Cele i zakres

**W scope:** filtr `?lang=pl|uk|ru|en|be` (single-select), zawężanie pinów/listy/wyników
semantycznych/wszystkich liczników, liczniki per język (zera widoczne), „Usuń filtry" czyści język,
mobilny arkusz, `be` w „Dodaj firmę"/dashboardzie/na kartach, nowa flaga `by.svg`, klucze ×4 locale.

**Poza scope:** język w ścieżce URL/SEO, multi-select, przegląd flag 🇷🇺/🇬🇧, backfill `be` w
`data/services/`, flagi na pinach, sortowanie zamiast filtra, `be` jako locale UI, zmiany
`clearCategories` w arkuszu.

## Stan obecny → docelowy

| Obszar | Dziś | Docelowo |
|---|---|---|
| Filtry mapy | kategoria, zasięg, województwo/miasto, query | + język obsługi (`?lang=`) |
| `CoverageFilters` | query, category, county, city, onlineOnly | + `language` |
| Liczniki | per kategoria, suma widocznych | + per język; wszystkie respektują język |
| Wyniki semantyczne | ręczny filtr lokalizacji/kategorii | + wspólny predykat języka |
| Lista kodów języków | `add-business/form-limits.ts` (pl, uk, en, ru) | `src/lib/languages.ts` (pl, uk, ru, en, be) + reeksport |
| Mapy flag | 2 kopie (`service-card`, `business-card-preview`) | 1 w `languages.ts` |
| `by.svg` | czerwono-zielona | biało-czerwono-biała |

## Fazy wdrożenia

| Faza | Unit | Cel | Nakład | Zależy od |
|---|---|---|---|---|
| 1 | U1 | Moduł języków + `be` w formularzach i na kartach | M | — |
| 2 | U2 | Predykat języka + `countCardsByLanguage` | S | U1 |
| 3 | U3 | Stan `?lang` wpięty w mapę, listę, semantykę | M | U2 |
| 4 | U4 | Kontrolka języka (desktop, mobile, reset) | M | U3 |

Szczegółowe zadania, testy i weryfikacja: `filtr-jezyka-obslugi-zadania.md`.

## Kryteria akceptacji (całość)

- Wybór języka zawęża piny, listę, wyniki semantyczne i liczniki; licznik na chipie = liczba kart.
- `/mapa/prawne?lang=ru` jest udostępnialny, „wstecz" cofa zmianę języka, filtr przetrwa zmianę
  locale strony.
- `?lang=xx` = brak filtra, status 200.
- Canonical nie zawiera `?lang`.
- „Usuń filtry" aktywny i skuteczny przy samym języku.
- `be` wybieralny w „Dodaj firmę" i dashboardzie, flaga biało-czerwono-biała na kartach.
- Wszystkie nowe klucze w czterech `messages/*.json`.
- Quality gate: `npx tsc --noEmit` 0 błędów, `npx jest` zielony, `npx next lint` 0 błędów.

## Ryzyka i mitygacja

| Ryzyko | Mitygacja |
|---|---|
| Rozszerzenie `LanguageCode` łamie indeksowanie `LocalizedText` (pl/uk/en/ru) | U1 atomowo: `business-card-preview`/`generated-summary` przechodzą na `Locale` z `@/i18n/config` |
| Kopia reguły filtra (lekcja PR #27: 29 pinów vs 14 wyników) | Jeden eksportowany `matchesLanguage`, reużyty w semantyce |
| Dwa mechanizmy historii (pushState ścieżki + nuqs query) gubią `lang` | Ręczna weryfikacja w U3 (klik kategorii z aktywnym językiem) |
| Shallow nuqs niewidoczne dla przełącznika locale | Założenie z działającego `?query=`; weryfikacja ręczna U3 |
| Brak `.env.e2e` | Scenariusze przeglądarkowe jako `Operator:` |
| Regresja w nietestowanym komponencie renderującym flagi | Grep wszystkich miejsc renderujących języki w U1 |

## Mierniki sukcesu

- Liczba kart na liście = licznik na chipie kategorii = licznik przy języku, dla każdej kombinacji
  filtrów sprawdzanej w testach.
- Zero nowych `any`, zero nowych błędów lint, nowe funkcje publiczne z testem happy path + error.

## Zasoby i zależności

- Brak nowych zależności (nuqs 2.4 już zainstalowane, `parseAsStringLiteral` dostępne).
- Brak zmian schematu bazy i migracji.
- Nowe SVG flagi (biało-czerwono-białej) w formacie istniejących flag.

## Szacunek czasowy

~1–1,5 dnia pracy: U1 ~3 h, U2 ~1 h, U3 ~2–3 h, U4 ~3 h, weryfikacja ręczna ~1 h.
