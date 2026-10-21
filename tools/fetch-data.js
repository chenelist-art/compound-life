/* Fetches the real-world figures that set the chances in a life, and writes js/data.js (do not edit that file by hand).
   Every number comes from a published source, with its year; nothing is typed in. Run it again to refresh:
     node tools/fetch-data.js
   Sources (all public, no key needed):
   - World Bank, World Development Indicators and Gender Statistics: api.worldbank.org/v2 (each indicator's own source is
     named in js/data.js: UN Population Division, ILO, UNESCO Institute for Statistics, WHO, UN World Marriage Data, IMF)
   - World Health Organization, Global Health Estimates 2021 (deaths by cause, age and sex, 2000–2021):
     xmart-api-public.who.int/DEX_CMS/GHE_FULL
   - EM-DAT, the International Disaster Database (CRED, UCLouvain), as published by Our World in Data:
     catalog.ourworldindata.org/explorers/emdat/latest/natural_disasters/natural_disasters_yearly.csv
   When a country's figure is missing or too old (before the year given as "min"), the World Bank's average for its region
   is used instead, and js/data.js says so next to the number. */
const fs=require('fs'),path=require('path'),https=require('https');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'js/data.js');
/* the game's countries: ISO 2 (as in js/engine.js) and ISO 3 codes, and Our World in Data's names */
const CC=[['IN','IND','India'],['CN','CHN','China'],['NG','NGA','Nigeria'],['PK','PAK','Pakistan'],['ID','IDN','Indonesia'],['ET','ETH','Ethiopia'],
 ['US','USA','United States'],['BD','BGD','Bangladesh'],['BR','BRA','Brazil'],['MX','MEX','Mexico'],['PH','PHL','Philippines'],['VN','VNM','Vietnam'],
 ['JP','JPN','Japan'],['DE','DEU','Germany'],['GB','GBR','United Kingdom'],['MY','MYS','Malaysia'],['SG','SGP','Singapore']];
const REGION={SAS:'South Asia',EAS:'East Asia & Pacific',SSF:'Sub-Saharan Africa',LCN:'Latin America & Caribbean',NAC:'North America',
 ECS:'Europe & Central Asia',MEA:'Middle East, North Africa, Afghanistan & Pakistan',WLD:'World'};

/* World Bank indicators: key in js/data.js, indicator, what it is, its original source, the oldest year accepted, decimals */
const WB=[
 {k:'tfr',id:'SP.DYN.TFRT.IN',what:'Children per woman (total fertility rate)',src:'UN Population Division, World Population Prospects',min:2018,dec:2},
 {k:'smamF',id:'SP.DYN.SMAM.FE',what:'Average age at first marriage, women',src:'UN World Marriage Data (World Bank Gender Statistics)',min:2005,dec:1},
 {k:'smamM',id:'SP.DYN.SMAM.MA',what:'Average age at first marriage, men',src:'UN World Marriage Data (World Bank Gender Statistics)',min:2005,dec:1},
 {k:'unemp',id:'SL.UEM.TOTL.ZS',what:'Unemployment, % of the labour force',src:'ILO, modelled estimates (ILOSTAT)',min:2020,dec:2},
 {k:'prim',id:'SE.PRM.CMPT.ZS',what:'Primary school completion rate, % of the age group (can pass 100: late and early finishers count too)',src:'UNESCO Institute for Statistics',min:2015,dec:1},
 {k:'lsec',id:'SE.SEC.CMPT.LO.ZS',what:'Lower secondary school completion rate, % of the age group (can pass 100)',src:'UNESCO Institute for Statistics',min:2015,dec:1},
 {k:'tert',id:'SE.TER.ENRR',what:'University and college (tertiary) enrolment, gross, % of the five years after secondary school',src:'UNESCO Institute for Statistics',min:2015,dec:1},
 {k:'road',id:'SH.STA.TRAF.P5',what:'Road traffic deaths per 100,000 people',src:'WHO, Global status report on road safety',min:2015,dec:1},
 {k:'ncd',id:'SH.DYN.NCOM.ZS',what:'Chance of dying between 30 and 70 from heart disease and stroke, cancer, diabetes or chronic lung disease, %',src:'WHO Global Health Estimates',min:2015,dec:1}
];
/* figures that are published but don't measure what the game needs: the regional average is used instead, with the reason */
const OVERRIDE={lsec:{DE:'Germany’s published rate (71%) counts finishing the last grade of lower secondary, but its school tracks end in different grades, so it is not a share of children leaving school early'}};
const INFL={id:'FP.CPI.TOTL.ZG',from:2000,src:'IMF International Financial Statistics, via World Bank WDI FP.CPI.TOTL.ZG'};
/* WHO Global Health Estimates: the year (2019, the last before COVID-19, so the rates are those of normal years), causes and age bands */
const GHE={year:2019,causes:{all:0,comm:10,ncd:600,inj:1510,cancer:610,cvd:1100,heart:1130,stroke:1140,road:1530},
 bands:{'15-49':['Y15T19','Y20T24','Y25T29','Y30T34','Y35T39','Y40T44','Y45T49'],'50-69':['Y50T54','Y55T59','Y60T64','Y65T69'],'70+':['Y70T74','Y75T79','Y80T84','Y_GE85']}};
