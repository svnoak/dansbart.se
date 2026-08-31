import { useState, useEffect, useCallback, useMemo } from 'react';
import type { StyleNode } from '@/api/models/styleNode';
import { getStyleTree } from '@/api/generated/styles/styles';
import { submitFeedback } from '@/api/generated/tracks/tracks';
import { getVoterId } from '@/utils/voter';

export type StyleTree = Record<string, string[]>;

export interface StyleVoteSubmitResult {
  success: boolean;
  styleJustConfirmed: boolean;
}

export interface UseStyleVoteResult {
  styleTree: StyleTree;
  mainCategories: string[];
  subStylesFor: (main: string) => string[];
  isSubmitting: boolean;
  submit: (style: string, tempoCorrection: string) => Promise<StyleVoteSubmitResult>;
}

/** Shared style-tree fetch + vote submission for the three classification surfaces
 *  (ClassifyPage, SmartNudge, FlagTrackModal). Each caller keeps its own step/view
 *  machine — the flows differ enough (verify-first vs ask-first, addition mode,
 *  secondary-style confirmation) that unifying them isn't worth the coupling. */
export function useStyleVote(trackId: string | undefined): UseStyleVoteResult {
  const [styleTree, setStyleTree] = useState<StyleTree>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getStyleTree()
      .then((nodes: StyleNode[]) => {
        const tree: StyleTree = {};
        for (const node of nodes) {
          if (node.name) tree[node.name] = node.subStyles ?? [];
        }
        setStyleTree(tree);
      })
      .catch(() => {});
  }, []);

  const mainCategories = useMemo(() => Object.keys(styleTree).sort(), [styleTree]);
  const subStylesFor = useCallback((main: string) => styleTree[main] ?? [], [styleTree]);

  const submit = useCallback(
    async (style: string, tempoCorrection: string): Promise<StyleVoteSubmitResult> => {
      if (!trackId) return { success: false, styleJustConfirmed: false };
      setIsSubmitting(true);
      try {
        const res = await submitFeedback(
          trackId,
          { suggestedStyle: style, tempoCorrection },
          { headers: { 'X-Voter-ID': getVoterId() } },
        );
        return { success: true, styleJustConfirmed: !!res.styleJustConfirmed };
      } catch {
        return { success: false, styleJustConfirmed: false };
      } finally {
        setIsSubmitting(false);
      }
    },
    [trackId],
  );

  return { styleTree, mainCategories, subStylesFor, isSubmitting, submit };
}
