import 'server-only';

import sharp from 'sharp';

import { safeFetchImage, type SafeFetchOptions } from '@/lib/add-business/safe-fetch';

/**
 * Logo wpisu (D9): upload wlasciciela albo kandydat ze strony, oba przez ten sam pipeline.
 *
 * Format rozpoznaje sharp z TRESCI pliku (`metadata()`), nie `file.type` ani rozszerzenie —
 * SVG udajacy PNG to ryzyko XSS, wiec przepuszczamy tylko PNG/JPEG/WebP. Wynik zawsze jest
 * ponownie enkodowany do PNG (≤ 512 px), co przy okazji gubi metadane i ewentualny ladunek
 * doklejony do oryginalu. Nic nie trafia na dysk — bufor idzie jako zalacznik maila.
 */

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MAX_DIMENSION = 512;

const ALLOWED_FORMATS = new Set(['png', 'jpeg', 'webp']);

export type LogoErrorCode = 'INVALID_LOGO' | 'LOGO_TOO_LARGE';

type LogoResult = { ok: true; png: Buffer } | { ok: false; code: LogoErrorCode };

/** Upload: `png: null` = wlasciciel nie dolaczyl pliku (pusty input to nie blad). */
export type LogoUploadResult =
    | { ok: true; png: Buffer | null }
    | { ok: false; code: LogoErrorCode };

async function toLogoPng(bytes: Uint8Array): Promise<LogoResult> {
    if (bytes.byteLength > LOGO_MAX_BYTES) return { ok: false, code: 'LOGO_TOO_LARGE' };

    try {
        const { format } = await sharp(bytes).metadata();
        if (format === undefined || !ALLOWED_FORMATS.has(format)) {
            return { ok: false, code: 'INVALID_LOGO' };
        }

        const png = await sharp(bytes)
            .resize({
                width: LOGO_MAX_DIMENSION,
                height: LOGO_MAX_DIMENSION,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .png()
            .toBuffer();
        return { ok: true, png };
    } catch (error) {
        // sharp rzuca zwyklym `Error` dla danych, ktorych nie umie zdekodowac.
        if (!(error instanceof Error)) throw error;
        console.warn('logo rejected by sharp', { reason: error.message });
        return { ok: false, code: 'INVALID_LOGO' };
    }
}

export async function processLogoUpload(file: File | null): Promise<LogoUploadResult> {
    if (file === null || file.size === 0) return { ok: true, png: null };
    // Rozmiar przed odczytem: nie ladujemy do pamieci pliku, ktory i tak odrzucimy.
    if (file.size > LOGO_MAX_BYTES) return { ok: false, code: 'LOGO_TOO_LARGE' };

    return toLogoPng(new Uint8Array(await file.arrayBuffer()));
}

/**
 * Kandydat ze strony (R11). Porazka nie blokuje wysylki: `null` i mail oznacza "brak logo".
 * `options` tylko dla testow (transport bez sieci).
 */
export async function processLogoCandidate(
    url: string,
    options?: SafeFetchOptions,
): Promise<Buffer | null> {
    const fetched = await safeFetchImage(url, options);
    if (!fetched.ok) {
        console.warn('logo candidate skipped', { code: fetched.code });
        return null;
    }

    const result = await toLogoPng(fetched.body);
    if (!result.ok) {
        console.warn('logo candidate skipped', { code: result.code });
        return null;
    }
    return result.png;
}
