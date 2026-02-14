import { getRequestConfig, type RequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { defaultLocale, Locale, locales } from '@/i18n/config';

// export default getRequestConfig(async ({ locale }): Promise<RequestConfig> => {
//     const resolvedLocale = locale ?? defaultLocale; // Ensure locale is always a string
//
//     if (!locales.includes(resolvedLocale as Locale)) notFound();
//
//     try {
//         const messages = (await import(`./messages/${resolvedLocale}.json`)).default;
//         return { locale: resolvedLocale, messages };
//     } catch {
//         notFound();
//     }
// });
