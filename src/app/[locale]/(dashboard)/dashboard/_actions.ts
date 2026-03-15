'use server';

import { db } from '@/db';
import {
    servicesTable,
    serviceLocationsTable,
    servicesTranslationsTable,
    servicesTagsTable,
    tagsTable,
    tagsTranslationsTable,
    categoryEnum,
    statusEnum,
    voivodeshipEnum,
} from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import slugify from 'slugify';
import sharp from 'sharp';

const categoryValues = categoryEnum.enumValues;
const statusValues = statusEnum.enumValues;
const voivodeshipValues = voivodeshipEnum.enumValues;

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const serviceSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    category: z.enum(categoryValues as [string, ...string[]]),
    status: z.enum(statusValues as [string, ...string[]]).default('active'),
    webpage: z.string().max(255).optional().or(z.literal('')),
    nip: z.string().max(10).optional().or(z.literal('')),
    languages: z.array(z.string()).default(['pl']),
    whatsappNumber: z.string().max(20).optional().or(z.literal('')),
    socials: z.object({
        instagram: z.string().optional().or(z.literal('')),
        telegram: z.string().optional().or(z.literal('')),
        tiktok: z.string().optional().or(z.literal('')),
        facebook: z.string().optional().or(z.literal('')),
        youtube: z.string().optional().or(z.literal('')),
        viber: z.string().optional().or(z.literal('')),
        whatsapp: z.string().optional().or(z.literal('')),
    }).optional(),
    // Location
    city: z.string().max(255).optional().or(z.literal('')),
    street: z.string().max(255).optional().or(z.literal('')),
    voivodeship: z.enum(voivodeshipValues as [string, ...string[]]).optional().or(z.literal('')),
    postcode: z.string().max(20).optional().or(z.literal('')),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    phoneNumber: z.string().max(50).optional().or(z.literal('')),
    email: z.string().email().max(255).optional().or(z.literal('')),
    // Translations
    namePl: z.string().max(255).optional().or(z.literal('')),
    nameEn: z.string().max(255).optional().or(z.literal('')),
    nameUk: z.string().max(255).optional().or(z.literal('')),
    nameRu: z.string().max(255).optional().or(z.literal('')),
    descriptionPl: z.string().optional().or(z.literal('')),
    descriptionEn: z.string().optional().or(z.literal('')),
    descriptionUk: z.string().optional().or(z.literal('')),
    descriptionRu: z.string().optional().or(z.literal('')),
    // Tags
    tags: z.array(z.string()).default([]),
});

export type ServiceFormData = z.infer<typeof serviceSchema>;

export type ActionResult = {
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
};

export async function getServicesForDashboard() {
    const services = await db
        .select({
            id: servicesTable.id,
            name: servicesTable.name,
            category: servicesTable.category,
            status: servicesTable.status,
            createdAt: servicesTable.createdAt,
            slug: serviceLocationsTable.slug,
            webpage: serviceLocationsTable.webpage,
            nip: serviceLocationsTable.nip,
            city: serviceLocationsTable.city,
            voivodeship: serviceLocationsTable.voivodeship,
            phoneNumber: serviceLocationsTable.phoneNumber,
            email: serviceLocationsTable.email,
        })
        .from(servicesTable)
        .leftJoin(serviceLocationsTable, eq(servicesTable.id, serviceLocationsTable.serviceId))
        .orderBy(desc(servicesTable.createdAt));

    return services;
}

export type DashboardService = Awaited<ReturnType<typeof getServicesForDashboard>>[number];

export async function getTags() {
    const rows = await db
        .select({
            id: tagsTable.id,
            name: tagsTranslationsTable.name,
            languageCode: tagsTranslationsTable.languageCode,
        })
        .from(tagsTable)
        .innerJoin(tagsTranslationsTable, eq(tagsTable.id, tagsTranslationsTable.tagId));

    const tagMap = new Map<string, { id: string; names: Record<string, string> }>();
    for (const row of rows) {
        if (!tagMap.has(row.id)) {
            tagMap.set(row.id, { id: row.id, names: {} });
        }
        tagMap.get(row.id)!.names[row.languageCode] = row.name;
    }

    return Array.from(tagMap.values());
}