const EMDAT={from:2000,to:2024,url:'https://catalog.ourworldindata.org/explorers/emdat/latest/natural_disasters/natural_disasters_yearly.csv',
 cols:{all:'total_affected_rate_per_100k_all_disasters',flood:'total_affected_rate_per_100k_flood',storm:'total_affected_rate_per_100k_storm',
  quake:'total_affected_rate_per_100k_earthquake',drought:'total_affected_rate_per_100k_drought'}};

function get(url,tries=4){return new Promise((ok,no)=>{const go=n=>https.get(url,{headers:{'User-Agent':'Mozilla/5.0 (A Second Chance data script)'}},r=>{
  if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();get(r.headers.location,n).then(ok,no);return}
  let b='';r.setEncoding('utf8');r.on('data',d=>b+=d);r.on('end',()=>{if(r.statusCode!==200||!b){if(n>1)setTimeout(()=>go(n-1),1500);else no(new Error(url+': HTTP '+r.statusCode))}else ok(b)})})
 .on('error',e=>{if(n>1)setTimeout(()=>go(n-1),1500);else no(e)});go(tries)})}
const json=async u=>JSON.parse(await get(u));
const r=(v,d)=>+v.toFixed(d);

async function wbSeries(codes,id,from,to){const out={};
 const j=await json('https://api.worldbank.org/v2/country/'+codes.join(';')+'/indicator/'+id+'?format=json&per_page=5000&date='+from+':'+to);
 for(const x of j[1]||[])if(x.value!=null){const c=x.countryiso3code||x.country.id;(out[c]=out[c]||[]).push([+x.date,x.value])}
 for(const c in out)out[c].sort((a,b)=>a[0]-b[0]);return out}
const latest=l=>l&&l.length?l[l.length-1]:null;

