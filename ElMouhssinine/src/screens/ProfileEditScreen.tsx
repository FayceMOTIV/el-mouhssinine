import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize, HEADER_PADDING_TOP } from '../theme/colors';
import { BackgroundPattern } from '../components/BackgroundPattern';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

type ProfileEditRouteParams = {
  ProfileEdit: {
    uid: string;
    nom: string;
    prenom: string;
    telephone: string;
    adresse: string;
    email: string;
  };
};

const ProfileEditScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ProfileEditRouteParams, 'ProfileEdit'>>();
  const { uid, nom, prenom, telephone, adresse, email } = route.params;

  const [editedNom, setEditedNom] = useState(nom || '');
  const [editedPrenom, setEditedPrenom] = useState(prenom || '');
  const [editedTelephone, setEditedTelephone] = useState(telephone || '');
  const [editedAdresse, setEditedAdresse] = useState(adresse || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    // Validation
    if (!editedPrenom.trim() || !editedNom.trim()) {
      Alert.alert('Erreur', 'Le prénom et le nom sont obligatoires');
      return;
    }

    if (!editedTelephone.trim()) {
      Alert.alert('Erreur', 'Le téléphone est obligatoire');
      return;
    }

    setIsSaving(true);

    try {
      // Mettre à jour dans Firestore
      await firestore()
        .collection('members')
        .doc(uid)
        .update({
          nom: editedNom.trim(),
          prenom: editedPrenom.trim(),
          telephone: editedTelephone.trim(),
          adresse: editedAdresse.trim(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      Alert.alert(
        'Succès',
        'Votre profil a été mis à jour avec succès',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('[ProfileEdit] Error updating profile:', error);
      Alert.alert(
        'Erreur',
        error?.message || 'Une erreur est survenue lors de la mise à jour'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BackgroundPattern>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Modifier mon profil</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {/* Prénom */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Prénom *</Text>
              <TextInput
                style={styles.input}
                value={editedPrenom}
                onChangeText={setEditedPrenom}
                placeholder="Votre prénom"
                placeholderTextColor={colors.textMuted}
                editable={!isSaving}
              />
            </View>

            {/* Nom */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nom *</Text>
              <TextInput
                style={styles.input}
                value={editedNom}
                onChangeText={setEditedNom}
                placeholder="Votre nom"
                placeholderTextColor={colors.textMuted}
                editable={!isSaving}
              />
            </View>

            {/* Téléphone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Téléphone *</Text>
              <TextInput
                style={styles.input}
                value={editedTelephone}
                onChangeText={setEditedTelephone}
                placeholder="06 12 34 56 78"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                editable={!isSaving}
              />
            </View>

            {/* Adresse */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Adresse</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editedAdresse}
                onChangeText={setEditedAdresse}
                placeholder="Votre adresse complète"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                editable={!isSaving}
              />
            </View>

            {/* Email (lecture seule) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.input, styles.inputDisabled]}>
                <Text style={styles.disabledText}>{email}</Text>
              </View>
              <Text style={styles.helperText}>
                L'email ne peut pas être modifié
              </Text>
            </View>

            {/* Bouton Enregistrer */}
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </BackgroundPattern>
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
    justifyContent: 'space-between',
    paddingTop: HEADER_PADDING_TOP,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.primary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#fff',
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.border,
  },
  disabledText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  helperText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#fff',
  },
});

export default ProfileEditScreen;
