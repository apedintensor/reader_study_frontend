import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { BlockFeedback, Assessment } from '../types/domain';
import { useUserStore } from './userStore';

const BLOCK_SIZE = 10;

interface CaseAssessmentCacheEntry { pre?: Assessment | null; post?: Assessment | null }

export const useGameStore = defineStore('game', () => {
  const userStore = useUserStore();
  const currentBlockIndex = ref(0);
  const blockFeedbackVisible = ref(false);
  const currentBlockFeedback = ref<BlockFeedback | null>(null);
  const loadingFeedback = ref(false);
  const assessmentCache = ref<Record<number, CaseAssessmentCacheEntry>>({});

  function getBlockIndexForCase(globalOrder: number) { return Math.floor(globalOrder / BLOCK_SIZE); }

  async function handleCaseFullyCompleted(_caseId: number, caseGlobalOrder: number, isPostAi: boolean, orderedCaseIds: number[]) {
    if (!isPostAi) return;
    const blockIdx = getBlockIndexForCase(caseGlobalOrder);
    const start = blockIdx * BLOCK_SIZE;
    const end = start + BLOCK_SIZE;
    if (orderedCaseIds.length < end) return; // not enough cases yet
    const blockCaseIds = orderedCaseIds.slice(start, end);
    const filledCount = blockCaseIds.filter(cid => assessmentCache.value[cid]?.post).length;
    if (filledCount === BLOCK_SIZE) {
      await buildBlockFeedback(blockIdx, blockCaseIds);
      currentBlockIndex.value = blockIdx + 1;
      blockFeedbackVisible.value = true;
    }
  }

  async function buildBlockFeedback(blockIdx: number, caseIds: number[]) {
    loadingFeedback.value = true;
    const userId = userStore.user?.id; if (!userId) { loadingFeedback.value = false; return; }
    let preTop1 = 0, preTop3 = 0, postTop1 = 0, postTop3 = 0, counted = 0;
    for (const cid of caseIds) {
      let cacheEntry = assessmentCache.value[cid];
      if (!cacheEntry) cacheEntry = assessmentCache.value[cid] = {};
  // Legacy per-case assessment fetch removed (backend no longer provides singular endpoint).
  // cacheEntry.pre / post left as-is (undefined) – metrics will be unavailable until
  // server-provided block feedback or updated retrieval logic is implemented.
      const pre = cacheEntry.pre; const post = cacheEntry.post; if (!pre || !post) continue; counted++;
      const gtid = (pre as any).ground_truth_diagnosis_id ?? pre.case_id;
      const preRanks = pre.diagnoses;
      if (preRanks.find(d => d.rank === 1 && d.diagnosis_id === gtid)) preTop1++;
      if (preRanks.some(d => d.diagnosis_id === gtid)) preTop3++;
      const postRanks = post.diagnoses;
      if (postRanks.find(d => d.rank === 1 && d.diagnosis_id === gtid)) postTop1++;
      if (postRanks.some(d => d.diagnosis_id === gtid)) postTop3++;
    }
    currentBlockFeedback.value = {
      block_index: blockIdx,
      top1_accuracy_pre: counted ? preTop1 / counted : undefined,
      top1_accuracy_post: counted ? postTop1 / counted : undefined,
      top3_accuracy_pre: counted ? preTop3 / counted : undefined,
      top3_accuracy_post: counted ? postTop3 / counted : undefined,
      delta_top1: counted ? (postTop1 - preTop1) / counted : undefined,
      delta_top3: counted ? (postTop3 - preTop3) / counted : undefined,
    };
    loadingFeedback.value = false;
  }

  function closeFeedback() { blockFeedbackVisible.value = false; }

  return { BLOCK_SIZE, currentBlockIndex, blockFeedbackVisible, currentBlockFeedback, loadingFeedback, handleCaseFullyCompleted, closeFeedback, getBlockIndexForCase };
});
