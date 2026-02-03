/**
 * Tests pour le service Stripe - Tests unitaires des utilitaires
 */

describe('Stripe Service Utilities', () => {
  describe('eurosToCents conversion', () => {
    const eurosToCents = (euros: number): number => Math.round(euros * 100);

    it('should convert whole euros to cents', () => {
      expect(eurosToCents(10)).toBe(1000);
      expect(eurosToCents(50)).toBe(5000);
      expect(eurosToCents(100)).toBe(10000);
    });

    it('should convert decimal euros to cents', () => {
      expect(eurosToCents(10.50)).toBe(1050);
      expect(eurosToCents(9.99)).toBe(999);
      expect(eurosToCents(0.01)).toBe(1);
    });

    it('should handle rounding', () => {
      expect(eurosToCents(10.555)).toBe(1056); // Rounded up
      expect(eurosToCents(10.554)).toBe(1055); // Rounded down
    });

    it('should handle zero', () => {
      expect(eurosToCents(0)).toBe(0);
    });
  });

  describe('payment amount validation', () => {
    const MIN_AMOUNT = 1;
    const MAX_AMOUNT = 10000;

    const validatePaymentAmount = (amount: number): boolean => {
      if (typeof amount !== 'number' || isNaN(amount)) return false;
      if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) return false;
      return true;
    };

    it('should accept valid amounts', () => {
      expect(validatePaymentAmount(1)).toBe(true);
      expect(validatePaymentAmount(50)).toBe(true);
      expect(validatePaymentAmount(10000)).toBe(true);
    });

    it('should reject amounts below minimum', () => {
      expect(validatePaymentAmount(0)).toBe(false);
      expect(validatePaymentAmount(0.5)).toBe(false);
      expect(validatePaymentAmount(-10)).toBe(false);
    });

    it('should reject amounts above maximum', () => {
      expect(validatePaymentAmount(10001)).toBe(false);
      expect(validatePaymentAmount(100000)).toBe(false);
    });

    it('should reject invalid values', () => {
      expect(validatePaymentAmount(NaN)).toBe(false);
      expect(validatePaymentAmount(Infinity)).toBe(false);
    });
  });

  describe('payment metadata structure', () => {
    interface PaymentMetadata {
      projectId?: string;
      projectName?: string;
      memberId?: string;
      memberIdDisplay?: string;
      memberName?: string;
      email?: string;
      isAnonymous?: boolean;
      period?: string;
      membersCount?: string;
    }

    const createPaymentMetadata = (data: Partial<PaymentMetadata>): PaymentMetadata => {
      return {
        ...data,
      };
    };

    it('should create metadata for donation', () => {
      const metadata = createPaymentMetadata({
        projectId: 'project-123',
        projectName: 'Mosquée',
        email: 'donor@example.com',
        isAnonymous: false,
      });

      expect(metadata.projectId).toBe('project-123');
      expect(metadata.projectName).toBe('Mosquée');
      expect(metadata.isAnonymous).toBe(false);
    });

    it('should create metadata for cotisation', () => {
      const metadata = createPaymentMetadata({
        memberId: 'uid-123',
        memberIdDisplay: 'ELM-2026-0001',
        memberName: 'John Doe',
        email: 'john@example.com',
        period: 'annuel',
      });

      expect(metadata.memberId).toBe('uid-123');
      expect(metadata.memberIdDisplay).toBe('ELM-2026-0001');
      expect(metadata.period).toBe('annuel');
    });

    it('should create metadata for multi-member cotisation', () => {
      const metadata = createPaymentMetadata({
        memberId: 'uid-123',
        memberName: 'John Doe',
        membersCount: '3',
        period: 'annuel',
      });

      expect(metadata.membersCount).toBe('3');
    });

    it('should handle anonymous donation', () => {
      const metadata = createPaymentMetadata({
        projectId: 'project-123',
        isAnonymous: true,
      });

      expect(metadata.isAnonymous).toBe(true);
      expect(metadata.memberName).toBeUndefined();
    });
  });

  describe('payment type validation', () => {
    type PaymentType = 'donation' | 'cotisation';

    const isValidPaymentType = (type: string): type is PaymentType => {
      return type === 'donation' || type === 'cotisation';
    };

    it('should accept valid payment types', () => {
      expect(isValidPaymentType('donation')).toBe(true);
      expect(isValidPaymentType('cotisation')).toBe(true);
    });

    it('should reject invalid payment types', () => {
      expect(isValidPaymentType('invalid')).toBe(false);
      expect(isValidPaymentType('')).toBe(false);
      expect(isValidPaymentType('DONATION')).toBe(false);
    });
  });

  describe('payment description formatting', () => {
    const formatPaymentDescription = (
      type: 'donation' | 'cotisation',
      projectName?: string,
      memberName?: string
    ): string => {
      if (type === 'donation' && projectName) {
        return `Don - ${projectName}`;
      }
      if (type === 'cotisation' && memberName) {
        return `Cotisation - ${memberName}`;
      }
      return type === 'donation' ? 'Don' : 'Cotisation';
    };

    it('should format donation description with project', () => {
      expect(formatPaymentDescription('donation', 'Construction Mosquée')).toBe('Don - Construction Mosquée');
    });

    it('should format cotisation description with member', () => {
      expect(formatPaymentDescription('cotisation', undefined, 'John Doe')).toBe('Cotisation - John Doe');
    });

    it('should handle missing details', () => {
      expect(formatPaymentDescription('donation')).toBe('Don');
      expect(formatPaymentDescription('cotisation')).toBe('Cotisation');
    });
  });
});
