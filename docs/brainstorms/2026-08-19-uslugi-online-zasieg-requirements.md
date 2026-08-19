---
date: 2026-08-19
topic: uslugi-online-zasieg
---

# Usługi online — zasięg jako wymiar wpisu

## Problem

Polvia jest katalogiem usług dla imigrantów (głównie ukraińskojęzycznych) w Polsce, a całe
odkrywanie usług odbywa się przez mapę opartą na współrzędnych. Dla usług świadczonych zdalnie
ten model działa przeciwko użytkownikowi.

Przykład, który uruchomił temat — **fotodokarty.com.pl**: zdjęcia biometryczne na kartę pobytu
CUKR, upload selfie → plik JPG mailem w ~20 sekund, 17 zł, zasięg cała Polska. Firma ma adres
rejestrowy (Al. Solidarności 68/121, Warszawa), ale **nie ma punktu stacjonarnego**.

Pin na tym adresie robi dwie szkody naraz:

1. **Kłamie** — sugeruje „przyjdź tu", a nie ma gdzie przyjść.
2. **Ukrywa wpis przed właściwymi ludźmi** — filtr geograficzny odcina po województwie i mieście,
   więc Ukrainiec w Rzeszowie potrzebujący zdjęcia do karty pobytu nigdy tej usługi nie znajdzie.
   Mapa działa tu jako filtr wykluczający dokładnie tych, których usługa ma obsłużyć.

Mylącym wymiarem nie jest kategoria ani adres, a **zasięg**. Lokalny fryzjer ma *położenie*.
FotoDoKarty ma *zasięg = cała Polska*. Dziś system zna wyłącznie pierwsze.

Problem jest już realny, nie hipotetyczny: w `src/db/seed.ts` siedzi kilka biur rachunkowych
opisanych jako „księgowość online", „obsługa online w całej Polsce", „Remote service across
Poland" — wpisanych jako zwykłe lokalne firmy w kategorii `financial`. Podaż istnieje, produkt
jej nie wykorzystuje.

## Wymagania

- **R1.** Wpis ma zasięg w jednym z trzech stanów: `lokalna` (domyślny), `online`, `hybryda`.
  Zasięg jest niezależny od kategorii — to druga, ortogonalna oś.
- **R2.** Kategoria pozostaje **branżą**. „Online" nie staje się wartością kategorii. Prawnik
  działający zdalnie jest nadal widoczny pod filtrem „Prawne".
- **R3.** Mapa pokazuje pin wyłącznie dla wpisów, które można odwiedzić — `lokalna` i `hybryda`.
  Wpis `online` nie dostaje pinu w żadnych okolicznościach.
- **R4.** Pod wynikami lokalnymi pojawia się sekcja „Dostępne online w całej Polsce (N)",
  widoczna zawsze, niezależnie od aktywnego filtra województwa lub miasta.
- **R5.** Wpisy `online` i `hybryda` nie są odfiltrowywane przez filtr geograficzny — użytkownik
  z filtrem „Podkarpackie" widzi je bez wykonywania dodatkowej akcji.
- **R6.** Sekcja online zawiera wyłącznie wpisy, których nie ma już w liście lokalnej. Przy braku
  filtra geograficznego hybrydowe biuro z Warszawy pojawia się raz — w liście lokalnej.
- **R7.** Filtr „Online" jest dostępny w tym samym rzędzie co filtry kategorii i kombinuje się
  z kategorią: „Prawne" + „Online" → prawnicy obsługujący zdalnie.
- **R8.** Usługi online mają własne, indeksowalne adresy: `/mapa/online` oraz
  `/mapa/{kategoria}/online`. Slug `online` jest identyczny we wszystkich czterech locale.
  Adresy wchodzą do sitemapy i mają hreflang jak istniejące strony kategorii.
- **R9.** Dla wpisu `online` miasto jest wymagane; ulica i współrzędne są opcjonalne. Wpis
  prezentuje się jako „Warszawa — obsługa online całej Polski", bez ulicy i bez pinu.
