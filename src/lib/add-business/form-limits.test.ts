/**
 * @jest-environment node
 */
import sharp from 'sharp';

import { DRAFT_JSON_SCHEMA } from '@/lib/add-business/draft-schema';
import {
    LANGUAGE_CODES,
    LOGO_ACCEPTED_TYPES,
    LOGO_MAX_BYTES,
} from '@/lib/add-business/form-limits';
import { processLogoUpload } from '@/lib/add-business/logo';
import { SERVICE_LANGUAGES } from '@/lib/languages';

type SharpFormat = 'png' | 'jpeg' | 'webp' | 'gif';

/** Obrazek w danym formacie z pamieci — bez pliku w repo. */
async function encode(format: SharpFormat): Promise<Buffer> {
    return sharp({ create: { width: 8, height: 8, channels: 3, background: '#336699' } })
        .toFormat(format)
        .toBuffer();
}

function sharpFormat(mime: (typeof LOGO_ACCEPTED_TYPES)[number]): SharpFormat {
    const formats: Record<(typeof LOGO_ACCEPTED_TYPES)[number], SharpFormat> = {
        'image/png': 'png',
        'image/jpeg': 'jpeg',
        'image/webp': 'webp',
    };
    return formats[mime];
}

beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('LOGO_ACCEPTED_TYPES', () => {
    it.each(LOGO_ACCEPTED_TYPES)('%s z listy klienta przechodzi pipeline serwera', async mime => {
        const bytes = await encode(sharpFormat(mime));

        const result = await processLogoUpload(new File([bytes], 'logo', { type: mime }));

        expect(result.ok && result.png !== null).toBe(true);
    });

    it('format spoza listy (GIF) serwer odrzuca — lista nie jest szersza niz pipeline', async () => {
        const bytes = await encode('gif');

        const result = await processLogoUpload(new File([bytes], 'logo', { type: 'image/gif' }));

        expect(result).toEqual({ ok: false, code: 'INVALID_LOGO' });
    });
});

describe('LOGO_MAX_BYTES', () => {
    it('plik o bajt wiekszy od limitu klienta serwer odrzuca jako za duzy', async () => {
        const file = new File([new Uint8Array(LOGO_MAX_BYTES + 1)], 'logo.png', {
            type: 'image/png',
        });

        expect(await processLogoUpload(file)).toEqual({ ok: false, code: 'LOGO_TOO_LARGE' });
    });
});

describe('LANGUAGE_CODES', () => {
    it('to lista jezykow obslugi z @/lib/languages, z bialoruskim', () => {
        expect(LANGUAGE_CODES).toBe(SERVICE_LANGUAGES);
        expect(LANGUAGE_CODES).toContain('be');
    });

    it('schemat JSON szkicu dla modelu dopuszcza wszystkie jezyki obslugi', () => {
        expect(JSON.stringify(DRAFT_JSON_SCHEMA)).toContain(
            `"enum":${JSON.stringify(SERVICE_LANGUAGES)}`,
        );
    });
});
