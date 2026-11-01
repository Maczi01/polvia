# Kontekst: Strona firmy — darmowy profil + Premium

**Branch:** `feature/strona-firmy-premium` (worktree: `C:\Users\mateu\WebstormProjects\polvia-strona-firmy`, od `origin/master` @ `84638df`)
**Ostatnia aktualizacja:** 2026-11-01 (poprawki po re-review fazy 3)

## Źródła

- Requirements doc: [docs/dev-brainstorms/2026-10-31-strona-firmy-premium-requirements.md](../../dev-brainstorms/2026-10-31-strona-firmy-premium-requirements.md)
- Plan techniczny: [docs/plans/2026-10-31-001-feat-strona-firmy-premium-plan.md](../../plans/2026-10-31-001-feat-strona-firmy-premium-plan.md)

## Designerski kontekst

- **DESIGN.md (projekt-wide):** `null`. Brak w repo; user wybrał zamiast tego unit kierunku wizualnego (U3).
- **SPEC.md (per-feature, pomiary z Figmy):** `null`. Brak makiet.
- **Screeny referencyjne:** brak.

> Buildery UI opierają się na `nextjs-stack-guidelines`, tokenach z `tailwind.config.ts` i kierunku zaakceptowanym w U3.
> Pułapki tokenów: skala `green` to w praktyce niebieski (`#1877F2`), a akcent marki `#C52289` jest hardkodowany w `service-card.tsx`.

## Powiązane pliki

### Istniejące — do odwzorowania lub modyfikacji

| Plik | Rola |
|---|---|
| `src/db/schema.ts` | `servicesTable` (brak slugu), `serviceLocationsTable` (slug lokalizacji, kontakt, `openingHours`, `socials`, `whatsappNumber`), `promotedServicesTable` (ranking) |
| `src/db/service-input-schema.ts` | `buildServiceSlug`, `buildLocationSlugs`, strict schemat JSON wpisu |
| `src/db/add-service.ts` | runner `db:add` (tylko inserty, `--dry-run`, `findTakenSlugs`) |
| `src/db/seed.ts` | `seedService({ name, slug, … })`; seed jest źródłem prawdy |
| `src/lib/queries.ts` | `getServices` (alias tłumaczeń, `isPublicService`, ranking przez `promoted_services`); 345 linii, więc nowe zapytania idą do osobnego modułu |
| `src/lib/semantic-search.ts` | ranking `MAX(priority) WHERE expires_at > NOW()` |
| `src/lib/map-url-builder.ts` | `localePathPrefix()`, `localizedMapBasePath()`, `buildServiceUrl` |
| `src/lib/rate-limit.ts` | `checkRateLimit`, `getClientIp`, `RateLimitStoreError` |
| `src/lib/mailer.ts` | `sendMail`, `getOperatorInbox`, `SMTP_TIMEOUT_MS` |
| `src/middleware.ts` | walidacja slugu mapy przed next-intl (wzorzec), rewrite `/mapa/**`, 301 `/map/**` |
| `src/lib/legacy-map-redirect.ts` | nowe na `origin/master`: logika przekierowań mapy wyciągnięta z middleware (wzorzec czystego modułu) |
| `src/i18n/routing.ts` | `pathnames` (`/pricing` → `/cennik` itd.), `localePrefix: 'as-needed'` |
| `src/i18n/messages-parity.test.ts` | test parytetu kluczy 4 locale; używać zamiast własnych skryptów |
| `src/app/sitemap.ts` (+ test) | dziś bez wpisów usług |
| `src/app/[locale]/blog/[slug]/page.tsx` | wzorzec `generateMetadata` + `alternates` |
| `src/app/[locale]/(main)/map/[[...slug]]/page.tsx` | wzorzec `openGraph`, `languages` |
| `src/app/[locale]/(main)/_components/service-card/service-card.tsx` | render kontaktu, godzin, social, WA/TG; 768 linii, `next/link` (dług; nie refaktoryzujemy) |
| `src/app/[locale]/(main)/_components/marker-popup.tsx` | popup mapy (`next/link`) |
| `src/app/[locale]/(header)/pricing/page.tsx` | makieta cennika `'use client'` |
| `src/app/api/submit-contact-query/route.ts` | wzorzec route handlera: Zod, rate limit, format odpowiedzi |
| `src/app/[locale]/loading.tsx` | **powód soft-404**: streamowanie każdej strony |
| `.claude/skills/dodaj/SKILL.md` | procedura concierge; dopisać „Wpis premium” |
| `env.ts` | zmienne server, client i `runtimeEnv` |

### Nowe (z planu technicznego)

- **Biblioteki w `src/lib/`:**
  - `service-profile-queries.ts`
  - `service-profile-path.ts`
  - `service-profile-metadata.ts`
  - `premium.ts`
  - `premium-templates.ts`
  - `stripe.ts`
  - `subscription-sync.ts`
- **Skrypty w `src/db/`:**
  - `backfill-service-slugs.ts`
  - `premium-content-schema.ts`
  - `upsert-premium-content.ts`
  - `publish-premium.ts`
  - `sync-subscriptions.ts`
- **Route handlery:**
  - `src/app/api/service-slug/[slug]/route.ts`
  - `src/app/api/stripe/webhook/route.ts`
