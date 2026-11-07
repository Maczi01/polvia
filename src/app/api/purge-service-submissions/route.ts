import { createHash, timingSafeEqual } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { deleteExpiredServiceSubmissions } from '@/lib/service-submissions';

import { env } from '../../../../env';

/**
 * Codzienny cron Vercela (`vercel.json`): usuwa rozpatrzone zgloszenia po terminie z polityki
 * prywatnosci. Vercel wysyla `Authorization: Bearer <CRON_SECRET>`. Bez sekretu endpoint
 * niczego nie usuwa.
 */
export const runtime = 'nodejs';

function sha256(value: string): Buffer {
    return createHash('sha256').update(value).digest();
}

function errorResponse(code: string, message: string, status: number): NextResponse {
    return NextResponse.json({ error: { code, message } }, { status });
}

/** Porownanie w czasie stalym na skrotach: `timingSafeEqual` wymaga rownej dlugosci buforow. */
function hasValidSecret(request: NextRequest, secret: string): boolean {
    const provided = request.headers.get('authorization') ?? '';
    return timingSafeEqual(sha256(provided), sha256(`Bearer ${secret}`));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    const secret = env.CRON_SECRET;
    if (!secret) {
        // Log, bo inaczej termin z polityki prywatnosci przestaje byc dotrzymywany po cichu.
        console.error('purge-service-submissions: CRON_SECRET is not configured');
        return errorResponse('CRON_NOT_CONFIGURED', 'Cron is not configured.', 503);
    }
    if (!hasValidSecret(request, secret)) {
        return errorResponse('UNAUTHORIZED', 'Unauthorized.', 401);
    }

    try {
        const deleted = await deleteExpiredServiceSubmissions();
        return NextResponse.json({ data: { deleted } });
    } catch (error) {
        // Bez komunikatu bledu: drizzle dokleja do niego parametry zapytania.
        console.error('purge-service-submissions: failed', {
            reason: error instanceof Error ? error.name : 'unknown',
        });
        return errorResponse('PURGE_FAILED', 'Could not delete expired submissions.', 500);
    }
}
