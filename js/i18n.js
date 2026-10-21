/* A Second Chance translations: the code. The text is in i18n/<lang>.json (the game's interface) and in each event
   (events/*.json); tools/build.js puts each language's text into gen/<lang>.js and a page loads only the one in use:
   English (en), Simplified Chinese (zh) or Traditional Chinese (zht, Taiwan wording).
   t(key, vars) returns text in the current language. M(key, vars) stores a message to translate later, MN(number) / MS(number)
   mark money so it is formatted for the current language ($12k, $1.2万, $1.2萬). Text can hold {name} (a value) and
   {n:one|other}, chosen by the number n (# is the number): "{n:a year|# years}". Static HTML uses data-i18n="key"; English is
   whatever is already in the HTML. A page starts its own code with I18N.ready(fn), which runs once the text has arrived. */
(function(R){
const LANGS=['en','zh','zht'],HL={en:'en',zh:'zh-Hans',zht:'zh-Hant'},FONT={zh:'Noto+Sans+SC'};
const D={},pend={},waiting=[];
let lang='en';
try{const v=localStorage.getItem('cl-lang');if(LANGS.includes(v))lang=v;else{const n=(navigator.language||'').toLowerCase();if(n.startsWith('zh'))lang=/(tw|hk|mo|hant)/.test(n)?'zht':'zh'}}catch(e){}
/* gen/<lang>.js sits next to the js/ folder this file is in */
const BASE=(()=>{try{const s=document.currentScript.src;return s.slice(0,s.lastIndexOf('/js/')+1)+'gen/'}catch(e){return 'gen/'}})();

/* a language's text arrives (gen/<lang>.js calls this) */
function add(l,dict){D[l]=dict;const cbs=pend[l]||[];delete pend[l];cbs.forEach(f=>f&&f());if(l===lang)arrived()}
function load(l,cb){if(D[l]){cb&&cb();return}const first=!pend[l];(pend[l]=pend[l]||[]).push(cb);if(!first||typeof document==='undefined')return;
 const sc=document.createElement('script');sc.src=BASE+l+'.js';sc.onerror=()=>console.error('Could not load '+sc.src+' (run node tools/build.js)');document.head.appendChild(sc)}
function arrived(){if(typeof document!=='undefined'&&document.readyState!=='loading')apply();while(waiting.length)waiting.shift()()}
function ready(fn){if(D[lang])fn();else waiting.push(fn)}

function trim(x,d){return x.toFixed(d).replace(/\.0+$/,'').replace(/(\.\d*?)0+$/,'$1')}
function money(v,sign){
  if(!isFinite(v))v=0;const n=Math.abs(v);let s;
  if(lang==='en'){if(n>=1e9)s=(n/1e9).toFixed(n>=1e10?1:2)+'B';else if(n>=1e6)s=(n/1e6).toFixed(n>=1e7?1:2)+'M';else if(n>=1e4)s=Math.round(n/1e3)+'k';else if(n>=1e3)s=(n/1e3).toFixed(1)+'k';else s=String(Math.round(n))}
  else{const w=lang==='zht'?['萬','億']:['万','亿'];if(n>=1e8)s=trim(n/1e8,n>=1e9?1:2)+w[1];else if(n>=1e4)s=trim(n/1e4,n>=1e5?0:1)+w[0];else s=Math.round(n).toLocaleString('en-US')}
  if(s==='0')return '$0';
  return (v<0?'−':(sign&&v>0?'+':''))+'$'+s;
}
/* {k:'_c',ci} is a country, named in the current language */
function fv(x){if(x==null)return '';if(typeof x==='object'){if('m' in x)return money(x.m,x.sg);if(x.k==='_c')return cname(x.ci);if('k' in x)return t(x.k,x.v)}return String(x)}
function raw(k){const d=D[lang];return d&&d[k]!=null?d[k]:null}
const num=x=>x&&typeof x==='object'&&'m' in x?x.m:x;
function t(k,v){v=v||{};const d=raw(k);if(d==null)return k;const f={};for(const n in v)f[n]=fv(v[n]);
 return String(d).replace(/\{(\w+)(?::([^{}|]*)\|([^{}]*))?\}/g,(m,n,one,other)=>{if(one===undefined)return n in f?f[n]:m;return(+num(v[n])===1?one:other).replace(/#/g,n in f?f[n]:'')})}
function tr(x){if(x==null)return '';if(typeof x==='string')return x;if(typeof x==='object'){if('k' in x)return t(x.k,x.v);if('m' in x)return money(x.m,x.sg)}return String(x)}
function cname(i){const c=(typeof C!=='undefined')?C[i]:null;if(!c)return '';return lang==='en'?c[0]:raw('cn.'+c[1])||c[0]}
function loadFont(){if(typeof document==='undefined'||!FONT[lang]||document.getElementById('font-'+lang))return;const l=document.createElement('link');l.id='font-'+lang;l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family='+FONT[lang]+':wght@400&display=swap';l.addEventListener('load',()=>{R.fitAll&&R.fitAll()});document.head.appendChild(l)}
function apply(){
  if(typeof document==='undefined'||!D[lang])return;
  const de=document.documentElement;de.lang=HL[lang];loadFont();
  document.querySelectorAll('[data-i18n]').forEach(el=>{if(el.__en==null)el.__en=el.innerHTML;const k=el.getAttribute('data-i18n');const v=lang==='en'?null:raw(k);el.innerHTML=v!=null?v:el.__en});
  document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
  de.classList.remove('i18n-wait');
  R.fitAll&&R.fitAll();
}
/* switching language loads its text first, then redraws the page (pages listen for 'langchange') */
function set(l){if(!LANGS.includes(l)||l===lang)return;load(l,()=>{lang=l;try{localStorage.setItem('cl-lang',l)}catch(e){}apply();R.fitAll&&R.fitAll();R.dispatchEvent&&R.dispatchEvent(new Event('langchange'))})}

R.M=(k,v)=>({k,v});R.MN=v=>({m:v});R.MS=v=>({m:v,sg:1});
R.t=t;R.tr=tr;R.fm=money;
R.I18N={get lang(){return lang},set,apply,cname,add,ready,load,locale:()=>lang==='en'?'en':lang==='zh'?'zh-Hans':'zh-Hant',has:k=>raw(k)!=null};
if(typeof document!=='undefined'){
  const de=document.documentElement;de.lang=HL[lang];loadFont();
  if(lang!=='en'){de.classList.add('i18n-wait');setTimeout(()=>de.classList.remove('i18n-wait'),1500)}
  load(lang);
  document.addEventListener('DOMContentLoaded',()=>{if(D[lang])apply();document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>set(b.dataset.lang)))});
}
})(typeof window!=='undefined'?window:globalThis);
