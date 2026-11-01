import type { Meta, StoryObj } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';

import messages from '../../../../../../../messages/pl.json';
import { PricingPlans } from './pricing-plans';

const meta = {
    title: 'cennik/Plany',
    component: PricingPlans,
    // `Link` z next-intl korzysta z hookow App Routera.
    parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
    decorators: [
        Story => (
            <NextIntlClientProvider locale="pl" messages={messages} timeZone="Europe/Warsaw">
                <div className="bg-gray-50 px-6 py-16 dark:bg-gray-900">
                    <div className="mx-auto max-w-6xl">
                        <Story />
                    </div>
                </div>
            </NextIntlClientProvider>
        ),
    ],
    args: {
        heading: (
            <h1 className="font-sans text-4xl font-extrabold text-[#26364d] dark:text-white">
                {messages.Pricing.choosePlan}
            </h1>
        ),
        purchase: { kind: 'checkout', portalUrl: 'https://billing.stripe.com/p/login/test_123' },
    },
} satisfies Meta<typeof PricingPlans>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Platnosci online wylaczone: plan premium prowadzi do formularza kontaktowego. */
export const ContactPurchase: Story = { args: { purchase: { kind: 'contact' } } };
