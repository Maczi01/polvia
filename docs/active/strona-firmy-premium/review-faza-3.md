# Review fazy 3 — Subskrypcja (U8, U9, U10, U11)

**Data:** 2026-11-01
**Zakres:** `bbc304a..568bce1` (57 plików, +4352 / −361)
**Reviewerzy:** security-sentinel, performance-oracle, kieran-typescript-reviewer (+ architecture-strategist), spec-flow-analyzer (scenariusze i pokrycie testów). E2E pominięte (patrz niżej).

## Werdykt

⚠️ **KONTYNUUJ Z ZASTRZEŻENIAMI** — 0 × P1, 7 × P2, 26 × P3.

Faza jest poprawnie zbudowana: podpis webhooka, dedupe, `server-only`, `isPremiumActive` jako jedyne źródło prawdy, czysty bundle klienta, wszystkie scenariusze testowe z planu mają testy z realnymi asercjami, asercje nie zostały osłabione. Problemy P2 dotyczą **wierności stanu premium względem Stripe** (premium bez płacenia w trzech scenariuszach) i dwóch słabości strony `dziekujemy`. Przed startem sprzedaży naprawić wszystkie P2; #1–#3 razem, bo łącznie dają premium bez płatności.

Trzy ustalenia (#1, #2, #3) zweryfikowane przez orkiestratora w kodzie (`premium.ts:44-49`, `subscription-sync.ts:153` vs `:166`, brak `livemode` w `src/`).

## 🟠 P2 — important

### 1. Karencja `past_due` liczona od nowego końca okresu
`src/lib/premium.ts:39-49`, `src/lib/subscription-sync.ts:181` (spec-flow)
- Przy odnowieniu Stripe najpierw przesuwa okres (`items[].current_period_end` = +1 mies./+1 rok), potem płatność pada i status zmienia się na `past_due`.
- `isPremiumActive` daje wtedy `true` do **nowego** końca okresu + 3 dni; `promoted_services.expiresAt` tak samo. Firma ma premium i ranking bez płacenia przez cały cykl Smart Retries, a przy źle skonfigurowanej akcji końcowej — do roku (plan roczny).
- Testy (`premium.test.ts:25-35`, `subscription-sync.test.ts:154`) modelują `past_due` z `periodEnd` w przeszłości — stanu, którego Stripe nie produkuje.
- **Poprawka:** zapisywać `current_period_start` (z `items.data[]`) w `service_subscriptions`; dla `past_due` granica = `periodStart + PREMIUM_GRACE_DAYS`. Test: `past_due`, `periodEnd` za 28 dni, `periodStart` 4 dni temu → `false`.

### 2. Wyścig dwóch różnych zdarzeń tej samej subskrypcji zapisuje nieświeży stan
`src/lib/subscription-sync.ts:153` (retrieve) vs `:166` (lock) (spec-flow)
- `stripe.subscriptions.retrieve` jest **przed** transakcją z `FOR UPDATE`, więc blokada porządkuje zapisy, ale nie odczyty.
- Koniec Smart Retries: `invoice.payment_failed` (A pobiera `past_due`) i `customer.subscription.deleted` (B pobiera `canceled`) prawie naraz. B commituje, A nadpisuje `past_due` — z #1 premium wraca, a kolejne zdarzenie nie przyjdzie.
- Komentarz „kolejność zdarzeń nie ma znaczenia” jest prawdziwy tylko dla zdarzeń dostarczanych sekwencyjnie.
- **Poprawka:** `retrieve` po `lockService` w transakcji (lock do ~16 s przy obecnym ruchu — akceptowalne) **albo** `canceled` jako stan końcowy: nie nadpisywać go dla tego samego `stripeSubscriptionId`. Test: dwie równoległe synchronizacje z `retrieve` rozwiązanym w odwrotnej kolejności.

### 3. Brak rozróżnienia trybu testowego i produkcyjnego Stripe
`src/app/api/stripe/webhook/route.ts:52-60`, `src/db/sync-subscriptions.ts`, `src/lib/subscription-sync.ts:111-125` (spec-flow)
- `livemode` nie jest sprawdzany nigdzie. `DATABASE_URL` wskazuje na produkcję; Preview albo lokalny `.env` z kluczami `sk_test_` i tą samą bazą wiąże testową subskrypcję (karta 4242) po `metadata.serviceSlug` z prawdziwym wpisem → darmowe premium albo fałszywy konflikt.
- **Poprawka:** webhook: `event.livemode !== isLiveKey` → 200 bez synchronizacji (z logiem). CLI: pomijać subskrypcje z niezgodnym `livemode`, przed startem wypisać tryb klucza i host bazy (wzorzec `assertDropAllowed` w `drop.ts`).

### 4. Synchronizacja i weryfikacja sesji nie sprawdzają ceny/produktu
`src/lib/subscription-sync.ts:110`, `:153-165`; `src/lib/stripe-webhook-events.ts:33`; `src/lib/premium-checkout.ts:104-109` (security)
- Allowlista cen działa tylko przy tworzeniu sesji. Sync nadaje premium każdej subskrypcji na koncie, którą da się powiązać z wpisem; `client_reference_id` przyjmowany przy samym formacie UUID.
- Dowolny Payment Link subskrypcyjny na koncie (inny/tańszy produkt, link testowy) przyjmuje `?client_reference_id=<uuid>`; UUID-y wpisów są publiczne (`/api/services`). Zmiana planu w Customer Portal na inny produkt też zachowa premium.
- **Poprawka:** w `toSubscriptionRecord` wymagać `items.data[].price.id ∈ {STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY}`, inaczej `unlinked` + `console.warn` (snapshot z `price.id`). W `verifyPaidCheckoutSession` ten sam warunek (`expand: ['line_items']` albo przez subskrypcję). Operator: w Customer Portal tylko te dwie ceny.

### 5. Mail o konflikcie subskrypcji przy każdym zdarzeniu i każdym resyncu
`src/lib/subscription-sync.ts:188-200` (architektura P2, security i spec-flow P3)
- `notifySubscriptionConflict` jest wewnątrz `syncSubscriptionFromStripe`, poza bramką `isFirstDelivery`. Jeden zakup w konflikcie = 3–4 maile (`checkout.session.completed`, `subscription.created`, `invoice.paid`, `.updated`), potem przy każdym odnowieniu i każdym `db:sync-subscriptions`.
- Łamie zapisany kontrakt webhooka (skutki uboczne po oznaczeniu zdarzenia) i miesza skutek uboczny z idempotentną synchronizacją.
- Dodatkowo po `db:reset` CLI (lista od najnowszych) zapisze **nowszą** subskrypcję — tę, którą founder miał zwrócić — a starą oznaczy jako konflikt.
- **Poprawka:** sync zwraca `{ outcome: 'conflict', serviceId, activeSubscriptionId, conflictingSubscriptionId, isIncomingActive }` bez maila; webhook wysyła mail w `processEvent` przy `isFirstDelivery` i jednym typie zdarzenia (`checkout.session.completed` lub `customer.subscription.created`). CLI wiąże w kolejności od najstarszej. Testy konfliktu-maila przenieść do `route.test.ts`.

### 6. Strona `dziekujemy` — publiczny GET bez limitu prosto do API Stripe
`src/app/[locale]/firma/[slug]/premium/dziekujemy/page.tsx:157-162`, `src/lib/premium-checkout.ts:139` (security)
- Każde żądanie z `session_id` w formacie `cs_live_…` i poprawnym slugiem woła `checkout.sessions.retrieve`, bez limitu i cache. Skrypt z losowymi `cs_live_…` zużywa limit API konta Stripe, wspólny z `sessions.create` (utracona sprzedaż: `CHECKOUT_FAILED`) i webhookiem (500, opóźniona aktywacja).
- **Poprawka:** `checkRateLimit` po `getClientIp({ headers: await headers() })` przed `verifyPaidCheckoutSession` (np. 20/h, wzorzec `isWithinLimit` z `_actions.ts`); po przekroczeniu `CheckoutNotConfirmed`.

### 7. Strona `dziekujemy` mówi płacącemu „nie potwierdzono”, gdy Stripe jest niedostępny
`src/app/[locale]/firma/[slug]/premium/dziekujemy/page.tsx:162-163` (architektura P2, spec-flow P3)
- `verification.status !== 'paid'` zrównuje `'unavailable'` (timeout/awaria Stripe) z `'invalid'`. Unia celowo je rozróżnia, a akcja materiałów robi to poprawnie (`VERIFY_FAILED` vs `FORBIDDEN`). Firma tuż po płatności widzi komunikat o niepowodzeniu.
- Strona nie ma żadnego testu mimo trzech gałęzi.
- **Poprawka:** osobny wariant „chwilowy problem, odśwież za chwilę” (klucz w 4 `messages/`); test gałęzi `unavailable` / `invalid` / zły format.

## 🟡 P3 — nit

### Webhook i synchronizacja
8. **Mail „opłacono” bez aktywnego premium** — `webhook/route.ts:62-68`: `notifyPremiumPurchased` przy `outcome === 'synced'` bez `isPremiumActive` (BLIK/3DS w toku, `incomplete`). Warunek `result.isPremiumActive` + test.
9. **`service_missing` / nie-UUID `client_reference_id` po cichu** — `subscription-sync.ts:110-112`, `:168-169`: zapłacono, nic nie zapisane, brak logu/maila. `console.warn` z identyfikatorami; rozważyć fallback na łańcuch slug → metadata.
10. **`setPromotion(null)` kasuje ręczną promocję operatora**; upsert nadpisuje dłuższy `expiresAt` operatora — `subscription-store.ts:85-95`. Jeśli świadome — wpis w checkliście operatora.
11. **Budżet webhooka bez wspólnego deadline'u, baza bez timeoutu** — `webhook/route.ts:27-32`, `subscription-notifications.ts`, `src/db/index.ts:8`: wolny Stripe + wolna baza → oznaczenie zdarzenia po ~22 s, mail 8 s ubity przez `maxDuration` (wzorzec z learned-patterns). Deadline od wejścia do `POST`; opcjonalnie `lock_timeout`/`statement_timeout` w transakcji.
12. **`sync-subscriptions` pobiera każdą subskrypcję drugi raz** — `sync-subscriptions.ts:32-34`: `list` zwraca pełne obiekty, a sync robi `retrieve`. `syncSubscriptionSnapshot` bez `retrieve` dla CLI albo komentarz.
13. **Zmiana slugu + `db:reset`** — nieaktualny `metadata.serviceSlug` i stary UUID → `service_missing`, premium znika po resyncu. Slug jest niezmienny z założenia — dopisać do dokumentacji operatora.

### Alias i lookup
14. **SWR 24 h dla aliasu** — `api/service-slug/[slug]/route.ts:50-56`: `s-maxage=300, stale-while-revalidate=86400` daje opóźnienie premium do 24 h, nie „do 5 min” (komentarz i decyzja w kontekście). Skrócić SWR dla `exists` (np. 300) albo poprawić opis.
15. **Każdy jednosegmentowy 404 to funkcja Node + SELECT** — `middleware.ts:76-92`: ścieżki skanerów bez kropki (`/wp-admin`, `/phpmyadmin`) omijają cache (unikalne), ruch z sekretem omija limit. `stale-while-revalidate` dla `missing` i/lub kilka segmentów skanerów w `STATIC_RESERVED_SEGMENTS`.
16. **Slug kolidujący z segmentem zarezerwowanym albo zaczynający się od `api`** nie dostaje aliasu obiecanego w `/cennik`, bez sygnału — `service-profile-path.ts:80-114`, matcher `middleware.ts:163`. Walidacja przy nadawaniu slugu albo ostrzeżenie w mailu `premium_purchased`.

### Checkout i materiały
17. **Druga płatność w oknie przed webhookiem** — `_actions.ts:79-81`: dwie karty → dwa checkouty, obie płatności pobrane; konflikt rozstrzygany po fakcie (ręczny zwrot). Zgodne z planem; opcjonalnie `subscriptions.search` po `metadata['serviceId']` przed `sessions.create`.
18. **Formularz materiałów można wysłać wiele razy; `sendMail` bez własnego limitu** — `_actions.ts:143-171`: odświeżenie strony pokazuje formularz ponownie; fazy SMTP do ~30 s > limit Server Action. Znacznik „wysłano” per `session_id` (Redis TTL) + `sendWithTimeout`.
19. **`session_id` w URL może wyciec** — `dziekujemy/page.tsx`: brak `referrer: 'no-referrer'`.
20. **`payment_status === 'paid'` jako jedyny warunek** — `premium-checkout.ts:110-116`: kupon 100%/trial dałby `no_payment_required`. Komentarz, że świadome.
21. **Link do profilu w mailu z materiałami względny** — `_actions.ts:105`: `buildProfileCanonicalUrl(env.NEXT_PUBLIC_SITE_URL, 'pl', slug)`.

### Architektura i jakość kodu
22. **`premium-checkout.ts` importuje `SUBSCRIPTION_METADATA_KEYS` z `subscription-sync.ts`** — wciąga store, powiadomienia i mailer. Klucze do lekkiego `src/lib/subscription-metadata.ts`.
23. **`subscriptionColumns`/`subscriptionJoin` w `service-profile-queries.ts` (300 linii)** — przenieść do `src/lib/subscription-query-parts.ts`; `subscription-store.ts:65-70` powtarza te same kolumny ręcznie.
24. **`syncSubscriptionFromStripe` ma 52 linie** (`subscription-sync.ts:149-200`) — wyciągnąć `applySubscriptionState`; po #5 i tak się skróci.
25. **Nazwy `stripe-events.ts` vs `stripe-webhook-events.ts`** — np. `stripe-event-dedupe.ts` i `stripe-event-sync-target.ts`.
26. **`VISIBLE_FIELDS` przepisuje unię ręcznie** — `_checkout-schema.ts:73-78`: `new Set<PremiumMaterialsField>(['template', ...PREMIUM_MATERIALS_TEXT_FIELDS])`; `_actions.ts:130` → `PremiumMaterialsField[]`.
27. **Powielony helper locale** (`hasLocale(...) ? x : defaultLocale`) — `pricing/page.tsx:16`, `dziekujemy/page.tsx:25`, `_actions.ts:50` (+3 starsze miejsca). `toLocale()` w `@/i18n/config`.
28. **Kwota planu w trzech źródłach + dwa słowniki interwału** — `Pricing.plans.essentials.*` i `ServiceProfile.checkout.*`; `BillingPeriod = 'monthly' | 'annual'` vs `PremiumInterval = 'monthly' | 'yearly'`. Jeden zestaw kluczy i `PremiumInterval`. Domyślny interwał: `monthly` na profilu, `yearly` na `/cennik` — ujednolicić.
29. **Drobne w webhooku i `/cennik`** — `webhook/route.ts:39` `jsonError(code: string)` → typ `WebhookErrorCode`; `pricing/page.tsx:42-43` podwójna pusta linia, komentarz o `<main>` w złym miejscu.

### Testy (poza scenariuszami planu)
30. **Luki w testach webhooka** — `stripe-webhook-events.ts` bez testu własnego; `route.test.ts` nie pokrywa `customer.subscription.created`, `.deleted`, `invoice.paid`; brak testu równoległego duplikatu (`markStripeEventProcessed → false`); `route.test.ts` mockuje wewnętrzny `syncSubscriptionFromStripe` (reguła §2 — do obrony jako granica unit, ale odnotowane).
31. **`sync-subscriptions.ts` bez testu**; adaptery `subscription-store.ts` i `stripe-events.ts` bez testu (świadome, SQL `FOR UPDATE`/upserty weryfikowane tylko ręcznie).
32. **`pricing-plans.test.tsx` bez `uk` w `it.each`**; `service-profile-queries.test.ts` 456 linii (zgłoszone przy U8).
33. **Trasa `dziekujemy` poza `pathnames`** (`routing.ts` niezmieniony) — działanie potwierdzone tylko analizą kodu; do testu ręcznego (krok `Operator:` U9).

## Odchylenia od planu

- **Pliki z sekcji „Pliki” U8–U11 — wszystkie istnieją**, w tym wszystkie pliki testowe z planu. Brak P2 z tytułu brakujących testów.
- `Delegate to:` zgodne z kategorią plików we wszystkich czterech IU.
- Dedupe: SELECT przed synchronizacją + INSERT po niej (plan dopuszcza „zapis po sukcesie”) — udokumentowane w kontekście.
- Dodatkowe moduły (`subscription-store`, `subscription-notifications`, `stripe-events`, `stripe-webhook-events`, `premium-checkout*`) — podział sensowny (adapter vs logika, czyste funkcje, lekkie stałe dla klienta); uwagi tylko #22, #23, #25.
- `src/i18n/routing.ts` niezmieniony (plan: „jeśli wymagana”) — #33.

## Sprawdzone bez uwag

- **Podpis webhooka:** `runtime = 'nodejs'`, surowe `request.text()` → `constructEvent`; 400 przed I/O; testy podpisują prawdziwym HMAC paczki.
- **Dedupe:** `on conflict do nothing returning`; mail o zakupie raz przy równoległych dostarczeniach; `FOR UPDATE` szereguje zapisy; lock trzymany milisekundy (Stripe i mail poza transakcją).
- **Server Actions:** Zod przed limitem, limit po IP, cena z allowlisty, `client_reference_id` i metadata ustawia serwer; `submitPremiumMaterials` ponownie weryfikuje sesję i wiąże ją ze slugiem; `redirect` poza `try`.
- **Dane i sekrety:** dane płacącego tylko w mailu do operatora (tylko `text`, temat przez `toHeaderText`, `replyTo` ze Stripe); `STRIPE_*` tylko w `server` + `runtimeEnv`; `server-only` na modułach z db/Stripe/mailem; brak surowych błędów w odpowiedziach.
- **Open redirect:** alias to ta sama domena ze zwalidowanego slugu; `success_url`/`cancel_url` z env.
- **Zapytania i indeksy:** joiny po PK z `limit(1)`, UNIQUE na `stripe_subscription_id`, brak N+1.
- **Bundle klienta:** `upgrade-cta`, `premium-materials-form`, `pricing-plans` importują wartości tylko z lekkich modułów; akcje wstrzykiwane propsami.
- **Type safety:** brak `any`, `!`, `as` (poza `as const`); unie wyników obsłużone wyczerpująco; typowane błędy, brak pustych `catch`; brak `'/en'` na sztywno.
- **Testy:** każdy scenariusz `[Unit]` U8–U11 ma test z realną asercją (tabela mapowania w raporcie spec-flow; 35 suite'ów / 335 testów zielonych w zakresie fazy). Zmienione asercje w testach profilu i lookupu odpowiadają nowemu zachowaniu, nie są słabsze.

## E2E

⚪ Pominięte — faza 3 nie ma żadnego checkboxa `Weryfikacja:` dla przeglądarki (wszystkie to CLI). Scenariusze przeglądarkowe są krokami `Operator:` (wymagają kluczy Stripe w trybie testowym). Dodatkowo w worktree celowo nie ma `.env`, a dev server nie działa.

## Bookkeeping checkboxów Weryfikacja:

- Odznaczone automatycznie (CLI/grep): 16
- Odznaczone na podstawie E2E: 0
- Pozostawione dla operatora (Manual): 0
- Niejasne (P3): 0
- Failujące (P2): 0

### Szczegóły
- [x] U8 `npx tsc --noEmit` → PASS (exit 0)
- [x] U8 `npx jest src/lib/premium src/lib/subscription-sync "src/app/api/stripe"` → PASS (5 suite'ów / 49 testów)
- [x] U8 `npx next lint` → PASS (0 błędów)
- [x] U8 grep `process.env` w nowych plikach / `STRIPE_SECRET_KEY` tylko w `server` → PASS (0 trafień poza `env.ts`; `env.ts:31` server, `:54` runtimeEnv)
- [x] U9 `npx tsc --noEmit` → PASS
- [x] U9 `npx jest "src/app/\[locale\]/firma"` → PASS (25 / 123)
- [x] U9 `npx next lint` → PASS
- [x] U9 `npx jest src/i18n/messages-parity` → PASS (1 / 6)
- [x] U10 `npx tsc --noEmit` → PASS
- [x] U10 `npx jest src/lib/service-profile-path "src/app/api/service-slug"` → PASS (2 / 113)
- [x] U10 `npx next lint` → PASS
- [x] U11 `npx tsc --noEmit` → PASS
- [x] U11 `npx jest "src/app/\[locale\]/\(header\)/pricing"` → PASS (1 / 9)
- [x] U11 `npx next lint` → PASS
- [x] U11 grep `href="#"` w `pricing/**` → PASS (0 trafień)
- [x] U11 `npx jest src/i18n/messages-parity` → PASS

(Komendy `tsc`, `lint` i `messages-parity` liczone osobno dla każdego IU.)

---

# Re-review fazy 3 po poprawkach P2 (2026-11-01)

**Zakres:** `git diff 5748887..HEAD -- . ':!docs'` (commity `3b8df5a`, `0661ce2`; 24 pliki, +955/−118).
**Agenci:** security-sentinel, performance-oracle, kieran-typescript-reviewer (architektura + TS), spec-flow-analyzer (scenariusze + testy). E2E pominięte: brak `.env` (DATABASE_URL = produkcja) i brak otwartych checkboxów `Weryfikacja:` w fazie 3.
**Gate:** tsc OK, jest 163 suite'y / 1790 testów, lint 0 błędów.

## Werdykt: ⚠️ KONTYNUUJ Z ZASTRZEŻENIAMI — 0 × P1, 3 × P2, 14 × P3

### Status pierwotnych P2

| # | Problem | Status |
|---|---|---|
| 1 | Karencja `past_due` od nowego końca okresu | ✅ zamknięty |
| 2 | Wyścig `retrieve` przed blokadą | ✅ zamknięty (scenariusz `canceled`); wyścigi niekońcowe → P3 R6 |
| 3 | Brak sprawdzenia `livemode` | ⚠️ **częściowo** → R1 |
| 4 | Brak sprawdzenia ceny | ✅ zamknięty |
| 5 | Wielokrotny mail o konflikcie | ✅ zamknięty |
| 6 | Strona `dziekujemy` bez limitu | ✅ zamknięty, ale nowa zależność od Redisa → R2 |
| 7 | `unavailable` jako „nie potwierdzono” | ✅ zamknięty |

Cykl `premium-checkout` ↔ `subscription-sync` usunięty. Zmienione istniejące testy nie zostały osłabione (asercje maila przeniesione do `route.test.ts`, ściślejsze `toHaveBeenCalledWith`), z dwoma drobnymi wyjątkami (P3 R10, R11).

## 🟠 P2

**R1. `livemode` nie chroni przed kluczem testowym + produkcyjną bazą** — `src/app/api/stripe/webhook/route.ts:108`, `src/db/sync-subscriptions.ts:53,67`. (security + spec-flow; zweryfikowane)
Kod łapie tylko niezgodność trybu klucza i zdarzenia, która w praktyce nie występuje: endpoint testowy ma inny `whsec` (400 na podpisie), a `subscriptions.list` zwraca obiekty jednego trybu (gałąź `wrong_mode` w CLI jest martwa). Pierwotny scenariusz zostaje: lokalny `.env` z produkcyjnym `DATABASE_URL` + `sk_test_` + `stripe listen` / „lokalny test checkoutu” z kroków operatora → karta 4242 daje prawdziwemu wpisowi premium i ranking na ~miesiąc. Poprawka: bramka wzorem `assertDropAllowed` (`src/db/drop.ts:19`, `LOCAL_HOSTS`): `!STRIPE_LIVE_MODE` i host bazy spoza `LOCAL_HOSTS` → webhook 200 bez sync, CLI odmawia startu; ewentualny jawny override w `env.ts`. Usunąć martwy filtr `wrong_mode`.

**R2. Awaria Redisa → strona błędu płacącemu tuż po zapłacie** — `src/app/[locale]/firma/[slug]/premium/dziekujemy/page.tsx:34-42, 227`, `src/lib/redis.ts:5-8`. (performance + architektura + spec-flow; security jako P3; zweryfikowane)
`isWithinVerifyLimit` nie łapie `RateLimitStoreError` ani błędu ioredis, a pod `src/app/[locale]` nie ma `error.tsx`. Przed poprawką #6 strona nie zależała od Redisa. Do tego ioredis nie ma `commandTimeout` (tylko `maxRetriesPerRequest: 3`), więc przy zawieszonym Redisie render czeka kilkadziesiąt sekund. Poprawka: `try/catch` z logiem → fail-open (wołamy Stripe, który ma własny limit) albo `CheckoutUnavailable`; `commandTimeout` ~1–2 s w `redis.ts` (zabezpiecza też akcje premium). Test „`checkRateLimit` rzuca”.

**R3. Nowy zakup w trakcie karencji `past_due` starej subskrypcji: zapłacono, premium brak do odnowienia** — `src/lib/subscription-sync.ts:156-164` + `route.ts:64-80`. (spec-flow; zweryfikowane w kodzie)
Stara subskrypcja `past_due` w 3-dniowej karencji → `isPremiumActive` = true → wszystkie zdarzenia nowej, opłaconej subskrypcji kończą się `conflict` bez zapisu, a founder dostaje mail sugerujący zwrot nowej. Po `canceled` starej nic nie synchronizuje nowej aż do jej odnowienia (miesiąc/rok) albo ręcznego `db:sync-subscriptions`. To naturalna ścieżka „wygasła karta → kupuję jeszcze raz”. Poprawka: przychodząca `active`/`trialing` wygrywa z zapisaną `past_due` (zapis + log zamiast konfliktu). Test: stored `past_due` w karencji + przychodząca `active` o innym `id` → zapis, premium, brak maila o konflikcie.

## 🟡 P3

- **R4** `webhook/route.ts:68-69`: gałąź stanu końcowego zwraca `synced` z `isPremiumActive: false`, a `notifyAfterCheckout` wysyła „opłacono” przy każdym `synced`. Pogłębia P3 #8; warunek `result.isPremiumActive` zamyka oba.
- **R5** `premium-checkout.ts:111`: `line_items.has_more` ignorowane (>10 pozycji). Odrzucić sesję przy `has_more`.
- **R6** `subscription-sync.ts`: wyścigi niekońcowe (nieświeży `active` po `past_due`). Wąskie okno, samonaprawialne.
- **R7** `premium.ts:50-53`: `past_due` po zmianie planu w środku okresu liczy karencję od chwili zmiany. Potwierdzić `payment_behavior` Customer Portalu.
- **R8** `subscription-sync.ts:229-230` vs `premium-prices.ts:14`: dwie wersje reguły cen (pusta lista). Opisać różnicę w JSDoc.
- **R9** `dziekujemy/page.tsx:232-237`: `paid` jako gałąź domyślna bez exhaustiveness. `switch` z `never`.
- **R10** `route.test.ts` „konflikt nie wysyła maila o zakupie”: asercja po tytule maila wpisanym na sztywno. Zamienić na `toHaveBeenCalledTimes(1)` + asercję na mail o konflikcie.
- **R11** `subscription-sync.test.ts` „nieaktywna druga subskrypcja”: `toEqual` → `toMatchObject` zgubiło ID. Przywrócić pełny `toEqual`.
- **R12** Brakujące testy: `past_due` → `active` z odtworzeniem promocji, `trialing`, wiele pozycji (max startów/końców), `incomplete` po `incomplete_expired`. Test wyścigu #2 (`:238`) jest sekwencyjny i dubluje `:220`.
- **R13** `sync-subscriptions.ts:74-76`: konflikt w CLI bez `activeSubscriptionId` w logu.
- **R14** `stale_ignored` jako osobny wariant wyniku zamiast `synced` (czytelność, widoczny w CLI przez `Record<Outcome>`).
- **R15** Postgres bez `connect_timeout` / `lock_timeout` (`src/db/index.ts:8`): czekanie na `FOR UPDATE` bez limitu wobec `maxDuration` 30 s.
- **R16** `schema.ts:179`: `current_period_start NOT NULL` bez default. `push` padnie, jeśli `service_subscriptions` ma już wiersze.
- **R17** `isWithinVerifyLimit` duplikuje `isWithinLimit` z `_actions.ts`; `resolveServerTree` w teście przy drugim użyciu do wspólnego modułu. Mail o konflikcie przepada przy awarii SMTP po `markStripeEventProcessed`: krok operatora — przeglądać logi `conflict`.

## Bookkeeping checkboxów Weryfikacja: (re-review)

- Odznaczone automatycznie (CLI/grep): 0 (wszystkie 16 odznaczone w pierwszym review)
- Odznaczone na podstawie Agent 5 E2E: 0
- Pozostawione dla operatora: 0
- Niejasne: 0
- Failujące: 0

---

# Review fazy 3 — runda 3 (po poprawkach re-review, 2026-11-01)

**Zakres:** `git diff 61c1367..HEAD -- . ':!docs'` (commity `e6aab21`, `ed2ffcc`; 10 plików, +457/−60).
**Agenci:** security-sentinel, performance-oracle, kieran-typescript-reviewer, spec-flow-analyzer. E2E pominięte (brak `.env`, brak otwartych checkboxów `Weryfikacja:`).
**Gate:** tsc OK, jest 164 suite'y / 1812 testów, lint 0 błędów.

## Werdykt: ⚠️ KONTYNUUJ Z ZASTRZEŻENIAMI — 0 × P1, 1 × P2, 11 × P3

### Status R1–R4 (+R9)

| # | Status |
|---|---|
| R1 bramka klucz testowy + baza nielokalna | ✅ zamyka ryzyko zapisu (security sprawdził obejścia URL vs parser `postgres.js`: rozbieżności tylko w bezpieczną stronę; jedyne ścieżki zapisu subskrypcji to webhook i CLI). Nowy problem → T1 |
| R2 fail-open na `dziekujemy` | ✅ (timer sprzątany, brak unhandled rejection; wymuszenie fail-open przez atakującego nieopłacalne) |
| R3 wyparcie `past_due` | ✅ bez wektora ataku; ⚠️ przesłanka nietrafna → T5 |
| R4 mail „opłacono” tylko przy premium | ✅ |
| R9 `switch` z jawną gałęzią `paid` | ✅ (TS2366 wymusza exhaustiveness przy jawnym typie zwracanym) |

Testy nie osłabione (zmienione tylko fabryki mocków na gettery).

### Zweryfikowane przez orkiestratora — korekta klasyfikacji

Architektura i spec-flow zgłosiły jako 🟠 „podwójna opłata bez śladu” oraz „anulowanie nowszej z dwóch opłaconych zdejmuje premium”. Security wykazał, a orkiestrator potwierdził w kodzie (`_actions.ts:80` `ALREADY_PREMIUM` przy `hasActivePremium`; `premium-checkout-queries.ts:48` = `isPremiumActive`, który obejmuje `past_due` w karencji), że **w 3-dniowej karencji nie da się rozpocząć nowego checkoutu**. Oba scenariusze wymagają sesji Checkout otwartej przed przejściem w `past_due` (ważnej do 24 h) — stąd obniżenie do 🟡 (T3, T5).

## 🟠 P2

**T1. Bramka R1 odpowiada 200 — przy błędnej konfiguracji wdrożenia zdarzenia przepadają na stałe** — `src/app/api/stripe/webhook/route.ts:112-117`. (spec-flow; zweryfikowane)
Scenariusz: na produkcji `sk_test_` razem z live `whsec` (pomyłka w zmiennych Vercela). Podpis przechodzi, bramka zwraca 200, Stripe uznaje zdarzenie za dostarczone i nie ponawia. Przed R1 to samo zdarzenie kończyło się 500 (`retrieve` subskrypcji live kluczem testowym rzuca) i Stripe ponawiał przez 3 dni, więc stan sam się naprawiał po poprawce klucza. `db:sync-subscriptions` odtworzy tabele, ale nie maile (zakup, konflikt). Poprawka: bramka zwraca 503 + `console.error` (błąd konfiguracji „leci wyżej”, jak opisuje komentarz przy `verifyEvent`); przy lokalnym `stripe listen` i Preview 503 nic nie psuje. Test: kombinacja → 503, sync niewołany, zdarzenie nieoznaczone.

## 🟡 P3

- **T2** `dziekujemy/page.tsx`: brak `export const maxDuration = 30` — najgorszy render ~18 s (Redis 1,5 s + Stripe 8 s × 2); bez Fluid compute stare limity 10–15 s → 504 zamiast `CheckoutUnavailable`.
- **T3** `subscription-sync.ts:180-183`: konflikt przy zdarzeniu innym niż `checkout.session.completed` nie jest logowany, a anulowanie nowszej z dwóch opłaconych zdejmuje premium do następnego zdarzenia starszej. Osiągalne tylko przez wcześniej otwartą sesję (patrz korekta). Minimum: `console.warn` przy każdym `conflict && isIncomingActive` + test „stara `past_due` → `active` po wyparciu”; krok operatora po podwójnej płatności: anulować starszą i `db:sync-subscriptions`.
- **T4** `dziekujemy/page.tsx` (297/300 linii): `checkRateLimitWithTimeout` + `RateLimitCheckTimeoutError` to infrastruktura limitu — przenieść do `src/lib/rate-limit.ts` (unit test zamiast testu strony na fake timerach), scalić z `isWithinLimit` z `_actions.ts` (R17; trzeci wzorzec `Promise.race`+timer obok `subscription-notifications.ts`). Polityka fail-open zostaje w stronie.
- **T5** Przesłanka R3 („wygasła karta → kupuję jeszcze raz”) nie zgadza się z `ALREADY_PREMIUM`. Decyzja: (i) dopuścić checkout przy `past_due` (wtedy T3 staje się realne) albo (ii) uznać R3 za obronę na wyścig i poprawić JSDoc w `subscription-sync.ts:156`.
- **T6** `applySubscriptionState`: `supersedesPastDue` liczony dwa razy (raz ukryty w `conflictingSubscriptionId`) — czysta funkcja decyzji zwracająca unię `conflict | stale | write(replacedId)`.
- **T7** Testy: kolejność bramek webhooka (live event + test key + zdalna baza; zdarzenie już w `stripe_events`), sekwencje R3 (`payment_failed` A po B, `incomplete`→`active` B, dwie nowe po sobie, A `past_due`→`active`), czyszczenie timera po rozwiązanym limicie.
- **T8** `premium-checkout.ts:67`: brak `payment_method_types` — metoda z opóźnionym rozliczeniem (SEPA) włączona w Dashboardzie → `checkout.session.completed` przed `active` → mail o zakupie nie wychodzi wcale. Przypiąć `['card']` (+ BLIK, jeśli zaakceptowany) albo potwierdzić konfigurację Dashboardu.
- **T9** `_actions.ts:159-167`: mail „materiały” na środowisku z kluczem testowym bez oznaczenia — `[TEST]` w temacie przy `!STRIPE_LIVE_MODE`.
- **T10** `database-host.ts`: JSDoc — bramka chroni przed złym `DATABASE_URL`, nie przed tunelem na localhost (ssh -L, cloud-sql-proxy).
- **T11** Drobne: klucz limitu wyliczony przed `try` (błąd programistyczny w `rateLimitSubject` dawałby cichy fail-open); `assertKeyModeMatchesDatabase(host)` miesza źródła; podwójne parsowanie URL w `drop.ts`; dwie konwencje sprzątania `console` spy; fail-open widoczny tylko w logu (krok operatora: przeglądać logi `failing open`); rozjazd CLI (najstarsza) vs webhook (najnowsza) przy podwójnej płatności.

## Bookkeeping checkboxów Weryfikacja: (runda 3)

- Odznaczone automatycznie (CLI/grep): 0 (wszystkie 16 odznaczone w pierwszym review)
- E2E: 0; Manual: 0; Niejasne: 0; Failujące: 0

---

# Review fazy 3 — runda 4 (po poprawkach rundy 3, 2026-11-01)

**Zakres:** `git diff 1298f72..HEAD -- . ':!docs'` (commit `4b11e94`; 8 plików, +148/−19).
**Agenci:** security-sentinel, kieran-typescript-reviewer (+ perspektywa architecture-strategist), spec-flow-analyzer. Performance oceniony przez orkiestratora (jedyna zmiana w tym obszarze to `maxDuration`, patrz U2). E2E pominięte (brak `.env`, brak otwartych checkboxów `Weryfikacja:`).
**Gate:** tsc OK, jest 3 dotknięte suite'y 69/69 (pełny: 164 / 1817 z rundy poprawek), eslint 0 błędów (nowe `no-console` warn — przyjęty wzorzec modułu).

## Werdykt: ✅ GOTOWE DO KONTYNUACJI — 0 × P1, 0 × P2, 5 × P3

### Status T1–T3, T9, T10

| # | Status |
|---|---|
| T1 webhook 503 `CONFIG_MISMATCH` | ✅ bramka po HMAC — niepodpisany klient nie wymusi 503 ani nie pozna konfiguracji; zdarzenie nieoznaczone, więc ponowienie przechodzi przez dedupe; kolejność bramek zablokowana testem. Zmiana testu 200→503 to świadoma zmiana kontraktu, asercje pełniejsze niż wcześniej |
| T2 `maxDuration = 30` | ✅ dla renderu; skutek dla Server Action → U2 |
| T3 log konfliktu | ✅ obejmuje wszystkie typy zdarzeń i CLI, bez spamu przy ponowieniach (dedupe przed sync); fałszywy alarm dla `past_due` → U1 |
| T9 `[TEST]` w mailu materiałów | ✅; pozostałe maile → U4 |
| T10 JSDoc o tunelu | ✅ |

Scenariusze wdrożeń przy T1 (spec-flow): produkcja poprawna — bez zmian; `sk_test_` na produkcji — 503 i ponowienia (cel poprawki; checkout i tak pada na „No such price”, więc okno strat to odnowienia/anulowania); endpoint testowy na domenę produkcyjną — 400 na podpisie, bez zmian; lokalnie z dockerem — sync; lokalnie z bazą produkcyjną — 503 widoczne w CLI zamiast cichego 200.

## 🟡 P3

- **U1** `src/lib/subscription-sync.ts:203-210, 224` — log „second paid subscription” bazuje na `isIncomingActive = isPremiumActive(...)`, a `past_due` w karencji jest uprawniony (`premium.ts:41`). Po wyparciu starej `past_due` (R3) każde jej `invoice.payment_failed` / `subscription.updated` (Smart Retries) loguje „podwójną opłatę”, choć stara nic nie zapłaciła — operator szuka płatności do zwrotu, której nie ma. Poprawka: w `reportConflict` (i w polu sterującym mailem „wymagany zwrot”) warunek `record.status ∈ {active, trialing}`; test: zapisana nowa `active` + przychodząca stara `past_due` w karencji → brak logu. (spec-flow; zweryfikowane w kodzie)
- **U2** `premium/dziekujemy/page.tsx:28-29` — `maxDuration` dotyczy też `submitPremiumMaterials` (akcja wołana z tej strony wykonuje się w tej samej funkcji). Najgorszy przypadek akcji: limit + `retrieve` 8 s × 2 + SMTP do 10 s/fazę > 30 s; przy Fluid compute (domyślnie 300 s) eksport realnie obniża limit akcji → błąd sieci zamiast `SEND_FAILED`. Poprawka: `60` + komentarz z budżetem akcji, albo świadoma decyzja w komentarzu (akcja do ponowienia, płatność niezagrożona). (kieran)
- **U3** `strona-firmy-premium-zadania.md` „Po wdrożeniu” — dokumentacja operatora po T1: (a) „Stripe ponawia do 3 dni” nieprawdziwe dla `stripe listen` (brak ponowień; tryb testowy ponawia kilka razy w godzinach) → po zmianie bazy `stripe events resend <evt>`; (b) nie rejestrować testowego endpointu webhooka dla Preview — Preview ma nielokalną bazę, więc 503 na każde zdarzenie, maile o awarii, w końcu wyłączenie endpointu; (c) procedura po `CONFIG_MISMATCH` na produkcji: poprawić klucz + redeploy, sprawdzić/włączyć endpoint w Dashboardzie, `db:sync-subscriptions` z kluczem live, ponownie wysłać nieudane `checkout.session.completed` spoza okna ponowień (tylko to odtwarza maile). Kod bez zmian. (security, spec-flow, kieran — zduplikowane)
- **U4** `src/lib/subscription-notifications.ts:49,71` — `[TEST]` tylko w mailu materiałów; lokalny test z `stripe listen` wysyła na prawdziwą skrzynkę „Nowa subskrypcja premium” i „…wymagany zwrot” bez oznaczenia. Ten sam prefiks z `STRIPE_LIVE_MODE` w `notifyFounder` + test obu trybów. (spec-flow)
- **U5** `src/lib/subscription-sync.ts:203-212, 228` — `reportConflict` zwraca swój argument, żeby owinąć `return` (log w środku wyrażenia). Jawny krok: `const conflict: SubscriptionConflict = {…}; logPaidConflict(conflict); return conflict;` — najlepiej razem z T6 (unia decyzji). (kieran)

## Bookkeeping checkboxów Weryfikacja: (runda 4)

- Odznaczone automatycznie (CLI/grep): 0 (wszystkie 16 odznaczone w pierwszym review)
- E2E: 0; Manual: 0; Niejasne: 0; Failujące: 0

---

# Review fazy 3 — runda 5 (po domknięciu P3 i uśpieniu Stripe, 2026-11-01)

**Zakres:** `git diff d5fa59c..HEAD -- . ':!docs'` (commity `2881345`, `ce9cccd`; 137 plików, +7063/−2709).
**Agenci:** security-sentinel, performance-oracle, kieran-typescript-reviewer (+ architecture-strategist), spec-flow-analyzer. E2E pominięte (brak `.env` w worktree, `DATABASE_URL` = produkcja; brak otwartych checkboxów `Weryfikacja:`).
**Gate (przed review):** tsc OK, jest 189 suite'ów / 2056 testów, lint 0 błędów.

## Werdykt: ⚠️ KONTYNUUJ Z ZASTRZEŻENIAMI — 0 × P1, 6 × P2, 30 × P3

Poprawki P3 rund 1–4 zrobione poprawnie; asercje nie osłabione (podziały plików zachowują wszystkie `it`, zmiany to świadome zmiany kontraktu: #23 sitemapa, `CHECKOUT_DISABLED`, nowe joiny). Uśpienie Stripe szczelne: każda ścieżka Stripe za bramką `isStripeConfigured` przed I/O, `hasActivePremium` jedynym odczytem premium firmy, joiny tylko po `service_id`. Wszystkie P2 zweryfikowane przez orkiestratora w kodzie. P2-1 i P2-3 są uśpione przy wyłączonym Stripe; P2-2 i P2-4 dotyczą wdrożenia bez Stripe; P2-5 i P2-6 to luki testów na regułach z ostatniej decyzji.

## 🟠 P2

**P2-1. `env.ts:70` — `resolveStripeConfig(env)` na końcu modułu rzuca w przeglądarce.** (kieran; zweryfikowane)
`@t3-oss/env-core` 0.12 rzuca przy odczycie zmiennej z sekcji `server` na kliencie, a funkcja destrukturyzuje pięć `STRIPE_*`. Każdy przyszły import `env` w komponencie `'use client'` (po to istnieje sekcja `client: NEXT_PUBLIC_SITE_URL`) wywali hydratację na produkcji; SSR i testy (mock `env`) tego nie pokażą. Dziś żaden klient nie importuje `env` — pułapka uśpiona. Poprawka: `if (typeof window === 'undefined') resolveStripeConfig(env);` + komentarz; przy okazji `emptyStringAsUndefined: true` (P3-16).

**P2-2. `premium/dziekujemy/page.tsx:242` — bez Stripe `notFound()` daje soft-404 (200).** (security P3 + spec-flow P2; zweryfikowane: `src/app/[locale]/loading.tsx` istnieje, middleware łapie tylko 2-segmentowe `/firma/<slug>`)
Wzorzec z `learned-patterns.md` („Catch-all + `<Suspense>`”). Krok operatora „`dziekujemy` → 404” nie przejdzie `curl`; `page.disabled.test.tsx` sprawdza tylko sygnał `notFound`. Poprawka: gałąź w `middleware.ts` — Stripe nieskonfigurowany + ścieżka `/{locale?}/firma/<slug>/premium/dziekujemy` → `rewrite(SERVICE_PROFILE_NOT_FOUND_PATH)`; dopasowanie jako czysta funkcja w `service-profile-path.ts` z testem.

**P2-3. `firma/[slug]/_actions.ts:216` vs `:224` — fail-open znacznika materiałów nieosiągalny.** (kieran; zweryfikowane)
`isWithinPremiumLimit('materials')` rzuca przy awarii Redisa przed `claimSend` (który celowo przepuszcza). Płacący po zakupie dostaje wyjątek z Server Action (brak `error.tsx` pod `[locale]`) zamiast typowanego błędu — łamie wniosek z kontekstu („każdy limit na ścieżce płacącego potrzebuje fail-open”) i format `{ error }`. Test `_actions.materials.test.ts:263` pokrywa tylko awarię znacznika. Uśpione (bez Stripe `CHECKOUT_DISABLED`). Poprawka: limit w `try/catch` z logiem i fail-open (jak `isWithinVerifyLimit` na `dziekujemy`); w `startPremiumCheckout` (`:83`) wyjątek → `fail('CHECKOUT_FAILED')`; testy „limit rzuca”.

**P2-4. `api/service-slug/[slug]/route.ts:60` — krótki cache `exists` (240/60) + timeout lookupu 1,5 s → krótki adres premium z małym ruchem daje 404.** (performance; zweryfikowane: `SERVICE_SLUG_LOOKUP_TIMEOUT_MS = 1500`, `unknown` → brak przekierowania)
Wcześniej `swr=86400` maskował zimne starty. Teraz prawie każde wejście na rzadko odwiedzany `/<slug>` (ulotki) to miss CDN → zimna funkcja + `connect_timeout` → >1,5 s → `unknown` → 404 zamiast 307. Profil `/firma/<slug>` traci 0,3–1,5 s TTFB z tego samego powodu, choć potrzebuje tylko `exists`. Poprawka: osobny klucz cache dla aliasu (`?premium=1` → 240/60), profil bez query z `s-maxage=300, stale-while-revalidate=86400`; parametr `purpose: 'profile' | 'alias'` w `lookupServiceSlug`; testy nagłówków dla obu.

**P2-5. `src/lib/subscription-store.ts:107-124` — `setPromotion(null)` z `NOT EXISTS` bez testu; atrapa przeczy kontraktowi.** (spec-flow P2, kieran P3; zweryfikowane)
`tests/fixtures/premium/fake-subscription-store.ts:53` usuwa promocję bezwarunkowo, więc reguła „premium ręczne trzyma ranking po końcu subskrypcji” nie jest sprawdzana nigdzie; regresja w `notExists` (odwrócony `gt`, brak filtra) przejdzie. `createTransactionStore` ma 70 linii. Poprawka: `buildRemovePromotionQuery(tx, serviceId)` obok `buildExtendPromotionQuery` z testem SQL (`drizzle.mock().toSQL()`); atrapa z `manualPremiumUntil` i scenariusz „anulowana subskrypcja + trwające premium ręczne → promocja zostaje”. Razem z P3-3 (jeden builder `GREATEST`) i P3-4.

**P2-6. `src/db/premium-content-store.ts:102-134` — mapowanie daty w `findContent` i transakcja `saveContent` bez testu.** (spec-flow; zweryfikowane)
Diff przedłużenia w `db:premium --dry-run` działa tylko dzięki `manualPremiumLastDay` w `findContent`; regresja daje `{ kind: 'invalid' }` i komunikat „treść zostanie nadpisana”. Gałąź zapisu rankingu i atomowość też bez testu. Poprawka: czysta `toEntryShape(row)` z testem round-trip (data → `manualPremiumEnd` → wiersz → `toEntryShape` → `premiumContentSchema.parse` → ta sama data); test `saveContent` na atrapie `db.transaction` (z datą 2 zapisy, bez daty 1, jedna transakcja).

## 🟡 P3

### Stripe (uśpiony) i bezpieczeństwo
1. `_actions.ts:80-97` — checkout bez bramki „klucz testowy + baza nielokalna” (webhook i CLI ją mają): po powrocie Stripe z `sk_test_` na produkcji płacący widzi „płatność potwierdzona”, premium nie wchodzi. Wspólne `isStripeModeAllowed` w akcjach i `dziekujemy` → `CHECKOUT_DISABLED`. (security)
2. `firma/[slug]/page.tsx` — `startPremiumCheckout` bez jawnego `maxDuration` (najgorszy przypadek ~21 s); `export const maxDuration = 30` + budżet w komentarzu. (performance)
3. Reguła `GREATEST` dwa razy (`subscription-store.ts:130-139`, `premium-content-store.ts:69-81`) — `setPromotion` przez `buildExtendPromotionQuery(tx, …)`. (kieran)
4. `subscription-store.ts:107-124` — `NOT EXISTS` zostawia też datę wydłużoną przez Stripe (roczna subskrypcja + krótsze premium ręczne + zwrot → ranking do końca roku). Zamiast pominięcia `UPDATE … SET expires_at = LEAST(expires_at, manual_premium_until)`. (spec-flow)
5. `premium-subscription-search.ts:35` — nazwa `hasActivePremiumSubscription` myli się z `hasActivePremium` (`_actions.ts:87,89` obok siebie) → np. `hasUnsyncedPaidStripeSubscription`; rozważyć `isPremiumActive` → `isSubscriptionPremiumActive`. (kieran)
6. `api/stripe/webhook/route.ts:37-42` — budżet w komentarzu zaniżony (`statement_timeout` per zapytanie × 5 + zapytania poza transakcją); bezpieczeństwo zachowane, poprawić opis. (performance)
7. `_actions.ts:227` — dwie karty: druga dostaje `MATERIALS_SENT`, gdy pierwsza jeszcze wysyła i może dostać timeout; znacznik `pending`/`sent`. Opcjonalne. (spec-flow)
8. Premium ręczne blokuje przedpłatę online po powrocie Stripe (`ALREADY_PREMIUM`, brak CTA) — potwierdzić, że akceptowane. (spec-flow)

### Premium ręczne i dokumentacja
9. `publish-premium.ts:108` — `activeUntil` z przeszłości lub z odległej przyszłości (literówka roku) bez ostrzeżenia; CLI pisze „aktywne do 2025-12-31”. Ostrzeżenie w dry-run i przy zapisie + test. (spec-flow)
10. Dokumentacja (zadania, `SKILL.md:265`) — „widok i alias znikają od razu”: alias do 5 min (cache CDN). (spec-flow)
11. CLAUDE.md „plik jest źródłem prawdy” — dopisać zastrzeżenie: ranking (`GREATEST`) trwa do starej daty po skróceniu/usunięciu `activeUntil`. (kieran)
12. Zadania „po każdym `db:reset`: `db:sync-subscriptions`” — oznaczyć „(Stripe, odłożone)”; bez Stripe kod 1. (spec-flow)
13. `manual-premium.test.ts` — dodać same dni zmiany czasu (`2026-03-29` → `22:00Z`, `2026-10-25` → `23:00Z`). Kod poprawny. (spec-flow)

### Wydajność
14. `pricing/page.tsx:6`, `firma/[slug]/page.tsx:25` — import `@/lib/stripe` ładuje SDK Stripe na zimnym starcie także w trybie uśpionym; lekki `stripe-enabled.ts` dla `/cennik`, `await import` w akcji. Opcjonalne. (performance)
15. `src/i18n/request.ts:8-13` — import wszystkich 4 plików tłumaczeń; dynamiczny import per locale. (performance)
16. `env.ts` — `emptyStringAsUndefined: true` (pusty `STRIPE_WEBHOOK_SECRET=` daje ogólne „Invalid environment variables” zamiast Stripe wyłączonego). (spec-flow, kieran)
17. Profil `force-dynamic` bez cache + `getSimilarServices` ze skorelowanym podzapytaniem (sprzed zakresu); opcja na później `revalidate = 300` + `revalidatePath` jednego profilu. (performance)
18. `service-profile-queries.ts:222` — kolumny jsonb treści premium pobierane też dla widoku free (transfer, nie parsowanie). Do zrobienia przy realnym ruchu. (performance)

### Architektura i jakość kodu
19. `isLocale` w trzech miejscach (`i18n/config.ts:8` prywatne, `split-locale-prefix.ts:18-20`, `blog-urls.ts:7`) — eksport z `config.ts`. (kieran)
20. Para kolumn premium powtarzana 3× (`premium-checkout-queries.ts:40-44`, `service-profile-queries.ts:135-139, 229-235`) — `premiumStateColumns` w `subscription-query-parts.ts`, `ServiceProfile = {…} & PremiumState`. (kieran)
21. `ServiceSlugStatus` dopuszcza `{ exists: false, hasActivePremium: true }` — unia dyskryminowana. (kieran)
22. Wrapper „`sendMail` z limitem” dwa razy (`_actions.ts:183-196`, `subscription-notifications.ts:30-44`) — jedna funkcja w `mailer.ts`. (kieran)
23. `premium-plan.ts` z jedną stałą — przenieść `DEFAULT_PREMIUM_INTERVAL` do `premium-checkout-fields.ts`. (kieran)
24. `contact-form.tsx` 350 linii (było 342), komponent 216 linii — `contactDefaults(prefill, t)` do `premium-contact.ts` z testem. (kieran)
25. Funkcje > 50 linii: `PriceCard` (76), `middleware` (56), `createTransactionStore` (70, z P2-5), `GalleryHero` (51). (kieran)
26. Linie > 100 znaków w komentarzach: `middleware.ts:68`, JSDoc `selectProfileView`. (kieran)

### Testy
27. `profile-upgrade-cta.test.tsx:15` mockuje `Link` — dodać `it.each` na 4 locale z prawdziwym `Link` (`/kontakt` vs `/en/contact`). (spec-flow)
28. Matcher middleware `api/` (#16) bez testu — wyeksportować wzorzec, test: `/apiary` pasuje, `/api/x` nie. (spec-flow)
29. Formularz kontaktowy: test wysłania z prefill (body POST), slug > 255 w `premium-contact.test.ts`; uwaga produktowa — slug tylko w edytowalnej wiadomości. (spec-flow)
30. Wybór `PremiumPurchase` / `PricingPurchase` z `isStripeConfigured` bez testu — czysta `premiumPurchaseFor(config)` z testem. (spec-flow)

### Poza zakresem diffu (zgłoszone, nie liczone)
- `src/app/api/submit-contact-query/route.ts:64-65` — `req.json()` + `parse` bez `safeParse`: zły input → 500 zamiast 400 `{ error }`. Lejek premium idzie teraz przez ten endpoint — osobne zadanie. (security)

## Sprawdzone bez uwag (skrót)

- **Bezpieczeństwo:** akcje — bramka Stripe przed Zod/Redis/Stripe, potem Zod → limit po IP → weryfikacja; cena z allowlisty env; materiały wiązane z sesją i slugiem przed `SET NX`. Webhook 404 przed odczytem body. `?topic=&firma=` — slug przez `isValidServiceSlug`, tylko do `defaultValue` (escape Reacta) i maila `text`. SQL parametryzowany (`NOT EXISTS`, `GREATEST`, `set_config` lokalny w transakcji). `hasActivePremium` nie do włączenia dla cudzego wpisu (joiny po `service_id`, kolumnę pisze tylko CLI/seed). Lookup aliasu: sekret porównywany w stałym czasie, odpowiedź niezależna od sekretu. Matcher i segmenty zarezerwowane pokrywają wszystkie trasy najwyższego poziomu. Brak nowych `process.env`/`NEXT_PUBLIC_*`.
- **Wydajność:** nowe joiny po PK z `LIMIT 1`, bez N+1; `cache()` dla `resolveProfileView` — jedno parsowanie na żądanie, zero przy free; `withTimeout` sprząta timer; budżet `dziekujemy` (60 s) się zgadza; galeria RSC, klient bez zod/drizzle/env/stripe; `/kontakt` zostaje SSG (`<Suspense>`); `Intl.DateTimeFormat` modułowy.
- **Architektura/TS:** `hasActivePremium` jedynym odczytem premium firmy (pozostałe `isPremiumActive(` tylko dla rekordu Stripe); `PremiumPurchase`/`ProfileViewKind` jako unie; `stripe-config.ts` czysty; leniwy `getStripe()`; granice DST poprawne; brak `as`/`!`/`any` w nowym kodzie, brak cykli, testy mockują tylko granice.
- **Scenariusze:** tabela scenariusz → test (spec-flow) — 27 z 35 wierszy ✅, braki ujęte w P2-2, P2-5, P2-6 i P3. Nazwy z `seed.ts` (142 wpisy) nie kolidują z segmentami zarezerwowanymi.

## Bookkeeping checkboxów Weryfikacja: (runda 5)

- Odznaczone automatycznie (CLI/grep): 0 (wszystkie 16 odznaczone w pierwszym review)
- E2E: 0; Manual: 0; Niejasne: 0; Failujące: 0