- **R10.** Karta usługi `online` i `hybryda` nosi widoczne oznaczenie zasięgu („Obsługa online —
  cała Polska"), żeby użytkownik nie musiał wnioskować z opisu.
- **R11.** Mobile: gdy w widoku „mapa" nie ma żadnego wyniku z pinem (np. filtr „Online"), mapa
  pokazuje empty state kierujący do widoku listy — nie pustą mapę Polski.
- **R12.** Istniejące wpisy z `seed.ts` opisane jako zdalne/online dostają zasięg `hybryda`
  (mają realne biura i obsługują zdalnie). FotoDoKarty dostaje `online`.

## Kryteria sukcesu

- Użytkownik w Rzeszowie z filtrem „Podkarpackie" widzi FotoDoKarty bez klikania czegokolwiek.
- Żaden pin na mapie nie prowadzi pod adres, pod którym nie ma punktu obsługi klienta.
- Wpis online da się dodać bez podawania ulicy i współrzędnych — baza nie dostaje zmyślonych
  koordynatów ani centroidów miast.
- Filtr „Prawne" nadal zwraca prawnika działającego wyłącznie online.
- Hybrydowe biuro rachunkowe z Warszawy jest osiągalne dwiema drogami: jako pin dla warszawiaka
  i jako opcja zdalna dla użytkownika z Podkarpacia — ale nigdy nie pojawia się dwa razy na
  jednym ekranie.
- `/mapa/online` jest w sitemapie i ma własny `title`.

## Granice scope'u

- **Bez osobnej gałęzi route `/uslugi-online`** — rozważone i odrzucone: duplikowałoby logikę
  listy, filtrów i kart usług.
- **Bez pinów zastępczych** — żadnych centroidów województw, pinów „środek Polski" ani pinów
  o innym kształcie dla usług bez punktu obsługi.
- **Bez zasięgu regionalnego** — zasięg online oznacza „cała Polska". Wariant „obsługuję tylko
  3 województwa" jest poza scope'em.
- **Bez sekcji online na stronie głównej** — `category-preview` i inne powierzchnie strony
  głównej zostają bez zmian w tej iteracji.
- **Bez naprawy kategorii `government`** — to osobna, wcześniejsza luka (patrz Zależności).
- **Bez nowej kategorii w `categoryEnum`** — świadomie, patrz Kluczowe decyzje.

## Kluczowe decyzje

- **„Online" to wymiar zasięgu, nie kategoria**: kolumna kategorii jest jednowartościowa, więc
  `category: 'online'` zmusiłoby online prawnika do wypadnięcia z filtra „Prawne", a kafelek
  „Usługi online" zebrałby prawnika, księgową i fotografa w jeden worek — drugie `others`.
  Kafelek, o który prosił użytkownik, i tak powstaje (R7) — tylko jako filtr zasięgu.
- **Trzy stany zasięgu, nie boolean**: FotoDoKarty (brak punktu) i biuro rachunkowe z realnym
  biurem obsługujące też zdalnie to różne przypadki. Boolean zmusza do skłamania w jedną
  ze stron — albo hybryda znika z mapy, albo znika z wyników online.
- **Mapa pokazuje tylko to, co można odwiedzić**: to jedyna reguła, przy której żaden pin nie
  wprowadza w błąd, i zdejmuje potrzebę wymyślania „pinu online".
- **Sekcja zamiast wmieszania w listę**: wpis z adresem w Warszawie pośród wyników „Pomorskie"
  wygląda na bug, dopóki użytkownik nie przeczyta plakietki. Nagłówek sekcji tłumaczy sam siebie.
- **`online` w slocie lokalizacji URL**: semantycznie „prawne w całej Polsce" zamiast „prawne
  w Pomorskim". Parser zostaje przy maks. 2 segmentach — dochodzi tylko nowa dozwolona wartość.
  Query param `?online=1` odrzucony: zerowa wartość SEO na frazy typu „prawnik online dla
  Ukraińców", brak własnego canonicala, brak wpisu w sitemapie.
