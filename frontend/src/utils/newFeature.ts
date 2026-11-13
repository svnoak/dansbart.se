/**
 * Features that carry a "Nytt" label for a while after their release. The label
 * goes away for a person once they have opened the feature, and for everyone
 * after the date given here.
 */
const NEW_UNTIL = {
  'lagg-till': '2027-01-01',
} as const;

export type NewFeature = keyof typeof NEW_UNTIL;

const storageKey = (feature: NewFeature) => `feature_seen_${feature}`;

export function isFeatureNew(feature: NewFeature): boolean {
  if (Date.now() >= new Date(NEW_UNTIL[feature]).getTime()) return false;
  try {
    return localStorage.getItem(storageKey(feature)) === null;
  } catch {
    // Without storage the visit cannot be remembered, and a label that never goes away is worse than none.
    return false;
  }
}

export function markFeatureSeen(feature: NewFeature): void {
  try {
    localStorage.setItem(storageKey(feature), 'true');
  } catch {
    // Nothing to do: isFeatureNew hides the label when storage does not work.
  }
}
