import { OpenFeature, InMemoryProvider } from '@openfeature/web-sdk';

export const FLAGS = {
  EXPLORER_PAGE: 'explorer-page',
  DISCOVERY_V2: 'discovery-v2',
  FEEDBACK_ENABLED: 'feedback-enabled',
} as const;

export type FlagKey = (typeof FLAGS)[keyof typeof FLAGS];

const flagConfig = {
  [FLAGS.EXPLORER_PAGE]: { defaultVariant: 'off', disabled: false, variants: { on: true, off: false } },
  [FLAGS.DISCOVERY_V2]: { defaultVariant: 'off', disabled: false, variants: { on: true, off: false } },
  [FLAGS.FEEDBACK_ENABLED]: { defaultVariant: 'on', disabled: false, variants: { on: true, off: false } },
};

export function initFeatureFlags(): void {
  OpenFeature.setProvider(new InMemoryProvider(flagConfig));
}
