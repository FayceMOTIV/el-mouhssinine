/**
 * Tests pour le service Text-to-Speech
 */

import Tts from 'react-native-tts';

describe('TTS Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isTtsAvailable', () => {
    it('devrait retourner true', () => {
      // Utilise isolateModules car le module a un etat interne (ttsInitialized)
      jest.isolateModules(() => {
        const { isTtsAvailable } = require('../tts');
        expect(isTtsAvailable()).toBe(true);
      });
    });
  });

  describe('initTTS', () => {
    it('devrait initialiser le TTS avec la langue arabe', (done) => {
      jest.isolateModules(() => {
        const { initTTS } = require('../tts');
        initTTS().then((result: boolean) => {
          expect(result).toBe(true);
          expect(Tts.setDefaultLanguage).toHaveBeenCalledWith('ar-SA');
          expect(Tts.setDefaultRate).toHaveBeenCalledWith(0.4, false);
          expect(Tts.setDefaultPitch).toHaveBeenCalledWith(1.0);
          done();
        });
      });
    });
  });

  describe('speakArabic', () => {
    it('devrait parler le texte en arabe', (done) => {
      jest.isolateModules(() => {
        const { speakArabic } = require('../tts');
        speakArabic('بسم الله').then(() => {
          expect(Tts.stop).toHaveBeenCalled();
          expect(Tts.speak).toHaveBeenCalled();
          done();
        });
      });
    });
  });

  describe('stopSpeaking', () => {
    it('devrait arreter la lecture', (done) => {
      jest.isolateModules(() => {
        const { initTTS, stopSpeaking } = require('../tts');
        initTTS().then(() => {
          stopSpeaking().then(() => {
            expect(Tts.stop).toHaveBeenCalled();
            done();
          });
        });
      });
    });

    it('devrait gerer les erreurs silencieusement', (done) => {
      (Tts.stop as jest.Mock).mockRejectedValueOnce(new Error('No speech'));
      jest.isolateModules(() => {
        const { stopSpeaking } = require('../tts');
        stopSpeaking().then(() => {
          // Pas d'exception = succes
          done();
        });
      });
    });
  });
});
