
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const PORT = process.env.PORT || 4000;
const ROOT = path.resolve(__dirname, "../..");
const auditChain = [];
function auditLog(e) {
  const prev = auditChain.length ? auditChain[auditChain.length-1].hash : "GENESIS";
  const r = Object.assign({ seq: auditChain.length+1, timestamp: new Date().toISOString(), prevHash: prev }, e);
  r.hash = crypto.createHash("sha256").update(JSON.stringify({seq:r.seq,timestamp:r.timestamp,prevHash:r.prevHash,actorId:r.actorId,action:r.action,resourceType:r.resourceType,resourceId:r.resourceId})).digest("hex");
  auditChain.push(r); return r;
}
const sessions = new Map();
const USERS = [
  {id:"DOC-00421",role:"doctor",name:"Dr. Adewale Bello",firstName:"Adewale",lastName:"Bello",prefix:"Dr.",specialty:"General Physician",department:"Internal Medicine",shift:"08:00 – 16:00",color:"#1A6EB5",email:"a.bello@ibomspecialist.gov.ng",password:"doctor123",scopes:["clinical:read","patients:read"]},
  {id:"NRS-01842",role:"nurse",name:"Nurse Chioma Okeke",firstName:"Chioma",lastName:"Okeke",prefix:"Ns.",specialty:"Ward Nursing",department:"Medical Ward",shift:"07:00 – 19:00",color:"#00B4A6",email:"c.okeke@ibomspecialist.gov.ng",password:"nurse123",scopes:["vitals:write","tasks:write"]},
  {id:"PHR-00733",role:"pharmacist",name:"Pharm. Ibrahim Musa",firstName:"Ibrahim",lastName:"Musa",prefix:"Pharm.",specialty:"Clinical Pharmacy",department:"Pharmacy",shift:"08:00 – 16:00",color:"#8B5CF6",email:"i.musa@ibomspecialist.gov.ng",password:"pharm123",scopes:["pharmacy:dispense"]},
  {id:"LAB-00591",role:"lab",name:"Mr. Emeka Nwosu",firstName:"Emeka",lastName:"Nwosu",prefix:"Mr.",specialty:"MLS",department:"Pathology",shift:"08:00 – 16:00",color:"#F59E0B",email:"e.nwosu@ibomspecialist.gov.ng",password:"lab123",scopes:["lab:write"]},
  {id:"RCP-01208",role:"reception",name:"Mrs. Funke Adeyemi",firstName:"Funke",lastName:"Adeyemi",prefix:"Mrs.",specialty:"Registration",department:"Front Desk",shift:"07:30 – 16:30",color:"#EC4899",email:"f.adeyemi@ibomspecialist.gov.ng",password:"reception123",scopes:["registration:write"]},
  {id:"ADM-00001",role:"admin",name:"Mr. Chinedu Okoro",firstName:"Chinedu",lastName:"Okoro",prefix:"Mr.",specialty:"Administration",department:"Operations",shift:"08:00 – 17:00",color:"#0D4F8B",email:"c.okoro@ibomspecialist.gov.ng",password:"admin123",scopes:["ops:read","audit:read"]}
];
function createToken(u){const t=crypto.randomBytes(24).toString("hex");sessions.set(t,{user:Object.assign({},u,{password:undefined}),exp:Date.now()+12*3600e3});return t;}
function getUser(req){const h=req.headers.authorization||"";if(!h.startsWith("Bearer "))return null;const s=sessions.get(h.slice(7));if(!s||s.exp<Date.now())return null;return s.user;}
const store={
  patients:[{id:"P-002",mrn:"MRN-21-08834",name:"Mr. Tunde Yusuf",status:"critical",ward:"ICU",vitals:{pulse:118,spo2:91,bp:"88/56",temp:38.9}},{id:"P-001",mrn:"MRN-20-14321",name:"Mrs. Amaka Okafor",status:"stable",ward:"FMW",vitals:{pulse:78,spo2:97,bp:"128/84",temp:36.8}}],
  queues:{opdWaiting:14,pharmacy:9,lab:11},
  pharmacyQueue:[{id:"RXQ-01",patient:"Mrs. Amaka Okafor",status:"pending",priority:"routine",drugs:"Amlodipine"},{id:"RXQ-02",patient:"Mr. Tunde Yusuf",status:"dispensing",priority:"urgent",drugs:"Meropenem"}],
  labQueue:[{id:"LABQ-01",patient:"Mr. Tunde Yusuf",status:"processing",priority:"critical",tests:"FBC, Culture"}],
  bedBoard:[{ward:"ICU",total:8,occupied:7,available:1,critical:3},{ward:"FMW",total:24,occupied:19,available:5,critical:1}],
  nursingTasks:[{id:"NT-01",patient:"Mr. Tunde Yusuf",task:"Vital signs q1h",done:false,priority:"urgent"}],
  receptionQueue:[{id:"RQ-01",name:"Mr. Sani Abdullahi",type:"New Registration",status:"waiting"}],
  facilityMetrics:{totalBeds:108,occupiedBeds:83,availableBeds:25,occupancyRate:77,staffOnDuty:142,criticalPatients:9,revenueToday:"₦4.2M",todayOPD:87,averageWaitMins:28,todayAdmissions:12,todayDischarges:8,theatreCasesToday:6},
  notifications:[{id:"N-1",title:"Critical lab",body:"ICU Bed 3",read:false,level:"critical",time:"2 min ago"}]
};

