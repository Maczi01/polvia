import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { parseMapSlug } from '@/lib/map-slug-parser';
import { parseMapPathname } from '@/lib/map-pathname';
import { localizedMapBasePath } from '@/lib/map-url-builder';

const intlMiddleware = createMiddleware({
    ...routing,
    localeDetection: false
});

export default function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Walidacja slugu mapy MUSI byc tutaj, nie w page.tsx.
    //
    // Strona mapy to opcjonalny catch-all, wiec dopasowuje KAZDY slug i renderuje
    // shell przez <Suspense>. Kiedy `notFound()` odpala sie w trakcie streamowania,
    // naglowki sa juz wyslane ze statusem 200 — Next dokleja tresc strony 404, ale
    // statusu nie zmieni. Efekt: soft-404, czyli indeksowalne smieci dla Google.
    // Middleware wykonuje sie przed jakimkolwiek renderem, wiec to jedyne miejsce,
    // gdzie da sie zwrocic prawdziwy status.
    const mapPath = parseMapPathname(pathname);
    if (mapPath) {
        const parsed = parseMapSlug(mapPath.slug, mapPath.locale);
        if (!parsed.success) {
            const url = request.nextUrl.clone();
            url.pathname = localizedMapBasePath(mapPath.locale);
            url.search = '';
            return NextResponse.redirect(url, 308);
        }
    }

    // Handle localized /mapa/{slug...} URLs for PL locale.
    // next-intl only maps the exact /mapa → /map pathname;
    // sub-paths like /mapa/zdrowie need a manual rewrite to the
    // internal filesystem route /pl/map/zdrowie.
    if (/^\/mapa\/.+/.test(pathname)) {
        const slugPart = pathname.slice('/mapa'.length); // e.g. /zdrowie or /zdrowie/tyrone
        const url = request.nextUrl.clone();
        url.pathname = `/pl/map${slugPart}`;
        return NextResponse.rewrite(url);
    }

    // Redirect old /map/{slug...} to /mapa/{slug...} (PL is default locale).
    // Unprefixed /map/... is always PL context; EN uses /en/map/... via next-intl.
    if (/^\/map\/.+/.test(pathname)) {
        const slugPart = pathname.slice('/map'.length);
        const url = request.nextUrl.clone();
        url.pathname = `/mapa${slugPart}`;
        return NextResponse.redirect(url, 301);
    }

    return intlMiddleware(request);
}

export const config = {
    matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
