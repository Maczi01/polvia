import 'server-only';

import { eq } from 'drizzle-orm';
import { createTranslator } from 'next-intl';

import { db } from '@/db';
import { servicesTable } from '@/db/schema';
import { type Locale, toLocale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { localePathPrefix } from '@/lib/map-url-builder';
import { buildServiceProfilePath } from '@/lib/service-profile-path';
import { REPLY_LINK_PLACEHOLDER } from '@/lib/submission-reply-limits';

import en from '../../messages/en.json';
import pl from '../../messages/pl.json';
import ru from '../../messages/ru.json';
import uk from '../../messages/uk.json';

/**
 * Adres w mailu do klienta. Nie `NEXT_PUBLIC_SITE_URL`: panel dziala lokalnie, a tam ta zmienna
 * to `localhost`, wiec klient dostalby martwy link.
 */
const PUBLIC_SITE_URL = 'https://www.polvia.pl';

const MESSAGES = { pl, en, ru, uk } satisfies Record<Locale, unknown>;

export interface SubmissionReplyDraft {
    subject: string;
    text: string;
    hasLink: boolean;
}

/**
 * Slug opublikowanego wpisu. Szukamy po nazwie, bo slug ze zgloszenia nie musi sie zgadzac:
 * publikacja przydziela go od nowa. `null`, gdy nazwa nie wskazuje jednego wpisu, zeby klient
 * nie dostal linku do cudzej firmy. Blad bazy nie moze wywrocic strony zgloszenia.
 */
async function findPublishedServiceSlug(name: string): Promise<string | null> {
    try {
        const rows = await db
            .select({ slug: servicesTable.slug })
            .from(servicesTable)
            .where(eq(servicesTable.name, name))
            .limit(2);
        return rows.length === 1 ? rows[0].slug : null;
    } catch (error) {
        console.error('published service slug not found', {
            reason: error instanceof Error ? error.name : 'unknown',
        });
        return null;
    }
}

function pricingUrl(locale: Locale): string {
    return `${PUBLIC_SITE_URL}${localePathPrefix(locale)}${routing.pathnames['/pricing'][locale]}`;
}

/**
 * Gotowa odpowiedz po publikacji, w jezyku, w ktorym zglaszajacy wypelnil formularz.
 * Akapit o premium tylko przy zgodzie z formularza: bez niej to niezamowiona informacja handlowa.
 */
export async function buildSubmissionReplyDraft(submission: {
    name: string;
    locale: string;
    premiumInfoConsent: boolean;
}): Promise<SubmissionReplyDraft> {
    const locale = toLocale(submission.locale);
    const slug = await findPublishedServiceSlug(submission.name);
    const url = slug
        ? `${PUBLIC_SITE_URL}${buildServiceProfilePath(locale, slug)}`
        : REPLY_LINK_PLACEHOLDER;
    const t = createTranslator({
        locale,
        messages: MESSAGES[locale],
        namespace: 'addBusiness.publishedEmail',
    });

    const premium = submission.premiumInfoConsent
        ? `${t('premium', { url: pricingUrl(locale) })}\n\n`
        : '';

    return {
        subject: t('subject', { name: submission.name }),
        text: t('body', { name: submission.name, url, premium }),
        hasLink: slug !== null,
    };
}
