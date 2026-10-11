# Dodaj firmę z AI — kontekst

Branch: `feature/dodaj-firme-z-ai`
Worktree: `C:\Users\mateu\WebstormProjects\polvia-dodaj-firme-ai`
Ostatnia aktualizacja: 2026-10-11 (review Fazy B)

## Źródła

- Requirements doc: `docs/brainstorms/2026-10-10-dodaj-firme-z-ai-requirements.md`
- Plan techniczny: `docs/plans/2026-10-11-001-feat-dodaj-firme-z-ai-plan.md`

## Powiązane pliki (istniejące)

| Plik | Rola w tym zadaniu |
|---|---|
| `src/db/service-input-schema.ts` | **Kontrakt wyjścia.** `serviceInputSchema` (strict; `local`/`hybrid` wymagają lat/lng; `openingHours` z kluczami `monday`…`sunday`), `buildServiceSlug`. Importowalny z app (brak `server-only` i `db`). |
| `src/db/add-service.ts` | CLI operatora `npm run db:add`. Nie zmieniamy. Konsumuje plik z maila. |
| `src/lib/categories.ts` | `CATEGORY_VALUES`, jedyne źródło kategorii. Enum w schemacie LLM. |
| `src/lib/category-contexts.ts` | `CATEGORY_CONTEXTS`, opisy kategorii w 4 językach do promptu. |
| `src/lib/semantic-relevance-judge.ts` (+ test) | Wzorzec OpenAI: wstrzykiwany klient, `json_schema strict`, `temperature: 0`, `maxRetries: 0`, typowane błędy, `safeParse`. |
| `src/lib/rate-limit.ts` (+ test) | `checkRateLimit`, `getClientIp`. Fixed window na ioredis. |
| `src/lib/redis.ts` | Singleton ioredis. W testach mock jak w `src/app/api/services/route.test.ts`. |
| `src/app/api/submit-contact-query/route.ts` | Transport Gmail. U7 przenosi go do `src/lib/mailer.ts`. |
| `src/lib/queries.ts` | `server-only`. U5 dodaje `findServiceByDomain`. |
| `src/lib/map-url-builder.ts` | `buildServiceUrl`, `localePathPrefix()`. Link do duplikatu bez hardkodu `/en`. |
| `src/app/[locale]/(main)/_components/service-card/service-card.tsx` | Wzorzec wizualny podglądu (777 linii, ma efekty uboczne, nie używamy wprost). |
| `src/app/[locale]/(dashboard)/dashboard/_service-schema.ts` (+ test) | `emptyToNull` + `z.preprocess` dla FormData. |
| `src/app/[locale]/(dashboard)/dashboard/_actions.ts` | `validateImage` (sharp), `useActionState`. Nie kopiujemy zapisu na dysk. |
| `src/app/[locale]/(header)/contact/page.tsx` | U10: CTA pod `<ContactForm />`. |
| `src/i18n/routing.ts` | U9: `pathnames['/add-business']`. |
| `next.config.ts` | U8: `experimental.serverActions.bodySizeLimit: '3mb'`. |
| `messages/{pl,en,ru,uk}.json` | Namespace `addBusiness` + klucz CTA. |
| `.claude/skills/dodaj/SKILL.md`, `references/klasyfikacja.md` | Reguły merytoryczne (fakty, opisy 300–600 znaków, zasięg, języki obsługi, kontrole geokodowania). Źródło dla promptu i `geocode.ts`. |

## Decyzje techniczne (skrót; pełne uzasadnienie w planie technicznym)

- **D1:** dwa kroki. Krok 1 to tylko link albo tryb ręczny. Logo, e-mail i uwagi są w kroku 2.
- **D2:** draft w Redis (`draftId`, TTL 2 h, jednorazowy GETDEL). Kategoria, zasięg, tagi i
  opisy przy submit pochodzą wyłącznie z Redis.
- **D3:** wynik waliduje `serviceInputSchema`. Brak lat/lng przy `local`/`hybrid` tylko
  flagowany w mailu.
