---
name: dodaj
description: "Dodawanie nowego wpisu (firmy, punktu) do katalogu polvia — research z URL-a firmy albo z dyktowania, klasyfikacja kategorii i zasiegu, opisy pl/uk/en/ru, wspolrzedne, plik JSON w data/services/ i zapis do bazy przez npm run db:add. Wywoluj przez /dodaj [URL albo nazwa firmy]."
argument-hint: "[URL firmy albo nazwa]"
---

# Dodaj wpis do katalogu

Skill prowadzi od surowego wejscia (URL firmy albo kilka zdan od usera) do wiersza w zywej bazie.

**Nadrzedna zasada: nie wymyslaj danych.** Godziny otwarcia, NIP, telefon i adres albo pochodza ze
zrodla (strona firmy, wiadomosc od usera), albo nie ma ich w JSON-ie. Wpis z wymyslonymi godzinami
jest gorszy niz wpis bez godzin — user przyjedzie pod zamkniete drzwi.

## Zmienne

- WEJSCIE: $1 (URL firmy albo nazwa; moze byc puste)

## Co powstaje

| Artefakt | Gdzie |
|---|---|
| Opis wpisu | `data/services/<slug>.json` — zostaje w repo, widac go w diffie |
| Wiersze w bazie | `services`, `services_translations`, `service_locations`, `services_tags` |
| Embedding | dorabiany przez `npm run db:embeddings` po zapisie |

Cala mechanika zapisu siedzi w `src/db/add-service.ts`; walidacja i slugi w
`src/db/service-input-schema.ts`. **Nie pisz nowego skryptu `add-<nazwa>.ts`** — ta era sie
skonczyla, opis wpisu jest danymi.

## Faza 1: Zebranie faktow

Jesli WEJSCIE to URL — pobierz strone glowna oraz podstrony typu `/kontakt`, `/o-nas`, `/oferta`.
Jesli WEJSCIE to sama nazwa albo jest puste — zapytaj o URL. Gdy firma nie ma strony, zbieraj
dane od usera pytaniami, po kolei, nie wszystkie naraz.

Do wypelnienia:

| Pole | Wymagane | Skad |
|---|---|---|
| `name` | tak | nazwa handlowa, tak jak pisze ja firma |
| `category` | tak | patrz `references/klasyfikacja.md` |
| `coverage` | tak | patrz `references/klasyfikacja.md` — to NIE jest kategoria |
| `city` | tak | miasto punktu obslugi (dla `online`: miasto siedziby) |
| `latitude` / `longitude` | tak, poza `online` | Faza 2 |
| `street`, `postcode`, `voivodeship` | mocno zalecane | strona, stopka, wizytowka Google |
| `openingHours` | zalecane | pomijaj dni nieczynne; nie zgaduj |
| `phoneNumber`, `email`, `webpage` | zalecane | stopka / kontakt |
| `nip` | opcjonalne | 10 cyfr, bez mysnikow |
| `socials` | opcjonalne | pelne URL-e z `https://` |
| `languages` | tak | jezyki OBSLUGI klienta, nie jezyki strony |
| `tags` | zalecane | 3-5 sztuk, cztery jezyki kazdy |
| `translations` | tak | Faza 4 |

Przy kazdym fakcie zapamietaj zrodlo. Fakt bez zrodla przedstaw userowi jako do potwierdzenia,
nie wpisuj go po cichu.

## Faza 2: Wspolrzedne

`MAPBOX_TOKEN` w `.env` jest **pusty** — nie probuj Mapbox Geocoding. Uzyj Nominatim (OSM):

```bash
curl -s --get "https://nominatim.openstreetmap.org/search" \
  -H "User-Agent: polvia-katalog/1.0" \
  --data-urlencode "q=<ulica i numer>, <miasto>" \
  --data-urlencode "countrycodes=pl" \
  --data-urlencode "format=jsonv2" --data-urlencode "limit=1" --data-urlencode "addressdetails=1"
```

Odpowiedz daje `lat`, `lon`, a w `address` takze `postcode` i `state` (wojewodztwo) — wykorzystaj
je do uzupelnienia pol, ale tylko gdy zgadzaja sie z adresem ze strony.

Weryfikacja, zanim wpiszesz do JSON-a:

1. `display_name` musi zawierac to miasto, o ktore chodzi. Nominatim potrafi trafic w inna
   miejscowosc o tej samej nazwie ulicy.
2. Jesli geokoder zgubil numer budynku (zwrocil sama ulice), pin bedzie przesuniety o kilkaset
   metrow. Powiedz to userowi wprost i zapytaj, czy ma dokladniejsze wspolrzedne.
3. Gdy firma linkuje wlasna wizytowke Google Maps, wspolrzedne z linku (`!3d<lat>!4d<lng>`) sa
   dokladniejsze niz geokodowanie adresu — uzyj ich.
