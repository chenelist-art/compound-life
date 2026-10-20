/* A Second Chance game UI: birth, the yearly loop, decisions (each one a tarot card), passbook, chart and the end card.
   All text goes through t()/tr() from js/i18n.js, so switching language re-renders everything. */
(function(){
const $=q=>document.querySelector(q);
const G={slotMode:null,th:{}};
const SPEEDS=[900,450,180];
let speedI=0;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const tok=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const FOCUS=['learn','grind','hustle','balance','people'];
const SRC=['child','school','edu','learn','cert','pivot','startup'];
const TH=[1,3,10,30,100,300];
const store={get(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const esc=x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cls=v=>v>.5?'gain':v<-.5?'loss':'';
const trE=x=>esc(tr(x));
Art.decorate();

/* ---------- setup ---------- */
const sel=$('#country');
function fillCountries(){const cur=sel.value||String(C.findIndex(c=>c[1]==='MY'));sel.innerHTML='';
  C.map((c,i)=>[I18N.cname(i),i]).sort((a,b)=>a[0].localeCompare(b[0],I18N.locale())).forEach(([n,i])=>{const o=document.createElement('option');o.value=i;o.textContent=n;sel.appendChild(o)});sel.value=cur}
fillCountries();
document.querySelectorAll('input[name="bp"]').forEach(r=>r.addEventListener('change',()=>{$('#countryWrap').hidden=!$('#bp-pick').checked}));
function setSpeed(i){speedI=i;document.querySelectorAll('#pace0 button,#pace button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.sp===i)));store.set('cl-speed',i);if(G.s)schedule()}
document.querySelectorAll('#pace0 button,#pace button').forEach(b=>b.addEventListener('click',()=>setSpeed(+b.dataset.sp)));
const sv=store.get('cl-speed');if(typeof sv==='number')setSpeed(sv);
/* difficulty: easy shows projections before you choose, normal shows a hindsight card after, hard reveals everything on the end card */
const DIFF=['easy','normal','hard'],HIND_MS=7000;
let diff='normal';
function setDiff(d){diff=d;document.querySelectorAll('#diff0 button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.df===d)));document.querySelectorAll('[data-dn]').forEach(el=>{el.hidden=el.dataset.dn!==d});store.set('cl-diff',d)}
document.querySelectorAll('#diff0 button').forEach(b=>b.addEventListener('click',()=>setDiff(b.dataset.df)));
setDiff(DIFF.includes(store.get('cl-diff'))?store.get('cl-diff'):'normal');
function pickCountry(){const tot=C.reduce((a,c)=>a+c[2],0);let u=Math.random()*tot;for(let i=0;i<C.length;i++){u-=C[i][2];if(u<=0)return i}return 0}
/* "Let me choose" picks the country and, if you like, girl or boy; otherwise both are drawn (sex from the country's sex ratio at birth) */
$('#born').addEventListener('click',()=>{const pk=$('#bp-pick').checked;reveal(pk?+sel.value:pickCountry(),pk&&$('#sex').value||undefined)});
function renderPast(){const p=store.get('cl-past')||[];$('#pastwrap').hidden=!p.length;
  $('#past').innerHTML=p.slice(0,5).map(x=>{const ci=x.ci!=null?x.ci:C.findIndex(c=>c[0]===x.c);return `<li><span>${esc(t('g.pastItem',{c:ci>=0?I18N.cname(ci):x.c,a:x.age}))}</span><span class="num ${cls(x.nw)}">${x.g?`<b class="pgrade">${esc(x.g)}</b>`:''}${fm(x.nw)}</span></li>`}).join('')}
renderPast();
function setupBg(){Guilloche.render($('#setupRosette'),Object.assign({},Guilloche.MOON,{phase:.6}))}
setupBg();

let R=null;
function revealText(){if(!R)return;const{ci,life}=R;$('#rname').textContent=I18N.cname(ci);
  $('#rfam').textContent=t('g.bornR',{x:M('sex.kid.'+life.sex),fam:M('fam.'+life.fam)});
  $('#rmeta').textContent=t('g.rmeta',{a:MN(life.base),le:life.le,h:C[ci][5]})}
function reveal(ci,sex){
  const seed=(Math.random()*4294967296)>>>0;const life=newLife(ci,seed,sex,diff);R=null;
  $('#setupForm').hidden=true;$('#roulette').hidden=false;$('#rgo').hidden=true;
  const nm=$('#rname');nm.classList.remove('landed');$('#rfam').textContent='';$('#rmeta').textContent='';
  const total=reduce?0:20;let k=0;
  const step=()=>{
    if(k<total){let n;do{n=I18N.cname(Math.floor(Math.random()*C.length))}while(n===nm.textContent);nm.textContent=n;k++;setTimeout(step,30+k*k*.4);return}
    R={ci,life};nm.classList.add('landed');revealText();
    $('#rgo').hidden=false;$('#rgo').focus({preventScroll:true});
  };
  step();
  $('#rgo').onclick=()=>startLife(ci,seed,life.sex);
}
function backToSetup(){closeReplay(true);closeMoment();G.moq=[];G.moThen=null;clearTimeout(G.timer);clearTimeout(G.hindT);G.hind=null;G.s=null;R=null;$('#game').hidden=true;$('#gstat').hidden=true;$('#gctrlLive').hidden=true;$('#setup').hidden=false;$('#setupForm').hidden=false;$('#roulette').hidden=true;renderPast();setupBg();window.scrollTo(0,0)}

/* ---------- life loop ---------- */
function startLife(ci,seed,sex){
  Object.assign(G,{ci,s:newLife(ci,seed,sex,diff),t:newLife(ci,seed,sex,diff),foc:{},lcArm:null,ea:{},mirror:null,hs:[[0,0]],ht:[[0,0]],marks:[],log:[],playing:true,pending:null,ended:false,proj:null,nextF:null,pix:{},cheer:0,wasM:false,nKids:0,moq:[],mom:null,moThen:null,salPrev:0,promoAt:null,hover:null,slotMode:null,th:{},mode:diff,hind:null,hinds:[],peers:null,peakInc:0,dec:[]});
  const s=G.s;G.t.auto=true;G.snapS=snap(s);
  addLog(M('log.born',{c:{k:'_c',ci},fam:M('fam.'+s.fam)}),'good');
  addLog(M('log.wage',{a:MN(s.base),le:s.le}),'');
  $('#noteSerial').textContent='SC '+(seed>>>0).toString(16).toUpperCase().padStart(8,'0');
  $('#setup').hidden=true;$('#game').hidden=false;$('#gstat').hidden=false;$('#gctrlLive').hidden=false;
  buildFocus();buildLife();window.scrollTo(0,0);render();schedule();
}
/* country names inside stored messages are resolved when shown */
const rx=x=>{if(x&&typeof x==='object'&&x.k==='_c')return I18N.cname(x.ci);if(x&&typeof x==='object'&&x.k&&x.v){const v={};for(const n in x.v)v[n]=(x.v[n]&&x.v[n].k==='_c')?I18N.cname(x.v[n].ci):x.v[n];return t(x.k,v)}return tr(x)};
/* big moments that make the pixel character jump with sparkles (a wedding or a new baby gets hearts instead) */
const CHEER=new Set(['log.grad','log.promo','log.ring','log.car.trained','log.car.up','log.car.ok','log.car.exit']);
function addLog(m,k,a){G.log.push({a:a===undefined?G.s.age:a,m,k:k||''});if(G.log.length>400)G.log.shift();if(m&&CHEER.has(m.k))G.cheer=G.cheer||'yay';if(m&&MOMENT[m.k])moment(MOMENT[m.k],m);else if(m&&SMALL.has(m.k))toast(m)}
function resolveTwin(){const tw=G.t;if(tw.dead)return;let g=0,ev;while((ev=dueEvents(tw)[0])&&g++<30){const id=ev.mirror&&G.s.done[ev.id]?G.s.done[ev.id]:ev.def;applyOpt(tw,ev,id)}}
function recordTh(){const s=G.s,a=s.dead?s.deathAge+1:s.age;for(const id in s.trk){const v=trkView(s,s.trk[id]).v;const h=G.th[id]||(G.th[id]=[]);if(h.length&&h[h.length-1][0]===a)h[h.length-1][1]=v;else h.push([a,v])}}
function advance(){
  const s=G.s;if(!s||G.ended||G.pending||G.hind||G.mom)return 'stop';
  const ev=dueEvents(s)[0];if(ev){showDecision(ev);return 'ev'}
  /* a new focus picked during the year starts now */
  if(G.nextF&&s.age>=18&&!s.retired){s.focus=G.nextF;G.nextF=null;addLog(M('log.focus',{x:M('f.'+s.focus)}),'choice')}
  resolveTwin();const a=s.age,yr=yearRand(s.seed,a);G.foc[a]=s.focus;G.ea[a]=s.earned;G.salPrev=salary(s);
  if(a===6)addLog(M('log.school'),'',a);
  const out=tick(s,yr,(m,k)=>addLog(m,k,a));s.lastInc=out.gross;if(out.gross>G.peakInc)G.peakInc=out.gross;
  if(!G.t.dead){tick(G.t,yr,null);G.ht.push([G.t.dead?G.t.deathAge+1:G.t.age,netWorth(G.t)])}
  G.hs.push([s.dead?a+1:s.age,netWorth(s)]);recordTh();
  if(a>=18&&out.gross>0)addLog(out.saved>=0?M('log.incSave',{a:MN(out.gross),b:MN(out.saved)}):M('log.incOver',{a:MN(out.gross),b:MN(-out.saved)}),'year',a);
  checkMilestones();lifeMoments();
  if(s.dead){G.moq=[];endLife();return 'end'}
  if(flushMoments(()=>{render();schedule()}))return 'moment';
  return 'ok';
}
function schedule(){clearTimeout(G.timer);if(!G.s||!G.playing||G.pending||G.hind||G.ended||G.mom||G.lcArm)return;const d=G.s.age<12?Math.min(160,SPEEDS[speedI]/3):SPEEDS[speedI];G.timer=setTimeout(()=>{const r=advance();if(r==='ok'){render();schedule()}},d)}
function skipAhead(){if(G.hind)endHind();if(G.pending||G.ended||G.mom)return;clearTimeout(G.timer);let g=0,r;do{r=advance()}while(r==='ok'&&g++<150);if(r==='ok'){render();schedule()}}
function showDecision(ev){
  const s=G.s;clearTimeout(G.timer);
  if(ev.pre&&!s['pre_'+ev.id]){ev.pre(s);s['pre_'+ev.id]=1;if(ev.preLog)addLog(ev.preLog(s),'bad');recordTh()}
  /* a crash, a serious illness or an inheritance shows as a big moment before its decision */
  if(MO_EV[ev.id]&&!s['mo_'+ev.id]){s['mo_'+ev.id]=1;const k=ev.id;moment(k,k==='crash'?ev.preLog(s):k==='ill'?M('mo.ill.x'):ev.text(s),k==='ill'?M('mo.ill.'+s.illType+'.t'):null)}
  if(flushMoments(()=>showDecision(ev)))return;
  G.pending=ev;G.proj=null;render();
  setTimeout(()=>{if(G.pending!==ev)return;const P=G.proj=Object.assign(projBegin(s,ev,40),{ev});fillProj();
    const step=()=>{if(G.pending!==ev||G.proj!==P||!P.todo.length)return;projNext(s,ev,P);fillProj();setTimeout(step,0)};setTimeout(step,0)},60);
  const el=$('#slot');const top=el.getBoundingClientRect().top;
  if(top<70||top>window.innerHeight*.7)window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-84,behavior:reduce?'auto':'smooth'});
}
function choose(id){
  const ev=G.pending;if(!ev)return;const s=G.s;
  /* the 40 futures are worked out from the moment before you choose; they are kept for the hindsight card and the end card */
  const P=G.proj&&G.proj.ev===ev?G.proj:Object.assign(projBegin(s,ev,40),{ev}),os=evOpts(s,ev),age=s.age;
  while(P.todo.length)projNext(s,ev,P);
  const had=new Set(Object.keys(s.trk));
  const o=applyOpt(s,ev,id);lifeMoments();
  /* kept for the life replay: what you chose, and the passbook lines that choice started */
  /* and every option's typical result from the 40 futures (relative to the default option), for the road not taken */
  G.dec.push({id:ev.id,age,title:ev.title,label:o.label,pick:o.id,def:ev.def,trk:Object.keys(s.trk).filter(k=>!had.has(k)),tgt:P.tgt,
    rows:os.filter(x=>P.res[x.id]).map(x=>{const r=P.res[x.id];return{id:x.id,label:x.label,med:r.base?0:r.med,alive:r.alive}})});
  addLog(M('log.chose',{x:o.label}),'choice');if(o.id!==ev.def)G.marks.push({a:s.age,t:ev.title});
  const h={id:ev.id,title:ev.title,age,tgt:P.tgt,pick:o.id,rows:os.filter(x=>P.res[x.id]).map(x=>Object.assign({id:x.id,label:x.label},P.res[x.id]))};
  const real=h.rows.length>1;if(real)G.hinds.push(h);
  recordTh();G.pending=null;
  if(G.mode==='normal'&&real){showHind(h);return}
  next();
}
function next(){if(flushMoments(next))return;const nx=dueEvents(G.s)[0];if(nx){showDecision(nx);return}render();schedule()}
function showHind(h){G.hind=h;G.hindEnd=Date.now()+HIND_MS;render();const b=$('#hcont');if(b)b.focus({preventScroll:true});clearTimeout(G.hindT);G.hindT=setTimeout(endHind,HIND_MS)}
function endHind(){if(!G.hind)return;clearTimeout(G.hindT);G.hind=null;next()}
function level(nw,B){let L=0;for(const x of TH)if(nw>=x*B)L++;return L}
function checkMilestones(){
  const s=G.s,m=s.milestones;
  for(const id in s.trk){const tk=s.trk[id];if(tk.kind==='skill'&&tk.cost>0&&!m['p_'+id]&&tk.gain>=tk.cost){m['p_'+id]=1;addLog(M('log.paid',{x:tk.label,a:MN(tk.cost)}),'good');toast(M('g.toastPaid',{x:tk.label}))}}
  const nw=netWorth(s);
  for(const x of [1e5,1e6,1e7])if(nw>=x&&!m['n'+x]){m['n'+x]=1;const l=M('ms.'+(x===1e5?'1e5':x===1e6?'1e6':'1e7'));addLog(M('log.nw',{l}),'good');toast(M('g.toastNw',{l}))}
  const L=level(nw,s.base);if(L>(m.ring||0)){m.ring=L;addLog(M('log.ring',{n:TH[L-1]}),'good');toast(M('g.toastRing',{n:TH[L-1]}))}
}
function toast(msg){const el=$('#toast');G.toastMsg=msg;el.textContent=tr(msg);el.hidden=false;el.style.animation='none';void el.offsetWidth;el.style.animation='';clearTimeout(G.tt);G.tt=setTimeout(()=>{el.hidden=true},4200)}
function endLife(){G.ended=true;G.pending=null;clearTimeout(G.timer);const s=G.s;G.peers=bornWithYou();G.mirror=mirrorLife(s,G.foc,s.deathAge);G.grade=lifeScore(s);const p=store.get('cl-past')||[];p.unshift({c:C[s.ci][0],ci:s.ci,age:s.deathAge,nw:Math.round(netWorth(s)),g:G.grade.grade});store.set('cl-past',p.slice(0,12));render();window.scrollTo({top:0,behavior:'auto'});
  /* the farewell card comes first, then the life replay */
  if(moOn){G.moq=[deathMo()];G.moThen=playReplay;showMoment()}else playReplay()}

/* ---------- big moment cards: a flashcard that stops time for the moments that shape a life ---------- */
/* diary lines that are big moments, and the card each one opens (the line under the title is the diary line itself) */
const MOMENT={'log.laidOff':'fired','log.layVol':'package','log.car.auto':'auto','log.bizFail':'bizfail','log.car.fail':'bizfail','log.coinDown':'crypto','log.burst':'burst',
  'log.broke':'broke','log.divorce':'divorce','log.car.injEnd':'injury','log.promo':'promo','log.car.up':'careerup','log.grad':'grad','log.bizOk':'bizup','log.car.ok':'bizup',
  'log.car.exit':'exit','log.child':'child','log.retire':'retired','log.rel.move':'together','log.rel.break':'breakup','log.rel.left':'left','log.rel.try':'trying'};
/* decision cards that open with a big moment: the moment shows first, then the decision */
const MO_EV={crash:1,ill:1,inh:1};
const MO_BAD=new Set(['fired','package','auto','bizfail','crypto','crash','burst','broke','divorce','ill','injury','breakup','left']);
/* moments that bring a partner or a child: hearts instead of sparkles, and the partner walks in */
const LOVE=new Set(['married','child','dating','together']),PT_IN=new Set(['dating']),PT_OUT=new Set(['breakup','left','divorce']);
/* smaller events stay as a toast, so the game isn't stopped every year */
const SMALL=new Set(['log.car.trained','log.car.trainFail','log.loanPaid','log.illRec','log.illOk','log.depEnd','log.layNo','log.bizSold','log.boom','log.boomUp','log.coinUp','log.coinBig','log.car.inj','log.rel.look','log.rel.preg','log.rel.noBaby']);
let moOn=store.get('cl-moments')!==false;
function setMo(on){moOn=on;document.querySelectorAll('#mo0 button').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.mo==='1')===on)));store.set('cl-moments',on)}
document.querySelectorAll('#mo0 button').forEach(b=>b.addEventListener('click',()=>setMo(b.dataset.mo==='1')));
setMo(moOn);
const num=x=>x&&typeof x==='object'&&'m' in x?x.m:0;
/* the money line: a text key with {a} (signed) or {b} (no sign), the amount, and whether it is a gain (pos) or neither (flat) */
function moMoney(kind,m){const s=G.s,v=m&&m.v||{},sal=Math.max(s.lastSal||0,salary(s))||s.base,raise=salary(s)-(G.salPrev||0);
  switch(kind){
    case 'fired':case 'package':return{k:'mo.n.pay6',v:-.5*sal};
    case 'auto':return{k:'mo.n.sev',v:num(v.a)};
    case 'bizfail':return m.k==='log.bizFail'?{k:'mo.n.gone',v:-num(v.a)}:{k:'mo.n.noInc'};
    case 'crypto':return{k:'mo.n.coin',v:num(v.b)-num(v.a)};
    case 'crash':{const m=s.crashM||.62;return s.crashP>1?{k:'mo.n.stock',v:-s.crashP/m*(1-m)}:{k:'mo.n.noStock'}}
    case 'burst':return s.house?{k:'mo.n.home',v:-s.house.value/.7*.3}:{k:'mo.n.noHome'};
    case 'broke':return{k:'mo.n.broke',v:0,flat:1};
    case 'divorce':return{k:'mo.n.div',v:-num(v.a)};
    case 'injury':return{k:'mo.n.sport'};
    case 'hired':return s.job.train>s.age?{k:'mo.n.train',n:s.job.train}:{k:'mo.n.pay',v:salary(s)};
    case 'promo':case 'careerup':return raise>0?{k:'mo.n.raise',v:raise}:null;
    case 'grad':return s.sloan>0?{k:'mo.n.loan',v:-s.sloan}:{k:'mo.n.noLoan'};
    case 'bizup':return m.k==='log.bizOk'?{k:'mo.n.inc',v:num(v.a)}:raise>0?{k:'mo.n.raise',v:raise}:null;
    case 'exit':return{k:'mo.n.cash',v:num(v.a)};
    case 'married':{const w=s.pt&&s.trk['wed'+s.pt.n];return w&&w.spent>0?{k:'mo.n.wed',v:-w.spent}:null}
    case 'dating':return{k:'mo.n.date',v:-.04*s.base};
    case 'together':return ptPay(s)>0?{k:'mo.n.ptPay',v:ptPay(s)}:null;
    case 'breakup':case 'left':return num(v.a)>0?{k:'mo.n.move',v:-num(v.a)}:null;
    case 'trying':return{k:'mo.n.try',v:-.15*s.base};
    case 'child':return{k:'mo.n.kid',v:-.15*s.base};
    case 'inh':return{k:'mo.n.inh',v:inhAmt(s)};
    case 'house':return s.house.pay>0?{k:'mo.n.mort',v:s.house.pay}:null;
    case 'retired':return s.pension>0?{k:'mo.n.pen',v:s.pension}:{k:'mo.n.noPen'};
  }return null}
/* queue a card (one of each kind at a time); with the cards off it is a toast instead, and so is a promotion within three years of the last promotion card */
function moment(kind,line,title){const s=G.s;if(!s||G.ended||G.moq.some(x=>x.kind===kind))return;
  if(['grad','child','dating','together','breakup','left','trying'].includes(kind))line=M('mo.'+kind+'.x');
  const o={kind,tone:MO_BAD.has(kind)?'bad':'good',age:s.age,title:title||M('mo.'+kind+'.t'),line,money:moMoney(kind,line)};
  const up=kind==='promo'||kind==='careerup';if(up&&G.promoAt!=null&&s.age-G.promoAt<3){toast(line);return}
  if(moOn){if(up)G.promoAt=s.age;G.moq.push(o)}else toast(o.title)}
function deathMo(){const s=G.s,nw=netWorth(s);return{kind:'death',tone:'end',age:s.deathAge,title:M('mo.death.t',{a:s.deathAge}),
  line:s.illDeath?M('mo.die.ill',{x:M('ill.'+s.illDeath)}):M(s.deathAge>=Math.max(70,s.le-3)?'mo.die.old':'mo.die.soon'),money:{k:nw<0?'mo.n.debt':'mo.n.leave',v:nw,flat:1}}}
/* moments that show in the life itself rather than in the diary: a wedding, a new job, the last mortgage payment */
const snap=s=>({m:!!s.married,p:s.pt?s.pt.n:0,j:s.job?s.job.tk:null,h:s.house?s.house.mort:-1});
function lifeMoments(){const s=G.s,a=G.snapS||snap(s),b=snap(s);G.snapS=b;
  if(b.p&&b.p!==a.p)moment('dating');
  if(b.m&&!a.m)moment('married',M('mo.married.x'));
  if(b.j&&b.j!==a.j)moment('hired',M(s.job.train>s.age?'mo.hired.tx':'mo.hired.x',{x:M('car.a.'+s.job.id)}));
  if(a.h>=1&&b.h>=0&&b.h<1)moment('house',M('mo.house.x'))}
/* show what's queued, then carry on with `then` */
function flushMoments(then){if(!G.moq.length)return false;G.moThen=then;render();showMoment();return true}
function moHTML(o){const ttl=trE(o.title),mo=o.money;let money='';
  if(mo){const v=mo.v,c=mo.flat||v==null?'':v>0?'gain':v<0?'loss':'',b=x=>`<b class="${c}">${esc(x)}</b>`;
    money=`<p class="mo-m">${esc(t(mo.k,{a:'\u0001',b:'\u0002',n:mo.n})).replace('\u0001',v==null?'':b(fm(v,true))).replace('\u0002',v==null?'':b(fm(Math.abs(v))))}</p>`}
  return Art.card({cls:'mo-card mo-'+o.tone,c:o.tone==='bad'?'mi':o.tone==='end'?'wa':'ya',num:Art.roman(o.age),label:ttl,name:esc(t('mo.k.'+o.tone)),win:Art.momentWin(o.kind,'mo-win'),
    body:`<h2 class="mo-t" id="moT">${ttl}</h2><div class="mo-row"><canvas class="pix pix-mo" width="48" height="48" aria-hidden="true"></canvas><div class="mo-txt"><p class="mo-x">${trE(o.line)}</p>${money}</div></div>
    <div class="mo-go"><button class="btn btn-accent" id="moGo" type="button">${esc(t(o.tone==='end'?'mo.end.go':'g.cont'))} <span class="arr">→</span></button><span class="muted mo-key">${esc(t('mo.key'))}</span></div>`})}
/* the pixel character matches the moment: sad (dizzy when ill, sweating when broke), celebrating, or at peace */
function moPose(o){const ps=Object.assign({},Pixel.stateOf(G.s));
  if(o.tone==='end')ps.sleep=true;
  else if(o.tone==='bad'){ps.face=o.kind==='ill'?'sick':'sad';if(o.kind==='ill')ps.ill='gown';if(o.kind==='broke')ps.emote='sweat'}
  else ps.face='happy';
  /* the partner walks in for a new love, and walks away at a break-up or a divorce */
  if(PT_IN.has(o.kind))Object.assign(ps,{partner:true,pmove:'in'});else if(PT_OUT.has(o.kind))Object.assign(ps,{partner:true,pmove:'out'});
  return ps}
function paintMoment(){const o=G.mom,el=$('#moment');if(!o||!el)return;el.dataset.kind=o.kind;el.innerHTML=moHTML(o);
  const cv=el.querySelector('.pix-mo');Pixel.set(cv,moPose(o));clearInterval(G.moCheer);
  if(o.tone==='good'){const k=LOVE.has(o.kind)?'love':'yay';Pixel.cheer(cv,k);if(!reduce)G.moCheer=setInterval(()=>Pixel.cheer(cv,k),2600)}
  $('#moGo').onclick=endMoment}
function showMoment(){G.mom=G.moq.shift();clearTimeout(G.timer);let el=$('#moment');
  if(!el){el=document.createElement('div');el.id='moment';el.className='moment';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','moT');document.body.appendChild(el)}
  for(const c of document.body.children)if(c!==el)c.inert=true;
  el.hidden=false;paintMoment();$('#moGo').focus({preventScroll:true})}
function closeMoment(){clearInterval(G.moCheer);G.mom=null;const el=$('#moment');if(!el)return;el.hidden=true;el.innerHTML='';for(const c of document.body.children)c.inert=false}
function endMoment(){if(!G.mom)return;if(G.moq.length){clearInterval(G.moCheer);showMoment();return}closeMoment();const f=G.moThen;G.moThen=null;if(f)f()}

/* ---------- rendering ---------- */
function phase(s){return s.age<18?'child':s.retired?'ret':'adult'}
function render(){
  const s=G.s,tw=G.t;
  const age=s.dead?s.deathAge:s.age;
  $('#age').textContent=age;
  const job=s.study?t('g.studying',{x:s.study.label}):s.retired?t('g.retired'):(s.biz&&s.biz.mode==='full'&&s.biz.ok&&!s.biz.sold)?t('g.biz'):s.job?jobTxt(s):s.age<18?t('g.child'):'';
  $('#where').textContent=t('g.where',{c:I18N.cname(s.abroad!=null?s.abroad:s.ci),s:M((s.age<18?'sex.kid.':'sex.')+s.sex),f:M('famS.'+s.fam),j:job?' · '+job:''});
  const nw=netWorth(s),tv=netWorth(tw);
  $('#nw').textContent=fm(nw);$('#nw').className='nw'+(nw<0?' loss':'');window.fitText&&fitText($('#nw'));
  $('#nwsub').innerHTML=(s.age>=18?esc(t('g.income',{a:MN(s.lastInc)})):'')+esc(t('g.twin',{a:MN(tv)}));
  $('#rkW').textContent=rankWorld(nw);$('#rkC').textContent=rankCountry(nw);
  /* health conditions that are active right now */
  $('#conds').innerHTML=s.dead?'':[[sick(s),'rec'],[depressed(s),'dep']].filter(c=>c[0]).map(c=>`<span class="cond c-${c[1]}">${esc(t('cond.'+c[1]))}</span>`).join('');
  $('#note').style.setProperty('--shift',Math.min(100,age)/100);
  $('#nwNum').textContent=Art.roman(age);
  $('#nwName').textContent=t(s.retired||s.dead?'tn.king':s.age<18?'tn.page':'tn.knight');
  /* the pixel character: this year's look, kept per age for the replay; it jumps at a wedding and other big moments */
  const ps=Pixel.stateOf(s);G.pix[age]=ps;Pixel.set($('#pix'),ps);
  const nk=s.kids.filter(b=>b<=s.age).length;if((s.married&&!G.wasM)||nk>G.nKids)G.cheer='love';G.wasM=s.married;G.nKids=nk;if(G.cheer&&!s.dead)Pixel.cheer($('#pix'),G.cheer);G.cheer=0
  const sk=skill(s);$('#skv').textContent=Math.round(sk);$('#skb').style.width=clamp(sk,0,100)+'%';$('#skx').textContent=t('g.skx',{p:Math.round(SK*sk*100)});
  $('#hev').textContent=Math.round(s.health);$('#heb').style.width=s.health+'%';$('#hav').textContent=Math.round(s.happy);$('#hab').style.width=s.happy+'%';$('#rev').textContent=Math.round(s.rel);$('#reb').style.width=s.rel+'%';
  $('#chips').innerHTML=SRC.filter(k=>(s.skillSrc[k]||0)>=.5).map(k=>{const v=s.skillSrc[k];const name=k==='edu'&&s.trk.sk_edu?tr(s.trk.sk_edu.label):t('src.'+k);return `<span class="chip"><b>${esc(name)}</b> ${esc(t('g.chipSk',{n:Math.round(v)}))} · <span class="gain">${esc(t('g.chipPay',{p:Math.round(SK*v*100)}))}</span></span>`}).join('');
  const L=level(nw,s.base);
  $('#sealcap').textContent=L<6?t('g.ring',{n:L,a:MN(TH[L]*s.base)}):t('g.ringAll');
  drawSeal($('#seal'),nw,s.base,age,s.dead);
  $('#play').textContent=t(G.playing?'g.pause':'g.play');$('#play').disabled=G.ended;$('#skip').disabled=G.ended||!!G.pending;
  renderSlot();updFocus();updLife();drawChart();renderLedger();renderLog();
}
/* the career in the header: "Nurse · level 2", "Doctor, in training", or just the name where there are no levels */
function jobTxt(s){const j=M('car.'+s.job.id);return s.job.train>s.age?t('g.train',{j}):CAR[s.job.id].gr>0?t('g.joblvl',{j,n:s.level}):t('g.job1',{j})}
/* where you stand: world and country wealth ranks from the data in engine.js */
const pctTxt=p=>p>=99.95?'99.9':p>=99?p.toFixed(1):String(Math.max(1,Math.round(p)));
function rankWorld(nw,ci){const p=worldPct(ci==null?G.s.ci:ci,nw);return p<=0?t('g.rkWorld0'):t('g.rkWorld',{p:pctTxt(p)})}
function rankCountry(nw,ci){ci=ci==null?G.s.ci:ci;const p=countryPct(ci,nw),c=I18N.cname(ci);if(p>=50){const top=100-p;return t('g.rkTop',{p:top<1?Math.max(.1,top).toFixed(1):String(Math.round(top)),c})}return t('g.rkBottom',{p:String(Math.max(1,Math.round(p))),c})}
/* four other babies born in the same second: random countries weighted by births, same rules, default choices */
function bornWithYou(){const s=G.s,tot=C.reduce((a,c)=>a+c[2],0),out=[];
  for(let i=0;i<4;i++){let u=mb(hsh(s.seed,'peer',i))()*tot,ci=0;for(;ci<C.length-1;ci++){u-=C[ci][2];if(u<=0)break}
    const p=newLife(ci,hsh(s.seed,'peerSeed',i),undefined,s.dk);p.auto=true;let g=0,top=0,topAge=0;while(!p.dead&&g++<130){resolveAuto(p);tick(p,yearRand(p.seed,p.age),null);const v=netWorth(p);if(v>top){top=v;topAge=p.dead?p.deathAge:p.age}}
    out.push({ci,fam:p.fam,sex:p.sex,age:p.deathAge,nw:netWorth(p),top,topAge})}
  return out}
/* a sun with one scalloped ring per wealth level; it falls asleep (a moon) when the life ends */
const RING=[.44,.57,.69,.8,.89,.96],RINGC=['mizu','wakatake','yamabuki','coral','washi','mizu'];
function sealCfg(nw,B,age,end){
  const L=level(nw,B),neg=nw<0,bands=[],guides=[];
  for(let i=RING.length-1;i>=0;i--){if(i<L)bands.push({r:RING[i]-.02,a:.02,p:12+i*4,fill:RINGC[i],dir:i%2?1:-1});else guides.push({r:RING[i]})}
  return{bands,guides,core:{r:.33,fill:neg?'coral':'yamabuki',face:end?'sleep':neg?'sad':'happy',craters:!!end},phase:age*.06};
}
function drawSeal(cv,nw,B,age,end){Guilloche.render(cv,sealCfg(nw,B,age,end))}
function renderSlot(force){
  const el=$('#slot'),s=G.s;const mode=G.ended?'end':G.pending?`ev:${G.pending.id}:${s.age}`:G.hind?'hind:'+G.hinds.length:'idle:'+phase(s);
  if(force||mode!==G.slotMode){G.slotMode=mode;
    if(G.ended){el.innerHTML=endHTML();
      $('#again').onclick=()=>{backToSetup();reveal(pickCountry())};
      $('#same').onclick=()=>{backToSetup();reveal(G.ci)};
      $('#home').onclick=()=>backToSetup();
      $('#replay').onclick=()=>playReplay();
      $('#copy').onclick=()=>{const txt=$('#share').textContent;const b=$('#copy');const ok=()=>{b.textContent=t('g.copied');setTimeout(()=>b.textContent=t('g.copy'),1800)};
        try{navigator.clipboard.writeText(txt).then(ok,()=>selectShare())}catch(e){selectShare()}};
      drawSeal($('#certSeal'),netWorth(s),s.base,s.deathAge,true);Pixel.set($('#pixEnd'),Pixel.stateOf(s));window.fitAll&&fitAll();
    }else if(G.pending){el.innerHTML=slipHTML(G.pending);el.querySelectorAll('.opt:not([disabled])').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.id)))}
    else if(G.hind){el.innerHTML=hindHTML(G.hind);$('#hcont').onclick=endHind}
    else el.innerHTML=idleHTML(phase(s));
  }
  if(G.pending)fillProj();else if(!G.ended&&!G.hind)updIdle()
}
function selectShare(){const r=document.createRange();r.selectNodeContents($('#share'));const sl=getSelection();sl.removeAllRanges();sl.addRange(r);$('#copy').textContent=t('g.ctrlc')}
/* in Easy, an option's text also gets its hint (skill, pay %, odds); otherwise you only see what you'd know in real life */
function withHint(a,h){return G.mode==='easy'&&h?tr(a)+(I18N.lang==='en'?' ':'')+tr(h):tr(a)}
function slipHTML(ev){
  const s=G.s,os=evOpts(s,ev),easy=G.mode==='easy';
  const keys=`<span class="kbd">1</span>–<span class="kbd">${os.length}</span>`;
  return Art.card({cls:'slip',c:Art.frame(ev.id),num:Art.num(ev.id),label:trE(ev.title),name:esc(t('tn.'+ev.id)),win:Art.win(ev.id,'slip-win'),body:`
  <div class="slip-top"><span class="stamp">${esc(t('g.decAge',{a:s.age}))}</span><span class="payto">${esc(t('g.payto'))}</span></div>
  <h2>${trE(ev.title)}</h2><p class="slip-text">${esc(withHint(ev.text(s),ev.hint&&ev.hint(s)))}</p>
  <div class="opts${easy?'':' blind'}${os.length>8?' many':''}">${os.map((o,i)=>{const dis=o.ok!==undefined&&o.ok!==true;return `${o.grp&&o.grp!==(os[i-1]||{}).grp?`<h4 class="ogrp">${esc(t('car.f.'+o.grp))}</h4>`:''}<button class="opt" type="button" data-id="${o.id}"${dis?' disabled':''}><span class="okey" aria-hidden="true">${i+1}</span><span class="ot"><span class="ol">${trE(o.label)}${o.id===ev.def?`<span class="tag">${esc(t('g.default'))}</span>`:''}</span><span class="os">${dis?trE(o.ok):esc(withHint(o.sub,o.hint))}</span></span>${easy?`<span class="op" id="op-${o.id}">${dis?'':`<span class="pv muted">…</span><span class="pr">${esc(t('g.simulating'))}</span>`}</span>`:''}</button>`}).join('')}</div>
  ${ev.care?`<p class="slip-care">${trE(ev.care)}</p>`:''}
  <div class="slip-foot"><span id="projlbl">${esc(t(easy?'g.sim40':G.mode==='hard'?'g.footH':'g.footN'))}</span><span>${t('g.press',{k:keys})}</span></div>`});
}
/* a range bar: the line is zero, the pill is the middle 80% of futures, the dot is the typical one */
function scaleOf(rows){let mn=0,mx=0;for(const r of rows){if(r.base)continue;mn=Math.min(mn,r.lo);mx=Math.max(mx,r.hi)}if(mx-mn<1)mx=mn+1;return v=>((v-mn)/(mx-mn)*100).toFixed(2)+'%'}
/* a serious illness: the share of futures that survived comes first (r.alive), money second */
const aliveTxt=r=>t('g.alive',{p:Math.round(r.alive*100)});
function valHTML(r,B){if(r.alive!=null)return{c:r.base?'':cls(r.med),v:`<span class="pv">${esc(aliveTxt(r))}</span>`};if(r.base)return{c:'',v:`<span class="pv muted">${esc(t('g.baseline'))}</span>`};const flat=Math.abs(r.med)<.03*B,c=flat?'':cls(r.med);return{c,v:`<span class="pv ${c}">${flat?esc(t('g.same')):fm(r.med,true)}</span>`}}
function barHTML(r,X,c){return r.base?`<span class="rbar"><span class="rb-zero" style="left:${X(0)}"></span><span class="rb-med" style="left:${X(0)}"></span></span>`:`<span class="rbar ${c}"><span class="rb-zero" style="left:${X(0)}"></span><span class="rb-range" style="left:${X(r.lo)};width:calc(${X(r.hi)} - ${X(r.lo)})"></span><span class="rb-med" style="left:${X(r.med)}"></span></span>`}
function fillProj(){
  const P=G.proj;if(!P||G.mode!=='easy')return;const B=G.s.base;
  const lb=$('#projlbl');if(lb)lb.textContent=t('g.projlbl',{age:P.tgt});
  const X=scaleOf(Object.values(P.res));
  for(const id in P.res){const el=document.getElementById('op-'+id);if(!el)continue;const r=P.res[id],v=valHTML(r,B);
    if(r.base){el.innerHTML=`${v.v}${barHTML(r,X)}<span class="pr">${esc(t('g.twinPath'))}</span>`;continue}
    const risky=(r.hi-r.lo)>Math.max(2*Math.abs(r.med),.6*B);
    el.innerHTML=`${v.v}${barHTML(r,X,v.c)}<span class="pr">${esc(r.alive!=null?t('g.netBy',{a:MS(r.med),age:P.tgt}):risky?t('g.risky',{a:MS(r.lo),b:MS(r.hi)}):t('g.byAge',{a:P.tgt}))}${Math.abs(r.earn)>.05*B?esc(t('g.lifePay',{a:MS(r.earn)})):''}</span>`;
  }
}
/* hindsight: how your choice typically turned out, shown after you choose (Normal), and every option on the end card (all modes) */
const hv=r=>(r.alive!=null?r.alive*1e12:0)+(r.base?0:r.med);
function bestOf(h){return h.rows.reduce((b,r)=>!b||hv(r)>hv(b)?r:b,null)}
function hindHTML(h){
  const B=G.s.base,left=Math.max(0,(G.hindEnd||0)-Date.now());
  /* only crown a best option when it clearly beats another one */
  const b0=bestOf(h),best=h.rows.some(r=>hv(b0)-hv(r)>=.03*B)?b0:null;
  const top8=h.rows.length>8?new Set([h.pick,b0.id].concat(h.rows.slice().sort((a,b)=>hv(b)-hv(a)).map(r=>r.id))):null;
  /* Normal shows only your own choice; the others wait for the end card */
  const own=G.mode==='normal',shown=own?h.rows.filter(r=>r.id===h.pick):top8?h.rows.filter(r=>[...top8].slice(0,8).includes(r.id)):h.rows,X=scaleOf(shown);
  const rows=shown.map(r=>{const v=valHTML(r,B),mine=r.id===h.pick;return `<li class="hrow${mine?' mine':''}"><span class="ol">${trE(r.label)}${mine?`<span class="tag">${esc(t('g.yours'))}</span>`:''}${!own&&r===best?`<span class="tag tag-best">${esc(t('g.bestTag'))}</span>`:''}</span><span class="op">${v.v}${barHTML(r,X,v.c)}</span></li>`}).join('');
  return Art.card({cls:'slip hind',c:Art.frame(h.id),num:Art.num(h.id),label:trE(h.title),name:esc(t('tn.'+h.id)),body:`
  <div class="slip-top"><span class="stamp">${esc(t('g.hindK',{a:h.age}))}</span></div>
  <h2>${trE(h.title)}</h2><p class="slip-text">${esc(t(own?'g.hindPN':'g.hindP',{age:h.tgt}))}${top8&&!own?(I18N.lang==='en'?' ':'')+esc(t('g.hindTop',{m:h.rows.length})):''}</p>
  <ul class="hrows">${rows}</ul>
  <div class="hfoot"><button class="btn btn-accent" id="hcont" type="button">${esc(t('g.cont'))} <span class="arr">→</span></button><span class="htimer" aria-hidden="true"><i style="animation-duration:${left}ms"></i></span></div>`});
}
/* the end grade: a letter from money, happiness, health and relationships (lifeScore in engine.js), with the four parts */
const GP=[['money','sk'],['happy','ha'],['health','he'],['rel','re']];
function gradeHTML(g){
  return `<section class="grade"><div class="g-letter" data-g="${g.grade}"><b>${g.grade}</b></div><div class="g-txt"><h4>${esc(t('g.gradeT'))}</h4><p class="g-sum">${esc(t('g.grade.'+g.grade))}</p><p class="muted g-note">${esc(t('g.gradeNote'))}</p></div>
  <div class="g-parts">${GP.map(([k,c])=>`<div><div class="sh"><span>${esc(t('g.gp.'+k))}</span><b>${Math.round(g[k])}</b></div><div class="track ${c}"><i style="width:${Math.round(g[k])}%"></i></div></div>`).join('')}</div></section>`}
