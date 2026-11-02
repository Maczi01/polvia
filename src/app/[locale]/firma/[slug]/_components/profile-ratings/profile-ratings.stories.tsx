import type { Meta, StoryObj } from '@storybook/react';

import { withProfileIntl } from '../profile-story-parameters';
import { ProfileRatings } from './profile-ratings';

const meta = {
    title: 'firma/Sekcje/Oceny z innych serwisow',
    component: ProfileRatings,
    decorators: [
        withProfileIntl,
        Story => (
            <div className="max-w-sm p-6">
                <Story />
            </div>
        ),
    ],
    globals: { theme: 'light' },
    args: {
        ratings: [
            {
                source: 'google',
                name: 'Google',
                rating: 4.8,
                count: 126,
                url: 'https://example.com/opinie/google',
            },
            {
                source: 'booksy',
                name: 'Booksy',
                rating: 4.9,
                count: 312,
                url: 'https://example.com/opinie/booksy',
            },
            {
                source: 'fixly',
                name: 'Fixly',
                rating: 4.7,
                count: 58,
                url: 'https://example.com/opinie/fixly',
            },
        ],
    },
} satisfies Meta<typeof ProfileRatings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThreeSources: Story = {};

export const SingleSource: Story = {
    args: {
        ratings: [
            {
                source: 'google',
                name: 'Google',
                rating: 5,
                count: 1,
                url: 'https://example.com/opinie/google',
            },
        ],
    },
};
