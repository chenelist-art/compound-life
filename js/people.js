/* A Second Chance: the people in your life. Game rules, not published data (the numbers are ESTIMATES).
   s.ppl lists them: {id, r role, sex, n name key, d (their age minus yours), bond 0–100, dead (your age when they died),
   gone (no longer in your life: an ex-partner, a former boss, a friend you drifted from), and what happened to them:
   wed, eng (engaged), ret (retired), kids, away (moved abroad), moving}. Roles: mother, father, sib, friend, pt (partner),
   kid, boss, mentor. Names are keys nm.<country>.<f|m>.<n> from events/_names.json, so they show in every language.
   Everyone ages with you. Each year (pplYear, from tick) siblings are born and marry, parents retire, people may pass away,
   a friend may move abroad, bosses change, and closeness drifts toward a level that depends on who they are, your
   Relationships and the People focus. Choices on cards about them move it (an option's "bond", or bond() in a script).
   All randomness here has its own keys, so the people don't change the rest of a life's luck. */
/* average number of brothers and sisters, by country: an ESTIMATE loosely following each country's fertility a generation ago */
const SIBS={NG:2.6,ET:2.4,PK:2,PH:1.4,BD:1.1,IN:1.1,ID:1,MX:.9,VN:.8,MY:.8,BR:.7,US:.8,GB:.7,DE:.6,CN:.35,JP:.6,SG:.5};
/* where closeness settles for each kind of person (before your Relationships move it) */
const BOND={mother:60,father:60,sib:55,friend:55,pt:65,kid:70,boss:50,mentor:55};
const PPL_ROLES=['mother','father','sib','friend','pt','kid','boss','mentor'],PPL_GROUP={parent:['mother','father']};
const pplR=(s,k)=>evR(s,'ppl'+k)();
const pplAge=(s,p)=>s.age+p.d;
/* in your life right now: born, alive, not gone */
const pplHere=(s,p)=>p.dead==null&&!p.gone&&s.age+p.d>=0;
/* a name nobody in this life has had; if the list runs out, one that no relative and nobody still around has */
function pplPick(s,code,sex,r){const N=(typeof EVDATA!=='undefined'&&EVDATA.names&&EVDATA.names[code])||{f:1,m:1},n=N[sex]||1,P=s.ppl||[],key=i=>'nm.'+code+'.'+sex+'.'+i;
 const ever=new Set(P.map(p=>p.n)),near=new Set(P.filter(p=>['mother','father','sib','kid','pt'].includes(p.r)||pplHere(s,p)).map(p=>p.n)),i0=Math.floor(r()*n);
 for(const used of[ever,near])for(let k=0;k<n;k++){const i=(i0+k)%n;if(!used.has(key(i)))return key(i)}return key(i0)}
function pplName(s,sex,code,salt){return pplPick(s,code,sex,evR(s,'nm'+salt))}
function pplAdd(s,o){o.id='p'+(s.pplN=(s.pplN||0)+1);if(o.bond==null)o.bond=BOND[o.r];o.at=s.age;s.ppl.push(o);return o}
/* parents and brothers and sisters, at birth */
function pplBorn(s){const r=mb(hsh(s.seed,'ppl')),code=C[s.ci][1],k=clamp(Math.log(s.base/3000)/Math.log(35000/3000),0,1);s.ppl=[];s.pplN=0;
 const nm=sex=>pplPick(s,code,sex,r);
 const md=clamp(Math.round(23+8*k+(r()-.5)*8),17,44);
 pplAdd(s,{r:'mother',sex:'f',n:nm('f'),d:md,bond:70});pplAdd(s,{r:'father',sex:'m',n:nm('m'),d:md+Math.floor(r()*7)-1,bond:65});
 const lam=SIBS[code]||1,L=Math.exp(-lam);let n=0,q=r();while(q>L&&n<5){n++;q*=r()}
 for(let i=0;i<n;i++){let d=1;for(let t=0;t<12;t++){d=-10+Math.floor(r()*23);if(d!==0&&d<=md-17&&d>=-(44-md))break}const sex=r()<.5?'f':'m';pplAdd(s,{r:'sib',sex,n:nm(sex),d,bond:60})}
 return s.ppl}
