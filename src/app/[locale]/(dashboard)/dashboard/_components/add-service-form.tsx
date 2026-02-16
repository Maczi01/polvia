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
import { createService, createTag, type ActionResult, type Tag } from '../_actions';

const categories = [
    'others', 'education', 'renovation', 'financial', 'beauty', 'gastronomy',
    'grocery', 'transport', 'law', 'mechanics', 'health', 'entertainment',
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

export function AddServiceForm({ tags: initialTags }: { tags: Tag[] }) {
    const [state, formAction, isPending] = useActionState(createService, initialState);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const latRef = useRef<HTMLInputElement>(null);
    const lonRef = useRef<HTMLInputElement>(null);
    const [allTags, setAllTags] = useState<Tag[]>(initialTags);
    const [showNewTag, setShowNewTag] = useState(false);
    const [newTagNames, setNewTagNames] = useState({ pl: '', en: '', uk: '', ru: '' });
    const [creatingTag, setCreatingTag] = useState(false);

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
                        <Input id="name" name="name" required placeholder="Service name" />
                        {state.errors?.name && (
                            <p className="text-sm text-destructive">{state.errors.name[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Category *</Label>
                        <Select name="category" required>
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
                        <Select name="status" defaultValue="active">
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
                        <Input id="webpage" name="webpage" placeholder="https://example.com" />
                        {state.errors?.webpage && (
                            <p className="text-sm text-destructive">{state.errors.webpage[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="nip">NIP</Label>
                        <Input id="nip" name="nip" placeholder="1234567890" maxLength={10} />
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
                        {imagePreview && (
                            <img
                                src={imagePreview}
                                alt="Preview"
                                className="mt-2 h-24 w-24 rounded-md object-cover border"
                            />
                        )}
                        {state.errors?.image && (
                            <p className="text-sm text-destructive">{state.errors.image[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
                        <Input id="whatsappNumber" name="whatsappNumber" placeholder="+48..." />
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
                                    defaultChecked={lang.value === 'pl'}
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
                        <Input id="city" name="city" placeholder="Warsaw" />
                        {state.errors?.city && (
                            <p className="text-sm text-destructive">{state.errors.city[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="street">Street</Label>
                        <Input id="street" name="street" placeholder="ul. Marszalkowska 1" />
                        {state.errors?.street && (
                            <p className="text-sm text-destructive">{state.errors.street[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="voivodeship">Voivodeship</Label>
                        <Select name="voivodeship">
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
                        <Input id="postcode" name="postcode" placeholder="00-001" />
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
                            className="flex h-9 w-full rounded-md border border-input bg-white dark:bg-gray-800 px-3 py-1 text-base text-gray-900 dark:text-white shadow-sm transition-colors placeholder:text-gray-500 dark:placeholder:text-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                        />
                        {state.errors?.longitude && (
                            <p className="text-sm text-destructive">{state.errors.longitude[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phoneNumber">Phone Number</Label>
                        <Input id="phoneNumber" name="phoneNumber" placeholder="+48 123 456 789" />
                        {state.errors?.phoneNumber && (
                            <p className="text-sm text-destructive">{state.errors.phoneNumber[0]}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" placeholder="contact@example.com" />
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
                        <Input id="socials.facebook" name="socials.facebook" placeholder="https://facebook.com/..." />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="socials.instagram">Instagram</Label>
                        <Input id="socials.instagram" name="socials.instagram" placeholder="https://instagram.com/..." />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="socials.telegram">Telegram</Label>
                        <Input id="socials.telegram" name="socials.telegram" placeholder="https://t.me/..." />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="socials.tiktok">TikTok</Label>
                        <Input id="socials.tiktok" name="socials.tiktok" placeholder="https://tiktok.com/@..." />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="socials.youtube">YouTube</Label>
                        <Input id="socials.youtube" name="socials.youtube" placeholder="https://youtube.com/..." />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="socials.viber">Viber</Label>
                        <Input id="socials.viber" name="socials.viber" placeholder="Viber link or number" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="socials.whatsapp">WhatsApp</Label>
                        <Input id="socials.whatsapp" name="socials.whatsapp" placeholder="https://wa.me/..." />
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
                                <Input id="namePl" name="namePl" placeholder="Nazwa usługi" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="descriptionPl">Description (Polish)</Label>
                                <Textarea id="descriptionPl" name="descriptionPl" rows={3} placeholder="Opis usługi po polsku..." />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">English</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nameEn">Name (English)</Label>
                                <Input id="nameEn" name="nameEn" placeholder="Service name" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="descriptionEn">Description (English)</Label>
                                <Textarea id="descriptionEn" name="descriptionEn" rows={3} placeholder="Service description in English..." />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Ukrainian</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nameUk">Name (Ukrainian)</Label>
                                <Input id="nameUk" name="nameUk" placeholder="Назва послуги" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="descriptionUk">Description (Ukrainian)</Label>
                                <Textarea id="descriptionUk" name="descriptionUk" rows={3} placeholder="Опис послуги українською..." />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Russian</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nameRu">Name (Russian)</Label>
                                <Input id="nameRu" name="nameRu" placeholder="Название услуги" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="descriptionRu">Description (Russian)</Label>
                                <Textarea id="descriptionRu" name="descriptionRu" rows={3} placeholder="Описание услуги на русском..." />
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
                    {isPending ? 'Creating...' : 'Create Service'}
                </Button>
            </div>
        </form>
    );
}