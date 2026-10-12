/**
 * @jest-environment node
 */
import type { ChatCompletion } from 'openai/resources/chat/completions';

import { businessDraftSchema, type LlmDraft } from './draft-schema';
import { type DraftClient, fromOwner, fromPage } from './llm-draft';

/** Prefill social media w szkicu: z JSON-LD `sameAs` i z linku kroku 1 (A). */

const TAG = { pl: 'Tag', uk: 'Тег', en: 'Tag', ru: 'Тег' };

const MODEL_DRAFT: LlmDraft = {
    category: 'law',
    coverage: 'local',
    languages: ['pl'],
    tags: [TAG, TAG, TAG],
    descriptions: { pl: 'Opis', uk: 'Опис', en: 'Description', ru: 'Описание' },
    name: null,
    street: null,
    postcode: null,
    city: null,
    phone: null,
    email: null,
    openingHours: null,
};

function clientReturning(content: unknown): DraftClient {
    const response: ChatCompletion = {
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
    return { chat: { completions: { create: jest.fn().mockResolvedValue(response) } } };
}

describe('prefill social media w szkicu', () => {
    it('fromPage rozpoznaje serwisy z sameAs, wa.me idzie do whatsappNumber', async () => {
        const draft = await fromPage(clientReturning(MODEL_DRAFT), {
            text: 'Kancelaria',
            url: 'https://nowak.pl',
            structured: {
                sameAs: [
                    'https://www.facebook.com/nowak',
                    'https://www.instagram.com/nowak/',
                    'https://wa.me/48500600700',
                    'https://nowak-blog.pl',
                ],
            },
        });

        expect(draft.socials).toEqual({
            facebook: 'https://www.facebook.com/nowak',
            instagram: 'https://www.instagram.com/nowak/',
        });
        expect(draft.whatsappNumber).toBe('+48500600700');
        expect(businessDraftSchema.safeParse(draft).success).toBe(true);
    });

    it('fromPage bez sameAs daje puste socials i brak numeru', async () => {
        const draft = await fromPage(clientReturning(MODEL_DRAFT), {
            text: 'Kancelaria',
            url: 'https://nowak.pl',
            structured: {},
        });

        expect(draft.socials).toEqual({});
        expect(draft.whatsappNumber).toBeNull();
    });

    it('fromOwner: link Instagram z kroku 1 trafia do socials.instagram', async () => {
        const draft = await fromOwner(clientReturning(MODEL_DRAFT), {
            fields: {
                name: 'Salon Ola',
                street: null,
                postcode: null,
                city: 'Kraków',
                phoneNumber: null,
                email: null,
                openingHours: null,
            },
            description: 'Salon kosmetyczny w Krakowie.',
            link: 'https://www.instagram.com/salon.ola/',
        });

        expect(draft.socials).toEqual({ instagram: 'https://www.instagram.com/salon.ola/' });
    });
});
