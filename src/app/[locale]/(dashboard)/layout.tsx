import { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { LayoutDashboard, List, Plus } from 'lucide-react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-screen bg-background">
            <aside className="w-64 border-r bg-muted/10 flex flex-col">
                <div className="p-4 border-b">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 bg-green rounded-full" />
                        <span className="font-semibold">polvia Panel</span>
                    </div>
                </div>
                <nav className="flex-1 p-3 space-y-1">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                    </Link>
                    <Link
                        href="/dashboard/services"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <List className="h-4 w-4" />
                        Services
                    </Link>
                    <Link
                        href="/dashboard/services/new"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <Plus className="h-4 w-4" />
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