/* the same life as the other sex: same family, choices and luck, so only the pay gap, the child penalty and lifespan differ */
function mirrorHTML(){const s=G.s,m=G.mirror;if(!m)return '';const a=s.deathAge,at=Math.min(a,m.deathAge);
  /* compare at the same age: yours from the chart history, theirs recorded by mirrorLife */
  const h=G.hs.find(x=>x[0]===at),myNw=h?h[1]:netWorth(s),myEarn=G.ea[at]!=null?G.ea[at]:s.earned;
  const box=(lk,v,mine,money)=>`<div><span class="lbl">${esc(lk)}</span><b>${money?fm(v):esc(String(v))}</b><span class="mvs">${esc(t('g.mirVs',{b:money?MN(mine):String(mine)}))}</span></div>`;
  return `<section class="stand"><h4>${esc(t('g.mirT.'+m.sex))}</h4><p class="muted">${esc(t('g.mirP'))}</p>
  <div class="sgrid mgrid">${box(t('g.mirNw',{a:at}),m.nwAt,myNw,1)}${box(t('g.mirInc',{a:at}),m.earnAt,myEarn,1)}${box(t('g.mirAge'),m.deathAge,a,0)}</div></section>`}
function hindAllHTML(){
  const B=G.s.base;if(!G.hinds.length)return '';
  const val=r=>r.alive!=null?`<b>${esc(aliveTxt(r))}</b>`:r.base?esc(t('g.baseline')):`<b class="${cls(r.med)}">${fm(r.med,true)}</b>`;
  const put=(k,x,r)=>esc(t(k,{x,v:'\u0001'})).replace('\u0001',val(r));
  const li=G.hinds.map(h=>{const me=h.rows.find(r=>r.id===h.pick),b=bestOf(h);if(!me)return '';const top=hv(b)-hv(me)<.03*B;
    return `<li><span class="la">${h.age}</span><span class="lt"><span class="ll">${trE(h.title)} <span class="muted">· ${esc(t('g.byAge',{a:h.tgt}))}</span></span><span class="ln">${put('g.hindYou',me.label,me)} · ${top?esc(t('g.hindWasBest')):put('g.hindBest',b.label,b)}</span></span></li>`}).join('');
  return `<details class="hall"${G.mode==='hard'?' open':''}><summary>${esc(t('g.hindAll'))}</summary><p class="muted">${esc(t('g.hindAllP'))}</p><ul>${li}</ul></details>`;
}
/* between decisions: a few words about childhood or retirement (the focus has its own panel) */
function idleHTML(ph){
  if(ph==='child')return `<section class="panel"><div class="phead"><h3>${esc(t('g.childhood'))}</h3></div><p class="childtxt" id="childtxt"></p></section>`;
  if(ph==='ret')return `<section class="panel"><div class="phead"><h3>${esc(t('g.retiredT'))}</h3></div><p class="childtxt">${esc(t('g.retTxt',{p:M(G.s.pension?'g.pension':'g.statePension')}))}</p></section>`;
  return '';
}
function updIdle(){const s=G.s,el=$('#childtxt');if(el&&phase(s)==='child')el.textContent=s.age<12?t('g.child0',{a:s.age,sk:Math.round(skill(s)),fam:M('fam.'+s.fam)}):s.age<16?t('g.child12'):t('g.child16')}
/* the yearly focus: always on screen (a left-hand panel, or a row of chips along the bottom on smaller screens).
   A pick waits in G.nextF and starts with the next year; no money forecasts, outcomes stay hidden. */
