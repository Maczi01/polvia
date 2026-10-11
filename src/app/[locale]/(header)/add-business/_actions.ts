'use server';

import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { getLocale } from 'next-intl/server';
import OpenAI from 'openai';

import { defaultLocale, type Locale, locales } from '@/i18n/config';
import { generateDraft } from '@/lib/add-business/generate-draft';
import { geocodeAddress } from '@/lib/add-business/geocode';
import { processLogoCandidate } from '@/lib/add-business/logo';
import { relocateDraft } from '@/lib/add-business/relocate-draft';
import { safeFetchHtml } from '@/lib/add-business/safe-fetch';
import { submitDraft } from '@/lib/add-business/submit-draft';
import type {
    GenerateDraftResult,
    RelocateResult,
    SubmitDraftResult,
} from '@/lib/add-business/types';
import { sendMail } from '@/lib/mailer';
import { findServiceByDomain } from '@/lib/queries';
import { getClientIp } from '@/lib/rate-limit';

import { env } from '../../../../../env';

/**
 * Akcje flow „Dodaj firme" (U8). Cienkie: IP, locale i prawdziwe uslugi zewnetrzne — cala
 * logika, walidacja `FormData` i mapowanie bledow na kody sa w orkiestratorach
 * (`src/lib/add-business/*`), testowanych z falszywymi zaleznosciami.
 *
 * Kazda akcja to publiczny endpoint POST: brak auth jest zamierzony (formularz publiczny),
 * a koszt ogranicza Redis (D7) w orkiestratorach. Bez `revalidatePath`: nic nie zmienia sie
 * w bazie (R14) — szkic zyje w Redisie, zgloszenie idzie mailem.
 *
 * `maxDuration = 60` ustawia strona (U9); akcja dziedziczy konfiguracje segmentu.
 */

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

async function clientIp(): Promise<string> {
    return getClientIp({ headers: await headers() });
}

async function requestLocale(): Promise<Locale> {
    const locale = await getLocale();
    return hasLocale(locales, locale) ? locale : defaultLocale;
}

export async function generateDraftAction(
    _previous: GenerateDraftResult | null,
    formData: FormData,
): Promise<GenerateDraftResult> {
    const [ip, locale] = await Promise.all([clientIp(), requestLocale()]);

    return generateDraft(
        { formData, ip, locale },
        {
            llm: openai,
            fetchHtml: (url, options) => safeFetchHtml(url, options),
            geocode: geocodeAddress,
            findDuplicate: findServiceByDomain,
            now: Date.now,
        },
    );
}

export async function relocateDraftAction(
    _previous: RelocateResult | null,
    formData: FormData,
): Promise<RelocateResult> {
    return relocateDraft(formData, { geocode: geocodeAddress });
}

export async function submitDraftAction(
    _previous: SubmitDraftResult | null,
    formData: FormData,
): Promise<SubmitDraftResult> {
    return submitDraft(
        { formData, ip: await clientIp() },
        {
            geocode: geocodeAddress,
            fetchLogoCandidate: url => processLogoCandidate(url),
            sendMail,
        },
    );
}
