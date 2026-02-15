import { Link } from '@/i18n/navigation';
import { List, Plus, TrendingUp } from 'lucide-react';
import { getServicesForDashboard } from './_actions';

export default async function DashboardPage() {
    const services = await getServicesForDashboard();

    const activeCount = services.filter((s) => s.status === 'active').length;
    const pendingCount = services.filter((s) => s.status === 'pending').length;
    const inactiveCount = services.filter((s) => s.status === 'inactive').length;

    const stats = [
        { label: 'Total Services', value: services.length, icon: List },
        { label: 'Active', value: activeCount, icon: TrendingUp },
        { label: 'Pending', value: pendingCount, icon: TrendingUp },
        { label: 'Inactive', value: inactiveCount, icon: TrendingUp },
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground">Manage your services and data</p>
                </div>
                <Link
                    href="/dashboard/services/new"
                    className="inline-flex items-center gap-2 rounded-md bg-green px-4 py-2 text-sm font-medium text-white hover:bg-green/90 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Add Service
                </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="rounded-lg border bg-card p-6 shadow-sm"
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-2 text-3xl font-bold">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Recent Services</h2>
                    <Link
                        href="/dashboard/services"
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                        View all
                    </Link>
                </div>
                {services.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4">No services yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">City</th>
                                </tr>
                            </thead>
                            <tbody>
                                {services.slice(0, 5).map((service) => (
                                    <tr key={service.id} className="border-b last:border-0">
                                        <td className="px-3 py-2 font-medium">{service.name}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{service.category}</td>
                                        <td className="px-3 py-2">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                                service.status === 'active'
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                                    : service.status === 'pending'
                                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                            }`}>
                                                {service.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">{service.city || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}