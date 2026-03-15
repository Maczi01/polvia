import { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { LayoutDashboard, List, Plus } from 'lucide-react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-screen bg-background">
            <aside className="flex w-64 flex-col border-r bg-muted/10">
                <div className="border-b p-4">
                    <div className="flex items-center gap-2">
                        <div className="size-6 rounded-full bg-green" />
                        <span className="font-semibold">polvia Panel</span>
                    </div>
                </div>
                <nav className="flex-1 space-y-1 p-3">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <LayoutDashboard className="size-4" />
                        Dashboard
                    </Link>
                    <Link
                        href="/dashboard/services"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <List className="size-4" />
                        Services
                    </Link>
                    <Link
                        href="/dashboard/services/new"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <Plus className="size-4" />
                        Add Service
                    </Link>
                </nav>
            </aside>

            <main className="flex-1 overflow-auto">
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}