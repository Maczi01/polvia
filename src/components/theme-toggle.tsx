'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

const fadeInKeyframes = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fadeIn {
  animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* FIX: Composited animations using pseudo-elements */
.theme-button {
  position: relative;
  overflow: hidden;
}

.theme-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: inherit;
  opacity: 0;
  transition: opacity 0.3s ease-in-out;
  pointer-events: none;
}

.theme-button.light::before {
  background-color: #1877F2;
}

.theme-button.dark::before {
  background-color: #1877F2;
}

.theme-button.active::before {
  opacity: 1;
}

.theme-button:hover::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: inherit;
  background-color: rgba(0, 0, 0, 0.1);
  opacity: 1;
  transition: opacity 0.3s ease-in-out;
  pointer-events: none;
}

.theme-button.active:hover::after {
  display: none;
}
`;

export const ThemeToggle = () => {
    const [mounted, setMounted] = useState(false);
    const { theme, resolvedTheme, setTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    // Consistent container dimensions
    const containerClass = "flex items-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full p-1 w-[76px] h-[36px] gap-1";

    if (!mounted) {
        return (
            <div className={containerClass}>
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse" />
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse ml-1" />
            </div>
        );
    }

    const currentTheme = theme === "system" ? resolvedTheme : theme;

    return (
        <div className="animate-fadeIn">
            <style>{fadeInKeyframes}</style>
            {/* FIX: Removed transition-colors to avoid non-composited animations */}
            <div className={`${containerClass} hover:shadow-md will-change-[box-shadow] contain-layout`}>
                <button
                    onClick={() => setTheme('light')}
                    className={`group theme-button light ${currentTheme === 'light' ? 'active' : ''} 
                        flex items-center justify-center w-8 h-8 rounded-full 
                        will-change-[opacity] relative z-10
                        ${currentTheme === 'light'
                        ? 'text-white shadow-lg'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                    title="Light mode"
                    aria-label="Switch to light mode"
                >
                    <Sun
                        size={16}
                        className="transition-transform duration-300 group-hover:rotate-12 group-active:scale-90 relative z-20"
                    />
                </button>
                <button
                    onClick={() => setTheme('dark')}
                    className={`group theme-button dark ${currentTheme === 'dark' ? 'active' : ''} 
                        flex items-center justify-center w-8 h-8 rounded-full 
                        will-change-[opacity] relative z-10
                        ${currentTheme === 'dark'
                        ? 'text-white shadow-lg'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                    title="Dark mode"
                    aria-label="Switch to dark mode"
                >
                    <Moon
                        size={16}
                        className="transition-transform duration-300 group-hover:rotate-12 group-active:scale-90 relative z-20"
                    />
                </button>
            </div>
        </div>
    );
};