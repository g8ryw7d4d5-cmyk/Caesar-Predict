const express=require("express");
const app=express();
const PORT=process.env.PORT||3000;
const API="https://v3.football.api-sports.io";
const cache=new Map();
let apiQueue=Promise.resolve();
let lastApiAt=0;
const CACHE_MS=60*60*1000;
const API_GAP=6500; // Free plan is 10 requests/minute; keep a safe gap.

app.use(express.static(__dirname));

function pct(v){if(v==null)return null;const n=parseFloat(String(v).replace("%",""));return Number.isFinite(n)?n:null}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

async function api(e){
  const k=process.env.API_FOOTBALL_KEY;
  if(!k)throw Error("API_FOOTBALL_KEY is missing. Add it in Render.");
  const h=cache.get(e);
  if(h&&Date.now()-h.t<CACHE_MS)return h.d;

  const run=apiQueue.then(async()=>{
    const cached=cache.get(e);
    if(cached&&Date.now()-cached.t<CACHE_MS)return cached.d;
    const wait=Math.max(0,API_GAP-(Date.now()-lastApiAt));
    if(wait)await sleep(wait);

    const r=await fetch(API+e,{headers:{"x-apisports-key":k,Accept:"application/json"}});
    const d=await r.json();
    lastApiAt=Date.now();

    const errors=d.errors&&Object.keys(d.errors).length?d.errors:null;
    if(errors){
      const rate=String(errors.rateLimit||"");
      if(rate){
        throw Error("API rate limit reached. The free API allows 10 requests per minute. Please wait about a minute before trying again.");
      }
      throw Error(JSON.stringify(errors));
    }
    if(!r.ok)throw Error(JSON.stringify({status:r.status}));
    cache.set(e,{t:Date.now(),d});
    return d;
  });
  apiQueue=run.catch(()=>{});
  return run;
}

async function prediction(id){
  try{
    const d=await api(`/predictions?fixture=${id}`);
    const p=d.response?.[0]?.predictions;
    if(!p)return null;
    return {
      winner:p.winner?.name||null,
      advice:p.advice||null,
      home:pct(p.percent?.home),
      draw:pct(p.percent?.draw),
      away:pct(p.percent?.away),
      underOver:p.under_over||null,
      goals:p.goals||null
    };
  }catch(_){return null}
}

function result(f,id){
  if(f.goals.home==null||f.goals.away==null)return null;
  const home=f.teams.home.id===id;
  const gf=home?f.goals.home:f.goals.away,ga=home?f.goals.away:f.goals.home;
  return gf>ga?"W":gf===ga?"D":"L";
}
function form(fs,id){return(fs.response||[]).filter(f=>f.fixture.status?.short==="FT").map(f=>result(f,id)).filter(Boolean).slice(0,5)}
function goals(fs,id){let gf=0,ga=0,n=0;for(const f of(fs.response||[]).filter(f=>f.fixture.status?.short==="FT").slice(0,5)){if(f.goals.home==null)continue;const home=f.teams.home.id===id;gf+=home?f.goals.home:f.goals.away;ga+=home?f.goals.away:f.goals.home;n++}return n?`${gf} scored, ${ga} conceded in last ${n}`:"No recent goal data"}

app.get("/api/matches",async(req,res)=>{
  try{
    const date=new Date().toISOString().slice(0,10);
    const l=req.query.league;
    const e=l?`/fixtures?league=${encodeURIComponent(l)}&season=2026&date=${date}`:`/fixtures?date=${date}`;
    const d=await api(e);
    const fs=(d.response||[]).slice(0,12);

    // Free plan: only a small number of prediction calls per page load.
    // Remaining fixtures still appear and are clearly marked as unavailable rather than faking data.
    const predictionLimit=4;
    const out=[];
    for(let i=0;i<fs.length;i++){
      const f=fs[i];
      const p=i<predictionLimit?await prediction(f.fixture.id):null;
      out.push({
        id:f.fixture.id,date:f.fixture.date,time:new Date(f.fixture.date).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
        status:f.fixture.status?.short,league:f.league.name,country:f.league.country,leagueId:f.league.id,season:f.league.season,
        home:f.teams.home.name,away:f.teams.away.name,homeId:f.teams.home.id,awayId:f.teams.away.id,
        homeLogo:f.teams.home.logo,awayLogo:f.teams.away.logo,prediction:p
      });
    }
    res.json(out);
  }catch(e){res.status(500).json({error:e.message})}
});

app.get("/api/analyze",async(req,res)=>{
  try{
    const id=Number(req.query.fixture);
    if(!id)throw Error("Missing fixture id");
    const fd=await api(`/fixtures?id=${id}`);
    const f=fd.response?.[0];
    if(!f)throw Error("Fixture not found");

    const season=Number(f.league?.season)||2026;
    const hi=f.teams.home.id,ai=f.teams.away.id;
    const now=new Date();
    const to=now.toISOString().slice(0,10);
    const fromDate=new Date(now.getTime()-120*24*60*60*1000);
    const from=fromDate.toISOString().slice(0,10);

    // Sequential calls are intentional: the free plan is limited to 10 requests/minute.
    const h=await api(`/fixtures?team=${hi}&season=${season}&from=${from}&to=${to}`);
    const a=await api(`/fixtures?team=${ai}&season=${season}&from=${from}&to=${to}`);
    const hh=await api(`/fixtures/headtohead?h2h=${hi}-${ai}`);

    h.response=(h.response||[]).filter(x=>x.fixture.status?.short==="FT").sort((x,y)=>new Date(y.fixture.date)-new Date(x.fixture.date)).slice(0,5);
    a.response=(a.response||[]).filter(x=>x.fixture.status?.short==="FT").sort((x,y)=>new Date(y.fixture.date)-new Date(x.fixture.date)).slice(0,5);
    hh.response=(hh.response||[]).filter(x=>x.fixture.status?.short==="FT").sort((x,y)=>new Date(y.fixture.date)-new Date(x.fixture.date)).slice(0,10);

    const hf=form(h,hi),af=form(a,ai),done=hh.response||[];
    let hw=0,dr=0,aw=0,btts=0;
    for(const x of done){
      const hg=x.goals.home,ag=x.goals.away;
      if(hg==null||ag==null)continue;
      const homeScore=x.teams.home.id===hi?hg:ag;
      const awayScore=x.teams.home.id===hi?ag:hg;
      if(homeScore>awayScore)hw++;else if(homeScore===awayScore)dr++;else aw++;
      if(hg>0&&ag>0)btts++;
    }
    const n=hw+dr+aw;
    res.json({
      home:{name:f.teams.home.name,formText:hf.join(" → ")||"No recent completed matches",goalsText:goals(h,hi)},
      away:{name:f.teams.away.name,formText:af.join(" → ")||"No recent completed matches",goalsText:goals(a,ai)},
      h2h:{summary:n?`${hw} home wins · ${dr} draws · ${aw} away wins from ${n} H2H matches`:"No completed H2H matches available",btts:n?`${btts}/${n} H2H matches (${Math.round(btts/n*100)}%) had both teams scoring`:"Not available"},
      correctScore:"Not provided by the API response; Caesar Predict does not invent one.",
      note:"Recent form, H2H and goal data are supporting context. API prediction percentages remain the prediction source."
    });
  }catch(e){res.status(500).json({error:e.message})}
});

app.get("/health",(_,res)=>res.json({ok:true,service:"Caesar Predict V2.1.3",time:new Date().toISOString()}));
app.listen(PORT,()=>console.log(`Caesar Predict V2.1.3 running on port ${PORT}`));
