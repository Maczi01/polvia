import type { ReactElement, ReactNode } from 'react';

import { Footer } from '@/components/footer';
import { Header } from '@/components/header/header';

/** Profil firmy z naglowkiem i stopka serwisu — ten sam uklad co grupa `(header)`. */
export default function ServiceProfileLayout({ children }: { children: ReactNode }): ReactElement {
    return (
        <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
        </div>
    );
}
