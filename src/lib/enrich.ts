import type { EnrichedMaengelverwaltung } from '@/types/enriched';
import type { Maengelverwaltung, Objektverwaltung } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface MaengelverwaltungMaps {
  objektverwaltungMap: Map<string, Objektverwaltung>;
}

export function enrichMaengelverwaltung(
  maengelverwaltung: Maengelverwaltung[],
  maps: MaengelverwaltungMaps
): EnrichedMaengelverwaltung[] {
  return maengelverwaltung.map(r => ({
    ...r,
    objektName: resolveDisplay(r.fields.objekt, maps.objektverwaltungMap, 'bezeichnung'),
  }));
}
