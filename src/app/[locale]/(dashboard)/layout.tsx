import { Button } from '@/components/ui/button/button';
import { X } from 'lucide-react';
import { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <div className="w-64 border-r bg-muted/10">
                <div className="p-4 border-b">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 bg-green rounded-full" />
                        <span className="font-semibold">Polie Control Panel</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex">
                <div className="flex-1 flex flex-col">
                    <header className="h-14 border-b px-4 flex items-center justify-between">
                        <h1 className="text-sm font-medium">Voice conversation</h1>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm">
                                Save conversation
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </header>
                    {children}
                </div>
            </div>
        </div>
    );
}