- **D4:** fakty w kolejności JSON-LD > dosłownie w tekście źródła > `null` + `unconfirmed`.
- **D5:** prompt z `CATEGORY_CONTEXTS` + stała reguła zasięgu i języków. Bez kopii
  `klasyfikacja.md`.
- **D6:** Server Actions + `useActionState`, `maxDuration = 60` w `page.tsx`. Bez streamingu.
- **D7:** limity (24 h):

  | Klucz | Limit |
  |---|---|
  | `gen:<ip>` | 2, zużywane tuż przed LLM |
  | `gen:global` | 40 |
  | `fetch:<ip>` | 6 |
  | `submit:<ip>` | 2 |
  | relokacja | 10 na draft |

- **D8:** hosty social pomijają fetch i kierują do trybu ręcznego. Duplikaty sprawdzamy tylko
  dla własnych domen.
- **D9:** logo przez sharp: PNG/JPEG/WebP, ≤ 2 MB, PNG ≤ 512 px. Kandydat ze strony pobierany
  dopiero przy submit. Bez SVG.
- **D10:** pin jako statyczny obraz Mapbox + atrybucja. „Sprawdź na mapie” wywołuje
  `relocate`.
- **D11:** maile plain text przez `src/lib/mailer.ts` (Gmail). Do operatora z załącznikami i
  `replyTo`. Do właściciela w jego locale.
- **D12:** `business-card-preview` jako osobny komponent, klasy 1:1 z `service-card`.
- **D13:** ścieżka pl `/dodaj-firme`, en/ru/uk `/add-business`. Strona indeksowalna.
- **D14:** przypięty snapshot `gpt-4.1-mini`, `max_completion_tokens` ok. 3000.

## Zależności

- **Nowa:** `cheerio`, dokładna wersja (decyzja usera 2026-10-11). Guard SSRF bez biblioteki
  (undici `Agent` + własny lookup).
- **Istniejące:** `openai@^4.91`, `sharp@^0.34.5`, `nodemailer@^7`, `ioredis`, `zod@^3.24`,
  `slugify`.
- **Usługi zewnętrzne:**
  - OpenAI;
  - Nominatim (≤ 1 req/s, User-Agent, cache, atrybucja OSM);
  - Gmail SMTP;
  - Mapbox static images (publiczny token `pk.`).
- **Środowisko:** brak nowych zmiennych w `env.ts`.

## Wiedza instytucjonalna do przestrzegania

- FormData: `emptyToNull` + `z.preprocess`; bez `as string`; bez `?? 0`. Testy z polami `''`.
  (`docs/solutions/runtime-errors/2026-08-22-zod-coerce-number-puste-formdata.md`)
- Prefiks locale przez helper, test z asercją negatywną `/en`.
  (`docs/solutions/deployment-issues/2026-08-22-soft-404-notfound-podczas-streamowania.md`)
- Gate przy zatrzymanym dev serverze. Nigdy `npm run build` obok `next dev`.
  (`docs/solutions/build-errors/2026-08-23-jest-worker-exceptions-rywalizacja-o-next.md`)
- Zależność ESM-only w Jest: `moduleNameMapper` na build CJS. Pusty `AggregateError` →
  `error.errors[0].message`.
  (`docs/solutions/testing-issues/2026-08-22-testy-komponentow-esm-i-resizeobserver.md`).
  Dotyczy też `cheerio`, jeśli w testach wejdzie wersja ESM.
- Pamięć projektu:
  - `DATABASE_URL` = produkcja; feature tylko czyta (duplikaty);
  - seed jest jedynym źródłem prawdy;
  - upload na Vercelu jest efemeryczny;
  - pracujemy w worktree, bez `git switch` w głównym katalogu.

## Otwarte (odroczone do implementacji)

- Dokładny prompt i schemat LLM — kształtowane na fixture'ach.
- Normalizacja telefonu przy porównaniu ze źródłem.
- Pełna lista hostów social.
- Czy `ipaddr.js` jest bezpośrednią zależnością. Przechodniej nie używamy.
- Czy `src/app/sitemap.ts` listuje strony statyczne. Jeśli tak, dopisać `/add-business`.
- Brak `docs/DESIGN.md`: UI opiera się na `service-card`, `contact-form` i shadcn/ui.

