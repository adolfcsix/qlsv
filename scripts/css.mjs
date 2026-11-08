import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function compileCSS(watch=false){
 const cli=fileURLToPath(new URL('../node_modules/@tailwindcss/cli/dist/index.mjs',import.meta.url));
 return spawn(process.execPath,[cli,'-i','frontend/src/styles/theme.css','-o','frontend/src/styles/generated.css','--minify',...(watch?['--watch=always']:[])],{stdio:'inherit'});
}
export function cssOnce(){return new Promise((resolve,reject)=>{const c=compileCSS();c.on('error',reject);c.on('exit',n=>n===0?resolve():reject(new Error('npm ci để cài bộ biên dịch CSS.')));});}
