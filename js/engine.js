/* A Second Chance simulation engine: countries, life events, yearly money model, simulated futures.
   Every piece of text is a message descriptor M(key, vars) that js/i18n.js turns into
   English, Simplified or Traditional Chinese when it is shown. Money vars use MN() / MS(). */
const SK=.012;
/* ---------- difficulty (game rules, not data) ----------
   Easy keeps the original game's rules. Normal and Hard add, per life (s.dk, set by newLife):
   pay     pay grows less with Skill, promotions and experience (the Easy growth to this power)
   tax     an extra tax[1] on pay above tax[0] typical wages
   toll    long-hours careers (the ones that cost Happiness) take this many times more Happiness and Health, and time from people
   frug    Happiness target lost per point of pay saved above 10% (and for living below your means)
   wcap    wealth stops making you happier past this many years of a typical wage
   creep   share of take-home pay above a typical wage that goes on a bigger lifestyle
   rise    rents and home prices rise this much faster than pay, a year
   med, lay  more medical bills and layoffs
   shock   yearly chance of an unexpected bill (the car, the flat, a family emergency, a fine, a theft)
   lost    chance of a lost decade, ten years when stocks go nowhere (often right after the crash)
   crash   share of their value stocks keep in the crash (a range: some crashes are deeper)
   learn   degrees, courses and the Learn focus teach this share of the usual Skill (a range)
   trainFail chance of failing the final exams of medical or law training */
const DF={
 easy:{pay:1,toll:1,tax:[0,0],frug:0,wcap:1e9,creep:0,rise:0,med:1,lay:1,shock:0,lost:0,crash:[.62,.62],learn:[1,1],trainFail:0},
 normal:{pay:.6,toll:2.5,tax:[2,.25],frug:.3,wcap:8,creep:.2,rise:.005,med:1.3,lay:1.3,shock:.07,lost:.45,crash:[.5,.75],learn:[.5,1.3],trainFail:.2},
 hard:{pay:.5,toll:3.5,tax:[1.6,.3],frug:.4,wcap:5,creep:.25,rise:.01,med:1.6,lay:1.7,shock:.11,lost:.6,crash:[.42,.7],learn:[.35,1.2],trainFail:.3}};
const D=s=>DF[s.dk]||DF.easy;
const inR=(r,[a,b])=>a+(b-a)*r;
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
/* ---------- real-world chances (RD, js/data.js, written by tools/fetch-data.js) ----------
   RD holds published figures for every country, each with its source and year in js/data.js: World Bank (with the UN Population
   Division, ILO, UNESCO, WHO and IMF figures it republishes), WHO Global Health Estimates and EM-DAT. Where a figure only sets how
   countries differ, it is divided by the average of the 17 countries weighted by births (rdAvg: lives come up in proportion to
   births), so the game's overall level over all lives (tuned with tools/balance.js) stays where it was. How each one is used:
   - serious illness: the yearly chance (illP) × the country's chance of dying between 30 and 70 from heart disease, stroke, cancer,
     diabetes or chronic lung disease (RD.ncd) ÷ the 17-country average (rdAvg). Whether it is cancer, a heart attack or a stroke follows the
     country's death rates from each at your age (RD.deaths, ages 15–49, 50–69 and 70+)
   - meeting someone and marrying, from the country's average age at first marriage for your sex (RD.smamF, RD.smamM): before that
     age the yearly chance of meeting someone (meetP) is 1 ÷ (that age − 23) (at least 14% a year, as before, and at most 60%); after
     it, the game's older bands (14%, 9%, 5%) move with the difference from the 17-country average. Lives nobody steers (autoRel)
     marry from four years before that age, after at least a year together, and move in together after two years if they haven't
     married yet. The 23 and the four years were set with a simulation (300 such lives a country) so that their first marriages
     come at about the published average age, for women and for men
   - children: lives nobody steers aim for the country's children per woman (RD.tfr), rounded up or down at random so the average
     matches (kidGoal), trying most years once married; in a simulation they end up with 76–95% of the country's figure (some lives
     end early, some couples part or don't have children). Women who marry younger than 20 in the data (Bangladesh, India, Nigeria)
     marry a few years later in the game, which has no dating before 18
   - layoffs: each career's yearly layoff chance × the unemployment rate where you work (RD.unemp) ÷ the 17-country average (rdAvg)
   - money left in cash: it loses 1% a year (a game rule, as before), plus inflation above what the country is used to: each year
     one year of its record since 2000 (RD.infl) is drawn at random, and whatever that year's inflation was above the record's
     median is lost. Savings accounts roughly keep up with the inflation a country is used to; surprises eat into cash
   - natural disasters (hazards): the yearly chance that a flood, a storm or a drought reaches you is the share of people EM-DAT
     records as affected by it a year where you live (RD.disasters, average 2000–2024). Floods and storms damage your home (less
     with the cover or preparation from the flood cards: s.prot); droughts raise food and water costs and hit farm work.
     Earthquakes come with Japan's earthquake card, at Japan's recorded rate (disP)
   - road accidents (hazards): the yearly chance of a serious road injury is the road death rate where you live (RD.road) × ROADK,
     from WHO's "Road traffic injuries" fact sheet (who.int, fetched 2026-10-21): about 1.16 million people killed a year and
     "between 20 and 50 million more" injured; ROADK uses the low end, 20 ÷ 1.16
   - school (newLife): the chance of leaving school before finishing primary school (at 11) or lower secondary school (at 15) is
     1 − the completion rate (RD.prim, RD.lsec; rates above 100 count as 100). After school, the chance of a university place is
     university enrolment ÷ lower secondary completion (RD.tert ÷ RD.lsec, at most 100%); a top student (Skill 26+, the
     scholarship on the education card) always gets one. The published rates have no split by family, so every family gets the
     national rate.
   How much a disaster or an accident costs and hurts are game rules (ESTIMATES), not data. */
/* the 17-country average, weighted by births (C[i][2]: how often each country comes up), so the level over all lives stays the same */
const rdAvg=t=>{let a=0,w=0;for(const c of C){a+=c[2]*t[c[1]];w+=c[2]}return a/w};
const RDA={ncd:rdAvg(RD.ncd),unemp:rdAvg(RD.unemp),smamF:rdAvg(RD.smamF),smamM:rdAvg(RD.smamM)};
const ROADK=20/1.16;
const INFL_MED={};for(const k in RD.infl){const l=[...RD.infl[k]].sort((a,b)=>a-b),n=l.length;INFL_MED[k]=n%2?l[(n-1)/2]:(l[n/2-1]+l[n/2])/2}
/* average age at first marriage for a sex in a country, and how far it is from the 17-country average */
const smam=(k,sex)=>(sex==='f'?RD.smamF:RD.smamM)[k];
const smamD=s=>smam(C[s.ci][1],s.sex)-RDA[s.sex==='f'?'smamF':'smamM'];
/* layoffs where you work, relative to the 17-country average */
const layC=s=>RD.unemp[C[s.abroad!=null?s.abroad:s.ci][1]]/RDA.unemp;
/* how many children a life nobody steers aims for: the country's children per woman, rounded up or down at random */
function kidGoal(s){if(s.kidGoal==null){const T=RD.tfr[C[s.ci][1]];s.kidGoal=Math.floor(T)+(mb(hsh(s.seed,'kidGoal'))()<T%1?1:0)}return s.kidGoal}
/* the chance of a university place after school (see above) */
const uniRate=s=>{const k=C[s.ci][1];return Math.min(1,RD.tert[k]/Math.min(100,RD.lsec[k]))};
/* the chance a disaster reaches you within yrs years where you live: floods and storms ('fs'), or one kind of RD.disasters */
function disP(s,yrs,kind){const z=RD.disasters[C[s.abroad!=null?s.abroad:s.ci][1]],a=(kind?z[kind]:z.flood+z.storm)/1e5;return 1-Math.pow(1-a,yrs)}
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
/* free=true leaves out retirement accounts that are still locked (l.lock is the age they open, or retiring) */
const locked=(s,l)=>l.lock>s.age&&!s.retired;
function eqTot(s,free){let t=0;for(const k in s.lots)if(!free||!locked(s,s.lots[k]))t+=s.lots[k].v;return t}
/* "market" lots follow the stock market; gold, bonds and fixed-rate accounts (deposits, EPF, CPF) do not */
const isMkt=l=>l.rate==null&&!l.t;
function mktTot(s){let t=0;for(const k in s.lots)if(isMkt(s.lots[k]))t+=s.lots[k].v;return t}
function liquid(s){return Math.max(0,s.cash)+eqTot(s,1)}
function addLot(s,src,a){if(!(a>0))return;const l=s.lots[src]||(s.lots[src]={v:0,tin:0,tout:0});l.v+=a;l.tin+=a}
function mkLot(s,src,props,lk){const l=s.lots[src]||(s.lots[src]={v:0,tin:0,tout:0});Object.assign(l,props||{});if(lk)T(s,'lot_'+src,{kind:'lot',src,label:M(lk)});return l}
function withdrawEq(s,amt){const tot=eqTot(s,1);if(tot<=0||amt<=0)return 0;const take=Math.min(amt,tot),fr=take/tot;for(const k in s.lots){const l=s.lots[k];if(locked(s,l))continue;const x=l.v*fr;l.v-=x;l.tout+=x}return take}
/* banks stop lending at about two years of a typical wage; past that you go without, which costs Happiness, and the
   end grade still counts what you couldn't pay (acc.gw, in years of a typical wage), unpaid interest included */
