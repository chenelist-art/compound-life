/* A Second Chance: the event script language.
   Events live in events/*.json as data. What a choice does is written there as a short script, such as
     "pay(.12*base); happy += 2; later(age+3, 'mlm')"
   and amounts and conditions as expressions, such as ".05*base" or "liquid() > .3*base".
   This file reads them with its own small parser (nothing is run through eval) and turns each one into a
   JavaScript closure once, so a script costs about as much as hand-written code when the game runs.

   The language is a small part of JavaScript:
   - numbers, 'strings', true, false, null, [arrays], {objects}, + - * / % < <= > >= == != === !== && || ?? ! and a ? b : c
   - calls: verbs from js/verbs.js (pay, spend, later, M, MN…), the event's own `fn` helpers, and Math.min, Math.round…
   - statements: let / const, = += -= *= /=, ++ and --, if / else, for (const k of list) / for (const k in object), return, delete
   Names: a call like pay(…) is a verb or helper; a plain name is a local value (let, the event's `let`, a helper's arguments),
   then a constant (Math, C, CAR, ILLT), and otherwise a field of the life being played: base, age, cash, house.value… So
   `happy += 2` changes the life's Happiness. Only a value's own fields can be read (and `length`); there are no other
   methods, no arrow functions and no way to reach the page, so a script can only change the life it is given.

   ES.expr(src, scope) / ES.script(src, scope) compile; scope = {vars: names of outer values, fns: names of helpers}.
   A compiled closure takes a context c = {s: the life, v: values (an object), L: the year's logger or null, p: text prefix}. */
(function(R){
'use strict';
const BAD=new Set(['__proto__','constructor','prototype','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__']);
const KW=new Set(['let','const','if','else','for','of','in','return','delete','break','continue','true','false','null','undefined']);
/* JavaScript words the language does not have: an error rather than a life field by that name */
const NOPE=new Set(['var','function','while','do','switch','case','default','new','this','typeof','instanceof','void','try','catch','finally','throw','class','extends','super','import','export','yield','await','async','with','debugger','eval','arguments','globalThis','window','document']);
const OPS=['===','!==','==','!=','<=','>=','&&','||','??','+=','-=','*=','/=','%=','++','--','+','-','*','/','%','<','>','!','?',':','.',',',';','(',')','[',']','{','}','='];
const hasOwn=Object.prototype.hasOwnProperty;

class ScriptError extends Error{}
function fail(msg,src,pos){const e=new ScriptError(msg+(src!=null?' at '+pos+' in "'+src+'"':''));e.src=src;e.pos=pos;throw e}

/* ---------- reading: characters → tokens → a tree ---------- */
function lex(src){const T=[],n=src.length;let i=0;
 while(i<n){const ch=src[i];
  if(ch===' '||ch==='\n'||ch==='\t'||ch==='\r'){i++;continue}
  if(ch==='/'&&src[i+1]==='/'){while(i<n&&src[i]!=='\n')i++;continue}
  if(ch==='/'&&src[i+1]==='*'){const j=src.indexOf('*/',i+2);if(j<0)fail('unclosed comment',src,i);i=j+2;continue}
  if((ch>='0'&&ch<='9')||(ch==='.'&&src[i+1]>='0'&&src[i+1]<='9')){const m=/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));T.push({t:'num',v:parseFloat(m[0]),p:i});i+=m[0].length;continue}
  if(/[A-Za-z_$]/.test(ch)){const w=/^[A-Za-z_$][\w$]*/.exec(src.slice(i))[0];T.push({t:KW.has(w)?w:'id',v:w,p:i});i+=w.length;continue}
  if(ch==="'"||ch==='"'){let j=i+1,s='';while(j<n&&src[j]!==ch){if(src[j]==='\\'){const e=src[j+1];s+=e==='n'?'\n':e==='t'?'\t':e;j+=2}else s+=src[j++]}
   if(j>=n)fail('unclosed string',src,i);T.push({t:'str',v:s,p:i});i=j+1;continue}
  const op=OPS.find(o=>src.startsWith(o,i));if(!op)fail('unexpected character '+JSON.stringify(ch),src,i);T.push({t:op,v:op,p:i});i+=op.length}
 T.push({t:'eof',p:n});return T}

