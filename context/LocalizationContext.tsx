import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { Language } from '../types';

interface LocalizationContextType {
    language: Language;
    setLanguage: (language: Language) => void;
    t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Language is now hardcoded to English
    const language: Language = 'en';

    // setLanguage is a no-op function to avoid breaking components that use it
    const setLanguage = (_: Language) => {
        // No-op: language is always English
    };

    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadTranslations = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch('/locales/en.json');
                if (!response.ok) throw new Error('Failed to load en.json');
                const data = await response.json();
                setTranslations(data);
            } catch (err: any) {
                console.error("Error loading English translation file:", err.message);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        loadTranslations();
    }, []);

    const t = (key: string, replacements?: Record<string, string | number>): string => {
        let text = translations[key] || key;
        if (replacements) {
            Object.entries(replacements).forEach(([placeholder, value]) => {
                text = text.replace(new RegExp(`{{${placeholder}}}`, 'g'), String(value));
            });
        }
        return text;
    };

    if (isLoading) return null;
    
    if (error) {
        return (
            <div style={{ padding: '20px', fontFamily: 'sans-serif', color: 'red', textAlign: 'center', background: '#fff1f1' }}>
                <h1 style={{color: '#c00'}}>Application Error</h1>
                <pre style={{ whiteSpace: 'pre-wrap', background: '#f9f9f9', border: '1px solid #ddd', padding: '10px' }}>{error}</pre>
            </div>
        );
    }

    return (
        <LocalizationContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LocalizationContext.Provider>
    );
};

export const useLocalization = (): LocalizationContextType => {
    const context = useContext(LocalizationContext);
    if (context === undefined) {
        throw new Error('useLocalization must be used within a LocalizationProvider');
    }
    return context;
};