/* keep the list in step with the rest of the life: a new partner, children, a boss for each job, a mentor */
function pplSync(s){const P=s.ppl;if(!P)return null;let msg=null;const code=workCode(s);
 for(const p of P)if(p.r==='pt'&&!p.gone&&(!s.pt||s.pt.n!==p.ptn)){p.gone=true;p.ex=s.age}
 if(s.pt&&!P.some(p=>p.r==='pt'&&p.ptn===s.pt.n)){const sex=s.meetSex||(pplR(s,'ptSex'+s.pt.n)<.9?(s.sex==='f'?'m':'f'):s.sex);
  pplAdd(s,{r:'pt',sex,n:s.meetName||pplName(s,sex,code,'pt'+s.pt.n),d:Math.round((pplR(s,'ptAge'+s.pt.n)-.5)*8),ptn:s.pt.n,bond:65});s.meetName=null;s.meetSex=null}
 for(const b of s.kids)if(!P.some(p=>p.r==='kid'&&p.b===b)){const sex=pplR(s,'kidSex'+b)<.5?'f':'m';pplAdd(s,{r:'kid',sex,n:pplName(s,sex,code,'kid'+b),d:-b,b,bond:75})}
 const boss=P.find(p=>p.r==='boss'&&!p.gone),bossy=s.job&&!s.retired&&['office','hands','sport'].includes(CAR[s.job.id].f);
 if(boss&&(!bossy||boss.tk!==s.job.tk))boss.gone=true;
 if(bossy&&!P.some(p=>p.r==='boss'&&!p.gone)){const sex=pplR(s,'bossSex')<.5?'f':'m',nb=pplAdd(s,{r:'boss',sex,n:pplName(s,sex,code,'boss'+s.pplN),d:5+Math.floor(pplR(s,'bossAge')*16),tk:s.job.tk});
  if(boss&&boss.tk===s.job.tk)msg=M('log.ppl.boss',{n:M(nb.n)})}
 if((s.done.mentor==='yes'||s.done.mentor==='some')&&!P.some(p=>p.r==='mentor')){const sex=pplR(s,'menSex')<.5?'f':'m';pplAdd(s,{r:'mentor',sex,n:pplName(s,sex,code,'mentor'),d:12+Math.floor(pplR(s,'menAge')*14)})}
 return msg}