4. Polska to mniej wiecej `lat 49-55`, `lng 14-24`. Wynik poza tym zakresem oznacza blad, nie
   egzotyczna lokalizacje.

Dla `coverage: "online"` wspolrzedne pomijasz — wpis nie ma pinu i tak.

## Faza 3: Klasyfikacja

Przeczytaj `references/klasyfikacja.md` i wybierz `category`, `coverage`, `tags`, `languages`.
Klasyfikacje pokaz userowi w Fazie 7 razem z uzasadnieniem jednym zdaniem — to pole, w ktorym
najlatwiej o cicha pomylke, a poprawka po zapisie wymaga UPDATE-a recznie.

## Faza 4: Opisy pl / uk / en / ru

Wszystkie cztery sa wymagane (schemat odrzuci brak). Zasady:

- 300-600 znakow. Konkret: co firma robi, gdzie, czym sie wyroznia, w jakich jezykach obsluguje,
  czy dowozi i w jakim czasie.
- To **lokalizacja, nie tlumaczenie slowo w slowo**. Wersje `uk` i `ru` czyta klient, dla ktorego
  to jest jezyk pierwszy — pisz naturalnie, nie kalkuj polskiej skladni.
- Zero marketingowej waty ("najlepszy", "lider rynku"), zero cen i obietnic terminow, ktorych nie
  ma w zrodle.
- Nazwy wlasne i marki zostaja w oryginale.

## Faza 5: Obrazek

Karta uzywa `public/services/<plik>`, a `service-card.tsx` podstawia `/default.png` **tylko** gdy
kolumna `image` jest NULL. Nazwa pliku bez pliku na dysku = 404 zamiast grafiki zastepczej.

- Masz plik: wrzuc do `public/services/<slug>.png` i podaj sama nazwe pliku w JSON.
- Nie masz: zostaw `"image": null`. Runner i tak sprawdza istnienie pliku i ostrzega.
- Pobranie logo ze strony firmy zaproponuj userowi, ale nie rob tego bez jego zgody.

## Faza 6: Plik JSON

Zapisz `data/services/<slug>.json` wzorem z `references/wpis-template.json`.

Schemat jest `strict` — nieznany klucz to blad walidacji, nie ciche pominiecie. To celowe:
`"lat"` zamiast `"latitude"` kiedys skonczyloby sie wpisem bez pinu. Nie dopisuj wiec pol "na
wszelki wypadek" i nie zmieniaj nazw kluczy.

Kilka punktow tej samej firmy to **jeden plik z tablica `locations`** — jeden wpis w `services`,
wiele wierszy w `service_locations`. Slugi wylicza runner: `<slug-firmy>-<slug-miasta>`, z numerem
na koncu gdy w jednym miescie jest wiecej niz jeden punkt.

## Faza 7: Dry run i STOP

```bash
npm run db:add -- data/services/<slug>.json --dry-run
```

Dry run waliduje plik, sprawdza kolizje slugow, mowi ktore tagi powstana jako nowe i czy obrazek
istnieje — **nie zapisuje nic**.

Pokaz userowi:

- wyjscie dry runu,
- kategorie i zasieg z jednozdaniowym uzasadnieniem,
- cztery opisy w calosci,
- liste pol, ktorych nie udalo sie potwierdzic (czyli tych pustych).

**Zatrzymaj sie i czekaj na wyrazne OK.** Nie zapisuj do bazy na podstawie domyslu.

Gdy dry run zglosi kolizje slugu — to duplikat. Nie obchodz tego, zmieniajac `slug`, dopoki user
nie potwierdzi, ze to faktycznie inna firma pod podobna nazwa.

## Faza 8: Zapis i weryfikacja

Po OK, po kolei:

```bash
npm run db:add -- data/services/<slug>.json
npm run db:embeddings
```

Potem sprawdz wpis w aplikacji. Sciezka mapy przyjmuje **najwyzej dwa segmenty**
(`{kategoria}/{powiat|miasto|online}`) — nie ma segmentu na wpis. Do konkretnej karty prowadzi
query param `place`:

```
/mapa/<slug-kategorii-pl>?place=<slug-lokalizacji>
```

Slug kategorii bierze sie ze `src/lib/slug-mappings.ts` (np. `beauty` → `uroda`, `health` →
`zdrowie`), a URL buduje `buildServiceUrl` w `src/lib/map-url-builder.ts`.

