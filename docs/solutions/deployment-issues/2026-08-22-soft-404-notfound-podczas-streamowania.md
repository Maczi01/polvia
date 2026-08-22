---
title: "notFound() podczas streamowania nie zmienia statusu — soft-404 z HTTP 200"
date: 2026-08-22
category: deployment-issues
severity: high
stack:
  - Next.js
  - App Router
  - next-intl
tags:
  - seo
  - soft-404
  - streaming
  - suspense
  - middleware
  - catch-all
status: verified
last_verified: 2026-08-22
---

# notFound() podczas streamowania nie zmienia statusu — soft-404 z HTTP 200

## Symptomy

Każdy błędny URL pod trasą mapy zwraca **HTTP 200** z treścią strony 404:

```
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/mapa/bzdura
200
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/mapa/prawne/bzdura
200
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/map/bzdura
200
```

Strona `not-found.tsx` renderuje się poprawnie, więc w przeglądarce wszystko wygląda dobrze.
Problem widać tylko w statusie odpowiedzi — dla Google to **soft-404**, czyli URL wart
zaindeksowania.

Dowód rozstrzygający: w odpowiedzi są **jednocześnie** treść strony docelowej i treść 404.

```bash
curl -s http://localhost:3000/mapa/bzdura | grep -c "Page Not Found"   # 1
curl -s http://localhost:3000/mapa/bzdura | grep -c "FotoDoKarty"      # 1  <- tresc mapy!
```

## Root Cause

**Nie chodzi o `NextResponse.rewrite` w middleware** — to była pierwsza, błędna hipoteza.
Ścieżka `/calkowicie-nieistniejaca` jest też rewrite'owana przez middleware next-intl
i zwraca poprawne **404**.

Prawdziwy mechanizm to złożenie trzech rzeczy:

1. Trasa jest **opcjonalnym catch-all** (`map/[[...slug]]/page.tsx`), więc dopasowuje
   **każdy** slug — Next nie ma powodu zwrócić 404 sam z siebie.
2. Strona owija treść w `<Suspense>`, więc Next **zaczyna streamować shell** i wysyła
   nagłówki ze statusem `200` zanim komponent skończy pracę.
3. `notFound()` odpala się już po wysłaniu nagłówków. Next dokleja do strumienia treść
   najbliższego `not-found.tsx`, ale **statusu nie da się już zmienić**.

Dlatego w HTML widać oba fragmenty naraz.

## Rozwiązanie

Przenieś walidację do **middleware** — jedynego miejsca wykonującego się przed
jakimkolwiek renderem, więc przed rozpoczęciem streamowania.

```typescript
// src/middleware.ts
import { parseMapSlug } from '@/lib/map-slug-parser';
import { parseMapPathname } from '@/lib/map-pathname';

export default function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const mapPath = parseMapPathname(pathname);
    if (mapPath) {
        const parsed = parseMapSlug(mapPath.slug, mapPath.locale);
        if (!parsed.success) {
            const url = request.nextUrl.clone();
            url.pathname = localizedMapBasePath(mapPath.locale);
            url.search = '';
            return NextResponse.redirect(url, 307); // tymczasowe, patrz nizej
        }
    }

    // ... dalsza obsluga rewrite'ow
}
```

**Czystą logikę rozbioru ścieżki wydziel do `src/lib/`**, bo `middleware.ts` importuje
`next-intl/middleware` (ESM), czego nie da się zaimportować w teście jednostkowym:

```typescript
// src/lib/map-pathname.ts — testowalne bez frameworka
export function parseMapPathname(pathname: string): MapPathname | null {
    const plMatch = /^\/mapa\/(.+)$/.exec(pathname);
    if (plMatch) return { locale: 'pl', slug: plMatch[1].split('/') };

    const prefixedMatch = /^\/([a-z]{2})\/map\/(.+)$/.exec(pathname);
    if (prefixedMatch && locales.includes(prefixedMatch[1] as Locale)) {
        return { locale: prefixedMatch[1] as Locale, slug: prefixedMatch[2].split('/') };
    }

    return null;
}
```

**Dwa świadome kompromisy:**

1. Przekierowanie nie jest semantycznie tym samym co 404 — mówi „idź tam", a nie „to nie
   istnieje". Prawdziwe 404 wymagałoby odejścia od streamowania w tej trasie. Przekierowanie
   usuwa soft-404 z indeksu, co było celem.
2. **307, nie 308.** Przekierowania trwałe są agresywnie cache'owane przez przeglądarki
   i Google. Gdyby parser kiedykolwiek zaklasyfikował **poprawny** URL jako błędny,
   użytkownik dostałby zapamiętane przekierowanie, którego nie da się odwołać bez
   cache-bustingu. Efekt SEO jest ten sam, a błąd odwracalny. Na 308 warto przejść dopiero
   po okresie obserwacji na produkcji.

## Komendy diagnostyczne

```bash
# Status + czy odpowiedz byla rewrite'owana
curl -s -i http://localhost:3000/mapa/bzdura | head -5

# Czy w odpowiedzi sa JEDNOCZESNIE obie tresci (dowod streamowania)
curl -s http://localhost:3000/mapa/bzdura | grep -c "Page Not Found"
curl -s http://localhost:3000/mapa/bzdura | grep -c "<jakis-tekst-ze-strony-docelowej>"

# Kontrola: sciezka BEZ pasujacej trasy powinna dac 404
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/calkowicie-nieistniejaca

# Po naprawie: status i cel przekierowania
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" http://localhost:3000/mapa/bzdura
```

## Zapobieganie

- **Catch-all (`[[...slug]]`) + `<Suspense>` = ryzyko soft-404.** Jeśli trasa dopasowuje
  dowolny slug, walidacja musi się wydarzyć przed pierwszym bajtem odpowiedzi.
- **Nie ufaj temu, że `notFound()` daje 404.** Sprawdź `curl -o /dev/null -w "%{http_code}"`,
  nie wygląd strony w przeglądarce. Strona 404 przy statusie 200 wygląda identycznie.
- **Nie mierz statusów na dev serverze po `npm run build`.** Produkcyjny build nadpisuje
  `.next` pod działającym dev serverem i wszystko zaczyna zwracać 500 z `ENOENT` na
  manifestach. Przy dziwnych statusach: zatrzymaj dev server, `rm -rf .next`, uruchom ponownie.
- Jeśli parser walidujący slug zwraca pole typu `redirectTo`, sprawdź czy ktokolwiek go
  używa. U nas istniało od początku i było martwe — strona wołała `notFound()` i ignorowała je.

## Powiązane

- `docs/solutions/testing-issues/2026-08-22-testy-komponentow-esm-i-resizeobserver.md` —
  ten sam problem z ESM w node_modules, inne rozwiązanie (tu: wydzielenie modułu)

## Kontekst

Odkryte przy weryfikacji zadania `online-service-coverage`. Next.js 15.1.11 (App Router,
Turbopack), `next-intl` 4, trasa `src/app/[locale]/(main)/map/[[...slug]]/page.tsx`.

Problem był **preegzystujący** i dotyczył wszystkich czterech locale.

Efekt po naprawie: 6 błędnych URL-i → 307 na poprawną dla locale ścieżkę bazową
(`/ru/map/bzdura` → `/ru/map`), 8 poprawnych URL-i → 200 bez zmian. Middleware
42.9 kB → 44.2 kB.

Znalezisko uboczne: `map/not-found.tsx` to relikt po forku — pokazuje SVG **Irlandii**,
tekst „discover businesses across Ireland" i stopkę „© Qolie. All rights reserved.".
Nienaprawione, osobna sprawa.
