import { getServices } from '@/lib/queries';
import { ServicesClientComponent } from './services-client-component';

type ServicesServerComponentProps = {
    params: {
        locale?: string;
    };
};

export default async function ServicesServerComponent({ params }: ServicesServerComponentProps) {
    const resolvedParams = await params;
    const locale = resolvedParams?.locale || 'en';

    const services = await getServices(locale);
    return <ServicesClientComponent services={services} />;
}
