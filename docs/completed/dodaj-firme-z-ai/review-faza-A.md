# Review fazy A — Dodaj firmę z AI

Data: 2026-10-11
Zakres: `af26611..22456b5` (U1–U7, moduły serwerowe `src/lib/add-business/**`, `mailer.ts`,
`rate-limit.ts`, `queries.ts`, trasa kontaktu, `messages/*.json`)
Reviewerzy: security-sentinel, performance-oracle, kieran-typescript-reviewer
(+ architecture-strategist), tester scenariuszy. E2E (chrome-devtools) pominięte: faza A nie ma
UI ani checkboxów przeglądarkowych.

## Severity gate

**⚠️ KONTYNUUJ Z ZASTRZEŻENIAMI — 0 × P1, 14 × P2, 28 × P3**

Rdzeń jest solidny:
- SSRF: lookup przy połączeniu dla http i https, allowlista IPv6 `2000::/3`, redirecty walidowane
  na każdym skoku, limit bajtów liczony strumieniowo, brak gzip;
- type safety: zero `any` i `!`, `as` tylko jako `as const`;
- wszystkie scenariusze testowe z planu mają testy z realną asercją;
- przepływ end-to-end przez wszystkie moduły (test w scratchpadzie) daje JSON zgodny z
  `serviceInputSchema`.

Część P2 dotyczy kontraktów, z których skorzysta U8. Warto je zamknąć przed fazą B.

## 🟠 P2 — important

