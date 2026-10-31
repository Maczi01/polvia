import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { parseMapSlug } from '@/lib/map-slug-parser';
import { parseMapPathname } from '@/lib/map-pathname';
import { localizedMapBasePath } from '@/lib/map-url-builder';
import {
    isValidServiceSlug,
    parseServiceProfilePathname,
    SERVICE_PROFILE_NOT_FOUND_PATH,
} from '@/lib/service-profile-path';
import { lookupServiceSlug } from '@/lib/service-slug-lookup';

import { env } from '../env';

const intlMiddleware = createMiddleware({
    ...routing,
    localeDetection: false
});

/**
 * Profil firmy `/firma/<slug>` (i `/{locale}/firma/<slug>`): prawdziwe 404 dla slugu,
 * pod ktorym nie ma aktywnego wpisu. `null` = sciezka nie jest profilem albo profil
 * istnieje / lookup zawiodl — zadanie idzie dalej normalna droga.
 *
 * Powod jak przy mapie: `[locale]/loading.tsx` sprawia, ze strona streamuje, wiec
 * `notFound()` w `page.tsx` daje soft-404 (status 200). Middleware na edge nie ma bazy,
 * wiec pyta `GET /api/service-slug/<slug>` (Node). Matcher wyklucza `/api`, wiec ten
 * `fetch` nie wraca do middleware. Sekret w naglowku zwalnia lookup z limitu po IP:
 * na Vercelu kazdy fetch z middleware ma ten sam adres wychodzacy (wspolny kubelek).
 *
 * Origin z `request.nextUrl` (naglowek `Host`), nie z `env.NEXT_PUBLIC_SITE_URL`: ta
 * zmienna to adres produkcji, wiec dev i preview pytalyby kodu i bazy produkcji, a nie
 * swojego deploymentu. Sekret nie wycieka do obcego hosta, bo na Vercelu zadanie trafia
 * do deploymentu tylko przez domeny do niego przypisane — `Host` jest zawsze nasz.
 *
 * 404 to rewrite na sciezke, ktorej nie dopasuje zadna trasa: router Next ustawia 404
 * i renderuje globalne not-found przed jakimkolwiek streamowaniem layoutu `[locale]`.
 */
async function handleServiceProfile(request: NextRequest): Promise<NextResponse | null> {
    const profilePath = parseServiceProfilePathname(request.nextUrl.pathname);
    if (!profilePath) return null;

    const notFound = (): NextResponse =>
        NextResponse.rewrite(new URL(SERVICE_PROFILE_NOT_FOUND_PATH, request.url));

    if (!isValidServiceSlug(profilePath.slug)) return notFound();

    const result = await lookupServiceSlug({
        origin: request.nextUrl.origin,
        slug: profilePath.slug,
        secret: env.SERVICE_SLUG_LOOKUP_SECRET,
    });

    // `unknown` (timeout, 5xx, 429) = fail-open: profil renderuje sie albo konczy
    // `notFound()` strony — swiadomie akceptowany soft-404 w wyjatku.
    return result === 'missing' ? notFound() : null;
}

/**
 * Kolejnosc galezi:
 * 1. walidacja slugu mapy (307 na baze mapy),
 * 2. profil `/firma/<slug>` (404 dla nieistniejacego),
 * 3. rewrite `/mapa/**` i redirect `/map/**`,
 * 4. next-intl.
 * Galezie walidacji ida przed rewrite'ami, bo musza widziec adres z przegladarki.
 */
export default async function middleware(request: NextRequest): Promise<NextResponse> {
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
            // 307 (tymczasowe), NIE 308. Przekierowania trwale sa agresywnie
            // cache'owane przez przegladarki i Google — gdyby parser kiedykolwiek
            // zaklasyfikowal POPRAWNY URL jako bledny, uzytkownik dostalby
            // zapamietane przekierowanie, ktorego nie da sie odwolac bez
            // cache-bustingu. Efekt SEO jest ten sam (soft-404 znika), a blad
            // jest odwracalny. Na 308 mozna przejsc po okresie obserwacji.
            return NextResponse.redirect(url, 307);
        }
    }

    const profileResponse = await handleServiceProfile(request);
    if (profileResponse) return profileResponse;

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