- **Profil firmy, `src/app/[locale]/firma/[slug]/`:**
  - `page.tsx`, `_actions.ts`, `_checkout-schema.ts`
  - `premium/dziekujemy/page.tsx`
  - `_components/`: `profile-free`, `template-gallery`, `template-professional`, `template-classic`, sekcje, `upgrade-cta`, `premium-materials-form`, `select-profile-view.ts`, `profile-fixtures.ts`, `service-profile-types.ts`
- **Not-found:** `src/app/[locale]/firma/not-found.tsx`

## Decyzje techniczne (skrót; uzasadnienia w planie technicznym)

1. **Stripe Billing + Checkout + no-code Customer Portal + Fakturownia (KSeF).** Ceny PLN w Dashboardzie, w kodzie tylko allowlista identyfikatorów cen z `env.ts`.
2. **`services.slug`:** unikalny, niezmienny. Backfill z `buildServiceSlug` z sufiksem `-2`, `-3`.
3. **Walidacja `/firma/<slug>` i alias w middleware** przez `GET /api/service-slug/[slug]` (Node + `db`, jawny timeout; przy awarii żądanie przechodzi dalej). Powód: edge bez `db` i soft-404 przez `loading.tsx`.
4. **`isPremiumActive(sub, now)`** w `src/lib/premium.ts` to jedyne źródło prawdy: `status ∈ {active, trialing, past_due}` i `now < currentPeriodEnd + PREMIUM_GRACE_DAYS`. Liczone na odczycie, bez crona.
5. **Ranking przez `promoted_services`**, synchronizowane z webhooka (`expiresAt = currentPeriodEnd + grace`). Zapytania rankingowe się nie zmieniają.
6. **Treść premium w `service_profiles`** (jsonb, Zod na zapisie i odczycie), niezależna od subskrypcji. Po wygaśnięciu zostaje.
7. **Źródło treści:** blok `premium` w `data/services/<slug>.json`. Publikacja przez `db:premium` (upsert, `--dry-run`); seed odtwarza. Zdjęcia w `public/services/<slug>/`.
8. **Webhook:**
   1. podpis (`request.text()`, runtime Node),
   2. dedupe `stripe_events`,
   3. `syncSubscriptionFromStripe`,
   4. mail z timeoutem.

   Błąd synchronizacji daje 500, a dedupe zostaje wycofany. Bez rate limitu, bo bramką jest podpis.
9. **Checkout jako Server Action** (Zod, rate limit, `ALREADY_PREMIUM`, `client_reference_id`, `tax_id_collection`). Formularz materiałów tylko dla opłaconej sesji; zdjęcia mailem.
10. **Alias tylko bez prefiksu locale**, kierowany na profil `pl`. Najpierw 307; lista słów zarezerwowanych w `service-profile-path.ts`.
11. **Free profil pokazuje to, co karta dziś** (kontakt, godziny, WWW, social, WA/TG). Decyzja usera z planowania, wpisana do requirements doc w R2, R9 i R19.
12. **Profil jako Server Component.** Szablony prezentacyjne z jednym kontraktem `ServiceProfileView`; mapa jako link lub podgląd zamiast Mapboxa.

## Zależności

- **Zewnętrzne:**
  - konto Stripe (BLIK recurring wymaga akceptacji),
  - Fakturownia,
  - Vercel env (Preview ma deployment protection, która blokuje webhooki).
- **Nowa paczka npm:** `stripe`, wymaga zgody usera.
- **Wiedza instytucjonalna:**
  - `docs/solutions/deployment-issues/2026-08-22-soft-404-notfound-podczas-streamowania.md`
  - `docs/solutions/runtime-errors/2026-10-11-nieograniczony-czas-po-nieodwracalnym-kroku.md`
  - `docs/solutions/database-issues/2026-08-22-drizzle-generate-nieuzywalny-snapshoty.md`
  - testy: `docs/solutions/testing-issues/*` (ESM, route group w wzorcach jest, akcje React 19, `URL.canParse`)
- **Środowisko:**
  - brak `.env.e2e`, więc scenariusze przeglądarkowe to kroki `Operator:`;
  - `DATABASE_URL` = produkcja;
  - jeden dev server, nigdy `npm run build` przy działającym serverze.

## Decyzje podjęte w trakcie wykonania

- **2026-10-31: ceny planu Profesjonalny to 9 zł/mies. i 49 zł/rok** (decyzja usera przy starcie fazy 1).
  - Kwoty trafiają do Stripe Prices (PLN; operator, U8) i do `Pricing.plans.essentials` w 4 plikach `messages/` (U11).
  - BLIK recurring mieści się w limicie 2000 PLN.

- **2026-10-31: user zaakceptował wygląd profilu i 3 szablonów (bramka U3).** Zrzuty: `screeny-u3/`.
- **Slug usługi liczony jedną regułą w seedzie, backfillu i `db:add`** (`createServiceSlugAllocator` w `src/db/service-slugs.ts`). Wcześniej seed zapisywał bazę slugów lokalizacji (`multi-cook-warszawa`), a backfill na produkcji liczył slug z nazwy (`multi-cook`), więc po `db:reset` adresy `/firma/…` by się zmieniły.
- **404 dla nieistniejącego profilu:** middleware robi `rewrite` na `/pl/firma/_brak-profilu/_404`, ścieżkę niedopasowaną przez routing. Next zwraca wtedy 404 przed streamowaniem layoutu (sprawdzone w kodzie Next 15.1.11).
  - Treść to globalne not-found Next, tak samo jak dla każdego nieistniejącego adresu w serwisie. Własna strona 404 dla całego serwisu jest poza zakresem.
  - `firma/not-found.tsx` obsługuje tylko fail-open.
