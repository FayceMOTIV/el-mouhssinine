/**
 * Source unique de verite pour le statut membre.
 * Utilise par firebase.ts, MemberCard.tsx, MyMembershipsScreen.tsx.
 *
 * Regle: le champ `data.status` Firestore est la source de verite.
 * `hasValidCotisation` sert UNIQUEMENT quand status est absent/vide.
 */

/** Statuts possibles stockes dans Firestore */
export type FirestoreStatus =
  | 'actif'
  | 'en_attente_paiement'
  | 'en_attente_validation'
  | 'en_attente_signature'
  | 'sympathisant'
  | 'annule'
  | 'expire'
  | 'aucun';

/** Donnees minimales necessaires pour calculer le statut */
export interface MemberStatusInput {
  status?: string;
  cotisationDateFin?: Date | { toDate: () => Date } | string | null;
}

/**
 * Calcule le statut normalise d'un membre.
 * 1. Si data.status est un statut connu -> le retourner tel quel
 * 2. Sinon, si la cotisation est valide (dateFin dans le futur) -> 'actif'
 * 3. Sinon -> 'en_attente_signature' (defaut pour nouveau membre)
 */
export const computeMemberStatus = (input: MemberStatusInput): FirestoreStatus => {
  const rawStatus = input.status?.trim().toLowerCase();

  const KNOWN_STATUSES: FirestoreStatus[] = [
    'actif',
    'en_attente_paiement',
    'en_attente_validation',
    'en_attente_signature',
    'sympathisant',
    'annule',
    'expire',
    'aucun',
  ];

  if (rawStatus && KNOWN_STATUSES.includes(rawStatus as FirestoreStatus)) {
    return rawStatus as FirestoreStatus;
  }

  // Status absent ou inconnu -> fallback sur la date de cotisation
  const hasValidCotisation = getHasValidCotisation(input.cotisationDateFin);
  return hasValidCotisation ? 'actif' : 'en_attente_signature';
};

/** Verifie si la cotisation est encore valide (dateFin dans le futur) */
export const getHasValidCotisation = (
  dateFin: Date | { toDate: () => Date } | string | null | undefined
): boolean => {
  if (!dateFin) return false;
  try {
    const date = typeof dateFin === 'object' && 'toDate' in dateFin
      ? dateFin.toDate()
      : new Date(dateFin as string | Date);
    return date.getTime() > Date.now();
  } catch {
    return false;
  }
};

/** Configuration badge pour affichage UI */
export interface StatusBadgeConfig {
  label: string;
  labelAr: string;
  color: string;
  bg: string;
}

const STATUS_BADGE_MAP: Record<FirestoreStatus, StatusBadgeConfig> = {
  actif: { label: 'Actif', labelAr: '\u0646\u0634\u0637', color: '#10B981', bg: 'rgba(34,197,94,0.15)' },
  en_attente_paiement: { label: 'En attente paiement', labelAr: '\u0641\u064a \u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u062f\u0641\u0639', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  en_attente_validation: { label: 'En attente', labelAr: '\u0641\u064a \u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u062a\u062d\u0642\u0642', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  en_attente_signature: { label: 'En attente signature', labelAr: '\u0641\u064a \u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u062a\u0648\u0642\u064a\u0639', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  sympathisant: { label: 'Sympathisant', labelAr: '\u0645\u062a\u0639\u0627\u0637\u0641', color: '#06B6D4', bg: 'rgba(6,182,212,0.15)' },
  annule: { label: 'Annul\u00e9', labelAr: '\u0645\u0644\u063a\u0649', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  expire: { label: 'Expir\u00e9', labelAr: '\u0645\u0646\u062a\u0647\u064a', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  aucun: { label: 'Aucun', labelAr: '\u0644\u0627 \u064a\u0648\u062c\u062f', color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
};

/** Retourne la config badge pour un statut donne */
export const getStatusBadgeConfig = (status: string): StatusBadgeConfig => {
  return STATUS_BADGE_MAP[status as FirestoreStatus] || STATUS_BADGE_MAP.en_attente_validation;
};
