import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { ServiceForm } from '../../../_components/service-form';
import { getServiceById, getTags } from '../../../_actions';

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [service, tags] = await Promise.all([getServiceById(id), getTags()]);

    if (!service) {
        notFound();
    }

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
                <h1 className="text-2xl font-bold">Edit Service</h1>
                <p className="text-muted-foreground">Update the details for &quot;{service.name}&quot;</p>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
                <ServiceForm tags={tags} mode="edit" initialData={service} />
            </div>
        </div>
    );
}
