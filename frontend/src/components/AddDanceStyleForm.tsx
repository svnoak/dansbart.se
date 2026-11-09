import { useId, useState } from 'react';
import { createDanceStyle } from '@/api/generated/contributions/contributions';
import { ApiError } from '@/api/http-client';
import { Button, InlineError } from '@/ui';

interface AddDanceStyleFormProps {
  /** The main styles a new variant can belong to. */
  mainStyles: string[];
  /** Pre-selects "variant of" this main style. */
  defaultParent?: string;
  /** Called with the stored spelling of the new style. subStyle is null for a new main style. */
  onCreated: (mainStyle: string, subStyle: string | null) => void;
  onCancel: () => void;
}

const inputClass =
  'min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[15px] text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]';
const labelClass = 'mb-1 block text-[14px] font-semibold text-[rgb(var(--color-text))]';

/**
 * Adds a dance style that everyone can then pick: either a new main style (for example
 * Masurka) or a variant under an existing one (for example a new kind of polska).
 * Only shown to signed-in users who are not banned.
 */
export function AddDanceStyleForm({ mainStyles, defaultParent, onCreated, onCancel }: AddDanceStyleFormProps) {
  const id = useId();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'main' | 'sub'>(defaultParent ? 'sub' : 'main');
  const [parent, setParent] = useState(defaultParent ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Skriv namnet på dansstilen.');
      return;
    }
    if (kind === 'sub' && !parent) {
      setError('Välj vilken dans det är en variant av.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createDanceStyle({
        name: name.trim(),
        parentStyle: kind === 'sub' ? parent : undefined,
      });
      onCreated(created.mainStyle ?? name.trim(), created.subStyle ?? null);
    } catch (e) {
      setError(e instanceof ApiError && e.detail ? e.detail : 'Det gick inte att lägga till dansstilen. Försök igen.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] p-4">
      <p className="text-[15px] font-bold text-[rgb(var(--color-text))]">Ny dansstil</p>
      <p className="text-[14px] text-[rgb(var(--color-text-muted))]">
        Dansstilen blir synlig för alla direkt.
      </p>

      <div>
        <label htmlFor={`${id}-name`} className={labelClass}>Namn på dansstilen</label>
        <input
          id={`${id}-name`}
          type="text"
          value={name}
          maxLength={40}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          className={inputClass}
        />
      </div>

      <fieldset>
        <legend className={labelClass}>Vad är det för dansstil?</legend>
        <div className="space-y-1">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-[rgb(var(--color-text))]">
            <input
              type="radio"
              name={`${id}-kind`}
              checked={kind === 'main'}
              onChange={() => { setKind('main'); setError(null); }}
              className="h-5 w-5"
            />
            En egen dans
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-[rgb(var(--color-text))]">
            <input
              type="radio"
              name={`${id}-kind`}
              checked={kind === 'sub'}
              onChange={() => { setKind('sub'); setError(null); }}
              className="h-5 w-5"
            />
            En variant av en annan dans
          </label>
        </div>
      </fieldset>

      {kind === 'sub' && (
        <div>
          <label htmlFor={`${id}-parent`} className={labelClass}>Variant av</label>
          <select
            id={`${id}-parent`}
            value={parent}
            onChange={(e) => { setParent(e.target.value); setError(null); }}
            className={inputClass}
          >
            <option value="">Välj dans...</option>
            {mainStyles.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      <InlineError>{error}</InlineError>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? 'Lägger till...' : 'Lägg till dansstilen'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}
