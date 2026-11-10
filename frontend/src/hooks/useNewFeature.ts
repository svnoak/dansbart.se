import { useEffect } from 'react';
import { isFeatureNew, markFeatureSeen, type NewFeature } from '@/utils/newFeature';

/**
 * Whether to show the "Nytt" label for a feature. Pass `visiting` as true while
 * the person is on the feature's page: that hides the label and keeps it hidden.
 */
export function useNewFeature(feature: NewFeature, visiting = false): boolean {
  useEffect(() => {
    if (visiting) markFeatureSeen(feature);
  }, [feature, visiting]);
  return !visiting && isFeatureNew(feature);
}
