/**
 * Tests pour le logger utilitaire
 */
import { logger, maskEmail, maskUid } from '../logger';

describe('Logger Utilities', () => {
  describe('maskEmail', () => {
    it('should mask email correctly with long local part', () => {
      expect(maskEmail('john.doe@example.com')).toBe('j***e@example.com');
    });

    it('should mask email with short local part', () => {
      // Pour les emails courts (<=2 chars), le comportement peut varier
      const result = maskEmail('ab@example.com');
      expect(result).toMatch(/^a\*+.*@example\.com$/);
    });

    it('should mask single character local part', () => {
      const result = maskEmail('a@example.com');
      expect(result).toContain('***');
      expect(result).toContain('@example.com');
    });

    it('should return *** for empty string', () => {
      expect(maskEmail('')).toBe('***');
    });

    it('should return *** for null/undefined', () => {
      expect(maskEmail(null as any)).toBe('***');
      expect(maskEmail(undefined as any)).toBe('***');
    });

    it('should return *** for invalid email without @', () => {
      expect(maskEmail('invalidemail')).toBe('***');
    });

    it('should handle email with subdomain', () => {
      expect(maskEmail('user@mail.example.com')).toBe('u***r@mail.example.com');
    });
  });

  describe('maskUid', () => {
    it('should truncate uid to 8 characters', () => {
      expect(maskUid('abc123def456ghi789')).toBe('abc123de...');
    });

    it('should handle short uid', () => {
      expect(maskUid('short')).toBe('short...');
    });

    it('should return *** for empty string', () => {
      expect(maskUid('')).toBe('***');
    });

    it('should return *** for null/undefined', () => {
      expect(maskUid(null as any)).toBe('***');
      expect(maskUid(undefined as any)).toBe('***');
    });

    it('should handle exactly 8 character uid', () => {
      expect(maskUid('12345678')).toBe('12345678...');
    });
  });

  describe('logger', () => {
    let consoleSpy: {
      log: jest.SpyInstance;
      warn: jest.SpyInstance;
      error: jest.SpyInstance;
      info: jest.SpyInstance;
      debug: jest.SpyInstance;
    };

    beforeEach(() => {
      consoleSpy = {
        log: jest.spyOn(console, 'log').mockImplementation(),
        warn: jest.spyOn(console, 'warn').mockImplementation(),
        error: jest.spyOn(console, 'error').mockImplementation(),
        info: jest.spyOn(console, 'info').mockImplementation(),
        debug: jest.spyOn(console, 'debug').mockImplementation(),
      };
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('in development mode', () => {
      it('should log messages in dev mode', () => {
        logger.log('test message');
        expect(consoleSpy.log).toHaveBeenCalledWith('test message');
      });

      it('should warn messages in dev mode', () => {
        logger.warn('warning message');
        expect(consoleSpy.warn).toHaveBeenCalledWith('warning message');
      });

      it('should error messages', () => {
        logger.error('error message', new Error('test'));
        expect(consoleSpy.error).toHaveBeenCalled();
      });

      it('should info messages in dev mode', () => {
        logger.info('info message');
        expect(consoleSpy.info).toHaveBeenCalledWith('info message');
      });

      it('should debug messages in dev mode', () => {
        logger.debug('debug message');
        expect(consoleSpy.debug).toHaveBeenCalledWith('debug message');
      });
    });

    describe('api logger', () => {
      it('should mask email in params', () => {
        logger.api('/users', { email: 'test@example.com', name: 'Test' });
        expect(consoleSpy.log).toHaveBeenCalledWith(
          '[API] /users',
          expect.objectContaining({
            email: 't***t@example.com',
            name: 'Test',
          })
        );
      });

      it('should mask uid in params', () => {
        logger.api('/users', { uid: 'abc123def456', name: 'Test' });
        expect(consoleSpy.log).toHaveBeenCalledWith(
          '[API] /users',
          expect.objectContaining({
            uid: 'abc123de...',
            name: 'Test',
          })
        );
      });

      it('should handle undefined params', () => {
        logger.api('/users');
        expect(consoleSpy.log).toHaveBeenCalledWith('[API] /users', undefined);
      });
    });

    describe('firebase logger', () => {
      it('should log with [Firebase] prefix', () => {
        logger.firebase('getUser', 'user123');
        expect(consoleSpy.log).toHaveBeenCalledWith('[Firebase] getUser', 'user123');
      });
    });

    describe('auth logger', () => {
      it('should mask email in auth logs', () => {
        logger.auth('signIn', 'user@example.com');
        expect(consoleSpy.log).toHaveBeenCalledWith(
          '[Auth] signIn',
          'u***r@example.com'
        );
      });

      it('should handle undefined email', () => {
        logger.auth('signOut');
        expect(consoleSpy.log).toHaveBeenCalledWith('[Auth] signOut', undefined);
      });
    });
  });
});
