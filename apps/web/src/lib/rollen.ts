import type { RolleTyp } from '@soziolog/shared';

/** Alle soziokratischen Funktionsrollen (unabhängig von der Software-Rolle Admin). */
export const ROLLEN: RolleTyp[] = ['moderation', 'logbuchfuehrer', 'delegierte'];

/** Rollennamen in Verbform (wie im Design). */
export const ROLLEN_LABEL: Record<RolleTyp, string> = {
  moderation: 'Moderierend',
  logbuchfuehrer: 'Logbuchführend',
  delegierte: 'Delegiert',
};
