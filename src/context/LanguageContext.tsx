import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { I18nManager, Alert } from 'react-native';
import { translations, Language, TranslationKey, getLanguage, setLanguage as saveLanguage } from '../i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLang] = useState<Language>('fr');
  const [isRTL, setIsRTL] = useState(false);

  useEffect(() => {
    // Charger la langue sauvegardée
    const loadLanguage = async () => {
      const savedLang = await getLanguage();
      setLang(savedLang);
      setIsRTL(savedLang === 'ar');
    };
    loadLanguage();
  }, []);

  const setLanguage = async (lang: Language) => {
    const previousLang = language;
    setLang(lang);
    setIsRTL(lang === 'ar');
    await saveLanguage(lang);

    // Pour RTL, il faut redémarrer l'app
    const needsRestart = (lang === 'ar' && !I18nManager.isRTL) || (lang === 'fr' && I18nManager.isRTL);

    if (needsRestart) {
      if (lang === 'ar') {
        I18nManager.forceRTL(true);
      } else {
        I18nManager.forceRTL(false);
      }

      Alert.alert(
        lang === 'ar' ? 'تم تغيير اللغة' : 'Langue modifiée',
        lang === 'ar'
          ? 'يرجى إعادة تشغيل التطبيق لتطبيق التغييرات'
          : 'Veuillez redémarrer l\'application pour appliquer les changements',
        [{ text: 'OK' }]
      );
    }
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