export type Tag = Awaited<ReturnType<typeof getTags>>[number];

export type ServiceEditData = {
    id: string;
    name: string;
    category: string;
    status: string;
    webpage: string;
    nip: string;
    image: string;
    languages: string[];
    whatsappNumber: string;
    socials: {
        instagram?: string;
        telegram?: string;
        tiktok?: string;
        facebook?: string;
        youtube?: string;
        viber?: string;
        whatsapp?: string;
    };
    city: string;
    street: string;
    voivodeship: string;
    postcode: string;
    latitude: number;
    longitude: number;
    phoneNumber: string;
    email: string;
    namePl: string;
    nameEn: string;
    nameUk: string;
    nameRu: string;
    descriptionPl: string;
    descriptionEn: string;
    descriptionUk: string;
    descriptionRu: string;
    tags: string[];
};

export async function getServiceById(id: string): Promise<ServiceEditData | null> {
    const [service] = await db
        .select()
        .from(servicesTable)
        .where(eq(servicesTable.id, id))
        .limit(1);

    if (!service) return null;

    const [location] = await db
        .select()
        .from(serviceLocationsTable)
        .where(and(eq(serviceLocationsTable.serviceId, id), eq(serviceLocationsTable.isMainLocation, true)))
        .limit(1);

    const translations = await db
        .select()
        .from(servicesTranslationsTable)
        .where(eq(servicesTranslationsTable.serviceId, id));

    const tagRows = await db
        .select({ tagId: servicesTagsTable.tagId })
        .from(servicesTagsTable)
        .where(eq(servicesTagsTable.serviceId, id));

    const translationMap: Record<string, { name?: string | null; description?: string | null }> = {};
    for (const t of translations) {
        translationMap[t.languageCode] = { name: t.name, description: t.description };
    }

    const socials = (location?.socials ?? {}) as ServiceEditData['socials'];

    return {
        id: service.id,
        name: service.name,
        category: service.category,
        status: service.status,
        webpage: location?.webpage ?? '',
        nip: location?.nip ?? '',
        image: service.image ?? '',
        languages: service.languages ?? ['pl'],
        whatsappNumber: location?.whatsappNumber ?? '',
        socials,
        city: location?.city ?? '',
        street: location?.street ?? '',
        voivodeship: location?.voivodeship ?? '',
        postcode: location?.postcode ?? '',
        latitude: location?.latitude ?? 0,
        longitude: location?.longitude ?? 0,
        phoneNumber: location?.phoneNumber ?? '',
        email: location?.email ?? '',
        namePl: translationMap['pl']?.name ?? '',
        nameEn: translationMap['en']?.name ?? '',
        nameUk: translationMap['uk']?.name ?? '',
        nameRu: translationMap['ru']?.name ?? '',
        descriptionPl: translationMap['pl']?.description ?? '',
        descriptionEn: translationMap['en']?.description ?? '',
        descriptionUk: translationMap['uk']?.description ?? '',
        descriptionRu: translationMap['ru']?.description ?? '',
        tags: tagRows.map((r) => r.tagId),
    };
}

