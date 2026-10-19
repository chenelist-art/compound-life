/* Balance test: plays many lives with three bots and checks how hard the game is.
   node tools/balance.js                 bots on every difficulty, 500 lives each
   node tools/balance.js normal 500 opt  also: for every decision, how often each option was the best one
   Bots (each life is played by all three, from the same birth):
   - smart: always invests (saves 30%, puts bonuses and windfalls in the market), studies (degree, courses, Learn focus
     until 30), buys insurance, never gambles; otherwise takes the cheapest option and the best-paid steady career
   - random: a random option on every card, and now and then a random focus
   - default: the default option on every card, Balance focus all life
   - mixed: each life gets its own care level, from reckless to careful, and mixes the three bots accordingly
   "Best option" (opt): at each decision of a mixed-bot life, every option is played out to the end of that same life
   (same luck, same later choices) and the one with the highest life score wins; ties share the win. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
const ctx={console};vm.createContext(ctx);
/* ENGINE=path runs another copy of the engine, for example an older one to compare against */
for(const f of[path.join(ROOT,'js/i18n.js'),process.env.ENGINE||path.join(ROOT,'js/engine.js')])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const E=vm.runInContext(`({C,EV,CAR,newLife,tick,yearRand,dueEvents,applyOpt,netWorth,clone,mb,hsh,carStartPay,lifeScore,salary,skill,evOpts:typeof evOpts==='function'?evOpts:(s,ev)=>ev.opts(s)})`,ctx);
const args=process.argv.slice(2),DIFFS=['easy','normal','hard'];
const onlyD=args.find(a=>DIFFS.includes(a)),N=+(args.find(a=>/^\d+$/.test(a))||500),OPT=args.includes('opt');
const FOC=['learn','grind','hustle','balance','people'];

/* ---------- bots ---------- */
const SMART={hobby:['code','music'],allow:['bank'],tuition:['yes','free'],phone1:['wait'],pocket:['fund'],loot:['skip'],teen:['school'],
 summer:['exam'],edu:['uni','dip'],switch:['stay'],cc:['full'],move:['share'],bnpl:['skip'],efund:['build'],nego:['ask'],holiday:['skip'],
 insure:['yes'],lend:['no'],car:['none'],gym:['run'],mlm:['no'],abroad:['go'],phone:['keep'],tip:['skip'],pet:['no'],scam:['no'],
 bonus:['inv'],cert:['mba','cert'],agent:['term'],wed:['reg'],gold:['index'],health:['yes'],home:['buy','small'],rates:['fix'],kids:['k0'],
 edufund:['fund'],biz:['no'],crash:['buy','hold'],layoff:['take'],bubble:['sell','hold'],idle:['inv'],parents:['sib'],divorce:['counsel'],
 roof:['fix'],car2:['keep'],fire:['keep'],pivot:['re'],life:['frugal'],inh:['inv'],ret:['65'],charity:['no'],glide:['mix'],ltc:['yes'],
 travel:['home'],grandkid:['no'],room:['rent'],annuity:['buy'],ret2:['yes'],club:['garden'],downsize:['stay'],medcover:['keep'],
 health2:['priv'],scam2:['check'],will:['will'],hearing:['basic'],reverse:['no'],move2:['stay'],gtrip:['no'],funeral:['none'],
 debt:['sell','cut'],friends:['read'],peer:['old'],trip:['work'],date:['solo'],team:['never'],fwed:['skip'],mentor:['yes'],credit:['talk'],
 network:['follow'],uncle:['no'],sibfees:['no'],cny:['skip'],cosign:['no'],away:['go'],bizpal:['no'],reunion:['skip'],fsick:['visit'],
 carers:['share'],inhfight:['fair'],grandsit:['no'],ill:['best','std'],dep:['ther']};
const pctOf=id=>+String(id).replace(/\D/g,'')||0;
function smartJob(s,os){let best=null,bv=-1;for(const o of os){const c=E.CAR[o.id];if(c.tiers||c.own||c.vol||c.mkt)continue;const v=E.carStartPay(s,o.id);if(v>bv){bv=v;best=o.id}}return best||os[0].id}
const BOTS={
 smart:{pick(s,ev,os){if(ev.id==='job')return smartJob(s,os);
   if(ev.id==='save'||ev.id==='scheme'||ev.id==='save2')return os.reduce((b,o)=>pctOf(o.id)>pctOf(b.id)?o:b).id;
   for(const id of SMART[ev.id]||[])if(os.some(o=>o.id===id))return id;return ev.def},
  focus:s=>s.age<30?'learn':'balance'},
 random:{pick:(s,ev,os)=>os[Math.floor(E.mb(E.hsh(s.seed,'rb',ev.id,s.age))()*os.length)].id,
  focus(s){const r=E.mb(E.hsh(s.seed,'rf',s.age));return r()<.25?FOC[Math.floor(r()*5)]:null}},
 default:{pick:(s,ev)=>ev.def,focus:()=>null}};
/* mixed: each life has its own care level c (0 = reckless, 1 = careful): the smart choice with chance c, a random one with
   chance (1 - c) / 2, otherwise the default; the focus follows the same mix */
