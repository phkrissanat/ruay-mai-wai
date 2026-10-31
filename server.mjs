import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
const dir=path.resolve('dist');
http.createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname,resolved=path.resolve(dir,'.'+decodeURIComponent(pathname));
 if(resolved!==dir&&!resolved.startsWith(dir+path.sep)){res.writeHead(403).end();return}
 const file=resolved===dir?path.join(dir,'index.html'):resolved;const body=await fs.readFile(file);
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(body);
}catch{res.writeHead(404).end('Not found')}}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'));
