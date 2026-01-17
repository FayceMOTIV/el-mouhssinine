import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import CompassHeading from 'react-native-compass-heading';
import Clipboard from '@react-native-clipboard/clipboard';
import { colors, spacing, borderRadius, fontSize, HEADER_PADDING_TOP, wp, platformShadow, isSmallScreen } from '../theme/colors';
import { subscribeToMosqueeInfo, requestRecuFiscal } from '../services/firebase';
import { AuthService } from '../services/auth';
import { MosqueeInfo, NotificationSettings } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  requestNotificationPermission,
  scheduleJumuaReminder,
  cancelJumuaReminder,
  isJumuaReminderEnabled,
} from '../services/notifications';
import {
  getPrayerNotificationSettings,
  savePrayerNotificationSettings,
  PrayerNotificationSettings,
  schedulePrayerNotifications,
  cancelAllPrayerNotifications,
  requestNotificationPermission as requestPrayerNotifPermission,
} from '../services/prayerNotifications';
import { PrayerAPI } from '../services/prayerApi';

const MoreScreen = () => {
  const navigation = useNavigation<any>();
  const { language, setLanguage, t, isRTL } = useLanguage();
  const [mosqueeInfo, setMosqueeInfo] = useState<MosqueeInfo>({
    name: 'Mosquée El Mouhssinine',
    address: '123 Rue de la Mosquée',
    city: 'Bourg-en-Bresse',
    postalCode: '01000',
    phone: '04 74 XX XX XX',
    email: 'contact@elmouhssinine.fr',
    website: 'el-mouhssinine.web.app',
    iban: 'FR76 1234 5678 9012 3456 7890 123',
    bic: 'AGRIFRPP',
    bankName: 'Crédit Agricole',
    accountHolder: 'Association El Mouhssinine',
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    enabled: true,
    minutesBefore: 10,
    adhanSound: true,
    jumuaReminder: true,
  });

  const [copied, setCopied] = useState('');
  const [jumuaReminderEnabled, setJumuaReminderEnabled] = useState(false);
  const [prayerNotifSettings, setPrayerNotifSettings] = useState<PrayerNotificationSettings>({
    enabled: true,
    minutesBefore: 15,
    prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  });
  const [compassHeading, setCompassHeading] = useState(0);
  const [compassError, setCompassError] = useState<string | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const qiblaDirection = 119; // Direction Qibla pour Bourg-en-Bresse

  // Reçu fiscal
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() - 1);
  const [sendingRecuFiscal, setSendingRecuFiscal] = useState(false);

  useEffect(() => {
    const unsub = subscribeToMosqueeInfo((info) => {
      if (info) setMosqueeInfo(info);
    });
    return () => unsub?.();
  }, []);

  // Récupérer l'email de l'utilisateur connecté
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged((user) => {
      if (user?.email) {
        setUserEmail(user.email);
      }
    });
    return () => unsubscribe();
  }, []);

  // Initialiser la boussole
  useEffect(() => {
    const degree_update_rate = 3; // Mise à jour toutes les 3 degrés

    CompassHeading.start(degree_update_rate, ({ heading, accuracy }) => {
      setCompassHeading(heading);
      setCompassError(null);

      // Calculer la rotation de l'aiguille vers la Qibla
      // L'aiguille doit pointer vers qiblaDirection depuis le Nord
      // Donc on soustrait le heading actuel pour compenser l'orientation du téléphone
      const qiblaRotation = qiblaDirection - heading;

      Animated.timing(rotateAnim, {
        toValue: qiblaRotation,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }).catch((error: any) => {
      console.error('Compass error:', error);
      setCompassError(language === 'ar' ? 'البوصلة غير متوفرة' : 'Boussole non disponible');
    });

    return () => {
      CompassHeading.stop();
    };
  }, [language, rotateAnim]);

  // Charger l'état du rappel Jumu'a au démarrage
  useEffect(() => {
    isJumuaReminderEnabled().then(setJumuaReminderEnabled);
  }, []);

  // Charger les settings de notifications de priere
  useEffect(() => {
    getPrayerNotificationSettings().then(setPrayerNotifSettings);
  }, []);

  // Mettre a jour les settings de notifications de priere
  const updatePrayerNotifSettings = async (newSettings: PrayerNotificationSettings) => {
    setPrayerNotifSettings(newSettings);
    await savePrayerNotificationSettings(newSettings);

    // Re-scheduler les notifications avec les nouveaux settings
    if (newSettings.enabled) {
      const hasPermission = await requestPrayerNotifPermission();
      if (hasPermission) {
        try {
          const timings = await PrayerAPI.getTimesByCity('Bourg-en-Bresse', 'France');
          await schedulePrayerNotifications(timings, newSettings);
        } catch (error) {
          console.warn('[MoreScreen] Erreur re-scheduling:', error);
        }
      }
    } else {
      await cancelAllPrayerNotifications();
    }
  };

  // Gérer le toggle du rappel Jumu'a
  const handleJumuaToggle = async () => {
    if (!jumuaReminderEnabled) {
      const hasPermission = await requestNotificationPermission();
      if (hasPermission) {
        await scheduleJumuaReminder(language);
        setJumuaReminderEnabled(true);
        Alert.alert(
          language === 'ar' ? 'تم التفعيل' : 'Activé',
          language === 'ar'
            ? 'ستتلقى تذكيراً كل جمعة الساعة 12:30'
            : 'Vous recevrez un rappel chaque vendredi à 12h30'
        );
      } else {
        Alert.alert(
          language === 'ar' ? 'الإذن مطلوب' : 'Permission requise',
          language === 'ar'
            ? 'فعّل الإشعارات في إعدادات هاتفك'
            : 'Activez les notifications dans les réglages de votre téléphone.'
        );
      }
    } else {
      await cancelJumuaReminder();
      setJumuaReminderEnabled(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    Clipboard.setString(text.replace(/\s/g, ''));
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleCall = () => {
    const phoneNumber = mosqueeInfo.phone.replace(/\s/g, '');
    Linking.openURL(`tel:+33${phoneNumber.substring(1)}`);
  };

  const handleEmail = () => {
    Linking.openURL(`mailto:${mosqueeInfo.email}`);
  };

  const handleWebsite = () => {
    Linking.openURL(`https://${mosqueeInfo.website}`);
  };

  // Demander l'envoi du reçu fiscal
  const handleRequestRecuFiscal = async () => {
    if (!userEmail) {
      Alert.alert(
        language === 'ar' ? 'تسجيل الدخول مطلوب' : 'Connexion requise',
        language === 'ar'
          ? 'يرجى تسجيل الدخول لطلب إيصالك الضريبي'
          : 'Veuillez vous connecter pour demander votre reçu fiscal'
      );
      return;
    }

    setSendingRecuFiscal(true);
    try {
      const result = await requestRecuFiscal(userEmail, selectedYear);
      if (result.success) {
        Alert.alert(
          language === 'ar' ? 'تم الإرسال' : 'Envoyé !',
          language === 'ar'
            ? `تم إرسال إيصالك الضريبي بمبلغ ${result.montantTotal?.toFixed(2)}€ إلى ${userEmail}`
            : `Votre reçu fiscal de ${result.montantTotal?.toFixed(2)}€ a été envoyé à ${userEmail}`
        );
      } else {
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Erreur',
          result.message
        );
      }
    } catch (error: any) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Erreur',
        error.message || (language === 'ar' ? 'حدث خطأ' : 'Une erreur est survenue')
      );
    } finally {
      setSendingRecuFiscal(false);
    }
  };

  const Switch = ({ active, onToggle }: { active: boolean; onToggle: () => void }) => (
    <TouchableOpacity
      onPress={onToggle}
      style={[styles.switch, active && styles.switchActive]}
    >
      <View style={[styles.switchKnob, active && styles.switchKnobActive]} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, isRTL && styles.textRTL]}>{t('more')}</Text>
        </View>

        <View style={styles.content}>
          {/* Direction Qibla */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>🧭 {t('qiblaDirection')}</Text>
            <View style={styles.qiblaCard}>
              {/* Titre Direction de La Mecque */}
              <Text style={styles.qiblaMainTitle}>
                {language === 'ar' ? 'اتجاه مكة المكرمة' : 'Direction de La Mecque'}
              </Text>
              <Text style={styles.kaaba}>🕋</Text>

              {compassError ? (
                <View style={styles.compassErrorContainer}>
                  <Text style={styles.compassErrorIcon}>🧭</Text>
                  <Text style={styles.compassErrorText}>{compassError}</Text>
                </View>
              ) : (
                <>
                  {/* Grande boussole améliorée */}
                  <View style={styles.compass}>
                    <View style={styles.compassRing}>
                      {/* Points cardinaux plus visibles */}
                      <Text style={[styles.cardinal, styles.cardinalN]}>N</Text>
                      <Text style={[styles.cardinal, styles.cardinalS]}>S</Text>
                      <Text style={[styles.cardinal, styles.cardinalE]}>E</Text>
                      <Text style={[styles.cardinal, styles.cardinalO]}>O</Text>

                      {/* Grande flèche dorée animée vers la Qibla */}
                      <Animated.View style={[
                        styles.needle,
                        {
                          transform: [{
                            rotate: rotateAnim.interpolate({
                              inputRange: [-360, 360],
                              outputRange: ['-360deg', '360deg'],
                            })
                          }]
                        }
                      ]}>
                        <View style={styles.needlePointer}>
                          <Text style={styles.arrowEmoji}>▲</Text>
                        </View>
                        <View style={styles.needleLine} />
                      </Animated.View>

                      {/* Centre de la boussole */}
                      <View style={styles.compassCenter} />
                    </View>
                  </View>

                  {/* Indicateur d'alignement */}
                  <View style={[
                    styles.alignmentIndicator,
                    Math.abs((compassHeading - qiblaDirection + 360) % 360) < 15 && styles.alignmentIndicatorAligned
                  ]}>
                    <Text style={styles.alignmentText}>
                      {Math.abs((compassHeading - qiblaDirection + 360) % 360) < 15
                        ? (language === 'ar' ? '✓ أنت على القبلة!' : '✓ Vous êtes aligné!')
                        : (language === 'ar' ? 'وجّه الهاتف نحو القبلة' : 'Tournez vers la Qibla')}
                    </Text>
                  </View>
                </>
              )}

              {/* Direction en degrés */}
              <View style={styles.qiblaDegreesContainer}>
                <Text style={styles.qiblaDegreesValue}>{qiblaDirection}°</Text>
                <Text style={styles.qiblaDegreesLabel}>{t('southEast')}</Text>
              </View>

              <Text style={[styles.qiblaCity, isRTL && styles.textRTL]}>
                📍 {t('qiblaDirectionFrom')} {mosqueeInfo.city}
              </Text>
            </View>
          </View>

          {/* RIB Mosquée */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>🏦 {t('bankDetails')}</Text>
            <View style={styles.card}>
              <View style={styles.ribHeader}>
                <Text style={styles.ribIcon}>🕌</Text>
                <Text style={styles.ribTitulaire}>{mosqueeInfo.accountHolder}</Text>
                <Text style={styles.ribBanque}>{mosqueeInfo.bankName}</Text>
              </View>

              <View style={styles.ribRow}>
                <View style={styles.ribInfo}>
                  <Text style={styles.ribLabel}>IBAN</Text>
                  <Text style={styles.ribValue}>{mosqueeInfo.iban}</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(mosqueeInfo.iban, 'iban')}
                >
                  <Text style={styles.copyBtnText}>{copied === 'iban' ? '✓' : '📋'}</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.ribRow, styles.ribRowLast]}>
                <View style={styles.ribInfo}>
                  <Text style={styles.ribLabel}>BIC</Text>
                  <Text style={styles.ribValue}>{mosqueeInfo.bic}</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(mosqueeInfo.bic, 'bic')}
                >
                  <Text style={styles.copyBtnText}>{copied === 'bic' ? '✓' : '📋'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Infos Mosquée */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>📍 {t('information')}</Text>
            <View style={styles.card}>
              {/* Adresse */}
              <View style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <Text style={styles.infoIcon}>📍</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('address')}</Text>
                    <Text style={styles.infoValue}>
                      {mosqueeInfo.address}, {mosqueeInfo.postalCode} {mosqueeInfo.city}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.copyBtnSmall}
                  onPress={() => copyToClipboard(
                    `${mosqueeInfo.address}, ${mosqueeInfo.postalCode} ${mosqueeInfo.city}`,
                    'adresse'
                  )}
                >
                  <Text style={styles.copyBtnSmallText}>{copied === 'adresse' ? '✓' : '📋'}</Text>
                </TouchableOpacity>
              </View>

              {/* Téléphone */}
              <TouchableOpacity style={styles.infoRow} onPress={handleCall}>
                <View style={styles.infoLeft}>
                  <Text style={styles.infoIcon}>📞</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('phone')}</Text>
                    <Text style={[styles.infoValue, styles.infoValueLink]}>{mosqueeInfo.phone}</Text>
                  </View>
                </View>
                <Text style={styles.infoArrow}>→</Text>
              </TouchableOpacity>

              {/* Email */}
              <TouchableOpacity style={styles.infoRow} onPress={handleEmail}>
                <View style={styles.infoLeft}>
                  <Text style={styles.infoIcon}>✉️</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('email')}</Text>
                    <Text style={[styles.infoValue, styles.infoValueLink]}>{mosqueeInfo.email}</Text>
                  </View>
                </View>
                <Text style={styles.infoArrow}>→</Text>
              </TouchableOpacity>

              {/* Site web */}
              <TouchableOpacity style={styles.infoRow} onPress={handleWebsite}>
                <View style={styles.infoLeft}>
                  <Text style={styles.infoIcon}>🌐</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('website')}</Text>
                    <Text style={[styles.infoValue, styles.infoValueLink]}>{mosqueeInfo.website}</Text>
                  </View>
                </View>
                <Text style={styles.infoArrow}>→</Text>
              </TouchableOpacity>

              {/* Contacter la mosquée */}
              <TouchableOpacity
                style={[styles.infoRow, styles.infoRowLast]}
                onPress={() => navigation.navigate('Messages')}
              >
                <View style={styles.infoLeft}>
                  <Text style={styles.infoIcon}>💬</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>
                      {language === 'ar' ? 'راسلنا' : 'Nous contacter'}
                    </Text>
                    <Text style={[styles.infoValue, styles.infoValueLink]}>
                      {language === 'ar' ? 'إرسال رسالة للمسجد' : 'Envoyer un message'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.infoArrow}>→</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notifications de priere locales */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>🔔 {t('prayerNotifications')}</Text>
            <View style={styles.card}>
              {/* Toggle principal */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Text style={styles.settingIcon}>🔔</Text>
                  <Text style={styles.settingLabel}>{t('enableReminders')}</Text>
                </View>
                <Switch
                  active={prayerNotifSettings.enabled}
                  onToggle={() => updatePrayerNotifSettings({
                    ...prayerNotifSettings,
                    enabled: !prayerNotifSettings.enabled
                  })}
                />
              </View>

              {prayerNotifSettings.enabled && (
                <>
                  {/* Minutes avant */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Text style={styles.settingIcon}>⏱️</Text>
                      <Text style={styles.settingLabel}>{t('reminderBefore')}</Text>
                    </View>
                    <View style={styles.picker}>
                      {[5, 10, 15, 30].map((min) => (
                        <TouchableOpacity
                          key={min}
                          style={[
                            styles.pickerOption,
                            prayerNotifSettings.minutesBefore === min && styles.pickerOptionActive
                          ]}
                          onPress={() => updatePrayerNotifSettings({
                            ...prayerNotifSettings,
                            minutesBefore: min
                          })}
                        >
                          <Text style={[
                            styles.pickerOptionText,
                            prayerNotifSettings.minutesBefore === min && styles.pickerOptionTextActive
                          ]}>
                            {min}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <Text style={styles.pickerUnit}>min</Text>
                    </View>
                  </View>

                  {/* Toggles par priere */}
                  <View style={styles.prayerTogglesSection}>
                    <Text style={[styles.prayerTogglesTitle, isRTL && styles.textRTL]}>
                      {language === 'ar' ? 'اختر الصلوات للتذكير' : 'Prieres a rappeler'}
                    </Text>
                    {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((prayer, index, arr) => {
                      const prayerIcons: Record<string, string> = {
                        fajr: '🌅',
                        dhuhr: '☀️',
                        asr: '🌤️',
                        maghrib: '🌅',
                        isha: '🌙',
                      };
                      const prayerNames: Record<string, { fr: string; ar: string }> = {
                        fajr: { fr: 'Fajr', ar: 'الفجر' },
                        dhuhr: { fr: 'Dhuhr', ar: 'الظهر' },
                        asr: { fr: 'Asr', ar: 'العصر' },
                        maghrib: { fr: 'Maghrib', ar: 'المغرب' },
                        isha: { fr: 'Isha', ar: 'العشاء' },
                      };
                      return (
                        <View
                          key={prayer}
                          style={[
                            styles.prayerToggleRow,
                            index === arr.length - 1 && styles.prayerToggleRowLast
                          ]}
                        >
                          <View style={styles.settingLeft}>
                            <Text style={styles.settingIcon}>{prayerIcons[prayer]}</Text>
                            <Text style={styles.settingLabel}>
                              {language === 'ar' ? prayerNames[prayer].ar : prayerNames[prayer].fr}
                            </Text>
                          </View>
                          <Switch
                            active={prayerNotifSettings.prayers[prayer]}
                            onToggle={() => updatePrayerNotifSettings({
                              ...prayerNotifSettings,
                              prayers: {
                                ...prayerNotifSettings.prayers,
                                [prayer]: !prayerNotifSettings.prayers[prayer]
                              }
                            })}
                          />
                        </View>
                      );
                    })}
                  </View>

                  {/* Note explicative */}
                  <View style={styles.prayerNotifNote}>
                    <Text style={styles.prayerNotifNoteText}>
                      {language === 'ar'
                        ? '💡 افتح التطبيق مرة واحدة في الأسبوع لمواصلة تلقي التذكيرات'
                        : '💡 Ouvrez l\'app au moins 1 fois par semaine pour continuer à recevoir les rappels'}
                    </Text>
                  </View>

                  {/* Rappel Jumu'a */}
                  <View style={[styles.settingRow, styles.settingRowLast]}>
                    <View style={styles.settingLeft}>
                      <Text style={styles.settingIcon}>🕌</Text>
                      <Text style={styles.settingLabel}>{t('jumuaFriday')}</Text>
                    </View>
                    <Switch
                      active={jumuaReminderEnabled}
                      onToggle={handleJumuaToggle}
                    />
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Reçu Fiscal */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              📄 {language === 'ar' ? 'الإيصال الضريبي' : 'Reçu fiscal'}
            </Text>
            <View style={styles.card}>
              <Text style={[styles.recuFiscalInfo, isRTL && styles.textRTL]}>
                {language === 'ar'
                  ? 'احصل على إيصالك الضريبي السنوي لتخفيض ضرائبك بنسبة 66%'
                  : 'Recevez votre reçu fiscal annuel pour déduire 66% de vos dons de vos impôts'}
              </Text>

              {/* Sélecteur d'année */}
              <View style={styles.yearSelector}>
                <Text style={styles.yearLabel}>
                  {language === 'ar' ? 'السنة:' : 'Année :'}
                </Text>
                <View style={styles.yearButtons}>
                  {[...Array(3)].map((_, i) => {
                    const year = new Date().getFullYear() - 1 - i;
                    return (
                      <TouchableOpacity
                        key={year}
                        style={[
                          styles.yearButton,
                          selectedYear === year && styles.yearButtonActive
                        ]}
                        onPress={() => setSelectedYear(year)}
                      >
                        <Text style={[
                          styles.yearButtonText,
                          selectedYear === year && styles.yearButtonTextActive
                        ]}>
                          {year}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Bouton envoyer */}
              <TouchableOpacity
                style={[
                  styles.recuFiscalButton,
                  (!userEmail || sendingRecuFiscal) && styles.recuFiscalButtonDisabled
                ]}
                onPress={handleRequestRecuFiscal}
                disabled={!userEmail || sendingRecuFiscal}
              >
                {sendingRecuFiscal ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={styles.recuFiscalButtonIcon}>📧</Text>
                    <Text style={styles.recuFiscalButtonText}>
                      {language === 'ar'
                        ? 'إرسال الإيصال عبر البريد الإلكتروني'
                        : 'Recevoir par email'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {!userEmail && (
                <Text style={styles.recuFiscalWarning}>
                  {language === 'ar'
                    ? 'يرجى تسجيل الدخول أولاً'
                    : 'Connectez-vous pour recevoir votre reçu'}
                </Text>
              )}
            </View>
          </View>

          {/* Langue */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🌐 {t('language')}</Text>
            <View style={styles.card}>
              <View style={styles.languageSelector}>
                <TouchableOpacity
                  style={[
                    styles.languageOption,
                    language === 'fr' && styles.languageOptionActive
                  ]}
                  onPress={() => setLanguage('fr')}
                >
                  <Text style={styles.languageFlag}>🇫🇷</Text>
                  <Text style={[
                    styles.languageText,
                    language === 'fr' && styles.languageTextActive
                  ]}>
                    {t('french')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.languageOption,
                    language === 'ar' && styles.languageOptionActive
                  ]}
                  onPress={() => setLanguage('ar')}
                >
                  <Text style={styles.languageFlag}>🇸🇦</Text>
                  <Text style={[
                    styles.languageText,
                    language === 'ar' && styles.languageTextActive
                  ]}>
                    {t('arabic')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Version */}
          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>{t('version')} 1.0.0</Text>
            <Text style={styles.copyrightText}>© 2026 El Mouhssinine</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: HEADER_PADDING_TOP,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.accent,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  // Qibla - Design amélioré
  qiblaCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.3)',
  },
  qiblaMainTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  kaaba: {
    fontSize: 40,
    marginBottom: spacing.lg,
  },
  compass: {
    width: wp(55),
    height: wp(55),
    minWidth: 180,
    maxWidth: 280,
    aspectRatio: 1,
    marginBottom: spacing.lg,
  },
  compassRing: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 6,
    borderColor: colors.accent,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,162,39,0.08)',
  },
  cardinal: {
    position: 'absolute',
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  cardinalN: { top: 12 },
  cardinalS: { bottom: 12 },
  cardinalE: { right: 12 },
  cardinalO: { left: 12 },
  needle: {
    position: 'absolute',
    width: 40,
    height: 90,
    alignItems: 'center',
  },
  needlePointer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowEmoji: {
    fontSize: 48,
    color: colors.accent,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  needleLine: {
    width: 4,
    height: 30,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  compassCenter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  alignmentIndicator: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  alignmentIndicatorAligned: {
    backgroundColor: 'rgba(76,175,80,0.3)',
  },
  alignmentText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  qiblaDegreesContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  qiblaDegreesValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: colors.accent,
  },
  qiblaDegreesLabel: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  qiblaCity: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  compassErrorContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  compassErrorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
    opacity: 0.5,
  },
  compassErrorText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  // RIB
  ribHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  ribIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  ribTitulaire: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.accent,
  },
  ribBanque: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  ribRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  ribRowLast: {
    borderBottomWidth: 0,
  },
  ribInfo: {},
  ribLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  ribValue: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  copyBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  copyBtnText: {
    fontSize: fontSize.sm,
    color: '#ffffff',
    fontWeight: '600',
  },
  // Info
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  infoValueLink: {
    color: colors.accent,
  },
  infoArrow: {
    fontSize: fontSize.lg,
    color: colors.accent,
  },
  copyBtnSmall: {
    backgroundColor: 'rgba(201,162,39,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  copyBtnSmallText: {
    fontSize: fontSize.xs,
    color: colors.accent,
  },
  // Settings
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
  },
  settingIcon: {
    fontSize: isSmallScreen ? 14 : 18,
    marginRight: isSmallScreen ? spacing.sm : spacing.md,
  },
  settingLabel: {
    fontSize: isSmallScreen ? fontSize.sm : fontSize.md,
    color: colors.text,
    flexShrink: 1,
  },
  // Switch
  switch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    padding: 2,
  },
  switchActive: {
    backgroundColor: colors.accent,
  },
  switchKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    ...platformShadow(2),
  },
  switchKnobActive: {
    alignSelf: 'flex-end',
  },
  // Picker
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f5',
    borderRadius: borderRadius.sm,
    padding: isSmallScreen ? 2 : 4,
    flexShrink: 0,
  },
  pickerOption: {
    paddingHorizontal: isSmallScreen ? 6 : spacing.sm,
    paddingVertical: isSmallScreen ? 3 : spacing.xs,
    borderRadius: borderRadius.sm,
    minWidth: isSmallScreen ? 24 : 28,
    alignItems: 'center',
  },
  pickerOptionActive: {
    backgroundColor: colors.accent,
  },
  pickerOptionText: {
    fontSize: isSmallScreen ? 11 : fontSize.sm,
    color: colors.textMuted,
    fontWeight: '600',
  },
  pickerOptionTextActive: {
    color: '#ffffff',
  },
  pickerUnit: {
    fontSize: isSmallScreen ? 10 : fontSize.sm,
    color: colors.textMuted,
    marginLeft: isSmallScreen ? 2 : spacing.xs,
  },
  // Prayer toggles
  prayerTogglesSection: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  prayerTogglesTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  prayerToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  prayerToggleRowLast: {
    borderBottomWidth: 0,
  },
  prayerNotifNote: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  prayerNotifNoteText: {
    fontSize: fontSize.xs,
    color: '#FFC107',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Version
  versionContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  versionText: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.5)',
  },
  copyrightText: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  // Language selector
  languageSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  languageOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  languageOptionActive: {
    backgroundColor: 'rgba(201,162,39,0.15)',
    borderColor: colors.accent,
  },
  languageFlag: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  languageText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textMuted,
  },
  languageTextActive: {
    color: colors.accent,
  },
  // RTL support
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  // Reçu fiscal
  recuFiscalInfo: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  yearLabel: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  yearButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  yearButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  yearButtonActive: {
    backgroundColor: 'rgba(201,162,39,0.2)',
    borderColor: colors.accent,
  },
  yearButtonText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '600',
  },
  yearButtonTextActive: {
    color: colors.accent,
  },
  recuFiscalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  recuFiscalButtonDisabled: {
    backgroundColor: 'rgba(201,162,39,0.4)',
  },
  recuFiscalButtonIcon: {
    fontSize: 18,
  },
  recuFiscalButtonText: {
    fontSize: fontSize.md,
    color: '#ffffff',
    fontWeight: '600',
  },
  recuFiscalWarning: {
    fontSize: fontSize.sm,
    color: '#FFA726',
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

export default MoreScreen;
