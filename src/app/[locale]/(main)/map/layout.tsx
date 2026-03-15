import { Header } from '@/components/header/header';
import { ReactNode } from 'react';

export default async function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-full flex-col">
            <Header />
            <main className="flex-1 overflow-hidden">{children}</main>
        </div>
    );
}
