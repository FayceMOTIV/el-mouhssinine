// Text-to-Speech service using react-native-tts
import { logger } from '../utils';

let Tts: any = null;
let ttsInitialized = false;
let listenersAdded = false;

const loadTts = () => {
  if (Tts) return true;
  try {
    Tts = require('react-native-tts').default;
    return true;
  } catch (e) {
    logger.error('[TTS] Native module failed to load:', e);
    return false;
  }
};

// Initialize TTS - exported for App.tsx
export const initTTS = async (): Promise<boolean> => {
  if (ttsInitialized) return true;
  if (!loadTts()) return false;

  try {
    // Ajouter les listeners une seule fois
    if (!listenersAdded) {
      Tts.addEventListener('tts-start', () => logger.log('[TTS] Started'));
      Tts.addEventListener('tts-finish', () => logger.log('[TTS] Finished'));
      Tts.addEventListener('tts-error', (err: any) => logger.log('[TTS] Error:', err));
      listenersAdded = true;
    }

    // Configure for Arabic - try ar-SA, fallback to ar
    try {
      await Tts.setDefaultLanguage('ar-SA');
    } catch {
      logger.log('[TTS] ar-SA not available, trying ar...');
      try {
        await Tts.setDefaultLanguage('ar');
      } catch {
        logger.log('[TTS] ar not available, will use system default');
      }
    }

    await Tts.setDefaultRate(0.4, false); // Slower for learning
    await Tts.setDefaultPitch(1.0);

    ttsInitialized = true;
    logger.log('[TTS] Initialized successfully');
    return true;
  } catch (error) {
    logger.error('[TTS] Initialization error:', error);
    return false;
  }
};

export const speakArabic = async (text: string): Promise<void> => {
  try {
    if (!ttsInitialized) {
      await initTTS();
    }
    if (!Tts) return;

    await Tts.stop();

    // Speak the text
    logger.log('[TTS] Speaking:', text);
    await Tts.speak(text, {
      iosVoiceId: '',  // Laisser iOS choisir la meilleure voix disponible
      rate: 0.4,
    } as any);
  } catch (error) {
    logger.error('[TTS] Error speaking:', error);
    // Fallback: try without options
    try {
      await Tts.speak(text);
    } catch (fallbackError) {
      logger.error('[TTS] Fallback also failed:', fallbackError);
    }
  }
};

export const isTtsAvailable = (): boolean => {
  return true;
};

export const stopSpeaking = async (): Promise<void> => {
  try {
    if (!Tts) return;
    await Tts.stop();
  } catch (error) {
    logger.error('[TTS] Error stopping:', error);
  }
};

export default {
  speakArabic,
  isTtsAvailable,
  stopSpeaking,
};