async function main(){const today=new Date().toISOString().slice(0,10);
 const meta=await json('https://api.worldbank.org/v2/country/'+CC.map(c=>c[1]).join(';')+'?format=json&per_page=50');
 const reg={};for(const x of meta[1])reg[x.id]=x.region.id;
 const regions=[...new Set(Object.values(reg)),'WLD'];
 const data={},notes=[];
 /* ---------- World Bank ---------- */
 for(const ind of WB){process.stdout.write(ind.id+' ');
  const s=await wbSeries([...CC.map(c=>c[1]),...regions],ind.id,1990,2026);data[ind.k]={};
  for(const[c2,c3]of CC){let v=latest(s[c3]),why=null;const ov=OVERRIDE[ind.k]&&OVERRIDE[ind.k][c2];
   if(ov)why=ov;else if(!v)why='no figure for this country';else if(v[0]<ind.min)why='its latest figure ('+r(v[1],ind.dec)+') is from '+v[0];
   if(why){const rg=reg[c3],rv=latest(s[rg])&&latest(s[rg])[0]>=ind.min?latest(s[rg]):null,w=latest(s.WLD);
    if(rv)data[ind.k][c2]={v:r(rv[1],ind.dec),y:rv[0],note:'REGIONAL AVERAGE: '+REGION[rg]+' ('+rg+'); '+why};
    else if(w&&w[0]>=ind.min)data[ind.k][c2]={v:r(w[1],ind.dec),y:w[0],note:'WORLD AVERAGE (no recent regional figure); '+why};
    else throw new Error(ind.id+' '+c2+': nothing usable');notes.push(ind.k+' '+c2+': '+data[ind.k][c2].note)}
   else data[ind.k][c2]={v:r(v[1],ind.dec),y:v[0]}}}
 /* ---------- inflation, every year since 2000 ---------- */
 process.stdout.write(INFL.id+' ');
 {const s=await wbSeries(CC.map(c=>c[1]),INFL.id,INFL.from,2026);data.infl={};for(const[c2,c3]of CC){const l=s[c3]||[];if(l.length<15)throw new Error('inflation '+c2+': only '+l.length+' years');data.infl[c2]=l.map(([y,v])=>[y,r(v,1)])}}
 /* ---------- WHO Global Health Estimates: deaths per 100,000 by cause and age band ---------- */
 data.ghe={};
 for(const[c2,c3]of CC){process.stdout.write('GHE:'+c2+' ');
  const cf=Object.values(GHE.causes).map(c=>'DIM_GHECAUSE_CODE eq '+c).join(' or ');
  const f="DIM_COUNTRY_CODE eq '"+c3+"' and DIM_YEAR_CODE eq "+GHE.year+" and DIM_SEX_CODE eq 'TOTAL' and ("+cf+")";
  const j=await json('https://xmart-api-public.who.int/DEX_CMS/GHE_FULL?$filter='+encodeURIComponent(f)+'&$select=DIM_AGEGROUP_CODE,DIM_GHECAUSE_CODE,VAL_DTHS_COUNT_NUMERIC,ATTR_POPULATION_NUMERIC&$top=5000');
  const out={};for(const[band,ages]of Object.entries(GHE.bands)){out[band]={};
   for(const[k,code]of Object.entries(GHE.causes)){const rows=j.value.filter(x=>x.DIM_GHECAUSE_CODE===code&&ages.includes(x.DIM_AGEGROUP_CODE));
    if(rows.length!==ages.length)throw new Error('GHE '+c2+' '+band+' '+k+': '+rows.length+' of '+ages.length+' age groups');
    const d=rows.reduce((a,x)=>a+x.VAL_DTHS_COUNT_NUMERIC,0),p=rows.reduce((a,x)=>a+x.ATTR_POPULATION_NUMERIC,0);out[band][k]=r(1e5*d/p,1)}}
  data.ghe[c2]=out}
 /* ---------- EM-DAT: people affected by natural disasters, a year per 100,000, average 2000–2024 ---------- */
 process.stdout.write('EM-DAT ');
 {const csv=(await get(EMDAT.url)).split('\n'),head=csv[0].split(','),ix={};for(const[k,col]of Object.entries(EMDAT.cols)){ix[k]=head.indexOf(col);if(ix[k]<0)throw new Error('EM-DAT: no column '+col)}
  data.dis={};for(const[c2,,name]of CC){const rows=csv.slice(1).map(l=>l.split(',')).filter(x=>x[0]===name&&+x[1]>=EMDAT.from&&+x[1]<=EMDAT.to);
   const o={};for(const k in ix)o[k]=r(rows.reduce((a,x)=>a+(+x[ix[k]]||0),0)/(EMDAT.to-EMDAT.from+1),1);o.n=rows.length;data.dis[c2]=o}}
 console.log('\n'+notes.join('\n'));
 fs.writeFileSync(OUT,render(data,today));console.log('wrote js/data.js')}

