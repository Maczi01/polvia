# Dodaj firmę z AI — podsumowanie

Data ukończenia: 2026-10-11
Branch: `feature/dodaj-firme-z-ai` (worktree `polvia-dodaj-firme-ai`)
Plan techniczny: `docs/plans/2026-10-11-001-feat-dodaj-firme-z-ai-plan.md`
Status: kod gotowy. Gate zielony: tsc 0, jest 92 suity / 1017 testów, lint 0 błędów, build OK.
**Ręczne sprawdzenia operatora są otwarte** (niżej). Zadanie zarchiwizowane z decyzji usera.

## Co zostało dostarczone

Właściciel firmy zgłasza swój wpis sam, bez pisania do nas:

1. Na `/dodaj-firme` (en/ru/uk: `/add-business`) wkleja link do strony firmy.
   Wejście jest też z `/kontakt`, przyciskiem „Dodaj firmę z AI”.
2. Serwer pobiera stronę i do 2 podstron (guard SSRF), wyciąga fakty (JSON-LD, tekst), a LLM
   (`gpt-4.1-mini`) przygotowuje szkic: kategorię, zasięg, tagi i opisy w 4 językach. Fakty
   bez potwierdzenia w źródle są oznaczone „do uzupełnienia”. Adres jest geokodowany przez
   Nominatim.
3. Właściciel widzi podgląd karty 1:1 z katalogiem i statyczny pin Mapbox. Edytuje pola
   kontaktowe, adres („Sprawdź na mapie”), godziny i języki, dodaje logo, e-mail i uwagi.
4. Po wysłaniu operator dostaje mail z gotowym JSON-em do `npm run db:add`, logiem i
   `replyTo`. Właściciel dostaje potwierdzenie w swoim języku.

Ścieżki boczne:
- **tryb ręczny:** link do social mediów albo strona nieczytelna;
- **duplikat:** link do istniejącego wpisu;
- **limity:** z `retryAfter`.

## Kluczowe decyzje

- **Bez zapisu do bazy.** Wpis trafia do operatora mailem, a operator dodaje go przez
  `db:add`. Akcje nie mają `revalidatePath`.
- **Szkic w Redis** (TTL 2 h, jednorazowy GETDEL). Kategoria, zasięg, tagi, opisy i geo
  pochodzą wyłącznie ze szkicu. Z formularza czytane są tylko pola R8.
- **Limity Redis (24 h):**
  - generowanie: 2 na IP, 40 globalnie;
  - pobrania stron: 6 na IP;
  - wysyłki: 2 na IP;
  - relokacje: 10 na szkic.

  IPv6 jest agregowane do /64. Licznik jest atomowy (`MULTI SET NX EX + INCR`).
- **Budżet czasu:** `maxDuration = 60`; generowanie ma deadline 50 s liczony od startu.
  Wysyłka:
  - wszystko, co może zawieść, dzieje się przed `consumeDraft`;
  - geo i logo idą równolegle;
  - SMTP ma timeout 10 s;
  - utracone zgłoszenie trafia do logu.
- **Kolejność w `generateDraft`:** social → peek limitu → limit fetch → duplikat → fetch → LLM.
  Sprawdzenie duplikatu zużywa limit fetch (decyzja usera).
- **Token Mapbox:** zostaje istniejący publiczny token `pk.` (decyzja usera), w jednej stałej
  `src/lib/mapbox.ts`.
- **`removeConsole`** na produkcji zostawia `console.error` i `console.warn`.
- **`bodySizeLimit: '3mb'`** dla Server Actions (logo ≤ 2 MB). Dotyczy całej aplikacji.

## Główne pliki

- **Serwer:** `src/lib/add-business/**`, w tym:
  - `safe-fetch`, `html-extract`, `jsonld-facts`, `link-kind`;
  - `llm-draft`, `verify-facts`, `geocode`;
  - `draft-store`, `limits`;
  - `build-service-json`, `logo`, `submission-emails`;
  - orkiestratory `generate-draft`, `submit-draft`, `relocate-draft`;
  - kontrakty i stałe: `types`, `form-limits`.
