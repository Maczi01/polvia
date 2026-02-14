import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, Locale } from './config';
import { hasLocale } from 'use-intl';
import { routing } from '@/i18n/routing';

export default getRequestConfig(async ({requestLocale}) => {
    const requested = await requestLocale;

    const locale = hasLocale(routing.locales, requested)
        ? requested
        : routing.defaultLocale;
    const loc = locale as Locale;

    const validLocale = !loc || !locales.includes(loc) ? defaultLocale : loc;

    const messages = {
        en: (await import('../../messages/en.json')).default,
        pl: (await import('../../messages/pl.json')).default,
    };

    return {
        locale: validLocale,
        messages: messages[validLocale as keyof typeof messages],
    };
});