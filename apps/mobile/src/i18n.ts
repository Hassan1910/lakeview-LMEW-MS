import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'lmew.language';

const strings = {
  EN: {
    saved: 'Saved',
    avatar: 'Avatar updated',
    language: 'Language',
    support: 'Contact support',
    faqRequestQ: 'How do I request a repair?',
    faqRequestA: 'Open New request, choose a vessel, and submit up to five photos.',
    faqPayQ: 'How do I pay?',
    faqPayA: 'Open an issued invoice. Pay with Paystack, or upload proof for cash, bank, cheque, card, or M-Pesa.',
    faqTrackQ: 'How do I track progress?',
    faqTrackA: 'The home screen and request detail update live as the yard changes status.',
    recommended: 'Services',
    active: 'Active request',
  },
  SW: {
    saved: 'Imehifadhiwa',
    avatar: 'Picha imesasishwa',
    language: 'Lugha',
    support: 'Wasiliana na msaada',
    faqRequestQ: 'Ninaombaje ukarabati?',
    faqRequestA: 'Fungua ombi jipya, chagua chombo, na weka picha hadi tano.',
    faqPayQ: 'Ninalipaje?',
    faqPayA: 'Fungua ankara. Lipa kwa Paystack, au pakia uthibitisho wa pesa taslimu, benki, hundi, kadi, au M-Pesa.',
    faqTrackQ: 'Ninafuatiliaje maendeleo?',
    faqTrackA: 'Skrini ya nyumbani na maelezo ya ombi hubadilika papo hapo.',
    recommended: 'Huduma',
    active: 'Ombi linaloendelea',
  },
} as const;

export type Language = keyof typeof strings;

export function useLanguage() {
  const [language, setLanguage] = useState<Language>('EN');
  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((value) => {
      if (value === 'SW' || value === 'EN') setLanguage(value);
    });
  }, []);
  const toggle = async () => {
    const next: Language = language === 'EN' ? 'SW' : 'EN';
    setLanguage(next);
    await AsyncStorage.setItem(KEY, next);
  };
  const t = (key: keyof typeof strings.EN) => strings[language][key];
  return { language, toggle, t };
}

export const copy = strings;