- **Rate limit lookupu:** 120 zapytań na 60 s per IP klienta (`x-forwarded-for` przekazany z middleware). Przy 429 albo awarii store'u lookup przepuszcza żądanie (fail-open).
  - Po wdrożeniu sprawdzić w logach Vercela, czy route widzi IP klienta, a nie IP middleware. Jeśli widzi IP middleware, rozważyć nagłówek z sekretem (nowa zmienna env).

- **2026-10-31: `src/lib/premium.ts` przeniesiony z U8 do fazy 2 (decyzja usera przy starcie fazy 2).** U7 wymaga `isPremiumActive`, a U8 czeka na zgodę na paczkę `stripe`.
  - Teraz powstaje tylko czysta część: `isPremiumActive(sub, now)`, `PREMIUM_GRACE_DAYS`, `premiumRankingExpiry`. Test-first, bez Stripe. Typ subskrypcji jest strukturalny i lokalny dla modułu.
  - Do czasu U8 `page.tsx` traktuje każdy wpis jako „bez subskrypcji”, więc w praktyce nikt nie dostaje premium. U8 podmienia to źródło na `service_subscriptions` i nie zmienia `premium.ts`.

## Log wykonania

### Faza 1 — Darmowy profil (2026-10-31)

| Unit | Builder | Status | Commit |
|---|---|---|---|
| U1 Slug + zapytania | feature-builder-web-data | completed (+ poprawka seeda) | `668f261` |
| U2 Routing, lookup, sitemap | feature-builder-web-data | completed | `0365af3` |
| U3 Komponenty i 3 szablony | feature-builder-web-ui | completed, wygląd zaakceptowany | `c6bc11a` |
| U4 Strona profilu, metadane, linki | feature-builder-web-ui | completed | `c3d43c8` |

Gate po fazie: `npx tsc --noEmit` OK, `npx jest` 143 suite'y i 1505 testów OK, `npx next lint` bez błędów i warningów.

**`npm run build` nie został uruchomiony.** W worktree celowo nie ma `.env`, a build bez prawdziwego środowiska nie przejdzie walidacji `env.ts`; sitemapa z `revalidate` pyta bazę przy buildzie. Weryfikacja buildu odbędzie się na deployu preview.

**Odchylenia zgłoszone przez builderów (zaakceptowane):**
- **U1:**
  - Logika slugów i doboru podobnych wydzielona do czystych modułów `src/db/service-slugs.ts` i `src/lib/similar-services.ts` (z testami).
  - Brak `src/db/add-service.test.ts`, bo `add-service.ts` odpala `main()` i łączy się z bazą przy imporcie. Komenda weryfikacji poprawiona w zadaniach.
  - `superRefine` odrzuca pusty slug wyliczony z nazwy.
- **U2:**
  - Dodatkowy moduł `src/lib/service-slug-lookup.ts` (fetch z timeoutem, testowalny poza middleware).
  - Typ `AppPathnames` zawężony do tras bez parametrów.
  - `revalidate = 3600` w sitemapie: wpisy z `db:add` pojawiają się bez deployu.
- **U3:**
  - Dodatkowe sekcje i helpery, żeby zmieścić się w limicie 300 linii.
  - Token `brand` (`#C52289`) w `tailwind.config.ts`.
  - `SimilarService.href` w kontrakcie.
- **U4:**
  - `src/app/[locale]/firma/layout.tsx` z nagłówkiem i stopką, bo `firma/` leży poza route groups.
  - Kolumna `serviceSlug` także w `semantic-search.ts`.
  - Fixture'y 8 istniejących testów dostały `serviceSlug: null`; asercje bez zmian.
  - Test popupu.
  - Naprawiony przełącznik języka (zgłoszone przez U2).
  - Naprawiony wiersz „Dziś” w karcie: klucze godzin w danych są pisane małymi literami, a karta szukała `Monday`.

**Incydent:** builder U1 użył raz `git stash` + `stash pop` w współdzielonym worktree (kilka sekund). Pop przeszedł czysto, a końcowe diffy U3 i kontekstu są kompletne. Kolejni builderzy mają zakaz komend git zmieniających drzewo.

### Review fazy 1 (2026-10-31)

Raport: [review-faza-1.md](review-faza-1.md). Werdykt: ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 9 × P2, 17 × P3). Wszystkie 15 checkboxów `Weryfikacja:` fazy 1 przeszło. E2E nie było uruchamiane: brak scenariuszy przeglądarkowych w `Weryfikacja:`, a baza bez backfillu.