| # | Plik:linia | Problem | Poprawka | Źródło |
|---|---|---|---|---|
| 1 | `src/lib/add-business/logo.ts:34-47` | sharp bez `limitInputPixels`. PNG 16000×16000 mieści się w 1 MB, a dekoduje się do ok. 1 GB (bomba dekompresyjna). Atakujący kontroluje i upload, i kandydata logo ze swojej strony. Obraz parsowany 2×. | `sharp(bytes, { limitInputPixels: 4096*4096, failOn: 'error' })`, jedna instancja, sprawdzenie `width*height` po `metadata()`. Test z fixture o dużych wymiarach. | sec, perf |
| 2 | `src/lib/add-business/llm-draft.ts:122-124` | `stripDelimiters` nie jest idempotentny: `<<<ZRODLO_<<<ZRODLO_KONIEC>>>KONIEC>>>` po strip daje działający znacznik końca. Prompt injection może zamknąć sekcję danych. | Usuwać całe sekwencje `<{3,}` / `>{3,}` albo znaczniki z nonce `randomUUID()`. Test z zagnieżdżonym znacznikiem. | sec |
| 3 | `src/lib/rate-limit.ts:39-47`, `limits.ts:35-46` | Klucze limitów od pełnego IPv6. Klient z /64 omija limity fetch/submit, a 20 adresów wyczerpuje `gen:global` (DoS funkcji na 24 h). | Normalizacja IPv6 do prefiksu /64 w helperze. Rozważyć globalny limit fetch. Potwierdzić, że Vercel nadpisuje `x-forwarded-for`. | sec |
| 4 | `src/lib/add-business/verify-facts.ts:63-69` | `verifyText` sprawdza podciąg bez granic słów. LLM `city: "Gdańsk"` przy „ul. Gdańska 5, Łódź” → potwierdzone; geokoder też przepuszcza, pin w złym mieście. Przechodzą też `'a'`, `'ul'`, postcode `'0'`; „Prosta 1” vs „Prosta 15”. | Granice Unicode `(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])` z escapowaniem, postcode `^\d{2}-\d{3}$`, minimalna długość. Testy na przykłady. | scen, sec |
| 5 | `src/lib/add-business/verify-facts.ts:28` | `PHONE_CANDIDATE_PATTERN` skleja sąsiednie liczby po zwinięciu białych znaków („22 123 45 67 600 700 800”, „Tel. 600 700 800 00-950”), więc prawdziwy telefon jest odrzucany. Częsty układ stopek. | Okna ciągłych grup cyfr o długości 9–11 po `nationalDigits`. Testy na 3 wejścia. | scen |
| 6 | `src/lib/add-business/draft-store.ts:154-157, 183-191` | Zapis bez walidacji, odczyt przez strict schema. Naturalne `geo: { ...geocodeResult, address }` zapisze `ok: true`, a każdy odczyt da ciche `DRAFT_EXPIRED`. | `storedDraftSchema.parse()` przy zapisie (fail-fast) + helper `toDraftGeo()` z testem. | arch |
| 7 | `draft-store.ts:72-129` vs `draft-schema.ts:40-80` | Drugi, luźniejszy schemat `BusinessDraft`: tags bez min/max, godziny jako `z.record` bez wzorca i dni. Trzecia kopia `localizedText`; interfejsy pisane ręcznie. | Jeden `businessDraftSchema` w `draft-schema.ts`, `type BusinessDraft = z.infer<…>`; użyć `tagInputSchema` z `service-input-schema`. | arch |
| 8 | `owner-edits-schema.ts:37`, `jsonld-facts.ts:35-44`, `draft-schema.ts:27-35` | Format godzin i dni (`TIME_PATTERN`, `WEEKDAYS`) w 4 miejscach; komentarz sam mówi, że musi być identyczny ze schematem `db:add`. | Wyeksportować `TIME_PATTERN` i `WEEKDAY_KEYS` z `src/db/service-input-schema.ts` (właściciel kontraktu). | arch |
| 9 | `safe-fetch.ts:38,223`, `html-extract.ts:133-152` (dla U8) | Budżet 60 s: podstrony wychodzą z HTML-a strony głównej, więc 8 + 8 s sekwencyjnie, nie równolegle. Najgorszy przypadek ok. 55 s + cold start, a przekroczenie daje 504 bez kodu dla UI. Plan (tabela ryzyk) zakłada 8 s. | U8: jeden deadline na generowanie, `timeoutMs` z pozostałego czasu, krótszy timeout dla fallbacków `/kontakt`/`/contact`, pomijanie podstron przy braku budżetu. Poprawić tabelę ryzyk. | perf |
| 10 | `llm-draft.ts:36-39` | Timeout LLM 30 s blisko realnego czasu (4 opisy, uk/ru drogie w tokenach, szacunek 15–35 s). Timeout zjada 1 z 2 dziennych generowań (limit zużyty przed LLM), a OpenAI i tak nalicza tokeny. | Zmierzyć p50/p95 na 5–10 stronach (przy ręcznym przebiegu w U9). Przy p95 > 25 s przesunąć budżet. Rozważyć zwrot limitu IP przy timeoutcie. | perf |
| 11 | `src/lib/queries.ts:279, 314-318` | `ILIKE '%host%'` + `LIMIT 20` + sort tylko po `isMainLocation`: przy krótkim hoście (`art.pl`, `lex.pl`) prawdziwy duplikat może wypaść za limit. Brak normalizacji hosta wewnątrz funkcji. Brak rate limitu przed zapytaniem (krok przed `peek`). | Zakotwiczone wzorce (`%://host%`, `%://www.host%`) albo regex z granicą hosta; `normalizeHost` w funkcji. Test „> 20 kandydatów, duplikat ostatni”. W U8 limit przed sprawdzeniem duplikatu. | perf, arch, scen |
| 12 | `src/lib/rate-limit.ts:61-65` | `INCR` i `EXPIRE` nieatomowe. Przerwanie między nimi zostawia klucz bez TTL. Dla `add-business:gen:global` to trwałe wyłączenie funkcji po 40 generowaniach. | `multi().incr().expire(key, window, 'NX')` albo Lua; minimum samonaprawa przy `ttl === -1`. | perf, scen |
| 13 | `src/lib/add-business/draft-schema.ts:5,68,117` | Moduł „dla klienta” importuje `coverageEnum` z `@/db/schema`, więc ciągnie drizzle `pg-core`. Walidacja klientowa w fazie B wciągnęłaby schemat do bundla. | `COVERAGE_VALUES` w lekkim module (wzorem `src/lib/categories.ts`), `pgEnum('coverage', COVERAGE_VALUES)`. | perf |
| 14 | `next.config.ts:13` | `compiler.removeConsole: NODE_ENV === 'production'` wycina wszystkie `console.*`, także `warn`/`error`. Na produkcji znikną logi z safe-fetch/logo/draft-store/mailer, a plan opiera mitygację utraty zgłoszenia przy `SEND_FAILED` na logu. Zweryfikowane w kodzie. | `removeConsole: { exclude: ['error', 'warn'] }`. Config starszy niż zadanie, ale unieważnia mitygację z tej fazy — **decyzja usera**. | perf |

