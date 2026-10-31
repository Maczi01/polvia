import { z } from 'zod';

import { formatZodIssue } from './format-zod-issue';

function firstIssue(schema: z.ZodTypeAny, input: unknown): z.ZodIssue {
    const result = schema.safeParse(input);
    if (result.success) throw new Error('oczekiwano bledu walidacji');

    return result.error.issues[0];
}

describe('formatZodIssue', () => {
    it('skleja sciezke pola kropkami przed komunikatem', () => {
        const schema = z.object({ faq: z.array(z.object({ q: z.string().min(1, 'Pusty') })) });

        expect(formatZodIssue(firstIssue(schema, { faq: [{ q: '' }] }))).toBe('faq.0.q: Pusty');
    });

    it('blad na korzeniu oznacza jako (korzen)', () => {
        expect(formatZodIssue(firstIssue(z.string({ message: 'Tekst' }), 1))).toBe(
            '(korzen): Tekst',
        );
    });
});
