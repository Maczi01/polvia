// import * as React from "react"
//
// import { cn } from "@/lib/utils"

import type { Meta, StoryObj } from '@storybook/react';
import { MobileBottomMarkerCard } from './mobile-bottom-marker-card';
import { Service, View } from '@/types';

type PartialService = Omit<
    Service,
    'createdAt' | 'openingHours' | 'updatedAt' | 'embedding' | 'priority'
>;

const meta = {
    title: 'component/mobileBottomCard',
    component: MobileBottomMarkerCard,
    parameters: {
        // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
        // layout: 'centered',
    },
    // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
    // tags: ['autodocs'],
    // More on argTypes: https://storybook.js.org/docs/api/argtypes
    // argTypes: {
    //     backgroundColor: { control: 'color' },
    // },
    // Use `fn` to spy on the onClick arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#action-args
    args: {},
} satisfies Meta<typeof MobileBottomMarkerCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary2: Story = {
    args: {
        selectedService: null,
        handleClose: () => void 0,
        currentView: 'View.Map' as View,
    },
};
