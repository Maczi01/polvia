'use client';

import React from 'react';

export default function DashboardPage() {
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
                <h2 className="mb-4 text-2xl font-bold">Data Entry Form</h2>
            </div>
            <div>
                <h2 className="mb-4 text-2xl font-bold">Location Map</h2>
            </div>
        </div>
    );
}