function parseRawServiceData(formData: FormData) {
    const raw = {
        name: formData.get('name') as string,
        category: formData.get('category') as string,
        status: (formData.get('status') as string) || 'active',
        webpage: formData.get('webpage') as string,
        nip: formData.get('nip') as string,
        languages: formData.getAll('languages') as string[],
        whatsappNumber: formData.get('whatsappNumber') as string,
        socials: {
            instagram: formData.get('socials.instagram') as string,
            telegram: formData.get('socials.telegram') as string,
            tiktok: formData.get('socials.tiktok') as string,
            facebook: formData.get('socials.facebook') as string,
            youtube: formData.get('socials.youtube') as string,
            viber: formData.get('socials.viber') as string,
            whatsapp: formData.get('socials.whatsapp') as string,
        },
        city: formData.get('city') as string,
        street: formData.get('street') as string,
        voivodeship: formData.get('voivodeship') as string,
        postcode: formData.get('postcode') as string,
        latitude: formData.get('latitude') as string,
        longitude: formData.get('longitude') as string,
        phoneNumber: formData.get('phoneNumber') as string,
        email: formData.get('email') as string,
        namePl: formData.get('namePl') as string,
        nameEn: formData.get('nameEn') as string,
        nameUk: formData.get('nameUk') as string,
        nameRu: formData.get('nameRu') as string,
        descriptionPl: formData.get('descriptionPl') as string,
        descriptionEn: formData.get('descriptionEn') as string,
        descriptionUk: formData.get('descriptionUk') as string,
        descriptionRu: formData.get('descriptionRu') as string,
        tags: formData.getAll('tags') as string[],
    };
    if (raw.languages.length === 0) {
        raw.languages = ['pl'];
    }
    return raw;
}

function validateImage(imageFile: File | null): ActionResult | null {
    if (imageFile && imageFile.size > 0) {
        if (!ALLOWED_IMAGE_TYPES.has(imageFile.type)) {
            return {
                success: false,
                message: 'Validation failed',
                errors: { image: ['Image must be PNG, JPEG, or WebP'] },
            };
        }
        if (imageFile.size > MAX_IMAGE_SIZE) {
            return {
                success: false,
                message: 'Validation failed',
                errors: { image: ['Image must be 5MB or smaller'] },
            };
        }
    }
    return null;
}

function validateFormData(raw: ReturnType<typeof parseRawServiceData>): { data: ServiceFormData } | { error: ActionResult } {
    const parsed = serviceSchema.safeParse(raw);
    if (!parsed.success) {
        const fieldErrors: Record<string, string[]> = {};
        for (const [key, value] of Object.entries(parsed.error.flatten().fieldErrors)) {
            if (value) fieldErrors[key] = value;
        }
        return { error: { success: false, message: 'Validation failed', errors: fieldErrors } };
    }
    return { data: parsed.data };
}

async function saveImage(imageFile: File, serviceName: string): Promise<string> {
    const filename = `${slugify(serviceName, { lower: true, strict: true })}.png`;
    const dir = path.join(process.cwd(), 'public', 'services');
    await mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await imageFile.arrayBuffer());

    const metadata = await sharp(buffer).metadata();
    const width = metadata.width!;
    const height = metadata.height!;

    // Canvas 8% larger than the image's larger dimension,
    // so the circular crop on the page won't clip into the image edges
    const size = Math.round(Math.max(width, height) * 1.08);

    const result = await sharp({
        create: {
            width: size,
            height: size,
            channels: 3,
            background: { r: 255, g: 255, b: 255 },
        },
    })
        .composite([{
            input: buffer,
            left: Math.round((size - width) / 2),
            top: Math.round((size - height) / 2),
        }])
        .png()
        .toBuffer();

    await writeFile(path.join(dir, filename), result);
    return filename;
}

