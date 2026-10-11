/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import {
    LOGO_MAX_DIMENSION,
    processLogoCandidate,
    processLogoUpload,
} from '@/lib/add-business/logo';
import type { SafeFetchOptions, Transport } from '@/lib/add-business/safe-fetch';

const FIXTURES = path.join(__dirname, '../../../tests/fixtures/add-business');
const LOGO_PNG = readFileSync(path.join(FIXTURES, 'logo.png'));
const FAKE_PNG_SVG = readFileSync(path.join(FIXTURES, 'fake-png.svg'));

const PUBLIC_IP = '93.184.216.34';

async function* once(chunk: Uint8Array): AsyncIterable<Uint8Array> {
    yield chunk;
}

/** Siec w pamieci: jeden host, jedna odpowiedz albo blad polaczenia. Zero prawdziwych polaczen. */
function fakeImageServer(
    response: { contentType: string; body: Uint8Array } | null,
): SafeFetchOptions {
    const transport: Transport = async () => {
        if (response === null) throw new Error('ECONNREFUSED');
        return {
            status: 200,
            location: null,
            contentType: response.contentType,
            body: once(response.body),
            discard: () => {},
        };
    };
    return {
        transport,
        resolveHost: async () => [{ address: PUBLIC_IP, family: 4 }],
    };
}

beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('processLogoUpload', () => {
    it('poprawny PNG 800x600 wraca jako PNG zmniejszony do 512 px', async () => {
        const file = new File([LOGO_PNG], 'logo.png', { type: 'image/png' });

        const result = await processLogoUpload(file);

        if (!result.ok || result.png === null) throw new Error('expected png');
        const metadata = await sharp(result.png).metadata();
        expect(metadata.format).toBe('png');
        expect(metadata.width).toBe(LOGO_MAX_DIMENSION);
        expect(metadata.height).toBe(384);
    });

    it('maly obrazek nie jest powiekszany', async () => {
        const small = await sharp({
            create: { width: 64, height: 32, channels: 3, background: '#123456' },
        })
            .jpeg()
            .toBuffer();

        const result = await processLogoUpload(new File([small], 'logo.jpg'));

        if (!result.ok || result.png === null) throw new Error('expected png');
        const metadata = await sharp(result.png).metadata();
        expect([metadata.format, metadata.width, metadata.height]).toEqual(['png', 64, 32]);
    });

    it('SVG z rozszerzeniem .png i typem image/png to INVALID_LOGO', async () => {
        const file = new File([FAKE_PNG_SVG], 'logo.png', { type: 'image/png' });

        await expect(processLogoUpload(file)).resolves.toEqual({
            ok: false,
            code: 'INVALID_LOGO',
        });
    });

    it('smieci zamiast obrazka to INVALID_LOGO, nie wyjatek', async () => {
        const file = new File(['to nie jest obrazek'], 'logo.png', { type: 'image/png' });

        await expect(processLogoUpload(file)).resolves.toEqual({
            ok: false,
            code: 'INVALID_LOGO',
        });
    });

    it('plik 3 MB to LOGO_TOO_LARGE', async () => {
        const file = new File([new Uint8Array(3 * 1024 * 1024)], 'logo.png', {
            type: 'image/png',
        });

        await expect(processLogoUpload(file)).resolves.toEqual({
            ok: false,
            code: 'LOGO_TOO_LARGE',
        });
    });

    it('pusty plik i brak pliku oznaczaja brak logo, nie blad', async () => {
        await expect(processLogoUpload(new File([], ''))).resolves.toEqual({ ok: true, png: null });
        await expect(processLogoUpload(null)).resolves.toEqual({ ok: true, png: null });
    });
});

describe('processLogoCandidate', () => {
    it('kandydat ze strony przechodzi ten sam pipeline', async () => {
        const options = fakeImageServer({ contentType: 'image/png', body: LOGO_PNG });

        const png = await processLogoCandidate('https://firma.pl/logo.png', options);

        if (png === null) throw new Error('expected png');
        const metadata = await sharp(png).metadata();
        expect([metadata.format, metadata.width]).toEqual(['png', LOGO_MAX_DIMENSION]);
    });

    it('blad fetch daje null', async () => {
        const png = await processLogoCandidate('https://firma.pl/logo.png', fakeImageServer(null));

        expect(png).toBeNull();
    });

    it('SVG podany jako image/svg+xml daje null', async () => {
        const options = fakeImageServer({ contentType: 'image/svg+xml', body: FAKE_PNG_SVG });

        await expect(
            processLogoCandidate('https://firma.pl/logo.svg', options),
        ).resolves.toBeNull();
    });
});