**Nie weryfikuj samym kodem HTTP.** Trzeci segment (`/mapa/prawne/<slug-lokalizacji>`) nie jest
404 — `src/middleware.ts` odbija go przez 307 na `/mapa`, wiec `curl -L` pokazuje 200 i wpis,
ktory nigdy nie trafil do bazy, wyglada na dodany. Mierz status **bez** `-L`
(`curl -s -o /dev/null -w '%{http_code} %{redirect_url}'`) i dodatkowo znajdz nazwe wpisu
w HTML-u. Uwaga: `place` steruje stanem po stronie klienta, wiec lista kategorii renderuje ten
sam SSR z nim i bez niego — grep po nazwie potwierdza, ze wpis jest w bazie i w wynikach, a nie
ze karta sie otwiera. To ostatnie sprawdz w przegladarce.

Jesli dev server nie chodzi, uruchom go dopiero teraz i tylko jeden — rownolegly `npm run build`
nadpisuje ten sam `.next` i wszystkie strony zaczynaja zwracac 500. `TaskStop` ubija opakowanie
`npx`, ale potrafi zostawic zywy proces Next: zanim uznasz port za wolny, sprawdz
`Get-NetTCPConnection -State Listen -LocalPort <port>`. Drugi `next dev` na zajetym porcie
wywala sie na `EADDRINUSE` juz po naruszeniu `.next` — wtedy stary serwer zwraca 500 i pomiary
sa bezwartosciowe.

Zglos userowi: id wpisu, slugi, URL do sprawdzenia, tagi utworzone jako nowe.

Plik `data/services/<slug>.json` zostaje w repo jako slad tego, co poszlo do bazy.
**Nie commituj go, dopoki user o to nie poprosi.**

## Wpis premium

Tresc strony premium (szablon, cover, galeria, cennik, FAQ, oceny) to blok `premium` w **tym samym**
pliku `data/services/<plik>.json`, co wpis. Model jest concierge (R17): firma nie ma panelu,
founder publikuje tresc za nia. Wpis musi juz istniec w bazie (`db:add`). Tresc przetrwa
`db:reset` (seed czyta bloki `premium`) i zostaje w bazie po wygasnieciu subskrypcji.

Po kolei:

1. **Weryfikacja, ze placi wlasciciel.** Porownaj dane z platnosci (Stripe albo przelew: e-mail, NIP z faktury)
   z danymi wpisu: domena e-maila = domena `webpage`, NIP = `nip` wpisu, albo potwierdzenie
   z kontaktu podanego we wpisie (telefon, e-mail ze strony firmy). Brak zgodnosci = **stop**:
   nie publikuj, zglos userowi do zwrotu platnosci. Nie publikuj na podstawie domyslu.
   **Blok `premium` dopisuj do JSON-a dopiero po tej weryfikacji** — seed (`db:reset`)
   publikuje kazdy blok `premium` z `data/services/` bez pytania, takze szkic niezweryfikowanej
   firmy.
2. **Zdjecia do `public/services/<slug-uslugi>/`**, gdzie `<slug-uslugi>` to adres profilu
   `/firma/<slug-uslugi>` (wypisuje go dry run). W JSON-ie podawaj **sama nazwe pliku**
   (`cover.jpg`), bez sciezki — schemat odrzuca `/` i `..`. Formaty: jpg, png, webp, avif.
   Nazwa w JSON-ie musi zgadzac sie z plikiem **co do wielkosci liter** (`Cover.JPG` przy
   `cover.jpg` to brak pliku — Vercel rozroznia wielkosc liter, Windows nie). Pliki galerii
   nie moga sie powtarzac. Galeria: najwyzej `PREMIUM_GALLERY_MAX` (15) zdjec. Brak pliku
   przerywa publikacje z lista brakujacych — strona nigdy nie dostaje martwego obrazka.
   **Katalog zalezy od slugu uslugi w bazie, nie od nazwy pliku JSON.** Slug z sufiksem
   (`salon-roza-2`, przy duplikacie nazwy) moze sie zmienic po `db:reset`, jesli zmieni sie
   kolejnosc wpisow w seedzie — wtedy seed przerwie sie na `IMAGES_MISSING`. Przed
   `db:reset` sprawdz, czy slugi uslug premium sie nie zmienia (albo przenies katalog).
