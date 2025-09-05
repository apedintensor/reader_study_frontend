#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const vueExt = '.vue';
const disallowedInline = /style\s*=\s*"[^"]*#[0-9a-fA-F]{3,6}[^"]*"/g;
let issues = [];

function walk(dir){
  for(const e of readdirSync(dir,{withFileTypes:true})){
    const p = join(dir,e.name);
    if(e.isDirectory()) walk(p); else if(e.name.endsWith(vueExt)) audit(p);
  }
}
function audit(file){
  const text = readFileSync(file,'utf8');
  const matches = text.match(disallowedInline); if(matches){
    matches.forEach(m=> issues.push({file, snippet:m.slice(0,120)}));
  }
}
walk(SRC);
if(!issues.length){
  console.log('✅ Inline style audit passed (no inline hex styles).');
  process.exit(0);
}
console.log('⚠ Inline style audit found issues:');
issues.forEach(i=> console.log('-', i.file, '\n  ', i.snippet));
process.exit(1);
