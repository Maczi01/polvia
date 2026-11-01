import type Stripe from 'stripe';

/**
 * Ktora subskrypcje zsynchronizowac po danym zdarzeniu Stripe. Czysta funkcja: stan
 * i tak pobieramy na nowo (`syncSubscriptionFromStripe`), wiec ze zdarzenia bierzemy
 * tylko identyfikator subskrypcji i — przy checkoucie — wpis z `client_reference_id`.
 */
export type SubscriptionSyncTarget = {
    stripeSubscriptionId: string;
    /** `client_reference_id` sesji checkoutu (U9 ustawia tam `services.id`). */
    serviceId?: string;
};

function idOf(reference: string | { id: string } | null | undefined): string | null {
    if (!reference) return null;
    return typeof reference === 'string' ? reference : reference.id;
}

/**
 * Obslugiwane zdarzenia (do skonfigurowania w endpoincie webhooka w Stripe Dashboard):
 * `checkout.session.completed`, `customer.subscription.created|updated|deleted`,
 * `invoice.paid`, `invoice.payment_failed`.
 *
 * `null`: zdarzenie bez wplywu na stan premium (odpowiadamy 200 bez synchronizacji).
 */
export function subscriptionSyncTarget(event: Stripe.Event): SubscriptionSyncTarget | null {
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const stripeSubscriptionId = idOf(session.subscription);
            if (session.mode !== 'subscription' || !stripeSubscriptionId) return null;

            const serviceId = session.client_reference_id ?? undefined;
            return serviceId ? { stripeSubscriptionId, serviceId } : { stripeSubscriptionId };
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            return { stripeSubscriptionId: event.data.object.id };
        }
        case 'invoice.paid':
        case 'invoice.payment_failed': {
            const stripeSubscriptionId = idOf(
                event.data.object.parent?.subscription_details?.subscription,
            );
            return stripeSubscriptionId ? { stripeSubscriptionId } : null;
        }
        default: {
            return null;
        }
    }
}
