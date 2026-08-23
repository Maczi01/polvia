# Podsumowanie: Zasięg usługi (lokalna / online / hybryda)

**Status:** ukończone i zmergowane
**Branch:** `feature/online-service-coverage` → `master`
**PR:** [#3](https://github.com/Maczi01/polvia/pull/3) (32 commity, zmergowany)
**Okres:** 2026-08-19 – 2026-08-23

## Co powstało

Zasięg obsługi jako **druga, ortogonalna oś** opisu wpisu, obok kategorii (branży).

| Oś | Kolumna | Odpowiada na |
|---|---|---|
| Branża | `category` | **co** firma robi |
| Zasięg | `coverage` | **jak** obsługuje klienta |

`coverage` to `local` \| `online` \| `hybrid`. Mapa pokazuje piny wyłącznie dla wpisów
odwiedzalnych; usługi zdalne żyją w osobnej sekcji listy, widocznej niezależnie od filtra
geograficznego, pod indeksowalnym `/mapa/online`.

Punktem wyjścia była firma **fotodokarty.com.pl** — zdjęcia biometryczne na kartę pobytu,
w pełni zdalnie, adres rejestrowy w Warszawie bez punktu stacjonarnego. Pin na tym adresie
kłamał i jednocześnie ukrywał wpis przed użytkownikiem filtrującym inne województwo.

## Najważniejsza decyzja produktowa

**Kategoria NIE zyskała wartości `online`.** Kolumna kategorii jest jednowartościowa, więc
prawnik obsługujący zdalnie musiałby zniknąć z filtra „Prawne", a kafelek „Usługi online"
stałby się drugim `others`. Kafelek, o który prosił użytkownik, powstał — ale jako filtr
zasięgu, nie wartość kategorii.

To rozstrzygnięcie zostało zapisane w `CLAUDE.md`, żeby kolejne sesje nie proponowały
dodania `online` do `categoryEnum`.

## Zakres

10 Implementation Units w 5 fazach: schemat i migracja, dashboard i dane referencyjne,
warstwa URL, UI odkrywania (kubełkowanie, sekcja listy, mapa, karta), SEO.

Stan na moment merge'a: `tsc` 0, `jest` 208/208 (12 suit), `next lint` 0 błędów,
`npm run build` przechodzi.

## Sprostowania planu w trakcie wykonania

Trzy założenia planu okazały się błędne i zostały skorygowane:

1. **`innerJoin` nie wymagał zmiany na `leftJoin`.** `service_locations` niesie wymagany
   `slug` i `city`, więc wiersz lokalizacji istnieje zawsze. Nullowalne są tylko współrzędne.
2. **Seed nigdy nie był idempotentny.** Zero `delete`/`TRUNCATE`/`onConflictDoNothing`
   w 3447 liniach — opiera się na `db:drop`. Wymóg skorygowany, nie zrealizowany.
3. **„Nullowalne współrzędne" nie dało się zamknąć jako samodzielny zielony commit.**
   Zdjęcie `notNull` psuje kompilację u konsumentów. To była wada podziału na fazy:
   zmiana nullowalności kolumny jest z natury cross-cutting i musi być jednym unitem
   razem z konsumentami.

## Bugi preegzystujące naprawione po drodze

| Bug | Skutek | Commit |
|---|---|---|
| `Badge` ignorował `children` | Cennik pokazywał „Empty" zamiast „Polecane" | `c40d10c` |
| `z.coerce.number()` na pustym `FormData` | Wpis bez współrzędnych dostawał pin na (0,0) | `25b3c08` |
| Hardkodowany prefiks `/en` (3 miejsca) | Klik filtra przełączał język na `ru` i `uk` | `99e1a8a` |
| Soft-404 na całej trasie mapy | Każdy błędny URL to indeksowalne śmieci (HTTP 200) | `f9a1340`, `f536e3f` |
| Martwy `drizzle:generate` | Procedura z `CLAUDE.md` nie działała | `b1c0b60` |
| Testy komponentów nie startowały | ESM w `lucide-react` + brak `ResizeObserver` | `112913a` |

## Czego nauczyła ta praca

**Weryfikacja w przeglądarce złapała to, czego 197 testów nie widziało.** Sekcja „Dostępne
online" nie renderowała się na `/mapa` w ogóle — przy 139 wynikach lokalnych nagłówek siedział
poza okienkiem wirtualizacji `virtua`. Stąd banner nad listą (`2562300`). Żadna asercja
jednostkowa nie mogła tego wychwycić, bo w teście kubełek ma 1-2 elementy.

**Characterization testy zapłaciły się natychmiast.** Pierwsza wersja zmiany w karcie usługi
wywaliła render wszystkich 14 testów — `coverage` nie było destrukturyzowane z propsów.
Bez testów napisanych przed zmianą błąd wyszedłby dopiero w przeglądarce.

**Pomiar na uszkodzonym środowisku prowadzi do fałszywych wniosków.** Dwa razy w tej pracy
`npm run build` pod działającym dev serverem rozspójnił `.next`, dając 500-tki i nieaktualne
statusy — raz kazało to podejrzewać kod, który był poprawny.

**Grep bije test tam, gdzie testów nie ma.** Trzecie miejsce budujące URL do Google Maps
(`MobileBottomMarkerCard`) znalazł grep, nie test — bo żaden test nie pokrywa tego komponentu.
Była to jedyna prawdziwa regresja wprowadzona tą pracą.

## Baza wiedzy

Pięć wpisów w `docs/solutions/` i sześć reguł w `.claude/rules/learned-patterns.md`.
`docs/solutions/` było wcześniej puste.

## Otwarte, świadomie nieukończone

Rejestr w `online-service-coverage-zadania.md`, sekcja „Znaleziska niezależne od tego zadania".
Najważniejsze:

1. **Godziny otwarcia nigdy się nie renderują** — `getTodayHours` buduje klucz z wielkiej
   litery (`'Saturday'`), dane mają małą (`'saturday'`). Dla żadnej ze 140 usług.
   Odłożone decyzją użytkownika: naprawa uwidoczni blok godzin na wszystkich kartach.
2. `role="status"` + `tabIndex={0}` na każdym badge'u (wymóg istniejących testów).
3. Cztery źródła prawdy o kategoriach; `government` osiągalne w UI, ale niezapisywalne.
4. Główna strona 404 ma zahardkodowany `lang="pl"` i `href="/pl"` niezależnie od locale.
5. `PolishMediaTable` — tabela polonijnych mediów w Irlandii, relikt treściowy po forku.

## Niedokończona weryfikacja

Trzy pozycje `Operator:` pozostały niepotwierdzone w przeglądarce w momencie merge'a.
Dwie z nich sprawdzono później z HTML-a; **empty state mobilnej mapy na `/mapa/online`
nadal nie był oglądany przez człowieka** — `isMobile` jest wyliczane po stronie klienta,
więc `curl` go nie widzi.

Odnotowano też, że `SelectValue` w formularzu dashboardu renderuje pustą wartość w SSR
zarówno dla nowego pola `coverage`, jak i dla preegzystującego `status` — czyli to wspólny
quirk shadcn/Radix w tym repo, nie regresja. Czy hydratacja to naprawia, pozostaje
niesprawdzone.
