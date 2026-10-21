/* A Second Chance: builds the deck of decisions (EV in engine.js) from the event data in gen/events.js, which
   tools/build.js makes from events/*.json. The format is described in events/README.md; in short, each event has an id,
   an age window and a weight (how likely it is in a life), conditions, options with scripts saying what they do (see
   js/script.js and js/verbs.js), follow-up cards, a tarot name and a drawing. Its text is in gen/<language>.js.
   Scripts are compiled the first time an event is needed, so a much bigger deck still loads quickly. */
(function(R){
'use strict';
const D=R.EVDATA;if(!D)throw new Error('gen/events.js is missing: run node tools/build.js');
const ent=o=>o?Object.entries(o):[];
const list=v=>Array.isArray(v)?v:[v];

/* ---------- conditions ----------
   An object of checks that must all hold, or one expression. "if" is who can get the card (checked at birth: country,
   family, sex); "when" is checked each year it could come up. Unknown keys are refused by tools/validate.js. */
const PT={date:'dating',live:'living',wed:'married'};
const ptState=s=>s.pt?PT[s.pt.st]:'single';
const STAT={health:s=>s.health,happy:s=>s.happy,rel:s=>s.rel,skill:s=>skill(s),cash:s=>s.cash,debt:s=>s.debt,liquid:s=>liquid(s),
 netWorth:s=>netWorth(s),salary:s=>salary(s),age:s=>s.age,kids:s=>s.kids.length,sloan:s=>s.sloan};
const CMP={'<':(a,b)=>a<b,'<=':(a,b)=>a<=b,'>':(a,b)=>a>b,'>=':(a,b)=>a>=b,'==':(a,b)=>a===b,'!=':(a,b)=>a!==b};
const flag=f=>b=>s=>!!f(s)===b;
const COND={
 country:v=>{const l=list(v);return s=>l.includes(C[s.ci][1])},
 family:v=>{const l=list(v);return s=>l.includes(s.fam)},
 sex:v=>s=>s.sex===v,
 age:([a,b])=>s=>s.age>=a&&s.age<=b,
 working:flag(s=>job(s)),job:flag(s=>s.job),studying:flag(s=>s.study),retired:flag(s=>s.retired),
 house:flag(s=>s.house),car:flag(s=>s.car),insured:flag(s=>s.insured),married:flag(s=>s.married),
 abroad:flag(s=>s.abroad!=null),selfEmployed:flag(s=>selfEmp(s)),canWorkAbroad:flag(s=>ctrWhen(s)),
 partner:v=>{const l=list(v);return s=>l.includes(ptState(s))},
 kids:v=>typeof v==='boolean'?s=>(s.kids.length>0)===v:s=>s.kids.length>=v[0]&&s.kids.length<=v[1],
 kidAge:([a,b])=>s=>hasKid(s,a,b),
 career:v=>{const l=list(v);return s=>!!s.job&&l.includes(s.job.id)},
 careerType:v=>{const l=list(v);return s=>!!s.job&&l.includes(CAR[s.job.id].f)},
 difficulty:v=>{const l=list(v);return s=>l.includes(s.dk)},
 stats:(o,sc)=>{const fs=ent(o).map(([k,rule])=>{const m=/^\s*(<=|>=|<|>|==|!=)\s*(.+)$/.exec(rule);if(!m)throw new Error('stats.'+k+': write it like "> .3*base"');
   const g=STAT[k]||(()=>{const f=ES.expr(k,sc);return s=>f({s,v:{}})})(),r=ES.expr(m[2],sc),op=CMP[m[1]];return s=>op(g(s),r({s,v:{}}))});
  return s=>fs.every(f=>f(s))}
};
function cond(spec,sc,pv,chainId){if(spec==null)return null;
 const ctx=s=>({s,v:chainId?Object.assign(Object.create(pv),{chain:s.chain&&s.chain[chainId]?s.chain[chainId].d:undefined}):pv});
 if(typeof spec==='string'){const f=ES.expr(spec,sc);return s=>f(ctx(s))}
 const parts=[];for(const[k,v]of ent(spec)){if(k==='test')continue;const mk=COND[k];if(!mk)throw new Error('unknown condition "'+k+'"');parts.push(mk(v,sc))}
 if(spec.test!=null){const f=ES.expr(spec.test,sc);parts.push(s=>f(ctx(s)))}
 return s=>{for(const f of parts)if(!f(s))return false;return true}}

/* ---------- one event ---------- */
function prefixed(f,p){return c=>f(c.p===p?c:{s:c.s,v:c.v,L:c.L,p})}
function make(e,ix){
 const tp=e.use?D.templates[e.use]:null;if(e.use&&!tp)throw new Error(e.id+': unknown template "'+e.use+'"');
 const pre='e.'+e.id,tpre=tp?'e.'+tp.key:pre;
 const PV=Object.assign(Object.create(null),tp&&tp.defaults,e.with);
 /* a template's scripts know the event they belong to as id */
 if(tp&&PV.id==null)PV.id=e.id;
 const lets=[...(tp?ent(tp.let).map(x=>[...x,tpre]):[]),...ent(e.let).map(x=>[...x,pre])];
 const fns=[...(tp?ent(tp.fn).map(x=>[...x,tpre]):[]),...ent(e.fn).map(x=>[...x,pre])];
 const vars=[...Object.keys(PV),...lets.map(l=>l[0]),'chain',...(e.who?['p']:[])],fnN=fns.map(f=>f[0]);
 const sc={vars,fns:fnN},csc={vars:[...Object.keys(PV),'chain']};
 const ev={id:e.id,ix,win:e.age||undefined,def:e.def,title:M(pre+'.t'),cc:e.country,chain:!!e.chain,art:e.art,tarot:e.tarot};
 if(e.dens!=null||e.country)ev.dens=e.dens!=null?e.dens:CDENS;
 if(e.surv)ev.surv=true;
 if(e.care)ev.care=M(e.care[0]==='.'?pre+e.care:e.care);
 /* everything that needs compiling is set up on first use */
 let ready=false;const C1={};
 const prep=()=>{if(ready)return;ready=true;Object.assign(C1,compileEvent(e,tp,{pre,tpre,PV,lets,fns,sc,csc}))};
 const lazy=k=>function(){prep();ev[k]=C1[k];return C1[k].apply(null,arguments)};
 ev.p=e.weight==null?1:typeof e.weight==='number'?e.weight:lazy('p');
 /* who can get it: born in the file's country, plus the event's own "if" */
 if(e.country||e.if)ev.only=lazy('only');
 if(e.when!=null||e.who)ev.when=lazy('when');
 /* the person a card is about ("who"): game.js keeps their name with the decision */
 if(e.who)ev.whoOf=lazy('whoOf');
 ev.opts=lazy('opts');ev.text=lazy('text');
 for(const k of['hint','preLog','again'])if(e[k]!=null)ev[k]=lazy(k);
 /* "pre" runs once before the card is shown; an event with only a "preLog" gets an empty one, so its diary line is written */
 if(e.pre!=null||e.preLog!=null)ev.pre=lazy('pre');
 ev._prep=prep;
 return ev}
function compileEvent(e,tp,X){const{pre,tpre,PV,lets,fns,sc,csc}=X,out={};
 const L=[...lets.map(([n,src,p])=>[n,prefixed(ES.expr(src,sc),p)])];
 const F=fns.map(([n,f,p])=>[n,f.args||[],prefixed(ES.script(f.do,{vars:sc.vars,fns:sc.fns,args:f.args||[]}),p)]);
 const env=s=>{const v=Object.create(PV);if(e.chain)v.chain=s.chain&&s.chain[e.id]?s.chain[e.id].d:undefined;if(pick)v.p=pick(s);const c={s,v,L:null,p:pre};
  for(const[n,args,body]of F)v[n]=(c2,...a)=>{const v2=Object.create(v);for(let i=0;i<args.length;i++)v2[args[i]]=a[i];return body({s:c2.s,v:v2,L:c2.L,p:c2.p})};
  for(const[n,f]of L)v[n]=f(c);return c};
 const ex=src=>prefixed(ES.expr(src,sc),pre),sx=src=>prefixed(ES.script(src,sc),pre);
 const msg=(spec,key)=>spec===true?()=>M(key):typeof spec==='string'?ex(spec):(()=>{const vs=ent(spec).map(([k,src])=>[k,ex(src)]);return c=>{const o={};for(const[k,f]of vs)o[k]=f(c);return M(key,o)}})();
 if(typeof e.weight==='string'){const f=ES.expr(e.weight,csc);out.p=s=>f({s,v:PV,p:pre})}
 const ifc=cond(e.if,csc,PV),cc=e.country?COND.country(e.country):null;
 out.only=ifc&&cc?s=>cc(s)&&ifc(s):ifc||cc;
 /* "who": the card needs someone of that role (their age, a test on p, how to choose among several); scripts and text see them as p */
 let pick=null;if(e.who){const w=e.who,wt=w.test!=null?ES.expr(w.test,{vars:[...csc.vars,'p']}):null;
  pick=s=>pplFind(s,w,wt?p=>!!wt({s,v:Object.assign(Object.create(PV),{p}),L:null,p:pre}):null);out.whoOf=pick}
 const wc=e.when!=null?cond(e.when,csc,PV,e.chain?e.id:null):null;
 out.when=pick?(wc?s=>wc(s)&&!!pick(s):s=>!!pick(s)):wc;
 /* the card's text: "text" (an expression), or the key e.<id>.x with "vars" */
 const tx=e.text!=null?ex(e.text):msg(e.vars||true,pre+'.x');out.text=s=>tx(env(s));
 if(e.hint!=null){const h=msg(e.hint,pre+'.h');out.hint=s=>h(env(s))}
 if(e.preLog!=null){const h=ex(e.preLog);out.preLog=s=>h(env(s))}
 if(e.pre!=null){const f=sx(e.pre);out.pre=s=>{f(env(s))}}else if(e.preLog!=null)out.pre=()=>{};
 if(e.again!=null){const f=sx(e.again);out.again=s=>{f(env(s))}}
 /* the options: template options first (if the event uses one), then the event's own */
 const OP=[...(tp?(tp.opts||[]).map(o=>option(o,tpre,sc)):[]),...(e.opts||[]).map(o=>option(o,pre,sc))];
 out.opts=s=>{const c=env(s),os=[];for(const O of OP)O.build(c,os);return os};
 return out}
/* an option, or a group of options made from a list ("each") */
function option(o,kp,sc){
 const as=o.each!=null?o.as||'it':null,osc=as?{vars:[...sc.vars,as],fns:sc.fns}:sc;
 const lets=ent(o.let).map(([n,src])=>[n,prefixed(ES.expr(src,osc),kp)]),lsc=lets.length?{vars:[...osc.vars,...lets.map(l=>l[0])],fns:sc.fns}:osc;
 const ex=src=>prefixed(ES.expr(src,lsc),kp);
 const idf=as?ex(o.id):null,show=o.show!=null?ex(o.show):null,label=o.label!=null?ex(o.label):null,ok=o.ok!=null?ex(o.ok):null,grp=o.grp!=null?ex(o.grp):null;
 const vmsg=(spec,suffix)=>{if(spec==null||spec===false)return null;if(spec===true)return(c,key)=>M(key+suffix);if(typeof spec==='string'){const f=ex(spec);return c=>f(c)}
  const vs=ent(spec).map(([k,src])=>[k,ex(src)]);return(c,key)=>{const v={};for(const[k,f]of vs)v[k]=f(c);return M(key+suffix,v)}};
 const sub=o.sub===undefined?(c,key)=>M(key+'.s'):vmsg(o.sub,'.s'),hint=vmsg(o.hint,'.h');
 const run=o.do!=null?prefixed(ES.script(o.do,lsc),kp):null,rel=o.rel,bond=o.bond;
 const nexts=list(o.next||[]).map(n=>({id:n.event,yrs:n.in,p:n.p,data:ent(n.data).map(([k,src])=>[k,ex(src)])}));
 const one=(c,out)=>{let cc=c;if(lets.length){const v=Object.create(c.v);cc={s:c.s,v,L:null,p:c.p};for(const[n,f]of lets)v[n]=f(cc)}
  if(show&&!show(cc))return false;
  const id=idf?String(idf(cc)):o.id,key=kp+'.'+id;
  const r={id,label:label?label(cc):M(key),sub:sub?sub(cc,key):undefined,go:null};
  if(ok){const k=ok(cc);if(k!==undefined)r.ok=k}
  const h=hint?hint(cc,key):undefined;if(rel!==undefined)r.hint=RH(rel,h);else if(hint)r.hint=h;
  if(grp)r.grp=grp(cc);
  const v=cc.v,p=cc.p;
  r.go=s=>{if(rel!==undefined)rl(s,rel);if(bond&&v.p)pplBond(s,v.p,bond);const c2={s,v,L:null,p};if(run)run(c2);
   for(const n of nexts){if(n.p!=null&&evR(s,'nextP'+n.id)()>=n.p)continue;const d={};for(const[k,f]of n.data)d[k]=f(c2);next(s,n.id,n.yrs,d)}};
  out.push(r);return true};
 const each=as?prefixed(ES.expr(o.each,sc),kp):null;
 return{build:as?(c,out)=>{const items=each(c);let n=0;for(const it of items||[]){const v=Object.create(c.v);v[as]=it;if(one({s:c.s,v,L:null,p:c.p},out)&&o.max&&++n>=o.max)break}}:one}}

/* ---------- consequences that arrive later ("later" in an event, a template or events/_shared.json) ---------- */
function laterKind(kind,src,p){let f=null;LATER[kind]=(s,x,L)=>{if(!f)f=ES.script(src,{vars:['x']});return f({s,v:{x},L:L||null,p})}}
for(const[k,src]of ent(D.later))laterKind(k,src,'e');
for(const[n,t]of ent(D.templates))for(const[k,src]of ent(t.later))laterKind(k,src,'e.'+t.key);
for(const e of D.events)for(const[k,src]of ent(e.later))laterKind(k,src,'e.'+e.id);

/* ---------- life texture: small moments that need no decision (events/_texture.json) ----------
   Weather, a hobby, a small win or loss, family news, school, work gossip, a festival. Each moment belongs to a group with
   conditions (an age stage, a country, a career, a family, wealth); its own conditions and a person ("who") narrow it further.
   Each year texYear() deals 2–4 that fit the life, at most one per kind (cat), favouring ones not seen yet; a moment comes
   back only after "again" years (default 10), or never with "once". About one in four has a small effect ("fx": cash as a
   share of a typical wage, happy, health, rel, bond with the person). Game rules, not data. Only the player's own life gets
   them (game.js and the validator call texYear; the twin, the 40 futures and the bots don't), so they never change a
   projection. */
const TXA=10,TXK={win:'good',loss:'bad'};
let TX=null;
function texPrep(){TX=[];for(const g of D.texture||[])for(const m of g.moments){
 const who=m.who||g.who||null,wt=who&&who.test!=null?ES.expr(who.test,{vars:['p']}):null,fx=m.fx||null;
 const tone=m.tone||(fx?((fx.cash||0)+(fx.happy||0)+(fx.health||0)+(fx.rel||0)>=0?'good':'bad'):TXK[m.cat||g.cat]||'');
 TX.push({id:m.id,cat:m.cat||g.cat,w:m.w==null?1:m.w,once:!!(m.once||g.once),again:m.again!=null?m.again:g.again!=null?g.again:TXA,fx,tone,who,
  wt:wt?(s,p)=>!!wt({s,v:{p},L:null,p:'tx'}):null,when:[cond(g.when,{vars:[]},{}),cond(m.when,{vars:[]},{})].filter(Boolean)})}}
function texFire(s,x,p){const f=x.fx||{},o={id:x.id,cat:x.cat,tone:x.tone,age:s.age},v={};
 if(p){v.p=pplWho(s,p,0);v.P=pplWho(s,p,1);v.n=M(p.n)}
 o.m=M('tx.'+x.id,v);
 /* money only from 18: a child's small wins and losses are their parents' */
 if(f.cash&&s.age>=18){const a=Math.abs(f.cash)*s.base;if(f.cash>0)s.cash+=a;else if(s.retired)payRet(s,a);else pay(s,a);o.a=MS(f.cash>0?a:-a);o.v=f.cash}
 if(f.happy){s.happy=clamp(s.happy+f.happy,0,100);o.happy=f.happy}
 if(f.health){s.health=clamp(s.health+f.health,3,100);o.health=f.health}
 if(f.rel){rl(s,f.rel);o.rel=f.rel}
 if(f.bond&&p)pplBond(s,p,f.bond);
 return o}
function texYear(s,L){if(!L||s.dead)return;if(!TX)texPrep();
 const a=s.age,r=evR(s,'tex'),seen=s.tx||(s.tx={}),cats=new Set(),ok=[];
 for(const x of TX){const last=seen[x.id];if(last!=null&&(x.once||a-last<x.again))continue;
  let good=true;for(const f of x.when)if(!f(s)){good=false;break}if(!good)continue;
  let p=null;if(x.who){p=pplFind(s,x.who,x.wt?q=>x.wt(s,q):null);if(!p)continue}
  ok.push([x,p,x.w*(last==null?4:1)])}
 let n=2+(r()<.45)+(r()<.12);
 while(n-->0){const c=ok.filter(o=>!cats.has(o[0].cat));if(!c.length)break;let tot=0;for(const o of c)tot+=o[2];
  let u=r()*tot,pick=c[c.length-1];for(const o of c){u-=o[2];if(u<=0){pick=o;break}}
  const[x,p]=pick;cats.add(x.cat);seen[x.id]=a;L(texFire(s,x,p))}}
R.texYear=texYear;

/* ---------- the deck ---------- */
D.events.forEach((e,i)=>EV.push(make(e,i)));
for(const e of EV){EVBY[e.id]=e;if(!e.win)EVX.push(e)}
R.Deck={compileAll(){for(const e of EV)e._prep();if(!TX)texPrep()},COND,STAT};
})(typeof window!=='undefined'?window:globalThis);