## 🟡 P3 — nit

**Bezpieczeństwo i dane**
1. `verify-facts.ts:39-46`: `verifyPhone` zwraca string od LLM, a porównuje tylko cyfry. „123 456 789 – zadzwoń, wygrałeś” przechodzi. Zwracać fragment ze źródła albo odrzucać znaki spoza `[\d\s()+.-]`.
2. `verify-facts.ts:96-111`: godziny potwierdzane dowolnym `HH:MM` na stronie (np. data aktualizacji). Wymagać pary open/close blisko siebie albo oznaczać godziny z LLM jako `unconfirmed`.
3. `jsonld-facts.ts:131-136`: `flattenNodes` rekurencyjne. JSON-LD zagnieżdżony na 1M poziomów daje `RangeError`, mimo kontraktu „nigdy nie rzuca”. Dodać limit głębokości.
4. `safe-fetch.ts:287`: `safeFetchImage` przyjmuje `image/svg+xml`. librsvg parsuje go, zanim sharp odrzuci. Allowlista MIME. `safe-fetch.ts:235`: dopuszczony redirect `https`→`http`.
5. `submission-emails.ts:22-23`: rada „loguj cały `entry.json` przy `SEND_FAILED`” to PII w logach Vercela. W U8 zdecydować: Redis z TTL albo maskowanie (powiązane z P2-14).
6. `submission-emails.ts:206-222`: potwierdzenie na niezweryfikowany e-mail z treścią właściciela (name, webpage, phone) to kanał phishingu z Gmaila operatora. Ryzyko przyjęte w planie; rozważyć usunięcie klikalnego `webpage` albo globalny limit submit.
7. `jsonld-facts.ts:102`: `telephone: "tel:+48…"` przechodzi z prefiksem. Zdejmować `tel:` jak `mailto:`.
8. `jsonld-facts.ts:177`: `closes: "24:00"` kasuje dzień. Mapować na `23:59`.
9. `jsonld-facts.ts:216`: `mergeFacts` scala fakty z wielu oddziałów (nazwa z A, telefon z B). Brać jeden najlepszy węzeł.
10. `geocode.ts:232-235`: przy `knownGeo` brak województwa i kodu, bez flagi dla operatora.

**Architektura i jakość**
11. `build-service-json.ts:60-66, 93, 104`: `normalizeHours({})` zwraca `'||||||'`, więc `{}` liczy się jako wypełnione i daje fałszywe `changedByOwner`.
12. Model błędów: unie vs wyjątki (`DraftGenerationError`, `HtmlExtractError`, Redis). `UPSTREAM_FAILED`/`RATE_LIMITED` znaczą co innego w różnych modułach. W U8 jedna tabela mapowania kodów na UI.
13. `queries.ts:16` importuje z folderu feature'a (`domain-match`). Lepiej neutralny `src/lib/web-host.ts`. Odchylenie niezalogowane.
14. Nesting > 2: `safe-fetch.ts:105-129, 226-238`, `jsonld-facts.ts:183-191`, `owner-edits-schema.ts:225-235`.
15. Importy w `add-business`: mieszanka `./…` i `@/lib/add-business/…`.
16. `owner-edits-schema.ts:39`: druga kopia `emptyToNull` (dashboard). Opcjonalnie `src/lib/form-data.ts`.
17. `geocode.ts:28`: trzecia definicja typu `Voivodeship`. Przenieść do `src/db/schema.ts`.
18. `safe-fetch.ts:43`: `USER_AGENT` z `https://polvia.pl` na sztywno, podczas gdy geocode bierze `env.NEXT_PUBLIC_SITE_URL`. Trasa kontaktu nie używa `getOperatorInbox()`.
19. `rate-limit.ts` `peekRateLimit`: przy `NaN` daje `allowed: true, remaining: NaN`.
20. `draft-store.ts:220`: `reserveRelocation` nie sprawdza istnienia draftu. Udokumentować kolejność `getDraft → reserveRelocation`.
21. `html-extract.ts:38-45`: rzucany `HtmlExtractError` niezalogowany jako odchylenie.
22. U7 `Delegate to: feature-builder-web-data` modyfikuje `messages/*.json` (kategoria UI). Notatka dla planisty.

