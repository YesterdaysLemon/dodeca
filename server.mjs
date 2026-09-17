import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { JevProvider } from './provider.mjs';

const port=Number(process.env.PORT ?? 8788);
const sessionId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const provider=new JevProvider({key:process.env.TYPESAFE_API_KEY,directory:new URL(`./results/live-${sessionId}/receipts/`,import.meta.url)});
delete process.env.TYPESAFE_API_KEY;
const files={
  '/':['./web/index.html','text/html'], '/app.mjs':['./web/app.mjs','text/javascript'],
  '/style.css':['./web/style.css','text/css'], '/core.mjs':['./core.mjs','text/javascript'],
  '/world.mjs':['./web/world.mjs','text/javascript'],
  '/vendor/three.module.js':['./node_modules/three/build/three.module.js','text/javascript'],
  '/vendor/three.core.js':['./node_modules/three/build/three.core.js','text/javascript'],
  '/vendor/OrbitControls.js':['./node_modules/three/examples/jsm/controls/OrbitControls.js','text/javascript']
};
const origins=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
const server=http.createServer(async(req,res)=>{
  const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});res.end(typeof data==='string'?data:JSON.stringify(data));};
  if (![ `127.0.0.1:${port}`,`localhost:${port}` ].includes(req.headers.host)) return send(403,{error:'Loopback host required.'});
  if (req.headers.origin && !origins.has(req.headers.origin)) return send(403,{error:'Local origin required.'});
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    if (req.method==='GET' && path==='/api/status') return send(200,{...provider.status(),sessionId});
    if (req.method==='GET' && path==='/api/pilot') {
      try { return send(200,await readFile(new URL('./results/latest-summary.json',import.meta.url),'utf8')); }
      catch { return send(200,{status:'not_run'}); }
    }
    if (req.method==='GET' && files[path]) {
      const [file,type]=files[path];let contents=await readFile(new URL(file,import.meta.url),'utf8');
      if(path==='/vendor/OrbitControls.js')contents=contents.replace("from 'three'","from './three.module.js'");
      return send(200,contents,type);
    }
    if (req.method==='GET' && path==='/favicon.ico') {res.writeHead(204);return res.end();}
    if (req.method==='POST' && path==='/api/decide') {
      if (!String(req.headers['content-type']).startsWith('application/json')) return send(415,{error:'JSON required.'});
      const parts=[];let size=0;
      for await (const part of req) {size+=part.length;if(size>12000) return send(413,{error:'State is too large.'});parts.push(part);}
      let payload;try{payload=JSON.parse(Buffer.concat(parts));}catch{return send(400,{error:'Invalid JSON.'});}
      if(provider.busy)return send(409,{error:'A decision is already in flight.'});
      try{return send(200,await provider.evaluate(payload.state,payload.weights,{singleOnly:payload.singleOnly===true}));}
      catch(err){return send(400,{error:err.message});}
    }
    return send(404,{error:'Not found.'});
  } catch { if(!res.headersSent)send(500,{error:'Local server error.'});else res.end(); }
});
server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({url:`http://127.0.0.1:${port}`,jevConnected:provider.status().available,sessionId})));
