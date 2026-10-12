---
date: 2026-10-10
topic: dodaj-firme-z-ai
---

# Dodaj firmę z AI — samoobsługowe zgłoszenie wpisu z linku

## Problem

Firmy zgłaszają się dziś przez formularz kontaktowy (e-mail, temat, wiadomość). Zgłaszający to
głównie **właściciele firm**. Wiadomość jest wolnym tekstem, więc całą pracę, czyli research,
klasyfikację, opisy w 4 językach i współrzędne, wykonuje operator ręcznie albo przez skill
`/dodaj`, często dopytując o brakujące dane.

Chcemy przenieść pierwszą część pracy `/dodaj` na stronę. Właściciel wkleja link i widzi
wygenerowaną kartę swojej firmy. Poprawia kluczowe pola i wysyła ją. Operator dostaje gotowy wpis
do akceptacji zamiast surowej wiadomości.

## Wymagania

**Wejście**
- R1. Na stronie kontaktu formularz kontaktowy zostaje bez zmian. Pod nim pojawia się wyraźny
  przycisk „Dodaj firmę z AI”, który prowadzi do nowego flow.
- R2. Flow startuje od jednego pola: link do firmy (strona www albo profil social / wizytówka).
  Dodatkowo jest opcjonalny upload logo i wymagany e-mail zgłaszającego.

**Generowanie karty**
- R3. Z linku system generuje propozycję wpisu w tym samym zakresie co `/dodaj`: nazwa,
  kategoria, zasięg (local/online/hybrid), adres i lokalizacja na mapie, telefon, e-mail, www,
  godziny otwarcia, języki obsługi, tagi oraz opisy pl/uk/en/ru.
- R4. Obowiązuje zasada `/dodaj`: **nie wymyślamy danych**. Pole, którego nie da się potwierdzić
  ze źródła, zostaje puste i jest oznaczone w karcie jako „do uzupełnienia”, a nie wypełnione
  zgadywaną wartością.
- R5. Wynik pokazujemy jako podgląd karty wyglądający jak prawdziwa karta w katalogu, w języku
  interfejsu zgłaszającego.
- R6. Gdy linku nie da się odczytać (np. Instagram/Facebook za loginem, strona nie odpowiada),
  użytkownik dostaje jasny komunikat i ten sam formularz pól kluczowych, tylko pusty. Wpisuje
  dane i krótki opis działalności, a kategorię, tagi i opisy w 4 językach generujemy z tego, co
  wpisał.
- R7. Jeśli link wskazuje firmę, która już jest w katalogu (ta sama domena), informujemy o tym
  z linkiem do istniejącego wpisu, zanim ruszy generowanie.

**Edycja przez właściciela**
- R8. Właściciel może edytować pola kluczowe: nazwa, adres, telefon, e-mail, www, godziny
  otwarcia, języki obsługi. Zmiana adresu aktualizuje pin na podglądzie.
- R9. Kategoria, zasięg, tagi i opisy są generowane i **nie** podlegają edycji. Właściciel może
  je skomentować w polu uwag.
- R10. Pole „Uwagi” (wolny tekst, opcjonalne) służy do zgłaszania błędów i informacji
  dodatkowych, np. „jest jeszcze punkt w Gdańsku”.

**Logo**
- R11. System próbuje znaleźć logo na stronie firmy i pokazuje je w podglądzie jako propozycję.
- R12. Właściciel może wgrać własne logo, które zastępuje propozycję. Ograniczenia: typy
  graficzne i limit rozmiaru. Bez logo karta pokazuje standardowy placeholder.

**Wysłanie i akceptacja**
- R13. Po wysłaniu operator dostaje maila z:
  - podglądem danych,
  - plikiem wpisu zgodnym ze schematem `data/services/*.json` (gotowym pod
    `npm run db:add -- <plik> --dry-run`),
  - logo jako załącznikiem,
  - uwagami właściciela,
  - listą pól niepotwierdzonych lub zmienionych ręcznie przez właściciela,
  - reply-to ustawionym na e-mail zgłaszającego.
- R14. Zgłoszenie **nie** trafia do bazy. Akceptacja i publikacja zostają ręczne, przez
  istniejący przepływ `/dodaj` / `db:add` + `seed.ts`.
- R15. Po wysłaniu właściciel widzi swoją kartę i podziękowanie. Dostaje też mail potwierdzający
  w swoim języku z kopią zgłoszonych danych.

**Ochrona**
- R16. Twardy limit **2 generowań na IP na dobę**. Po przekroczeniu użytkownik widzi czytelny
  komunikat i link do zwykłego formularza kontaktowego.
