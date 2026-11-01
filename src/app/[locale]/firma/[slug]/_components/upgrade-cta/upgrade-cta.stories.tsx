import type { Meta, StoryObj } from '@storybook/react';

import type { CheckoutAction } from '@/lib/premium-checkout-fields';

import { mobileViewport, withProfileIntl } from '../profile-story-parameters';
import { UpgradeCta } from './upgrade-cta';

/** Zastepstwa `startPremiumCheckout`: Storybook nie laczy sie ze Stripe. */
const idleAction: CheckoutAction = async () => null;

const failingAction: CheckoutAction = async () => ({
    error: {
        code: 'CHECKOUT_FAILED',
        message: 'Nie udało się otworzyć płatności. Spróbuj ponownie za chwilę.',
    },
});

const meta = {
    title: 'firma/CTA checkoutu premium',
    component: UpgradeCta,
    decorators: [
        withProfileIntl,
        Story => (
            <div className="max-w-sm p-6">
                <Story />
            </div>
        ),
    ],
    globals: { theme: 'light' },
    args: { serviceId: '6f1c2a9e-3b7d-4c55-9a10-2f4e8d7b1c01', action: idleAction },
} satisfies Meta<typeof UpgradeCta>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = { parameters: mobileViewport };

/** Klik w CTA pokazuje blad akcji podpiety do wyboru interwalu. */
export const CheckoutError: Story = { args: { action: failingAction } };
