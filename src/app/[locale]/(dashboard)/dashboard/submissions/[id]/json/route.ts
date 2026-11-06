import { hasDashboardAccess } from '@/lib/dashboard-access';
import { getServiceSubmission } from '@/lib/service-submissions';

/** Plik wpisu do `data/services/`. Dostep sprawdza sam, jak kazdy punkt wejscia panelu. */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
    if (!(await hasDashboardAccess())) return new Response(null, { status: 404 });

    const { id } = await params;
    const submission = await getServiceSubmission(id);
    if (!submission) return new Response(null, { status: 404 });

    return new Response(JSON.stringify(submission.entry, null, 4), {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${submission.slug}.json"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