async function updateSeedImage(serviceName: string, imageFilename: string): Promise<void> {
    try {
        const seedPath = path.join(process.cwd(), 'src', 'db', 'seed.ts');
        let content = await readFile(seedPath, 'utf8');

        const escaped = serviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const namePattern = new RegExp(`name:\\s*['"]${escaped}['"]`);
        const nameMatch = content.match(namePattern);

        if (!nameMatch || nameMatch.index === undefined) {
            console.log(`[seed-sync] Service "${serviceName}" not found in seed.ts, skipping`);
            return;
        }

        const beforeName = content.slice(0, Math.max(0, nameMatch.index));
        const blockStart = beforeName.lastIndexOf('seedService({');
        if (blockStart === -1) return;

        let depth = 0;
        let blockEnd = -1;
        for (let i = content.indexOf('{', blockStart); i < content.length; i++) {
            if (content[i] === '{') depth++;
            else if (content[i] === '}') {
                depth--;
                if (depth === 0) {
                    blockEnd = i + 1;
                    break;
                }
            }
        }
        if (blockEnd === -1) return;

        const block = content.slice(blockStart, blockEnd);

        const imageRegex = /image:\s*'[^']*'/;
        let newBlock: string;

        if (imageRegex.test(block)) {
            newBlock = block.replace(imageRegex, `image: '${imageFilename}'`);
        } else {
            const tagsLineRegex = /(tags:\s*\[[^\]]*\],?\s*\n)/;
            if (tagsLineRegex.test(block)) {
                newBlock = block.replace(tagsLineRegex, `$1        image: '${imageFilename}',\n`);
            } else {
                const catRegex = /(category:\s*['"][^'"]*['"],?\s*\n)/;
                newBlock = block.replace(catRegex, `$1        image: '${imageFilename}',\n`);
            }
        }

        content = content.slice(0, Math.max(0, blockStart)) + newBlock + content.slice(Math.max(0, blockEnd));
        await writeFile(seedPath, content, 'utf8');
        console.log(`[seed-sync] Updated seed.ts: ${serviceName} → ${imageFilename}`);
    } catch (error) {
        console.error('[seed-sync] Failed to update seed.ts:', error);
    }
}

function buildTranslations(data: ServiceFormData, serviceId: string) {
    const langData: Record<string, { name?: string; description?: string }> = {
        pl: { name: data.namePl || undefined, description: data.descriptionPl || undefined },
        en: { name: data.nameEn || undefined, description: data.descriptionEn || undefined },
        uk: { name: data.nameUk || undefined, description: data.descriptionUk || undefined },
        ru: { name: data.nameRu || undefined, description: data.descriptionRu || undefined },
    };

    const translations: { serviceId: string; languageCode: string; name?: string; description?: string }[] = [];
    for (const [lang, { name, description }] of Object.entries(langData)) {
        if (name || description) {
            translations.push({
                serviceId,
                languageCode: lang,
                ...(name && { name }),
                ...(description && { description }),
            });
        }
    }
    return translations;
}

export async function createTag(names: Record<string, string>): Promise<{ success: boolean; tag?: Tag; error?: string }> {
    const entries = Object.entries(names).filter(([, v]) => v.trim());
    if (entries.length === 0) {
        return { success: false, error: 'At least one tag name is required' };
    }

    try {
        const [tag] = await db.insert(tagsTable).values({}).returning({ id: tagsTable.id });

        await db.insert(tagsTranslationsTable).values(
            entries.map(([lang, name]) => ({
                tagId: tag.id,
                languageCode: lang,
                name: name.trim(),
            })),
        );

        const resultNames: Record<string, string> = {};
        for (const [lang, name] of entries) {
            resultNames[lang] = name.trim();
        }

        return { success: true, tag: { id: tag.id, names: resultNames } };
    } catch (error) {
        console.error('Failed to create tag:', error);
        return { success: false, error: 'Failed to create tag' };
    }
}

export async function createService(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    const imageFile = formData.get('image') as File | null;
    const imageError = validateImage(imageFile);
    if (imageError) return imageError;

    const raw = parseRawServiceData(formData);
    const result = validateFormData(raw);
    if ('error' in result) return result.error;
    const data = result.data;

    let imageFilename: string | null = null;
    if (imageFile && imageFile.size > 0) {
        imageFilename = await saveImage(imageFile, data.name);
        await updateSeedImage(data.name, imageFilename);
    }

    try {
        const [service] = await db
            .insert(servicesTable)
            .values({
                name: data.name,
                category: data.category as typeof categoryValues[number],
                status: data.status as typeof statusValues[number],
                image: imageFilename,
                languages: data.languages,
            })
            .returning({ id: servicesTable.id });

        await db.insert(serviceLocationsTable).values({
            serviceId: service.id,
            slug: slugify(data.name, { lower: true, strict: true }),
            city: data.city || null,
            street: data.street || null,
            voivodeship: data.voivodeship
                ? (data.voivodeship as typeof voivodeshipValues[number])
                : null,
            postcode: data.postcode || null,
            latitude: data.latitude,
            longitude: data.longitude,
            phoneNumber: data.phoneNumber || null,
            email: data.email || null,
            webpage: data.webpage || null,
            nip: data.nip || null,
            socials: data.socials,
            whatsappNumber: data.whatsappNumber || null,
            openingHours: {},
            isMainLocation: true,
        });

        const translations = buildTranslations(data, service.id);
        if (translations.length > 0) {
            await db.insert(servicesTranslationsTable).values(translations);
        }

        if (data.tags.length > 0) {
            await db.insert(servicesTagsTable).values(
                data.tags.map((tagId) => ({
                    serviceId: service.id,
                    tagId,
                })),
            );
        }

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/services');

        return { success: true, message: `Service "${data.name}" created successfully` };
    } catch (error) {
        console.error('Failed to create service:', error);
        return { success: false, message: 'Failed to create service. Please try again.' };
    }
}

