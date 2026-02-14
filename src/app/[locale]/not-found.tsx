import Link from 'next/link';
import { MapPin, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
    return (
        <html lang="pl" className="h-full">
        <body className="h-full bg-[#F6F6F7] antialiased">
        {/* Header */}

        {/* Main Content */}
        <main className="min-h-screen">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center">
                    {/* 404 Illustration */}
                    <div className="mb-8">
                        <div className="inline-flex items-center justify-center w-32 h-32 bg-green-100 rounded-full mb-6">
                            <MapPin className="w-16 h-16 text-green-500" />
                        </div>
                        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                            Strona nie została znaleziona
                        </h2>
                        <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
                            Przepraszamy, ale strona której szukasz nie istnieje lub została przeniesiona.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
                        <Link
                            href="/pl"
                            className="flex items-center bg-green-500 text-white px-6 py-3 rounded-full font-medium hover:bg-green-600 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            Wróć do strony głównej
                        </Link>

                        <Link
                            href="/pl/map"
                            className="flex items-center bg-white text-green-600 px-6 py-3 rounded-full font-medium border-2 border-green-500 hover:bg-green-50 transition-colors"
                        >
                            <MapPin className="w-5 h-5 mr-2" />
                            Zobacz mapę
                        </Link>
                    </div>

                    {/* Search Section */}
                    {/*<div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-2xl mx-auto">*/}
                    {/*    <h3 className="text-xl font-semibold text-gray-800 mb-4">*/}
                    {/*        Znajdź to czego szukasz*/}
                    {/*    </h3>*/}
                    {/*    <p className="text-gray-600 mb-6">*/}
                    {/*        Przeszukaj naszą bazę ponad 200 polskich punktów usługowych i sklepów.*/}
                    {/*    </p>*/}

                    {/*    <div className="flex flex-col sm:flex-row gap-3">*/}
                    {/*        <div className="flex-1 relative">*/}
                    {/*            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />*/}
                    {/*            <input*/}
                    {/*                type="text"*/}
                    {/*                placeholder="Szukaj według kategorii, nazwy lub lokalizacji"*/}
                    {/*                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"*/}
                    {/*            />*/}
                    {/*        </div>*/}
                    {/*        <button className="bg-green-500 text-white px-8 py-3 rounded-full font-medium hover:bg-green-600 transition-colors">*/}
                    {/*            Szukaj*/}
                    {/*        </button>*/}
                    {/*    </div>*/}
                    {/*</div>*/}

                    {/* Popular Categories */}
                    <div className="mt-12">
                        <h4 className="text-lg font-medium text-gray-800 mb-6">
                            Popularne kategorie
                        </h4>
                        <div className="flex flex-wrap gap-3 justify-center">
                            {[
                                { name: 'grocery', color: 'bg-pink-100 text-pink-700' },
                                { name: 'transport', color: 'bg-green-100 text-green-700' },
                                { name: 'financial', color: 'bg-orange-100 text-orange-700' },
                                { name: 'mechanics', color: 'bg-gray-100 text-gray-700' },
                                { name: 'law', color: 'bg-yellow-100 text-yellow-700' },
                                { name: 'renovation', color: 'bg-blue-100 text-blue-700' }
                            ].map((category) => (
                                <Link
                                    key={category.name}
                                    href={`/pl/mapa?category=${category.name.toLowerCase()}`}
                                    className={`px-4 py-2 rounded-full text-sm font-medium ${category.color} hover:opacity-80 transition-opacity`}
                                >
                                    {category.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            {/*<footer className="bg-white border-t border-gray-200">*/}
            {/*    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">*/}
            {/*        <div className="flex flex-col md:flex-row justify-between items-center">*/}
            {/*            <div className="flex items-center mb-4 md:mb-0">*/}
            {/*                <div className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center mr-2">*/}
            {/*                    <MapPin className="w-4 h-4 text-white" />*/}
            {/*                </div>*/}
            {/*                <span className="text-xl font-bold text-gray-900">qolie</span>*/}
            {/*            </div>*/}

            {/*            <div className="flex items-center space-x-6 text-sm text-gray-600">*/}
            {/*                <Link href="/pl/privacy" className="hover:text-gray-900">*/}
            {/*                    Polityka prywatności*/}
            {/*                </Link>*/}
            {/*                <Link href="/pl/terms" className="hover:text-gray-900">*/}
            {/*                    Regulamin*/}
            {/*                </Link>*/}
            {/*                <Link href="/pl/contact" className="hover:text-gray-900">*/}
            {/*                    Kontakt*/}
            {/*                </Link>*/}
            {/*            </div>*/}
            {/*        </div>*/}

            {/*        <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm text-gray-600">*/}
            {/*            © 2025 Qolie. Wszystkie prawa zastrzeżone.*/}
            {/*        </div>*/}
            {/*    </div>*/}
            {/*</footer>*/}
        </main>
        </body>
        </html>
    );
}
