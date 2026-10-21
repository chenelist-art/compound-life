/* A Second Chance: the verbs events can use. Events are data (events/*.json); what a choice does is a short script that
   calls these verbs, e.g. "pay(.12*base); rec('mlm', .04*base, 3)". Each verb runs on the life being played (the script
   never names it), so pay(x) here is pay(s, x) in engine.js. events/README.md lists every verb with an example.
   The shared mechanics first (most came from the country cards and are used by many events), then the table itself.
   SOURCES for the amounts the country cards use are in each card's "src" in events/country-*.json. */

/* ---------- shared mechanics (country cards and more) ---------- */
const CC=s=>C[s.ci][1];
/* country cards are dealt a little more often than general ones (DENSITY in engine.js), so each life gets a few */
const CDENS=.8;
const kidAge=s=>s.kids.map(b=>s.age-b).filter(x=>x>=0);
const hasKid=(s,a,b)=>kidAge(s).some(x=>x>=a&&x<=b);
/* no employer's schemes: your own business, creative or gig work, farming, or no job */
const selfEmp=s=>!s.job||['own','creative'].includes(CAR[s.job.id].f)||s.job.id==='farm';
const byFam=(s,o)=>o[s.fam];
/* a contract abroad can start: working, not abroad or on a contract already, not retired, not still training */
const ctrWhen=s=>job(s)&&s.abroad==null&&!s.ctr&&!s.retired&&!(s.job.train>s.age);
/* move part of your free savings into a savings product */
function putIn(s,src,a,props,lk){a=Math.min(a,liquid(s));if(!(a>0))return 0;pay(s,a);mkLot(s,src,props,lk);addLot(s,src,a);return a}
/* a yearly contribution into a lot: amt a year (or p × pay), plus bonus × it (a government top-up, an employer's share,
   tax relief); until an age; noHouse: stops once you own a home */
function yearly(s,src,o,props,lk){mkLot(s,src,props||{},lk);(s.dca||(s.dca=[])).push(Object.assign({lot:src},o))}
/* a pay change for some years (overtime, parental leave, part-time), then back to normal */
function tmpPay(s,id,m,yrs,lk){s.bump[id]=(s.bump[id]||1)*m;const t=T(s,id,{kind:'custom',label:M(lk)});t.note=M(m<1?'note.payDn':'note.payUp',{p:Math.round(Math.abs(m-1)*100),n:yrs});later(s,s.age+yrs,'unbump',{id})}
/* stop yearly contributions into a lot */
function stopYearly(s,lot){s.dca=(s.dca||[]).filter(d=>d.lot!==lot)}
/* stop a yearly cost early */
function stopRec(s,id){for(const r of s.rec)if(r.id===id)r.until=s.age}
/* a contract abroad: pay × m for yrs years, living costs × cm (below 1 when the employer houses you), a fee up front;
   remit: money sent home each year */
function contract(s,id,o){const t=T(s,id,{kind:'custom',label:M('trk.'+id),nk:'note.ctr'});pay(s,o.fee);t.v-=o.fee;t.paid=o.fee;t.note=M('note.ctr',{a:MN(o.fee)});
 s.bump[id]=(s.bump[id]||1)*o.m;s.ctr=id;s.costMul=(s.costMul||1)*o.cm;s.happy-=3;rl(s,-3);
 if(o.remit){T(s,'remit',{kind:'custom',label:M('trk.remit')});rec(s,'remit',o.remit,o.yrs);rl(s,5)}
 later(s,s.age+o.yrs,'ctrEnd',{id,cm:o.cm})}
