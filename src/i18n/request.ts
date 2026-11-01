import { getRequestConfig } from 'next-intl/server';

import { toLocale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
    const locale = toLocale(await requestLocale);

    const messages = {
        en: (await import('../../messages/en.json')).default,
        pl: (await import('../../messages/pl.json')).default,
        ru: (await import('../../messages/ru.json')).default,
        uk: (await import('../../messages/uk.json')).default,
    };

    return {
        locale,
        messages: messages[locale],
    };
});