const debtCap=(s,quiet)=>{if(s.debt>2*s.base){const x=(s.debt-2*s.base)/s.base;s.debt=2*s.base;s.acc.gw=(s.acc.gw||0)+x;if(!quiet)s.happy=clamp(s.happy-25*x,0,100)}};
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
 let v=s.base*carR(s,j.id)*(j.tier||1)*(j.own||1)*(j.yv==null?1:j.yv)*Math.pow((1+SK*skill(s))*(1+.18*c.gr*s.level)*(1+.015*c.gr*Math.min(s.exp,25)),D(s).pay);
 if(c.fl&&v<c.fl*s.base)v=c.fl*s.base;return v>0?v*pm(s)*sexPay(s):v}
function netOf(s,g){const x=D(s).tax;return g-Math.max(0,g-.4*s.base)*.18-Math.max(0,g-x[0]*s.base)*x[1]}
function price(s){return s.hm*s.base}
function rent(s){return .03*price(s)}
function mPay(L){return amort(L,.03,30)}
function carPay(P){return amort(P,.06,5)}
/* what your parents leave you; less what they spent on extras for you as a child (famSpent, see famPay in js/verbs.js), with what it
   could have grown to, down to a quarter of it (game rule) */
function inhAmt(s){const m=s.fam==='rich'?6:1.2;return Math.max(.25*m,m-1.5*(s.famSpent||0))*s.base}
function bizP(s){return Math.min(.75,.16+skill(s)*.004+s.hustleYears*.025)}
function eduCost(s,k){const fp={rich:1,middle:.5}[s.fam]||0;const sc=(k==='uni'&&skill(s)>=26)?.6:0;return s.uni*s.base*(k==='uni'?1:.35)*(1-fp)*(1-sc)}
function kidsCost(s,a){let c=0;for(const b of s.kids)if(a>=b&&a<b+22)c+=.15*s.base;return c}
function evR(s,k){return mb(hsh(s.seed,s.age,k))}
function yearRand(seed,age){const r=mb(hsh(seed,'y',age));return{mkt:.05+.16*gauss(r),hs:gauss(r),d:r(),md:r(),ma:r(),jl:r(),pr:r(),gd:gauss(r),bd:gauss(r)}}
function clone(s){return JSON.parse(JSON.stringify(s))}
function netWorth(s){let n=s.cash+eqTot(s)-s.debt-s.sloan;if(s.crypto)n+=s.crypto.stake;if(s.house)n+=s.house.value-s.house.mort;if(s.car&&s.car.bal)n-=s.car.bal;if(s.biz&&s.biz.ok&&!s.biz.sold)n+=(s.biz.mode==='full'?2:1)*s.biz.inc;return n}

function newLife(ci,seed,sex,dk){const r=mb(hsh(seed,'birth'));const c=C[ci];const u=r();const fam=u<.3?'poor':u<.68?'working':u<.92?'middle':'rich';
 const s={ci,base:c[3],le:c[4],hm:c[5],uni:c[6],fam,seed,age:0,dead:false,deathAge:null,
  skillSrc:{base:{poor:8,working:13,middle:19,rich:25}[fam]},health:70+Math.floor(r()*12),happy:60,
  cash:0,debt:0,sloan:0,sloanPay:0,lots:{},house:null,car:null,job:null,level:0,levelGrind:0,exp:0,
  study:null,cert:null,savePct:0,life:.85,insured:false,married:false,kids:[],biz:null,crypto:null,
  focus:'balance',hustleYears:0,retireAge:null,retired:false,pension:0,
  crashAge:34+Math.floor(r()*17),inheritAge:46+Math.floor(r()*14),
  done:{},trk:{},earned:0,outUntil:0,sold:0,lastSal:0,lastInc:0,pivoted:false,pivotYear:-1,
  cutDebt:false,debtSeen:-99,noDeath:false,milestones:{},brokeLogged:0,
  plan:{},spare:{},lastDec:4,later:[],rec:[],bump:{},costMul:1,rentMul:1,rentUntil:0,habit:0,efund:0,abroad:null,scheme:null,ilp:null,
  kidEdu:null,kidFee:0,famSpent:0,annu:0,ret2:null,layAt:-1,layVol:false,screen:false,ltc:false,insMul:1,
  rel:50,offUntil:0,uncle:false,refN:0,lonely:0,
  pt:null,ptN:0,meetAt:null,meetCar:null,look:-1,tryAt:null,ask:null,heal:null,acts:[],hist:{},chain:{},
  ill:null,illAge:-1,illType:null,dep:null,depAge:-1,lowHap:0,grindY:0,
  needJob:true,lastCar:null,carN:0,carGone:{},swAt:null,swWhy:null,
  acc:{n:0,h:0,hl:0,r:0,an:0,nw:0,bad:0}};
 s.hz=0;s.dieAt=-Math.log(1-mb(hsh(seed,'death'))());
 const k=c[1];s.sex=sex||(r()<SRB[k]/(1+SRB[k])?'m':'f');s.le=Math.round(c[4]+LE_SEX[k][s.sex==='f'?0:1]-LE_SEX[k][2]);
 s.dk=DF[dk]?dk:'easy';const rd=mb(hsh(seed,'diff')),d=D(s);s.crashM=inR(rd(),d.crash);s.lostAt=rd()<d.lost?(rd()<.6?s.crashAge+1:25+Math.floor(rd()*36)):-99;
 /* school, at the country's real rates (see "real-world chances"): leftAt is the age you leave school early (0: you finish it) */
 {const rs=mb(hsh(seed,'school')),pr=Math.min(100,RD.prim[k])/100,ls=Math.min(pr,Math.min(100,RD.lsec[k])/100),u=rs();
  s.leftAt=u<1-pr?11:u<1-ls?15:0;s.uniPlace=rs()<uniRate(s)}
 s.plan=planLife(s);
 /* parents and brothers and sisters (js/people.js) */
 if(typeof pplBorn==='function')pplBorn(s);return s}

/* Each life draws its own mix of decisions. Events with `win:[from,to]` get an age in that window
   (with chance `p`, and only if `only(s)` allows it at birth); fixed-age events are placed first and
   the rest try to land on years that are still free. Events that missed the draw go into `spare`,
   used only to fill a quiet stretch (see dueEvents). */
const DENSITY=.5; // scales every event's chance; raise it for more decisions per life (about 50 at .5). Country cards use their own (dens)
function planLife(s){const r=mb(hsh(s.seed,'plan')),used={},plan={},spare={};
 for(const e of EV)if(e.win&&e.win[0]===e.win[1]){plan[e.id]=e.win[0];used[e.win[0]]=1}
 for(const e of EV){if(!e.win||e.win[0]===e.win[1])continue;
  const p=typeof e.p==='function'?e.p(s):(e.p==null?1:e.p);if(e.only&&!e.only(s))continue;const pick=r()<p*(p<1?(e.dens||DENSITY):1);
  const[a,b]=e.win;let age=a+Math.floor(r()*(b-a+1));for(let k=0;k<8&&used[age];k++)age=a+Math.floor(r()*(b-a+1));
  if(pick){used[age]=1;plan[e.id]=age}else if(p>0)spare[e.id]=age}
 s.spare=spare;return plan}

/* ---------- decision helpers ---------- */
/* on Normal and Hard a degree or course can teach more or less than expected (D(s).learn) */
const learnLuck=(s,k)=>inR(evR(s,k)(),D(s).learn);
function startStudy(s,k){const cost=eduCost(s,k);const lab=M(k==='uni'?'lbl.uni':'lbl.dip');s.study={end:s.age+(k==='uni'?4:2),gain:(k==='uni'?6.5:6)*learnLuck(s,'study'),pt:k==='uni'?.25:.3,label:lab,k};const t=T(s,'sk_edu',{kind:'skill',label:lab});t.cost+=cost;const fc=Math.min(Math.max(0,s.cash),cost);s.cash-=fc;s.sloan+=cost-fc}
function startCert(s,k){const fee=k==='mba'?s.base:.3*s.base;const lab=M(k==='mba'?'lbl.mba':'lbl.cert');s.cert={end:s.age+(k==='mba'?2:1),kind:k,label:lab,eff:learnLuck(s,'cert')};pay(s,fee);const t=T(s,'sk_cert',{kind:'skill',label:lab});t.cost+=fee}
function setSave(s,p){s.savePct=p;if(p>0){const t=T(s,'lot_auto',{kind:'lot',src:'auto'});t.label=M('trk.auto',{p:Math.round(p*100)})}}
function bet(s,p){const amt=p*liquid(s);const fc=Math.min(Math.max(0,s.cash),amt);s.cash-=fc;withdrawEq(s,amt-fc);s.crypto={stake:amt,res:s.age+2};T(s,'tip',{kind:'custom',label:M(p>.1?'trk.tipBig':'trk.tipSmall'),note:M('note.tipIn',{a:MN(amt)})})}
function wed(s,m,key){const a=m*s.base,p=s.pt;s.married=true;s.happy+=5;pay(s,a);const t=T(s,'wed'+p.n,{kind:'ghost',label:M(key)});t.spent+=a;t.g+=a;
 p.st='wed';p.wedAt=s.age;p.nw0=netWorth(s);ptLine(s)}
