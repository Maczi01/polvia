# Dodaj firmę z AI — zadania

Branch: `feature/dodaj-firme-z-ai`
Worktree: `C:\Users\mateu\WebstormProjects\polvia-dodaj-firme-ai`
Ostatnia aktualizacja: 2026-10-11

Szczegóły podejścia per unit: `docs/plans/2026-10-11-001-feat-dodaj-firme-z-ai-plan.md`.

## Faza A — moduły serwerowe

### U1: Guard SSRF — `feature-builder-web-data` — M

- [ ] Stwórz `src/lib/add-business/safe-fetch.ts`:
  - walidacja URL;
  - undici `Agent` z własnym lookupem;
  - ręczne redirecty ≤ 3;
  - timeout 8 s;
  - limit 2 MB;
  - content-type HTML i wariant obrazkowy;
  - wynik jako unia z kodami.
- [ ] Stwórz `src/lib/add-business/safe-fetch.test.ts`
- [ ] Test: klasyfikator IP odrzuca `127.0.0.1`, `10.0.0.5`, `172.16.0.1`, `192.168.1.1`,
  `169.254.169.254`, `100.64.0.1`, `0.0.0.0`, `::1`, `fc00::1`, `fe80::1`, `::ffff:127.0.0.1`
  i przepuszcza publiczne IPv4/IPv6
- [ ] Test: `file:`, `ftp:`, `javascript:`, userinfo, port 22 → `INVALID_URL`
- [ ] Test: redirect na adres prywatny → `BLOCKED_ADDRESS`; 4 redirecty → `TOO_MANY_REDIRECTS`
  (transport mockowany)
- [ ] Test: za duża odpowiedź → `TOO_LARGE`; `application/pdf` → `BAD_CONTENT_TYPE`; brak
  odpowiedzi → `TIMEOUT`
- [ ] Test: 200 `text/html` → `ok: true` z `finalUrl` po redirectcie
- [ ] Weryfikacja: `npx jest src/lib/add-business/safe-fetch.test.ts` przechodzi
- [ ] Weryfikacja: `npx tsc --noEmit` bez błędów

### U2: Ekstrakcja HTML + `link-kind` — `feature-builder-web-data` — M

- [ ] Dodaj `cheerio` (dokładna wersja) do `package.json` / `package-lock.json`
- [ ] Stwórz `src/lib/add-business/html-extract.ts`:
  - tekst ≤ 12 tys. znaków;
  - JSON-LD `LocalBusiness`/`@graph` z walidacją zod;
  - godziny z dniami lowercase;
  - kandydaci logo;
  - link kontaktu (≤ 2 podstrony).
- [ ] Stwórz `src/lib/add-business/link-kind.ts`: normalizacja hosta, wykrycie social
- [ ] Stwórz fixtures `tests/fixtures/add-business/`:
  - `local-business-jsonld.html`
  - `no-jsonld.html`
  - `graph-jsonld.html`
- [ ] Stwórz testy `html-extract.test.ts`, `link-kind.test.ts`
- [ ] Test: fixture z `LocalBusiness` → adres, telefon, godziny (lowercase), geo
- [ ] Test: `@graph` + zepsuty blok JSON-LD → poprawny węzeł wyciągnięty, błąd zalogowany,
  brak wyjątku
- [ ] Test: brak JSON-LD → puste fakty strukturalne, niepusty tekst bez skryptów
- [ ] Test: względny `apple-touch-icon` → absolutny URL; brak og:image → następny kandydat
- [ ] Test: `instagram.com/x` i `maps.app.goo.gl/…` → social; `https://WWW.Firma.pl/o-nas` →
  `firma.pl`
- [ ] Weryfikacja: `npx jest src/lib/add-business/html-extract.test.ts src/lib/add-business/link-kind.test.ts`
  przechodzi
- [ ] Weryfikacja: `npx tsc --noEmit` bez błędów

### U3: Szkic LLM + weryfikacja faktów — `feature-builder-web-data` — L

> Notatka wykonawcza: `verify-facts` test-first.

- [ ] Stwórz `src/lib/add-business/draft-schema.ts`:
  - płaski schemat strict, pola nullable;
  - `category` z `CATEGORY_VALUES`;
  - typ `BusinessDraft`.
- [ ] Stwórz `src/lib/add-business/llm-draft.ts`:
  - `fromPage` / `fromOwner`;
  - wstrzykiwany klient;
  - prompt z danymi w ogranicznikach + `CATEGORY_CONTEXTS`;
  - `DraftGenerationError`.
