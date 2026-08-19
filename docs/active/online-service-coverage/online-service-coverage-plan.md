# Plan: Zasięg usługi (lokalna / online / hybryda)

**Branch:** `feature/online-service-coverage`
**Ostatnia aktualizacja:** 2026-08-20

## Źródła

- Requirements doc: [docs/brainstorms/2026-08-19-uslugi-online-zasieg-requirements.md](../../brainstorms/2026-08-19-uslugi-online-zasieg-requirements.md)
- Plan techniczny: [docs/plans/2026-08-19-001-feat-online-service-coverage-plan.md](../../plans/2026-08-19-001-feat-online-service-coverage-plan.md)

> Plan techniczny jest źródłem prawdy dla decyzji implementacyjnych, scenariuszy testowych
> i kryteriów weryfikacji. Ten dokument organizuje je w fazy wykonawcze i śledzi postęp.

## Podsumowanie wykonawcze

Wprowadzamy **zasięg** jako drugą, ortogonalną oś opisu wpisu — obok kategorii (branży).
Wpis jest `local`, `online` albo `hybrid`.

Problem: cała discovery przechodzi przez mapę opartą na współrzędnych, co dla usług zdalnych
działa przeciw użytkownikowi. Przypadek wzorcowy — **fotodokarty.com.pl** (zdjęcia biometryczne
na kartę pobytu CUKR, upload selfie → JPG mailem, zasięg cała Polska, adres rejestrowy
w Warszawie bez punktu stacjonarnego). Pin na tym adresie kłamie i jednocześnie ukrywa wpis
przed użytkownikiem w Rzeszowie, bo filtrowanie odcina po `voivodeship` / `city`.

Rozwiązanie: mapa pokazuje wyłącznie miejsca, które można odwiedzić; usługi zdalne dostają
osobną sekcję na liście (widoczną zawsze, niezależnie od filtra geograficznego), własny filtr
oraz indeksowalne URL-e `/mapa/online` i `/mapa/{kategoria}/online`.

Kategoria **nie** zyskuje wartości `online` — świadomie odrzucona alternatywa. Kolumna kategorii
jest jednowartościowa, więc `category: 'online'` wyrzuciłby online prawnika z filtra „Prawne",
a kafelek „Usługi online" stałby się drugim `others`.

## Analiza obecnego stanu

- `serviceLocationsTable.latitude` / `longitude` są `notNull` — wpis bez współrzędnych nie istnieje.
- `getServices()` i `getMostPopular()` mają niemal identyczne, zduplikowane selecty.
- Filtrowanie jest klienckie, w `services-client-component.tsx` (681 linii — ponad próg 300
  z `coding-rules.md`).
- `MapList` renderuje już **dwie** sekcje z `SectionHeader` (wyniki filtrowane + `embeddingResults`)
  ze wspólnym licznikiem `cardIndex` — gotowy wzorzec dla trzeciej sekcji.
- `parseMapSlug` przyjmuje maks. 2 segmenty; drugi slot to county **lub** city — miejsce dla `online`.
- W `seed.ts` istnieje kilka biur rachunkowych opisanych jako zdalne, zapisanych jako lokalne
  wpisy w kategorii `financial`. Podaż już jest, produkt jej nie wykorzystuje.
- Repo ma **2 błędy typecheck** (brak `index.ts` w `badge/` i `button/`), więc `npx tsc --noEmit`
  zawsze failuje.

## Proponowany stan docelowy

- `coverageEnum` (`local` | `online` | `hybrid`) + kolumna `coverage` na `servicesTable`.
- `latitude` / `longitude` nullowalne; `city` wymagane dla wpisów niebędących `local`.
- Trzy kubełki wyników liczone czystą, testowalną funkcją w `src/lib/service-coverage.ts`.
- Piny tylko dla wpisów odwiedzalnych ze współrzędnymi; empty state dla mobilnej mapy bez pinów.
- Filtr „Online" w rzędzie filtrów, kombinowalny z kategorią.
- `/mapa/online` w sitemapie z własnym `title`, `canonical` i `hreflang`.

## Cele i zakres

### W zakresie

