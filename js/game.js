/* Compound Life game UI: birth, the yearly loop, decisions (each one a tarot card), passbook, chart and the end card.
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
const JOBK={corp:'e.job.corp',startup:'e.job.startup',gov:'e.job.gov'};
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
  $('#past').innerHTML=p.slice(0,5).map(x=>{const ci=x.ci!=null?x.ci:C.findIndex(c=>c[0]===x.c);return `<li><span>${esc(t('g.pastItem',{c:ci>=0?I18N.cname(ci):x.c,a:x.age}))}</span><span class="num ${cls(x.nw)}">${fm(x.nw)}</span></li>`}).join('')}
renderPast();
function setupBg(){Guilloche.render($('#setupRosette'),Object.assign({},Guilloche.MOON,{phase:.6}))}
setupBg();

let R=null;
function revealText(){if(!R)return;const{ci,life}=R;$('#rname').textContent=I18N.cname(ci);
  $('#rfam').textContent=t('g.bornR',{x:M('sex.kid.'+life.sex),fam:M('fam.'+life.fam)});
  $('#rmeta').textContent=t('g.rmeta',{a:MN(life.base),le:life.le,h:C[ci][5]})}
function reveal(ci,sex){
  const seed=(Math.random()*4294967296)>>>0;const life=newLife(ci,seed,sex);R=null;
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
function backToSetup(){clearTimeout(G.timer);clearTimeout(G.hindT);G.hind=null;G.s=null;R=null;$('#game').hidden=true;$('#gstat').hidden=true;$('#gctrlLive').hidden=true;$('#setup').hidden=false;$('#setupForm').hidden=false;$('#roulette').hidden=true;renderPast();setupBg();window.scrollTo(0,0)}

/* ---------- life loop ---------- */
function startLife(ci,seed,sex){
  Object.assign(G,{ci,s:newLife(ci,seed,sex),t:newLife(ci,seed,sex),foc:{},ea:{},mirror:null,hs:[[0,0]],ht:[[0,0]],marks:[],log:[],playing:true,pending:null,ended:false,proj:null,fcache:null,hover:null,slotMode:null,th:{},mode:diff,hind:null,hinds:[],peers:null,peakInc:0});
  const s=G.s;
  addLog(M('log.born',{c:{k:'_c',ci},fam:M('fam.'+s.fam)}),'good');
  addLog(M('log.wage',{a:MN(s.base),le:s.le}),'');
  $('#noteSerial').textContent='CL '+(seed>>>0).toString(16).toUpperCase().padStart(8,'0');
  $('#setup').hidden=true;$('#game').hidden=false;$('#gstat').hidden=false;$('#gctrlLive').hidden=false;
  window.scrollTo(0,0);render();schedule();
}
/* country names inside stored messages are resolved when shown */
const rx=x=>{if(x&&typeof x==='object'&&x.k==='_c')return I18N.cname(x.ci);if(x&&typeof x==='object'&&x.k&&x.v){const v={};for(const n in x.v)v[n]=(x.v[n]&&x.v[n].k==='_c')?I18N.cname(x.v[n].ci):x.v[n];return t(x.k,v)}return tr(x)};
function addLog(m,k,a){G.log.push({a:a===undefined?G.s.age:a,m,k:k||''});if(G.log.length>400)G.log.shift()}
function resolveTwin(){const tw=G.t;if(tw.dead)return;let g=0,ev;while((ev=dueEvents(tw)[0])&&g++<30){const id=ev.mirror&&G.s.done[ev.id]?G.s.done[ev.id]:ev.def;applyOpt(tw,ev,id)}}
function recordTh(){const s=G.s,a=s.dead?s.deathAge+1:s.age;for(const id in s.trk){const v=trkView(s,s.trk[id]).v;const h=G.th[id]||(G.th[id]=[]);if(h.length&&h[h.length-1][0]===a)h[h.length-1][1]=v;else h.push([a,v])}}
function advance(){
  const s=G.s;if(!s||G.ended||G.pending||G.hind)return 'stop';
  const ev=dueEvents(s)[0];if(ev){showDecision(ev);return 'ev'}
  resolveTwin();const a=s.age,yr=yearRand(s.seed,a);G.foc[a]=s.focus;G.ea[a]=s.earned;
  if(a===6)addLog(M('log.school'),'',a);
  const out=tick(s,yr,(m,k)=>addLog(m,k,a));s.lastInc=out.gross;if(out.gross>G.peakInc)G.peakInc=out.gross;
  if(!G.t.dead){tick(G.t,yr,null);G.ht.push([G.t.dead?G.t.deathAge+1:G.t.age,netWorth(G.t)])}
  G.hs.push([s.dead?a+1:s.age,netWorth(s)]);recordTh();
  if(a>=18&&out.gross>0)addLog(out.saved>=0?M('log.incSave',{a:MN(out.gross),b:MN(out.saved)}):M('log.incOver',{a:MN(out.gross),b:MN(-out.saved)}),'year',a);
  checkMilestones();
  if(s.dead){endLife();return 'end'}
  return 'ok';
}
function schedule(){clearTimeout(G.timer);if(!G.s||!G.playing||G.pending||G.hind||G.ended)return;const d=G.s.age<12?Math.min(160,SPEEDS[speedI]/3):SPEEDS[speedI];G.timer=setTimeout(()=>{const r=advance();if(r==='ok'){render();schedule()}},d)}
function skipAhead(){if(G.hind)endHind();if(G.pending||G.ended)return;clearTimeout(G.timer);let g=0,r;do{r=advance()}while(r==='ok'&&g++<150);if(r==='ok'){render();schedule()}}
function showDecision(ev){
  const s=G.s;clearTimeout(G.timer);
  if(ev.pre&&!s['pre_'+ev.id]){ev.pre(s);s['pre_'+ev.id]=1;if(ev.preLog)addLog(ev.preLog(s),'bad');recordTh()}
  G.pending=ev;G.proj=null;render();
  setTimeout(()=>{if(G.pending!==ev)return;G.proj=Object.assign(projectEvent(s,ev,40),{ev});fillProj()},60);
  const el=$('#slot');const top=el.getBoundingClientRect().top;
  if(top<70||top>window.innerHeight*.7)window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-84,behavior:reduce?'auto':'smooth'});
}
function choose(id){
  const ev=G.pending;if(!ev)return;const s=G.s;
  /* the 40 futures are worked out from the moment before you choose; they are kept for the hindsight card and the end card */
  const P=G.proj&&G.proj.ev===ev?G.proj:projectEvent(s,ev,40),os=ev.opts(s),age=s.age;
  const o=applyOpt(s,ev,id);
  addLog(M('log.chose',{x:o.label}),'choice');if(o.id!==ev.def)G.marks.push({a:s.age,t:ev.title});
  const h={id:ev.id,title:ev.title,age,tgt:P.tgt,pick:o.id,rows:os.filter(x=>P.res[x.id]).map(x=>Object.assign({id:x.id,label:x.label},P.res[x.id]))};
  const real=h.rows.length>1;if(real)G.hinds.push(h);
  recordTh();G.pending=null;G.fcache=null;
  if(G.mode==='normal'&&real){showHind(h);return}
  next();
}
function next(){const nx=dueEvents(G.s)[0];if(nx){showDecision(nx);return}render();schedule()}
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
function endLife(){G.ended=true;G.pending=null;clearTimeout(G.timer);const s=G.s;G.peers=bornWithYou();G.mirror=mirrorLife(s,G.foc,s.deathAge);const p=store.get('cl-past')||[];p.unshift({c:C[s.ci][0],ci:s.ci,age:s.deathAge,nw:Math.round(netWorth(s))});store.set('cl-past',p.slice(0,12));render();window.scrollTo({top:0,behavior:reduce?'auto':'smooth'})}

