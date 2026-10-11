# Dodaj firmę z AI — plan wykonawczy

Branch: `feature/dodaj-firme-z-ai`
Worktree: `C:\Users\mateu\WebstormProjects\polvia-dodaj-firme-ai` (od `origin/master`;
pamięć projektu: równoległe sesje, bez `git switch` w głównym katalogu)
Ostatnia aktualizacja: 2026-10-11

## Źródła

- Requirements doc: `docs/brainstorms/2026-10-10-dodaj-firme-z-ai-requirements.md`
- Plan techniczny: `docs/plans/2026-10-11-001-feat-dodaj-firme-z-ai-plan.md` — tam są pełne
  decyzje D1–D14, podejście i wzorce per unit. Ten plik je streszcza i porządkuje wykonanie.

## Podsumowanie wykonawcze

Nowa publiczna strona `/dodaj-firme` (`/{locale}/add-business`), na którą prowadzi przycisk pod
formularzem kontaktowym.

Przebieg:
1. Właściciel wkleja link do firmy.
2. Serwer pobiera stronę z ochroną SSRF, wyciąga fakty (JSON-LD, tekst), a LLM klasyfikuje wpis
   i pisze opisy pl/uk/en/ru. Nominatim liczy pin.
3. Właściciel widzi podgląd karty, poprawia pola faktograficzne, dodaje logo, e-mail i uwagi.
4. Po wysłaniu operator dostaje mail z gotowym `data/services/<slug>.json` i PNG logo, a
   właściciel potwierdzenie w swoim języku.

Nic nie trafia do bazy. Publikacja zostaje ręczna, przez `/dodaj` i `seed.ts`.

**Wartość biznesowa:** operator przestaje robić research od zera. Dostaje wpis zgodny ze
schematem `db:add`, z jawną listą pól niepotwierdzonych.

## Obecny stan

- `/kontakt` przyjmuje tylko wolny tekst (e-mail, temat, wiadomość) i wysyła go przez Gmail
  (`src/app/api/submit-contact-query/route.ts`).
- Cała logika wpisu (fakty, klasyfikacja, opisy, geokodowanie) żyje w skillu `/dodaj` i jest
  wykonywana ręcznie z Claude Code.
- Elementy do ponownego użycia:
  - `serviceInputSchema` (kontrakt pliku wpisu),
  - `checkRateLimit`,
  - wzorzec wywołania OpenAI z `semantic-relevance-judge.ts`,
  - `CATEGORY_VALUES` i `CATEGORY_CONTEXTS`,
  - sharp.
- W repo nie ma: parsera HTML, kodu geokodowania, wspólnego modułu maili, załączników,
  `.env.e2e`.

## Stan docelowy

```
src/lib/add-business/
  safe-fetch.ts          guard SSRF (U1)
  html-extract.ts        tekst, JSON-LD, logo, link kontaktu (U2)
  link-kind.ts           social vs własna domena, normalizacja hosta (U2)
  draft-schema.ts        schemat strict dla LLM (U3)
  llm-draft.ts           wywołanie OpenAI (U3)
  verify-facts.ts        bariera przed wymyślonymi danymi (U3)
  geocode.ts             Nominatim + cache + 1 req/s (U4)
  draft-store.ts         draft w Redis, jednorazowy (U5)
  limits.ts              limity D7 (U5)
  build-service-json.ts  wynik = wejście serviceInputSchema (U6)
  owner-edits-schema.ts  FormData → zod (U6)
  logo.ts                sharp: walidacja, PNG ≤ 512 px (U6)
  submission-emails.ts   treść maili (U7)
  generate-draft.ts      orkiestrator (U8)
  submit-draft.ts        orkiestrator (U8)
  types.ts               kontrakty wyników akcji (U8)
src/lib/mailer.ts        wspólny transport nodemailer (U7)
src/app/[locale]/(header)/add-business/
  page.tsx, _actions.ts, _components/* (U8, U9)
src/app/[locale]/(header)/contact/_components/add-business-cta/ (U10)
```

## Fazy

### Faza A — moduły serwerowe (U1–U7)

| # | Unit | Nakład | Zależy od | Kryterium akceptacji |
|---|---|---|---|---|
| U1 | Guard SSRF | M | — | Adresy niepubliczne (w tym IPv4-mapped IPv6, metadata 169.254.169.254) odrzucone przy połączeniu i na każdym redirectcie. Timeout, limit rozmiaru i content-type egzekwowane. Testy bez sieci. |
| U2 | Ekstrakcja HTML + `link-kind` | M | — | Fixture'y JSON-LD/`@graph`/brak JSON-LD dają poprawne fakty (dni lowercase). Kandydaci logo mają absolutne URL-e. Linki social rozpoznane. `cheerio` dodany w dokładnej wersji. |
| U3 | Szkic LLM + `verify-facts` | L | U2 | Fakt spoza źródła → `null` + `unconfirmed`. JSON-LD wygrywa z LLM. Błędy OpenAI typowane. Kategoria spoza `CATEGORY_VALUES` → `INVALID_RESPONSE`. |
| U4 | Geokodowanie | M | — | Cache Redis, blokada 1 req/s, kontrola miasta i zakresu Polski, `approximate`, mapowanie województwa. |
| U5 | Draft store, limity, duplikaty | M | U2, U3 | Draft jednorazowy (GETDEL). `peek` bez inkrementacji. Limit globalny blokuje. `findServiceByDomain` bez czytania całej tabeli. |
| U6 | JSON wpisu + logo | L | U1, U3, U5 | Pełny draft + edycje przechodzą `serviceInputSchema`. Brak koordynatów zgłoszony flagą, nie wyjątkiem. Puste pola FormData → `null`, nie `0`. SVG udający PNG odrzucony. |
| U7 | Maile | M | U6 | Mail operatora: sekcje niepotwierdzone/zmienione/uwagi, załączniki `<slug>.json` i `<slug>.png`, `replyTo`. Potwierdzenie w locale właściciela. Temat bez CRLF. Trasa kontaktu działa na `mailer.ts`. |

