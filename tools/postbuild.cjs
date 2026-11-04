const fs=require('fs'),path=require('path');
const file=path.resolve(__dirname,'../build/web-mobile/index.html');
let html=fs.readFileSync(file,'utf8');
html=html.replace(/<title>.*?<\/title>/s,'<title>方块深掘 · 第一矿井</title>');
html=html.replace(/(<meta\s+name="viewport"\s+content=")[^"]*("\s*\/?>)/,'$1width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover$2');
if(!html.includes('blockdig-browser-style')) html=html.replace('</head>','<style id="blockdig-browser-style">html,body{background:#0b1222;margin:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none}canvas{touch-action:none;-webkit-user-select:none;user-select:none}#GameDiv{touch-action:none}</style><meta name="theme-color" content="#0b1222"></head>');
if(!html.includes('rel="icon"'))html=html.replace('</head>','<link rel="icon" href="data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#0b1222"/><path d="M16 3L26 12 22 27 12 30 5 13Z" fill="#70d2c0"/><path d="M16 3L17 16 12 30 5 13Z" fill="#c4f3d5"/></svg>')+'"></head>');
if(!html.includes('blockdig-desktop-frame'))html=html.replace(/System\.import\('\.\/index\.js'\)\.catch\(function\(err\)\s*\{\s*console\.error\(err\);\s*\}\)/,`(function(){
  var framed=new URLSearchParams(location.search).has('play-frame');
  if(!framed&&window.innerWidth>window.innerHeight&&window.matchMedia('(pointer:fine)').matches){
    document.getElementById('GameDiv').remove();
    var frame=document.createElement('iframe'),url=new URL(location.href);url.searchParams.set('play-frame','1');
    frame.id='blockdig-desktop-frame';frame.title='方块深掘竖屏试玩';frame.src=url.href;
    frame.style.cssText='display:block;width:430px;max-width:100%;height:100%;border:0;margin:0 auto;background:#0b1222';
    document.body.appendChild(frame);
  }else{System.import('./index.js').catch(function(err){console.error(err);});}
})()`);
fs.writeFileSync(file,html);
const licenseSource=path.resolve(__dirname,'../licenses'),licenseOutput=path.resolve(__dirname,'../build/web-mobile/licenses');
if(fs.existsSync(licenseSource)){
  fs.mkdirSync(licenseOutput,{recursive:true});
  for(const name of fs.readdirSync(licenseSource)){
    const source=path.join(licenseSource,name);if(fs.statSync(source).isFile())fs.copyFileSync(source,path.join(licenseOutput,name));
  }
}
console.log('Web title, viewport, touch styles and retained license texts updated.');