function Parser(src){this.src=src;this.T=lex(src);this.i=0}
const P=Parser.prototype;
P.peek=function(k){return this.T[this.i+(k||0)]};
P.next=function(){return this.T[this.i++]};
P.is=function(t){return this.T[this.i].t===t};
P.eat=function(t){if(this.T[this.i].t===t){this.i++;return true}return false};
P.want=function(t){const k=this.T[this.i];if(k.t!==t)fail('expected '+t+(k.t==='eof'?' before the end':' but found '+JSON.stringify(k.v)),this.src,k.p);this.i++;return k};
P.err=function(msg){fail(msg,this.src,this.T[this.i].p)};
/* expressions, lowest precedence first */
P.expr=function(){const test=this.nullish();if(this.eat('?')){const a=this.expr();this.want(':');const b=this.expr();return{k:'cond',test,a,b}}return test};
P.bin=function(next,ops,kind){let l=next.call(this);for(;;){const t=this.peek().t;if(!ops.includes(t))return l;this.i++;l={k:kind||'bin',op:t,l,r:next.call(this)}}};
P.nullish=function(){return this.bin(this.or,['??'],'log')};
P.or=function(){return this.bin(this.and,['||'],'log')};
P.and=function(){return this.bin(this.eq,['&&'],'log')};
P.eq=function(){return this.bin(this.rel,['===','!==','==','!='])};
P.rel=function(){return this.bin(this.add,['<','>','<=','>='])};
P.add=function(){return this.bin(this.mul,['+','-'])};
P.mul=function(){return this.bin(this.unary,['*','/','%'])};
P.unary=function(){const t=this.peek().t;if(t==='!'||t==='-'||t==='+'){this.i++;return{k:'un',op:t,a:this.unary()}}return this.postfix()};
P.postfix=function(){let e=this.primary();for(;;){
  if(this.eat('.')){const k=this.next();if(k.t!=='id'&&!KW.has(k.t))fail('expected a name after "."',this.src,k.p);e={k:'mem',o:e,name:k.v,p:k.p}}
  else if(this.eat('[')){const x=this.expr();this.want(']');e={k:'mem',o:e,x}}
  else if(this.is('(')){const p=this.next().p,args=[];if(!this.eat(')')){do args.push(this.expr());while(this.eat(','));this.want(')')}e={k:'call',f:e,args,p}}
  else return e}};
P.primary=function(){const k=this.next();
 switch(k.t){
  case 'num':return{k:'lit',v:k.v};case 'str':return{k:'lit',v:k.v};
  case 'true':return{k:'lit',v:true};case 'false':return{k:'lit',v:false};case 'null':return{k:'lit',v:null};case 'undefined':return{k:'lit',v:undefined};
  case 'id':if(NOPE.has(k.v))fail('"'+k.v+'" is not part of the event language',this.src,k.p);return{k:'id',name:k.v,p:k.p};
  case '(':{const e=this.expr();this.want(')');return e}
  case '[':{const items=[];if(!this.eat(']')){do{if(this.is(']'))break;items.push(this.expr())}while(this.eat(','));this.want(']')}return{k:'arr',items}}
  case '{':{const props=[];if(!this.eat('}')){do{if(this.is('}'))break;const n=this.next();if(n.t!=='id'&&n.t!=='str'&&n.t!=='num'&&!KW.has(n.t))fail('expected a field name',this.src,n.p);
    const key=String(n.v);if(BAD.has(key))fail('field name "'+key+'" is not allowed',this.src,n.p);
    if(this.eat(':'))props.push([key,this.expr()]);else if(n.t==='id')props.push([key,{k:'id',name:key,p:n.p}]);else fail('expected ":"',this.src,n.p)}while(this.eat(','));this.want('}')}return{k:'obj',props}}
 }
 fail(k.t==='eof'?'unexpected end':'unexpected '+JSON.stringify(k.v),this.src,k.p)};
/* statements */
P.stmts=function(end){const out=[];while(!this.is(end)){if(this.eat(';'))continue;out.push(this.stmt())}return out};
P.stmt=function(){const k=this.peek();
 if(k.t==='let'||k.t==='const'){this.i++;const decls=[];do{const n=this.want('id');this.want('=');decls.push([n.v,this.expr(),n.p])}while(this.eat(','));this.end();return{k:'let',decls}}
 if(k.t==='if'){this.i++;this.want('(');const test=this.expr();this.want(')');const a=this.stmt();const b=this.eat('else')?this.stmt():null;return{k:'if',test,a,b}}
 if(k.t==='for'){this.i++;this.want('(');if(!this.eat('const')&&!this.eat('let'))this.err('expected "const" in for (const x of list)');const n=this.want('id');
  const kind=this.eat('of')?'of':this.eat('in')?'in':this.err('expected "of" or "in"');const list=this.expr();this.want(')');return{k:'for',kind,name:n.v,list,body:this.stmt()}}
 if(k.t==='return'){this.i++;const e=this.is(';')||this.is('}')||this.is('eof')?null:this.expr();this.end();return{k:'ret',e}}
 if(k.t==='break'||k.t==='continue'){this.i++;this.end();return{k:k.t}}
 if(k.t==='delete'){this.i++;const t=this.postfix();if(t.k!=='mem')this.err('delete needs a field, like delete done.wed');this.end();return{k:'del',t}}
 if(k.t==='{'){this.i++;const body=this.stmts('}');this.want('}');return{k:'block',body}}
 if(k.t==='++'||k.t==='--'){this.i++;const t=this.target(this.postfix());this.end();return{k:'upd',op:k.t,t}}
 const e=this.expr(),op=this.peek().t;
 if(op==='='||op==='+='||op==='-='||op==='*='||op==='/='||op==='%='){this.i++;const t=this.target(e);const v=this.expr();this.end();return{k:'set',op,t,v}}
 if(op==='++'||op==='--'){this.i++;const t=this.target(e);this.end();return{k:'upd',op,t}}
 this.end();return{k:'do',e}};