- **Miasto wymagane, współrzędne opcjonalne**: gdyby adres pozostał wymagany, dostawcy wpisywaliby
  zmyślone koordynaty, a fałszywe piny zostają w bazie na zawsze i są droższe do wyczyszczenia niż
  dopuszczenie `null` teraz. Miasto ma realną wartość (język obsługi, zaufanie).

## Zależności / Założenia

- **Blokada strukturalna do zniesienia:** `serviceLocationsTable.latitude` i `longitude` są dziś
  `notNull` (`src/db/schema.ts`), a `getServices()` łączy lokalizacje przez `innerJoin`
  (`src/lib/queries.ts`) — usługa bez lokalizacji jest niewidoczna wszędzie, nie tylko na mapie.
  R9 wymaga zniesienia obu ograniczeń.
- **Filtrowanie jest dziś klienckie** — po `s.voivodeship` i `s.city` w
  `services-client-component.tsx`. R5 dotyka tej samej ścieżki.
- **Luka wcześniejsza, niezależna od tego zadania:** kategoria `government` istnieje w
  `src/lib/consts.ts`, `src/lib/slug-mappings.ts` (4 locale) i `messages/*.json`, ale **nie ma jej
  w `categoryEnum`** — więc dziś nie da się jej nikomu przypisać. To najbliższa branżowo kategoria
  dla FotoDoKarty (sprawy urzędowe / karta pobytu). Do czasu naprawy FotoDoKarty ląduje w `others`.
- **Koszt dodania kategorii — dla orientacji:** enum + migracja + `consts.ts` +
  `slug-mappings.ts` ×4 locale + `messages/*.json` ×4 + ikona SVG + `mapCategoryToBadgeColor`.
- Założenie: sortowanie w sekcji online działa jak w liście lokalnej (promowane, potem klikalność).
- Założenie (R7): nazwa filtra w UI to „Online". Zmiana na „Usługi online" lub „Cała Polska"
  jest kosmetyczna i nie blokuje planowania.

## Otwarte pytania

### Do rozwiązania przed planowaniem

_(brak — wszystkie decyzje produktowe rozstrzygnięte)_

### Odroczone do planowania

- [Dotyczy R1][Techniczne] Czy zasięg należy do `services` (firma), czy do `service_locations`
  (punkt)? Firma z dwoma biurami i obsługą zdalną rozstrzyga tę kwestię.
- [Dotyczy R9][Techniczne] Zakres skutków `latitude`/`longitude` jako nullable: `getServices`
  (`innerJoin` → `leftJoin`), typ `Service` w `src/types/index.ts`, `createPoints` w
  `overview-map/utility.ts`, walidacja Zod w `_actions.ts` dashboardu, formularz `service-form.tsx`.
- [Dotyczy R8][Techniczne] Walidacja `online` w slocie lokalizacji: `parseMapSlug`,
  `buildMapUrl`, `isValidCountySlug` — oraz co zrobić z `/mapa/online/{wojewodztwo}`
  (sprzeczna kombinacja, prawdopodobnie 301 na `/mapa/online`).
- [Dotyczy R4][Techniczne] Czy wyszukiwanie semantyczne (embeddingi, `/api/services`) respektuje
  zasięg i zasila sekcję online, czy działa tylko na liście lokalnej.
- [Dotyczy R8][Wymaga researchu] Czy `/mapa/{kategoria}/online` wchodzi do sitemapy, czy zostaje
  pominięte jak pozostałe kombinacje kategoria+lokalizacja (dziś świadomie wykluczone jako
  thin content).
- [Dotyczy R9][Techniczne] `serviceLocationsTable.openingHours` jest `notNull` — dla usługi w pełni
  zdalnej godziny otwarcia nie mają sensu. Czy pole staje się opcjonalne, czy dla zasięgu `online`
  karta pokazuje w tym miejscu coś innego (np. czas realizacji).
- [Dotyczy R12][Wymaga researchu] Przegląd `seed.ts` — które konkretnie wpisy kwalifikują się
  jako `hybryda` na podstawie opisów.

## Następne kroki

→ `/dev-plan` do planowania technicznego implementacji