const care=s=>E.mb(E.hsh(s.seed,"care"))();
const mix=(s,k)=>{const u=E.mb(E.hsh(s.seed,"mx",k,s.age))(),c=care(s);return u<c?"smart":u<c+(1-c)/2?"random":"default"};
BOTS.mixed={pick:(s,ev,os)=>BOTS[mix(s,ev.id)].pick(s,ev,os),focus:s=>BOTS[mix(s,"focus")].focus(s)};

/* ---------- playing a life ---------- */
const open=(s,ev)=>E.evOpts(s,ev).filter(o=>o.ok===undefined||o.ok===true);
function pickCountry(seed){const tot=E.C.reduce((a,c)=>a+c[2],0);let u=E.mb(E.hsh(seed,'country'))()*tot;for(let i=0;i<E.C.length;i++){u-=E.C[i][2];if(u<=0)return i}return 0}
function born(seed,dk){return E.newLife(pickCountry(seed),seed,undefined,dk)}
/* plays on until death; `hook(s, ev, options)` sees every decision before it is made; `rec` collects setbacks */
function play(s,bot,hook,rec){let g=0;
 const L=rec?(m)=>{if(m&&SETBACK[m.k])rec[SETBACK[m.k]]=1}:null;
 while(!s.dead&&g++<130){
  let k=0,ev;while(!s.dead&&(ev=E.dueEvents(s)[0])&&k++<40){
   if(ev.pre&&!s['pre_'+ev.id]){ev.pre(s);s['pre_'+ev.id]=1}
   const os=open(s,ev);if(hook&&os.length>1)hook(s,ev,os);E.applyOpt(s,ev,bot.pick(s,ev,os))}
  if(s.dead)break;
  if(s.age>=18&&!s.retired){const f=bot.focus(s);if(f)s.focus=f}
  const nw0=E.netWorth(s);E.tick(s,E.yearRand(s.seed,s.age),L);
  if(rec){const nw=E.netWorth(s),B=s.base;if(nw0>0&&nw0-nw>=Math.max(B,nw0/3))rec.crash=1;if(s.debt>=1.5*B)rec.debt=1}}
 if(rec&&s.done.ill)rec.ill=1;return s}
/* serious setbacks: an involuntary layoff (or the job automated), a serious illness, a year that wipes out a third of your
   net worth (at least a year of typical wage), or credit debt of 1.5 years of typical wage. Others are counted for interest */
const SERIOUS=['layoff','ill','crash','debt'];
const SETBACK={'log.laidOff':'layoff','log.car.auto':'layoff','log.divorce':'divorce','log.bizFail':'biz','log.car.fail':'biz','log.broke':'broke'};

/* ---------- summaries ---------- */
const med=a=>{const b=a.slice().sort((x,y)=>x-y);return b.length?b[b.length>>1]:0};
const pc=(n,d)=>d?Math.round(100*n/d)+'%':'-';
const money=v=>{const a=Math.abs(v),s=v<0?'-':'';return a>=1e6?s+'$'+(a/1e6).toFixed(1)+'M':a>=1e3?s+'$'+Math.round(a/1e3)+'k':s+'$'+Math.round(a)};
function bots(dk,n){const R={smart:[],random:[],default:[],mixed:[]};
 for(let i=0;i<n;i++){const seed=E.hsh('bal',i)>>>0;
  for(const b in R){const rec={},s=play(born(seed,dk),BOTS[b],null,rec),sc=E.lifeScore(s);
   R[b].push({nw:E.netWorth(s),nwB:E.netWorth(s)/s.base,mean:s.acc.an?s.acc.nw/s.acc.an:0,sc,age:s.deathAge,illD:!!s.illDeath,rec,any:SERIOUS.some(k=>rec[k])})}}
 return R}
function report(dk,R){
 console.log(`\n=== ${dk.toUpperCase()} · ${R.smart.length} lives per bot ===`);
 console.log('bot      median NW  NW/wage  avg wage-yrs  happy health  rel  score  grade S/A/B/C/D    to 65  ill death  serious setback');
 for(const b in R){const r=R[b],g={S:0,A:0,B:0,C:0,D:0};for(const x of r)g[x.sc.grade]++;
  console.log(`${b.padEnd(8)} ${money(med(r.map(x=>x.nw))).padStart(9)} ${med(r.map(x=>x.nwB)).toFixed(1).padStart(8)} ${med(r.map(x=>x.mean)).toFixed(1).padStart(13)}  ${med(r.map(x=>x.sc.happy)).toFixed(0).padStart(5)} ${med(r.map(x=>x.sc.health)).toFixed(0).padStart(6)} ${med(r.map(x=>x.sc.rel)).toFixed(0).padStart(4)} ${med(r.map(x=>x.sc.total)).toFixed(1).padStart(6)}  ${['S','A','B','C','D'].map(k=>pc(g[k],r.length)).join('/').padEnd(19)} ${pc(r.filter(x=>x.age>=65).length,r.length).padStart(5)} ${pc(r.filter(x=>x.illD).length,r.length).padStart(10)} ${pc(r.filter(x=>x.any).length,r.length).padStart(8)}`)}
 const n=R.smart.length,win=(a,b,f)=>R[a].filter((x,i)=>f(x)>f(R[b][i])).length;
 console.log(`smart beats random: ${pc(win('smart','random',x=>x.sc.total),n)} by life score, ${pc(win('smart','random',x=>x.nwB),n)} by final net worth, ${pc(win('smart','random',x=>x.mean),n)} by average net worth`);
 console.log(`smart beats default: ${pc(win('smart','default',x=>x.sc.total),n)} by life score, ${pc(win('smart','default',x=>x.nwB),n)} by final net worth`);
 const kinds=SERIOUS.concat(['divorce','biz','broke']);
 for(const b in R)console.log(`setbacks, ${b}: `+kinds.map(k=>k+' '+pc(R[b].filter(x=>x.rec[k]).length,R[b].length)).join(', ')+` · serious (first four) ${pc(R[b].filter(x=>x.any).length,R[b].length)}`);
}