- [ ] Stwórz `src/lib/add-business/verify-facts.ts`
- [ ] Stwórz testy `llm-draft.test.ts`, `verify-facts.test.ts`
- [ ] Test: telefon z LLM nieobecny w źródle → `null` + `phone` w `unconfirmed`
- [ ] Test: JSON-LD telefon A, LLM B → A
- [ ] Test: źródło `+48 22 123-45-67`, LLM `221234567` → przyjęty po normalizacji
- [ ] Test: `APIError` → `UPSTREAM_FAILED`; odpowiedź niezgodna ze schematem →
  `INVALID_RESPONSE`
- [ ] Test: `fromOwner` → fakty właściciela bez zmian i bez `unconfirmed`; opis właściciela w
  prompcie
- [ ] Test: kategoria spoza enumu → `INVALID_RESPONSE` (nie ciche `others`)
- [ ] Weryfikacja: `npx jest src/lib/add-business/llm-draft.test.ts src/lib/add-business/verify-facts.test.ts`
  przechodzi
- [ ] Weryfikacja: `npx tsc --noEmit` bez błędów

### U4: Geokodowanie — `feature-builder-web-data` — M

- [ ] Stwórz `src/lib/add-business/geocode.ts`:
  - Nominatim, User-Agent z `env.NEXT_PUBLIC_SITE_URL`;
  - cache Redis 30 dni (również „nie znaleziono”);
  - blokada `SET NX PX 1000`;
  - kontrole miasta i zakresu PL;
  - `approximate`;
  - mapowanie województwa.
- [ ] Stwórz `src/lib/add-business/geocode.test.ts`
- [ ] Test: trafienie w cache → brak `fetch`
- [ ] Test: wynik spoza PL / inne miasto → `MISMATCH`
- [ ] Test: brak `house_number` → `approximate: true`
- [ ] Test: zajęta blokada przy obu próbach → `RATE_LIMITED` bez sieci
- [ ] Test: `województwo mazowieckie` → `mazowieckie`
- [ ] Weryfikacja: `npx jest src/lib/add-business/geocode.test.ts` przechodzi
- [ ] Weryfikacja: `npx tsc --noEmit` bez błędów

### U5: Draft store, limity, duplikaty — `feature-builder-web-data` — M

- [ ] Stwórz `src/lib/add-business/draft-store.ts`:
  - save / get / consume (GETDEL);
  - TTL 2 h;
  - walidacja zod przy odczycie;
  - licznik relokacji.
- [ ] Stwórz `src/lib/add-business/limits.ts`: stałe D7, `peek` / `consume`, klucz IP +
  globalny
- [ ] Modyfikuj `src/lib/queries.ts`: `findServiceByDomain(host, locale)`. Zawężenie w SQL,
  dokładne porównanie hosta, tylko aktywne wpisy.
- [ ] Stwórz testy `draft-store.test.ts`, `limits.test.ts`
- [ ] Test: `save` → `consume` zwraca draft; drugi `consume` → `DRAFT_EXPIRED`
- [ ] Test: uszkodzony JSON w Redis → `DRAFT_EXPIRED` + log, bez wyjątku
- [ ] Test: trzecie `consume` `gen:<ip>` → `allowed: false` z `retryAfter`; `peek` nie
  inkrementuje
- [ ] Test: wyczerpany limit globalny blokuje mimo wolnego limitu IP
- [ ] Weryfikacja: `npx jest src/lib/add-business/draft-store.test.ts src/lib/add-business/limits.test.ts`
  przechodzi
- [ ] Weryfikacja: `npx tsc --noEmit` bez błędów

### U6: JSON wpisu + logo — `feature-builder-web-data` — L

> Notatka wykonawcza: zacznij od testu kontraktu z `serviceInputSchema`.

- [ ] Stwórz `src/lib/add-business/build-service-json.ts`:
  - scalenie draft + edycje;
  - `changedByOwner`;
  - `image: <slug>.png` tylko gdy jest logo;
  - `missingCoordinates`.
- [ ] Stwórz `src/lib/add-business/owner-edits-schema.ts`:
  - `emptyToNull` + `z.preprocess`;
  - godziny jako 7 par;
  - języki z dozwolonego zbioru;
  - URL http(s);
  - e-mail zgłaszającego;
  - uwagi ≤ 2000.
- [ ] Stwórz `src/lib/add-business/logo.ts`:
  - ≤ 2 MB;
  - format przez sharp `metadata()`;
  - PNG ≤ 512 px;
  - kandydat przez safe-fetch (wariant obrazkowy).
- [ ] Stwórz fixtures `tests/fixtures/add-business/logo.png`, `fake-png.svg`
- [ ] Stwórz testy `build-service-json.test.ts`, `owner-edits-schema.test.ts`, `logo.test.ts`
- [ ] Test: pełny draft `hybrid` + edycje → `serviceInputSchema.safeParse` sukces; `image` =
  `<slug>.png`
