/* A Second Chance: country cards. Each of the 17 countries has its own cards, based on its real systems and common life
   situations; a life is dealt a few of them alongside the general deck. They are added to the front of EV (so a country card
   comes before a general card due the same year: Singapore's National Service and Germany's Ausbildung before the
   choice at 18). Every card is only dealt to lives born in its country (`only`), and is checked again when due (`when`).
   SOURCES: each card's comment gives the facts it quotes and where they come from. All money amounts in the game are
   converted to game money (PPP dollars) by the World Bank PPP factors in engine.js (PPP); for Nigeria, Pakistan and
   Ethiopia, where prices have risen a lot since 2022, recent local amounts are compared with that year's minimum or typical
   wage instead. The game's own numbers (chances, how much a choice changes Health, Happiness or Relationships, risk of a
   flood or a failed savings group) are game rules, not data, and are marked ESTIMATE where they are guesses at a real cost. */
const CC=s=>C[s.ci][1];
/* country cards are dealt a little more often than general ones (DENSITY in engine.js), so each life gets a few */
const CDENS=.8;
const kidAge=s=>s.kids.map(b=>s.age-b).filter(x=>x>=0);
const hasKid=(s,a,b)=>kidAge(s).some(x=>x>=a&&x<=b);
/* no employer's schemes: your own business, creative or gig work, farming, or no job */
const selfEmp=s=>!s.job||['own','creative'].includes(CAR[s.job.id].f)||s.job.id==='farm';
const byFam=(s,o)=>o[s.fam];
/* a country card: dealt only to lives born in `cc`; title e.<id>.t and text e.<id>.x unless given */
function CE(cc,o){const only=o.only,when=o.when;o.cc=cc;if(o.dens==null)o.dens=CDENS;o.only=s=>CC(s)===cc&&(!only||only(s));o.when=s=>CC(s)===cc&&!s.dead&&(!when||when(s));
 if(!o.title)o.title=M('e.'+o.id+'.t');if(!o.text)o.text=s=>M('e.'+o.id+'.x');return o}
/* an option: label <k>.<id>, sub <k>.<id>.s with vars v; h (true or vars) adds the Easy-only hint <k>.<id>.h */
function Q(k,id,v,go,ok,h){const o=O(id,k+'.'+id,M(k+'.'+id+'.s',v||{}),go,ok);if(h)o.hint=M(k+'.'+id+'.h',h===true?{}:h);return o}
/* the same, moving Relationships by d (shown in Easy) */
function QR(k,id,v,d,go,ok,h){return OR(id,k+'.'+id,M(k+'.'+id+'.s',v||{}),d,go,ok,h?M(k+'.'+id+'.h',h===true?{}:h):undefined)}
const ek=id=>'e.'+id;

/* ---------- shared mechanics ---------- */
/* move part of your free savings into a savings product */
function putIn(s,src,a,props,lk){a=Math.min(a,liquid(s));if(!(a>0))return 0;pay(s,a);mkLot(s,src,props,lk);addLot(s,src,a);return a}
/* a yearly contribution into a lot: amt a year (or p × pay), plus bonus × it (a government top-up, an employer's share,
   tax relief); until an age; noHouse: stops once you own a home */
function yearly(s,src,o,props,lk){mkLot(s,src,props||{},lk);(s.dca||(s.dca=[])).push(Object.assign({lot:src},o))}
/* a pay change for some years (overtime, parental leave, part-time), then back to normal */
function tmpPay(s,id,m,yrs,lk){s.bump[id]=(s.bump[id]||1)*m;const t=T(s,id,{kind:'custom',label:M(lk)});t.note=M(m<1?'note.payDn':'note.payUp',{p:Math.round(Math.abs(m-1)*100),n:yrs});later(s,s.age+yrs,'unbump',{id})}
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
const upFront=(P,dp,fee)=>MN((dp+(fee!=null?fee:.03))*P),yrPay=(P,dp,r,n)=>MN(amort((1-dp)*P,r||1e-6,n||30));
/* a savings group (ROSCA): pay a yearly amount a (× typical wage) for n years; take the pot early (× early) or late (× late,
   with a small risk that someone stops paying and you get half) */
function rosca(s,id,turn,o){const a=o.a*s.base,pot=a*o.n,t=T(s,id,{kind:'custom',label:M('trk.rosca'),paid:0,saved:0,nk:'note.rosca'});rec(s,id,a,o.n);
 if(turn==='early'){const v=pot*o.early;s.cash+=v;t.v+=v;t.saved=v;t.note=M('note.rosca',{a:MN(0),b:MN(v)})}else later(s,s.age+o.n,'rosca',{id,pot,m:o.late,risk:o.risk})}
/* the three choices on every savings-group card (the group's name and how it works are in the card's text) */
function roscaOpts(id,o,draw){return s=>{const a=o.a*s.base,v={a:MN(a),b:MN(a*o.n*o.early),c:MN(a*o.n*o.late),n:o.n};
 const os=draw?[QR('e.rosca','join',v,2,s=>rosca(s,id,evR(s,id+'Turn')()<.5?'early':'late',o),undefined,{p:Math.round(o.risk*100)})]
  :[QR('e.rosca','early',v,2,s=>rosca(s,id,'early',o)),QR('e.rosca','late',v,2,s=>rosca(s,id,'late',o),undefined,{p:Math.round(o.risk*100)})];
 return os.concat([QR('e.rosca','no',v,-1,null)])}}
/* floods and storms: k 0 nothing done, 1 prepared, 2 insured; aid: government aid when hit (× typical wage); p: the chance
   a flood reaches you in the next few years (game rule) */
function floodPrep(s,id,k,o){later(s,s.age+1+Math.floor(evR(s,id+'At')()*7),'flood',{id,lv:k,aid:o.aid||0,p:o.p||.55});
 if(k===2){T(s,id,{kind:'custom',label:M('trk.floodIns'),paid:0,saved:0,nk:'note.floodIns'});rec(s,id,o.prem*s.base,10)}
 if(k===1)spend(s,id+'P',o.prep*s.base,'trk.floodPrep')}
function floodOpts(id,o){return s=>[Q('e.flood','cover',{a:MN(o.prem*s.base)},s=>floodPrep(s,id,2,o),undefined,{p:Math.round((o.p||.55)*100)}),
 Q('e.flood','prep',{a:MN(o.prep*s.base)},s=>floodPrep(s,id,1,o),undefined,{p:Math.round((o.p||.55)*100)}),
 Q('e.flood','none',{},s=>floodPrep(s,id,0,o),undefined,{p:Math.round((o.p||.55)*100)})]}
/* very high inflation: money left in a local bank account loses f of its value next year */
function inflOpts(id,f,usd){return s=>{const c=Math.max(0,s.cash),fx=evR(s,id+'F')(),lose=inR(fx,f);return[
 Q('e.infl','keep',{},s=>later(s,s.age+1,'infl',{id,f:lose}),undefined,{a:Math.round(f[0]*100),b:Math.round(f[1]*100)}),
 Q('e.infl','usd',{a:MN(.02*c),x:M(usd)},s=>{const t=T(s,id,{kind:'custom',label:M('trk.infl')});const fe=.02*Math.max(0,s.cash);s.cash-=fe;t.v-=fe;later(s,s.age+1,'infl',{id,f:inR(fx,[-.04,.05])})}),
 Q('e.infl','stock',{a:MN(.5*c)},s=>{putIn(s,id+'S',.5*Math.max(0,s.cash),{},'trk.inflStock');later(s,s.age+1,'infl',{id,f:lose})})]}}
/* a fixed bonus month by law (13th-month pay, THR, aguinaldo): how to use it. m: share of a year's pay */
function bonusOpts(id,m){return s=>{const a=m*salary(s);return[
 Q('e.m13','inv',{a:MN(a)},s=>{putIn(s,id,a,{},'trk.m13inv')}),
 Q('e.m13','debt',{a:MN(a)},s=>{const p=Math.min(a,s.debt,Math.max(0,s.cash));s.debt-=p;s.cash-=p;s.happy+=1},s.debt>1||M('e.m13.nodebt')),
 Q('e.m13','treat',{a:MN(a)},s=>{spend(s,id,a,'trk.m13treat');s.happy+=3;rl(s,1)}),
 Q('e.m13','bank',{a:MN(a)},s=>{})]}}
/* a contract abroad card's options: go, go and send money home, stay */
function ctrOpts(id,o){return s=>{const sal=salary(s),f=o.fee*s.base,r=(o.remit||.25)*s.base;return[
 Q('e.ctr','go',{a:MN(o.m*sal),b:MN(sal),f:MN(f),n:o.yrs},s=>contract(s,id,Object.assign({},o,{fee:f}))),
 Q('e.ctr','send',{a:MN(o.m*sal),f:MN(f),r:MN(r),n:o.yrs},s=>contract(s,id,Object.assign({},o,{fee:f,remit:r}))),
 Q('e.ctr','stay',{},s=>{})]}}
const ctrWhen=s=>job(s)&&s.abroad==null&&!s.ctr&&!s.retired&&!(s.job.train>s.age);
/* a public exam for a government job: p is the chance to pass; full: a year of unpaid leave to study */
function examTry(s,id,p,full,fee){pay(s,fee);const t=T(s,id,{kind:'custom',label:M('trk.exam')});t.v-=fee+(full?Math.max(0,salary(s)):0);t.note=M('note.examIn');
 if(full)s.offUntil=s.age+1;else s.happy-=2;later(s,s.age+1,'exam',{id,p})}
function examOpts(id,base){return s=>{const p=clamp(base+skill(s)*.004,.04,.4),sal=salary(s);return[
 Q('e.exam','full',{a:MN(sal),b:MN(.1*s.base)},s=>examTry(s,id,p,true,.1*s.base),undefined,{p:Math.round(p*100)}),
 Q('e.exam','part',{b:MN(.05*s.base)},s=>examTry(s,id,.55*p,false,.05*s.base),undefined,{p:Math.round(.55*p*100)}),
 Q('e.exam','no',{},s=>{})]}}
/* a child's schooling: tuition now may win them a bursary for university later (kidFeeM; game rule) */
function kidWin(s,p,m){later(s,s.age+6,'kidWin',{p,m})}
/* the family pays for a teenager's coaching; a poorer family borrows, and you help repay it once you work */
function famCost(s,id,a){if(s.fam==='poor'||s.fam==='working')later(s,22,'famDebt',{id,a:a*s.base})}
/* the pension-claiming card's options: ages and multipliers */
function penOpts(id,list){return s=>list.map(([at,m,ok])=>Q(ek(id),String(at),{a:MN(.18*s.base*m),n:at},s=>penClaim(s,at,m,id),ok?ok(s):undefined))}

/* ---------- consequences that arrive later ---------- */
Object.assign(LATER,{
 unbump:(s,x)=>{s.bump[x.id]=1;const t=s.trk[x.id];if(t)t.note=M('note.payEnd')},
 ctrEnd:(s,x,L)=>{s.bump[x.id]=1;s.costMul=(s.costMul||1)/x.cm;s.ctr=null;rl(s,3);s.happy+=3;const t=s.trk[x.id];if(t){t.nk='note.ctrEnd';t.note=M('note.ctrEnd',{a:MN(t.paid||0)})}L&&L(M('log.ctrEnd'),'good')},
 rosca:(s,x,L)=>{const t=s.trk[x.id],bad=evR(s,'rosca'+x.id)()<x.risk,v=x.pot*x.m*(bad?.5:1);s.cash+=v;if(t){t.v+=v;t.saved=(t.saved||0)+v;t.note=M('note.rosca',{a:MN(t.paid||0),b:MN(t.saved)})}
  if(bad)rl(s,-3);L&&L(M(bad?'log.roscaBad':'log.roscaOk',{a:MN(v)}),bad?'bad':'good')},
 flood:(s,x,L)=>{if(evR(s,x.id)()>=x.p){L&&L(M('log.floodNo'),'good');return}
  const B=s.base,full=(s.house?.45:.15)*B,f=[1,.5,.12][x.lv],loss=full*f,aid=x.aid*B,t=T(s,x.id,{kind:'custom',label:M('trk.flood'),paid:0,saved:0});
  pay(s,loss);s.cash+=aid;s.happy=clamp(s.happy-5,0,100);s.health=clamp(s.health-2,3,100);t.v+=aid-loss;t.saved=(t.saved||0)+full-loss;
  t.note=M(x.lv===2?'note.floodIns':'note.flood',{a:MN(x.lv===2?t.paid:loss),b:MN(x.lv===2?t.saved:aid)});L&&L(M(aid>0?'log.floodAid':'log.flood',{a:MN(loss),b:MN(aid)}),'bad')},
 infl:(s,x,L)=>{const t=T(s,x.id,{kind:'custom',label:M('trk.infl')}),d=-x.f*Math.max(0,s.cash);s.cash+=d;t.v+=d;
  t.note=M(d<0?'note.inflLoss':'note.inflOk',{a:MN(Math.abs(d))});L&&L(M(d<0?'log.inflLoss':'log.inflOk',{a:MN(Math.abs(d))}),d<0?'bad':'good')},
 exam:(s,x,L)=>{const t=s.trk[x.id];if(!s.job||s.retired)return;if(evR(s,'exam'+x.id)()<x.p){endCareer(s,'quit',s.age-1);pickCareer(s,'civ');if(t)t.note=M('note.examOk');L&&L(M('log.examOk'),'good')}
  else{s.happy-=3;if(t)t.note=M('note.examNo');L&&L(M('log.examNo'),'bad')}},
 kidWin:(s,x,L)=>{if(evR(s,'kidWin')()<x.p){s.kidFeeM=(s.kidFeeM||1)*x.m;L&&L(M('log.kidWin'),'good')}},
 famDebt:(s,x,L)=>{T(s,x.id,{kind:'custom',label:M('trk.famDebt')});rec(s,x.id,x.a/5,5);L&&L(M('log.famDebt',{a:MN(x.a)}),'')},
 refund:(s,x,L)=>{s.cash+=x.a;const t=s.trk[x.id];if(t){t.v+=x.a;t.note=M('note.refund',{a:MN(x.a)})}},
 hmove:(s,x,L)=>{s.hm*=x.m;if(s.house)s.house.value*=x.m;L&&L(M(x.m<1?'log.hmDown':'log.hmUp',{p:Math.round(Math.abs(x.m-1)*100)}),x.m<1?'bad':'good')},
 sideBiz:(s,x,L)=>{if(evR(s,'side'+x.id)()<x.p){T(s,x.id,{kind:'custom',label:M('trk.sideBiz')});rec(s,x.id,-x.a,x.n);L&&L(M('log.sideBiz'),'good')}},
 /* Singapore: the BTO ballot, then the keys about four years later */
 bto:(s,x,L)=>{if(s.house){s.hWait=0;return}if(evR(s,'bto'+x.n)()<x.p){s.hWait=s.age+5;later(s,s.age+4,'btoKeys',{});L&&L(M('log.btoWin'),'good')}
  else if(x.n<3){later(s,s.age+1,'bto',{p:x.p,n:x.n+1});L&&L(M('log.btoLose'),'')}else{s.hWait=0;L&&L(M('log.btoGive'),'bad')}},
 btoKeys:(s,x,L)=>{s.hWait=0;if(s.house)return;const P=price(s);buyAt(s,.66*P,{val:P,dp:.2,fee:.02,r:.01,n:25,lk:'trk.bto',fixed:true,flex:true});L&&L(M('log.btoKeys'),'good')},
 coeEnd:(s,x,L)=>{if(s.car&&s.car.trk==='sg_coe'){s.car=null;L&&L(M('log.coeEnd'),'')}},
 /* Japan: a buyer for the empty house; an earthquake */
 akiya:(s,x,L)=>{if(evR(s,'akiyaBuy')()<.3){const v=.4*s.base;s.cash+=v;stopRec(s,'jp_akiya');const t=s.trk.jp_akiya;if(t){t.v+=v;t.note=M('note.akiyaSold',{a:MN(v)})}L&&L(M('log.akiyaSold',{a:MN(v)}),'good')}},
 quake:(s,x,L)=>{if(!s.house||evR(s,'quake')()>=.25)return;const d=.25*s.house.value,cov=x.ins?.5*d:0;pay(s,d-cov);s.happy-=5;
  const t=T(s,'jp_quake',{kind:'custom',label:M('trk.jp_quake')});t.v-=d-cov;t.note=M('note.quake',{a:MN(d),b:MN(cov)});L&&L(M('log.quake',{a:MN(d),b:MN(cov)}),'bad')},
 /* Germany: BAföG repayments start five years after your studies */
 bafog:(s,x,L)=>{const y=Math.ceil(x.a/(.07*s.base));rec(s,'de_bafog',.07*s.base,y)},
 /* Brazil: the FGTS balance at 60 */
 fgts60:(s,x,L)=>{const f=s.fgts;if(!f||f.mode!=='resc')return;const v=fgtsBal(s);f.since=s.age;s.cash+=v;const t=s.trk.br_fgts;if(t){t.v+=v;t.note=M('note.fgts',{a:MN(v)})}L&&L(M('log.fgts',{a:MN(v)}),'good')},
 /* Ethiopia: the condominium lottery; a death in the family */
 condo:(s,x,L)=>{if(s.house){s.condoOn=0;return}if(evR(s,'condo'+s.age)()<x.p){const P=.6*price(s),l=s.lots.et_condo,sv=l?l.v:0;if(l){l.v=0;l.tout+=sv;s.cash+=sv}
   s.dca=(s.dca||[]).filter(d=>d.lot!=='et_condo');s.condoOn=0;buyAt(s,P,{val:price(s),dp:x.dp,fee:.01,r:.0,n:20,lk:'trk.et_condo',fixed:true,flex:true});L&&L(M('log.condoWin'),'good')}
  else if(s.age<x.until)later(s,s.age+1,'condo',x)},
 idir:(s,x,L)=>{const c=.3*s.base,cov=s.idir?.8*c:0;pay(s,c-cov);s.happy-=4;const t=T(s,'et_idir',{kind:'custom',label:M('trk.et_idir'),paid:0,saved:0,nk:'note.idir'});
  t.v-=c-cov;t.saved=(t.saved||0)+cov;t.note=M('note.idir',{a:MN(t.paid||0),b:MN(t.saved)});L&&L(M(s.idir?'log.idirHelp':'log.idirNo',{a:MN(c),b:MN(cov)}),'bad')},
 rte:(s,x,L)=>{if(evR(s,'rte')()<.35){L&&L(M('log.rteWin'),'good');kidWin(s,.3,.7)}else{L&&L(M('log.rteNo'),'');kidWin(s,.15,.8)}}
});
/* Brazil's FGTS: 8% of pay a year goes into the account (balance capped at eight years' worth, an ESTIMATE of what builds up
   between payouts); on a layoff you take it all plus the 40% fine, or only the fine if you chose saque-aniversário */
