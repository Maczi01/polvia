'use client';

import { useActionState, useState, useRef } from 'react';
import { Button } from '@/components/ui/button/button';
import { Input } from '@/components/ui/input/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select/select';
import { createService, updateService, createTag, type ActionResult, type Tag, type ServiceEditData } from '../_actions';

const categories = [
    'others', 'education', 'renovation', 'financial', 'beauty', 'gastronomy',
    'grocery', 'transport', 'law', 'mechanics', 'health', 'real_estate', 'help_support',
] as const;

const statuses = ['active', 'inactive', 'pending'] as const;

const voivodeships = [
    { value: 'dolnoslaskie', label: 'Dolnośląskie' },
    { value: 'kujawsko-pomorskie', label: 'Kujawsko-Pomorskie' },
    { value: 'lubelskie', label: 'Lubelskie' },
    { value: 'lubuskie', label: 'Lubuskie' },
    { value: 'lodzkie', label: 'Łódzkie' },
    { value: 'malopolskie', label: 'Małopolskie' },
    { value: 'mazowieckie', label: 'Mazowieckie' },
    { value: 'opolskie', label: 'Opolskie' },
    { value: 'podkarpackie', label: 'Podkarpackie' },
    { value: 'podlaskie', label: 'Podlaskie' },
    { value: 'pomorskie', label: 'Pomorskie' },
    { value: 'slaskie', label: 'Śląskie' },
    { value: 'swietokrzyskie', label: 'Świętokrzyskie' },
    { value: 'warminsko-mazurskie', label: 'Warmińsko-Mazurskie' },
    { value: 'wielkopolskie', label: 'Wielkopolskie' },
    { value: 'zachodniopomorskie', label: 'Zachodniopomorskie' },
] as const;

const languages = [
    { value: 'pl', label: 'Polish' },
    { value: 'en', label: 'English' },
    { value: 'uk', label: 'Ukrainian' },
    { value: 'ru', label: 'Russian' },
];

const initialState: ActionResult = { success: false, message: '' };

type ServiceFormProps = {
    tags: Tag[];
    mode: 'create' | 'edit';
    initialData?: ServiceEditData;
};