3. **Blok `premium` w JSON-ie**, kazdy tekst w czterech jezykach (`pl`, `uk`, `en`, `ru`):

   ```json
   "premium": {
     "template": "gallery",
     "coverImage": "cover.jpg",
     "gallery": [{ "file": "wnetrze.jpg", "alt": { "pl": "…", "uk": "…", "en": "…", "ru": "…" } }],
     "priceList": [{ "name": { "pl": "…", … }, "price": { "pl": "od 80 zl", … }, "note": { … } }],
     "faq": [{ "q": { "pl": "…", … }, "a": { "pl": "…", … } }],
     "ratings": [
       { "source": "google", "rating": 4.8, "count": 126, "url": "https://maps.app.goo.gl/…" },
       { "source": "other", "label": "Oferteo", "rating": 5, "count": 12, "url": "https://…" }
     ]
   }
   ```

   `template`: `gallery` | `professional` | `classic`. `coverImage`, `gallery`, `priceList`,
   `faq` i `note` sa opcjonalne. Ceny to tekst od firmy — nie wymyslaj ich ani nie przeliczaj.
   Limity: cennik najwyzej `PREMIUM_PRICE_LIST_MAX` (30) pozycji, FAQ najwyzej
   `PREMIUM_FAQ_MAX` (20) pytan. Nazwy w cenniku i pytania FAQ nie moga sie powtarzac w
   zadnym jezyku.

   **`ratings` (opcjonalne) — oceny z innych serwisow, wpisywane recznie.** `source`:
   `google` | `booksy` | `facebook` | `znanylekarz` | `other` (`other` wymaga `label` z nazwa
   serwisu; przy znanych serwisach `label` jest zabronione). `rating` 0–5 (np. `4.8`), `count`
   liczba opinii (calkowita, ≥ 0), `url` tylko `https://` — link do profilu firmy w tym
   serwisie. Jeden wpis na serwis, najwyzej `PREMIUM_RATINGS_MAX` (6). Wartosci przepisz z
   profilu firmy w dniu publikacji (albo od firmy) — nie zaokraglaj w gore i nie wymyslaj.
   Oceny nie odswiezaja sie same: przy przedluzeniu premium zaktualizuj je tym samym
   `db:premium`. Nie trafiaja do JSON-LD (`aggregateRating`) — to celowe.
4. **Dry run i STOP:**

   ```bash
   npm run db:premium -- data/services/<plik>.json --dry-run
   ```

   Pokazuje profil, ktorego dotyczy tresc, i diff wzgledem bazy (`+` nowe, `-` usuniete, `~`
   zmienione). Pokaz userowi wyjscie i caly blok `premium`. **Czekaj na wyrazne OK.**
5. **Publikacja** po OK:

   ```bash
   npm run db:premium -- data/services/<plik>.json
   ```

   Upsert jest idempotentny — poprawki w JSON-ie publikujesz ta sama komenda. Zdjecia w
   `public/` trafiaja na produkcje dopiero z deployem: zglos userowi, ze trzeba je zacommitowac.

Strona pokazuje szablon premium tylko przy aktywnym premium: subskrypcji Stripe **albo**
premium recznym (`activeUntil`). Sama tresc w bazie niczego nie wlacza.

### Premium reczne (przelew) — `premium.activeUntil`

Platnosci online sa wylaczone, dopoki w Vercelu nie ma zmiennych `STRIPE_*`; wtedy „Przejdz na
Premium” prowadzi do formularza kontaktowego (temat „Premium”, slug firmy w wiadomosci).

- **Kiedy ustawiac:** dopiero po otrzymaniu przelewu (i weryfikacji wlasciciela z kroku 1 —
  dane z przelewu zamiast danych ze Stripe). Nie ustawiaj „na zapas” przed wplata.
- **Format:** `"activeUntil": "2026-11-30"` w bloku `premium` — ostatni dzien premium,
  **wlacznie**, w strefie Europe/Warsaw (wygasa o polnocy czasu polskiego po tym dniu, samo,
  bez crona). Data musi istniec w kalendarzu (`2026-02-30` odrzuci walidacja).
- **Publikacja:** ten sam dry run i `npm run db:premium -- data/services/<plik>.json`. Diff
  pokazuje zmiane daty (`~ premium reczne: … -> …`). Zapis ustawia
  `service_profiles.manual_premium_until` i podbija ranking (`promoted_services`) do konca tej
  daty — dluzszej istniejacej daty rankingu nie skraca.
- **Przedluzenie:** nowa data w JSON-ie + ponownie `db:premium` (dry run, OK, zapis).
- **Wylaczenie przed czasem:** usun `activeUntil` i opublikuj — widok premium i alias znikna od
  razu, ale pozycja w rankingu zostaje do starej daty (zapis nigdy nie usuwa promocji). Skrocenie
  rankingu to reczna zmiana `promoted_services` przez operatora.
- Seed (`db:reset`) odtwarza date z JSON-a, wiec **plik jest zrodlem prawdy** — data wpisana
  tylko w bazie zniknie.

## Czego nie robic

- Nie uzywaj `npm run db:reset` — kasuje cala baze. Runner dopisuje wpis do dzialajacej bazy.
- Nie uzywaj `drizzle:generate` (snapshoty w `drizzle/` sa rozjechane). Ten skill i tak nie
  zmienia schematu.
- Nie dodawaj `online` jako wartosci `category` — zasieg to osobna kolumna.
- Nie wypelniaj brakow "sensownymi" wartosciami domyslnymi. Puste pole jest uczciwe.
