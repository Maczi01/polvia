# Dodaj firmę z AI — zadania

Branch: `feature/dodaj-firme-z-ai`
Worktree: `C:\Users\mateu\WebstormProjects\polvia-dodaj-firme-ai`
Ostatnia aktualizacja: 2026-10-11 (Faza B ukończona)

Szczegóły podejścia per unit: `docs/plans/2026-10-11-001-feat-dodaj-firme-z-ai-plan.md`.

## Faza A — moduły serwerowe ✅

### U1: Guard SSRF — `feature-builder-web-data` — M

- [x] Stwórz `src/lib/add-business/safe-fetch.ts`:
  - walidacja URL;
  - undici `Agent` z własnym lookupem;
  - ręczne redirecty ≤ 3;
  - timeout 8 s;
  - limit 2 MB;
  - content-type HTML i wariant obrazkowy;
  - wynik jako unia z kodami.
- [x] Stwórz `src/lib/add-business/safe-fetch.test.ts`
- [x] Test: klasyfikator IP odrzuca `127.0.0.1`, `10.0.0.5`, `172.16.0.1`, `192.168.1.1`,
  `169.254.169.254`, `100.64.0.1`, `0.0.0.0`, `::1`, `fc00::1`, `fe80::1`, `::ffff:127.0.0.1`
  i przepuszcza publiczne IPv4/IPv6
- [x] Test: `file:`, `ftp:`, `javascript:`, userinfo, port 22 → `INVALID_URL`
- [x] Test: redirect na adres prywatny → `BLOCKED_ADDRESS`; 4 redirecty → `TOO_MANY_REDIRECTS`
  (transport mockowany)
- [x] Test: za duża odpowiedź → `TOO_LARGE`; `application/pdf` → `BAD_CONTENT_TYPE`; brak
  odpowiedzi → `TIMEOUT`
- [x] Test: 200 `text/html` → `ok: true` z `finalUrl` po redirectcie
- [x] Weryfikacja: `npx jest src/lib/add-business/safe-fetch.test.ts` przechodzi
- [x] Weryfikacja: `npx tsc --noEmit` bez błędów

### U2: Ekstrakcja HTML + `link-kind` — `feature-builder-web-data` — M

- [x] Dodaj `cheerio` (dokładna wersja) do `package.json` / `package-lock.json`
- [x] Stwórz `src/lib/add-business/html-extract.ts`:
  - tekst ≤ 12 tys. znaków;
  - JSON-LD `LocalBusiness`/`@graph` z walidacją zod;
  - godziny z dniami lowercase;
  - kandydaci logo;
  - link kontaktu (≤ 2 podstrony).
- [x] Stwórz `src/lib/add-business/link-kind.ts`: normalizacja hosta, wykrycie social
- [x] Stwórz fixtures `tests/fixtures/add-business/`:
  - `local-business-jsonld.html`
  - `no-jsonld.html`
  - `graph-jsonld.html`
- [x] Stwórz testy `html-extract.test.ts`, `link-kind.test.ts`
- [x] Test: fixture z `LocalBusiness` → adres, telefon, godziny (lowercase), geo
- [x] Test: `@graph` + zepsuty blok JSON-LD → poprawny węzeł wyciągnięty, błąd zalogowany,
  brak wyjątku
- [x] Test: brak JSON-LD → puste fakty strukturalne, niepusty tekst bez skryptów
- [x] Test: względny `apple-touch-icon` → absolutny URL; brak og:image → następny kandydat
- [x] Test: `instagram.com/x` i `maps.app.goo.gl/…` → social; `https://WWW.Firma.pl/o-nas` →
  `firma.pl`
- [x] Weryfikacja: `npx jest src/lib/add-business/html-extract.test.ts src/lib/add-business/link-kind.test.ts`
  przechodzi
- [x] Weryfikacja: `npx tsc --noEmit` bez błędów

### U3: Szkic LLM + weryfikacja faktów — `feature-builder-web-data` — L

