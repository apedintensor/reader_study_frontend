import apiClient from '.';

export interface GameSummary {
  block_index: number;
  top1_accuracy_pre?: number;
  top1_accuracy_post?: number;
  top3_accuracy_pre?: number;
  top3_accuracy_post?: number;
  delta_top1?: number;
  delta_top3?: number;
  peer_percentile_top1?: number;
  peer_percentile_top3?: number;
  created_at?: string;
}

export interface GameProgressResponse {
  total_cases: number;
  completed_cases: number; // POST phase done
  remaining_cases: number; // total_cases - completed_cases
  assigned_cases: number;  // already assigned to any block
  unassigned_cases: number; // total_cases - assigned_cases
  in_progress_cases: number; // PRE done but POST not yet
}

export type AssignmentArm = 'HUMAN' | 'HUMAN_AI';

export interface Assignment {
  id: number;
  user_id: number;
  case_id: number;
  arm: AssignmentArm;
  display_order: number;
  block_index: number;
  started_at?: string | null;
  completed_pre_at?: string | null;
  completed_post_at?: string | null;
}

// List historical block reports (renamed from getGames)
export async function getGames(): Promise<GameSummary[]> {
  const { data } = await apiClient.get<GameSummary[]>('/api/game/reports');
  return data;
}

// Fetch a specific block report
export async function getGame(block: number): Promise<GameSummary> {
  const { data } = await apiClient.get<GameSummary>(`/api/game/report/${block}`);
  return data;
}

// Start (or resume) the next game block
// Response shape for POST /game/start per OpenAPI spec
interface StartGameResponse { block_index: number; assignments: Assignment[] }

export async function createNextGame(_size = 10, _human_ai_probability = 0.5): Promise<Assignment[]> {
  const { data } = await apiClient.post<StartGameResponse | Assignment[]>('/api/game/start');
  // Backend returns { block_index, assignments: [...] }. Older placeholder code treated entire object as an array
  // which made assignments.length undefined and UI thought there were no remaining cases.
  if (Array.isArray(data)) return data;
  if (data && (data as any).assignments && Array.isArray((data as any).assignments)) {
    return (data as StartGameResponse).assignments;
  }
  return []; // defensive fallback
}

// Fetch assignments for a given block index (verbose flag may request expanded fields)
export async function getGameAssignments(block: number, _verbose = false): Promise<Assignment[]> {
  // There is no dedicated endpoint to fetch assignments for an arbitrary block.
  // Use /api/game/active and return assignments only when it matches the requested block.
  try {
    const active: any = await getActiveGame();
    if (
      active &&
      typeof active.block_index === 'number' &&
      active.block_index === block &&
      Array.isArray(active.assignments)
    ) {
      return active.assignments as Assignment[];
    }
  } catch (_) {
    // ignore errors; return empty to avoid throwing in UI
  }
  return [];
}

// Convenience: active game state (current in-progress block + assignments)
export async function getActiveGame() {
  const { data } = await apiClient.get(`/api/game/active`);
  return data;
}

export interface CanViewReportResponse {
  ready?: boolean;                 // legacy name
  available?: boolean;             // preferred flag
  reason?: string;                 // e.g., 'block_incomplete', 'block_not_found'
  remaining_cases?: number;        // if incomplete, how many POSTs left
}

export async function canViewReport(block: number): Promise<CanViewReportResponse> {
  const { data } = await apiClient.get(`/api/game/can_view_report/${block}`);
  return data as CanViewReportResponse;
}

export async function getLatestReport() {
  const { data } = await apiClient.get(`/api/game/report/latest`);
  return data as GameSummary;
}

export async function getGameProgress(): Promise<GameProgressResponse> {
  const { data } = await apiClient.get<GameProgressResponse>('/api/game/progress');
  return data;
}

// New unified endpoint for starting or advancing to the next assignment
export interface GameNextResponse {
  status: 'started' | 'continuing' | 'exhausted';
  block_index: number | null;
  assignment: Assignment | null; // present unless exhausted
  remaining: number; // remaining not POST-finished in current block (0 when just finished)
}

export async function gameNext(): Promise<GameNextResponse> {
  const { data } = await apiClient.post<GameNextResponse>('/api/game/next');
  return data;
}
