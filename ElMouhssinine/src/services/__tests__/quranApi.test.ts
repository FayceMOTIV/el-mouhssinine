/**
 * Tests pour le service Quran API
 * Teste les exports, les donnees statiques et la construction d'URL
 * Note: les appels API utilisent isolateModules a cause du cache interne
 */

import { getAudioUrl, getVerseAudioUrl, reciters, surahsInfo } from '../quranApi';

describe('Quran API Service', () => {
  // ============================================================
  // DONNEES STATIQUES (pas de cache, testable directement)
  // ============================================================
  describe('Donnees statiques des sourates', () => {
    it('devrait contenir exactement 114 sourates', () => {
      expect(surahsInfo).toHaveLength(114);
    });

    it('devrait avoir la Fatiha en premier', () => {
      expect(surahsInfo[0].number).toBe(1);
      expect(surahsInfo[0].englishName).toBe('Al-Fatiha');
      expect(surahsInfo[0].ayahs).toBe(7);
    });

    it('devrait avoir An-Nas en dernier', () => {
      const last = surahsInfo[surahsInfo.length - 1];
      expect(last.number).toBe(114);
      expect(last.englishName).toBe('An-Nas');
      expect(last.ayahs).toBe(6);
    });

    it('devrait avoir des numeros sequentiels de 1 a 114', () => {
      surahsInfo.forEach((surah, index) => {
        expect(surah.number).toBe(index + 1);
      });
    });

    it('devrait avoir des noms arabes pour toutes les sourates', () => {
      surahsInfo.forEach((surah) => {
        expect(surah.name).toBeTruthy();
        expect(surah.name.length).toBeGreaterThan(0);
      });
    });

    it('devrait avoir le nombre correct de versets pour Al-Baqara (286)', () => {
      const baqara = surahsInfo.find(s => s.number === 2);
      expect(baqara?.ayahs).toBe(286);
    });

    it('devrait avoir le type Mecquoise ou Medinoise', () => {
      surahsInfo.forEach((surah) => {
        expect(['Mecquoise', 'Medinoise']).toContain(surah.type);
      });
    });

    it('devrait totaliser plus de 6000 versets', () => {
      const totalAyahs = surahsInfo.reduce((sum, s) => sum + s.ayahs, 0);
      expect(totalAyahs).toBeGreaterThan(6000);
    });
  });

  // ============================================================
  // RECITATEURS
  // ============================================================
  describe('Recitateurs', () => {
    it('devrait avoir au moins 5 recitateurs', () => {
      expect(reciters.length).toBeGreaterThanOrEqual(5);
    });

    it('devrait avoir Alafasy comme recitateur', () => {
      const alafasy = reciters.find(r => r.id === 'ar.alafasy');
      expect(alafasy).toBeDefined();
      expect(alafasy!.bitrate).toBe(128);
    });

    it('devrait avoir des champs requis pour chaque recitateur', () => {
      reciters.forEach((reciter) => {
        expect(reciter.id).toBeTruthy();
        expect(reciter.name).toBeTruthy();
        expect(reciter.nameAr).toBeTruthy();
        expect(reciter.country).toBeTruthy();
        expect(reciter.flag).toBeTruthy();
        expect(reciter.bitrate).toBeGreaterThan(0);
      });
    });

    it('devrait avoir des bitrates valides (64, 128, 192)', () => {
      reciters.forEach((reciter) => {
        expect([64, 128, 192]).toContain(reciter.bitrate);
      });
    });
  });

  // ============================================================
  // CONSTRUCTION D'URL AUDIO
  // ============================================================
  describe('getAudioUrl', () => {
    it('devrait construire l\'URL avec le recitateur par defaut', () => {
      const url = getAudioUrl(1);
      expect(url).toBe('https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/1.mp3');
    });

    it('devrait construire l\'URL avec un recitateur specifique', () => {
      const url = getAudioUrl(36, 'ar.husary');
      expect(url).toBe('https://cdn.islamic.network/quran/audio-surah/128/ar.husary/36.mp3');
    });

    it('devrait construire l\'URL pour la sourate 114', () => {
      const url = getAudioUrl(114);
      expect(url).toContain('/114.mp3');
    });
  });

  describe('getVerseAudioUrl', () => {
    it('devrait construire l\'URL du verset avec Alafasy (128)', () => {
      const url = getVerseAudioUrl(1);
      expect(url).toBe('https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3');
    });

    it('devrait utiliser le bitrate 192 pour abdulbasitmurattal', () => {
      const url = getVerseAudioUrl(1, 'ar.abdulbasitmurattal');
      expect(url).toContain('/audio/192/');
    });

    it('devrait fallback a 128 pour un recitateur inconnu', () => {
      const url = getVerseAudioUrl(1, 'ar.unknown');
      expect(url).toContain('/audio/128/');
    });

    it('devrait utiliser 64 pour saoodshuraym', () => {
      const url = getVerseAudioUrl(7, 'ar.saoodshuraym');
      expect(url).toContain('/audio/64/');
    });
  });
});
