// CSS đã có sẵn trong frontend/src/styles/generated.css, chạy offline không cần CDN.
import {spawn} from 'node:child_process';
try{process.loadEnvFile('.env');}catch(err){if(err.code!=='ENOENT')throw err;}
const server=spawn(process.execPath,['--env-file-if-exists=.env','backend/src/server.js',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,SEED_DEMO:process.env.SEED_DEMO||'1'}});
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.kill(sig));
server.on('exit',code=>{process.exitCode=code??0;});