export async function updateService(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
    const serviceId = formData.get('serviceId') as string;
    const existingImage = formData.get('existingImage') as string;

    if (!serviceId) {
        return { success: false, message: 'Service ID is required' };
    }

    const imageFile = formData.get('image') as File | null;
    const imageError = validateImage(imageFile);
    if (imageError) return imageError;

    const raw = parseRawServiceData(formData);
    const result = validateFormData(raw);
    if ('error' in result) return result.error;
    const data = result.data;

    let imageFilename: string | null = existingImage || null;
    if (imageFile && imageFile.size > 0) {
        imageFilename = await saveImage(imageFile, data.name);
        await updateSeedImage(data.name, imageFilename);
    }

    try {
        await db
            .update(servicesTable)
            .set({
                name: data.name,
                category: data.category as typeof categoryValues[number],
                status: data.status as typeof statusValues[number],
                image: imageFilename,
                languages: data.languages,
                updatedAt: new Date(),
            })
            .where(eq(servicesTable.id, serviceId));

        await db
            .update(serviceLocationsTable)
            .set({
                slug: slugify(data.name, { lower: true, strict: true }),
                city: data.city || null,
                street: data.street || null,
                voivodeship: data.voivodeship
                    ? (data.voivodeship as typeof voivodeshipValues[number])
                    : null,
                postcode: data.postcode || null,
                latitude: data.latitude,
                longitude: data.longitude,
                phoneNumber: data.phoneNumber || null,
                email: data.email || null,
                webpage: data.webpage || null,
                nip: data.nip || null,
                socials: data.socials,
                whatsappNumber: data.whatsappNumber || null,
                updatedAt: new Date(),
            })
            .where(and(eq(serviceLocationsTable.serviceId, serviceId), eq(serviceLocationsTable.isMainLocation, true)));

        // Delete + re-insert translations
        await db.delete(servicesTranslationsTable).where(eq(servicesTranslationsTable.serviceId, serviceId));
        const translations = buildTranslations(data, serviceId);
        if (translations.length > 0) {
            await db.insert(servicesTranslationsTable).values(translations);
        }

        // Delete + re-insert tags
        await db.delete(servicesTagsTable).where(eq(servicesTagsTable.serviceId, serviceId));
        if (data.tags.length > 0) {
            await db.insert(servicesTagsTable).values(
                data.tags.map((tagId) => ({
                    serviceId,
                    tagId,
                })),
            );
        }

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/services');

        return { success: true, message: `Service "${data.name}" updated successfully` };
    } catch (error) {
        console.error('Failed to update service:', error);
        return { success: false, message: 'Failed to update service. Please try again.' };
    }
}

export async function deleteService(serviceId: string): Promise<ActionResult> {
    try {
        await db.delete(servicesTable).where(eq(servicesTable.id, serviceId));
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/services');
        return { success: true, message: 'Service deleted successfully' };
    } catch (error) {
        console.error('Failed to delete service:', error);
        return { success: false, message: 'Failed to delete service' };
    }
}