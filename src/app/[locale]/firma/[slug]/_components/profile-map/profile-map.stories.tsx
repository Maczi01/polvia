import type { Meta, StoryObj } from '@storybook/react';

import { localServiceFixture, premiumProfessionalFixture } from '../profile-fixtures';
import {
    mobileViewport,
    profileStoryParameters,
    withProfileIntl,
} from '../profile-story-parameters';
import { ProfileMap } from './profile-map';

const meta = {
    title: 'firma/Sekcje/Mapa dojazdu',
    component: ProfileMap,
    decorators: [
        withProfileIntl,
        Story => (
            <div className="mx-auto max-w-6xl p-6">
                <Story />
            </div>
        ),
    ],
    parameters: profileStoryParameters,
    globals: { theme: 'light' },
    args: { profile: localServiceFixture },
} satisfies Meta<typeof ProfileMap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SeveralLocations: Story = {};

export const SingleLocation: Story = {
    args: { profile: premiumProfessionalFixture },
};

export const WithoutCatalogueLink: Story = {
    args: { profile: { ...localServiceFixture, mapHref: null } },
};

export const Mobile: Story = {
    parameters: mobileViewport,
};