function buildFocus(){
  const el=$('#frail');
  el.innerHTML=`<div class="fr-head"><h3 id="frT">${esc(t('g.focusT'))}</h3><p class="fr-desc" id="frDesc" aria-hidden="true"></p><p class="fr-note" id="frNote" aria-live="polite"></p></div>
  <div class="fr-list">${FOCUS.map(id=>`<button type="button" class="fcard" data-f="${id}" aria-pressed="false">${Art.focusWin(id)}<span class="fc-t"><span class="fc-n">${esc(t('f.'+id))}</span><span class="fc-d">${esc(t('f.'+id+'.d'))}</span></span><span class="fc-tag"></span></button>`).join('')}</div>`;
  el.querySelectorAll('[data-f]').forEach(b=>b.addEventListener('click',()=>pickFocus(b.dataset.f)));
  updFocus();
}
function pickFocus(f){const s=G.s;if(!s||G.ended||s.retired)return;G.nextF=f===s.focus?null:f;updFocus()}
function updFocus(){
  const s=G.s;if(!s)return;
  $('#frail').hidden=G.ended;$('#game').classList.toggle('nof',G.ended);if(G.ended)return;
  if(s.retired)G.nextF=null;
  const nx=G.nextF,show=nx||s.focus;
  $('#frNote').textContent=t(s.retired?'g.fNoteRet':s.age<18?'g.fNote18':'g.fNote');
  $('#frDesc').textContent=t('f.'+show)+(I18N.lang==='en'?': ':'：')+t('f.'+show+'.d');
  $('#frail').querySelectorAll('[data-f]').forEach(b=>{const f=b.dataset.f,cur=f===s.focus,next=f===nx;
    b.setAttribute('aria-pressed',String(cur));b.classList.toggle('next',next);b.disabled=s.retired;
    b.querySelector('.fc-tag').textContent=next?t(s.age<18?'g.fAt18':'g.fNext'):cur&&!s.retired?t('g.current'):''});
}
/* Life choices: love and family, decided whenever you like while the life runs (only what makes sense right now). It sits
   under the focus cards on wide screens, and opens from a tab on the bottom bar on smaller ones. Breaking up and divorcing
   ask for a second tap. Easy also shows what each choice does (hints); outcomes stay hidden otherwise */
