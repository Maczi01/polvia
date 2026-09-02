import { Link } from '@/i18n/navigation';
import { Plus } from 'lucide-react';
import { getServicesForDashboard } from '../_actions';
import { ServicesTable } from '../_components/services-table';

export default async function ServicesPage() {
    const services = await getServicesForDashboard();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Services</h1>
                    <p className="text-muted-foreground">View and manage all services</p>
                </div>
                <Link
                    href="/dashboard/services/new"
                    className="inline-flex items-center gap-2 rounded-md bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90"
                >
                    <Plus className="size-4" />
                    Add Service
                </Link>
            </div>

            <ServicesTable services={services} />
        </div>
    );
}