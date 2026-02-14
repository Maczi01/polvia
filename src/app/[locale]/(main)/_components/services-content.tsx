import { getServices } from '@/lib/queries';

interface ServicesContentProps {
    params: any;
}

export default async function ServicesContent({ params }: ServicesContentProps) {
    const resolvedParams = await params;
    const locale = resolvedParams?.locale || 'en';

    const services = await getServices(locale);

    return services;
}