const HEART='<svg viewBox="0 0 16 14" aria-hidden="true" focusable="false"><path d="M8 13 C2 9 0.5 6 1.5 3.5 C2.6 1 6 0.6 8 3.4 C10 0.6 13.4 1 14.5 3.5 C15.5 6 14 9 8 13 Z"/></svg>';
function buildLife(){
  let el=$('#lcWrap');if(!el){el=document.createElement('section');el.id='lcWrap';el.className='fr-life';$('#frail').appendChild(el)}
  el.setAttribute('aria-labelledby','lcT');
  el.innerHTML=`<button type="button" class="lc-tab" id="lcTab" aria-expanded="false" aria-controls="lcBody">${HEART}<span>${esc(t('lc.t'))}</span></button>
  <div class="lc-body" id="lcBody"><h3 id="lcT">${esc(t('lc.t'))}</h3><p class="lc-st" id="lcSt" aria-live="polite"></p><div class="lc-acts" id="lcActs"></div></div>`;
  $('#lcActs').addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(b&&!b.disabled)lifeAct(b.dataset.a)});
  $('#lcTab').onclick=()=>{const o=!el.classList.contains('open');el.classList.toggle('open',o);$('#lcTab').setAttribute('aria-expanded',String(o));if(o)G.lcKey=null;updLife()};
  G.lcKey=null;updLife()}
function lcStatus(s){if(s.age<18)return t('lc.kid');const p=s.pt,sp=I18N.lang==='en'?' ':'';let x;
  if(!p)x=t('lc.st.single');
  else if(p.st==='date')x=t('lc.st.date',{a:p.at,x:M('car.a.'+p.car)});
  else{x=t(p.st==='wed'?'lc.st.wed':'lc.st.live',{a:p.st==='wed'?p.wedAt:p.from});x+=sp+(p.ret?t('lc.ret'):t('lc.pay',{a:MN(ptPay(s)||0),x:M('car.a.'+p.car)}))}
  const n=s.kids.filter(b=>b<=s.age).length;if(n)x+=sp+t('lc.kids',{n});return x}
