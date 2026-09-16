# Klasyfikacja wpisu: kategoria, zasieg, tagi, jezyki

## Dwie niezalezne osie

`category` mowi **co firma robi**. `coverage` mowi **jak obsluguje klienta**. To dwie osobne
kolumny i dwa osobne filtry — wpis jest zawsze w dokladnie jednej kategorii i ma dokladnie jeden
zasieg.

Kategoria jest jednowartosciowa, wiec `online` nigdy nie jest kategoria: prawnik obslugujacy
zdalnie musialby wtedy zniknac z filtra "Prawne".

## `category` — 14 wartosci

Opisy pochodza z `CATEGORY_CONTEXTS` w `src/db/generate-embeddings.ts` — to ten sam tekst, ktory
trafia do embeddingu, wiec kategoria wplywa takze na wyszukiwarke semantyczna.

| Wartosc | Slug PL (URL) | Co obejmuje |
|---|---|---|
| `grocery` | `spozywcze` | sklepy spozywcze, markety, osiedlowe, delikatesy |
| `gastronomy` | `gastronomia` | restauracje, kawiarnie, catering, jedzenie na wynos |
| `transport` | `transport` | przewozy, przeprowadzki, kurierzy, taxi, logistyka |
| `financial` | `finansowe` | ksiegowosc, ubezpieczenia, kredyty, doradztwo finansowe |
| `renovation` | `remonty` | budowlanka, wykonczenia, hydraulika, elektryka, ekipy |
| `law` | `prawne` | kancelarie, radcowie, legalizacja pobytu, tlumaczenia przysiegle |
| `beauty` | `uroda` | fryzjer, paznokcie, kosmetyczka, brwi, barber, SPA |
| `health` | `zdrowie` | lekarze, dentysci, fizjoterapia, psycholog, apteka |
| `mechanics` | `mechanik` | warsztaty, wulkanizacja, blacharstwo, serwis maszyn |
| `real_estate` | `nieruchomosci` | posrednicy, wynajem, zarzadzanie najmem |
| `help_support` | `pomoc-i-wsparcie` | fundacje, pomoc socjalna, wsparcie dla uchodzcow, doradztwo |
| `education` | `edukacja` | szkoly jezykowe, korepetycje, kursy, przedszkola, zlobki |
| `it` | `it-i-komputery` | strony, sklepy online, SEO, hosting, AI, serwis komputerow |
| `others` | `inne` | wszystko, co nie miesci sie wyzej (np. kwiaciarnia, pralnia) |

Zasady wyboru:

1. Wybieraj po **glownym zrodle przychodu**, nie po najciekawszej uslugze z oferty. Warsztat,
   ktory przy okazji sprzedaje opony, to `mechanics`, nie `grocery`.
2. `others` to swiadoma decyzja, nie schronienie przy watpliwosci. Zanim je wybierzesz, przejrzyj
   liste jeszcze raz.
3. Slug PL z tabeli sluzy do zbudowania URL-a do weryfikacji. Pelna mapa (takze en/ru/uk) jest
   w `src/lib/slug-mappings.ts`.

> `CATEGORY_SLUGS` zawiera dodatkowo `government: 'urzedowe'`, ale takiej wartosci **nie ma**
> w `categoryEnum` w `src/db/schema.ts`. Nie proboj jej uzyc — walidacja ja odrzuci.

## `coverage` — zasieg

| Wartosc | Znaczenie | Pin na mapie | Wspolrzedne |
|---|---|---|---|
| `local` | obsluga wylacznie na miejscu | tak | wymagane |
| `online` | obsluga wylacznie zdalna, brak punktu obslugi | nie | opcjonalne |
| `hybrid` | punkt obslugi **oraz** obsluga zdalna | tak | wymagane |

**Regula, o ktora najlatwiej sie potknac:** sekcja online w `splitServicesByCoverage`
(`src/lib/service-coverage.ts`) **nie ma filtra geograficznego**. Wpis `hybrid` albo `online`
zobaczy uzytkownik w calej Polsce.

Konsekwencje:

- Kwiaciarnia dowozaca wylacznie po Warszawie to `local`, mimo ze "dowozi". Jako `hybrid`
  pokazalaby sie uzytkownikowi w Gdansku, ktory nic z niej nie ma.
- Kancelaria prowadzaca sprawy zdalnie dla calego kraju i majaca biuro to `hybrid`.
- Web studio bez punktu obslugi to `online` — nawet jesli ma adres siedziby. Miasto podajesz
  (jest wymagane), wspolrzedne pomijasz.
- `online` dopuszcza tylko jedna lokalizacje. Kilka punktow oznacza, ze wpis jest `hybrid`.

Kryterium rozstrzygajace: **czy klient moze tam przyjsc i zostac obsluzony?** Jesli tak i to
jedyna droga — `local`. Jesli tak i dziala tez zdalnie dla calego kraju — `hybrid`. Jesli nie —
`online`.

## `tags`

- 3-5 tagow. Kazdy w czterech jezykach (`pl`, `uk`, `en`, `ru`) — struktura pliku tego pilnuje.
- Tag opisuje **konkretna usluge albo produkt**, wezej niz kategoria: "Bukiety", "Legalizacja
  pobytu", "Manicure hybrydowy", "Wymiana opon".
- Nie powtarzaj kategorii ani miasta w tagu.
- Runner dopasowuje tagi po **polskiej nazwie**: taki sam `pl` to ten sam tag, ponownie uzyty.
  Dlatego trzymaj sie form juz obecnych w bazie zamiast wymyslac wariant ("Manicure" vs
  "Manicure i pedicure"). Dry run pokazuje, ktore tagi powstana jako NOWE — jesli tag, ktory
  powinien juz istniec, jest oznaczony jako nowy, prawdopodobnie masz literowke albo inna odmiane.

## `languages`

Jezyki, w ktorych firma **obsluguje klienta**, nie jezyki jej strony. Kody: `pl`, `uk`, `en`,
`ru`. Domyslnie `["pl"]`. Nie dopisuj `uk`/`ru` z checi zwiekszenia zasiegu wpisu — to jedna
z tych informacji, przez ktore uzytkownik dzwoni i nie moze sie dogadac.