## Log wykonania — Faza A

### U1 Guard SSRF — completed (commit 6f691b0)
- Pliki: `safe-fetch.ts` (+test), `public-address.ts` (+test) — klasyfikator IP na `net.BlockList`.
- API: `safeFetchHtml(url, opts?)`, `safeFetchImage(url, opts?)` → `{ ok: true, finalUrl, mimeType, body } | { ok: false, code }`; opcje `transport`, `resolveHost`, `timeoutMs` do testów.
- **Odchylenia:**
  - `node:http`/`node:https` z własnym `lookup` zamiast undici `Agent` — undici nie jest zależnością; ochrona w chwili połączenia ta sama, zero nowych paczek.
  - Nowy kod `NETWORK_ERROR` (DNS ENOTFOUND, odmowa połączenia, TLS).
  - Jeden timeout 8 s na całą operację (z redirectami i body), nie per żądanie.
  - Wydzielony `public-address.ts` (limit 300 linii).
- Notatki dla konsumentów: `safeFetchImage` przepuszcza `image/svg+xml` — U6 odrzuca SVG przez sharp `metadata()`. Charset tylko z nagłówka HTTP. Obrazek: limit 1 MB.

### U2 Ekstrakcja HTML + link-kind — completed (commit f6f16d7)
- Pliki: `html-extract.ts`, `jsonld-facts.ts`, `link-kind.ts` (+testy), fixtures w `tests/fixtures/add-business/`. `cheerio@1.2.0` (exact).
- API: `extractPage(html, finalUrl)` → `{ text, facts: StructuredFacts, logoCandidates, contactLinks }`; `classifyLink(url)` → `social | own-domain | invalid`.
- Lista hostów social (doprecyzowanie D8): instagram, facebook/fb/messenger/m.me, tiktok, youtube/youtu.be, linkedin, x/twitter, t.me/telegram.me, wa.me/whatsapp, viber, threads, pinterest, maps.app.goo.gl, g.page, business.site, tripadvisor, booksy, znanylekarz.pl, olx.pl, linktr.ee + Google Maps po ścieżce.
- **Odchylenie:** wydzielony `jsonld-facts.ts` (limit 300 linii), pokryty testami przez `html-extract.test.ts`.
- Cheerio w Jest (środowisko node) działa bez `moduleNameMapper`.

### U3 Szkic LLM + verify-facts — completed (commit 4d42c7b)
- Pliki: `draft-schema.ts`, `llm-draft.ts`, `verify-facts.ts` (+testy).
- Model `gpt-4.1-mini-2025-04-14`, ręczny JSON schema (nie `zodResponseFormat` — emituje `nullable: true`).
- Nazwy pól faktów = nazwy z `serviceInputSchema` (`phoneNumber`, nie `phone`).
- **Odchylenia:** w `fromOwner` puste pola właściciela trafiają do `unconfirmed` (D4/R4); dodatkowe przypadki `INVALID_RESPONSE` (odmowa, nie-JSON, < 3 tagi).
- Do zrobienia w U8/U9: `''` → `null` przed `fromOwner`; `facts.name` może być `null` — UI wymusza nazwę przed wysyłką. Prompt nie był sprawdzony na prawdziwym modelu — ręczny przebieg w Operator checklist U9.

### U4 Geokodowanie — completed (commit 20a9af7)
- API: `geocodeAddress({ street, city }, { knownGeo?, fetchImpl?, sleep? })` → `{ ok: true, lat, lng, postcode | null, voivodeship | null, approximate } | { ok: false, code: NOT_FOUND | MISMATCH | RATE_LIMITED | UPSTREAM_FAILED }`.
- Cache trzyma surową odpowiedź po walidacji zod; kontrole liczone przy każdym odczycie. Awaria Redisa → wyjątek (U8 obsługuje).
- **Odchylenia:** `postcode`/`voivodeship` zawsze obecne jako `null` zamiast opcjonalnych; HTTP 429 → `RATE_LIMITED`.