function lcSub(s,id){const B=s.base;switch(id){
  case 'look':return M('lc.look.s',{a:MN(.02*B)});case 'baby':return M('lc.baby.s',{a:MN(.15*B)});
  case 'div':return M('lc.div.s',{a:MN(divC(s)[0]*B)});default:return M('lc.'+id+'.s')}}
function lcHint(s,id){if(G.mode!=='easy')return null;const sp=I18N.lang==='en'?' ':'';
  if(id==='baby'){let h=t('lc.baby.h',{p:Math.round(babyP(s.age)*100)});if(s.sex==='f'&&CHILDPEN[workCode(s)]>0&&!s.kids.length)h+=sp+t('e.kids.h',{p:CHILDPEN[workCode(s)]});return h}
  return ['look','move','break','div'].includes(id)?t('lc.'+id+'.h'):null}
function updLife(){
  const s=G.s,el=$('#lcWrap');if(!s||!el)return;
  /* while a card or a moment is open the buttons stay, greyed out */
  const busy=!!(G.ended||G.pending||G.hind||G.mom||s.dead),acts=relActs(s);
  $('#lcSt').textContent=lcStatus(s)+(busy&&!G.ended&&s.age>=18?(I18N.lang==='en'?' ':'')+t('lc.busy'):'');
  $('#lcTab').classList.toggle('has',!busy&&acts.some(a=>a.ok===true));
  const html=acts.map(a=>{const dis=busy||a.ok!==true,arm=G.lcArm===a.id,sub=a.ok!==true?tr(a.ok):arm?t('lc.sure'):withHint(lcSub(s,a.id),lcHint(s,a.id));
    return `<button type="button" class="lc-btn${arm?' arm':''}" data-a="${a.id}"${dis?' disabled':''}><span class="lc-n">${esc(t('lc.'+a.id))}</span><span class="lc-s">${esc(sub)}</span></button>`}).join('');
  /* rebuild only when something changed, so a click (or the keyboard focus) isn't lost as the years go by */
  if(html!==G.lcKey){G.lcKey=html;$('#lcActs').innerHTML=html}}
function lifeAct(id){
  const s=G.s;if(!s||G.ended||G.pending||G.hind||G.mom||RPY.el)return;
  /* breaking up and divorcing need a second tap within a few seconds */
  /* (time stands still while it waits) */
  if((id==='break'||id==='div')&&G.lcArm!==id){G.lcArm=id;clearTimeout(G.timer);clearTimeout(G.lcArmT);G.lcArmT=setTimeout(()=>{G.lcArm=null;updLife();schedule()},4000);updLife();return}
  G.lcArm=null;clearTimeout(G.lcArmT);
  const had=new Set(Object.keys(s.trk)),age=s.age;
  if(!relAct(s,id,(m,k)=>addLog(m,k)))return;
  /* kept for the life replay; the wedding is recorded by its own card */
  if(id!=='wed'){G.dec.push({id:'p_'+id,age,title:M('lc.'+id),label:M('lc.'+id),pick:id,def:null,trk:id==='baby'?['kids']:Object.keys(s.trk).filter(k=>!had.has(k)),rows:[]});G.marks.push({a:age,t:M('lc.'+id)})}
  $('#lcWrap').classList.remove('open');$('#lcTab').setAttribute('aria-expanded','false');
  lifeMoments();recordTh();clearTimeout(G.timer);next()}
function spark(id,v){
  const h=G.th[id]||[];const c=cls(v)||'flat';
  if(h.length<2)return `<svg class="spark" viewBox="0 0 64 26" aria-hidden="true"><line class="z" x1="0" y1="13" x2="64" y2="13"/><circle class="${c}" cx="60" cy="13" r="2.5"/></svg>`;
  let mn=0,mx=0;for(const p of h){mn=Math.min(mn,p[1]);mx=Math.max(mx,p[1])}if(mx-mn<1e-9)mx=mn+1;
  const a0=h[0][0],a1=h[h.length-1][0],span=Math.max(1,a1-a0);
  const X=a=>2+(a-a0)/span*58,Y=v=>23-(v-mn)/(mx-mn)*20;
  const pts=h.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ');const e=h[h.length-1];
  return `<svg class="spark" viewBox="0 0 64 26" aria-hidden="true"><line class="z" x1="0" y1="${Y(0).toFixed(1)}" x2="64" y2="${Y(0).toFixed(1)}"/><polyline class="p ${c}" points="${pts}"/><circle class="${c}" cx="${X(e[0]).toFixed(1)}" cy="${Y(e[1]).toFixed(1)}" r="2.2"/></svg>`;
}
function renderLedger(){
  const s=G.s;const rows=Object.values(s.trk).map(tk=>Object.assign({tk},trkView(s,tk))).sort((a,b)=>a.tk.age-b.tk.age);
  const d=netWorth(s)-netWorth(G.t);const vs=$('#vs');vs.textContent=fm(d,true);vs.className=cls(d);
  $('#ledger').innerHTML=rows.length?rows.map(r=>`<li class="lrow"><span class="la">${r.tk.age}</span><span class="lt"><span class="ll">${trE(r.tk.label)}</span><span class="ln">${trE(r.note)}</span></span>${spark(r.tk.id,r.v)}<span class="lv ${cls(r.v)}">${fm(r.v,true)}</span></li>`).join(''):`<li class="lempty">${esc(t('g.ledgerEmpty'))}</li>`;
}
function renderLog(){$('#log').innerHTML=G.log.slice(-90).reverse().map(l=>`<li><span class="a">${l.a}</span><span class="${l.k}">${esc(rx(l.m))}</span></li>`).join('')}
function endHTML(){
  const s=G.s,cn=I18N.cname(s.ci),nw=netWorth(s),tv=netWorth(G.t);
  const peak=G.hs.reduce((m,p)=>p[1]>m[1]?p:m,[0,-Infinity]);
  const rows=Object.values(s.trk).map(tk=>Object.assign({tk},trkView(s,tk)));
  const best=rows.filter(r=>r.v>.5).sort((a,b)=>b.v-a.v).slice(0,3),worst=rows.filter(r=>r.v<-.5).sort((a,b)=>a.v-b.v).slice(0,3);
  const li=a=>a.length?a.map(r=>`<li><span>${trE(r.tk.label)} <span class="muted">· ${r.tk.age}</span></span><span class="num ${cls(r.v)}">${fm(r.v,true)}</span></li>`).join(''):`<li class="muted">${esc(t('g.none'))}</li>`;
  const d=nw-tv,fam=M('fam.'+s.fam);
  const story=Math.abs(d)<1?esc(t('g.level')):d>0?esc(t('g.ahead',{a:'\u0001'})).replace('\u0001',`<b class="gain">${fm(d)}</b>`):esc(t('g.behind',{a:'\u0001'})).replace('\u0001',`<b class="loss">${fm(-d)}</b>`);
  const rel=Math.abs(d)<1?M('g.relLevel'):d>0?M('g.relAhead',{a:MN(d)}):M('g.relBehind',{a:MN(-d)});
  const wp=worldPct(s.ci,nw);
  const gr=G.grade||lifeScore(s);
  const share=t('g.share',{c:cn,fam,a:s.deathAge,nw:MN(nw),rel,best:best[0]?M('g.best',{x:best[0].tk.label,v:MS(best[0].v)}):''})+(wp>0?t('g.shareW',{p:pctTxt(wp)}):'')+t('g.shareG',{g:gr.grade});
  /* you and the four babies born in the same second, ranked by how rich each life got at its peak (wealth at death mostly
     shows how much was spent in retirement) */
  const crowd=[{me:1,ci:s.ci,fam:s.fam,sex:s.sex,age:s.deathAge,nw,top:Math.max(0,peak[1]),topAge:peak[0]}].concat(G.peers||[]).map(p=>Object.assign(p,{w:worldPct(p.ci,p.top)}));
  const order=crowd.slice().sort((a,b)=>b.w-a.w||b.top-a.top);
  const peersH=crowd.map(p=>`<li class="${p.me?'me':''}"><span class="pk">${esc(t('g.peerRank',{n:order.indexOf(p)+1}))}</span><b>${esc(p.me?t('g.you'):I18N.cname(p.ci))}</b><span class="muted">${esc(p.me?cn:'')}${p.me?' · ':''}${esc(t('sex.kid.'+p.sex))} · ${esc(t('famS.'+p.fam))} · ${esc(t('g.peerAge',{a:p.age}))}</span><span class="pnw num">${fm(p.top)}</span><span class="pw">${esc(t('g.peerPeak',{a:p.topAge}))}</span><span class="pw">${esc(rankWorld(p.top,p.ci))}</span></li>`).join('');
  const stand=`<section class="stand"><h4>${esc(t('g.standT'))}</h4>
  <div class="sgrid"><div><span class="lbl">${esc(t('g.standW'))}</span><b>${esc(rankWorld(nw))}</b></div><div><span class="lbl">${esc(t('g.standC',{c:cn}))}</span><b>${esc(rankCountry(nw))}</b></div><div><span class="lbl">${esc(t('g.standP',{a:peak[0]}))}</span><b>${esc(rankWorld(Math.max(0,peak[1])))}</b></div>${G.peakInc>0?`<div><span class="lbl">${esc(t('g.standI'))}</span><b>${esc(t('g.standIv',{p:pctTxt(incomePct(G.peakInc))}))}</b></div>`:''}</div>
  <h4>${esc(t('g.peersT'))}</h4><p class="muted">${esc(t('g.peersSub'))}</p><ol class="peers">${peersH}</ol>
  <p class="snote">${esc(t('g.standNote'))}</p></section>`;
  return Art.card({cls:'cert',c:'mi',num:'XXI',label:esc(t('g.lifeIn',{c:cn,a:s.deathAge})),name:esc(t('tn.end')),
  win:`<div class="t-win cert-win" style="--wb:var(--wakatake)"><canvas id="certSeal" aria-hidden="true"></canvas>${Art.svg('wreath')}</div>`,body:`
  <div class="cert-hero"><div class="cert-head"><span class="stamp">${esc(t('g.closed',{a:s.deathAge}))}</span>
    <h2>${esc(t('g.lifeIn',{c:cn,a:s.deathAge}))}</h2>
    <div class="cert-den ${nw<0?'loss':''}" data-fit>${fm(nw)}</div><span class="lbl">${esc(t('g.nwEnd'))}</span></div><canvas class="pix pix-end" id="pixEnd" width="48" height="48" aria-hidden="true"></canvas></div>
  <p class="cert-story">${esc(t('g.bornInto',{fam}))}${I18N.lang==='en'?' ':''}${story}${s.illDeath?(I18N.lang==='en'?' ':'')+esc(t('g.illEnd',{a:s.deathAge,x:M('ill.'+s.illDeath)})):''}</p>
  <div class="egrid"><div><span class="lbl">${esc(t('g.peak',{a:peak[0]}))}</span><b>${fm(peak[1])}</b></div><div><span class="lbl">${esc(t('g.lifeInc'))}</span><b>${fm(s.earned)}</b></div><div><span class="lbl">${esc(t('g.twinT'))}</span><b>${fm(tv)}</b></div><div><span class="lbl">${esc(t('g.ringHi'))}</span><b>${esc(t('g.ringOf',{n:s.milestones.ring||0}))}</b></div></div>
  ${gradeHTML(gr)}
  ${mirrorHTML()}
  ${stand}
  <div class="elists"><div><h4>${esc(t('g.grew'))}</h4><ul>${li(best)}</ul></div><div><h4>${esc(t('g.cost'))}</h4><ul>${li(worst)}</ul></div></div>
  ${hindAllHTML()}
  <p class="share" id="share">${esc(share)}</p>
  <div class="erow"><button class="btn btn-accent" id="again" type="button">${esc(t('g.again'))} <span class="arr">→</span></button><button class="btn btn-ghost" id="same" type="button">${esc(t('g.sameC',{c:cn}))}</button><button class="btn btn-ghost" id="replay" type="button">${esc(t('rp.again'))}</button><button class="btn btn-ghost" id="copy" type="button">${esc(t('g.copy'))}</button><button class="btn btn-ghost" id="home" type="button">${esc(t('g.home'))}</button></div>`});
}

/* ---------- life replay ----------
   Before the end card, the life is drawn again as one continuous line: one scene per stage that actually happened (the
   stage's main decision, or its biggest one by passbook value), sorted by age, standing on your net-worth line. Each scene
   tells what you did and what came of it (from the passbook history), and shows the road not taken: every other option's
   typical result from the 40 futures saved when you chose. You move on yourself (buttons, swipe, ←/→).
   The ending fades the screen to charcoal for "Was it all worth it?", the one dark moment in the design, then back to light. */
