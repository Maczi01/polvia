import { z } from 'zod';
import { NextResponse } from 'next/server';
import { env } from '../../../../env';
import { redis } from '@/lib/redis';
import { getClientIp } from '@/lib/rate-limit';
import { getTranslations } from 'next-intl/server';
import { serviceName } from '@/lib/consts';
import { sendMail } from '@/lib/mailer';

const ContactFormSchema = z.object({
    email: z.string().email('Please enter a valid email address').max(100),
    topic: z.string().min(1, 'Topic is required').max(50),
    message: z.string().min(1, 'Message is required').max(500),
});

const CONTACT_RATE_LIMIT = {
    maxMessagesPerIP: 5,
    ipWindowSeconds: 24 * 60 * 60, // 24h
    emailCooldownSeconds: 6 * 60 * 60, // 6h
};

async function checkContactRateLimit(ip: string) {
    const ipKey = `contact_ip:${ip}`;
    const ipMessages = await redis.get(ipKey);

    if (ipMessages && Number.parseInt(ipMessages) >= CONTACT_RATE_LIMIT.maxMessagesPerIP) {
        return {
            blocked: true,
            retryAfter: await redis.ttl(ipKey),
        };
    }

    return { blocked: false };
}

async function incrementContactRateLimit(ip: string) {
    const key = `contact_ip:${ip}`;
    await redis.multi()
        .incr(key)
        .expire(key, CONTACT_RATE_LIMIT.ipWindowSeconds)
        .exec();
}

export type ContactFormData = z.infer<typeof ContactFormSchema>;

export async function POST(req: Request) {
    const ip = getClientIp(req);

    const t = await getTranslations('contact');


    // Rate limit check
    const rate = await checkContactRateLimit(ip);
    if (rate.blocked) {
        return NextResponse.json(
            {
                success: false,
                message: t('rateLimitExceeded'),
                retryAfter: rate.retryAfter,
            },
            {
                status: 429,
                headers: { 'Retry-After': rate.retryAfter?.toString() || '3600' },
            }
        );
    }

    const body = await req.json();
    const { email, topic, message } = ContactFormSchema.parse(body);

    const sent = await sendMail({
        to: env.MY_GMAIL,
        replyTo: email,
        subject: `Nowa wiadomość z serwisu ${serviceName}: ${topic}`,
        text: message,
    });

    // Szczegoly bledu transportu loguje `mailer.ts`; klient dostaje tylko kod i komunikat.
    // `success`/`message` zostaja dla `contact-form.tsx`, ktory czyta wlasnie te pola.
    if (!sent.ok) {
        const failure = t('sendFailed');
        return NextResponse.json(
            { success: false, message: failure, error: { code: sent.code, message: failure } },
            { status: 500 },
        );
    }

    await incrementContactRateLimit(ip);

    return NextResponse.json({ success: true, data: null });
}
