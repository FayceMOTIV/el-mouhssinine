import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize, HEADER_PADDING_TOP, platformShadow } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';
import {
  subscribeToMessage,
  addUserReplyToMessage,
  UserMessage,
} from '../services/firebase';
import { clearBadgeCount } from '../services/notifications';

const ConversationScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { language, isRTL } = useLanguage();
  const scrollViewRef = useRef<ScrollView>(null);

  const { messageId } = route.params || {};

  const [message, setMessage] = useState<UserMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Effacer le badge quand on ouvre la conversation
  useEffect(() => {
    clearBadgeCount();
  }, []);

  // Charger le message
  useEffect(() => {
    if (!messageId) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToMessage(messageId, (msg) => {
      setMessage(msg);
      setLoading(false);
      // Scroll to bottom when new messages arrive
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => unsubscribe();
  }, [messageId]);

  // Envoyer une réponse
  const handleSendReply = async () => {
    if (replyText.trim().length < 10) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Erreur',
        language === 'ar' ? 'الرسالة قصيرة جدا (10 أحرف على الأقل)' : 'Message trop court (10 caractères minimum)'
      );
      return;
    }

    setSending(true);
    try {
      // Passer le userId du message pour vérification d'ownership
      const result = await addUserReplyToMessage(messageId, replyText.trim(), message?.odUserId);
      if (result.success) {
        setReplyText('');
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
      setSending(false);
    }
  };

  // Formatter la date
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; labelAr: string; color: string; bg: string }> = {
      non_lu: { label: 'En attente', labelAr: 'في الانتظار', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
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

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{language === 'ar' ? 'محادثة' : 'Conversation'}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  if (!message) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{language === 'ar' ? 'محادثة' : 'Conversation'}</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>❌</Text>
          <Text style={styles.emptyText}>
            {language === 'ar' ? 'الرسالة غير موجودة' : 'Message introuvable'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, isRTL && styles.textRTL]} numberOfLines={1}>
            {message.sujet}
          </Text>
          {getStatusBadge(message.status)}
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messagesContent}
      >
        {/* Message original */}
        <View style={styles.messageWrapper}>
          <View style={[styles.messageBubble, styles.userBubble]}>
            <Text style={[styles.messageText, isRTL && styles.textRTL]}>
              {message.message}
            </Text>
            <Text style={styles.messageTime}>{formatDate(message.createdAt)}</Text>
          </View>
          <Text style={styles.senderLabel}>
            {language === 'ar' ? 'أنت' : 'Vous'}
          </Text>
        </View>

        {/* Réponses */}
        {message.reponses && message.reponses.map((rep, index) => (
          <View key={rep.id || index} style={styles.messageWrapper}>
            <View style={[
              styles.messageBubble,
              rep.createdBy === 'mosquee' ? styles.adminBubble : styles.userBubble
            ]}>
              <Text style={[styles.messageText, isRTL && styles.textRTL]}>
                {rep.message}
              </Text>
              <Text style={styles.messageTime}>{formatDate(rep.createdAt)}</Text>
            </View>
            <Text style={[
              styles.senderLabel,
              rep.createdBy === 'mosquee' && styles.senderLabelAdmin
            ]}>
              {rep.createdBy === 'mosquee'
                ? (language === 'ar' ? '🕌 المسجد' : '🕌 Mosquée')
                : (language === 'ar' ? 'أنت' : 'Vous')
              }
            </Text>
          </View>
        ))}

        {/* Info si résolu */}
        {message.status === 'resolu' && (
          <View style={styles.resolvedNotice}>
            <Text style={styles.resolvedIcon}>✅</Text>
            <Text style={styles.resolvedText}>
              {language === 'ar'
                ? 'تم حل هذا الطلب'
                : 'Cette demande a été traitée'
              }
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Zone de réponse (si pas résolu) */}
      {message.status !== 'resolu' && (
        <View style={styles.replyContainer}>
          <TextInput
            style={[styles.replyInput, isRTL && styles.textRTL]}
            value={replyText}
            onChangeText={setReplyText}
            placeholder={language === 'ar' ? 'اكتب ردك...' : 'Écrivez votre réponse...'}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
            onPress={handleSendReply}
            disabled={sending || replyText.trim().length < 10}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendBtnText}>→</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
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
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.accent,
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
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
    textAlign: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  messageWrapper: {
    marginBottom: spacing.lg,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...platformShadow(2),
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  adminBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  messageTime: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  senderLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  senderLabelAdmin: {
    textAlign: 'left',
    color: colors.accent,
  },
  resolvedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  resolvedIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  resolvedText: {
    fontSize: fontSize.sm,
    color: '#22c55e',
    fontWeight: '600',
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  replyInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    maxHeight: 100,
    marginRight: spacing.sm,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default ConversationScreen;
