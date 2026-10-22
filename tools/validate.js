/* Checks every event before it reaches the game:
   - the files are valid JSON with the expected fields, and event ids are unique
   - conditions use known checks ("if", "when"), weights and ages make sense
   - every expression and script compiles, calls only known verbs, and reads only fields a life really has
   - every option's default exists, and the default can always be picked
   - text: English, Simplified and Traditional Chinese all present, with the same {placeholders}; nothing missing
   - every tarot name and drawing exists; every follow-up card (next) and consequence (later) exists
   - small moments (events/_texture.json): fields, conditions, effects, text in the three languages
   - gen/ matches the sources (run node tools/build.js after editing)
   - then it plays lives with random choices in all three languages and reports crashes, cards whose default can't be
     picked, and text that comes out as a raw key or with an unfilled {placeholder}
   node tools/validate.js            all checks and 300 simulated lives
   node tools/validate.js 1000       more lives
   node tools/validate.js --quick    no simulation */
const fs=require('fs'),path=require('path'),vm=require('vm');
const B=require('./build.js');
const{LANGS,ROOT,full}=B;

const EVENT_KEYS=new Set(['id','src','age','weight','dens','if','when','chain','def','tarot','art','surv','care','use','with','let','fn','text','vars','hint','pre','preLog','again','opts','later','i18n','country','_file','who']);
const OPT_KEYS=new Set(['each','as','max','id','let','show','label','sub','hint','ok','rel','bond','do','next','grp']);
const WHO_KEYS=new Set(['role','age','test','pick','dead']),WHO_ROLES=['mother','father','parent','sib','friend','pt','kid','boss','mentor'];
const TPL_KEYS=new Set(['key','about','defaults','let','fn','opts','later','i18n']);
const BG=new Set(['co','ya','mi','wa','wh']);
/* small moments: their kinds, fields and effects (fx: cash is a share of a typical wage; the rest are points) */
const TX_CATS=['weather','hobby','win','loss','family','health','school','work','festival','home','friends','money'];
const TX_GROUP=new Set(['id','about','cat','when','who','again','once','moments']),TX_KEYS=new Set(['id','cat','when','who','w','once','again','fx','tone','en','zh','zht']);
const TX_FX={cash:.05,happy:4,health:4,rel:4,bond:8};