- R17. Pobieranie obcej strony jest ograniczone do publicznych adresów http(s) z limitem czasu
  i rozmiaru. Link nie może prowadzić do zasobów wewnętrznych.

**i18n / a11y**
- R18. Cały flow jest dostępny w 4 locale (pl/en/ru/uk). Stany ładowania, błędów i sukcesu są
  ogłaszane czytnikom ekranu.

## Kryteria sukcesu

- Plik z maila przechodzi `npm run db:add -- <plik> --dry-run` bez ręcznych poprawek struktury.
  Poprawki merytoryczne, np. kategoria po uwagach, są dopuszczalne.
- Czas operatora na jedno zgłoszenie spada z researchu od zera do przeglądu i akceptacji.
- Firma bez strony www (tylko social) może się zgłosić przez fallback z R6.
- Zero wymyślonych wartości w wygenerowanej karcie. Puste pola są widoczne jako puste.

## Granice scope'u

- Brak zapisu do bazy i statusu `pending`. Brak panelu akceptacji i brak auth w dashboardzie.
- Brak automatycznego maila „Twój wpis został opublikowany”. Operator informuje ręcznie.
- Brak edycji kategorii, zasięgu, tagów i opisów przez właściciela.
- Brak captchy i weryfikacji e-maila przed generowaniem. Wystarcza rate limit z R16.
- Brak wielu lokalizacji w formularzu. Dodatkowe punkty właściciel wpisuje w uwagach.
- Brak storage na logo (Vercel Blob itp.). Logo podróżuje wyłącznie jako załącznik maila.
- Brak edycji istniejącego wpisu przez właściciela. R7 tylko informuje o duplikacie.

## Kluczowe decyzje

- **Mail z JSON-em zamiast wpisu pending:** baza ma jedno źródło prawdy (`seed.ts` + pliki
  `data/services/`). Wpis dopisany bezpośrednio zniknąłby przy odtworzeniu, a dashboard nie ma
  autoryzacji.
- **Edycja tylko pól faktograficznych:** właściciel zna swoje godziny i telefon lepiej niż
  scraper. Klasyfikację katalogu kontroluje operator, a właściciel ma na nią wpływ przez uwagi.
- **Logo jako załącznik:** upload przez serwer na Vercelu trafia do efemerycznego systemu
  plików, a mail omija ten problem bez nowej infrastruktury.
- **Fallback zamiast odrzucenia linków social:** wiele małych firm nie ma własnej strony.
  Odrzucenie wycięłoby właśnie tę grupę.
- **Limit 2/dobę/IP:** zgłoszeń jest niewiele, a każde generowanie kosztuje (LLM + fetch).

## Zależności / Założenia

- Dostawca LLM do ekstrakcji i opisów: w projekcie jest dziś `OPENAI_API_KEY` (embeddingi).
- Wysyłka maili: istnieje nodemailer/Gmail (kontakt) i Resend. Wybór należy do planowania.
- Schemat wpisu i reguły klasyfikacji: `src/db/service-input-schema.ts` oraz
  `.claude/skills/dodaj/references/klasyfikacja.md`. Generator na stronie powinien z nich
  korzystać, a nie mieć własnej kopii reguł.

## Otwarte pytania

### Do rozwiązania przed planowaniem
(brak)

### Odroczone do planowania
- [R1][Techniczne] Osobna strona czy rozwinięcie na stronie kontaktu? Ważna lokalizowana
  ścieżka i SEO (noindex dla flow?).
- [R3][Techniczne] Model i dostawca LLM, limit kosztu jednego generowania, czas odpowiedzi
  (streaming/postęp vs limity czasu funkcji Vercela).
- [R3][Wymaga researchu] Geokodowanie na produkcji: Nominatim ma politykę użycia (1 req/s,
  User-Agent), a `MAPBOX_TOKEN` jest pusty.
- [R3/R9][Techniczne] Jak współdzielić reguły klasyfikacji między skillem `/dodaj` a kodem
  aplikacji, żeby się nie rozjechały.
- [R7][Techniczne] Normalizacja domeny przy wykrywaniu duplikatów (www, subdomeny, linki social
  nie są unikalne per firma).
- [R11][Techniczne] Heurystyka wyboru logo (og:image, apple-touch-icon, favicon) i minimalna
  jakość.
- [R13][Techniczne] Wybór transportu maila (Gmail vs Resend) i limit rozmiaru załączników.
- [R17][Techniczne] Ochrona przed SSRF przy pobieraniu linku (DNS rebinding, przekierowania).

## Następne kroki

→ `/dev-plan` do planowania technicznego implementacji
