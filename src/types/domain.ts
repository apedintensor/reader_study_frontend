// Central domain types aligned with backend-normalized schemas.
// All optional additive fields marked with ?: so we can evolve without breaking.

export interface DiagnosisTerm { id: number; name: string }

// Suggestion (canonical + synonym) returned by /api/v1/diagnosis_terms/suggest
export interface DiagnosisTermSuggestion {
  id: number;        // canonical term id
  label: string;     // canonical name
  match: string;     // matched fragment or synonym
  source: 'name' | 'synonym';
  score: number;     // ordering heuristic (higher better)
}

export interface Image { id: number; case_id: number; image_url: string; full_url?: string }

export interface AIOutput {
  id: number;
  case_id: number;
  rank: number; // 1..n (top 3 relevant)
  prediction_id: number;
  confidence_score: number;
  prediction: DiagnosisTerm;
}

export interface Case {
  id: number;
  ground_truth_diagnosis_id: number;
  typical_diagnosis: boolean;
  created_at?: string;
  images: Image[];
  ai_outputs: AIOutput[];
  ground_truth_diagnosis?: DiagnosisTerm;
  malignancy_flag?: boolean;
  superclass?: string;
  source_dataset?: string;
  original_source_id?: string;
}

export interface Diagnosis {
  id: number;
  assessment_user_id: number;
  assessment_case_id: number;
  assessment_is_post_ai: boolean;
  rank: number; // 1|2|3 in practice
  diagnosis_id: number; // FK -> DiagnosisTerm.id
  diagnosis_term: DiagnosisTerm;
}

// Forward-looking free-text entry (feature-flagged backend endpoint not yet active)
export interface DiagnosisEntry {
  id?: number;
  rank: 1 | 2 | 3;
  raw_text: string;
  diagnosis_term_id?: number;
  mapping_method?: string; // EXACT | PREFIX | SUBTEXT | SYNONYM | ALIAS | ABBREVIATION | FUZZY | NONE
  mapping_confidence?: number; // 0-1 or percentage *100? treat as 0-1 now
}


// --- New normalized assessment model (block-based workflow) ---
export type AssessmentPhase = 'PRE' | 'POST';

export interface ReaderCaseAssignment {
  id: number;
  user_id: number;
  case_id: number;
  arm: string;             // HUMAN | HUMAN_AI (string for forward compat)
  display_order: number;   // 0..9 within block
  block_index: number;     // zero-based block identifier
  started_at?: string;
  completed_pre_at?: string | null;
  completed_post_at?: string | null;
}

export interface DiagnosisEntryCreate {
  rank: 1 | 2 | 3;
  raw_text?: string;
  diagnosis_term_id?: number; // canonical selection
}

export interface DiagnosisEntryRead extends DiagnosisEntryCreate { id: number; }

export interface AssessmentNew {
  id: number;
  assignment_id: number;
  phase: AssessmentPhase;
  diagnostic_confidence?: number | null;
  management_confidence?: number | null;
  investigation_plan?: 'none' | 'biopsy' | 'other' | null;
  next_step?: 'reassure' | 'manage' | 'refer' | null;
  changed_primary_diagnosis?: boolean | null;
  changed_management_plan?: boolean | null;
  ai_usefulness?: string | null;
  top1_correct?: boolean | null;
  top3_correct?: boolean | null;
  rank_of_truth?: number | null;
  created_at: string;
  diagnosis_entries: DiagnosisEntryRead[];
}

export interface BlockFeedbackRead {
  id: number;
  user_id: number;
  block_index: number;
  top1_accuracy_pre?: number | null;
  top1_accuracy_post?: number | null;
  top3_accuracy_pre?: number | null;
  top3_accuracy_post?: number | null;
  delta_top1?: number | null;
  delta_top3?: number | null;
  peer_percentile_top1?: number | null;
  peer_percentile_top3?: number | null;
  stats_json?: Record<string, any> | null;
  created_at: string;
}

export interface StartGameResponse { block_index: number; assignments: ReaderCaseAssignment[]; }
export interface ActiveGameResponse { block_index: number; assignments: ReaderCaseAssignment[]; remaining: number; }

export interface AssessmentCreatePayload {
  assignment_id: number;
  phase: AssessmentPhase;
  diagnostic_confidence?: number | null;
  management_confidence?: number | null;
  investigation_plan?: 'none' | 'biopsy' | 'other' | null;
  next_step?: 'reassure' | 'manage' | 'refer' | null;
  changed_primary_diagnosis?: boolean | null; // POST only
  changed_management_plan?: boolean | null;   // POST only
  ai_usefulness?: string | null;              // POST only
  diagnosis_entries: DiagnosisEntryCreate[];  // rank1 required
}

// Legacy Assessment kept temporarily for backward compatibility (remove once migration done)
export interface Assessment {
  user_id: number;
  case_id: number;
  is_post_ai: boolean;
  assessable_image_score?: number;
  diagnostic_confidence?: number; // 1-5 required for submit
  management_confidence?: number; // 1-5
  biopsy_recommended?: boolean;
  referral_recommended?: boolean;
  was_updated?: boolean;
  change_diagnosis_after_ai?: boolean;
  change_management_after_ai?: boolean;
  created_at: string;
  diagnoses: Diagnosis[]; // legacy path
  ai_suggestions_json?: AIOutput[]; // additive when server provides
}

// Lightweight shape for creation (legacy) – omit server-computed fields
// (Legacy) Lightweight shape for creation (deprecated)
export interface LegacyAssessmentCreatePayload {
  user_id: number;
  case_id: number;
  is_post_ai: boolean;
  diagnostic_confidence: number;
  biopsy_recommended: boolean;
  referral_recommended: boolean;
  management_confidence: number;
  was_updated?: boolean; // for POST only
}

// Gamification block feedback (client-side computation placeholder)
export interface BlockFeedback {
  block_index: number; // zero-based
  top1_accuracy_pre?: number;
  top1_accuracy_post?: number;
  top3_accuracy_pre?: number;
  top3_accuracy_post?: number;
  peer_percentile_top1?: number; // optional from backend later
  peer_percentile_top3?: number;
  delta_top1?: number; // post - pre
  delta_top3?: number;
}

export interface LegacyDiagnosisCreatePayload {
  assessment_user_id: number;
  assessment_case_id: number;
  assessment_is_post_ai: boolean;
  rank: 1 | 2 | 3;
  diagnosis_id: number; // selected term id
}

// Diff model used for was_updated computation
export interface PrePostComparableSubset {
  diagnostic_confidence?: number;
  management_confidence?: number;
  investigation_plan?: 'none' | 'biopsy' | 'other' | null;
  next_step?: 'reassure' | 'manage' | 'refer' | null;
  diagnoses: Array<{ rank: number; diagnosis_id?: number; raw_text?: string }>; // raw_text for future replacement
}