/* one year for everyone (from tick, at your age a) */
function pplYear(s,a,L){if(!s.ppl)return;const lg=(m,k)=>{L&&L(m,k)};const bm=pplSync(s);if(bm)lg(bm,'');const le=C[s.ci][4],code=workCode(s);
 /* someone you'll meet: their name and sex are known before the date card */
 if(s.meetAt===a+1&&!s.pt&&!s.meetName){s.meetSex=pplR(s,'meetSex')<.9?(s.sex==='f'?'m':'f'):s.sex;s.meetName=pplName(s,s.meetSex,code,'meet'+a)}
 /* a best friend from school, and a new one now and then if you have none */
 const fr=s.ppl.find(p=>p.r==='friend'&&pplHere(s,p));
 if(!fr&&a>=6&&a<=70&&(a===6||pplR(s,'newFriend')<.12)){const sex=pplR(s,'frSex')<.7?s.sex:(s.sex==='f'?'m':'f');const f=pplAdd(s,{r:'friend',sex,n:pplName(s,sex,code,'fr'+s.pplN),d:a<18?0:Math.round((pplR(s,'frAge')-.5)*6)});lg(M('log.ppl.friend',{n:M(f.n)}),'good')}
 for(const p of s.ppl){if(p.dead!=null||p.gone)continue;const x=a+p.d;if(x<0)continue;
  if(x===0&&p.r==='sib'){lg(M('log.ppl.born',{p:pplWho(s,p,1)}),'good');continue}
  /* passing away: the same kind of risk as yours, at their age, for the country's life expectancy */
  if(['mother','father','sib','friend','mentor'].includes(p.r)&&x>=1){const mu=.09*Math.exp(.09*(x-(le+8)))+(x<40?.0002:.0006);
   if(pplR(s,'die'+p.id)<mu){p.dead=a;const par=p.r==='mother'||p.r==='father';s.happy=clamp(s.happy-(par?6:p.r==='sib'?5:p.r==='friend'?4:2),0,100);
    lg(M(par?'log.ppl.dieP':'log.ppl.die',{p:pplWho(s,p,1)}),'bad');continue}}
  if(p.r==='mother'||p.r==='father'){if(!p.ret&&x>=60+(+p.id.slice(1))%6){p.ret=true;lg(M('log.ppl.ret',{p:pplWho(s,p,1)}),'')}}
  /* weddings: the first sibling's and the first child's come as cards (sib_wed, kid_wed), the rest in the diary; from three
     years before the country's average age at first marriage for their sex (js/data.js) */
  if((p.r==='sib'||p.r==='kid')&&!p.wed&&!p.eng&&x>=Math.round(smam(C[s.ci][1],p.sex))-3&&x<=40&&pplR(s,'wed'+p.id)<.1){const card=p.r==='sib'?'sib_wed':'kid_wed';
   if(!s.done[card]&&a>=16&&a<90)p.eng=true;else{p.wed=true;lg(M('log.ppl.wed',{p:pplWho(s,p,1)}),'good')}}
  if(p.r==='friend'&&!p.wed&&x>=24&&x<=45&&(s.done.fwed||a>34)&&pplR(s,'wed'+p.id)<.08){p.wed=true;lg(M('log.ppl.wed',{p:pplWho(s,p,1)}),'good')}
  if((p.r==='sib'||p.r==='kid')&&p.wed&&x>=24&&x<=42&&(p.kids||0)<3&&pplR(s,'baby'+p.id)<.15){p.kids=(p.kids||0)+1;lg(M(p.r==='kid'?'log.ppl.grand':'log.ppl.baby',{p:pplWho(s,p,1),x:M('sex.kid.'+(pplR(s,'babySex'+p.id)<.5?'f':'m'))}),'good')}
  if(p.r==='friend'&&!p.away&&!p.moving&&x>=22&&x<=55&&pplR(s,'move'+p.id)<.015){if(!s.done.friend_move&&a>=18)p.moving=true;else{p.away=true;lg(M('log.ppl.away',{p:pplWho(s,p,1)}),'')}}
  if(p.r==='boss'&&pplR(s,'bossGo'+p.id)<.07){p.gone=true;continue}
  if(p.r==='mentor'&&a>=p.at+8){p.gone=true;continue}
  /* closeness drifts toward its level: higher with good Relationships and the People focus, lower when far away */
  const tg=BOND[p.r]+(s.rel-50)*.3-(p.away?10:0);p.bond=clamp(p.bond+(tg-p.bond)*.05+(s.focus==='people'&&a>=18&&!s.study?1:0),0,100);
  if(p.r==='friend'&&a>=18&&p.bond<15){p.gone=true;lg(M('log.ppl.apart',{p:pplWho(s,p,0)}),'bad')}}
 pplSync(s)}

