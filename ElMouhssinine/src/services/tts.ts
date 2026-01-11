// Text-to-Speech service using react-native-tts
import Tts from 'react-native-tts';

let ttsInitialized = false;

// Initialize TTS - exported for App.tsx
export const initTTS = async (): Promise<boolean> => {
  if (ttsInitialized) return true;

  try {
    // Configure for Arabic
    await Tts.setDefaultLanguage('ar-SA');
    await Tts.setDefaultRate(0.4); // Slower for learning
    await Tts.setDefaultPitch(1.0);

    // Add event listeners
    Tts.addEventListener('tts-start', () => console.log('[TTS] Started'));
    Tts.addEventListener('tts-finish', () => console.log('[TTS] Finished'));
    Tts.addEventListener('tts-error', (err: any) => console.log('[TTS] Error:', err));

    ttsInitialized = true;
    console.log('[TTS] Initialized successfully for Arabic');
    return true;
  } catch (error) {
    console.error('[TTS] Initialization error:', error);
    return false;
  }
};

export const speakArabic = async (text: string): Promise<void> => {
  try {
    // Initialize on first use
    await initTTS();

    // Stop any current speech
    await Tts.stop();

    // Speak the text with language option
    console.log('[TTS] Speaking:', text);
    await Tts.speak(text, {
      language: 'ar-SA',
      rate: 0.4,
    });
  } catch (error) {
    console.error('[TTS] Error speaking:', error);
    // Fallback: try without options
    try {
      Tts.speak(text);
    } catch (fallbackError) {
      console.error('[TTS] Fallback also failed:', fallbackError);
    }
  }
};

export const isTtsAvailable = (): boolean => {
  // TTS is always available since we import it statically
  return true;
};

// Stop current speech
export const stopSpeaking = async (): Promise<void> => {
  try {
    await Tts.stop();
  } catch (error) {
    console.error('[TTS] Error stopping:', error);
  }
};

export default {
  speakArabic,
  isTtsAvailable,
  stopSpeaking,
};