function buy(s,P){const up=.23*P,r=.03+(s.rateAdj||0);homeFirst(s);pay(s,up);s.house={value:P,mort:.8*P,pay:amort(.8*P,r,30),out:up,rentAv:0,frac:P/price(s),rate:r,end:s.age+30};T(s,'home',{kind:'custom',label:M(P<price(s)?'trk.flat':'trk.home'),v:-.03*P,note:M('note.homeFees')})}
function startBiz(s,mode,cap){pay(s,cap);s.biz={mode,cap,res:s.age+2,ok:false,done:false,inc:0,sold:false};T(s,'biz',{kind:'custom',label:M(mode==='full'?'trk.bizFull':'trk.bizSide'),v:-cap,note:M('note.bizIn',{a:MN(cap)})})}
function crashTrack(s,mode){const P=s.crashP||0;if(P>1)T(s,'crash',{kind:'crash',mode,hold:P,sell:P,label:M(mode==='sell'?'trk.crashSell':'trk.crashHold')})}
const crashPct=s=>Math.round(100*(1-(s.crashM||.62)));
function crashSell(s){const P=eqTot(s,1);withdrawEq(s,P);s.cash+=P;s.sold=P;s.outUntil=s.age+3;crashTrack(s,'sell')}
/* one-off spending, tracked as what the money would be worth had it been invested */
function spend(s,id,a,lk){pay(s,a);const t=T(s,id,{kind:'ghost',label:M(lk)});t.spent+=a;t.g+=a}
/* a cost that repeats every year for `yrs` years (negative = income); `h` changes health each year */
function rec(s,id,amt,yrs,h){s.rec.push({id,amt,until:s.age+yrs,h:h||0})}
/* something that resolves years from now (see LATER) */
function later(s,age,k,x){s.later.push(Object.assign({age,k},x||{}))}
function bump(s,id,m,label,nk){s.bump[id]=(s.bump[id]||1)*m;const t=T(s,id,{kind:'custom',label});t.note=M(nk||'note.bump',{p:Math.round((s.bump[id]-1)*100)})}
function setRate(h,rate,age){h.rate=rate;if(h.mort>0)h.pay=amort(h.mort,rate,Math.max(1,(h.end||age+20)-age))}
function efTarget(s){return .5*(.5*s.base*(s.costMul||1)+rent(s))}
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
function chipIn(s,you,k,L){if(s.rel>=40&&evR(s,k)()<(s.rel-30)/100){const h=you*(.2+.3*s.rel/100);s.cash+=h;helped(s,h);L&&L(helpMsg(s,'log.helpMed',h),'good')}}
/* the diary names the closest person who chipped in, if there is one (js/people.js) */
function helpMsg(s,k,h){const p=typeof pplClosest==='function'&&pplClosest(s);return p?M(k+'P',{a:MN(h),p:pplWho(s,p,1)}):M(k,{a:MN(h)})}
/* a child's name for the diary when they are born */
function pplKidWho(s,b){const p=(s.ppl||[]).find(x=>x.r==='kid'&&x.b===b);return p?pplWho(s,p,1):M('ppl.baby')}
const job=s=>!!s.job&&!s.study&&!s.retired;
/* about 1 in 3 mentors turn out not to help much */
const mentorFit=s=>evR(s,'mentorFit')()>=.33;

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
 /* training fees come from savings first, the rest goes on the student loan (3%, paid back over ten years) */
 if(j.train>a){const f=c.tr.fee*s.base,fc=Math.min(Math.max(0,s.cash),f);s.cash-=fc;if(f>fc){s.sloan+=f-fc;s.sloanPay=slPay(s)}const t=s.trk[j.tk];if(t){t.v-=f;t.fee+=f;carNote(t)}return}
 if(j.train===a){if(evR(s,'trainFail')()<D(s).trainFail){L&&L(M('log.car.trainFail',{x:nm}),'bad');endCareer(s,'fail',a-1);return}L&&L(M('log.car.trained',{x:nm}),'good')}
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
 return hp*clamp(.25+(s.age-30)*.03,.25,2.5)*(1+.03*Math.min(25,s.grindY+.5*s.hustleYears))*RD.ncd[C[s.ci][1]]/RDA.ncd}
/* which serious illness: cancer, a heart attack or a stroke, in proportion to the country's death rates from each at your age */
function illKind(s,u){const d=RD.deaths[C[s.ci][1]][s.age<50?'15-49':s.age<70?'50-69':'70+'],x=u*(d.cancer+d.heart+d.stroke);return x<d.cancer?'cancer':x<d.cancer+d.heart?'heart':'stroke'}
function survP(s,k){const ci=s.abroad!=null?s.abroad:s.ci;return clamp(ILLT[k].p+(s.health-50)*.005+(C[ci][4]-75)*.008-Math.max(0,s.age-60)*.006+(s.screen?.05:0),.05,.97)}
const illYou=(s,k)=>ILLT[k].c*s.base*(s.insured?.15:1)*(s.medCut||1);
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

/* happiness when a child is born: the first brings the most */
const KIDH=[4,2,1];
/* ---------- love and family: meeting someone, dating, living together, marriage, children, splitting up ----------
   Game rules, not published data. While you're single (18 to 70) there's a yearly chance to meet someone (meetP); the 'date'
   card then asks whether to start dating. Everything after that is yours to decide in the Life choices panel (relActs,
   relAct): move in together, propose (the 'wed' card), try for a baby, break up or divorce. s.pt is the partner:
   {n (1st, 2nd… partner), st 'date' | 'live' | 'wed', car (their career), q (their pay luck), exp (years of experience),
   at (your age when you met), from (moved in), nw0 (net worth at the wedding), tk (their passbook line)}.
   Partners can also end it (dating couples more often); a marriage ends through the old divorce rules (LATER.div).
   Living together or married, the partner's pay (after tax) joins the household and so do their living costs (the same as
   yours; the home is shared). Once they're 65 they get the state pension, as you do. */
/* a partner's career, shaped by the country: [weight in a poorer country, weight in a richer one]. A country sits between
   the two by its typical wage, on a log scale from $3k to $35k a year */
const PTJ={acct:[1,4],mkt:[1,4],swe:[.3,3],bank:[.3,2],civ:[3,4],teach:[3,4],nurse:[2,4],doc:[.3,1],law:[.3,1],chef:[3,2],elec:[2,2],
 mech:[2,2],cons:[5,2],drv:[4,3],fact:[6,2],farm:[14,.5],design:[.5,2],hawker:[6,1],shop:[4,2],prop:[1,1.5],ins:[1,1.5]};
function ptCar(s,r){const k=clamp(Math.log(s.base/3000)/Math.log(35000/3000),0,1),w={};let tot=0;
 for(const id in PTJ){w[id]=PTJ[id][0]*(1-k)+PTJ[id][1]*k;tot+=w[id]}let u=r()*tot;for(const id in w){u-=w[id];if(u<=0)return id}return 'civ'}
/* the yearly chance of meeting someone while single: lower with age, higher with good Relationships, the People focus,
   or in a year you went looking; the ages move with the country's average age at first marriage (see "real-world chances") */
function meetP(s,a){const m=smam(C[s.ci][1],s.sex),d=smamD(s),b=a<m?clamp(1/Math.max(1,m-23),.14,.6):a<36+d?.14:a<51+d?.09:.05;return clamp(b+(s.rel-50)*.003+(s.focus==='people'&&!s.retired?.12:0)+(s.look===a?.4:0),.02,.8)}
/* the chance a year of trying brings a baby, by your age (the partner is taken to be about your age) */
const babyP=a=>a<30?.85:a<35?.75:a<40?.55:a<45?.3:.1;
/* divorce by country: [legal fees, child support a year for each child under 18], in years of a typical wage. Rough
   estimates of a contested divorce: lawyers cost most in the US and the UK, little where most couples divorce by
   agreement (Japan, China) */