export function ServiceForm({ tags: initialTags, mode, initialData }: ServiceFormProps) {
    const action = mode === 'edit' ? updateService : createService;
    const [state, formAction, isPending] = useActionState(action, initialState);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const latRef = useRef<HTMLInputElement>(null);
    const lonRef = useRef<HTMLInputElement>(null);
    const [allTags, setAllTags] = useState<Tag[]>(initialTags);
    const [showNewTag, setShowNewTag] = useState(false);
    const [newTagNames, setNewTagNames] = useState({ pl: '', en: '', uk: '', ru: '' });
    const [creatingTag, setCreatingTag] = useState(false);

    const d = initialData;

    const handleCreateTag = async () => {
        setCreatingTag(true);
        const result = await createTag(newTagNames);
        if (result.success && result.tag) {
            setAllTags((prev) => [...prev, result.tag!]);
            setNewTagNames({ pl: '', en: '', uk: '', ru: '' });
            setShowNewTag(false);
        }
        setCreatingTag(false);
    };

    return (
        <form action={formAction} className="space-y-8">
            {mode === 'edit' && d && (
                <>
                    <input type="hidden" name="serviceId" value={d.id} />
                    <input type="hidden" name="existingImage" value={d.image} />
                </>
            )}

            {state.message && (
                <div className={`rounded-lg p-4 text-sm ${
                    state.success
                        ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800'
                        : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800'
                }`}>
                    <p className="font-medium">{state.message}</p>
                    {state.errors && Object.keys(state.errors).length > 0 && (
                        <ul className="mt-2 list-disc list-inside space-y-1">
                            {Object.entries(state.errors).map(([field, messages]) => (
                                <li key={field}><span className="font-medium">{field}:</span> {messages.join(', ')}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Basic Info */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" name="name" required placeholder="Service name" defaultValue={d?.name} />
                        {state.errors?.name && (
                            <p className="text-sm text-destructive">{state.errors.name[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Category *</Label>
                        <Select name="category" required defaultValue={d?.category}>
                            <SelectTrigger className="rounded-md">
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {state.errors?.category && (
                            <p className="text-sm text-destructive">{state.errors.category[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select name="status" defaultValue={d?.status ?? 'active'}>
                            <SelectTrigger className="rounded-md">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                {statuses.map((status) => (
                                    <SelectItem key={status} value={status}>
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="webpage">Webpage</Label>
                        <Input id="webpage" name="webpage" placeholder="https://example.com" defaultValue={d?.webpage} />
                        {state.errors?.webpage && (
                            <p className="text-sm text-destructive">{state.errors.webpage[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="nip">NIP</Label>
                        <Input id="nip" name="nip" placeholder="1234567890" maxLength={10} defaultValue={d?.nip} />
                        {state.errors?.nip && (
                            <p className="text-sm text-destructive">{state.errors.nip[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="image">Image</Label>
                        <input
                            id="image"
                            name="image"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="flex h-9 w-full rounded-md border border-input bg-white dark:bg-gray-800 px-3 py-1 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    setImagePreview(URL.createObjectURL(file));
                                } else {
                                    setImagePreview(null);
                                }
                            }}
                        />
                        {imagePreview ? (
                            <img
                                src={imagePreview}
                                alt="Preview"
                                className="mt-2 h-24 w-24 rounded-md object-cover border"
                            />
                        ) : d?.image ? (
                            <img
                                src={`/services/${d.image}`}
                                alt="Current image"
                                className="mt-2 h-24 w-24 rounded-md object-cover border"
                            />
                        ) : null}
                        {state.errors?.image && (
                            <p className="text-sm text-destructive">{state.errors.image[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
                        <Input id="whatsappNumber" name="whatsappNumber" placeholder="+48..." defaultValue={d?.whatsappNumber} />
                        {state.errors?.whatsappNumber && (
                            <p className="text-sm text-destructive">{state.errors.whatsappNumber[0]}</p>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Languages</Label>
                    <div className="flex flex-wrap gap-3">
                        {languages.map((lang) => (
                            <label key={lang.value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="languages"
                                    value={lang.value}
                                    defaultChecked={d ? d.languages.includes(lang.value) : lang.value === 'pl'}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <span className="text-sm">{lang.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <Label>Tags</Label>
                    {allTags.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                            {allTags.map((tag) => (
                                <label key={tag.id} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="tags"
                                        value={tag.id}
                                        defaultChecked={d?.tags.includes(tag.id)}
                                        className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <span className="text-sm">
                                        {tag.names.en || tag.names.pl || Object.values(tag.names)[0]}
                                    </span>
                                    {Object.keys(tag.names).length > 1 && (
                                        <span className="text-xs text-muted-foreground">
                                            ({Object.keys(tag.names).join(', ')})
                                        </span>
                                    )}
                                </label>
                            ))}
                        </div>
                    )}

                    {!showNewTag ? (
                        <button
                            type="button"
                            onClick={() => setShowNewTag(true)}
                            className="text-sm text-green hover:underline"
                        >
                            + Add new tag
                        </button>
                    ) : (
                        <div className="rounded-md border p-3 space-y-3 bg-muted/20">
                            <p className="text-sm font-medium">New tag translations</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Polish</Label>
                                    <Input
                                        placeholder="Tag po polsku"
                                        value={newTagNames.pl}
                                        onChange={(e) => setNewTagNames((p) => ({ ...p, pl: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">English</Label>
                                    <Input
                                        placeholder="Tag in English"
                                        value={newTagNames.en}
                                        onChange={(e) => setNewTagNames((p) => ({ ...p, en: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Ukrainian</Label>
                                    <Input
                                        placeholder="Тег українською"
                                        value={newTagNames.uk}
                                        onChange={(e) => setNewTagNames((p) => ({ ...p, uk: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Russian</Label>
                                    <Input
                                        placeholder="Тег на русском"
                                        value={newTagNames.ru}
                                        onChange={(e) => setNewTagNames((p) => ({ ...p, ru: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={creatingTag || !Object.values(newTagNames).some((v) => v.trim())}
                                    onClick={handleCreateTag}
                                    className="rounded-md bg-green hover:bg-green/90 text-white"
                                >
                                    {creatingTag ? 'Creating...' : 'Create Tag'}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="rounded-md"
                                    onClick={() => {
                                        setShowNewTag(false);
                                        setNewTagNames({ pl: '', en: '', uk: '', ru: '' });
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Location */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input id="city" name="city" placeholder="Warsaw" defaultValue={d?.city} />
                        {state.errors?.city && (
                            <p className="text-sm text-destructive">{state.errors.city[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="street">Street</Label>
                        <Input id="street" name="street" placeholder="ul. Marszalkowska 1" defaultValue={d?.street} />
                        {state.errors?.street && (
                            <p className="text-sm text-destructive">{state.errors.street[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="voivodeship">Voivodeship</Label>
                        <Select name="voivodeship" defaultValue={d?.voivodeship || undefined}>
                            <SelectTrigger className="rounded-md">
                                <SelectValue placeholder="Select voivodeship" />
                            </SelectTrigger>
                            <SelectContent>
                                {voivodeships.map((v) => (
                                    <SelectItem key={v.value} value={v.value}>
                                        {v.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {state.errors?.voivodeship && (
                            <p className="text-sm text-destructive">{state.errors.voivodeship[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="postcode">Postcode</Label>
                        <Input id="postcode" name="postcode" placeholder="00-001" defaultValue={d?.postcode} />
                        {state.errors?.postcode && (
                            <p className="text-sm text-destructive">{state.errors.postcode[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="coordinates">Paste Coordinates (lat, lon)</Label>
                        <Input
                            id="coordinates"
                            placeholder="52.25174, 20.99145"
                            onChange={(e) => {
                                const value = e.target.value;
                                const parts = value.split(',').map((s) => s.trim());
                                if (parts.length === 2) {
                                    const lat = parseFloat(parts[0]);
                                    const lon = parseFloat(parts[1]);
                                    if (!isNaN(lat) && !isNaN(lon)) {
                                        if (latRef.current) {
                                            const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
                                            nativeSet.call(latRef.current, String(lat));
                                            latRef.current.dispatchEvent(new Event('input', { bubbles: true }));
                                        }
                                        if (lonRef.current) {
                                            const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
                                            nativeSet.call(lonRef.current, String(lon));
                                            lonRef.current.dispatchEvent(new Event('input', { bubbles: true }));
                                        }
                                    }
                                }
                            }}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="latitude">Latitude *</Label>
                        <input
                            ref={latRef}
                            id="latitude"
                            name="latitude"
                            type="number"
                            step="any"
                            required
                            placeholder="52.2297"
                            defaultValue={d?.latitude}
                            className="flex h-9 w-full rounded-md border border-input bg-white dark:bg-gray-800 px-3 py-1 text-base text-gray-900 dark:text-white shadow-sm transition-colors placeholder:text-gray-500 dark:placeholder:text-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                        />
                        {state.errors?.latitude && (
                            <p className="text-sm text-destructive">{state.errors.latitude[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="longitude">Longitude *</Label>
                        <input
                            ref={lonRef}
                            id="longitude"
                            name="longitude"
                            type="number"
                            step="any"
                            required
                            placeholder="21.0122"
                            defaultValue={d?.longitude}
                            className="flex h-9 w-full rounded-md border border-input bg-white dark:bg-gray-800 px-3 py-1 text-base text-gray-900 dark:text-white shadow-sm transition-colors placeholder:text-gray-500 dark:placeholder:text-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                        />
                        {state.errors?.longitude && (
                            <p className="text-sm text-destructive">{state.errors.longitude[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phoneNumber">Phone Number</Label>
                        <Input id="phoneNumber" name="phoneNumber" placeholder="+48 123 456 789" defaultValue={d?.phoneNumber} />
                        {state.errors?.phoneNumber && (
                            <p className="text-sm text-destructive">{state.errors.phoneNumber[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" placeholder="contact@example.com" defaultValue={d?.email} />
                        {state.errors?.email && (
                            <p className="text-sm text-destructive">{state.errors.email[0]}</p>
                        )}
                    </div>
                </div>
            </section>

            {/* Socials */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Social Media</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="socials.facebook">Facebook</Label>
                        <Input id="socials.facebook" name="socials.facebook" placeholder="https://facebook.com/..." defaultValue={d?.socials?.facebook} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="socials.instagram">Instagram</Label>
                        <Input id="socials.instagram" name="socials.instagram" placeholder="https://instagram.com/..." defaultValue={d?.socials?.instagram} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="socials.telegram">Telegram</Label>
                        <Input id="socials.telegram" name="socials.telegram" placeholder="https://t.me/..." defaultValue={d?.socials?.telegram} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="socials.tiktok">TikTok</Label>
                        <Input id="socials.tiktok" name="socials.tiktok" placeholder="https://tiktok.com/@..." defaultValue={d?.socials?.tiktok} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="socials.youtube">YouTube</Label>
                        <Input id="socials.youtube" name="socials.youtube" placeholder="https://youtube.com/..." defaultValue={d?.socials?.youtube} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="socials.viber">Viber</Label>
                        <Input id="socials.viber" name="socials.viber" placeholder="Viber link or number" defaultValue={d?.socials?.viber} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="socials.whatsapp">WhatsApp</Label>
                        <Input id="socials.whatsapp" name="socials.whatsapp" placeholder="https://wa.me/..." defaultValue={d?.socials?.whatsapp} />
                    </div>
                </div>
            </section>

            {/* Translations */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Translations</h3>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Polish</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="namePl">Name (Polish)</Label>
                                <Input id="namePl" name="namePl" placeholder="Nazwa usługi" defaultValue={d?.namePl} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="descriptionPl">Description (Polish)</Label>
                                <Textarea id="descriptionPl" name="descriptionPl" rows={3} placeholder="Opis usługi po polsku..." defaultValue={d?.descriptionPl} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">English</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nameEn">Name (English)</Label>
                                <Input id="nameEn" name="nameEn" placeholder="Service name" defaultValue={d?.nameEn} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="descriptionEn">Description (English)</Label>
                                <Textarea id="descriptionEn" name="descriptionEn" rows={3} placeholder="Service description in English..." defaultValue={d?.descriptionEn} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Ukrainian</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nameUk">Name (Ukrainian)</Label>
                                <Input id="nameUk" name="nameUk" placeholder="Назва послуги" defaultValue={d?.nameUk} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="descriptionUk">Description (Ukrainian)</Label>
                                <Textarea id="descriptionUk" name="descriptionUk" rows={3} placeholder="Опис послуги українською..." defaultValue={d?.descriptionUk} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Russian</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nameRu">Name (Russian)</Label>
                                <Input id="nameRu" name="nameRu" placeholder="Название услуги" defaultValue={d?.nameRu} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="descriptionRu">Description (Russian)</Label>
                                <Textarea id="descriptionRu" name="descriptionRu" rows={3} placeholder="Описание услуги на русском..." defaultValue={d?.descriptionRu} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="reset" variant="outline" className="rounded-md">
                    Reset
                </Button>
                <Button
                    type="submit"
                    disabled={isPending}
                    className="rounded-md bg-green hover:bg-green/90 text-white px-6"
                >
                    {isPending
                        ? (mode === 'edit' ? 'Saving...' : 'Creating...')
                        : (mode === 'edit' ? 'Save Changes' : 'Create Service')
                    }
                </Button>
            </div>
        </form>
    );
}