### U5 Draft store, limity, duplikaty — completed (commit 1631ba1)
- Pliki: `draft-store.ts`, `limits.ts`, `domain-match.ts` (+testy), `tests/fixtures/add-business/fake-redis.ts`; modyfikacje `rate-limit.ts` (`peekRateLimit`), `queries.ts` (`findServiceByDomain`).
- API: `saveDraft`, `getDraft`, `consumeDraft` (GETDEL), `updateDraftGeo` (`SET KEEPTTL XX`), `reserveRelocation`; `peekGenerationLimit`, `consumeGenerationLimit`, `consumeFetchLimit`, `consumeSubmitLimit`; `findServiceByDomain(host, locale)` → `{ name, slug } | null`.
- `StoredDraft.geo` trzyma adres, który geokodowano. Submit geokoduje ponownie tylko przy zmianie adresu.
- **Odchylenia:**
  - licznik relokacji to osobny atomowy klucz (`checkRateLimit`, okno = TTL draftu), a nie pole w JSON-ie — odczyt, zmiana i zapis przepuszczałyby równoległe relokacje;
  - `peekRateLimit` trafił do `rate-limit.ts` (ten sam licznik co `checkRateLimit`, jego zachowanie bez zmian);
  - dodatkowe pliki `domain-match.ts` i `fake-redis.ts`.
- Operator: Redis musi obsługiwać `GETDEL` i `SET KEEPTTL` (≥ 6.2). Do potwierdzenia dla obecnego `REDIS_URL`.

### U6 JSON wpisu + logo — completed (commit eed5ad7)
- API: `parseOwnerEdits(formData)` → `{ ok, data: OwnerEdits } | { ok: false, fieldErrors }` (wartości to klucze `addBusiness.errors.*` z `OWNER_EDIT_ERRORS` — U9 dodaje je do 4 locale); `buildServiceJson({ stored, edits, geo, hasLogo })`; `processLogoUpload(file)`, `processLogoCandidate(url)`.
- Nazwy pól FormData: `name, street, postcode, city, phoneNumber, email, webpage, hours.<day>.open|close, languages (getAll), submitterEmail, notes`.
- Decyzje:
  - formularz to pełny stan pól, nie lista różnic;
  - pole uzupełnione przez właściciela schodzi z `unconfirmed`, ale zostaje w `changedByOwner`;
  - bazą do porównania `webpage` jest `sourceUrl`;
  - JSON bez kluczy `null` i bez `slug`, ze `status: 'active'`, `verified: false`;
  - `city` jest wymagane zawsze, także dla `online` (wymaga tego schemat).
- **Odchylenie:** brak, poza kolejnością (test per moduł, nie per scenariusz). Komentarz w `draft-schema.ts` poprawiony przez orkiestratora: `languages` są edytowalne, R9 obejmuje tylko kategorię, zasięg, tagi i opisy.

### U7 Maile — completed (commit bb13389)
- API: `sendMail(msg)` → `{ ok: true } | { ok: false, code: 'SEND_FAILED' }`. Nigdy nie rzuca; surowy błąd SMTP trafia do logu tylko jako `{ name, code, responseCode }`. `buildOperatorEmail(input)`, `buildOwnerConfirmationEmail(input)` to czyste funkcje zwracające `MailMessage`.
- Potwierdzenie używa `createTranslator` z next-intl na `messages/*.json`, bez kontekstu requestu, więc da się je testować i TS sprawdza klucze. 25 kluczy `addBusiness.confirmationEmail.*` w 4 locale.
- Trasa kontaktu: błąd wysyłki daje 500 `{ success: false, message, error: { code: 'SEND_FAILED', message } }`. `success`/`message` zostały dla `contact-form.tsx`. Nowy test trasy.
- **Odchylenia:**
  - nowy klucz `contact.sendFailed` w 4 locale (komunikat zamiast `String(error)`);
  - unia zamiast klasy `MailerError`.