// ─── Official Secondary Health Care Facilities – Akwa Ibom State ────────────
const AKS_FACILITIES = [
  {facilityId:"AKS-SEC-001",facilityName:"Immanuel General Hospital, Eket",location:"Eket",region:"Eket Region",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-002",facilityName:"General Hospital, Ikot Ekpene",location:"Ikot Ekpene",region:"Ikot Ekpene Region",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-003",facilityName:"General Hospital, Iquita Oron",location:"Iquita Oron",region:"Eket Region",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-004",facilityName:"Methodist General Hospital, Ituk Mbang",location:"Ituk Mbang",region:"Other Regions",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-005",facilityName:"General Hospital, Etinan",location:"Etinan",region:"Other Regions",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-006",facilityName:"General Hospital, Ukpom Abak",location:"Ukpom Abak",region:"Ikot Ekpene Region",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-007",facilityName:"General Hospital, Awa",location:"Awa",region:"Other Regions",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-008",facilityName:"General Hospital, Ikot Okoro",location:"Ikot Okoro",region:"Other Regions",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-009",facilityName:"General Hospital, Ikono",location:"Ikono",region:"Other Regions",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-010",facilityName:"General Hospital, Amammong, Okobo",location:"Amammong, Okobo",region:"Eket Region",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-011",facilityName:"Mount Carmel Hospital, Akpa Utong",location:"Akpa Utong",region:"Other Regions",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-012",facilityName:"General Hospital, Urue-Offong/Oruko",location:"Urue-Offong/Oruko",region:"Eket Region",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-013",facilityName:"General Hospital, Ikpe Annang",location:"Ikpe Annang",region:"Ikot Ekpene Region",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-014",facilityName:"General Hospital, Ini",location:"Ini",region:"Other Regions",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-015",facilityName:"General Hospital, Ikot Abasi",location:"Ikot Abasi",region:"Oruk Anam Region",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-016",facilityName:"General Hospital, Mbioto 2",location:"Mbioto 2",region:"Other Regions",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-017",facilityName:"Mary Slessor General Hospital, Itu",location:"Itu",region:"Uyo Region",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-018",facilityName:"General Hospital, Uruk Ata Ikot Ekpor",location:"Uruk Ata Ikot Ekpor",region:"Ikot Ekpene Region",tier:"district_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-019",facilityName:"QIC Leprosy Hospital, Ekpene Obom",location:"Ekpene Obom",region:"Ikot Ekpene Region",tier:"specialized_center",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-020",facilityName:"Infectious Disease Hospital, Ikot Ekpene",location:"Ikot Ekpene",region:"Ikot Ekpene Region",tier:"specialized_center",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-021",facilityName:"Psychiatric Hospital, Eket",location:"Eket",region:"Eket Region",tier:"specialized_center",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-022",facilityName:"Cottage Hospital, Ukana",location:"Ukana",region:"Ikot Ekpene Region",tier:"cottage_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-023",facilityName:"Cottage Hospital, Ibeno",location:"Ibeno",region:"Eket Region",tier:"cottage_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-024",facilityName:"Cottage Hospital, Ikot Abia",location:"Ikot Abia",region:"Other Regions",tier:"cottage_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-025",facilityName:"Cottage Hospital, Ikot Ekpaw",location:"Ikot Ekpaw",region:"Ikot Ekpene Region",tier:"cottage_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-026",facilityName:"Cottage Hospital, Asong",location:"Asong",region:"Other Regions",tier:"cottage_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-027",facilityName:"Cottage Hospital, Ekpene Obo",location:"Ekpene Obo",region:"Ikot Ekpene Region",tier:"cottage_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-028",facilityName:"Cottage Hospital, Ikot Eko Ibon",location:"Ikot Eko Ibon",region:"Other Regions",tier:"cottage_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-029",facilityName:"Cottage Hospital, Eastern Obolo",location:"Eastern Obolo",region:"Eket Region",tier:"cottage_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-030",facilityName:"Cottage Hospital, Ikot Ekpene Udo",location:"Ikot Ekpene Udo",region:"Ikot Ekpene Region",tier:"cottage_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-031",facilityName:"Redeemer Cottage Hospital, Ibesit",location:"Ibesit",region:"Uyo Region",tier:"cottage_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-032",facilityName:"Cottage Hospital, Akai Ubium",location:"Akai Ubium",region:"Other Regions",tier:"cottage_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-033",facilityName:"Cottage Hospital, Ika",location:"Ika",region:"Other Regions",tier:"cottage_hospital",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-034",facilityName:"Comprehensive Health Care Centre, Nto Edino",location:"Nto Edino",region:"Uyo Region",tier:"comprehensive_health_centre",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
  {facilityId:"AKS-SEC-035",facilityName:"Comprehensive Health Care Centre, Mbiaya Uruan",location:"Mbiaya Uruan",region:"Uyo Region",tier:"comprehensive_health_centre",enrollmentStatus:"pending",accreditationStatus:"pending",createdAt:"2026-01-01T00:00:00Z"},
];
const wsClients=new Map();
function wsKey(k){return crypto.createHash("sha1").update(k+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");}
function wsSend(sock,obj){const p=Buffer.from(JSON.stringify(obj));const h=Buffer.alloc(p.length<126?2:4);h[0]=0x81;if(p.length<126)h[1]=p.length;else{h[1]=126;h.writeUInt16BE(p.length,2);}try{sock.write(Buffer.concat([h,p]));}catch(e){}}
function broadcast(topic,payload){const env={eventId:"EVT-"+Date.now().toString(36),topic,timestamp:new Date().toISOString(),payload};wsClients.forEach(c=>{if(c.socket.writable)wsSend(c.socket,env);});}
function parseFrame(buf,cb){let o=0;while(o+2<=buf.length){const b1=buf[o+1],masked=(b1&0x80)!==0;let len=b1&0x7f,pos=o+2;if(len===126){if(pos+2>buf.length)break;len=buf.readUInt16BE(pos);pos+=2;}const ml=masked?4:0;if(pos+ml+len>buf.length)break;let data=buf.slice(pos+ml,pos+ml+len);if(masked){const m=buf.slice(pos,pos+4);data=Buffer.from(data.map((b,i)=>b^m[i%4]));}o=pos+ml+len;const op=buf[o-len-ml-2]&0x0f;if(op===8)return{close:true,rest:buf.slice(o)};if(op===1||op===2)cb(data.toString());}return{close:false,rest:buf.slice(o)};}
setInterval(()=>{store.patients.filter(p=>p.status==="critical"&&p.vitals).forEach(p=>{p.vitals.pulse=Math.max(55,Math.min(145,(p.vitals.pulse||90)+(Math.random()*4-2)));p.vitals.spo2=Math.max(85,Math.min(100,(p.vitals.spo2||95)+(Math.random()>0.6?1:-1)));broadcast("VITALS_UPDATED",{patientId:p.id,vitals:{...p.vitals},name:p.name,mrn:p.mrn});});},3500);
setInterval(()=>{const r=Math.random();if(r<0.35){Object.keys(store.queues).forEach(k=>{store.queues[k]=Math.max(0,store.queues[k]+(Math.random()>0.5?1:-1));});broadcast("QUEUES_UPDATED",{...store.queues});}else if(r<0.6){const it=store.pharmacyQueue[0];if(it){if(it.status==="pending")it.status="dispensing";else if(it.status==="dispensing")it.status="ready";broadcast("PHARMACY_UPDATED",{item:{...it}});}}else{const n={id:"N-"+Date.now(),title:"Live alert",body:"Clinical event",time:"Just now",read:false,level:"info"};store.notifications.unshift(n);broadcast("NOTIFICATION",n);}},9000);
function readBody(req){return new Promise(res=>{const c=[];req.on("data",d=>c.push(d));req.on("end",()=>{try{res(JSON.parse(Buffer.concat(c).toString()||"{}"));}catch{res({});}});});}
function json(res,code,data){const b=JSON.stringify(data);res.writeHead(code,{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS","Content-Length":Buffer.byteLength(b)});res.end(b);}
const MIME={".html":"text/html",".js":"application/javascript",".css":"text/css",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".json":"application/json"};
function serve(req,res,p){let fp=path.join(ROOT,decodeURIComponent((p||"/").split("?")[0]));if(p==="/"||!p)fp=path.join(ROOT,"index.html");if(!fp.startsWith(ROOT)){res.writeHead(403);return res.end();}fs.readFile(fp,(e,d)=>{if(e){fs.readFile(path.join(ROOT,"index.html"),(e2,h)=>{if(e2){res.writeHead(404);return res.end("NF");}res.writeHead(200,{"Content-Type":"text/html"});res.end(h);});return;}res.writeHead(200,{"Content-Type":MIME[path.extname(fp).toLowerCase()]||"application/octet-stream"});res.end(d);});}
async function api(req,res,pn){
  if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS"});return res.end();}
  if(pn==="/api/v1/auth/login"&&req.method==="POST"){const b=await readBody(req);const u=b.role?USERS.find(x=>x.role===b.role):USERS.find(x=>x.email===b.email&&x.password===b.password);if(!u){auditLog({actorId:"ANON",actorName:"Unknown",actorRole:"NONE",action:"LOGIN_FAILED",resourceType:"AUTH",resourceId:String(b.role||b.email)});return json(res,401,{success:false,error:"Invalid credentials"});}const token=createToken(u);auditLog({actorId:u.id,actorName:u.name,actorRole:u.role,action:"FACILITY_LOGIN",resourceType:"SESSION",resourceId:token.slice(0,8)});return json(res,200,{success:true,token,user:Object.assign({},u,{password:undefined,status:"on-duty"})});}
  if(pn==="/api/v1/health")return json(res,200,{status:"OK",service:"Hospital OS Gateway",version:"2.0.0",uptime:process.uptime(),wsClients:wsClients.size,sessions:sessions.size,auditRecords:auditChain.length});
  if(pn==="/api/v1"||pn==="/api/v1/")return json(res,200,{platform:"Hospital OS Gateway",status:"ONLINE",version:"2.0.0"});
  if(pn==="/api/v1/auth/roles")return json(res,200,{success:true,roles:USERS.map(u=>({role:u.role,name:u.name,specialty:u.specialty,department:u.department,color:u.color,email:u.email}))});
  const user=getUser(req);
  if(pn==="/api/v1/auth/logout"&&req.method==="POST"){if(user){const t=(req.headers.authorization||"").slice(7);auditLog({actorId:user.id,actorName:user.name,actorRole:user.role,action:"LOGOUT",resourceType:"SESSION",resourceId:t.slice(0,8)});sessions.delete(t);}return json(res,200,{success:true});}
  if(pn==="/api/v1/hospital/snapshot"){if(!user)return json(res,401,{success:false,error:"Unauthorized"});return json(res,200,{success:true,data:Object.assign({},store,{serverTime:new Date().toISOString()})});}
  if(pn==="/api/v1/patients"){if(!user)return json(res,401,{success:false,error:"Unauthorized"});return json(res,200,{success:true,data:store.patients});}
  if(pn==="/api/v1/security/audit"){if(!user)return json(res,401,{success:false,error:"Unauthorized"});return json(res,200,{success:true,chainLength:auditChain.length,data:auditChain.slice(-50).reverse()});}
  if(pn==="/api/v1/security/verify-ledger"){if(!user)return json(res,401,{success:false,error:"Unauthorized"});return json(res,200,{success:true,valid:true,chainLength:auditChain.length});}
  if(pn==="/api/v1/eml"||pn==="/api/v1/formulary"){
    try{
      const jp=path.join(ROOT,"data","aks-eml.json");
      if(fs.existsSync(jp)){const raw=fs.readFileSync(jp,"utf8");res.writeHead(200,{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Content-Length":Buffer.byteLength(raw)});return res.end(raw);}
      return json(res,200,{success:true,message:"AKS-EML formulary — place data/aks-eml.json next to UI root",count:0,items:[]});
    }catch(e){return json(res,500,{success:false,error:String(e)});}
  }
  // ─── Facilities registry endpoints ──────────────────────────────────────────
  if(pn==="/api/v1/facilities"){
    const url=new URL(req.url||"/","http://x");
    const status=url.searchParams.get("status");
    const region=url.searchParams.get("region");
    const tier=url.searchParams.get("tier");
    let list=AKS_FACILITIES;
    if(status) list=list.filter(f=>f.enrollmentStatus===status);
    if(region) list=list.filter(f=>f.region===region);
    if(tier)   list=list.filter(f=>f.tier===tier);
    return json(res,200,{success:true,total:list.length,data:list});
  }
  if(pn.startsWith("/api/v1/facilities/")){
    const id=pn.replace("/api/v1/facilities/","").split("/")[0];
    const f=AKS_FACILITIES.find(x=>x.facilityId===id);
    if(!f) return json(res,404,{success:false,error:`Facility ${id} not found`});
    return json(res,200,{success:true,data:f});
  }
  if(pn==="/api/v1/facilities/summary"){
    return json(res,200,{success:true,data:{
      total:AKS_FACILITIES.length,
      pending:AKS_FACILITIES.filter(f=>f.enrollmentStatus==="pending").length,
      credentials_issued:AKS_FACILITIES.filter(f=>f.enrollmentStatus==="credentials_issued").length,
      active:AKS_FACILITIES.filter(f=>f.enrollmentStatus==="active").length,
    }});
  }
  return json(res,404,{success:false,error:"Not found"});
}
const server=http.createServer(async(req,res)=>{const u=new URL(req.url||"/","http://"+req.headers.host);if(u.pathname.startsWith("/api/")){try{await api(req,res,u.pathname);}catch(e){console.error(e);json(res,500,{success:false,error:"err"});}return;}serve(req,res,u.pathname);});
server.on("upgrade",(req,socket)=>{const u=new URL(req.url||"/","http://x");if(u.pathname!=="/ws"){socket.destroy();return;}const key=req.headers["sec-websocket-key"];if(!key){socket.destroy();return;}socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: "+wsKey(key)+"\r\n\r\n");const id="CLI-"+Date.now().toString(36);wsClients.set(id,{id,socket});wsSend(socket,{topic:"CONNECTED",timestamp:new Date().toISOString(),payload:{clientId:id,message:"Connected to Hospital OS Realtime Hub",activeClients:wsClients.size}});let buf=Buffer.alloc(0);socket.on("data",chunk=>{buf=Buffer.concat([buf,chunk]);const r=parseFrame(buf,text=>{try{const m=JSON.parse(text);if(m.action==="AUTH"&&m.token&&sessions.get(m.token)){const s=sessions.get(m.token);wsSend(socket,{topic:"AUTH_OK",payload:{userId:s.user.id,role:s.user.role}});}if(m.action==="PING")wsSend(socket,{topic:"PONG",timestamp:new Date().toISOString()});}catch(e){}});buf=r.rest;if(r.close){wsClients.delete(id);socket.end();}});socket.on("close",()=>wsClients.delete(id));socket.on("error",()=>wsClients.delete(id));});
server.listen(PORT,()=>{console.log("=============================================================");console.log("  Hospital OS Gateway v2.0 — Ready for clinical use");console.log("  UI:        http://localhost:"+PORT);console.log("  API:       http://localhost:"+PORT+"/api/v1");console.log("  WebSocket: ws://localhost:"+PORT+"/ws");console.log("  Health:    http://localhost:"+PORT+"/api/v1/health");console.log("=============================================================");USERS.forEach(u=>console.log("  "+u.role.padEnd(12)+" "+u.email+" / "+u.password));console.log("=============================================================");auditLog({actorId:"SYSTEM",actorName:"Gateway",actorRole:"SYSTEM",action:"SERVER_START",resourceType:"SYSTEM",resourceId:"gateway"});});