/* a move to a big city: pay × m, living costs × cm, home prices × hm, further from family */
function cityMove(s,id,m,cm,hm,d){bump(s,id,m,M('trk.'+id));s.costMul=(s.costMul||1)*cm;s.hm*=hm;rl(s,d);s.happy-=1}
/* a health scheme: it pays share 1−m of each medical bill; a yearly premium */
function medPlan(s,id,m,cost){s.medCut=m;s.medTk=id;T(s,id,{kind:'custom',label:M('trk.'+id),paid:0,saved:0,nk:'note.med'});if(cost>0)rec(s,id,cost,99)}
/* when the state pension starts and how big it is (see statePen in engine.js) */
function penClaim(s,at,m,id){s.penAt=at;s.penM=m;s.penTk=id;T(s,id,{kind:'custom',label:M('trk.penAt',{a:at}),got:0,note:M('note.penAt0')})}
/* a scheme's own pension: a contributions line (yearly cost) and the pension it pays from `at` */
function penScheme(s,id,cost,yrs,a,at){T(s,id,{kind:'custom',label:M('trk.'+id),paid:0,saved:0,nk:'note.penX'});if(cost>0)rec(s,id,cost,yrs);s.penX={a,at,tk:id}}
/* a home bought through a scheme. P: price you pay; o: val (what it is worth), dp (down payment share), fee (costs
   share), r (real interest), n (years), lk (passbook label), fixed (a fixed-rate loan the rate rises skip), flex (if
   savings don't cover the down payment, the loan covers more, down to 5% down) */
function buyAt(s,P,o){let dp=o.dp!=null?o.dp:.2;const fee=o.fee!=null?o.fee:.03,r=Math.max(1e-6,(o.r!=null?o.r:.03)+(s.rateAdj||0)),n=o.n||30,val=o.val||P;
 homeFirst(s);if(o.flex)dp=clamp(liquid(s)/P-fee,.05,dp);const up=(dp+fee)*P,L0=(1-dp)*P;pay(s,up);
 s.house={value:val,mort:L0,pay:L0>0?amort(L0,r,n):0,out:up,rentAv:0,frac:o.frac||val/price(s),rate:r,end:s.age+n,fixed:!!o.fixed};
 T(s,'home',{kind:'custom',label:M(o.lk||'trk.home'),v:-fee*P,note:M('note.homeFees')});return up}
/* what a scheme home costs up front, and a year's repayments (money for the option's text) */
const upFront=(P,dp,fee)=>MN((dp+(fee!=null?fee:.03))*P),yrPay=(P,dp,r,n)=>MN(amort((1-dp)*P,r||1e-6,n||30));
/* a child's schooling: tuition now may win them a bursary for university later (kidFeeM; game rule) */
function kidWin(s,p,m){later(s,s.age+6,'kidWin',{p,m})}
/* the family pays for a teenager's coaching; a poorer family borrows, and you help repay it once you work */
function famCost(s,id,a){if(s.fam==='poor'||s.fam==='working')later(s,22,'famDebt',{id,a:a*s.base})}
/* Brazil's FGTS: 8% of pay a year goes into the account (balance capped at eight years' worth, an ESTIMATE of what builds up
   between payouts); on a layoff you take it all plus the 40% fine, or only the fine if you chose saque-aniversário */
function fgtsBal(s){const f=s.fgts;return .08*Math.max(s.lastSal,s.base)*Math.min(8,Math.max(0,s.age-f.since))}
function cLaid(s,L){const f=s.fgts;if(!f||!s.job)return;const b=fgtsBal(s),v=(f.mode==='resc'?1.4:.4)*b;f.since=s.age;s.cash+=v;const t=s.trk.br_fgts;if(t){t.v+=v;t.note=M('note.fgts',{a:MN(v)})}L&&L(M('log.fgts',{a:MN(v)}),'good')}
/* follow-up cards ("three years later…"): event `id` (an event with "chain": true) comes up `yrs` years from now (a number,
   or [from, to] for a random year in between); `data` is kept for it and its scripts read it as `chain` */
function next(s,id,yrs,data){if(!s.chain)s.chain={};if(s.chain[id]||s.done[id])return;
 const y=Array.isArray(yrs)?yrs[0]+Math.floor(evR(s,'nextAt'+id)()*(yrs[1]-yrs[0]+1)):yrs||0;s.chain[id]={at:s.age+y,d:data||{}}}

