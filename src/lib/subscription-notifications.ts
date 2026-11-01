import 'server-only';

import { getOperatorInbox, type MailMessage, sendMail } from '@/lib/mailer';

/**
 * Powiadomienia foundera o zdarzeniach subskrypcji. Skutek uboczny: nigdy nie rzuca,
 * a blad i przekroczenie czasu ida wylacznie do logu. Wolane PO nieodwracalnym kroku
 * (zapis stanu), wiec musza skonczyc sie w `maxDuration` webhooka — stad wlasny limit
 * ponad limity faz SMTP z `mailer.ts` (te sumuja sie do ~30 s).
 */
export const NOTIFICATION_TIMEOUT_MS = 8000;

type NotificationResult = 'sent' | 'failed' | 'timed_out';

async function sendWithTimeout(message: MailMessage): Promise<NotificationResult> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<NotificationResult>(resolve => {
        timer = setTimeout(() => resolve('timed_out'), NOTIFICATION_TIMEOUT_MS);
    });
    const delivery = sendMail(message).then<NotificationResult>(result =>
        result.ok ? 'sent' : 'failed',
    );

    try {
        return await Promise.race([delivery, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

async function notifyFounder(kind: string, message: Omit<MailMessage, 'to'>): Promise<void> {
    const result = await sendWithTimeout({ ...message, to: getOperatorInbox() });
    if (result === 'sent') return;

    // Bez tresci maila: tylko rodzaj powiadomienia i wynik (identyfikatory Stripe sa w tresci).
    console.error('subscription notification not delivered', { kind, result });
}

export interface SubscriptionRef {
    serviceId: string;
    stripeSubscriptionId: string;
}

export function notifyPremiumPurchased({
    serviceId,
    stripeSubscriptionId,
}: SubscriptionRef): Promise<void> {
    return notifyFounder('premium_purchased', {
        subject: 'Nowa subskrypcja premium',
        text: [
            'Firma oplacila plan premium. Czekaj na materialy (formularz po platnosci).',
            '',
            `Usluga (services.id): ${serviceId}`,
            `Subskrypcja Stripe: ${stripeSubscriptionId}`,
        ].join('\n'),
    });
}

export interface SubscriptionConflict {
    serviceId: string;
    activeSubscriptionId: string;
    conflictingSubscriptionId: string;
}

export function notifySubscriptionConflict({
    serviceId,
    activeSubscriptionId,
    conflictingSubscriptionId,
}: SubscriptionConflict): Promise<void> {
    return notifyFounder('subscription_conflict', {
        subject: 'Druga aktywna subskrypcja premium dla jednego wpisu — wymagany zwrot',
        text: [
            'Wpis ma juz aktywna subskrypcje premium, a oplacono kolejna.',
            'Stan wpisu NIE zostal zmieniony. Anuluj druga subskrypcje i zwroc platnosc w Stripe.',
            '',
            `Usluga (services.id): ${serviceId}`,
            `Aktywna subskrypcja: ${activeSubscriptionId}`,
            `Druga subskrypcja (do zwrotu): ${conflictingSubscriptionId}`,
        ].join('\n'),
    });
}
