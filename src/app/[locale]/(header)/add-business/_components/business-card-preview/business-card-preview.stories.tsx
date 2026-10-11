import type { Meta, StoryObj } from '@storybook/react';
import { NextIntlClientProvider } from 'next-intl';

import messages from '../../../../../../../messages/pl.json';
import { BusinessCardPreview } from './business-card-preview';
import { PIN_FIXTURE, PREVIEW_FIXTURE } from './preview-fixture';

const meta = {
    title: 'add-business/business-card-preview',
    component: BusinessCardPreview,
    decorators: [
        Story => (
            <NextIntlClientProvider locale="pl" messages={messages} timeZone="Europe/Warsaw">
                <div className="max-w-xl p-4">
                    <Story />
                </div>
            </NextIntlClientProvider>
        ),
    ],
    args: {
        preview: PREVIEW_FIXTURE,
        unconfirmed: [],
        logoSrc: null,
        pin: PIN_FIXTURE,
    },
} satisfies Meta<typeof BusinessCardPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Complete: Story = {};

export const Unconfirmed: Story = {
    args: {
        preview: { ...PREVIEW_FIXTURE, phoneNumber: null, email: null, openingHours: null },
        unconfirmed: ['phoneNumber', 'email', 'openingHours'],
    },
};

export const ApproximatePin: Story = {
    args: { pin: { ...PIN_FIXTURE, approximate: true } },
};

export const AddressNotFound: Story = {
    args: { pin: null },
};

export const Online: Story = {
    args: { preview: { ...PREVIEW_FIXTURE, coverage: 'online', street: null }, pin: null },
};
