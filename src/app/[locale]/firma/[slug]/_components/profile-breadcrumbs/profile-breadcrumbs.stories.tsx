import type { Meta, StoryObj } from '@storybook/react';

import { localServiceFixture, onlineServiceFixture } from '../profile-fixtures';
import { withProfileIntl } from '../profile-story-parameters';
import { ProfileBreadcrumbs } from './profile-breadcrumbs';

const meta = {
    title: 'firma/Okruszki',
    component: ProfileBreadcrumbs,
    decorators: [withProfileIntl],
    globals: { theme: 'light' },
    args: { items: localServiceFixture.breadcrumbs },
} satisfies Meta<typeof ProfileBreadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithCity: Story = {};

/** Wpis online: bez okruszka miasta. */
export const WithoutCity: Story = { args: { items: onlineServiceFixture.breadcrumbs } };

/** Jasny tekst na zdjeciu — naglowek szablonu „Galeria”. */
export const Inverted: Story = {
    args: { tone: 'inverted' },
    decorators: [
        Story => (
            <div className="bg-gradient-to-br from-brand via-fuchsia-800 to-orange-500 p-6">
                <Story />
            </div>
        ),
    ],
};
