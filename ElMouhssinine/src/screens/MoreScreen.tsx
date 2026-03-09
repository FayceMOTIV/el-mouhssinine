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
  PermissionsAndroid,
} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import Geolocation from '@react-native-community/geolocation';
import { useNavigation } from '@react-navigation/native';
import CompassHeading from 'react-native-compass-heading';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  HEADER_PADDING_TOP,
  wp,
  platformShadow,
  isSmallScreen,
} from '../theme/colors';
import {
  subscribeToMosqueeInfo,
  subscribeToRamadanSettings,
  RamadanSettings,
  deleteMyAccount,
} from '../services/firebase';
import { AuthService } from '../services/auth';
import firebase from '@react-native-firebase/app';
import '@react-native-firebase/functions';
import { MosqueeInfo } from '../types';
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
  // Boost Prière
  PrayerBoostSettings,
  DEFAULT_PRAYER_BOOST_SETTINGS,
  getBoostSettings,
  saveBoostSettings,
  scheduleBoostNotifications,
  cancelBoostNotifications,
  // Rappel Coran
  QuranReminderSettings,
  DEFAULT_QURAN_REMINDER_SETTINGS,
  getQuranReminderSettings,
  saveQuranReminderSettings,
  scheduleQuranReminders,
  cancelQuranReminders,
  // Proximité Mosquée (mode silencieux)
  MosqueProximitySettings,
  DEFAULT_MOSQUE_PROXIMITY_SETTINGS,
  getMosqueProximitySettings,
  saveMosqueProximitySettings,
  // Notifications Ramadan
  RamadanUserNotificationSettings,
  DEFAULT_RAMADAN_NOTIFICATION_SETTINGS,
  getRamadanNotificationSettings,
  saveRamadanNotificationSettings,
  scheduleRamadanNotifications,
  cancelRamadanNotifications,
} from '../services/prayerNotifications';
import {
  initBackgroundLocation,
  stopBackgroundLocation,
} from '../services/backgroundLocation';
import { PrayerAPI } from '../services/prayerApi';