- [ ] Test: draft `local` bez współrzędnych → wynik + `missingCoordinates: true`, brak wyjątku
- [ ] Test: edycja telefonu → `changedByOwner` zawiera `phoneNumber`; niezmienione pole nie
- [ ] Test: FormData z każdym polem `''` → `null`, nie `0`; puste godziny → dzień pominięty
- [ ] Test: zły e-mail zgłaszającego → błąd pola z kluczem tłumaczenia
- [ ] Test: poprawny PNG → PNG ≤ 512 px; SVG jako `.png` → `INVALID_LOGO`; 3 MB →
  `LOGO_TOO_LARGE`
- [ ] Weryfikacja: `npx jest src/lib/add-business/build-service-json.test.ts src/lib/add-business/owner-edits-schema.test.ts src/lib/add-business/logo.test.ts`
  przechodzi
- [ ] Weryfikacja: `npx tsc --noEmit` bez błędów

### U7: Maile — `feature-builder-web-data` — M

- [ ] Stwórz `src/lib/mailer.ts`: transport Gmail z `env`, `sendMail` z typowanym błędem
- [ ] Modyfikuj `src/app/api/submit-contact-query/route.ts`: użycie `mailer.ts`, bez
  `String(error)` w odpowiedzi
- [ ] Stwórz `src/lib/add-business/submission-emails.ts`:
  - operator: plain text, sekcje, komenda dry-run, załączniki, `replyTo`;
  - właściciel: plain text w locale zgłoszenia.
- [ ] Stwórz testy `src/lib/mailer.test.ts`, `src/lib/add-business/submission-emails.test.ts`
- [ ] Test: mail operatora ma „Niepotwierdzone”, uwagi i 2 załączniki `<slug>.json` /
  `<slug>.png`; JSON się parsuje
- [ ] Test: nazwa z `\r\n` → temat bez nowych linii
- [ ] Test: potwierdzenie `uk` z tekstem z `messages/uk.json`
- [ ] Test: błąd transportu → typowany błąd bez surowego komunikatu
- [ ] Test: trasa kontaktu działa po przejściu na `mailer.ts`
- [ ] Weryfikacja: `npx jest src/lib/add-business/submission-emails.test.ts src/lib/mailer.test.ts`
  przechodzi
- [ ] Weryfikacja: `npx tsc --noEmit` bez błędów

## Faza B — akcje, strona, wejście

### U8: Orkiestracja + Server Actions — `feature-builder-web-data` — L

> Notatka wykonawcza: orkiestratory testowane z wstrzykniętymi fałszywymi zależnościami
> zewnętrznymi.

- [ ] Stwórz `src/lib/add-business/types.ts`: unie wyników `generateDraft`, `relocate`,
  `submitDraft`
- [ ] Stwórz `src/lib/add-business/generate-draft.ts`:
  - kolejność social → duplikat → `peek` → limit fetch → fetch strony + ≤ 2 podstron → LLM →
    verify → geocode → save;
  - tryb ręczny.
- [ ] Stwórz `src/lib/add-business/submit-draft.ts`:
  - walidacja → limit submit → `consume`;
  - geokodowanie przy zmianie adresu;
  - JSON → logo → maile.
- [ ] Stwórz `src/app/[locale]/(header)/add-business/_actions.ts`: cienkie akcje (IP z
  `headers()`, locale, FormData), bez `revalidatePath`
- [ ] Modyfikuj `next.config.ts`: `experimental.serverActions.bodySizeLimit: '3mb'`
- [ ] Stwórz testy `generate-draft.test.ts`, `submit-draft.test.ts`
- [ ] Test: Instagram → `needsManual('SOCIAL_LINK')`; zero wywołań fetch, LLM i limitu gen
- [ ] Test: domena istniejącego wpisu → `duplicate` z URL; dla `ru` URL nie zaczyna się od
  `/en`
- [ ] Test: fetch `TIMEOUT` → `needsManual('UNREADABLE')`, limit gen nie zużyty
- [ ] Test: wyczerpany limit gen → `limited` przed fetchem
- [ ] Test: happy path → `ready`, draft zapisany, LLM 1×, limit gen 1×
- [ ] Test: `submitDraft` z wygasłym draftem → `DRAFT_EXPIRED`, bez maila
- [ ] Test: sfałszowana `category` w FormData → kategoria z draftu
- [ ] Test: mail operatora pada → `SEND_FAILED` + log z JSON; potwierdzenie pada → `sent`
- [ ] Weryfikacja: `npx jest src/lib/add-business/generate-draft.test.ts src/lib/add-business/submit-draft.test.ts`
  przechodzi
- [ ] Weryfikacja: `npx tsc --noEmit` bez błędów
- [ ] Weryfikacja: grep — `add-business/_actions.ts` bez `process.env` i `console.log`

### U9: Strona i komponenty UI — `feature-builder-web-ui` — XL

- [ ] Modyfikuj `src/i18n/routing.ts`: `'/add-business'` → pl `/dodaj-firme`, en/ru/uk
  `/add-business`