### Faza B — akcje, strona, wejście (U8–U10)

| # | Unit | Nakład | Zależy od | Kryterium akceptacji |
|---|---|---|---|---|
| U8 | Orkiestracja + Server Actions | L | U1–U7 | Kolejność social → duplikat → limit → fetch → LLM. Nieudany fetch i duplikat nie zużywają limitu. Sfałszowana kategoria z FormData ignorowana. `SEND_FAILED` loguje JSON. `bodySizeLimit: '3mb'`. |
| U9 | Strona i komponenty UI | XL | U8 | Maszyna stanów jako unia. Podgląd odwzorowuje `service-card`. Znaczniki „do uzupełnienia”. Brak kontrolki kategorii. `aria-live` i `aria-describedby`. jest-axe zielony. Klucze w 4 locale. Brak `next/link`. |
| U10 | Przycisk na `/kontakt` | S | U9 | Link „Dodaj firmę z AI” prowadzi do `/add-business` w każdym locale. Formularz kontaktowy bez zmian. |

**Kolejność wykonania:**
- U1, U2 i U4 są niezależne (mogą iść równolegle).
- Dalej U3 → U5 → U6 → U7 → U8 → U9 → U10.

**Szacunek łączny:** ok. 4–6 dni roboczych pracy implementacyjnej. Faza A ok. 60%, z czego U3 i
U6 to najwięcej logiki. U9 to największy pojedynczy unit, bo obejmuje 5 komponentów, testy a11y
i 4 locale.

## Ocena ryzyka

| Ryzyko | Prawdopodobieństwo / wpływ | Mitygacja |
|---|---|---|
| SSRF (rebinding, redirect na adres wewnętrzny) | niskie / wysoki | Walidacja w `lookup` i na każdym skoku. Testy klasyfikatora IP (U1). |
| Wymyślone dane w karcie | średnie / wysoki | `verify-facts` test-first, JSON-LD jako źródło nadrzędne, widoczna lista `unconfirmed` (U3). |
| Prompt injection z treści strony | średnie / niski | Dane w ogranicznikach, schema strict, wynik przegląda operator. |
| Koszt OpenAI | niskie / średni | 2/IP/dobę, 40 globalnie, `max_completion_tokens`, `gpt-4.1-mini`. |
| Spam przez maile potwierdzające | niskie / średni | Draft jednorazowy, limit submit, maile plain text. |
| Przekroczenie czasu funkcji | średnie / średni | `maxDuration = 60`, timeouty fetch 8 s, LLM ok. 30 s. |
| Polityka Nominatim | niskie / średni | Cache, 1 req/s, User-Agent, atrybucja, geokodowanie na żądanie. |
| Rozjazd podglądu z prawdziwą kartą | średnie / niski | Klasy 1:1 z `service-card` i ręczne porównanie (Operator checklist U9). |
| Utrata zgłoszenia przy błędzie maila | niskie / średni | Pełny JSON w logu serwera, komunikat z odesłaniem do formularza. |
| Kolizja z równoległymi sesjami | średnie / średni | Praca wyłącznie w worktree `polvia-dodaj-firme-ai`. |

## Mierniki sukcesu

- JSON z maila przechodzi `npm run db:add -- <plik> --dry-run` bez poprawek struktury.
- Firma z samym Instagramem przechodzi flow do wysłania (tryb ręczny).
- Zero faktów w karcie, których nie ma w źródle (testy `verify-facts` + przegląd pierwszych
  zgłoszeń).
- Czas operatora na zgłoszenie: przegląd + dry-run zamiast researchu.

## Zasoby i zależności

- Nowa zależność: `cheerio` w dokładnej wersji (zgoda usera, tylko serwer).
- Istniejące zmienne: `OPENAI_API_KEY`, `REDIS_URL`, `MY_GMAIL`, `MY_GMAIL_PASSWORD`,
  `NEXT_PUBLIC_SITE_URL`. Brak nowych wpisów w `env.ts`.
- Usługi zewnętrzne: OpenAI, Nominatim (OSM), Gmail SMTP, statyczne obrazy Mapbox (publiczny
  token `pk.` z `overview-map.tsx`).
- E2E: brak `.env.e2e`, więc scenariusze przeglądarkowe są w Operator checklist jako
  `[Manual]`.

## Granice scope'u

Poza zakresem:
- wpis `pending` w bazie, panel akceptacji, auth;
- mail po publikacji;
- edycja kategorii, zasięgu, tagów i opisów przez właściciela;
- captcha i weryfikacja e-maila;
- wiele lokalizacji;
- storage logo;
- SVG;
- streaming postępu;
- poprawki `getTodayHours`, metadata `/kontakt` i `next/navigation` w `contact-form.tsx` (znane
  długi, osobne zadanie).
