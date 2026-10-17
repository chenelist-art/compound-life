/* Landing page: live counters, the hero tarot card with its turning sun, the money lab, and the birth map.
   Text comes from js/i18n.js; static copy is translated through data-i18n attributes. */
(function(){
const $=q=>document.querySelector(q);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const tok=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const esc=x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- serial + counters ---------- */
const sn=String(Math.floor(Math.random()*1e9)).padStart(9,'0');
$('#serialNo').textContent='CL '+sn.slice(0,3)+' '+sn.slice(3,6)+' '+sn.slice(6);
$('#noteSerial').textContent='CL'+sn;
const t0=performance.now();
function counters(){const s=(performance.now()-t0)/1000;$('#cBirth').textContent=Math.floor(s*4.2).toLocaleString('en-US');$('#cDeath').textContent=Math.floor(s*1.95).toLocaleString('en-US')}
counters();setInterval(counters,250);

/* ---------- tarot cards: corners, ribbon tails, drawings ---------- */
Art.decorate();

/* ---------- the turning sun on the hero card ---------- */
const hc=$('#heroRosette');let phase=0,last=0,heroVis=true;
function heroDraw(){Guilloche.render(hc,Object.assign({},Guilloche.SUN,{phase}))}
function heroLoop(ts){requestAnimationFrame(heroLoop);if(!heroVis||document.hidden||ts-last<42)return;last=ts;phase+=.012;heroDraw()}
heroDraw();
if(!reduce){requestAnimationFrame(heroLoop);try{new IntersectionObserver(e=>{heroVis=e[0].isIntersecting}).observe(hc)}catch(e){}}
function statics(){Guilloche.render($('#finalRosette'),Object.assign({},Guilloche.SUN,{phase:1.1}))}
statics();

/* tilt, and the colour strip slides with the pointer */
const note=$('#heroNote'),stage=document.querySelector('.hero');
if(!reduce&&matchMedia('(hover:hover)').matches){
  stage.addEventListener('pointermove',e=>{const r=note.getBoundingClientRect();const x=clamp((e.clientX-r.left)/r.width,0,1),y=clamp((e.clientY-r.top)/r.height,0,1);
    note.style.transform=`rotate(-3deg) rotateY(${(x-.5)*14}deg) rotateX(${(.5-y)*10}deg)`;note.style.setProperty('--shift',x)});
  stage.addEventListener('pointerleave',()=>{note.style.transform='';note.style.setProperty('--shift','.5')});
}

/* ---------- money lab ---------- */
const L={ci:C.findIndex(c=>c[1]==='MY'),study:'uni',pct:.15,start:22,hover:null};
const STUDY={work:{p:0,start:18,fee:0},dip:{p:.12,start:20,fee:.35},uni:{p:.26,start:22,fee:1}};
const sel=$('#labCountry');
function fillCountries(){sel.innerHTML='';C.map((c,i)=>[I18N.cname(i),i]).sort((a,b)=>a[0].localeCompare(b[0],I18N.locale())).forEach(([n,i])=>{const o=document.createElement('option');o.value=i;o.textContent=n;if(i===L.ci)o.selected=true;sel.appendChild(o)})}
fillCountries();
function labRun(ci,study,pct,startInv){
  const c=C[ci],W=c[3],S=STUDY[study],fee=S.fee*c[6]*W;
  let pot=0,contrib=0,cum=0;const pts=[];
  for(let a=18;a<=70;a++){
    pot*=1.05;
    const y=a-S.start;
    let pay=a<S.start?.25*W:W*(1+S.p)*(1+.015*Math.min(y,25))*Math.pow(1.012,Math.min(y,30));
    if(a>=65)pay=0;
    cum+=pay;
    if(a>=S.start&&a>=startInv&&a<65){const net=pay-Math.max(0,pay-.4*W)*.18;const inv=net*pct;pot+=inv;contrib+=inv}
    pts.push({a,pot,contrib,cum,pay});
  }
  return{pts,fee,W};
}
function labUpdate(){
  const A=labRun(L.ci,L.study,L.pct,L.start);
  const B=labRun(L.ci,L.study==='work'?'uni':'work',L.pct,L.start);
  const at=(R,a)=>R.pts[a-18];
  const p65=at(A,65),gr=p65.pot-p65.contrib;
  $('#roPot').textContent=fm(p65.pot);$('#roIn').textContent=fm(p65.contrib);$('#roGr').textContent=fm(gr);
  $('#roGrN').textContent=p65.pot>0?t('l.grN',{p:Math.round(gr/p65.pot*100)}):t('l.grNone');
  $('#roPotN').textContent=p65.pot>0?t('l.potN',{n:Math.round(p65.pot/A.W)}):t('l.potNone');
  const S=STUDY[L.study],cn=I18N.cname(L.ci);
  $('#studyHint').textContent=L.study==='work'?t('l.hintWork'):t('l.hintStudy',{a:MN(A.fee),p:Math.round(S.p*100)});
  const eff=Math.max(L.start,S.start);
  $('#startHint').textContent=L.start<S.start?t('l.startLate',{a:S.start}):eff===S.start?t('l.startFirst'):t('l.startWait',{n:eff-S.start});
  if(L.study==='work'){
    const U=labRun(L.ci,'uni',L.pct,L.start);let pb=null;for(const p of U.pts){const d=p.cum-U.fee-at(A,p.a).cum;if(p.a>22&&d>=0){pb=p.a;break}}
    $('#pbAge').textContent='18';
    $('#pbText').innerHTML=pb?t('l.pbWorkYes',{c:esc(cn),a:MN(U.fee),n:pb}):t('l.pbWorkNo',{c:esc(cn),a:MN(U.fee)});
  }else{
    const W0=labRun(L.ci,'work',L.pct,L.start);let pb=null;for(const p of A.pts){const d=p.cum-A.fee-at(W0,p.a).cum;if(p.a>S.start&&d>=0){pb=p.a;break}}
    const extra=at(A,65).cum-A.fee-at(W0,65).cum;
    $('#pbAge').textContent=pb?pb:'—';
    $('#pbText').innerHTML=pb?t('l.pbYes',{d:M(L.study==='uni'?'l.degree':'l.diploma'),n:pb,a:MN(extra)}):t('l.pbNo',{c:esc(cn),d2:M(L.study==='uni'?'l.aDegree':'l.aDiploma')});
  }
  $('#cmpLbl').textContent=t(L.study==='work'?'l.cmpUni':'l.cmpWork');
  $('#labPctV').textContent=Math.round(L.pct*100)+'%';$('#labStartV').textContent=L.start;
  fillRange($('#labPct'));fillRange($('#labStart'));
  L.A=A;L.B=B;drawLab();
}
function fillRange(el){const p=(el.value-el.min)/(el.max-el.min)*100;el.style.setProperty('--fill',p+'%')}
sel.addEventListener('change',()=>{L.ci=+sel.value;labUpdate()});
document.querySelectorAll('#labStudy button').forEach(b=>b.addEventListener('click',()=>{L.study=b.dataset.v;document.querySelectorAll('#labStudy button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));labUpdate()}));
$('#labPct').addEventListener('input',e=>{L.pct=e.target.value/100;labUpdate()});
$('#labStart').addEventListener('input',e=>{L.start=+e.target.value;labUpdate()});

function nice(x){const p=Math.pow(10,Math.floor(Math.log10(x)));const f=x/p;return(f<1.5?1:f<3?2:f<7?5:10)*p}
function drawLab(){
  const cv=$('#labChart');const w=cv.clientWidth,h=cv.clientHeight;if(!w||!L.A)return;
  const dpr=Math.min(devicePixelRatio||1,2);cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);
  const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
  const ink=tok('--charcoal'),mizu=tok('--mizu'),yama=tok('--yamabuki'),coral=tok('--coral'),washi=tok('--washi'),font=tok('--font');
  const A=L.A.pts,B=L.B.pts;let mx=1;for(const p of A.concat(B))mx=Math.max(mx,p.pot);
  const st=nice(mx/4);const top=Math.ceil(mx/st)*st;
  x.font=`12px ${font}`;const tks=[];for(let v=0;v<=top+st/2;v+=st)tks.push(v);
  const pl=Math.max(...tks.map(v=>x.measureText(fm(v)).width))+12,pr=12,pt=12,pb=26;
  const X=a=>pl+(a-18)/(70-18)*(w-pl-pr),Y=v=>pt+(1-v/top)*(h-pt-pb);
  x.lineJoin='round';x.lineCap='round';
  /* flat palette areas, outlined in charcoal */
  const area=(lo,hi,fill)=>{x.beginPath();A.forEach((p,i)=>{const yy=Y(hi(p));i?x.lineTo(X(p.a),yy):x.moveTo(X(p.a),yy)});for(let i=A.length-1;i>=0;i--)x.lineTo(X(A[i].a),Y(lo(A[i])));x.closePath();x.fillStyle=fill;x.fill()};
  area(()=>0,p=>p.contrib,mizu);area(p=>p.contrib,p=>p.pot,yama);
  x.textAlign='right';x.textBaseline='middle';x.strokeStyle=ink;
  for(const v of tks){x.lineWidth=v?1:2;x.setLineDash(v?[1,5]:[]);x.beginPath();x.moveTo(pl,Math.round(Y(v))+.5);x.lineTo(w-pr,Math.round(Y(v))+.5);x.stroke();x.fillStyle=ink;x.fillText(fm(v),pl-8,Y(v))}
  x.setLineDash([]);x.textAlign='center';x.textBaseline='top';for(let a=20;a<=70;a+=10){x.fillText(String(a),X(a),h-pb+9)}
  x.setLineDash([4,5]);x.lineWidth=1.5;x.beginPath();x.moveTo(X(65)+.5,pt);x.lineTo(X(65)+.5,h-pb);x.stroke();x.setLineDash([]);
  x.textAlign='right';x.textBaseline='top';x.fillText(t('l.retire'),X(65)-6,pt+2);
  const path=(pts,f)=>{x.beginPath();pts.forEach((p,i)=>{const yy=Y(f(p));i?x.lineTo(X(p.a),yy):x.moveTo(X(p.a),yy)});x.stroke()};
  x.lineWidth=1.5;path(A,p=>p.contrib);
  x.setLineDash([6,5]);x.lineWidth=2;path(B,p=>p.pot);x.setLineDash([]);
  x.lineWidth=3;path(A,p=>p.pot);
  const e=A[65-18];x.fillStyle=coral;x.lineWidth=2.5;x.beginPath();x.arc(X(65),Y(e.pot),5.5,0,7);x.fill();x.stroke();
  if(L.hover!=null){const a=L.hover,p=A[a-18],q=B[a-18];x.lineWidth=1.5;x.beginPath();x.moveTo(X(a)+.5,pt);x.lineTo(X(a)+.5,h-pb);x.stroke();
    x.fillStyle=washi;x.lineWidth=2.5;x.beginPath();x.arc(X(a),Y(p.pot),4.5,0,7);x.fill();x.stroke();
    const tx=t('l.hover',{a,b:MN(p.pot),c:MN(p.contrib),d:MN(q.pot)});x.font=`12px ${font}`;const tw=x.measureText(tx).width+20;const bx=Math.min(Math.max(X(a)-tw/2,pl),w-pr-tw);
    x.fillStyle=washi;x.lineWidth=2;x.beginPath();x.roundRect?x.roundRect(bx,pt,tw,26,13):x.rect(bx,pt,tw,26);x.fill();x.stroke();x.fillStyle=ink;x.textAlign='left';x.textBaseline='middle';x.fillText(tx,bx+10,pt+13.5)}
  L.geo={pl,pr,w};
}
const lc=$('#labChart');
lc.addEventListener('pointermove',e=>{const g=L.geo;if(!g)return;const r=lc.getBoundingClientRect();const a=Math.round(18+(e.clientX-r.left-g.pl)/(g.w-g.pl-g.pr)*52);L.hover=a>=18&&a<=70?a:null;drawLab()});
lc.addEventListener('pointerleave',()=>{L.hover=null;drawLab()});
labUpdate();

/* ---------- birth map ---------- */
const tot=C.reduce((a,c)=>a+c[2],0);
const order=C.map((c,i)=>i).sort((a,b)=>C[b][2]-C[a][2]);
const PAL=['--coral','--yamabuki','--mizu','--wakatake'];
const share=i=>C[i][2]/tot*100;
const pct=v=>v>=1?Math.round(v)+'%':v>=.1?v.toFixed(1)+'%':'<0.1%';
let infoI=order[0];
function strip(){
  $('#strip').innerHTML=order.map((i,k)=>{const s=share(i),c=C[i],n=I18N.cname(i);return `<button type="button" class="cseg" data-i="${i}" style="flex-grow:${c[2]};--c:var(${PAL[k%PAL.length]})" aria-label="${esc(t('l.aria',{c:n,p:pct(s)}))}">${s>=4.5?`<span><b>${Math.round(s)}%</b>${esc(n)}</span>`:''}</button>`}).join('');
  document.querySelectorAll('.cseg').forEach(b=>{const i=+b.dataset.i;b.addEventListener('mouseenter',()=>info(i));b.addEventListener('focus',()=>info(i));b.addEventListener('click',()=>info(i))});
  info(infoI);
  const maxS=share(order[0]);
  $('#tbl').innerHTML=order.map(i=>{const c=C[i],s=share(i);return `<tr><td>${esc(I18N.cname(i))}</td><td><span class="sbar" style="width:${Math.max(2,s/maxS*120)}px"></span><span class="num">${pct(s)}</span></td><td class="n">${fm(c[3])}</td><td class="n">${c[4]}</td><td class="n">${esc(t('l.yrsPay',{n:c[5]}))}</td><td class="n">${esc(c[6]<1?t('l.moPay',{n:Math.round(c[6]*12)}):t('l.yrsPay',{n:c[6]}))}</td></tr>`}).join('');
}
function info(i){infoI=i;const c=C[i];document.querySelectorAll('.cseg').forEach(b=>b.classList.toggle('on',+b.dataset.i===i));
  $('#stripInfo').innerHTML=`<strong class="si-name">${esc(I18N.cname(i))}</strong><span>${t('l.si1',{p:pct(share(i))})}</span><span>${t('l.si2',{a:MN(c[3])})}</span><span>${t('l.si3',{n:c[4]})}</span><span>${t('l.si4',{n:c[5]})}</span>`}
strip();

/* ---------- language, resize ---------- */
function redraw(){heroDraw();statics();drawLab()}
window.addEventListener('langchange',()=>{document.title=t('l.title');fillCountries();labUpdate();strip()});
document.title=t('l.title');
let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(redraw,120)});
document.fonts&&document.fonts.ready.then(()=>drawLab());
})();
