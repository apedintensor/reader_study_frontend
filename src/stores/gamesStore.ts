import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getGames, getGame, createNextGame, getGameAssignments, getActiveGame, gameNext, canViewReport, type GameSummary, type Assignment, type GameNextResponse } from '../api/games';

export const useGamesStore = defineStore('games', () => {
  const games = ref<GameSummary[]>([]);
  const assignmentsByBlock = ref<Record<number, Assignment[]>>({});
  const blockSizes = ref<Record<number, number>>({}); // persist known block sizes
  const loadingGames = ref(false);
  const loadingAssignments = ref(false);
  const creatingNext = ref(false);
  const pollingHandles = ref<Record<number, any>>({});
  const activeAssignment = ref<Assignment | null>(null);
  const activeRemaining = ref<number | null>(null); // remaining not POST-finished in current block
  const activeStatus = ref<'started' | 'continuing' | 'exhausted' | null>(null);

  function getBlockAssignments(block: number) {
    return assignmentsByBlock.value[block] || [];
  }

  function setAssignments(block: number, assignments: Assignment[]) {
    assignmentsByBlock.value[block] = assignments.sort((a,b)=>a.display_order - b.display_order);
  // Track the largest known size for this block
  const size = assignments.length;
  if (size > (blockSizes.value[block] ?? 0)) blockSizes.value[block] = size;
  }

  function upsertGame(summary: GameSummary) {
    const idx = games.value.findIndex(g => g.block_index === summary.block_index);
    if (idx === -1) games.value.push(summary); else games.value[idx] = summary;
    games.value.sort((a,b)=>a.block_index - b.block_index);
  }

  async function loadAllGames(force = false) {
    if (loadingGames.value) return;
    if (!force && games.value.length) return; // cached
    loadingGames.value = true;
    try {
      const list = await getGames();
      // Merge: keep existing placeholders (e.g., active in-progress) and let fetched reports override
      const byIndex = new Map<number, GameSummary>();
      for (const g of games.value) byIndex.set(g.block_index, g);
      for (const g of list) byIndex.set(g.block_index, g);
      games.value = Array.from(byIndex.values()).sort((a,b)=>a.block_index - b.block_index);
    } finally {
      loadingGames.value = false;
    }
  }

  async function loadGame(block: number, opts: { force?: boolean } = {}) {
    if (loadingGames.value) return;
    if (!opts.force && games.value.some(g => g.block_index === block)) return; // cached
    loadingGames.value = true;
    try {
      // Safe check: if backend says report not available, skip fetch to avoid 404 noise
      try {
        const can = await canViewReport(block);
        const ok = !!(can?.available ?? can?.ready);
        if (!ok) { return null; }
      } catch { /* ignore can_view_report errors and attempt getGame as fallback */ }
      const summary = await getGame(block);
      upsertGame(summary);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        // Summary not ready; swallow
        return null;
      }
      throw e;
    } finally {
      loadingGames.value = false;
    }
  }

  function hasIncompleteBlock(): boolean {
    return Object.values(assignmentsByBlock.value).some(list => list.some(a => !a.completed_post_at));
  }

  function latestBlockIndex(): number | null {
    if (!games.value.length && !Object.keys(assignmentsByBlock.value).length) return null;
    const maxAssignmentsBlock = Object.keys(assignmentsByBlock.value).map(Number).sort((a,b)=>b-a)[0];
    const maxGameBlock = games.value.length ? games.value[games.value.length-1].block_index : null;
    return Math.max(maxAssignmentsBlock ?? -1, maxGameBlock ?? -1);
  }

  async function startNextGame(size = 10, probability = 0.5) {
    if (creatingNext.value) return [];
    if (hasIncompleteBlock()) throw new Error('Finish current block before starting a new one.');
    creatingNext.value = true;
    try {
      const assignments = await createNextGame(size, probability);
      if (!assignments.length) return assignments; // no remaining cases
      const block = assignments[0].block_index;
      setAssignments(block, assignments);
  blockSizes.value[block] = Math.max(blockSizes.value[block] ?? 0, assignments.length);
      // optimistic placeholder game summary (will be filled later)
      if (!games.value.some(g => g.block_index === block)) {
        upsertGame({ block_index: block });
      }
  // begin polling for summary once block completes (handled via refresh call inside polling loop)
  ensureAssignmentsLoaded(block);
      return assignments;
    } finally {
      creatingNext.value = false;
    }
  }

  // New flow: advance to next assignment (or start/resume block) via /game/next
  async function advanceToNext(): Promise<GameNextResponse> {
    const resp = await gameNext();
    activeStatus.value = resp.status;
    activeRemaining.value = resp.remaining;
    if (resp.assignment) {
      activeAssignment.value = resp.assignment;
      // ensure assignment cached in store structure
      if (resp.block_index != null) {
        const existing = assignmentsByBlock.value[resp.block_index] || [];
        if (!existing.some(a => a.id === resp.assignment!.id)) {
          existing.push(resp.assignment!);
          setAssignments(resp.block_index, existing);
        }
        if (!games.value.some(g => g.block_index === resp.block_index)) {
          upsertGame({ block_index: resp.block_index });
        }
      }
    } else {
      activeAssignment.value = null;
    }
    return resp;
  }

  function blockProgress(block: number) {
    const list = getBlockAssignments(block);
  if (!list.length && !(blockSizes.value[block] > 0)) return { pre: 0, post: 0, total: 0, pct: 0 };
  const total = Math.max(list.length, blockSizes.value[block] ?? 0);
    const post = list.filter(a => a.completed_post_at).length;
    const pre = list.filter(a => a.completed_pre_at).length;
    return { pre, post, total, pct: (post/total)*100 };
  }

  async function refreshSummaryIfCompleted(block: number) {
    const prog = blockProgress(block);
    if (prog.post === prog.total && prog.total > 0) {
      // try fetch summary (may 404 until backend generates)
      await loadGame(block, { force: true });
    }
  }

  async function loadAssignments(block: number, opts: { force?: boolean, verbose?: boolean } = {}) {
    if (loadingAssignments.value) return;
    if (!opts.force && assignmentsByBlock.value[block]) return; // cached
    loadingAssignments.value = true;
    try {
  const list = await getGameAssignments(block, false);
      setAssignments(block, list);
  blockSizes.value[block] = Math.max(blockSizes.value[block] ?? 0, list.length);
      // After loading assignments, attempt summary refresh if block possibly already done
      refreshSummaryIfCompleted(block);
    } finally {
      loadingAssignments.value = false;
    }
  }

  function ensureAssignmentsLoaded(block: number) {
    if (!assignmentsByBlock.value[block]) {
      loadAssignments(block).catch(()=>{});
    }
  }

  function startSummaryPolling(block: number, intervalMs = 6000) {
    if (pollingHandles.value[block]) return; // already polling
    pollingHandles.value[block] = setInterval(async () => {
      const prog = blockProgress(block);
      if (prog.post === prog.total && prog.total > 0) {
        try {
          await loadGame(block, { force: true }); // fetch summary only after completion
        } catch (e) {
          // swallow 404 until backend finalizes
        }
        const summary = games.value.find(g=>g.block_index===block);
        if (summary && (summary.top1_accuracy_pre != null || summary.top1_accuracy_post != null)) {
          clearInterval(pollingHandles.value[block]);
          delete pollingHandles.value[block];
        }
      }
    }, intervalMs);
  }

  function stopSummaryPolling(block: number) {
    if (pollingHandles.value[block]) {
      clearInterval(pollingHandles.value[block]);
      delete pollingHandles.value[block];
    }
  }

  // Hydrate store when user lands directly on a case page (browser refresh) with an in-progress block.
  async function hydrateActiveGame() {
    // If we already have any assignments cached, skip
    if (Object.keys(assignmentsByBlock.value).length) return;
    try {
      const active: any = await getActiveGame();
      if (active && Array.isArray(active.assignments) && active.assignments.length) {
        const block = active.block_index ?? active.assignments[0].block_index;
        setAssignments(block, active.assignments as Assignment[]);
    blockSizes.value[block] = Math.max(blockSizes.value[block] ?? 0, (active.assignments as Assignment[]).length);
        // Always ensure a placeholder summary exists for the active block so the card persists
        if (!games.value.some(g => g.block_index === block)) {
          upsertGame({ block_index: block });
        }
      }
    } catch (e) {
      // silent: no active game is fine
    }
  }

  return { games, assignmentsByBlock, loadingGames, loadingAssignments, creatingNext, loadAllGames, loadGame, startNextGame, advanceToNext, activeAssignment, activeRemaining, activeStatus, getBlockAssignments, hasIncompleteBlock, latestBlockIndex, blockProgress, refreshSummaryIfCompleted, loadAssignments, ensureAssignmentsLoaded, startSummaryPolling, stopSummaryPolling, hydrateActiveGame };
});
