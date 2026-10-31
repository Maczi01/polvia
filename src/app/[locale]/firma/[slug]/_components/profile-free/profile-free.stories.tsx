import type { Meta, StoryObj } from '@storybook/react';

import {
    localServiceFixture,
    noLogoServiceFixture,
    onlineServiceFixture,
} from '../profile-fixtures';
import { mobileViewport, profileStoryParameters, withProfileIntl } from '../profile-story-parameters';
import { ProfileFree } from './profile-free';

const meta = {
    title: 'firma/Profil darmowy',
    component: ProfileFree,
    decorators: [withProfileIntl],
    parameters: profileStoryParameters,
    globals: { theme: 'light' },
    args: { profile: localServiceFixture },
} satisfies Meta<typeof ProfileFree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LocalDesktop: Story = {};

export const LocalMobile: Story = { parameters: mobileViewport };

export const OnlineDesktop: Story = { args: { profile: onlineServiceFixture } };

export const OnlineMobile: Story = {
    args: { profile: onlineServiceFixture },
    parameters: mobileViewport,
};

export const NoLogoDesktop: Story = { args: { profile: noLogoServiceFixture } };

export const NoLogoMobile: Story = {
    args: { profile: noLogoServiceFixture },
    parameters: mobileViewport,
};
