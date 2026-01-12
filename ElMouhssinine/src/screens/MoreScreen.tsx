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
} from 'react-native';
import CompassHeading from 'react-native-compass-heading';
import Clipboard from '@react-native-clipboard/clipboard';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';
import { subscribeToMosqueeInfo } from '../services/firebase';
import { MosqueeInfo, NotificationSettings } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  requestNotificationPermission,
  scheduleJumuaReminder,
  cancelJumuaReminder,
  isJumuaReminderEnabled,
} from '../services/notifications';

const MoreScreen = () => {
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
  const [compassHeading, setCompassHeading] = useState(0);
  const [compassError, setCompassError] = useState<string | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const qiblaDirection = 119; // Direction Qibla pour Bourg-en-Bresse

  useEffect(() => {
    const unsub = subscribeToMosqueeInfo((info) => {
      if (info) setMosqueeInfo(info);
    });
    return () => unsub?.();
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
              <TouchableOpacity style={[styles.infoRow, styles.infoRowLast]} onPress={handleWebsite}>
                <View style={styles.infoLeft}>
                  <Text style={styles.infoIcon}>🌐</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('website')}</Text>
                    <Text style={[styles.infoValue, styles.infoValueLink]}>{mosqueeInfo.website}</Text>
                  </View>
                </View>
                <Text style={styles.infoArrow}>→</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notifications */}
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
                  active={notifications.enabled}
                  onToggle={() => setNotifications({
                    ...notifications,
                    enabled: !notifications.enabled
                  })}
                />
              </View>

              {notifications.enabled && (
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
                            notifications.minutesBefore === min && styles.pickerOptionActive
                          ]}
                          onPress={() => setNotifications({
                            ...notifications,
                            minutesBefore: min
                          })}
                        >
                          <Text style={[
                            styles.pickerOptionText,
                            notifications.minutesBefore === min && styles.pickerOptionTextActive
                          ]}>
                            {min}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <Text style={styles.pickerUnit}>min</Text>
                    </View>
                  </View>

                  {/* Son Adhan */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Text style={styles.settingIcon}>🔊</Text>
                      <Text style={styles.settingLabel}>{t('adhanSound')}</Text>
                    </View>
                    <Switch
                      active={notifications.adhanSound}
                      onToggle={() => setNotifications({
                        ...notifications,
                        adhanSound: !notifications.adhanSound
                      })}
                    />
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
    paddingTop: 60,
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
    width: 220,
    height: 220,
    marginBottom: spacing.lg,
  },
  compassRing: {
    width: '100%',
    height: '100%',
    borderRadius: 110,
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
  },
  settingIcon: {
    fontSize: 18,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: fontSize.md,
    color: colors.text,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
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
    padding: 4,
  },
  pickerOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  pickerOptionActive: {
    backgroundColor: colors.accent,
  },
  pickerOptionText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '600',
  },
  pickerOptionTextActive: {
    color: '#ffffff',
  },
  pickerUnit: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginLeft: spacing.xs,
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
});

export default MoreScreen;