Kluczowe wnioski:
- **Slug usługi musi mieć jedną regułę i jeden format na wszystkich ścieżkach zapisu** (seed, backfill, `db:add`, middleware). Decyzja: slug zawsze z nazwy, `slug` w JSON to tylko baza slugów lokalizacji. Naprawić przed backfillem na produkcji.
- **Lookup w middleware ma trzy słabości:** prefetch linków mnoży wywołania, brak cache CDN, a założenie o `x-forwarded-for` jest wewnętrznie sprzeczne. Fail-open chroni dostępność profili, ale nie gwarancję 404.
- **Kontrakt widoku do uproszczenia przed fazą 2:** `PremiumProfileView` zamiast podwójnego propsa, `ProfileLocation` inferowany z Drizzle.

### Poprawki po review fazy 1 (2026-10-31)

Wszystkie 9 × P2 naprawione, do tego P3 #10, #11 (świadomie bez zmiany), #13–#15, #17, #19, #24, #26. Bramka: `tsc` OK, `jest` 143 suite'y / 1566 testów, `next lint` 0 błędów (4660 starych ostrzeżeń, 4425 to `no-undef` w plikach testowych w całym repo, nie z tej gałęzi).

| Commit | Builder | Zakres |
|---|---|---|
| `16f505b` | feature-builder-web-data | #2–#6, P3 #11, #15, #24, #26 |
| `0e63b47` | feature-builder-web-ui | #1, #7–#9, P3 #10, #13, #14, #17, #19 |

Decyzje:
- **Format slugu:** jedno źródło w `src/lib/service-slug-format.ts`. Z niego korzystają zod i middleware. Nazwa bez liter i cyfr daje slug `firma`.
- **`db:add`:** slug usługi liczony z nazwy (`planNewServiceSlug`). Zajęty slug dostaje sufiks `-2`, a błędem jest tylko kolizja slugu lokalizacji. `describeSlugConflicts` i `isServiceSlugTaken` usunięte.
- **Lookup:** middleware wysyła `SERVICE_SLUG_LOOKUP_SECRET` w nagłówku `x-service-slug-lookup-secret`, porównywany przez `timingSafeEqual` na SHA-256.
  - Ruch z sekretem nie ma limitu po IP. Wszystkie fetche z middleware wychodzą z jednego adresu, więc limit byłby jednym globalnym kubełkiem.
  - Ruch publiczny ma limit 120/min po `x-vercel-forwarded-for`, a bez niego po `x-real-ip`. Nigdy po XFF.