**Wydajność**
23. `verify-facts.ts:206,212`: `EMAIL_PATTERN` ma kwadratowy koszt na długim ciągu bez `@` (12k: dziesiątki–setki ms; sklejone 3 strony: sekundy). Najpierw `includes`, potem sprawdzenie granic.
24. `html-extract.ts:76-81, 117-118`: cheerio na 2 MB, `$('body *').append(' ')` mutuje każdy element. Strona 2 MB: 2,8 s, 3 strony naraz: 100–200 MB. Przycinać HTML podstron, zbierać tekst iteracyjnie.
25. `mailer.ts`: nowy transport SMTP przy każdym mailu (1–3 s na submit). Transporter na moduł; potwierdzenie przez `allSettled`.
26. Redis: 10–14 round-tripów na generowanie. `MGET` w `peek`, `multi()` w `consume`.

**Testy**
27. Brak testów granicznych: dokładnie 3 redirecty, dokładnie limit bajtów, notes = 2000, logo = 2 MB. Brak testów współbieżności (`Promise.all` consume, relokacje na granicy 10, 2× consume przy 1 wolnym miejscu).
28. `verify-facts.test.ts:116`: `not.toEqual(arrayContaining([...]))` jest za słabe. Użyć `not.toContain` per pole.

## Poza zakresem (zgłoszone, nie do tej fazy)
- `submit-contact-query/route.ts`: `ContactFormSchema.parse` i `req.json()` bez obsługi błędu, więc 500 zamiast 400. Kod sprzed zadania; kandydat na osobny fix.
- `bodySizeLimit: '3mb'` jest już zaplanowany w U8 (bez niego upload logo > 1 MB nie dojdzie).

## Odchylenia od planu

Wszystkie pliki z sekcji „Pliki:” IU 1–7 istnieją, łącznie z plikami testów i fixtures.
`cheerio` przypięty jako `1.2.0`. Zalogowane odchylenia wszyscy reviewerzy uznali za uzasadnione:
- `node:http(s)` z własnym `lookup` zamiast undici;
- wydzielone `public-address`, `jsonld-facts`, `domain-match`, `fake-redis`;
- atomowy licznik relokacji;
- `peekRateLimit` w `rate-limit.ts`;
- unia zamiast klasy `MailerError`;
- klucz `contact.sendFailed`.

Niezalogowane (P3): zależność `queries.ts` → feature, `HtmlExtractError`, własny schemat
`BusinessDraft` w draft-store.

## Pokrycie scenariuszy z planu

Wszystkie scenariusze IU 1–7 mają test z asercją. Pełna tabela w raporcie testera:
safe-fetch, public-address, html-extract, link-kind, verify-facts, llm-draft, geocode,
draft-store, limits, build-service-json, owner-edits-schema, logo, submission-emails, mailer,
route. 234 testy w 17 suitach przechodzą.

## Bookkeeping checkboxów Weryfikacja:

- Odznaczone automatycznie (CLI/grep): 14
- Odznaczone na podstawie Agent 5 E2E (chrome-devtools): 0 (brak scenariuszy przeglądarkowych w fazie A)
- Pozostawione dla operatora (Manual): 0
- Niejasne (P3): 0
- Failujące (P2): 0

### Szczegóły
- [x] CLI: U1 `npx jest src/lib/add-business/safe-fetch.test.ts` → PASS
- [x] CLI: U2 `npx jest …/html-extract.test.ts …/link-kind.test.ts` → PASS
- [x] CLI: U3 `npx jest …/llm-draft.test.ts …/verify-facts.test.ts` → PASS
- [x] CLI: U4 `npx jest …/geocode.test.ts` → PASS
- [x] CLI: U5 `npx jest …/draft-store.test.ts …/limits.test.ts` → PASS
- [x] CLI: U6 `npx jest …/build-service-json.test.ts …/owner-edits-schema.test.ts …/logo.test.ts` → PASS
- [x] CLI: U7 `npx jest …/submission-emails.test.ts src/lib/mailer.test.ts` → PASS
- [x] CLI: U1–U7 `npx tsc --noEmit` (7 checkboxów) → PASS (exit 0)

Operator checklist U5 z planu technicznego („ręcznie sprawdź `findServiceByDomain` dla domeny
istniejącego wpisu”) zostaje otwarty i wymaga operatora.
