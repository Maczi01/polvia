'use client';

import { ReactNode } from 'react';

type DirectoryLayoutProps = {
    introContent: ReactNode;
    mainContent: ReactNode;
    map: ReactNode;
};

export function DirectoryLayout({ introContent, mainContent, map }: DirectoryLayoutProps) {
    return (
        <>
            {/* Desktop: two-column layout */}
            <div className="hidden lg:flex">
                {/* Left column — scrolls with page */}
                <div className="w-7/12">
                    <div className="max-w-3xl px-6 py-10">
                        {introContent}
                        {mainContent}
                    </div>
                </div>

                {/* Right column — sticky map */}
                <div className="w-5/12 sticky top-20 h-[calc(100vh-5rem)]">
                    {map}
                </div>
            </div>

            {/* Mobile: single column with inline map */}
            <div className="lg:hidden">
                <div className="px-4 py-6 sm:px-6">
                    {introContent}
                </div>

                <div className="h-64 sm:h-80">
                    {map}
                </div>

                <div className="px-4 py-6 sm:px-6">
                    {mainContent}
                </div>
            </div>
        </>
    );
}