- **Zmienna obowiązkowa:** `SERVICE_SLUG_LOOKUP_SECRET` (`min(32)`) jest wymagana w `env.ts`. Bez niej padną build na Vercelu, `npm run dev` i skrypty `db:*` na tej gałęzi.
- **Origin lookupu:** zostaje z `Host` (P3 #11, z komentarzem). `NEXT_PUBLIC_SITE_URL` skierowałby dev i preview na produkcję.
- **Cache:** `exists:true` dostaje `s-maxage=300, swr=86400`, `false` dostaje `s-maxage=30`, a 400/429/500 dostają `private, no-store`.
- **Podobne firmy:**
  - Sortowanie i `LIMIT 6` są w SQL, nowy indeks `idx_location_service_main`.
  - Zostaje skorelowane podzapytanie `mainCity` zamiast joina, bo dane mają wpisy z dwiema głównymi lokalizacjami.
  - `pickSimilarServices` usunięty.
  - `getServiceProfile` pobiera wpis i lokalizacje równolegle.
- **Metadane:** `buildProfileMetadata` i `pickMetaDescription` w `service-profile-metadata.ts`, `toSameAs` i `toSafeExternalHref` w `profile-helpers.ts`. `page.tsx` jest cienki.
- **Link do profilu:** `ServiceProfileLink` w `(main)/_components/` ma zawsze `prefetch={false}`.

Odłożone (P3): #12, #16, #18, #20–#23, #25. Do tego `border-[#C52289]` w `service-card.tsx:425` i ujednolicenie `OpeningHours` z `add-business/jsonld-facts.ts`.

### Faza 2 — Treść premium (2026-10-31)

| Unit | Builder | Status | Commit |
|---|---|---|---|
| U6 `service_profiles` + `db:premium` | feature-builder-web-data | completed | `4e58899` |
| `premium.ts` (z U8, decyzja usera) | feature-builder-web-data | completed | `e4c7f7e` |
| U7 Wybór widoku free / premium | feature-builder-web-ui | completed | `1440555` |

Bramka: `tsc` OK, `jest` 149 suite'ów / 1625 testów, `next lint` 0 błędów. `npm run build` pominięty z tego samego powodu co w fazie 1 (brak `.env` w worktree).

Decyzje i odchylenia builderów (zaakceptowane):
- **U6:**
  - Slug usługi do upsertu szukany **po slugach lokalizacji z pliku**, nie przez `buildServiceSlug(name)`. Przy duplikacie nazwy wpis ma adres `nazwa-2`, a slug liczony z nazwy wpisałby treść premium do cudzego profilu.
  - Baza trzyma wszystkie 4 tłumaczenia, lokalizacja przy odczycie (`localizePremiumContent`). Alt coveru = nazwa firmy w locale.
  - Nazwa pliku zdjęcia walidowana regexem (bez `/` i `..`, tylko jpg/png/webp/avif), co zamyka path traversal.
  - Limity długości tekstów: alt 200, cena 60, pytanie 200, odpowiedź 2000. Bez limitu liczby pozycji cennika i FAQ (plan go nie przewidywał).
  - Seed pomija z ostrzeżeniem blok `premium` wpisu nieobecnego w bazie; błędny blok albo brak zdjęcia przerywa seed.
  - Dodatkowe moduły dla limitu 300 linii: `src/db/premium-content-diff.ts`, `src/lib/service-profile-premium.ts`. Typowany błąd `PremiumContentError` ma kody `INVALID_ENTRY`, `SERVICE_NOT_FOUND`, `ENTRY_AMBIGUOUS`, `IMAGES_MISSING`.
  - `console.error` z `eslint-disable` w `service-profile-premium.ts`, bo repo nie ma loggera.
- **`premium.ts`:** `SUBSCRIPTION_STATUSES` (8 statusów Stripe) dla przyszłego enumu. `isPremiumActive` liczy granicę przez `premiumRankingExpiry`, więc ranking i widok się nie rozjadą. Granica jest ostra. `cancelAtPeriodEnd` nie wpływa na wynik.
- **U7:**
  - `resolveProfileView(profile)` w `page.tsx` jest wspólny dla strony i `generateMetadata`. Źródłem stanu jest `getPremiumSubscription()`, które zwraca `null`; U8 podmienia jego ciało (przy async trzeba dodać `await` w dwóch wywołaniach).
  - Premium bez treści: `toPremiumProfileView` wstawia pustą treść `classic` (bez coveru: baner z gradientem, puste sekcje ukryte).
  - `ProfileMetadataInput.coverImagePath` (opcjonalne). Obrazek OG = cover przy premium, inaczej logo. JSON-LD `image` zostaje logo.
  - `to-profile-view.ts`: `premium: profile.premiumContent`.

Ryzyko: `page.tsx` nie ma testu renderu. Przejście premium → szablon da się sprawdzić w przeglądarce dopiero po U8.

**Kroki operatora fazy 2:** `npx drizzle-kit push` (enum `profile_template` + `service_profiles`, addytywne) razem z krokami fazy 1; przy pierwszej publikacji premium zacommitować zdjęcia z `public/services/<slug>/`.

**Nowe kroki operatora** (dochodzą do kroków U1/U2):
1. Wygenerować sekret: `openssl rand -hex 32`, zapisać jako `SERVICE_SLUG_LOOKUP_SECRET` w Vercel (Production + Preview) i w lokalnym `.env`.
2. `npx drizzle-kit push`: kolumna `services.slug` z U1 oraz indeks `idx_location_service_main`. Oba addytywne.
3. Na preview sprawdzić:
   - `curl -sI /api/service-slug/<slug>`: jest `Cache-Control`, drugie żądanie daje `x-vercel-cache: HIT`,
   - `/firma/xyz` zwraca 404.
4. Po backfillu: `SELECT slug FROM services WHERE slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'` ma zwrócić 0 wierszy.

### Review fazy 2 (2026-10-31)

Raport: [review-faza-2.md](review-faza-2.md). Werdykt: ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 4 × P2, 20 × P3). Wszystkie 6 checkboxów `Weryfikacja:` fazy 2 przeszło (CLI). E2E nie było uruchamiane: brak scenariuszy przeglądarkowych w `Weryfikacja:`, a jedyny scenariusz premium wymaga U8.

Kluczowe wnioski:
- **Kontrakt subskrypcji trzeba ustalić przed U8, a nie w U8.**
  - Stub `getPremiumSubscription()` bez `serviceId` wymusza na U8 zmianę sygnatury i zaprasza do źródła niefiltrującego po usłudze.
  - Kierunek: `subscription` jako pole `getServiceProfile` (left join, jak `premiumContent`).
- **Decyzje „co pokazać przy premium” (cover w OG, podobne firmy) muszą być czystymi funkcjami z testami.** `page.tsx` nie ma testu, a R18 zostawia treść w bazie po wygaśnięciu. Odwrócony warunek przeszedłby przez gate.
- **Jeden kształt treści premium.** Projekcja na locale przechodzi do `src/lib`, a typ widoku jest aliasem.
- **Seed czyta teraz `data/services/`**, więc niepoprawny plik roboczy przerywa `db:reset`. Parse musi być odporny i wskazywać plik.
- Bezpieczeństwo bez uwag: path traversal zamknięty, brak XSS, premium nie do włączenia bez subskrypcji.

### Poprawki po review fazy 2 (2026-10-31)

Wszystkie 4 × P2 naprawione, do tego P3 #1 (część), #2, #3, #7–#16, #19, #20. Bramka: `tsc` OK, `jest` 151 suite'ów / 1644 testów, `next lint` 0 błędów.

| Commit | Builder | Zakres |
|---|---|---|
| `fbe8cf9` | feature-builder-web-data | P2-1 (dane), P2-3, P2-4, P3 #1–#3, #7, #9, #11–#16, #19, #20 |
| `e861b55` | feature-builder-web-ui | P2-1 (UI), P2-2, P3 #8, #10, #19 (część) |

