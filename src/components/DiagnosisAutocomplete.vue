<template>
  <div class="diagnosis-autocomplete" ref="rootEl">
    <div class="input-wrapper" :class="{ disabled }">
      <input
        ref="inputEl"
        :placeholder="placeholder"
        :disabled="disabled"
        v-model="inputValue"
        @input="onInput"
        @focus="onFocus"
        @keydown.down.prevent="onArrowDown"
        @keydown.up.prevent="onArrowUp"
        @keydown.enter.prevent="onEnter"
        @keydown.esc.prevent="closeDropdown"
        class="da-input"
        autocomplete="off"
        spellcheck="false"
      />
      <span v-if="loading" class="spinner" aria-label="Loading"></span>
      <button v-if="inputValue && !loading" class="clear-btn" type="button" @click="clearInput" aria-label="Clear">×</button>
    </div>

    <transition name="fade">
      <ul
        v-if="showDropdown"
        class="results"
        role="listbox"
        :aria-activedescendant="activeOptionId"
      >
        <li
          v-for="(r, idx) in visibleResults"
          :key="r.item.id"
          :id="optionId(idx)"
          class="result"
          :class="{ active: idx === activeIndex }"
          role="option"
          :aria-selected="idx === activeIndex"
          @mousedown.prevent="selectResult(r.item)"
          @mousemove="activeIndex = idx"
        >
          <span class="primary" v-html="r.highlighted"></span>
          <small v-if="r.score !== undefined" class="score">{{ formatScore(r.score) }}</small>
        </li>
        <li v-if="!loading && results.length === 0" class="empty">No matches</li>
      </ul>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick, defineExpose } from 'vue';
import Fuse from 'fuse.js';
import type { FuseResultMatch } from 'fuse.js';

// --- Types ---
export interface DiagnosisTermSuggestion { id: number; name: string; synonyms: string[] }
// Backend may return { id, name? , canonical, synonyms, abbreviations }
interface RawSuggestion {
  id: number;
  name?: string;         // possible field
  canonical?: string;    // possible field
  label?: string;        // backend uses 'label' for canonical
  match?: string;        // backend provides matched fragment or full term
  src?: string;          // source of match (name|synonym|abbr)
  score?: number;        // backend rank (optional)
  synonyms?: string[];
  abbreviations?: string[];
  syns?: string[];       // backend shorthand array of synonyms
}

// --- Props / Emits ---
const props = withDefaults(defineProps<{
  modelValue: string;
  placeholder?: string;
  minChars?: number;
  maxResults?: number;
  disabled?: boolean;
}>(), {
  placeholder: 'Search diagnosis...',
  minChars: 2,
  maxResults: 8,
  disabled: false
});

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void;
  (e: 'select', term: DiagnosisTermSuggestion): void;
}>();

// --- Refs / State ---
const inputValue = ref(props.modelValue || '');
const loading = ref(false);
const results = ref<Array<{ item: DiagnosisTermSuggestion; score?: number; highlighted: string }>>([]);
const fuse = ref<Fuse<DiagnosisTermSuggestion> | null>(null);
const activeIndex = ref(-1);
const open = ref(false);
const selectedTerm = ref<DiagnosisTermSuggestion | null>(null);
const lastQuery = ref('');
const rootEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);

// --- Caching (normalized query -> raw term list) ---
const cache = new Map<string, DiagnosisTermSuggestion[]>();

// --- Debounce & Abort ---
let debounceTimer: number | null = null;
let abortCtrl: AbortController | null = null;

// --- Normalization ---
function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
}

// --- Fuse Initialization ---
function initFuse(list: DiagnosisTermSuggestion[]) {
  fuse.value = new Fuse(list, {
    includeScore: true,
    includeMatches: true,
    threshold: 0.35,
    distance: 100,
    minMatchCharLength: 2,
    keys: ['name', 'synonyms']
  });
}

// --- Highlighting ---
function highlightName(name: string, matches: readonly FuseResultMatch[] | undefined): string {
  if (!matches || matches.length === 0) return escapeHtml(name);
  // Collect ranges for key === 'name'
  const nameMatches = matches.filter(m => m.key === 'name');
  if (!nameMatches.length) return escapeHtml(name);
  const indices: Array<[number, number]> = [];
  nameMatches.forEach(m => m.indices.forEach((pair: readonly [number, number]) => indices.push([pair[0], pair[1]])));
  // Merge overlaps
  indices.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [s, e] of indices) {
    if (!merged.length || s > merged[merged.length - 1][1] + 1) {
      merged.push([s, e]);
    } else {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    }
  }
  let out = '';
  let cursor = 0;
  for (const [s, e] of merged) {
    if (cursor < s) out += escapeHtml(name.slice(cursor, s));
    out += '<mark>' + escapeHtml(name.slice(s, e + 1)) + '</mark>';
    cursor = e + 1;
  }
  if (cursor < name.length) out += escapeHtml(name.slice(cursor));
  return out;
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// --- Fetch Suggestions ---
import apiClient from '../api';

