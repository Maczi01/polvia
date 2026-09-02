# POLVIA SEO PLAN — WERSJA PROSTA DO ODHACZANIA

## Jak korzystać z tego pliku

Ten plan jest prostą checklistą do codziennej pracy.

Zasada:
- nie robię wszystkiego naraz,
- idę krok po kroku,
- najpierw buduję podstawę,
- potem dokładam kolejne typy stron.

Najważniejsze:
Polvia dalej jest katalogiem z mapą i listą.
SEO to tylko dodatkowa warstwa stron, które Google łatwiej rozumie.

---

# ETAP 1 — ZROZUMIENIE CELU

## Mój cel
Chcę, żeby Google rozumiało Polvia jako katalog firm, a nie tylko jako stronę z mapą i filtrami.

## Co zostaje bez zmian
- mapa
- lista
- filtry
- wyszukiwarka

## Co dokładam
- strony firm
- strony miast
- strony miasto + kategoria
- title i description
- linkowanie wewnętrzne
- sitemapę i podstawy technicznego SEO

---

# ETAP 2 — STRUKTURA STRON

## Typy stron, które chcę mieć

### 1. Strona główna
URL:
- `/`

Cel:
- wyjaśnić, czym jest Polvia
- pokazać najważniejsze miasta
- pokazać najważniejsze kategorie
- prowadzić do mapy i listy

### 2. Strona miasta
Przykłady:
- `/warszawa`
- `/krakow`
- `/wroclaw`

Cel:
- pokazać firmy z jednego miasta

### 3. Strona miasto + kategoria
Przykłady:
- `/warszawa/fryzjer`
- `/warszawa/prawnik`
- `/krakow/sklep-ukrainski`

Cel:
- pokazać firmy z jednej kategorii w jednym mieście

### 4. Strona firmy
Przykłady:
- `/firma/kyiv-hair-studio-warszawa`
- `/firma/legal-help-krakow`

Cel:
- pokazać jedną konkretną firmę jako osobną stronę

---

# ETAP 3 — KOLEJNOŚĆ WDROŻENIA

## Kolejność, której mam się trzymać

### Krok 1
Zrobić strony firm

### Krok 2
Zrobić strony miast

### Krok 3
Zrobić strony miasto + kategoria

### Krok 4
Dodać metadata SEO

### Krok 5
Dodać linkowanie wewnętrzne

### Krok 6
Dodać sitemapę i uporządkować indeksację

### Krok 7
Dodać schema markup

---

# ETAP 4 — PRACA Z DANYMI

## Muszę sprawdzić, czy każda firma ma

- [ ] `slug`
- [ ] `citySlug`
- [ ] `cityName`
- [ ] `categorySlug`
- [ ] `categoryName`
- [ ] `name`
- [ ] `description`
- [ ] `address` lub przynajmniej podstawowe dane kontaktowe

## Muszę też mieć listę miast
- [ ] lista miast jest spójna
- [ ] nazwy miast nie dublują się w różnych formach
- [ ] każde miasto ma slug

## Muszę też mieć listę kategorii
- [ ] lista kategorii jest spójna
- [ ] każda kategoria ma slug
- [ ] kategorie nie są pomieszane

---

# ETAP 5 — SLUGI

## Zasady slugów

### Dla miasta
Przykłady:
- `warszawa`
- `krakow`
- `wroclaw`

### Dla kategorii
Przykłady:
- `fryzjer`
- `prawnik`
- `psycholog`
- `sklep-ukrainski`

### Dla firmy
Format:
- `nazwa-firmy-miasto`

Przykłady:
- `kyiv-hair-studio-warszawa`
- `legal-help-krakow`

## Zasady ogólne
- [ ] tylko małe litery
- [ ] spacje zamienione na myślniki
- [ ] najlepiej bez polskich znaków
- [ ] slug po utworzeniu nie powinien się często zmieniać

---

# ETAP 6 — ROUTING W NEXT.JS

## Docelowa struktura folderów

```txt
app/
  page.tsx

  [city]/
    page.tsx

    [category]/
      page.tsx

  firma/
    [slug]/
      page.tsx

  mapa/
    page.tsx
```

## Co to oznacza

- [ ] `app/page.tsx` obsługuje `/`
- [ ] `app/[city]/page.tsx` obsługuje `/warszawa`
- [ ] `app/[city]/[category]/page.tsx` obsługuje `/warszawa/fryzjer`
- [ ] `app/firma/[slug]/page.tsx` obsługuje `/firma/kyiv-hair-studio-warszawa`

