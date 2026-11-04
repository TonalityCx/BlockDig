const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),task=process.argv[2]||'serve';
const bundled=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe');
const runtime=process.env.BLOCKDIG_NODE||(Number(process.versions.node.split('.')[0])>=20?process.execPath:fs.existsSync(bundled)?bundled:null);
if(!runtime){console.error('需要 Node.js 20 或更新版本。可通过 BLOCKDIG_NODE 指定路径。');process.exit(1);}
const commands={serve:['tools/serve.cjs'],build:['tools/build.cjs'],release:['tools/build.cjs','--release'],test:['node_modules/vitest/vitest.mjs','run'],typecheck:['node_modules/typescript/bin/tsc','--noEmit'],verify:['tools/verify-level.cjs'],solve:['tools/solve-level.cjs']};
if(!commands[task]){console.error('Unknown task: '+task);process.exit(1);}
const env={...process.env},pathKey=Object.keys(env).find(k=>k.toLowerCase()==='path')||'PATH';env[pathKey]=path.dirname(runtime)+path.delimiter+(env[pathKey]||'');
const child=spawn(runtime,[...commands[task],...process.argv.slice(3)],{cwd:root,env,stdio:'inherit',windowsHide:true});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.on('close',code=>{process.exitCode=code===null?1:code;});
