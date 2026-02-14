import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
    ...routing,
    localeDetection: false
});

export default function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

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
