import { z } from 'zod';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { env } from '../../../../env';
import { redis } from '@/lib/redis';
import { getTranslations } from 'next-intl/server';
import { serviceName } from '@/lib/consts';

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

function getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');

    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    return realIP || cfConnectingIP || '127.0.0.1';
}

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
    const ip = getClientIP(req);

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

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: env.MY_GMAIL,
            pass: env.MY_GMAIL_PASSWORD
        },
    });

    try {
        await transporter.sendMail({
            from: env.MY_GMAIL,
            to: env.MY_GMAIL,
            replyTo: email,
            subject: `Nowa wiadomość z serwisu ${serviceName}: ${topic}`,
            text: message,
        });
        await incrementContactRateLimit(ip);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Mail error:', error);
        return NextResponse.json(
            { success: false, message: String(error) },
            { status: 500 }
        );    }
}