function fgtsBal(s){const f=s.fgts;return .08*Math.max(s.lastSal,s.base)*Math.min(8,Math.max(0,s.age-f.since))}
function cLaid(s,L){const f=s.fgts;if(!f||!s.job)return;const b=fgtsBal(s),v=(f.mode==='resc'?1.4:.4)*b;f.since=s.age;s.cash+=v;const t=s.trk.br_fgts;if(t){t.v+=v;t.note=M('note.fgts',{a:MN(v)})}L&&L(M('log.fgts',{a:MN(v)}),'good')}

const CEV=[
/* ===================== Malaysia (MY) ===================== */
/* PTPTN: study loans charge a 1% yearly ujrah (fee) and are repaid by salary deduction (ptptn.gov.my, as summarised by
   malaysia4u.com and CTOS, 2026). Malaysian inflation has run at about 2% (DOSM), so in today's money about −1% a year.
   Many borrowers park spare loan money in ASB/ASM, which paid 4.75–5.75% (PNB): about 2.5% after inflation, an ESTIMATE. */
CE('MY',{id:'my_ptptn',win:[18,19],p:1,def:'take',when:s=>!!s.study&&s.study.k==='uni'&&s.fam!=='rich',
 text:s=>M('e.my_ptptn.x'),
 opts:s=>{const B=s.base;return[
  Q(ek('my_ptptn'),'take',{},s=>{s.sloanR=-.01;s.sloanN=15}),
  Q(ek('my_ptptn'),'park',{a:MN(.3*B)},s=>{s.sloanR=-.01;s.sloanN=15;s.sloan+=.3*B;mkLot(s,'ptinv',{rate:.025},'trk.ptinv');addLot(s,'ptinv',.3*B)},undefined,true),
  Q(ek('my_ptptn'),'skip',{},s=>{})]}}),
/* EPF Akaun Fleksibel: since 11 May 2024, 10% of new contributions go to Account 3, withdrawable at any time (min RM50)
   (EPF via Malay Mail, 25 Apr 2024). EPF paid 6.30% for 2024 (EPF, 1 Mar 2025, via The Star and Malay Mail). */
CE('MY',{id:'my_epf3',win:[26,50],p:.8,def:'keep',when:s=>!!s.lots.epf&&s.age<55&&s.lots.epf.v>.3*s.base,
 text:s=>M('e.my_epf3.x',{a:MN(.1*s.lots.epf.v)}),
 opts:s=>{const x=.1*s.lots.epf.v,out=s=>{const l=s.lots.epf,y=Math.min(x,l.v);l.v-=y;l.tout+=y;return y};return[
  Q(ek('my_epf3'),'keep',{},s=>{}),
  Q(ek('my_epf3'),'spend',{a:MN(x)},s=>{const y=out(s);s.happy+=3;const t=T(s,'my_epf3',{kind:'ghost',label:M('trk.my_epf3')});t.spent+=y;t.g+=y}),
  Q(ek('my_epf3'),'cash',{a:MN(x)},s=>{s.cash+=out(s)})]}}),
/* PNB fixed-price funds: ASM 2 Wawasan paid 4.75 sen a unit (4.75%) for FY2024, beating 12-month fixed deposits by 2.04 points
   (PNB press release, 30 Aug 2024). After about 2% inflation, roughly 2.5% a year: an ESTIMATE. */
CE('MY',{id:'my_asm',win:[22,48],p:.7,def:'keep',when:s=>liquid(s)>.25*s.base,
 text:s=>M('e.my_asm.x',{a:MN(.3*liquid(s))}),
 opts:s=>{const a=.3*liquid(s);return[
  Q(ek('my_asm'),'asm',{a:MN(a)},s=>putIn(s,'asm',a,{rate:.025},'trk.asm')),
  Q(ek('my_asm'),'index',{a:MN(a)},s=>putIn(s,'pick',a,{},'trk.pick')),
  Q(ek('my_asm'),'keep',{},s=>{})]}}),
/* Open houses (rumah terbuka) at Hari Raya, Chinese New Year, Deepavali and Christmas, with duit raya / ang pao for children:
   a long-standing Malaysian custom (Tourism Malaysia). The costs are ESTIMATES. */
CE('MY',{id:'my_open',win:[27,62],p:.7,def:'small',
 opts:s=>{const B=s.base;return[
  QR(ek('my_open'),'big',{a:MN(.06*B)},4,s=>{spend(s,'my_open',.06*B,'trk.my_open');s.happy+=2}),
  QR(ek('my_open'),'small',{a:MN(.015*B)},2,s=>spend(s,'my_open',.015*B,'trk.my_open')),
  QR(ek('my_open'),'visit',{a:MN(.004*B)},1,s=>spend(s,'my_open',.004*B,'trk.my_open'))]}}),
/* Monsoon floods: the northeast monsoon (November to March) brings floods in many years (MetMalaysia). After the December 2021
   floods, NADMA paid RM1,000 per flood-hit household as Bantuan Wang Ihsan (Malay Mail, 22 Dec 2021): RM1,000 ÷ the
   game's typical wage (RM21,000 a year) = 0.048. Premiums for a "special perils" flood add-on are an ESTIMATE. */
CE('MY',{id:'my_flood',win:[24,75],p:.7,def:'none',opts:floodOpts('my_flood',{aid:.048,prem:.006,prep:.01})}),
/* Working in Singapore from Johor: 250,000–300,000 Malaysians commute daily, some for three hours (Malay Mail 2023; SCMP 2023).
   Pay in Singapore dollars: about 1.7× (game estimate from the two countries' typical wages); tolls and fuel are ESTIMATES. */
CE('MY',{id:'my_jb',win:[22,40],p:.5,def:'stay',when:ctrWhen,
 text:s=>M('e.my_jb.x',{a:MN(1.7*salary(s))}),
 opts:s=>{const sal=salary(s),B=s.base;return[
  Q(ek('my_jb'),'go',{a:MN(1.7*sal),b:MN(sal),c:MN(.06*B)},s=>{contract(s,'my_jb',{m:1.7,cm:1,yrs:8,fee:.02*B});rec(s,'my_jb',.06*B,8,-.8);s.happy-=1},undefined,true),
  Q(ek('my_jb'),'stay',{},s=>{})]}}),
/* First home: first-time buyers pay no stamp duty on homes up to RM500,000 until 31 Dec 2027 (P.U.(A) 448/2025, Budget 2026;
   Bernama, SAYS). Banks lend up to 90% on a first or second home (Bank Negara's loan-to-value limit applies from the third). */
CE('MY',{id:'my_first',win:[26,40],p:.6,def:'wait',when:s=>!s.house&&job(s)&&!(s.hWait>s.age),
 text:s=>M('e.my_first.x',{p:MN(.85*price(s))}),
 opts:s=>{const P=.85*price(s),liq=liquid(s);return[
  Q(ek('my_first'),'buy',{d:upFront(P,.1,.01),m:yrPay(P,.1,.03,35)},s=>buyAt(s,P,{dp:.1,fee:.01,r:.03,n:35,lk:'trk.flat'}),liq>=.11*P||M('e.home.need',{n:MN(.11*P),h:MN(liq)})),
  Q(ek('my_first'),'wait',{},s=>{})]}}),
/* SSPN: the national education savings scheme paid 4.05% for 2024, the highest in a decade (PTPTN via Bernama); up to RM8,000
   a year of net savings is tax-deductible (RinggitPlus; extended to YA2027 in Budget 2025, Deloitte). After inflation about 2%;
   the tax saving (about 5% of what you put in) is an ESTIMATE. */
CE('MY',{id:'my_sspn',win:[26,48],p:.75,def:'none',when:s=>hasKid(s,0,8),
 opts:s=>{const a=.04*s.base;return[
  Q(ek('my_sspn'),'save',{a:MN(a)},s=>yearly(s,'sspn',{amt:a,until:s.age+15,bonus:.05},{rate:.02},'trk.sspn')),
  Q(ek('my_sspn'),'none',{},s=>{})]}}),

/* ===================== Singapore (SG) ===================== */
/* National Service: two years full-time for male citizens from 18. A recruit's allowance is $790 a month from 1 July 2025,
   up from $755, rising with rank (MINDEF fact sheet, 3 Mar 2025). About $900 a month on average × 12 ÷ the game's typical
   wage ($26,100) ≈ 0.4. NS years work as in engine.js (s.nsUntil): an allowance, no career progress, a degree waits. */
CE('SG',{id:'sg_ns',win:[18,18],def:'spend',when:s=>s.sex==='m'&&!s.nsUntil,
 opts:s=>{const B=s.base,ns=(c,h)=>s=>{s.nsUntil=s.age+2;s.nsPay=.4;s.nsCost=c;s.happy+=h;T(s,'ns',{kind:'custom',label:M('trk.ns'),paid:0,note:M('note.ns',{a:MN(0)})})};return[
  Q(ek('sg_ns'),'save',{a:MN(.25*B)},ns(.15,-1)),
  Q(ek('sg_ns'),'spend',{},ns(.32,2)),
  Q(ek('sg_ns'),'course',{a:MN(.1*B)},s=>{ns(.25,-2)(s);spend(s,'nsCourse',.1*B,'trk.nsCourse');addSkill(s,'ns',3*learnLuck(s,'ns'),M('trk.nsCourse'))},undefined,true)]}}),
/* BTO flats: a 4-room BTO flat in Hougang launched in Feb 2024 from $371,000, against a median $563,500 for 4-room resale flats
   there (Stacked Homes, 2024): BTO ≈ 0.66 of resale. An HDB loan charges 2.6% (0.1 point above the CPF Ordinary Account rate,
   HDB): about 1% after inflation. Ballot chances (6 in 10 a try, up to 3 tries) are a game rule. */
CE('SG',{id:'sg_bto',win:[25,38],p:.9,def:'rent',when:s=>!s.house&&!(s.hWait>s.age)&&job(s)&&(!!s.pt&&s.pt.st!=='date'||s.age>=35),
 text:s=>M('e.sg_bto.x',{p:MN(.66*price(s)),q:MN(price(s))}),
 opts:s=>{const P=price(s),liq=liquid(s);return[
  Q(ek('sg_bto'),'bto',{},s=>{s.hWait=s.age+9;later(s,s.age+1,'bto',{n:1,p:.6})},undefined,true),
  Q(ek('sg_bto'),'resale',{d:upFront(P,.2,.03),m:yrPay(P,.2,.01,25)},s=>buyAt(s,P,{dp:.2,fee:.03,r:.01,n:25,lk:'trk.resale',fixed:true}),liq>=.23*P||M('e.home.need',{n:MN(.23*P),h:MN(liq)})),
  Q(ek('sg_bto'),'rent',{},s=>{})]}}),
/* COE: small-car (Category A) COEs closed between $85,000 and $128,105 at 2025 first-round biddings (LTA results via
   motorist.sg); a COE lasts ten years. Car loans are capped at 60–70% of the price and 7 years (MAS). A small car with COE at
   about $170,000 ≈ 6.5 years of the game's typical wage; running costs (parking, road tax, insurance, petrol) are ESTIMATES. */
CE('SG',{id:'sg_coe',win:[25,32],p:.9,def:'none',when:s=>!s.car&&!s.retired,
 opts:s=>{const B=s.base,P=6.5*B,d=.35*P,l=P-d;return[
  Q(ek('sg_coe'),'buy',{c:MN(P),d:MN(d),p:MN(amort(l,.03,7)),r:MN(.3*B)},s=>{s.car={type:'new',bal:l,pay:amort(l,.03,7),trk:'sg_coe'};const t=T(s,'sg_coe',{kind:'ghost',label:M('trk.sg_coe')});pay(s,d);t.spent+=d;t.g+=d;
   rec(s,'sg_coe',.3*B,10);later(s,s.age+10,'coeEnd',{});s.happy+=4},liquid(s)>=d||M('e.home.need',{n:MN(d),h:MN(liquid(s))})),
  Q(ek('sg_coe'),'share',{a:MN(.04*B)},s=>{T(s,'sg_share',{kind:'ghost',label:M('trk.sg_share')});rec(s,'sg_share',.04*B,10);s.happy+=1}),
  Q(ek('sg_coe'),'none',{},s=>{})]}}),
/* CPF top-ups for loved ones: up to $8,000 a year of tax relief on cash top-ups to parents' retirement savings (CPF Board FAQ,
   Retirement Sum Topping-Up Scheme); $8,000 ÷ $26,100 ≈ 0.3. The tax saved (about 7% at a middle income) is an ESTIMATE. */
CE('SG',{id:'sg_rstu',win:[30,55],p:.6,def:'no',when:job,
 opts:s=>{const B=s.base,go=a=>s=>{pay(s,a);const t=T(s,'sg_rstu',{kind:'custom',label:M('trk.sg_rstu')});t.v-=a;t.note=M('note.paid',{a:MN(a)});later(s,s.age+1,'refund',{id:'sg_rstu',a:.07*a});s.happy+=2};return[
  QR(ek('sg_rstu'),'full',{a:MN(.3*B),b:MN(.021*B)},5,go(.3*B)),
  QR(ek('sg_rstu'),'half',{a:MN(.15*B),b:MN(.0105*B)},3,go(.15*B)),
  QR(ek('sg_rstu'),'no',{},0,null)]}}),
/* CPF at 55: the Retirement Account is formed; the Full Retirement Sum for those turning 55 in 2025 is $213,000 (CPF via
   Beansprout and StashAway); savings above it can be withdrawn, or topped up towards the Enhanced Retirement Sum for higher
   CPF LIFE payouts from 65. Retirement Account savings earn at least 4% (CPF Board): about 2% after inflation. */
CE('SG',{id:'sg_cpf55',win:[55,56],p:.9,def:'leave',when:s=>!!s.lots.cpf&&s.lots.cpf.v>.5*s.base,
 text:s=>M('e.sg_cpf55.x',{a:MN(s.lots.cpf.v)}),
 opts:s=>{const x=.4*s.lots.cpf.v,a=.3*liquid(s);return[
  Q(ek('sg_cpf55'),'out',{a:MN(x)},s=>{const l=s.lots.cpf,y=Math.min(x,l.v);l.v-=y;l.tout+=y;s.cash+=y;s.happy+=2}),
  Q(ek('sg_cpf55'),'leave',{},s=>{}),
  Q(ek('sg_cpf55'),'ers',{a:MN(a)},s=>putIn(s,'cpfers',a,{rate:.02,lock:65},'trk.cpfers'),a>.05*s.base||M('e.sg_cpf55.no'))]}}),
/* Singapore Savings Bonds: government-backed, step-up interest, redeemable any month without penalty; 10-year average returns of
   1.83–2.69% across 2025 issues (MAS via Beansprout). After about 2% inflation, near 0.3%. */
CE('SG',{id:'sg_ssb',win:[22,60],p:.6,def:'keep',when:s=>liquid(s)>.3*s.base,
 text:s=>M('e.sg_ssb.x',{a:MN(.3*liquid(s))}),
 opts:s=>{const a=.3*liquid(s);return[
  Q(ek('sg_ssb'),'ssb',{a:MN(a)},s=>putIn(s,'ssb',a,{rate:.003},'trk.ssb')),
  Q(ek('sg_ssb'),'sti',{a:MN(a)},s=>putIn(s,'pick',a,{},'trk.pick')),
  Q(ek('sg_ssb'),'keep',{},s=>{})]}}),
/* Baby Bonus and CDA: for children born from 18 Feb 2025, a $5,000 CDA First Step Grant and dollar-for-dollar government matching up
   to $4,000 for a first child; a Baby Bonus Cash Gift of $11,000 for a first or second child, paid over 6.5 years (MSF Baby
   Bonus page; UOB). $5,000 ≈ 0.19, $4,000 ≈ 0.15, $11,000 ≈ 0.42 of the game's typical wage. */
CE('SG',{id:'sg_cda',win:[20,55],p:.95,def:'some',when:s=>hasKid(s,0,1),
 opts:s=>{const B=s.base,g=.61*B,go=d=>s=>{const t=T(s,'sg_cda',{kind:'custom',label:M('trk.sg_cda')});pay(s,d);s.cash+=g+2*d;t.v+=g+d;t.note=M('note.sg_cda',{a:MN(g+d)})};return[
  Q(ek('sg_cda'),'max',{a:MN(.15*B)},go(.15*B)),
  Q(ek('sg_cda'),'some',{a:MN(.04*B)},go(.04*B)),
  Q(ek('sg_cda'),'none',{b:MN(g)},go(0))]}}),
/* PSLE: taken in Primary 6; its score sets the secondary school choices (MOE). Tuition fees are an ESTIMATE; whether tuition
   wins a bursary later is a game rule. */
CE('SG',{id:'sg_psle',win:[30,62],p:.7,def:'class',when:s=>hasKid(s,9,11),
 opts:s=>{const a=.08*s.base;return[
  Q(ek('sg_psle'),'class',{a:MN(a)},s=>{T(s,'sg_psle',{kind:'ghost',label:M('trk.tuition')});rec(s,'sg_psle',a,3);s.happy-=1;kidWin(s,.3,.6)},undefined,true),
  QR(ek('sg_psle'),'home',{},2,s=>{s.happy-=2;kidWin(s,.2,.7)},undefined,true),
  Q(ek('sg_psle'),'none',{},s=>{s.happy+=1;kidWin(s,.12,.8)},undefined,true)]}}),

/* ===================== China (CN) ===================== */
/* Gaokao: 13.35 million registered in 2025 (Ministry of Education via Xinhua and The Paper). Extra-class costs are an ESTIMATE;
   a poorer family borrows and you help repay it (famCost). */
CE('CN',{id:'cn_gaokao',win:[17,17],def:'steady',
 opts:s=>[
  Q(ek('cn_gaokao'),'cram',{a:MN(.25*s.base)},s=>{addSkill(s,'school',6*learnLuck(s,'gk'),M('trk.school'));s.happy-=5;s.health-=2;famCost(s,'cn_gaokao',.25)},s.fam==='poor'?M('e.cn_gaokao.no'):true,true),
  Q(ek('cn_gaokao'),'steady',{},s=>{addSkill(s,'school',4*learnLuck(s,'gk'),M('trk.school'));s.happy-=1},undefined,true),
  Q(ek('cn_gaokao'),'easy',{},s=>{addSkill(s,'school',1.5,M('trk.school'));s.happy+=2},undefined,true)]}),
/* Hukou and the big cities: since 2019 cities with 1–3 million urban residents were told to lift hukou limits (NDRC, Key Tasks
   for New Urbanisation 2019); first-tier cities still tie home buying and school places to local hukou or years of social
   insurance. Pay and cost multiples are ESTIMATES from the gap in typical wages and rents. */
CE('CN',{id:'cn_city',win:[22,28],p:.7,def:'stay',when:ctrWhen,
 text:s=>M('e.cn_city.x',{a:MN(1.45*salary(s))}),
 opts:s=>{const sal=salary(s);return[
  Q(ek('cn_city'),'go',{a:MN(1.45*sal)},s=>cityMove(s,'cn_city',1.45,1.45,1.6,-4),undefined,true),
  Q(ek('cn_city'),'mid',{a:MN(1.2*sal)},s=>cityMove(s,'cn_city',1.2,1.12,1.1,-2)),
  Q(ek('cn_city'),'stay',{},s=>{})]}}),
/* 996: China's labour law limits work to 44 hours a week on average, with at most 36 hours of overtime a month; in Aug 2021 the
   Supreme People's Court and the Ministry of Human Resources and Social Security said 996 schedules break the law (Sixth Tone;
   Quartz). Pay, promotion and health effects are game rules. */
CE('CN',{id:'cn_996',win:[23,40],p:.6,def:'go',when:s=>job(s)&&['office','hands'].includes(CAR[s.job.id].f),
 opts:s=>[
  QR(ek('cn_996'),'go',{},-4,s=>{tmpPay(s,'cn_996',1.1,5,'trk.cn_996');rec(s,'',0,5,-1.5);s.grindY+=3;s.ppM=(s.ppM||1)*1.25;s.happy-=3},undefined,true),
  Q(ek('cn_996'),'line',{},s=>{s.ppM=(s.ppM||1)*.85;s.happy+=1},undefined,true),
  Q(ek('cn_996'),'move',{},s=>{bump(s,'cn_996m',.92,M('trk.cn_996m'));s.happy+=3})]}),
/* Buying a flat: housing provident fund loans for a first home cost 2.6% from 8 May 2025 (PBoC, via The Paper and Beijing
   News); CPI inflation near 0.5% leaves about 2% real. New-home prices in 70 cities fell for 32 months in a row to Feb 2026
   (NBS via Trading Economics). Parents' help ("six wallets") by family background and the price path ahead are ESTIMATES. */
CE('CN',{id:'cn_house',win:[26,34],p:.75,def:'rent',when:s=>!s.house&&job(s)&&!(s.hWait>s.age),
 text:s=>M('e.cn_house.x',{p:MN(price(s))}),
 opts:s=>{const P=price(s),g=byFam(s,{poor:0,working:.08,middle:.15,rich:.3})*P,liq=liquid(s),drift=s=>later(s,s.age+3,'hmove',{m:inR(evR(s,'cnhm')(),[.82,1.05])});return[
  QR(ek('cn_house'),'family',{g:MN(g),d:MN(.32*P-g),l:MN(.7*P)},2,s=>{s.cash+=g;const t=T(s,'cn_gift',{kind:'custom',label:M('trk.cn_gift'),v:g,note:M('note.got',{a:MN(g)})});buyAt(s,P,{dp:.3,fee:.02,r:.02,n:30});drift(s)},
   g<=0?M('e.cn_house.no'):liq+g>=.32*P||M('e.home.need',{n:MN(.32*P-g),h:MN(liq)})),
  Q(ek('cn_house'),'small',{d:upFront(.55*P,.3,.02),m:yrPay(.55*P,.3,.02)},s=>{buyAt(s,.55*P,{dp:.3,fee:.02,r:.02,n:30,lk:'trk.flat'});drift(s)},liq>=.18*P||M('e.home.need',{n:MN(.18*P),h:MN(liq)})),
  Q(ek('cn_house'),'rent',{},s=>{})]}}),
/* The civil service exam: about 3.7 million people sat the national exam in late 2025 for 38,100 posts; the age limit rose from 35
   to 38 (China Daily HK, 1 Dec 2025; Xinhua via The Tribune; Caixin, 15 Oct 2025). The chance to pass is a game rule. */
CE('CN',{id:'cn_kaogong',win:[22,36],p:.6,def:'no',when:s=>job(s)&&s.job.id!=='civ'&&s.age<=38,opts:examOpts('cn_kaogong',.03)}),
/* Personal pension: up to ¥12,000 a year deductible from taxable income, gains untaxed, 3% tax when you draw it; nationwide
   from 2024 (Ministry of Finance and State Taxation Administration notice No. 21 of 2024, via cs.com.cn). ¥12,000 ÷ the game's
   typical wage (¥41,700) ≈ 0.29. The net tax saving (about 7% of what you put in) is an ESTIMATE. */
CE('CN',{id:'cn_pension',win:[25,45],p:.6,def:'no',when:job,
 opts:s=>{const B=s.base;return[
  Q(ek('cn_pension'),'max',{a:MN(.29*B),b:MN(.02*B)},s=>yearly(s,'cnpen',{amt:.29*B,until:60,bonus:.07},{lock:60},'trk.cnpen')),
  Q(ek('cn_pension'),'half',{a:MN(.14*B),b:MN(.01*B)},s=>yearly(s,'cnpen',{amt:.14*B,until:60,bonus:.07},{lock:60},'trk.cnpen')),
  Q(ek('cn_pension'),'no',{},s=>{})]}}),
/* Residents' medical insurance: ¥400 a person for 2025 in most places, plus ¥670 of government money (Sichuan and national
   notices, via The Paper and the Sichuan news site): ¥400 ÷ ¥41,700 ≈ 0.01. The share of bills it pays (about half overall)
   is an ESTIMATE. */
CE('CN',{id:'cn_yibao',win:[22,60],p:.8,def:'join',when:s=>selfEmp(s)&&!s.medCut,
 opts:s=>[Q(ek('cn_yibao'),'join',{a:MN(.01*s.base)},s=>medPlan(s,'cn_yibao',.5,.01*s.base),undefined,true),Q(ek('cn_yibao'),'skip',{},s=>{})]}),
/* Retirement age: from 1 Jan 2025 China raises retirement ages over 15 years (men 60 → 63; women 50 → 55 and 55 → 58), allows
   flexible claiming up to three years early or late, and raises minimum contribution years from 15 to 20 from 2030 (NPC Standing
   Committee decision, Sep 2024). How much an earlier or later claim changes the pension is an ESTIMATE (about 5% a year). */
CE('CN',{id:'cn_tuixiu',win:[57,60],p:.9,def:'std',
 opts:s=>{const a=s.sex==='f'?58:63;return[[a-3,.85],[a,1],[a+3,1.15]].map(([at,m],i)=>Q(ek('cn_tuixiu'),['early','std','late'][i],{a:MN(.18*s.base*m),n:at},s=>penClaim(s,at,m,'cn_tuixiu')))}}),

/* ===================== Japan (JP) ===================== */
/* Shūkatsu: firms hire new graduates together each April after job-hunting in the third and fourth years (Keidanren and
   government schedule guidelines). Large firms' layoff rarity, seniority pay and costs are game rules and ESTIMATES. */
CE('JP',{id:'jp_shukatsu',win:[20,23],p:1,def:'big',when:s=>!!s.study&&s.study.k==='uni'&&s.study.end-s.age===1,
 opts:s=>{const B=s.base;return[
  Q(ek('jp_shukatsu'),'big',{a:MN(.04*B)},s=>{spend(s,'jp_shukatsu',.04*B,'trk.jp_shukatsu');s.happy-=3;s.layM=.35;s.ppM=(s.ppM||1)*.8;bump(s,'jp_big',1.06,M('trk.jp_big'))},undefined,true),
  Q(ek('jp_shukatsu'),'small',{a:MN(.015*B)},s=>spend(s,'jp_shukatsu',.015*B,'trk.jp_shukatsu'),undefined,true),
  Q(ek('jp_shukatsu'),'gap',{a:MN(.3*B)},s=>{spend(s,'jp_gap',.3*B,'trk.jp_gap');s.happy+=5;addSkill(s,'gap',2,M('trk.jp_gap'));s.layM=1.15;s.jobAt=s.study.end+1},undefined,true)]}}),
/* Overtime: since 2019 capped at 45 hours a month and 360 a year (720 with special agreements); 80 hours a month is the
   government's overwork-illness line; overtime pays at least 25% extra (MHLW, Work Style Reform). Effects are game rules. */
CE('JP',{id:'jp_overtime',win:[24,45],p:.6,def:'stay',when:s=>job(s)&&CAR[s.job.id].f==='office',
 opts:s=>[
  QR(ek('jp_overtime'),'stay',{},-3,s=>{tmpPay(s,'jp_overtime',1.15,5,'trk.jp_overtime');rec(s,'',0,5,-1.5);s.grindY+=3;s.happy-=3},undefined,true),
  Q(ek('jp_overtime'),'cap',{},s=>{s.ppM=(s.ppM||1)*.9;s.happy+=1},undefined,true),
  Q(ek('jp_overtime'),'move',{},s=>{bump(s,'jp_calm',.97,M('trk.jp_calm'));s.happy+=3})]}),
/* New NISA (from 2024): up to ¥3.6 million a year and ¥18 million in a lifetime, tax-free (FSA, via Daiwa and Rakuten Securities).
   iDeCo is locked until 60 and contributions are deductible; the tax saving (about 15% with resident tax) is an ESTIMATE. */
CE('JP',{id:'jp_nisa',win:[22,45],p:.75,def:'bank',when:job,
 opts:s=>{const a=.1*s.base;return[
  Q(ek('jp_nisa'),'nisa',{a:MN(a)},s=>yearly(s,'nisa',{amt:a,until:s.age+25},{},'trk.nisa')),
  Q(ek('jp_nisa'),'ideco',{a:MN(a),b:MN(.15*a)},s=>yearly(s,'ideco',{amt:a,until:60,bonus:.15},{lock:60},'trk.ideco')),
  Q(ek('jp_nisa'),'bank',{},s=>{})]}}),
/* Furusato nōzei: donations to towns come off income and resident tax except ¥2,000, within a limit; return gifts are capped at
   30% of the donation (Ministry of Internal Affairs rules since June 2019). A ¥120,000 donation ≈ 0.05 of the game's typical
   wage (¥2.47 million), so gifts ≈ 0.014 a year after the ¥2,000. */
CE('JP',{id:'jp_furusato',win:[26,62],p:.6,def:'skip',when:job,
 opts:s=>{const B=s.base;return[
  Q(ek('jp_furusato'),'yearly',{a:MN(.05*B),b:MN(.015*B)},s=>{T(s,'jp_furusato',{kind:'custom',label:M('trk.jp_furusato')});rec(s,'jp_furusato',-.014*B,15);s.happy+=1}),
  Q(ek('jp_furusato'),'once',{a:MN(.05*B),b:MN(.015*B)},s=>{s.cash+=.014*B;s.happy+=1}),
  Q(ek('jp_furusato'),'skip',{},s=>{})]}}),
/* Family care: care leave of up to 93 days per family member at 67% of pay from employment insurance (MHLW); long-term care
   insurance users pay 10–30%; about 104,000 people left work to give care in FY2023 (MHLW, reported via financial-field.com).
   Service and care-home costs are ESTIMATES. */
CE('JP',{id:'jp_kaigo',win:[45,62],p:.55,def:'leave',
 opts:s=>{const B=s.base;return[
  QR(ek('jp_kaigo'),'leave',{a:MN(.04*B)},4,s=>{if(job(s))tmpPay(s,'jp_kaigoL',.92,1,'trk.jp_kaigoL');T(s,'jp_kaigo',{kind:'custom',label:M('trk.jp_kaigo')});rec(s,'jp_kaigo',.04*B,6)}),
  QR(ek('jp_kaigo'),'quit',{},7,s=>{endCareer(s,'quit',s.age-1);s.jobAt=s.age+3;s.happy-=3;T(s,'jp_kaigo',{kind:'custom',label:M('trk.jp_kaigo')});rec(s,'jp_kaigo',.01*B,3)},job(s)||M('e.jp_kaigo.nojob')),
  QR(ek('jp_kaigo'),'home',{a:MN(.15*B)},1,s=>{T(s,'jp_kaigo',{kind:'custom',label:M('trk.jp_kaigoH')});rec(s,'jp_kaigo',.15*B,5)})]}}),
/* Akiya: 9.0 million empty homes in Oct 2023, 13.8% of all homes (Housing and Land Survey 2023, via Jiji); since 27 Apr 2023 inherited
   land can be handed to the state for a fee of usually ¥200,000 (≈ 0.08), the building torn down first (Ministry of Justice).
   Upkeep, demolition and sale prices are ESTIMATES. */
CE('JP',{id:'jp_akiya',win:[50,74],p:.5,def:'keep',
 opts:s=>{const B=s.base;return[
  Q(ek('jp_akiya'),'keep',{a:MN(.05*B)},s=>{T(s,'jp_akiya',{kind:'custom',label:M('trk.jp_akiya')});rec(s,'jp_akiya',.05*B,15);s.happy+=1;later(s,s.age+2+Math.floor(evR(s,'akiyaAt')()*8),'akiya',{})}),
  Q(ek('jp_akiya'),'sell',{},s=>{const v=inR(evR(s,'akiyaSell')(),[0,.6])*B;s.cash+=v;const t=T(s,'jp_akiya',{kind:'custom',label:M('trk.jp_akiyaS'),v});t.note=M('note.got',{a:MN(v)})},undefined,true),
  Q(ek('jp_akiya'),'state',{a:MN(.5*B),b:MN(.08*B)},s=>{const c=.58*B;pay(s,c);const t=T(s,'jp_akiya',{kind:'custom',label:M('trk.jp_akiyaG'),v:-c});t.note=M('note.paid',{a:MN(c)})})]}}),
/* Pension timing: claim from 60 to 75; each month early cuts 0.4% (−24% at 60), each month late adds 0.7% (+42% at 70, +84% at 75),
   for those born from 2 Apr 1962 (Japan Pension Service rules since April 2022, via President Online and Daiwa Institute). */
CE('JP',{id:'jp_nenkin',win:[59,60],p:1,def:'65',opts:penOpts('jp_nenkin',[[60,.76],[65,1],[70,1.42],[75,1.84]])}),
/* Earthquake insurance: government-backed, up to 50% of the fire-insurance amount; 69.4% of fire policies included it in FY2022
   (General Insurance Rating Organization of Japan, via financial-field.com). Premiums and quake odds are ESTIMATES. */
CE('JP',{id:'jp_quake',win:[32,70],p:.6,def:'skip',when:s=>!!s.house,
 opts:s=>{const q=(ins)=>s=>later(s,s.age+1+Math.floor(evR(s,'quakeAt')()*20),'quake',{ins});return[
  Q(ek('jp_quake'),'add',{a:MN(.007*s.base)},s=>{T(s,'jp_quakeI',{kind:'custom',label:M('trk.jp_quakeI')});rec(s,'jp_quakeI',.007*s.base,20);q(1)(s)},undefined,true),
  Q(ek('jp_quake'),'skip',{},q(0),undefined,true)]}}),

/* ===================== United States (US) ===================== */
/* Student loans: from 1 July 2026 the Repayment Assistance Plan charges a share of income (from a $10 minimum up to 10% of AGI),
   waives unpaid interest and forgives the rest after 30 years; Public Service Loan Forgiveness clears the balance after 10 years
   of payments in public or non-profit work (One Big Beautiful Bill Act 2025; NerdWallet; NYC DCWP). A share of about 5% of pay
   above a small allowance is an ESTIMATE for a typical borrower. */
CE('US',{id:'us_rap',win:[21,27],p:1,def:'std',when:s=>s.sloan>.3*s.base&&!s.study&&!s.sloanInc,
 text:s=>M('e.us_rap.x',{a:MN(s.sloan)}),
 opts:s=>[Q(ek('us_rap'),'std',{a:MN(s.sloanPay||slPay(s))},s=>{}),
  Q(ek('us_rap'),'rap',{a:MN(.05*Math.max(0,salary(s)-.2*s.base))},s=>{s.sloanInc={r:.05,th:.2,end:s.age+30,pslf:s.age+10,waive:1}})]}),
/* Cashing out a 401(k): before 59½ a 10% additional tax on top of income tax (IRS); 41.4% of workers leaving a job withdraw money
   (UBC Sauder study of 162,000 US job changers, via Financial Planning). A 22% income-tax bracket is an ESTIMATE. */
CE('US',{id:'us_401k',win:[25,52],p:.65,def:'roll',when:s=>!!s.lots.k401&&s.lots.k401.v>.3*s.base&&(s.carN||0)>=2,
 text:s=>M('e.us_401k.x',{a:MN(s.lots.k401.v)}),
 opts:s=>{const v=s.lots.k401.v,out=f=>s=>{const l=s.lots.k401,x=l.v*f;l.v-=x;l.tout+=x;s.cash+=.68*x;s.happy+=f>.6?3:1;const t=T(s,'us_401k',{kind:'custom',label:M('trk.us_401k')});t.v-=.32*x;t.note=M('note.us_401k',{a:MN(.32*x)})};return[
  Q(ek('us_401k'),'roll',{},s=>{}),
  Q(ek('us_401k'),'cash',{a:MN(.68*v)},out(1)),
  Q(ek('us_401k'),'half',{a:MN(.34*v)},out(.5))]}}),
/* Medical bills: non-profit hospitals must have a written financial assistance policy and limit charges to eligible patients
   (IRS, section 501(r)); about 6% of adults owe over $1,000 in medical debt (KFF, Feb 2024). Bill size and the chance of a cut
   are ESTIMATES. */
CE('US',{id:'us_medbill',win:[24,70],p:.6,def:'pay',
 text:s=>M('e.us_medbill.x',{a:MN((s.insured?.07:.3)*s.base*(s.medCut||1))}),
 opts:s=>{const a=(s.insured?.07:.3)*s.base*(s.medCut||1),line=()=>T(s,'us_medbill',{kind:'custom',label:M('trk.us_medbill')});return[
  Q(ek('us_medbill'),'fight',{},s=>{const r=evR(s,'medFight'),cut=r()<.55?inR(r(),[.3,.8]):0,y=a*(1-cut);pay(s,y);s.happy-=1;const t=line();t.v-=y;t.note=M('note.us_medbill',{a:MN(a),b:MN(y)})},undefined,true),
  Q(ek('us_medbill'),'plan',{a:MN(a/3)},s=>{const t=line();rec(s,'us_medbill',a/3,3)}),
  Q(ek('us_medbill'),'pay',{a:MN(a)},s=>{pay(s,a);const t=line();t.v-=a;t.note=M('note.paid',{a:MN(a)})})]}}),
/* Credit scores and mortgages: in Nov 2025 a $300,000 30-year loan was offered at about 6.57% APR for scores of 760+ and 7.34% for
   620–639 (myFICO data via ConsumerAffairs). The rate changes in the game (−0.3 / +0.4 points) are ESTIMATES. */
CE('US',{id:'us_credit',win:[19,26],p:.75,def:'none',
 opts:s=>[Q(ek('us_credit'),'build',{},s=>{s.rateAdj=-.003},undefined,true),Q(ek('us_credit'),'none',{},s=>{s.rateAdj=.004},undefined,true)]}),
/* Social Security: claiming at 62 pays about 70% of the full benefit for those with a full retirement age of 67 (born 1960 or
   later); each year of delay past 67 adds 8%, to 124% at 70 (SSA, as summarised by Fox and The Motley Fool). */
CE('US',{id:'us_ss',win:[61,62],p:1,def:'67',opts:penOpts('us_ss',[[62,.7],[67,1],[70,1.24]])}),
/* Childcare: the national average price was $13,128 a year in 2024, up from $11,582 in 2023 (Child Care Aware of America, May 2025).
   The game already counts a child's basic costs, so the card adds the part above them (about 0.25 of a typical wage): an ESTIMATE. */
CE('US',{id:'us_daycare',win:[22,45],p:.8,def:'daycare',when:s=>hasKid(s,0,1)&&job(s),
 opts:s=>{const B=s.base;return[
  Q(ek('us_daycare'),'daycare',{a:MN(.25*B)},s=>{T(s,'us_daycare',{kind:'custom',label:M('trk.daycare')});rec(s,'us_daycare',.25*B,4)}),
  QR(ek('us_daycare'),'part',{},2,s=>{tmpPay(s,'us_part',.55,4,'trk.parttime');s.happy+=2}),
  QR(ek('us_daycare'),'family',{a:MN(.04*B)},3,s=>{T(s,'us_daycare',{kind:'custom',label:M('trk.daycareF')});rec(s,'us_daycare',.04*B,4);s.happy-=1})]}}),
/* FHA loans: 3.5% down with a credit score of 580+, an upfront mortgage insurance premium of 1.75% of the loan and an annual
   premium of 0.55% for the loan's life with under 10% down (HUD Mortgagee Letter 2023-05; Quicken Loans). */
CE('US',{id:'us_fha',win:[25,36],p:.6,def:'wait',when:s=>!s.house&&job(s)&&liquid(s)<.23*price(s)&&!(s.hWait>s.age),
 text:s=>M('e.us_fha.x',{p:MN(.8*price(s))}),
 opts:s=>{const P=.8*price(s),r=.0355+(s.rateAdj||0),liq=liquid(s);return[
  Q(ek('us_fha'),'fha',{d:upFront(P,.035,.0475),m:yrPay(P,.035,r)},s=>buyAt(s,P,{dp:.035,fee:.0475,r:.0355,n:30,lk:'trk.flat'}),liq>=.083*P||M('e.home.need',{n:MN(.083*P),h:MN(liq)})),
  Q(ek('us_fha'),'wait',{},s=>{})]}}),
/* Health Savings Account: with a high-deductible plan, contributions are deductible and growth and medical withdrawals are
   tax-free (IRS Publication 969). The tax saving (about 25%) and the higher share of each bill you pay are ESTIMATES. */
CE('US',{id:'us_hsa',win:[25,45],p:.5,def:'ppo',when:s=>job(s)&&!s.medCut,
 opts:s=>{const a=.08*s.base;return[Q(ek('us_hsa'),'hsa',{a:MN(a)},s=>{yearly(s,'hsa',{amt:a,until:65,bonus:.25},{},'trk.hsa');s.medCut=1.15}),Q(ek('us_hsa'),'ppo',{},s=>{})]}}),

/* ===================== United Kingdom (GB) ===================== */
/* Plan 5 student loans (England, from Aug 2023): 9% of income above £25,000, interest at RPI, written off after 40 years
   (GOV.UK, as summarised by Whitings LLP and uktax.tools). £25,000 in game money (÷ 0.633, PPP) ≈ 1.41 typical wages. */
CE('GB',{id:'gb_sloan',win:[21,25],p:1,def:'pay',when:s=>s.sloan>.2*s.base&&!s.study&&!s.sloanInc,
 text:s=>M('e.gb_sloan.x',{a:MN(s.sloan)}),
 opts:s=>[Q(ek('gb_sloan'),'pay',{a:MN(.09*Math.max(0,salary(s)-1.41*s.base))},s=>{s.sloanR=0;s.sloanInc={r:.09,th:1.41,end:s.age+40}}),
  Q(ek('gb_sloan'),'over',{a:MN(amort(s.sloan,1e-6,10))},s=>{s.sloanR=0;s.sloanN=10;s.sloanPay=slPay(s)})]}),
/* Lifetime ISA: open from 18 to 39, save up to £4,000 a year with a 25% government bonus (max £1,000); for a first home up to
   £450,000 or after 60, otherwise a 25% withdrawal charge (GOV.UK; MoneyHelper). */
CE('GB',{id:'gb_lisa',win:[18,39],p:.7,def:'none',when:s=>!s.house,
 opts:s=>{const a=.1*s.base;return[
  Q(ek('gb_lisa'),'lisa',{a:MN(a),b:MN(.25*a)},s=>yearly(s,'lisa',{amt:a,until:50,bonus:.25},{lock:60},'trk.lisa')),
  Q(ek('gb_lisa'),'isa',{a:MN(a)},s=>yearly(s,'isa',{amt:a,until:s.age+30},{},'trk.isa')),
  Q(ek('gb_lisa'),'none',{},s=>{})]}}),
/* Workplace pension: automatic enrolment with a minimum of 8% of qualifying earnings, at least 3% from the employer (The
   Pensions Regulator); normal minimum pension age 57 from 2028 (HMRC). */
CE('GB',{id:'gb_pension',win:[22,30],p:.9,def:'stay',when:job,
 opts:s=>{const w=salary(s);return[
  Q(ek('gb_pension'),'stay',{a:MN(.05*w),b:MN(.03*w)},s=>yearly(s,'wpen',{p:.05,until:67,bonus:.6},{lock:57},'trk.wpen')),
  Q(ek('gb_pension'),'more',{a:MN(.1*w),b:MN(.03*w)},s=>yearly(s,'wpen',{p:.1,until:67,bonus:.3},{lock:57},'trk.wpen')),
  Q(ek('gb_pension'),'out',{a:MN(.05*w)},s=>{})]}}),
/* NHS waits: 7.41 million waiting pathways in August 2025, with 61% waiting under 18 weeks (NHS England RTT statistics, via
   Health Care and Protection). A private knee replacement at about £13,500 ≈ 0.76 of the game's typical wage: an ESTIMATE. */
CE('GB',{id:'gb_nhs',win:[45,64],p:.55,def:'wait',
 opts:s=>{const c=.76*s.base*(s.insured?.15:1);return[
  Q(ek('gb_nhs'),'wait',{},s=>{rec(s,'',0,2,-2);s.happy-=4;if(job(s))tmpPay(s,'gb_nhsW',.95,1,'trk.gb_nhsW')},undefined,true),
  Q(ek('gb_nhs'),'private',{a:MN(c),ins:s.insured?M('e.health2.ins'):''},s=>{spend(s,'gb_nhs',c,'trk.gb_nhs');s.health+=1;s.happy+=1})]}}),
/* Shared Ownership: buy a 10–75% share with a mortgage and pay rent (usually up to 2.75–3% of the unsold share's value a year)
   to a housing association (GOV.UK Shared Ownership). */
CE('GB',{id:'gb_shared',win:[25,40],p:.6,def:'wait',when:s=>!s.house&&job(s)&&!(s.hWait>s.age),
 text:s=>M('e.gb_shared.x',{p:MN(price(s))}),
 opts:s=>{const P=price(s),Sh=.4*P,liq=liquid(s);return[
  Q(ek('gb_shared'),'share',{d:upFront(Sh,.1,.02),m:yrPay(Sh,.1,.03),r:MN(.0165*P)},s=>{buyAt(s,Sh,{dp:.1,fee:.02,r:.03,n:30,lk:'trk.gb_shared',frac:1});T(s,'gb_soRent',{kind:'custom',label:M('trk.gb_soRent')});rec(s,'gb_soRent',.0165*P,30)},liq>=.12*Sh||M('e.home.need',{n:MN(.12*Sh),h:MN(liq)})),
  Q(ek('gb_shared'),'wait',{},s=>{})]}}),
/* Childcare in England: 30 hours a week of funded childcare in term time for working parents of children from 9 months, from
   September 2025 (Department for Education; Working Families). Costs of extra hours are ESTIMATES. */
CE('GB',{id:'gb_childcare',win:[22,45],p:.8,def:'both',when:s=>hasKid(s,0,1)&&job(s),
 opts:s=>{const B=s.base;return[
  Q(ek('gb_childcare'),'both',{a:MN(.1*B)},s=>{T(s,'gb_cc',{kind:'custom',label:M('trk.daycare')});rec(s,'gb_cc',.1*B,4)}),
  QR(ek('gb_childcare'),'part',{},2,s=>{tmpPay(s,'gb_part',.6,4,'trk.parttime');s.happy+=2}),
  QR(ek('gb_childcare'),'family',{a:MN(.03*B)},3,s=>{T(s,'gb_cc',{kind:'custom',label:M('trk.daycareF')});rec(s,'gb_cc',.03*B,4)})]}}),
/* National Insurance gaps: the full new State Pension is £230.25 a week in 2025/26 and needs 35 qualifying years; a voluntary
   Class 3 year costs £923 and adds about £342 a year (1/35 of the full rate) (Which?, 2025). In game money a year costs ≈ 0.052
   and adds ≈ 0.019 a year; three missing years. */
CE('GB',{id:'gb_ni',win:[42,60],p:.6,def:'skip',
 opts:s=>{const B=s.base;return[
  Q(ek('gb_ni'),'fill',{a:MN(.156*B),b:MN(.058*B)},s=>{pay(s,.156*B);penScheme(s,'gb_ni',0,0,.058*B,67);const t=s.trk.gb_ni;t.v-=.156*B;t.paid=.156*B}),
  Q(ek('gb_ni'),'skip',{},s=>{})]}}),
/* Premium Bonds: a 3.60% prize fund rate until April 2026, then 3.30% with odds of 23,000 to 1 per £1 bond; prizes tax-free
   (NS&I press release, Feb 2026). With UK inflation near 3.5%, about 0% in today's money; a cash ISA about 0.5%: ESTIMATES. */
CE('GB',{id:'gb_bonds',win:[22,70],p:.5,def:'keep',when:s=>liquid(s)>.3*s.base,
 text:s=>M('e.gb_bonds.x',{a:MN(.3*liquid(s))}),
 opts:s=>{const a=.3*liquid(s);return[
  Q(ek('gb_bonds'),'bonds',{a:MN(a)},s=>putIn(s,'pbond',a,{rate:0},'trk.pbond')),
  Q(ek('gb_bonds'),'cash',{a:MN(a)},s=>putIn(s,'cisa',a,{rate:.005},'trk.cisa')),
  Q(ek('gb_bonds'),'keep',{},s=>{})]}}),

/* ===================== Germany (DE) ===================== */
/* Ausbildung: the average collectively agreed training allowance was €1,133 a month in 2024 (BIBB press release, 6 Feb 2025):
   €13,600 a year ÷ 0.688 (PPP) ≈ 0.62 of the game's typical wage, paid while training (as a study with pay). Public universities
   charge no tuition. The skill gained is a game rule. Choosing it counts as a diploma, so the card at 18 is skipped. */
CE('DE',{id:'de_ausb',win:[18,18],def:'abi',when:s=>!s.done.edu,
 opts:s=>[Q(ek('de_ausb'),'ausb',{a:MN(.62*s.base)},s=>{s.done.edu='dip';const lab=M('lbl.ausb');s.study={end:s.age+3,gain:5*learnLuck(s,'ausb'),pt:.62,label:lab,k:'dip'};T(s,'sk_edu',{kind:'skill',label:lab})},undefined,true),
  Q(ek('de_ausb'),'abi',{},s=>{})]}),
/* BAföG: up to €992 a month from winter 2025/26 for students living away from home, by parents' income; half grant, half
   interest-free loan, repayment capped at €10,010 and starting five years after the funding ends, usually €130 a month
   (Studierendenwerke FAQ, Jan 2026). In game money: €992 × 12 ÷ 0.688 ≈ 0.54; the cap ≈ 0.45; €130 a month ≈ 0.07. */
CE('DE',{id:'de_bafog',win:[18,19],p:1,def:'parents',when:s=>!!s.study&&s.study.k==='uni'&&s.age<=19,
 opts:s=>{const g=byFam(s,{poor:.54,working:.38,middle:.15,rich:0})*s.base,y=Math.max(1,s.study.end-s.age);return[
  Q(ek('de_bafog'),'apply',{a:MN(g)},s=>{T(s,'de_bafog',{kind:'custom',label:M('trk.de_bafog')});rec(s,'de_bafog',-g,y);later(s,s.study.end+5,'bafog',{a:Math.min(.5*g*y,.45*s.base)})},g>0||M('e.de_bafog.no')),
  Q(ek('de_bafog'),'work',{a:MN(.3*s.base)},s=>{T(s,'de_ws',{kind:'custom',label:M('trk.de_ws')});rec(s,'de_ws',-.3*s.base,y);s.happy-=2;addSkill(s,'ws',2,M('trk.de_ws'))},undefined,true),
  QR(ek('de_bafog'),'parents',{},1,null)]}}),
/* Renting for life: 47.6% of Germans owned their home in 2023, the EU's lowest (Eurostat, via Bundestag research service WD 7-065/24);
   land transfer tax is 3.5–6.5% by state (finanz.de, 2026), plus notary, land registry and often an agent: about 11% in all. */
CE('DE',{id:'de_buy',win:[30,42],p:.65,def:'rent',when:s=>!s.house&&job(s)&&!(s.hWait>s.age),
 text:s=>M('e.de_buy.x',{p:MN(price(s))}),
 opts:s=>{const P=price(s),liq=liquid(s),a=.08*s.base;return[
  Q(ek('de_buy'),'buy',{d:upFront(P,.2,.11),m:yrPay(P,.2,.03)},s=>buyAt(s,P,{dp:.2,fee:.11,r:.03,n:30}),liq>=.31*P||M('e.home.need',{n:MN(.31*P),h:MN(liq)})),
  Q(ek('de_buy'),'etf',{a:MN(a)},s=>yearly(s,'etf',{amt:a,until:s.age+30},{},'trk.etf')),
  Q(ek('de_buy'),'rent',{},s=>{})]}}),
/* Riester: put in 4% of last year's pay to get the full state allowance of €175 a year plus €300 per child born from 2008 (§§ 84–86
   EStG). €175 ≈ 0.008 and €300 ≈ 0.014 of the game's typical wage. Fees (about 1.2% a year) are an ESTIMATE. */
CE('DE',{id:'de_riester',win:[25,40],p:.55,def:'none',when:job,
 opts:s=>{const w=Math.max(salary(s),.5*s.base),bon=(.008+.014*s.kids.length)*s.base/(.04*w);return[
  Q(ek('de_riester'),'riester',{a:MN(.04*w),b:MN((.008+.014*s.kids.length)*s.base)},s=>yearly(s,'riester',{p:.04,until:66,bonus:bon},{lock:62,fee:.012},'trk.riester')),
  Q(ek('de_riester'),'etf',{a:MN(.04*w)},s=>yearly(s,'etf2',{p:.04,until:66},{},'trk.etf')),
  Q(ek('de_riester'),'none',{},s=>{})]}}),
/* Elterngeld: about 65% of net pay (67% below €1,200), €300–1,800 a month, for up to 12 months per parent, 14 if both take part;
   Elternzeit (unpaid leave) up to three years (BEEG, via HUK and kita.de). */
CE('DE',{id:'de_eltern',win:[22,45],p:.85,def:'year',when:s=>hasKid(s,0,0)&&job(s),
 opts:s=>[
  QR(ek('de_eltern'),'year',{},3,s=>{tmpPay(s,'de_eltern',.65,1,'trk.de_eltern');s.happy+=3}),
  QR(ek('de_eltern'),'two',{},1,s=>{tmpPay(s,'de_eltern',.94,1,'trk.de_eltern');s.happy+=1}),
  QR(ek('de_eltern'),'three',{},5,s=>{const t=T(s,'de_eltern',{kind:'custom',label:M('trk.de_eltern3')});rec(s,'de_eltern',-.6*Math.max(0,salary(s)),1);s.offUntil=s.age+3;s.ppM=(s.ppM||1)*.85;s.happy+=4},undefined,true)]}),
/* Tax returns: of 14.9 million employees assessed for 2021, 86% got a refund, averaging €1,172 (Destatis, via VLH): ≈ 0.053.
   An average of about 0.045 a year after costs is an ESTIMATE. */
CE('DE',{id:'de_tax',win:[23,60],p:.6,def:'skip',when:job,
 opts:s=>{const B=s.base;return[
  Q(ek('de_tax'),'diy',{a:MN(.045*B)},s=>{T(s,'de_tax',{kind:'custom',label:M('trk.de_tax')});rec(s,'de_tax',-.045*B,25)}),
  Q(ek('de_tax'),'help',{a:MN(.035*B)},s=>{T(s,'de_tax',{kind:'custom',label:M('trk.de_tax')});rec(s,'de_tax',-.035*B,25)}),
  Q(ek('de_tax'),'skip',{},s=>{})]}}),
/* Minijob: earnings up to €556 a month in 2025, free of income tax and of the worker's social contributions (§ 8 SGB IV; the limit
   follows the minimum wage): €6,672 a year ≈ 0.3; about 0.25 after travel and time, an ESTIMATE. */
CE('DE',{id:'de_minijob',win:[20,55],p:.5,def:'no',when:job,
 opts:s=>[QR(ek('de_minijob'),'yes',{a:MN(.25*s.base)},-2,s=>{T(s,'de_mini',{kind:'custom',label:M('trk.de_mini')});rec(s,'de_mini',-.25*s.base,5,-.5);s.happy-=2},undefined,true),Q(ek('de_minijob'),'no',{},s=>{})]}),
/* Retiring: after 45 insured years, from 65 with no deduction (born 1964 or later, § 38 SGB VI); with 35 years up to four years
   before 67 with 0.3% less per month (14.4% at 63); each month after 67 adds 0.5% (§ 77 SGB VI) (Deutsche Rentenversicherung rules,
   as summarised by gegen-hartz.de). */
CE('DE',{id:'de_rente',win:[60,61],p:1,def:'67',
 opts:penOpts('de_rente',[[63,.856],[65,1,s=>(s.exp||0)>=40||M('e.de_rente.need')],[67,1],[70,1.18]])}),

/* ===================== India (IN) ===================== */
/* Coaching: in Kota, coaching and living cost about ₹1.5–3 lakh a year (Careers360; Lok Sabha answer: about ₹1.5 lakh plus
   ₹50,000 for a hostel). Two years ≈ ₹4 lakh ÷ the game's typical wage (₹92,000) ≈ 4: paid by the family (famCost). */
CE('IN',{id:'in_coach',win:[15,16],p:.75,def:'self',
 opts:s=>[
  Q(ek('in_coach'),'kota',{},s=>{addSkill(s,'school',6*learnLuck(s,'kota'),M('trk.school'));s.happy-=6;s.health-=2},s.fam==='middle'||s.fam==='rich'||M('e.in_coach.no'),true),
  Q(ek('in_coach'),'local',{a:MN(.5*s.base)},s=>{addSkill(s,'school',4*learnLuck(s,'kota'),M('trk.school'));s.happy-=2;famCost(s,'in_coach',.5)},undefined,true),
  Q(ek('in_coach'),'self',{},s=>addSkill(s,'school',2.5,M('trk.school')),undefined,true)]}),
/* PPF: 7.1% a year, tax-free, unchanged for Jul–Sep 2025; 15-year lock-in; up to ₹1.5 lakh a year (Ministry of Finance, via
   Business Standard and Motilal Oswal). With CPI near 4.5%, about 2.5% after inflation. */
CE('IN',{id:'in_ppf',win:[22,45],p:.7,def:'none',when:job,
 opts:s=>{const a=.12*s.base;return[
  Q(ek('in_ppf'),'ppf',{a:MN(a)},s=>yearly(s,'ppf',{amt:a,until:s.age+15},{rate:.025,lock:s.age+15},'trk.ppf')),
  Q(ek('in_ppf'),'sip',{a:MN(a)},s=>yearly(s,'sip',{amt:a,until:s.age+15},{},'trk.sip')),
  Q(ek('in_ppf'),'none',{},s=>{})]}}),
/* Gold: jewellery's making charges are not paid back on sale (about 10% or more: an ESTIMATE from jewellers' price lists); no new
   Sovereign Gold Bond tranche since February 2024 (Bajaj Broking, 2026). */
CE('IN',{id:'in_gold',win:[24,55],p:.6,def:'none',when:s=>liquid(s)>.25*s.base,
 opts:s=>{const a=Math.min(.2*s.base,.5*liquid(s));return[
  QR(ek('in_gold'),'jewel',{a:MN(a)},1,s=>{pay(s,a);mkLot(s,'gold',{t:'gold'},'trk.gold');addLot(s,'gold',.88*a);s.lots.gold.tin+=.12*a;s.happy+=3}),
  Q(ek('in_gold'),'etf',{a:MN(a)},s=>{pay(s,a);mkLot(s,'gold',{t:'gold'},'trk.gold');addLot(s,'gold',.995*a);s.lots.gold.tin+=.005*a}),
  Q(ek('in_gold'),'none',{},s=>{})]}}),
/* The Gulf: GCC countries sent 38% of India's remittances in 2023–24, down from 47% in 2016–17 (RBI survey, via Drishti IAS);
   registered recruiting agents may charge at most ₹30,000 (Emigration Rules, 1983): ≈ 0.33. Pay and housing multiples are ESTIMATES. */
CE('IN',{id:'in_gulf',win:[21,40],p:.45,def:'stay',when:s=>ctrWhen(s)&&['hands','office'].includes(CAR[s.job.id].f),
 text:s=>M('e.in_gulf.x',{a:MN(2.5*salary(s))}),opts:ctrOpts('in_gulf',{m:2.5,cm:.8,yrs:3,fee:.33,remit:.25})}),
/* Chit funds: the foreman's commission is capped at 5% of the chit amount (Chit Funds Act, 1982, s. 21); members bid down the pot
   at monthly auctions. The discount for an early turn, the late-turn bonus and the default risk are ESTIMATES. */
CE('IN',{id:'in_chit',win:[24,50],p:.55,def:'no',opts:roscaOpts('in_chit',{a:.2,n:2,early:.85,late:1.06,risk:.05})}),
/* Health cover: Ayushman Bharat PM-JAY gives ₹5 lakh a year of free hospital cover per family to about 55 crore people, and from
   Sep 2024 to everyone aged 70+ (PIB, Sep 2024). Private family-floater premiums (about ₹20,000 a year ≈ 0.22) and the shares of
   bills covered are ESTIMATES. */
CE('IN',{id:'in_health',win:[25,45],p:.6,def:'none',when:s=>!s.medCut,
 opts:s=>[Q(ek('in_health'),'buy',{a:MN(.22*s.base)},s=>medPlan(s,'in_health',.3,.22*s.base),undefined,true),
  Q(ek('in_health'),'pmjay',{},s=>medPlan(s,'in_health',.55,0),s.fam==='poor'||s.fam==='working'||M('e.in_health.no'),true),
  Q(ek('in_health'),'none',{},s=>{})]}),
/* Monsoon floods: the southwest monsoon (June–September) brings most of India's rain (India Meteorological Department); the
   2018 Kerala floods needed about ₹31,000 crore to rebuild (UN/World Bank Post Disaster Needs Assessment). Odds and costs are ESTIMATES. */
CE('IN',{id:'in_flood',win:[25,70],p:.5,def:'none',opts:floodOpts('in_flood',{aid:0,prem:.005,prep:.012})}),
/* School: private unaided schools must keep 25% of entry-level seats for children from weaker sections, free, by lottery (Right
   to Education Act 2009, s. 12(1)(c)). Fees and the lottery odds are ESTIMATES. */
CE('IN',{id:'in_rte',win:[27,45],p:.6,def:'govt',when:s=>hasKid(s,3,5),
 opts:s=>{const a=.12*s.base;return[
  Q(ek('in_rte'),'private',{a:MN(a)},s=>{T(s,'in_rte',{kind:'ghost',label:M('trk.schoolFees')});rec(s,'in_rte',a,12);s.happy+=1;kidWin(s,.3,.7)},undefined,true),
  Q(ek('in_rte'),'rte',{},s=>later(s,s.age,'rte',{}),s.fam==='poor'||s.fam==='working'||M('e.in_rte.no'),true),
  Q(ek('in_rte'),'govt',{},s=>kidWin(s,.15,.8),undefined,true)]}}),

/* ===================== Nigeria (NG) ===================== */
/* NYSC: a year of service after university; the allowance rose from ₦33,000 to ₦77,000 a month, approved in Sep 2024 (ThisDay,
   26 Sep 2024; ICIR). ₦924,000 a year ÷ a full year at the 2024 minimum wage (₦840,000) ≈ 1.1. */
CE('NG',{id:'ng_nysc',win:[21,27],p:1,def:'serve',when:s=>s.done.edu==='uni'&&!s.study&&!s.nsUntil&&s.age<30,
 opts:s=>{const ns=(c)=>s=>{s.nsUntil=s.age+1;s.nsPay=1.1;s.nsCost=c;T(s,'ns',{kind:'custom',label:M('trk.nysc'),paid:0,note:M('note.ns',{a:MN(0)})})};return[
  QR(ek('ng_nysc'),'serve',{},2,ns(.6)),
  Q(ek('ng_nysc'),'saed',{},s=>{ns(.65)(s);addSkill(s,'saed',2,M('trk.saed'));later(s,s.age+1,'sideBiz',{id:'ng_saed',p:.35,a:.12*s.base,n:5})},undefined,true),
  QR(ek('ng_nysc'),'home',{},2,s=>{ns(.35)(s);s.happy+=1})]}}),
/* Japa: UK Skilled Worker visa £719 (up to 3 years, from Oct 2023) and the Immigration Health Surcharge £1,035 a year (Mayer Brown;
   Edwin Coe). With flights and a deposit, about £6,000, at market exchange rates ≈ 6 years of a Nigerian typical wage (ESTIMATE).
   Pay and costs in the UK are ESTIMATES from the two countries' typical wages. */
CE('NG',{id:'ng_japa',win:[24,38],p:.45,def:'stay',when:s=>ctrWhen(s)&&edLv(s)>=1,
 opts:s=>{const gi=C.findIndex(c=>c[1]==='GB'),f=6*s.base,sal=salary(s);return[
  Q(ek('ng_japa'),'go',{a:MN(6*sal),f:MN(f)},s=>{pay(s,f);s.abroad=gi;s.costMul=5;s.happy-=4;rl(s,-5);bump(s,'abroad',6,M('trk.abroad',{c:{k:'_c',ci:gi}}));s.trk.abroad.v-=f},liquid(s)>=f||M('e.home.need',{n:MN(f),h:MN(liquid(s))})),
  Q(ek('ng_japa'),'stay',{},s=>{})]}}),
/* Inflation: 34.80% in December 2024, after the May 2023 subsidy removal and naira devaluation (NBS, via TechCabal and Intelpoint);
   rebased CPI showed 24.48% in January 2025. Savings rates far below that: a 12–25% real loss in a year is an ESTIMATE. */
CE('NG',{id:'ng_infl',win:[22,60],p:.7,def:'keep',when:s=>s.cash>.2*s.base,opts:inflOpts('ng_infl',[.12,.25],'e.infl.ng')}),
/* Generators and solar: Nigerians spend over $14bn a year on generator fuel (Stears/Sterling, via ThisDay, 2023); home solar
   installations cost about ₦1.5–3.5 million (BusinessDay); 1.25% of households had solar in 2022 (BCG/All On, via AP). A small
   system ≈ 1.8 years of the minimum wage; fuel and upkeep are ESTIMATES. */
CE('NG',{id:'ng_gen',win:[24,55],p:.65,def:'gen',
 opts:s=>{const B=s.base;return[
  Q(ek('ng_gen'),'gen',{a:MN(.25*B)},s=>{T(s,'ng_gen',{kind:'custom',label:M('trk.ng_gen')});rec(s,'ng_gen',.25*B,12,-.2)},undefined,true),
  Q(ek('ng_gen'),'solar',{a:MN(1.8*B),b:MN(.03*B)},s=>{const t=T(s,'ng_gen',{kind:'custom',label:M('trk.ng_solar')});pay(s,1.8*B);t.v-=1.8*B;rec(s,'ng_gen',.03*B,12);s.happy+=2}),
  Q(ek('ng_gen'),'none',{},s=>{s.happy-=3})]}}),
/* Floods: the 2022 floods killed 662 people and displaced 2.4 million (NEMA, via Channels TV and Daily Trust, Jan 2023). */
CE('NG',{id:'ng_flood',win:[25,70],p:.5,def:'none',opts:floodOpts('ng_flood',{aid:0,prem:.008,prep:.015,p:.5})}),
/* Ajo / esusu: a rotating savings group run by a collector; a widespread Nigerian practice. Fees and risk are ESTIMATES. */
CE('NG',{id:'ng_ajo',win:[22,55],p:.6,def:'no',opts:roscaOpts('ng_ajo',{a:.2,n:1,early:.97,late:.97,risk:.07})}),
/* Health insurance: the National Health Insurance Authority Act 2022 made health insurance compulsory and set up state schemes for
   informal workers (NHIA). Premiums and cover share are ESTIMATES. */
CE('NG',{id:'ng_nhia',win:[22,60],p:.6,def:'none',when:s=>!s.medCut,
 opts:s=>[Q(ek('ng_nhia'),'join',{a:MN(.02*s.base)},s=>medPlan(s,'ng_nhia',.5,.02*s.base),undefined,true),Q(ek('ng_nhia'),'none',{},s=>{})]}),
/* Micro Pension Plan: PenCom's plan for the self-employed and informal workers (launched 2019), with contingent withdrawals
   (TheCable 2024; ThisDay 2019). Pension funds' real returns near 0% in high-inflation years: an ESTIMATE. */
CE('NG',{id:'ng_pension',win:[25,50],p:.5,def:'none',when:selfEmp,
 opts:s=>{const a=.06*s.base;return[Q(ek('ng_pension'),'join',{a:MN(a)},s=>yearly(s,'mpp',{amt:a,until:60},{rate:0,lock:60},'trk.mpp')),Q(ek('ng_pension'),'none',{},s=>{})]}}),

/* ===================== Pakistan (PK) ===================== */
/* Committees (ROSCAs): common among salaried and self-employed people; no legal contracts (HRMARS study; finclusion.org 2017). Risk
   is an ESTIMATE. */
CE('PK',{id:'pk_committee',win:[22,55],p:.6,def:'no',opts:roscaOpts('pk_committee',{a:.25,n:1,early:1,late:1,risk:.06},true)}),
/* The Gulf: a record $38.3bn of remittances in FY2025, $9.3bn from Saudi Arabia and $7.9bn from the UAE (State Bank of Pakistan, via
   Profit). Fees, pay and housing multiples are ESTIMATES. */
CE('PK',{id:'pk_gulf',win:[21,40],p:.45,def:'stay',when:s=>ctrWhen(s)&&['hands','office'].includes(CAR[s.job.id].f),
 text:s=>M('e.pk_gulf.x',{a:MN(2.5*salary(s))}),opts:ctrOpts('pk_gulf',{m:2.5,cm:.8,yrs:3,fee:.5,remit:.25})}),
/* Floods: in 2022 a third of the country was under water and about 33 million people were affected; damage $14.9bn and losses
   $15.2bn (Post-Disaster Needs Assessment, Planning Commission). */
CE('PK',{id:'pk_flood',win:[25,70],p:.5,def:'none',opts:floodOpts('pk_flood',{aid:0,prem:.008,prep:.015,p:.5})}),
/* Inflation: 38% in May 2023, a record (Pakistan Bureau of Statistics, via Business Recorder). The yearly loss is an ESTIMATE. */
CE('PK',{id:'pk_infl',win:[22,60],p:.6,def:'keep',when:s=>s.cash>.2*s.base,opts:inflOpts('pk_infl',[.1,.22],'e.infl.pk')}),
/* Behbood Savings Certificates: for people 60+, widows and disabled people; 12.72% a year from 4 Nov 2025, monthly profit, 10 years
   (National Savings, via ARY News). With inflation near 5–7% and withholding tax, about 5% real: an ESTIMATE. */
CE('PK',{id:'pk_behbood',win:[60,70],p:.8,def:'bank',when:s=>liquid(s)>.3*s.base,
 opts:s=>{const a=.4*liquid(s);return[Q(ek('pk_behbood'),'buy',{a:MN(a)},s=>putIn(s,'behbood',a,{rate:.05},'trk.behbood')),Q(ek('pk_behbood'),'bank',{},s=>{})]}}),
/* Solar: grid power rose from about Rs 9 a unit in 2015 to Rs 44 in 2024; about 17 GW of panels imported in 2024; net-metering
   buy-back being cut from Rs 27 to Rs 10 a unit (Wikipedia "Solar power in Pakistan"; Payne Institute; PIDE). System costs and
   savings are ESTIMATES. */
CE('PK',{id:'pk_solar',win:[26,60],p:.6,def:'grid',
 opts:s=>{const B=s.base,go=(c,v)=>s=>{const t=T(s,'pk_solar',{kind:'custom',label:M('trk.pk_solar')});pay(s,c);t.v-=c;rec(s,'pk_solar',-v,15)};return[
  Q(ek('pk_solar'),'solar',{a:MN(1.2*B),b:MN(.12*B)},go(1.2*B,.12*B)),
  Q(ek('pk_solar'),'small',{a:MN(.5*B),b:MN(.06*B)},go(.5*B,.06*B)),
  Q(ek('pk_solar'),'grid',{},s=>{})]}}),
/* EOBI: employers pay 5% and workers 1% of the minimum wage; a pension of at least Rs 10,000 a month from July 2023, at 60 (55 for
   women) after 15 years (OECD Pensions at a Glance Asia/Pacific 2024; Dawn). Rs 120,000 a year ÷ a full year at the minimum wage
   (Rs 444,000) ≈ 0.27. */
CE('PK',{id:'pk_eobi',win:[20,40],p:.6,def:'skip',when:s=>job(s)&&!selfEmp(s),
 opts:s=>{const B=s.base;return[Q(ek('pk_eobi'),'reg',{a:MN(.01*B),b:MN(.27*B)},s=>penScheme(s,'pk_eobi',.01*B,35,.27*B,s.sex==='f'?55:60)),Q(ek('pk_eobi'),'skip',{},s=>{})]}}),
/* School: free and compulsory education for children 5–16 (Constitution, Article 25-A, 2010); low-fee private schools are common.
   Fees and outcomes are ESTIMATES. */
CE('PK',{id:'pk_school',win:[27,48],p:.6,def:'govt',when:s=>hasKid(s,4,6),
 opts:s=>{const B=s.base,go=(a,p)=>s=>{if(a){T(s,'pk_school',{kind:'ghost',label:M('trk.schoolFees')});rec(s,'pk_school',a,12)}kidWin(s,p,.75)};return[
  Q(ek('pk_school'),'top',{a:MN(.4*B)},go(.4*B,.4),undefined,true),Q(ek('pk_school'),'low',{a:MN(.08*B)},go(.08*B,.25),undefined,true),Q(ek('pk_school'),'govt',{},go(0,.15),undefined,true)]}}),

/* ===================== Indonesia (ID) ===================== */
/* Arisan: a monthly savings group where a name is drawn each meeting to take the pot (a common Indonesian practice). Risk ESTIMATE. */
CE('ID',{id:'id_arisan',win:[22,60],p:.65,def:'no',opts:roscaOpts('id_arisan',{a:.15,n:2,early:1,late:1,risk:.04},true)}),
/* THR: one month's wage for a full year of work, paid in full at least 7 days before Idul Fitri (Permenaker 6/2016; Minister of
   Manpower, via Setkab and Kontan). */
CE('ID',{id:'id_thr',win:[22,55],p:.7,def:'bank',when:job,
 opts:s=>{const a=salary(s)/12;return[
  QR(ek('id_thr'),'mudik',{a:MN(a)},4,s=>{spend(s,'id_thr',a,'trk.id_thr');s.happy+=3}),
  QR(ek('id_thr'),'send',{a:MN(.5*a)},2,s=>spend(s,'id_thr',.5*a,'trk.id_thrS')),
  QR(ek('id_thr'),'bank',{a:MN(a)},-1,s=>{s.happy-=1})]}}),
/* BPJS Kesehatan for independent members: Rp150,000 / 100,000 / 42,000 a person a month for classes I / II / III (class III
   subsidised to Rp35,000), Perpres 64/2020, still in force in Aug 2025 (LPEM; CNN Indonesia). Class I ≈ 0.056 and class III ≈ 0.013
   a year of the game's typical wage (Rp32 million). Shares of bills covered are ESTIMATES. */
CE('ID',{id:'id_bpjs',win:[22,60],p:.75,def:'k3',when:s=>selfEmp(s)&&!s.medCut,
 opts:s=>{const B=s.base;return[
  Q(ek('id_bpjs'),'k1',{a:MN(.056*B)},s=>medPlan(s,'id_bpjs',.2,.056*B),undefined,true),
  Q(ek('id_bpjs'),'k3',{a:MN(.013*B)},s=>medPlan(s,'id_bpjs',.35,.013*B),undefined,true),
  Q(ek('id_bpjs'),'none',{},s=>{})]}}),
/* Floods: Jakarta and other cities flood in many rainy seasons (BNPB). Odds and costs are ESTIMATES. */
CE('ID',{id:'id_flood',win:[25,70],p:.5,def:'none',opts:floodOpts('id_flood',{aid:0,prem:.006,prep:.012})}),
/* Working abroad: under Law 18/2017 and BP2MI Regulation 9/2020, employers bear the placement costs for ten job types, including
   domestic and care work. Pay and housing multiples are ESTIMATES. */
CE('ID',{id:'id_pmi',win:[21,40],p:.4,def:'stay',when:s=>ctrWhen(s)&&['hands','office'].includes(CAR[s.job.id].f),
 text:s=>M('e.id_pmi.x',{a:MN(2.2*salary(s))}),opts:ctrOpts('id_pmi',{m:2.2,cm:.9,yrs:2,fee:.05,remit:.2})}),
/* FLPP subsidised mortgages: fixed 5% for up to 20 years, from 1% down, for first-time buyers under an income cap (about Rp8.5–14
   million a month, PKP Ministerial Regulation 5/2025) and a price cap (about Rp166–185 million) (Kemenkeu; Kompas TV; Pasardana).
   With about 2.5% inflation, ≈ 2.5% real; a home at the price cap ≈ half of the game's family-home price. */
CE('ID',{id:'id_flpp',win:[24,40],p:.65,def:'wait',when:s=>!s.house&&job(s)&&!(s.hWait>s.age),
 text:s=>M('e.id_flpp.x',{p:MN(.52*price(s))}),
 opts:s=>{const P=.52*price(s),ok=salary(s)<1.6*s.base||M('e.id_flpp.no');return[
  Q(ek('id_flpp'),'flpp',{d:upFront(P,.01,.02),m:yrPay(P,.01,.025,20),c:MN(.04*s.base)},s=>{buyAt(s,P,{dp:.01,fee:.02,r:.025,n:20,lk:'trk.id_flpp',fixed:true});T(s,'id_far',{kind:'custom',label:M('trk.commute')});rec(s,'id_far',.04*s.base,20)},ok),
  Q(ek('id_flpp'),'wait',{},s=>{})]}}),
/* Ride-hailing (ojol): driving in the evenings for Gojek or Grab. Earnings and wear are ESTIMATES. */
CE('ID',{id:'id_ojol',win:[20,50],p:.5,def:'no',when:job,
 opts:s=>[QR(ek('id_ojol'),'yes',{a:MN(.25*s.base)},-2,s=>{T(s,'id_ojol',{kind:'custom',label:M('trk.id_ojol')});rec(s,'id_ojol',-.25*s.base,4,-.6);s.happy-=2},undefined,true),Q(ek('id_ojol'),'no',{},s=>{})]}),
/* Retail government bonds: ORI027 paid 6.65% (3 years) and 6.75% (6 years), from Rp1 million, coupon tax 10% (Bisnis.com; Bareksa,
   Jan 2025). With inflation near 2.5%, about 3.5% real: an ESTIMATE. */
CE('ID',{id:'id_ori',win:[24,60],p:.6,def:'keep',when:s=>liquid(s)>.2*s.base,
 text:s=>M('e.id_ori.x',{a:MN(.3*liquid(s))}),
 opts:s=>{const a=.3*liquid(s);return[Q(ek('id_ori'),'ori',{a:MN(a)},s=>putIn(s,'ori',a,{rate:.035},'trk.ori')),Q(ek('id_ori'),'keep',{},s=>{})]}}),

/* ===================== Ethiopia (ET) ===================== */
/* Equb (iqub): members pay in regularly and take the pot in turn, often by lottery (Wikipedia "Equb"; Addis Standard). Risk ESTIMATE. */
CE('ET',{id:'et_iqub',win:[22,60],p:.65,def:'no',opts:roscaOpts('et_iqub',{a:.2,n:2,early:1,late:1,risk:.05},true)}),
/* Idir (edir): a community burial association; families pay small monthly dues and the idir pays for funerals and lends tents and
   cooking equipment (Wikipedia "Eder (finance)"; Addis Fortune). Dues, the funeral cost and the share covered are ESTIMATES. */
CE('ET',{id:'et_idir',win:[24,55],p:.7,def:'join',
 opts:s=>{const a=.01*s.base,go=j=>s=>{s.idir=j;if(j){T(s,'et_idir',{kind:'custom',label:M('trk.et_idir'),paid:0,saved:0,nk:'note.idir'});rec(s,'et_idir',a,45)}
   later(s,s.age+3+Math.floor(evR(s,'idirAt')()*20),'idir',{})};return[QR(ek('et_idir'),'join',{a:MN(a)},3,go(1)),QR(ek('et_idir'),'no',{},-1,go(0))]}}),
/* Inflation: above 30% in 2023; after the July 2024 float the birr fell from about 57 to 128 per dollar by December 2024 (Ethiopian
   Economics Association, via The Reporter; Dabafinance). The yearly loss is an ESTIMATE. */
CE('ET',{id:'et_infl',win:[22,60],p:.6,def:'keep',when:s=>s.cash>.2*s.base,opts:inflOpts('et_infl',[.08,.2],'e.infl.et')}),
/* Community-based health insurance: a household premium of 240 birr a year under the national guideline (some districts 400–530
   birr), 827 of about 1,100 districts covered in 2020 (Dove Press review; Frontiers in Public Health, 2022). Share covered: ESTIMATE. */
CE('ET',{id:'et_cbhi',win:[22,60],p:.75,def:'join',when:s=>!s.medCut,
 opts:s=>[Q(ek('et_cbhi'),'join',{a:MN(.012*s.base)},s=>medPlan(s,'et_cbhi',.45,.012*s.base),undefined,true),Q(ek('et_cbhi'),'none',{},s=>{})]}),
/* Condominiums: the 20/80 and 40/60 schemes need a 20% or 40% down payment saved at the Commercial Bank of Ethiopia, the rest over 20
   years; homes are allocated by lottery and many savers have waited over a decade (Addis Fortune; The Reporter; Capital Ethiopia).
   Savings earn less than inflation; the subsidised price (about 0.6 of market) and yearly odds are ESTIMATES. */
CE('ET',{id:'et_condo',win:[24,40],p:.6,def:'no',when:s=>!s.house&&!s.condoOn,
 opts:s=>{const B=s.base,go=(a,dp,p)=>s=>{s.condoOn=1;yearly(s,'et_condo',{amt:a,until:s.age+15},{rate:-.04},'trk.et_condoS');later(s,s.age+3,'condo',{dp,p,until:s.age+15})};return[
  Q(ek('et_condo'),'s20',{a:MN(.08*B)},go(.08*B,.2,.08),undefined,true),
  Q(ek('et_condo'),'s40',{a:MN(.16*B)},go(.16*B,.4,.14),undefined,true),
  Q(ek('et_condo'),'no',{},s=>{})]}}),
/* The Grade 12 exam: 8.4% of the 585,882 students who sat it in 2024/25 passed (50% or more), up from 5.4% (The Reporter). Effects
   of tutoring are game rules. */
CE('ET',{id:'et_exam',win:[16,17],p:.85,def:'self',
 opts:s=>[
  Q(ek('et_exam'),'tutor',{},s=>{addSkill(s,'school',5*learnLuck(s,'etx'),M('trk.school'));s.happy-=3;famCost(s,'et_exam',.3)},undefined,true),
  Q(ek('et_exam'),'self',{},s=>{addSkill(s,'school',3*learnLuck(s,'etx'),M('trk.school'));s.happy-=1},undefined,true),
  Q(ek('et_exam'),'work',{a:MN(.05*s.base)},s=>{addSkill(s,'school',1,M('trk.school'));s.cash+=.05*s.base;s.earned+=.05*s.base},undefined,true)]}),
/* The Ethiopian Securities Exchange opened in January 2025; Ethio Telecom sold shares at 300 birr each (minimum 33 shares, 9,900
   birr) to about 47,000 citizens and listed in May 2026 (Ethio Telecom; Capital Ethiopia; mystocks.africa). */
CE('ET',{id:'et_esx',win:[24,60],p:.55,def:'bank',when:s=>liquid(s)>.4*s.base,
 opts:s=>{const a=.25*liquid(s);return[Q(ek('et_esx'),'buy',{a:MN(a)},s=>putIn(s,'esx',a,{},'trk.esx')),Q(ek('et_esx'),'bank',{},s=>{})]}}),

/* ===================== Bangladesh (BD) ===================== */
/* Microcredit: the Microcredit Regulatory Authority caps interest at 24% a year on a declining balance, since 2019 (The Business
   Standard; Financial Express). Business outcomes are game rules. */
CE('BD',{id:'bd_micro',win:[22,50],p:.6,def:'no',
 opts:s=>{const B=s.base;return[
  Q(ek('bd_micro'),'loan',{a:MN(.3*B),b:MN(.19*B)},s=>{s.cash+=.3*B;T(s,'bd_micro',{kind:'custom',label:M('trk.bd_micro'),v:.3*B});rec(s,'bd_micro',.19*B,2);later(s,s.age+1,'sideBiz',{id:'bd_shop',p:.55,a:.12*B,n:6})},undefined,true),
  Q(ek('bd_micro'),'save',{a:MN(.03*B)},s=>yearly(s,'bdsave',{amt:.03*B,until:s.age+10},{rate:0},'trk.bdsave')),
  Q(ek('bd_micro'),'no',{},s=>{})]}}),
/* The Gulf: remittances passed $30bn (FY2024–25, $30.33bn); a record 750,000+ workers went to Saudi Arabia in 2025 (Daily Star; Arab
   News). Migration costs, pay and housing multiples are ESTIMATES. */
CE('BD',{id:'bd_gulf',win:[21,40],p:.45,def:'stay',when:s=>ctrWhen(s)&&['hands','office'].includes(CAR[s.job.id].f),
 text:s=>M('e.bd_gulf.x',{a:MN(2.5*salary(s))}),opts:ctrOpts('bd_gulf',{m:2.5,cm:.8,yrs:3,fee:1.5,remit:.3})}),
/* Floods and cyclones: low-lying areas flood in most monsoon seasons and cyclones strike the coast (Bangladesh Meteorological
   Department). Odds and costs are ESTIMATES. */
CE('BD',{id:'bd_flood',win:[25,70],p:.55,def:'none',opts:floodOpts('bd_flood',{aid:0,prem:.008,prep:.015,p:.6})}),
/* Sanchayapatra: the 5-year Bangladesh Savings Certificate pays up to 12.40% a year from Jan 2025, taxed 5–10% (UNB). With inflation
   near 9%, about 2% real: an ESTIMATE. */
CE('BD',{id:'bd_sanchay',win:[25,65],p:.6,def:'bank',when:s=>liquid(s)>.25*s.base,
 opts:s=>{const a=.3*liquid(s);return[Q(ek('bd_sanchay'),'buy',{a:MN(a)},s=>putIn(s,'sanchay',a,{rate:.02},'trk.sanchay')),Q(ek('bd_sanchay'),'bank',{},s=>{})]}}),
/* Universal Pension Scheme (from 17 Aug 2023): Surokkha for informal workers at Tk1,000–5,000 a month; Samata for low incomes at
   Tk1,000 with the government paying half (Daily Star; upension.gov.bd). Tk12,000 a year ≈ 0.11 of the game's typical wage. Real
   returns are an ESTIMATE. */
CE('BD',{id:'bd_upension',win:[25,50],p:.55,def:'no',when:selfEmp,
 opts:s=>{const B=s.base;return[
  Q(ek('bd_upension'),'surokkha',{a:MN(.11*B)},s=>yearly(s,'upen',{amt:.11*B,until:60},{rate:.02,lock:60},'trk.upen')),
  Q(ek('bd_upension'),'samata',{a:MN(.055*B),b:MN(.055*B)},s=>yearly(s,'upen',{amt:.055*B,until:60,bonus:1},{rate:.02,lock:60},'trk.upen'),s.fam==='poor'||M('e.bd_upension.low')),
  Q(ek('bd_upension'),'no',{},s=>{})]}}),
/* Moving to Dhaka: pay and cost multiples are ESTIMATES. */
CE('BD',{id:'bd_city',win:[19,28],p:.6,def:'stay',when:ctrWhen,
 text:s=>M('e.bd_city.x',{a:MN(1.3*salary(s))}),
 opts:s=>[Q(ek('bd_city'),'go',{a:MN(1.3*salary(s))},s=>cityMove(s,'bd_city',1.3,1.25,1.2,-3)),Q(ek('bd_city'),'stay',{},s=>{})]}),
/* Private tutoring for the SSC and HSC exams is widespread (education household surveys); fees and outcomes are ESTIMATES. */
CE('BD',{id:'bd_tuition',win:[34,60],p:.6,def:'some',when:s=>hasKid(s,12,15),
 opts:s=>{const B=s.base;return[
  Q(ek('bd_tuition'),'much',{a:MN(.12*B)},s=>{T(s,'bd_tuition',{kind:'ghost',label:M('trk.tuition')});rec(s,'bd_tuition',.12*B,4);s.happy-=1;kidWin(s,.3,.65)},undefined,true),
  Q(ek('bd_tuition'),'some',{a:MN(.04*B)},s=>{T(s,'bd_tuition',{kind:'ghost',label:M('trk.tuition')});rec(s,'bd_tuition',.04*B,4);kidWin(s,.2,.75)},undefined,true),
  Q(ek('bd_tuition'),'none',{},s=>kidWin(s,.12,.8),undefined,true)]}}),
/* Samity: a neighbourhood savings group with a rotating pot. Risk ESTIMATE. */
CE('BD',{id:'bd_samity',win:[22,55],p:.55,def:'no',opts:roscaOpts('bd_samity',{a:.15,n:2,early:1,late:1,risk:.05},true)}),

/* ===================== Brazil (BR) ===================== */
/* FGTS: employers deposit 8% of pay; with saque-aniversário you withdraw part each year in your birthday month but, if fired
   without cause, only receive the 40% fine (Projuris; Banco Mercantil; O POVO, 2025). Yearly withdrawal size is an ESTIMATE. */
CE('BR',{id:'br_fgts',win:[22,40],p:.7,def:'resc',when:s=>job(s)&&!selfEmp(s)&&!s.fgts,
 opts:s=>{const set=m=>s=>{s.fgts={mode:m,since:s.age};T(s,'br_fgts',{kind:'custom',label:M('trk.br_fgts')});if(m==='aniv')rec(s,'br_fgts',-.04*Math.max(salary(s),s.base),25);else later(s,60,'fgts60',{})};return[
  Q(ek('br_fgts'),'resc',{},set('resc'),undefined,true),Q(ek('br_fgts'),'aniv',{a:MN(.04*Math.max(salary(s),s.base))},set('aniv'),undefined,true)]}}),
/* 13º salário: a 13th month's pay by law each December (Lei 4.090/1962). */
CE('BR',{id:'br_13',win:[22,55],p:.65,def:'bank',when:s=>job(s)&&!selfEmp(s),opts:bonusOpts('br_13',1/12)}),
/* MEI: R$75.90 a month in 2025 (5% of the R$1,518 minimum wage) gives INSS cover and a minimum-wage pension at 65 (62 for women)
   with 15–20 years of contributions (Metrópoles; Previdenciarista). R$910 a year ≈ 0.045 of the game's typical wage; the pension
   above what everyone gets (≈ 0.5) is an ESTIMATE. */
CE('BR',{id:'br_mei',win:[22,45],p:.7,def:'no',when:selfEmp,
 opts:s=>{const B=s.base;return[Q(ek('br_mei'),'mei',{a:MN(.045*B),b:MN(.5*B),n:s.sex==='f'?62:65},s=>penScheme(s,'br_mei',.045*B,40,.5*B,s.sex==='f'?62:65)),Q(ek('br_mei'),'no',{},s=>{})]}}),
/* Health plans: 52.2 million beneficiaries in January 2025, about 25% of the population; SUS is free for all (ANS, via CQCS; IESS).
   Premiums and cover are ESTIMATES. */
CE('BR',{id:'br_plano',win:[24,55],p:.6,def:'sus',when:s=>!s.medCut,
 opts:s=>[Q(ek('br_plano'),'plano',{a:MN(.12*s.base)},s=>{medPlan(s,'br_plano',.4,.12*s.base);s.happy+=1},undefined,true),Q(ek('br_plano'),'sus',{},s=>{})]}),
/* Tesouro Direto: Tesouro IPCA+ 2035 paid about inflation + 6.2% in 2024 (InfoMoney; Money Times); 15% income tax after two years.
   About 4.5% real after tax and custody fees: an ESTIMATE. Poupança pays roughly inflation: an ESTIMATE. */
CE('BR',{id:'br_tesouro',win:[23,60],p:.65,def:'keep',when:s=>liquid(s)>.25*s.base,
 text:s=>M('e.br_tesouro.x',{a:MN(.3*liquid(s))}),
 opts:s=>{const a=.3*liquid(s);return[Q(ek('br_tesouro'),'ipca',{a:MN(a)},s=>putIn(s,'ipca',a,{rate:.045},'trk.ipca')),Q(ek('br_tesouro'),'poup',{a:MN(a)},s=>putIn(s,'poup',a,{rate:.005},'trk.poup')),Q(ek('br_tesouro'),'keep',{},s=>{})]}}),
/* Minha Casa, Minha Vida: Faixa 1 for family incomes up to R$2,850 a month (2024–25; raised in 2026), subsidies up to 95% of the price
   and interest of about 4–5% (InvestNews; Tenda). Price and subsidy in the game are ESTIMATES. */
CE('BR',{id:'br_mcmv',win:[24,45],p:.6,def:'wait',when:s=>!s.house&&!(s.hWait>s.age)&&!!s.job,
 text:s=>M('e.br_mcmv.x',{p:MN(.55*price(s))}),
 opts:s=>{const P=.55*price(s),ok=salary(s)<1.8*s.base||M('e.br_mcmv.no');return[
  Q(ek('br_mcmv'),'mcmv',{d:upFront(P,.05,.01),m:yrPay(P,.05,.005)},s=>buyAt(s,P,{dp:.05,fee:.01,r:.005,n:30,lk:'trk.br_mcmv',fixed:true}),ok),Q(ek('br_mcmv'),'wait',{},s=>{})]}}),
/* Floods: in May 2024 floods in Rio Grande do Sul displaced 538,245 people and killed at least 149 (state Civil Defence, via Poder360
   and Diário do Nordeste). */
CE('BR',{id:'br_flood',win:[25,70],p:.45,def:'none',opts:floodOpts('br_flood',{aid:.1,prem:.006,prep:.012,p:.45})}),
/* Concursos: the 2024 Concurso Nacional Unificado had about 2.1 million registrations for 6,640 posts, 317 per post (MGI, via O Povo
   and Gran Cursos). Chances are game rules. */
CE('BR',{id:'br_concurso',win:[22,40],p:.6,def:'no',when:s=>job(s)&&s.job.id!=='civ',opts:examOpts('br_concurso',.04)}),

/* ===================== Mexico (MX) ===================== */
/* Tandas: 20% of Mexican savers use tandas (INEGI ENIF 2024, via El Universal and Milenio). Risk ESTIMATE. */
CE('MX',{id:'mx_tanda',win:[22,60],p:.6,def:'no',opts:roscaOpts('mx_tanda',{a:.15,n:1,early:1,late:1,risk:.05})}),
/* AFORE: the 2020 reform raises employer contributions from 5.15% to about 13.9% of pay by 2030, 15% in total (Deloitte; Principal;
   IADB). Voluntary contributions can be deductible: the tax saving (about 10%) is an ESTIMATE. */
CE('MX',{id:'mx_afore',win:[25,45],p:.6,def:'no',when:s=>job(s)&&!selfEmp(s),
 opts:s=>{const w=salary(s);return[Q(ek('mx_afore'),'vol',{a:MN(.05*w)},s=>yearly(s,'afore',{p:.05,until:65,bonus:.1},{lock:65},'trk.afore')),Q(ek('mx_afore'),'no',{},s=>{})]}}),
/* Infonavit: employers pay 5% of pay into the worker's housing subaccount, usable as the down payment with an Infonavit loan (Ley del
   INFONAVIT art. 29; El Imparcial, 2025). Loan rates by income (about 3% real) are an ESTIMATE. */
CE('MX',{id:'mx_infonavit',win:[25,40],p:.65,def:'wait',when:s=>!s.house&&job(s)&&!selfEmp(s)&&!(s.hWait>s.age),
 text:s=>M('e.mx_infonavit.x',{p:MN(.75*price(s)),a:MN(.08*.75*price(s))}),
 opts:s=>{const P=.75*price(s),sub=.08*P;return[Q(ek('mx_infonavit'),'buy',{d:MN(Math.max(0,.13*P-sub)),m:yrPay(P,.1,.03)},s=>{s.cash+=sub;const t=T(s,'mx_sub',{kind:'custom',label:M('trk.mx_sub'),v:sub,note:M('note.got',{a:MN(sub)})});buyAt(s,P,{dp:.1,fee:.03,r:.03,n:30,lk:'trk.mx_infonavit',fixed:true,flex:true})}),Q(ek('mx_infonavit'),'wait',{},s=>{})]}}),
/* Aguinaldo: at least 15 days' wages, paid before 20 December (Ley Federal del Trabajo, art. 87; PROFEDET). */
CE('MX',{id:'mx_aguinaldo',win:[22,55],p:.65,def:'bank',when:s=>job(s)&&!selfEmp(s),opts:bonusOpts('mx_aguinaldo',15/365)}),
/* Seasonal work in the US: 315,328 H-2A visas were issued in 2024, over 90% to Mexicans (USAFacts; Wilson Center for FY2019); Mexico
   received a record $64.7bn in remittances in 2024 (Banxico, via LatinNews). Employers pay travel and housing under H-2A. Pay and
   season length are ESTIMATES. */
CE('MX',{id:'mx_h2',win:[20,40],p:.45,def:'stay',when:s=>ctrWhen(s)&&CAR[s.job.id].f==='hands',
 text:s=>M('e.mx_h2.x',{a:MN(1.8*salary(s))}),opts:ctrOpts('mx_h2',{m:1.8,cm:.85,yrs:3,fee:.03,remit:.3})}),
/* Hurricanes: Otis struck Acapulco as a category 5 storm in October 2023 (SMN/CONAGUA). Odds and costs are ESTIMATES. */
CE('MX',{id:'mx_storm',win:[25,70],p:.45,def:'none',opts:floodOpts('mx_storm',{aid:0,prem:.006,prep:.012,p:.45})}),
/* IMSS for independent workers: voluntary enrolment for MX$18,870 a year from Feb 2025 (MX$20,538 from Feb 2026) (El Imparcial;
   UnoTV): ≈ 0.19 of the game's typical wage (MX$99,000). Share of bills covered is an ESTIMATE. */
CE('MX',{id:'mx_imss',win:[22,55],p:.6,def:'none',when:s=>selfEmp(s)&&!s.medCut,
 opts:s=>[Q(ek('mx_imss'),'join',{a:MN(.19*s.base)},s=>medPlan(s,'mx_imss',.25,.19*s.base),undefined,true),Q(ek('mx_imss'),'none',{},s=>{})]}),
/* Cetes: 28-day Cetes paid 9.87% in January and 7.48% by late July 2025 (Banco Base; Monex); with inflation near 4%, about 3.5% real:
   an ESTIMATE. Cetesdirecto sells from 100 pesos. */
CE('MX',{id:'mx_cetes',win:[23,60],p:.6,def:'keep',when:s=>liquid(s)>.2*s.base,
 text:s=>M('e.mx_cetes.x',{a:MN(.3*liquid(s))}),
 opts:s=>{const a=.3*liquid(s);return[Q(ek('mx_cetes'),'cetes',{a:MN(a)},s=>putIn(s,'cetes',a,{rate:.035},'trk.cetes')),Q(ek('mx_cetes'),'keep',{},s=>{})]}}),

/* ===================== Philippines (PH) ===================== */
/* OFWs: an estimated 2.16 million Overseas Filipino Workers in 2023 (PSA Survey on Overseas Filipinos, via Philstar); placement fees
   may not exceed one month's basic salary, and none for domestic workers (DMW; PNA). Pay and housing multiples are ESTIMATES. */
CE('PH',{id:'ph_ofw',win:[21,42],p:.5,def:'stay',when:ctrWhen,
 text:s=>M('e.ph_ofw.x',{a:MN(2.6*salary(s))}),opts:ctrOpts('ph_ofw',{m:2.6,cm:.85,yrs:3,fee:.15,remit:.3})}),
/* Paluwagan: an informal rotating savings group; about 4% of adults save this way (BSP, via Moneymax). Risk ESTIMATE. */
CE('PH',{id:'ph_paluwagan',win:[22,55],p:.6,def:'no',opts:roscaOpts('ph_paluwagan',{a:.15,n:1,early:1,late:1,risk:.06})}),
/* Typhoons: about 20 tropical cyclones enter the Philippine Area of Responsibility each year, 8 or 9 crossing the country (PAGASA). */
CE('PH',{id:'ph_typhoon',win:[25,70],p:.6,def:'none',opts:floodOpts('ph_typhoon',{aid:0,prem:.006,prep:.012,p:.6})}),
/* Pag-IBIG MP2: 7.10% tax-free dividends for 2024 (Pag-IBIG Fund, via ABS-CBN and Philstar); a five-year program. With 3% inflation,
   about 4% real: an ESTIMATE. */
CE('PH',{id:'ph_mp2',win:[22,55],p:.65,def:'none',when:job,
 opts:s=>{const a=.06*s.base;return[Q(ek('ph_mp2'),'mp2',{a:MN(a)},s=>yearly(s,'mp2',{amt:a,until:s.age+5},{rate:.04,lock:s.age+5},'trk.mp2')),Q(ek('ph_mp2'),'none',{},s=>{})]}}),
/* PhilHealth: 5% of income for direct contributors in 2025, floor ₱10,000 (₱500 a month) (PhilHealth Advisory 2025-0002): ₱6,000 a
   year ≈ 0.057 of the game's typical wage (₱105,000). Share of bills covered is an ESTIMATE. */
CE('PH',{id:'ph_philhealth',win:[22,55],p:.65,def:'none',when:s=>selfEmp(s)&&!s.medCut,
 opts:s=>[Q(ek('ph_philhealth'),'join',{a:MN(.057*s.base)},s=>medPlan(s,'ph_philhealth',.5,.057*s.base),undefined,true),Q(ek('ph_philhealth'),'none',{},s=>{})]}),
/* SSS voluntary members: 15% of the monthly salary credit (from ₱5,000) from Jan 2025, all paid by the member; 120 monthly
   contributions earn a lifetime pension (Manila Bulletin; Grant Thornton). ₱9,000 a year ≈ 0.086; the pension (≈ ₱2,400 a month,
   ≈ 0.27) is an ESTIMATE. */
CE('PH',{id:'ph_sss',win:[22,45],p:.6,def:'none',when:selfEmp,
 opts:s=>{const B=s.base;return[Q(ek('ph_sss'),'pay',{a:MN(.086*B),b:MN(.27*B)},s=>penScheme(s,'ph_sss',.086*B,30,.27*B,60)),Q(ek('ph_sss'),'none',{},s=>{})]}}),
/* 13th-month pay: one-twelfth of basic salary, paid by 24 December (Presidential Decree 851). */
CE('PH',{id:'ph_13th',win:[22,55],p:.65,def:'bank',when:s=>job(s)&&!selfEmp(s),opts:bonusOpts('ph_13th',1/12)}),
/* Pag-IBIG housing loans: 5.75% (1-year) and 6.25% (3-year) repricing in 2025; the Affordable Housing Program charges 3% for
   low-income members, for up to 30 years (Malaya; Tribune, 2025). Real rates (about 0% and 3%) and prices are ESTIMATES. */
CE('PH',{id:'ph_house',win:[26,42],p:.6,def:'wait',when:s=>!s.house&&job(s)&&!(s.hWait>s.age),
 text:s=>M('e.ph_house.x',{p:MN(.8*price(s)),q:MN(.45*price(s))}),
 opts:s=>{const P=price(s),liq=liquid(s);return[
  Q(ek('ph_house'),'ahp',{d:upFront(.45*P,.05,.02),m:yrPay(.45*P,.05,0)},s=>buyAt(s,.45*P,{dp:.05,fee:.02,r:0,n:30,lk:'trk.ph_ahp',fixed:true}),salary(s)<1.4*s.base||M('e.ph_house.no')),
  Q(ek('ph_house'),'reg',{d:upFront(.8*P,.1,.03),m:yrPay(.8*P,.1,.03)},s=>buyAt(s,.8*P,{dp:.1,fee:.03,r:.03,n:30,lk:'trk.flat'}),liq>=.13*.8*P||M('e.home.need',{n:MN(.104*P),h:MN(liq)})),
  Q(ek('ph_house'),'wait',{},s=>{})]}}),

/* ===================== Vietnam (VN) ===================== */
/* Hụi / họ: legal under Decree 19/2019 if interest stays within 20% a year; organisers sometimes collapse ("vỡ hụi") (Thư viện Pháp luật;
   PLO). Risk ESTIMATE. */
CE('VN',{id:'vn_hui',win:[22,60],p:.6,def:'no',opts:roscaOpts('vn_hui',{a:.2,n:2,early:.88,late:1.06,risk:.1})}),
/* Working in Japan: about 200,000 Vietnamese technical interns by June 2025, the largest group (Vietnamese government, via Bao Bac Ninh;
   MHLW); jobs in Japan cost workers about 192 million dong (≈ US$8,000) on average, though the legal cap is US$3,600 (ILO; IOM study).
   At market exchange rates that is ≈ 3.8 years of the game's typical wage; pay and costs in Japan are ESTIMATES. */
CE('VN',{id:'vn_xkld',win:[20,32],p:.45,def:'stay',when:s=>ctrWhen(s)&&CAR[s.job.id].f==='hands',
 text:s=>M('e.vn_xkld.x',{a:MN(3*salary(s))}),opts:ctrOpts('vn_xkld',{m:3,cm:1.8,yrs:3,fee:3.8,remit:.3})}),
/* Typhoon Yagi (Sep 2024): about $3.3bn of economic losses, 136,705 homes damaged and over 202,000 ha of rice flooded (Vietnamese
   officials, via ARY and RFA). */
CE('VN',{id:'vn_typhoon',win:[25,70],p:.55,def:'none',opts:floodOpts('vn_typhoon',{aid:0,prem:.006,prep:.012,p:.55})}),
/* One-time social insurance withdrawal: 1.5 months' average pay per year before 2014 and 2 months per year from 2014; from 1 July 2025
   (Law 41/2024) a pension needs only 15 years and new members can no longer take a lump sum (BHXH; baohiemxahoidientu.vn). The cut
   to the state pension (5% per year taken out) is an ESTIMATE. */
CE('VN',{id:'vn_bhxh',win:[26,45],p:.55,def:'keep',when:s=>job(s)&&(s.carN||0)>=2,
 opts:s=>{const n=Math.min(10,s.exp||0),a=n*2/12*Math.max(0,salary(s));return[
  Q(ek('vn_bhxh'),'keep',{},s=>{}),
  Q(ek('vn_bhxh'),'take',{a:MN(a),n},s=>{s.cash+=a;s.penM=(s.penM||1)*(1-.05*n);s.penTk='vn_bhxh';T(s,'vn_bhxh',{kind:'custom',label:M('trk.vn_bhxh'),v:a,note:M('note.got',{a:MN(a)})})},n>=1||M('e.vn_bhxh.no'))]}}),
/* Gold: SJC gold bars traded 9–20 million dong a tael above the world price in 2024 (VTC News; VnBusiness; Znews), a premium of
   roughly 10–20%; plain gold rings trade closer to the world price. Deposits pay about 1% above inflation: ESTIMATES. */
CE('VN',{id:'vn_gold',win:[24,60],p:.6,def:'bank',when:s=>liquid(s)>.25*s.base,
 opts:s=>{const a=.3*liquid(s),g=f=>s=>{pay(s,a);mkLot(s,'gold',{t:'gold'},'trk.gold');addLot(s,'gold',f*a);s.lots.gold.tin+=(1-f)*a;s.happy+=1};return[
  Q(ek('vn_gold'),'sjc',{a:MN(a)},g(.85)),Q(ek('vn_gold'),'ring',{a:MN(a)},g(.96)),Q(ek('vn_gold'),'bank',{a:MN(a)},s=>putIn(s,'vnfd',a,{rate:.01},'trk.fd'))]}}),
/* Household health insurance: 4.5% of the base salary for the first member (Law on Health Insurance, art. 13); the base salary is
   2.34 million dong a month from July 2024: about 1.26 million a year ≈ 0.026 of the game's typical wage. Share covered: ESTIMATE. */
CE('VN',{id:'vn_bhyt',win:[22,60],p:.7,def:'join',when:s=>selfEmp(s)&&!s.medCut,
 opts:s=>[Q(ek('vn_bhyt'),'join',{a:MN(.026*s.base)},s=>medPlan(s,'vn_bhyt',.45,.026*s.base),undefined,true),Q(ek('vn_bhyt'),'none',{},s=>{})]}),
/* Moving to Ho Chi Minh City or Hanoi: paper household registration books were abolished from 1 Jan 2023 (Law on Residence 2020).
   Pay and cost multiples are ESTIMATES. */
CE('VN',{id:'vn_city',win:[19,28],p:.6,def:'stay',when:ctrWhen,
 text:s=>M('e.vn_city.x',{a:MN(1.35*salary(s))}),
 opts:s=>[Q(ek('vn_city'),'go',{a:MN(1.35*salary(s))},s=>cityMove(s,'vn_city',1.35,1.3,1.3,-3)),Q(ek('vn_city'),'stay',{},s=>{})]}),
/* Extra classes: Circular 29/2024 (from 14 Feb 2025) regulates extra classes; those held in school are free and limited to listed
   groups, and paid classes outside school must be registered businesses (MOET, via Lao Cai and Nong nghiep newspapers). Fees and
   outcomes are ESTIMATES. */
CE('VN',{id:'vn_hocthem',win:[30,58],p:.6,def:'some',when:s=>hasKid(s,10,15),
 opts:s=>{const B=s.base,go=(a,p)=>s=>{if(a){T(s,'vn_hocthem',{kind:'ghost',label:M('trk.tuition')});rec(s,'vn_hocthem',a,5)}kidWin(s,p,.75)};return[
  Q(ek('vn_hocthem'),'many',{a:MN(.1*B)},s=>{go(.1*B,.3)(s);s.happy-=1},undefined,true),Q(ek('vn_hocthem'),'some',{a:MN(.04*B)},go(.04*B,.2),undefined,true),Q(ek('vn_hocthem'),'none',{},go(0,.12),undefined,true)]}})
];
EV.unshift(...CEV);
