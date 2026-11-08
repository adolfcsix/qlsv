import {readdir,readFile,stat} from 'node:fs/promises';
import {resolve,relative,dirname,join,extname} from 'node:path';
import {createHash} from 'node:crypto';

const root=resolve(import.meta.dirname,'..');
const sourceDirs=['frontend/src','backend/src','backend/database/seeds','backend/scripts','shared','scripts'];
const codeExtensions=new Set(['.js','.mjs']);
const source=new Set();

async function collect(folder){
  for(const entry of await readdir(folder,{withFileTypes:true})){
    if(['node_modules','dist'].includes(entry.name))continue;
    const name=join(folder,entry.name);
    if(entry.isDirectory())await collect(name);
    else if(codeExtensions.has(extname(name)))source.add(resolve(name));
  }
}
for(const dir of sourceDirs)await collect(join(root,dir));

const imports=new Map(),missing=[],hashes=new Map();
const staticImport=/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])(\.[^'"\n]+)\1/g;
for(const file of source){
  const content=await readFile(file,'utf8');
  const targets=[];
  for(const match of content.matchAll(staticImport)){
    const specifier=match[2];
    let target=resolve(dirname(file),specifier);
    if(!extname(target))target+='.js';
    try{if(!(await stat(target)).isFile())missing.push(`${relative(root,file)} → ${specifier}`)}
    catch{missing.push(`${relative(root,file)} → ${specifier}`);}
    targets.push(target);
  }
  imports.set(file,targets);
  // Multiple identical source files are evidence of code duplication, not a versioned artifact.
  if(content.length>200&&!file.endsWith('audit-source.mjs')){
    const checksum=createHash('sha256').update(content).digest('hex');
    (hashes.get(checksum)||hashes.set(checksum,[]).get(checksum)).push(relative(root,file));
  }
}
const entrypoints=[
  'frontend/src/main.js','backend/src/server.js','backend/scripts/init.mjs',
  'backend/scripts/seed.mjs','backend/scripts/bootstrap.mjs',
  'scripts/dev.mjs','scripts/build.mjs','scripts/css.mjs','scripts/serve.mjs',
  'scripts/audit-source.mjs','scripts/check-local.mjs','scripts/check-ai.mjs',
  'scripts/configure-ai.mjs' // Điểm vào CLI `npm run ai:setup`, không có import từ trang web.
].map(filename=>resolve(root,filename));
async function reachable(entries){
 const seen=new Set(),todo=[...entries];
 while(todo.length){
   const file=todo.pop();
   if(seen.has(file))continue;
   seen.add(file);todo.push(...(imports.get(file)||[]));
 }
 return seen;
}
const production=await reachable(entrypoints);
const testFiles=await readdir(join(root,'tests'));
const tested=await reachable([...entrypoints,...testFiles.filter(name=>name.endsWith('.test.mjs')).map(name=>resolve(root,'tests',name))]);
const duplicates=[...hashes.values()].filter(group=>group.length>1);
const unused=[...source].filter(file=>!tested.has(file)).map(file=>relative(root,file));
const testOnly=[...source].filter(file=>!production.has(file)&&tested.has(file)&&!file.startsWith(join(root,'tests'))).map(file=>relative(root,file));
const obsolete=['backend/src/security.js','backend/src/mutations.js','backend/src/state.js','backend/src/assistant.js','backend/src/results.js','backend/src/database.js','backend/src/seed.js','frontend/src/pages/academic/students/students.js','frontend/src/pages/account/change-password.js','frontend/src/pages/account/profile-security.js','frontend/src/app.js','frontend/src/pages.js','frontend/src/ui.js','frontend/src/repository.js','frontend/src/features/chatbot/chatbot.js'];
const stale=[];for(const name of obsolete){try{await stat(join(root,name));stale.push(name)}catch{}}
// Truy vết stylesheet nguồn và output biên dịch để tránh xóa nhầm CSS đang sử dụng.
const styleRoot=join(root,'frontend/src/styles');
const styleFiles=(await readdir(styleRoot)).filter(name=>name.endsWith('.css'));
const styleImports=new Map(),missingStyles=[];
for(const name of styleFiles){
  const file=resolve(styleRoot,name);
  const contents=await readFile(file,'utf8');
  const targets=[];
  for(const match of contents.matchAll(/@import\s+['"](\.[^'"]+)['"]/g)){
    const target=resolve(dirname(file),match[1]);
    try{if(!(await stat(target)).isFile())missingStyles.push(`${name} → ${match[1]}`)}
    catch{missingStyles.push(`${name} → ${match[1]}`)}
    targets.push(target);
  }
  styleImports.set(file,targets);
}
const usedStyles=new Set(),queue=['main.css','theme.css'].map(file=>resolve(styleRoot,file));
while(queue.length){
  const name=queue.pop();
  if(usedStyles.has(name))continue;
  usedStyles.add(name);
  queue.push(...(styleImports.get(name)||[]));
}
const unusedStyles=styleFiles.filter(name=>!usedStyles.has(resolve(styleRoot,name)));
// Các endpoint cũ vẫn đang hoạt động; ghi nhận số chỗ gọi thay vì xóa nhầm.
const compatibilityFiles=[];
for(const file of source){
  if(!file.includes('/frontend/src/'))continue;
  const contents=await readFile(file,'utf8');
  if(/api\(['"]\/(?:state|changes)['"]|api\(['"]\/(?:state|changes)[?'\w]/.test(contents))compatibilityFiles.push(relative(root,file));
}
const summary={sourceFiles:source.size,missingImports:missing,duplicateFiles:duplicates,unusedSources:unused,testOnlySources:testOnly,obsoleteFiles:stale,styleFiles:styleFiles.length,missingStyles,unusedStyles,compatibilityFiles};
console.log(JSON.stringify(summary,null,2));
if(missing.length||duplicates.length||unused.length||stale.length||missingStyles.length||unusedStyles.length)process.exitCode=1;