- [ ] Stwórz `src/app/[locale]/(header)/add-business/page.tsx`:
  - Server Component;
  - metadata z tłumaczeń, canonical i alternates helperami locale;
  - `maxDuration = 60`.
- [ ] Stwórz `_components/add-business-flow/add-business-flow.tsx`: stan jako unia
  (`link` | `generating` | `manual` | `editing` | `submitting` | `submitted` | `duplicate` |
  `limited`)
- [ ] Stwórz `_components/link-step/link-step.tsx` + test
- [ ] Stwórz `_components/manual-step/manual-step.tsx` + test
- [ ] Stwórz `_components/draft-editor/draft-editor.tsx` + test:
  - pola R8, logo, e-mail, uwagi;
  - „Sprawdź na mapie”;
  - kategoria, zasięg i tagi jako tekst.
- [ ] Stwórz `_components/business-card-preview/business-card-preview.tsx` + test + stories:
  - klasy 1:1 z `service-card`;
  - znaczniki „do uzupełnienia”;
  - statyczny pin + atrybucja.
- [ ] Stwórz `_components/submitted-state/submitted-state.tsx` + test
- [ ] Modyfikuj `messages/{pl,en,ru,uk}.json`: namespace `addBusiness`
- [ ] Sprawdź `src/app/sitemap.ts`; jeśli listuje strony statyczne, dodaj `/add-business`
- [ ] Test: każdy komponent → render + `toHaveNoViolations`
- [ ] Test: `business-card-preview` z polem w `unconfirmed` → znacznik „do uzupełnienia”
  dostępny po roli/tekście
- [ ] Test: `draft-editor` → brak kontrolki kategorii; błąd e-maila przez `aria-describedby`
- [ ] Test: `link-step` → pusty/niepoprawny URL daje komunikat bez wywołania akcji
- [ ] Test: `submitted-state` → nazwa firmy i tekst o mailu potwierdzającym
- [ ] Weryfikacja: `npx jest "src/app/\[locale\]/(header)/add-business"` przechodzi (z
  jest-axe)
- [ ] Weryfikacja: `npx tsc --noEmit` bez błędów; `npx next lint` bez nowych błędów
- [ ] Weryfikacja: grep — każdy klucz `addBusiness.*` w 4 plikach `messages/*.json`
- [ ] Weryfikacja: grep — brak `next/link` / `next/navigation` w `add-business/**`

**Operator checklist (brak `.env.e2e`; flow woła płatne OpenAI i wysyła prawdziwe maile):**
- [ ] [Manual] Porównanie podglądu z prawdziwą kartą na `/mapa` (pozycja logo, paddingi),
  desktop i 390 px
- [ ] [Manual] Pełny flow: strona z JSON-LD → podgląd → edycja telefonu → submit → oba maile
  dotarły. Plik z załącznika przechodzi `npm run db:add -- <plik> --dry-run`.
- [ ] [Manual] Link Instagram → tryb ręczny → submit
- [ ] [Manual] Domena istniejącego wpisu → komunikat duplikatu z działającym linkiem
- [ ] [Manual] `pl` i `uk`: brak brakujących kluczy, brak błędów konsoli; ścieżki
  `/dodaj-firme` i `/uk/add-business`

### U10: Wejście z `/kontakt` — `feature-builder-web-ui` — S

- [ ] Stwórz `src/app/[locale]/(header)/contact/_components/add-business-cta/add-business-cta.tsx`
  (Server Component, `Link` z `@/i18n/navigation`, `buttonVariants`)
- [ ] Stwórz `.../add-business-cta/add-business-cta.test.tsx`
- [ ] Modyfikuj `src/app/[locale]/(header)/contact/page.tsx`: CTA pod `<ContactForm />`
- [ ] Modyfikuj `messages/{pl,en,ru,uk}.json`: tekst CTA
- [ ] Test: link „Dodaj firmę z AI” wskazuje `/add-business`; jest-axe bez naruszeń
- [ ] Weryfikacja: `npx jest "src/app/\[locale\]/(header)/contact"` przechodzi
- [ ] Weryfikacja: grep — klucz CTA w 4 plikach `messages/*.json`

**Operator checklist:**
- [ ] [Manual] `/kontakt` → klik → `/dodaj-firme`; `/uk/contact` → `/uk/add-business`

## Quality gate (przed PR)

- [ ] Weryfikacja: `npx tsc --noEmit` — zero błędów
- [ ] Weryfikacja: `npx jest` — wszystkie testy przechodzą
- [ ] Weryfikacja: `npx next lint` — zero błędów
- [ ] Weryfikacja: grep — brak nowych `any`, `console.log`, `process.env` w
  `src/lib/add-business/**` i `src/app/[locale]/(header)/add-business/**`
