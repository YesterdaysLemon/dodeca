import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { JevProvider } from './provider.mjs';

const port=Number(process.env.PORT ?? 8788);
const sessionId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const dataRoot=process.env.DATA_DIR?pathToFileURL(process.env.DATA_DIR.replace(/\/$/,'')+'/'):new URL('./runtime-data/',import.meta.url);
const provider=new JevProvider({key:process.env.TYPESAFE_API_KEY,directory:new URL(`live-${sessionId}/receipts/`,dataRoot),budgetPath:new URL('budget.json',dataRoot)});
delete process.env.TYPESAFE_API_KEY;
let revision='local';try{revision=(await readFile(new URL('./build-sha',import.meta.url),'utf8')).trim();}catch{}
const files={
  '/':['./web/index.html','text/html'], '/app.mjs':['./web/app.mjs','text/javascript'],
  '/style.css':['./web/style.css','text/css'], '/core.mjs':['./core.mjs','text/javascript'],
  '/world.mjs':['./web/world.mjs','text/javascript'],
  '/vendor/three.module.js':['./node_modules/three/build/three.module.js','text/javascript'],
  '/vendor/three.core.js':['./node_modules/three/build/three.core.js','text/javascript'],
  '/vendor/OrbitControls.js':['./node_modules/three/examples/jsm/controls/OrbitControls.js','text/javascript'],
  '/vendor/BufferGeometryUtils.js':['./node_modules/three/examples/jsm/utils/BufferGeometryUtils.js','text/javascript']
};
const origins=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
if(process.env.PUBLIC_ORIGIN)origins.add(new URL(process.env.PUBLIC_ORIGIN).origin);
const hosts=new Set([...origins].map(o=>new URL(o).host));
const rates=new Map();
const server=http.createServer(async(req,res)=>{
  const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:Buffer.isBuffer(data)||typeof data==='string'?data:JSON.stringify(data));};
  // Deploy Manager probes the host-mapped candidate port before Caddy routes traffic.
  const mappedHealth=['GET','HEAD'].includes(req.method)&&req.url==='/healthz'&&/^127\.0\.0\.1:\d{1,5}$/.test(req.headers.host??'');
  if (!hosts.has(req.headers.host)&&!mappedHealth) return send(403,{error:'Unrecognized host.'});
  if (req.headers.origin && !origins.has(req.headers.origin)) return send(403,{error:'Local origin required.'});
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    if(['GET','HEAD'].includes(req.method)&&path==='/healthz')return send(200,{ok:true,app:'dodeca',revision,jevConnected:provider.status().available});
    if (req.method==='GET' && path==='/api/status') return send(200,{...provider.status(),sessionId});
    if (req.method==='GET' && path==='/api/pilot') {
      try { return send(200,await readFile(new URL('./results/latest-summary.json',import.meta.url),'utf8')); }
      catch { return send(200,{status:'not_run'}); }
    }
    if (['GET','HEAD'].includes(req.method) && files[path]) {
      const [file,type]=files[path];let contents=await readFile(new URL(file,import.meta.url),'utf8');
      if(path.startsWith('/vendor/'))contents=contents.replace("from 'three'","from './three.module.js'");
      return send(200,contents,type);
    }
    if (req.method==='GET' && path==='/favicon.ico') {res.writeHead(204);return res.end();}
    if(['GET','HEAD'].includes(req.method)&&['/icon.svg','/robots.txt','/sitemap.xml','/llms.txt','/social.png'].includes(path)){
      const types={svg:'image/svg+xml',txt:'text/plain; charset=utf-8',xml:'application/xml',png:'image/png'};
      return send(200,await readFile(new URL('./web'+path,import.meta.url)),types[path.split('.').pop()]);
    }
    if (req.method==='POST' && path==='/api/decide') {
      if(!req.headers.origin||!origins.has(req.headers.origin))return send(403,{error:'A same-site request is required.'});
      if (!String(req.headers['content-type']).startsWith('application/json')) return send(415,{error:'JSON required.'});
      const client=String(req.headers['x-forwarded-for']??req.socket.remoteAddress).split(',').pop().trim(),now=Date.now();
      for(const [k,v] of rates)if(now-v.since>60000)rates.delete(k);
      const rate=rates.get(client)??{since:now,count:0};if(rate.count>=40||rates.size>2000)return send(429,{error:'Give the inhabitants a moment. The live request limit resets after a minute.'});rate.count++;rates.set(client,rate);
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
server.requestTimeout=25000;server.headersTimeout=10000;
server.listen(port,process.env.HOST??'127.0.0.1',()=>console.log(JSON.stringify({url:`http://127.0.0.1:${port}`,jevConnected:provider.status().available,sessionId})));
