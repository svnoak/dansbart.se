import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteDanceList, getDanceList, updateDanceList } from '@/api/generated/dance-lists/dance-lists';
import type { DanceListDto } from '@/api/models/danceListDto';
import { ChevronLeftIcon, QueueListIcon } from '@/icons';
import { Button, EmptyState, InlineError, RowSkeleton, TextField, toast } from '@/ui';
import { ConfirmDeleteByName, GuestCodePanel, SettingsSection } from '@/components';

const inputClass =
  'min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-sm text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]';

const linkButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] hover:bg-[rgb(var(--color-accent-hover))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]';

export function DanceListSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [danceList, setDanceList] = useState<DanceListDto | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [savingAbout, setSavingAbout] = useState(false);
  const [aboutError, setAboutError] = useState<string | null>(null);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getDanceList(id, { signal: controller.signal })
      .then((list) => {
        setDanceList(list);
        setName(list.name ?? '');
        setDescription(list.description ?? '');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setDanceList(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  if (loading) return <RowSkeleton rows={4} label="Laddar inställningarna" />;

  if (!danceList || danceList.viewerHasFullControl !== true) {
    return (
      <EmptyState
        icon={<QueueListIcon className="h-7 w-7" aria-hidden />}
        title={danceList ? 'Du kan inte ändra inställningarna' : 'Danslistan hittades inte'}
        description={
          danceList
            ? 'Bara den som äger danslistan kan ändra dess inställningar.'
            : 'Den kan ha tagits bort, eller så har du inte tillgång till den.'
        }
        action={
          <Link to={danceList && id ? `/dance-lists/${id}` : '/dance-lists'} className={linkButtonClass}>
            {danceList ? 'Till danslistan' : 'Till danslistorna'}
          </Link>
        }
      />
    );
  }

  const ownerGroup = danceList.ownerGroup;
  const ownerName = danceList.owner?.displayName ?? danceList.owner?.username ?? 'Okänd';

  async function handleSaveAbout() {
    if (!id) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSavingAbout(true);
    setAboutError(null);
    try {
      await updateDanceList(id, { name: trimmedName, description });
      setDanceList((prev) => (prev ? { ...prev, name: trimmedName, description } : prev));
      toast('Ändringarna är sparade.');
    } catch {
      setAboutError('Det gick inte att spara ändringarna.');
    } finally {
      setSavingAbout(false);
    }
  }

  async function handleTogglePublic() {
    if (!id || !danceList) return;
    const nextPublic = danceList.isPublic !== true;
    setVisibilityError(null);
    try {
      await updateDanceList(id, { isPublic: nextPublic });
      setDanceList((prev) => (prev ? { ...prev, isPublic: nextPublic } : prev));
      toast(nextPublic ? 'Danslistan är nu offentlig' : 'Danslistan är nu privat');
    } catch {
      setVisibilityError('Det gick inte att ändra synligheten.');
    }
  }

  async function handleDelete() {
    if (!id) return;
    setDeleteError(null);
    try {
      await deleteDanceList(id);
      toast('Danslistan är raderad');
      navigate(ownerGroup?.id ? `/groups/${ownerGroup.id}` : '/dance-lists');
    } catch {
      setDeleteError('Det gick inte att radera danslistan.');
    }
  }

  const privateDescription = ownerGroup
    ? 'Bara gruppens medlemmar ser den.'
    : 'Bara du och de du delar med ser den.';

  return (
    <div className="space-y-6">
      <Link
        to={`/dance-lists/${id}`}
        className="inline-flex min-h-11 max-w-full items-center gap-1 pr-2 text-sm font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
      >
        <ChevronLeftIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{danceList.name}</span>
      </Link>

      <div className="flex items-center gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text-muted))]"
          aria-hidden
        >
          <QueueListIcon className="h-7 w-7" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[rgb(var(--color-text-muted))]">Inställningar</p>
          <h1 className="truncate text-[32px] font-bold leading-tight tracking-tight text-[rgb(var(--color-text))]">
            {danceList.name}
          </h1>
        </div>
      </div>

      <SettingsSection
        title="Om danslistan"
        description="Namnet och beskrivningen syns för alla som kan se danslistan."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveAbout();
          }}
          className="space-y-4"
        >
          <TextField id="dance-list-name" label="Namn" value={name} onChange={setName} />
          <div className="space-y-1">
            <label htmlFor="dance-list-description" className="block text-sm font-medium text-[rgb(var(--color-text))]">
              Beskrivning
            </label>
            <textarea
              id="dance-list-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setAboutError(null);
              }}
              rows={4}
              className={inputClass}
            />
          </div>
          <Button type="submit" disabled={savingAbout || !name.trim()}>
            Spara
          </Button>
          <InlineError>{aboutError}</InlineError>
        </form>
      </SettingsSection>

      <SettingsSection title="Synlighet" description="Välj vem som kan hitta och se danslistan.">
        <div className="space-y-2">
          <label htmlFor="dance-list-public" className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-[rgb(var(--color-text))]">Offentlig danslista</span>
              <span className="block text-[13px] text-[rgb(var(--color-text-muted))]">
                {danceList.isPublic ? 'Alla kan hitta och se den här danslistan.' : privateDescription}
              </span>
            </span>
            <input
              id="dance-list-public"
              type="checkbox"
              checked={danceList.isPublic === true}
              onChange={handleTogglePublic}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgb(var(--color-focus))] ${
                danceList.isPublic ? 'bg-[rgb(var(--color-selected))]' : 'bg-[rgb(var(--color-border-strong))]'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  danceList.isPublic ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </label>
          <InlineError>{visibilityError}</InlineError>
        </div>
      </SettingsSection>

      {ownerGroup ? (
        <SettingsSection
          title="Vilka kan ändra"
          description="Danslistan ägs av en grupp. Den som är med i gruppen ser listan, och den som får hantera gruppens listor kan ändra den."
        >
          <div className="space-y-3">
            <p className="text-[15px] text-[rgb(var(--color-text))]">
              Ägs av gruppen{' '}
              <Link to={`/groups/${ownerGroup.id}`} className="font-bold text-[rgb(var(--color-link))] hover:underline">
                {ownerGroup.name}
              </Link>
              .
            </p>
            <p className="text-[13px] text-[rgb(var(--color-text-muted))]">
              Lägg till personer i gruppen för att ge dem tillgång till danslistan.
            </p>
            <Link to={`/groups/${ownerGroup.id}/settings`} className={linkButtonClass}>
              Hantera gruppens medlemmar
            </Link>
          </div>
        </SettingsSection>
      ) : (
        <SettingsSection title="Ägare" description="Den som äger danslistan bestämmer över den.">
          <p className="text-[15px] font-bold text-[rgb(var(--color-text))]">{ownerName}</p>
        </SettingsSection>
      )}

      {id && (
        <SettingsSection
          title="Låt andra lägga till"
          description="En kod och en QR-kod till danskvällen eller kursen. Den som har koden kan lägga till danser, men inte ändra något annat."
        >
          <GuestCodePanel
            kind="danceList"
            listId={id}
            code={danceList.guestCode ?? null}
            onChange={(code) => setDanceList((prev) => (prev ? { ...prev, guestCode: code ?? undefined } : prev))}
          />
        </SettingsSection>
      )}

      <SettingsSection
        title="Radera danslista"
        description="Det här går inte att ångra. Skriv in danslistans namn för att bekräfta."
        danger
      >
        <div className="space-y-3">
          <ConfirmDeleteByName name={danceList.name ?? ''} buttonLabel="Radera danslista" onConfirm={handleDelete} />
          <InlineError>{deleteError}</InlineError>
        </div>
      </SettingsSection>
    </div>
  );
}