const DIVC={US:[.6,.15],GB:[.5,.12],DE:[.4,.13],SG:[.5,.12],JP:[.1,.06],MY:[.3,.1],CN:[.2,.1],IN:[.3,.08],BR:[.3,.1],MX:[.3,.1]};
const divC=s=>DIVC[C[s.ci][1]]||[.25,.08];
function startDating(s){const n=s.ptN=(s.ptN||0)+1,r=evR(s,'pt'+n);s.pt={n,st:'date',car:s.meetCar||ptCar(s,r),q:.75+.5*r(),exp:Math.max(0,Math.round((s.age-21)*.8)),at:s.age};s.happy+=3}
/* their pay: the career's typical multiple for the country, their luck and experience (half a year's pay in a layoff year) */
function ptPay(s){const p=s.pt;if(!p||p.st==='date'||p.ret)return 0;return s.base*carR(s,p.car)*p.q*Math.pow(1+.015*Math.min(p.exp,25),D(s).pay)*(p.lay===s.age?.5:1)}
/* their passbook line opens when you move in or marry */
function ptLine(s){const p=s.pt;if(p.tk)return;p.tk='pt'+p.n;p.from=s.age;T(s,p.tk,{kind:'custom',label:M('trk.ptNow',{x:M('car.'+p.car),a:s.age}),paid:0,cost:0,note:M('note.pt0')})}
/* a partner's year: dating costs a little; living together, their take-home pay comes in and their living costs go out */
function ptYear(s,a){const p=s.pt,B=s.base,cm=s.costMul||1;if(!p)return{net:0,cost:0};
 if(p.st==='date'){const c=.04*B*cm,t=T(s,'date'+p.n,{kind:'ghost',label:M('trk.dating',{a:p.at})});t.spent+=c;t.g+=c;return{net:0,cost:c}}
 if(!p.ret&&a>=65)p.ret=1;
 let net;if(p.ret)net=.18*B;else{if(evR(s,'ptLay')()<CAR[p.car].lay[a===s.crashAge?1:0]*layC(s))p.lay=a;net=netOf(s,ptPay(s));p.exp++}
 const cost=.5*B*cm,t=s.trk[p.tk];if(t){t.v+=net-cost;t.paid+=net;t.cost+=cost;t.note=M('note.pt',{a:MN(t.paid),b:MN(t.cost)})}
 return{net,cost}}
/* the partner leaves your life: close their passbook line */
function ptEnd(s){const p=s.pt;if(!p)return;const t=p.tk&&s.trk[p.tk];if(t)t.label=M('trk.pt',{x:M('car.'+p.car),a:p.from,b:s.age});
 s.pt=null;s.married=false;s.ask=null;s.tryAt=null}
/* a hit to Happiness that fades over a few years (see tick) */
function heal(s,yrs,d){s.heal={until:s.age+yrs,yrs,d}}
/* breaking up (dating or living together): living together means moving out */
function splitUp(s,by,L){const p=s.pt;if(!p)return;const live=p.st==='live',c=live?.1*s.base:0;ptEnd(s);
 if(c)spend(s,'moveOut'+p.n,c,'trk.moveOut');
 s.happy=clamp(s.happy-(live?8:5),0,100);rl(s,by==='me'?-2:-3);heal(s,live?3:2,live?6:4);
 L&&L(M(by==='me'?'log.rel.break':'log.rel.left',{a:MN(c)}),'bad')}
/* a divorce: legal fees, half of what you built together since the wedding (the house, savings and investments,
   retirement accounts too), child support for children under 18, and a Happiness hit that fades over about four years */
function divorce(s,by,L){const p=s.pt;if(!p||!s.married)return;const k=divC(s),B=s.base,before=netWorth(s);pay(s,k[0]*B);
 const A=Math.max(0,s.cash)+eqTot(s)+(s.house?Math.max(0,s.house.value-s.house.mort):0),gain=netWorth(s)-(p.nw0||0),f=A>0?clamp(.5*Math.max(0,gain)/A,0,.5):0;
 if(f>0){if(s.cash>0)s.cash*=1-f;for(const id in s.lots){const l=s.lots[id],x=l.v*f;l.v-=x;l.tout+=x}if(s.house){s.house.value*=1-f;s.house.mort*=1-f;setRate(s.house,s.house.rate||.03,s.age)}}
 const kids=s.kids.filter(b=>s.age>=b&&s.age<b+18);for(const b of kids)rec(s,'support',k[1]*B,b+18-s.age);
 if(kids.length)T(s,'support',{kind:'custom',label:M('trk.support'),note:M('note.support0')});
 const loss=before-netWorth(s),t=T(s,'div'+p.n,{kind:'custom',label:M('trk.divorce')});t.v-=loss;t.note=M('note.divorce',{a:MN(loss)});
 ptEnd(s);s.happy=clamp(s.happy-12,0,100);rl(s,-4);heal(s,4,8);L&&L(M('log.divorce',{a:MN(loss)}),'bad')}
/* the Life choices panel: what makes sense right now, each {id, ok} (ok is true, or why it can't be done this year) */
function relActs(s){if(s.dead||s.age<18)return[];const p=s.pt,a=s.age,o=[];
 if(!p){if(a<70)o.push({id:'look',ok:s.look===a?M('lc.look.on'):true});return o}
 if(p.st==='date')o.push({id:'move',ok:true});
 if(p.st!=='wed')o.push({id:'wed',ok:true});
 if(p.st!=='date'&&a<=45&&s.kids.length<5)o.push({id:'baby',ok:s.tryAt===a?M('lc.baby.on'):s.kids.some(b=>b>a)?M('lc.baby.due'):true});
 o.push({id:p.st==='wed'?'div':'break',ok:true});return o}
/* do one of them now (the mirror life replays them from s.acts). Proposing brings up the wedding card at once */
function relAct(s,id,L){const p=s.pt,a=s.age,x=relActs(s).find(o=>o.id===id);if(!x||x.ok!==true)return false;s.acts.push([a,id]);
 if(id==='look'){spend(s,'look',.02*s.base,'trk.look');s.look=a;L&&L(M('log.rel.look'),'')}
 else if(id==='move'){p.st='live';ptLine(s);rl(s,3);s.happy+=3;L&&L(M('log.rel.move'),'good')}
 else if(id==='wed')s.ask='wed';
 else if(id==='baby'){s.tryAt=a;L&&L(M('log.rel.try'),'good')}
 else if(id==='break')splitUp(s,'me',L);
 else if(id==='div')divorce(s,'me',L);
 if(typeof pplSync==='function')pplSync(s);return true}
/* lives nobody steers (the autopilot twin, the simulated futures, the babies born with you, the balance bots) follow a
   typical path (see "real-world chances"): marry from about four years before the country's average age at first marriage, after
   at least a year together, moving in together first if it takes longer; and have the country's number of children per woman
   (kidGoal), before 40 (44 for a big family) */
function autoRel(s,a){const p=s.pt;if(!p)return;const r=evR(s,'auto'),g=kidGoal(s);
 if(!s.married){if(a-p.at>=1&&a>=smam(C[s.ci][1],s.sex)-4&&r()<.45){s.ask='wed';return}if(p.st==='date'&&a-p.at>=2)relAct(s,'move',null)}
 if(s.married&&a<(g>2?44:40)&&s.kids.length<g&&!s.kids.some(b=>b>a)&&r()<.7)s.tryAt=a+1}
/* children under 6 at this age (sleepless nights) */
const smallKids=(s,a)=>s.kids.filter(b=>a>=b&&a<b+6).length;
/* ---------- events ----------
   The decisions are data: events/*.json, built into gen/events.js by tools/build.js and turned into EV by js/deck.js (see
   events/README.md). Each has win (its age window, "age" in the JSON), p (its chance to be in a life, "weight"), only (who can
   get it, "if"), when (checked when it is due) and opts (its options). Events without win come with the situation (first job,
   a crash, debt); follow-up cards (chain) come when an earlier choice scheduled them with next(). EVBY finds an event by id;
   EVX lists the events without a window, which are checked every year. */
const EV=[],EVBY={},EVX=[];

/* an event is due when its planned age has come (and its window hasn't passed), or a follow-up's year has come, and its
   conditions hold; no event happens twice */
function due(s,e){if(e.chain){const ch=s.chain&&s.chain[e.id];if(!ch||s.age<ch.at)return false}
 else if(e.win){const a=s.plan[e.id];if(a==null||s.age<a||s.age>e.win[1])return false}
 if(e.only&&!e.only(s))return false;return !e.when||e.when(s)}
const byIx=(a,b)=>a.ix-b.ix;
/* after two quiet years, bring forward the open decision planned closest to now (this life's plan first, then the spares),
   so late-life cards are not used up early */
function pullForward(s){if(s.age<6||s.age-s.lastDec<2)return null;let best=null,bd=1e9;
 for(const[src,w]of [[s.plan,0],[s.spare,.5]]){const cand=[];for(const id in src){const e=EVBY[id];if(e)cand.push(e)}cand.sort(byIx);
  for(const e of cand){const a=src[e.id];if(!e.win||s.done[e.id]||s.age<e.win[0]||s.age>e.win[1]||(src===s.plan&&a<=s.age))continue;
   const d=Math.abs(a-s.age)+w;if(d<bd&&(!e.when||e.when(s))){best=e;bd=d}}}
 if(best)s.plan[best.id]=s.age;return best}
/* the cards due this year, in deck order: planned ones from this life's plan, and those that come with the situation */
function dueEvents(s){if(s.dead)return[];const d=[];
 for(const id in s.plan){const e=EVBY[id];if(e&&!s.done[id]&&due(s,e))d.push(e)}
 for(const e of EVX)if(!s.done[e.id]&&due(s,e))d.push(e);
 if(d.length)return d.sort(byIx);const p=pullForward(s);return p?[p]:[]}
/* you can't choose what you can't pay for: an option that would need more than your cash, the savings you can reach and what
   the bank will still lend is greyed out. The default never is, so every card can be answered */