Decyzje:
- **Subskrypcja jest polem profilu.** `getServiceProfile` zwraca `subscription` (stała `NO_SUBSCRIPTION = null` do U8). `page.tsx` czyta `profile.subscription`, a `getRequestNow = cache(() => new Date())` daje jedną chwilę na żądanie. U8 zmienia tylko zapytanie (`leftJoin(service_subscriptions)`), checklista U8 zaktualizowana.
- **Decyzje widoku premium** to `selectOgCoverPath` i `shouldLoadSimilarServices` w `select-profile-view.ts`, z testami.
- **Treść premium ma jeden kształt:** `LocalizedPremiumContent` + projekcja na locale w `src/lib/service-profile-premium.ts`. `PremiumContent` w kontrakcie widoku jest aliasem.
- **Seed:** nieparsowalny JSON w `data/services/` trafia do `skipped` z nazwą pliku (łapany tylko `SyntaxError`). `IMAGES_MISSING` i `ENTRY_AMBIGUOUS` przerywają seed (testy).
- **Walidacja treści:**
  - limity `PREMIUM_PRICE_LIST_MAX = 30` i `PREMIUM_FAQ_MAX = 20`;
  - unikalność pliku galerii oraz nazwy i pytania w każdym locale;
  - zdjęcia sprawdzane z wielkością liter (`readdir` zamiast `existsSync`).
- **Lookup usługi to jedno zapytanie** (`findServicesByLocationSlugs` → `{ id, slug }`). Adapter Drizzle wydzielony do `src/db/premium-content-store.ts`, bo `upsert-premium-content.ts` przekroczył 300 linii. `findServiceIdBySlug` usunięte razem ze swoim testem; `SERVICE_NOT_FOUND` dalej pokryte.
- `formatZodIssue` w `src/db/format-zod-issue.ts` (3 użycia).

Otwarte: P3 #4, #5, #6, #18 (do rozważenia). Przed U8 zostaje #17: sprawdzić, czy trasa profilu jest dynamiczna. Wymaga `npm run build` z `.env`, więc dopiero na preview.

### Faza 3 — Subskrypcja (2026-11-01)

Decyzje usera przy starcie: zależność `stripe@23.0.1` (23.1.0 miała 3 dni — za świeża), `PREMIUM_GRACE_DAYS = 3`, cała faza w jednym uruchomieniu.

| Unit | Builder | Status | Commit |
|---|---|---|---|
| U8 Stripe: webhook, stan, ranking, resync | feature-builder-web-data | completed | `683ccc5` |
| U10 Krótki adres `/<slug>` | feature-builder-web-data | completed (równolegle z U9) | `9c1e845` |
| U9 Checkout + formularz materiałów | feature-builder-web-fullstack | completed | `187806b` |
| U11 Przepisanie `/cennik` | feature-builder-web-ui | completed | `568bce1` |

Bramka: `tsc` OK, `jest` 160 suite'ów / 1755 testów, `next lint` 0 błędów. `npm run build` pominięty (brak `.env` w worktree).

Decyzje i odchylenia builderów (zaakceptowane):
- **U8:**
  - `apiVersion = '2026-09-30.endive'`; `current_period_end` leży na `items.data[]` (bierzemy maksimum). Klient: timeout 8 s, `maxNetworkRetries: 1`; webhook `maxDuration = 30`.
  - Dedupe zapisywany **po** udanej synchronizacji (`insert … on conflict do nothing returning`); mail tylko gdy ten insert oznaczył zdarzenie.
  - Powiązanie subskrypcji z wpisem: `client_reference_id` → istniejący wiersz → `metadata.serviceSlug` → `metadata.serviceId`. Slug potrzebny, bo `db:reset` nadaje nowe UUID.
  - Konflikt drugiej subskrypcji rozstrzyga `isPremiumActive` zapisanej; wygasła zostaje zastąpiona. Upsert `promoted_services` zmienia tylko `expiresAt`, `priority` operatora zostaje.
  - Dodatkowe moduły (limit 300 linii): `subscription-store.ts`, `subscription-notifications.ts`, `stripe-events.ts`, `stripe-webhook-events.ts`. Adaptery Drizzle bez własnych testów (zastąpione bazą w pamięci w testach sync i route).
  - **5 zmiennych `STRIPE_*` jest wymaganych w `env.ts`** — bez nich nie wstanie build ani dev server.
  - `service-profile-queries.test.ts` ma 456 linii (ponad limit 300, było 400) — zgłoszone, nie dzielone.
- **U10:**
  - `ServiceSlugLookupResult = 'premium' | 'found' | 'missing' | 'unknown'`; gałąź `/firma/*` sprawdza tylko `missing`.
  - `rootAliasRedirectPath` jako czysta funkcja (middleware nie importuje się w Jeście). 307, query string przechodzi.
  - Cache CDN `s-maxage=300` obejmuje `hasActivePremium` — alias zaczyna/przestaje działać z opóźnieniem do 5 min (decyzja orkiestratora).
  - Ograniczenie: slugi zaczynające się od `api` nie dostaną aliasu (matcher). Nowy katalog w `public/` lub przekierowanie w `next.config.ts` trzeba dopisać do `STATIC_RESERVED_SEGMENTS`.
  - Ryzyko do review bezpieczeństwa: losowe jednosegmentowe ścieżki (np. `/wp-admin`) robią lookup do bazy (indeksowany SELECT; ten sam profil ryzyka co `/firma/<losowy>` od U2).
