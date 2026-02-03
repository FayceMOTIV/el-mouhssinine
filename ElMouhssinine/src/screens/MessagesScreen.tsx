import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Vibration,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize, HEADER_PADDING_TOP, platformShadow } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import { AuthService, MemberProfile } from '../services/auth';
import {
  subscribeToUserMessages,
  sendMessage,
  deleteMessage,
  UserMessage,
  MESSAGE_SUBJECTS,
} from '../services/firebase';
import { clearBadgeCount } from '../services/notifications';
import { EmptyMessages } from '../components';

const MessagesScreen = () => {
  const navigation = useNavigation<any>();
  const { language, isRTL } = useLanguage();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [sending, setSending] = useState(false);

  // Formulaire nouveau message
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [messageText, setMessageText] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  // Supprimer un message avec confirmation
  const handleDeleteMessage = (msg: UserMessage) => {
    Alert.alert(
      language === 'ar' ? 'حذف الرسالة' : 'Supprimer le message',
      language === 'ar' ? 'هل أنت متأكد من حذف هذه الرسالة؟' : 'Êtes-vous sûr de vouloir supprimer ce message ?',
      [
        {
          text: language === 'ar' ? 'إلغاء' : 'Annuler',
          style: 'cancel',
        },
        {
          text: language === 'ar' ? 'حذف' : 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeleting(msg.id);
            try {
              // Passer le userId pour vérification d'ownership
              const result = await deleteMessage(msg.id, memberProfile?.uid);
              if (result.success) {
                // Le message sera automatiquement retiré via subscription
              } else {
                Alert.alert(
                  language === 'ar' ? 'خطأ' : 'Erreur',
                  result.error || 'Une erreur est survenue'
                );
              }
            } catch (error) {
              const err = error as Error;
              Alert.alert(
                language === 'ar' ? 'خطأ' : 'Erreur',
                err?.message || 'Une erreur est survenue'
              );
            } finally {
              setDeleting(null);
            }
          },
        },
      ]
    );
  };

  // Effacer le badge quand on ouvre l'écran Messages
  useEffect(() => {
    clearBadgeCount();
  }, []);

  // Écouter l'état de connexion Firebase
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(async (user) => {
      if (user) {
        setIsLoggedIn(true);
        const profile = await AuthService.getMemberProfile(user.uid);
        setMemberProfile(profile);
        // Si pas de profil trouvé, on arrête le loading quand même
        if (!profile) {
          setLoading(false);
        }
      } else {
        setIsLoggedIn(false);
        setMemberProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Charger les messages
  useEffect(() => {
    if (!memberProfile?.uid) {
      if (isLoggedIn === false) setLoading(false);
      return;
    }

    const unsubscribe = subscribeToUserMessages(memberProfile.uid, (msgs) => {
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [memberProfile?.uid, isLoggedIn]);

  // Envoyer un nouveau message
  const handleSendMessage = async () => {
    if (!selectedSubject) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Erreur',
        language === 'ar' ? 'اختر موضوعا' : 'Veuillez choisir un sujet'
      );
      return;
    }

    if (messageText.trim().length < 10) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Erreur',
        language === 'ar' ? 'الرسالة قصيرة جدا (10 أحرف على الأقل)' : 'Message trop court (10 caractères minimum)'
      );
      return;
    }

    if (!memberProfile) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Erreur',
        language === 'ar' ? 'يجب تسجيل الدخول' : 'Vous devez être connecté'
      );
      return;
    }

    setSending(true);
    try {
      const userName = memberProfile.name || 'Utilisateur';
      const userEmail = memberProfile.email || '';

      await sendMessage(memberProfile.uid, userName, userEmail, selectedSubject, messageText.trim());

      // Haptic feedback sur succès
      Vibration.vibrate(50);

      setShowNewMessageModal(false);
      setSelectedSubject('');
      setMessageText('');

      Alert.alert(
        language === 'ar' ? 'تم الإرسال' : 'Message envoyé',
        language === 'ar' ? 'سنرد عليك قريبا إن شاء الله' : 'Nous vous répondrons bientôt insha\'Allah'
      );
    } catch (error) {
      const err = error as Error;
      const errorMsg = err?.message || 'Erreur';
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Erreur',
        errorMsg.includes('limite')
          ? (language === 'ar' ? 'وصلت الحد اليومي (5 رسائل)' : 'Limite atteinte (5 messages/jour)')
          : errorMsg
      );
    } finally {
      setSending(false);
    }
  };

  // Formatter la date
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return language === 'ar' ? 'أمس' : 'Hier';
    } else if (days < 7) {
      return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; labelAr: string; color: string; bg: string }> = {
      non_lu: { label: 'Non lu', labelAr: 'غير مقروء', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
      en_cours: { label: 'En cours', labelAr: 'قيد المعالجة', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
      resolu: { label: 'Résolu', labelAr: 'تم الحل', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
    };

    const config = statusConfig[status] || statusConfig.non_lu;

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
        <Text style={[styles.statusText, { color: config.color }]}>
          {language === 'ar' ? config.labelAr : config.label}
        </Text>
      </View>
    );
  };

  // Si en cours de chargement de l'état d'auth, afficher un loader
  if (loading && !memberProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {language === 'ar' ? 'رسائلي' : 'Mes messages'}
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  // Si pas connecté (après vérification auth terminée)
  if (!isLoggedIn || !memberProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {language === 'ar' ? 'رسائلي' : 'Mes messages'}
          </Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔐</Text>
          <Text style={[styles.emptyTitle, isRTL && styles.textRTL]}>
            {language === 'ar' ? 'تسجيل الدخول مطلوب' : 'Connexion requise'}
          </Text>
          <Text style={[styles.emptyText, isRTL && styles.textRTL]}>
            {language === 'ar'
              ? 'للوصول إلى الرسائل والتواصل مع المسجد، يرجى تسجيل الدخول أو إنشاء حساب من قسم العضوية.'
              : 'Pour accéder à la messagerie et contacter la mosquée, veuillez d\'abord vous connecter ou créer un compte depuis l\'onglet Membre.'}
          </Text>
          <TouchableOpacity
            style={styles.goToMemberBtn}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Member' })}
          >
            <Text style={styles.goToMemberBtnText}>
              {language === 'ar' ? 'الذهاب إلى قسم العضوية' : 'Aller à l\'espace Membre'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, isRTL && styles.textRTL]}>
          {language === 'ar' ? 'رسائلي' : 'Mes messages'}
        </Text>
        <TouchableOpacity
          style={styles.newMessageBtn}
          onPress={() => setShowNewMessageModal(true)}
        >
          <Text style={styles.newMessageBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : messages.length === 0 ? (
        <EmptyMessages onContact={() => setShowNewMessageModal(true)} />
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {messages.map((msg) => (
            <View key={msg.id} style={styles.messageCardWrapper}>
              <TouchableOpacity
                style={[styles.messageCard, deleting === msg.id && styles.messageCardDeleting]}
                onPress={() => navigation.navigate('Conversation', { messageId: msg.id })}
                disabled={deleting === msg.id}
              >
                <View style={styles.messageHeader}>
                  <Text style={[styles.messageSubject, isRTL && styles.textRTL]} numberOfLines={1}>
                    {msg.sujet}
                  </Text>
                  {getStatusBadge(msg.status)}
                </View>
                <Text style={[styles.messagePreview, isRTL && styles.textRTL]} numberOfLines={2}>
                  {msg.message}
                </Text>
                <View style={styles.messageFooter}>
                  <Text style={styles.messageDate}>{formatDate(msg.createdAt)}</Text>
                  {msg.reponses && msg.reponses.length > 0 && (
                    <View style={styles.replyBadge}>
                      <Text style={styles.replyBadgeText}>
                        {msg.reponses.length} {language === 'ar' ? 'ردود' : 'réponse(s)'}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteMessage(msg)}
                disabled={deleting === msg.id}
              >
                {deleting === msg.id ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* Modal nouveau message */}
      <Modal
        visible={showNewMessageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewMessageModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isRTL && styles.textRTL]}>
                {language === 'ar' ? 'رسالة جديدة' : 'Nouveau message'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowNewMessageModal(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Sélection sujet */}
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                {language === 'ar' ? 'الموضوع' : 'Sujet'}
              </Text>
              <View style={styles.subjectsGrid}>
                {MESSAGE_SUBJECTS.map((subject) => (
                  <TouchableOpacity
                    key={subject}
                    style={[
                      styles.subjectOption,
                      selectedSubject === subject && styles.subjectOptionActive
                    ]}
                    onPress={() => setSelectedSubject(subject)}
                  >
                    <Text style={[
                      styles.subjectOptionText,
                      selectedSubject === subject && styles.subjectOptionTextActive
                    ]}>
                      {subject}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Message */}
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                {language === 'ar' ? 'رسالتك' : 'Votre message'}
              </Text>
              <TextInput
                style={[styles.textArea, isRTL && styles.textRTL]}
                value={messageText}
                onChangeText={setMessageText}
                placeholder={language === 'ar' ? 'اكتب رسالتك هنا...' : 'Écrivez votre message ici...'}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>
                {messageText.length}/500 {language === 'ar' ? 'حرف' : 'caractères'}
              </Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>
                    {language === 'ar' ? 'إرسال' : 'Envoyer'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: HEADER_PADDING_TOP,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  backButtonText: {
    fontSize: 24,
    color: colors.text,
  },
  title: {
    flex: 1,
    fontSize: fontSize.title,
    fontWeight: 'bold',
    color: colors.accent,
  },
  newMessageBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...platformShadow(4),
  },
  newMessageBtnText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: -2,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  goToMemberBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  goToMemberBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  emptyButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    fontSize: fontSize.md,
    color: '#fff',
    fontWeight: '600',
  },
  messageCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...platformShadow(2),
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  messageSubject: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  messagePreview: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageDate: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  replyBadge: {
    backgroundColor: 'rgba(201,162,39,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  replyBadgeText: {
    fontSize: fontSize.xs,
    color: colors.accent,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 100,
  },
  messageCardWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  messageCardDeleting: {
    opacity: 0.5,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  deleteBtnText: {
    fontSize: 18,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.accent,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontSize: 18,
    color: colors.text,
  },
  modalContent: {
    padding: spacing.lg,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  subjectOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  subjectOptionActive: {
    backgroundColor: 'rgba(201,162,39,0.2)',
    borderColor: colors.accent,
  },
  subjectOptionText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  subjectOptionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 150,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  charCount: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  modalFooter: {
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  sendButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: '#fff',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default MessagesScreen;
