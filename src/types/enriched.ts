import type { Maengelverwaltung } from './app';

export type EnrichedMaengelverwaltung = Maengelverwaltung & {
  objektName: string;
};
