import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
    checkRateLimit,
    getClientIp,
    type RateLimitResult,
    RateLimitStoreError,
    rateLimitSubject,
} from '@/lib/rate-limit';
import { getServiceSlugStatus } from '@/lib/service-profile-queries';
import { isValidServiceSlug } from '@/lib/service-profile-path';

/**
 * Lookup istnienia profilu `/firma/<slug>` dla `src/middleware.ts`.
 *
 * Middleware dziala na edge bez dostepu do bazy, wiec pyta ten handler (Node + db)
 * przed renderem — tylko tam da sie jeszcze zwrocic prawdziwy status 404.
 */
export const runtime = 'nodejs';

/**
 * Endpoint jest publiczny, ale tani (indeksowany SELECT po unikalnym slugu) i oddaje
 * tylko `exists`. Limit odbiera sens masowemu odpytywaniu, a z naddatkiem miesci
 * przegladanie profili, w tym prefetch linkow, ktory tez przechodzi przez middleware.
 */
const SLUG_LOOKUP_RATE_LIMIT = {
    maxRequestsPerIp: 120,
    windowSeconds: 60,
};

const slugParamsSchema = z.object({
    slug: z.string().refine(isValidServiceSlug, 'Invalid service slug format'),
});

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * Limit z fail-open: lookup sluzy tylko do zwrocenia 404 zamiast soft-404, wiec awaria
 * Redisa nie moze blokowac profili. Kazda inna awaria leci wyzej (500 → middleware
 * i tak przepuszcza zadanie).
 */
async function checkLookupRateLimit(request: NextRequest): Promise<RateLimitResult> {
    try {
        return await checkRateLimit({
            key: `service_slug_ip:${rateLimitSubject(getClientIp(request))}`,
            max: SLUG_LOOKUP_RATE_LIMIT.maxRequestsPerIp,
            windowSeconds: SLUG_LOOKUP_RATE_LIMIT.windowSeconds,
        });
    } catch (error) {
        if (!(error instanceof RateLimitStoreError)) throw error;

        console.error('Service slug lookup: rate limit store unavailable, allowing request', error);
        return { allowed: true, remaining: SLUG_LOOKUP_RATE_LIMIT.maxRequestsPerIp };
    }
}

export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
    try {
        const rate = await checkLookupRateLimit(request);

        if (!rate.allowed) {
            return NextResponse.json(
                {
                    data: null,
                    error: { code: 'RATE_LIMITED', message: 'Too many slug lookups' },
                },
                { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
            );
        }

        const parsed = slugParamsSchema.safeParse(await params);

        if (!parsed.success) {
            return NextResponse.json(
                {
                    data: null,
                    error: {
                        code: 'BAD_REQUEST',
                        message: parsed.error.issues[0]?.message ?? 'Invalid service slug',
                    },
                },
                { status: 400 },
            );
        }

        const { exists } = await getServiceSlugStatus(parsed.data.slug);

        return NextResponse.json({ data: { exists }, error: null });
    } catch (error) {
        // Szczegoly tylko w logach serwera — surowy blad bazy nie leci do klienta.
        console.error('Service slug lookup failed:', error);

        return NextResponse.json(
            { data: null, error: { code: 'LOOKUP_FAILED', message: 'Slug lookup failed' } },
            { status: 500 },
        );
    }
}