> Notatka wykonawcza: `verify-facts` test-first.

- [x] Stwórz `src/lib/add-business/draft-schema.ts`:
  - płaski schemat strict, pola nullable;
  - `category` z `CATEGORY_VALUES`;
  - typ `BusinessDraft`.
- [x] Stwórz `src/lib/add-business/llm-draft.ts`:
  - `fromPage` / `fromOwner`;
  - wstrzykiwany klient;
  - prompt z danymi w ogranicznikach + `CATEGORY_CONTEXTS`;
  - `DraftGenerationError`.
- [x] Stwórz `src/lib/add-business/verify-facts.ts`
- [x] Stwórz testy `llm-draft.test.ts`, `verify-facts.test.ts`
- [x] Test: telefon z LLM nieobecny w źródle → `null` + `phone` w `unconfirmed`
- [x] Test: JSON-LD telefon A, LLM B → A
- [x] Test: źródło `+48 22 123-45-67`, LLM `221234567` → przyjęty po normalizacji
- [x] Test: `APIError` → `UPSTREAM_FAILED`; odpowiedź niezgodna ze schematem →
  `INVALID_RESPONSE`
- [x] Test: `fromOwner` → fakty właściciela bez zmian i bez `unconfirmed`; opis właściciela w
  prompcie
- [x] Test: kategoria spoza enumu → `INVALID_RESPONSE` (nie ciche `others`)
- [x] Weryfikacja: `npx jest src/lib/add-business/llm-draft.test.ts src/lib/add-business/verify-facts.test.ts`
  przechodzi
- [x] Weryfikacja: `npx tsc --noEmit` bez błędów

### U4: Geokodowanie — `feature-builder-web-data` — M

- [x] Stwórz `src/lib/add-business/geocode.ts`:
  - Nominatim, User-Agent z `env.NEXT_PUBLIC_SITE_URL`;
  - cache Redis 30 dni (również „nie znaleziono”);
  - blokada `SET NX PX 1000`;
  - kontrole miasta i zakresu PL;
  - `approximate`;
  - mapowanie województwa.
- [x] Stwórz `src/lib/add-business/geocode.test.ts`
- [x] Test: trafienie w cache → brak `fetch`
- [x] Test: wynik spoza PL / inne miasto → `MISMATCH`
- [x] Test: brak `house_number` → `approximate: true`
- [x] Test: zajęta blokada przy obu próbach → `RATE_LIMITED` bez sieci
- [x] Test: `województwo mazowieckie` → `mazowieckie`
- [x] Weryfikacja: `npx jest src/lib/add-business/geocode.test.ts` przechodzi
- [x] Weryfikacja: `npx tsc --noEmit` bez błędów

### U5: Draft store, limity, duplikaty — `feature-builder-web-data` — M

- [x] Stwórz `src/lib/add-business/draft-store.ts`:
  - save / get / consume (GETDEL);
  - TTL 2 h;
  - walidacja zod przy odczycie;
  - licznik relokacji.
- [x] Stwórz `src/lib/add-business/limits.ts`: stałe D7, `peek` / `consume`, klucz IP +
  globalny
- [x] Modyfikuj `src/lib/queries.ts`: `findServiceByDomain(host, locale)`. Zawężenie w SQL,
  dokładne porównanie hosta, tylko aktywne wpisy.
- [x] Stwórz testy `draft-store.test.ts`, `limits.test.ts`
- [x] Test: `save` → `consume` zwraca draft; drugi `consume` → `DRAFT_EXPIRED`
- [x] Test: uszkodzony JSON w Redis → `DRAFT_EXPIRED` + log, bez wyjątku
- [x] Test: trzecie `consume` `gen:<ip>` → `allowed: false` z `retryAfter`; `peek` nie
  inkrementuje
- [x] Test: wyczerpany limit globalny blokuje mimo wolnego limitu IP
- [x] Weryfikacja: `npx jest src/lib/add-business/draft-store.test.ts src/lib/add-business/limits.test.ts`
  przechodzi