- **Znalezisko poza zakresem (zgłoszone, nie naprawione):** `submit-contact-query/route.ts` używa `ContactFormSchema.parse` i `req.json()` bez obsługi błędów. Złe wejście daje 500 zamiast 400. Kandydat na osobny fix.

## Gate Fazy A (2026-10-11)
- `npx tsc --noEmit`: 0 błędów
- `npx jest`: 62 suity, 770/770 PASS
- `npx next lint`: 0 błędów; nowe warningi to `no-undef` (globale jest, jak w całym repo) i `console.warn` w logach modułów (repo nie ma loggera)
- `npm run build`: OK. Worktree nie ma `.env`, więc build idzie z env głównego checkoutu załadowanym przez `@next/env`, z usuniętym `NODE_ENV`. `.env` ustawia `NODE_ENV`, a to psuje prerender `/404` (`<Html> should not be imported`).

## Notatki dla Fazy B (U8–U10)
- U8 kolejność: `classifyLink` (social → manual) → `findServiceByDomain` (tylko own-domain) → `peekGenerationLimit` → `consumeFetchLimit` → `safeFetchHtml` + ≤ 2 `contactLinks` → `consumeGenerationLimit` → `fromPage` → `geocodeAddress(…, { knownGeo })` → `saveDraft`.
- U8 obsługuje kod `NETWORK_ERROR` z safe-fetch oraz wyjątek przy niedostępnym Redisie (geocode, draft-store).
- U8 relocate: `getDraft` → `reserveRelocation` → geocode → `updateDraftGeo`.
- U8 submit: `parseOwnerEdits` → `consumeSubmitLimit` → `consumeDraft` → geocode, jeśli adres różni się od `stored.geo.address` → logo (upload albo `logoCandidate`) → `buildServiceJson` → `sendMail(operator)`; przy porażce log z JSON + `SEND_FAILED` → `sendMail(confirmation)`, której porażka idzie tylko do logu.
- U8: `bodySizeLimit: '3mb'` w `next.config.ts`.
- U9: klucze `addBusiness.errors.*` (`OWNER_EDIT_ERRORS`) w 4 locale; nazwy pól jak w `parseOwnerEdits`; `name` i `city` wymagane; ostrzeżenie przy `approximate: true`.
- Testy U8 mogą użyć `tests/fixtures/add-business/fake-redis.ts`.

## Review Fazy A (2026-10-11)
- Raport: `review-faza-A.md`. 4 reviewerów (security, performance, architektura/TS, scenariusze). E2E pominięte, bo faza nie ma UI.
- Gate: ⚠️ kontynuuj z zastrzeżeniami. 0 × P1, 14 × P2, 28 × P3. 14 checkboxów `Weryfikacja:` (CLI) odznaczonych.
- Wnioski:
  - Rdzeń SSRF solidny; wszystkie scenariusze z planu mają testy. Przepływ end-to-end przez moduły daje JSON zgodny z `serviceInputSchema`.
  - Najsłabsze miejsce: `verify-facts`. Podciąg bez granic słów potwierdza zmyślone miasto/numer, a sklejanie liczb gubi prawdziwe telefony. To jedyna bariera przed wymyślonymi danymi.
  - Kontrakty dla U8 do domknięcia przed fazą B: walidacja przy zapisie draftu, jeden schemat `BusinessDraft`, wspólny `TIME_PATTERN`/`WEEKDAY_KEYS`.
  - Budżet czasu 60 s jest ciaśniejszy niż w planie (podstrony sekwencyjnie, LLM 30 s). U8 potrzebuje jednego deadline'u.
  - `next.config.ts` `removeConsole` wycina na produkcji wszystkie logi, więc mitygacja `SEND_FAILED` z planu nie działa. Decyzja usera.

## Poprawki po review Fazy A (2026-10-11)

Decyzje usera: najpierw poprawki, potem Faza B; `removeConsole: { exclude: ['error','warn'] }`.
Wykonanie: 4 subagenci `feature-builder-web-data` (3 równolegle na rozłącznych plikach, potem
`verify-facts`), #14 inline.

