import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/api/http-client';
import { DataTable } from '@/admin/components/DataTable';
import type { Column } from '@/admin/components/DataTable';
import { Modal } from '@/admin/components/Modal';
import { TextInput } from '@/admin/components/forms/TextInput';
import { FormField } from '@/admin/components/forms/FormField';
import { FormActions } from '@/admin/components/forms/FormActions';
import { Button, Pill } from '@/ui';
import { StylePill } from '@/components/TrackRow/StylePill';
import { toast } from '@/admin/components/toastEmitter';

interface StyleConfig {
  id: string;
  mainStyle: string;
  subStyle: string | null;
  beatsPerBar: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface PageData {
  items: StyleConfig[];
  total: number;
}

const API_BASE = '/api/admin/style-config';

async function fetchConfigs(): Promise<PageData> {
  const res = await apiFetch(`${API_BASE}?limit=100&offset=0`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

async function createConfig(data: { mainStyle: string; subStyle?: string; beatsPerBar: number }) {
  const res = await apiFetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create');
  }
  return res.json();
}

async function updateConfig(
  id: string,
  data: { mainStyle?: string; subStyle?: string; beatsPerBar?: number; isActive?: boolean },
) {
  const res = await apiFetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update');
  }
  return res.json();
}

async function deleteConfig(id: string) {
  const res = await apiFetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
  return res.json();
}

export function AdminStyleConfigPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<StyleConfig | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<StyleConfig | null>(null);