---

# ETAP 7 — STRONA FIRMY

## Co muszę zrobić

- [ ] stworzyć route `/firma/[slug]`
- [ ] pobierać firmę po slug
- [ ] jeśli firma nie istnieje, zwracać `notFound()`

## Co ma być na stronie firmy

- [ ] nazwa firmy
- [ ] kategoria
- [ ] miasto
- [ ] opis
- [ ] adres
- [ ] telefon
- [ ] strona www
- [ ] języki
- [ ] mapa lub lokalizacja
- [ ] podobne firmy
- [ ] link do strony miasta
- [ ] link do strony miasto + kategoria

## Kiedy uznaję etap za zrobiony
- [ ] każda firma ma własny URL
- [ ] z listy lub mapy mogę wejść na profil firmy
- [ ] strona działa poprawnie
- [ ] brakujący slug daje 404 / `notFound()`

---

# ETAP 8 — STRONA MIASTA

## Co muszę zrobić

- [ ] stworzyć route `/[city]`
- [ ] pobierać firmy z danego miasta
- [ ] jeśli miasto nie istnieje, zwracać `notFound()`

## Co ma być na stronie miasta

- [ ] H1, np. „Ukraińskie firmy w Warszawie”
- [ ] krótki opis miasta
- [ ] lista firm z miasta
- [ ] lista popularnych kategorii w mieście
- [ ] link do mapy
- [ ] linki do stron typu miasto + kategoria
- [ ] opcjonalnie FAQ

## Kiedy uznaję etap za zrobiony
- [ ] strona miasta działa
- [ ] pokazuje prawdziwe firmy
- [ ] prowadzi głębiej do kategorii
- [ ] nie istnieje dla błędnych slugów

---

# ETAP 9 — STRONA MIASTO + KATEGORIA

## Co muszę zrobić

- [ ] stworzyć route `/[city]/[category]`
- [ ] pobierać firmy z konkretnego miasta i konkretnej kategorii
- [ ] jeśli kombinacja nie istnieje albo nie ma sensu, zwracać `notFound()`

## Co ma być na stronie

- [ ] H1, np. „Ukraiński fryzjer w Warszawie”
- [ ] krótki opis
- [ ] lista firm
- [ ] przycisk „Zobacz na mapie”
- [ ] FAQ
- [ ] link do miasta
- [ ] linki do podobnych kategorii
- [ ] linki do profili firm

## Kiedy uznaję etap za zrobiony
- [ ] strona działa tylko dla sensownych kombinacji
- [ ] ma prawdziwe wyniki
- [ ] nie jest pusta
- [ ] ma linki wewnętrzne

---

# ETAP 10 — META TITLE I META DESCRIPTION

## Muszę dodać metadata dla

- [ ] homepage
- [ ] strony miasta
- [ ] strony miasto + kategoria
- [ ] strony firmy

## Przykłady

### Homepage
Title:
- `Polvia – ukraińskie firmy i usługi w Polsce`

Description:
- `Znajdź ukraińskie firmy, sklepy i usługi w Polsce. Przeglądaj katalog, listę firm i mapę.`

### Miasto
Title:
- `Ukraińskie firmy w Warszawie | Polvia`

Description:
- `Znajdź ukraińskie firmy i usługi w Warszawie. Sprawdź listę firm, kontakt i lokalizacje.`

### Miasto + kategoria
Title:
- `Ukraiński fryzjer w Warszawie | Polvia`

Description:
- `Znajdź ukraińskich fryzjerów w Warszawie. Zobacz listę firm, kontakt i lokalizacje.`

### Firma
Title:
- `Kyiv Hair Studio – fryzjer w Warszawie | Polvia`

Description:
- `Sprawdź profil firmy Kyiv Hair Studio. Zobacz opis, kontakt, adres i lokalizację.`

---

# ETAP 11 — LINKOWANIE WEWNĘTRZNE

## Co muszę połączyć linkami

### Homepage
- [ ] linki do najważniejszych miast
- [ ] linki do najważniejszych kategorii
- [ ] link do mapy
- [ ] link do dodawania firmy

### Strona miasta
- [ ] linki do stron miasto + kategoria
- [ ] linki do wybranych firm
- [ ] link do mapy

### Strona miasto + kategoria
- [ ] link do strony miasta
- [ ] linki do podobnych kategorii
- [ ] linki do profili firm
- [ ] link do mapy z odpowiednim filtrem

### Strona firmy
- [ ] link do miasta
- [ ] link do strony miasto + kategoria
- [ ] linki do podobnych firm