- [x] Weryfikacja: `npx tsc --noEmit` bez błędów

### U6: JSON wpisu + logo — `feature-builder-web-data` — L

> Notatka wykonawcza: zacznij od testu kontraktu z `serviceInputSchema`.

- [x] Stwórz `src/lib/add-business/build-service-json.ts`:
  - scalenie draft + edycje;
  - `changedByOwner`;
  - `image: <slug>.png` tylko gdy jest logo;
  - `missingCoordinates`.
- [x] Stwórz `src/lib/add-business/owner-edits-schema.ts`:
  - `emptyToNull` + `z.preprocess`;
  - godziny jako 7 par;
  - języki z dozwolonego zbioru;
  - URL http(s);
  - e-mail zgłaszającego;
  - uwagi ≤ 2000.
- [x] Stwórz `src/lib/add-business/logo.ts`:
  - ≤ 2 MB;
  - format przez sharp `metadata()`;
  - PNG ≤ 512 px;
  - kandydat przez safe-fetch (wariant obrazkowy).
- [x] Stwórz fixtures `tests/fixtures/add-business/logo.png`, `fake-png.svg`
- [x] Stwórz testy `build-service-json.test.ts`, `owner-edits-schema.test.ts`, `logo.test.ts`
- [x] Test: pełny draft `hybrid` + edycje → `serviceInputSchema.safeParse` sukces; `image` =
  `<slug>.png`
- [x] Test: draft `local` bez współrzędnych → wynik + `missingCoordinates: true`, brak wyjątku
- [x] Test: edycja telefonu → `changedByOwner` zawiera `phoneNumber`; niezmienione pole nie
- [x] Test: FormData z każdym polem `''` → `null`, nie `0`; puste godziny → dzień pominięty
- [x] Test: zły e-mail zgłaszającego → błąd pola z kluczem tłumaczenia
- [x] Test: poprawny PNG → PNG ≤ 512 px; SVG jako `.png` → `INVALID_LOGO`; 3 MB →
  `LOGO_TOO_LARGE`
- [x] Weryfikacja: `npx jest src/lib/add-business/build-service-json.test.ts src/lib/add-business/owner-edits-schema.test.ts src/lib/add-business/logo.test.ts`
  przechodzi
- [x] Weryfikacja: `npx tsc --noEmit` bez błędów

### U7: Maile — `feature-builder-web-data` — M

- [x] Stwórz `src/lib/mailer.ts`: transport Gmail z `env`, `sendMail` z typowanym błędem
- [x] Modyfikuj `src/app/api/submit-contact-query/route.ts`: użycie `mailer.ts`, bez
  `String(error)` w odpowiedzi
- [x] Stwórz `src/lib/add-business/submission-emails.ts`:
  - operator: plain text, sekcje, komenda dry-run, załączniki, `replyTo`;
  - właściciel: plain text w locale zgłoszenia.
- [x] Stwórz testy `src/lib/mailer.test.ts`, `src/lib/add-business/submission-emails.test.ts`
- [x] Test: mail operatora ma „Niepotwierdzone”, uwagi i 2 załączniki `<slug>.json` /
  `<slug>.png`; JSON się parsuje
- [x] Test: nazwa z `\r\n` → temat bez nowych linii
- [x] Test: potwierdzenie `uk` z tekstem z `messages/uk.json`
- [x] Test: błąd transportu → typowany błąd bez surowego komunikatu
- [x] Test: trasa kontaktu działa po przejściu na `mailer.ts`
- [x] Weryfikacja: `npx jest src/lib/add-business/submission-emails.test.ts src/lib/mailer.test.ts`
  przechodzi
- [x] Weryfikacja: `npx tsc --noEmit` bez błędów

## Do poprawy po review fazy A

Raport: `review-faza-A.md`. Gate: ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 14 × P2, 28 × P3).
Poprawki wykonane 2026-10-11 (commity `5b0c286`..`1640e9d`); #9 i #10 przeniesione do U8/U9.