| Commit | Zakres | Najważniejsze |
|---|---|---|
| `5b0c286` | P2 #6, #7, #8, #13, P3 #17 | Jeden `businessDraftSchema` (typy przez `z.infer`). `saveDraft`/`updateDraftGeo` robią `parse` przy zapisie i rzucają `ZodError` (błąd programisty). Nowy `toDraftGeo(result, address)`. `TIME_PATTERN`, `WEEKDAY_KEYS`, `Weekday`, `openingHoursSchema`, `tagInputSchema` eksportowane z `service-input-schema.ts`. Nowe lekkie moduły `src/lib/coverage.ts`, `voivodeships.ts`, `service-status.ts`; `service-input-schema.ts` nie importuje już `./schema`. Wartości enumów bez zmian (bez `drizzle-kit push`). |
| `6e4bd31` | P2 #1, #2 | `LOGO_MAX_INPUT_PIXELS = 4096²`, `failOn: 'error'`, jedna instancja sharp. `stripDelimiters` (eksport) usuwa ciągi `<{3,}`/`>{3,}`. |
| `288658b` | P2 #3, #11, #12 | `checkRateLimit`: `MULTI SET NX EX + INCR + TTL`, samonaprawa przy `TTL -1`, `RateLimitStoreError`. `rateLimitSubject(ip)` (IPv6 → /64, IPv4-mapped → IPv4) tylko w kluczach `limits.ts`. `domainLikePatterns(host)` + `LIMIT 100`. Nowy `src/lib/queries.test.ts` (mock `@/db`, SQL renderowany przez `PgDialect`). |
| `770b665` | P2 #4, #5, P3 #1, #28 | Granice słów Unicode, `MIN_TEXT_FACT_LENGTH = 3`, `verifyPostcode`. Telefon szukany w oknach grup cyfr (≤ 6 grup, ≤ 13 cyfr). Telefon z LLM ze znakami spoza `[\d\s()+.-]` odrzucony. |
| `1640e9d` | P2 #14 | `removeConsole` z `exclude: ['error', 'warn']`. |

**Odchylenia (zalogowane przez subagentów, zaakceptowane):**
- Fixture `DRAFT` w `draft-store.test.ts` ma 3 tagi zamiast 1, bo jednolity schemat wymaga 3–5. Asercje bez zmian.
- `rate-limit.test.ts` przepisany na `createFakeRedis`. Asercje na wywołania mocków (`expire` wywołany / niewywołany) zastąpione asercjami na stan klucza (TTL 60/40, licznik nietknięty po `peek`). Wartości oczekiwane bez zmian; orkiestrator sprawdził diff, osłabień brak.
- `services/route.test.ts`: mock Redisa → fake z `multi`. `fake-redis.ts` ma `multi()` i synchroniczne komendy wewnętrzne.
- `verify-facts-text.test.ts` wydzielony (limit 300 linii).
- Telefon od LLM musi mieć dokładnie 9 cyfr krajowych; numery zagraniczne od LLM odrzucane (z JSON-LD przechodzą).
- Wzorce parsowania godzin w `jsonld-facts.ts` (`SCHEMA_ORG_TIME_PATTERN`) i `verify-facts.ts` celowo zostały lokalne: parsują luźne wejście przed normalizacją.
- `src/lib/service-status.ts`: moduł spoza zakresu, potrzebny, żeby `service-input-schema` nie importował `pg-core`.

**Kontrakty dla U8 (zmienione):**
- Geo do draftu wyłącznie przez `toDraftGeo(result, address)`.
- Typ `Voivodeship` z `@/lib/voivodeships`; `geocode.ts` go już nie eksportuje.
- `WEEKDAY_KEYS` z `@/db/service-input-schema`, nie z `draft-schema`.
- `checkRateLimit` może rzucić `RateLimitStoreError` (jak wcześniej `redis.incr`).

