# Frontend Style Architecture

Goal: Single source of truth for colors & reusable presentation while keeping component scopes lean.

## Layers
1. tokens.css
   Pure design tokens (semantic + primitives). Do not put layout or component selectors here.
2. utilities.css
   Small utility classes mapping to tokens (text colors, surfaces, state colors, spacing helpers).
3. base.css
   Pure global element defaults (typography smoothing, body/html sizing, minimal resets). No theme colors defined here.
4. Component-scoped <style scoped>
   Only structure + specific layout tweaks. Pull colors from utilities or rely on inheritance.

## How to Change a Color
1. Adjust semantic token in `tokens.css` (e.g. --text-color-secondary).
2. Utilities + components inherit automatically.
3. If a component had a hard-coded hex, replace with a token or utility class.

## Dark Mode
Triggered by `body.dark-theme` class (set in `MainLayout.vue`). The dark block in `tokens.css` overrides semantic tokens. No per‑component dark selectors should be needed—remove them as you touch components.

## Migration Checklist When Editing a Component
- Remove hex / rgba if a token exists.
- Replace complex color logic with utility classes (e.g., `u-text-muted`).
- Ensure no duplicate background / border declarations if a utility fits (`u-surface-card`).
- Delete obsolete local dark-mode overrides once token driven.
 - Prefer utility + semantic token over custom gradients; use `--accent-cta-start/end` for CTA buttons.
 - If legacy classes like `text-500` remain, they now map to tokens via a bridge in `utilities.css`; still migrate to semantic utilities when convenient.

## Example
Before:
```vue
<div class="panel" />
<style scoped>
.panel { background:#1e1e1e; border:1px solid #2a2a2a; color:#e0e0e0; }
body.dark-theme .panel { background:#181818; }
</style>
```
After:
```vue
<div class="u-surface-card u-card-pad" />
```

## Utilities Quick Reference
- Text: `u-text-secondary`, `u-text-muted`
- Surfaces: `u-surface-card`, `u-surface-overlay`
- State: `u-success`, `u-danger`
- Generic border: `u-border`
- Headings: `u-heading`, `u-heading-sub`
- Legacy bridges: `.text-500` (muted), `.text-600` (secondary)
- Elevation: `u-elev-1` … `u-elev-4`
- Spacing: `m-0`, `mt-1..4`, `p-1..4`
- Typography sizes: `fs-xs`, `fs-sm`, `fs-base`, `fs-lg`, `fs-xl`, `fs-2xl`, `fs-3xl`
- Line height: `lh-tight`, `lh-normal`, `lh-relaxed`
- Motion: `transition-base`
- Composite: `u-card` (surface+border+padding+elevation), `u-card-interactive`

## Future Improvements
- Provide CSS logical properties for RTL readiness.
- Container Query driven refinements.
- Map PrimeFlex spacing utilities to token scale automatically.
- Add color algorithm tooling (e.g., lightness shift) for on-the-fly variants.
 - Auto-generate utility docs from tokens.

## Style Quality Gates
- `npm run style:audit` scans for raw hex codes outside whitelisted token/base files.
- `npm run style:inline` rejects inline styles containing hex colors.
- `npm run style:check` runs both; integrate in CI before build.

To allow a new raw color, add a token instead of embedding the hex.
