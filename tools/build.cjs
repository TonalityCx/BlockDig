const {spawn}=require('child_process'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),editor=process.env.COCOS_CREATOR||'E:/Cocos/Creator/3.8.8/CocosCreator.exe';
const log=fs.createWriteStream(path.join(root,'build-latest.log'));
const release=process.argv.includes('--release');
const config={platform:'web-mobile',debug:!release,startScene:'63899b9c-7fba-4e94-a80e-173774556d31',name:'BlockDig',outputName:'web-mobile',orientation:'portrait',sourceMaps:!release,useSplashScreen:false,engineModulesConfigKey:'defaultConfig'};
const configFile=path.join(root,'build-config.json');fs.writeFileSync(configFile,JSON.stringify(config,null,2));
const child=spawn(editor,['--project',root,'--build','configPath='+configFile],{cwd:root,windowsHide:true});
for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log.write(chunk);if(process.env.VERBOSE_BUILD)process.stdout.write(chunk);});
console.log('Cocos Web Mobile build started. See build-latest.log for details.');
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('close',code=>{
  log.end();if(code!==36){console.error('Build failed: exit '+code);process.exitCode=1;return;}
  require('./postbuild.cjs');console.log('Build complete: build/web-mobile');
});