- **U9:**
  - Akcje z sygnaturą `(previous, formData)` (`useActionState`). Kody: checkout `BAD_INPUT`, `RATE_LIMITED`, `NOT_FOUND`, `ALREADY_PREMIUM`, `CHECKOUT_FAILED`; materiały `BAD_INPUT`, `RATE_LIMITED`, `FORBIDDEN`, `VERIFY_FAILED`, `SEND_FAILED`.
  - Logika Stripe i zapytanie po id w `src/lib/premium-checkout.ts` i `premium-checkout-queries.ts` (`getPremiumCheckoutTarget`); stałe dla klienta w `premium-checkout-fields.ts`.
  - `success_url` z `env.NEXT_PUBLIC_SITE_URL` — lokalny test checkoutu wymaga ustawienia tej zmiennej na localhost.
  - Strona `dziekujemy` nie wymaga zmian w routingu ani middleware (4 segmenty nie pasują do `/firma/[slug]`); do potwierdzenia w teście ręcznym.
  - Formularze bez react-hook-form (zakaz importu zod w kliencie); `onSubmit` + `startTransition`, żeby błąd nie czyścił pól.
  - `ServiceProfileView.upgradeHref` zastąpione przez `serviceId`; testy profilu zaktualizowane do nowego zachowania (asercje nie osłabione).
  - Checkout dla `uk` z `locale: 'auto'` (Stripe nie ma ukraińskiego).
- **U11:**
  - `/cennik` jako Server Component; `pricing-plans` kliencki tylko dla przełącznika. Oszczędność roczna 54% (1 − 49/108).
  - Poprawione także obietnice spoza `features`: „14-day free trial” w en/ru/uk (triala nie ma), gwiazdki markdown w `team.features.0`, plan Przedsiębiorstwo „Wycena indywidualna”, link stopki `href="#"` → `/contact`. Usunięty zdublowany landmark `<main>`.

### Review fazy 3 (2026-11-01)

Raport: [review-faza-3.md](review-faza-3.md). Werdykt: ⚠️ kontynuuj z zastrzeżeniami (0 × P1, 7 × P2, 26 × P3). Wszystkie 16 checkboxów `Weryfikacja:` fazy 3 przeszło (CLI). E2E nie było uruchamiane: faza nie ma scenariuszy przeglądarkowych w `Weryfikacja:`, a test ścieżki płatności wymaga kluczy Stripe (krok `Operator:`).

Kluczowe wnioski:
- **Stan premium nie jest jeszcze wierny Stripe.** Trzy niezależne drogi do premium bez płacenia:
  - karencja `past_due` liczona od przesuniętego już końca okresu,
  - odczyt subskrypcji przed blokadą (wyścig zdarzeń),
  - brak sprawdzenia `livemode` przy produkcyjnej bazie.
  Do tego brak sprawdzenia ceny/produktu: każda subskrypcja na koncie z `client_reference_id` daje premium. Wszystko to przed startem sprzedaży.
- **Skutki uboczne tylko w webhooku, po oznaczeniu zdarzenia.** Mail o konflikcie w `syncSubscriptionFromStripe` złamał ten kontrakt (powtarzane maile, także z CLI).
- **Strona sukcesu to publiczny proxy do API Stripe** — potrzebuje limitu i rozróżnienia „Stripe niedostępny” od „nieopłacone”.
- Bez uwag: podpis i dedupe webhooka, granice `server-only`, `isPremiumActive` jako jedyne źródło prawdy, czysty bundle klienta, kompletne pokrycie scenariuszy testowych z planu.

## Poprawki P2 po review fazy 3 (2026-11-01)

