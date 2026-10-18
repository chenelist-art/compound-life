/* Compound Life simulation engine: countries, life events, yearly money model, simulated futures.
   Every piece of text is a message descriptor M(key, vars) that js/i18n.js turns into
   English, Simplified or Traditional Chinese when it is shown. Money vars use MN() / MS(). */
const SK=.012;
// name, code, births (millions/yr), typical low-skill full-time wage (PPP $/yr), life expectancy, home price ÷ wage, full degree fees ÷ wage
const C=[
 ["India","IN",23,4500,72,10,.8],["China","CN",9,11000,78,18,.8],["Nigeria","NG",7.5,3000,54,10,.8],
 ["Pakistan","PK",6.5,3500,67,10,.8],["Indonesia","ID",4.4,6500,71,10,.8],["Ethiopia","ET",3.9,1800,66,10,.8],
 ["United States","US",3.6,35000,78,8,2.5],["Bangladesh","BD",3,4000,73,10,.8],["Brazil","BR",2.5,9000,76,9,.9],
 ["Mexico","MX",1.9,10000,75,8,.9],["Philippines","PH",1.7,5500,72,10,.9],["Vietnam","VN",1.4,7000,74,14,.8],
 ["Japan","JP",.75,26000,84,8,1.2],["Germany","DE",.7,32000,81,9,.3],["United Kingdom","GB",.65,28000,81,11,2],
 ["Malaysia","MY",.45,14000,76,8,1],["Singapore","SG",.03,30000,83,11,1.2]
];
const famM=f=>M('fam.'+f);

/* ---------- where you stand in the world: real data ----------
   WEALTH_PCT: [net worth per adult in US dollars, % of the world's adults with less], end-2022, all 5,363 million adults.
   Source: UBS / Credit Suisse, Global Wealth Report 2023 (Davies, Lluberas & Shorrocks, Global Wealth Databook 2023).
   - p.22, Figure 1: 52.5% of adults below USD 10,000; 34.4% between 10,000 and 100,000; 12.0% between 100,000 and 1 million.
   - p.23: USD 8,654 to be in the richer half, USD 137,333 for the top 10%, USD 1,081,342 for the top 1%.
   - p.31: 7.9 million adults above USD 5m, 2.8 million above USD 10m, 243,060 above USD 50m (shares of 5,363.4m adults worked out by us).
   Between these points we interpolate on a log scale. Below the median the report gives no thresholds, so we fit a curve
   to its <USD 10,000 band (2,818m adults owning USD 5.3tn, an average of USD 1,881): share = 50% × (wealth / 8,654)^0.2317.
   That lower part is an ESTIMATE. */
const WEALTH_PCT=[[8654,50],[10000,52.5],[100000,86.9],[137333,90],[1e6,98.9],[1081342,99],[5e6,99.853],[1e7,99.948],[5e7,99.9955]];
/* INCOME_PCT: [income per person per day in 2021 PPP dollars, % of the world's people living on less], world, 2022.
   Source: World Bank, Poverty and Inequality Platform (pip.worldbank.org), API pip-grp, country=WLD, year=2022, fetched 2026-10-18.
   It measures household income or consumption per person, so comparing it with one person's pay is an ESTIMATE. */
const INCOME_PCT=[[1,1.18],[3,10.87],[8.3,48.27],[20,74.13],[50,89.58],[100,96.99],[200,99.49]];
/* WD[code] = [median, mean] wealth per adult in US dollars, end-2022: UBS Global Wealth Databook 2023, as listed in Wikipedia's
   "List of countries by wealth per adult" (fetched 2026-10-18). Checked against the Global Wealth Report 2023, p.16 Table 2:
   US, UK and Singapore (both), Japan (median) and Germany (mean). The others were not checked against the Databook itself.
   Inside a country we assume wealth follows a log-normal curve with that median and mean, so ranks in a country are ESTIMATES.
   PPP[code] = [PPP conversion factor (local currency per international $, PA.NUS.PPP), official exchange rate (local currency per US$,
   PA.NUS.FCRF)], 2022: World Bank World Development Indicators, fetched 2026-10-18. Their ratio turns the game's PPP dollars
   into the market US dollars UBS uses. Game money is in today's prices; the UBS and World Bank figures are 2022 dollars. */
const WD={IN:[3755,16500],CN:[27273,75731],NG:[1507,6879],PK:[2076,5226],ID:[4819,17457],ET:[2124,4905],US:[107739,551347],BD:[3842,9796],
 BR:[5702,29452],MX:[18920,55274],PH:[3155,14486],VN:[5309,14569],JP:[103681,216078],DE:[66735,256179],GB:[151825,302783],MY:[8523,29314],SG:[99488,382957]};
const PPP={IN:[20.4927,78.6045],CN:[3.79465,6.73716],NG:[147.997,425.979],PK:[46.2085,204.867],ID:[4918.70,14849.85],ET:[17.2634,51.7562],US:[1,1],
 BD:[27.7516,91.7455],BR:[2.41166,5.16397],MX:[9.92278,20.12735],PH:[19.0815,54.4778],VN:[6942.55,23271.21],JP:[94.9221,131.4981],DE:[.688423,.949624],
 GB:[.633175,.811302],MY:[1.50323,4.40108],SG:[.870895,1.378667]};
/* ---------- women and men: real data ----------
   LE_SEX[code] = [women, men, everyone] life expectancy at birth, 2023: World Bank WDI SP.DYN.LE00.FE.IN, SP.DYN.LE00.MA.IN and
   SP.DYN.LE00.IN (fetched 2026-10-18). The game keeps each country's lifespan from C and shifts it by the published gap between the sexes.
   SRB[code] = boys born for every girl, 2023: World Bank WDI SP.POP.BRTH.MF (fetched 2026-10-18).
   PAYGAP[code] = how much less women earn than men, in %:
   - OECD "Gender wage gap", median earnings of full-time employees, OECD Data Explorer as listed in JILPT Databook of International
     Labour Statistics 2025, table 5-10: JP 22.0 (2023), US 16.4 (2023), GB 13.3 (2023), DE 14.4 (2022), MX 15.0 (2023), BR 10.0 (2023).
   - SG 14.3 (2023): Ministry of Manpower, full-time resident employees aged 25-54, median (MRSD, Update on Singapore's Adjusted Gender Pay Gap).
   - MY 2.9 (June 2024): DOSM, Employee Wages Statistics (Formal Sector) Q2 2024, median monthly wages RM2,782 men and RM2,700 women.
   - ILOSTAT gender wage gap, all occupations (EAR_GGAP_OCU_RT, from mean hourly earnings of employees), latest year, fetched 2026-10-18:
     IN 19.5 (2025), BD 14.5 (2024), ID 13.5 (2023), VN 8.7 (2024), ET 21.1 (2021), NG 27.4 (2013), PK -3.1 (2025), PH -15.3 (2024).
     Where the published gap is below zero (few women hold paid jobs, and those who do tend to be better educated) the game uses 0
     rather than a premium: an ESTIMATE.
   - China publishes no official figure; CN uses the ILO's world figure of "around 18 per cent" (ILO news release, September 2026): an ESTIMATE.
   CHILDPEN[code] = the child penalty: how far women's employment falls relative to men's after a first child, in %. Kleven, Landais &
   Leite-Mariante, "The Child Penalty Atlas", Review of Economic Studies 92(5), 2025 (data from childpenaltyatlas.org, fetched 2026-10-18).
   Singapore is not in the atlas; SG uses the atlas's Asia figure (26): an ESTIMATE.
   The game turns that drop in work into the same % less pay for a mother for ten years after her first child (the expected loss
   rather than a choice): an ESTIMATE. The measured pay gaps already include some mothers, so the two effects overlap a little. */
const LE_SEX={IN:[73.60,70.52,72.00],CN:[80.93,75.20,77.95],NG:[54.74,54.18,54.46],PK:[70.16,65.33,67.65],ID:[73.27,69.04,71.15],ET:[70.73,64.08,67.31],
 US:[81.10,75.80,78.39],BD:[76.37,73.03,74.67],BR:[78.98,72.76,75.85],MX:[77.81,72.24,75.07],PH:[72.82,66.89,69.83],VN:[79.26,69.88,74.59],
 JP:[87.14,81.09,84.04],DE:[83.50,78.70,81.04],GB:[83.21,79.36,81.24],MY:[79.37,74.27,76.66],SG:[85.30,81.00,83.10]};