/* ---------- rendering ---------- */
function phase(s){return s.age<18?'child':s.retired?'ret':'adult'}
function render(){
  const s=G.s,tw=G.t;
  const age=s.dead?s.deathAge:s.age;
  $('#age').textContent=age;
  const job=s.study?t('g.studying',{x:s.study.label}):s.retired?t('g.retired'):(s.biz&&s.biz.mode==='full'&&s.biz.ok&&!s.biz.sold)?t('g.biz'):s.job?t('g.joblvl',{j:M(JOBK[s.job.type]),n:s.level}):s.age<18?t('g.child'):'';
  $('#where').textContent=t('g.where',{c:I18N.cname(s.abroad!=null?s.abroad:s.ci),s:M((s.age<18?'sex.kid.':'sex.')+s.sex),f:M('famS.'+s.fam),j:job?' · '+job:''});
  const nw=netWorth(s),tv=netWorth(tw);
  $('#nw').textContent=fm(nw);$('#nw').className='nw'+(nw<0?' loss':'');window.fitText&&fitText($('#nw'));
  $('#nwsub').innerHTML=(s.age>=18?esc(t('g.income',{a:MN(s.lastInc)})):'')+esc(t('g.twin',{a:MN(tv)}));
  $('#rkW').textContent=rankWorld(nw);$('#rkC').textContent=rankCountry(nw);
  $('#note').style.setProperty('--shift',Math.min(100,age)/100);
  $('#nwNum').textContent=Art.roman(age);
  $('#nwName').textContent=t(s.retired||s.dead?'tn.king':s.age<18?'tn.page':'tn.knight');
  const sk=skill(s);$('#skv').textContent=Math.round(sk);$('#skb').style.width=clamp(sk,0,100)+'%';$('#skx').textContent=t('g.skx',{p:Math.round(SK*sk*100)});
  $('#hev').textContent=Math.round(s.health);$('#heb').style.width=s.health+'%';$('#hav').textContent=Math.round(s.happy);$('#hab').style.width=s.happy+'%';$('#rev').textContent=Math.round(s.rel);$('#reb').style.width=s.rel+'%';
  $('#chips').innerHTML=SRC.filter(k=>(s.skillSrc[k]||0)>=.5).map(k=>{const v=s.skillSrc[k];const name=k==='edu'&&s.trk.sk_edu?tr(s.trk.sk_edu.label):t('src.'+k);return `<span class="chip"><b>${esc(name)}</b> ${esc(t('g.chipSk',{n:Math.round(v)}))} · <span class="gain">${esc(t('g.chipPay',{p:Math.round(SK*v*100)}))}</span></span>`}).join('');
  const L=level(nw,s.base);
  $('#sealcap').textContent=L<6?t('g.ring',{n:L,a:MN(TH[L]*s.base)}):t('g.ringAll');
  drawSeal($('#seal'),nw,s.base,age,s.dead);
  $('#play').textContent=t(G.playing?'g.pause':'g.play');$('#play').disabled=G.ended;$('#skip').disabled=G.ended||!!G.pending;
  renderSlot();drawChart();renderLedger();renderLog();
}
/* where you stand: world and country wealth ranks from the data in engine.js */
const pctTxt=p=>p>=99.95?'99.9':p>=99?p.toFixed(1):String(Math.max(1,Math.round(p)));
function rankWorld(nw,ci){const p=worldPct(ci==null?G.s.ci:ci,nw);return p<=0?t('g.rkWorld0'):t('g.rkWorld',{p:pctTxt(p)})}
function rankCountry(nw,ci){ci=ci==null?G.s.ci:ci;const p=countryPct(ci,nw),c=I18N.cname(ci);if(p>=50){const top=100-p;return t('g.rkTop',{p:top<1?Math.max(.1,top).toFixed(1):String(Math.round(top)),c})}return t('g.rkBottom',{p:String(Math.max(1,Math.round(p))),c})}
/* four other babies born in the same second: random countries weighted by births, same rules, default choices */
function bornWithYou(){const s=G.s,tot=C.reduce((a,c)=>a+c[2],0),out=[];
  for(let i=0;i<4;i++){let u=mb(hsh(s.seed,'peer',i))()*tot,ci=0;for(;ci<C.length-1;ci++){u-=C[ci][2];if(u<=0)break}
    const p=newLife(ci,hsh(s.seed,'peerSeed',i));let g=0,top=0,topAge=0;while(!p.dead&&g++<130){resolveAuto(p);tick(p,yearRand(p.seed,p.age),null);const v=netWorth(p);if(v>top){top=v;topAge=p.dead?p.deathAge:p.age}}
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
  const el=$('#slot'),s=G.s;const mode=G.ended?'end':G.pending?`ev:${G.pending.id}:${s.age}`:G.hind?'hind:'+G.hinds.length:'focus:'+phase(s);
  if(force||mode!==G.slotMode){G.slotMode=mode;
    if(G.ended){el.innerHTML=endHTML();
      $('#again').onclick=()=>{backToSetup();reveal(pickCountry())};
      $('#same').onclick=()=>{backToSetup();reveal(G.ci)};
      $('#home').onclick=()=>backToSetup();
      $('#copy').onclick=()=>{const txt=$('#share').textContent;const b=$('#copy');const ok=()=>{b.textContent=t('g.copied');setTimeout(()=>b.textContent=t('g.copy'),1800)};
        try{navigator.clipboard.writeText(txt).then(ok,()=>selectShare())}catch(e){selectShare()}};
      drawSeal($('#certSeal'),netWorth(s),s.base,s.deathAge,true);window.fitAll&&fitAll();
    }else if(G.pending){el.innerHTML=slipHTML(G.pending);el.querySelectorAll('.opt:not([disabled])').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.id)))}
    else if(G.hind){el.innerHTML=hindHTML(G.hind);$('#hcont').onclick=endHind}
    else{el.innerHTML=focusHTML(phase(s));el.querySelectorAll('[data-f]').forEach(b=>b.addEventListener('click',()=>{G.s.focus=b.dataset.f;addLog(M('log.focus',{x:M('f.'+b.dataset.f)}),'choice');updFocus();renderLog()}))}
  }
  if(G.pending)fillProj();else if(!G.ended&&!G.hind){updFocus();queueFocus()}
}
function selectShare(){const r=document.createRange();r.selectNodeContents($('#share'));const sl=getSelection();sl.removeAllRanges();sl.addRange(r);$('#copy').textContent=t('g.ctrlc')}
/* in Easy, an option's text also gets its hint (skill, pay %, odds); otherwise you only see what you'd know in real life */
function withHint(a,h){return G.mode==='easy'&&h?tr(a)+(I18N.lang==='en'?' ':'')+tr(h):tr(a)}
function slipHTML(ev){
  const s=G.s,os=ev.opts(s),easy=G.mode==='easy';
  const keys=`<span class="kbd">1</span>–<span class="kbd">${os.length}</span>`;
  return Art.card({cls:'slip',c:Art.frame(ev.id),num:Art.num(ev.id),label:trE(ev.title),name:esc(t('tn.'+ev.id)),win:Art.win(ev.id,'slip-win'),body:`
  <div class="slip-top"><span class="stamp">${esc(t('g.decAge',{a:s.age}))}</span><span class="payto">${esc(t('g.payto'))}</span></div>
  <h2>${trE(ev.title)}</h2><p class="slip-text">${esc(withHint(ev.text(s),ev.hint&&ev.hint(s)))}</p>
  <div class="opts${easy?'':' blind'}">${os.map((o,i)=>{const dis=o.ok!==undefined&&o.ok!==true;return `<button class="opt" type="button" data-id="${o.id}"${dis?' disabled':''}><span class="okey" aria-hidden="true">${i+1}</span><span class="ot"><span class="ol">${trE(o.label)}${o.id===ev.def?`<span class="tag">${esc(t('g.default'))}</span>`:''}</span><span class="os">${dis?trE(o.ok):esc(withHint(o.sub,o.hint))}</span></span>${easy?`<span class="op" id="op-${o.id}">${dis?'':`<span class="pv muted">…</span><span class="pr">${esc(t('g.simulating'))}</span>`}</span>`:''}</button>`}).join('')}</div>
  <div class="slip-foot"><span id="projlbl">${esc(t(easy?'g.sim40':G.mode==='hard'?'g.footH':'g.footN'))}</span><span>${t('g.press',{k:keys})}</span></div>`});
}
/* a range bar: the line is zero, the pill is the middle 80% of futures, the dot is the typical one */
function scaleOf(rows){let mn=0,mx=0;for(const r of rows){if(r.base)continue;mn=Math.min(mn,r.lo);mx=Math.max(mx,r.hi)}if(mx-mn<1)mx=mn+1;return v=>((v-mn)/(mx-mn)*100).toFixed(2)+'%'}
function valHTML(r,B){if(r.base)return{c:'',v:`<span class="pv muted">${esc(t('g.baseline'))}</span>`};const flat=Math.abs(r.med)<.03*B,c=flat?'':cls(r.med);return{c,v:`<span class="pv ${c}">${flat?esc(t('g.same')):fm(r.med,true)}</span>`}}
function barHTML(r,X,c){return r.base?`<span class="rbar"><span class="rb-zero" style="left:${X(0)}"></span><span class="rb-med" style="left:${X(0)}"></span></span>`:`<span class="rbar ${c}"><span class="rb-zero" style="left:${X(0)}"></span><span class="rb-range" style="left:${X(r.lo)};width:calc(${X(r.hi)} - ${X(r.lo)})"></span><span class="rb-med" style="left:${X(r.med)}"></span></span>`}
function fillProj(){
  const P=G.proj;if(!P||G.mode!=='easy')return;const B=G.s.base;
  const lb=$('#projlbl');if(lb)lb.textContent=t('g.projlbl',{age:P.tgt});
  const X=scaleOf(Object.values(P.res));
  for(const id in P.res){const el=document.getElementById('op-'+id);if(!el)continue;const r=P.res[id],v=valHTML(r,B);
    if(r.base){el.innerHTML=`${v.v}${barHTML(r,X)}<span class="pr">${esc(t('g.twinPath'))}</span>`;continue}
    const risky=(r.hi-r.lo)>Math.max(2*Math.abs(r.med),.6*B);
    el.innerHTML=`${v.v}${barHTML(r,X,v.c)}<span class="pr">${esc(risky?t('g.risky',{a:MS(r.lo),b:MS(r.hi)}):t('g.byAge',{a:P.tgt}))}${Math.abs(r.earn)>.05*B?esc(t('g.lifePay',{a:MS(r.earn)})):''}</span>`;
  }
}
/* hindsight: how each option typically turned out, shown after you choose (Normal) and on the end card (all modes) */
const hv=r=>r.base?0:r.med;
function bestOf(h){return h.rows.reduce((b,r)=>!b||hv(r)>hv(b)?r:b,null)}
function hindHTML(h){
  const B=G.s.base,X=scaleOf(h.rows),left=Math.max(0,(G.hindEnd||0)-Date.now());
  /* only crown a best option when it clearly beats another one */
  const b0=bestOf(h),best=h.rows.some(r=>hv(b0)-hv(r)>=.03*B)?b0:null;
  const rows=h.rows.map(r=>{const v=valHTML(r,B),mine=r.id===h.pick;return `<li class="hrow${mine?' mine':''}"><span class="ol">${trE(r.label)}${mine?`<span class="tag">${esc(t('g.yours'))}</span>`:''}${r===best?`<span class="tag tag-best">${esc(t('g.bestTag'))}</span>`:''}</span><span class="op">${v.v}${barHTML(r,X,v.c)}</span></li>`}).join('');
  return Art.card({cls:'slip hind',c:Art.frame(h.id),num:Art.num(h.id),label:trE(h.title),name:esc(t('tn.'+h.id)),body:`
  <div class="slip-top"><span class="stamp">${esc(t('g.hindK',{a:h.age}))}</span></div>
  <h2>${trE(h.title)}</h2><p class="slip-text">${esc(t('g.hindP',{age:h.tgt}))}</p>
  <ul class="hrows">${rows}</ul>
  <div class="hfoot"><button class="btn btn-accent" id="hcont" type="button">${esc(t('g.cont'))} <span class="arr">→</span></button><span class="htimer" aria-hidden="true"><i style="animation-duration:${left}ms"></i></span></div>`});
}
/* the same life as the other sex: same family, choices and luck, so only the pay gap, the child penalty and lifespan differ */
function mirrorHTML(){const s=G.s,m=G.mirror;if(!m)return '';const a=s.deathAge,at=Math.min(a,m.deathAge);
  /* compare at the same age: yours from the chart history, theirs recorded by mirrorLife */
  const h=G.hs.find(x=>x[0]===at),myNw=h?h[1]:netWorth(s),myEarn=G.ea[at]!=null?G.ea[at]:s.earned;
  const box=(lk,v,mine,money)=>`<div><span class="lbl">${esc(lk)}</span><b>${money?fm(v):esc(String(v))}</b><span class="mvs">${esc(t('g.mirVs',{b:money?MN(mine):String(mine)}))}</span></div>`;
  return `<section class="stand"><h4>${esc(t('g.mirT.'+m.sex))}</h4><p class="muted">${esc(t('g.mirP'))}</p>
  <div class="sgrid mgrid">${box(t('g.mirNw',{a:at}),m.nwAt,myNw,1)}${box(t('g.mirInc',{a:at}),m.earnAt,myEarn,1)}${box(t('g.mirAge'),m.deathAge,a,0)}</div></section>`}
