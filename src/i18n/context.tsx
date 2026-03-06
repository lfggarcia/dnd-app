import React, { createContext, useContext, useState, useCallback } from 'react';
import { en } from './translations/en';
import { es } from './translations/es';

export type Lang = 'en' | 'es';
type DeepString<T> = T extends string ? string : { [K in keyof T]: DeepString<T[K]> };
type TranslationMap = DeepString<typeof en>;

const translations: Record<Lang, TranslationMap> = { en, es };

type I18nContextType = {
  t: (key: string) => string;
  lang: Lang;
  setLang: (l: Lang) => void;
};

const I18nContext = createContext<I18nContextType>({
  t: (key) => key,
  lang: 'es',
  setLang: () => {},
});

export const useI18n = () => useContext(I18nContext);

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Lang>('es');

  const t = useCallback(
    (key: string): string => {
      const keys = key.split('.');
      let value: any = translations[lang];
      for (const k of keys) {
        value = value?.[k];
      }
      return typeof value === 'string' ? value : key;
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
};
