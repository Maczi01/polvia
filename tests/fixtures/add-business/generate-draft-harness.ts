/**
 * Wspolna atrapa zaleznosci zewnetrznych `generateDraft` (strona, OpenAI, Nominatim, baza)
 * dla testow orkiestratora. Redis podmieniaja same pliki testow (`jest.mock` jest per plik).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { ChatCompletion } from 'openai/resources/chat/completions';

import type { LlmDraft } from '@/lib/add-business/draft-schema';
import type { GenerateDraftDeps } from '@/lib/add-business/generate-draft';
import type { GeocodeResult } from '@/lib/add-business/geocode';
import type { DraftClient } from '@/lib/add-business/llm-draft';
import type { SafeFetchResult } from '@/lib/add-business/safe-fetch';

export const IP = '203.0.113.7';
export const SITE = 'https://gabinet-zdrowie.pl/';
export const FIXTURE_HTML = readFileSync(
    path.join(__dirname, 'local-business-jsonld.html'),
    'utf8',
);

const TAG = { pl: 'Stomatologia', uk: 'Стоматологія', en: 'Dentistry', ru: 'Стоматология' };

export const MODEL_DRAFT: LlmDraft = {
    category: 'health',
    coverage: 'local',
    languages: ['pl'],
    tags: [TAG, TAG, TAG],
    descriptions: { pl: 'Opis pl', uk: 'Опис uk', en: 'Description en', ru: 'Описание ru' },
    name: 'Gabinet Zdrowie',
    street: null,
    postcode: null,
    city: 'Warszawa',
    phone: null,
    email: null,
    openingHours: null,
};

export const GEOCODED: GeocodeResult = {
    ok: true,
    lat: 52.2297,
    lng: 21.0122,
    postcode: '00-001',
    voivodeship: 'mazowieckie',
    approximate: false,
};

export function completion(content: unknown): ChatCompletion {
    return {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: 0,
        model: 'test-model',
        choices: [
            {
                index: 0,
                finish_reason: 'stop',
                logprobs: null,
                message: { role: 'assistant', content: JSON.stringify(content), refusal: null },
            },
        ],
    };
}

const HTTP_ERROR: SafeFetchResult<string> = { ok: false, code: 'HTTP_ERROR' };

export interface Harness {
    deps: GenerateDraftDeps;
    llmCreate: jest.Mock;
    fetchHtml: jest.Mock;
    geocode: jest.Mock;
    findDuplicate: jest.Mock;
    clock: { now: number };
}

export function harness(): Harness {
    const clock = { now: 0 };
    const llmCreate = jest.fn().mockResolvedValue(completion(MODEL_DRAFT));
    const llm: DraftClient = { chat: { completions: { create: llmCreate } } };
    const fetchHtml = jest.fn(async (url: string): Promise<SafeFetchResult<string>> => {
        if (url !== SITE) return HTTP_ERROR;
        return { ok: true, finalUrl: SITE, mimeType: 'text/html', body: FIXTURE_HTML };
    });
    const geocode = jest.fn().mockResolvedValue(GEOCODED);
    const findDuplicate = jest.fn().mockResolvedValue(null);

    return {
        deps: { llm, fetchHtml, geocode, findDuplicate, now: () => clock.now },
        llmCreate,
        fetchHtml,
        geocode,
        findDuplicate,
        clock,
    };
}

export function linkForm(url: string): FormData {
    const form = new FormData();
    form.set('mode', 'link');
    form.set('url', url);
    return form;
}

export function manualForm(fields: Record<string, string>): FormData {
    const form = new FormData();
    form.set('mode', 'manual');
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return form;
}