---

# ETAP 12 — MAPA

## Ważna zasada
Mapa zostaje.

Nie usuwam mapy.
Nie przebudowuję produktu.

## Co zmieniam
Mapa nie jest jedyną stroną, przez którą Google może wejść do katalogu.

## Docelowy model
- SEO page: `/warszawa/fryzjer`
- mapa: `/mapa?city=warszawa&category=fryzjer`

## Co sprawdzić
- [ ] ze strony SEO da się wejść do mapy
- [ ] mapa pokazuje ten sam filtr
- [ ] SEO nie opiera się tylko na mapie

---

# ETAP 13 — INDEKSACJA

## Co powinno być indeksowane
- [ ] homepage
- [ ] strony miast
- [ ] strony miasto + kategoria
- [ ] profile firm
- [ ] najważniejsze strony statyczne

## Czego raczej nie indeksować
- [ ] losowych parametrów filtrów
- [ ] pustych stron
- [ ] stron testowych
- [ ] duplikatów
- [ ] cienkich stron bez wartości

## Zasada
- [ ] nie tworzę stron SEO dla pustych kombinacji
- [ ] jeśli nie ma wyników, lepiej zrobić `notFound()`

---

# ETAP 14 — TECHNICZNE SEO

## Muszę zrobić

- [ ] canonicale
- [ ] sitemapę
- [ ] sprawdzić `robots.txt`
- [ ] upewnić się, że ważne strony nie mają `noindex`
- [ ] upewnić się, że sitemap zawiera tylko sensowne URL-e

## Co ma wejść do sitemap
- [ ] homepage
- [ ] strony miast
- [ ] strony miasto + kategoria
- [ ] profile firm

---

# ETAP 15 — SCHEMA MARKUP

## To robię później, nie na początku

## Co warto dodać
- [ ] `Organization`
- [ ] `WebSite`
- [ ] `BreadcrumbList`
- [ ] `FAQPage`
- [ ] `LocalBusiness` dla stron firm

## Ważna zasada
- [ ] schema musi odpowiadać temu, co naprawdę widać na stronie

---

# ETAP 16 — MINIMALNA WERSJA NA START

## Jeśli chcę ruszyć szybciej, robię tylko to

### Wersja minimum
- [ ] profile firm
- [ ] strony miast
- [ ] metadata dla homepage, miast i firm
- [ ] linki z listy do profili

### Wersja druga
- [ ] strony miasto + kategoria
- [ ] FAQ
- [ ] linki do mapy
- [ ] sitemap

### Wersja trzecia
- [ ] schema
- [ ] dalsze ulepszenia
- [ ] wersje językowe
- [ ] hreflang

---

# ETAP 17 — CZEGO NIE ROBIĆ

- [ ] nie generować tysięcy pustych stron
- [ ] nie indeksować przypadkowych URL-i z filtrami
- [ ] nie tworzyć stron bez realnych firm
- [ ] nie robić stron, które są prawie identyczne
- [ ] nie opierać całego SEO wyłącznie na mapie

---

# ETAP 18 — DEFINICJA „GOTOWE”

Uznaję projekt za dobrze wdrożony, gdy:

- [ ] każda firma ma własną stronę
- [ ] najważniejsze miasta mają własne strony
- [ ] najważniejsze kombinacje miasto + kategoria mają własne strony
- [ ] najważniejsze strony mają title i description
- [ ] działa linkowanie wewnętrzne
- [ ] mapa nadal działa jako produkt
- [ ] Google może zrozumieć strukturę katalogu bez klikania w filtry

---

# MÓJ NAJBLIŻSZY PLAN PRACY

## Najpierw
- [ ] przygotować slugi
- [ ] zrobić strony firm

## Potem
- [ ] zrobić strony miast

## Potem
- [ ] zrobić strony miasto + kategoria

## Potem
- [ ] dodać metadata
- [ ] dodać linkowanie
- [ ] dodać sitemapę

## Na końcu
- [ ] schema
- [ ] wersje językowe
- [ ] hreflang

---

# PROSTE PRZYPOMNIENIE KONCEPCJI

Nie buduję drugiej strony internetowej.

Biorę jeden katalog danych i pokazuję go w kilku widokach:

- homepage = czym jest Polvia
- miasto = firmy w jednym mieście
- miasto + kategoria = firmy jednej kategorii w jednym mieście
- firma = jedna konkretna firma
- mapa = interaktywny widok katalogu

To jest cały model.