async function fetchSuggestions(query: string) {
  const norm = normalizeQuery(query);
  if (!norm || norm.length < props.minChars) {
    results.value = [];
    fuse.value = null;
    return;
  }
  if (cache.has(norm)) {
    initFuse(cache.get(norm)!);
    runFuse(norm);
    return;
  }
  if (abortCtrl) abortCtrl.abort();
  abortCtrl = new AbortController();
  loading.value = true;
  try {
  // Use centralized apiClient so baseURL / auth / env fallbacks apply (fixes production static hosting issue)
  const { data: raw } = await apiClient.get<unknown>(`/api/diagnosis_terms/suggest`, { params: { q: norm }, signal: abortCtrl.signal as any });
    let data: DiagnosisTermSuggestion[] = [];
    if (Array.isArray(raw)) {
      data = (raw as RawSuggestion[]).map(r => ({
        id: r.id,
        name: (r.name || r.label || r.canonical || '').trim(),
        synonyms: [...(r.synonyms || []), ...(r.abbreviations || []), ...(r.syns || [])].filter(Boolean)
      })).filter(r => r.name);
    } else if ((raw as any)?.items && Array.isArray((raw as any).items)) {
      data = ((raw as any).items as RawSuggestion[]).map(r => ({
        id: r.id,
        name: (r.name || r.label || r.canonical || '').trim(),
        synonyms: [...(r.synonyms || []), ...(r.abbreviations || []), ...(r.syns || [])].filter(Boolean)
      })).filter(r => r.name);
    }
    cache.set(norm, data);
    initFuse(data);
    runFuse(norm);
  } catch (e: any) {
    if (e.name === 'AbortError') return; // stale
    console.warn('Suggestion fetch failed:', e);
    results.value = [];
  } finally {
    loading.value = false;
  }
}

// --- Run Fuse Search ---
function runFuse(normQuery: string) {
  if (!fuse.value) return;
  const searchQuery = normQuery; // we already normalized; allow fuzzy
  const fuseResults = fuse.value.search(searchQuery, { limit: props.maxResults });
  // Deduplicate by canonical id (Fuse may return duplicates via synonyms)
  const seen = new Set<number>();
  const prepared: Array<{ item: DiagnosisTermSuggestion; score?: number; highlighted: string }> = [];
  for (const r of fuseResults) {
    if (seen.has(r.item.id)) continue;
    seen.add(r.item.id);
    prepared.push({
      item: r.item,
      score: r.score,
      highlighted: highlightName(r.item.name, r.matches)
    });
  }
  // Fallback: if Fuse returned nothing but we have a source list, show top original list
  if (!prepared.length) {
    const source = (fuse.value as any)._docs as DiagnosisTermSuggestion[] | undefined;
    if (source && source.length) {
      results.value = source.slice(0, props.maxResults).map(it => ({ item: it, highlighted: escapeHtml(it.name), score: undefined }));
    } else {
      results.value = [];
    }
  } else {
    results.value = prepared;
  }
  activeIndex.value = prepared.length ? 0 : -1;
  open.value = true;
}

// --- Input Handling ---
function onInput() {
  emit('update:modelValue', inputValue.value);
  selectedTerm.value = null; // Reset selection if user edits
  scheduleSearch();
}

function scheduleSearch() {
  if (debounceTimer) window.clearTimeout(debounceTimer);
  const current = inputValue.value;
  debounceTimer = window.setTimeout(() => {
    const norm = normalizeQuery(current);
    if (!norm || norm.length < props.minChars) {
      results.value = [];
      open.value = false;
      return;
    }
    if (norm === lastQuery.value) {
      // If we have no results or fuse was reset, force refetch
      if (!results.value.length || !fuse.value) {
        fetchSuggestions(current);
      } else {
        open.value = true; // reuse existing
      }
      return;
    }
    lastQuery.value = norm;
    fetchSuggestions(current);
  }, 250);
}

// --- Selection ---
function selectResult(term: DiagnosisTermSuggestion) {
  selectedTerm.value = term;
  inputValue.value = term.name;
  emit('update:modelValue', term.name);
  emit('select', term);
  closeDropdown();
  nextTick(() => inputEl.value?.blur());
}

function clearInput() {
  inputValue.value = '';
  selectedTerm.value = null;
  emit('update:modelValue', '');
  results.value = [];
  open.value = false;
  lastQuery.value = '';
}

// --- Keyboard Navigation ---
function onArrowDown() {
  if (!open.value) open.value = true;
  if (!results.value.length) return;
  activeIndex.value = (activeIndex.value + 1) % results.value.length;
}
function onArrowUp() {
  if (!open.value) open.value = true;
  if (!results.value.length) return;
  activeIndex.value = (activeIndex.value - 1 + results.value.length) % results.value.length;
}
function onEnter() {
  if (open.value && activeIndex.value >= 0 && activeIndex.value < results.value.length) {
    selectResult(results.value[activeIndex.value].item);
  } else if (inputValue.value && !selectedTerm.value) {
    // Attempt exact selection if the typed value matches a canonical name exactly in results
    const exact = results.value.find(r => r.item.name.toLowerCase() === inputValue.value.toLowerCase());
    if (exact) selectResult(exact.item);
  }
}