function hindAllHTML(){
  const B=G.s.base;if(!G.hinds.length)return '';
  const val=r=>r.base?esc(t('g.baseline')):`<b class="${cls(r.med)}">${fm(r.med,true)}</b>`;
  const put=(k,x,r)=>esc(t(k,{x,v:'\u0001'})).replace('\u0001',val(r));
  const li=G.hinds.map(h=>{const me=h.rows.find(r=>r.id===h.pick),b=bestOf(h);if(!me)return '';const top=hv(b)-hv(me)<.03*B;
    return `<li><span class="la">${h.age}</span><span class="lt"><span class="ll">${trE(h.title)} <span class="muted">· ${esc(t('g.byAge',{a:h.tgt}))}</span></span><span class="ln">${put('g.hindYou',me.label,me)} · ${top?esc(t('g.hindWasBest')):put('g.hindBest',b.label,b)}</span></span></li>`}).join('');
  return `<details class="hall"${G.mode==='hard'?' open':''}><summary>${esc(t('g.hindAll'))}</summary><p class="muted">${esc(t('g.hindAllP'))}</p><ul>${li}</ul></details>`;
}
function focusHTML(ph){
  if(ph==='child')return `<section class="panel"><div class="phead"><h3>${esc(t('g.childhood'))}</h3></div><p class="childtxt" id="childtxt"></p></section>`;
  if(ph==='ret')return `<section class="panel"><div class="phead"><h3>${esc(t('g.retiredT'))}</h3></div><p class="childtxt">${esc(t('g.retTxt',{p:M(G.s.pension?'g.pension':'g.statePension')}))}</p></section>`;
  return `<section class="panel"><div class="phead"><h3>${esc(t('g.focusT'))}</h3><span class="muted" style="font-size:13px" id="fsub">${esc(t('g.focusSub'))}</span></div>
  <div class="fgrid">${FOCUS.map(id=>`<button type="button" class="fbtn" data-f="${id}" data-cur="${esc(t('g.current'))}" aria-pressed="false"><span class="fname">${esc(t('f.'+id))}</span><span class="fdesc">${esc(t('f.'+id+'.d'))}</span>${G.mode==='easy'?`<span class="fproj" id="fp-${id}">…</span>`:''}</button>`).join('')}</div></section>`;
}
function updFocus(){
  const s=G.s,ph=phase(s);
  if(ph==='child'){const el=$('#childtxt');if(el)el.textContent=s.age<12?t('g.child0',{a:s.age,sk:Math.round(skill(s)),fam:M('fam.'+s.fam)}):s.age<16?t('g.child12'):t('g.child16');return}
  if(ph!=='adult')return;
  document.querySelectorAll('[data-f]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.f===s.focus)));
  const fc=G.fcache;if(G.mode!=='easy'||!fc||fc.age!==s.age)return;
  $('#fsub').textContent=t('g.focusSub2',{age:fc.tgt});
  for(const id of FOCUS){const el=document.getElementById('fp-'+id);if(!el)continue;if(id==='balance'){el.innerHTML=`${esc(t('g.baseline'))}<small>${esc(t('g.healthUp'))}</small>`;continue}
    const o=fc.out[id];el.innerHTML=`<span class="${cls(o.earn)}">${esc(t('g.fPay',{a:MS(o.earn)}))}</span><small>${esc(t('g.fNw',{a:MS(o.nw)}))}</small>`}
}
function queueFocus(){
  const s=G.s;if(G.mode!=='easy'||phase(s)!=='adult'||(G.fcache&&G.fcache.age===s.age)||G.fq)return;
  G.fq=setTimeout(()=>{G.fq=null;const s=G.s;if(!s||G.pending||G.ended||phase(s)!=='adult')return;const N=(G.playing&&speedI===2)?10:16;const p=projectFocus(s,N);G.fcache={age:s.age,tgt:p.tgt,out:p.out};updFocus()},50);
}
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
  const share=t('g.share',{c:cn,fam,a:s.deathAge,nw:MN(nw),rel,best:best[0]?M('g.best',{x:best[0].tk.label,v:MS(best[0].v)}):''})+(wp>0?t('g.shareW',{p:pctTxt(wp)}):'');
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
  <div class="cert-head"><span class="stamp">${esc(t('g.closed',{a:s.deathAge}))}</span>
    <h2>${esc(t('g.lifeIn',{c:cn,a:s.deathAge}))}</h2>
    <div class="cert-den ${nw<0?'loss':''}" data-fit>${fm(nw)}</div><span class="lbl">${esc(t('g.nwEnd'))}</span></div>
  <p class="cert-story">${esc(t('g.bornInto',{fam}))}${I18N.lang==='en'?' ':''}${story}</p>
  <div class="egrid"><div><span class="lbl">${esc(t('g.peak',{a:peak[0]}))}</span><b>${fm(peak[1])}</b></div><div><span class="lbl">${esc(t('g.lifeInc'))}</span><b>${fm(s.earned)}</b></div><div><span class="lbl">${esc(t('g.twinT'))}</span><b>${fm(tv)}</b></div><div><span class="lbl">${esc(t('g.ringHi'))}</span><b>${esc(t('g.ringOf',{n:s.milestones.ring||0}))}</b></div></div>
  ${mirrorHTML()}
  ${stand}
  <div class="elists"><div><h4>${esc(t('g.grew'))}</h4><ul>${li(best)}</ul></div><div><h4>${esc(t('g.cost'))}</h4><ul>${li(worst)}</ul></div></div>
  ${hindAllHTML()}
  <p class="share" id="share">${esc(share)}</p>
  <div class="erow"><button class="btn btn-accent" id="again" type="button">${esc(t('g.again'))} <span class="arr">→</span></button><button class="btn btn-ghost" id="same" type="button">${esc(t('g.sameC',{c:cn}))}</button><button class="btn btn-ghost" id="copy" type="button">${esc(t('g.copy'))}</button><button class="btn btn-ghost" id="home" type="button">${esc(t('g.home'))}</button></div>`});
}

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
  if(G.s){G.fcache=null;renderSlot(true);render();if(G.ended)drawSeal($('#certSeal'),netWorth(G.s),G.s.base,G.s.deathAge,true);if(!$('#toast').hidden&&G.toastMsg)$('#toast').textContent=tr(G.toastMsg)}});

/* ---------- controls ---------- */
$('#play').addEventListener('click',()=>{if(G.ended)return;G.playing=!G.playing;$('#play').textContent=t(G.playing?'g.pause':'g.play');schedule()});
$('#skip').addEventListener('click',()=>skipAhead());
document.addEventListener('keydown',e=>{
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
