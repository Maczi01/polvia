'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button/button';
import { Input } from '@/components/ui/input/input';
import { Badge } from '@/components/ui/badge/badge';
import { Trash2, ExternalLink, Search, Pencil } from 'lucide-react';
import { type DashboardService, deleteService } from '../_actions';
import { mapCategoryToBadgeColor } from '@/lib/consts';
import Link from 'next/link';

const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
};

export function ServicesTable({ services }: { services: DashboardService[] }) {
    const [search, setSearch] = useState('');
    const [isPending, startTransition] = useTransition();

    const filtered = services.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.slug?.toLowerCase().includes(search.toLowerCase()) ||
        s.category?.toLowerCase().includes(search.toLowerCase()) ||
        s.city?.toLowerCase().includes(search.toLowerCase()) ||
        s.nip?.includes(search)
    );

    const handleDelete = (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
        startTransition(async () => {
            await deleteService(id);
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search services..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <span className="text-sm text-muted-foreground">
                    {filtered.length} of {services.length} services
                </span>
            </div>

            <div className="rounded-lg border">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="px-4 py-3 text-left font-medium">Slug</th>
                                <th className="px-4 py-3 text-left font-medium">Name</th>
                                <th className="px-4 py-3 text-left font-medium">Category</th>
                                <th className="px-4 py-3 text-left font-medium">Status</th>
                                <th className="px-4 py-3 text-left font-medium">City</th>
                                <th className="px-4 py-3 text-left font-medium">Voivodeship</th>
                                <th className="px-4 py-3 text-left font-medium">Phone</th>
                                <th className="px-4 py-3 text-left font-medium">Webpage</th>
                                <th className="px-4 py-3 text-left font-medium">Created</th>
                                <th className="px-4 py-3 text-left font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                                        {services.length === 0 ? 'No services yet. Add your first one!' : 'No services match your search.'}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((service) => (
                                    <tr key={service.id} className="border-b transition-colors last:border-0 hover:bg-muted/30">
                                        <td className="px-4 py-3 text-muted-foreground">{service.slug}</td>
                                        <td className="px-4 py-3 font-medium">{service.name}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant={mapCategoryToBadgeColor(service.category) as any} label={service.category} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[service.status] || ''}`}>
                                                {service.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">{service.city || '-'}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{service.voivodeship || '-'}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{service.phoneNumber || '-'}</td>
                                        <td className="px-4 py-3">
                                            {service.webpage ? (
                                                <a
                                                    href={service.webpage.startsWith('http') ? service.webpage : `https://${service.webpage}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                                                >
                                                    <ExternalLink className="size-3" />
                                                    Link
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {service.createdAt ? new Date(service.createdAt).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <Link href={`/dashboard/services/${service.id}/edit`}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="size-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={isPending}
                                                    onClick={() => handleDelete(service.id, service.name)}
                                                    className="size-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}