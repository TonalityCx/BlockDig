const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const source=fs.readFileSync(path.resolve(__dirname,'../assets/scripts/core/GameModel.ts'),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const exported={};vm.runInNewContext(output,{exports:exported,require,console});module.exports=exported;
