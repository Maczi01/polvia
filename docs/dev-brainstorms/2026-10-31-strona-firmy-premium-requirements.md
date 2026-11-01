---
date: 2026-10-31
topic: strona-firmy-premium
---

# Strona firmy: darmowy profil + Premium w subskrypcji

## Problem

Firma w katalogu polvia nie ma dziś własnej strony. Istnieje tylko jako karta na liście i pin na mapie. Z tego wynikają trzy rzeczy:

- **Nie ma czego sprzedać.** Cennik `/pricing` obiecuje płatny plan „Profesjonalny” (19 €/mies. albo 69 €/rok), ale nic za nim nie stoi i nie ma jak za niego zapłacić.
- **Wpisy nie są indeksowane osobno.** Ruch z wyszukiwarki na frazy typu „[nazwa firmy]” albo „[usługa] [miasto]” nie trafia na polvia.
- **Outreach nie ma linku.** SOP przejmowania wizytówek (`develop-strategy/Mechanizm Przejmowania Wizytówek.md`) zakłada wysłanie firmie linku do jej wizytówki, a takiej wizytówki nie ma.

Cel: każda firma dostaje darmowy profil. Płatna subskrypcja zamienia go w atrakcyjną stronę firmową, którą właściciel chętnie podlinkuje w bio na Instagramie i na wizytówce. Premium ma zachęcać wyglądem i wyraźną różnicą względem wersji darmowej.

## Wymagania

**Darmowy profil (dla każdego aktywnego wpisu)**
- R1. Każdy aktywny wpis ma własną, indeksowaną stronę pod stałym adresem w formacie `polvia.pl/firma/<nazwa>`. Pozostałe locale używają prefiksu (`/en/…`, `/ru/…`, `/uk/…`). Adres nie zmienia się przy kupnie ani rezygnacji z premium.
- R2. Darmowy profil pokazuje dane, które wpis już ma: nazwę, logo, opis w języku strony, kategorię, zasięg, adres z mapą (tylko wpisy z punktem obsługi), języki obsługi i tagi. Pokazuje też wszystko, co dziś pokazuje karta: kontakt, godziny otwarcia, WWW, social media, WhatsApp i Telegram.
- R3. Darmowy profil ma sekcję „Podobne firmy” z wpisami z tej samej kategorii.
- R4. Darmowy profil ma widoczny przycisk „To moja firma — ulepsz stronę”, który prowadzi do zakupu premium dla tego konkretnego wpisu.
- R5. Karta na liście i popup na mapie linkują do profilu firmy.
- R6. Profile są w mapie strony i mają metadane do wyszukiwarek (tytuł, opis, podgląd przy udostępnianiu) we wszystkich czterech locale.

**Premium (plan „Profesjonalny”)**
- R7. Firma z aktywną subskrypcją ma do wyboru jeden z trzech szablonów strony. Szablony pokazują te same dane, ale z innym naciskiem:
  - **Galeria** — duże zdjęcia; dla beauty, remontów i gastro.
  - **Profesjonalny** — oszczędny układ z usługami i FAQ na pierwszym planie; dla prawników, księgowych i lekarzy.
  - **Klasyczny** — zbalansowana wizytówka.
- R8. Premium dodaje zdjęcie w nagłówku strony (cover) i galerię zdjęć. Limit galerii ustala planowanie; punkt odniesienia z `monetyzacja.md` to 15 zdjęć.
- R9. Premium dodaje bogatszą treść: listę usług z cenami i FAQ. Godziny otwarcia, link WWW, social media i przyciski WhatsApp/Telegram **nie** są atutem premium. Karta na mapie pokazuje je dziś każdemu wpisowi, więc darmowy profil (R2) też je pokazuje. Decyzja z `/dev-plan` z 2026-10-31.
- R10. Na stronie premium nie ma sekcji „Podobne firmy” (R3), więc strona nie poleca konkurencji.
- R11. Premium dostaje krótki adres `polvia.pl/<nazwa>`, który przekierowuje na adres główny z R1. Krótki adres nie może kolidować z istniejącymi trasami serwisu ani z prefiksami locale. Po wygaśnięciu premium krótki adres przestaje działać.
- R12. Wpisy premium są wyżej na liście wyników i w swojej kategorii. Obiecuje to dzisiejszy cennik.
- R13. Treść premium (opis, usługi, FAQ) jest dostępna we wszystkich czterech locale, tak jak dzisiejsze opisy wpisów.

**Zakup, rozliczenia i cykl życia**
- R14. Przycisk z R4 oraz przycisk w `/pricing` prowadzą do checkoutu operatora płatności. Checkout jest powiązany z konkretnym wpisem i obsługuje subskrypcję miesięczną i roczną. Firma spoza katalogu najpierw dodaje wpis przez `/add-business`.
- R15. Faktury i odnowienia obsługuje automatycznie operator płatności. Founder nie fakturuje i nie windykuje ręcznie.
- R16. Po opłaceniu firma trafia na formularz, w którym przesyła materiały: zdjęcia, cennik, godziny, FAQ, linki i wybrany szablon. Founder dostaje powiadomienie.
- R17. Model concierge: founder weryfikuje, że płaci właściciel firmy, i publikuje treść premium. Firma nie ma konta ani panelu edycji. Zmiany treści zgłasza founderowi.
- R18. Gdy subskrypcja wygasa albo płatność ostatecznie nie przechodzi, strona automatycznie wraca do darmowego profilu, bez udziału foundera. Treść premium zostaje zachowana (ukryta) i wraca po wznowieniu subskrypcji.
- R19. Cennik `/pricing` jest przepisany tak, żeby plan „Profesjonalny” obiecywał dokładnie to, co dostarcza R7–R12. Obietnice bez pokrycia znikają: wyszukiwarka semantyczna jako atut, powitanie w social mediach, promocje. Znika też link WWW i social media jako atut premium, bo to dostaje każdy (R2).

