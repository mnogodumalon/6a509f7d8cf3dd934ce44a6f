// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Objektverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    stadt?: string;
    baujahr?: number;
    anzahl_einheiten?: number;
    vermietungsstand?: number;
  };
}

export interface Maengelverwaltung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    objekt?: string; // applookup -> URL zu 'Objektverwaltung' Record
    beschreibung?: string;
    dringlichkeit?: LookupValue;
    melder_vorname?: string;
    melder_nachname?: string;
    meldedatum?: string; // Format: YYYY-MM-DD oder ISO String
    handwerker?: string;
    status?: LookupValue;
    fotos?: string;
  };
}

export const APP_IDS = {
  OBJEKTVERWALTUNG: '6a509f6c054779eb935038b7',
  MAENGELVERWALTUNG: '6a509f6e847d39d638f5f86a',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'maengelverwaltung': {
    dringlichkeit: [{ key: "niedrig", label: "Niedrig" }, { key: "mittel", label: "Mittel" }, { key: "hoch", label: "Hoch" }, { key: "dringend", label: "Dringend" }],
    status: [{ key: "offen", label: "Offen" }, { key: "beauftragt", label: "Beauftragt" }, { key: "erledigt", label: "Erledigt" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'objektverwaltung': {
    'bezeichnung': 'string/text',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'stadt': 'string/text',
    'baujahr': 'number',
    'anzahl_einheiten': 'number',
    'vermietungsstand': 'number',
  },
  'maengelverwaltung': {
    'objekt': 'applookup/select',
    'beschreibung': 'string/textarea',
    'dringlichkeit': 'lookup/radio',
    'melder_vorname': 'string/text',
    'melder_nachname': 'string/text',
    'meldedatum': 'date/date',
    'handwerker': 'string/text',
    'status': 'lookup/radio',
    'fotos': 'file',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateObjektverwaltung = StripLookup<Objektverwaltung['fields']>;
export type CreateMaengelverwaltung = StripLookup<Maengelverwaltung['fields']>;