- [x] 🟠 [important] **src/lib/add-business/logo.ts:34-47** — sharp bez `limitInputPixels` (bomba dekompresyjna); limit 4096², jedna instancja, test z dużym wymiarem
- [x] 🟠 [important] **src/lib/add-business/llm-draft.ts:122-124** — `stripDelimiters` nieidempotentny (zagnieżdżony znacznik przeżywa); usuwać `<{3,}`/`>{3,}` lub nonce + test
- [x] 🟠 [important] **src/lib/rate-limit.ts:39-47 / limits.ts:35-46** — klucze od pełnego IPv6; normalizacja do /64 ✅; `x-forwarded-for` udokumentowane w `getClientIp`; globalny limit fetch NIE dodany (otwarte, decyzja)
- [x] 🟠 [important] **src/lib/add-business/verify-facts.ts:63-69** — `verifyText` po podciągu („Gdańsk” w „ul. Gdańska”); granice Unicode, postcode `^\d{2}-\d{3}$`, min. długość + testy
- [x] 🟠 [important] **src/lib/add-business/verify-facts.ts:28** — sklejanie sąsiednich liczb gubi prawdziwy telefon; okna grup cyfr 9–11 + 3 testy
- [x] 🟠 [important] **src/lib/add-business/draft-store.ts:154-191** — zapis bez walidacji vs strict odczyt (ciche `DRAFT_EXPIRED`); `parse` przy zapisie + `toDraftGeo()` z testem
- [x] 🟠 [important] **draft-store.ts:72-129 vs draft-schema.ts:40-80** — zduplikowany, luźniejszy schemat `BusinessDraft`; jeden schemat w `draft-schema.ts`, typ przez `z.infer`
- [x] 🟠 [important] **owner-edits-schema.ts:37, jsonld-facts.ts:35-44, draft-schema.ts:27-35** — `TIME_PATTERN`/dni w 4 miejscach; eksport z `src/db/service-input-schema.ts`
- [x] 🟠 [important] **src/lib/queries.ts:314-318** — `ILIKE %host%` + `LIMIT 20` gubi duplikat przy krótkim hoście; zakotwiczone wzorce, `normalizeHost` w funkcji, test > 20 kandydatów
- [x] 🟠 [important] **src/lib/rate-limit.ts:61-65** — `INCR`/`EXPIRE` nieatomowe (klucz globalny bez TTL = trwała blokada); `MULTI SET NX EX + INCR + TTL` + samonaprawa
- [x] 🟠 [important] **src/lib/add-business/draft-schema.ts:5** — import `coverageEnum` z `@/db/schema` ciągnie drizzle do potencjalnego bundla klienta; `COVERAGE_VALUES` w lekkim module
- [x] 🟠 [important] **next.config.ts:13** — `removeConsole` wycina `warn`/`error` na produkcji; `exclude: ['error','warn']` (decyzja usera 2026-10-11)
- [x] 🟠 [important] **U8 (orkiestrator) / plan tabela ryzyk** — budżet 60 s → przeniesione do U8 (zadanie „jeden deadline” niżej)
- [x] 🟠 [important] **llm-draft.ts:36-39** — timeout LLM 30 s → przeniesione do Operator checklist U9 (pomiar p50/p95)
- [ ] 🟡 [nit] 28 sugestii P3 — lista w `review-faza-A.md`. Zrobione przy okazji: #1, #17, #28. Otwarte m.in.: #13 (`queries.ts` → `domain-match`), #23 (`EMAIL_PATTERN`), rekurencja `flattenNodes`, `tel:`/`24:00` w JSON-LD, `normalizeHours({})`, nesting > 2, testy graniczne i współbieżności

## Faza B — akcje, strona, wejście ✅

### U8: Orkiestracja + Server Actions — `feature-builder-web-data` — L

> Notatka wykonawcza: orkiestratory testowane z wstrzykniętymi fałszywymi zależnościami
> zewnętrznymi.