- **Wspólne:**
  - `src/lib/mailer.ts`, `rate-limit.ts`, `queries.ts` (duplikaty);
  - `coverage.ts`, `voivodeships.ts`, `service-status.ts`, `weekdays.ts`, `mapbox.ts`.
- **Strona:**
  - `src/app/[locale]/(header)/add-business/` (`page.tsx`, `_actions.ts`, `_components/**`);
  - `contact/_components/add-business-cta`.
- **Konfiguracja:**
  - `src/i18n/routing.ts`, `src/app/sitemap.ts`, `next.config.ts`;
  - `messages/*.json` (namespace `addBusiness`, 148 kluczy);
  - zależność `cheerio@1.2.0`.

## Wnioski

- **Komponent kliencki nie importuje wartości z modułów walidacji ani z `src/db`.** Stałe
  trzymamy w lekkich modułach (`categories.ts`, `weekdays.ts`, `form-limits.ts`), a schematy
  je reeksportują. Inaczej zod, `slugify`, a nawet drizzle trafiają do bundla. Ten błąd
  wyszedł w obu review.
- **Wzorzec `jest` ze ścieżką `(header)` musi mieć escapowane nawiasy** (`\(header\)`).
  Bez tego dopasowuje 0 plików, a komenda „przechodzi” pustym przebiegiem.
- **Drogą pracę stawiamy za tanią kontrolą limitu.** Sharp i fetch idą dopiero po `peek`.
  Wiążący `consume` zostaje tam, gdzie zły input nie spala próby.
- **Kod po nieodwracalnym kroku (`consumeDraft`) musi mieć ograniczony czas.** Inaczej
  przerwanie funkcji gubi dane bez śladu. Domyślne timeouty nodemailera to minuty.
- **`URL.canParse` nie istnieje w jsdom.** Testy schematów z tą funkcją wymagają
  `@jest-environment node`.
- **React 19 łączy trwające akcje async.** Niezakończona obietnica akcji w teście blokuje
  kolejne testy.
- **Test lokalizowanych linków:** prawdziwy `@/i18n/navigation` z mockiem samego
  `next/navigation` działa w jsdom i sprawdza faktyczne ścieżki per locale.

## Otwarte

**Ręczne sprawdzenia operatora** (przed wdrożeniem na produkcję):
- [ ] Porównanie podglądu z kartą na `/mapa` (pozycja logo, paddingi), desktop i 390 px.
- [ ] Pełne przejście na stronie z JSON-LD. Oba maile dochodzą, a plik z załącznika przechodzi
  `npm run db:add -- <plik> --dry-run`.
- [ ] Czas LLM p50/p95 na 5–10 stronach. Przy p95 > 25 s przesunąć budżet.
- [ ] Link Instagram → tryb ręczny → wysyłka.
- [ ] Domena istniejącego wpisu → komunikat duplikatu z działającym linkiem.
- [ ] `pl` i `uk`: wszystkie klucze obecne, konsola bez błędów, poprawne ścieżki.
- [ ] `/kontakt` → `/dodaj-firme`; `/uk/contact` → `/uk/add-business`.
- [ ] `/mapa` ładuje mapę po przeniesieniu tokenu do `src/lib/mapbox.ts`.
- [ ] Redis w wersji ≥ 6.2 (`GETDEL`, `SET KEEPTTL`).

**Do decyzji lub osobnych zadań:**
- Globalny limit pobrań stron i agregacja IPv6 do /48.
- Sugestie P3: 28 z review A i 37 z review B (`review-faza-A.md`, `review-faza-B.md`).
  Warte uwagi:
  - podwójna wysyłka może nadpisać ekran podziękowania;
  - `limited` z wysyłki porzuca edytor;
  - `SEND_FAILED` sugeruje ponowienie przy zużytym szkicu;
  - tryb ręczny nie sprawdza duplikatu;
  - mail operatora pokazuje tylko opis pl;
  - `NextIntlClientProvider` dostaje wszystkie komunikaty.
- **Poza zakresem:**
  - `map/[[...slug]]/page.tsx:121` daje dla `pl` `/map?…`;
  - martwy import `Header` w `contact/page.tsx`;
  - `submit-contact-query` zwraca 500 zamiast 400.
