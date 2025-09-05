#!/usr/bin/env node
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const exts = ['.vue', '.css'];
const hexRegex = /#[0-9a-fA-F]{3,6}\b/g;
const disallowed = []; // no disallowed properties currently
const allowList = ['#fff', '#FFFFFF'];
const fileWhitelist = [
  /src\\styles\\tokens\.css$/,
  /src\\style\.css$/
];

let issues = [];

function walk(dir){
  for(const entry of readdirSync(dir, { withFileTypes:true })){
    const p = join(dir, entry.name);
    if(entry.isDirectory()) walk(p); else if(exts.some(e=> entry.name.endsWith(e))){
      auditFile(p);
    }
  }
}

function auditFile(file){
  const text = readFileSync(file, 'utf8');
  // Hex scan
  const hexes = [...text.matchAll(hexRegex)].map(m=>m[0]);
  const whitelisted = fileWhitelist.some(r=> r.test(file));
  for(const h of hexes){
    if(whitelisted) continue;
    if(!allowList.includes(h)) issues.push({ file, type:'hex-color', value:h });
  }
  // Disallowed properties (simple check)
  for(const prop of disallowed){
    if(text.includes(prop+':')){
      issues.push({ file, type:'disallowed-prop', value:prop });
    }
  }
}

walk(SRC);

if(!issues.length){
  console.log('\u2705 Style audit passed (no unexpected hex colors).');
  process.exit(0);
}
console.log('\n\u26A0 Style audit found issues:');
for(const i of issues){
  console.log(`- [${i.type}] ${i.value} in ${i.file}`);
}
process.exit(1);
