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
