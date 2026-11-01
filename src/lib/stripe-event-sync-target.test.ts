/**
 * @jest-environment node
 */
import Stripe from 'stripe';

import {
    event,
    invoiceObject,
    signatureFor,
    WEBHOOK_SECRET,
} from '../../tests/fixtures/premium/stripe-webhook-kit';
import { subscriptionSyncTarget } from './stripe-event-sync-target';

const SERVICE_ID = '11111111-1111-4111-8111-111111111111';
const parser = new Stripe('sk_test_dummy');

/** `Stripe.Event` z JSON-a przez prawdziwa weryfikacje paczki — bez rzutowania typu. */
function stripeEvent(type: string, object: Record<string, unknown>): Stripe.Event {
    const payload = event('evt_1', type, object);
    return parser.webhooks.constructEvent(payload, signatureFor(payload), WEBHOOK_SECRET);
}

describe('subscriptionSyncTarget', () => {
    it('checkout.session.completed w trybie subskrypcji: subskrypcja i wpis z client_reference_id', () => {
        const target = subscriptionSyncTarget(
            stripeEvent('checkout.session.completed', {
                mode: 'subscription',
                subscription: 'sub_1',
                client_reference_id: SERVICE_ID,
            }),
        );

        expect(target).toEqual({ stripeSubscriptionId: 'sub_1', serviceId: SERVICE_ID });
    });

    it('checkout bez client_reference_id: sama subskrypcja (powiazanie po metadanych)', () => {
        const target = subscriptionSyncTarget(
            stripeEvent('checkout.session.completed', {
                mode: 'subscription',
                subscription: { id: 'sub_1', object: 'subscription' },
                client_reference_id: null,
            }),
        );

        expect(target).toEqual({ stripeSubscriptionId: 'sub_1' });
    });

    it.each([
        ['platnosc jednorazowa', { mode: 'payment', subscription: null }],
        ['subskrypcja bez id', { mode: 'subscription', subscription: null }],
    ])('checkout bez subskrypcji (%s): null', (_case, session) => {
        expect(
            subscriptionSyncTarget(stripeEvent('checkout.session.completed', session)),
        ).toBeNull();
    });

    it.each([
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
    ])('%s: id subskrypcji ze zdarzenia', type => {
        expect(
            subscriptionSyncTarget(stripeEvent(type, { id: 'sub_7', object: 'subscription' })),
        ).toEqual({
            stripeSubscriptionId: 'sub_7',
        });
    });

    it.each(['invoice.paid', 'invoice.payment_failed'])(
        '%s: subskrypcja z parent faktury',
        type => {
            expect(subscriptionSyncTarget(stripeEvent(type, invoiceObject('sub_9')))).toEqual({
                stripeSubscriptionId: 'sub_9',
            });
        },
    );

    it('faktura bez subskrypcji (np. jednorazowa): null', () => {
        const target = subscriptionSyncTarget(
            stripeEvent('invoice.paid', { id: 'in_1', object: 'invoice', parent: null }),
        );

        expect(target).toBeNull();
    });

    it('zdarzenie bez wplywu na premium: null', () => {
        expect(subscriptionSyncTarget(stripeEvent('customer.created', { id: 'cus_1' }))).toBeNull();
    });
});