Commity `3b8df5a` (feature-builder-web-data, #1–#5) i `0661ce2` (feature-builder-web-fullstack, #6–#7). Gate: tsc OK, jest 163 suite'y / 1790 testów, lint 0 błędów.

- **#1:** nowa kolumna `current_period_start`; dla `past_due` `premiumRankingExpiry = periodStart + PREMIUM_GRACE_DAYS` (to samo dla `isPremiumActive` i `promoted_services`). Okres z `items.data[]` (max startów / max końców).
- **#2:** decyzja — `canceled`/`incomplete_expired` jako stan końcowy pod `FOR UPDATE` zamiast `retrieve` pod blokadą (blokada przez wywołanie sieciowe do ~16 s przy `maxDuration` 30 s). Wyciągnięte `applySubscriptionState` (zamyka P3 #24).
- **#3:** `isLiveStripeKey` w `stripe.ts`; webhook przy niezgodnym `livemode` → 200 bez sync i bez `stripe_events`; CLI wypisuje tryb klucza + host bazy i pomija niezgodne (`wrong_mode`).
- **#4:** allowlista cen w nowym `src/lib/premium-prices.ts` (osobny moduł, by uniknąć cyklu `premium-checkout` ↔ `subscription-sync`). Obca cena w sync → `unlinked` (zapisany wiersz bez zmian, premium wygasa z końcem okresu); `verifyPaidCheckoutSession` z `expand: ['line_items']`, obca cena → istniejący wariant `invalid`.
- **#5:** sync zwraca `conflict` bez maila; mail wysyła webhook przy `isFirstDelivery`, tylko dla `checkout.session.completed` i aktywnej przychodzącej subskrypcji (odchylenie od sugestii `subscription.created` — tam status bywa `incomplete`). CLI wiąże od najstarszej, bez maili.
- **#6–#7:** strona `dziekujemy`: `checkRateLimit` po IP (20/h) po walidacji formatu, przed Stripe; `unavailable` i przekroczony limit → wariant `CheckoutUnavailable` „odśwież za chwilę” (3 klucze × 4 locale). Link „odśwież” to `<a href="?session_id=…">`, bo trasy nie ma w `routing.pathnames` (P3 #33).
- **Zmienione istniejące testy** (sprzeczne z poprawką, uzasadnione w raportach builderów): `premium.test.ts` (realistyczny okres `past_due`), `subscription-sync.test.ts` (konflikt bez maila), `route.test.ts` (mail o konflikcie w webhooku), `_actions.test.ts` (`retrieve` z `expand`).

## Poprawki po re-review fazy 3 (2026-11-01)

Commity `e6aab21` (feature-builder-web-data: R1, R3, R4) i `ed2ffcc` (feature-builder-web-fullstack: R2, R9). Gate: tsc OK, jest 164 suite'y / 1812 testów, lint 0 błędów.

- **R1:** nowy `src/lib/database-host.ts` (`isLocalDatabaseUrl`, bez zależności — importuje go też `drop.ts`). Webhook: podpis → `!STRIPE_LIVE_MODE && !isLocalDatabaseUrl` → 200 bez sync i bez `stripe_events`. CLI `db:sync-subscriptions` przy tej kombinacji kończy się `exit 1` przed `subscriptions.list`. Martwa gałąź `wrong_mode` usunięta; porównanie `livemode` zostało jako tania druga linia obrony. Bez flagi override — staging z kluczami testowymi i zdalną bazą testową wymagałby świadomego override w `env.ts`. Uboczna naprawa: `drop.ts` uznaje teraz `[::1]` i `LOCALHOST` za lokalne (stary `LOCAL_HOSTS.has('::1')` nie łapał IPv6 z nawiasami).
- **R3:** `supersedesPastDue` — opłacona nowa subskrypcja wypiera zapisaną `past_due` innej subskrypcji (zapis + `console.warn`). Nieopłacona nowa (`incomplete`) nie wypiera. Późniejsze `deleted` starej → `conflict` z `isIncomingActive: false`, wiersz nowej bez zmian.
- **R4:** mail „opłacono” tylko przy `synced` z `isPremiumActive`.
- **R2:** decyzja orkiestratora — timeout **lokalny** w stronie `dziekujemy` (`Promise.race`, 1500 ms), nie globalny `commandTimeout` w `redis.ts`: globalny timeout zmieniałby zachowanie `GETDEL` w `add-business/draft-store.ts` (komenda wykonana po stronie Redisa, a wołający widzi porażkę → utracony szkic). Każdy błąd limitu → `console.error` bez IP i fail-open do Stripe.
- **R9:** `switch` po `verification.status` z jawną gałęzią `paid`, bez `default`.
- **Otwarte (P3):** po zakupie „ratunkowym” stara subskrypcja może odzyskać płatność (`past_due` → `active`) — founder płaci za dwie, a ślad jest tylko w logu `conflict`. Klient Redisa nadal bez globalnego timeoutu (osobna decyzja z ryzykiem dla `GETDEL`).

## Re-review fazy 3 po poprawkach (2026-11-01)

4 agentów (security, performance, kieran-typescript, spec-flow) na `5748887..HEAD`. Werdykt ⚠️ 0 × P1, 3 × P2, 14 × P3. Zamknięte: P2 #1, #2, #4, #5, #6, #7.

- **Wniosek o `livemode`:** porównanie trybu klucza z trybem zdarzenia nie chroni przed niczym realnym (inny `whsec` per tryb, `list` zwraca jeden tryb). Prawdziwe ryzyko to *klucz testowy + baza produkcyjna*. Potrzebna bramka na host bazy (R1).
- **Wniosek o rate limicie:** limit na stronie po płatności wprowadził twardą zależność od Redisa (R2). Każdy nowy `checkRateLimit` na ścieżce płacącego potrzebuje fail-open albo łagodnego wariantu.
- **R3:** blokada konfliktu przez `past_due` w karencji uniemożliwia „ratunkowy” zakup po wygaśnięciu karty.

## Środowisko worktree

- `node_modules`: własna instalacja (`npm ci`, 2026-10-31). Junction do głównego katalogu łamał Storybooka: webpack nie przetwarzał `.storybook/preview.ts` spoza ścieżki projektu. U8 może więc instalować `stripe` normalnie.
- **Brak `.env` w worktree, celowo.** `DATABASE_URL` = produkcja, więc buildery nie mogą zapisać nic do żywej bazy.
- Baseline 2026-10-31: `npx tsc --noEmit` przechodzi; `npx jest`: 113 suite'ów i 1288 testów zielonych.

## Odroczone do implementacji

- ~~Ceny i waluta~~: rozstrzygnięte (patrz wyżej).
- Ostateczne `PREMIUM_GRACE_DAYS`.
- Timeout i cache lookupu w middleware.
- Limit galerii (punkt odniesienia: 15) i wymiary cover.
- Mechanizm zwrócenia statusu 404 z middleware (musi przejść `curl`).
- Rate limit lookupu: IP klienta przy wywołaniu z middleware.
