import { type Locale, locales } from '@/i18n/config';
import { localePathPrefix } from '@/lib/map-url-builder';

const LOCALES: ReadonlySet<string> = new Set<string>(locales);

// Nie `hasLocale` z use-intl: pakiet jest wylacznie ESM i nie laduje sie w Jest.
function isLocale(value: string): value is Locale {
    return LOCALES.has(value);
}

/**
 * Sciezka bloga z prefiksem locale liczonym tak jak routing (`as-needed`: pl bez prefiksu).
 *
 * Reczne `/${locale}/blog` dawalo dla pl `/pl/blog/...`, a to odpowiada 307 — linki
 * wewnetrzne i canonical wpisu wskazywaly na przekierowanie. `Link` z `@/i18n/navigation`
 * nie wchodzi w gre: `routing.pathnames` nie zna `/blog/[slug]`, a dopisanie go zmienia
 * typ `AppPathnames` uzywany przez przelacznik jezyka i naglowek.
 */
export function blogPath(locale: string, slug?: string): string {
    // Nieznane locale odrzuca juz layout (notFound) — tu tylko zawezenie typu.
    const prefix = isLocale(locale) ? localePathPrefix(locale) : `/${locale}`;
    return `${prefix}/blog${slug ? `/${slug}` : ''}`;
}
