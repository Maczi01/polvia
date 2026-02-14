import { Header } from '@/components/header/header';
import { ReactNode } from 'react';
import { Footer } from '@/components/footer';

export default async function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col">
            <Header />
            <main className="grow">{children}</main>
            <Footer />
        </div>
    );
}