function closeDropdown() { open.value = false; }

function onFocus() {
  // Re-trigger search when refocusing with same text after clearing results externally
  const norm = normalizeQuery(inputValue.value);
  if (norm && norm.length >= props.minChars) {
    if (!results.value.length) {
      // Immediate fetch (no debounce) to feel responsive on refocus
      fetchSuggestions(inputValue.value);
    } else {
      open.value = true;
    }
  }
}

// --- Outside Click ---
function onClickOutside(e: MouseEvent) {
  if (!rootEl.value) return;
  if (!rootEl.value.contains(e.target as Node)) closeDropdown();
}
onMounted(() => document.addEventListener('mousedown', onClickOutside));
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside));

// --- Sync with external v-model ---
watch(() => props.modelValue, (v) => {
  if (v !== inputValue.value) inputValue.value = v || '';
});

// --- Computeds ---
const showDropdown = computed(() => open.value && (loading.value || results.value.length > 0 || lastQuery.value.length >= props.minChars));
const visibleResults = computed(() => results.value.slice(0, props.maxResults));
const activeOptionId = computed(() => activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined);
function optionId(i: number) { return `da-opt-${i}`; }
function formatScore(score?: number) { return score == null ? '' : (Math.round((1 - score) * 100)).toString(); }

// --- Expose selected term ---
function getSelectedTerm() { return selectedTerm.value; }
defineExpose({ getSelectedTerm });
</script>

<style scoped>
.diagnosis-autocomplete { position: relative; width: 100%; }
.input-wrapper { position: relative; display: flex; align-items: center; }
.input-wrapper.disabled { opacity: 0.6; cursor: not-allowed; }
.da-input { width:100%; padding:.5rem 2.25rem .5rem .65rem; border:1px solid var(--border-color); border-radius:4px; font-size:.95rem; background: var(--bg-surface-card); color: var(--text-color); transition: background .15s,color .15s,border-color .15s; }
.da-input::placeholder { color: var(--text-color-muted); opacity:.75; }
.da-input:focus { outline:2px solid var(--accent-primary); outline-offset:1px; border-color: var(--accent-primary); }
.spinner { position:absolute; right:.5rem; width:14px; height:14px; border:2px solid var(--border-color); border-top-color: var(--accent-primary); border-radius:50%; animation:spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.clear-btn { position:absolute; right:.25rem; background:transparent; border:none; font-size:1.1rem; cursor:pointer; line-height:1; padding:0 .25rem; color: var(--text-color-secondary); }
.clear-btn:hover { color: var(--text-color); }
.results { position:absolute; z-index:30; top:calc(100% + 4px); left:0; right:0; list-style:none; margin:0; padding:4px 0; background:var(--bg-surface-overlay,var(--bg-surface-card)); color:var(--text-color); border:1px solid var(--border-color); border-radius:6px; max-height:300px; overflow-y:auto; backdrop-filter:saturate(180%) blur(6px); box-shadow:0 8px 24px -6px rgba(0,0,0,.2),0 2px 6px rgba(0,0,0,.12); }
.result { padding:8px 12px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:.75rem; font-size:.9rem; }
.result:hover { background: var(--highlight-bg,rgba(99,102,241,0.14)); }
.result.active { background: var(--accent-primary); color: var(--color-white,#fff); }
.result.active mark { background: rgba(255,255,255,0.35); color:inherit; }
.result mark { background: var(--highlight-accent); padding:0 2px; border-radius:2px; color:inherit; }
.result .score { opacity: 0.55; font-size: 0.65rem; letter-spacing: 0.5px; }
.empty { padding:10px 12px; font-size:.85rem; color: var(--text-color-secondary); }

/* Scrollbar subtle */
.results::-webkit-scrollbar { width: 8px; }
.results::-webkit-scrollbar-track { background: transparent; }
.results::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
.result:not(.active) .primary { font-weight: 500; }

/* Dark mode handled by tokens (no extra selectors needed) */

/* High contrast tweak if user overrides primary color */
@media (prefers-contrast: more) {
  .result.active { outline: 2px solid var(--accent-primary); }
  .da-input:focus { outline-width: 3px; }
}
.fade-enter-active, .fade-leave-active { transition: opacity 120ms ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

<!-- Usage Example (Parent Component)
<script setup lang="ts">
import { ref } from 'vue';
import DiagnosisAutocomplete, { DiagnosisTermSuggestion } from '@/components/DiagnosisAutocomplete.vue';

const diagnosis = ref('');
let selected: DiagnosisTermSuggestion | null = null;

function handleSelect(term: DiagnosisTermSuggestion) {
  selected = term;
}

async function submit() {
  if (!selected) return;
  await fetch('/api/assessment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ term_id: selected.id, name: selected.name })
  });
}
</script>

<template>
  <DiagnosisAutocomplete v-model="diagnosis" @select="handleSelect" />
  <button @click="submit">Submit</button>
</template>
-->