/* consequences these verbs schedule (the events' own are in their JSON, under "later") */
Object.assign(LATER,{
 unbump:(s,x)=>{s.bump[x.id]=1;const t=s.trk[x.id];if(t)t.note=M('note.payEnd')},
 ctrEnd:(s,x,L)=>{s.bump[x.id]=1;s.costMul=(s.costMul||1)/x.cm;s.ctr=null;rl(s,3);s.happy+=3;const t=s.trk[x.id];if(t){t.nk='note.ctrEnd';t.note=M('note.ctrEnd',{a:MN(t.paid||0)})}L&&L(M('log.ctrEnd'),'good')},
 kidWin:(s,x,L)=>{if(evR(s,'kidWin')()<x.p){s.kidFeeM=(s.kidFeeM||1)*x.m;L&&L(M('log.kidWin'),'good')}},
 famDebt:(s,x,L)=>{T(s,x.id,{kind:'custom',label:M('trk.famDebt')});rec(s,x.id,x.a/5,5);L&&L(M('log.famDebt',{a:MN(x.a)}),'')}
});

/* ---------- the verb table ----------
   Verbs that act on the life get it as their first argument (pay(s, a) is written pay(a)); the rest are plain functions. */
{const V=ES.VERBS,S={
 /* money */ pay,spend,rec,stopRec,stopYearly,putIn,yearly,addLot,mkLot,withdrawEq,bump,tmpPay,setSave,bet,
 /* passbook */ T,
 /* skill, study and work */ addSkill,startStudy,startCert,learnLuck,edLv,pickCareer,endCareer,offerSwitch,carStartPay,carLock,carHint,startBiz,
 /* home, car, family */ buy,buyAt,homeFirst,wed,startDating,kidWin,famCost,
 /* places and schemes */ contract,cityMove,medPlan,penClaim,penScheme,abroadTo,
 /* health */ treat,illYou,survP,depFee,depStart,
 /* markets */ crashSell,crashTrack,crashPct,
 /* reading the life */ salary,skill,liquid,eqTot,mktTot,netWorth,netOf,price,rent,eduCost,inhAmt,bizP,negoP,efTarget,slPay,fgtsBal,
  CC,kidAge,hasKid,selfEmp,byFam,mentorFit,LNY,relP,ctrWhen,
 /* consequences and people */ later,rl,heal,next,
 /* randomness: evR('key') is a sequence of random numbers, the same for this life, year and key (see engine.js) */ evR};
 for(const k in S){const f=S[k];V[k]=(c,...a)=>f(c.s,...a)}
 const PURE={MN,MS,clamp,amort,carPay,mPay,inR,upFront,yrPay,setRate,isMkt,String,Number,
  /* careers: every career id, and one career's data (read only) */ careerIds:()=>Object.keys(CAR),career:id=>CAR[id],countryIndex:k=>C.findIndex(c=>c[1]===k)};
 for(const k in PURE){const f=PURE[k];V[k]=(c,...a)=>f(...a)}
 /* a message to translate when shown; a key starting with "." belongs to this event: M('.no') in the event "hobby" is e.hobby.no */
 V.M=(c,k,v)=>M(typeof k==='string'&&k[0]==='.'?c.p+k:k,v);
 /* one random number in [0, 1): roll('key') is evR('key')() */
 V.roll=(c,k)=>evR(c.s,k)();
 /* working: a career, not studying, not retired (job(s) in engine.js) */
 V.working=c=>job(c.s);
 /* a line in this year's diary (only while the year is being played; kind 'good', 'bad' or '') */
 V.log=(c,m,k)=>{if(c.L)c.L(m,k||'')};
 /* verbs that also write in the diary */
 V.refer=(c,id,m,lk,lg)=>refer(c.s,id,m,lk,c.L,lg);
 V.chipIn=(c,you,k)=>chipIn(c.s,you,k,c.L);
 V.divorce=(c,by)=>divorce(c.s,by,c.L);
 V.splitUp=(c,by)=>splitUp(c.s,by,c.L);
 V.cLaid=c=>cLaid(c.s,c.L);
 const K=ES.CONST;K.Math={min:Math.min,max:Math.max,floor:Math.floor,ceil:Math.ceil,round:Math.round,abs:Math.abs,exp:Math.exp,log:Math.log,sqrt:Math.sqrt,pow:Math.pow,PI:Math.PI};
 K.C=C;K.CAR=CAR;K.ILLT=ILLT;K.SCH=SCH;K.SK=SK;K.DENSITY=DENSITY;K.CDENS=CDENS}
