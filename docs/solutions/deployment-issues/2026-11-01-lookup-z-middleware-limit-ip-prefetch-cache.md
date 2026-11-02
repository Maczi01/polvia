---
title: "Lookup z middleware na Vercelu: globalny limit po IP, podrabialny XFF, prefetch i brak cache"
date: 2026-11-01
category: deployment-issues
severity: high
stack:
  - Next.js 15
  - Vercel
  - Upstash Ratelimit
tags:
  - middleware
  - rate-limit
  - x-forwarded-for
  - prefetch
  - cache-control
  - soft-404
status: verified
last_verified: 2026-11-01
---

# Lookup z middleware na Vercelu: globalny limit po IP, podrabialny XFF, prefetch i brak cache

## Symptomy

Problem znalazł review fazy 1 zadania `strona-firmy-premium`, przed wdrożeniem. Na produkcji objawiłby się tak:

- `/firma/<nieistniejący>` czasem zwraca 200 z treścią not-found (soft-404) zamiast 404. Middleware robi lookup z fail-open, a lookup dostaje 429.
- Wystarczy ~120 wejść na profile na minutę w **całym serwisie**, żeby 404 przestały działać dla wszystkich.
- Szybkie przewijanie listy na `/mapa` zjada limit, choć użytkownik nie kliknął żadnego profilu.
- Każde wejście na profil dokłada 50–150 ms, a przy zimnym starcie do ~1,5 s: dwa wywołania funkcji, w tym lookup bez cache.

## Root Cause

Middleware działa na edge bez bazy, więc pyta własny route (`GET /api/service-slug/[slug]`, Node + db), czy slug istnieje. Złożyły się na to cztery błędy:

1. **Limit po IP z `x-forwarded-for`.** Fetch z middleware wychodzi z infrastruktury Vercela, więc route widzi jeden adres dla całego ruchu: globalny kubełek. Gdyby ufać XFF przekazanemu przez klienta, każdy obszedłby limit dowolnym nagłówkiem.
2. **Prefetch `<Link>`.** Next prefetchuje widoczne linki, a prefetch przechodzi przez middleware, więc każda karta z „Zobacz profil” odpalała lookup.
3. **`cache: 'no-store'` i brak `Cache-Control` na odpowiedzi.** Każde wejście szło do funkcji i do bazy.
4. **Fail-open przy 429** jest słuszny, bo profil ma się wyświetlić, ale razem z punktami 1–3 zamieniał limit w generator soft-404.

## Rozwiązanie

**1. Ruch wewnętrzny uwierzytelniony sekretem, publiczny limitowany po nagłówku platformy.**

```ts
// src/lib/service-slug-lookup.ts (middleware)
fetch(url, { headers: { [SERVICE_SLUG_LOOKUP_SECRET_HEADER]: secret } }); // bez cache: 'no-store'

// src/app/api/service-slug/[slug]/route.ts (Node)
function isTrustedLookup(request: Request): boolean {
    const provided = request.headers.get(SERVICE_SLUG_LOOKUP_SECRET_HEADER);
    if (!provided) return false;
    // skróty SHA-256: równa długość buforów i brak wycieku długości sekretu
    return timingSafeEqual(sha256(provided), sha256(env.SERVICE_SLUG_LOOKUP_SECRET));
}

function clientKey(request: Request): string {
    // Vercel nadpisuje te nagłówki adresem klienta; NIGDY x-forwarded-for
    return (
        request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip')?.trim() ||
        'unknown'
    );
}
```

Ruch z poprawnym sekretem omija limit po IP. Każdy taki lookup to jedno wejście na profil, które i tak robi więcej zapytań. Sekret trafia do `env.ts` jako wymagany `z.string().min(32)`, więc bez niego build pada głośno.

**2. Linki do tras walidowanych w middleware bez prefetchu.** Wspólny komponent `ServiceProfileLink` ma zawsze `prefetch={false}`.

**3. Cache CDN na odpowiedzi lookupu.** Odpowiedź nie zależy od sekretu, więc współdzielony cache jest bezpieczny. Błędy i 429 nie mogą trafić do cache.

```ts
const CACHE_CONTROL = {
    profileExists: 'public, s-maxage=300, stale-while-revalidate=86400',
    missing: 'public, s-maxage=30, stale-while-revalidate=300',
    uncacheable: 'private, no-store', // 400 / 429 / 500
};
```

## Komendy diagnostyczne

```bash
# status, nie wygląd strony (patrz soft-404)
curl -s -o /dev/null -w "%{http_code}\n" https://polvia.pl/firma/xyz-nie-istnieje   # 404
# cache lookupu: drugie żądanie powinno mieć x-vercel-cache: HIT
curl -sI https://polvia.pl/api/service-slug/multi-cook | grep -iE "cache-control|x-vercel-cache"
```

## Zapobieganie

- Rate limit dla fetchu z middleware do własnego API nie może iść po IP. To ruch z jednego źródła; uwierzytelniaj go sekretem.
- IP klienta na Vercelu bierz z `x-vercel-forwarded-for` / `x-real-ip`, nigdy z surowego `x-forwarded-for`.
- Trasa, którą middleware sprawdza zapytaniem, dostaje linki z `prefetch={false}`.
- Każdy lookup na ścieżce krytycznej ma `Cache-Control` z `s-maxage`, a odpowiedzi błędów są `private, no-store`.
- Preview z Deployment Protection zwraca 401 na fetch z middleware, więc lookup przechodzi tam w fail-open i statusów 404 nie da się sprawdzić na chronionym preview.

## Powiązane

- `docs/solutions/deployment-issues/2026-08-22-soft-404-notfound-podczas-streamowania.md`: dlaczego walidacja musi być w middleware.
- `docs/completed/strona-firmy-premium/review-faza-1.md` (#1–#3) i podsumowanie zadania.
- Vercel: https://vercel.com/docs/headers/request-headers

## Kontekst

Next.js 15.1 App Router, `[locale]/loading.tsx` streamuje każdą stronę. Middleware: next-intl + własne rewrite'y. Rate limit przez `@upstash/ratelimit` (Redis). Zmiany: commity `16f505b` (sekret, limit, cache) i `0e63b47` (`ServiceProfileLink`, prefetch), PR #32.