function canPay(s,ev,o){if(o.id===ev.def)return true;const c=clone(s),co=ev.opts(c).find(x=>x.id===o.id);co.go(c);return !((c.acc.gw||0)>(s.acc.gw||0)+1e-9)}
function evOpts(s,ev){const os=ev.opts(s);for(const o of os)if((o.ok===undefined||o.ok===true)&&!canPay(s,ev,o))o.ok=M('g.cantPay');return os}
function applyOpt(s,ev,id){if(ev.pre&&!s['pre_'+ev.id]){ev.pre(s);s['pre_'+ev.id]=1}const os=ev.opts(s);let o=os.find(x=>x.id===id);if(!o||(o.ok!==undefined&&o.ok!==true)||!canPay(s,ev,o))o=os.find(x=>x.id===ev.def)||os[os.length-1];o.go(s);s.done[ev.id]=o.id;s.hist[ev.id+'@'+s.age]=o.id;s.lastDec=s.age;if(ev.again)ev.again(s);if(typeof pplSync==='function')pplSync(s);return o}
function resolveAuto(s){let g=0,ev;while((ev=dueEvents(s)[0])&&g++<30)applyOpt(s,ev,ev.def)}

/* ---------- consequences that arrive years later ----------
   later(s, age, kind, data) schedules one; at the start of that year LATER[kind](s, data, logger) resolves it. Most kinds belong
   to an event and are written in its JSON ("later"); js/deck.js adds them here. These two are the engine's own. */
