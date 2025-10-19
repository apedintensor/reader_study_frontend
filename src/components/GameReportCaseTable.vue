<template>
  <div v-if="loading" class="text-500 text-xs mb-2">Loading diagnosis entries…</div>
  <div v-if="error" class="text-xs text-red-500 mb-2">{{ error }}</div>
  <div v-if="rows.length" class="overflow-auto case-table-wrap">
    <table class="case-table w-full">
      <thead>
        <tr>
          <th>Case</th>
          <th>Ground Truth</th>
          <th>Pre-AI Diagnoses</th>
          <th>Post-AI Diagnoses</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.caseKey">
          <td>{{ row.caseLabel }}</td>
          <td>{{ groundTruthLabel(row) }}</td>
          <td>
            <template v-if="row.preEntries?.length">
              <ol class="diagnosis-list">
                <li v-for="entry in row.preEntries" :key="`pre-${row.caseKey}-${entry.rank}`">
                  <span>{{ entry.raw_text || '—' }}</span>
                </li>
              </ol>
            </template>
            <span v-else class="text-500">—</span>
          </td>
          <td>
            <template v-if="row.postEntries?.length">
              <ol class="diagnosis-list">
                <li v-for="entry in row.postEntries" :key="`post-${row.caseKey}-${entry.rank}`">
                  <span>{{ entry.raw_text || '—' }}</span>
                </li>
              </ol>
            </template>
            <span v-else class="text-500">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-else-if="!loading" class="text-500 text-xs">No case rows</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { getDiagnosisEntries } from '../api/assessments';

interface TableRow {
  caseKey: string;
  caseLabel: string;
  groundTruthId?: number | null;
  groundTruthLabel?: string | null;
  preEntries: DisplayEntry[] | null;
  postEntries: DisplayEntry[] | null;
}

interface DisplayEntry {
  id: number | null;
  rank: number;
  raw_text: string;
  diagnosis_term_id?: number | null;
}

const props = defineProps<{
  cases: any[];
  termMap?: Record<number, string>;
}>();

