import 'server-only';

import { getOperatorInbox, type MailMessage, sendMail } from '@/lib/mailer';
import { STRIPE_LIVE_MODE } from '@/lib/stripe';
import { TimeoutError, withTimeout } from '@/lib/with-timeout';

/**
 * Powiadomienia foundera o zdarzeniach subskrypcji. Skutek uboczny: nigdy nie rzuca,
 * a blad i przekroczenie czasu ida wylacznie do logu. Wolane PO nieodwracalnym kroku
 * (zapis stanu), wiec musza skonczyc sie w `maxDuration` webhooka — stad wlasny limit
 * ponad limity faz SMTP z `mailer.ts` (te sumuja sie do ~30 s).
 */
export const NOTIFICATION_TIMEOUT_MS = 8000;

type NotificationResult = 'sent' | 'failed' | 'timed_out';

export interface NotificationOptions {
    /**
     * Wspolny termin wolajacego (znacznik czasu jak `Date.now()`). Mail dostaje mniejsza
     * z wartosci: `NOTIFICATION_TIMEOUT_MS` albo czas do terminu; po terminie nie wychodzi.
     */
    deadline?: number;
}

function timeoutFor({ deadline }: NotificationOptions): number {
    if (deadline === undefined) return NOTIFICATION_TIMEOUT_MS;
    return Math.min(NOTIFICATION_TIMEOUT_MS, deadline - Date.now());
}

async function sendWithTimeout(
    message: MailMessage,
    timeoutMs: number,
): Promise<NotificationResult> {
    try {
        const result = await withTimeout(
            sendMail(message),
            timeoutMs,
            () => new TimeoutError('operator notification', timeoutMs),
        );
        return result.ok ? 'sent' : 'failed';
    } catch (error) {
        if (error instanceof TimeoutError) return 'timed_out';
        throw error;
    }
}

/**
 * Klucz testowy Stripe (lokalny `stripe listen`, Preview) wysyla na prawdziwa skrzynke
 * foundera — `[TEST]` odroznia takie maile od prawdziwej sprzedazy. Ten sam znacznik co
 * w mailu z materialami.
 */
function modeSubject(subject: string): string {
    return STRIPE_LIVE_MODE ? subject : `[TEST] ${subject}`;
}

async function deliver(
    message: Omit<MailMessage, 'to'>,
    options: NotificationOptions,
): Promise<NotificationResult> {
    const timeoutMs = timeoutFor(options);
    if (timeoutMs <= 0) return 'timed_out';

    const subject = modeSubject(message.subject);
    return sendWithTimeout({ ...message, subject, to: getOperatorInbox() }, timeoutMs);
}

async function notifyFounder(
    kind: string,
    message: Omit<MailMessage, 'to'>,
    options: NotificationOptions,
): Promise<void> {
    const result = await deliver(message, options);
    if (result === 'sent') return;

    // Bez tresci maila: tylko rodzaj powiadomienia i wynik (identyfikatory Stripe sa w tresci).
    console.error('subscription notification not delivered', { kind, result });
}

export interface SubscriptionRef {
    serviceId: string;
    stripeSubscriptionId: string;
}

export function notifyPremiumPurchased(
    { serviceId, stripeSubscriptionId }: SubscriptionRef,
    options: NotificationOptions = {},
): Promise<void> {
    const message = {
        subject: 'Nowa subskrypcja premium',
        text: [
            'Firma oplacila plan premium. Czekaj na materialy (formularz po platnosci).',
            '',
            `Usluga (services.id): ${serviceId}`,
            `Subskrypcja Stripe: ${stripeSubscriptionId}`,
        ].join('\n'),
    };
    return notifyFounder('premium_purchased', message, options);
}

export interface SubscriptionConflict {
    serviceId: string;
    activeSubscriptionId: string;
    conflictingSubscriptionId: string;
}

export function notifySubscriptionConflict(
    { serviceId, activeSubscriptionId, conflictingSubscriptionId }: SubscriptionConflict,
    options: NotificationOptions = {},
): Promise<void> {
    const message = {
        subject: 'Druga aktywna subskrypcja premium dla jednego wpisu — wymagany zwrot',
        text: [
            'Wpis ma juz aktywna subskrypcje premium, a oplacono kolejna.',
            'Stan wpisu NIE zostal zmieniony. Anuluj druga subskrypcje i zwroc platnosc w Stripe.',
            '',
            `Usluga (services.id): ${serviceId}`,
            `Aktywna subskrypcja: ${activeSubscriptionId}`,
            `Druga subskrypcja (do zwrotu): ${conflictingSubscriptionId}`,
        ].join('\n'),
    };
    return notifyFounder('subscription_conflict', message, options);
}