/* the game's code in a sandbox, for compiling scripts and for the simulation */
function sandbox(gen,langs){const ctx={console};vm.createContext(ctx);
 const run=(f,src)=>vm.runInContext(src!=null?src:fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
 run('js/i18n.js');for(const L of langs||['en'])run('gen/'+L+'.js',gen['gen/'+L+'.js']);
 for(const f of['js/data.js','js/engine.js','js/people.js','js/script.js','js/verbs.js'])run(f);
 return{ctx,run}}
function artNames(){const src=fs.readFileSync(path.join(ROOT,'js/art.js'),'utf8');
 const cards=new Set([...src.matchAll(/^(\w+):\{n:'/gm)].map(m=>m[1]));const a=src.indexOf('const CA={'),b=src.indexOf('\n};',a);
 const themes=new Set([...src.slice(a,b).matchAll(/^(\w+):\(\)=>/gm)].map(m=>m[1]));return{cards,themes}}
/* fields a life has: those newLife() sets, those the engine and verbs set, and those any event script sets */
function engineFields(){const out=new Set();for(const f of['js/engine.js','js/people.js','js/verbs.js']){const src=fs.readFileSync(path.join(ROOT,f),'utf8');
  for(const m of src.matchAll(/\bs\.(\w+)\s*(?:=(?!=)|\+=|-=|\*=|\/=|\+\+|--|\|\|=)/g))out.add(m[1]);for(const m of src.matchAll(/\bs\[['"](\w+)['"]\]/g))out.add(m[1])}return out}
function near(name,list){let best=null,bd=3;for(const x of list){const d=lev(name,x);if(d<bd){bd=d;best=x}}return best}
function lev(a,b){const m=[];for(let i=0;i<=a.length;i++){m[i]=[i];for(let j=1;j<=b.length;j++)m[i][j]=i?Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1)):j}return m[a.length][b.length]}
const holes=s=>new Set([...String(s).matchAll(/\{(\w+)(?::[^{}]*)?\}/g)].map(m=>m[1]));

function check(data,opt){opt=opt||{};const errors=[],warnings=[],said=new Set();
 const once=(list,m)=>{if(!said.has(m)){said.add(m);list.push(m)}};
 const E=(where,msg)=>once(errors,where+': '+msg),W=(where,msg)=>once(warnings,where+': '+msg);
 const gen=B.generate(data);const{ctx}=sandbox(gen);const ES=ctx.ES;
 vm.runInContext(fs.readFileSync(path.join(ROOT,'js/deck.js'),'utf8').replace("const D=R.EVDATA;if(!D)throw","const D=R.EVDATA||{templates:{},later:{},events:[]};if(!D)throw"),ctx,{filename:'js/deck.js'});
 const COND=ctx.Deck.COND,STAT=ctx.Deck.STAT,VERBS=ES.VERBS;
 const life=vm.runInContext('newLife(0,1,"f","easy")',ctx);
 const fields=new Set([...Object.keys(life),...engineFields()]),reads=[],writes=new Set(),sets=new Set(),allReads=new Set();
 const art=artNames(),dict=B.texts(data);
 const evById={},laterKinds=new Map(),nextRefs=[];
 for(const k of['div','ill','unbump','ctrEnd','kidWin','famDebt','kidLoan'])laterKinds.set(k,'engine');
 const has=(L,k)=>dict[L][k]!=null;
 /* text keys: present in all three languages */
 function needKey(where,key){const miss=LANGS.filter(L=>!has(L,key));if(miss.length)E(where,'missing text "'+key+'" in '+miss.join(', '))}

 /* ---------- compiling, with what each piece uses ---------- */
 function compile(where,src,kind,scope){if(typeof src!=='string'){E(where,'expected text with an '+(kind==='expr'?'expression':'script')+', got '+JSON.stringify(src));return null}
  let ast;try{ast=kind==='expr'?ES.parseExpr(src):ES.parseScript(src);(kind==='expr'?ES.expr:ES.script)(src,scope)}catch(e){E(where,e.message);return null}
  const u=ES.uses(ast,scope);
  for(const c of u.calls)if(!VERBS[c]&&!(scope.fns||[]).includes(c)&&!(scope.vars||[]).includes(c)&&!(scope.args||[]).includes(c)){const n=near(c,[...Object.keys(VERBS),...(scope.fns||[])]);E(where,'unknown verb "'+c+'"'+(n?' (did you mean '+n+'?)':''))}
  for(const r of u.reads){reads.push([where,r]);allReads.add(r)}for(const w of u.writes)writes.add(w);for(const w of u.sets)sets.add(w);
  for(const k of u.keys)keyRefs.push([where,k,scope.pre]);
  for(const k of u.later)laterRefs.push([where,k]);for(const k of u.next)nextRefs.push([where,k]);
  return u}
 const keyRefs=[],laterRefs=[];
 function condition(where,spec,scope,birth){if(spec==null)return;
  if(typeof spec==='string'){compile(where,spec,'expr',scope);return}
  if(typeof spec!=='object'||Array.isArray(spec)){E(where,'conditions must be an object or an expression');return}
  for(const[k,v]of Object.entries(spec)){const w=where+'.'+k;
   if(k==='test'){compile(w,v,'expr',scope);continue}
   if(!COND[k]){const n=near(k,Object.keys(COND));E(w,'unknown condition'+(n?' (did you mean '+n+'?)':''));continue}
   const bool=['working','job','studying','retired','house','car','insured','married','abroad','selfEmployed','canWorkAbroad'];
   if(bool.includes(k)&&typeof v!=='boolean')E(w,'should be true or false');
   if((k==='age'||k==='kidAge')&&!(Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)&&v[0]<=v[1]))E(w,'should be [from, to]');
   if(k==='kids'&&typeof v!=='boolean'&&!(Array.isArray(v)&&v.length===2))E(w,'should be true, false or [min, max]');
   if(k==='sex'&&v!=='f'&&v!=='m')E(w,'should be "f" or "m"');
   if(k==='family'&&![].concat(v).every(x=>['poor','working','middle','rich'].includes(x)))E(w,'families are poor, working, middle and rich');
   if(k==='country'&&![].concat(v).every(x=>vm.runInContext('C',ctx).some(c=>c[1]===x)))E(w,'unknown country code');
   if(k==='difficulty'&&![].concat(v).every(x=>['easy','normal','hard'].includes(x)))E(w,'difficulties are easy, normal and hard');
   if(k==='partner'&&![].concat(v).every(x=>['single','dating','living','married'].includes(x)))E(w,'partner is single, dating, living or married');
   if(k==='careerType'&&![].concat(v).every(x=>['office','hands','creative','sport','own'].includes(x)))E(w,'career types are office, hands, creative, sport and own');
   if(k==='career'){const cars=vm.runInContext('Object.keys(CAR)',ctx);for(const x of[].concat(v))if(!cars.includes(x))E(w,'unknown career "'+x+'"')}
   if(k==='stats')for(const[sk,rule]of Object.entries(v||{})){const m=/^\s*(<=|>=|<|>|==|!=)\s*(.+)$/.exec(rule);if(!m){E(w+'.'+sk,'write it like "> .3*base"');continue}
    if(!STAT[sk])compile(w+'.'+sk,sk,'expr',scope);compile(w+'.'+sk,m[2],'expr',scope)}}
  if(birth)for(const k of Object.keys(spec))if(['working','job','studying','retired','house','car','insured','married','abroad','kids','kidAge','partner','stats','career','careerType','age'].includes(k))W(where+'.'+k,'"if" is checked at birth, when this is always the same; did you mean "when"?')}
 function msgSpec(where,spec,scope,key){if(spec==null||spec===false)return;if(spec===true){needKey(where,key);for(const L of LANGS)if(has(L,key))for(const k of holes(dict[L][key]))E(where,'"'+key+'" ('+L+') shows {'+k+'} but no value is given for it');return}
  if(typeof spec==='string'){compile(where,spec,'expr',scope);return}
  if(typeof spec==='object'&&!Array.isArray(spec)){needKey(where,key);for(const[k,v]of Object.entries(spec))compile(where+'.'+k,v,'expr',scope);
   for(const L of LANGS)if(has(L,key)){const h=holes(dict[L][key]);for(const k of h)if(!(k in spec))E(where,'"'+key+'" ('+L+') needs {'+k+'} but it is not given')}return}
  E(where,'should be true, an object of values, or an expression')}

 /* ---------- one option ---------- */
 function option(where,o,scope,kp,ids){
  for(const k of Object.keys(o))if(!OPT_KEYS.has(k))E(where,'unknown field "'+k+'"');
  let sc=scope;
  if(o.each!=null){if(!o.as)W(where,'"each" without "as": the item is called "it"');compile(where+'.each',o.each,'expr',scope);sc={vars:[...scope.vars,o.as||'it'],fns:scope.fns,pre:kp};
   if(o.max!=null&&!(Number.isInteger(o.max)&&o.max>0))E(where+'.max','should be a whole number')}
  else{if(typeof o.id!=='string'||!/^[\w-]+$/.test(o.id))E(where,'every option needs an "id" (letters, digits, _ or -)');else ids.push([o.id,!!o.show])}
  if(o.let){sc={vars:[...sc.vars],fns:sc.fns,pre:kp};for(const[n,v]of Object.entries(o.let)){compile(where+'.let.'+n,v,'expr',sc);sc.vars.push(n)}}
  if(o.each!=null){if(o.id==null)E(where,'an "each" option needs an "id" expression');else compile(where+'.id',o.id,'expr',sc)}
  const key=o.each!=null?null:kp+'.'+o.id,w=where+(o.id&&o.each==null?'('+o.id+')':'');
  for(const k of['show','ok','grp'])if(o[k]!=null)compile(w+'.'+k,o[k],'expr',sc);
  if(o.label!=null)compile(w+'.label',o.label,'expr',sc);else if(key)needKey(w,key);
  if(o.sub===undefined){if(key)needKey(w,key+'.s')}else if(key)msgSpec(w+'.sub',o.sub,sc,key+'.s');else if(typeof o.sub==='string')compile(w+'.sub',o.sub,'expr',sc);
  if(o.hint!=null){if(key)msgSpec(w+'.hint',o.hint,sc,key+'.h');else if(typeof o.hint==='string')compile(w+'.hint',o.hint,'expr',sc)}
  if(o.rel!=null&&typeof o.rel!=='number')E(w+'.rel','should be a number (how much Relationships change)');
  if(o.bond!=null){if(typeof o.bond!=='number')E(w+'.bond','should be a number (how much closeness with the card’s person changes)');else if(!scope.vars.includes('p'))E(w+'.bond','"bond" needs a "who" on the event: whose closeness?')}
  if(o.do!=null)compile(w+'.do',o.do,'script',sc);
  for(const n of[].concat(o.next||[])){if(!n||typeof n.event!=='string'){E(w+'.next','needs {"event": id, "in": years}');continue}nextRefs.push([w+'.next',n.event]);
   if(n.in!=null&&!(Number.isFinite(n.in)||(Array.isArray(n.in)&&n.in.length===2&&n.in[0]<=n.in[1])))E(w+'.next.in','should be years, or [from, to]');
   if(n.p!=null&&!(n.p>0&&n.p<=1))E(w+'.next.p','should be a chance between 0 and 1');
   for(const[k,v]of Object.entries(n.data||{}))compile(w+'.next.data.'+k,v,'expr',sc)}}

 /* ---------- templates ---------- */
 for(const[name,t]of Object.entries(data.templates)){const where='events/_shared.json templates.'+name;
  for(const k of Object.keys(t))if(!TPL_KEYS.has(k))E(where,'unknown field "'+k+'"');
  if(!t.key)E(where,'needs a "key" (its text is e.<key>.*)');}

 /* ---------- events ---------- */
 const seen=new Map();
 for(const e of data.events){const where=e._file+' '+(e.id||'(no id)');
  for(const k of Object.keys(e))if(!EVENT_KEYS.has(k))E(where,'unknown field "'+k+'"'+(near(k,[...EVENT_KEYS])?' (did you mean '+near(k,[...EVENT_KEYS])+'?)':''));
  if(typeof e.id!=='string'||!/^[a-z][a-z0-9_]*$/.test(e.id)){E(where,'"id" should be lower-case letters, digits and _');continue}
  if(seen.has(e.id))E(where,'id already used in '+seen.get(e.id));seen.set(e.id,e._file);evById[e.id]=e;
  const tp=e.use?data.templates[e.use]:null;if(e.use&&!tp)E(where,'unknown template "'+e.use+'" (see events/_shared.json)');
  const pre='e.'+e.id,tpre=tp?'e.'+tp.key:pre;
  if(e.age!=null&&!(Array.isArray(e.age)&&e.age.length===2&&e.age.every(Number.isInteger)&&e.age[0]<=e.age[1]&&e.age[0]>=0&&e.age[1]<=110))E(where+'.age','should be [from, to], whole years');
  if(e.chain&&e.age)E(where,'a follow-up card ("chain") comes when scheduled; it should not have an "age"');
  if(e.weight!=null&&typeof e.weight==='number'&&!(e.weight>=0&&e.weight<=1))E(where+'.weight','should be a chance between 0 and 1');
  if(e.weight!=null&&!e.age)W(where+'.weight','only cards with an "age" window use a weight');
  if(e.age==null&&e.when==null&&!e.chain&&!e.who)E(where,'needs an "age" window, a "when" condition, a "who", or "chain": true');
  if(e.dens!=null&&!(e.dens>0&&e.dens<=1))E(where+'.dens','should be between 0 and 1');
  const params=Object.assign({},tp&&tp.defaults,e.with,tp?{id:e.id}:{});
  /* the contract template names its passbook line from the event id (contract() in js/verbs.js reads M('trk.'+id)) */
  if(e.use==='ctr')needKey(where,'trk.'+e.id);
  /* who the card is about */
  if(e.who!=null){const w=e.who,ww=where+'.who';if(typeof w!=='object'||Array.isArray(w))E(ww,'should be {"role": …}');else{for(const k of Object.keys(w))if(!WHO_KEYS.has(k))E(ww,'unknown field "'+k+'" (role, age, test, pick, dead)');
   if(!WHO_ROLES.includes(w.role))E(ww+'.role','one of '+WHO_ROLES.join(', '));if(w.age!=null&&!(Array.isArray(w.age)&&w.age.length===2&&w.age[0]<=w.age[1]))E(ww+'.age','should be [from, to] (their age)');
   if(w.pick!=null&&!['first','oldest','youngest','closest'].includes(w.pick))E(ww+'.pick','first, oldest, youngest or closest');if(w.dead!=null&&typeof w.dead!=='boolean')E(ww+'.dead','true or false');
   if(w.test!=null)compile(ww+'.test',w.test,'expr',{vars:[...Object.keys(params),'chain','p'],fns:[],pre})}}
  const vars=[...Object.keys(params),...Object.keys(tp&&tp.let||{}),...Object.keys(e.let||{}),'chain',...(e.who?['p']:[])],fns=[...Object.keys(tp&&tp.fn||{}),...Object.keys(e.fn||{})];
  const sc={vars,fns,pre},csc={vars:[...Object.keys(params),'chain'],fns:[],pre};
  if(typeof e.weight==='string')compile(where+'.weight',e.weight,'expr',csc);
  condition(where+'.if',e.if,csc,true);condition(where+'.when',e.when,csc,false);
  /* text */
  const tx=e.i18n||{};for(const L of LANGS)if(!tx[L]||typeof tx[L]!=='object')E(where,'i18n.'+L+' is missing (English, Simplified and Traditional Chinese are all needed)');
  const keysets=LANGS.map(L=>new Set(Object.keys(tx[L]||{})));
  for(let i=0;i<3;i++)for(const k of keysets[i])for(let j=0;j<3;j++)if(!keysets[j].has(k))E(where,'text "'+k+'" is in '+LANGS[i]+' but not in '+LANGS[j]);
  for(const k of keysets[0]){if(k[0]!=='.'&&data.ui.en[k]!=null)E(where,'text "'+k+'" is also in i18n/en.json');
   for(const L of LANGS){const v=tx[L]&&tx[L][k];if(typeof v!=='string'){if(v!=null)E(where,'text "'+k+'" ('+L+') should be text');continue}
    if(L!=='en'&&tx.en&&typeof tx.en[k]==='string'){const a=holes(tx.en[k]),b=holes(v);for(const x of a)if(!b.has(x))W(where,'"'+k+'" ('+L+') has no {'+x+'}, the English does');for(const x of b)if(!a.has(x))W(where,'"'+k+'" ('+L+') uses {'+x+'}, the English does not')}}}
  needKey(where,pre+'.t');
  if(e.text!=null)compile(where+'.text',e.text,'expr',sc);else msgSpec(where+'.vars',e.vars||true,sc,pre+'.x');
  if(e.hint!=null)msgSpec(where+'.hint',e.hint,sc,pre+'.h');
  if(e.care!=null)needKey(where+'.care',full(pre,e.care));
  for(const k of['pre','again'])if(e[k]!=null)compile(where+'.'+k,e[k],'script',sc);
  if(e.preLog!=null)compile(where+'.preLog',e.preLog,'expr',sc);
  for(const[n,v]of Object.entries(e.let||{}))compile(where+'.let.'+n,v,'expr',sc);
  for(const[n,f]of Object.entries(e.fn||{})){if(!f||typeof f.do!=='string'){E(where+'.fn.'+n,'needs {"args": [...], "do": "..."}');continue}compile(where+'.fn.'+n,f.do,'script',{vars,fns,args:f.args||[],pre})}
  for(const[k,v]of Object.entries(e.later||{})){if(laterKinds.has(k))E(where+'.later.'+k,'consequence "'+k+'" is already defined in '+laterKinds.get(k));laterKinds.set(k,e.id);compile(where+'.later.'+k,v,'script',{vars:['x'],fns:[],pre})}
  /* tarot and drawing */
  if(typeof e.tarot==='string'){}else if(e.tarot&&typeof e.tarot==='object'){for(const L of LANGS)if(!e.tarot[L])E(where+'.tarot','missing '+L)}else E(where,'needs a tarot name: {"en": …, "zh": …, "zht": …}, or the id of a card to borrow it from');
  if(typeof e.art==='string'){if(!art.cards.has(e.art))E(where+'.art','no drawing "'+e.art+'" in js/art.js')}
  else if(e.art&&typeof e.art==='object'){if(!art.themes.has(e.art.draw))E(where+'.art','no shared drawing "'+e.art.draw+'" in js/art.js (CA)');if(!BG.has(e.art.bg))E(where+'.art','"bg" is one of co, ya, mi, wa, wh')}
  else E(where,'needs a drawing: "art": a card in js/art.js, or {"draw": a shared drawing, "bg": a colour}');
  /* options */
  if(!tp&&!e.opts)E(where,'needs "opts" (or "use" a template)');
  const ids=[],opts=[...(tp?(tp.opts||[]).map(o=>[o,tpre,'template '+e.use]):[]),...(e.opts||[]).map(o=>[o,pre,''])];
  let dyn=false;opts.forEach(([o,kp,from],i)=>{if(o.each!=null)dyn=true;option(where+'.opts['+i+']'+(from?' ('+from+')':''),o,{vars,fns,pre:kp},kp,ids)});
  const count={};for(const[id,shown]of ids){count[id]=count[id]||{n:0,all:true};count[id].n++;if(!shown)count[id].all=false}
  for(const id in count)if(count[id].n>1&&!count[id].all)E(where,'two options are called "'+id+'" (allowed only when both have "show")');
  if(typeof e.def!=='string')E(where,'needs "def": the id of the default option');
  else if(!dyn&&!count[e.def])E(where,'default option "'+e.def+'" is not one of its options');
  for(const[o]of opts)if(o.id===e.def&&o.ok!=null)E(where,'the default option ("'+e.def+'") must always be clickable, so it cannot have "ok"')}
 /* template scripts, with the params each event gives */
 for(const[name,t]of Object.entries(data.templates)){const users=data.events.filter(e=>e.use===name);if(!users.length)W('template '+name,'no event uses it');
  const pre='e.'+t.key,vars=[...new Set([...Object.keys(t.defaults||{}),...users.flatMap(e=>Object.keys(e.with||{})),'id',...Object.keys(t.let||{}),'chain'])],fns=Object.keys(t.fn||{});
  const before=reads.length;
  for(const[n,v]of Object.entries(t.let||{}))compile('template '+name+'.let.'+n,v,'expr',{vars,fns,pre});
  for(const[n,f]of Object.entries(t.fn||{}))compile('template '+name+'.fn.'+n,f.do,'script',{vars,fns,args:f.args||[],pre});
  for(const[k,v]of Object.entries(t.later||{})){if(laterKinds.has(k))E('template '+name,'consequence "'+k+'" is already defined in '+laterKinds.get(k));laterKinds.set(k,'template '+name);compile('template '+name+'.later.'+k,v,'script',{vars:['x'],fns:[],pre})}
  /* a parameter a template needs must be given by every event that uses it */
  const need=new Set();for(const ev of users)for(const p of Object.keys(Object.assign({},t.defaults,ev.with)))need.add(p);
  for(const ev of users)for(const p of need)if(!(p in Object.assign({},t.defaults,ev.with)))E(ev._file+' '+ev.id+'.with','template "'+name+'" needs "'+p+'" (other events give it)')}
 for(const[k,v]of Object.entries(data.later)){if(laterKinds.has(k))E('events/_shared.json later.'+k,'already defined in '+laterKinds.get(k));laterKinds.set(k,'_shared');compile('events/_shared.json later.'+k,v,'script',{vars:['x'],fns:[],pre:'e'})}

 /* ---------- small moments with no decision (events/_texture.json) ---------- */
 const txIds=new Set();let txN=0,txFx=0;
 for(const g of data.texture||[]){const gw='events/_texture.json '+(g.id||'(group without id)');
  for(const k of Object.keys(g))if(!TX_GROUP.has(k))E(gw,'unknown field "'+k+'"');
  if(!Array.isArray(g.moments)){E(gw,'needs "moments": [...]');continue}
  const gsc={vars:[],fns:[],pre:'tx'};condition(gw+'.when',g.when,gsc,false);
  for(const m of g.moments){const w=gw+' '+(m.id||'(no id)');txN++;
   for(const k of Object.keys(m))if(!TX_KEYS.has(k))E(w,'unknown field "'+k+'"');
   if(typeof m.id!=='string'||!/^[a-z][a-z0-9_]*$/.test(m.id)){E(w,'"id" should be lower-case letters, digits and _');continue}
   if(txIds.has(m.id))E(w,'id already used');txIds.add(m.id);
   const cat=m.cat||g.cat;if(!TX_CATS.includes(cat))E(w,'"cat" is one of '+TX_CATS.join(', '));
   condition(w+'.when',m.when,gsc,false);
   const ages=[g.when&&g.when.age,m.when&&m.when.age].filter(Boolean);if(!ages.length)E(w,'needs an age window ("when": {"age": [from, to]}) here or on its group');
   const top=Math.min(...ages.map(x=>x[1]));
   const who=m.who||g.who;if(who){if(!WHO_ROLES.includes(who.role))E(w+'.who','role is one of '+WHO_ROLES.join(', '));for(const k of Object.keys(who))if(!WHO_KEYS.has(k))E(w+'.who','unknown field "'+k+'"');
    if(who.test!=null)compile(w+'.who.test',who.test,'expr',{vars:['p'],fns:[],pre:'tx'})}
   if(m.w!=null&&!(m.w>0&&m.w<=5))E(w+'.w','a weight between 0 and 5 (1 is usual)');
   const ag=m.again!=null?m.again:g.again;if(ag!=null&&!(Number.isInteger(ag)&&ag>=1))E(w+'.again','years before it can come back: a whole number');
   if(m.tone!=null&&!['good','bad',''].includes(m.tone))E(w+'.tone','good, bad or ""');
   if(m.fx!=null){txFx++;if(typeof m.fx!=='object'||!Object.keys(m.fx).length)E(w+'.fx','should be {"cash": .01, "happy": 1, …}');
    for(const[k,v]of Object.entries(m.fx||{})){if(!(k in TX_FX)){E(w+'.fx','unknown effect "'+k+'" ('+Object.keys(TX_FX).join(', ')+')');continue}
     if(typeof v!=='number'||!v||Math.abs(v)>TX_FX[k])E(w+'.fx.'+k,'a small number, at most '+TX_FX[k]+' either way')}
    if(m.fx.cash&&top<18)E(w+'.fx.cash','money moves only from 18 (a child’s are their parents’)');if(m.fx.bond&&!who)E(w+'.fx.bond','needs a "who"')}
   for(const L of LANGS){if(typeof m[L]!=='string'||!m[L].trim()){E(w,'text in '+L+' is missing');continue}
    const h=holes(m[L]);for(const x of h){if(!['p','P','n'].includes(x))E(w,'('+L+') uses {'+x+'}; moments can show {p} "your sister Mei", {P} "Your sister Mei" and {n} "Mei"');else if(!who)E(w,'('+L+') uses {'+x+'} but has no "who"')}
    if(L!=='en'&&typeof m.en==='string'){const a=holes(m.en);for(const x of h)if(!a.has(x))E(w,'('+L+') uses {'+x+'}, the English does not');for(const x of a)if(!h.has(x))E(w,'('+L+') has no {'+x+'}, the English does')}}}}
 if(txN&&(txFx/txN<.18||txFx/txN>.33))W('events/_texture.json',Math.round(100*txFx/txN)+'% of moments have an effect; about a quarter is the aim');

 /* ---------- what scripts read: real fields only ---------- */
/* a field is real if a life starts with it, the engine sets it, or a script creates it with = (a += on an unknown field is a typo) */
 const known=new Set([...fields,...sets]);
 for(const[where,r]of reads)if(!known.has(r)){const n=near(r,[...known]);E(where,'"'+r+'" is not a field of a life'+(n?' (did you mean '+n+'?)':'')+'; a value worked out for the card goes in "let"')}
 const engSrc=['js/engine.js','js/verbs.js','js/game.js','js/pixel.js'].map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n');
 for(const w of writes)if(!fields.has(w)&&!allReads.has(w)&&!new RegExp('\\bs\\.'+w+'\\b').test(engSrc))W('scripts','"'+w+'" is set but nothing reads it (a typo?)');
 /* ---------- message keys, consequences, follow-up cards ---------- */
 for(const[where,k,pre]of keyRefs)needKey(where,full(pre||'e',k));
 for(const[where,k]of laterRefs)if(!laterKinds.has(k))E(where,'no consequence "'+k+'" ("later" in an event, a template or events/_shared.json)');
 for(const[where,id]of nextRefs){const t=evById[id];if(!t)E(where,'follow-up card "'+id+'" does not exist');else if(!t.chain)E(where,'follow-up card "'+id+'" needs "chain": true')}
 for(const e of data.events)if(e.chain&&!nextRefs.some(([,id])=>id===e.id))W(e._file+' '+e.id,'a follow-up card nothing schedules (next) never comes up');
 for(const e of data.events)if(typeof e.tarot==='string'){const t=evById[e.tarot];if(!t&&!['king','page','knight','end','kids'].includes(e.tarot))E(e._file+' '+e.id+'.tarot','no card "'+e.tarot+'" to borrow the tarot name from');else if(t&&typeof t.tarot!=='object')E(e._file+' '+e.id+'.tarot','"'+e.tarot+'" borrows its own name too; borrow from a card with its own')}
 /* ---------- interface text: the same keys in every language (English lacks the h.* keys, which are in the HTML, and the cn.*
   country names, which come from the engine's country table) ---------- */
 for(const L of LANGS)for(const k of Object.keys(data.ui[L]))for(const M of LANGS)if(M!==L&&data.ui[M][k]==null&&!(M==='en'&&/^(h|cn)\./.test(k)))E('i18n/'+M+'.json','missing "'+k+'" (it is in i18n/'+L+'.json)');
 /* a placeholder only another language uses is probably a typo; {b} for the English {a} is the money-without-sign convention */
 for(const k of Object.keys(data.ui.en))for(const L of['zh','zht'])if(data.ui[L][k]!=null){const a=holes(data.ui.en[k]),b=holes(data.ui[L][k]);for(const x of b)if(!a.has(x)&&!(x==='b'&&a.has('a')))W('i18n/'+L+'.json "'+k+'"','uses {'+x+'}, the English does not (fine if the code gives it)')}
 /* ---------- names: every country, both sexes, at least 6 each, all three languages, no repeats ---------- */
 const codes=vm.runInContext('C.map(c=>c[1])',ctx);
 for(const c of codes)for(const sex of['f','m']){const l=(data.names[c]||{})[sex],w='events/_names.json '+c+'.'+sex;
  if(!Array.isArray(l)||l.length<6){E(w,'needs at least 6 names');continue}
  const seenN=new Set();l.forEach((x,i)=>{if(!Array.isArray(x)||x.length!==3||!x.every(y=>typeof y==='string'&&y.trim()))E(w+'['+i+']','should be ["English", "简体", "繁體"]');else{if(seenN.has(x[0]))E(w+'['+i+']','"'+x[0]+'" is in the list twice');seenN.add(x[0])}})}
 for(const c of Object.keys(data.names))if(!codes.includes(c))E('events/_names.json '+c,'not a country of the game');
 /* ---------- gen/ up to date ---------- */
 if(opt.stale!==false)for(const[f,txt]of Object.entries(gen)){const p=path.join(ROOT,f);if(!fs.existsSync(p)||fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')!==txt){E(f,'out of date: run node tools/build.js');break}}
 /* ---------- play ---------- */
 let sim=null;if(!errors.length){const c=chainTest(data);if(c)E('engine',c)}
 if(opt.sim&&!errors.length)sim=simulate(gen,opt.sim,errors,warnings);
 report(errors,warnings,data,sim,{n:txN,fx:txFx});return{errors,warnings,sim}}

/* follow-up cards work end to end: a tiny deck where a choice at 10 schedules a card three years later (with a value it
   carries), and a script schedules another with next(); each must come once, at its year, showing the value */
function chainTest(data){const T=(en)=>({en,zh:en,zht:en});
 const txt=(o)=>({en:o,zh:o,zht:o});
 const evs=[{id:'zz_a',age:[10,10],def:'go',tarot:T('A'),art:'hobby',opts:[{id:'go',next:{event:'zz_b',in:3,data:{a:'age'}},do:"next('zz_c', [5, 5], {n: 7})"},{id:'no'}],
   i18n:txt({'.t':'A','.x':'A','.go':'Go','.go.s':'Go','.no':'No','.no.s':'No'})},
  {id:'zz_b',chain:true,def:'ok',tarot:'zz_a',art:'hobby',vars:{a:'chain.a'},opts:[{id:'ok'}],i18n:txt({'.t':'B','.x':'From {a}','.ok':'Ok','.ok.s':'Ok'})},
  {id:'zz_c',chain:true,def:'ok',tarot:'zz_a',art:'hobby',vars:{n:'chain.n'},when:{test:'chain.n === 7'},opts:[{id:'ok'}],i18n:txt({'.t':'C','.x':'N {n}','.ok':'Ok','.ok.s':'Ok'})}];
 const d=Object.assign({},data,{events:evs.map(e=>Object.assign({_file:'(self-test)'},e))}),gen=B.generate(d);
 const{ctx,run}=sandbox(gen);run('gen/events.js',gen['gen/events.js']);run('js/deck.js');
 const r=vm.runInContext(`(()=>{const s=newLife(0,1,'f','easy'),got=[];let g=0;while(!s.dead&&s.age<30&&g++<40){let ev,k=0;while((ev=dueEvents(s)[0])&&k++<5){got.push(ev.id+'@'+s.age+':'+tr(ev.text(s)));applyOpt(s,ev,ev.def)}tick(s,yearRand(s.seed,s.age),null)}return got.join(', ')})()`,ctx);
 const want='zz_a@10:A, zz_b@13:From 10, zz_c@15:N 7';return r===want?null:'follow-up cards: expected "'+want+'", got "'+r+'"'}
/* plays lives with random choices, as a player would (options, Life choices, focus), in all three languages */
function simulate(gen,n,errors,warnings){const{ctx,run}=sandbox(gen,LANGS);run('gen/events.js',gen['gen/events.js']);run('js/deck.js');
 try{vm.runInContext('Deck.compileAll()',ctx)}catch(e){errors.push('compiling: '+e.message);return null}
 ctx.__n=n;const r=vm.runInContext(`(()=>{const LANGS=['en','zh','zht'],bad=[],seen={},raw=new Set(),miss=new Set(),noDef=new Set(),tx={};let cards=0,deaths=0,txY=0,yrs=0;
  const keyLike=/^[a-z][a-zA-Z0-9]*(\\.[\\w-]+)+$/;
  const look=(x,where)=>{if(x==null||x===true)return;for(const L of LANGS){I18N.set(L);const s=tr(x);if(keyLike.test(s))raw.add(s+' ('+where+')');const h=/\\{\\w+[}:]/.exec(s);if(h)miss.add(where+': '+s)}I18N.set('en')};
  for(let i=0;i<__n;i++){const dk=['easy','normal','hard'][i%3],s=newLife(i%C.length,7919*i+13,null,dk),r=mb(hsh(i,'validate'));let g=0;
   try{while(!s.dead&&g++<130){yrs++;
    if(r()<.2){const a=relActs(s).filter(x=>x.ok===true);if(a.length){const id=a[Math.floor(r()*a.length)].id;if(id!=='div'&&id!=='break'||r()<.2)relAct(s,id,(m,k)=>look(m,'diary'))}}
    if(r()<.1)s.focus=['learn','grind','hustle','balance','people'][Math.floor(r()*5)];
    let k=0,ev;while((ev=dueEvents(s)[0])&&k++<40){cards++;seen[ev.id]=(seen[ev.id]||0)+1;
     if(ev.pre&&!s['pre_'+ev.id]){ev.pre(s);s['pre_'+ev.id]=1;if(ev.preLog)look(ev.preLog(s),ev.id+' diary')}
     look(ev.title,ev.id+' title');look(ev.text(s),ev.id+' text');if(ev.hint)look(ev.hint(s),ev.id+' hint');
     const os=evOpts(s,ev);const d=os.find(o=>o.id===ev.def);if(!d||(d.ok!==undefined&&d.ok!==true))noDef.add(ev.id);
     for(const o of os){look(o.label,ev.id+'.'+o.id+' label');look(o.sub,ev.id+'.'+o.id+' sub');if(o.hint)look(o.hint,ev.id+'.'+o.id+' hint');if(o.ok!==undefined&&o.ok!==true)look(o.ok,ev.id+'.'+o.id+' ok')}
     const ok=os.filter(o=>o.ok===undefined||o.ok===true),pick=r()<.3?ev.def:(ok[Math.floor(r()*ok.length)]||os[0]).id;applyOpt(s,ev,pick)}
    texYear(s,o=>{look(o.m,'moment '+o.id);if(o.a)look(o.a,'moment '+o.id+' money');tx[o.id]=(tx[o.id]||0)+1;txY++});
    tick(s,yearRand(s.seed,s.age),(m)=>look(m,'diary'))}
    for(const t of Object.values(s.trk)){const v=trkView(s,t);look(t.label,'passbook');look(v.note,'passbook note')}
    if(s.dead)deaths++}catch(e){bad.push('life '+i+' (age '+s.age+'): '+(e.stack||e.message).split('\\n').slice(0,3).join(' | '))}}
  return{cards,deaths,bad,seen,raw:[...raw],miss:[...miss],noDef:[...noDef],tx,txY,yrs}})()`,ctx);
 for(const b of r.bad.slice(0,15))errors.push('simulation: '+b);if(r.bad.length>15)errors.push('simulation: …and '+(r.bad.length-15)+' more crashes');
 for(const k of r.raw.slice(0,30))errors.push('simulation: text missing for '+k);
 for(const k of r.miss.slice(0,30))errors.push('simulation: unfilled placeholder in '+k);
 for(const id of r.noDef)errors.push('simulation: '+id+': the default option was missing or could not be picked');
 return{lives:n,cards:r.cards,seen:r.seen,tx:r.tx,txY:r.txY,yrs:r.yrs}}

function report(errors,warnings,data,sim,tx){
 for(const w of warnings)console.log('  warning  '+w);
 for(const e of errors)console.log('  ERROR    '+e);
 const nEv=data.events.length,tpl=Object.keys(data.templates).length;
 let line=nEv+' events in '+data.files.length+' files, '+tpl+' templates';
 if(sim){const never=data.events.filter(e=>!sim.seen[e.id]).map(e=>e.id);line+='; played '+sim.lives+' lives ('+sim.cards+' cards)'+(never.length?', '+never.length+' events never came up'+(never.length<=12?' ('+never.join(', ')+')':''):'')}
 if(tx&&tx.n){line+='; '+tx.n+' small moments ('+Math.round(100*tx.fx/tx.n)+'% with an effect)';
  if(sim&&sim.yrs){const all=(data.texture||[]).flatMap(g=>g.moments.map(m=>m.id)),never=all.filter(id=>!sim.tx[id]);line+=', '+(sim.txY/sim.yrs).toFixed(1)+' a year'+(never.length?', '+never.length+' never came up'+(never.length<=12?' ('+never.join(', ')+')':''):'')}}
 console.log((errors.length?'✗ ':'✓ ')+line+(errors.length?': '+errors.length+' error'+(errors.length>1?'s':''):'')+(warnings.length?', '+warnings.length+' warning'+(warnings.length>1?'s':''):''))}

module.exports={check,chainTest};

if(require.main===module){const a=process.argv.slice(2),quick=a.includes('--quick'),n=+(a.find(x=>/^\d+$/.test(x))||300);
 let data;try{data=B.load()}catch(e){console.log('  ERROR    '+e.message);process.exit(1)}
 const r=check(data,{sim:quick?0:n});process.exit(r.errors.length?1:0)}
