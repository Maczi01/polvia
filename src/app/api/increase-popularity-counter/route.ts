import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

// Rate limiting configuration for popularity clicks
const POPULARITY_RATE_LIMIT = {
    // Allow 5 clicks per IP per hour (across all services)
    maxClicksPerIP: 5,
    ipWindowSeconds: 60 * 60, // 1 hour
    // Allow 1 click per service per IP per day (prevents spam on specific items)
    serviceClickCooldown: 24 * 60 * 60, // 24 hours
};

function getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');

    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    return realIP || cfConnectingIP || '127.0.0.1';
}

async function checkPopularityRateLimit(ip: string, serviceId: string) {
    // Check IP-based rate limiting (total clicks per hour)
    const ipKey = `popularity_ip:${ip}`;
    const ipClicks = await redis.get(ipKey);

    if (ipClicks && Number.parseInt(ipClicks) >= POPULARITY_RATE_LIMIT.maxClicksPerIP) {
        return {
            blocked: true,
            reason: 'Too many votes. Please try again later.',
            retryAfter: await redis.ttl(ipKey)
        };
    }

    // Check service-specific rate limiting (prevent spam on specific items)
    const serviceKey = `popularity_service:${ip}:${serviceId}`;
    const serviceExists = await redis.exists(serviceKey);

    if (serviceExists) {
        return {
            blocked: true,
            reason: 'You have already voted for this item recently.',
            retryAfter: await redis.ttl(serviceKey)
        };
    }

    return { blocked: false };
}

async function incrementPopularityRateLimit(ip: string, serviceId: string) {
    const pipeline = redis.pipeline();

    // Increment IP clicks counter
    const ipKey = `popularity_ip:${ip}`;
    pipeline.incr(ipKey);
    pipeline.expire(ipKey, POPULARITY_RATE_LIMIT.ipWindowSeconds);

    // Set service-specific cooldown
    const serviceKey = `popularity_service:${ip}:${serviceId}`;
    pipeline.setex(serviceKey, POPULARITY_RATE_LIMIT.serviceClickCooldown, '1');

    await pipeline.exec();
}

export async function POST(request: Request) {
    try {
        const { serviceId } = await request.json();

        // Validate serviceId
        if (!serviceId) {
            return NextResponse.json(
                { success: false, message: 'Service ID is required' },
                { status: 400 }
            );
        }

        if (typeof serviceId !== 'string' || serviceId.trim().length === 0) {
            return NextResponse.json(
                { success: false, message: 'Invalid service ID' },
                { status: 400 },
            );
        }

        // Get client IP
        const clientIP = getClientIP(request);

        // Check rate limits
        const rateLimitCheck = await checkPopularityRateLimit(clientIP, serviceId);

        if (rateLimitCheck.blocked) {
            return NextResponse.json(
                {
                    success: false,
                    message: rateLimitCheck.reason,
                    retryAfter: rateLimitCheck.retryAfter
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': rateLimitCheck.retryAfter?.toString() || '3600'
                    }
                }
            );
        }

        // Increment the popularity counter
        await redis.incr(`service:${serviceId}:clicks`);

        // Update rate limiting counters
        await incrementPopularityRateLimit(clientIP, serviceId);

        return NextResponse.json({ success: true, message: 'Vote recorded successfully' });

    } catch (error) {
        console.error('Error saving popularity click:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}