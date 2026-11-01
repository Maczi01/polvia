import { splitLocalePrefix } from '@/lib/split-locale-prefix';

describe('splitLocalePrefix', () => {
    it('sciezka bez prefiksu to pl ze wszystkimi segmentami', () => {
        expect(splitLocalePrefix('/firma/x')).toEqual({
            locale: 'pl',
            isPrefixed: false,
            segments: ['firma', 'x'],
        });
    });

    it.each(['en', 'ru', 'uk', 'pl'] as const)('prefiks /%s jest odcinany', locale => {
        expect(splitLocalePrefix(`/${locale}/map/prawne`)).toEqual({
            locale,
            isPrefixed: true,
            segments: ['map', 'prawne'],
        });
    });

    it('segment spoza listy locale nie jest prefiksem', () => {
        expect(splitLocalePrefix('/de/map/x')).toEqual({
            locale: 'pl',
            isPrefixed: false,
            segments: ['de', 'map', 'x'],
        });
    });

    it('odcina tylko jeden prefiks', () => {
        expect(splitLocalePrefix('/en/en/x').segments).toEqual(['en', 'x']);
    });

    it('sam prefiks daje pusta liste segmentow', () => {
        expect(splitLocalePrefix('/uk')).toEqual({ locale: 'uk', isPrefixed: true, segments: [] });
    });
});