/* ---------- which option is best ---------- */
const PARTS=['money','happy','health','rel'];
function optionStudy(dk,n,only,verbose){const st={},TOL=.005,W=vm.runInContext('GR.w',ctx);
 for(let i=0;i<n;i++){const seed=E.hsh('opt',i)>>>0;
  play(born(seed,dk),BOTS.mixed,(s,ev,os)=>{if(only&&!only.includes(ev.id))return;
   const sc=os.map(o=>{const c=E.clone(s);E.applyOpt(c,ev,o.id);return E.lifeScore(play(c,BOTS.mixed),1)});
   const tot=sc.map(x=>x.total),mx=Math.max(...tot),w=os.filter((o,j)=>tot[j]>=mx-TOL);
   const e=st[ev.id]||(st[ev.id]={n:0,o:{}});e.n++;const avg=k=>sc.reduce((a,x)=>a+(k==='total'?x.total:W[k]*x.raw[k]),0)/sc.length;
   const mean={total:avg('total')};for(const k of PARTS)mean[k]=avg(k);
   os.forEach((o,j)=>{const k=ev.id==='job'?'fam:'+E.CAR[o.id].f:o.id,x=e.o[k]||(e.o[k]={n:0,w:0,seen:-1,d:{total:0,money:0,happy:0,health:0,rel:0},m:0,gap:[]});x.gap.push(tot[j]-Math.max(...tot.filter((v,i)=>i!==j)));
    if(x.seen!==e.n){x.seen=e.n;x.n++}x.m++;x.d.total+=tot[j]-mean.total;for(const p of PARTS)x.d[p]+=W[p]*sc[j].raw[p]-mean[p]});
   if(ev.id==='job'){const fams=new Set(w.map(o=>'fam:'+E.CAR[o.id].f));for(const f of fams)e.o[f].w+=1/fams.size}
   else for(const o of w)e.o[o.id].w+=1/w.length})}
 const rows=Object.entries(st).map(([id,e])=>{const os=Object.entries(e.o).map(([k,x])=>{const g=x.gap.slice().sort((a,b)=>a-b);return{k,share:x.w/x.n,n:x.n,d:x.d,m:x.m,need:Math.max(0,-g[Math.floor(.85*(g.length-1))])}});const big=os.filter(o=>o.n>=20);return{id,n:e.n,os,min:big.length>1?Math.min(...big.map(o=>o.share)):1}}).sort((a,b)=>a.min-b.min);
 console.log(`
=== BEST OPTION · ${dk.toUpperCase()} · ${n} mixed-bot lives (share of lives where each option was best, among lives that could pick it) ===`);
 for(const r of rows){console.log(`${(r.min>=.15?'  ok ':r.min>=.1?'  ~  ':'  LOW').padEnd(6)}${r.id.padEnd(9)} n=${String(r.n).padEnd(5)} ${r.os.map(o=>o.k+' '+Math.round(100*o.share)+'%'+(o.n<20?' (only '+o.n+' lives)':o.share<.15?' (needs +'+o.need.toFixed(3)+')':'')).join(' · ')}`);
  if(verbose)for(const o of r.os)console.log('        '+o.k.padEnd(8)+['total'].concat(PARTS).map(p=>p+' '+(o.d[p]/o.m).toFixed(2)).join('  '))}
 const ok=rows.filter(r=>r.min>=.15).length,near=rows.filter(r=>r.min>=.1).length;
 console.log(`${ok} of ${rows.length} decisions have every option best in at least 15% of lives (${near} at 10% or more); options seen in fewer than 20 lives are not judged`);
 return rows}

module.exports={E,BOTS,play,born,bots,report,optionStudy};
if(require.main===module){const t0=Date.now();
 for(const dk of onlyD?[onlyD]:DIFFS)report(dk,bots(dk,N));
 if(OPT)optionStudy(onlyD||'normal',Math.min(N,300),(args.find(a=>a.startsWith('only='))||'').slice(5).split(',').filter(Boolean).length?(args.find(a=>a.startsWith('only='))).slice(5).split(','):null,args.includes('v'));
 console.log(`\n(${((Date.now()-t0)/1000).toFixed(1)} s)`)}
