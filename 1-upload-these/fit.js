// Minimal FIT decoder: record (20) and session (18) messages only.
// Returns {records:[{t,hr,pw,spd,dist,cad}], session:{sport, start, elapsed}}
function parseFIT(buf){
  const dv=new DataView(buf); const hs=dv.getUint8(0); const dataSize=dv.getUint32(4,true);
  const sig=String.fromCharCode(dv.getUint8(8),dv.getUint8(9),dv.getUint8(10),dv.getUint8(11));
  if(sig!=='.FIT') throw new Error('Not a FIT file');
  const end=Math.min(hs+dataSize, buf.byteLength); let p=hs; const defs={}; const records=[]; let session=null; let lastTs=0;
  const SZ={0:1,1:1,2:1,7:1,10:1,13:1,131:2,132:2,139:2,133:4,134:4,140:4,136:4,137:8,142:8,143:8,144:8};
  function rd(base,size,le){
    const t=base&0x1F;
    if(size===1){const v=dv.getUint8(p); p+=1; if(t===1){return v===0x7F?null:(v>127?v-256:v);} return v===0xFF?null:v;}
    if(size===2){const v=(t===3)?dv.getInt16(p,le):dv.getUint16(p,le); p+=2; return (t===3? v===0x7FFF : v===0xFFFF)?null:v;}
    if(size===4){const v=(t===5)?dv.getInt32(p,le):dv.getUint32(p,le); p+=4; return (t===5? v===0x7FFFFFFF : v===0xFFFFFFFF)?null:v;}
    p+=size; return null;
  }
  while(p<end){
    const h=dv.getUint8(p); p+=1;
    if(h&0x80){ // compressed timestamp header
      const local=(h>>5)&0x3, off=h&0x1F; const def=defs[local]; if(!def) throw new Error('bad local');
      let ts=(lastTs&0xFFFFFFE0)+off; if(off<(lastTs&0x1F)) ts+=0x20; lastTs=ts;
      const m=readData(def); m[253]=ts; handle(def.g,m); continue;
    }
    const local=h&0x0F;
    if(h&0x40){ // definition
      p+=1; const arch=dv.getUint8(p); p+=1; const le=arch===0; const g=le?dv.getUint16(p,true):dv.getUint16(p,false); p+=2;
      const n=dv.getUint8(p); p+=1; const fields=[];
      for(let i=0;i<n;i++){fields.push({num:dv.getUint8(p),size:dv.getUint8(p+1),base:dv.getUint8(p+2)}); p+=3;}
      let dev=0; if(h&0x20){const nd=dv.getUint8(p); p+=1; for(let i=0;i<nd;i++){dev+=dv.getUint8(p+1); p+=3;}}
      defs[local]={g,le,fields,dev};
    } else {
      const def=defs[local]; if(!def) throw new Error('data before definition');
      const m=readData(def); if(m[253]!=null) lastTs=m[253]; handle(def.g,m);
    }
  }
  function readData(def){
    const m={};
    for(const f of def.fields){
      const bs=SZ[f.base]||1;
      if(f.size===bs) m[f.num]=rd(f.base,f.size,def.le); else {p+=f.size; m[f.num]=null;}
    }
    p+=def.dev; return m;
  }
  function handle(g,m){
    if(g===20){
      const spd=m[73]!=null?m[73]/1000:(m[6]!=null?m[6]/1000:null);
      records.push({t:m[253],hr:m[3]||null,pw:m[7],spd,dist:m[5]!=null?m[5]/100:null,cad:m[4]});
    } else if(g===18 && !session){
      session={sport:m[5],start:m[2],elapsed:m[7]!=null?m[7]/1000:null};
    }
  }
  return {records,session};
}
// FIT epoch offset (1989-12-31) to unix seconds
const FIT_EPOCH=631065600;
function summarizeFIT(parsed,ftp){
  let r=parsed.records.filter(x=>x.t!=null); if(!r.length) return null;
  {const ts=r.map(x=>x.t).sort((a,b)=>a-b);const med=ts[Math.floor(ts.length/2)];r=r.filter(x=>Math.abs(x.t-med)<43200).sort((a,b)=>a.t-b.t);}
  const t0=r[0].t, t1=r[r.length-1].t, n=t1-t0+1;
  const pw=new Array(n).fill(null), hr=new Array(n).fill(null);
  for(const x of r){const i=x.t-t0; if(x.pw!=null) pw[i]=x.pw; if(x.hr) hr[i]=x.hr;}
  // forward-fill gaps up to 5 s
  for(const a of [pw,hr]){let last=null,gap=0;for(let i=0;i<n;i++){if(a[i]!=null){last=a[i];gap=0}else if(last!=null&&gap<5){a[i]=last;gap++}}}
  const P=pw.map(v=>v==null?0:v); const hasP=pw.some(v=>v>0); const hasHR=hr.some(v=>v>0);
  const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
  const roll=(a,w)=>{const o=[];let s=0;for(let i=0;i<a.length;i++){s+=a[i];if(i>=w)s-=a[i-w];if(i>=w-1)o.push(s/w)}return o};
  let NP=null,b20=null,b5=null,b60=null,avgP=null;
  if(hasP){const r30=roll(P,30);NP=r30.length?Math.pow(mean(r30.map(v=>v**4)),0.25):null;avgP=mean(P);
    const best=w=>{const q=roll(P,w);return q.length?q.reduce((a,b)=>a>b?a:b,-1):null};b5=best(300);b20=best(1200);b60=best(3600);}
  const H=hr.filter(v=>v>0); const avgHR=hasHR?mean(H):null; const maxHR=hasHR?H.reduce((a,b)=>a>b?a:b,0):null;
  let hr20=null; if(hasP&&hasHR&&b20){const q=roll(P,1200);const i=q.indexOf(b20);const seg=hr.slice(i,i+1200).filter(v=>v>0);hr20=mean(seg);}
  let decouple=null,EF=null;
  if(hasP&&hasHR&&n>=2400){
    const idx=[];for(let i=600;i<n;i++){if(P[i]>40&&hr[i]>0)idx.push(i)}
    const half=Math.floor(idx.length/2);const A=idx.slice(0,half),B=idx.slice(half);
    const ef=s=>mean(s.map(i=>P[i]))/mean(s.map(i=>hr[i]));
    if(A.length&&B.length){const e1=ef(A),e2=ef(B);decouple=(e1-e2)/e1*100;}
    EF=NP&&avgHR?NP/avgHR:null;
  }
  const IF=NP&&ftp?NP/ftp:null; const TSS=IF?(n*NP*IF)/(ftp*3600)*100:null;
  return {start:new Date((t0+FIT_EPOCH)*1000).toISOString(),durMin:n/60,avgP,NP,b5,b20,b60,hr20,avgHR,maxHR,EF,decouple,IF,TSS,sport:parsed.session?parsed.session.sport:null};
}
if(typeof module!=='undefined') module.exports={parseFIT,summarizeFIT};
