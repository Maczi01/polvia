import { hasDashboardAccess } from '@/lib/dashboard-access';
import { getServiceSubmissionLogo } from '@/lib/service-submissions';

/**
 * Logo zgloszenia: PNG po `sharp`, wiec typ jest pewny. `?download=1` zapisuje plik
 * pod nazwa oczekiwana w `public/services/`, bez parametru obrazek do podgladu.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    if (!(await hasDashboardAccess())) return new Response(null, { status: 404 });

    const { id } = await params;
    const result = await getServiceSubmissionLogo(id);
    if (!result) return new Response(null, { status: 404 });

    const isDownload = new URL(request.url).searchParams.has('download');
    return new Response(new Uint8Array(result.logo), {
        headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="${result.slug}.png"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