const RP=[['child',['hobby','allow','tuition','phone1','pocket','friends','peer','loot']],['school',['edu','summer','teen','trip','cn_gaokao','in_coach','et_exam','de_ausb','sg_ns','ng_nysc'],'edu'],
  ['job',['job','save','nego','scheme','abroad','jp_shukatsu','cn_city','cn_kaogong','br_concurso','my_jb','in_gulf','pk_gulf','id_pmi','bd_gulf','mx_h2','ph_ofw','vn_xkld','ng_japa','bd_city','vn_city'],'job'],['love',['wed','date','p_move'],'wed'],['home',['home','bubble','move','sg_bto','cn_house','my_first','us_fha','gb_shared','de_buy','id_flpp','br_mcmv','mx_infonavit','ph_house','et_condo'],'home'],['kids',['p_baby'],'p_baby'],
  ['crisis',['ill','dep','crash','layoff','debt','divorce','p_div','p_break','scam','scam2','us_medbill','my_flood','in_flood','ng_flood','pk_flood','id_flood','bd_flood','br_flood','mx_storm','ph_typhoon','vn_typhoon','ng_infl','pk_infl','et_infl']],['old',['will','travel','downsize','move2','gtrip','grandkid','charity','annuity','reverse','club','funeral']]];
const RPX={date:'no'}; // choices that mean the stage never happened
/* a try for a baby only makes a page when a baby came of it (its story is the children's passbook line) */
const rpOk=d=>d.id!=='p_baby'||G.s.kids.includes(d.age+1);
const RPY={};
const decVal=d=>d.trk.length?d.trk.reduce((a,id)=>a+(G.s.trk[id]?trkView(G.s,G.s.trk[id]).v:0),0):null;
const nwAt=a=>{let v=0;for(const p of G.hs)if(p[0]<=a)v=p[1];return v};
function replayPages(){
  const s=G.s,pg=[{st:'birth',age:0,title:M('rp.bornT',{c:{k:'_c',ci:s.ci}}),story:[M('rp.t.born',{x:M('sex.kid.'+s.sex),c:{k:'_c',ci:s.ci},fam:M('fam.'+s.fam)})]}];
  const page=(st,d)=>({st,age:d.age,title:d.title,d,story:decStory(d)}),big=d=>Math.abs(decVal(d)||0);
  const old=s.retired&&s.retireAge!=null?s.retireAge+1:65; // old age comes after retirement
  for(const[st,ids,anchor]of RP){const ds=G.dec.filter(d=>ids.includes(d.id)&&RPX[d.id]!==d.pick&&rpOk(d)&&(st!=='old'||d.age>=old));if(!ds.length)continue;
    /* hard times: up to two pages, illness and depression first */
    if(st==='crisis'){const w=d=>d.id==='ill'?2:d.id==='dep'?1:0;ds.sort((a,b)=>w(b)-w(a)||big(b)-big(a)).slice(0,2).forEach(d=>pg.push(page(st,d)));continue}
    pg.push(page(st,ds.find(d=>d.id===anchor)||ds.sort((a,b)=>big(b)-big(a))[0]))}
  /* later careers: up to two more pages (the first career is the "first job" page) */
  G.dec.filter(d=>d.id==='job').slice(1).sort((a,b)=>big(b)-big(a)).slice(0,2).forEach(d=>pg.push(page('career',d)));
  if(s.retired&&s.retireAge!=null){const d=G.dec.find(x=>x.id==='fire'&&x.pick==='now')||G.dec.find(x=>x.id==='ret');
    pg.push({st:'ret',age:s.retireAge,title:d?d.title:M('rp.s.ret'),d,story:[M('rp.t.ret',{a:s.retireAge,nw:MN(nwAt(s.retireAge))})]})}
  pg.push({st:'end',age:s.deathAge,title:M('rp.endT'),story:[s.illDeath?M('rp.t.endIll',{a:s.deathAge,x:M('ill.'+s.illDeath)}):M('rp.t.end',{a:s.deathAge}),M('rp.t.endNw',{nw:MN(netWorth(s))})]});
  return pg.sort((a,b)=>a.age-b.age);
}
/* a decision's passbook lines added up, year by year: [[age, value], ...] */
function decHist(d){const ages=new Set();for(const id of d.trk)for(const p of G.th[id]||[])ages.add(p[0]);
  return [...ages].sort((a,b)=>a-b).map(a=>[a,d.trk.reduce((v,id)=>{let x=0;for(const p of G.th[id]||[])if(p[0]<=a)x=p[1];return v+x},0)])}
/* what you did, then what it did to your money: "At 18 you chose … It cost $21k at first, then paid you back by 31." */
function decStory(d){
  const s=G.s,B=s.base,small=.02*B,out=[];
  if(d.id==='ill'){out.push(M('rp.t.ill',{a:d.age,x:M('ill.'+(s.illDeath||s.illType)),l:d.label}));out.push(M(s.illDeath?'rp.t.illEnd':'rp.t.illOk'))}
  else if(d.id==='dep'){out.push(M('rp.t.dep',{a:d.age,l:d.label}));if(!depressed(s))out.push(M('rp.t.depOk'))}
  else out.push(M('rp.t.dec',{a:d.age,l:d.label}));
  /* a career: from when to when, and what it came to */
  const ck=d.id==='job'&&d.trk.find(k=>/^car\d/.test(k)),ct=ck&&s.trk[ck];
  if(ct){const v=ct.label.v||{};out.push(M('rp.m.career',{x:M('car.a.'+d.pick),a:v.a!=null?v.a:d.age,b:v.b!=null?v.b:s.deathAge,e:MS(ct.v)}));return out}
  const h=decHist(d);
  if(!h.length){const me=(d.rows||[]).find(r=>r.id===d.pick),df=(d.rows||[]).find(r=>r.id===d.def);
    if(!me||!df||d.pick===d.def)out.push(M('rp.m.track'));
    else out.push(Math.abs(me.med)<.03*B?M('rp.m.sameAs',{x:df.label}):M('rp.m.vs',{x:df.label,a:MS(me.med),age:d.tgt}));
    return out}
  const end=h[h.length-1][1];let lo=0,loA=0;for(const p of h)if(p[1]<lo){lo=p[1];loA=p[0]}
  const back=lo<-small&&end>=0?h.find(p=>p[0]>loA&&p[1]>=0):null;
  if(back){out.push(M('rp.m.back',{c:MN(-lo),age:back[0]}));if(end>small)out.push(M('rp.m.worth',{a:MN(end)}))}
  else out.push(end>small?M('rp.m.added',{a:MN(end)}):end<-small?M('rp.m.cost',{a:MN(-end)}):M('rp.m.little'));
  return out;
}
/* the road not taken: every option's typical result from the 40 futures, compared with what you picked */
function roadHTML(d){
  if(!d||!d.rows||d.rows.length<2)return '';
  const B=G.s.base,me=d.rows.find(r=>r.id===d.pick);if(!me)return '';
  const hv=r=>(r.alive!=null?r.alive*1e12:0)+r.med,best=d.rows.reduce((b,r)=>hv(r)>hv(b)?r:b,me);
  const top=hv(best)-hv(me)<.03*B,tie=d.rows.every(r=>Math.abs(hv(r)-hv(me))<.03*B);
  const keep=d.rows.length>6?new Set([me.id].concat(d.rows.filter(r=>r!==me).sort((a,b)=>hv(b)-hv(a)).slice(0,5).map(r=>r.id))):null;
  const li=d.rows.filter(r=>!keep||keep.has(r.id)).map(r=>{const mine=r===me,diff=r.med-me.med,flat=Math.abs(diff)<.03*B;
    const al=r.alive!=null?esc(t('g.alive',{p:Math.round(r.alive*100)})):'';
    const v=mine?al:[al,flat?esc(t('rp.same')):`<span class="${cls(diff)}">${esc(t('rp.vs',{a:MS(diff),age:d.tgt}))}</span>`].filter(Boolean).join(' · ');
    const best1=!tie&&(mine?top:r===best&&!top);
    return `<li class="rr${mine?' mine':''}"><span class="rr-l">${trE(r.label)}${mine?`<span class="tag">${esc(t('g.yours'))}</span>`:''}${best1?`<span class="tag tag-best">${esc(t('rp.bestT'))}</span>`:''}</span>${v?`<span class="rr-v">${mine?'':'→ '}${v}</span>`:''}</li>`}).join('');
  const verdict=tie?t('rp.tie'):top?t('rp.best'):t('rp.notBest',{x:best.label});
  return `<div class="rp-road"><h4>${esc(t('rp.road'))}</h4><p class="rp-roadP">${esc(t('rp.roadP',{age:d.tgt}))}</p><ul>${li}</ul>${keep?`<p class="rp-roadP">${esc(t('rp.more',{n:d.rows.length-6}))}</p>`:''}<p class="rp-verdict">${esc(verdict)}</p></div>`;
}
/* a scene's words: stage, age, what you did, what came of it, and the road not taken */
function sceneText(p){const age=p.st==='end'?G.s.deathAge:p.age;
  return `<div class="rp-hd"><div class="rp-hl"><span class="rp-chip" style="--c:var(${Art.stageBg(p.st)})">${esc(t('rp.s.'+p.st))}</span><span class="rp-age">${esc(t('rp.age',{a:age}))}</span></div><canvas class="pix pix-rp" data-age="${age}" width="48" height="48" aria-hidden="true"></canvas></div>
  <h3>${trE(p.title)}</h3><p class="rp-story">${p.story.map(trE).join(I18N.lang==='en'?' ':'')}</p>${roadHTML(p.d)}`}
/* each page's pixel character: the look recorded at that age (or the nearest year before it) */
function pixAt(a){let k=-1;for(const x in G.pix)if(+x<=a&&+x>k)k=+x;return G.pix[k]||G.pix[0]}
function rpPix(root){root.querySelectorAll('canvas.pix-rp').forEach(c=>Pixel.set(c,pixAt(+c.dataset.age)))}

/* ---------- the drawing: one charcoal line across the whole life ----------
   Each scene has its own frame, exactly the size of the drawing box: a small inline SVG, WH units high, standing in a
   horizontal strip of frames. The view never moves while a scene draws. Moving on slides the strip once (0.5 s,
   ease-in-out, a CSS transform on the strip only, so the browser can do it without repainting). In each frame the
   ground is your net-worth line: it comes in at the left edge, at the height where the frame before left off, runs to the
   scene in the middle, and after the scene is drawn and its words have shown it runs on to the right edge, where the next
   frame picks it up. So it still reads as one line. Each scene is a stage drawing from Art.stageArt drawn twice: a line
   layer whose strokes draw themselves one after another (pathLength=1, stroke-dashoffset animated with the Web Animations
   API) and a layer of flat palette fills that fades in once the lines are done. The pen (a small dot) sits at the tip of
   whatever is being drawn. Tapping the drawing speeds the scene up; a scene you come back to is shown finished; with
   reduced motion every scene is shown finished and frames change without sliding. */
const SS=1.35,WH=240,GTOP=162,GBOT=222,SLIDE=500;
const SHAPES='path,circle,rect,ellipse,line,polyline,polygon';
/* the life's net-worth scale, shared by every frame: [lo, hi, y of zero] */
function rpScale(){let lo=0,hi=1;for(const p of G.hs){lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1])}const Y=v=>GBOT-(v-lo)/(hi-lo)*(GBOT-GTOP);return{Y,z:Y(0)}}
/* net worth at a fractional age (the passbook keeps one value a year) */
const nwF=a=>{const f=Math.floor(a),c=Math.ceil(a);return f===c?nwAt(a):nwAt(f)+(nwAt(c)-nwAt(f))*(a-f)};
/* frame i, W units wide: its ground runs from the halfway age to the scene before, through the scene's age at the centre,
   to the halfway age to the next scene (the life's last age in the last frame) */
