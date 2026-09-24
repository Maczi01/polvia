/**
 * @jest-environment node
 */
// Kod serwerowy: SDK OpenAI wymaga `fetch`, ktorego jsdom nie ma.
import OpenAI from 'openai';
import type { ChatCompletion } from 'openai/resources/chat/completions';

import { type JudgeCandidate, type JudgeClient, judgeRelevance } from './semantic-relevance-judge';

function completion(content: string | null): ChatCompletion {
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
                message: { role: 'assistant', content, refusal: null },
            },
        ],
    };
}

function clientReturning(content: string | null): JudgeClient {
    return {
        chat: { completions: { create: jest.fn().mockResolvedValue(completion(content)) } },
    };
}

function candidate(id: string, name: string): JudgeCandidate {
    return { id, name, category: 'law', description: null, tags: null };
}

const KANCELARIA = candidate('loc-1', 'Kancelaria Adwokacka');
const REMONTY = candidate('loc-2', 'Remonty Kowalski');

describe('judgeRelevance', () => {
    it('zwraca tylko kandydatow oznaczonych przez model jako trafni', async () => {
        const client = clientReturning(JSON.stringify({ relevant: ['c1'] }));

        const relevantIds = await judgeRelevance(client, 'prawnik', [KANCELARIA, REMONTY]);

        expect([...relevantIds]).toEqual(['loc-1']);
    });

    it('pusta lista od modelu oznacza brak trafnych wynikow', async () => {
        const client = clientReturning(JSON.stringify({ relevant: [] }));

        const relevantIds = await judgeRelevance(client, 'pralnia', [KANCELARIA, REMONTY]);

        expect(relevantIds.size).toBe(0);
    });

    it('odrzuca klucze spoza listy kandydatow', async () => {
        const client = clientReturning(JSON.stringify({ relevant: ['c2', 'c99', 'loc-1'] }));

        const relevantIds = await judgeRelevance(client, 'remont', [KANCELARIA, REMONTY]);

        expect([...relevantIds]).toEqual(['loc-2']);
    });

    it('nie odpytuje modelu, gdy nie ma kandydatow', async () => {
        const client = clientReturning(JSON.stringify({ relevant: [] }));

        const relevantIds = await judgeRelevance(client, 'prawnik', []);

        expect(relevantIds.size).toBe(0);
        expect(client.chat.completions.create).not.toHaveBeenCalled();
    });

    it('przekazuje zapytanie i kandydatow jako dane w wiadomosci uzytkownika', async () => {
        const client = clientReturning(JSON.stringify({ relevant: [] }));

        await judgeRelevance(client, 'prawnik', [KANCELARIA]);

        const [body] = jest.mocked(client.chat.completions.create).mock.calls[0];
        const userMessage = body.messages.find(message => message.role === 'user');
        expect(JSON.parse(String(userMessage?.content))).toEqual({
            query: 'prawnik',
            results: [
                {
                    id: 'c1',
                    name: 'Kancelaria Adwokacka',
                    category: 'law',
                    description: null,
                    tags: [],
                },
            ],
        });
    });

    describe('bledy', () => {
        it('odpowiedz, ktora nie jest JSON-em, konczy sie INVALID_RESPONSE', async () => {
            const client = clientReturning('to nie jest json');

            await expect(judgeRelevance(client, 'prawnik', [KANCELARIA])).rejects.toMatchObject({
                name: 'RelevanceJudgeError',
                code: 'INVALID_RESPONSE',
            });
        });

        it('JSON niezgodny ze schematem konczy sie INVALID_RESPONSE', async () => {
            const client = clientReturning(JSON.stringify({ relevant: 'c1' }));

            await expect(judgeRelevance(client, 'prawnik', [KANCELARIA])).rejects.toMatchObject({
                code: 'INVALID_RESPONSE',
            });
        });

        it('pusta tresc odpowiedzi konczy sie INVALID_RESPONSE', async () => {
            const client = clientReturning(null);

            await expect(judgeRelevance(client, 'prawnik', [KANCELARIA])).rejects.toMatchObject({
                code: 'INVALID_RESPONSE',
            });
        });

        it('blad API OpenAI konczy sie UPSTREAM_FAILED', async () => {
            const client: JudgeClient = {
                chat: {
                    completions: {
                        create: jest
                            .fn()
                            .mockRejectedValue(
                                new OpenAI.APIError(
                                    503,
                                    undefined,
                                    'Service Unavailable',
                                    undefined,
                                ),
                            ),
                    },
                },
            };

            await expect(judgeRelevance(client, 'prawnik', [KANCELARIA])).rejects.toMatchObject({
                code: 'UPSTREAM_FAILED',
            });
        });
    });
});