**Otwarte:**
- P2 #9 (deadline 60 s) → U8; P2 #10 (pomiar LLM) → Operator checklist U9.
- Globalny limit fetch (decyzja). `x-vercel-forwarded-for` jako twardsza alternatywa dla `x-forwarded-for` (decyzja).
- P3 #13 (`queries.ts` importuje z folderu feature'a, teraz też `domainLikePatterns`), P3 #23 (`EMAIL_PATTERN`) i pozostałe P3.
- Poza zakresem: `dashboard/_service-schema.ts` używa `*Enum.enumValues` z `@/db/schema`, więc wciąga `pg-core`.

**Gate (2026-10-11):** `tsc` 0 błędów; `jest` 64 suity, 825/825 PASS; `next lint` 0 błędów;
`npm run build` OK (env głównego checkoutu przez `@next/env`, bez `NODE_ENV`).

## Log wykonania — Faza B (2026-10-11)

### U8 Orkiestracja + Server Actions — completed (commit 5228704)
- Pliki: `types.ts`, `generate-draft.ts`, `submit-draft.ts`, `relocate-draft.ts`, `action-errors.ts` (`withActionBoundary`, `server-only`), `page-sources.ts`, `manual-input-schema.ts`, `draft-geo.ts`, `preview.ts`, `_actions.ts`; testy + `tests/fixtures/add-business/generate-draft-harness.ts`. `bodySizeLimit: '3mb'`.
- API dla UI: `generateDraftAction` (`mode` = `link` | `manual`), `relocateDraftAction`, `submitDraftAction`, wszystkie `(prev, formData) => Promise<Result>`. Kody UI: `GENERATION_FAILED`, `DRAFT_EXPIRED`, `RELOCATION_LIMIT`, `ADDRESS_NOT_FOUND`, `GEOCODE_UNAVAILABLE`, `INVALID_ENTRY`, `SEND_FAILED`, `INTERNAL`.
- Budżet czasu (review A P2 #9): `GENERATION_BUDGET_MS = 50 000`, `GEOCODE_RESERVE_MS = 9 500`, fetch dostaje resztę po LLM 30 s. Podstrony mają limit 4 s, fallbacki `/kontakt` 2 s, a przy budżecie < 1 s są pomijane.
- **Odchylenia:**
  - kolejność `generateDraft`: social → peek gen → limit fetch → duplikat → fetch. **Decyzja usera 2026-10-11:** zapytanie do bazy idzie za limitem. Duplikat zużywa 1 z 6 fetchy, a przy wyczerpanym limicie generowania właściciel widzi „limit”, nie „duplikat”;
  - kolejność `submitDraft`: wszystko, co może zawieść (walidacja uploadu, limit, geokodowanie, kandydat logo), dzieje się przed `consumeDraft`;
  - tryb ręczny bez godzin: trafiają do `unconfirmed`, a właściciel uzupełnia je w edytorze;
  - log `SEND_FAILED` zawiera `entry.json`, ale nie `submitterEmail` ani `notes` (review A P3 #5);
  - nowe eksporty w Fazie A: `DRAFT_TIMEOUT_MS`, `mergeFacts`, `CONTACT_FALLBACK_PATHS`, `optionalText/Email/Webpage`.

### U9 Strona i komponenty — completed (commit e099104)
- `page.tsx` (`maxDuration = 60`, `generateStaticParams`, metadata przez `getPathname`), flow (`FlowState` + `useOptimistic`), `link-step`, `manual-step`, `draft-editor` (+ `relocate-control`, `opening-hours-fields`, `languages-field`, `generated-summary`), `business-card-preview` (+ `static-map-pin`, stories), `submitted-state`, wspólne `form-field`, `flow-heading`, `generation-progress`, `flow-notices`. Routing `/dodaj-firme`. Sitemap pl+en. Test spójności kluczy `addBusiness.*` w 4 locale.
- Decyzje:
  - `next/image` z `unoptimized` dla Mapboxa, blob i kandydata logo (bez `remotePatterns`);
  - przyciski z `aria-disabled`;
  - fokus na `h2` każdego kroku;
  - po `SEND_FAILED`, `INVALID_ENTRY` i `DRAFT_EXPIRED` powrót do kroku link (draft zużyty).
- Pomiar logo: `left` 12 px mobile, 16 px od `md`, jak w `service-card`. Do sprawdzenia przez operatora.
- **Odchylenia:** dodatkowe pliki (limit 300 linii), `preview-fixture.ts` obok komponentu (Storybook), logo/e-mail/uwagi w kroku 2 (D1, nie R2).
- **Ryzyko do decyzji usera:** token `pk.` Mapboxa na sztywno w `overview-map.tsx` należy do obcego konta (`hijiangtao`). Teraz jest też w `static-map-url.ts` (`MAPBOX_PUBLIC_TOKEN`). Propozycja: własny token jako `NEXT_PUBLIC_*` w `env.ts`.
- Wniosek do `docs/solutions/`: React 19 łączy trwające akcje async; niezakończona obietnica akcji w teście blokuje kolejne testy.

### U10 CTA na /kontakt — completed (commit 3b1e0a3)
- `add-business-cta.tsx` (Server Component z `useTranslations`, `buttonVariants({ variant: 'addBusiness', size: 'lg' })`), `<section aria-labelledby>` z `h2`. Klucze `addBusiness.cta.{heading,description,button}`.
- **Odchylenie:** dodany nagłówek sekcji (dostępna nazwa regionu).
- Poza zakresem (zgłoszone): martwy import `Header` i nieposortowane importy w `contact/page.tsx`; `map/[[...slug]]/page.tsx:121` daje dla `pl` `/map?…` zamiast `/mapa?…` po odrzuceniu starych filtrów (z raportu U8).

## Gate Fazy B (2026-10-11)
- `npx tsc --noEmit`: 0 błędów
- `npx jest`: 85 suit, 963/963 PASS
- `npx next lint`: 0 błędów (warningi `no-undef` jest i istniejące wcześniej)
- grep: zero `any`, `console.log`, `process.env` w `src/lib/add-business/**` i `add-business/**`; zero `next/link` / `next/navigation`
- `npm run build`: OK; `/[locale]/add-business` prerenderowane dla 4 locale

## Review Fazy B (2026-10-11)
Raport: `review-faza-B.md`. Gate: ⚠️ kontynuuj z zastrzeżeniami. Wynik: 0 × P1, 11 × P2, 37 × P3.
Reviewerzy: security, performance, architektura/TS, scenariusze. E2E pominięte, bo
wszystkie scenariusze przeglądarkowe to `[Manual]`.

**Kluczowe wnioski:**
- **Wysyłka (`submitDraft`) jest najsłabszym miejscem:**
  - sharp działa przed limitem wysyłek, więc jeden szkic pozwala na nielimitowane dekodowanie obrazów;
  - SMTP nie ma timeoutów, więc zawieszony Gmail po `consumeDraft` gubi zgłoszenie bez logu.

  Poprawka: peek limitu przed sharpem, geo ∥ logo, timeouty transportu.
- **Bundle klienta:** stałe importowane z modułów zod/`src/db` ciągną schematy i `slugify`.
  Potrzebne są lekkie moduły stałych. Ta sama klasa problemu co P2 #13 z fazy A.
- **Testy:** brakuje testów ścieżek błędów orkiestratorów (gałęzie limitów, porażka
  geokodera) oraz własnych testów `manual-input-schema` i `page-sources`. Scenariusze z planu
  są pokryte w całości.
- **Token Mapbox:** nadal czeka na decyzję usera. Dwóch reviewerów potwierdziło, że to P2.
- **Bookkeeping:** 9/9 checkboxów `Weryfikacja:` fazy B jest odznaczonych (CLI/grep PASS).
  Wzorzec `(header)` w komendach jest w checklistach i w planie dopasowywał 0 plików (nawiasy
  w regexie); poprawiony na `\(header\)`. Kolejność kroków `generateDraft` w `zadania.md`
  została uzgodniona z kodem.
- **Potwierdzone jako poprawne:**
  - R9 (z FormData czytane są tylko pola R8);
  - atomowość `consumeDraft`;
  - budżet generowania ≈ 50–51 s;
  - brak XSS i open redirect;
  - wyczerpujące unie stanów;
  - zero `any`/`as`/`!`.
