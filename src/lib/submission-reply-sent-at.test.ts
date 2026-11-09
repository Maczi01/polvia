import { formatReplySentAt } from './submission-reply-sent-at';

describe('formatReplySentAt', () => {
    it('pokazuje date i godzine w strefie Europe/Warsaw', () => {
        expect(formatReplySentAt(new Date('2026-11-09T09:30:00.000Z'))).toBe('9 Nov 2026, 10:30');
    });

    it('w czasie letnim przesuwa o dwie godziny', () => {
        expect(formatReplySentAt(new Date('2026-07-01T22:15:00.000Z'))).toBe('2 Jul 2026, 00:15');
    });
});
