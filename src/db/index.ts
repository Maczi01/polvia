import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {env} from '../../env'

// // import { users } from './schema'
// import { servicesTable } from './schema';

// const connectionString = env.DATABASE_URL!;
const connectionString = "postgresql://postgres.pxohvfoeakvtvqsvoaxa:mRjwsiEJ0BEkdomP@aws-0-eu-west-1.pooler.supabase.com:5432/postgres";

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client);

// const allServices = await db.select().from(servicesTable);