function rpFrameSVG(i,W,Y,z){
  const pages=RPY.pages,n=pages.length,s=G.s,age=p=>p.st==='end'?s.deathAge:p.age,a=age(pages[i]);
  const aL=i?(age(pages[i-1])+a)/2:a,aR=i<n-1?(a+age(pages[i+1]))/2:a,gy=x=>Y(nwF(x)),C=W/2;
  const half=(a0,a1,x0,x1)=>{const o=[[x0,gy(a0)]];if(a1>a0)for(let k=Math.floor(a0)+1;k<a1;k++)o.push([x0+(k-a0)/(a1-a0)*(x1-x0),gy(k)]);o.push([x1,gy(a1)]);return o};
  const pin=half(aL,a,0,C),pout=half(a,aR,C,W),d=ps=>'M'+ps.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' L');
  const area=(ps,x0,x1)=>`M${x0.toFixed(1)} ${z.toFixed(1)} L`+ps.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' L')+` L${x1.toFixed(1)} ${z.toFixed(1)} Z`;
  const all=pin.concat(pout),earth=`M0 ${WH+10} L`+all.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' L')+` L${W.toFixed(1)} ${WH+10} Z`;
  const ar=(ps,x0,x1,h)=>`<g class="rp-ar" data-h="${h}"><path class="rp-up" clip-path="url(#rpUp)" d="${area(ps,x0,x1)}"/><path class="rp-dn" clip-path="url(#rpDn)" d="${area(ps,x0,x1)}"/><path class="rp-zero" d="M${x0.toFixed(1)} ${z.toFixed(1)} H${x1.toFixed(1)}"/></g>`;
  /* the scene stands on the highest ground under it, in an arch of the stage's colour; the drawing is cut off at its base
     and the arch's colour runs on down to the net-worth line, which is drawn over it */
  let base=gy(a);for(const q of all)if(Math.abs(q[0]-C)<=66*SS)base=Math.min(base,q[1]);
  const at=`transform="translate(${(C-60*SS).toFixed(1)} ${(base-80*SS).toFixed(1)}) scale(${SS})"`,id=pages[i].st,art=Art.stageArt(id);
  const ARCH='M-6 80 V34 A66 66 0 0 1 126 34 V80',SKIRT='M-6 150 V34 A66 66 0 0 1 126 34 V150 Z';
  /* the last frame ends with a small star, drawn slowly after the last scene */
  let star='';if(i===n-1){const sx=W-Math.min(34,W*.1),sy=gy(aR)-38;let st='';for(let k=0;k<10;k++){const t2=-Math.PI/2+k*Math.PI/5,q=k%2?5:11;st+=(k?'L':'M')+(sx+q*Math.cos(t2)).toFixed(1)+' '+(sy+q*Math.sin(t2)).toFixed(1)}
    star=`<g class="rp-fill" data-i="star"><path class="ya" d="${st}Z"/></g><g class="rp-lines" data-i="star"><path d="${st}Z"/></g>`}
  return `<svg class="rp-svg" data-f="${i}" style="left:${i*100}%" viewBox="0 0 ${W.toFixed(1)} ${WH}" aria-hidden="true" focusable="false">
   <g class="rp-fill" data-i="${i}" ${at} style="--wb:var(${Art.stageBg(id)})"><path class="rp-bg" d="${SKIRT}"/><g clip-path="url(#rpCut)">${art}</g></g>
   <path class="rp-earth" d="${earth}"/>${ar(pin,0,C,'in')}${ar(pout,C,W,'out')}
   <g class="rp-lines" data-i="${i}" ${at} clip-path="url(#rpCut)"><path d="${ARCH}"/>${art}</g>
   <path class="rp-gl" data-h="in" d="${d(pin)}"/><path class="rp-gl" data-h="out" d="${d(pout)}"/>${star}</svg>`}
/* (re)build every frame for the box's current size; scenes already drawn are shown finished */
function rpBuild(){
  const box=RPY.box,w=box.clientWidth,h=box.clientHeight;if(!h||!w)return;const f=h/WH,W=w/f;
  if(RPY.W&&Math.abs(W-RPY.W)<.5&&Math.abs(f-RPY.f)<.001)return;
  rpFinish();RPY.W=W;RPY.f=f;const{Y,z}=rpScale(),st=RPY.strip;
  st.style.setProperty('--gw',(3/f).toFixed(3));st.style.setProperty('--lw',(3/f/SS).toFixed(3));st.style.setProperty('--tw',(2.2/f/SS).toFixed(3));
  RPY.defs.innerHTML=`<defs><clipPath id="rpCut" clipPathUnits="userSpaceOnUse"><rect x="-60" y="-90" width="240" height="170.5"/></clipPath>
   <clipPath id="rpUp" clipPathUnits="userSpaceOnUse"><rect x="-10" y="0" width="${(W+20).toFixed(1)}" height="${z.toFixed(1)}"/></clipPath>
   <clipPath id="rpDn" clipPathUnits="userSpaceOnUse"><rect x="-10" y="${z.toFixed(1)}" width="${(W+20).toFixed(1)}" height="${WH}"/></clipPath></defs>`;
  st.innerHTML=RPY.pages.map((p,i)=>rpFrameSVG(i,W,Y,z)).join('');rpPrep(st);
  for(const k in RPY.drawn)if(RPY.drawn[k])rpShow(k==='star'?k:+k);
  rpPlace(Math.max(0,RPY.i))}
/* get every line ready to draw: hidden, with a length of 1 so a dash offset of 1 hides it and 0 shows all of it */
function rpPrep(root){
  root.querySelectorAll('.rp-lines .ns').forEach(e=>e.remove());
  root.querySelectorAll('.rp-lines, .rp-gl').forEach(g=>{for(const e of g.matches(SHAPES)?[g]:g.querySelectorAll(SHAPES)){e.setAttribute('pathLength','1');e.style.strokeDasharray='1 1';e.style.strokeDashoffset='1';e.style.opacity='0'}});
  root.querySelectorAll('.rp-fill, .rp-ar').forEach(g=>g.style.opacity='0')}
/* scene i's parts, in drawing order: the ground coming in and the colour under it, the scene's strokes, its fills, then
   the ground going out to the right edge and the colour under that ('star': the last frame's star) */
function rpParts(i){const st=RPY.strip;
  if(i==='star'){const fr=st.querySelector(`.rp-svg[data-f="${RPY.pages.length-1}"]`);return{lines:[...fr.querySelector('.rp-lines[data-i="star"]').querySelectorAll(SHAPES)],fl:fr.querySelector('.rp-fill[data-i="star"]')}}
  const fr=st.querySelector(`.rp-svg[data-f="${i}"]`),q=s=>fr.querySelector(s);
  return{gin:q('.rp-gl[data-h="in"]'),ain:q('.rp-ar[data-h="in"]'),lines:[...q('.rp-lines').querySelectorAll(SHAPES)],fl:q('.rp-fill'),gout:q('.rp-gl[data-h="out"]'),aout:q('.rp-ar[data-h="out"]')}}
/* show scene i finished, at once */
function rpShow(i){const p=rpParts(i);
  for(const e of[p.gin,p.gout].concat(p.lines)){if(!e)continue;for(const a of e.getAnimations())a.cancel();e.style.opacity='1';e.style.strokeDashoffset='0'}
  for(const g of[p.fl,p.ain,p.aout]){if(!g)continue;for(const a of g.getAnimations())a.cancel();g.style.opacity='1'}RPY.drawn[i]=1}
/* draw scene i: about 0.6 s of ground coming in, about 1.8 s of strokes (each as long as its share of the ink), the
   colours, the words, then the ground going out to the next frame. slow stretches it (the last stroke of the life) */
function rpDraw(i,txt,slow){
  const p=rpParts(i),k=slow||1,anims=[],all=[];let at=0;
  const len=e=>{try{return Math.max(4,e.getTotalLength())}catch(x){return 30}};
  const stroke=(e,dur)=>{const a=e.animate([{opacity:0,strokeDashoffset:1},{opacity:1,strokeDashoffset:1,offset:.01},{opacity:1,strokeDashoffset:0}],{duration:dur,delay:at,fill:'both',easing:'linear'});anims.push({e,len:len(e),a});all.push(a);return dur};
  const fade=(g,dur,d0)=>{if(g)all.push(g.animate([{opacity:0},{opacity:1}],{duration:dur,delay:d0,fill:'both',easing:'ease-out'}))};
  if(p.gin){fade(p.ain,(i===0?450:650)*k,at);at+=stroke(p.gin,(i===0?450:650)*k)+60}
  const lens=p.lines.map(len),ink=lens.reduce((a,b)=>a+b,0)||1;
  p.lines.forEach((e,j)=>{at+=stroke(e,k*Math.min(420,Math.max(70,1800*lens[j]/ink)))+25});
  fade(p.fl,600*k,at);at+=600*k;
  if(txt)all.push(txt.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:450,delay:at-350,fill:'both',easing:'ease-out'}));
  if(p.gout){at+=150;fade(p.aout,500,at);stroke(p.gout,500)}
  RPY.run={i,anims,all};
  return Promise.all(all.map(a=>a.finished)).then(()=>{if(RPY.run&&RPY.run.i===i){RPY.drawn[i]=1;RPY.run=null}}).catch(()=>{})}
/* finish whatever is being drawn now (a tap speeds it up instead) */
function rpFinish(){const r=RPY.run;if(!r)return;for(const a of r.all)a.finish();RPY.drawn[r.i]=1;RPY.run=null}
function rpFast(){const r=RPY.run;if(r)for(const a of r.all)a.updatePlaybackRate?a.updatePlaybackRate(6):(a.playbackRate=6)}
/* the strip of frames: frame i in view (no animation) */
function rpPlace(i){const s=RPY.slide;if(s){s.cancel();RPY.slide=null}RPY.strip.style.transform=`translate3d(${-i*RPY.box.clientWidth}px,0,0)`}
/* slide to frame i: one quick, smooth move (only the strip's transform changes) */
function rpSlide(i){
  if(RPY.slide)RPY.slide.finish();const w=RPY.box.clientWidth,to=`translate3d(${-i*w}px,0,0)`,from=RPY.strip.style.transform||'translate3d(0px,0,0)';
  if(reduce||from===to){rpPlace(i);return Promise.resolve()}
  const a=RPY.slide=RPY.strip.animate([{transform:from},{transform:to}],{duration:SLIDE,easing:'ease-in-out'});RPY.strip.style.transform=to;
  return a.finished.then(()=>{if(RPY.slide===a)RPY.slide=null},()=>{})}
/* every frame: put the pen on the tip of the stroke being drawn (the frames don't move while drawing) */
function rpFrame(){
  if(!RPY.el)return;RPY.raf=requestAnimationFrame(rpFrame);
  const r=RPY.run,pen=RPY.pen;let tip=null;
  if(r&&!RPY.slide)for(const x of r.anims){const c=x.a.effect.getComputedTiming();if(c.progress!=null&&c.progress>0&&c.progress<1&&x.a.playState==='running'){try{
    if(!x.m)x.m=x.e.getCTM();tip=new DOMPoint(...(p=>[p.x,p.y])(x.e.getPointAtLength(c.progress*x.len))).matrixTransform(x.m)}catch(e){}break}}
  if(tip){pen.style.opacity='1';pen.style.transform=`translate3d(${tip.x.toFixed(1)}px,${tip.y.toFixed(1)}px,0)`}else if(pen.style.opacity!=='0')pen.style.opacity='0'}
function rpNav(){const e=RPY.el,n=RPY.pages.length,i=RPY.i;
  e.querySelector('#rpN').textContent=t('rp.n',{i:i+1,n});e.querySelector('#rpPrev').disabled=i<=0;
  e.querySelector('#rpNext').innerHTML=i>=n-1?`${esc(t('rp.fin'))} <span class="arr">→</span>`:`${esc(t('rp.next'))} <span class="arr">›</span>`}
function rpText(){const e=RPY.el;if(!e)return;e.setAttribute('aria-label',t('rp.aria'));e.querySelector('#rpK').textContent=t('rp.kick',{c:I18N.cname(G.s.ci)});
  e.querySelector('#rpSkip').innerHTML=`${esc(t('rp.skip'))} <span class="arr">»</span>`;e.querySelector('#rpQ').textContent=t('rp.q');
  e.querySelector('#rpPrev').innerHTML=`<span class="arr">‹</span> ${esc(t('rp.prev'))}`;e.querySelector('#rpHint').textContent=t('rp.hint');rpNav();
  const tx=e.querySelector('#rpTin');if(RPY.i>=0){tx.innerHTML=sceneText(RPY.pages[RPY.i]);rpPix(tx);if(!(RPY.run&&RPY.run.i===RPY.i))tx.style.opacity='1'}}
/* go to scene i: whatever is drawing finishes first (nothing moves while lines draw), then the strip slides once; a new
   scene is drawn after the slide, one already drawn (going back, or forward again) is simply there */
function rpGo(i){
  const e=RPY.el,n=RPY.pages.length;if(!e||RPY.ending||i<0)return;if(i>=n){rpFinale();return}if(i===RPY.i)return;
  rpFinish();const first=RPY.i<0;RPY.i=i;
  const tx=e.querySelector('#rpTin');for(const a of tx.getAnimations())a.cancel();tx.innerHTML=sceneText(RPY.pages[i]);rpPix(tx);e.querySelector('#rpTxt').scrollTop=0;
  const mid=e.querySelector('.rp-mid');if(mid.scrollTop)mid.scrollTop=0;rpNav();
  for(let k=0;k<i;k++)if(!RPY.drawn[k])rpShow(k);
  if(RPY.drawn[i]||reduce){if(!RPY.drawn[i])rpShow(i);tx.style.opacity='1';if(first)rpPlace(i);else rpSlide(i);return}
  tx.style.opacity='0';
  if(first){rpPlace(i);rpDraw(i,tx);return}
  rpSlide(i).then(()=>{if(RPY.el&&RPY.i===i&&!RPY.drawn[i]&&!RPY.run)rpDraw(i,tx)})}
