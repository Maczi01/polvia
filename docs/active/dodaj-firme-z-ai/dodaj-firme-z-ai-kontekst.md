# Dodaj firmę z AI — kontekst

Branch: `feature/dodaj-firme-z-ai`
Worktree: `C:\Users\mateu\WebstormProjects\polvia-dodaj-firme-ai`
Ostatnia aktualizacja: 2026-10-11 (Faza A ukończona)

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
