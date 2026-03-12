/**
 * widgetService.ts — Bridge entre React Native et les widgets iOS (WidgetKit)
 *
 * Envoie les données (horaires priere, annonces) vers le UserDefaults partagé
 * via App Groups. Le widget extension SwiftUI lit ces données.
 *
 * Aucun effet si Android ou si le NativeModule n'est pas disponible.
 */

import { NativeModules, Platform } from 'react-native';

const { WidgetBridge } = NativeModules;

/**
 * Met à jour les horaires de prière dans le widget.
 * Appeler depuis HomeScreen quand les horaires sont fetched.
 */
export const updateWidgetPrayerData = (timings: {
  Fajr: string;
  Sunrise?: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  IqamaFajr?: string;
  IqamaDhuhr?: string;
  IqamaAsr?: string;
  IqamaMaghrib?: string;
  IqamaIsha?: string;
  Jumua?: string;
}, hijri?: { day?: string; month?: string; year?: string }): void => {
  if (Platform.OS !== 'ios' || !WidgetBridge) return;

  try {
    WidgetBridge.updatePrayerData({
      fajr: timings.Fajr,
      sunrise: timings.Sunrise || '',
      dhuhr: timings.Dhuhr,
      asr: timings.Asr,
      maghrib: timings.Maghrib,
      isha: timings.Isha,
      iqamaFajr: timings.IqamaFajr || '',
      iqamaDhuhr: timings.IqamaDhuhr || '',
      iqamaAsr: timings.IqamaAsr || '',
      iqamaMaghrib: timings.IqamaMaghrib || '',
      iqamaIsha: timings.IqamaIsha || '',
      jumua: timings.Jumua || '',
      hijriDay: hijri?.day || '',
      hijriMonth: hijri?.month || '',
      hijriYear: hijri?.year || '',
      lastUpdate: new Date().toISOString(),
    });
  } catch {
    // Widget bridge pas disponible — silencieux
  }
};

/**
 * Met à jour les annonces dans le widget.
 */
export const updateWidgetAnnouncements = (announcements: Array<{
  title: string;
  body: string;
  type: string;
}>): void => {
  if (Platform.OS !== 'ios' || !WidgetBridge) return;

  try {
    WidgetBridge.updateAnnouncements(
      announcements.slice(0, 5).map(a => ({
        title: a.title,
        body: a.body,
        type: a.type,
      }))
    );
  } catch {
    // silencieux
  }
};

/**
 * Force le refresh de tous les widgets.
 */
export const reloadAllWidgets = (): void => {
  if (Platform.OS !== 'ios' || !WidgetBridge) return;
  try {
    WidgetBridge.reloadWidgets();
  } catch {
    // silencieux
  }
};
