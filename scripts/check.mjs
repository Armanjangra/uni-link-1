import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
for (const dir of ['server','scripts']) {
  const walk = (d) => { for (const ent of fs.readdirSync(d,{withFileTypes:true})) { const full=path.join(d,ent.name); if(ent.isDirectory()) walk(full); else if(full.endsWith('.js') || full.endsWith('.mjs')) files.push(full); } };
  walk(path.join(root,dir));
}
let failed=false;
for (const file of files) { const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit'}); if(r.status!==0) failed=true; }
if(failed) process.exit(1);
console.log(`Syntax checks passed for ${files.length} server/script files.`);