const rows = ref<TableRow[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const diagnosisCache = new Map<number, DisplayEntry[]>();
let requestToken = 0;

function normalizeEntries(entries: any): DisplayEntry[] | null {
  if (!Array.isArray(entries)) return null;
  const cleaned = entries
    .map((entry: any) => {
      if (!entry || typeof entry.rank !== 'number') return null;
      return {
        id: typeof entry.id === 'number' ? entry.id : null,
        rank: entry.rank,
        raw_text: typeof entry.raw_text === 'string' ? entry.raw_text : '',
        diagnosis_term_id: entry.diagnosis_term_id ?? null,
      } satisfies DisplayEntry;
    })
    .filter(Boolean) as DisplayEntry[];
  return cleaned.sort((a, b) => a.rank - b.rank);
}

async function loadEntries(assessmentId: number): Promise<DisplayEntry[] | null> {
  if (diagnosisCache.has(assessmentId)) {
    return diagnosisCache.get(assessmentId)!;
  }
  try {
    const data = await getDiagnosisEntries(assessmentId);
    const normalized = normalizeEntries(data) ?? [];
    diagnosisCache.set(assessmentId, normalized);
    return normalized;
  } catch (e: any) {
    console.error('Failed to load diagnosis entries for assessment', assessmentId, e);
    error.value = 'Some diagnosis entries could not be loaded.';
    diagnosisCache.set(assessmentId, []);
    return [];
  }
}

function extractAssessmentId(caseItem: any, phase: 'pre' | 'post'): number | null {
  const directKey = phase === 'pre' ? 'pre_assessment_id' : 'post_assessment_id';
  const camelKey = phase === 'pre' ? 'preAssessmentId' : 'postAssessmentId';
  const objectKey = phase === 'pre' ? 'pre_assessment' : 'post_assessment';
  return (
    caseItem?.[directKey] ??
    caseItem?.[camelKey] ??
    caseItem?.[objectKey]?.id ??
    null
  );
}

function extractEntriesFromCase(caseItem: any, phase: 'pre' | 'post'): DisplayEntry[] | null {
  const key = phase === 'pre' ? 'pre_diagnosis_entries' : 'post_diagnosis_entries';
  const altKey = phase === 'pre' ? 'preEntries' : 'postEntries';
  return normalizeEntries(caseItem?.[key] ?? caseItem?.[altKey]);
}

function extractGroundTruth(caseItem: any) {
  const label =
    caseItem?.ground_truth_label ??
    caseItem?.ground_truth_name ??
    caseItem?.ground_truth?.name ??
    null;
  const id =
    caseItem?.ground_truth_diagnosis_id ??
    caseItem?.ground_truth_id ??
    caseItem?.ground_truth?.id ??
    null;
  return { id, label };
}

function buildCaseLabel(caseItem: any, index: number) {
  const number =
    caseItem?.case_number ??
    caseItem?.case_display_number ??
    caseItem?.display_order ??
    caseItem?.case_id ??
    index + 1;
  return `#${number}`;
}

function groundTruthLabel(row: TableRow) {
  if (row.groundTruthLabel) return row.groundTruthLabel;
  if (row.groundTruthId == null) return '—';
  return props.termMap?.[row.groundTruthId] ?? `#${row.groundTruthId}`;
}

async function rebuildRows() {
  const currentCases = Array.isArray(props.cases) ? props.cases : [];
  if (!currentCases.length) {
    rows.value = [];
    loading.value = false;
    error.value = null;
    return;
  }
  loading.value = true;
  error.value = null;
  const token = ++requestToken;
  const built = await Promise.all(
    currentCases.map(async (caseItem, index) => {
      const { id: groundTruthId, label: groundTruthLabel } = extractGroundTruth(caseItem);
      const caseLabel = buildCaseLabel(caseItem, index);
      const caseKey = String(
        caseItem?.case_id ??
        caseItem?.case_number ??
        caseItem?.case_display_number ??
        caseItem?.display_order ??
        index
      );

      const preAssessmentId = extractAssessmentId(caseItem, 'pre');
      const postAssessmentId = extractAssessmentId(caseItem, 'post');

      let preEntries = extractEntriesFromCase(caseItem, 'pre');
      if (!preEntries && preAssessmentId) {
        preEntries = await loadEntries(preAssessmentId) ?? [];
      }

      let postEntries = extractEntriesFromCase(caseItem, 'post');
      if (!postEntries && postAssessmentId) {
        postEntries = await loadEntries(postAssessmentId) ?? [];
      }

      return {
        caseKey,
        caseLabel,
        groundTruthId,
        groundTruthLabel,
        preEntries: preEntries ?? null,
        postEntries: postEntries ?? null,
      } satisfies TableRow;
    })
  );

  if (token === requestToken) {
    rows.value = built;
    loading.value = false;
  }
}

watch(
  () => props.cases,
  () => {
    rebuildRows().catch((e) => {
      console.error('Failed to rebuild report rows', e);
      loading.value = false;
      error.value = 'Unable to display diagnosis entries right now.';
    });
  },
  { immediate: true, deep: true }
);
</script>

<style scoped>
.case-table-wrap { border:1px solid var(--surface-border); border-radius:6px; overflow:hidden; background: var(--surface-card); }
.case-table { border-collapse: separate; border-spacing: 0; text-align:left; }
.case-table thead th { position:sticky; top:0; background: var(--surface-ground); color: var(--text-color); font-weight:600; font-size:.75rem; padding:.6rem; border-bottom:1px solid var(--surface-border); }
.case-table tbody td { padding:.6rem; border-top:1px solid var(--surface-border); vertical-align:top; }
.case-table tbody tr:nth-child(odd) td { background: color-mix(in srgb, var(--surface-overlay) 35%, transparent); }
.case-table tbody tr:hover td { background: color-mix(in srgb, var(--surface-overlay) 60%, transparent); }
.diagnosis-list { margin:0; padding-left:1.1rem; display:flex; flex-direction:column; gap:.35rem; }
.diagnosis-list li { list-style:decimal; font-size:.8rem; color: var(--text-color); }
.case-table tbody td span.text-500 { color: var(--text-color-secondary); }
</style>