P.target=function(e){if(e.k!=='id'&&e.k!=='mem')this.err('can only change a name or a field');return e};
P.end=function(){if(this.eat(';'))return;const t=this.peek().t;if(t!=='}'&&t!=='eof'&&t!=='else'){/* statements may also simply follow each other */}};

function parseExpr(src){const p=new Parser(String(src));const e=p.expr();if(!p.is('eof'))p.err('unexpected '+JSON.stringify(p.peek().v));return e}
function parseScript(src){const p=new Parser(String(src));const b=p.stmts('eof');return{k:'block',body:b,top:true}}

/* ---------- turning a tree into closures ---------- */
const VERBS={},CONST={};
function memGet(o,k,src){if(o==null)fail('cannot read "'+k+'" of '+o,src,0);if(BAD.has(k))fail('field "'+k+'" is not allowed',src,0);
 return hasOwn.call(o,k)||k==='length'?o[k]:undefined}
function Ctx(scope,src){this.vars=new Set(scope&&scope.vars||[]);this.fns=new Set(scope&&scope.fns||[]);this.locals=new Set();this.src=src;this.cst=new Set()}
function compile(node,X){const src=X.src;
 switch(node.k){
  case 'lit':{const v=node.v;return()=>v}
  case 'id':{const n=node.name;
   if(X.locals.has(n)||X.vars.has(n))return c=>c.v[n];
   if(hasOwn.call(CONST,n)){const v=CONST[n];return()=>v}
   if(BAD.has(n))fail('name "'+n+'" is not allowed',src,node.p);
   return c=>c.s[n]}
  case 'mem':{const o=compile(node.o,X);
   if(node.name!=null){const k=node.name;if(BAD.has(k))fail('field "'+k+'" is not allowed',src,node.p);return c=>memGet(o(c),k,src)}
   const x=compile(node.x,X);return c=>{const k=x(c);return memGet(o(c),typeof k==='number'?k:String(k),src)}}
  case 'arr':{const it=node.items.map(e=>compile(e,X));return c=>it.map(f=>f(c))}
  case 'obj':{const ps=node.props.map(([k,e])=>[k,compile(e,X)]);return c=>{const o={};for(const[k,f]of ps)o[k]=f(c);return o}}
  case 'un':{const a=compile(node.a,X);return node.op==='!'?c=>!a(c):node.op==='-'?c=>-a(c):c=>+a(c)}
  case 'log':{const l=compile(node.l,X),r=compile(node.r,X);return node.op==='&&'?c=>l(c)&&r(c):node.op==='||'?c=>l(c)||r(c):c=>l(c)??r(c)}
  case 'cond':{const t=compile(node.test,X),a=compile(node.a,X),b=compile(node.b,X);return c=>t(c)?a(c):b(c)}
  case 'bin':{const l=compile(node.l,X),r=compile(node.r,X);
   switch(node.op){case '+':return c=>l(c)+r(c);case '-':return c=>l(c)-r(c);case '*':return c=>l(c)*r(c);case '/':return c=>l(c)/r(c);case '%':return c=>l(c)%r(c);
    case '<':return c=>l(c)<r(c);case '>':return c=>l(c)>r(c);case '<=':return c=>l(c)<=r(c);case '>=':return c=>l(c)>=r(c);
    case '===':return c=>l(c)===r(c);case '!==':return c=>l(c)!==r(c);case '==':return c=>l(c)==r(c);case '!=':return c=>l(c)!=r(c)}
   break}
  case 'call':{const as=node.args.map(e=>compile(e,X)),f=node.f,n=as.length;
   const args=c=>{const a=new Array(n);for(let i=0;i<n;i++)a[i]=as[i](c);return a};
   if(f.k==='id'){const name=f.name;
    if(X.fns.has(name))return c=>c.v[name](c,...args(c));
    if(X.locals.has(name)||X.vars.has(name))return c=>{const g=c.v[name];if(typeof g!=='function')fail('"'+name+'" is not a function',src,node.p);return g(...args(c))};
    const vb=VERBS[name];if(!vb)fail('unknown verb "'+name+'"',src,f.p);
    if(n===0)return c=>vb(c);if(n===1){const a0=as[0];return c=>vb(c,a0(c))}if(n===2){const a0=as[0],a1=as[1];return c=>vb(c,a0(c),a1(c))}
    return c=>vb(c,...args(c))}
   if(f.k==='mem'&&f.name!=null&&f.o.k==='id'&&hasOwn.call(CONST,f.o.name)&&!X.locals.has(f.o.name)&&!X.vars.has(f.o.name)){const ns=CONST[f.o.name],g=hasOwn.call(ns,f.name)?ns[f.name]:undefined;
    if(typeof g!=='function')fail('"'+f.o.name+'.'+f.name+'" is not a function',src,node.p);return c=>g(...args(c))}
   if(f.k==='call'){const g=compile(f,X);return c=>{const h=g(c);if(typeof h!=='function')fail('not a function',src,node.p);return h(...args(c))}}
   fail('only verbs, helpers and Math functions can be called',src,node.p)}
 }
 fail('cannot compile '+node.k,src,0)}
