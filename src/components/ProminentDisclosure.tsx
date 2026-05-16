/**
 * ProminentDisclosure
 *
 * Popup affichée au PREMIER lancement de l'application, AVANT toute demande
 * de permission système. Conforme aux exigences Google Play pour l'usage de
 * ACCESS_FINE_LOCATION (foreground only — Qibla + mosque proximity).
 *
 * Doit rester affichée tant que l'utilisateur n'a pas explicitement accepté
 * ou refusé, et le choix est persisté dans AsyncStorage.
 *
 * Réf. : https://support.google.com/googleplay/android-developer/answer/9799150
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISCLOSURE_STORAGE_KEY = '@el_mouhssinine/prominent_disclosure_v1';

type DisclosureChoice = 'accepted' | 'declined';

interface ProminentDisclosureProps {
  onDone: (choice: DisclosureChoice) => void;
}

export const hasSeenProminentDisclosure = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(DISCLOSURE_STORAGE_KEY);
    return value === 'accepted' || value === 'declined';
  } catch {
    return false;
  }
};

export const getProminentDisclosureChoice =
  async (): Promise<DisclosureChoice | null> => {
    try {
      const value = await AsyncStorage.getItem(DISCLOSURE_STORAGE_KEY);
      if (value === 'accepted' || value === 'declined') return value;
      return null;
    } catch {
      return null;
    }
  };

const ProminentDisclosure: React.FC<ProminentDisclosureProps> = ({
  onDone,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const seen = await hasSeenProminentDisclosure();
      if (!seen) setVisible(true);
    })();
  }, []);

  const persistChoice = async (choice: DisclosureChoice) => {
    try {
      await AsyncStorage.setItem(DISCLOSURE_STORAGE_KEY, choice);
    } catch {
      // Persistance best-effort — on laisse passer pour ne pas bloquer l'UX
    }
    setVisible(false);
    onDone(choice);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            <Text style={styles.icon}>🕌</Text>
            <Text style={styles.title}>Utilisation de votre localisation</Text>

            <Text style={styles.paragraph}>
              El Mouhssinine souhaite accéder à la position de votre appareil
              lorsque vous utilisez l'application pour :
            </Text>
            <Text style={styles.paragraph}>
              • Calculer les horaires de prière précis selon votre position
              géographique{'\n'}
              • Déterminer la direction de la Qibla (boussole){'\n'}
              • Détecter lorsque vous approchez de la mosquée et vous rappeler
              de mettre votre téléphone en mode silencieux
            </Text>

            <View style={styles.bulletBlock}>
              <Text style={styles.bullet}>
                ✓ Vos coordonnées GPS{' '}
                <Text style={styles.bold}>restent sur votre téléphone</Text> et
                ne sont jamais envoyées sur un serveur.
              </Text>
              <Text style={styles.bullet}>
                ✓ Aucune donnée de localisation n'est partagée avec des tiers,
                ni utilisée à des fins publicitaires ou commerciales.
              </Text>
              <Text style={styles.bullet}>
                ✓ Cette fonctionnalité est{' '}
                <Text style={styles.bold}>entièrement optionnelle</Text>. Vous
                pouvez la désactiver à tout moment depuis l'onglet « Plus » de
                l'application, ou retirer l'autorisation dans les paramètres
                système.
              </Text>
              <Text style={styles.bullet}>
                ✓ Si vous refusez, l'application continue de fonctionner
                normalement, sans le rappel automatique à l'approche de la
                mosquée.
              </Text>
            </View>

            <Text style={styles.paragraphSmall}>
              Pour en savoir plus, consultez notre politique de confidentialité
              :{'\n'}
              https://el-mouhssinine.web.app/privacy-policy.html
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => persistChoice('declined')}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonSecondaryText}>Refuser</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={() => persistChoice('accepted')}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonPrimaryText}>Accepter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  icon: {
    fontSize: 44,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    marginBottom: 14,
  },
  paragraphSmall: {
    fontSize: 12,
    lineHeight: 18,
    color: '#666',
    marginTop: 6,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '700',
    color: '#1a1a1a',
  },
  bulletBlock: {
    backgroundColor: '#f5f3ef',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonSecondary: {
    backgroundColor: '#eee',
    marginRight: 8,
  },
  buttonSecondaryText: {
    color: '#444',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonPrimary: {
    backgroundColor: '#5c3a1a',
    marginLeft: 8,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default ProminentDisclosure;
