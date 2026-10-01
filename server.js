const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive:true});
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({users:[], sessions:{}, orders:[]}, null, 2));

function loadDb(){ try { return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); } catch { return {users:[],sessions:{},orders:[]}; } }
function saveDb(db){ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }
function json(res, status, data){ res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
function parseBody(req){ return new Promise((resolve,reject)=>{ let b=''; req.on('data',c=>{ b+=c; if(b.length>8_000_000){ reject(new Error('Payload too large')); req.destroy(); }}); req.on('end',()=>{ try{ resolve(b?JSON.parse(b):{});}catch(e){reject(e);} }); req.on('error',reject); }); }
function hashPassword(password, salt=crypto.randomBytes(16).toString('hex')){ const hash=crypto.scryptSync(password,salt,64).toString('hex'); return `${salt}:${hash}`; }
function verifyPassword(password, stored){ const [salt,hash]=stored.split(':'); const h=crypto.scryptSync(password,salt,64).toString('hex'); return crypto.timingSafeEqual(Buffer.from(hash,'hex'), Buffer.from(h,'hex')); }
function token(){ return crypto.randomBytes(32).toString('hex'); }
function auth(req, db){ const h=req.headers.authorization||''; const t=h.startsWith('Bearer ')?h.slice(7):''; const uid=db.sessions[t]; return db.users.find(u=>u.id===uid)||null; }
function safeUser(u){ if(!u) return null; const {passwordHash,...rest}=u; return rest; }

const PRODUCTS = [
  {id:'handichlor-2kg',name:'PoolStar Handichlor 2kg',category:'Sanitiser',price:39.78,image:'https://cdn.sanity.io/images/ux0ugier/production/423ee3a29a9026d9d87a1075c97994869082c2b2-2048x2048.png?auto=format&fit=max&q=75&w=1000',desc:'Stabilised granular chlorine, 56% available chlorine.'},
  {id:'handitabs-2kg',name:'PoolStar Handitabs 10 Pack 2kg',category:'Sanitiser',price:57.98,image:'https://cdn.sanity.io/images/ux0ugier/production/abafe915264e28b3b17b1b98b3bfe71e81ef2382-2048x2048.png?auto=format&fit=max&q=75&w=1000',desc:'Slow-dissolving 200g tablets for pools over 20,000L.'},
  {id:'hichlor-4kg',name:'PoolStar Hichlor 4kg',category:'Sanitiser',price:39.18,image:'https://ccapi.mitre10.co.nz/medias/sys_master/productimages/h6b/h12/9060957978654/065365xlg/065365xlg.jpg',desc:'Unstabilised calcium hypochlorite granules for daily or shock dosing.'},
  {id:'ph-plus-1kg',name:'PoolStar pH Increaser 1kg',category:'Balancer',price:19.98,image:'https://cdn.sanity.io/images/ux0ugier/production/b99d289d7d51eb4f3a3276161454ec46dfb9308e-2048x2048.png?auto=format&fit=max&q=75&w=1000',desc:'Raises pH to help keep pool water balanced.'},
  {id:'ph-minus-1kg',name:'PoolStar pH Decreaser 1kg',category:'Balancer',price:19.98,image:'https://cdn.sanity.io/images/ux0ugier/production/fc0e82cf431b7962d6152a871f6ddd7db92d7786-2048x2048.png?auto=format&fit=max&q=75&w=1000',desc:'Lowers pH and total alkalinity.'},
  {id:'superblue-1l',name:'PoolStar Superblue Algaecide 1L',category:'Problem Solver',price:19.98,image:'https://cdn.sanity.io/images/ux0ugier/production/11de12694cf913e536cb95c806175377864c8f7b-2048x2048.png?auto=format&fit=max&q=75&w=1000',desc:'Ready-to-use algaecide for control and prevention.'},
  {id:'test-strips',name:'PoolStar Test Strips – 4 in 1 Chlorine',category:'Testing',price:19.90,image:'https://cdn.sanity.io/images/ux0ugier/production/b60eb9fc9e173eac9d934013342ddcbdb4e37cf2-3000x3000.png?auto=format&fit=max&q=75&w=1000',desc:'Tests free chlorine, pH, total alkalinity and cyanuric acid.'}
];

const PLANS = [
  {id:'basic',name:'Basic',price:39.90,tag:'Small / light-use pools',maxLitres:20000,includes:['Monthly smart care plan','1kg sanitiser allowance','Seasonal dosing reminders','Test-strip photo analysis']},
  {id:'standard',name:'Standard',price:59.90,tag:'Most family pools',maxLitres:40000,featured:true,includes:['Everything in Basic','2kg sanitiser allowance','Balancer top-up allowance','Usage-based replenishment']},
  {id:'ultra',name:'Ultra',price:89.90,tag:'Larger / busy pools',maxLitres:60000,includes:['Everything in Standard','Up to 4.5kg sanitiser allowance','Algae prevention support','Priority seasonal adjustments']},
  {id:'premium',name:'Premium',price:129.90,tag:'High-use / hands-off care',maxLitres:999999,includes:['Everything in Ultra','Expanded chemical allowance','Test-strip replenishment','Premium support & proactive reminders']}
];

function n(v,d=0){ const x=Number(v); return Number.isFinite(x)?x:d; }
function round(v,dp=0){ const p=10**dp; return Math.round(v*p)/p; }

function recommend(profile, readings){
  const litres = Math.max(1000,n(profile.litres,30000));
  const fc = n(readings.freeChlorine,0);
  const ph = n(readings.ph,7.4);
  const ta = n(readings.alkalinity,100);
  const cya = n(readings.stabiliser,40);
  const targetFc = profile.poolType==='spa'?4:3.5;
  const recs=[];

  if (ta < 80) {
    const grams = round(((80-ta)/10) * (litres/10000) * 180,0);
    recs.push({priority:1,kind:'balance',product:'PoolStar Alkalinity Increaser',action:`Raise total alkalinity first. Prototype dose estimate: about ${grams} g, split into stages and retest.`,why:`Your alkalinity is ${ta} ppm; PoolStar's healthy pool range is 80–120 ppm.`});
  } else if (ta > 120) {
    recs.push({priority:1,kind:'balance',product:'PoolStar pH Decreaser',action:'Total alkalinity is high. Lower gradually in stages, circulate and retest before further adjustment.',why:`Your alkalinity is ${ta} ppm; target 80–120 ppm.`});
  }

  if (ph < 7.2) {
    const grams = round((7.2-ph)*180*(litres/10000),0);
    recs.push({priority:2,kind:'balance',product:'PoolStar pH Increaser',action:`Raise pH gradually. Prototype estimate: about ${grams} g, then circulate and retest.`,why:`Your pH is ${ph}; target 7.2–7.8.`});
  } else if (ph > 7.8) {
    const grams = round((ph-7.8)*220*(litres/10000),0);
    recs.push({priority:2,kind:'balance',product:'PoolStar pH Decreaser',action:`Lower pH gradually. Prototype estimate: about ${grams} g, then circulate and retest.`,why:`Your pH is ${ph}; target 7.2–7.8.`});
  }

  if (fc < 2) {
    const delta = Math.max(0,targetFc-fc);
    const grams56 = round((delta * litres / 1000) / 0.56,0); // ppm=>g available chlorine; divide by 56%
    const usageFactor = 1 + Math.max(0,n(profile.swimmers,2)-2)*0.06 + (profile.frequency==='daily'?0.18:profile.frequency==='weekly'?0.08:0);
    recs.push({priority:3,kind:'sanitise',product:cya>50?'PoolStar Hichlor':'PoolStar Handichlor',action:`To move free chlorine toward ${targetFc} ppm, chemistry basis is approximately ${round(grams56*usageFactor,0)} g of 56% chlorine equivalent. Use the selected product label for the final dose.`,why:`Your free chlorine is ${fc} ppm; PoolStar recommends 2–5 ppm.`});
  } else if (fc > 5) {
    recs.push({priority:3,kind:'hold',product:'No chlorine now',action:'Do not add more chlorine. Allow the level to fall naturally and retest before swimming.',why:`Your free chlorine is ${fc} ppm; PoolStar recommends 2–5 ppm.`});
  }

  if (cya < 30 && profile.poolType!=='indoor') {
    recs.push({priority:4,kind:'stabilise',product:'PoolStar UV Stabiliser',action:'Stabiliser is low. Adjust in stages to protect chlorine from sunlight, following the product label.',why:`Your stabiliser is ${cya} ppm; PoolStar lists 30–50 ppm as the healthy range.`});
  } else if (cya > 50) {
    recs.push({priority:4,kind:'stabilise',product:'Use unstabilised chlorine / consider partial dilution',action:'Avoid adding more stabilised chlorine until cyanuric acid is back in range. Consider Hichlor or liquid chlorine and partial drain/refill if required.',why:`Your stabiliser is ${cya} ppm; target 30–50 ppm.`});
  }

  if (!recs.length) recs.push({priority:1,kind:'good',product:'Maintain current routine',action:'Your key readings are inside the target bands. Keep testing weekly and more often during peak use.',why:'Balanced water helps chlorine work efficiently.'});

  const weeklyChlorineLoss = litres/10000 * (profile.frequency==='daily'?170:profile.frequency==='weekly'?125:95) * (1+Math.max(0,n(profile.swimmers,2)-2)*0.05);
  const monthly = round(weeklyChlorineLoss*4.3,0);
  const plan = PLANS.find(p=>litres<=p.maxLitres) || PLANS[3];
  return {targets:{freeChlorine:'2–5 ppm',ph:'7.2–7.8',alkalinity:'80–120 ppm',stabiliser:'30–50 ppm'},recs:recs.sort((a,b)=>a.priority-b.priority),estimatedMonthlySanitiserGrams:monthly,recommendedPlan:plan};
}

function deterministicStripEstimate(imageData){
  const h=crypto.createHash('sha256').update(String(imageData).slice(0,250000)).digest();
  const pick=(i,arr)=>arr[h[i]%arr.length];
  return {
    freeChlorine: pick(0,[0,0.5,1,2,3,5,10]),
    ph: pick(1,[6.8,7.2,7.4,7.6,7.8,8.4]),
    alkalinity: pick(2,[40,80,120,180,240]),
    stabiliser: pick(3,[0,30,50,100,150]),
    confidence: 'prototype',
    note:'Prototype photo estimate. Confirm each result against the colour chart on the PoolStar strip container before dosing.'
  };
}

async function api(req,res,url){
  const db=loadDb();
  if(req.method==='GET' && url.pathname==='/api/config') return json(res,200,{products:PRODUCTS,plans:PLANS,brand:{name:'PoolStar',manufacturer:'Damar Industries Ltd'}});
  if(req.method==='POST' && url.pathname==='/api/signup'){
    const b=await parseBody(req); if(!b.email||!b.password||!b.name) return json(res,400,{error:'Name, email and password are required.'});
    if(db.users.some(u=>u.email.toLowerCase()===String(b.email).toLowerCase())) return json(res,409,{error:'An account already exists for that email.'});
    const user={id:crypto.randomUUID(),name:b.name,email:String(b.email).toLowerCase(),passwordHash:hashPassword(b.password),createdAt:new Date().toISOString(),pool:b.pool||{},subscription:{planId:b.planId||'standard',status:'active',nextShipment:nextMonth()},tests:[]};
    db.users.push(user); const t=token(); db.sessions[t]=user.id; saveDb(db); return json(res,201,{token:t,user:safeUser(user)});
  }
  if(req.method==='POST' && url.pathname==='/api/login'){
    const b=await parseBody(req); const u=db.users.find(x=>x.email.toLowerCase()===String(b.email||'').toLowerCase());
    if(!u||!verifyPassword(b.password||'',u.passwordHash)) return json(res,401,{error:'Incorrect email or password.'});
    const t=token(); db.sessions[t]=u.id; saveDb(db); return json(res,200,{token:t,user:safeUser(u)});
  }
  if(req.method==='GET' && url.pathname==='/api/me'){
    const u=auth(req,db); if(!u) return json(res,401,{error:'Not signed in'}); return json(res,200,{user:safeUser(u)});
  }
  if(req.method==='POST' && url.pathname==='/api/pool'){
    const u=auth(req,db); if(!u) return json(res,401,{error:'Not signed in'}); const b=await parseBody(req); u.pool={...u.pool,...b}; saveDb(db); return json(res,200,{user:safeUser(u)});
  }
  if(req.method==='POST' && url.pathname==='/api/recommend'){
    const b=await parseBody(req); return json(res,200,recommend(b.profile||{},b.readings||{}));
  }
  if(req.method==='POST' && url.pathname==='/api/test-strip'){
    const b=await parseBody(req); if(!b.imageData) return json(res,400,{error:'Please upload a test-strip image.'});
    const readings=deterministicStripEstimate(b.imageData); const result=recommend(b.profile||{},readings);
    const u=auth(req,db); if(u){ u.tests.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),readings,result}); u.tests=u.tests.slice(0,20); saveDb(db); }
    return json(res,200,{readings,...result});
  }
  if(req.method==='POST' && url.pathname==='/api/subscribe'){
    const u=auth(req,db); if(!u) return json(res,401,{error:'Sign in to choose a plan.'}); const b=await parseBody(req); const p=PLANS.find(x=>x.id===b.planId); if(!p) return json(res,400,{error:'Invalid plan'}); u.subscription={planId:p.id,status:'active',nextShipment:nextMonth()}; saveDb(db); return json(res,200,{subscription:u.subscription,plan:p});
  }
  if(req.method==='POST' && url.pathname==='/api/order'){
    const u=auth(req,db); if(!u) return json(res,401,{error:'Sign in to order.'}); const b=await parseBody(req); const p=PRODUCTS.find(x=>x.id===b.productId); if(!p) return json(res,404,{error:'Product not found'});
    const order={id:'PS-'+Math.floor(100000+Math.random()*900000),userId:u.id,productId:p.id,qty:Math.max(1,Math.min(20,n(b.qty,1))),status:'demo-order',createdAt:new Date().toISOString()}; db.orders.unshift(order); saveDb(db); return json(res,201,{order,message:'Demo order created. Connect Stripe + your fulfilment platform for live checkout.'});
  }
  return json(res,404,{error:'Not found'});
}
function nextMonth(){ const d=new Date(); d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,10); }
function serveStatic(req,res,url){
  let p=url.pathname==='/'?'/index.html':url.pathname; p=path.normalize(p).replace(/^([.][.][/\\])+/, ''); const file=path.join(PUBLIC,p);
  if(!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); return res.end('Not found'); }
  const ext=path.extname(file).toLowerCase(); const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'}[ext]||'application/octet-stream'; res.writeHead(200,{'Content-Type':type}); fs.createReadStream(file).pipe(res);
}
const server=http.createServer(async(req,res)=>{ try{ const url=new URL(req.url,'http://localhost'); if(url.pathname.startsWith('/api/')) await api(req,res,url); else serveStatic(req,res,url);}catch(e){ console.error(e); json(res,500,{error:'Server error',detail:process.env.NODE_ENV==='production'?undefined:e.message}); }});
server.listen(PORT,()=>console.log(`PoolStar Smart Care running on http://localhost:${PORT}`));