/* assignment targets */
function root(node){while(node.k==='mem')node=node.o;return node}
function setter(t,X){const src=X.src;
 if(t.k==='id'){const n=t.name;
  if(X.locals.has(n))return(c,v)=>{c.v[n]=v};
  if(X.vars.has(n)||X.fns.has(n))fail('"'+n+'" is a value worked out for this card and cannot be changed here',src,t.p);
  if(hasOwn.call(CONST,n)||BAD.has(n))fail('"'+n+'" cannot be changed',src,t.p);
  return(c,v)=>{c.s[n]=v}}
 const r=root(t);if(r.k==='id'&&hasOwn.call(CONST,r.name)&&!X.locals.has(r.name)&&!X.vars.has(r.name))fail('"'+r.name+'" cannot be changed',src,r.p);
 const o=compile(t.o,X);
 if(t.name!=null){const k=t.name;if(BAD.has(k))fail('field "'+k+'" is not allowed',src,t.p);return(c,v)=>{const x=o(c);if(x==null||typeof x!=='object')fail('cannot set "'+k+'" of '+x,src,0);x[k]=v}}
 const kx=compile(t.x,X);return(c,v)=>{const x=o(c),k=kx(c);if(x==null||typeof x!=='object')fail('cannot set a field of '+x,src,0);const kk=typeof k==='number'?k:String(k);if(BAD.has(kk))fail('field "'+kk+'" is not allowed',src,0);x[kk]=v}}
const RET={},BRK={brk:1},CNT={cnt:1};
function stmt(node,X){
 if((node.k==='break'||node.k==='continue')&&!X.loop)fail(node.k+' can only be used inside a for loop',X.src,0);
 switch(node.k){
  case 'block':{const b=node.body.map(n=>stmt(n,X)),m=b.length;return c=>{for(let i=0;i<m;i++){const r=b[i](c);if(r!==undefined)return r}}}
  case 'let':{const ds=node.decls.map(([n,e])=>{const f=compile(e,X);X.locals.add(n);return[n,f]});return c=>{for(const[n,f]of ds)c.v[n]=f(c)}}
  case 'do':{const e=compile(node.e,X);return c=>{e(c)}}
  case 'set':{const v=compile(node.v,X),set=setter(node.t,X);if(node.op==='=')return c=>{set(c,v(c))};
   const get=compile(node.t,X),op=node.op;
   return op==='+='?c=>{set(c,get(c)+v(c))}:op==='-='?c=>{set(c,get(c)-v(c))}:op==='*='?c=>{set(c,get(c)*v(c))}:op==='/='?c=>{set(c,get(c)/v(c))}:c=>{set(c,get(c)%v(c))}}
  case 'upd':{const get=compile(node.t,X),set=setter(node.t,X),d=node.op==='++'?1:-1;return c=>{set(c,get(c)+d)}}
  case 'if':{const t=compile(node.test,X),a=stmt(node.a,X),b=node.b?stmt(node.b,X):null;return b?c=>t(c)?a(c):b(c):c=>{if(t(c))return a(c)}}
  case 'for':{const l=compile(node.list,X),n=node.name;X.locals.add(n);X.loop=(X.loop||0)+1;const body=stmt(node.body,X),src=X.src;X.loop--;
   if(node.kind==='of')return c=>{const xs=l(c);if(xs==null)fail('cannot loop over '+xs,src,0);for(const x of Array.from(xs)){c.v[n]=x;const r=body(c);if(r===CNT)continue;if(r===BRK)break;if(r!==undefined)return r}};
   return c=>{const o=l(c);if(o==null)return;for(const k of Object.keys(o)){c.v[n]=k;const r=body(c);if(r===CNT)continue;if(r===BRK)break;if(r!==undefined)return r}}}
  case 'break':return()=>BRK;case 'continue':return()=>CNT;
  case 'ret':{const e=node.e?compile(node.e,X):()=>undefined;return c=>({[RET]:1,v:e(c)})}
  case 'del':{const t=node.t,o=compile(t.o,X),k=t.name!=null?()=>t.name:compile(t.x,X),r=root(t);
   if(r.k==='id'&&hasOwn.call(CONST,r.name))fail('"'+r.name+'" cannot be changed',X.src,0);
   return c=>{const x=o(c),kk=String(k(c));if(BAD.has(kk))fail('field "'+kk+'" is not allowed',X.src,0);if(x&&typeof x==='object')delete x[kk]}}
 }
 fail('cannot compile '+node.k,X.src,0)}
