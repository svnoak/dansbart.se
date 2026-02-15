import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { StyleKeyword } from '@/api/models/styleKeyword';
import {
  getKeywords1,
  createKeyword,
  updateKeyword,
  deleteKeyword,
} from '@/api/generated/admin-style-keywords/admin-style-keywords';
import { adminRequestOptions } from '@/admin/api/client';
import { DataTable } from '@/admin/components/DataTable';
import type { Column } from '@/admin/components/DataTable';
import { FilterBar } from '@/admin/components/FilterBar';
import { Pagination } from '@/admin/components/Pagination';
import { Modal } from '@/admin/components/Modal';
import { TextInput } from '@/admin/components/forms/TextInput';
import { Select } from '@/admin/components/forms/Select';
import { FormField } from '@/admin/components/forms/FormField';
import { FormActions } from '@/admin/components/forms/FormActions';
import { Button } from '@/ui';
import { toast } from '@/admin/components/toastEmitter';

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

  const [formKeyword, setFormKeyword] = useState('');
  const [formMainStyle, setFormMainStyle] = useState('');
  const [formSubStyle, setFormSubStyle] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

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
        adminRequestOptions(),
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
        adminRequestOptions(),
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
        adminRequestOptions(),
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
      await deleteKeyword(deleteModal.id!, adminRequestOptions());
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
        adminRequestOptions(),
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
        <span className="font-medium text-[rgb(var(--color-text))]">{kw.keyword}</span>
      ),
    },
    {
      key: 'mainStyle',
      header: 'Huvudstil',
      render: (kw) => <span className="text-xs">{kw.mainStyle ?? '-'}</span>,
    },
    {
      key: 'subStyle',
      header: 'Understil',
      render: (kw) => (
        <span className="text-xs text-[rgb(var(--color-text-muted))]">{kw.subStyle ?? '-'}</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Aktiv',
      render: (kw) => (
        <button
          type="button"
          onClick={() => handleToggleActive(kw)}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            kw.isActive ? 'bg-[rgb(var(--color-accent))]' : 'bg-[rgb(var(--color-border))]'
          }`}
          aria-label={kw.isActive ? 'Inaktivera' : 'Aktivera'}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              kw.isActive ? 'translate-x-4' : ''
            }`}
          />
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (kw) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openEdit(kw)}
            className="px-2 py-1 text-xs text-[rgb(var(--color-accent))] hover:underline"
          >
            Redigera
          </button>
          <button
            type="button"
            onClick={() => setDeleteModal(kw)}
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
  const total = data?.total ?? 0;

  const keywordForm = (
    <div className="space-y-3">
      <FormField label="Nyckelord" htmlFor="kw-keyword">
        <TextInput
          id="kw-keyword"
          value={formKeyword}
          onChange={(e) => setFormKeyword(e.target.value)}
          required
        />
      </FormField>
      <FormField label="Huvudstil" htmlFor="kw-main">
        <TextInput
          id="kw-main"
          value={formMainStyle}
          onChange={(e) => setFormMainStyle(e.target.value)}
          required
        />
      </FormField>
      <FormField label="Understil" htmlFor="kw-sub">
        <TextInput
          id="kw-sub"
          value={formSubStyle}
          onChange={(e) => setFormSubStyle(e.target.value)}
          placeholder="Valfritt"
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
        <h1 className="text-xl font-semibold text-[rgb(var(--color-text))]">Nyckelord</h1>
        <Button variant="primary" size="sm" onClick={openCreate}>
          Skapa nyckelord
        </Button>
      </div>

      <FilterBar>
        <div className="flex-1 min-w-[200px]">
          <TextInput
            type="search"
            placeholder="Sök nyckelord..."
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
          />
        </div>
        <TextInput
          placeholder="Filtrera huvudstil..."
          value={mainStyle}
          onChange={(e) => updateParam('mainStyle', e.target.value)}
          className="w-auto min-w-[140px]"
        />
        <Select
          value={isActive ?? ''}
          onChange={(e) => updateParam('isActive', e.target.value)}
          className="w-auto min-w-[120px]"
        >
          <option value="">Alla</option>
          <option value="true">Aktiva</option>
          <option value="false">Inaktiva</option>
        </Select>
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
            Skapa
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
        <p className="text-sm text-[rgb(var(--color-text))]">
          Vill du radera nyckelordet <strong>{deleteModal?.keyword}</strong>?
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