const LATER={
 div:(s,x,L)=>{if(!s.married)return;if(evR(s,'div')()>=x.p*clamp(1.6-s.rel/62,.4,1.6)){L&&L(M('log.divNo'),'good');return}
  divorce(s,'them',L)},
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
function lotR(l,r,yr){return(l.rate!=null?l.rate:l.t==='gold'?.015+.15*yr.gd:l.t==='bond'?.015+.05*yr.bd:r)-(l.fee||0)}
/* yearly costs you signed up for (pets, gyms, premiums, helping parents); negative ones are income */
function recCost(s,a){let c=0;for(const r of s.rec){if(a>=r.until)continue;c+=r.amt;if(r.h)s.health+=r.h;const t=r.id&&s.trk[r.id];if(t&&r.amt){if(t.kind==='ghost'){t.spent+=r.amt;t.g+=r.amt}else{t.v-=r.amt;t.paid=(t.paid||0)+r.amt;t.note=t.nk?M(t.nk,{a:MN(t.paid),b:MN(t.saved||0)}):M(r.amt<0?'note.earned':'note.paid',{a:MN(Math.abs(t.paid))})}}}return c}
/* ---------- hooks for country cards (events/country-*.json) ----------
   student loans: a rate (s.sloanR, real; 3% unless set), a term in years (s.sloanN), or repayments as a share of pay above a
   threshold (s.sloanInc {r share, th threshold in typical wages, end age it is written off, pslf age a public-service job clears it,
   waive: unpaid interest is dropped}) */
const slR=s=>s.sloanR!=null?s.sloanR:.03;
const slPay=s=>amort(s.sloan,slR(s)||1e-6,s.sloanN||10);
/* careers that count as public service for US loan forgiveness */
const PUB={civ:1,teach:1,nurse:1,doc:1};
function slForgive(s,a,L){const q=s.sloanInc;if(!(a>=q.end||q.pslf&&a>=q.pslf&&s.job&&PUB[s.job.id]))return;const w=s.sloan;s.sloan=0;s.sloanInc=null;
 const t=T(s,'sloanW',{kind:'custom',label:M('trk.sloanW')});t.v+=w;t.note=M('note.sloanW',{a:MN(w)});L&&L(M('log.sloanW',{a:MN(w)}),'good')}
/* the state pension in retirement: about 18% of a typical wage, from s.penAt (if set) and times s.penM; s.penX adds a scheme's
   own pension {a a year, at age, tk passbook line}. The difference from the usual pension shows on the card's passbook line */
function statePen(s,a){const b=.18*s.base;let v=a>=(s.penAt||0)?b*(s.penM||1):0;const t=s.penTk&&s.trk[s.penTk];if(t&&v!==b){t.v+=v-b;t.got=(t.got||0)+v-b;t.note=M('note.penC',{a:MS(t.got)})}
 const x=s.penX;if(x&&a>=x.at){v+=x.a;const t2=s.trk[x.tk];if(t2){t2.v+=x.a;t2.saved=(t2.saved||0)+x.a;t2.note=M('note.penX',{a:MN(t2.paid||0),b:MN(t2.saved)})}}return v}
/* what a health scheme saved on a bill goes on its passbook line */
function medSaved(s,x){const t=s.medTk&&s.trk[s.medTk];if(!t||!(x>0))return;t.v+=x;t.saved=(t.saved||0)+x;t.note=M(t.nk||'note.med',{a:MN(t.paid||0),b:MN(t.saved)})}
/* buying a first home: a Lifetime ISA unlocks for it */
function homeFirst(s){if(!s.house&&s.lots.lisa)s.lots.lisa.lock=0}
/* a layoff: Brazil's FGTS pays out what is in the account */
function onLaid(s,L){if(typeof cLaid==='function')cLaid(s,L)}
/* money you put aside each year into plans: an insurance savings plan, a children's education fund, a retirement account */
function plans(s,a,work){let c=0;
 if(s.ilp&&a<s.ilp.until){c+=s.ilp.amt;addLot(s,'ilp',s.ilp.amt)}
 if(s.kidEdu==='fund')for(const b of s.kids)if(a<b+18){const x=s.kidFee/18;c+=x;addLot(s,'kidedu',x)}
 for(const d of s.dca||[]){if(a>=d.until||(d.noHouse&&s.house))continue;const x=d.p?d.p*work:d.amt;if(!(x>0))continue;c+=x;addLot(s,d.lot,x*(1+(d.bonus||0)))}
 if(s.scheme&&work>0){const x=s.scheme.p*work,l=s.lots[s.scheme.lot];c+=x;addLot(s,s.scheme.lot,x);if(l)l.v+=x*s.scheme.rel+Math.min(s.scheme.p,s.scheme.match)*work}
 return c}
function kidFees(s,a,L){if(!s.kidEdu)return;for(const b of s.kids){if(a!==b+18||(s.kidUni&&s.kidUni[b]))continue;
 if(s.kidEdu==='loan'){s.happy-=2;L&&L(M('log.kidLoan'),'');continue}
 let f=s.kidFee*(s.kidFeeM||1);const l=s.lots.kidedu;if(l&&l.v>0){const x=Math.min(l.v,f);l.v-=x;l.tout+=x;f-=x}
 if(f>0){pay(s,f);const t=T(s,'kidfees',{kind:'custom',label:M('trk.kidFees')});t.v-=f;t.note=M('note.paid',{a:MN(-t.v)})}
 L&&L(M('log.kidUni',{a:MN(s.kidFee)}),'good')}}

/* ---------- one year of life ---------- */
/* natural disasters and road accidents, at the real rates where you live (see "real-world chances"). One draw a year: a flood,
   a storm or a drought, then a road accident. The damage is a game rule (ESTIMATE): floods and storms cost 45% of a typical wage
   for a home you own, 15% for a rented one (as the flood cards always did), less with cover (12%) or preparation (50%) from a
   flood card and with that card's government aid; a drought costs 4% of a typical wage in food and water, and farmers lose a
   quarter of a year's pay; a serious road injury costs Health and a hospital bill of 10% of a typical wage (insurance pays 85%) */
function hazards(s,a,L){const k=C[s.abroad!=null?s.abroad:s.ci][1],B=s.base,z=RD.disasters[k],r=evR(s,'haz'),u=r()*1e5;
 const pay2=x=>{if(s.retired)payRet(s,x);else pay(s,x)};
 if(u<z.flood+z.storm){const kind=u<z.flood?'flood':'storm',full=(s.house?.45:.15)*B,pr=s.prot&&a<s.prot.until?s.prot:null,loss=full*(pr?[1,.5,.12][pr.lv]:1),aid=(s.prot?s.prot.aid:0)*B;
  pay2(loss);s.cash+=aid;s.happy=clamp(s.happy-5,0,100);s.health=clamp(s.health-2,3,100);
  const ti=pr&&pr.lv===2&&s.trk[pr.id];if(ti){ti.saved=(ti.saved||0)+full-loss;ti.v+=full-loss;ti.note=M('note.floodIns',{a:MN(ti.paid||0),b:MN(ti.saved)})}
  const t=T(s,'disaster',{kind:'custom',label:M('trk.disaster'),n:0,paid:0,cov:0});t.n++;t.paid+=loss-aid;t.cov+=full-loss+aid;t.v-=loss-aid;t.note=M('note.disaster',{n:t.n,a:MN(t.paid),b:MN(t.cov)});
  L&&L(M('log.dis.'+kind,{a:MN(loss),x:full-loss+aid>0?M('log.dis.cov',{b:MN(full-loss+aid)}):''}),'bad')}
 else if(u<z.flood+z.storm+z.drought){const farm=s.job&&s.job.id==='farm'&&job(s),c=.04*B+(farm?.25*salary(s):0);pay2(c);s.happy=clamp(s.happy-2,0,100);
  const t=T(s,'disaster',{kind:'custom',label:M('trk.disaster'),n:0,paid:0,cov:0});t.n++;t.paid+=c;t.v-=c;t.note=M('note.disaster',{n:t.n,a:MN(t.paid),b:MN(t.cov)});
  L&&L(M(farm?'log.dis.droughtFarm':'log.dis.drought',{a:MN(c)}),'bad')}
 if(r()<RD.road[k]*ROADK/1e5){const bill=.1*B*(s.medCut||1),you=s.insured?.15*bill:bill;pay2(you);s.health=clamp(s.health-6,3,100);s.happy=clamp(s.happy-3,0,100);
  const t=T(s,'road',{kind:'custom',label:M('trk.road'),n:0,paid:0});t.n++;t.paid+=you;t.v-=you;t.note=M('note.road',{n:t.n,a:MN(t.paid)});
  L&&L(M('log.road',{a:MN(bill),x:s.insured?M('log.medIns',{c:MN(bill-you)}):''}),'bad')}}
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
 let r=Math.max(-.45,yr.mkt-(a>=s.lostAt&&a<s.lostAt+10?.05:0));if(a===s.crashAge)r=.18;else if(a===s.crashAge+1&&s.lostAt!==a)r=.15;
 for(const k in s.lots){const l=s.lots[k];l.v*=1+lotR(l,r,yr)}
 /* cash loses 1% a year, plus inflation above the country's usual level (see "real-world chances"); not in a year an inflation
    card already took its loss (inflYr) */
 if(s.cash>0){const k=C[s.abroad!=null?s.abroad:s.ci][1],h=RD.infl[k],y=h[Math.floor(evR(s,'infl')()*h.length)],sur=s.inflYr===a?0:Math.max(0,y-INFL_MED[k])/100;
  if(s.efund&&s.trk.efund)s.trk.efund.v+=.015*s.cash;s.cash*=(s.efund?1:.99)*(1-sur)}
 for(const id in s.trk){const t=s.trk[id];if(t.kind==='ghost')t.g*=1+r;else if(t.kind==='crash'){t.hold*=1+r;t.sell*=(a<s.crashAge+3?.99:1+r)}}
 if(s.house)s.house.value*=1+.012+yr.hs*.05+D(s).rise;
 if(D(s).rise)s.hm*=1+D(s).rise;
 if(s.debt>0){s.debt*=1.18;debtCap(s,1)}
 const sk=skill(s),lf0=clamp(s.life+s.habit,.3,1);
 /* a partner: dating costs, or (living together, married) their take-home pay and their living costs */
 const pt=a>=18?ptYear(s,a):{net:0,cost:0};
 if(a>=18){
  if(s.nsUntil>a){const al=s.nsPay*B,d=al-(s.nsCost||.35)*B*cm+pt.net-pt.cost;s.earned+=al;out.gross=al;if(s.study)s.study.end++;
   if(d>=0)s.cash+=d;else pay(s,-d);out.saved=d;const t=s.trk.ns;if(t){t.v-=Math.max(0,carStartPay(s,'civ')-al);t.paid+=al;t.note=M('note.ns',{a:MN(t.paid)})}
  }else if(s.study){
   const st=s.study,part=st.pt*B;s.earned+=part;out.gross=part;
   const t=s.trk.sk_edu;if(t)t.cost+=Math.max(0,carStartPay(s,'civ')-part);
   const d=part-.35*B+pt.net-pt.cost;if(d>=0){s.cash+=d;out.saved=d}else{const fc=Math.min(Math.max(0,s.cash),-d);s.cash-=fc;s.sloan+=-d-fc;out.saved=d}
   addSkill(s,'edu',st.gain,st.label);if(fo==='learn')addSkill(s,'learn',fk,M('trk.learn'));
   if(a+1>=st.end){s.study=null;s.sloanPay=s.sloan>0?slPay(s):0;L&&L(M('log.grad',{x:s.sloan>0?M('log.gradLoan',{a:MN(s.sloan)}):M('log.gradNo')}),'good')}
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
    const cr=CAR[s.job.id],trn=s.job.train>a,lp=trn?0:cr.lay[a===s.crashAge?1:0]*D(s).lay*(s.layM||1)*layC(s);
    if(yr.jl<lp||s.layAt===a){work*=.5;onLaid(s,L);L&&L(M(s.layAt===a&&s.layVol?'log.layVol':'log.laidOff'),'bad');offerSwitch(s,'lay')}
    const den=1+SK*sk;
    for(const k in s.skillSrc){if(k==='base')continue;const t=s.trk['sk_'+k];if(!t)continue;const ex=sal*SK*s.skillSrc[k]/den;t.gain+=ex;t.per=ex}
    if(s.levelGrind&&s.trk.grind){const t=s.trk.grind,ex=sal*.18*s.levelGrind/(1+.18*s.level);t.gain+=ex;t.per=ex}
    for(const k in s.bump){const t=s.trk[k];if(t)t.v+=sal*(1-1/s.bump[k])}
    carPaid(s,work);
    let pp=.07+(fo==='grind'?.08*fk:0)+sk*.0015+(s.rel-50)*.0008;pp*=(cr.pp||1)*(s.ppM||1);if(s.uncle)pp*=.7;if(dp)pp*=.4;
    if(fo==='grind')s.grindY++;
    if(cr.gr>0&&!trn&&s.level<6&&yr.pr<pp){s.level++;if(fo==='grind'){s.levelGrind++;T(s,'grind',{kind:'skill',label:M('trk.grind')})}L&&L(M('log.promo',{n:s.level,a:MN(salary(s))}),'good')}
    if(!trn)s.exp++;
    /* good Relationships bring referrals: someone you know recommends you for a better-paid job (twice at most) */
    if(s.refN<2&&s.rel>55&&evR(s,'ref')()<(s.rel-55)/350){s.refN++;refer(s,'ref'+s.refN,1.08,'trk.referral',L,'log.referral')}
   }
   if(employed&&s.job)careerEnd(s,L);
   let hus=0;if(fo==='hustle'){s.hustleYears++;hus=B*.08*(1+.2*Math.min(s.hustleYears,10))*(1+SK*sk*.5)*fk;const t=T(s,'hustle',{kind:'custom',label:M('trk.hustle'),yrs:0});t.v+=hus;t.yrs++;t.note=M('note.hustle',{n:t.yrs,a:MN(hus)})}
   let side=0;if(s.biz&&s.biz.mode==='side'&&s.biz.ok&&!s.biz.sold){side=s.biz.inc;s.biz.inc*=1.06;if(tb){tb.v+=side;tb.note=M('note.bizSide',{a:MN(side)})}}
   const gross=work+hus+side,net=netOf(s,gross)+pt.net;
   /* on Normal and Hard, spending creeps up with take-home pay above a typical wage */
   const hs=housing(s),liv=.5*B*cm+D(s).creep*Math.max(0,net-pt.net-B);
   let fixed=liv+hs+pt.cost;
   {const at=s.abroad!=null&&s.trk.abroad?s.trk.abroad:s.ctr?s.trk[s.ctr]:null;if(at&&cm!==1)at.v-=(liv+(s.house?0:hs))*(1-1/cm)}
   const kc=kidsCost(s,a);if(kc){fixed+=kc;const t=s.trk.kids;if(t){t.cost+=kc;t.v-=kc;t.note=M('note.kids',{c:MN(t.cost)})}}
   fixed+=s.car?.05*B:.03*B;
   const ct=s.car&&s.trk[s.car.trk||'car'];
   if(ct){ct.spent+=.02*B;ct.g+=.02*B}
   if(s.car&&s.car.bal>0){s.car.bal*=1.06;const p=Math.min(s.car.pay,s.car.bal);s.car.bal-=p;if(s.car.bal<1)s.car.bal=0;fixed+=p;if(ct){ct.spent+=p;ct.g+=p}}
   if(s.sloan>0){const q=s.sloanInc,due=q?q.r*Math.max(0,gross-q.th*B):s.sloanPay||s.sloan*.12,i=s.sloan*slR(s);s.sloan+=q&&q.waive?Math.min(i,due):i;const p=Math.min(due,s.sloan);s.sloan-=p;fixed+=p;
    if(q&&s.sloan>=1)slForgive(s,a,L);if(s.sloan<1){s.sloan=0;L&&L(M('log.loanPaid'),'good')}}
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
   if(sur>=0){const lf=(s.cutDebt&&s.debt>0)?.4:lf0;let sv=sur-lf*sur;if(s.trk.habit)s.trk.habit.v-=s.habit*sur;if(s.trk.life){const d=(s.life-.85)*sur;s.trk.life.spent+=d;s.trk.life.g+=d}if(s.debt>0){const p=Math.min(sv,s.debt);s.debt-=p;sv-=p}s.cash+=sv;saved+=sv;if(s.cutDebt&&s.debt>0)s.happy-=2}
   else{/* while training (doctors, lawyers) the shortfall goes on the student loan */
    if(s.job&&s.job.train>a){const x=-sur,fc=Math.min(Math.max(0,s.cash),x);s.cash-=fc;s.sloan+=x-fc;s.sloanPay=slPay(s)}else pay(s,-sur);saved+=sur}
   if(s.cutDebt&&s.debt<=0)s.cutDebt=false;
   if(s.debt>0&&s.cash>.2*B){const p=Math.min(s.debt,s.cash-.2*B);s.cash-=p;s.debt-=p}
   if(s.debt<1)s.debt=0;
   s.earned+=gross;out.gross=gross;out.saved=saved;
  }else{
   let side=0;if(s.biz&&s.biz.mode==='side'&&s.biz.ok&&!s.biz.sold)side=s.biz.inc;
   const r2=s.ret2&&a<s.ret2.until?s.ret2.inc:0;if(r2&&s.trk.ret2){const t=s.trk.ret2;t.v+=r2;t.note=M('note.earned',{a:MN(t.v)})}
   const inc=s.pension+statePen(s,a)+side+r2;s.earned+=inc;out.gross=inc;
   if(s.pension&&s.trk.gov){const t=s.trk.gov;t.recv+=s.pension;t.v+=s.pension;t.note=M('note.pension',{p:MN(s.pension),r:MN(t.recv),l:MN(t.lost)})}
   let need=.5*B*cm+.25*B*(lf0/.85)+housing(s)+(s.car?.05*B:.03*B)+pt.cost;
   const kc=kidsCost(s,a);if(kc){need+=kc;const t=s.trk.kids;if(t){t.cost+=kc;t.v-=kc;t.note=M('note.kids',{c:MN(t.cost)})}}
   if(s.insured){const p=.035*B*s.insMul;need+=p;const t=s.trk.ins;if(t){t.prem+=p;t.v-=p;t.note=insNote(t)}}
   if(s.debt>0){const p=.25*s.debt;s.debt-=p;need+=p}
   need+=recCost(s,a)+plans(s,a,0);
   const d=inc+pt.net-need;
   if(d>=0){s.cash+=d;out.saved=d}else{const short=payRet(s,-d);out.saved=d;if(short>0){s.happy-=4;s.acc.bad++;if(!s.brokeLogged){s.brokeLogged=1;L&&L(M('log.broke'),'bad')}
    if(s.rel>=40&&evR(s,'helpBroke')()<(s.rel-30)/100){const h=.5*short;s.cash+=h;helped(s,h);L&&L(helpMsg(s,'log.helpBroke',h),'good')}}}
  }
  // body and mind
  if(a>=40)s.health-=.7;if(a>=65)s.health-=.6;
  /* while recovering from a serious illness you can't build Health back up */
  const hk=sick(s)?0:fk;
  if(s.retired)s.health+=2*hk;else if(!s.study){if(fo==='balance')s.health+=2.5*hk;if(fo==='people')s.health+=hk;if(fo==='grind')s.health-=2.5;if(fo==='hustle')s.health-=1}
  if(dp)s.health-=1.5;
  s.health-=.3*smallKids(s,a);
  /* a career's toll on health; on Normal and Hard demanding jobs take more (D(s).toll) */
  if(job(s)){const c=CAR[s.job.id],hd=c.hd||0;s.health+=hd>0?hd*hk:hd*(c.hp<0?D(s).toll:1)}
  s.health=clamp(s.health,3,100);
  if(a>=25&&s.illAge<0&&evR(s,'illRoll')()<illP(s)){s.illAge=a+1;s.illType=illKind(s,evR(s,'illType')())}
  const mp=(.02+Math.max(0,70-s.health)/900+a/3500)*D(s).med;
  if(yr.md<mp){const b0=B*.6*(.5+yr.ma*1.5)*(s.screen?.7:1),bill=b0*(s.medCut||1);medSaved(s,b0-bill);let you=bill;if(s.insured){you=.15*bill;const t=s.trk.ins;if(t){t.saved+=bill-you;t.v+=bill-you;t.note=insNote(t)}}
   if(s.retired)payRet(s,you);else pay(s,you);s.health=clamp(s.health-4,3,100);L&&L(M('log.med',{a:MN(bill),x:s.insured?M('log.medIns',{c:MN(bill-you)}):M('log.medSelf')}),'bad');
   chipIn(s,you,'helpMed',L)}
  hazards(s,a,L);
  /* on Normal and Hard, an unexpected bill now and then: the car, the flat, a family emergency, a fine, a theft */
  if(D(s).shock&&evR(s,'shock')()<D(s).shock){const r=evR(s,'shockK'),ks=['fam','fine','theft',s.car?'car':'fam',s.house?'home':'flat'],k=ks[Math.floor(r()*ks.length)],c=(.12+.4*r())*B;
   if(s.retired)payRet(s,c);else pay(s,c);const t=T(s,'shock',{kind:'custom',label:M('trk.shock'),n:0,paid:0});t.n++;t.paid+=c;t.v-=c;t.note=M('note.shock',{n:t.n,a:MN(t.paid)});L&&L(M('log.shock.'+k,{a:MN(c)}),'bad')}
  const nw=netWorth(s);let tg=48+9*Math.log10(1+Math.min(D(s).wcap,Math.max(0,nw)/B))-(s.debt>.3*B?10:0)+(s.pt?{date:2,live:3,wed:4}[s.pt.st]:a<40?1.5:0)+[0,4,5,5][Math.min(3,s.kids.length)]+(s.health-60)/8;
  tg+=(s.rel-50)/12;
  /* a break-up or divorce hurts, then fades over a few years */
  if(s.heal&&a<s.heal.until)tg-=s.heal.d*(s.heal.until-a)/s.heal.yrs;
  /* on Normal and Hard, saving a big share of your pay means a tighter budget */
  if(job(s))tg-=D(s).frug*(Math.max(0,100*(s.savePct+(s.scheme?s.scheme.p:0))-10)+50*(.85-s.life));
  if(!s.retired&&!s.study){if(fo==='balance')tg+=5*fk;if(fo==='grind')tg-=5;if(fo==='people')tg+=3*fk}
  if(sick(s))tg-=8;
  tg-=2*Math.max(0,smallKids(s,a)-1);
  if(s.termTo>a&&(s.married||s.kids.length))tg+=1.5;
  if(job(s)){const hp=CAR[s.job.id].hp||0;tg+=(hp>0?hp:hp*D(s).toll)-(s.car||s.age<25?0:1.5)}
  /* retirement means free time */
  if(s.retired)tg+=s.ret2&&a<s.ret2.until?2:6;
  if(s.retired&&s.rel<35){tg-=6;if(!s.lonely){s.lonely=1;L&&L(M('log.lonely'),'bad')}}
  s.happy=clamp(s.happy+(tg-s.happy)*.25,0,100);
  // two years in a row of low Happiness can bring on depression (once a life; it shows as a decision next year)
  s.lowHap=s.happy<35?s.lowHap+1:0;
  if(s.lowHap>=2&&!s.dep&&s.depAge<0&&evR(s,'depRoll')()<.5)s.depAge=a+1;
  // Relationships drift down unless you give people time; marriage, children and retirement help, and they pull back toward the
  // middle: a single kind gesture fades within a few years, how you spend your years is what lasts
  let dr=-1+(s.pt?{date:.1,live:.3,wed:.4}[s.pt.st]:a>=60?-.5:0)+[0,.3,.45,.5][Math.min(3,s.kids.length)]+(45-s.rel)*.05;
  if(s.retired)dr+=.5;else if(!s.study){const fd={people:4,balance:1.5,learn:0,grind:-1,hustle:-.6}[fo]||0;dr+=fd>0?fd*fk:fd;
   /* long-hours careers (the ones that cost Happiness) leave less time for people on Normal and Hard */
   if(job(s)&&CAR[s.job.id].hp<0)dr+=.5*CAR[s.job.id].hp*(D(s).toll-1)}
  rl(s,4*dr);
  if(s.married&&s.rel<25&&!s.later.some(x=>x.k==='div')&&evR(s,'lowrel')()<.04)later(s,a+1,'div',{p:1});
  /* a partner may end it: dating couples more often than those living together (a marriage ends through LATER.div) */
  if(s.pt&&s.pt.st!=='wed'&&s.pt.at<a&&evR(s,'ptLeave')()<(s.pt.st==='date'?.13:.05)*clamp(1.6-s.rel/62,.4,1.6))splitUp(s,'them',L);
  /* a year of trying for a baby: if it works, the baby is born next year */
  if(s.tryAt===a){s.tryAt=null;if(s.pt&&s.pt.st!=='date'){const ok=evR(s,'baby')()<babyP(a);
   if(ok){s.kids.push(a+1);const t=T(s,'kids',{kind:'custom',cost:0});t.label=M('trk.kids',{n:s.kids.length});if(!t.cost)t.note=M('note.kidsDue')}
   L&&L(M(ok?'log.rel.preg':'log.rel.noBaby'),ok?'good':'')}}
  /* meeting someone while single: the 'date' card comes up next year */
  if(!s.pt&&a<70&&s.meetAt==null&&evR(s,'meet')()<meetP(s,a)){s.meetAt=a+1;s.meetCar=ptCar(s,evR(s,'meetCar'))}
  if(s.auto)autoRel(s,a);
  // skills for next year
  if(a>=45&&s.done.pivot==='stay'&&!s.retired)s.skillSrc.base=Math.max(0,s.skillSrc.base-.8);
  if(!s.retired&&!s.study){
   if(s.job&&s.job.id==='start')addSkill(s,'startup',1.5,M('trk.startupSkill'));
   if(fo==='learn'){addSkill(s,'learn',(a<50?3.5:2)*fk*learnLuck(s,'learnYr'),M('trk.learn'));const t=s.trk.sk_learn;if(t){t.years=(t.years||0)+1;t.label=M('trk.learnN',{n:t.years})}}
   if(s.cert&&a<s.cert.end)addSkill(s,'cert',7*(s.cert.eff||1),s.cert.label);
  }
  for(const b of s.kids)if(b===a){s.happy=clamp(s.happy+KIDH[Math.min(2,s.kids.filter(x=>x<=a).length-1)],0,100);L&&L(M('log.child',{p:pplKidWho(s,b)}),'good')}
  if(s.ill&&!s.ill.over&&a+1>=s.ill.until){s.ill.over=1;s.health=clamp(s.health+6,3,100);L&&L(M('log.illRec'),'good')}
  if(s.dep&&!s.dep.over&&a+1>=s.dep.until){s.dep.over=1;s.happy=clamp(s.happy+8,0,100);L&&L(M('log.depEnd'),'good')}
  // lifespan: each year adds that year's risk of dying; you die once the total passes the luck drawn at birth (dieAt).
  // The odds at each age are the same as a fresh roll every year, but a lower risk (a woman's longer life, better health)
  // reliably means a later death for the same luck, so the mirror life compares fairly
  if(!s.noDeath){const Mx=s.le+8,bg=.09;let mu=bg*Math.exp(bg*(a-Mx))*Math.exp((60-s.health)/40)+.0006;if(a>=104)mu=99;s.hz+=mu;if(s.hz>=s.dieAt){s.dead=true;s.deathAge=a;return out}}
 }else{/* children's moods and friendships settle back as well */
  s.happy=clamp(s.happy+(62-s.happy)*.25,0,100);s.rel=clamp(s.rel+(50-s.rel)*.15,0,100);s.health=clamp(s.health,3,100)}
 if(s.leftAt&&a===s.leftAt)L&&L(M('log.leftSchool',{a}),'bad');
 /* the people in your life live their year too (js/people.js) */
 if(typeof pplYear==='function')pplYear(s,a,L);
 /* the end grade adds up every year lived (see lifeScore) */
 const A=s.acc;A.n++;A.h+=s.happy;A.hl+=s.health;A.r+=s.rel;if(a>=18){A.an++;A.nw+=netWorth(s)/B;if(s.debt>.5*B)A.bad++}
 s.age++;
 return out;
}