const isRet=r=>r!==undefined&&typeof r==='object'&&r[RET]===1;

/* public: compile an expression or a script. A script's closure returns what its `return` gave (or undefined) */
function expr(src,scope){if(typeof src!=='string')fail('expected an expression (text), got '+JSON.stringify(src));const X=new Ctx(scope,src);return compile(parseExpr(src),X)}
function script(src,scope){if(typeof src!=='string')fail('expected a script (text), got '+JSON.stringify(src));const X=new Ctx(scope,src);
 for(const a of scope&&scope.args||[])X.locals.add(a);const b=stmt(parseScript(src),X);return c=>{const r=b(c);return isRet(r)?r.v:undefined}}

/* what a script uses, for tools/validate.js: verbs and helpers it calls, life fields it reads or changes, message keys
   given as plain text (M('…')), fields it creates with = (sets), consequences it schedules (later(age, '…')) and follow-up cards (next('…')) */
function uses(node,scope){const vars=new Set(scope&&scope.vars||[]),fns=new Set(scope&&scope.fns||[]),loc=new Set(scope&&scope.args||[]);
 const out={calls:new Set(),reads:new Set(),writes:new Set(),sets:new Set(),keys:[],later:[],next:[],consts:new Set()};
 const isLocal=n=>loc.has(n)||vars.has(n);
 (function walk(n,asTarget){if(!n||typeof n!=='object')return;
  switch(n.k){
   case 'id':if(isLocal(n.name))return;if(hasOwn.call(CONST,n.name)){out.consts.add(n.name);return}(asTarget?out.writes:out.reads).add(n.name);return;
   case 'mem':walk(n.o,false);if(asTarget){const r=root(n);if(r.k==='id'&&!isLocal(r.name)&&!hasOwn.call(CONST,r.name))out.writes.add(r.name)}if(n.x)walk(n.x);return;
   case 'call':if(n.f.k==='id'){if(!isLocal(n.f.name))out.calls.add(n.f.name);const a=n.args;
     if(n.f.name==='M'&&a[0]&&a[0].k==='lit')out.keys.push(a[0].v);
     if(n.f.name==='later'&&a[1]&&a[1].k==='lit')out.later.push(a[1].v);
     if(n.f.name==='next'&&a[0]&&a[0].k==='lit')out.next.push(a[0].v)}else walk(n.f);
    n.args.forEach(x=>walk(x));return;
   case 'let':for(const[nm,e]of n.decls){walk(e);loc.add(nm)}return;
   case 'for':walk(n.list);loc.add(n.name);walk(n.body);return;
   case 'set':case 'upd':walk(n.t,true);if(n.v)walk(n.v);if(n.op!=='=')walk(n.t);else if(n.t.k==='id'&&!isLocal(n.t.name))out.sets.add(n.t.name);return;
   case 'del':walk(n.t,true);return;
  }
  for(const k in n){const v=n[k];if(k==='k')continue;if(Array.isArray(v))v.forEach(x=>Array.isArray(x)?x.forEach(y=>walk(y)):walk(x));else if(v&&typeof v==='object')walk(v)}
 })(node);return out}

R.ES={expr,script,parseExpr,parseScript,uses,VERBS,CONST,ScriptError};
})(typeof window!=='undefined'?window:globalThis);