  const [formMainStyle, setFormMainStyle] = useState('');
  const [formSubStyle, setFormSubStyle] = useState('');
  const [formBeatsPerBar, setFormBeatsPerBar] = useState(3);
  const [formIsActive, setFormIsActive] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchConfigs();
      setData({
        items: Array.isArray(result?.items) ? result.items : [],
        total: result?.total ?? 0,
      });
    } catch {
      toast('Kunde inte hämta stilkonfiguration', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setFormMainStyle('');
    setFormSubStyle('');
    setFormBeatsPerBar(3);
    setFormIsActive(true);
    setCreateModal(true);
  };

  const openEdit = (cfg: StyleConfig) => {
    setFormMainStyle(cfg.mainStyle);
    setFormSubStyle(cfg.subStyle ?? '');
    setFormBeatsPerBar(cfg.beatsPerBar);
    setFormIsActive(cfg.isActive);
    setEditModal(cfg);
  };

  const handleCreate = async () => {
    try {
      await createConfig({
        mainStyle: formMainStyle,
        subStyle: formSubStyle || undefined,
        beatsPerBar: formBeatsPerBar,
      });
      toast('Stilkonfiguration skapad');
      setCreateModal(false);
      loadData();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kunde inte skapa', 'error');
    }
  };

  const handleUpdate = async () => {
    if (!editModal) return;
    try {
      await updateConfig(editModal.id, {
        mainStyle: formMainStyle,
        subStyle: formSubStyle || undefined,
        beatsPerBar: formBeatsPerBar,
        isActive: formIsActive,
      });
      toast('Stilkonfiguration uppdaterad');
      setEditModal(null);
      loadData();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kunde inte uppdatera', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await deleteConfig(deleteModal.id);
      toast('Stilkonfiguration raderad');
      setDeleteModal(null);
      loadData();
    } catch {
      toast('Kunde inte radera', 'error');
    }
  };

  const handleToggleActive = async (cfg: StyleConfig) => {
    try {
      await updateConfig(cfg.id, { isActive: !cfg.isActive });
      toast(cfg.isActive ? 'Inaktiverad' : 'Aktiverad');
      loadData();
    } catch {
      toast('Kunde inte ändra status', 'error');
    }
  };

  const styleName = (cfg: StyleConfig) =>
    cfg.subStyle ? `${cfg.mainStyle} / ${cfg.subStyle}` : cfg.mainStyle;

  const columns: Column<StyleConfig>[] = [
    {
      key: 'mainStyle',
      header: 'Huvudstil',
      render: (cfg) => <StylePill style={cfg.mainStyle} state="confirmed" />,
    },
    {
      key: 'subStyle',
      header: 'Understil',
      render: (cfg) => (
        <span className="text-[15px] text-[rgb(var(--color-text))]">
          {cfg.subStyle ?? <span className="text-[13px] text-[rgb(var(--color-text-muted))]">–</span>}
        </span>
      ),
    },
    {
      key: 'beatsPerBar',
      header: 'Taktslag per takt',
      render: (cfg) => (
        <span className="text-[15px] tabular-nums text-[rgb(var(--color-text))]">{cfg.beatsPerBar}/4</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (cfg) => (
        <Pill
          active={cfg.isActive}
          aria-pressed={cfg.isActive}
          aria-label={cfg.isActive ? `Inaktivera ${styleName(cfg)}` : `Aktivera ${styleName(cfg)}`}
          onClick={() => handleToggleActive(cfg)}
        >
          {cfg.isActive ? 'Aktiv' : 'Inaktiv'}
        </Pill>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (cfg) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(cfg)}>
            Redigera
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[rgb(var(--color-error))]"
            onClick={() => setDeleteModal(cfg)}
          >
            Radera
          </Button>
        </div>
      ),
      className: 'w-56',
    },
  ];

  const items = data?.items ?? [];

  const configForm = (
    <div className="space-y-4">
      <FormField label="Huvudstil" htmlFor="cfg-main">
        <TextInput
          id="cfg-main"
          value={formMainStyle}
          onChange={(e) => setFormMainStyle(e.target.value)}
          placeholder="Till exempel Polska"
          className="min-h-11"
          required
        />
      </FormField>
      <FormField label="Understil (valfritt)" htmlFor="cfg-sub">
        <TextInput
          id="cfg-sub"
          value={formSubStyle}
          onChange={(e) => setFormSubStyle(e.target.value)}
          placeholder="Till exempel Galopp"
          className="min-h-11"
        />
      </FormField>
      <FormField label="Taktslag per takt" htmlFor="cfg-bpb">
        <input
          id="cfg-bpb"
          type="number"
          min={1}
          max={12}
          value={formBeatsPerBar}
          onChange={(e) => setFormBeatsPerBar(parseInt(e.target.value, 10) || 3)}
          className="min-h-11 w-28 rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[15px] tabular-nums text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
        />
      </FormField>
      {editModal && (
        <label className="flex min-h-11 items-center gap-3 text-[15px] text-[rgb(var(--color-text))]">
          <input
            type="checkbox"
            checked={formIsActive}
            onChange={(e) => setFormIsActive(e.target.checked)}
            className="h-5 w-5 rounded-[4px] border-[rgb(var(--color-border-strong))] accent-[rgb(var(--color-accent))]"
          />
          Aktiv konfiguration
        </label>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            Stilkonfiguration
          </h1>
          <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text-muted))]">
            Taktslag per takt för varje dansstil. Efter klassificering används värdet för att
            räkna om taktstrecken. En understil går före sin huvudstil.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          Lägg till stil
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        keyFn={(cfg) => cfg.id}
        loading={loading}
        emptyMessage="Ingen stilkonfiguration hittades."
      />

      {/* Create modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Lägg till stilkonfiguration">
        {configForm}
        <FormActions>
          <Button variant="ghost" onClick={() => setCreateModal(false)}>Avbryt</Button>
          <Button variant="primary" onClick={handleCreate} disabled={!formMainStyle || !formBeatsPerBar}>
            Lägg till stil
          </Button>
        </FormActions>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Redigera stilkonfiguration">
        {configForm}
        <FormActions>
          <Button variant="ghost" onClick={() => setEditModal(null)}>Avbryt</Button>
          <Button variant="primary" onClick={handleUpdate} disabled={!formMainStyle || !formBeatsPerBar}>
            Spara
          </Button>
        </FormActions>
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Radera stilkonfiguration">
        <p className="text-[15px] text-[rgb(var(--color-text))]">
          Vill du radera konfigurationen för <strong>{deleteModal?.mainStyle}</strong>
          {deleteModal?.subStyle ? ` / ${deleteModal.subStyle}` : ''}? Det går inte att ångra.
        </p>
        <FormActions>
          <Button variant="ghost" onClick={() => setDeleteModal(null)}>Avbryt</Button>
          <Button variant="danger" onClick={handleDelete}>
            Radera konfiguration
          </Button>
        </FormActions>
      </Modal>
    </div>
  );
}
