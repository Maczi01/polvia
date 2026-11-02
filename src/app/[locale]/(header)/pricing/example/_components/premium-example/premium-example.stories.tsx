import type { Meta, StoryObj } from '@storybook/react';

import {
    mobileViewport,
    profileStoryParameters,
    withProfileIntl,
} from '@/app/[locale]/firma/[slug]/_components/profile-story-parameters';

import { getPremiumExampleProfile } from '../premium-example-profile';
import { PremiumExample } from './premium-example';

const meta = {
    title: 'cennik/Przykładowa strona premium',
    component: PremiumExample,
    decorators: [withProfileIntl],
    parameters: profileStoryParameters,
    globals: { theme: 'light' },
    args: {
        profile: getPremiumExampleProfile('pl', 'gallery'),
        ctaHref: { pathname: '/contact', query: { topic: 'premium' } },
    },
} satisfies Meta<typeof PremiumExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GalleryDesktop: Story = {};

export const GalleryMobile: Story = { parameters: mobileViewport };

export const ProfessionalDesktop: Story = {
    args: { profile: getPremiumExampleProfile('pl', 'professional') },
};

export const ClassicDesktop: Story = {
    args: { profile: getPremiumExampleProfile('pl', 'classic') },
};

/** Treść fikcyjnej firmy w innym locale (interfejs Storybooka zostaje po polsku). */
export const ClassicUkrainianContent: Story = {
    args: { profile: getPremiumExampleProfile('uk', 'classic') },
};
