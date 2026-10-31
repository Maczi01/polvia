# Kontekst: Strona firmy — darmowy profil + Premium

**Branch:** `feature/strona-firmy-premium` (worktree: `C:\Users\mateu\WebstormProjects\polvia-strona-firmy`, od `origin/master` @ `84638df`)
**Ostatnia aktualizacja:** 2026-10-31

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

## Odroczone do implementacji

- Ceny i waluta (kwoty w Stripe i w `Pricing.plans.essentials`).
- Ostateczne `PREMIUM_GRACE_DAYS`.
- Timeout i cache lookupu w middleware.
- Limit galerii (punkt odniesienia: 15) i wymiary cover.
- Mechanizm zwrócenia statusu 404 z middleware (musi przejść `curl`).
- Rate limit lookupu: IP klienta przy wywołaniu z middleware.