/* ---------- the end grade ----------
   Game rules, not data. Four equal parts, each shown 0–100:
   Money          70% your average net worth over your adult years and 30% what you leave, in years of a typical wage, on a
                  log scale that is full at 10 years; minus what you couldn't pay past the debt limit (acc.gw) and a little for
                  each year in heavy debt or unable to pay the bills in retirement (acc.bad)
   Happiness      its average over every year lived (30 counts as nothing, 80 as full marks)
   Health         half its average, half how long you lived compared with your country's life expectancy
   Relationships  its average over every year lived (25 counts as nothing, 75 as full marks)
   The yearly sums are kept in s.acc by tick(). The grade S, A, B, C or D comes from the total (cut-offs in GR.cut, set with
   tools/balance.js so that S is rare and an autopilot life on Normal gets about a C; raised when the autopilot began to
   date, marry and have children by itself, which keeps the grades where they were). */
const GR={x:10,bad:.5,w:{money:.25,happy:.25,health:.25,rel:.25},cut:[[95,'S'],[88,'A'],[77,'B'],[62,'C']]};
/* each part is shown from 0 to 100, but the total uses the parts before that cut-off (a part keeps falling below 0 and rises
   slowly above 100), so a little more or less still counts at the extremes */
const soft=v=>v>100?100+(v-100)/4:v<0?-20*(1-Math.exp(v/20)):v;
/* happiness, health and relationships count with diminishing returns: a point gained where you are low is worth more */
const conc=v=>100*(1-Math.exp(-v/35))/(1-Math.exp(-100/35));
function lifeScore(s,withRaw){const A=s.acc,n=Math.max(1,A.n),x=.7*(A.an?A.nw/A.an:0)+.3*netWorth(s)/s.base-(A.gw||0),age=s.dead?s.deathAge:s.age;
 const raw={money:soft(100*(x>0?Math.log(1+x):x)/Math.log(1+GR.x)-GR.bad*A.bad),happy:conc(soft(2*(A.h/n-30))),
  health:conc(soft(.5*A.hl/n+.5*soft(50+4*(age-s.le)))),rel:conc(soft(2*(A.r/n-25)))};
 let tot=0;const p={};for(const k in GR.w){tot+=GR.w[k]*raw[k];p[k]=clamp(raw[k],0,100)}const g=GR.cut.find(c=>tot>=c[0]);
 return Object.assign(p,{total:tot,grade:g?g[1]:'D'},withRaw?{raw}:null)}

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
function mirrorLife(s0,foc,at){const m=newLife(s0.ci,s0.seed,s0.sex==='f'?'m':'f',s0.dk);let g=0;
 /* the option picked at this age (cards that come back are kept by age in s.hist), then the last one picked, then the default */
 const pick=ev=>{const h=s0.hist&&s0.hist[ev.id+'@'+m.age];return h!=null?h:s0.done[ev.id]!=null?s0.done[ev.id]:ev.def};
 const run=()=>{let k=0,ev;while((ev=dueEvents(m)[0])&&k++<40)applyOpt(m,ev,pick(ev))};
 while(!m.dead&&g++<130){run();for(const[x,id]of s0.acts||[])if(x===m.age)relAct(m,id,null);run();
  if(foc[m.age])m.focus=foc[m.age];if(m.age===at){m.nwAt=netWorth(m);m.earnAt=m.earned}tick(m,yearRand(m.seed,m.age),null)}
 if(m.nwAt==null){m.nwAt=netWorth(m);m.earnAt=m.earned}return m}