- R1–R12 z requirements doca (pełna lista w planie technicznym, sekcja „Śledzenie wymagań").
- Naprawa 2 błędów typecheck jako warunek sensowności automatycznej weryfikacji.

### Poza zakresem

- Osobna gałąź route `/uslugi-online`.
- Piny zastępcze (centroidy województw, „środek Polski", pin online).
- Zasięg regionalny — `online` znaczy „cała Polska".
- Sekcja online na stronie głównej (`category-preview` bez zmian).
- Naprawa kategorii `government` (osobna, wcześniejsza luka).
- Zmiany w `/api/services` (semantic search).
- `/mapa/{kategoria}/online` w sitemapie (thin content do czasu pojawienia się podaży).
- Konsolidacja czterech źródeł prawdy o kategoriach.

## Fazy wdrożenia

| Faza | Unity | Nakład | Cel |
|---|---|---|---|
| **0 — Odblokowanie weryfikacji** | U0 | S | Czysty baseline typecheck |
| **1 — Fundament danych** | U1 | M | `coverage` + nullowalne współrzędne + typy + zapytania |
| **2 — Wejście danych** | U2, U3 | M + S | Dashboard i dane referencyjne |
| **3 — Warstwa URL** | U4 | M | Slug `online` w parserze i builderze |
| **4 — UI odkrywania** | U5, U6, U7, U8 | M + L + M + L | Kubełkowanie, sekcja listy, mapa, karta |
| **5 — SEO** | U9 | M | Sitemap i metadata |

Nakład w klasach S/M/L/XL to **relatywne sizing**, nie zobowiązanie czasowe. Największe pozycje:
U6 (integracja trzeciej sekcji ze wspólnym `cardIndex`) i U8 (karta na 666 linii, wymaga
characterization testów przed dotknięciem gardów).

### Faza 0 — Odblokowanie weryfikacji

**U0. Czysty baseline typecheck** — nakład **S**, zależności: brak

Repo ma dokładnie 2 błędy typecheck: `badge.test.tsx` i `button.test.tsx` importują
z `@/components/ui/badge` / `@/components/ui/button`, a te katalogi nie mają barrel file'a.
Dopóki istnieją, `npx tsc --noEmit` zawsze failuje i **żaden** checkbox `Weryfikacja:`
w tym planie nie da się domknąć automatycznie.

*Kryteria akceptacji:* `npx tsc --noEmit` zwraca zero błędów; testy badge i button przechodzą
bez modyfikacji plików testowych.

### Faza 1 — Fundament danych

**U1. `coverage` w schemacie + nullowalne współrzędne + typy + zapytania** — nakład **M**, zależności: U0

Kluczowe ustalenie planowania: **`innerJoin` w `getServices` zostaje**. Requirements doc zakładał
zmianę na `leftJoin`, ale `service_locations` niesie wymagany, unikalny `slug` oraz `city` z R9,
więc każdy wpis zawsze ma wiersz lokalizacji. Nullowalne są tylko współrzędne.
Drugie ustalenie: **`openingHours` zostaje `notNull`** — dla wpisu zdalnego `{}`, a karta jest
już null-safe.

*Kryteria akceptacji:* kolumna `coverage` z `notNull().default('local')`; `latitude`/`longitude`
nullowalne; typ `Coverage` inferowany ze schematu Drizzle; `coverage` w selektach **obu** zapytań;
migracja wygenerowana przez `drizzle:generate` i nietknięta ręcznie.

### Faza 2 — Wejście danych

**U2. Zasięg w dashboardzie (formularz + Server Action + Zod)** — nakład **M**, zależności: U1

Najbardziej ryzykowny punkt całego planu: `z.coerce.number()` na pustym stringu z `FormData`
daje **`0`, nie `null`**. Wpis zdalny dostałby współrzędne `0,0` — pin w Zatoce Gwinejskiej —
i przeszedłby wszystkie testy typów.

*Kryteria akceptacji:* puste `latitude`/`longitude` zapisują `null`; `coverage !== 'local'`
wymaga `city`; `coverage === 'local'` wymaga współrzędnych; `coverage === 'online'` zapisuje
`openingHours: {}`; wartość spoza enuma odrzucona; błędy walidacji trafiają w konkretne pole.

**U3. Dane referencyjne w seedzie (R12)** — nakład **S**, zależności: U1

*Kryteria akceptacji:* wpisy zdalne z seeda mają `coverage: 'hybrid'`; ≥1 wpis `online`
bez ulicy i współrzędnych (FotoDoKarty); ≥1 wpis `hybrid` poza Mazowszem (do weryfikacji dedupe
w obie strony); seed pozostaje idempotentny.

### Faza 3 — Warstwa URL

**U4. Slug `online` w parserze i builderze URL** — nakład **M**, zależności: brak (może iść równolegle z Fazą 1–2)

`/mapa/pomorskie/online` odpada istniejącą ścieżką (`parseTwoSegments` wymaga kategorii jako
pierwszego segmentu) — **nie dopisywać osobnej reguły odrzucania**. Testy jednostkowe są tu
najważniejszym deliverable: to czyste funkcje, a regresja w parserze objawia się jako 404 na
produkcji.

*Kryteria akceptacji:* `/mapa/online` i `/mapa/prawne/online` parsują się poprawnie w 4 locale;
round-trip `parseMapSlug(buildMapUrl(f))` zwraca `f`; `online` nie koliduje z żadnym istniejącym
slugiem kategorii, county ani miasta.

### Faza 4 — UI odkrywania

**U5. Logika kubełkowania jako czysta funkcja** — nakład **M**, zależności: U1, U4

Reguły R4–R6 idą do `src/lib/service-coverage.ts`, nie do komponentu na 681 linii.
Deduplikacja liczona względem sumy listy lokalnej **i** `embeddingResults` — inaczej usługa
zdalna wyciągnięta przez semantic search pokaże się dwa razy na jednym ekranie.

*Kryteria akceptacji:* wpis `hybrid` trafia dokładnie do jednego kubełka w każdym stanie filtrów;
funkcja czysta, bez `server-only` (używa jej Client Component); 11 scenariuszy testowych z planu
technicznego przechodzi.

**U6. Sekcja „Dostępne online" + filtr „Online" + i18n** — nakład **L**, zależności: U4, U5

Punkt krytyczny: `onlineResults` musi wejść do `allServices` i wspólnego licznika `cardIndex`.
Rozjechanie tego zepsuje refy, scrollowanie i rozwijanie kart — te same struktury obsługują
już dwie sekcje. Drugi punkt: `resetAllFilters` musi zerować `onlineOnly`.

*Kryteria akceptacji:* sekcja pojawia się tylko przy niepustym kubełku; `cardIndex` unikalny
przy trzech sekcjach; nowe klucze i18n obecne we **wszystkich czterech** `messages/*.json`;
asercja `jest-axe` bez naruszeń.

**U7. Mapa — piny tylko dla odwiedzalnych + empty state** — nakład **M**, zależności: U1, U5

Wykluczenie działa u źródła, w `createPoints` — dzięki temu clustering, `bounds` i `supercluster`
nie wymagają zmian. Zakaz obchodzenia nullowalności przez `!` albo `as`.

*Kryteria akceptacji:* wpis `online` ze współrzędnymi nie tworzy pinu; wpis `hybrid` tworzy pin;
wpis `local` z `latitude: null` nie tworzy pinu i nie rzuca wyjątku; mobilny widok „mapa"
bez pinów pokazuje empty state kierujący do listy.

**U8. Karta usługi — oznaczenie zasięgu i null-safety adresu** — nakład **L**, zależności: U1

Regresja wprowadzana przez ten plan: gardy w `service-card.tsx:251,286` sprawdzają
`latitude !== undefined`, a `null !== undefined` jest `true`. Po U1 przepuszczą `null`
i poleci `handleFlyTo(null, null)`, a `navigateLink` zbuduje `destination=null,null`.

*Kryteria akceptacji:* brak linku nawigacji dla wpisu bez współrzędnych; badge zasięgu dla
`online` i `hybrid`, brak dla `local`; adres bez ulicy renderuje się bez wiszącego przecinka;
`handleFlyTo` nie jest wywoływany przy `null`; `jest-axe` bez naruszeń dla trzech wariantów.

### Faza 5 — SEO

**U9. Sitemap i metadata dla `/mapa/online`** — nakład **M**, zależności: U4, U6

Obecna sitemapa emituje kategorie tylko dla `pl` i `en`, nie dla `ru`/`uk` — **utrzymać tę
konwencję**, nie „naprawiać" jej po cichu w tym unicie.

*Kryteria akceptacji:* `/mapa/online` i `/en/map/online` w sitemapie; brak kombinacji
`/mapa/{kategoria}/online`; brak duplikatów URL-i; `onlineOnly` wpływa na `titleSuffix`,
`canonical` i `languages`; `npm run build` przechodzi.

## Mierniki sukcesu

Przeniesione z requirements doca, z przypisaniem do miejsca domknięcia.

| Kryterium sukcesu | Gdzie domykane |
|---|---|
| Użytkownik w Rzeszowie z filtrem „Podkarpackie" widzi FotoDoKarty bez klikania czegokolwiek | U5 (`Test:` dedupe), U6 (`[Manual]` `/mapa/pomorskie`) |
| Żaden pin nie prowadzi pod adres bez punktu obsługi | U7 (`Test:` wpis `online` nie tworzy pinu) |
| Wpis online da się dodać bez ulicy i współrzędnych; brak zmyślonych koordynatów | U2 (`Test:` puste `latitude` → `null`) |
| Filtr „Prawne" nadal zwraca prawnika działającego wyłącznie online | U5 (`Test:` filtr kategorii + wpis `online`) |
| Wpis `hybrid` osiągalny dwiema drogami, nigdy dwa razy na jednym ekranie | U5 (`Test:` oba stany filtra) |
| `/mapa/online` w sitemapie z własnym `title` | U9 (`Test:` sitemap, `[Manual]` `<title>`) |

## Ocena ryzyka i strategie mitygacji

| Ryzyko | Wpływ | Mitygacja |
|---|---|---|
| `z.coerce.number()` na `''` daje `0`, nie `null` | Wysoki — cichy bug, pin `0,0`, przechodzi testy typów | U2 pisany test-first, dedykowany scenariusz na puste wejście |
| `null !== undefined` w gardach karty | Wysoki — `handleFlyTo(null, null)`, martwy link nawigacji | U8 z characterization testami przed dotknięciem gardów; `grep` w `Weryfikacja:` |
| Rozjechanie `cardIndex` przy trzeciej sekcji | Średni — psuje refy, scroll, rozwijanie kart | Scenariusz testowy na trzy sekcje jednocześnie; wzorzec sekcji embeddingów |
| Brak `.env.e2e` | Średni — weryfikacja przeglądarkowa w całości operatorska | Zgłoszone jawnie; utworzenie `.env.e2e` zamienia wszystkie `[Manual]` na automatyczne `[E2E]` |
| Cztery rozjechane źródła prawdy o kategoriach | Średni — `government` osiągalne w UI, niezapisywalne | Nie naprawiamy tutaj, ale `coverage` czerpiemy **wyłącznie** z `coverageEnum.enumValues` — bez piątego źródła |
| Zdjęcie `notNull` ze współrzędnych jest nieodwracalne | Średni — powrót wymaga backfillu | Kolejność wdrożenia: migracja → deploy → backfill; do backfillu wszystko jest `local`, czyli produkt działa jak dziś |
| Pominięcie `coverage` w `getMostPopular` | Niski — objawi się dopiero na stronie głównej | Jawnie w kryteriach akceptacji U1: **oba** zapytania |
| Reguła dedupe jako jedyna ochrona przed duplikatem | Niski, ale trwały | Komentarz przy funkcji: czwarta sekcja listy musi dopisać się do zbioru odejmowanego |

## Wymagane zasoby i zależności

- **Lokalna baza:** `docker-compose up -d` (Postgres + pgvector), migracje przez
  `npm run drizzle:push` albo `npx tsx sequential-migrate.ts`.
- **OpenAI API** — `npm run db:embeddings` dla nowych wpisów zdalnych (koszt, krok operatorski).
  Bez tego wpisy nie wyjdą w semantic search.
- **Brak `.env.e2e`** — automatyczne E2E niedostępne; scenariusze przeglądarkowe są operatorskie.
- **Sekwencjonowanie:** U4 jest niezależny i może iść równolegle z Fazą 1–2. Reszta Fazy 4
  czeka na U5. U9 czeka na U6.

## Dokumentacja do aktualizacji

- `CLAUDE.md` — po U0 usunąć wzmiankę o 2 błędach typecheck z sekcji „Znane odchylenia".
- `CLAUDE.md` — dopisać `coverage` jako drugą oś obok kategorii, żeby kolejne sesje nie
  proponowały „kategorii online".
- Po zakończeniu: `/dev-compound` — `docs/solutions/` jest dziś puste, a wzorzec „ortogonalny
  wymiar zamiast nowej wartości enuma" jest wart zapisania.