const SRB={IN:1.07,CN:1.11,NG:1.04,PK:1.05,ID:1.06,ET:1.05,US:1.05,BD:1.05,BR:1.04,MX:1.04,PH:1.08,VN:1.11,JP:1.05,DE:1.06,GB:1.05,MY:1.06,SG:1.06};
const PAYGAP={JP:22.0,US:16.4,GB:13.3,DE:14.4,MX:15.0,BR:10.0,SG:14.3,MY:2.9,IN:19.5,BD:14.5,ID:13.5,VN:8.7,ET:21.1,NG:27.4,PK:-3.1,PH:-15.3,CN:18};
const CHILDPEN={BD:62,BR:37,CN:4,ET:15,DE:41,IN:25,ID:20,JP:44,MY:45,MX:44,NG:1,PK:16,PH:25,GB:34,US:25,VN:1,SG:26};
function logInterp(tab,x){if(x>=tab[tab.length-1][0])return tab[tab.length-1][1];for(let i=1;i<tab.length;i++)if(x<tab[i][0]){const[a,p]=tab[i-1],[b,q]=tab[i];return p+(q-p)*Math.log(x/a)/Math.log(b/a)}}
/* PPP dollars in the game → US dollars at market exchange rates, using your home country's price level */
function toUSD(ci,v){const p=PPP[C[ci][1]];return v*p[0]/p[1]}
/* % of the world's adults with less wealth than you (0 when you own nothing) */
function worldPct(ci,nw){const u=toUSD(ci,nw);if(u<=0)return 0;if(u<WEALTH_PCT[0][0])return 50*Math.pow(u/WEALTH_PCT[0][0],.2317);return logInterp(WEALTH_PCT,u)}
function normCdf(z){const t=1/(1+.2316419*Math.abs(z)),d=.3989423*Math.exp(-z*z/2),p=d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p}
/* % of adults in your country with less wealth than you (an estimate from the country's median and mean) */
function countryPct(ci,nw){const u=toUSD(ci,nw),[md,mn]=WD[C[ci][1]];if(u<=0)return 0;const sg=Math.sqrt(2*Math.log(mn/md));return 100*normCdf(Math.log(u/md)/sg)}
/* % of the world's people living on less than this yearly income (game income is already in PPP dollars) */
function incomePct(inc){const d=inc/365;if(d<=0)return 0;if(d<INCOME_PCT[0][0])return INCOME_PCT[0][1]*d/INCOME_PCT[0][0];return logInterp(INCOME_PCT,d)}
function mb(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hsh(...xs){let h=2166136261;for(const x of xs){const s=String(x);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}h^=124;h=Math.imul(h,16777619)}return h>>>0}
function gauss(r){let u=0;while(!u)u=r();const v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function amort(P,r,n){return P*r/(1-Math.pow(1+r,-n))}
function skill(s){let t=0;for(const k in s.skillSrc)t+=s.skillSrc[k];return t}
function eqTot(s){let t=0;for(const k in s.lots)t+=s.lots[k].v;return t}
/* "market" lots follow the stock market; gold, bonds and fixed-rate accounts (deposits, EPF, CPF) do not */
const isMkt=l=>l.rate==null&&!l.t;
function mktTot(s){let t=0;for(const k in s.lots)if(isMkt(s.lots[k]))t+=s.lots[k].v;return t}
function liquid(s){return Math.max(0,s.cash)+eqTot(s)}
function addLot(s,src,a){if(!(a>0))return;const l=s.lots[src]||(s.lots[src]={v:0,tin:0,tout:0});l.v+=a;l.tin+=a}
function mkLot(s,src,props,lk){const l=s.lots[src]||(s.lots[src]={v:0,tin:0,tout:0});Object.assign(l,props||{});if(lk)T(s,'lot_'+src,{kind:'lot',src,label:M(lk)});return l}
function withdrawEq(s,amt){const tot=eqTot(s);if(tot<=0||amt<=0)return 0;const take=Math.min(amt,tot),fr=take/tot;for(const k in s.lots){const l=s.lots[k],x=l.v*fr;l.v-=x;l.tout+=x}return take}
/* banks stop lending at about two years of a typical wage; past that you simply go without */
const debtCap=s=>{if(s.debt>2*s.base)s.debt=2*s.base};
function pay(s,a){if(!(a>0))return;const c=Math.min(Math.max(0,s.cash),a);s.cash-=c;a-=c;if(a>0)a-=withdrawEq(s,a);if(a>1e-6){s.debt+=a;debtCap(s)}}
function payRet(s,a){if(!(a>0))return 0;const c=Math.min(Math.max(0,s.cash),a);s.cash-=c;a-=c;if(a>0)a-=withdrawEq(s,a);return Math.max(0,a)}
function T(s,id,o){if(!s.trk[id])s.trk[id]=Object.assign({id,age:s.age,kind:'custom',v:0,gain:0,cost:0,per:0,spent:0,g:0},o||{});return s.trk[id]}
function addSkill(s,k,pts,label){pts*=Math.max(0,1-skill(s)/120);s.skillSrc[k]=(s.skillSrc[k]||0)+pts;if(k!=='base'&&label)T(s,'sk_'+k,{kind:'skill',label})}
/* pay multipliers from raises, a job abroad or going part-time */
function pm(s){let m=1;for(const k in s.bump)m*=s.bump[k];return m}
/* a woman's pay: the country's gender pay gap, and the child penalty for ten years after her first child */
const workCode=s=>C[s.abroad!=null?s.abroad:s.ci][1];
const momYears=(s,a)=>{if(!s.kids.length)return false;const b=Math.min(...s.kids);return a>=b&&a<b+10};
function gapM(s){return s.sex==='f'?1-Math.max(0,PAYGAP[workCode(s)])/100:1}
function sexPay(s){return s.sex==='f'?gapM(s)*(momYears(s,s.age)?1-CHILDPEN[workCode(s)]/100:1):1}
/* pay: the career's typical multiple, then Skill, promotions and experience (weighted by how much the career rewards them),
   a creative or sporting tier, a business's growth, this year's commission or market luck, raises, and the pay gap */
function salary(s){const j=s.job;if(!j)return 0;const c=CAR[j.id];if(j.train>s.age)return s.base*c.tr.pay*sexPay(s);
 let v=s.base*carR(s,j.id)*(j.tier||1)*(j.own||1)*(j.yv==null?1:j.yv)*(1+SK*skill(s))*(1+.18*c.gr*s.level)*(1+.015*c.gr*Math.min(s.exp,25));
 if(c.fl&&v<c.fl*s.base)v=c.fl*s.base;return v>0?v*pm(s)*sexPay(s):v}
function netOf(s,g){return g-Math.max(0,g-.4*s.base)*.18}
function price(s){return s.hm*s.base}
function rent(s){return .03*price(s)}
function mPay(L){return amort(L,.03,30)}
function carPay(P){return amort(P,.06,5)}
function inhAmt(s){return s.fam==='rich'?6*s.base:1.2*s.base}
function bizP(s){return Math.min(.75,.16+skill(s)*.004+s.hustleYears*.025)}
function eduCost(s,k){const fp={rich:1,middle:.5}[s.fam]||0;const sc=(k==='uni'&&skill(s)>=26)?.6:0;return s.uni*s.base*(k==='uni'?1:.35)*(1-fp)*(1-sc)}
function kidsCost(s,a){let c=0;for(const b of s.kids)if(a>=b&&a<b+22)c+=.15*s.base;return c}
function evR(s,k){return mb(hsh(s.seed,s.age,k))}
function yearRand(seed,age){const r=mb(hsh(seed,'y',age));return{mkt:.05+.16*gauss(r),hs:gauss(r),d:r(),md:r(),ma:r(),jl:r(),pr:r(),gd:gauss(r),bd:gauss(r)}}
function clone(s){return JSON.parse(JSON.stringify(s))}
function netWorth(s){let n=s.cash+eqTot(s)-s.debt-s.sloan;if(s.crypto)n+=s.crypto.stake;if(s.house)n+=s.house.value-s.house.mort;if(s.car&&s.car.bal)n-=s.car.bal;if(s.biz&&s.biz.ok&&!s.biz.sold)n+=(s.biz.mode==='full'?2:1)*s.biz.inc;return n}

function newLife(ci,seed,sex){const r=mb(hsh(seed,'birth'));const c=C[ci];const u=r();const fam=u<.3?'poor':u<.68?'working':u<.92?'middle':'rich';
 const s={ci,base:c[3],le:c[4],hm:c[5],uni:c[6],fam,seed,age:0,dead:false,deathAge:null,
  skillSrc:{base:{poor:8,working:13,middle:19,rich:25}[fam]},health:70+Math.floor(r()*12),happy:60,
  cash:0,debt:0,sloan:0,sloanPay:0,lots:{},house:null,car:null,job:null,level:0,levelGrind:0,exp:0,
  study:null,cert:null,savePct:0,life:.85,insured:false,married:false,kids:[],biz:null,crypto:null,
  focus:'balance',hustleYears:0,retireAge:null,retired:false,pension:0,
  crashAge:34+Math.floor(r()*17),inheritAge:46+Math.floor(r()*14),marryRoll:r(),
  done:{},trk:{},earned:0,outUntil:0,sold:0,lastSal:0,lastInc:0,pivoted:false,pivotYear:-1,
  cutDebt:false,debtSeen:-99,noDeath:false,milestones:{},brokeLogged:0,
  plan:{},spare:{},lastDec:4,later:[],rec:[],bump:{},costMul:1,rentMul:1,rentUntil:0,habit:0,efund:0,abroad:null,scheme:null,ilp:null,
  kidEdu:null,kidFee:0,annu:0,ret2:null,layAt:-1,layVol:false,screen:false,ltc:false,insMul:1,
  rel:50,offUntil:0,uncle:false,refN:0,lonely:0,
  ill:null,illAge:-1,illType:null,dep:null,depAge:-1,lowHap:0,grindY:0,
  needJob:true,lastCar:null,carN:0,carGone:{},swAt:null,swWhy:null};
 s.hz=0;s.dieAt=-Math.log(1-mb(hsh(seed,'death'))());
 const k=c[1];s.sex=sex||(r()<SRB[k]/(1+SRB[k])?'m':'f');s.le=Math.round(c[4]+LE_SEX[k][s.sex==='f'?0:1]-LE_SEX[k][2]);
 s.plan=planLife(s);return s}

/* Each life draws its own mix of decisions. Events with `win:[from,to]` get an age in that window
   (with chance `p`, and only if `only(s)` allows it at birth); fixed-age events are placed first and
   the rest try to land on years that are still free. Events that missed the draw go into `spare`,
   used only to fill a quiet stretch (see dueEvents). */
const DENSITY=.5; // scales every event's chance; raise it for more decisions per life (about 50 at .5)
function planLife(s){const r=mb(hsh(s.seed,'plan')),used={},plan={},spare={};
 for(const e of EV)if(e.win&&e.win[0]===e.win[1]){plan[e.id]=e.win[0];used[e.win[0]]=1}
 for(const e of EV){if(!e.win||e.win[0]===e.win[1])continue;
  const p=typeof e.p==='function'?e.p(s):(e.p==null?1:e.p);if(e.only&&!e.only(s))continue;const pick=r()<p*(p<1?DENSITY:1);
  const[a,b]=e.win;let age=a+Math.floor(r()*(b-a+1));for(let k=0;k<8&&used[age];k++)age=a+Math.floor(r()*(b-a+1));
  if(pick){used[age]=1;plan[e.id]=age}else if(p>0)spare[e.id]=age}
 s.spare=spare;return plan}

/* ---------- decision helpers ---------- */
function startStudy(s,k){const cost=eduCost(s,k);const lab=M(k==='uni'?'lbl.uni':'lbl.dip');s.study={end:s.age+(k==='uni'?4:2),gain:k==='uni'?6.5:6,pt:k==='uni'?.25:.3,label:lab,k};const t=T(s,'sk_edu',{kind:'skill',label:lab});t.cost+=cost;const fc=Math.min(Math.max(0,s.cash),cost);s.cash-=fc;s.sloan+=cost-fc}
function startCert(s,k){const fee=k==='mba'?s.base:.3*s.base;const lab=M(k==='mba'?'lbl.mba':'lbl.cert');s.cert={end:s.age+(k==='mba'?2:1),kind:k,label:lab};pay(s,fee);const t=T(s,'sk_cert',{kind:'skill',label:lab});t.cost+=fee}
function setSave(s,p){s.savePct=p;if(p>0){const t=T(s,'lot_auto',{kind:'lot',src:'auto'});t.label=M('trk.auto',{p:Math.round(p*100)})}}
function bet(s,p){const amt=p*liquid(s);const fc=Math.min(Math.max(0,s.cash),amt);s.cash-=fc;withdrawEq(s,amt-fc);s.crypto={stake:amt,res:s.age+2};T(s,'tip',{kind:'custom',label:M(p>.1?'trk.tipBig':'trk.tipSmall'),note:M('note.tipIn',{a:MN(amt)})})}
function wed(s,m,key){const a=m*s.base;s.married=true;s.happy+=5;pay(s,a);const t=T(s,'wed',{kind:'ghost',label:M(key)});t.spent+=a;t.g+=a}
function buy(s,P){const up=.23*P;pay(s,up);s.house={value:P,mort:.8*P,pay:mPay(.8*P),out:up,rentAv:0,frac:P/price(s),rate:.03,end:s.age+30};T(s,'home',{kind:'custom',label:M(P<price(s)?'trk.flat':'trk.home'),v:-.03*P,note:M('note.homeFees')})}
function startBiz(s,mode,cap){pay(s,cap);s.biz={mode,cap,res:s.age+2,ok:false,done:false,inc:0,sold:false};T(s,'biz',{kind:'custom',label:M(mode==='full'?'trk.bizFull':'trk.bizSide'),v:-cap,note:M('note.bizIn',{a:MN(cap)})})}
function crashTrack(s,mode){const P=s.crashP||0;if(P>1)T(s,'crash',{kind:'crash',mode,hold:P,sell:P,label:M(mode==='sell'?'trk.crashSell':'trk.crashHold')})}
function crashSell(s){const P=eqTot(s);withdrawEq(s,P);s.cash+=P;s.sold=P;s.outUntil=s.age+3;crashTrack(s,'sell')}
/* one-off spending, tracked as what the money would be worth had it been invested */
function spend(s,id,a,lk){pay(s,a);const t=T(s,id,{kind:'ghost',label:M(lk)});t.spent+=a;t.g+=a}
/* a cost that repeats every year for `yrs` years (negative = income); `h` changes health each year */
function rec(s,id,amt,yrs,h){s.rec.push({id,amt,until:s.age+yrs,h:h||0})}
/* something that resolves years from now (see LATER) */
function later(s,age,k,x){s.later.push(Object.assign({age,k},x||{}))}
function bump(s,id,m,label,nk){s.bump[id]=(s.bump[id]||1)*m;const t=T(s,id,{kind:'custom',label});t.note=M(nk||'note.bump',{p:Math.round((s.bump[id]-1)*100)})}
function setRate(h,rate,age){h.rate=rate;if(h.mort>0)h.pay=amort(h.mort,rate,Math.max(1,(h.end||age+20)-age))}
function efTarget(s){return .5*(.5*s.base*(s.costMul||1)+rent(s))}
function emerg(s){const r=evR(s,'em');later(s,s.age+2+Math.floor(r()*4),'emerg',{a:(.25+.25*r())*s.base})}
function abroadTo(s){return C.findIndex(c=>c[1]===(C[s.ci][1]==='SG'?'US':'SG'))}
const negoP=s=>clamp(.3+skill(s)*.006,.2,.65);
const SCH={US:{lot:'k401',lk:'trk.k401',match:.05,rel:0,rate:null,ps:[0,.05,.1]},MY:{lot:'epf',lk:'trk.epf',match:0,rel:0,rate:.03,ps:[0,.05,.1]},SG:{lot:'cpf',lk:'trk.cpf',match:0,rel:.1,rate:.02,ps:[0,.05]}};
const O=(id,lk,sub,go,ok)=>{const o={id,label:typeof lk==='string'?M(lk):lk,sub,go};if(ok!==undefined)o.ok=ok;return o};
/* `sub` says only what you'd know in real life (prices, pay, fees); `hint` adds the effects you couldn't know (skill, pay %, odds) and is shown only in Easy */
const Hn=(o,hint)=>{o.hint=hint;return o};
/* Relationships (0–100): moved by choices about people and by how you spend your years (see tick) */
function rl(s,d){s.rel=clamp(s.rel+d,0,100)}
const RH=(d,x)=>d?M(x?'hr2':'hr',{n:(d>0?'+':'−')+Math.abs(d),x}):x;
/* an option that also moves Relationships by d; the change (and any extra hint x) shows in Easy only */
const OR=(id,lk,sub,d,go,ok,x)=>Hn(O(id,lk,sub,s=>{rl(s,d);if(go)go(s)},ok),RH(d,x));
/* lunar new year: China, Malaysia, Singapore and Vietnam; elsewhere the biggest family holiday of the year */
const LNY=s=>['CN','MY','SG','VN'].includes(C[s.ci][1]);
/* a referral or recommendation: a lasting pay rise of m, shown in the passbook */
function refer(s,id,m,lk,L,lg){if(!s.job||s.retired||s.study)return false;bump(s,id,m,M(lk));L&&L(M(lg,{p:Math.round((m-1)*100)}),'good');return true}
/* chances that depend on people: each point of Relationships above 50 adds 0.4 percentage points */
const relP=(s,p)=>clamp(p+(s.rel-50)*.004,0,.95);
/* money from family and friends when you're sick or short, tracked in one passbook line */
function helped(s,h){const t=T(s,'help',{kind:'custom',label:M('trk.help')});t.v+=h;t.note=M('note.help',{a:MN(t.v)})}
/* family and friends may chip in on a medical bill; the closer you are, the likelier and the more */
function chipIn(s,you,k,L){if(s.rel>=40&&evR(s,k)()<(s.rel-30)/100){const h=you*(.2+.3*s.rel/100);s.cash+=h;helped(s,h);L&&L(M('log.helpMed',{a:MN(h)}),'good')}}
const job=s=>!!s.job&&!s.study&&!s.retired;

/* ---------- careers ----------
   CAR[id]: f family; r typical pay as a multiple of the median pay of all jobs (the game's pay curve, Skill, promotions and
   experience build on it, as they did for the old "big company" job at r = 1); g the ISCO-08 major group used to adjust r for
   your country (0 = none); req: ed (1 diploma, 2 degree), sk lowest Skill, hl lowest Health, age (latest age to start), cap
   (savings you put in, × typical wage); gr how much promotions and experience raise pay (0 = none); pp promotion speed;
   lay [yearly layoff chance, in a crash year]; auto yearly chance from 45 that the job is automated; inj yearly injury chance;
   hd Health and hp Happiness a year; tr training {y years, pay, fee} (× typical wage); pen pension (× last pay); tiers
   [[chance, pay ×]] drawn when you start (creative and sports work) and sometimes again; end [from, to] the age a playing
   career ends; own {res years until it works or fails, fail chance, grow a year, max ×}; vol yearly ups and downs
   (commission, harvests); mkt pay follows the stock market; fl lowest pay (× typical wage: gigs and day jobs).
   PAY DATA (r): US Bureau of Labor Statistics, Occupational Employment and Wage Statistics (OEWS), May 2025, national annual
   median wages, BLS public API (series OEUN…13), fetched 2026-10-18. All occupations: $50,980. Each r = occupation median ÷ $50,980:
   accountants and auditors 13-2011 $83,680 (1.64); market research analysts and marketing specialists 13-1161 $78,760 (1.54);
   software developers 15-1252 $135,980 (2.67); financial and investment analysts 13-2051 $102,740 (2.02, our banker);
   secondary school teachers 25-2031 $72,040 (1.41); registered nurses 29-1141 $97,550 (1.91; the game's nurse needs only a diploma, so it is adjusted with
   ISCO group 3, nursing associate professionals); family medicine physicians
   29-1215 $244,180 (4.79); lawyers 23-1011 $159,670 (3.13); restaurant cooks 35-2014 $37,390 (0.73, the first rung of a chef's career: promotions
   lead towards chefs and head cooks 35-1011, $62,470); electricians 47-2111
   $63,190 (1.24); automotive service technicians and mechanics 49-3023 $50,620 (0.99); construction laborers 47-2061 $47,120
   (0.92); heavy and tractor-trailer truck drivers 53-3032 $58,640 (1.15); miscellaneous assemblers and fabricators 51-2090
   $44,650 (0.88, our factory worker); farmworkers and laborers, crop 45-2092 $35,660 (0.70); graphic designers 27-1024 $62,960
   (1.24); writers and authors 27-3043 $76,910 (1.51); athletes and sports competitors 27-2021 $66,710 (1.31, footballer and
   badminton player); exercise trainers and group fitness instructors 39-9031 $47,160 (0.93); real estate sales agents 41-9022
   $52,830 (1.04); insurance sales agents 41-3021 $62,280 (1.22); securities, commodities and financial services sales agents
   41-3031 $78,660 (1.54, our trader).
   ESTIMATES (no published median fits): civil servant 1.0; musician 0.55 and actor 0.5 (the BLS gives only hourly medians,
   $47.80 and $29.05, for work that is mostly part-time); content creator 0.45; esports player 0.9; hawker 0.73 (restaurant
   cooks, as for the chef, as a stand-in); shop owner 0.95 (first-line supervisors of retail sales workers 41-1011, $48,520, as a
   stand-in); startup founder 0.5 while building. All the risks (tiers, injuries, failure, automation, when careers end) are
   game rules, not data.
   COUNTRY ADJUSTMENT (ISCO): ILOSTAT, mean monthly earnings of employees by occupation, ISCO-08 major groups 1–9
   (EAR_EMTA_SEX_OCU_NB, both sexes), ILO SDMX API, fetched 2026-10-18, latest year with every group: each group's mean ÷ the
   all-occupations mean. Years: BD 2024, BR 2025, DE 2022, ET 2021, GB 2025, ID 2023, IN 2025, MX 2025, MY 2020, NG 2024,
   PK 2025, PH 2024, SG 2021, US 2025, VN 2024. A career's r is multiplied by (its group's ratio in the country you work in ÷
   the US ratio), because the BLS medians are American. China and Japan have no occupation breakdown there and use the US
   ratios; Singapore has no farm figure and uses the US one; mixing mean ratios with medians is an approximation: ESTIMATES. */
const ISCO={US:[1.65,1.38,1.04,.72,.59,.57,.86,.75,.58],BD:[2.43,1.49,1.45,1.46,.93,.83,.94,1.00,.69],BR:[2.36,1.93,1.28,.81,.68,.58,.78,.83,.48],
 DE:[1.99,1.36,1.03,.86,.63,.71,.89,.83,.53],ET:[1.91,1.88,1.35,1.01,.53,.70,.74,1.07,.50],GB:[1.45,1.23,1.00,.72,.62,.68,.94,.87,.48],
 ID:[2.59,1.24,1.66,1.29,.89,.62,.91,1.16,.68],IN:[2.27,1.72,1.18,1.09,.70,.59,.76,.78,.52],MX:[2.09,1.63,1.30,1.10,.84,.72,1.04,1.05,.67],
 MY:[2.21,1.81,1.13,.81,.66,.53,.64,.65,.59],NG:[1.39,.99,1.23,.96,.77,.71,.95,1.19,.74],PK:[1.42,1.35,1.48,1.00,1.22,1.02,1.08,1.08,.94],
 PH:[2.03,1.89,1.32,1.18,.84,.73,.89,.92,.67],SG:[2.06,1.49,.88,.65,.56,null,.60,.46,.35],VN:[1.63,1.39,1.17,1.06,.85,.73,.95,1.01,.74]};
const CAR={
 acct:{f:'office',r:1.64,g:2,req:{ed:2},gr:1,lay:[.02,.1],auto:.025},
 mkt:{f:'office',r:1.54,g:2,req:{ed:1},gr:1,lay:[.03,.15],auto:.015},
 swe:{f:'office',r:2.67,g:2,req:{ed:2,sk:30},gr:1.1,lay:[.03,.15],auto:.01,hp:-1},
 bank:{f:'office',r:2.02,g:2,req:{ed:2,sk:30},gr:1.2,lay:[.03,.2],auto:.015,hd:-.3,hp:-2},
 civ:{f:'office',r:1,g:4,req:{},gr:.7,pp:.6,lay:[.005,.005],pen:.4},
 teach:{f:'office',r:1.41,g:2,req:{ed:2},gr:.6,pp:.5,lay:[.005,.01],pen:.35,hp:1},
 nurse:{f:'office',r:1.91,g:3,req:{ed:1},gr:.6,lay:[.005,.01],hd:-.4},
 doc:{f:'office',r:4.79,g:2,req:{ed:2,sk:42},gr:.8,lay:[.003,.005],tr:{y:4,pay:.4,fee:.5},hd:-.5,hp:-1},
 law:{f:'office',r:3.13,g:2,req:{ed:2,sk:36},gr:1,lay:[.02,.06],tr:{y:2,pay:.15,fee:.7},hp:-2},
 chef:{f:'hands',r:.73,g:5,req:{},gr:.5,lay:[.03,.1],inj:.02,hd:-.8},
 elec:{f:'hands',r:1.24,g:7,req:{ed:1},gr:.5,lay:[.02,.06],inj:.02,hd:-.6},
 mech:{f:'hands',r:.99,g:7,req:{},gr:.5,lay:[.02,.06],inj:.015,hd:-.6},
 cons:{f:'hands',r:.92,g:9,req:{hl:50},gr:.4,lay:[.04,.15],inj:.04,hd:-1.5},
 drv:{f:'hands',r:1.15,g:8,req:{},gr:.3,lay:[.02,.06],inj:.015,hd:-.8,auto:.03},
 fact:{f:'hands',r:.88,g:8,req:{},gr:.4,lay:[.04,.12],inj:.02,hd:-.8,auto:.03},
 farm:{f:'hands',r:.70,g:6,req:{},gr:.3,lay:[0,0],inj:.02,hd:-.8,vol:.25},
 design:{f:'creative',r:1.24,g:2,req:{ed:1},gr:.6,lay:[.03,.12],tiers:[[.25,.6],[.5,1],[.2,1.6],[.05,3]],fl:.6,hp:2},
 music:{f:'creative',r:.55,g:2,req:{},gr:0,lay:[0,0],tiers:[[.6,.35],[.25,1],[.12,3],[.03,20]],fl:.6,hp:3},
 infl:{f:'creative',r:.45,g:0,req:{},gr:0,lay:[0,0],tiers:[[.65,.2],[.22,1],[.1,4],[.03,30]],fl:.6,hp:2},
 actor:{f:'creative',r:.5,g:2,req:{},gr:0,lay:[0,0],tiers:[[.6,.3],[.25,1],[.12,3],[.03,25]],fl:.6,hp:3},
 writer:{f:'creative',r:1.51,g:2,req:{sk:25},gr:0,lay:[0,0],tiers:[[.5,.35],[.3,1],[.15,2],[.05,8]],fl:.6,hp:3},
 foot:{f:'sport',r:1.31,g:3,req:{hl:65,age:22},gr:0,lay:[0,0],tiers:[[.75,.45],[.2,1.2],[.04,6],[.01,40]],end:[30,35],inj:.07,hd:1,hp:2,fl:.6},
 badm:{f:'sport',r:1.31,g:3,req:{hl:65,age:22},gr:0,lay:[0,0],tiers:[[.8,.4],[.16,1.2],[.035,5],[.005,25]],end:[29,34],inj:.05,hd:1,hp:2,fl:.6},
 esp:{f:'sport',r:.9,g:0,req:{age:22},gr:0,lay:[0,0],tiers:[[.8,.3],[.15,1.2],[.04,5],[.01,20]],end:[25,29],inj:.03,hd:-.8,hp:2,fl:.6},
 coach:{f:'sport',r:.93,g:3,req:{hl:60},gr:.4,lay:[.03,.1],inj:.02,hd:1},
 hawker:{f:'own',r:.73,g:5,req:{cap:.2},gr:0,lay:[0,0],own:{res:2,fail:.3,grow:.04,max:2},hd:-.6},
 shop:{f:'own',r:.95,g:5,req:{cap:.8},gr:0,lay:[0,0],own:{res:2,fail:.4,grow:.05,max:2.5}},
 start:{f:'own',r:.5,g:0,req:{cap:.4,sk:25},gr:0,lay:[0,0],own:{res:4,fail:.7,grow:.06,max:10},hp:-1},
 prop:{f:'own',r:1.04,g:3,req:{},gr:.3,lay:[0,0],vol:.55},
 ins:{f:'own',r:1.22,g:3,req:{},gr:.3,lay:[0,0],vol:.4},
 trade:{f:'own',r:1.54,g:3,req:{cap:.5},gr:0,lay:[0,0],mkt:1}
};
/* a career's typical pay multiple in the country you work in */
function carR(s,id){const c=CAR[id],t=ISCO[workCode(s)];if(!c.g||!t)return c.r;const g=c.g-1;return c.r*(t[g]!=null?t[g]:ISCO.US[g])/ISCO.US[g]}
const edLv=s=>s.done.edu==='uni'?2:s.done.edu==='dip'?1:0;
function drawTier(r,c){let u=r();for(const t of c.tiers){u-=t[0];if(u<=0)return t[1]}return c.tiers[0][1]}
const typTier=c=>c.tiers.reduce((b,t)=>t[0]>b[0]?t:b)[1];
/* true, or the reason a career is out of reach right now */
function carLock(s,id){const q=CAR[id].req,ed=edLv(s);
 if(s.carGone&&s.carGone[id])return M('car.need.gone');
 if(q.ed&&ed<q.ed)return M(q.ed===2?'car.need.uni':'car.need.dip');
 if(q.age&&s.age>q.age)return M('car.need.age',{n:q.age});
 if(q.sk&&skill(s)<q.sk)return M('car.need.sk',{n:q.sk,h:Math.floor(skill(s))});
 if(q.hl&&s.health<q.hl)return M('car.need.hl',{n:q.hl,h:Math.floor(s.health)});
 if(q.cap&&liquid(s)<q.cap*s.base)return M('car.need.cap',{n:MN(q.cap*s.base),h:MN(liquid(s))});
 return true}
/* switching keeps half your experience in the same family of careers, a fifth in a new one, and you start lower */
const sameFam=(s,id)=>!!s.lastCar&&CAR[s.lastCar].f===CAR[id].f;
/* what a career would typically pay in its first working year (what you'd be told at the interview) */
function carStartPay(s,id){const c=CAR[id],j=s.job,lv=s.level,ex=s.exp,sf=sameFam(s,id);
 if(s.lastCar){s.level=sf?Math.max(0,lv-2):0;s.exp=ex*(sf?.5:.2)}
 s.job={id,tier:c.tiers?typTier(c):1,own:1,yv:c.mkt?.45:1};const v=salary(s);s.job=j;s.level=lv;s.exp=ex;return v}
function carHint(s,id){const c=CAR[id],nm=M('car.'+id);
 if(c.tr)return M('car.h.train',{n:c.tr.y});
 if(c.pen)return M('car.h.gov',{p:Math.round(c.pen*100)});
 if(c.f==='office')return M('car.h.office',{x:c.auto?M('car.h.auto'):''});
 if(id==='farm')return M('car.h.farm');
 if(c.f==='hands')return M('car.h.hands',{x:c.auto?M('car.h.auto'):''});
 if(c.f==='creative')return M('car.h.creative');
 if(c.end)return M('car.h.sport',{a:c.end[0]});
 if(id==='coach')return M('car.h.coach');
 if(id==='start')return M('car.h.start',{n:c.own.res});
 if(c.own)return M('car.h.own',{n:c.own.res});
 if(c.mkt)return M('car.h.trade');
 return M('car.h.comm',{x:M(id==='prop'?'car.h.prop':'car.h.ins')})}
function carNote(t){t.note=M('note.car',{a:MN(t.paid),n:t.yrs,f:t.fee?M('note.carF',{f:MN(t.fee)}):'',c:t.cap?M('note.carC',{c:MN(t.cap)}):''})}
function pickCareer(s,id){const c=CAR[id],r=evR(s,'carPick'),sf=sameFam(s,id);
 if(s.lastCar){s.exp*=sf?.5:.2;s.level=sf?Math.max(0,s.level-2):0;s.levelGrind=Math.min(s.levelGrind,s.level)}
 const j={id,start:s.age,tk:'car'+(s.carN=(s.carN||0)+1)};
 if(c.tr)j.train=s.age+c.tr.y;if(c.tiers)j.tier=drawTier(r,c);if(c.end)j.end=c.end[0]+Math.floor(r()*(c.end[1]-c.end[0]+1));
 if(c.own){j.own=1;j.res=s.age+c.own.res}if(id==='prop')j.hm0=s.hm;
 s.job=j;s.needJob=false;s.swAt=s.age+6+Math.floor(r()*5);s.swWhy=null;
 const t=T(s,j.tk,{kind:'custom',label:M('trk.carNow',{x:M('car.'+id),a:s.age}),paid:0,fee:0,cap:0,yrs:0});
 if(c.req.cap){const k=c.req.cap*s.base;pay(s,k);t.v-=k;t.cap=k}carNote(t)}
/* a career ends: you quit (to = the last year you worked), it was automated, a playing career ran out, an injury, a failed business */
function endCareer(s,why,to){const j=s.job;if(!j)return;const t=s.trk[j.tk];if(t)t.label=M('trk.car',{x:M('car.'+j.id),a:j.start,b:Math.max(j.start,to==null?s.age:to)});
 s.lastCar=j.id;s.job=null;s.needJob=true;s.swWhy=null;delete s.done.job;if(why==='auto')s.carGone[j.id]=1}
/* after a layoff or an injury, a "switch career?" card comes up next year */
function offerSwitch(s,why){if(!s.job)return;s.swAt=s.age+1;s.swWhy=why;delete s.done.switch}
/* the start of a working year: training fees, a creative or sporting career rising or fading, commission and harvest luck */
function careerStart(s,yr,L){const j=s.job,c=CAR[j.id],a=s.age,r=evR(s,'carYr'),nm=M('car.a.'+j.id);
 if(j.train>a){const f=c.tr.fee*s.base;pay(s,f);const t=s.trk[j.tk];if(t){t.v-=f;t.fee+=f;carNote(t)}return}
 if(j.train===a)L&&L(M('log.car.trained',{x:nm}),'good');
 if(c.tiers){if(!j.seen){j.seen=1;if(j.tier>=c.tiers[2][1])L&&L(M('log.car.up',{x:nm}),'good')}
  else if((a-j.start)%4===0&&r()<.4){const o=j.tier;j.tier=drawTier(r,c);if(j.tier!==o)L&&L(M(j.tier>o?'log.car.up':'log.car.down',{x:nm}),j.tier>o?'good':'bad')}}
 if(c.vol)j.yv=Math.exp(c.vol*gauss(r)-c.vol*c.vol/2)*(j.id==='prop'?clamp(s.hm/j.hm0,.5,2):j.id==='ins'?1+(s.rel-50)/150:1);
 if(c.mkt)j.yv=.45+5*(yr.mkt-.05)+.3*gauss(r);
 if(j.ok&&c.own)j.own=Math.min(c.own.max,j.own*(1+c.own.grow))}
/* this year's pay goes into the career's passbook line */
function carPaid(s,w){const t=s.job&&s.trk[s.job.tk];if(!t)return;t.v+=w;t.paid+=w;t.yrs++;carNote(t)}
/* the end of a working year: injuries, automation, a playing career running out, a business that works or fails */
function careerEnd(s,L){const j=s.job,c=CAR[j.id],a=s.age,r=evR(s,'carEnd'),nm=M('car.a.'+j.id),t=s.trk[j.tk];if(j.train>a)return;
 if(c.inj&&r()<c.inj*(1+Math.max(0,60-s.health)/80)){const sp=!!c.end,lost=.25*Math.max(0,salary(s));
  s.health=clamp(s.health-(sp?12:8),3,100);s.happy=clamp(s.happy-4,0,100);pay(s,lost);
  const ti=T(s,'inj',{kind:'custom',label:M('trk.inj'),lost:0});ti.lost+=lost;ti.v-=lost;ti.note=M('note.inj',{a:MN(ti.lost)});
  if(sp&&r()<.35){L&&L(M('log.car.injEnd',{x:nm}),'bad');endCareer(s,'inj');return}
  L&&L(M('log.car.inj'),'bad');offerSwitch(s,'inj')}
 if(c.auto&&a>=45&&r()<c.auto){const sev=.5*salary(s);s.cash+=sev;s.earned+=sev;if(t){t.v+=sev;t.paid+=sev;carNote(t)}L&&L(M('log.car.auto',{x:nm,a:MN(sev)}),'bad');endCareer(s,'auto');return}
 if(j.end&&a+1>=j.end){L&&L(M('log.car.age',{x:nm}),'');endCareer(s,'age');return}
 if(c.own&&!j.done&&a+1>=j.res){j.done=1;const u=r();
  if(j.id==='start'&&u<.08){const v=12*s.base*(1+skill(s)/60);s.cash+=v;s.earned+=v;if(t){t.v+=v;t.paid+=v;carNote(t)}L&&L(M('log.car.exit',{a:MN(v)}),'good');endCareer(s,'exit');return}
  if(u<c.own.fail){L&&L(M('log.car.fail',{x:nm}),'bad');endCareer(s,'fail');return}
  j.ok=true;if(j.id==='start')j.own=5;L&&L(M('log.car.ok',{x:nm}),'good')}}

/* ---------- serious illness and depression ----------
   Game rules, not published data. A serious illness (heart attack, stroke or cancer) can strike once a life: the yearly
   chance is small while Health is 50 or more, rises below 50 and climbs fast below 30, and grows with age and years of
   overwork (grind, and hustle at half weight). Survival depends on the treatment, Health, age, past screening and the
   country's life expectancy (a stand-in for its hospitals). Survivors lose some months of pay and can't build Health
   for a few years. Depression can follow two years in a row with Happiness under 35; while it lasts it cuts pay by 30%,
   makes promotions rarer, slowly lowers Health and halves what your focus does. */
const ILLT={best:{c:2.5,m:3,h:10,y:2,p:.9},std:{c:.6,m:5,h:15,y:3,p:.8},skip:{c:0,m:7,h:22,y:4,p:.35}};
function illP(s){const h=s.health,hp=h>=50?.002+(100-h)*.00004:h>=30?.004+(50-h)*.001:.024+(30-h)*.004;
 return hp*clamp(.25+(s.age-30)*.03,.25,2.5)*(1+.03*Math.min(25,s.grindY+.5*s.hustleYears))}
function survP(s,k){const ci=s.abroad!=null?s.abroad:s.ci;return clamp(ILLT[k].p+(s.health-50)*.005+(C[ci][4]-75)*.008-Math.max(0,s.age-60)*.006+(s.screen?.05:0),.05,.97)}
const illYou=(s,k)=>ILLT[k].c*s.base*(s.insured?.15:1);
const illNote=t=>M('note.ill',{a:MN(t.paid),b:MN(t.lost)});
function treat(s,k){const b=ILLT[k].c*s.base,you=illYou(s,k);pay(s,you);
 if(s.insured&&b>0){const t=s.trk.ins;if(t){t.saved+=b-you;t.v+=b-you;t.note=insNote(t)}}
 const t=T(s,'ill',{kind:'custom',label:M('trk.ill.'+s.illType),paid:0,lost:0});t.v-=you;t.paid+=you;t.note=illNote(t);
 later(s,s.age,'ill',{tr:k,p:survP(s,k),you})}
const sick=s=>!!s.ill&&!s.ill.over&&s.age<s.ill.until;
const depressed=s=>!!s.dep&&!s.dep.over&&s.age<s.dep.until;
const depFee=s=>.08*s.base*(s.insured?.5:1);
const depNote=t=>M('note.dep',{a:MN(t.lost),b:MN(t.paid)});
function depStart(s,how,yrs){s.dep={how,at:s.age,until:s.age+yrs};T(s,'dep',{kind:'custom',label:M('trk.dep'),lost:0,paid:0,note:depNote({lost:0,paid:0})})}

/* ---------- events ----------
   win: age window (fixed age when both ends match); p: chance it is in this life; only: birth condition;
   when: condition at the time. Events without win are triggered by the situation (first job, a crash, debt). */
const EV=[
/* childhood */
{id:'hobby',win:[6,8],p:.9,title:M('e.hobby.t'),def:'none',
 text:s=>M('e.hobby.x'),
 opts:s=>{const a=.05*s.base,no=s.fam==='poor'?M('e.hobby.no'):true;return[
  Hn(O('music','e.hobby.music',M('e.hobby.music.s',{a:MN(a)}),s=>{addSkill(s,'child',2,M('trk.child'));s.happy+=2},no),M('e.hobby.music.h')),
  Hn(O('sport','e.hobby.sport',M('e.hobby.sport.s',{a:MN(.6*a)}),s=>{s.health+=5;s.happy+=3}),M('e.hobby.sport.h')),
  Hn(O('code','e.hobby.code',M('e.hobby.code.s',{a:MN(.8*a)}),s=>addSkill(s,'child',3,M('trk.child')),no),M('e.hobby.code.h')),
  O('none','e.hobby.none',M('e.hobby.none.s'),s=>{})]}},
{id:'allow',win:[7,9],p:.85,title:M('e.allow.t'),def:'spend',
 text:s=>M('e.allow.x',{a:MN(.006*s.base)}),
 opts:s=>{const a=.012*s.base;return[
  Hn(O('spend','e.allow.spend',M('e.allow.spend.s'),s=>{s.happy+=2;s.habit+=.02;T(s,'habit',{kind:'custom',label:M('trk.habitSpend')})}),M('e.allow.spend.h')),
  Hn(O('jar','e.allow.jar',M('e.allow.jar.s'),s=>{s.cash+=a;s.habit-=.02;T(s,'habit',{kind:'custom',label:M('trk.habitSave')})}),M('e.allow.jar.h')),
  Hn(O('bank','e.allow.bank',M('e.allow.bank.s'),s=>{mkLot(s,'kidbank',{rate:.005},'trk.kidbank');addLot(s,'kidbank',a);s.habit-=.03;T(s,'habit',{kind:'custom',label:M('trk.habitSave')})}),M('e.allow.bank.h'))]}},
{id:'tuition',win:[9,11],p:.85,title:M('e.tuition.t'),def:'play',
 text:s=>M('e.tuition.x',{a:MN(.08*s.base)}),
 opts:s=>[
  Hn(O('yes','e.tuition.yes',M('e.tuition.yes.s'),s=>{addSkill(s,'child',4,M('trk.child'));s.happy-=3},s.fam==='poor'?M('e.tuition.no'):true),M('e.tuition.yes.h')),
  Hn(O('free','e.tuition.free',M('e.tuition.free.s'),s=>addSkill(s,'child',2,M('trk.child'))),M('e.tuition.free.h')),
  O('play','e.tuition.play',M('e.tuition.play.s'),s=>{s.happy+=2})]},
{id:'phone1',win:[10,11],p:.8,title:M('e.phone1.t'),def:'basic',
 text:s=>M('e.phone1.x'),
 opts:s=>[
  Hn(O('top','e.phone1.top',M('e.phone1.top.s',{a:MN(.04*s.base)}),s=>{s.happy+=3;s.skillSrc.base=Math.max(0,s.skillSrc.base-1.5)},s.fam==='poor'||s.fam==='working'?M('e.phone1.no'):true),M('e.phone1.top.h')),
  O('basic','e.phone1.basic',M('e.phone1.basic.s',{a:MN(.01*s.base)}),s=>{s.happy+=1}),
  Hn(O('wait','e.phone1.wait',M('e.phone1.wait.s'),s=>{s.happy-=2;addSkill(s,'child',1,M('trk.child'))}),M('e.phone1.wait.h'))]},
{id:'pocket',win:[12,12],title:M('e.pocket.t'),def:'spend',
 text:s=>M('e.pocket.x',{a:MN(.02*s.base)}),
 opts:s=>{const a=.02*s.base;return[
  O('spend','e.pocket.spend',M('e.pocket.spend.s'),s=>{s.happy+=3;const t=T(s,'pocket',{kind:'ghost',label:M('trk.pocketSpent')});t.spent+=a;t.g+=a}),
  O('jar','e.pocket.jar',M('e.pocket.jar.s'),s=>{s.cash+=a}),
  O('fund','e.pocket.fund',M('e.pocket.fund.s'),s=>{addLot(s,'pocket',a);T(s,'lot_pocket',{kind:'lot',src:'pocket',label:M('trk.pocketInv')})})]}},
{id:'loot',win:[13,14],p:.8,title:M('e.loot.t'),def:'skip',
 text:s=>M('e.loot.x'),
 opts:s=>{const a=.01*s.base;return[
  O('buy','e.loot.buy',M('e.loot.buy.s',{a:MN(a)}),s=>{s.happy+=1;const t=T(s,'loot',{kind:'ghost',label:M('trk.loot')});t.spent+=a;t.g+=a}),
  O('skip','e.loot.skip',M('e.loot.skip.s'),s=>{})]}},
{id:'teen',win:[13,15],p:.8,title:M('e.teen.t'),def:'school',
 text:s=>M('e.teen.x'),
 opts:s=>[
  Hn(O('tutor','e.teen.tutor',M('e.teen.tutor.s',{a:MN(.04*s.base)}),s=>{s.cash+=.04*s.base;s.earned+=.04*s.base;addSkill(s,'child',1,M('trk.child'))}),M('e.teen.tutor.h')),
  O('sell','e.teen.sell',M('e.teen.sell.s'),s=>later(s,s.age+1,'sell')),
  Hn(O('school','e.teen.school',M('e.teen.school.s'),s=>addSkill(s,'child',1.5,M('trk.child'))),M('e.teen.school.h'))]},
{id:'summer',win:[16,16],title:M('e.summer.t'),def:'chill',
 text:s=>M('e.summer.x'),
 opts:s=>[
  Hn(O('job','e.summer.job',M('e.summer.job.s',{a:MN(.12*s.base)}),s=>{s.cash+=.12*s.base;s.earned+=.12*s.base;addSkill(s,'base',1)}),M('e.summer.job.h')),
  Hn(O('exam','e.summer.exam',M('e.summer.exam.s',{sk:Math.round(skill(s))}),s=>addSkill(s,'school',5,M('trk.school'))),M('e.summer.exam.h')),
  O('chill','e.summer.chill',M('e.summer.chill.s'),s=>{s.happy+=4})]},
/* starting out */
{id:'edu',win:[18,18],title:M('e.edu.t'),def:'work',
 text:s=>{const sk=skill(s);return M('e.edu.x',{sk:Math.round(sk),sch:sk>=26?M('e.edu.sch'):'',fam:M(s.fam==='rich'?'e.edu.rich':s.fam==='middle'?'e.edu.middle':'e.edu.none')})},
 opts:s=>{const sk=skill(s),cu=eduCost(s,'uni'),cd=eduCost(s,'dip');const eu=Math.round(26*(1-(sk+13)/120)),ed=Math.round(12*(1-(sk+6)/120));return[
  Hn(O('uni','e.edu.uni',M('e.edu.uni.s',{c:MN(cu),loan:cu>Math.max(0,s.cash)+1?M('e.edu.loan'):''}),s=>startStudy(s,'uni')),M('e.edu.uni.h',{e:eu,p:Math.round(eu*SK*100)})),
  Hn(O('dip','e.edu.dip',M('e.edu.dip.s',{c:MN(cd)}),s=>startStudy(s,'dip')),M('e.edu.dip.h',{e:ed,p:Math.round(ed*SK*100)})),
  O('work','e.edu.work',M('e.edu.work.s'),s=>{})]}},
/* choosing a career: every career, grouped by family (grp), locked ones show why. It comes back whenever a career ends */
{id:'job',when:s=>s.needJob&&s.age>=18&&s.age<64&&!!s.done.edu&&!s.study&&!s.job&&!s.retired,title:M('e.job.t'),def:'civ',
 text:s=>M(s.lastCar?'e.job.x2':'e.job.x'),
 opts:s=>Object.keys(CAR).map(id=>{const c=CAR[id],a=MN(carStartPay(s,id));
  const sub=c.tr?M('car.s.tr',{n:c.tr.y,p:MN(c.tr.pay*s.base),f:MN(c.tr.fee*s.base),a}):c.req.cap?M('car.s.cap',{c:MN(c.req.cap*s.base),a}):M('car.s',{a});
  const o=Hn(O(id,'car.'+id,sub,s=>pickCareer(s,id),carLock(s,id)),carHint(s,id));o.grp=c.f;return o})},
/* every so often, and the year after a layoff or an injury: stay, or choose a new career */
{id:'switch',when:s=>job(s)&&s.swAt!=null&&s.age>=s.swAt&&s.age<62&&!(s.job.train>s.age),title:M('e.switch.t'),def:'stay',
 again:s=>{delete s.done.switch;s.swWhy=null;if(s.job)s.swAt=s.age+6+Math.floor(evR(s,'swAt')()*5)},
 text:s=>M('e.switch.x'+(s.swWhy?'.'+s.swWhy:''),{x:M('car.a.'+s.job.id),n:s.age-s.job.start}),hint:s=>M('e.switch.h'),
 opts:s=>[
  O('stay','e.switch.stay',M('e.switch.stay.s'),s=>{}),
  O('go','e.switch.go',M('e.switch.go.s'),s=>endCareer(s,'quit',s.age-1))]},
{id:'save',when:s=>!!s.job&&!s.done.save,title:M('e.save.t'),def:'0',
 text:s=>M('e.save.x'),
 opts:s=>{const net=netOf(s,salary(s));return [0,.1,.2,.3].map(p=>{const pc=Math.round(p*100);return p?{id:String(pc),label:M('e.save.p',{p:pc}),sub:M('e.save.p.s',{a:MN(net*p)}),go:s=>setSave(s,p)}:{id:'0',label:M('e.save.0'),sub:M('e.save.0.s'),go:s=>setSave(s,0)}})}},
{id:'cc',win:[19,21],p:.8,when:s=>!s.retired,title:M('e.cc.t'),def:'full',
 text:s=>M('e.cc.x',{a:MN(.3*s.base)}),
 opts:s=>{const a=.2*s.base;return[
  O('full','e.cc.full',M('e.cc.full.s'),s=>{}),
  O('min','e.cc.min',M('e.cc.min.s',{a:MN(a)}),s=>{s.debt+=a;s.happy+=3;const t=T(s,'cc',{kind:'ghost',label:M('trk.cc')});t.spent+=a;t.g+=a}),
  O('no','e.cc.no',M('e.cc.no.s'),s=>{})]}},
{id:'move',win:[19,23],p:.85,when:s=>!s.house,title:M('e.move.t'),def:'alone',
 text:s=>M('e.move.x',{r:MN(rent(s))}),
 opts:s=>{const r=rent(s),set=(m,h,lk)=>s=>{s.rentMul=m;s.rentUntil=s.age+7;s.happy+=h;T(s,'move',{kind:'custom',label:M(lk),note:M('note.move')})};return[
  O('alone','e.move.alone',M('e.move.alone.s',{r:MN(r)}),s=>{}),
  O('share','e.move.share',M('e.move.share.s',{r:MN(.55*r)}),set(.55,0,'trk.moveShare')),
  O('home','e.move.home',M('e.move.home.s',{r:MN(.2*r)}),set(.2,-4,'trk.moveHome'))]}},
{id:'scheme',win:[19,30],only:s=>!!SCH[C[s.ci][1]],when:job,title:M('e.scheme.t'),def:'0',
 text:s=>M('e.scheme.x.'+C[s.ci][1]),
 opts:s=>{const k=C[s.ci][1],sc=SCH[k],sal=salary(s);return sc.ps.map(p=>{const pc=Math.round(p*100),c=p*sal;
  return p?{id:String(pc),label:M('e.scheme.p',{p:pc}),sub:M('e.scheme.s.'+k,{a:MN(c),m:MN(k==='US'?Math.min(p,sc.match)*sal:sc.rel*c)}),go:s=>{s.scheme={p,match:sc.match,rel:sc.rel,lot:sc.lot};mkLot(s,sc.lot,{rate:sc.rate},sc.lk)}}
   :{id:'0',label:M('e.scheme.0'),sub:M('e.scheme.0.s.'+k),go:s=>{}}})}},
{id:'bnpl',win:[19,25],p:.7,title:M('e.bnpl.t'),def:'save',
 text:s=>M('e.bnpl.x',{a:MN(.08*s.base)}),
 opts:s=>{const a=.08*s.base;return[
  Hn(O('now','e.bnpl.now',M('e.bnpl.now.s',{a:MN(a/4)}),s=>{spend(s,'bnpl',a,'trk.bnpl');s.happy+=3;later(s,s.age+1,'late',{a:.25*a})}),M('e.bnpl.now.h')),
  O('save','e.bnpl.save',M('e.bnpl.save.s'),s=>{spend(s,'bnpl',a,'trk.bnplSave');s.happy+=1}),
  O('skip','e.bnpl.skip',M('e.bnpl.skip.s'),s=>{})]}},
{id:'efund',win:[21,28],p:.8,when:job,title:M('e.efund.t'),def:'skip',
 text:s=>M('e.efund.x',{a:MN(efTarget(s))}),
 opts:s=>[
  O('build','e.efund.build',M('e.efund.build.s',{a:MN(efTarget(s))}),s=>{s.efund=efTarget(s);T(s,'efund',{kind:'custom',label:M('trk.efund'),note:M('note.efund0')});emerg(s)}),
  O('skip','e.efund.skip',M('e.efund.skip.s'),s=>emerg(s))]},
{id:'nego',win:[22,29],p:.85,when:job,title:M('e.nego.t'),def:'accept',
 text:s=>M('e.nego.x',{a:MN(salary(s))}),hint:s=>M('e.nego.h',{p:Math.round(negoP(s)*100)}),
 opts:s=>[
  O('ask','e.nego.ask',M('e.nego.ask.s',{a:MN(.1*salary(s))}),s=>later(s,s.age,'nego',{p:negoP(s),m:1.1,lk:'trk.nego'})),
  O('shop','e.nego.shop',M('e.nego.shop.s'),s=>later(s,s.age,'nego',{p:.9*negoP(s),m:1.15,lv:1,lk:'trk.negoMove'})),
  O('accept','e.nego.accept',M('e.nego.accept.s'),s=>{})]},
{id:'holiday',win:[22,32],p:.7,title:M('e.holiday.t'),def:'local',
 text:s=>M('e.holiday.x'),
 opts:s=>[
  O('big','e.holiday.big',M('e.holiday.big.s',{a:MN(.12*s.base)}),s=>{spend(s,'holiday',.12*s.base,'trk.holiday');s.happy+=4}),
  O('local','e.holiday.local',M('e.holiday.local.s',{a:MN(.03*s.base)}),s=>{spend(s,'holiday',.03*s.base,'trk.holidayS');s.happy+=2}),
  O('skip','e.holiday.skip',M('e.holiday.skip.s'),s=>{})]},
{id:'insure',win:[24,24],title:M('e.insure.t'),def:'no',
 text:s=>M('e.insure.x',{a:MN(.035*s.base)}),
 opts:s=>[
  O('yes','e.insure.yes',M('e.insure.yes.s'),s=>{s.insured=true;T(s,'ins',{kind:'custom',label:M('trk.ins'),prem:0,saved:0,note:M('note.ins0')})}),
  O('no','e.insure.no',M('e.insure.no.s'),s=>{})]},
{id:'lend',win:[24,42],p:.75,when:s=>liquid(s)>.15*s.base,title:M('e.lend.t'),def:'no',
 text:s=>M('e.lend.x',{a:MN(Math.min(.3*s.base,.5*liquid(s)))}),hint:s=>M('e.lend.h'),
 opts:s=>{const a=Math.min(.3*s.base,.5*liquid(s)),go=(x,lk)=>s=>{pay(s,x);T(s,'lend',{kind:'custom',label:M(lk),v:-x,note:M('note.lend0',{a:MN(x)})});const r=evR(s,'lendAt')();later(s,s.age+2+Math.floor(r*4),'repay',{a:x,id:'lend'})};return[
  OR('all','e.lend.all',M('e.lend.all.s'),4,go(a,'trk.lend')),
  OR('half','e.lend.half',M('e.lend.half.s',{a:MN(a/2)}),2,go(a/2,'trk.lendHalf')),
  OR('no','e.lend.no',M('e.lend.no.s'),-4,s=>{s.happy-=3})]}},
{id:'car',win:[25,25],when:s=>!s.retired,title:M('e.car.t'),def:'used',
 text:s=>M('e.car.x'),
 opts:s=>{const B=s.base;return[
  O('new','e.car.new',M('e.car.new.s',{c:MN(1.1*B),p:MN(carPay(1.1*B))}),s=>{s.car={type:'new',bal:1.1*B,pay:carPay(1.1*B)};s.happy+=4;T(s,'car',{kind:'ghost',label:M('trk.carNew')})}),
  O('used','e.car.used',M('e.car.used.s',{c:MN(.35*B)}),s=>{s.car={type:'used',bal:0,pay:0};pay(s,.35*B);const t=T(s,'car',{kind:'ghost',label:M('trk.carUsed')});t.spent+=.35*B;t.g+=.35*B}),
  O('none','e.car.none',M('e.car.none.s'),s=>{s.car=null})]}},
{id:'gym',win:[26,36],p:.65,title:M('e.gym.t'),def:'none',
 text:s=>M('e.gym.x'),
 opts:s=>[
  Hn(O('gym','e.gym.gym',M('e.gym.gym.s',{a:MN(.025*s.base)}),s=>{T(s,'gym',{kind:'ghost',label:M('trk.gym')});rec(s,'gym',.025*s.base,10,.8)}),M('e.gym.gym.h')),
  Hn(O('run','e.gym.run',M('e.gym.run.s'),s=>{rec(s,'',0,10,.5);s.happy+=1}),M('e.gym.run.h')),
  O('none','e.gym.none',M('e.gym.none.s'),s=>{})]},
{id:'mlm',win:[26,38],p:.6,title:M('e.mlm.t'),def:'no',
 text:s=>M('e.mlm.x',{a:MN(.12*s.base)}),
 opts:s=>[
  OR('join','e.mlm.join',M('e.mlm.join.s',{a:MN(.12*s.base),b:MN(.04*s.base)}),-6,s=>{pay(s,.12*s.base);T(s,'mlm',{kind:'custom',label:M('trk.mlm'),v:-.12*s.base,note:M('note.paid',{a:MN(.12*s.base)})});rec(s,'mlm',.04*s.base,3);later(s,s.age+3,'mlm')},undefined,M('e.mlm.join.h')),
  O('buy','e.mlm.buy',M('e.mlm.buy.s',{a:MN(.015*s.base)}),s=>spend(s,'mlm',.015*s.base,'trk.mlmBuy')),
  O('no','e.mlm.no',M('e.mlm.no.s'),s=>{})]},
{id:'abroad',win:[26,35],p:.45,when:job,title:M('e.abroad.t'),def:'stay',
 text:s=>M('e.abroad.x',{c:{k:'_c',ci:abroadTo(s)}}),
 opts:s=>{const di=abroadTo(s),ratio=C[di][3]/s.base,m=clamp(.8*ratio,1.3,3),cm=clamp(.7*ratio,1.2,2.6),sal=salary(s);return[
  O('go',M('e.abroad.go',{c:{k:'_c',ci:di}}),M('e.abroad.go.s',{c:{k:'_c',ci:di},a:MN(m*sal),b:MN(sal),p:Math.round((cm-1)*100),m:MN(.2*s.base)}),s=>{pay(s,.2*s.base);s.abroad=di;s.costMul=cm;s.happy-=4;bump(s,'abroad',m,M('trk.abroad',{c:{k:'_c',ci:di}}))}),
  O('stay','e.abroad.stay',M('e.abroad.stay.s'),s=>{})]}},
{id:'phone',win:[26,38],p:.7,title:M('e.phone.t'),def:'mid',
 text:s=>M('e.phone.x'),
 opts:s=>[
  O('top','e.phone.top',M('e.phone.top.s',{a:MN(.05*s.base)}),s=>{spend(s,'phone',.05*s.base,'trk.phoneTop');s.happy+=2}),
  O('mid','e.phone.mid',M('e.phone.mid.s',{a:MN(.015*s.base)}),s=>spend(s,'phone',.015*s.base,'trk.phoneMid')),
  O('keep','e.phone.keep',M('e.phone.keep.s'),s=>{})]},
{id:'tip',win:[27,27],title:M('e.tip.t'),def:'skip',
 text:s=>M('e.tip.x'),
 opts:s=>{const liq=liquid(s),no=liq>.05*s.base||M('e.tip.no');return[
  O('big','e.tip.big',M('e.tip.big.s',{a:MN(.4*liq)}),s=>bet(s,.4),no),
  O('small','e.tip.small',M('e.tip.small.s',{a:MN(.05*liq)}),s=>bet(s,.05),no),
  O('skip','e.tip.skip',M('e.tip.skip.s'),s=>{})]}},
{id:'pet',win:[27,42],p:.55,title:M('e.pet.t'),def:'no',
 text:s=>M('e.pet.x'),
 opts:s=>[
  O('yes','e.pet.yes',M('e.pet.yes.s',{a:MN(.03*s.base)}),s=>{T(s,'pet',{kind:'ghost',label:M('trk.pet')});rec(s,'pet',.03*s.base,12);s.happy+=5}),
  O('no','e.pet.no',M('e.pet.no.s'),s=>{})]},
{id:'scam',win:[28,50],p:.55,when:s=>liquid(s)>.1*s.base,title:M('e.scam.t'),def:'no',
 text:s=>M('e.scam.x'),
 opts:s=>{const a=Math.min(.15*s.base,.3*liquid(s));return[
  Hn(O('try',M('e.scam.try',{a:MN(a)}),M('e.scam.try.s'),s=>{pay(s,a);T(s,'scam',{kind:'custom',label:M('trk.scam'),v:-a,note:M('note.scamIn',{a:MN(a)})});later(s,s.age+1,'scam',{a,id:'scam'})}),M('e.scam.try.h')),
  O('no','e.scam.no',M('e.scam.no.s'),s=>{})]}},
{id:'bonus',win:[28,46],p:.65,when:job,title:M('e.bonus.t'),def:'bank',
 text:s=>M('e.bonus.x',{a:MN(.3*salary(s))}),
 opts:s=>{const a=.3*salary(s),get=s=>{s.cash+=a;s.earned+=a};return[
  O('inv','e.bonus.inv',M('e.bonus.inv.s'),s=>{get(s);s.cash-=a;addLot(s,'bonus',a);T(s,'lot_bonus',{kind:'lot',src:'bonus',label:M('trk.bonusInv')})}),
  O('treat','e.bonus.treat',M('e.bonus.treat.s'),s=>{get(s);spend(s,'bonus',a,'trk.bonusTreat');s.happy+=4}),
  O('bank','e.bonus.bank',M('e.bonus.bank.s'),get)]}},
{id:'cert',win:[29,29],when:s=>!!s.job&&!s.retired,title:M('e.cert.t'),def:'no',
 text:s=>M('e.cert.x'),
 opts:s=>[
  Hn(O('mba','e.cert.mba',M('e.cert.mba.s',{a:MN(s.base)}),s=>startCert(s,'mba')),M('e.cert.mba.h')),
  Hn(O('cert','e.cert.cert',M('e.cert.cert.s',{a:MN(.3*s.base)}),s=>startCert(s,'cert')),M('e.cert.cert.h')),
  O('no','e.cert.no',M('e.cert.no.s'),s=>{})]},
{id:'agent',win:[29,42],p:.6,when:job,title:M('e.agent.t'),def:'no',
 text:s=>M('e.agent.x',{a:MN(.08*s.base)}),
 opts:s=>[
  Hn(O('ilp','e.agent.ilp',M('e.agent.ilp.s',{a:MN(.08*s.base)}),s=>{s.ilp={amt:.08*s.base,until:s.age+20};mkLot(s,'ilp',{fee:.025},'trk.ilp')}),M('e.agent.ilp.h')),
  O('term','e.agent.term',M('e.agent.term.s',{a:MN(.012*s.base)}),s=>{T(s,'term',{kind:'custom',label:M('trk.term')});rec(s,'term',.012*s.base,25)}),
  O('no','e.agent.no',M('e.agent.no.s'),s=>{})]},
{id:'wed',win:[30,30],when:s=>s.marryRoll<.4+.0065*s.rel,title:M('e.wed.t'),def:'modest',
 text:s=>M('e.wed.x'),
 opts:s=>{const B=s.base;return[
  O('big','e.wed.big',M('e.wed.big.s',{a:MN(1.6*B)}),s=>wed(s,1.6,'trk.wedBig')),
  O('modest','e.wed.modest',M('e.wed.modest.s',{a:MN(.4*B)}),s=>wed(s,.4,'trk.wedModest')),
  O('reg','e.wed.reg',M('e.wed.reg.s',{a:MN(.05*B)}),s=>wed(s,.05,'trk.wedReg'))]}},
{id:'gold',win:[30,46],p:.65,when:s=>liquid(s)>.3*s.base,title:M('e.gold.t'),def:'fd',
 text:s=>M('e.gold.x',{a:MN(.3*liquid(s))}),
 opts:s=>{const a=.3*liquid(s),go=parts=>s=>{pay(s,a);for(const[k,f,props,lk]of parts){mkLot(s,k,props,lk);addLot(s,k,a*f)}};return[
  O('index','e.gold.index',M('e.gold.index.s'),go([['pick',1,{},'trk.pick']])),
  O('gold','e.gold.gold',M('e.gold.gold.s'),go([['gold',1,{t:'gold'},'trk.gold']])),
  O('fd','e.gold.fd',M('e.gold.fd.s'),go([['fd',1,{rate:.005},'trk.fd']])),
  O('split','e.gold.split',M('e.gold.split.s'),go([['pick',1/3,{},'trk.pick'],['gold',1/3,{t:'gold'},'trk.gold'],['fd',1/3,{rate:.005},'trk.fd']]))]}},
{id:'health',win:[30,42],p:.55,title:M('e.health.t'),def:'no',
 text:s=>M('e.health.x',{a:MN(.02*s.base)}),
 opts:s=>[
  Hn(O('yes','e.health.yes',M('e.health.yes.s',{a:MN(.02*s.base)}),s=>{pay(s,.02*s.base);s.screen=true;s.health+=2}),M('e.health.yes.h')),
  O('no','e.health.no',M('e.health.no.s'),s=>{})]},
{id:'home',win:[31,31],when:s=>!s.house&&!!s.job&&!s.retired,title:M('e.home.t'),def:'rent',
 text:s=>M('e.home.x',{p:MN(price(s))}),
 opts:s=>{const P=price(s),liq=liquid(s);return[
  O('buy','e.home.buy',M('e.home.buy.s',{d:MN(.23*P),m:MN(mPay(.8*P))}),s=>buy(s,P),liq>=.23*P||M('e.home.need',{n:MN(.23*P),h:MN(liq)})),
  O('small','e.home.small',M('e.home.small.s',{d:MN(.138*P),m:MN(mPay(.48*P))}),s=>buy(s,.6*P),liq>=.138*P||M('e.home.need',{n:MN(.138*P),h:MN(liq)})),
  O('rent','e.home.rent',M('e.home.rent.s',{r:MN(rent(s))}),s=>{})]}},
{id:'rates',win:[32,52],p:.8,when:s=>!!s.house&&s.house.mort>.2*s.house.value,title:M('e.rates.t'),def:'ride',
 text:s=>{const h=s.house,n=Math.max(1,(h.end||s.age+20)-s.age);return M('e.rates.x',{a:MN(h.pay),b:MN(amort(h.mort,.065,n))})},
 opts:s=>{const h=s.house,x=Math.min(.3*h.mort,.5*liquid(s)),ride=s=>{setRate(s.house,.065,s.age);T(s,'rates',{kind:'custom',label:M('trk.rates'),note:M('note.rates')});later(s,s.age+2+Math.floor(evR(s,'rateLen')()*4),'rate')};return[
  O('fix','e.rates.fix',M('e.rates.fix.s',{a:MN(.01*h.mort)}),s=>{pay(s,.01*s.house.mort);setRate(s.house,.05,s.age);T(s,'rates',{kind:'custom',label:M('trk.ratesFix'),v:-.01*s.house.mort,note:M('note.rates')});later(s,s.age+5,'rate')}),
  O('pay','e.rates.pay',M('e.rates.pay.s',{a:MN(x)}),s=>{pay(s,x);s.house.mort-=x;s.house.out+=x;ride(s)},x>.05*h.mort||M('e.rates.payNo')),
  O('ride','e.rates.ride',M('e.rates.ride.s'),ride)]}},
{id:'kids',win:[33,33],when:s=>s.married,title:M('e.kids.t'),def:'k0',mirror:true,
 text:s=>M('e.kids.x',{a:MN(.15*s.base)}),hint:s=>s.sex==='f'&&CHILDPEN[workCode(s)]>0?M('e.kids.h',{p:CHILDPEN[workCode(s)]}):null,
 opts:s=>[0,1,2,3].map(n=>({id:'k'+n,label:n?M('e.kids.n',{n}):M('e.kids.0'),sub:n?M('e.kids.n.s',{a:MN(n*.15*s.base),h:n*3}):M('e.kids.0.s'),go:s=>{for(let i=0;i<n;i++)s.kids.push(s.age+i*2);s.happy+=n*3;if(n)T(s,'kids',{kind:'custom',label:M('trk.kids',{n}),cost:0,note:M('note.kids0')})}}))},
{id:'edufund',win:[34,46],p:.85,when:s=>s.kids.length>0,title:M('e.edufund.t'),def:'later',
 text:s=>M('e.edufund.x',{a:MN(s.uni*s.base*.6)}),
 opts:s=>{const f=s.uni*s.base*.6,set=k=>s=>{s.kidEdu=k;s.kidFee=f;if(k==='fund')mkLot(s,'kidedu',{},'trk.kidedu')};return[
  O('fund','e.edufund.fund',M('e.edufund.fund.s',{a:MN(f/18)}),set('fund')),
  O('later','e.edufund.later',M('e.edufund.later.s'),set('later')),
  O('loan','e.edufund.loan',M('e.edufund.loan.s'),set('loan'))]}},
{id:'biz',win:[36,36],when:s=>!!s.job&&!s.retired&&!s.biz,title:M('e.biz.t'),def:'no',
 text:s=>M('e.biz.x'),hint:s=>M('e.biz.h',{p:Math.round(bizP(s)*100)}),
 opts:s=>{const B=s.base,liq=liquid(s);return[
  O('full','e.biz.full',M('e.biz.full.s',{a:MN(1.2*B)}),s=>startBiz(s,'full',1.2*B),liq>=1.2*B||M('e.biz.need',{n:MN(1.2*B),h:MN(liq)})),
  O('side','e.biz.side',M('e.biz.side.s',{a:MN(.25*B)}),s=>startBiz(s,'side',.25*B),liq>=.25*B||M('e.biz.need',{n:MN(.25*B),h:MN(liq)})),
  O('no','e.biz.no',M('e.biz.no.s'),s=>{})]}},
{id:'crash',when:s=>s.age===s.crashAge,title:M('e.crash.t'),def:'hold',
 pre:s=>{for(const k in s.lots)if(isMkt(s.lots[k]))s.lots[k].v*=.62;for(const k in s.trk)if(s.trk[k].kind==='ghost')s.trk[k].g*=.62;s.crashP=eqTot(s)},
 preLog:s=>M('log.crash',{x:s.crashP>1?M('log.crashX',{a:MN(s.crashP)}):''}),
 text:s=>s.crashP>1?M('e.crash.x',{a:MN(s.crashP)}):M('e.crash.x0'),
 opts:s=>{const P=s.crashP||0,a=Math.max(0,s.cash-.3*s.base)*.6;return[
  O('sell','e.crash.sell',M('e.crash.sell.s',{a:MN(P)}),s=>crashSell(s),P>1||M('e.crash.sell.no')),
  O('hold','e.crash.hold',M('e.crash.hold.s'),s=>crashTrack(s,'hold')),
  O('buy','e.crash.buy',M('e.crash.buy.s',{a:MN(a)}),s=>{s.cash-=a;addLot(s,'dip',a);T(s,'lot_dip',{kind:'lot',src:'dip',label:M('trk.dip')});crashTrack(s,'hold')},s.cash>.4*s.base||M('e.crash.buy.no'))]}},
{id:'layoff',win:[35,52],p:.55,when:s=>job(s)&&!(s.biz&&s.biz.mode==='full'&&s.biz.ok),title:M('e.layoff.t'),def:'stay',
 text:s=>M('e.layoff.x',{a:MN(salary(s))}),
 opts:s=>{const a=salary(s);return[
  O('take','e.layoff.take',M('e.layoff.take.s',{a:MN(a)}),s=>{s.cash+=a;s.earned+=a;s.layAt=s.age+1;s.layVol=true;s.level=Math.max(0,s.level-1);T(s,'layoff',{kind:'custom',label:M('trk.layoff'),v:a,note:M('note.layoff',{a:MN(a)})})}),
  Hn(O('stay','e.layoff.stay',M('e.layoff.stay.s'),s=>later(s,s.age+1+Math.floor(evR(s,'layAt')()*3),'lay',{p:.45})),M('e.layoff.stay.h'))]}},
{id:'bubble',win:[35,54],p:.6,title:M('e.bubble.t'),def:'hold',
 pre:s=>{s.hm*=1.3;if(s.house)s.house.value*=1.3;later(s,s.age+1+Math.floor(evR(s,'bubAt')()*4),'burst')},
 preLog:s=>M('log.boomUp'),
 text:s=>s.house?M('e.bubble.x',{a:MN(s.house.value)}):M('e.bubble.x0',{p:MN(price(s))}),
 opts:s=>{const P=price(s),liq=liquid(s);if(s.house){const h=s.house,net=h.value*.95-h.mort;return[
  O('sell','e.bubble.sell',M('e.bubble.sell.s',{a:MN(net)}),s=>{const h=s.house,v=h.value;s.cash+=v*.95-h.mort;const t=s.trk.home;if(t)t.note=M('note.homeSold',{a:MN(v)});s.house=null;T(s,'bubble',{kind:'custom',label:M('trk.bubbleSell'),ref:v,note:M('note.bubble0')})}),
  O('hold','e.bubble.hold',M('e.bubble.hold.s'),s=>{})]}
  return[
  O('buy','e.bubble.buy',M('e.home.buy.s',{d:MN(.23*P),m:MN(mPay(.8*P))}),s=>buy(s,P),liq>=.23*P||M('e.home.need',{n:MN(.23*P),h:MN(liq)})),
  O('hold','e.bubble.wait',M('e.bubble.wait.s'),s=>{})]}},
{id:'idle',win:[38,38],when:s=>s.cash>1.5*s.base&&!s.retired,title:M('e.idle.t'),def:'keep',
 text:s=>M('e.idle.x',{a:MN(s.cash)}),
 opts:s=>{const a=s.cash-.5*s.base;return[
  O('inv','e.idle.inv',M('e.idle.inv.s',{a:MN(a)}),s=>{s.cash-=a;addLot(s,'idle',a);T(s,'lot_idle',{kind:'lot',src:'idle',label:M('trk.idle')})}),
  O('keep','e.idle.keep',M('e.idle.keep.s'),s=>{})]}},
{id:'parents',win:[38,54],p:s=>s.fam==='poor'||s.fam==='working'?.85:s.fam==='middle'?.3:0,title:M('e.parents.t'),def:'send',
 text:s=>M('e.parents.x'),
 opts:s=>[
  OR('send','e.parents.send',M('e.parents.send.s',{a:MN(.1*s.base)}),5,s=>{T(s,'parents',{kind:'custom',label:M('trk.parents')});rec(s,'parents',.1*s.base,12)}),
  OR('move','e.parents.move',M('e.parents.move.s',{a:MN(.04*s.base)}),4,s=>{T(s,'parents',{kind:'custom',label:M('trk.parentsIn')});rec(s,'parents',.04*s.base,12);s.happy-=3}),
  OR('sib','e.parents.sib',M('e.parents.sib.s'),-3,s=>{s.happy-=5})]},
{id:'divorce',win:[37,52],p:.55,when:s=>s.married,title:M('e.divorce.t'),def:'ignore',
 text:s=>M('e.divorce.x'),
 opts:s=>{const at=s=>s.age+2+Math.floor(evR(s,'divAt')()*5);return[
  Hn(O('counsel','e.divorce.counsel',M('e.divorce.counsel.s',{a:MN(.08*s.base)}),s=>{pay(s,.08*s.base);T(s,'marriage',{kind:'custom',label:M('trk.counsel'),v:-.08*s.base,note:M('note.paid',{a:MN(.08*s.base)})});later(s,at(s),'div',{p:.08})}),M('e.divorce.counsel.h')),
  Hn(O('budget','e.divorce.budget',M('e.divorce.budget.s'),s=>later(s,at(s),'div',{p:.18})),M('e.divorce.budget.h')),
  Hn(O('ignore','e.divorce.ignore',M('e.divorce.ignore.s'),s=>later(s,at(s),'div',{p:.35})),M('e.divorce.ignore.h'))]}},
{id:'roof',win:[38,74],p:.65,when:s=>!!s.house,title:M('e.roof.t'),def:'patch',
 text:s=>M('e.roof.x'),
 opts:s=>[
  O('fix','e.roof.fix',M('e.roof.fix.s',{a:MN(.12*s.base)}),s=>spend(s,'roof',.12*s.base,'trk.roofFix')),
  Hn(O('patch','e.roof.patch',M('e.roof.patch.s',{a:MN(.02*s.base)}),s=>{spend(s,'roof',.02*s.base,'trk.roofPatch');later(s,s.age+2+Math.floor(evR(s,'roofAt')()*3),'roof')}),M('e.roof.patch.h'))]},
{id:'car2',win:[39,52],p:.6,when:s=>!!s.car&&!s.retired,title:M('e.car2.t'),def:'keep',
 text:s=>M('e.car2.x'),
 opts:s=>{const B=s.base;return[
  O('lux','e.car2.lux',M('e.car2.lux.s',{c:MN(1.6*B),p:MN(carPay(1.5*B))}),s=>{const old=s.car.bal||0;s.car={type:'new',bal:1.5*B+old,pay:carPay(1.5*B+old),trk:'car2'};s.happy+=3;T(s,'car2',{kind:'ghost',label:M('trk.car2Lux')})}),
  O('sens','e.car2.sens',M('e.car2.sens.s',{c:MN(.5*B)}),s=>{spend(s,'car2',.5*B,'trk.car2');s.car.trk='car2'}),
  O('keep','e.car2.keep',M('e.car2.keep.s'),s=>{})]}},
{id:'save2',win:[40,40],when:s=>!!s.job&&!s.retired,title:M('e.save2.t'),def:'keep',
 text:s=>M('e.save2.x',{p:Math.round(s.savePct*100)}),
 opts:s=>[{id:'keep',label:M('e.save2.keep',{p:Math.round(s.savePct*100)}),sub:M('e.save2.keep.s'),go:s=>{}}].concat([.1,.2,.3,.4].filter(p=>Math.abs(p-s.savePct)>.01).slice(0,3).map(p=>({id:'p'+Math.round(p*100),label:M('e.save2.p',{p:Math.round(p*100)}),sub:M('e.save2.p.s',{a:MN(netOf(s,s.lastSal)*p)}),go:s=>setSave(s,p)})))},
{id:'fire',win:[40,54],when:s=>job(s)&&netWorth(s)>=12*s.base,title:M('e.fire.t'),def:'keep',
 text:s=>M('e.fire.x',{a:MN(netWorth(s)),n:Math.round(netWorth(s)/(.6*s.base))}),
 opts:s=>[
  O('now','e.fire.now',M('e.fire.now.s'),s=>{s.retireAge=s.age}),
  O('part','e.fire.part',M('e.fire.part.s'),s=>{bump(s,'fire',.5,M('trk.fire'),'note.fire');rec(s,'',0,15,.6);s.happy+=4}),
  O('keep','e.fire.keep',M('e.fire.keep.s'),s=>{})]},
{id:'pivot',win:[43,43],when:s=>!!s.job&&!s.retired&&!(s.biz&&s.biz.mode==='full'&&s.biz.ok),title:M('e.pivot.t'),def:'stay',
 text:s=>M('e.pivot.x'),
 opts:s=>[
  Hn(O('re','e.pivot.re',M('e.pivot.re.s',{a:MN(.3*s.base)}),s=>{s.pivoted=true;s.pivotYear=s.age;pay(s,.3*s.base);const t=T(s,'sk_pivot',{kind:'skill',label:M('trk.pivot')});t.cost+=.3*s.base;addSkill(s,'pivot',10,M('trk.pivot'))}),M('e.pivot.re.h')),
  Hn(O('stay','e.pivot.stay',M('e.pivot.stay.s'),s=>{}),M('e.pivot.stay.h'))]},
{id:'life',win:[47,47],when:s=>!s.retired,title:M('e.life.t'),def:'same',
 text:s=>M('e.life.x'),
 opts:s=>[
  O('up','e.life.up',M('e.life.up.s',{a:MN(s.base)}),s=>{pay(s,s.base);s.life=.95;s.happy+=5;const t=T(s,'life',{kind:'ghost',label:M('trk.lifeUp')});t.spent+=s.base;t.g+=s.base}),
  O('same','e.life.same',M('e.life.same.s'),s=>{}),
  O('frugal','e.life.frugal',M('e.life.frugal.s'),s=>{s.life=.65;s.happy-=3;T(s,'life',{kind:'ghost',label:M('trk.lifeFrugal')})})]},
{id:'inh',when:s=>s.age===s.inheritAge&&(s.fam==='middle'||s.fam==='rich'),title:M('e.inh.t'),def:'bank',
 text:s=>M('e.inh.x',{a:MN(inhAmt(s))}),
 opts:s=>{const A=inhAmt(s);const o=[O('inv','e.inh.inv',M('e.inh.inv.s'),s=>{addLot(s,'inh',A);T(s,'lot_inh',{kind:'lot',src:'inh',label:M('trk.inhInv')})})];
  if(s.house&&s.house.mort>1)o.push(O('mort','e.inh.mort',M('e.inh.mort.s',{a:MN(Math.min(A,s.house.mort))}),s=>{const p=Math.min(A,s.house.mort);s.house.mort-=p;s.house.out+=p;s.cash+=A-p;if(s.house.mort<1)s.house.mort=0;else setRate(s.house,s.house.rate||.03,s.age)}));
  o.push(O('spend','e.inh.spend',M('e.inh.spend.s'),s=>{s.happy+=6;const t=T(s,'inhs',{kind:'ghost',label:M('trk.inhSpent')});t.spent+=A;t.g+=A}));
  o.push(O('bank','e.inh.bank',M('e.inh.bank.s'),s=>{s.cash+=A}));return o}},
/* later life */
{id:'ret',win:[55,55],when:s=>!s.retired,title:M('e.ret.t'),def:'60',
 text:s=>M('e.ret.x',{a:MN(netWorth(s))}),
 opts:s=>[55,60,65,70].map(r=>({id:String(r),label:M('e.ret.'+r),sub:M('e.ret.'+r+'.s'),go:s=>{s.retireAge=r}}))},
{id:'charity',win:[55,85],p:.55,title:M('e.charity.t'),def:'small',
 text:s=>M('e.charity.x'),
 opts:s=>[
  O('big','e.charity.big',M('e.charity.big.s',{a:MN(.3*s.base)}),s=>{spend(s,'charity',.3*s.base,'trk.charity');s.happy+=4}),
  O('small','e.charity.small',M('e.charity.small.s',{a:MN(.03*s.base)}),s=>{spend(s,'charity',.03*s.base,'trk.charity');s.happy+=2}),
  O('no','e.charity.no',M('e.charity.no.s'),s=>{})]},
{id:'glide',win:[56,64],p:.8,when:s=>mktTot(s)>s.base,title:M('e.glide.t'),def:'stay',
 text:s=>M('e.glide.x',{a:MN(mktTot(s))}),
 opts:s=>{const move=(f,to)=>s=>{let x=0;for(const k in s.lots){const l=s.lots[k];if(!isMkt(l))continue;const y=l.v*f;l.v-=y;l.tout+=y;x+=y}if(to)addLot(s,to,x);else s.cash+=x};return[
  O('stay','e.glide.stay',M('e.glide.stay.s'),s=>{}),
  O('mix','e.glide.mix',M('e.glide.mix.s'),s=>{mkLot(s,'bond',{t:'bond'},'trk.bond');move(.4,'bond')(s)}),
  O('cash','e.glide.cash',M('e.glide.cash.s'),move(1,null))]}},
{id:'ltc',win:[56,64],p:.7,title:M('e.ltc.t'),def:'no',
 text:s=>M('e.ltc.x',{a:MN(.8*s.base)}),hint:s=>M('e.ltc.h'),
 opts:s=>{const care=s=>later(s,76+Math.floor(evR(s,'careAt')()*12),'care');return[
  O('yes','e.ltc.yes',M('e.ltc.yes.s',{a:MN(.025*s.base)}),s=>{s.ltc=true;T(s,'ltc',{kind:'custom',label:M('trk.ltc')});rec(s,'ltc',.025*s.base,99);care(s)}),
  O('no','e.ltc.no',M('e.ltc.no.s'),care)]}},
{id:'travel',win:[58,70],p:.8,when:s=>s.retired,title:M('e.travel.t'),def:'modest',
 text:s=>M('e.travel.x'),
 opts:s=>[
  O('world','e.travel.world',M('e.travel.world.s',{a:MN(.3*s.base)}),s=>{spend(s,'travel',.3*s.base,'trk.travelBig');s.happy+=6}),
  O('modest','e.travel.modest',M('e.travel.modest.s',{a:MN(.08*s.base)}),s=>{spend(s,'travel',.08*s.base,'trk.travel');s.happy+=3}),
  O('home','e.travel.home',M('e.travel.home.s'),s=>{})]},
{id:'grandkid',win:[58,74],p:.65,when:s=>s.kids.length>0,title:M('e.grandkid.t'),def:'no',
 text:s=>M('e.grandkid.x'),
 opts:s=>{const a=.4*s.base;return[
  O('gift',M('e.grandkid.gift',{a:MN(a)}),M('e.grandkid.gift.s'),s=>{spend(s,'gift',a,'trk.gift');s.happy+=4}),
  O('lend',M('e.grandkid.lend',{a:MN(a)}),M('e.grandkid.lend.s'),s=>{pay(s,a);T(s,'kidloan',{kind:'custom',label:M('trk.kidloan'),v:-a,note:M('note.lend0',{a:MN(a)})});later(s,s.age+3,'repay',{a,id:'kidloan',fam:1})}),
  O('no','e.grandkid.no',M('e.grandkid.no.s'),s=>{})]}},
{id:'room',win:[58,80],p:.45,when:s=>!!s.house,title:M('e.room.t'),def:'no',
 text:s=>M('e.room.x'),
 opts:s=>[
  O('rent','e.room.rent',M('e.room.rent.s',{a:MN(.06*s.base)}),s=>{T(s,'room',{kind:'custom',label:M('trk.room')});rec(s,'room',-.06*s.base,10);s.happy-=2}),
  O('no','e.room.no',M('e.room.no.s'),s=>{})]},
{id:'annuity',win:[60,68],p:.65,when:s=>liquid(s)>2*s.base,title:M('e.annuity.t'),def:'no',
 text:s=>M('e.annuity.x'),
 opts:s=>{const a=.3*liquid(s);return[
  O('buy',M('e.annuity.buy',{a:MN(a)}),M('e.annuity.buy.s',{b:MN(.055*a)}),s=>{pay(s,a);s.annu+=.055*a;T(s,'annuity',{kind:'custom',label:M('trk.annuity'),v:-a,cost:a,note:M('note.annuity',{a:MN(a),b:MN(0)})})}),
  O('no','e.annuity.no',M('e.annuity.no.s'),s=>{})]}},
{id:'ret2',win:[60,67],p:.55,when:s=>s.retired,title:M('e.ret2.t'),def:'no',
 text:s=>M('e.ret2.x'),
 opts:s=>[
  O('yes','e.ret2.yes',M('e.ret2.yes.s',{a:MN(.35*s.base)}),s=>{s.ret2={until:s.age+4,inc:.35*s.base};T(s,'ret2',{kind:'custom',label:M('trk.ret2')});s.happy+=1}),
  O('no','e.ret2.no',M('e.ret2.no.s'),s=>{})]},
{id:'club',win:[60,72],p:.55,when:s=>s.retired,title:M('e.club.t'),def:'garden',
 text:s=>M('e.club.x'),
 opts:s=>[
  OR('join','e.club.join',M('e.club.join.s',{a:MN(.06*s.base)}),8,s=>{T(s,'club',{kind:'ghost',label:M('trk.club')});rec(s,'club',.06*s.base,10);s.happy+=4}),
  OR('garden','e.club.garden',M('e.club.garden.s',{a:MN(.01*s.base)}),3,s=>{T(s,'club',{kind:'ghost',label:M('trk.garden')});rec(s,'club',.01*s.base,10);s.happy+=2}),
  O('no','e.club.no',M('e.club.no.s'),s=>{})]},
{id:'downsize',win:[62,76],p:.65,when:s=>!!s.house,title:M('e.downsize.t'),def:'stay',
 text:s=>M('e.downsize.x',{a:MN(s.house.value)}),
 opts:s=>{const h=s.house,free=.45*h.value;return[
  O('sell','e.downsize.sell',M('e.downsize.sell.s',{b:MN(Math.max(0,free-h.mort))}),s=>{const h=s.house;let x=.45*h.value;h.value*=.5;h.frac*=.5;h.out+=.05*h.value;const p=Math.min(x,h.mort);h.mort-=p;x-=p;if(h.mort<1)h.mort=0;mkLot(s,'down',{},'trk.down');addLot(s,'down',x);s.happy-=2}),
  O('stay','e.downsize.stay',M('e.downsize.stay.s'),s=>{})]}},
{id:'medcover',win:[63,72],p:.9,when:s=>s.insured,title:M('e.medcover.t'),def:'keep',
 text:s=>M('e.medcover.x',{a:MN(.035*s.base*2.2)}),
 opts:s=>[
  O('keep','e.medcover.keep',M('e.medcover.keep.s',{a:MN(.035*s.base*2.2)}),s=>{s.insMul=2.2}),
  O('drop','e.medcover.drop',M('e.medcover.drop.s'),s=>{s.insured=false;const t=s.trk.ins;if(t)t.note=M('note.insDrop',{p:MN(t.prem),c:MN(t.saved)})})]},
{id:'health2',win:[65,86],p:.7,title:M('e.health2.t'),def:'wait',
 text:s=>M('e.health2.x'),
 opts:s=>{const a=.5*s.base*(s.insured?.15:1);return[
  O('priv','e.health2.priv',M('e.health2.priv.s',{a:MN(a),ins:s.insured?M('e.health2.ins'):''}),s=>{spend(s,'health2',a,'trk.hipPriv');s.health+=4;s.happy+=3}),
  Hn(O('wait','e.health2.wait',M('e.health2.wait.s'),s=>{s.happy-=3;s.health-=6}),M('e.health2.wait.h'))]}},
{id:'scam2',win:[66,90],p:.6,when:s=>liquid(s)>.1*s.base,title:M('e.scam2.t'),def:'check',
 text:s=>M('e.scam2.x',{a:MN(Math.min(.3*s.base,.3*liquid(s)))}),
 opts:s=>{const a=Math.min(.3*s.base,.3*liquid(s));return[
  O('send','e.scam2.send',M('e.scam2.send.s'),s=>{pay(s,a);T(s,'scam2',{kind:'custom',label:M('trk.scam2'),v:-a,note:M('note.scamIn',{a:MN(a)})});later(s,s.age,'scam',{a,id:'scam2',k2:1})}),
  O('check','e.scam2.check',M('e.scam2.check.s'),s=>{})]}},
{id:'will',win:[70,90],p:.75,when:s=>s.kids.length>0,title:M('e.will.t'),def:'none',
 text:s=>M('e.will.x'),
 opts:s=>{const a=.25*liquid(s);return[
  O('gift',M('e.will.gift',{a:MN(a)}),M('e.will.gift.s'),s=>{spend(s,'will',a,'trk.giftKids');s.happy+=5}),
  O('will','e.will.will',M('e.will.will.s',{a:MN(.03*s.base)}),s=>{spend(s,'will',.03*s.base,'trk.will');s.happy+=2}),
  O('none','e.will.none',M('e.will.none.s'),s=>{})]}},
{id:'hearing',win:[72,92],p:.6,title:M('e.hearing.t'),def:'basic',
 text:s=>M('e.hearing.x'),
 opts:s=>[
  O('top','e.hearing.top',M('e.hearing.top.s',{a:MN(.08*s.base)}),s=>{spend(s,'hearing',.08*s.base,'trk.hearing');s.happy+=3}),
  O('basic','e.hearing.basic',M('e.hearing.basic.s',{a:MN(.02*s.base)}),s=>{spend(s,'hearing',.02*s.base,'trk.hearing');s.happy+=1}),
  O('none','e.hearing.none',M('e.hearing.none.s'),s=>{s.happy-=3})]},
{id:'reverse',win:[72,90],p:.5,when:s=>!!s.house&&s.house.mort<1&&s.retired,title:M('e.reverse.t'),def:'no',
 text:s=>M('e.reverse.x',{a:MN(s.house.value)}),
 opts:s=>[
  O('unlock',M('e.reverse.unlock',{a:MN(.3*s.house.value)}),M('e.reverse.unlock.s'),s=>{const h=s.house,x=.3*h.value;s.cash+=x;h.mort+=x;h.rate=.05;h.pay=0;T(s,'reverse',{kind:'custom',label:M('trk.reverse'),note:M('note.reverse',{a:MN(x)})})}),
  O('no','e.reverse.no',M('e.reverse.no.s'),s=>{})]},
{id:'move2',win:[75,92],p:.6,title:M('e.move2.t'),def:'stay',
 text:s=>M('e.move2.x',{a:MN(.25*s.base)}),
 opts:s=>[
  O('move','e.move2.move',M('e.move2.move.s',{a:MN(.25*s.base)}),s=>{T(s,'move2',{kind:'ghost',label:M('trk.move2')});rec(s,'move2',.25*s.base,40,1);s.happy+=4}),
  O('stay','e.move2.stay',M('e.move2.stay.s'),s=>{})]},
{id:'gtrip',win:[76,96],p:.6,when:s=>s.kids.length>0,title:M('e.gtrip.t'),def:'small',
 text:s=>M('e.gtrip.x'),
 opts:s=>[
  O('big','e.gtrip.big',M('e.gtrip.big.s',{a:MN(.2*s.base)}),s=>{spend(s,'gtrip',.2*s.base,'trk.gtrip');s.happy+=5}),
  O('small','e.gtrip.small',M('e.gtrip.small.s',{a:MN(.03*s.base)}),s=>{spend(s,'gtrip',.03*s.base,'trk.gtripS');s.happy+=3}),
  O('no','e.gtrip.no',M('e.gtrip.no.s'),s=>{})]},
{id:'funeral',win:[80,100],p:.7,title:M('e.funeral.t'),def:'none',
 text:s=>M('e.funeral.x',{a:MN(.3*s.base)}),
 opts:s=>[
  O('plan','e.funeral.plan',M('e.funeral.plan.s',{a:MN(.25*s.base)}),s=>{spend(s,'funeral',.25*s.base,'trk.funeral');s.happy+=2}),
  O('simple','e.funeral.simple',M('e.funeral.simple.s',{a:MN(.08*s.base)}),s=>{spend(s,'funeral',.08*s.base,'trk.funeralS');s.happy+=2}),
  O('none','e.funeral.none',M('e.funeral.none.s'),s=>{})]},
{id:'debt',when:s=>s.age>=18&&s.debt>.4*s.base&&!s.retired,title:M('e.debt.t'),def:'min',
 text:s=>M('e.debt.x',{a:MN(s.debt),i:MN(s.debt*.18)}),
 opts:s=>{const o=[];if(eqTot(s)>1)o.push(O('sell','e.debt.sell',M('e.debt.sell.s',{a:MN(Math.min(eqTot(s),s.debt))}),s=>{s.debtSeen=s.age;const p=Math.min(eqTot(s),s.debt);withdrawEq(s,p);s.debt-=p}));
  o.push(O('cut','e.debt.cut',M('e.debt.cut.s'),s=>{s.debtSeen=s.age;s.cutDebt=true;s.happy-=4}));
  o.push(O('min','e.debt.min',M('e.debt.min.s'),s=>{s.debtSeen=s.age}));return o}},
/* people: friends, family and partners. Every choice here also moves Relationships */
{id:'friends',win:[6,8],p:.85,title:M('e.friends.t'),def:'some',
 text:s=>M('e.friends.x'),
 opts:s=>{const a=.01*s.base;return[
  OR('all','e.friends.all',M('e.friends.all.s',{a:MN(a)}),8,s=>{s.happy+=3}),
  OR('some','e.friends.some',M('e.friends.some.s',{a:MN(.4*a)}),4,s=>{s.happy+=1}),
  OR('read','e.friends.read',M('e.friends.read.s'),-4,s=>addSkill(s,'child',1.5,M('trk.child')),undefined,M('hx.sk',{n:1.5}))]}},
{id:'peer',win:[11,14],p:.8,title:M('e.peer.t'),def:'old',
 text:s=>M('e.peer.x',{a:MN(.03*s.base)}),
 opts:s=>{const a=.03*s.base;return[
  OR('ask','e.peer.ask',M('e.peer.ask.s'),3,s=>{s.happy+=2;s.habit+=.01;T(s,'habit',{kind:'custom',label:M('trk.habitSpend')})},s.fam==='poor'||s.fam==='working'?M('e.peer.no'):true,M('e.allow.spend.h')),
  OR('own','e.peer.own',M('e.peer.own.s',{a:MN(a)}),3,s=>{spend(s,'peer',a,'trk.peer');s.happy+=2},s.cash>=a||M('e.peer.cash',{a:MN(Math.max(0,s.cash))})),
  OR('old','e.peer.old',M('e.peer.old.s'),-2,s=>{s.happy-=1})]}},
{id:'trip',win:[12,15],p:.8,only:s=>s.fam==='poor'||s.fam==='working',title:M('e.trip.t'),def:'stay',
 text:s=>M('e.trip.x',{a:MN(.06*s.base)}),
 opts:s=>{const a=.06*s.base;return[
  OR('ask','e.trip.ask',M('e.trip.ask.s',{a:MN(a)}),5,s=>{s.happy+=3;later(s,19,'tripDebt',{a})}),
  OR('work','e.trip.work',M('e.trip.work.s',{a:MN(a)}),5,s=>{s.earned+=a;s.happy+=1;addSkill(s,'base',.5)},undefined,M('hx.sk',{n:.5})),
  OR('stay','e.trip.stay',M('e.trip.stay.s'),-4,s=>{s.happy-=3})]}},
{id:'date',win:[18,24],p:.85,title:M('e.date.t'),def:'simple',
 text:s=>M('e.date.x'),
 opts:s=>[
  OR('fancy','e.date.fancy',M('e.date.fancy.s',{a:MN(.15*s.base)}),6,s=>{spend(s,'date',.15*s.base,'trk.dateFancy');s.happy+=4;s.marryRoll-=.08}),
  OR('simple','e.date.simple',M('e.date.simple.s',{a:MN(.04*s.base)}),6,s=>{spend(s,'date',.04*s.base,'trk.date');s.happy+=3;s.marryRoll-=.08}),
  OR('solo','e.date.solo',M('e.date.solo.s'),-3,s=>addSkill(s,'base',1),undefined,M('hx.sk',{n:1}))]},
{id:'team',win:[22,32],p:.7,when:job,title:M('e.team.t'),def:'some',
 text:s=>M('e.team.x',{a:MN(.03*s.base)}),
 opts:s=>{const a=.03*s.base;return[
  OR('often','e.team.often',M('e.team.often.s',{a:MN(a)}),5,s=>{T(s,'team',{kind:'ghost',label:M('trk.team')});rec(s,'team',a,5)}),
  OR('some','e.team.some',M('e.team.some.s',{a:MN(a/3)}),2,s=>{T(s,'team',{kind:'ghost',label:M('trk.team')});rec(s,'team',a/3,5)}),
  OR('never','e.team.never',M('e.team.never.s'),-4,null)]}},
{id:'fwed',win:[23,34],p:.85,title:M('e.fwed.t'),def:'norm',
 text:s=>M('e.fwed.x',{a:MN(.02*s.base)}),
 opts:s=>{const a=.02*s.base;return[
  OR('big','e.fwed.big',M('e.fwed.big.s',{a:MN(2*a)}),4,s=>spend(s,'fwed',2*a,'trk.fwed')),
  OR('norm','e.fwed.norm',M('e.fwed.norm.s',{a:MN(a)}),2,s=>spend(s,'fwed',a,'trk.fwed')),
  OR('skip','e.fwed.skip',M('e.fwed.skip.s'),-5,null)]}},
{id:'mentor',win:[21,30],p:.7,when:job,title:M('e.mentor.t'),def:'no',
 text:s=>M('e.mentor.x'),
 opts:s=>{const a=.015*s.base;return[
  OR('yes','e.mentor.yes',M('e.mentor.yes.s',{a:MN(a)}),4,s=>{T(s,'mentor',{kind:'ghost',label:M('trk.mentorLunch')});rec(s,'mentor',a,3);addSkill(s,'mentor',3,M('trk.mentor'));later(s,s.age+3,'mentor',{p:.35})},undefined,M('hx.sk',{n:3})),
  OR('some','e.mentor.some',M('e.mentor.some.s'),2,s=>{addSkill(s,'mentor',1,M('trk.mentor'));later(s,s.age+3,'mentor',{p:.15})},undefined,M('hx.sk',{n:1})),
  O('no','e.mentor.no',M('e.mentor.no.s'),s=>{})]}},
{id:'credit',win:[25,40],p:.6,when:job,title:M('e.credit.t'),def:'let',
 text:s=>M('e.credit.x'),
 opts:s=>[
  OR('talk','e.credit.talk',M('e.credit.talk.s'),0,s=>later(s,s.age,'credit',{p:.45,m:1.05}),undefined,M('e.credit.talk.h')),
  OR('boss','e.credit.boss',M('e.credit.boss.s'),-4,s=>later(s,s.age,'credit',{p:.55,m:1.08,bad:.25}),undefined,M('e.credit.boss.h')),
  OR('let','e.credit.let',M('e.credit.let.s'),1,s=>{s.happy-=3})]},
{id:'network',win:[24,42],p:.65,when:job,title:M('e.network.t'),def:'skip',
 text:s=>M('e.network.x',{a:MN(.02*s.base)}),
 opts:s=>{const a=.02*s.base,at=s=>s.age+1+Math.floor(evR(s,'netAt')()*3);return[
  OR('follow','e.network.follow',M('e.network.follow.s',{a:MN(a)}),4,s=>{spend(s,'network',a,'trk.network');later(s,at(s),'network',{p:.3})}),
  OR('cards','e.network.cards',M('e.network.cards.s',{a:MN(a)}),1,s=>{spend(s,'network',a,'trk.network');later(s,at(s),'network',{p:.1})}),
  O('skip','e.network.skip',M('e.network.skip.s'),s=>{})]}},
{id:'uncle',win:[20,28],p:.4,when:s=>job(s)&&s.abroad==null,title:M('e.uncle.t'),def:'no',
 text:s=>M('e.uncle.x',{a:MN(1.1*salary(s))}),hint:s=>M('e.uncle.h'),
 opts:s=>[
  OR('join','e.uncle.join',M('e.uncle.join.s',{a:MN(1.1*salary(s))}),5,s=>{bump(s,'uncle',1.1,M('trk.uncle'));s.uncle=true;later(s,s.age+4+Math.floor(evR(s,'uncAt')()*5),'uncle')}),
  OR('no','e.uncle.no',M('e.uncle.no.s'),-1,null)]},
{id:'sibfees',win:[22,36],p:.5,title:M('e.sibfees.t'),def:'no',
 text:s=>M('e.sibfees.x',{a:MN(.4*s.base)}),
 opts:s=>{const a=.4*s.base,liq=liquid(s),go=(x,lk)=>s=>{pay(s,x);T(s,'sib',{kind:'custom',label:M(lk),v:-x,note:M('note.paid',{a:MN(x)})});later(s,s.age+5+Math.floor(evR(s,'sibAt')()*5),'sib',{a:x})};return[
  OR('all','e.sibfees.all',M('e.sibfees.all.s',{a:MN(a)}),7,go(a,'trk.sib'),liq>=a||M('e.home.need',{n:MN(a),h:MN(liq)})),
  OR('half','e.sibfees.half',M('e.sibfees.half.s',{a:MN(a/2)}),3,go(a/2,'trk.sibHalf'),liq>=a/2||M('e.home.need',{n:MN(a/2),h:MN(liq)})),
  OR('no','e.sibfees.no',M('e.sibfees.no.s'),-5,null)]}},
{id:'cny',win:[20,62],p:.8,title:M('e.cny.t'),def:'mod',
 text:s=>M(LNY(s)?'e.cny.x':'e.cny.x2',{a:MN(.06*s.base)}),
 opts:s=>[
  OR('big',LNY(s)?'e.cny.big':'e.cny.big2',M('e.cny.big.s',{a:MN(.06*s.base)}),4,s=>{spend(s,'cny',.06*s.base,'trk.cny');s.happy+=2}),
  OR('mod','e.cny.mod',M('e.cny.mod.s',{a:MN(.02*s.base)}),2,s=>spend(s,'cny',.02*s.base,'trk.cny')),
  OR('skip','e.cny.skip',M('e.cny.skip.s'),-4,s=>{s.happy-=1})]},
{id:'cosign',win:[28,52],p:.5,title:M('e.cosign.t'),def:'no',
 text:s=>M('e.cosign.x',{a:MN(s.base)}),hint:s=>M('e.cosign.h'),
 opts:s=>[
  OR('sign','e.cosign.sign',M('e.cosign.sign.s',{a:MN(s.base)}),5,s=>{T(s,'cosign',{kind:'custom',label:M('trk.cosign'),note:M('note.cosign0')});later(s,s.age+2+Math.floor(evR(s,'cosAt')()*4),'cosign',{a:.6*s.base})}),
  OR('gift',M('e.cosign.gift',{a:MN(.1*s.base)}),M('e.cosign.gift.s'),1,s=>spend(s,'cosign',.1*s.base,'trk.cosignGift')),
  OR('no','e.cosign.no',M('e.cosign.no.s'),-5,null)]},
{id:'away',win:[30,45],p:.55,when:job,title:M('e.away.t'),def:'stay',
 text:s=>M('e.away.x',{a:MN(1.2*salary(s)),b:MN(salary(s))}),
 opts:s=>[
  OR('go','e.away.go',M('e.away.go.s',{a:MN(.1*s.base)}),-10,s=>{pay(s,.1*s.base);bump(s,'away',1.2,M('trk.away'));s.trk.away.v-=.1*s.base;s.happy-=2}),
  OR('remote','e.away.remote',M('e.away.remote.s'),0,s=>later(s,s.age,'remote',{p:.35}),undefined,M('e.away.remote.h')),
  OR('stay','e.away.stay',M('e.away.stay.s'),3,null)]},
{id:'bizpal',win:[30,46],p:.5,when:s=>liquid(s)>.15*s.base&&!s.retired,title:M('e.bizpal.t'),def:'no',
 text:s=>M('e.bizpal.x'),hint:s=>M('e.bizpal.h'),
 opts:s=>{const liq=liquid(s),big=Math.min(.5*s.base,.6*liq),sm=Math.min(.12*s.base,.3*liq),go=(a,lk)=>s=>{pay(s,a);T(s,'bizpal',{kind:'custom',label:M(lk),v:-a,note:M('note.bizpalIn',{a:MN(a)})});later(s,s.age+3,'bizpal',{a})};return[
  OR('in',M('e.bizpal.in',{a:MN(big)}),M('e.bizpal.in.s'),4,go(big,'trk.bizpal')),
  OR('small',M('e.bizpal.small',{a:MN(sm)}),M('e.bizpal.small.s'),2,go(sm,'trk.bizpalS')),
  OR('no','e.bizpal.no',M('e.bizpal.no.s'),-2,null)]}},
{id:'reunion',win:[40,72],p:.7,title:M('e.reunion.t'),def:'dinner',
 text:s=>M('e.reunion.x'),
 opts:s=>[
  OR('trip','e.reunion.trip',M('e.reunion.trip.s',{a:MN(.06*s.base)}),6,s=>{spend(s,'reunion',.06*s.base,'trk.reunion');s.happy+=3}),
  OR('dinner','e.reunion.dinner',M('e.reunion.dinner.s',{a:MN(.01*s.base)}),3,s=>{spend(s,'reunion',.01*s.base,'trk.reunion');s.happy+=1}),
  OR('skip','e.reunion.skip',M('e.reunion.skip.s'),-2,null)]},
{id:'fsick',win:[40,66],p:.5,title:M('e.fsick.t'),def:'visit',
 text:s=>M('e.fsick.x',{a:MN(.15*s.base)}),
 opts:s=>{const a=.15*s.base;return[
  OR('give',M('e.fsick.give',{a:MN(a)}),M('e.fsick.give.s'),6,s=>{spend(s,'fsick',a,'trk.fsickGift');s.happy+=2}),
  OR('lend',M('e.fsick.lend',{a:MN(a)}),M('e.fsick.lend.s'),3,s=>{pay(s,a);T(s,'fsick',{kind:'custom',label:M('trk.fsickLend'),v:-a,note:M('note.lend0',{a:MN(a)})});later(s,s.age+2+Math.floor(evR(s,'fsAt')()*3),'repay',{a,id:'fsick'})}),
  OR('visit','e.fsick.visit',M('e.fsick.visit.s'),3,null)]}},
{id:'carers',win:[50,66],p:.6,title:M('e.carers.t'),def:'share',
 text:s=>M('e.carers.x'),
 opts:s=>{const a=.25*s.base,b=.08*s.base;return[
  OR('quit','e.carers.quit',M('e.carers.quit.s'),8,s=>{s.offUntil=s.age+2;T(s,'carers',{kind:'custom',label:M('trk.carersQuit'),note:M('note.carers0')});s.happy-=2},job(s)||M('e.carers.nojob')),
  OR('pay','e.carers.pay',M('e.carers.pay.s',{a:MN(a)}),2,s=>{T(s,'carers',{kind:'custom',label:M('trk.carersPay')});rec(s,'carers',a,5)}),
  OR('share','e.carers.share',M('e.carers.share.s',{a:MN(b)}),1,s=>{T(s,'carers',{kind:'custom',label:M('trk.carersShare')});rec(s,'carers',b,5);s.happy-=2})]}},
{id:'inhfight',win:[52,70],p:.55,only:s=>s.fam==='poor'||s.fam==='working',title:M('e.inhfight.t'),def:'fair',
 text:s=>M('e.inhfight.x',{a:MN(.5*price(s))}),
 opts:s=>{const sh=.5*price(s)/3;return[
  OR('fair',M('e.inhfight.fair',{a:MN(sh)}),M('e.inhfight.fair.s'),-4,s=>{s.cash+=sh;T(s,'inhfight',{kind:'custom',label:M('trk.inhFair'),v:sh,note:M('note.got',{a:MN(sh)})})}),
  OR('give','e.inhfight.give',M('e.inhfight.give.s'),6,s=>{s.happy+=2}),
  OR('court','e.inhfight.court',M('e.inhfight.court.s',{a:MN(.1*s.base)}),-12,s=>{pay(s,.1*s.base);T(s,'inhfight',{kind:'custom',label:M('trk.inhCourt'),v:-.1*s.base,note:M('note.paid',{a:MN(.1*s.base)})});later(s,s.age+2,'court',{a:sh})},undefined,M('e.inhfight.court.h'))]}},
{id:'grandsit',win:[58,76],p:.6,when:s=>s.kids.length>0,title:M('e.grandsit.t'),def:'some',
 text:s=>M('e.grandsit.x'),
 opts:s=>[
  OR('yes','e.grandsit.yes',M('e.grandsit.yes.s',{a:MN(.04*s.base)}),6,s=>{T(s,'grandsit',{kind:'custom',label:M('trk.grandsit')});rec(s,'grandsit',-.04*s.base,5,-.3);s.happy+=3}),
  OR('some','e.grandsit.some',M('e.grandsit.some.s'),3,s=>{s.happy+=1}),
  OR('no','e.grandsit.no',M('e.grandsit.no.s'),-3,null)]},
/* health: a serious illness and depression come with the situation (see tick); `surv` makes the 40 futures count survivors */
{id:'ill',when:s=>s.illAge===s.age,surv:true,title:M('e.ill.t'),def:'std',
 pre:s=>{},preLog:s=>M('log.ill.'+s.illType),
 text:s=>M('e.ill.x.'+s.illType),hint:s=>M('e.ill.hx'),
 opts:s=>['best','std','skip'].map(k=>{const y=illYou(s,k),liq=liquid(s);
  return Hn(O(k,'e.ill.'+k,M('e.ill.'+k+'.s',{a:MN(y),ins:s.insured&&y>0?M('e.health2.ins'):'',off:job(s)?M('e.ill.off',{n:ILLT[k].m}):''}),s=>treat(s,k),
   k==='best'?(s.insured||liq>=.5*y||M('e.home.need',{n:MN(.5*y),h:MN(liq)})):undefined),M('e.ill.h',{p:Math.round(survP(s,k)*100)}))})},
{id:'dep',when:s=>s.depAge===s.age,title:M('e.dep.t'),def:'ignore',care:M('e.dep.care'),
 pre:s=>{},preLog:s=>M('log.dep'),
 text:s=>M('e.dep.x'),hint:s=>M('e.dep.h'),
 opts:s=>{const u=evR(s,'depLen')();return[
  Hn(O('ther','e.dep.ther',M('e.dep.ther.s',{a:MN(depFee(s)),ins:s.insured?M('e.health2.ins'):''}),s=>depStart(s,'ther',u<.5?1:2)),M('e.dep.ther.h')),
  Hn(O('off','e.dep.off',M('e.dep.off.s',{a:MN(job(s)?.33*salary(s):0)}),s=>depStart(s,'off',1),job(s)||M('e.dep.nojob')),M('e.dep.off.h')),
  OR('talk','e.dep.talk',M('e.dep.talk.s'),3,s=>depStart(s,'talk',clamp(Math.floor((75-s.rel)/15+u+1),1,4)),undefined,M('e.dep.talk.h')),
  Hn(O('ignore','e.dep.ignore',M('e.dep.ignore.s'),s=>depStart(s,'ignore',4+Math.floor(u*3))),M('e.dep.ignore.h'))]}}
];

/* an event is due when its planned age has come (and its window hasn't passed) and its condition holds; no event happens twice */
function due(s,e){if(e.win){const a=s.plan[e.id];if(a==null||s.age<a||s.age>e.win[1])return false}return !e.when||e.when(s)}
/* after two quiet years, bring forward the open decision planned closest to now (this life's plan first, then the spares),
   so late-life cards are not used up early */
function pullForward(s){if(s.age<6||s.age-s.lastDec<2)return null;let best=null,bd=1e9;
 for(const[src,w]of [[s.plan,0],[s.spare,.5]])for(const e of EV){const a=src[e.id];if(a==null||!e.win||s.done[e.id]||s.age<e.win[0]||s.age>e.win[1]||(src===s.plan&&a<=s.age))continue;
  const d=Math.abs(a-s.age)+w;if(d<bd&&(!e.when||e.when(s))){best=e;bd=d}}
 if(best)s.plan[best.id]=s.age;return best}
function dueEvents(s){if(s.dead)return[];const d=EV.filter(e=>!s.done[e.id]&&due(s,e));if(d.length)return d;const p=pullForward(s);return p?[p]:[]}
function applyOpt(s,ev,id){if(ev.pre&&!s['pre_'+ev.id]){ev.pre(s);s['pre_'+ev.id]=1}const os=ev.opts(s);let o=os.find(x=>x.id===id);if(!o||(o.ok!==undefined&&o.ok!==true))o=os.find(x=>x.id===ev.def)||os[os.length-1];o.go(s);s.done[ev.id]=o.id;s.lastDec=s.age;if(ev.again)ev.again(s);return o}
function resolveAuto(s){let g=0,ev;while((ev=dueEvents(s)[0])&&g++<30)applyOpt(s,ev,ev.def)}

/* ---------- consequences that arrive years later ---------- */
const LATER={
 sell:(s,x,L)=>{const u=evR(s,'teen')(),v=(u<.3?.1:u<.7?.03:0)*s.base;s.cash+=v;s.earned+=v;L&&L(M(v>0?'log.sellOk':'log.sellNo',{a:MN(v)}),v>0?'good':'')},
 late:(s,x,L)=>{if(evR(s,'late')()>=.35)return;pay(s,x.a);const t=s.trk.bnpl;if(t){t.spent+=x.a;t.g+=x.a}L&&L(M('log.late',{a:MN(x.a)}),'bad')},
 emerg:(s,x,L)=>{const c=Math.min(Math.max(0,s.cash),x.a),d=x.a-c;s.cash-=c;s.debt+=d;const t=s.trk.efund;if(t&&d<1)t.note=M('note.efund',{a:MN(x.a)});L&&L(M(d>=1?'log.emergDebt':'log.emergCash',{a:MN(x.a),b:MN(d)}),d>=1?'bad':'good')},
 nego:(s,x,L)=>{const ok=evR(s,'nego')()<x.p;if(ok){if(x.lv)s.level=Math.max(0,s.level-1);bump(s,'nego',x.m,M(x.lk))}else s.happy-=2;L&&L(M(ok?'log.negoOk':'log.negoNo',{p:Math.round((x.m-1)*100)}),ok?'good':'bad')},
 repay:(s,x,L)=>{const u=evR(s,'repay'+x.id)(),f=x.fam?(u<.7?1:u<.85?.5:0):(u<relP(s,.45)?1:u<relP(s,.65)?.5:0),v=x.a*f;s.cash+=v;const t=s.trk[x.id];if(t){t.v+=v;t.note=M('note.repay',{a:MN(x.a),b:MN(v)})}L&&L(M((x.fam?'log.kidRepay':'log.repay')+(f===1?'All':f?'Half':'None'),{a:MN(x.a),b:MN(v)}),f===1?'good':'bad')},
 mlm:(s,x,L)=>{const ok=evR(s,'mlm')()<.1,t=s.trk.mlm;if(ok){const v=.5*s.base;s.cash+=v;s.earned+=v;if(t)t.v+=v}if(t)t.note=M(ok?'note.mlmOk':'note.mlmNo',{a:MN(Math.abs(t.v))});L&&L(M(ok?'log.mlmOk':'log.mlmNo'),ok?'good':'bad')},
 scam:(s,x,L)=>{const t=s.trk[x.id];if(t)t.note=M('note.scam',{a:MN(x.a)});L&&L(M(x.k2?'log.scam2':'log.scam',{a:MN(x.a)}),'bad')},
 rate:(s,x,L)=>{const h=s.house;if(h&&h.rate>.03){setRate(h,.03,s.age);L&&L(M('log.rateDown'),'good')}},
 burst:(s,x,L)=>{const down=evR(s,'burst')()<.6,m=down?.7:1.15;s.hm*=m;if(s.house)s.house.value*=m;const t=s.trk.bubble;if(t){t.v=(1-m)*t.ref;t.note=M(down?'note.bubbleDodge':'note.bubbleMiss',{a:MN(Math.abs(t.v))})}L&&L(M(down?'log.burst':'log.boom'),down?'bad':'good')},
 lay:(s,x,L)=>{if(!s.job||s.retired)return;if(evR(s,'lay')()<x.p){s.layAt=s.age;s.layVol=false;s.level=Math.max(0,s.level-1)}else L&&L(M('log.layNo'),'good')},
 div:(s,x,L)=>{if(!s.married)return;if(evR(s,'div')()>=x.p*clamp(1.6-s.rel/62,.4,1.6)){L&&L(M('log.divNo'),'good');return}
  const before=netWorth(s);withdrawEq(s,.45*eqTot(s));if(s.cash>0)s.cash*=.55;if(s.house){s.house.value*=.55;s.house.mort*=.55;setRate(s.house,s.house.rate||.03,s.age)}pay(s,.2*s.base);
  const loss=before-netWorth(s),t=T(s,'marriage',{kind:'custom',label:M('trk.divorce')});t.label=M('trk.divorce');t.v-=loss;t.note=M('note.divorce',{a:MN(loss)});s.married=false;s.happy-=12;L&&L(M('log.divorce',{a:MN(loss)}),'bad')},
 care:(s,x,L)=>{if(evR(s,'care')()>=.4)return;const amt=.8*s.base;s.rec.push({id:'',amt:amt*(s.ltc?.3:1),until:s.age+3,h:0});if(s.ltc){const t=s.trk.ltc;if(t){t.v+=amt*.7*3;t.note=M('note.ltcPaid',{a:MN(amt*.7*3)})}}L&&L(M(s.ltc?'log.careIns':'log.care',{a:MN(amt)}),'bad')},
 tripDebt:(s,x,L)=>{spend(s,'trip',x.a,'trk.trip');L&&L(M('log.tripDebt',{a:MN(x.a)}),'')},
 mentor:(s,x,L)=>{if(evR(s,'mentor')()<relP(s,x.p))refer(s,'mentorRef',1.1,'trk.mentorRef',L,'log.mentorRef')},
 credit:(s,x,L)=>{const u=evR(s,'credit')();if(u<relP(s,x.p)){bump(s,'credit',x.m,M('trk.credit'));L&&L(M('log.creditOk',{p:Math.round((x.m-1)*100)}),'good')}else if(x.bad&&u>1-x.bad){s.happy-=4;L&&L(M('log.creditBad'),'bad')}else L&&L(M('log.creditNo'),'')},
 network:(s,x,L)=>{if(evR(s,'network')()<relP(s,x.p))refer(s,'netRef',1.1,'trk.netRef',L,'log.netRef')},
 remote:(s,x,L)=>{const ok=evR(s,'remote')()<x.p;if(ok)bump(s,'away',1.12,M('trk.awayRemote'));L&&L(M(ok?'log.remoteOk':'log.remoteNo'),ok?'good':'')},
 bizpal:(s,x,L)=>{const u=evR(s,'bizpal')(),f=u<.25?3:u<.55?1:0,v=x.a*f;s.cash+=v;const t=s.trk.bizpal;if(t){t.v+=v;t.note=M('note.bizpal',{a:MN(x.a),b:MN(v)})}rl(s,f?4:-6);L&&L(M(f>1?'log.bizpalWin':f?'log.bizpalBack':'log.bizpalFail',{a:MN(x.a),b:MN(v)}),f?'good':'bad')},
 cosign:(s,x,L)=>{const t=s.trk.cosign;if(evR(s,'cosign')()<.3){pay(s,x.a);if(t){t.v-=x.a;t.note=M('note.cosignPaid',{a:MN(x.a)})}rl(s,-6);L&&L(M('log.cosignPaid',{a:MN(x.a)}),'bad')}else{if(t)t.note=M('note.cosignOk');L&&L(M('log.cosignOk'),'good')}},
 sib:(s,x,L)=>{const u=evR(s,'sib')();if(u<.45){const v=.8*x.a;s.cash+=v;const t=s.trk.sib;if(t){t.v+=v;t.note=M('note.repay',{a:MN(x.a),b:MN(v)})}L&&L(M('log.sibBack',{a:MN(v)}),'good')}else if(!(u<.75&&refer(s,'sibRef',1.06,'trk.sibRef',L,'log.sibRef'))){rl(s,2);L&&L(M('log.sibThanks'),'good')}},
 uncle:(s,x,L)=>{if(!s.uncle)return;if(evR(s,'uncle')()<.4){s.uncle=false;s.bump.uncle=1;const t=s.trk.uncle;if(t)t.note=M('note.uncleEnd',{a:MN(t.v)});if(s.job&&!s.retired){s.layAt=s.age;s.layVol=false}L&&L(M('log.uncleEnd'),'bad')}else L&&L(M('log.uncleOk'),'good')},
 court:(s,x,L)=>{const won=evR(s,'court')()<.5,v=x.a*(won?1.6:.7);s.cash+=v;const t=s.trk.inhfight;if(t){t.v+=v;t.note=M('note.court',{a:MN(v)})}L&&L(M(won?'log.courtWin':'log.courtLose',{a:MN(v)}),won?'good':'')},
 roof:(s,x,L)=>{if(!s.house||evR(s,'roof')()>=.5)return;const c=.3*s.base;pay(s,c);const t=s.trk.roof;if(t){t.spent+=c;t.g+=c}L&&L(M('log.roof',{a:MN(c)}),'bad')},
 /* the treatment's outcome. Simulated futures can't die (noDeath), so they only note it and carry on as survivors */
 ill:(s,x,L)=>{const T0=ILLT[x.tr];
  if(evR(s,'illSurv')()>=x.p){if(!s.noDeath){s.dead=true;s.deathAge=s.age;s.illDeath=s.illType;L&&L(M('log.illDie',{x:M('ill.'+s.illType)}),'bad');return}s.illDied=1}
  s.health=clamp(s.health-T0.h,3,100);s.happy=clamp(s.happy-6,0,100);s.ill={at:s.age,until:s.age+T0.y,off:T0.m/12};
  if(x.you>0)chipIn(s,x.you,'helpIll',L);L&&L(M('log.illOk'),'good')}
};

/* ---------- yearly resolutions ---------- */
function retire(s,L){s.retired=true;if(s.job){const c=CAR[s.job.id];if(c.pen)s.pension=c.pen*s.lastSal;const t=s.trk[s.job.tk];if(t)t.label=M('trk.car',{x:M('car.'+s.job.id),a:s.job.start,b:Math.max(s.job.start,s.age-1)})}
 if(s.biz&&s.biz.ok&&!s.biz.sold){const v=(s.biz.mode==='full'?3:2)*s.biz.inc;addLot(s,'bizsale',v);s.biz.sold=true;const t=s.trk.biz;if(t){t.v+=v;t.note=M('note.bizSold',{a:MN(v)})}L&&L(M('log.bizSold',{a:MN(v)}),'good')}
 for(const k in s.trk)if(s.trk[k].kind==='skill')s.trk[k].per=0;
 L&&L(M('log.retire',{age:s.age,p:s.pension?M('log.retireP',{a:MN(s.pension)}):''}),'good')}
function resolveBiz(s,L){const b=s.biz,r=evR(s,'bizout'),u=r(),u2=r();b.done=true;const t=s.trk.biz;const p=bizP(s)+(b.mode==='side'?.05:0);
 if(u<p){b.ok=true;b.inc=b.mode==='full'?Math.max(s.lastSal,s.base)*(1.3+u2*2.5):s.base*(.2+.4*u2);L&&L(M('log.bizOk',{a:MN(b.inc)}),'good');if(t)t.note=M('note.bizOk',{a:MN(b.inc)})}
 else{L&&L(M('log.bizFail',{a:MN(b.cap)}),'bad');if(t)t.note=M('note.bizFail');b.ok=false}}
function resolveCrypto(s,L){const u=evR(s,'coin')();const st=s.crypto.stake;const m=u<.18?6:u<.45?1.3:.1;const val=st*m;s.cash+=val;const t=s.trk.tip;if(t){t.v=val-st;t.note=M('note.coin',{a:MN(st),b:MN(val)})}
 L&&L(M(m>1.5?'log.coinBig':m>1?'log.coinUp':'log.coinDown',{a:MN(st),b:MN(val)}),m>1?'good':'bad');s.crypto=null}
function housing(s){
 if(!s.house){const m=s.age<s.rentUntil?s.rentMul:1,b=rent(s)*(s.costMul||1);if(m<1&&s.trk.move)s.trk.move.v+=b*(1-m);return b*m}
 const h=s.house,rt=h.rate||.03;let mp=0;if(h.mort>0){if(rt>.03&&s.trk.rates)s.trk.rates.v-=h.mort*(rt-.03);h.mort*=1+rt;mp=Math.min(h.pay,h.mort);h.mort-=mp;if(h.mort<1)h.mort=0}
 const mt=.01*h.value;h.out+=mp+mt;h.rentAv+=rent(s)*h.frac;const t=s.trk.home;if(t){t.v=h.value-h.mort+h.rentAv-h.out;t.note=M('note.home',{v:MN(h.value),l:MN(h.mort),r:MN(h.rentAv)})}return mp+mt}
const insNote=t=>M('note.ins',{p:MN(t.prem),c:MN(t.saved)});
/* gold and bonds have their own ups and downs; fixed-rate accounts grow steadily; some funds charge yearly fees */
function lotR(l,r,yr){return(l.rate!=null?l.rate:l.t==='gold'?.01+.15*yr.gd:l.t==='bond'?.015+.05*yr.bd:r)-(l.fee||0)}
/* yearly costs you signed up for (pets, gyms, premiums, helping parents); negative ones are income */
function recCost(s,a){let c=0;for(const r of s.rec){if(a>=r.until)continue;c+=r.amt;if(r.h)s.health+=r.h;const t=r.id&&s.trk[r.id];if(t&&r.amt){if(t.kind==='ghost'){t.spent+=r.amt;t.g+=r.amt}else{t.v-=r.amt;t.paid=(t.paid||0)+r.amt;t.note=M(r.amt<0?'note.earned':'note.paid',{a:MN(Math.abs(t.paid))})}}}return c}
/* money you put aside each year into plans: an insurance savings plan, a children's education fund, a retirement account */
function plans(s,a,work){let c=0;
 if(s.ilp&&a<s.ilp.until){c+=s.ilp.amt;addLot(s,'ilp',s.ilp.amt)}
 if(s.kidEdu==='fund')for(const b of s.kids)if(a<b+18){const x=s.kidFee/18;c+=x;addLot(s,'kidedu',x)}
 if(s.scheme&&work>0){const x=s.scheme.p*work,l=s.lots[s.scheme.lot];c+=x;addLot(s,s.scheme.lot,x);if(l)l.v+=x*s.scheme.rel+Math.min(s.scheme.p,s.scheme.match)*work}
 return c}
function kidFees(s,a,L){if(!s.kidEdu)return;for(const b of s.kids){if(a!==b+18)continue;
 if(s.kidEdu==='loan'){s.happy-=2;L&&L(M('log.kidLoan'),'');continue}
 let f=s.kidFee;const l=s.lots.kidedu;if(l&&l.v>0){const x=Math.min(l.v,f);l.v-=x;l.tout+=x;f-=x}
 if(f>0){pay(s,f);const t=T(s,'kidfees',{kind:'custom',label:M('trk.kidFees')});t.v-=f;t.note=M('note.paid',{a:MN(-t.v)})}
 L&&L(M('log.kidUni',{a:MN(s.kidFee)}),'good')}}

/* ---------- one year of life ---------- */
function tick(s,yr,L){
 const a=s.age,B=s.base,fo=s.focus,out={gross:0,saved:0},cm=s.costMul||1;
 if(!s.retired&&s.retireAge&&a>=s.retireAge)retire(s,L);
 if(s.biz&&!s.biz.done&&a>=s.biz.res)resolveBiz(s,L);
 if(s.crypto&&a>=s.crypto.res)resolveCrypto(s,L);
 if(s.outUntil&&a===s.outUntil){const amt=Math.min(Math.max(0,s.cash),s.sold);s.cash-=amt;addLot(s,'auto',amt);L&&L(M('log.buyBack',{a:MN(amt)}),'')}
 if(s.later.length){for(const x of s.later)if(!x.done&&a>=x.age){x.done=1;LATER[x.k](s,x,L)}s.later=s.later.filter(x=>!x.done)}
 if(s.dead)return out; // a serious illness can end a life at the start of the year
 kidFees(s,a,L);
 /* depression halves what your focus does; therapy is paid as you go */
 const dp=depressed(s),fk=dp?.5:1;
 if(dp&&s.dep.how==='ther'){const c=depFee(s);if(s.retired)payRet(s,c);else pay(s,c);const t=s.trk.dep;if(t){t.paid+=c;t.v-=c;t.note=depNote(t)}}
 if(s.annu){s.cash+=s.annu;s.earned+=s.annu;const t=s.trk.annuity;if(t){t.v+=s.annu;t.got=(t.got||0)+s.annu;t.note=M('note.annuity',{a:MN(t.cost),b:MN(t.got)})}}
 let r=Math.max(-.45,yr.mkt);if(a===s.crashAge)r=.18;else if(a===s.crashAge+1)r=.15;
 for(const k in s.lots){const l=s.lots[k];l.v*=1+lotR(l,r,yr)}
 if(s.cash>0){if(s.efund&&s.trk.efund)s.trk.efund.v+=.015*s.cash;s.cash*=s.efund?1.005:.99}
 for(const id in s.trk){const t=s.trk[id];if(t.kind==='ghost')t.g*=1+r;else if(t.kind==='crash'){t.hold*=1+r;t.sell*=(a<s.crashAge+3?.99:1+r)}}
 if(s.house)s.house.value*=1+.012+yr.hs*.05;
 if(s.debt>0){s.debt*=1.18;debtCap(s)}
 const sk=skill(s),lf0=clamp(s.life+s.habit,.3,1);
 if(a>=18){
  if(s.study){
   const st=s.study,part=st.pt*B;s.earned+=part;out.gross=part;
   const t=s.trk.sk_edu;if(t)t.cost+=Math.max(0,carStartPay(s,'civ')-part);
   const d=part-.35*B;if(d>=0){s.cash+=d;out.saved=d}else{const fc=Math.min(Math.max(0,s.cash),-d);s.cash-=fc;s.sloan+=-d-fc;out.saved=d}
   addSkill(s,'edu',st.gain,st.label);if(fo==='learn')addSkill(s,'learn',fk,M('trk.learn'));
   if(a+1>=st.end){s.study=null;s.sloanPay=s.sloan>0?amort(s.sloan,.03,10):0;L&&L(M('log.grad',{x:s.sloan>0?M('log.gradLoan',{a:MN(s.sloan)}):M('log.gradNo')}),'good')}
  }else if(!s.retired){
   if(s.job)careerStart(s,yr,L);
   const sal=s.job?salary(s):0;s.lastSal=sal;
   if(s.sex==='f'&&sal>0&&!s.study){const full=sal/sexPay(s),g=gapM(s),lg=full*(1-g),lm=full*g-sal;
    if(lg>0){const t=T(s,'ggap',{kind:'custom',label:M('trk.ggap'),lost:0});t.lost+=lg;t.v-=lg;t.note=M('note.ggap',{a:MN(t.lost),p:Math.round((1-g)*100)})}
    if(lm>0){const t=T(s,'mompen',{kind:'custom',label:M('trk.mompen'),lost:0});t.lost+=lm;t.v-=lm;t.note=M('note.mompen',{a:MN(t.lost),p:CHILDPEN[workCode(s)]})}}
   const full=!!(s.biz&&s.biz.mode==='full'),tb=s.trk.biz;
   let work=sal;
   if(full){if(!s.biz.done){work=.3*sal;if(tb){tb.v-=.7*sal}}else if(s.biz.ok){work=s.biz.inc;if(tb){tb.v+=s.biz.inc-sal;tb.note=M('note.bizFull',{a:MN(s.biz.inc),b:MN(sal)})}s.biz.inc*=1.04}}
   const employed=!!s.job&&!(full&&(!s.biz.done||s.biz.ok));
   if(employed){
    if(fo==='learn'){const c=.06*work;work-=c;const t=T(s,'sk_learn',{kind:'skill',label:M('trk.learn')});t.cost+=c}
    if(fo==='grind')work*=1+.05*fk;
    if(s.pivotYear===a){const c=.5*work;work-=c;if(s.trk.sk_pivot)s.trk.sk_pivot.cost+=c}
    if(s.cert&&a<s.cert.end&&s.cert.kind==='mba'){const c=.1*work;work-=c;if(s.trk.sk_cert)s.trk.sk_cert.cost+=c}
    if(s.offUntil>a){const t=s.trk.carers;if(t){t.v-=work;t.note=M('note.carers',{a:MN(-t.v)})}work=0}
    /* months off for a serious illness; depression costs 30% of pay (four months off instead, in the year you take time off) */
    if(s.ill&&s.ill.at===a){const c=s.ill.off*work,t=s.trk.ill;work-=c;if(t){t.lost+=c;t.v-=c;t.note=illNote(t)}}
    if(dp){const c=(s.dep.how==='off'&&s.dep.at===a?.33:.3)*work,t=s.trk.dep;work-=c;if(t){t.lost+=c;t.v-=c;t.note=depNote(t)}}
    /* layoffs: each career has its own risk, much higher in a crash year (none while training); a switch card follows */
    const cr=CAR[s.job.id],trn=s.job.train>a,lp=trn?0:cr.lay[a===s.crashAge?1:0];
    if(yr.jl<lp||s.layAt===a){work*=.5;L&&L(M(s.layAt===a&&s.layVol?'log.layVol':'log.laidOff'),'bad');offerSwitch(s,'lay')}
    const den=1+SK*sk;
    for(const k in s.skillSrc){if(k==='base')continue;const t=s.trk['sk_'+k];if(!t)continue;const ex=sal*SK*s.skillSrc[k]/den;t.gain+=ex;t.per=ex}
    if(s.levelGrind&&s.trk.grind){const t=s.trk.grind,ex=sal*.18*s.levelGrind/(1+.18*s.level);t.gain+=ex;t.per=ex}
    for(const k in s.bump){const t=s.trk[k];if(t)t.v+=sal*(1-1/s.bump[k])}
    carPaid(s,work);
    let pp=.07+(fo==='grind'?.08*fk:0)+sk*.0015+(s.rel-50)*.0008;pp*=cr.pp||1;if(s.uncle)pp*=.7;if(dp)pp*=.4;
    if(fo==='grind')s.grindY++;
    if(cr.gr>0&&!trn&&s.level<6&&yr.pr<pp){s.level++;if(fo==='grind'){s.levelGrind++;T(s,'grind',{kind:'skill',label:M('trk.grind')})}L&&L(M('log.promo',{n:s.level,a:MN(salary(s))}),'good')}
    if(!trn)s.exp++;
    /* good Relationships bring referrals: someone you know recommends you for a better-paid job (twice at most) */
    if(s.refN<2&&s.rel>55&&evR(s,'ref')()<(s.rel-55)/350){s.refN++;refer(s,'ref'+s.refN,1.08,'trk.referral',L,'log.referral')}
   }
   if(employed&&s.job)careerEnd(s,L);
   let hus=0;if(fo==='hustle'){s.hustleYears++;hus=B*.08*(1+.2*Math.min(s.hustleYears,10))*(1+SK*sk*.5)*fk;const t=T(s,'hustle',{kind:'custom',label:M('trk.hustle'),yrs:0});t.v+=hus;t.yrs++;t.note=M('note.hustle',{n:t.yrs,a:MN(hus)})}
   let side=0;if(s.biz&&s.biz.mode==='side'&&s.biz.ok&&!s.biz.sold){side=s.biz.inc;s.biz.inc*=1.06;if(tb){tb.v+=side;tb.note=M('note.bizSide',{a:MN(side)})}}
   const gross=work+hus+side,net=netOf(s,gross);
   const hs=housing(s),liv=.5*B*cm;
   let fixed=liv+hs;
   if(s.trk.abroad&&cm>1)s.trk.abroad.v-=(liv+(s.house?0:hs))*(1-1/cm);
   const kc=kidsCost(s,a);if(kc){fixed+=kc;const t=s.trk.kids;if(t){t.cost+=kc;t.v-=kc;t.note=M('note.kids',{c:MN(t.cost)})}}
   fixed+=s.car?.05*B:.03*B;
   const ct=s.car&&s.trk[s.car.trk||'car'];
   if(ct){ct.spent+=.02*B;ct.g+=.02*B}
   if(s.car&&s.car.bal>0){s.car.bal*=1.06;const p=Math.min(s.car.pay,s.car.bal);s.car.bal-=p;if(s.car.bal<1)s.car.bal=0;fixed+=p;if(ct){ct.spent+=p;ct.g+=p}}
   if(s.sloan>0){s.sloan*=1.03;const p=Math.min(s.sloanPay||s.sloan*.12,s.sloan);s.sloan-=p;fixed+=p;if(s.sloan<1){s.sloan=0;L&&L(M('log.loanPaid'),'good')}}
   if(s.insured){const p=.035*B*s.insMul;fixed+=p;const t=s.trk.ins;if(t){t.prem+=p;t.v-=p;t.note=insNote(t)}}
   if(fo==='learn'&&employed){fixed+=.03*B;const t=s.trk.sk_learn;if(t)t.cost+=.03*B}
   if(fo==='people'){const c=.03*B;fixed+=c;const t=T(s,'people',{kind:'ghost',label:M('trk.people')});t.spent+=c;t.g+=c}
   if(s.debt>0){const p=.25*s.debt;s.debt-=p;fixed+=p}
   fixed+=recCost(s,a)+plans(s,a,employed?work:0);
   let avail=net-fixed,saved=0;
   if(s.efund&&avail>0&&s.cash<s.efund){const x=Math.min(avail,s.efund-s.cash);s.cash+=x;avail-=x;saved+=x}
   let auto=0;
   if(s.savePct>0&&avail>0){auto=Math.min(net*s.savePct,avail);if(s.outUntil>a)s.cash+=auto;else addLot(s,'auto',auto)}
   const sur=avail-auto;saved+=auto;
   if(sur>=0){const lf=(s.cutDebt&&s.debt>0)?.4:lf0;let sv=sur-lf*sur;if(s.trk.habit)s.trk.habit.v-=s.habit*sur;if(s.trk.life){const d=(s.life-.85)*sur;s.trk.life.spent+=d;s.trk.life.g+=d}if(s.debt>0){const p=Math.min(sv,s.debt);s.debt-=p;sv-=p}s.cash+=sv;saved+=sv}
   else{pay(s,-sur);saved+=sur}
   if(s.cutDebt&&s.debt<=0)s.cutDebt=false;
   if(s.debt>0&&s.cash>.2*B){const p=Math.min(s.debt,s.cash-.2*B);s.cash-=p;s.debt-=p}
   if(s.debt<1)s.debt=0;
   s.earned+=gross;out.gross=gross;out.saved=saved;
  }else{
   let side=0;if(s.biz&&s.biz.mode==='side'&&s.biz.ok&&!s.biz.sold)side=s.biz.inc;
   const r2=s.ret2&&a<s.ret2.until?s.ret2.inc:0;if(r2&&s.trk.ret2){const t=s.trk.ret2;t.v+=r2;t.note=M('note.earned',{a:MN(t.v)})}
   const inc=s.pension+.18*B+side+r2;s.earned+=inc;out.gross=inc;
   if(s.pension&&s.trk.gov){const t=s.trk.gov;t.recv+=s.pension;t.v+=s.pension;t.note=M('note.pension',{p:MN(s.pension),r:MN(t.recv),l:MN(t.lost)})}
   let need=.5*B*cm+.25*B*(lf0/.85)+housing(s)+(s.car?.05*B:.03*B);
   const kc=kidsCost(s,a);if(kc){need+=kc;const t=s.trk.kids;if(t){t.cost+=kc;t.v-=kc;t.note=M('note.kids',{c:MN(t.cost)})}}
   if(s.insured){const p=.035*B*s.insMul;need+=p;const t=s.trk.ins;if(t){t.prem+=p;t.v-=p;t.note=insNote(t)}}
   if(s.debt>0){const p=.25*s.debt;s.debt-=p;need+=p}
   need+=recCost(s,a)+plans(s,a,0);
   const d=inc-need;
   if(d>=0){s.cash+=d;out.saved=d}else{const short=payRet(s,-d);out.saved=d;if(short>0){s.happy-=4;if(!s.brokeLogged){s.brokeLogged=1;L&&L(M('log.broke'),'bad')}
    if(s.rel>=40&&evR(s,'helpBroke')()<(s.rel-30)/100){const h=.5*short;s.cash+=h;helped(s,h);L&&L(M('log.helpBroke',{a:MN(h)}),'good')}}}
  }
  // body and mind
  if(a>=40)s.health-=.7;if(a>=65)s.health-=.6;
  /* while recovering from a serious illness you can't build Health back up */
  const hk=sick(s)?0:fk;
  if(s.retired)s.health+=.5*hk;else if(!s.study){if(fo==='balance')s.health+=2.5*hk;if(fo==='people')s.health+=hk;if(fo==='grind')s.health-=2.5;if(fo==='hustle')s.health-=1}
  if(dp)s.health-=1.5;
  if(job(s)){const hd=CAR[s.job.id].hd||0;s.health+=hd>0?hd*hk:hd}
  s.health=clamp(s.health,3,100);
  if(a>=25&&s.illAge<0&&evR(s,'illRoll')()<illP(s)){s.illAge=a+1;const u=evR(s,'illType')();s.illType=u<.45?'cancer':u<.8?'heart':'stroke'}
  const mp=.02+Math.max(0,70-s.health)/900+a/3500;
  if(yr.md<mp){const bill=B*.6*(.5+yr.ma*1.5)*(s.screen?.7:1);let you=bill;if(s.insured){you=.15*bill;const t=s.trk.ins;if(t){t.saved+=bill-you;t.v+=bill-you;t.note=insNote(t)}}
   if(s.retired)payRet(s,you);else pay(s,you);s.health=clamp(s.health-4,3,100);L&&L(M('log.med',{a:MN(bill),x:s.insured?M('log.medIns',{c:MN(bill-you)}):M('log.medSelf')}),'bad');
   chipIn(s,you,'helpMed',L)}
  const nw=netWorth(s);let tg=48+9*Math.log10(1+Math.max(0,nw)/B)-(s.debt>.3*B?10:0)+(s.married?4:0)+Math.min(3,s.kids.length)*2+(s.health-60)/8;
  tg+=(s.rel-50)/12;
  if(!s.retired&&!s.study){if(fo==='balance')tg+=5*fk;if(fo==='grind')tg-=5;if(fo==='people')tg+=3*fk}
  if(sick(s))tg-=8;
  if(job(s))tg+=CAR[s.job.id].hp||0;
  if(s.retired&&s.rel<35){tg-=6;if(!s.lonely){s.lonely=1;L&&L(M('log.lonely'),'bad')}}
  s.happy=clamp(s.happy+(tg-s.happy)*.25,0,100);
  // two years in a row of low Happiness can bring on depression (once a life; it shows as a decision next year)
  s.lowHap=s.happy<35?s.lowHap+1:0;
  if(s.lowHap>=2&&!s.dep&&s.depAge<0&&evR(s,'depRoll')()<.5)s.depAge=a+1;
  // Relationships drift down unless you give people time; marriage, children and retirement help, and they pull back toward the middle
  let dr=-1+(s.married?.4:0)+.2*Math.min(3,s.kids.length)+(45-s.rel)*.05;
  if(s.retired)dr+=.5;else if(!s.study){const fd={people:4,balance:1.5,learn:0,grind:-1,hustle:-.6}[fo]||0;dr+=fd>0?fd*fk:fd}
  rl(s,dr);
  if(s.married&&s.rel<25&&!s.later.some(x=>x.k==='div')&&evR(s,'lowrel')()<.04)later(s,a+1,'div',{p:1});
  // skills for next year
  if(a>=45&&s.done.pivot==='stay'&&!s.retired)s.skillSrc.base=Math.max(0,s.skillSrc.base-.8);
  if(!s.retired&&!s.study){
   if(s.job&&s.job.id==='start')addSkill(s,'startup',1.5,M('trk.startupSkill'));
   if(fo==='learn'){addSkill(s,'learn',(a<50?3.5:2)*fk,M('trk.learn'));const t=s.trk.sk_learn;if(t){t.years=(t.years||0)+1;t.label=M('trk.learnN',{n:t.years})}}
   if(s.cert&&a<s.cert.end)addSkill(s,'cert',7,s.cert.label);
  }
  for(const b of s.kids)if(b===a)L&&L(M('log.child'),'good');
  if(s.ill&&!s.ill.over&&a+1>=s.ill.until){s.ill.over=1;s.health=clamp(s.health+6,3,100);L&&L(M('log.illRec'),'good')}
  if(s.dep&&!s.dep.over&&a+1>=s.dep.until){s.dep.over=1;s.happy=clamp(s.happy+8,0,100);L&&L(M('log.depEnd'),'good')}
  // lifespan: each year adds that year's risk of dying; you die once the total passes the luck drawn at birth (dieAt).
  // The odds at each age are the same as a fresh roll every year, but a lower risk (a woman's longer life, better health)
  // reliably means a later death for the same luck, so the mirror life compares fairly
  if(!s.noDeath){const Mx=s.le+8,bg=.09;let mu=bg*Math.exp(bg*(a-Mx))*Math.exp((60-s.health)/40)+.0006;if(a>=104)mu=99;s.hz+=mu;if(s.hz>=s.dieAt){s.dead=true;s.deathAge=a;return out}}
 }else{s.happy=clamp(s.happy,0,100);s.health=clamp(s.health,3,100)}
 s.age++;
 return out;
}

/* ---------- passbook lines ---------- */
function trkView(s,t){
 if(t.kind==='skill'){const v=t.gain-t.cost;const per=t.per>0?M('nv.per',{a:MN(t.per)}):'';return{v,note:t.cost>0?M('nv.skillC',{g:MN(t.gain),c:MN(t.cost),per}):M('nv.skill',{g:MN(t.gain),per})}}
 if(t.kind==='ghost'){if(t.spent<0)return{v:-t.spent,note:M('nv.saved',{a:MN(-t.spent)})};return{v:-t.g,note:M('nv.spent',{a:MN(t.spent),b:MN(t.g)})}}
 if(t.kind==='lot'){const l=s.lots[t.src]||{v:0,tin:0,tout:0};return{v:l.v+l.tout-l.tin,note:M('nv.lot',{a:MN(l.tin),b:MN(l.v),o:l.tout>1?M('nv.lotOut',{c:MN(l.tout)}):''})}}
 if(t.kind==='crash'){const v=t.mode==='sell'?t.sell-t.hold:t.hold-t.sell;return{v,note:t.mode==='sell'?M('nv.crashSell',{a:MN(t.sell),b:MN(t.hold)}):M('nv.crashHold',{a:MN(t.hold),b:MN(t.sell)})}}
 return{v:t.v,note:t.note||''}
}

/* ---------- the same life as the other sex ----------
   Same seed (family, markets, luck), the same option wherever the same decision comes up (the default otherwise), and the same
   focus each year (foc: age → focus). Records net worth and lifetime pay at age `at` for a fair comparison. */
function mirrorLife(s0,foc,at){const m=newLife(s0.ci,s0.seed,s0.sex==='f'?'m':'f');let g=0;
 while(!m.dead&&g++<130){let k=0,ev;while((ev=dueEvents(m)[0])&&k++<40)applyOpt(m,ev,s0.done[ev.id]!=null?s0.done[ev.id]:ev.def);
  if(foc[m.age])m.focus=foc[m.age];if(m.age===at){m.nwAt=netWorth(m);m.earnAt=m.earned}tick(m,yearRand(m.seed,m.age),null)}
 if(m.nwAt==null){m.nwAt=netWorth(m);m.earnAt=m.earned}return m}

/* ---------- simulated futures ---------- */
function MC(s,fn,N,tgt){const res=[];for(let i=0;i<N;i++){const c=clone(s);c.noDeath=true;c.seed=hsh(s.seed,'mc',i);
  if(c.crashAge>c.age){const r=mb(hsh(c.seed,'cr'))();const lo=Math.max(c.age+1,34);c.crashAge=lo>50?lo:lo+Math.floor(r*(51-lo))}
  fn(c);let g=0;while(c.age<tgt&&!c.dead&&g++<130){resolveAuto(c);tick(c,yearRand(c.seed,c.age),null)}res.push([netWorth(c),c.earned,c.illDied?0:1])}return res}
/* for an event with `surv` (a serious illness) each option also gets `alive`: the share of futures that survived it */
function projectEvent(s,ev,N){const P=projBegin(s,ev,N);while(P.todo.length)projNext(s,ev,P);return P}
/* the same in steps, so a card with many options (careers) can fill in its projections without freezing the page:
   projBegin runs the default option's futures, then each projNext runs one more option */
function projBegin(s,ev,N){const tgt=s.age<58?60:s.age+12,base=MC(s,c=>applyOpt(c,ev,ev.def),N,tgt),res={},todo=[];
 for(const o of ev.opts(s)){if(o.ok!==undefined&&o.ok!==true)continue;if(o.id===ev.def){res[o.id]={base:true};if(ev.surv)res[o.id].alive=aliveOf(base,N)}else todo.push(o.id)}
 return{tgt,res,todo,base,N}}
const aliveOf=(r,N)=>r.reduce((a,x)=>a+x[2],0)/N;
function projNext(s,ev,P){const id=P.todo.shift();if(id==null)return;const N=P.N,base=P.base;
 const r=MC(s,c=>applyOpt(c,ev,id),N,P.tgt);const d=r.map((x,i)=>x[0]-base[i][0]).sort((a,b)=>a-b);const e=r.map((x,i)=>x[1]-base[i][1]).sort((a,b)=>a-b);
 P.res[id]={med:d[N>>1],lo:d[Math.floor(N*.1)],hi:d[Math.min(N-1,Math.floor(N*.9))],earn:e[N>>1]};if(ev.surv)P.res[id].alive=aliveOf(r,N)}
function projectFocus(s,N){const tgt=s.age<55?60:s.age+5;const runs={};for(const f of['learn','grind','hustle','balance','people'])runs[f]=MC(s,c=>{c.focus=f},N,tgt);const out={};
 for(const f of['learn','grind','hustle','people']){const e=runs[f].map((x,i)=>x[1]-runs.balance[i][1]).sort((a,b)=>a-b);const n=runs[f].map((x,i)=>x[0]-runs.balance[i][0]).sort((a,b)=>a-b);out[f]={earn:e[N>>1],nw:n[N>>1]}}
 return{tgt,out}}