- [x] Stwórz `src/lib/add-business/types.ts`: unie wyników `generateDraft`, `relocate`,
  `submitDraft`
- [x] Stwórz `src/lib/add-business/generate-draft.ts`:
  - kolejność social → `peek` → limit fetch → duplikat → fetch strony + ≤ 2 podstron → LLM →
    verify → geocode → save;
  - tryb ręczny.
- [x] Stwórz `src/lib/add-business/submit-draft.ts`:
  - walidacja → limit submit → `consume`;
  - geokodowanie przy zmianie adresu;
  - JSON → logo → maile.
- [x] Stwórz `src/app/[locale]/(header)/add-business/_actions.ts`: cienkie akcje (IP z
  `headers()`, locale, FormData), bez `revalidatePath`
- [x] Modyfikuj `next.config.ts`: `experimental.serverActions.bodySizeLimit: '3mb'`
- [x] (review A P2 #9) Jeden deadline na generowanie: `timeoutMs` fetchy z pozostałego czasu,
  krótszy timeout fallbacków `/kontakt`/`/contact`, pominięcie podstron przy braku budżetu
- [x] Zapis geokodowania do draftu przez `toDraftGeo(result, address)`, nie `{ ...result, address }`
- [x] Stwórz testy `generate-draft.test.ts`, `submit-draft.test.ts`
- [x] Test: Instagram → `needsManual('SOCIAL_LINK')`; zero wywołań fetch, LLM i limitu gen
- [x] Test: domena istniejącego wpisu → `duplicate` z URL; dla `ru` URL nie zaczyna się od
  `/en`
- [x] Test: fetch `TIMEOUT` → `needsManual('UNREADABLE')`, limit gen nie zużyty
- [x] Test: wyczerpany limit gen → `limited` przed fetchem
- [x] Test: happy path → `ready`, draft zapisany, LLM 1×, limit gen 1×
- [x] Test: `submitDraft` z wygasłym draftem → `DRAFT_EXPIRED`, bez maila
- [x] Test: sfałszowana `category` w FormData → kategoria z draftu
- [x] Test: mail operatora pada → `SEND_FAILED` + log z JSON; potwierdzenie pada → `sent`
- [x] Weryfikacja: `npx jest src/lib/add-business/generate-draft.test.ts src/lib/add-business/submit-draft.test.ts`
  przechodzi
- [x] Weryfikacja: `npx tsc --noEmit` bez błędów
- [x] Weryfikacja: grep — `add-business/_actions.ts` bez `process.env` i `console.log`

### U9: Strona i komponenty UI — `feature-builder-web-ui` — XL

- [x] Modyfikuj `src/i18n/routing.ts`: `'/add-business'` → pl `/dodaj-firme`, en/ru/uk
  `/add-business`
- [x] Stwórz `src/app/[locale]/(header)/add-business/page.tsx`:
  - Server Component;
  - metadata z tłumaczeń, canonical i alternates helperami locale;
  - `maxDuration = 60`.
- [x] Stwórz `_components/add-business-flow/add-business-flow.tsx`: stan jako unia
  (`link` | `generating` | `manual` | `editing` | `submitting` | `submitted` | `duplicate` |
  `limited`)
- [x] Stwórz `_components/link-step/link-step.tsx` + test
- [x] Stwórz `_components/manual-step/manual-step.tsx` + test
- [x] Stwórz `_components/draft-editor/draft-editor.tsx` + test:
  - pola R8, logo, e-mail, uwagi;
  - „Sprawdź na mapie”;
  - kategoria, zasięg i tagi jako tekst.
- [x] Stwórz `_components/business-card-preview/business-card-preview.tsx` + test + stories:
  - klasy 1:1 z `service-card`;
  - znaczniki „do uzupełnienia”;
  - statyczny pin + atrybucja.
- [x] Stwórz `_components/submitted-state/submitted-state.tsx` + test
- [x] Modyfikuj `messages/{pl,en,ru,uk}.json`: namespace `addBusiness`
- [x] Sprawdź `src/app/sitemap.ts`; jeśli listuje strony statyczne, dodaj `/add-business`
- [x] Test: każdy komponent → render + `toHaveNoViolations`
- [x] Test: `business-card-preview` z polem w `unconfirmed` → znacznik „do uzupełnienia”
  dostępny po roli/tekście
- [x] Test: `draft-editor` → brak kontrolki kategorii; błąd e-maila przez `aria-describedby`
- [x] Test: `link-step` → pusty/niepoprawny URL daje komunikat bez wywołania akcji
- [x] Test: `submitted-state` → nazwa firmy i tekst o mailu potwierdzającym
- [x] Weryfikacja: `npx jest "src/app/\[locale\]/\(header\)/add-business"` przechodzi (z
  jest-axe)
- [x] Weryfikacja: `npx tsc --noEmit` bez błędów; `npx next lint` bez nowych błędów
- [x] Weryfikacja: grep — każdy klucz `addBusiness.*` w 4 plikach `messages/*.json`
- [x] Weryfikacja: grep — brak `next/link` / `next/navigation` w `add-business/**`

**Operator checklist (brak `.env.e2e`; flow woła płatne OpenAI i wysyła prawdziwe maile):**
- [ ] [Manual] Porównanie podglądu z prawdziwą kartą na `/mapa` (pozycja logo, paddingi),
  desktop i 390 px
- [ ] [Manual] Pełny flow: strona z JSON-LD → podgląd → edycja telefonu → submit → oba maile
  dotarły. Plik z załącznika przechodzi `npm run db:add -- <plik> --dry-run`.
- [ ] [Manual] (review A P2 #10) Czas LLM p50/p95 na 5–10 stronach; przy p95 > 25 s przesunąć
  budżet / zwrot limitu IP przy timeoutcie
- [ ] [Manual] Link Instagram → tryb ręczny → submit
- [ ] [Manual] Domena istniejącego wpisu → komunikat duplikatu z działającym linkiem
- [ ] [Manual] `pl` i `uk`: brak brakujących kluczy, brak błędów konsoli; ścieżki
  `/dodaj-firme` i `/uk/add-business`

### U10: Wejście z `/kontakt` — `feature-builder-web-ui` — S

- [x] Stwórz `src/app/[locale]/(header)/contact/_components/add-business-cta/add-business-cta.tsx`
  (Server Component, `Link` z `@/i18n/navigation`, `buttonVariants`)
- [x] Stwórz `.../add-business-cta/add-business-cta.test.tsx`
- [x] Modyfikuj `src/app/[locale]/(header)/contact/page.tsx`: CTA pod `<ContactForm />`
- [x] Modyfikuj `messages/{pl,en,ru,uk}.json`: tekst CTA
- [x] Test: link „Dodaj firmę z AI” wskazuje `/add-business`; jest-axe bez naruszeń
- [x] Weryfikacja: `npx jest "src/app/\[locale\]/\(header\)/contact"` przechodzi
- [x] Weryfikacja: grep — klucz CTA w 4 plikach `messages/*.json`

**Operator checklist:**
- [ ] [Manual] `/kontakt` → klik → `/dodaj-firme`; `/uk/contact` → `/uk/add-business`

## Do poprawy po review fazy B

Raport: `review-faza-B.md`. Gate: ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 11 × P2, 37 × P3).
Poprawki wykonane 2026-10-11 (commity `66413bc`, `f044f76`); token Mapbox: decyzja usera — zostaje istniejący, przeniesiony do `src/lib/mapbox.ts`.

- [x] 🟠 [important] **src/lib/add-business/submit-draft.ts:139-147** — sharp na uploadzie logo przed `consumeSubmitLimit` (jeden draftId = nielimitowane dekodowanie); `peekRateLimit(submitIpKey)` przed `processLogoUpload` + test
- [x] 🟠 [important] **src/lib/add-business/submit-draft.ts:150-170 / src/lib/mailer.ts:67** — submit sekwencyjny, SMTP bez timeoutów; zawieszony Gmail po `consumeDraft` = zgłoszenie znika bez logu; geo ∥ logo (`Promise.all`), timeouty transportu ~10 s + test
- [x] 🟠 [important] **add-business/_components/business-card-preview/static-map-url.ts:9-10** — druga kopia tokenu Mapbox z obcego konta poza `env.ts`; DECYZJA USERA: własny `NEXT_PUBLIC_MAPBOX_TOKEN` w `env.ts`, jedna stała, fallback przy błędzie obrazka — DECYZJA (2026-10-11): zostaje istniejący token; jedna stała w `src/lib/mapbox.ts` dla obu miejsc
- [x] 🟠 [important] **manual-step.tsx:7-10, draft-editor.tsx:7, business-card-preview.tsx:10, draft-values.ts:1, opening-hours-fields.tsx:7, languages-field.tsx:6, generated-summary.tsx:6** — klient importuje stałe z modułów zod/`src/db` (schematy + `slugify` w bundlu, granica warstw); lekkie `src/lib/weekdays.ts` + `src/lib/add-business/form-limits.ts`
- [x] 🟠 [important] **draft-editor.tsx:278-287 / add-business-flow.tsx:181** — logo > ~3 MB daje `INTERNAL` zamiast błędu pola (`bodySizeLimit`); walidacja `file.size` w kliencie + test
- [x] 🟠 [important] **add-business-flow.tsx:175,181 / use-relocation.ts:52** — `.catch(() => null)` połyka błąd bez logu, stare `fieldErrors` zostają; logowanie + przejście `afterRejection` w `flow-state.ts` + `actionFailure('INTERNAL')`
- [x] 🟠 [important] **generate-draft.ts:91-96,169 / types.ts:155-158** — martwe `url`/`duplicateUrl` w wyniku `duplicate` (UI używa `slug`); usunąć, asercję „ru ≠ /en” przenieść do testu `DuplicateNotice`
- [x] 🟠 [important] **generate-draft.ts:163-164,182-183,192-193** — brak testów gałęzi limitów: consume gen po fetchu (wyścig), wyczerpany fetch, global przy wolnym IP, tryb ręczny przy limicie
- [x] 🟠 [important] **draft-geo.ts / submit-draft.ts:70-85 / relocate-draft.ts** — brak testów porażki geokodera (NOT_FOUND przy generowaniu, re-geokodowanie przy `geo:null`, RATE_LIMITED przy submit → `missingCoordinates`, relocate → `GEOCODE_UNAVAILABLE`)
- [x] 🟠 [important] **src/lib/add-business/manual-input-schema.ts** — brak własnego testu (tooLong, same spacje, zły e-mail/link, brak name/city, File w polu tekstowym)
- [x] 🟠 [important] **src/lib/add-business/page-sources.ts** — brak własnego testu ścieżek błędów `readPageSource` (HtmlExtractError, timeout < minimum, odrzucona podstrona, priorytet JSON-LD, `combine`)
- [ ] 🟡 [nit] 37 sugestii P3 — lista w `review-faza-B.md`. Zrobione w trakcie review: #37 (wzorzec jest w checklistach, kolejność w `zadania.md`). Warte uwagi: #13 (podwójny submit nadpisuje `submitted`), #16 (`limited` z submitu porzuca edytor), #17 (`SEND_FAILED` sugeruje ponowienie przy zużytym szkicu), #19 (tryb ręczny bez sprawdzenia duplikatu), #4 (wszystkie 4 opisy w mailu operatora)

## Quality gate (przed PR)

- [x] Weryfikacja: `npx tsc --noEmit` — zero błędów
- [x] Weryfikacja: `npx jest` — wszystkie testy przechodzą
- [x] Weryfikacja: `npx next lint` — zero błędów
- [x] Weryfikacja: grep — brak nowych `any`, `console.log`, `process.env` w
  `src/lib/add-business/**` i `src/app/[locale]/(header)/add-business/**`
