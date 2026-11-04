const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const root = path.resolve(__dirname, '../build/web-mobile');
const port = Number(process.env.PORT || 4173);
const types = { '.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.wav':'audio/wav','.wasm':'application/wasm','.woff':'font/woff','.ttf':'font/ttf' };
http.createServer((req,res)=>{
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch {res.writeHead(400);res.end('Bad URL');return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  fs.stat(file,(error,stat)=>{
    if(error||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(file).pipe(res);
  });
}).listen({port,host:'::',ipv6Only:false},()=>{
  console.log(`BlockDig ${require('../package.json').version} local preview`);
  console.log(`Local: http://localhost:${port}`);
  for(const nic of Object.values(os.networkInterfaces()).flat()) if(nic.family==='IPv4'&&!nic.internal) console.log(`Phone: http://${nic.address}:${port}`);
}).on('error',error=>{
  if(error.code==='EADDRINUSE')console.error(`端口${port}已被占用。若试玩服务已启动，请直接打开 http://localhost:${port}；也可设置PORT使用其他端口。`);
  else console.error(error.message);
  process.exitCode=1;
});
