// 70.3 Ready v2 — plan to IRONMAN 70.3 North Carolina, Oct 16 2027.
// Built from the Oct 21 2026 analysis ("Road to 5:30"). Targets scale with the FTP,
// threshold pace and CSS stored in Settings, so a new test result rewrites every target.
(function(){
const BLOCKS=[
 {id:'recover',name:'Recover',start:'2026-10-18',end:'2026-11-01',focus:'Two easy weeks after the race. Nothing hard.'},
 {id:'b1',name:'B1 Test + base',start:'2026-11-02',end:'2026-11-29',focus:'Three field tests set every target (no pool until late May, so no swim test). Saturdays introduce sweet spot.'},
 {id:'b2',name:'B2 Aero + threshold',start:'2026-11-30',end:'2027-01-03',focus:'Clip-ons and a fit in early December, then every bike session in position. Threshold builds to 2 × 20.'},
 {id:'b3',name:'B3 Run speed',start:'2027-01-04',end:'2027-02-28',focus:'The run is the biggest gap. Wednesdays carry 5K-pace and threshold work; bike holds threshold.'},
 {id:'g1',name:'Gate 1 block',start:'2027-03-01',end:'2027-03-28',focus:'Retest week Mar 15–21 (FTP, 5K, durability). Gate 1: FTP ≥ 212 W and 5K ≤ 22:30 keep 5:30 live.'},
 {id:'b4',name:'B4 Race-specific',start:'2027-03-29',end:'2027-05-23',focus:'Race-power blocks with a run off the bike every Saturday. White Lake International on Sunday May 2.'},
 {id:'hold',name:'Hold + Gate 2',start:'2027-05-24',end:'2027-07-04',focus:'Hold the load through graduation. The pool reopens Memorial Day weekend: CSS test May 31, then a weekly swim. Gate 2 tests Jun 22 and Jun 26.'},
 {id:'trip',name:'Southeast Asia trip',start:'2027-07-05',end:'2027-07-25',focus:'No bike. Run three times a week, swim when you can, bodyweight strength.'},
 {id:'b5',name:'B5 Big build',start:'2027-07-26',end:'2027-09-19',focus:'The only high-volume window: 8–10 h a week, long rides to 3:30, three race simulations.'},
 {id:'peak',name:'Peak',start:'2027-09-20',end:'2027-10-03',focus:'Race-specific sharpness at slightly lower volume.'},
 {id:'taper',name:'Taper + race',start:'2027-10-04',end:'2027-10-16',focus:'Volume down 40–50%, intensity held. Race Saturday Oct 16.'}
];
const GATES=[
 {date:'2026-11-07',label:'FTP test',crit:'FTP ≥ 195 W keeps 5:30 live; ≤ 175 W moves the target to sub-5:45'},
 {date:'2027-03-21',label:'Gate 1',crit:'FTP ≥ 212 W · 5K ≤ 22:30 (two misses → target sub-5:45)'},
 {date:'2027-05-02',label:'White Lake International',crit:'Splits vs the predictions on record'},
 {date:'2027-06-26',label:'Gate 2',crit:'FTP ≥ 222 W · 10K ≤ 46:30 (FTP < 210 → pacing for sub-5:45)'},
 {date:'2027-09-04',label:'Gate 3',crit:'Race sim: 3:00 at 175–180 W, then 40 min at ≤ 8:45/mi with no cramp'},
 {date:'2027-10-16',label:'Race',crit:'The 5:30 recipe: 34:30 · 8:30 · 3:03 · 1:44'}
];
const D=s=>new Date(s+'T12:00:00');
const iso=d=>{const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,10)};
const addDays=(s,n)=>{const d=D(s);d.setDate(d.getDate()+n);return iso(d)};
const daysBetween=(a,b)=>Math.round((D(b)-D(a))/864e5);

function T(st){ // target text helpers from settings
  const ftp=st.ftp, r=x=>Math.round(x);
  const mmss=s=>{s=Math.round(s);const m=Math.floor(s/60),x=s%60;return m+':'+(x<10?'0':'')+x};
  return {
    W:(lo,hi)=>`${r(ftp*lo)}–${r(ftp*hi)} W`,
    RP:()=>`${r(ftp*0.78)}–${r(ftp*0.82)} W (race power)`,
    Z2:()=>`${r(ftp*0.56)}–${r(ftp*0.72)} W`,
    pace:off=>mmss(st.thrPace+off)+'/mi',
    thr:()=>mmss(st.thrPace)+'/mi',
    k5:()=>mmss(st.thrPace-22)+'/mi',
    hm:()=>mmss(st.thrPace+12)+'/mi',
    rp:()=>mmss(st.thrPace+20)+'/mi',
    easy:()=>`${mmss(st.thrPace+90)}–${mmss(st.thrPace+150)}/mi`,
    css:(off=0)=>mmss(st.css+off)+'/100 m',
    mmss
  };
}
// session factories
const S=(type,title,min,detail,o={})=>Object.assign({type,title,min,detail},o);
function bikeTh(t,n,reps,lo,hi,min=45,rest){return S('bike',`Bike ${min}: ${reps}`,min,`Warm up 10 min. ${reps} at ${t.W(lo,hi)}${rest?', '+rest+' easy between':''}. Cool down.`,{key:true,intensity:true})}
function sat90(t,blocks,runOff,min=90){return S('bike',`Bike ${min}: ${blocks} race power`,min,`Steady Zone 2 (${t.Z2()}) with ${blocks} at ${t.RP()}. In the aero position from December.${runOff?` Then run ${runOff} min at ${t.rp()}.`:''}`,{key:true,intensity:true,brick:!!runOff})}
const STR_A=S('strength','Strength A',40,'Trap-bar deadlift 4×5 @ 80–85% 1RM · RFE split squat 3×6–8/leg · eccentric step-down 3×10/leg (3 s down) · seated calf raise 3×12–15 · Copenhagen plank 3×20–30 s');
const STR_B=S('strength','Strength B',20,'Hip thrust 3×8–12 · single-leg RDL 3×8/leg · lateral band walk 3×15 · Pallof press 3×10 · side plank 3×30–45 s · swim dryland: band pull-aparts 2×15, straight-arm band pulldowns 2×12');
const REST=S('rest','Rest',0,'Off, or 10 min mobility.');
function easyRun(t,min,strides){return S('run',`Run ${min} easy`,min,`Easy ${t.easy()}${strides?' + 4–6 × 20 s strides':''}.`)}
function longRun(t,min,rpMin){return S('run',`Long run ${min}`,min,`Easy ${t.easy()}${rpMin?`; last ${rpMin} min at ${t.rp()}`:''}.`,{key:true})}
function runQ(t,kind,min=40){
  const m={
    thr6:`3 × 6 min at ${t.pace(15)}, 2 min jog`,thr8:`3 × 8 min at ${t.thr()}, 2 min jog`,thr10:`3 × 10 min at ${t.thr()}, 2 min jog`,
    thr46:`4 × 6 min at ${t.pace(-5)}, 2 min jog`,thr48:`4 × 8 min at ${t.thr()}, 2 min jog`,thr215:`2 × 15 min at ${t.pace(10)}, 3 min jog`,
    vo5:`5 × 3 min at ${t.k5()}, 2 min jog`,vo6:`6 × 3 min at ${t.k5()}, 2 min jog`,hm215:`2 × 15 min at ${t.hm()}, 3 min jog`,
    thr55:`5 × 5 min at ${t.pace(-10)}, 2 min jog`,thr312:`3 × 12 min at ${t.pace(10)}, 2 min jog`,hm220:`2 × 20 min at ${t.hm()}, 3 min jog`,
    thr64:`6 × 4 min at ${t.pace(-15)}, 90 s jog`,thr315:`3 × 15 min at ${t.thr()}, 3 min jog`,thr45:`4 × 5 min at ${t.thr()}, 2 min jog`
  };
  return S('run',`Run ${min}: quality`,min,`Warm up 10 min. ${m[kind]}. Cool down.`,{key:true,intensity:true});
}
function swimCSS(t,min=40){return S('swim',`Swim ${min}: CSS`,min,`400 easy · 8 × 100 at ${t.css(0)} (15 s rest) · 4 × 50 fast · 200 easy`)}

const TESTS={
 '2026-11-07':st=>[S('bike','TEST: 20-min FTP',65,'20 min easy with 3 × 1 min at ~220 W. 5 min hard. 10 min easy. 20 min maximal: start at 195 W, hold 5 min, then raise it if you can. Resistance mode, not ERG. Edge recording, Whoop HR on. Upload the FIT under Tests.',{key:true,test:'ftp-nov'})],
 '2026-11-14':st=>[S('run','TEST: 5K time trial',40,'Flat course (American Tobacco Trail or a track). 15 min easy, 4 × 20 s strides, 5 km even effort. Record HR. Enter the time under Tests.',{key:true,test:'5k-nov'})],
 '2026-11-15':st=>{const t=T(st);return[S('brick','Bike 90: 2 × 15 sweet spot + run 20',110,`Zone 2 with 2 × 15 min at ${t.W(0.88,0.94)}, then run 20 min easy (${t.easy()}).`,{key:true,intensity:true})]},
 '2026-11-28':st=>{const t=T(st);return[S('bike','TEST: Durability',115,`90 min at ${t.W(0.65,0.70)}, then 20 min maximal. Upload the FIT under Tests.`,{key:true,test:'dur-nov'})]},
 '2027-02-06':st=>[S('bike','TEST: 20-min FTP',65,'Same protocol as Nov 7. Upload the FIT under Tests.',{key:true,test:'ftp-feb'})],
 '2027-03-13':st=>{const t=T(st);return[S('bike','TEST: Durability',115,`90 min at ${t.W(0.65,0.70)}, then 20 min maximal.`,{key:true,test:'dur-mar'})]},
 '2027-03-20':st=>[S('bike','TEST: 20-min FTP (Gate 1)',65,'Same protocol as Nov 7.',{key:true,test:'ftp-g1'})],
 '2027-03-21':st=>[S('run','TEST: 5K time trial (Gate 1)',40,'Same protocol as Nov 14.',{key:true,test:'5k-g1'})],
 '2027-04-27':st=>{const t=T(st);return[S('bike','Bike 45: race-week openers',45,`Zone 2 with 3 × 3 min at ${t.RP()}. Race Sunday.`)]},
 '2027-04-28':st=>{const t=T(st);return[S('run','Run 35: openers',35,`Easy ${t.easy()} with 4 × 1 min at ${t.rp()}.`)]},
 '2027-04-29':st=>[S('strength','Light strength',25,'Half of Strength A at light weights. No heavy deadlifts in race week.')],
 '2027-05-01':st=>{const t=T(st);return[S('brick','Pre-race: bike 25 + run 10',35,`Easy spin with 3 × 1 min at ${t.RP()}, then a 10 min jog. Pack the night before. Packet pickup Sat 5–7 pm or race morning 6–7 am (Grand Regal @ Goldston's Beach, photo ID).`)]},
 '2027-05-02':st=>[S('brick','RACE: White Lake Spring International',150,'1500 m swim · 28 mi (45 km) bike at 0.88 × FTP · 10 km run. Starts 7:30 am, White Lake NC (about 2 h from Durham). No pool swims since October: wear the wetsuit, start wide and swim the first 400 m relaxed. Enter splits under Tests.',{key:true,test:'oly'})],
 '2027-05-03':st=>[S('rest','Rest',0,'Recovery day after the race.')],
 '2027-05-31':st=>[S('swim','TEST: Swim CSS (pool reopens)',45,'First swim since October. 400 easy, 4 × 50 build. 400 m all-out from a push. 10 min easy. 200 m all-out. CSS /100 m = (T400 − T200) ÷ 2. Enter it under Tests and in Setup.',{test:'css-may'})],
 '2027-06-22':st=>[S('bike','TEST: 20-min FTP (Gate 2)',65,'Same protocol as Nov 7.',{key:true,test:'ftp-g2'})],
 '2027-06-26':st=>[S('run','TEST: 10K time trial (Gate 2)',65,'15 min easy, strides, 10 km even effort.',{key:true,test:'10k-g2'})],
 '2027-08-14':st=>{const t=T(st);return[S('brick','RACE SIM 1',205,`2:45 at ${t.RP()} with race fueling, then 40 min at ${t.rp()}. Practice the full race fueling and fluid plan.`,{key:true,intensity:true})]},
 '2027-09-04':st=>{const t=T(st);return[S('brick','RACE SIM 2 (Gate 3)',220,`3:00 at 175–180 W (or ${t.RP()}), then 40 min run at 8:05–8:35/mi. Gate 3 passes if the run holds ≤ 8:45/mi with no cramp.`,{key:true,intensity:true,test:'sim-g3'})]},
 '2027-09-18':st=>{const t=T(st);return[S('brick','RACE SIM 3',220,`3:00 at ${t.RP()}, then 40 min at ${t.rp()}. Last big day.`,{key:true,intensity:true})]},
 '2027-10-16':st=>[S('brick','RACE DAY: IRONMAN 70.3 North Carolina',330,'Swim 34:30 · T1 5:30 · bike 3:03 · T2 3:00 · run 1:44. Ride the power, not the speed. Drink to your practiced fluid plan.',{key:true,test:'race'})]
};

function blockFor(date){return BLOCKS.find(b=>date>=b.start&&date<=b.end)||null}

function sessionsFor(date,st){
  const t=T(st); const b=blockFor(date); if(!b) return [];
  if(TESTS[date]) return TESTS[date](st).filter(Boolean);
  const wk=Math.floor(daysBetween(b.start,date)/7); const dow=(D(date).getDay()+6)%7; // 0=Mon
  const pick=(arr)=>arr[Math.min(wk,arr.length-1)];
  switch(b.id){
  case 'recover': return [[REST],[S('bike','Bike 40 easy',40,`Zone 2, ${t.Z2()}.`)],[easyRun(t,30)],[S('strength','Light strength',30,'Bodyweight circuit, mobility.')],[REST],[S('bike','Bike 60 easy',60,`Zone 2, ${t.Z2()}.`)],[easyRun(t,40)]][dow];
  case 'b1': {
    const tue=[S('bike','Bike 45: openers',45,`30 min Zone 2, then 3 × 1 min at ${t.W(1.0,1.05)}.`),bikeTh(t,0,'3 × 8 min',0.88,0.94,45,'4 min'),bikeTh(t,0,'3 × 10 min',0.88,0.94,50,'4 min'),S('bike','Bike 45 easy',45,`Zone 2, ${t.Z2()}.`)];
    const wed=[easyRun(t,40,true),runQ(t,'thr6'),runQ(t,'thr6'),runQ(t,'thr6')];
    const sat=[null,null,S('bike','Bike 90: 2 × 20 sweet spot',90,`Zone 2 with 2 × 20 min at ${t.W(0.88,0.94)}.`,{key:true,intensity:true}),null];
    const sun=[longRun(t,60),null,longRun(t,70),null];
    return [[REST],[pick(tue)],[pick(wed)],[STR_A],[easyRun(t,30,true)],[pick(sat)||S('bike','Bike 90 Zone 2',90,t.Z2())],[pick(sun)||longRun(t,65),STR_B]][dow].filter(Boolean);
  }
  case 'b2': {
    const tue=[bikeTh(t,0,'3 × 10 min',0.95,1.0,45,'3 min'),bikeTh(t,0,'2 × 15 min',0.95,1.0,45,'4 min'),bikeTh(t,0,'3 × 12 min',0.95,1.0,50,'3 min'),bikeTh(t,0,'2 × 20 min',0.95,1.0,55,'5 min'),S('bike','Bike 45 easy',45,`Zone 2, ${t.Z2()}.`)];
    const wed=[runQ(t,'thr8'),runQ(t,'thr46'),runQ(t,'thr10'),runQ(t,'thr215'),easyRun(t,40,true)];
    const sat=[sat90(t,'3 × 12 min'),sat90(t,'3 × 15 min'),sat90(t,'2 × 20 min'),sat90(t,'2 × 25 min'),S('bike','Bike 75 Zone 2',75,`${t.Z2()}, in position.`)];
    const sun=[65,70,75,80,60];
    return [[REST],[pick(tue)],[pick(wed)],[STR_A],[easyRun(t,30,true)],[pick(sat)],[longRun(t,pick(sun)),STR_B]][dow];
  }
  case 'b3': {
    const tue=[bikeTh(t,0,'2 × 20 min',0.95,1.0,50,'5 min'),bikeTh(t,0,'4 × 10 min',1.0,1.03,50,'3 min'),bikeTh(t,0,'2 × 20 min',0.97,1.02,50,'5 min'),S('bike','Bike 45: openers',45,`Zone 2 with 3 × 1 min at ${t.W(1.0,1.05)}.`),bikeTh(t,0,'3 × 15 min',0.97,1.02,55,'4 min'),bikeTh(t,0,'5 × 8 min',1.02,1.05,55,'3 min'),bikeTh(t,0,'2 × 25 min',0.95,0.98,60,'5 min'),S('bike','Bike 45 easy',45,`Zone 2, ${t.Z2()}.`)];
    const wed=['vo5','thr8','vo6',null,'thr10','vo6','thr48',null];
    const sat=[sat90(t,'2 × 20 min',10),sat90(t,'2 × 20 min',10),sat90(t,'2 × 25 min',10),S('bike','Bike 75 Zone 2',75,t.Z2()),sat90(t,'2 × 25 min',15),sat90(t,'3 × 20 min',15),sat90(t,'2 × 30 min',15),S('bike','Bike 75 Zone 2',75,t.Z2())];
    const sun=[70,75,80,60,80,85,85,60];
    const w=pick(wed);
    return [[REST],[pick(tue)],[w?runQ(t,w):easyRun(t,40,true)],[STR_A],[easyRun(t,35,true)],[pick(sat)],[longRun(t,pick(sun)),STR_B]][dow];
  }
  case 'g1': {
    if(wk===2) return [[REST],[S('bike','Bike 45: openers',45,`Zone 2 with 3 × 1 min at ${t.W(1.0,1.05)}.`)],[easyRun(t,30,true)],[S('strength','Light strength',30,'Half of Strength A, no heavy deadlift.')],[REST],[],[]][dow];
    if(wk===3) return [[REST],[S('bike','Bike 45 easy',45,t.Z2())],[easyRun(t,35)],[STR_A],[REST],[S('bike','Bike 75 Zone 2',75,t.Z2())],[easyRun(t,60)]][dow];
    const tue=[bikeTh(t,0,'2 × 20 min',0.97,1.02,50,'5 min'),bikeTh(t,0,'3 × 12 min',1.0,1.03,50,'3 min')];
    return [[REST],[pick(tue)],[runQ(t,wk?'vo6':'thr48')],[STR_A],[easyRun(t,35,true)],[sat90(t,'2 × 30 min',15)],[longRun(t,wk?80:85),STR_B]][dow];
  }
  case 'b4': {
    const tue=[bikeTh(t,0,'2 × 20 min',0.95,1.0,50,'5 min'),S('bike','Bike 50: over-unders',50,`3 sets of 4 × (2 min at ${t.W(1.03,1.07)} / 2 min at ${t.W(0.88,0.92)}), 4 min easy between sets.`,{key:true,intensity:true}),bikeTh(t,0,'2 × 20 min',0.97,1.02,50,'5 min'),S('bike','Bike 45 easy',45,t.Z2()),bikeTh(t,0,'3 × 15 min',0.98,1.02,55,'4 min'),S('bike','Bike 50: over-unders',50,`3 sets of 4 × (2 min at ${t.W(1.03,1.07)} / 2 min at ${t.W(0.88,0.92)}).`,{key:true,intensity:true}),bikeTh(t,0,'2 × 20 min',0.97,1.02,50,'5 min'),S('bike','Bike 45: openers',45,`Zone 2 with 4 × 1 min at ${t.W(1.0,1.05)}.`)];
    const wed=['hm215','thr55','thr312',null,'hm220','thr64','thr312',null];
    const sat=[sat90(t,'2 × 30 min',15),sat90(t,'2 × 30 min',15),sat90(t,'3 × 25 min',15),S('bike','Bike 75 Zone 2',75,t.Z2()),sat90(t,'2 × 35 min',20,105),sat90(t,'3 × 25 min',20,105),sat90(t,'2 × 40 min',20,110),null];
    const sun=[[80,20],[85,0],[90,20],[60,0],[90,25],[90,0],[90,30],[60,0]];
    const w=pick(wed); const sn=pick(sun);
    return [[REST],[pick(tue)],[w?runQ(t,w,45):easyRun(t,35,true)],[STR_A],[easyRun(t,35,true)],[pick(sat)||S('bike','Bike 60 easy',60,t.Z2())],[longRun(t,sn[0],sn[1]),STR_B]][dow];
  }
  case 'hold': {
    const vol=wk===5?0.75:1; const mn=x=>Math.round(x*vol/5)*5;
    const tue=[bikeTh(t,0,'2 × 20 min',0.97,1.02,50,'5 min'),bikeTh(t,0,'3 × 15 min',0.98,1.02,55,'4 min'),bikeTh(t,0,'2 × 20 min',0.97,1.02,50,'5 min'),S('bike','Bike 45 easy',45,t.Z2()),null,S('bike','Bike 45 easy',45,t.Z2())];
    const wed=['hm220','thr55','thr312',null,'thr64',null];
    const w=pick(wed);
    return [[wk>=2?swimCSS(t,40):REST],[pick(tue)||S('bike','Bike 45 easy',45,t.Z2())],[w?runQ(t,w,45):easyRun(t,mn(40),true)],[STR_A],[easyRun(t,mn(35),true)],[wk===3?S('bike','Bike 75 Zone 2',75,t.Z2()):sat90(t,wk===5?'2 × 20 min':'2 × 35 min',20,wk===5?75:105)],[longRun(t,mn(90),wk===3||wk===5?0:25),STR_B]][dow];
  }
  case 'trip': return [[S('swim','Swim / snorkel',30,'Optional, easy.')],[easyRun(t,35,true)],[S('strength','Bodyweight strength',20,'Split squats, single-leg RDL, step-downs, planks.')],[runQ(t,'thr45',40)],[S('strength','Bodyweight strength',20,'Same circuit.')],[easyRun(t,45)],[REST]][dow];
  case 'b5': {
    const rec=wk===3||wk===7; const reentry=wk===0;
    const tue=[S('bike','Bike 60 Zone 2',60,t.Z2()),bikeTh(t,0,'2 × 20 min',0.95,1.0,75,'5 min'),bikeTh(t,0,'3 × 15 min',0.97,1.02,75,'4 min'),S('bike','Bike 45 easy',45,t.Z2()),bikeTh(t,0,'2 × 20 min',0.97,1.02,75,'5 min'),bikeTh(t,0,'3 × 15 min',0.98,1.02,75,'4 min'),bikeTh(t,0,'2 × 20 min',0.97,1.02,75,'5 min'),S('bike','Bike 45: openers',45,`Zone 2 with 3 × 1 min at ${t.W(1.0,1.05)}.`)];
    const wed=[null,'thr55','thr315','x','hm220','thr64','hm220','x'];
    const sat=[S('bike','Long ride 1:45',105,`Zone 2 with 2 × 20 min at ${t.RP()}.`,{key:true}),S('brick','Long ride 2:30 + run 20',170,`Zone 2 with 3 × 30 min at ${t.RP()}, then run 20 min at ${t.rp()}.`,{key:true,intensity:true}),null,S('bike','Long ride 1:45 Zone 2',105,t.Z2()),S('brick','Long ride 3:00 + run 30',210,`Zone 2 with 3 × 40 min at ${t.RP()}, then 30 min at ${t.rp()}.`,{key:true,intensity:true}),null,S('brick','Long ride 3:30 + run 20',230,`Zone 2 with 2 × 60 min at ${t.RP()}, then 20 min at ${t.rp()}.`,{key:true,intensity:true}),null];
    const sun=[[60,0],[85,20],[95,25],[70,0],[100,30],[90,0],[105,30],[70,0]];
    const w=pick(wed); const sn=pick(sun);
    return [[swimCSS(t,45)],[pick(tue)],[w&&w!=='x'?runQ(t,w,50):easyRun(t,40,true)],[S('bike','Bike 60 Zone 2',60,t.Z2()),Object.assign({},STR_A,{min:30,title:'Strength A (short)'})],[rec?REST:swimCSS(t,45)],[pick(sat)||S('bike','Long ride 2:00 Zone 2',120,t.Z2())],[longRun(t,sn[0],sn[1])]][dow];
  }
  case 'peak': return [[swimCSS(t,45)],[bikeTh(t,0,'3 × 12 min',0.98,1.02,60,'4 min')],[runQ(t,wk?'thr45':'thr312',45)],[S('bike','Bike 60 Zone 2',60,t.Z2()),Object.assign({},STR_A,{min:30,title:'Strength A (short, lighter)'})],[swimCSS(t,40)],[wk?S('brick','Ride 2:00 + run 20',140,`Zone 2 with 2 × 25 min at ${t.RP()}, run 20 min at ${t.rp()}.`,{key:true,intensity:true}):S('brick','Ride 2:30 + run 25',175,`Zone 2 with 2 × 40 min at ${t.RP()}, run 25 min at ${t.rp()}.`,{key:true,intensity:true})],[longRun(t,wk?70:80,15)]][dow];
  case 'taper': {
    if(wk===0) return [[swimCSS(t,40)],[bikeTh(t,0,'3 × 8 min',0.98,1.02,45,'3 min')],[runQ(t,'thr45',40)],[S('bike','Bike 45 Zone 2',45,t.Z2())],[swimCSS(t,30)],[S('brick','Ride 1:30 + run 15',105,`Zone 2 with 2 × 15 min at ${t.RP()}, run 15 min at ${t.rp()}.`,{key:true})],[easyRun(t,50)]][dow];
    return [[S('swim','Swim 30 easy',30,'With 4 × 50 at race effort.')],[S('bike','Bike 40: openers',40,`Zone 2 with 3 × 2 min at ${t.RP()}.`)],[easyRun(t,30,true)],[S('swim','Swim 20 + bike 20',40,'Short and easy. Pack your bags.')],[S('bike','Bike 20 + run 10',30,'Check the bike, two short race-pace efforts. Rack the bike.')],[],[]][dow];
  }}
  return [];
}
window.PLAN={BLOCKS,GATES,blockFor,sessionsFor,T,iso,addDays,daysBetween,D};
})();
