const http=require('http'),fs=require('fs'),path=require('path');
const ROOT="C:/LumosCore";
const MIME={'.html':'text/html; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.css':'text/css','.js':'text/javascript','.json':'application/json','.mp4':'video/mp4','.webm':'video/webm'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/')p='/index.html';
  const fp=path.join(ROOT,p);
  fs.readFile(fp,(e,d)=>{
    if(e){res.writeHead(404);res.end('not found');return;}
    const ext=path.extname(fp).toLowerCase();
    res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'});
    res.end(d);
  });
}).listen(8799,()=>console.log('serving C:/LumosCore on http://localhost:8799'));
