const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const TYP={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/manifest+json','.png':'image/png'};
http.createServer((req,res)=>{
  let f=decodeURIComponent(req.url.split('?')[0]);
  if(f==='/')f='/index.html';
  const p=path.join(root,f);
  if(!fs.existsSync(p)){res.writeHead(404);return res.end('nope');}
  res.writeHead(200,{'Content-Type':TYP[path.extname(p)]||'application/octet-stream','Cache-Control':'no-cache'});
  res.end(fs.readFileSync(p));
}).listen(8901,()=>console.log('läuft auf 8901'));
