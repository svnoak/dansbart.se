import { StylePicker } from '@/components/StylePicker';
import { TEMPO_OPTIONS } from '@/utils/tempoOptions';

interface TempoPickerProps {
  presentation: 'full' | 'compact';
  onSelect: (tempoKey: string) => void;
  compactClassName?: string;
  disabled?: boolean;
}

export function TempoPicker({ presentation, onSelect, compactClassName, disabled }: TempoPickerProps) {
  return (
    <StylePicker
      presentation={presentation}
      placeholder="Välj tempo..."
      ariaLabel="Välj tempo"
      options={TEMPO_OPTIONS.map((t) => ({ value: t.key, label: t.label }))}
      onSelect={onSelect}
      compactClassName={compactClassName}
      disabled={disabled}
    />
  );
}