## Kryteria sukcesu

- **Główne:** co najmniej 5 płacących firm w ciągu 3 miesięcy od uruchomienia. Mniej oznacza, że przed inwestowaniem w samoobsługę trzeba zmienić ofertę.
- Każdy aktywny wpis ma działający, zaindeksowany profil. Link do profilu da się wysłać w outreachu.
- Wygasła subskrypcja wraca do darmowego profilu bez ręcznej interwencji (R18).
- Founder publikuje stronę premium z otrzymanych materiałów w czasie zbliżonym do dzisiejszego `/dodaj`.

## Granice scope'u

- Brak kont firm, logowania i samoobsługowego panelu edycji. To naturalny następny krok, jeśli kryterium sukcesu zostanie spełnione.
- Brak automatycznego przejmowania wizytówek (e-mail w domenie, SMS, bot IG/TG). Własność weryfikuje founder ręcznie przy publikacji (R17).
- Brak statystyk i raportów dla firm (wyświetlenia, kliknięcia).
- Brak wyboru koloru marki i własnej domeny firmy. Są tylko trzy szablony.
- Plan „Przedsiębiorstwo” i model VIP/lead gen z `monetyzacja.md` są poza zakresem. „Przedsiębiorstwo” zostaje w cenniku jako „do ustalenia / kontakt”.
- Brak ukrywania lub opóźniania danych kontaktowych na darmowym profilu (pomysł z `monetyzacja.md`). Darmowy profil pokazuje kontakt tak jak dziś.

## Kluczowe decyzje

- **Darmowy profil dla wszystkich, a premium jako jego ulepszenie.** Strona tylko dla płacących oznacza zero korzyści SEO dla ponad 95% wpisów i brak linku do outreachu. Ulepszenie czegoś, co firma już widzi, łatwiej sprzedać niż coś, czego nie zna.
- **Stały adres `/firma/<nazwa>` i krótki adres jako atut premium.** Unika kolizji z `/blog`, `/mapa`, `/pricing` i prefiksami locale. Zmiana adresu przy kupnie lub rezygnacji kosztowałaby pozycje w Google.
- **Concierge zamiast samoobsługi.** Najkrótsza droga do weryfikacji popytu przy jednoosobowej obsłudze. Auth, panel i moderacja to duża budowa, którą warto robić dopiero po dowodzie, że firmy płacą.
- **Automatyczne rozliczenia mimo ręcznej treści.** Odnowienia i wygasanie są powtarzalne i pilnowanie ich ręcznie się nie skaluje. Publikacja treści jest rzadka i zostaje ręczna.
- **Szablony różnią się układem, nie kolorem.** Różnica między opcjami ma być widoczna i dopasowana do typu firmy. Wybór koloru mnoży kombinacje do dopracowania.
- **Premium to dotychczasowy plan „Profesjonalny”.** Jeden płatny plan, a cennik obiecuje tylko to, co działa.
- **„Bez konkurencji” jako atut sprzedażowy.** Kosztuje tyle co ukrycie jednej sekcji, a daje argument „na Twojej stronie nie polecamy innych”.

## Zależności / Założenia

- Wpis online-only (bez punktu obsługi) ma profil bez mapy. Szablony muszą działać bez lokalizacji.
- Treść premium tłumaczy founder na cztery locale, tak jak robi to dziś `/dodaj`.
- Zakup przez osobę, która nie jest właścicielem wpisu, wyłapuje founder przy publikacji (R17). Taka płatność jest zwracana, a treść nie jest publikowana.

## Otwarte pytania

### Do rozwiązania przed planowaniem

(brak)

### Odroczone do planowania

- [Dotyczy R14, R19][Decyzja użytkownika] Ostateczna cena i waluta. Dzisiejsze 19 €/mies. i 69 €/rok są niespójne (rok to mniej niż 4 miesiące), a rynek jest polski. Sprawdzić, czy ceny w zł z `monetyzacja.md` (149 zł) nie są lepszą kotwicą.
- [Dotyczy R14, R15][Wymaga researchu] Wybór operatora płatności. Wymagania: subskrypcje, faktury VAT dla firm w PL, BLIK (np. Stripe albo Przelewy24).
- [Dotyczy R18][Decyzja użytkownika] Okres karencji po nieudanej płatności, zanim strona wróci do free (np. ile ponowień próbuje operator).
- [Dotyczy R1, R11][Techniczne] Generowanie nazwy w adresie, obsługa kolizji nazw (dwie firmy o tej samej nazwie) i lista nazw zarezerwowanych dla krótkiego adresu.
- [Dotyczy R8, R16][Techniczne] Przechowywanie i optymalizacja zdjęć (obecnie loga są plikami w repo) oraz limity rozmiaru.
- [Dotyczy R3][Techniczne] Dobór „Podobnych firm”: ta sama kategoria; czy preferować to samo miasto i ile pozycji.
- [Dotyczy R12][Techniczne] Czy wyższa pozycja reużywa istniejącej tabeli `promoted_services` (priorytet + data wygaśnięcia).
- [Dotyczy R16, R17][Techniczne] Forma formularza na materiały i powiadomienia foundera; czy rozszerzyć skill `/dodaj` o wpis premium.

## Następne kroki

→ `/dev-plan` do planowania technicznego implementacji. Darmowy profil (R1–R6) jest warunkiem premium i daje wartość sam (SEO, outreach). Warto rozważyć dostarczenie go jako osobnego, pierwszego etapu.
