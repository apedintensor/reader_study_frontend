<template>
  <div v-if="cases && cases.length" class="overflow-auto case-table-wrap">
    <table class="case-table w-full">
      <thead>
        <tr>
          <th>Case</th>
          <th>Ground Truth</th>
          <th>Pre Top1</th>
          <th>Pre Top3</th>
          <th>Post Top1</th>
          <th>Post Top3</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in cases" :key="c.case_id">
          <td>#{{ c.case_id }}</td>
          <td>{{ idLabel(c.ground_truth_diagnosis_id) }}</td>
          <td :class="cellClass(c.pre_top1_diagnosis_term_id, c.ground_truth_diagnosis_id)">
            <span>{{ idLabel(c.pre_top1_diagnosis_term_id) }}</span>
            <i v-if="match(c.pre_top1_diagnosis_term_id, c.ground_truth_diagnosis_id)" class="pi pi-check text-green-500 ml-1" />
            <i v-else class="pi pi-times text-red-400 ml-1" />
          </td>
          <td>
            <div :class="top3CellClass(top3Ids(c,'pre'), c.ground_truth_diagnosis_id)" class="inline-flex align-items-center">
              <span>
                <template v-if="top3Ids(c,'pre') != null">
                  {{ (top3Ids(c,'pre') || []).map(idLabel).join(', ') || '—' }}
                </template>
                <template v-else>—</template>
              </span>
              <i v-if="anyMatch(top3Ids(c,'pre'), c.ground_truth_diagnosis_id)" class="pi pi-check text-green-500 ml-2" />
              <i v-else class="pi pi-times text-red-400 ml-2" />
            </div>
          </td>
          <td :class="cellClass(c.post_top1_diagnosis_term_id, c.ground_truth_diagnosis_id)">
            <span>{{ idLabel(c.post_top1_diagnosis_term_id) }}</span>
            <i v-if="match(c.post_top1_diagnosis_term_id, c.ground_truth_diagnosis_id)" class="pi pi-check text-green-500 ml-1" />
            <i v-else class="pi pi-times text-red-400 ml-1" />
          </td>
          <td>
            <div :class="top3CellClass(top3Ids(c,'post'), c.ground_truth_diagnosis_id)" class="inline-flex align-items-center">
              <span>
                <template v-if="top3Ids(c,'post') != null">
                  {{ (top3Ids(c,'post') || []).map(idLabel).join(', ') || '—' }}
                </template>
                <template v-else>—</template>
              </span>
              <i v-if="anyMatch(top3Ids(c,'post'), c.ground_truth_diagnosis_id)" class="pi pi-check text-green-500 ml-2" />
              <i v-else class="pi pi-times text-red-400 ml-2" />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-else class="text-500 text-xs">No case rows</div>
  
</template>

<script setup lang="ts">

const props = defineProps<{
  cases: any[];
  termMap?: Record<number, string>;
}>()

function idLabel(id?:number|null){
  if(id==null) return '—';
  return props.termMap?.[id] || `#${id}`;
}
function match(a?:number|null, b?:number|null){ return a!=null && b!=null && a===b; }
function cellClass(a?:number|null, gt?:number|null){ return match(a,gt) ? 'text-green-500 font-medium' : 'text-500'; }
function anyMatch(arr?: (number|null)[] | null, gt?: number|null){ if(!arr || gt==null) return false; return arr.some(id=>id===gt); }
function top3CellClass(arr?: (number|null)[] | null, gt?: number|null){ return anyMatch(arr, gt) ? 'text-green-500 font-medium' : 'text-500'; }
function top3Ids(c:any, phase:'pre'|'post') : (number|null)[] | null {
  if(phase==='pre') return c.pre_top3_diagnosis_term_ids || c.pre_top_diagnosis_term_ids || null;
  return c.post_top3_diagnosis_term_ids || c.post_top_diagnosis_term_ids || null;
}
</script>

<style scoped>
.case-table-wrap { border:1px solid var(--surface-border); border-radius:6px; overflow:hidden; background: var(--surface-card); }
.case-table { border-collapse: separate; border-spacing: 0; text-align:center; }
.case-table thead th { position:sticky; top:0; background: var(--surface-ground); color: var(--text-color); font-weight:600; font-size:.75rem; padding:.5rem; border-bottom:1px solid var(--surface-border); }
.case-table tbody td { padding:.5rem; border-top:1px solid var(--surface-border); }
.case-table tbody tr:nth-child(odd) td { background: color-mix(in srgb, var(--surface-overlay) 50%, transparent); }
.case-table tbody tr:hover td { background: color-mix(in srgb, var(--surface-overlay) 80%, transparent); }
.case-table td:first-child, .case-table th:first-child { border-left: none; }
.case-table td:last-child, .case-table th:last-child { border-right: none; }
</style>
