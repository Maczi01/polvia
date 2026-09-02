import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { ServiceForm } from '../../_components/service-form';
import { getTags } from '../../_actions';

export default async function NewServicePage() {
    const tags = await getTags();

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <Link
                    href="/dashboard/services"
                    className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    Back to services
                </Link>
                <h1 className="text-2xl font-bold">Add New Service</h1>
                <p className="text-muted-foreground">Fill in the details to create a new service</p>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
                <ServiceForm tags={tags} mode="create" />
            </div>
        </div>
    );
}