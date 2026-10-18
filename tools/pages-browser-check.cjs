// Production smoke at exactly the Pages subpath, using the real seeded v4 loop.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {smoke}=require('./v4-browser-check.cjs');
const prefix='/magnet-sort/',dist=path.resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.ttf':'font/ttf'};
(async()=>{
 let server;
 try{
  let base=process.env.GAME_BASE_URL;
  if(!base){
   server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(dist,pathname.slice(prefix.length)||'index.html');
    if(!pathname.startsWith(prefix)||!file.startsWith(dist+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
   });
   await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+prefix;
  }
  await smoke(base,'artifacts/pages-browser');
 }finally{if(server)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

