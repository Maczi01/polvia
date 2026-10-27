import { SERVICE_LANGUAGES } from '@/lib/languages';

import { LANGUAGE_OPTIONS } from './language-options';

describe('LANGUAGE_OPTIONS — jezyki obslugi w dashboardzie', () => {
    it('zawiera wszystkie kody SERVICE_LANGUAGES w kolejnosci kanonicznej', () => {
        expect(LANGUAGE_OPTIONS.map(option => option.value)).toEqual([...SERVICE_LANGUAGES]);
    });

    it('kazdy kod ma niepusta etykiete', () => {
        for (const option of LANGUAGE_OPTIONS) {
            expect(option.label.trim()).not.toBe('');
        }
    });

    it('bialoruski ma etykiete Belarusian', () => {
        expect(LANGUAGE_OPTIONS).toContainEqual({ value: 'be', label: 'Belarusian' });
    });
});