/* ---------- reading the list ---------- */
/* how a person is called: mother, father, big sister, little brother, best friend, partner, son, daughter, boss, mentor */
function pplRk(s,p){if(p.r==='sib')return 'sib.'+p.sex+'.'+(p.d>0?'old':'young');if(p.r==='kid')return 'kid.'+p.sex;return p.r}
/* "your sister Mei" (cap: "Your sister Mei") */
function pplWho(s,p,cap){return M(cap?'ppl.Who':'ppl.who',{r:M('ppl.r.'+pplRk(s,p)),n:M(p.n)})}
/* the people of a role (or "parent") in your life now */
function pplOf(s,role){const rs=PPL_GROUP[role]||[role];return(s.ppl||[]).filter(p=>rs.includes(p.r)&&pplHere(s,p))}
/* the person a card is about: role, their age, dead or alive, and how to choose among several */
function pplFind(s,spec,test){const rs=PPL_GROUP[spec.role]||[spec.role];
 let L=(s.ppl||[]).filter(p=>rs.includes(p.r)&&!p.gone&&(spec.dead?p.dead!=null:p.dead==null)&&s.age+p.d>=0);
 if(spec.age)L=L.filter(p=>{const x=s.age+p.d;return x>=spec.age[0]&&x<=spec.age[1]});
 if(test)L=L.filter(test);if(!L.length)return null;
 if(spec.pick==='oldest')return L.reduce((a,b)=>b.d>a.d?b:a);if(spec.pick==='youngest')return L.reduce((a,b)=>b.d<a.d?b:a);
 if(spec.pick==='closest')return L.reduce((a,b)=>b.bond>a.bond?b:a);return L[0]}
function pplGet(s,x){return typeof x==='string'?(s.ppl||[]).find(p=>p.id===x)||null:x}
/* change closeness: one person (or id), or everyone of a role */
function pplBond(s,x,d){const L=typeof x==='string'&&(PPL_GROUP[x]||PPL_ROLES.includes(x))?pplOf(s,x):[pplGet(s,x)];for(const p of L)if(p)p.bond=clamp(p.bond+d,0,100)}
/* your parents together ("your parents Siti and Budi"), or the one still living */
function pplFolks(s,cap){const L=pplOf(s,'parent');if(L.length>=2)return M(cap?'ppl.Parents':'ppl.parents',{a:M(L[0].n),b:M(L[1].n)});if(L.length)return pplWho(s,L[0],cap);return M(cap?'ppl.Parents0':'ppl.parents0')}
/* names joined: "Mei", "Mei and Agus", "Mei, Agus and Tunde" */
function pplList(ps){const n=ps.map(p=>M(p.n));if(n.length<=1)return n[0]||'';if(n.length===2)return M('ppl.l2',{a:n[0],b:n[1]});if(n.length===3)return M('ppl.l3',{a:n[0],b:n[1],c:n[2]});return M('ppl.l4',{a:n[0],b:n[1],c:n[2]})}
/* your brothers and sisters: "your sister Mei", or "your siblings Mei and Agus" */
function pplSibs(s){const L=pplOf(s,'sib');return L.length===1?pplWho(s,L[0],0):M('ppl.sibs',{l:pplList(L)})}
/* parents who are still alive pass away (the inheritance cards say they have) */
function pplParentsPass(s){for(const p of pplOf(s,'parent'))p.dead=s.age}
/* the closest person who could help you (family and friends), for the diary */
function pplClosest(s){let b=null;for(const p of s.ppl||[])if(pplHere(s,p)&&p.r!=='boss'&&p.r!=='mentor'&&p.r!=='kid'&&(!b||p.bond>b.bond))b=p;return b}
/* the people shown next to your pixel character and in the replay: partner, children, parents, siblings, friend, boss, mentor */
const PPL_ORDER={pt:0,kid:1,mother:2,father:3,sib:4,friend:5,boss:6,mentor:7};
function pplView(s){return(s.ppl||[]).filter(p=>pplHere(s,p)).sort((a,b)=>PPL_ORDER[a.r]-PPL_ORDER[b.r]||b.d-a.d).map(p=>({id:p.id,n:p.n,rk:pplRk(s,p),x:s.age+p.d,b:Math.round(p.bond),away:!!p.away}))}
/* a child's university fees: the education fund's figure, or the same estimate (60% of a degree), and any bursary */
function pplKidFee(s){return(s.kidFee||s.uni*s.base*.6)*(s.kidFeeM||1)}
