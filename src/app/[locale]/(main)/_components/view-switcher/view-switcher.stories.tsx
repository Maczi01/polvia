import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ViewSwitcher } from '@/app/[locale]/(main)/_components/view-switcher/view-switcher';

const meta = {
    title: 'Components/ViewSwitcher',
    component: ViewSwitcher,
    parameters: {
        layout: 'centered', // Optional: Centers the component in the Canvas
    },
    tags: ['autodocs'], // Optional: Generates autodocs
    argTypes: {
        currentView: {
            control: { type: 'radio' },
            options: ['list', 'map'],
        },
        setCurrentView: { action: 'setCurrentView' }, // Logs the action when the view is changed
    },
    args: {
        currentView: 'map' as const, // Default value for the currentView prop
        setCurrentView: (view: 'list' | 'map') => console.log(view), // Mock function for setCurrentView
    },
} satisfies Meta<typeof ViewSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

// Primary Story
export const Primary: Story = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    render: (args: any) => (
        <div style={{ width: '400px' }}>
            {' '}
            {/* Add a wrapper div with custom width */}
            <ViewSwitcher {...args} />
        </div>
    ),
    args: {
        // currentView: 'list' as const,
        setCurrentView: (view: 'list' | 'map') => console.log(view), // Mock function for setCurrentView
    },
};

// Story for when the currentView is 'map'
export const MapView: Story = {
    render: (args: any) => (
        <div style={{ width: '500px' }}>
            {' '}
            {/* Add a wrapper div with custom width */}
            <ViewSwitcher {...args} />
        </div>
    ),
    args: {
        // currentView: 'map' as const,
        setCurrentView: (view: 'list' | 'map') => console.log(view), // Mock function for setCurrentView
    },
};