// @ts-ignore - Import version from package.json
import { version as appVersion } from '../../package.json';
import { BackgroundPattern } from '../components/BackgroundPattern';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MoreScreen = () => {
  const navigation = useNavigation<any>();
  const { language, setLanguage, t, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  // BUG 8 FIX: Pas de faux IBAN/données en fallback - valeurs vides par défaut
  const [mosqueeInfo, setMosqueeInfo] = useState<MosqueeInfo>({
    name: 'Mosquée El Mohsinine',
    address: '',
    city: 'Bourg-en-Bresse',
    postalCode: '01000',
    phone: '',
    email: 'centreculturelislamique@orange.fr',
    website: 'el-mouhssinine.web.app',
    iban: '',
    bic: '',
    bankName: '',
    accountHolder: 'Association El Mohsinine',
  });

  const [copied, setCopied] = useState('');
  const [jumuaReminderEnabled, setJumuaReminderEnabled] = useState(false);
  const [prayerNotifSettings, setPrayerNotifSettings] =
    useState<PrayerNotificationSettings>({
      enabled: true,
      minutesBefore: 15,
      prayers: {
        fajr: true,
        dhuhr: true,
        asr: true,
        maghrib: true,
        isha: true,
      },
    });

  // Boost Prière (feature optionnelle)
  const [boostSettings, setBoostSettings] = useState<PrayerBoostSettings>(
    DEFAULT_PRAYER_BOOST_SETTINGS,
  );
  // Rappel Coran
  const [quranReminderSettings, setQuranReminderSettings] =
    useState<QuranReminderSettings>(DEFAULT_QURAN_REMINDER_SETTINGS);
  // Proximité Mosquée (mode silencieux)
  const [mosqueProximitySettings, setMosqueProximitySettings] =
    useState<MosqueProximitySettings>(DEFAULT_MOSQUE_PROXIMITY_SETTINGS);
  // Notifications Ramadan
  const [ramadanNotifSettings, setRamadanNotifSettings] =
    useState<RamadanUserNotificationSettings>(
      DEFAULT_RAMADAN_NOTIFICATION_SETTINGS,
    );
  const [ramadanSettings, setRamadanSettings] =
    useState<RamadanSettings | null>(null);
  const [compassHeading, setCompassHeading] = useState(0);
  const [compassError, setCompassError] = useState<string | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const qiblaDirection = 119; // Direction Qibla pour Bourg-en-Bresse

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [pushDenied, setPushDenied] = useState(false);

  // S15: Vérifier permission notifications push
  useEffect(() => {
    const checkPushPermission = async () => {
      try {
        const authStatus = await messaging().hasPermission();
        if (authStatus === messaging.AuthorizationStatus.DENIED) {
          setPushDenied(true);
        } else if (authStatus === messaging.AuthorizationStatus.NOT_DETERMINED) {
          const result = await messaging().requestPermission();
          if (result === messaging.AuthorizationStatus.DENIED) {
            setPushDenied(true);
          }
        }
      } catch (err) {
        console.log('Push permission check error:', err);
      }
    };
    checkPushPermission();
  }, []);

  useEffect(() => {
    const unsub = subscribeToMosqueeInfo(info => {
      if (info) setMosqueeInfo(info);
    });
    return () => unsub?.();
  }, []);

  // Récupérer l'email de l'utilisateur connecté
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(user => {
      if (user?.email) {
        setUserEmail(user.email);
      }
    });
    return () => unsubscribe();
  }, []);

  // Initialiser la boussole
  useEffect(() => {
    const degree_update_rate = 3; // Mise à jour toutes les 3 degrés

    CompassHeading.start(
      degree_update_rate,
      ({ heading, accuracy }: { heading: number; accuracy: number }) => {
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
      },
    ).catch((error: any) => {
      console.error('Compass error:', error);
      setCompassError(
        language === 'ar' ? 'البوصلة غير متوفرة' : 'Boussole non disponible',
      );
    });

    return () => {
      CompassHeading.stop();
    };
  }, [rotateAnim]);

  // Charger l'état du rappel Jumu'a au démarrage
  useEffect(() => {
    isJumuaReminderEnabled().then(setJumuaReminderEnabled);
  }, []);

  // Charger les settings de notifications de priere
  useEffect(() => {
    getPrayerNotificationSettings().then(setPrayerNotifSettings);
  }, []);

  // Charger les settings boost
  useEffect(() => {
    getBoostSettings().then(setBoostSettings);
  }, []);

  // Charger les settings rappel Coran
  useEffect(() => {
    getQuranReminderSettings().then(setQuranReminderSettings);
  }, []);

  // Charger les settings proximité mosquée
  useEffect(() => {
    getMosqueProximitySettings().then(setMosqueProximitySettings);
  }, []);

  // Charger les settings notifications Ramadan
  useEffect(() => {
    getRamadanNotificationSettings().then(setRamadanNotifSettings);
  }, []);

  // S'abonner aux settings Ramadan (pour savoir si le mode est actif)
  useEffect(() => {
    const unsubscribe = subscribeToRamadanSettings(settings => {
      setRamadanSettings(settings);
    });
    return () => unsubscribe();
  }, []);

  // Mettre a jour les settings de notifications de priere
  const updatePrayerNotifSettings = async (
    newSettings: PrayerNotificationSettings,
  ) => {
    setPrayerNotifSettings(newSettings);
    await savePrayerNotificationSettings(newSettings);

    // Re-scheduler les notifications avec les nouveaux settings
    if (newSettings.enabled) {
      const hasPermission = await requestPrayerNotifPermission();
      if (hasPermission) {
        try {
          const timings = await PrayerAPI.getTimesByCity(
            'Bourg-en-Bresse',
            'France',
          );
          await schedulePrayerNotifications(timings, newSettings);
        } catch (error) {
          console.warn('[MoreScreen] Erreur re-scheduling:', error);
        }
      }
    } else {
      await cancelAllPrayerNotifications();
    }
  };

  // Mettre à jour les settings boost
  const updateBoostSettings = async (newSettings: PrayerBoostSettings) => {
    setBoostSettings(newSettings);
    await saveBoostSettings(newSettings);

    // Re-scheduler les notifications boost
    if (newSettings.enabled) {
      const hasPermission = await requestPrayerNotifPermission();
      if (hasPermission) {
        try {
          const timings = await PrayerAPI.getTimesByCity(
            'Bourg-en-Bresse',
            'France',
          );
          const translations = {
            reminderTitle: t('boostReminderTitle'),
            urgentTitle: t('boostUrgentTitle'),
            after30min: t('boostAfter30min'),
            midTime: t('boostMidTime'),
            before15min: t('boostBefore15min'),
          };
          await scheduleBoostNotifications(timings, newSettings, translations);
        } catch (error) {
          console.warn('[MoreScreen] Erreur boost scheduling:', error);
        }
      }
    } else {
      await cancelBoostNotifications();
    }
  };

  // Mettre à jour les settings rappel Coran
  const updateQuranReminderSettings = async (
    newSettings: QuranReminderSettings,
  ) => {
    setQuranReminderSettings(newSettings);
    await saveQuranReminderSettings(newSettings);

    // Re-scheduler les notifications
    if (newSettings.enabled) {
      const hasPermission = await requestPrayerNotifPermission();
      if (hasPermission) {
        const translations = {
          title: language === 'ar' ? '📖 وقت القراءة' : '📖 Rappel Coran',
          body:
            language === 'ar'
              ? 'حان وقت قراءة القرآن - ولو صفحة واحدة 🌙'
              : "C'est l'heure de lire le Coran - même une page 🌙",
        };
        await scheduleQuranReminders(newSettings, translations);
      }
    } else {
      await cancelQuranReminders();
    }
  };

  // Mettre à jour les settings notifications Ramadan
  const updateRamadanNotifSettings = async (
    newSettings: RamadanUserNotificationSettings,
  ) => {
    setRamadanNotifSettings(newSettings);
    await saveRamadanNotificationSettings(newSettings);

    // Re-scheduler les notifications si au moins une est activée
    const anyEnabled =
      newSettings.suhoor.enabled ||
      newSettings.iftar.enabled ||
      newSettings.tarawih.enabled;

    if (anyEnabled && ramadanSettings?.enabled) {
      const hasPermission = await requestPrayerNotifPermission();
      if (hasPermission) {
        try {
          const timings = await PrayerAPI.getTimesByCity(
            'Bourg-en-Bresse',
            'France',
          );
          const translations = {
            suhoorTitle: language === 'ar' ? '🌙 السحور' : '🌙 Suhoor',
            suhoorBody:
              language === 'ar'
                ? 'بقي {minutes} دقيقة على الفجر - استعد للصيام'
                : 'Plus que {minutes} min avant Fajr - Préparez-vous',
            iftarTitle: language === 'ar' ? '🌅 الإفطار' : '🌅 Iftar',
            iftarBody:
              language === 'ar'
                ? 'وقت الإفطار في {minutes} دقيقة'
                : 'Iftar dans {minutes} min',
            tarawihTitle: language === 'ar' ? '🕌 التراويح' : '🕌 Tarawih',
            tarawihBody:
              language === 'ar'
                ? 'صلاة التراويح في {minutes} دقيقة'
                : 'Prière Tarawih dans {minutes} min',
          };
          await scheduleRamadanNotifications(
            timings,
            ramadanSettings.tarawihTime,
            newSettings,
            translations,
          );
        } catch (error) {
          console.warn('[MoreScreen] Erreur Ramadan scheduling:', error);
        }
      }
    } else {
      await cancelRamadanNotifications();
    }
  };

  // Demander la permission de localisation avec explication
  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'ios') {
        // iOS - demander l'autorisation "always" pour le background
        return new Promise(resolve => {
          Geolocation.requestAuthorization(
            () => {},
            err => {
              if (__DEV__) console.log('[MoreScreen] Auth error:', err);
            },
          );
          // Sur iOS, on teste si la permission est accordée en essayant d'obtenir la position
          setTimeout(() => {
            Geolocation.getCurrentPosition(
              () => resolve(true),
              error => {
                console.log('[Location] iOS permission error:', error.code);
                if (error.code === 1) {
                  // PERMISSION_DENIED
                  resolve(false);
                } else {
                  resolve(true); // Autre erreur, mais permission OK
                }
              },
              { timeout: 5000, maximumAge: 60000 },
            );
          }, 1000); // Attendre 1s que l'utilisateur réponde à la popup iOS
        });
      } else {
        // Android - demander FINE_LOCATION d'abord
        const fineGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title:
              language === 'ar' ? 'إذن الموقع' : 'Permission de localisation',
            message:
              language === 'ar'
                ? 'التطبيق يحتاج إلى موقعك لإرسال تذكير عندما تكون قريبًا من المسجد.'
                : "L'application a besoin de votre position pour vous envoyer un rappel quand vous êtes proche de la mosquée.",
            buttonNeutral: language === 'ar' ? 'اسألني لاحقًا' : 'Plus tard',
            buttonNegative: language === 'ar' ? 'رفض' : 'Refuser',
            buttonPositive: language === 'ar' ? 'موافق' : 'Autoriser',
          },
        );

        if (fineGranted !== PermissionsAndroid.RESULTS.GRANTED) {
          return false;
        }

        // Android 10+ (API 29+) - demander aussi ACCESS_BACKGROUND_LOCATION
        if (typeof Platform.Version === 'number' && Platform.Version >= 29) {
          const bgGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
            {
              title:
                language === 'ar'
                  ? 'إذن الموقع في الخلفية'
                  : 'Localisation en arrière-plan',
              message:
                language === 'ar'
                  ? 'للحصول على تذكير حتى عندما يكون التطبيق مغلقًا، يرجى السماح بـ "السماح طوال الوقت".'
                  : 'Pour recevoir le rappel même quand l\'app est fermée, veuillez autoriser "Toujours".',
              buttonNeutral: language === 'ar' ? 'اسألني لاحقًا' : 'Plus tard',
              buttonNegative: language === 'ar' ? 'رفض' : 'Refuser',
              buttonPositive: language === 'ar' ? 'موافق' : 'Autoriser',
            },
          );
          return bgGranted === PermissionsAndroid.RESULTS.GRANTED;
        }

        return true;
      }
    } catch (error) {
      console.error('[Location] Permission error:', error);
      return false;
    }
  };

  // Mettre à jour les settings proximité mosquée avec demande de permission
  const updateMosqueProximitySettings = async (
    newSettings: MosqueProximitySettings,
  ) => {
    // Si on active la feature, demander la permission d'abord
    if (newSettings.enabled && !mosqueProximitySettings.enabled) {
      // Afficher explication avant de demander
      Alert.alert(
        `📍 ${t('geolocation')}`,
        language === 'ar'
          ? 'هذه الميزة ترسل لك تذكيرًا عندما تكون على بعد 100 متر من المسجد لوضع هاتفك في الوضع الصامت.\n\n⚠️ تحتاج إلى إذن "دائمًا" للعمل في الخلفية.'
          : 'Cette fonctionnalité vous enverra un rappel quand vous serez à moins de 100m de la mosquée.\n\n⚠️ Nécessite la permission "Toujours" pour fonctionner en arrière-plan.',
        [
          {
            text: t('commonCancel'),
            style: 'cancel',
          },
          {
            text: t('activated'),
            onPress: async () => {
              const hasPermission = await requestLocationPermission();
              if (hasPermission) {
                setMosqueProximitySettings(newSettings);
                await saveMosqueProximitySettings(newSettings);
                // IMPORTANT: Démarrer le service de localisation en arrière-plan
                await initBackgroundLocation();
                Alert.alert(
                  `✅ ${t('activated')}`,
                  language === 'ar'
                    ? 'ستتلقى تذكيرًا عند اقترابك من المسجد (حتى عندما يكون التطبيق مغلقًا)'
                    : 'Vous recevrez un rappel quand vous approcherez de la mosquée (même app fermée)',
                );
              } else {
                Alert.alert(
                  `❌ ${t('permissionDenied')}`,
                  language === 'ar'
                    ? 'يرجى تفعيل الموقع "دائمًا" في إعدادات هاتفك لاستخدام هذه الميزة'
                    : 'Veuillez autoriser la localisation "Toujours" dans les paramètres pour utiliser cette fonctionnalité',
                );
              }
            },
          },
        ],
      );
    } else if (!newSettings.enabled && mosqueProximitySettings.enabled) {
      // Désactivation - arrêter le service background
      setMosqueProximitySettings(newSettings);
      await saveMosqueProximitySettings(newSettings);
      await stopBackgroundLocation();
    } else {
      setMosqueProximitySettings(newSettings);
      await saveMosqueProximitySettings(newSettings);
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
          t('activated'),
          language === 'ar'
            ? 'ستتلقى تذكيراً كل جمعة الساعة 12:30'
            : 'Vous recevrez un rappel chaque vendredi à 12h30',
        );
      } else {
        Alert.alert(
          t('permissionRequired'),
          language === 'ar'
            ? 'فعّل الإشعارات في إعدادات هاتفك'
            : 'Activez les notifications dans les réglages de votre téléphone.',
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

  const Switch = ({
    active,
    onToggle,
  }: {
    active: boolean;
    onToggle: () => void;
  }) => (
    <TouchableOpacity
      onPress={onToggle}
      style={[styles.switch, active && styles.switchActive]}
    >
      <View style={[styles.switchKnob, active && styles.switchKnobActive]} />
    </TouchableOpacity>
  );

  return (
    <BackgroundPattern>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ paddingBottom: insets.bottom }}
      >
        <View style={styles.header}>
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {t('more')}
          </Text>
        </View>

        <View style={styles.content}>
          {/* S15: Bannière notifications désactivées */}
          {pushDenied && (
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              style={{
                backgroundColor: '#ff980020',
                borderWidth: 1,
                borderColor: '#ff980050',
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 22 }}>🔔</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ff9800', fontWeight: '700', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }}>
                  {language === 'ar' ? 'الإشعارات معطلة' : 'Notifications désactivées'}
                </Text>
                <Text style={{ color: '#ffffff90', fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>
                  {language === 'ar' ? 'اضغط لتفعيلها من الإعدادات' : 'Appuyez pour les activer dans les Réglages'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Direction Qibla */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              🧭 {t('qiblaDirection')}
            </Text>
            <View style={styles.qiblaCard}>
              {/* Titre Direction de La Mecque */}
              <Text style={styles.qiblaMainTitle}>
                {language === 'ar'
                  ? 'اتجاه مكة المكرمة'
                  : 'Direction de La Mecque'}
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
                      <Text style={[styles.cardinal, styles.cardinalN]}>
                        {isRTL ? 'ش' : 'N'}
                      </Text>
                      <Text style={[styles.cardinal, styles.cardinalS]}>
                        {isRTL ? 'ج' : 'S'}
                      </Text>
                      <Text style={[styles.cardinal, styles.cardinalE]}>
                        {isRTL ? 'ق' : 'E'}
                      </Text>
                      <Text style={[styles.cardinal, styles.cardinalO]}>
                        {isRTL ? 'غ' : 'O'}
                      </Text>

                      {/* Grande flèche dorée animée vers la Qibla */}
                      <Animated.View
                        style={[
                          styles.needle,
                          {
                            transform: [
                              {
                                rotate: rotateAnim.interpolate({
                                  inputRange: [-360, 360],
                                  outputRange: ['-360deg', '360deg'],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
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
                  <View
                    style={[
                      styles.alignmentIndicator,
                      Math.abs((compassHeading - qiblaDirection + 360) % 360) <
                        15 && styles.alignmentIndicatorAligned,
                    ]}
                  >
                    <Text style={styles.alignmentText}>
                      {Math.abs((compassHeading - qiblaDirection + 360) % 360) <
                      15
                        ? language === 'ar'
                          ? '✓ أنت على القبلة!'
                          : '✓ Vous êtes aligné!'
                        : language === 'ar'
                        ? 'وجّه الهاتف نحو القبلة'
                        : 'Tournez vers la Qibla'}
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

          {/* Calendrier des prières */}
          <TouchableOpacity
            style={[
              styles.card,
              {
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                padding: spacing.lg,
              },
            ]}
            onPress={() => navigation.navigate('PrayerCalendar' as never)}
            activeOpacity={0.7}
          >
            <Text
              style={{
                fontSize: 28,
                marginRight: isRTL ? 0 : spacing.md,
                marginLeft: isRTL ? spacing.md : 0,
              }}
            >
              📅
            </Text>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  {
                    fontSize: fontSize.lg,
                    fontWeight: '700',
                    color: colors.text,
                  },
                  isRTL && styles.textRTL,
                ]}
              >
                {t('prayerCalendar')}
              </Text>
              <Text
                style={[
                  {
                    fontSize: fontSize.sm,
                    color: colors.textSecondary,
                    marginTop: 2,
                  },
                  isRTL && styles.textRTL,
                ]}
              >
                {language === 'ar'
                  ? 'اطلع على مواقيت الصلاة لأي يوم'
                  : "Consultez les horaires pour n'importe quel jour"}
              </Text>
            </View>
            <Text style={{ fontSize: fontSize.lg, color: colors.textMuted }}>
              {isRTL ? '◀' : '▶'}
            </Text>
          </TouchableOpacity>

          {/* RIB Mosquée */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              🏦 {t('bankDetails')}
            </Text>
            <View style={styles.card}>
              <View style={styles.ribHeader}>
                <Text style={styles.ribIcon}>🕌</Text>
                <Text style={styles.ribTitulaire}>
                  {mosqueeInfo.accountHolder}
                </Text>
                <Text style={styles.ribBanque}>{mosqueeInfo.bankName}</Text>
              </View>

              <View style={styles.ribRow}>
                <View style={[styles.ribInfo, { flex: 1 }]}>
                  <Text style={styles.ribLabel}>IBAN</Text>
                  <Text
                    style={styles.ribValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {mosqueeInfo.iban}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(mosqueeInfo.iban, 'iban')}
                  accessibilityLabel="Copier l'IBAN"
                  accessibilityRole="button"
                >
                  <Text style={styles.copyBtnText}>
                    {copied === 'iban' ? '✓' : '📋'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.ribRow, styles.ribRowLast]}>
                <View style={[styles.ribInfo, { flex: 1 }]}>
                  <Text style={styles.ribLabel}>BIC</Text>
                  <Text style={styles.ribValue}>{mosqueeInfo.bic}</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(mosqueeInfo.bic, 'bic')}
                  accessibilityLabel="Copier le BIC"
                  accessibilityRole="button"
                >
                  <Text style={styles.copyBtnText}>
                    {copied === 'bic' ? '✓' : '📋'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Infos Mosquée */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              📍 {t('information')}
            </Text>
            <View style={styles.card}>
              {/* Adresse */}
              <View style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <Text style={styles.infoIcon}>📍</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('address')}</Text>
                    <Text style={styles.infoValue}>
                      {mosqueeInfo.address}, {mosqueeInfo.postalCode}{' '}
                      {mosqueeInfo.city}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.copyBtnSmall}
                  onPress={() =>
                    copyToClipboard(
                      `${mosqueeInfo.address}, ${mosqueeInfo.postalCode} ${mosqueeInfo.city}`,
                      'adresse',
                    )
                  }
                  accessibilityLabel="Copier l'adresse"
                  accessibilityRole="button"
                >
                  <Text style={styles.copyBtnSmallText}>
                    {copied === 'adresse' ? '✓' : '📋'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Téléphone */}
              <TouchableOpacity style={styles.infoRow} onPress={handleCall}>
                <View style={styles.infoLeft}>
                  <Text style={styles.infoIcon}>📞</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('phone')}</Text>
                    <Text style={[styles.infoValue, styles.infoValueLink]}>
                      {mosqueeInfo.phone}
                    </Text>
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
                    <Text style={[styles.infoValue, styles.infoValueLink]}>
                      {mosqueeInfo.email}
                    </Text>
                  </View>
                </View>
                <Text style={styles.infoArrow}>→</Text>
              </TouchableOpacity>

              {/* Site web */}
              <TouchableOpacity
                style={[styles.infoRow, styles.infoRowLast]}
                onPress={handleWebsite}
              >
                <View style={styles.infoLeft}>
                  <Text style={styles.infoIcon}>🌐</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('website')}</Text>
                    <Text style={[styles.infoValue, styles.infoValueLink]}>
                      {mosqueeInfo.website}
                    </Text>
                  </View>
                </View>
                <Text style={styles.infoArrow}>→</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notifications de priere locales */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              🔔 {t('prayerNotifications')}
            </Text>
            <View style={styles.card}>
              {/* Toggle principal */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Text style={styles.settingIcon}>🔔</Text>
                  <Text style={styles.settingLabel} numberOfLines={2}>
                    {t('enableReminders')}
                  </Text>
                </View>
                <Switch
                  active={prayerNotifSettings.enabled}
                  onToggle={() =>
                    updatePrayerNotifSettings({
                      ...prayerNotifSettings,
                      enabled: !prayerNotifSettings.enabled,
                    })
                  }
                />
              </View>

              {prayerNotifSettings.enabled && (
                <>
                  {/* Minutes avant */}
                  <View style={styles.settingRowVertical}>
                    <View style={styles.settingLabelRow}>
                      <Text style={styles.settingIcon}>⏱️</Text>
                      <Text style={styles.settingLabel}>
                        {t('reminderBefore')}
                      </Text>
                    </View>
                    <View style={styles.pickerFullWidth}>
                      {[5, 10, 15, 30].map(min => (
                        <TouchableOpacity
                          key={min}
                          style={[
                            styles.pickerOption,
                            prayerNotifSettings.minutesBefore === min &&
                              styles.pickerOptionActive,
                          ]}
                          onPress={() =>
                            updatePrayerNotifSettings({
                              ...prayerNotifSettings,
                              minutesBefore: min,
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.pickerOptionText,
                              prayerNotifSettings.minutesBefore === min &&
                                styles.pickerOptionTextActive,
                            ]}
                          >
                            {min}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <Text style={styles.pickerUnit}>
                        {isRTL ? 'د' : 'min'}
                      </Text>
                    </View>
                  </View>

                  {/* Toggles par priere */}
                  <View style={styles.prayerTogglesSection}>
                    <Text
                      style={[
                        styles.prayerTogglesTitle,
                        isRTL && styles.textRTL,
                      ]}
                    >
                      {language === 'ar'
                        ? 'اختر الصلوات للتذكير'
                        : 'Prieres a rappeler'}
                    </Text>
                    {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map(
                      (prayer, index, arr) => {
                        const prayerIcons: Record<string, string> = {
                          fajr: '🌅',
                          dhuhr: '☀️',
                          asr: '🌤️',
                          maghrib: '🌅',
                          isha: '🌙',
                        };
                        const prayerNames: Record<
                          string,
                          { fr: string; ar: string }
                        > = {
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
                              index === arr.length - 1 &&
                                styles.prayerToggleRowLast,
                            ]}
                          >
                            <View style={styles.settingLeft}>
                              <Text style={styles.settingIcon}>
                                {prayerIcons[prayer]}
                              </Text>
                              <Text style={styles.settingLabel}>
                                {language === 'ar'
                                  ? prayerNames[prayer].ar
                                  : prayerNames[prayer].fr}
                              </Text>
                            </View>
                            <Switch
                              active={prayerNotifSettings.prayers[prayer]}
                              onToggle={() =>
                                updatePrayerNotifSettings({
                                  ...prayerNotifSettings,
                                  prayers: {
                                    ...prayerNotifSettings.prayers,
                                    [prayer]:
                                      !prayerNotifSettings.prayers[prayer],
                                  },
                                })
                              }
                            />
                          </View>
                        );
                      },
                    )}
                  </View>

                  {/* Note explicative */}
                  <View style={styles.prayerNotifNote}>
                    <Text style={styles.prayerNotifNoteText}>
                      {language === 'ar'
                        ? '💡 افتح التطبيق مرة واحدة في الأسبوع لمواصلة تلقي التذكيرات'
                        : "💡 Ouvrez l'app au moins 1 fois par semaine pour continuer à recevoir les rappels"}
                    </Text>
                  </View>

                  {/* Rappel Jumu'a */}
                  <View style={[styles.settingRow, styles.settingRowLast]}>
                    <View style={styles.settingLeft}>
                      <Text style={styles.settingIcon}>🕌</Text>
                      <Text style={styles.settingLabel} numberOfLines={2}>
                        {t('jumuaFriday')}
                      </Text>
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

          {/* Boost Prière - Rappels progressifs (OPTIONNEL) */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              🚀 {t('boostPrayer')}
            </Text>
            <View style={styles.card}>
              {/* Toggle principal */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Text style={styles.settingIcon}>🚀</Text>
                  <Text style={styles.settingLabel} numberOfLines={2}>
                    {t('enableProgressiveReminders')}
                  </Text>
                </View>
                <Switch
                  active={boostSettings.enabled}
                  onToggle={() =>
                    updateBoostSettings({
                      ...boostSettings,
                      enabled: !boostSettings.enabled,
                    })
                  }
                />
              </View>

              {/* Détail des rappels par prière (visible si activé) */}
              {boostSettings.enabled && (
                <View style={styles.prayerNotifNote}>
                  <Text
                    style={[
                      styles.prayerNotifNoteText,
                      { fontWeight: '600', marginBottom: 8 },
                    ]}
                  >
                    📋{' '}
                    {language === 'ar' ? 'التفاصيل:' : 'Détails des rappels :'}
                  </Text>
                  <Text style={styles.prayerNotifNoteText}>
                    🌅 Fajr, Dhuhr, Asr :{' '}
                    {language === 'ar' ? '3 تذكيرات' : '3 rappels'}
                  </Text>
                  <Text style={styles.prayerNotifNoteText}>
                    {language === 'ar'
                      ? '   • 30 د بعد الأذان'
                      : "   • 30 min après l'adhan"}
                  </Text>
                  <Text style={styles.prayerNotifNoteText}>
                    {language === 'ar'
                      ? '   • في منتصف الوقت'
                      : '   • À mi-temps'}
                  </Text>
                  <Text style={styles.prayerNotifNoteText}>
                    {language === 'ar'
                      ? '   • 15 د قبل النهاية'
                      : '   • 15 min avant la fin'}
                  </Text>
                  <Text style={[styles.prayerNotifNoteText, { marginTop: 6 }]}>
                    🌅 Maghrib :{' '}
                    {language === 'ar'
                      ? '1 تذكير عاجل (مالكية)'
                      : '1 rappel urgent (Malikites)'}
                  </Text>
                  <Text style={[styles.prayerNotifNoteText, { marginTop: 6 }]}>
                    🌙 Isha :{' '}
                    {language === 'ar'
                      ? '1 تذكير (30 د بعد)'
                      : '1 rappel (30 min après)'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Rappel Coran */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              📖 {language === 'ar' ? 'تذكير القرآن' : 'Rappel Coran'}
            </Text>
            <View style={styles.card}>
              {/* Toggle principal */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Text style={styles.settingIcon}>📖</Text>
                  <Text style={styles.settingLabel} numberOfLines={2}>
                    {language === 'ar'
                      ? 'تفعيل التذكير اليومي'
                      : 'Activer le rappel quotidien'}
                  </Text>
                </View>
                <Switch
                  active={quranReminderSettings.enabled}
                  onToggle={() =>
                    updateQuranReminderSettings({
                      ...quranReminderSettings,
                      enabled: !quranReminderSettings.enabled,
                    })
                  }
                />
              </View>

              {quranReminderSettings.enabled && (
                <>
                  {/* Choix de l'heure */}
                  <View style={styles.settingRowVertical}>
                    <View style={styles.settingLabelRow}>
                      <Text style={styles.settingIcon}>⏰</Text>
                      <Text style={styles.settingLabel}>
                        {language === 'ar' ? 'الساعة' : 'Heure'}
                      </Text>
                    </View>
                    <View style={styles.pickerFullWidth}>
                      {[8, 12, 18, 20, 22].map(hour => (
                        <TouchableOpacity
                          key={hour}
                          style={[
                            styles.pickerOption,
                            quranReminderSettings.hour === hour &&
                              styles.pickerOptionActive,
                          ]}
                          onPress={() =>
                            updateQuranReminderSettings({
                              ...quranReminderSettings,
                              hour,
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.pickerOptionText,
                              quranReminderSettings.hour === hour &&
                                styles.pickerOptionTextActive,
                            ]}
                          >
                            {hour}h
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Fréquence */}
                  <View
                    style={[styles.settingRowVertical, styles.settingRowLast]}
                  >
                    <View style={styles.settingLabelRow}>
                      <Text style={styles.settingIcon}>📅</Text>
                      <Text style={styles.settingLabel}>
                        {language === 'ar' ? 'التكرار' : 'Fréquence'}
                      </Text>
                    </View>
                    <View style={styles.pickerFullWidth}>
                      <TouchableOpacity
                        style={[
                          styles.pickerOption,
                          quranReminderSettings.frequency === 'daily' &&
                            styles.pickerOptionActive,
                        ]}
                        onPress={() =>
                          updateQuranReminderSettings({
                            ...quranReminderSettings,
                            frequency: 'daily',
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            quranReminderSettings.frequency === 'daily' &&
                              styles.pickerOptionTextActive,
                          ]}
                        >
                          {language === 'ar' ? 'يومي' : 'Quotidien'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.pickerOption,
                          quranReminderSettings.frequency === 'friday' &&
                            styles.pickerOptionActive,
                        ]}
                        onPress={() =>
                          updateQuranReminderSettings({
                            ...quranReminderSettings,
                            frequency: 'friday',
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            quranReminderSettings.frequency === 'friday' &&
                              styles.pickerOptionTextActive,
                          ]}
                        >
                          {language === 'ar' ? 'الجمعة' : 'Vendredi'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Note */}
                  <View style={styles.prayerNotifNote}>
                    <Text style={styles.prayerNotifNoteText}>
                      {language === 'ar'
                        ? '💡 "إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ"'
                        : '💡 "Certes, c\'est Nous qui avons fait descendre le Coran"'}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Mode Silencieux Mosquée - Géolocalisation */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              📍 {t('mosqueSilentMode')}
            </Text>
            <View style={styles.card}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Text style={styles.settingIcon}>🔕</Text>
                  <Text style={styles.settingLabel} numberOfLines={2}>
                    {t('enableMosqueProximity')}
                  </Text>
                </View>
                <Switch
                  active={mosqueProximitySettings.enabled}
                  onToggle={() =>
                    updateMosqueProximitySettings({
                      ...mosqueProximitySettings,
                      enabled: !mosqueProximitySettings.enabled,
                    })
                  }
                />
              </View>

              {/* Note explicative */}
              <View style={styles.prayerNotifNote}>
                <Text style={styles.prayerNotifNoteText}>
                  {t('mosqueSilentModeDescription')}
                </Text>
              </View>
            </View>
          </View>

          {/* Notifications Ramadan - Visible uniquement si mode Ramadan actif */}
          {ramadanSettings?.enabled && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                🌙{' '}
                {language === 'ar' ? 'إشعارات رمضان' : 'Notifications Ramadan'}
              </Text>
              <View style={[styles.card, styles.ramadanCard]}>
                {/* Toggle Suhoor */}
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Text style={styles.settingIcon}>🌙</Text>
                    <Text style={styles.settingLabel} numberOfLines={2}>
                      {language === 'ar' ? 'تذكير السحور' : 'Rappel Suhoor'}
                    </Text>
                  </View>
                  <Switch
                    active={ramadanNotifSettings.suhoor.enabled}
                    onToggle={() =>
                      updateRamadanNotifSettings({
                        ...ramadanNotifSettings,
                        suhoor: {
                          ...ramadanNotifSettings.suhoor,
                          enabled: !ramadanNotifSettings.suhoor.enabled,
                        },
                      })
                    }
                  />
                </View>

                {/* Minutes avant Suhoor */}
                {ramadanNotifSettings.suhoor.enabled && (
                  <View style={styles.settingRowVertical}>
                    <View style={styles.settingLabelRow}>
                      <Text style={styles.settingIcon}>⏰</Text>
                      <Text style={styles.settingLabel} numberOfLines={1}>
                        {language === 'ar' ? 'قبل الفجر بـ' : 'Avant Fajr'}
                      </Text>
                    </View>
                    <View style={styles.pickerFullWidth}>
                      {[15, 30, 45].map(min => (
                        <TouchableOpacity
                          key={min}
                          style={[
                            styles.pickerOption,
                            ramadanNotifSettings.suhoor.minutesBefore === min &&
                              styles.pickerOptionActive,
                          ]}
                          onPress={() =>
                            updateRamadanNotifSettings({
                              ...ramadanNotifSettings,
                              suhoor: {
                                ...ramadanNotifSettings.suhoor,
                                minutesBefore: min,
                              },
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.pickerOptionText,
                              ramadanNotifSettings.suhoor.minutesBefore ===
                                min && styles.pickerOptionTextActive,
                            ]}
                          >
                            {min}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <Text style={styles.pickerUnit}>
                        {isRTL ? 'د' : 'min'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Toggle Iftar */}
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Text style={styles.settingIcon}>🌅</Text>
                    <Text style={styles.settingLabel} numberOfLines={2}>
                      {language === 'ar' ? 'تذكير الإفطار' : 'Rappel Iftar'}
                    </Text>
                  </View>
                  <Switch
                    active={ramadanNotifSettings.iftar.enabled}
                    onToggle={() =>
                      updateRamadanNotifSettings({
                        ...ramadanNotifSettings,
                        iftar: {
                          ...ramadanNotifSettings.iftar,
                          enabled: !ramadanNotifSettings.iftar.enabled,
                        },
                      })
                    }
                  />
                </View>

                {/* Minutes avant Iftar */}
                {ramadanNotifSettings.iftar.enabled && (
                  <View style={styles.settingRowVertical}>
                    <View style={styles.settingLabelRow}>
                      <Text style={styles.settingIcon}>⏰</Text>
                      <Text style={styles.settingLabel} numberOfLines={1}>
                        {language === 'ar' ? 'قبل المغرب بـ' : 'Avant Maghrib'}
                      </Text>
                    </View>
                    <View style={styles.pickerFullWidth}>
                      {[0, 5, 10, 15].map(min => (
                        <TouchableOpacity
                          key={min}
                          style={[
                            styles.pickerOption,
                            ramadanNotifSettings.iftar.minutesBefore === min &&
                              styles.pickerOptionActive,
                          ]}
                          onPress={() =>
                            updateRamadanNotifSettings({
                              ...ramadanNotifSettings,
                              iftar: {
                                ...ramadanNotifSettings.iftar,
                                minutesBefore: min,
                              },
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.pickerOptionText,
                              ramadanNotifSettings.iftar.minutesBefore ===
                                min && styles.pickerOptionTextActive,
                            ]}
                          >
                            {min === 0
                              ? language === 'ar'
                                ? 'الآن'
                                : "À l'heure"
                              : min}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {ramadanNotifSettings.iftar.minutesBefore > 0 && (
                        <Text style={styles.pickerUnit}>
                          {isRTL ? 'د' : 'min'}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Toggle Tarawih */}
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Text style={styles.settingIcon}>🕌</Text>
                    <Text style={styles.settingLabel} numberOfLines={2}>
                      {language === 'ar' ? 'تذكير التراويح' : 'Rappel Tarawih'}
                    </Text>
                  </View>
                  <Switch
                    active={ramadanNotifSettings.tarawih.enabled}
                    onToggle={() =>
                      updateRamadanNotifSettings({
                        ...ramadanNotifSettings,
                        tarawih: {
                          ...ramadanNotifSettings.tarawih,
                          enabled: !ramadanNotifSettings.tarawih.enabled,
                        },
                      })
                    }
                  />
                </View>

                {/* Minutes avant Tarawih */}
                {ramadanNotifSettings.tarawih.enabled && (
                  <View
                    style={[styles.settingRowVertical, styles.settingRowLast]}
                  >
                    <View style={styles.settingLabelRow}>
                      <Text style={styles.settingIcon}>⏰</Text>
                      <Text style={styles.settingLabel} numberOfLines={1}>
                        {language === 'ar'
                          ? 'قبل التراويح بـ'
                          : 'Avant Tarawih'}
                      </Text>
                    </View>
                    <View style={styles.pickerFullWidth}>
                      {[10, 15, 30].map(min => (
                        <TouchableOpacity
                          key={min}
                          style={[
                            styles.pickerOption,
                            ramadanNotifSettings.tarawih.minutesBefore ===
                              min && styles.pickerOptionActive,
                          ]}
                          onPress={() =>
                            updateRamadanNotifSettings({
                              ...ramadanNotifSettings,
                              tarawih: {
                                ...ramadanNotifSettings.tarawih,
                                minutesBefore: min,
                              },
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.pickerOptionText,
                              ramadanNotifSettings.tarawih.minutesBefore ===
                                min && styles.pickerOptionTextActive,
                            ]}
                          >
                            {min}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <Text style={styles.pickerUnit}>
                        {isRTL ? 'د' : 'min'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Note explicative */}
                <View style={styles.prayerNotifNote}>
                  <Text style={styles.prayerNotifNoteText}>
                    {language === 'ar'
                      ? '🌙 رمضان مبارك! ستتلقى تذكيرات في الأوقات المحددة'
                      : '🌙 Ramadan Mubarak ! Vous recevrez les rappels aux heures choisies'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Langue */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🌐 {t('language')}</Text>
            <View style={styles.card}>
              <View style={styles.languageSelector}>
                <TouchableOpacity
                  style={[
                    styles.languageOption,
                    language === 'fr' && styles.languageOptionActive,
                  ]}
                  onPress={() => setLanguage('fr')}
                >
                  <Text style={styles.languageFlag}>🇫🇷</Text>
                  <Text
                    style={[
                      styles.languageText,
                      language === 'fr' && styles.languageTextActive,
                    ]}
                  >
                    {t('french')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.languageOption,
                    language === 'ar' && styles.languageOptionActive,
                  ]}
                  onPress={() => setLanguage('ar')}
                >
                  <Text style={styles.languageFlag}>🇸🇦</Text>
                  <Text
                    style={[
                      styles.languageText,
                      language === 'ar' && styles.languageTextActive,
                    ]}
                  >
                    {t('arabic')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Politique de confidentialité (RGPD) */}
          <TouchableOpacity
            style={[
              styles.logoutButton,
              {
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderColor: 'rgba(59, 130, 246, 0.2)',
                marginBottom: spacing.sm,
              },
            ]}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <View style={[styles.settingRow, { justifyContent: 'center' }]}>
              <Text style={{ fontSize: 18, marginRight: spacing.sm }}>🔒</Text>
              <Text style={[styles.settingLabel, { color: '#3b82f6' }]}>
                {language === 'ar'
                  ? 'سياسة الخصوصية'
                  : 'Politique de confidentialité'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Exporter mes données (RGPD Article 20) */}
          {userEmail && (
            <TouchableOpacity
              style={[
                styles.logoutButton,
                {
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  borderColor: 'rgba(34, 197, 94, 0.2)',
                  marginBottom: spacing.sm,
                },
              ]}
              onPress={async () => {
                try {
                  const exportMyData = firebase
                    .app()
                    .functions('europe-west1')
                    .httpsCallable('exportMyData');
                  const result = await exportMyData();
                  const data = result.data as any;
                  Alert.alert(
                    t('exportData'),
                    language === 'ar'
                      ? `تم تصدير بياناتك بنجاح:\n\n• ${
                          data.donations?.length || 0
                        } تبرعات\n• ${data.paiements?.length || 0} مدفوعات\n• ${
                          data.messages?.length || 0
                        } رسائل\n\nتاريخ التصدير: ${new Date(
                          data.exportedAt,
                        ).toLocaleDateString('ar')}`
                      : `Vos données ont été exportées avec succès:\n\n• ${
                          data.donations?.length || 0
                        } donations\n• ${
                          data.paiements?.length || 0
                        } paiements\n• ${
                          data.messages?.length || 0
                        } messages\n\nExporté le: ${new Date(
                          data.exportedAt,
                        ).toLocaleDateString('fr-FR')}`,
                  );
                } catch (error) {
                  Alert.alert(
                    t('commonError'),
                    language === 'ar'
                      ? 'فشل تصدير البيانات'
                      : "Impossible d'exporter les données",
                  );
                }
              }}
            >
              <View style={[styles.settingRow, { justifyContent: 'center' }]}>
                <Text style={{ fontSize: 18, marginRight: spacing.sm }}>
                  📥
                </Text>
                <Text style={[styles.settingLabel, { color: '#22c55e' }]}>
                  {language === 'ar' ? 'تصدير بياناتي' : 'Exporter mes données'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Supprimer mon compte (RGPD) */}
          {userEmail && (
            <TouchableOpacity
              style={[styles.logoutButton, { marginBottom: spacing.sm }]}
              onPress={() => {
                Alert.alert(t('deleteAccount'), t('deleteAccountConfirm'), [
                  {
                    text: t('commonCancel'),
                    style: 'cancel',
                  },
                  {
                    text: t('commonDelete'),
                    style: 'destructive',
                    onPress: () => {
                      Alert.alert(
                        t('commonConfirm'),
                        t('deleteAccountConfirm'),
                        [
                          {
                            text: t('commonCancel'),
                            style: 'cancel',
                          },
                          {
                            text:
                              language === 'ar'
                                ? 'نعم، حذف حسابي'
                                : 'Oui, supprimer mon compte',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                const result = await deleteMyAccount();
                                if (result.success) {
                                  Alert.alert(
                                    t('accountDeleted'),
                                    language === 'ar'
                                      ? 'تم حذف حسابك بنجاح.'
                                      : result.message,
                                  );
                                  await AuthService.signOut();
                                } else {
                                  Alert.alert(t('commonError'), result.message);
                                }
                              } catch (error) {
                                Alert.alert(
                                  t('commonError'),
                                  language === 'ar'
                                    ? 'فشل حذف الحساب'
                                    : 'Impossible de supprimer le compte',
                                );
                              }
                            },
                          },
                        ],
                      );
                    },
                  },
                ]);
              }}
            >
              <View style={[styles.settingRow, { justifyContent: 'center' }]}>
                <Text style={{ fontSize: 18, marginRight: spacing.sm }}>
                  🗑️
                </Text>
                <Text style={[styles.settingLabel, { color: '#ef4444' }]}>
                  {language === 'ar' ? 'حذف حسابي' : 'Supprimer mon compte'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Déconnexion */}
          {userEmail && (
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => {
                Alert.alert(
                  language === 'ar' ? 'تسجيل الخروج' : 'Se déconnecter',
                  language === 'ar'
                    ? 'هل أنت متأكد؟'
                    : 'Êtes-vous sûr de vouloir vous déconnecter ?',
                  [
                    {
                      text: t('commonCancel'),
                      style: 'cancel',
                    },
                    {
                      text:
                        language === 'ar' ? 'تسجيل الخروج' : 'Se déconnecter',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await AuthService.signOut();
                        } catch (error) {
                          Alert.alert(
                            t('commonError'),
                            language === 'ar'
                              ? 'فشل تسجيل الخروج'
                              : 'Impossible de se déconnecter',
                          );
                        }
                      },
                    },
                  ],
                );
              }}
            >
              <View style={[styles.settingRow, { justifyContent: 'center' }]}>
                <Text style={{ fontSize: 18, marginRight: spacing.sm }}>
                  🚪
                </Text>
                <Text style={[styles.settingLabel, { color: '#ef4444' }]}>
                  {language === 'ar' ? 'تسجيل الخروج' : 'Se déconnecter'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Version */}
          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>
              {t('version')} {appVersion}
            </Text>
            <Text style={styles.copyrightText}>© 2026 El Mohsinine</Text>
          </View>
        </View>
      </ScrollView>
    </BackgroundPattern>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    color: colors.text,
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
    gap: spacing.sm,
  },
  ribRowLast: {
    borderBottomWidth: 0,
  },
  ribInfo: {
    flexShrink: 1,
    minWidth: 0,
  },
  ribLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  ribValue: {
    fontSize: isSmallScreen ? fontSize.sm : fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  copyBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    flexShrink: 0,
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
    gap: spacing.sm,
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingRowVertical: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  settingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  pickerFullWidth: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    backgroundColor: '#f0f0f5',
    borderRadius: borderRadius.sm,
    padding: isSmallScreen ? 2 : 4,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  settingIcon: {
    fontSize: isSmallScreen ? 14 : 18,
    marginRight: isSmallScreen ? spacing.sm : spacing.md,
  },
  settingLabel: {
    fontSize: isSmallScreen ? fontSize.sm : fontSize.md,
    color: colors.text,
    flexShrink: 1,
    minWidth: 0,
  },
  // Switch - Accessible touch target
  switch: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    padding: 2,
    minHeight: 44, // Touch target wrapper
    flexShrink: 0,
    marginLeft: spacing.sm,
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
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  pickerOption: {
    paddingHorizontal: isSmallScreen ? 8 : spacing.sm,
    paddingVertical: isSmallScreen ? 10 : 12,
    borderRadius: borderRadius.sm,
    minWidth: 44, // Minimum touch target Apple HIG
    minHeight: 44, // Minimum touch target Apple HIG
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: spacing.sm,
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
    color: colors.textMuted,
  },
  copyrightText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
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
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.08)',
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
  logoutButton: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  // Ramadan card
  ramadanCard: {
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
  },
});

export default MoreScreen;
