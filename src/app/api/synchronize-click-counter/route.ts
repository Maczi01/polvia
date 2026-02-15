import { NextResponse } from 'next/server';
import { db } from '@/db';
import { redis } from '@/lib/redis';
import { serviceEngagementsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
    try {
        const keys = await redis.keys('service:*:clicks');

        for (const key of keys) {
            const serviceId = key.split(':')[1];
            const clicks = await redis.get(key);

            if (clicks) {
                const existing = await db
                    .select()
                    .from(serviceEngagementsTable)
                    .where(eq(serviceEngagementsTable.serviceId, serviceId));

                if (existing.length > 0) {
                    await db
                        .update(serviceEngagementsTable)
                        .set({ clicks: existing[0].clicks + Number(clicks) })
                        .where(eq(serviceEngagementsTable.serviceId, serviceId));
                } else {
                    await db.insert(serviceEngagementsTable).values({
                        serviceId,
                        clicks: Number(clicks),
                    });
                }

                // ✅ Usuwamy dane z Redis po synchronizacji
                await redis.del(key);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error syncing clicks:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
