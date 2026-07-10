import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichMaengelverwaltung } from '@/lib/enrich';
import type { EnrichedMaengelverwaltung } from '@/types/enriched';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { lookupKey } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { IconAlertCircle, IconTool, IconRefresh, IconCheck, IconAlertTriangle, IconBuilding, IconPlus } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { KanbanWidget, KanbanSkeleton, KanbanError, type KanbanCard, type KanbanColumn } from '@/components/widgets/KanbanWidget';
import {
  RecordOverlay,
  RecordHeader,
  RecordSection,
  RecordField,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { MaengelverwaltungDialog } from '@/components/dialogs/MaengelverwaltungDialog';
import { ObjektverwaltungDialog } from '@/components/dialogs/ObjektverwaltungDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';

const APPGROUP_ID = '6a509f7d8cf3dd934ce44a6f';
const REPAIR_ENDPOINT = '/claude/build/repair';

// Kanban columns from schema — DECLARE ALL lookup values
const MANGEL_COLUMNS: KanbanColumn[] = (LOOKUP_OPTIONS['maengelverwaltung']?.['status'] ?? []).map(o => ({
  key: o.key,
  label: o.label,
}));

function toneForStatus(status: string | undefined) {
  if (status === 'offen') return 'warning' as const;
  if (status === 'beauftragt') return 'primary' as const;
  if (status === 'erledigt') return 'success' as const;
  return 'default' as const;
}

function toneForDringlichkeit(d: string | undefined) {
  if (d === 'dringend') return 'destructive' as const;
  if (d === 'hoch') return 'warning' as const;
  return 'default' as const;
}

export default function DashboardOverview() {
  const {
    objektverwaltung, setMaengelverwaltung, maengelverwaltung,
    objektverwaltungMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const clock = useClock();

  const enrichedMaengel = enrichMaengelverwaltung(maengelverwaltung, { objektverwaltungMap });

  // Dialog state
  const [createMangelOpen, setCreateMangelOpen] = useState(false);
  const [createMangelDefaults, setCreateMangelDefaults] = useState<Record<string, unknown>>({});
  const [createObjektOpen, setCreateObjektOpen] = useState(false);

  // Overlay
  const overlay = useRecordOverlayStack<{ type: 'mangel' | 'objekt'; id: string }>();

  // Derived data — ALL hooks before early returns
  const offeneMaengel = useMemo(
    () => enrichedMaengel.filter(m => lookupKey(m.fields.status) === 'offen'),
    [enrichedMaengel],
  );
  const dringendeMaengel = useMemo(
    () => offeneMaengel.filter(m => lookupKey(m.fields.dringlichkeit) === 'dringend' || lookupKey(m.fields.dringlichkeit) === 'hoch'),
    [offeneMaengel],
  );
  const erledigteMaengel = useMemo(
    () => enrichedMaengel.filter(m => lookupKey(m.fields.status) === 'erledigt'),
    [enrichedMaengel],
  );

  // KPI filter state
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Kanban cards
  const cards = useMemo<KanbanCard[]>(() => {
    const source = statusFilter
      ? enrichedMaengel.filter(m => lookupKey(m.fields.status) === statusFilter)
      : enrichedMaengel;
    return source.map(m => {
      const status = lookupKey(m.fields.status) ?? 'offen';
      const dring = lookupKey(m.fields.dringlichkeit);
      return {
        id: `mangel:${m.record_id}`,
        column: status,
        title: m.fields.beschreibung
          ? m.fields.beschreibung.length > 60
            ? m.fields.beschreibung.slice(0, 60) + '…'
            : m.fields.beschreibung
          : 'Ohne Beschreibung',
        subtitle: (
          <span className="flex flex-wrap gap-1 text-xs text-muted-foreground">
            {m.objektName && <span>{m.objektName}</span>}
            {m.objektName && dring && <span>·</span>}
            {dring && (
              <span className={
                dring === 'dringend' ? 'text-destructive font-medium' :
                dring === 'hoch' ? 'text-amber-600 font-medium' :
                'text-muted-foreground'
              }>{m.fields.dringlichkeit?.label ?? dring}</span>
            )}
          </span>
        ),
        tone: toneForStatus(status),
      };
    });
  }, [enrichedMaengel, statusFilter]);

  // Advance status helper (shared across board, worklist, overlay)
  const advanceStatus = async (mangel: EnrichedMaengelverwaltung) => {
    const current = lookupKey(mangel.fields.status);
    const next = current === 'offen' ? 'beauftragt' : current === 'beauftragt' ? 'erledigt' : null;
    if (!next) return;
    const prev = mangel.fields.status;
    // Optimistic update
    setMaengelverwaltung(all =>
      all.map(m => m.record_id === mangel.record_id
        ? { ...m, fields: { ...m.fields, status: { key: next, label: next === 'beauftragt' ? 'Beauftragt' : 'Erledigt' } } }
        : m,
      ),
    );
    undoToast(
      next === 'beauftragt' ? 'Mangel beauftragt' : 'Mangel erledigt',
      async () => {
        setMaengelverwaltung(all =>
          all.map(m => m.record_id === mangel.record_id
            ? { ...m, fields: { ...m.fields, status: prev } }
            : m,
          ),
        );
        await LivingAppsService.updateMaengelverwaltungEntry(mangel.record_id, { status: typeof prev === 'object' && prev && 'key' in prev ? (prev as { key: string }).key : String(prev ?? '') });
      },
    );
    try {
      await LivingAppsService.updateMaengelverwaltungEntry(mangel.record_id, { status: next });
    } catch {
      fetchAll();
    }
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Overlay targets
  const overlayMangel = overlay.top?.type === 'mangel'
    ? enrichedMaengel.find(m => m.record_id === overlay.top!.id)
    : undefined;
  const overlayObjekt = overlay.top?.type === 'objekt'
    ? objektverwaltung.find(o => o.record_id === overlay.top!.id)
    : undefined;

  // Context line
  const dringlNamen = namen(dringendeMaengel.map(m => m.objektName || m.fields.beschreibung?.slice(0, 20) || ''));
  const contextLine = dringendeMaengel.length > 0
    ? `${dringlNamen} ${dringendeMaengel.length === 1 ? 'hat einen dringenden Mangel' : 'haben dringende Mängel'} — sofortige Bearbeitung erforderlich.`
    : offeneMaengel.length > 0
      ? `${offeneMaengel.length} ${offeneMaengel.length === 1 ? 'offener Mangel' : 'offene Mängel'} warten auf Beauftragung.`
      : `Alles im Griff — ${erledigteMaengel.length} ${erledigteMaengel.length === 1 ? 'Mangel erledigt' : 'Mängel erledigt'}.`;

  return (
    <>
      {/* Page header — above the grid */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setCreateObjektOpen(true)}>
            <IconBuilding size={14} className="mr-1.5 shrink-0" />
            Objekt anlegen
          </Button>
          <Button size="sm" onClick={() => { setCreateMangelDefaults({}); setCreateMangelOpen(true); }}>
            <IconPlus size={14} className="mr-1.5 shrink-0" />
            Mangel melden
          </Button>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={dringendeMaengel.length > 0 && (
          <HeroBanner
            tone="destructive"
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: 'Beauftragen',
              onClick: () => {
                const first = dringendeMaengel[0];
                if (first) void advanceStatus(first);
              },
            }}
          >
            <b>{dringlNamen}</b> — {dringendeMaengel.length === 1 ? 'dringender Mangel' : `${dringendeMaengel.length} dringende Mängel`} warten auf sofortige Beauftragung.
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Offen"
              value={offeneMaengel.length}
              tone={offeneMaengel.length > 0 ? 'warning' : 'default'}
              onClick={() => setStatusFilter(f => f === 'offen' ? null : 'offen')}
              active={statusFilter === 'offen'}
            />
            <StatStripItem
              title="Beauftragt"
              value={enrichedMaengel.filter(m => lookupKey(m.fields.status) === 'beauftragt').length}
              tone="default"
              onClick={() => setStatusFilter(f => f === 'beauftragt' ? null : 'beauftragt')}
              active={statusFilter === 'beauftragt'}
            />
            <StatStripItem
              title="Erledigt"
              value={erledigteMaengel.length}
              tone={erledigteMaengel.length > 0 ? 'success' : 'default'}
              onClick={() => setStatusFilter(f => f === 'erledigt' ? null : 'erledigt')}
              active={statusFilter === 'erledigt'}
            />
            <StatStripItem
              title="Objekte"
              value={objektverwaltung.length}
              tone="default"
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            cards={cards}
            columns={MANGEL_COLUMNS}
            defaultCollapsed={['erledigt']}
            onCardClick={card => overlay.replace({ type: 'mangel', id: card.id.split(':')[1] ?? '' })}
            onCardMove={async (cardId, newColumn) => {
              const rid = cardId.split(':')[1];
              if (!rid) return;
              const mangel = maengelverwaltung.find(m => m.record_id === rid);
              if (!mangel) return;
              const prevStatus = mangel.fields.status;
              setMaengelverwaltung(all =>
                all.map(m => m.record_id === rid
                  ? { ...m, fields: { ...m.fields, status: { key: newColumn, label: MANGEL_COLUMNS.find(c => c.key === newColumn)?.label as string ?? newColumn } } }
                  : m,
                ),
              );
              undoToast(
                `Status geändert zu "${MANGEL_COLUMNS.find(c => c.key === newColumn)?.label ?? newColumn}"`,
                async () => {
                  setMaengelverwaltung(all =>
                    all.map(m => m.record_id === rid
                      ? { ...m, fields: { ...m.fields, status: prevStatus } }
                      : m,
                    ),
                  );
                  const prevKey = typeof prevStatus === 'object' && prevStatus && 'key' in prevStatus
                    ? (prevStatus as { key: string }).key
                    : String(prevStatus ?? '');
                  await LivingAppsService.updateMaengelverwaltungEntry(rid, { status: prevKey });
                },
              );
              try {
                await LivingAppsService.updateMaengelverwaltungEntry(rid, { status: newColumn });
              } catch {
                fetchAll();
              }
            }}
            onAddCard={column => {
              setCreateMangelDefaults({ status: column });
              setCreateMangelOpen(true);
            }}
          />
        }
        aside={
          <>
            {/* Dringende / offene Mängel — cross-stage time axis */}
            <WorkList
              title="Dringend & offen"
              icon={<IconAlertCircle size={14} />}
              items={enrichedMaengel
                .filter(m => {
                  const st = lookupKey(m.fields.status);
                  const dr = lookupKey(m.fields.dringlichkeit);
                  return (st === 'offen' || st === 'beauftragt') && (dr === 'dringend' || dr === 'hoch');
                })
                .sort((a, b) => {
                  const orderA = lookupKey(a.fields.dringlichkeit) === 'dringend' ? 0 : 1;
                  const orderB = lookupKey(b.fields.dringlichkeit) === 'dringend' ? 0 : 1;
                  return orderA - orderB;
                })
                .map(m => {
                  const status = lookupKey(m.fields.status);
                  const dring = lookupKey(m.fields.dringlichkeit);
                  const nextLabel = status === 'offen' ? '→ Beauftragen' : '✓ Erledigen';
                  return {
                    id: m.record_id,
                    title: m.objektName || 'Unbekanntes Objekt',
                    secondLine: (
                      <span className="flex flex-wrap gap-1">
                        <span className={dring === 'dringend' ? 'font-medium text-destructive' : 'font-medium text-amber-600'}>
                          {m.fields.dringlichkeit?.label ?? dring}
                        </span>
                        {m.fields.meldedatum && (
                          <span className="text-muted-foreground">· {formatDate(m.fields.meldedatum)}</span>
                        )}
                      </span>
                    ),
                    action: { label: nextLabel, onClick: () => void advanceStatus(m) },
                  };
                })
              }
              onItemClick={id => overlay.replace({ type: 'mangel', id })}
              empty={{
                text: 'Keine dringenden Mängel — alles im Griff.',
                action: { label: 'Mangel melden', onClick: () => { setCreateMangelDefaults({}); setCreateMangelOpen(true); } },
              }}
            />

            {/* Objektübersicht */}
            <WorkList
              title="Objekte"
              icon={<IconBuilding size={14} />}
              items={objektverwaltung.map(o => {
                const mangelCount = maengelverwaltung.filter(m => {
                  const rid = m.fields.objekt ? m.fields.objekt.match(/([a-f0-9]{24})$/i)?.[1] : null;
                  return rid === o.record_id && lookupKey(m.fields.status) !== 'erledigt';
                }).length;
                return {
                  id: o.record_id,
                  title: o.fields.bezeichnung ?? 'Unbekanntes Objekt',
                  secondLine: (
                    <span className="flex flex-wrap gap-1 text-xs">
                      <span className="text-muted-foreground">
                        {o.fields.strasse} {o.fields.hausnummer}, {o.fields.stadt}
                      </span>
                      {mangelCount > 0 && (
                        <span className={`font-medium ${mangelCount > 2 ? 'text-destructive' : 'text-amber-600'}`}>
                          · {mangelCount} {mangelCount === 1 ? 'Mangel' : 'Mängel'} offen
                        </span>
                      )}
                    </span>
                  ),
                };
              })}
              onItemClick={id => overlay.replace({ type: 'objekt', id })}
              empty={{
                text: 'Noch keine Objekte angelegt.',
                action: { label: 'Objekt anlegen', onClick: () => setCreateObjektOpen(true) },
              }}
            />
          </>
        }
      />

      {/* Mangel Detail Overlay */}
      <RecordOverlay
        open={overlay.open && overlay.top?.type === 'mangel'}
        onClose={overlay.close}
        ariaLabel="Mangel"
        footer={overlayMangel && lookupKey(overlayMangel.fields.status) !== 'erledigt' ? (
          <Button
            size="sm"
            onClick={() => { if (overlayMangel) void advanceStatus(overlayMangel); }}
          >
            {lookupKey(overlayMangel.fields.status) === 'offen' ? 'Beauftragen' : 'Als erledigt markieren'}
          </Button>
        ) : undefined}
      >
        {overlayMangel && (
          <>
            <RecordHeader
              title={overlayMangel.fields.beschreibung?.slice(0, 80) ?? 'Mangel'}
              subtitle={overlayMangel.fields.status?.label}
            />
            <RecordSection title="Details" cols={2}>
              <RecordField label="Objekt" value={overlayMangel.objektName} />
              <RecordField label="Dringlichkeit" value={overlayMangel.fields.dringlichkeit} format="pill" />
              <RecordField label="Meldedatum" value={overlayMangel.fields.meldedatum} format="date" />
              <RecordField label="Status" value={overlayMangel.fields.status} format="pill" />
            </RecordSection>
            <RecordSection title="Melder">
              <RecordField
                label="Name"
                value={[overlayMangel.fields.melder_vorname, overlayMangel.fields.melder_nachname].filter(Boolean).join(' ') || undefined}
              />
              <RecordField label="Beauftragter Handwerker" value={overlayMangel.fields.handwerker} />
            </RecordSection>
            {overlayMangel.fields.beschreibung && (
              <RecordSection title="Schadensbeschreibung">
                <RecordField label="Beschreibung" value={overlayMangel.fields.beschreibung} format="longtext" />
              </RecordSection>
            )}
            <RecordAttachments appId={APP_IDS.MAENGELVERWALTUNG} recordId={overlayMangel.record_id} />
          </>
        )}
      </RecordOverlay>

      {/* Objekt Detail Overlay */}
      <RecordOverlay
        open={overlay.open && overlay.top?.type === 'objekt'}
        onClose={overlay.close}
        ariaLabel="Objekt"
      >
        {overlayObjekt && (
          <>
            <RecordHeader
              title={overlayObjekt.fields.bezeichnung ?? 'Objekt'}
              subtitle={`${overlayObjekt.fields.strasse ?? ''} ${overlayObjekt.fields.hausnummer ?? ''}, ${overlayObjekt.fields.plz ?? ''} ${overlayObjekt.fields.stadt ?? ''}`.trim()}
            />
            <RecordSection title="Eigenschaften" cols={2}>
              <RecordField label="Baujahr" value={overlayObjekt.fields.baujahr?.toString()} />
              <RecordField label="Wohneinheiten" value={overlayObjekt.fields.anzahl_einheiten?.toString()} />
              <RecordField label="Vermieteter Stand" value={overlayObjekt.fields.vermietungsstand?.toString()} />
            </RecordSection>
            <RecordSection title="Mängel">
              {maengelverwaltung
                .filter(m => {
                  const rid = m.fields.objekt ? m.fields.objekt.match(/([a-f0-9]{24})$/i)?.[1] : null;
                  return rid === overlayObjekt.record_id;
                })
                .map(m => (
                  <div
                    key={m.record_id}
                    className="flex items-center justify-between py-1 cursor-pointer hover:bg-muted/50 rounded px-1"
                    role="button"
                    tabIndex={0}
                    onClick={() => overlay.push({ type: 'mangel', id: m.record_id })}
                    onKeyDown={e => e.key === 'Enter' && overlay.push({ type: 'mangel', id: m.record_id })}
                  >
                    <span className="text-sm min-w-0 truncate">
                      {m.fields.beschreibung?.slice(0, 50) ?? 'Mangel'}
                    </span>
                    <span className={`ml-2 shrink-0 text-xs font-medium ${
                      lookupKey(m.fields.status) === 'erledigt' ? 'text-green-600' :
                      lookupKey(m.fields.status) === 'beauftragt' ? 'text-blue-600' :
                      'text-amber-600'
                    }`}>
                      {m.fields.status?.label ?? lookupKey(m.fields.status)}
                    </span>
                  </div>
                ))
              }
              {maengelverwaltung.filter(m => {
                const rid = m.fields.objekt ? m.fields.objekt.match(/([a-f0-9]{24})$/i)?.[1] : null;
                return rid === overlayObjekt.record_id;
              }).length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Mängel für dieses Objekt.</p>
              )}
            </RecordSection>
            <RecordAttachments appId={APP_IDS.OBJEKTVERWALTUNG} recordId={overlayObjekt.record_id} />
          </>
        )}
      </RecordOverlay>

      {/* Create Mangel Dialog */}
      <MaengelverwaltungDialog
        open={createMangelOpen}
        onClose={() => setCreateMangelOpen(false)}
        onSubmit={async fields => {
          await LivingAppsService.createMaengelverwaltungEntry(fields);
          fetchAll();
        }}
        defaultValues={createMangelDefaults}
        objektverwaltungList={objektverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['Maengelverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Maengelverwaltung']}
      />

      {/* Create Objekt Dialog */}
      <ObjektverwaltungDialog
        open={createObjektOpen}
        onClose={() => setCreateObjektOpen(false)}
        onSubmit={async fields => {
          await LivingAppsService.createObjektverwaltungEntry(fields);
          fetchAll();
        }}
        enablePhotoScan={AI_PHOTO_SCAN['Objektverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Objektverwaltung']}
      />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
