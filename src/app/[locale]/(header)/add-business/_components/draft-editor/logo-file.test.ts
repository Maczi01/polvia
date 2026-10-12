import { LOGO_MAX_BYTES } from '@/lib/add-business/form-limits';

import { logoFileError } from './logo-file';

function fileOf(size: number, type: string): File {
    return new File([new Uint8Array(size)], 'logo', { type });
}

describe('logoFileError', () => {
    it('przepuszcza obraz w limicie', () => {
        expect(logoFileError(fileOf(LOGO_MAX_BYTES, 'image/png'))).toBeNull();
    });

    it('plik wiekszy niz limit to ten sam klucz, ktory zwraca serwer', () => {
        expect(logoFileError(fileOf(LOGO_MAX_BYTES + 1, 'image/webp'))).toBe(
            'addBusiness.errors.logoTooLarge',
        );
    });

    it('format spoza listy to invalidLogo', () => {
        expect(logoFileError(fileOf(10, 'image/gif'))).toBe('addBusiness.errors.invalidLogo');
    });

    it('pusty typ nie blokuje — format rozpoznaje serwer z tresci pliku', () => {
        expect(logoFileError(fileOf(10, ''))).toBeNull();
    });
});
