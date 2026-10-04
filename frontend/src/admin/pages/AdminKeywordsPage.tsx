import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { StyleKeyword } from '@/api/models/styleKeyword';
import {
  getKeywords1,
  createKeyword,
  updateKeyword,
  deleteKeyword,
} from '@/api/generated/admin-style-keywords/admin-style-keywords';
import { apiFetch } from '@/api/http-client';
import { DataTable } from '@/admin/components/DataTable';
import type { Column } from '@/admin/components/DataTable';
import { FilterBar } from '@/admin/components/FilterBar';
import { Pagination } from '@/admin/components/Pagination';
import { Modal } from '@/admin/components/Modal';
import { TextInput } from '@/admin/components/forms/TextInput';
import { Select } from '@/admin/components/forms/Select';
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
}

interface KeywordPageData {
  items: StyleKeyword[];
  total: number;
}

export function AdminKeywordsPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const mainStyle = params.get('mainStyle') ?? '';
  const isActive = params.get('isActive');
  const limit = parseInt(params.get('limit') ?? '50', 10);
  const offset = parseInt(params.get('offset') ?? '0', 10);

  const [data, setData] = useState<KeywordPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<StyleKeyword | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<StyleKeyword | null>(null);
  const [styleConfigs, setStyleConfigs] = useState<StyleConfig[]>([]);

  const [formKeyword, setFormKeyword] = useState('');
  const [formMainStyle, setFormMainStyle] = useState('');
  const [formSubStyle, setFormSubStyle] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => {
    apiFetch('/api/admin/style-config/active')
      .then((res) => (res.ok ? res.json() : []))
      .then((configs: StyleConfig[]) => setStyleConfigs(configs))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getKeywords1(
        {
          search: search || undefined,
          mainStyle: mainStyle || undefined,
          isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
          limit,
          offset,
        },
      );
      // Response is loosely typed; parse as page response
      const r = result as unknown as KeywordPageData;
      setData({
        items: Array.isArray(r?.items) ? r.items : [],
        total: r?.total ?? 0,
      });
    } catch {
      toast('Kunde inte hämta nyckelord', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, mainStyle, isActive, limit, offset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'offset') next.set('offset', '0');
    setParams(next, { replace: true });
  };

  const openCreate = () => {
    setFormKeyword('');
    setFormMainStyle('');
    setFormSubStyle('');
    setFormIsActive(true);
    setCreateModal(true);
  };

  const openEdit = (kw: StyleKeyword) => {
    setFormKeyword(kw.keyword ?? '');
    setFormMainStyle(kw.mainStyle ?? '');
    setFormSubStyle(kw.subStyle ?? '');
    setFormIsActive(kw.isActive ?? true);
    setEditModal(kw);
  };

  const handleCreate = async () => {
    try {
      await createKeyword(
        { keyword: formKeyword, mainStyle: formMainStyle, subStyle: formSubStyle || undefined },
      );
      toast('Nyckelord skapat');
      setCreateModal(false);
      fetchData();
    } catch {
      toast('Kunde inte skapa nyckelord', 'error');
    }
  };

  const handleUpdate = async () => {
    if (!editModal) return;
    try {
      await updateKeyword(
        editModal.id!,
        {
          keyword: formKeyword,
          mainStyle: formMainStyle,
          subStyle: formSubStyle || undefined,
          isActive: formIsActive,
        },
      );
      toast('Nyckelord uppdaterat');
      setEditModal(null);
      fetchData();
    } catch {
      toast('Kunde inte uppdatera nyckelord', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await deleteKeyword(deleteModal.id!);
      toast('Nyckelord raderat');
      setDeleteModal(null);
      fetchData();
    } catch {
      toast('Kunde inte radera nyckelord', 'error');
    }
  };

  const handleToggleActive = async (kw: StyleKeyword) => {
    try {
      await updateKeyword(
        kw.id!,
        {
          keyword: kw.keyword,
          mainStyle: kw.mainStyle,
          subStyle: kw.subStyle,
          isActive: !kw.isActive,
        },
      );
      toast(kw.isActive ? 'Nyckelord inaktiverat' : 'Nyckelord aktiverat');
      fetchData();
    } catch {
      toast('Kunde inte ändra status', 'error');
    }
  };

  const columns: Column<StyleKeyword>[] = [
    {
      key: 'keyword',
      header: 'Nyckelord',
      render: (kw) => (
        <span className="text-[15px] font-medium text-[rgb(var(--color-text))]">{kw.keyword}</span>
      ),
    },
    {
      key: 'mainStyle',
      header: 'Huvudstil',
      render: (kw) =>
        kw.mainStyle ? (
          <StylePill style={kw.mainStyle} state="confirmed" />
        ) : (
          <span className="text-[13px] text-[rgb(var(--color-text-muted))]">–</span>
        ),
    },
    {
      key: 'subStyle',
      header: 'Understil',
      render: (kw) => (
        <span className="text-[13px] text-[rgb(var(--color-text-muted))]">{kw.subStyle ?? '–'}</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (kw) => (
        <Pill
          active={!!kw.isActive}
          aria-pressed={!!kw.isActive}
          aria-label={kw.isActive ? `Inaktivera ${kw.keyword ?? 'nyckelordet'}` : `Aktivera ${kw.keyword ?? 'nyckelordet'}`}
          onClick={() => handleToggleActive(kw)}
        >
          {kw.isActive ? 'Aktiv' : 'Inaktiv'}
        </Pill>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (kw) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(kw)}>
            Redigera
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[rgb(var(--color-error))]"
            onClick={() => setDeleteModal(kw)}
          >
            Radera
          </Button>
        </div>
      ),
      className: 'w-56',
    },
  ];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const mainStyles = [...new Set(styleConfigs.map((c) => c.mainStyle))].sort();
  const subStylesForMain = styleConfigs
    .filter((c) => c.mainStyle === formMainStyle && c.subStyle)
    .map((c) => c.subStyle!)
    .sort();

  const keywordForm = (
    <div className="space-y-4">
      <FormField label="Nyckelord" htmlFor="kw-keyword">
        <TextInput
          id="kw-keyword"
          value={formKeyword}
          onChange={(e) => setFormKeyword(e.target.value)}
          className="min-h-11"
          required
        />
      </FormField>
      <FormField label="Huvudstil" htmlFor="kw-main">
        <Select
          id="kw-main"
          value={formMainStyle}
          onChange={(e) => {
            setFormMainStyle(e.target.value);
            setFormSubStyle('');
          }}
          className="min-h-11"
          required
        >
          <option value="">Välj huvudstil</option>
          {mainStyles.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </FormField>
      <FormField label="Understil" htmlFor="kw-sub">
        <Select
          id="kw-sub"
          value={formSubStyle}
          onChange={(e) => setFormSubStyle(e.target.value)}
          className="min-h-11"
          disabled={subStylesForMain.length === 0}
        >
          <option value="">Ingen understil</option>
          {subStylesForMain.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </FormField>
      {editModal && (
        <label className="flex min-h-11 items-center gap-3 text-[15px] text-[rgb(var(--color-text))]">
          <input
            type="checkbox"
            checked={formIsActive}
            onChange={(e) => setFormIsActive(e.target.checked)}
            className="h-5 w-5 rounded-[4px] border-[rgb(var(--color-border-strong))] accent-[rgb(var(--color-accent))]"
          />
          Aktivt nyckelord
        </label>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            Nyckelord
          </h1>
          <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text-muted))]">
            Ord i titlar och beskrivningar som pekar på en dansstil. Analysen använder dem när
            den gissar stilen på nya låtar.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          Skapa nyckelord
        </Button>
      </div>

      <FilterBar>
        <div className="flex min-w-55 flex-1 flex-col gap-1.5">
          <label htmlFor="kw-search" className="text-sm font-medium text-[rgb(var(--color-text))]">
            Sök nyckelord
          </label>
          <TextInput
            id="kw-search"
            type="search"
            placeholder="Till exempel schottis"
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
            className="min-h-11"
          />
        </div>
        <div className="flex min-w-45 flex-col gap-1.5">
          <label htmlFor="kw-filter-main" className="text-sm font-medium text-[rgb(var(--color-text))]">
            Huvudstil
          </label>
          <TextInput
            id="kw-filter-main"
            placeholder="Alla huvudstilar"
            value={mainStyle}
            onChange={(e) => updateParam('mainStyle', e.target.value)}
            className="min-h-11"
          />
        </div>
        <div className="flex min-w-40 flex-col gap-1.5">
          <label htmlFor="kw-filter-active" className="text-sm font-medium text-[rgb(var(--color-text))]">
            Status
          </label>
          <Select
            id="kw-filter-active"
            value={isActive ?? ''}
            onChange={(e) => updateParam('isActive', e.target.value)}
            className="min-h-11"
          >
            <option value="">Alla</option>
            <option value="true">Aktiva</option>
            <option value="false">Inaktiva</option>
          </Select>
        </div>
      </FilterBar>

      <DataTable
        columns={columns}
        data={items}
        keyFn={(kw) => kw.id!}
        loading={loading}
        emptyMessage="Inga nyckelord hittades."
      />

      {total > 0 && (
        <Pagination
          offset={offset}
          limit={limit}
          total={total}
          onChange={(newOffset) => updateParam('offset', String(newOffset))}
        />
      )}

      {/* Create modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Skapa nyckelord">
        {keywordForm}
        <FormActions>
          <Button variant="ghost" onClick={() => setCreateModal(false)}>Avbryt</Button>
          <Button variant="primary" onClick={handleCreate} disabled={!formKeyword || !formMainStyle}>
            Skapa nyckelord
          </Button>
        </FormActions>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Redigera nyckelord">
        {keywordForm}
        <FormActions>
          <Button variant="ghost" onClick={() => setEditModal(null)}>Avbryt</Button>
          <Button variant="primary" onClick={handleUpdate} disabled={!formKeyword || !formMainStyle}>
            Spara
          </Button>
        </FormActions>
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Radera nyckelord">
        <p className="text-[15px] text-[rgb(var(--color-text))]">
          Vill du radera nyckelordet <strong>{deleteModal?.keyword}</strong>? Det går inte att ångra.
        </p>
        <FormActions>
          <Button variant="ghost" onClick={() => setDeleteModal(null)}>Avbryt</Button>
          <Button variant="danger" onClick={handleDelete}>
            Radera nyckelord
          </Button>
        </FormActions>
      </Modal>
    </div>
  );
}