/* after the last scene: the line slows down and draws one last small star, then the ending */
function rpFinale(){
  const e=RPY.el;if(!e||RPY.ending)return;rpFinish();RPY.ending=true;
  e.querySelector('#rpNext').disabled=true;e.querySelector('#rpPrev').disabled=true;
  if(reduce){rpShow('star');rpEnd();return}
  rpDraw('star',null,1.8).then(()=>RPY.timers.push(setTimeout(rpEnd,900)))}
/* the ending: fade to charcoal, the question in washi white, hold ~3 s, back to light and into the end card */
function rpEnd(){
  const e=RPY.el;if(!e)return;const at=(ms,f)=>RPY.timers.push(setTimeout(f,ms));
  e.classList.add('dusk');e.querySelector('#rpSkip').focus({preventScroll:true});
  if(reduce){e.querySelector('#rpQ').classList.add('on');at(3000,()=>closeReplay(true));return}
  at(2400,()=>e.querySelector('#rpQ').classList.add('on'));
  at(6600,()=>e.querySelector('#rpQ').classList.remove('on'));
  at(7200,()=>e.classList.add('dawn'));
  at(8800,()=>closeReplay());
}
function playReplay(){
  closeReplay(true);if(!G.s||!G.ended)return;
  const el=document.createElement('div');el.className='replay';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  Object.assign(RPY,{el,pages:replayPages(),i:-1,ending:false,timers:[],drawn:{},run:null,slide:null,W:0,f:0});
  el.innerHTML=`<div class="rp-top"><span class="kicker" id="rpK"></span><button class="btn btn-ghost" id="rpSkip" type="button"></button></div>
  <div class="rp-mid"><div class="rp-world" id="rpWorld"><svg class="rp-defs" width="0" height="0" aria-hidden="true" focusable="false"></svg><div class="rp-strip" id="rpStrip"></div><span class="rp-pen" id="rpPen" aria-hidden="true"></span></div><div class="card rp-txt" id="rpTxt"><div class="rp-tin" id="rpTin" aria-live="polite"></div></div></div>
  <div class="rp-nav"><button class="btn btn-ghost" id="rpPrev" type="button"></button><span class="rp-pg"><b id="rpN"></b><span id="rpHint"></span></span><button class="btn btn-accent" id="rpNext" type="button"></button></div>
  <p class="rp-q" id="rpQ"></p>`;
  document.body.appendChild(el);document.body.classList.add('rp-open');
  Object.assign(RPY,{box:el.querySelector('#rpWorld'),strip:el.querySelector('#rpStrip'),defs:el.querySelector('.rp-defs'),pen:el.querySelector('#rpPen')});
  rpBuild();
  el.querySelector('#rpSkip').onclick=()=>closeReplay();el.querySelector('#rpPrev').onclick=()=>rpGo(RPY.i-1);el.querySelector('#rpNext').onclick=()=>rpGo(RPY.i+1);
  /* a tap on the drawing speeds up the scene being drawn */
  RPY.box.addEventListener('click',rpFast);
  /* swipe on phones: left for the next scene, right for the one before */
  let sx=null,sy=0;el.addEventListener('touchstart',ev=>{const p=ev.touches[0];sx=p.clientX;sy=p.clientY},{passive:true});
  el.addEventListener('touchend',ev=>{if(sx==null)return;const p=ev.changedTouches[0],dx=p.clientX-sx,dy=p.clientY-sy;sx=null;if(Math.abs(dx)>50&&Math.abs(dx)>1.5*Math.abs(dy))rpGo(RPY.i+(dx<0?1:-1))},{passive:true});
  /* the frames are rebuilt if the box changes size (the layout settles after the words arrive, and on rotation) */
  RPY.ro=new ResizeObserver(()=>{if(RPY.el)rpBuild()});RPY.ro.observe(RPY.box);
  rpGo(0);rpText();RPY.raf=requestAnimationFrame(rpFrame);el.querySelector('#rpNext').focus({preventScroll:true});
}
function closeReplay(now){const el=RPY.el;if(!el)return;for(const x of RPY.timers||[])clearTimeout(x);cancelAnimationFrame(RPY.raf);if(RPY.ro)RPY.ro.disconnect();if(RPY.slide)RPY.slide.cancel();RPY.el=null;RPY.run=null;RPY.slide=null;document.body.classList.remove('rp-open');
  if(now)el.remove();else{el.classList.add('fade');setTimeout(()=>el.remove(),800)}
  const a=$('#again');if(a)a.focus({preventScroll:true})}

/* ---------- chart ---------- */
function nice(x){const p=Math.pow(10,Math.floor(Math.log10(x)));const f=x/p;return(f<1.5?1:f<3?2:f<7?5:10)*p}
function ticks(a,b,n){const st=nice((b-a)/n||1);const lo=Math.floor(a/st)*st,hi=Math.ceil(b/st)*st,o=[];for(let v=lo;v<=hi+st/2;v+=st)o.push(Math.round(v/st)*st);return o}
function drawChart(){
  const cv=$('#chart');if(!cv||!G.s)return;const w=cv.clientWidth,h=cv.clientHeight;if(!w)return;const dpr=Math.min(devicePixelRatio||1,2);
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
  const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
  const ink=tok('--charcoal'),fill=tok('--wakatake'),coral=tok('--coral'),yama=tok('--yamabuki'),washi=tok('--washi'),font=tok('--font');
  const s=G.s,hs=G.hs,ht=G.ht;const xmax=Math.min(106,Math.max(s.le+15,(s.dead?s.deathAge:s.age)+5,60));
  let lo=0,hi=s.base*2;for(const p of hs.concat(ht)){if(p[1]<lo)lo=p[1];if(p[1]>hi)hi=p[1]}
  const tk=ticks(lo,hi,4);lo=tk[0];hi=tk[tk.length-1];
  x.font=`12px ${font}`;const pl=Math.max(...tk.map(v=>x.measureText(fm(v)).width))+12,pr=10,pt=10,pb=26;
  const X=a=>pl+(a/xmax)*(w-pl-pr),Y=v=>pt+(1-(v-lo)/(hi-lo||1))*(h-pt-pb);
  x.lineJoin='round';x.lineCap='round';x.strokeStyle=ink;
  /* flat fill between your line and zero: green above, coral below */
  if(hs.length>1){const z=Y(Math.max(lo,0));x.beginPath();hs.forEach((p,i)=>i?x.lineTo(X(p[0]),Y(p[1])):x.moveTo(X(p[0]),Y(p[1])));x.lineTo(X(hs[hs.length-1][0]),z);x.lineTo(X(hs[0][0]),z);x.closePath();
    for(const[top,c]of [[true,fill],[false,coral]]){x.save();x.beginPath();top?x.rect(0,0,w,z):x.rect(0,z,w,h);x.clip();x.beginPath();hs.forEach((p,i)=>i?x.lineTo(X(p[0]),Y(p[1])):x.moveTo(X(p[0]),Y(p[1])));x.lineTo(X(hs[hs.length-1][0]),z);x.lineTo(X(hs[0][0]),z);x.closePath();x.fillStyle=c;x.fill();x.restore()}}
  x.textAlign='right';x.textBaseline='middle';x.fillStyle=ink;
  for(const v of tk){x.lineWidth=v===0?2:1;x.setLineDash(v===0?[]:[1,5]);x.beginPath();x.moveTo(pl,Math.round(Y(v))+.5);x.lineTo(w-pr,Math.round(Y(v))+.5);x.stroke();x.fillText(fm(v),pl-8,Y(v))}
  x.setLineDash([]);x.textAlign='center';x.textBaseline='top';for(let a=0;a<=xmax;a+=10)x.fillText(String(a),X(a),h-pb+9);
  const ln=(pts,wd,dash)=>{if(pts.length<2)return;x.setLineDash(dash||[]);x.lineWidth=wd;x.beginPath();pts.forEach((p,i)=>i?x.lineTo(X(p[0]),Y(p[1])):x.moveTo(X(p[0]),Y(p[1])));x.stroke();x.setLineDash([])};
  ln(ht,2,[6,5]);ln(hs,3);
  const at=(arr,a)=>{let b=arr[0];for(const p of arr){if(p[0]<=a)b=p;else break}return b};
  x.fillStyle=coral;x.lineWidth=2;for(const m of G.marks){const p=at(hs,m.a);const cx=X(p[0]),cy=Y(p[1]);x.beginPath();x.moveTo(cx,cy-6.5);x.lineTo(cx+6.5,cy);x.lineTo(cx,cy+6.5);x.lineTo(cx-6.5,cy);x.closePath();x.fill();x.stroke()}
  const e=hs[hs.length-1];x.fillStyle=yama;x.lineWidth=2.5;x.beginPath();x.arc(X(e[0]),Y(e[1]),5.5,0,7);x.fill();x.stroke();
  if(G.hover!=null&&G.hover<=e[0]){const a=G.hover,p=at(hs,a),q=at(ht,a);const mk=G.marks.filter(m=>m.a===a).map(m=>tr(m.t)).join(', ');
    x.lineWidth=1.5;x.beginPath();x.moveTo(X(a)+.5,pt);x.lineTo(X(a)+.5,h-pb);x.stroke();
    const txt=t('g.hover',{a,b:MN(p[1]),c:MN(q[1])})+(mk?' · '+mk:'');x.font=`12px ${font}`;const tw2=x.measureText(txt).width+20;const bx=Math.min(Math.max(X(a)-tw2/2,pl),w-pr-tw2);
    x.fillStyle=washi;x.lineWidth=2;x.beginPath();x.roundRect?x.roundRect(bx,pt,tw2,26,13):x.rect(bx,pt,tw2,26);x.fill();x.stroke();x.fillStyle=ink;x.textAlign='left';x.textBaseline='middle';x.fillText(txt,bx+10,pt+13.5)}
  G._cx={pl,pr,xmax,w};
}
const cvEl=$('#chart');
cvEl.addEventListener('pointermove',ev=>{const g=G._cx;if(!g)return;const r=cvEl.getBoundingClientRect();const a=Math.round((ev.clientX-r.left-g.pl)/(g.w-g.pl-g.pr)*g.xmax);G.hover=a>=0?a:null;drawChart()});
cvEl.addEventListener('pointerleave',()=>{G.hover=null;drawChart()});
let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(G.s)render();else setupBg()},120)});
window.addEventListener('langchange',()=>{fillCountries();renderPast();revealText();document.title=t('g.title');
  if(G.s){buildFocus();buildLife();renderSlot(true);render();if(G.ended)drawSeal($('#certSeal'),netWorth(G.s),G.s.base,G.s.deathAge,true);if(!$('#toast').hidden&&G.toastMsg)$('#toast').textContent=tr(G.toastMsg);rpText();paintMoment()}});

/* ---------- controls ---------- */
$('#play').addEventListener('click',()=>{if(G.ended)return;G.playing=!G.playing;$('#play').textContent=t(G.playing?'g.pause':'g.play');schedule()});
$('#skip').addEventListener('click',()=>skipAhead());
document.addEventListener('keydown',e=>{
  if(G.mom){if(e.key===' '||e.key==='Enter'||e.key==='Escape'){e.preventDefault();endMoment()}return}
  if(RPY.el){if(e.key==='Escape'){e.preventDefault();closeReplay()}else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();rpGo(RPY.i+(e.key==='ArrowRight'?1:-1))}return}
  if(!G.s||e.target.closest('input,select,textarea')||e.metaKey||e.ctrlKey||e.altKey)return;
  if(G.pending&&/^[1-9]$/.test(e.key)){const b=document.querySelectorAll('.opt')[+e.key-1];if(b&&!b.disabled){e.preventDefault();b.click()}return}
  if(e.key===' '&&!e.target.closest('button')){e.preventDefault();$('#play').click()}
  if((e.key==='n'||e.key==='N')&&!G.pending)skipAhead();
});
document.title=t('g.title');

/* deep links from the landing page */
if(location.hash==='#born')reveal(pickCountry());
else if(location.hash==='#pick'){$('#bp-pick').checked=true;$('#countryWrap').hidden=false}
})();
