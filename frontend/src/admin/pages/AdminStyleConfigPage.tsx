import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/admin/api/client';
import { DataTable } from '@/admin/components/DataTable';
import type { Column } from '@/admin/components/DataTable';
import { Modal } from '@/admin/components/Modal';
import { TextInput } from '@/admin/components/forms/TextInput';
import { FormField } from '@/admin/components/forms/FormField';
import { FormActions } from '@/admin/components/forms/FormActions';
import { Button } from '@/ui';
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
  const res = await adminFetch(`${API_BASE}?limit=100&offset=0`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

async function createConfig(data: { mainStyle: string; subStyle?: string; beatsPerBar: number }) {
  const res = await adminFetch(API_BASE, {
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
  const res = await adminFetch(`${API_BASE}/${id}`, {
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
  const res = await adminFetch(`${API_BASE}/${id}`, { method: 'DELETE' });
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
      toast('Kunde inte hamta stilkonfiguration', 'error');
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
      toast('Kunde inte andra status', 'error');
    }
  };

  const columns: Column<StyleConfig>[] = [
    {
      key: 'mainStyle',
      header: 'Huvudstil',
      render: (cfg) => (
        <span className="font-medium text-[rgb(var(--color-text))]">{cfg.mainStyle}</span>
      ),
    },
    {
      key: 'subStyle',
      header: 'Understil',
      render: (cfg) => (
        <span className="text-xs text-[rgb(var(--color-text-muted))]">{cfg.subStyle ?? '-'}</span>
      ),
    },
    {
      key: 'beatsPerBar',
      header: 'Taktslag/takt',
      render: (cfg) => (
        <span className="font-mono text-sm">{cfg.beatsPerBar}/4</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Aktiv',
      render: (cfg) => (
        <button
          type="button"
          onClick={() => handleToggleActive(cfg)}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            cfg.isActive ? 'bg-[rgb(var(--color-accent))]' : 'bg-[rgb(var(--color-border))]'
          }`}
          aria-label={cfg.isActive ? 'Inaktivera' : 'Aktivera'}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              cfg.isActive ? 'translate-x-4' : ''
            }`}
          />
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (cfg) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openEdit(cfg)}
            className="px-2 py-1 text-xs text-[rgb(var(--color-accent))] hover:underline"
          >
            Redigera
          </button>
          <button
            type="button"
            onClick={() => setDeleteModal(cfg)}
            className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            Radera
          </button>
        </div>
      ),
      className: 'w-32',
    },
  ];

  const items = data?.items ?? [];

  const configForm = (
    <div className="space-y-3">
      <FormField label="Huvudstil" htmlFor="cfg-main">
        <TextInput
          id="cfg-main"
          value={formMainStyle}
          onChange={(e) => setFormMainStyle(e.target.value)}
          placeholder="t.ex. Polska"
          required
        />
      </FormField>
      <FormField label="Understil" htmlFor="cfg-sub">
        <TextInput
          id="cfg-sub"
          value={formSubStyle}
          onChange={(e) => setFormSubStyle(e.target.value)}
          placeholder="Valfritt, t.ex. Galopp"
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
          className="w-20 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-2 py-1.5 text-sm text-[rgb(var(--color-text))]"
        />
      </FormField>
      {editModal && (
        <label className="flex items-center gap-2 text-sm text-[rgb(var(--color-text))]">
          <input
            type="checkbox"
            checked={formIsActive}
            onChange={(e) => setFormIsActive(e.target.checked)}
            className="rounded"
          />
          Aktiv
        </label>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Stilkonfiguration</h1>
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Taktslag per takt för varje dansstil. Används för att korrigera taktstreck efter klassificering.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
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
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Lagg till stilkonfiguration">
        {configForm}
        <FormActions>
          <Button variant="ghost" onClick={() => setCreateModal(false)}>Avbryt</Button>
          <Button variant="primary" onClick={handleCreate} disabled={!formMainStyle || !formBeatsPerBar}>
            Skapa
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
        <p className="text-sm text-[rgb(var(--color-text))]">
          Vill du radera konfigurationen för <strong>{deleteModal?.mainStyle}</strong>
          {deleteModal?.subStyle ? ` / ${deleteModal.subStyle}` : ''}?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteModal(null)}>Avbryt</Button>
          <Button
            variant="primary"
            className="bg-red-600 hover:bg-red-700"
            onClick={handleDelete}
          >
            Radera
          </Button>
        </div>
      </Modal>
    </div>
  );
}