/* ---------- simulated futures ---------- */
function MC(s,fn,N,tgt){const res=[];for(let i=0;i<N;i++){const c=clone(s);c.noDeath=true;c.auto=true;c.seed=hsh(s.seed,'mc',i);
  if(c.crashAge>c.age){const r=mb(hsh(c.seed,'cr'))();const lo=Math.max(c.age+1,34);c.crashAge=lo>50?lo:lo+Math.floor(r*(51-lo));c.crashM=inR(mb(hsh(c.seed,'crM'))(),D(c).crash)}
  if((c.lostAt>c.age||c.lostAt<0)&&c.age<60){const r=mb(hsh(c.seed,'lost')),lo=Math.max(c.age+1,25);c.lostAt=r()<D(c).lost*(61-lo)/36?lo+Math.floor(r()*(61-lo)):-99}
  fn(c);let g=0;while(c.age<tgt&&!c.dead&&g++<130){resolveAuto(c);tick(c,yearRand(c.seed,c.age),null)}res.push([netWorth(c),c.earned,c.illDied?0:1])}return res}
/* for an event with `surv` (a serious illness) each option also gets `alive`: the share of futures that survived it */
function projectEvent(s,ev,N){const P=projBegin(s,ev,N);while(P.todo.length)projNext(s,ev,P);return P}
/* the same in steps, so a card with many options (careers) can fill in its projections without freezing the page:
   projBegin runs the default option's futures, then each projNext runs one more option */
function projBegin(s,ev,N){const tgt=s.age<58?60:s.age+12,base=MC(s,c=>applyOpt(c,ev,ev.def),N,tgt),res={},todo=[];
 for(const o of evOpts(s,ev)){if(o.ok!==undefined&&o.ok!==true)continue;if(o.id===ev.def){res[o.id]={base:true};if(ev.surv)res[o.id].alive=aliveOf(base,N)}else todo.push(o.id)}
 return{tgt,res,todo,base,N}}
const aliveOf=(r,N)=>r.reduce((a,x)=>a+x[2],0)/N;
function projNext(s,ev,P){const id=P.todo.shift();if(id==null)return;const N=P.N,base=P.base;
 const r=MC(s,c=>applyOpt(c,ev,id),N,P.tgt);const d=r.map((x,i)=>x[0]-base[i][0]).sort((a,b)=>a-b);const e=r.map((x,i)=>x[1]-base[i][1]).sort((a,b)=>a-b);
 P.res[id]={med:d[N>>1],lo:d[Math.floor(N*.1)],hi:d[Math.min(N-1,Math.floor(N*.9))],earn:e[N>>1]};if(ev.surv)P.res[id].alive=aliveOf(r,N)}
function projectFocus(s,N){const tgt=s.age<55?60:s.age+5;const runs={};for(const f of['learn','grind','hustle','balance','people'])runs[f]=MC(s,c=>{c.focus=f},N,tgt);const out={};
 for(const f of['learn','grind','hustle','people']){const e=runs[f].map((x,i)=>x[1]-runs.balance[i][1]).sort((a,b)=>a-b);const n=runs[f].map((x,i)=>x[0]-runs.balance[i][0]).sort((a,b)=>a-b);out[f]={earn:e[N>>1],nw:n[N>>1]}}
 return{tgt,out}}