/* ---------- js/data.js: one line per country, its year and any note in a comment ---------- */
function render(d,today){const L=[];const pad=(s,n)=>String(s).padEnd(n);
 L.push('/* A Second Chance: real-world figures that set the chances in a life. GENERATED by tools/fetch-data.js on '+today+' from the');
 L.push('   sources named on each table: do not edit by hand, run node tools/fetch-data.js to refresh. Each line gives the figure and,');
 L.push('   in a comment, its year. When a country has no figure or only an old one, the World Bank average for its region is used,');
 L.push('   and the comment says so (REGIONAL AVERAGE). How the game turns these into chances is explained where js/engine.js uses them. */');
 L.push('const RD={};');
 for(const ind of WB){L.push('');L.push('/* '+ind.what+'. World Bank '+(ind.k.startsWith('smam')?'Gender Statistics':'WDI')+' '+ind.id+'; source: '+ind.src+'. Latest year, from '+ind.min+' on. */');
  L.push('RD.'+ind.k+'={');const ks=Object.keys(d[ind.k]);ks.forEach((c,i)=>{const x=d[ind.k][c];L.push(' '+pad(c+':'+x.v+(i<ks.length-1?',':''),14)+'// '+x.y+(x.note?', '+x.note:''))});L.push('};')}
 L.push('');L.push('/* Inflation, consumer prices, % a year, each year from '+INFL.from+' to the latest. '+INFL.src+'. */');
 L.push('RD.infl={');CC.forEach(([c],i)=>{const l=d.infl[c];L.push(' '+c+':['+l.map(x=>x[1]).join(',')+']'+(i<CC.length-1?',':'')+' // '+l[0][0]+'–'+l[l.length-1][0]+(l.length!==l[l.length-1][0]-l[0][0]+1?' (some years missing)':''))});L.push('};');
 L.push('RD.inflFrom={'+CC.map(([c])=>c+':'+d.infl[c][0][0]).join(',')+'};');
 L.push('');L.push('/* Deaths per 100,000 people a year, by age band and cause, '+GHE.year+' (the last year before COVID-19): WHO Global Health Estimates 2021');
 L.push('   (GHE_FULL, both sexes; deaths and population of the five-year age groups added up). Causes: all; comm infections, pregnancy and');
 L.push('   birth, undernutrition; ncd noncommunicable; inj injuries; cancer malignant neoplasms; cvd cardiovascular; heart ischaemic heart');
 L.push('   disease; stroke; road road injury. */');
 L.push('RD.deaths={');CC.forEach(([c],i)=>{const g=d.ghe[c];L.push(' '+c+':{'+Object.entries(g).map(([b,o])=>"'"+b+"':{"+Object.entries(o).map(([k,v])=>k+':'+v).join(',')+'}').join(',')+'}'+(i<CC.length-1?',':'')+' // '+GHE.year)});L.push('};');
 L.push('');L.push('/* People affected by natural disasters (injured, needing help or made homeless), per 100,000 a year, average of '+EMDAT.from+'–'+EMDAT.to+':');
 L.push('   EM-DAT, the International Disaster Database (CRED / UCLouvain), as published by Our World in Data (natural_disasters_yearly).');
 L.push('   A year with no disaster recorded counts as 0. all every kind; flood; storm; quake earthquake; drought. n: years with a disaster. */');
 L.push('RD.disasters={');CC.forEach(([c],i)=>{const o=d.dis[c];L.push(' '+pad(c+':{'+['all','flood','storm','quake','drought'].map(k=>k+':'+o[k]).join(',')+'}'+(i<CC.length-1?',':''),72)+'// '+EMDAT.from+'–'+EMDAT.to+', '+o.n+' years with a disaster'+(o.n?'':' (none recorded)'))});L.push('};');
 L.push('if(typeof module!==\'undefined\')module.exports=RD;');
 return L.join('\n')+'\n'}

main().catch(e=>{console.error('\nFAILED: '+e.message);process.exit(1)});
