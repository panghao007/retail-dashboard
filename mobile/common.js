/* 移动端共享逻辑：直读已发布 PC 看板（纯皮肤，零中间数据文件）
   各看板取数均来自 ghpages_repo 已发布的 PC 看板，PC 一更新手机自动跟随。 */
const PERIOD_ORDER = ['day', 'yest', 'week', 'month', 'lastmonth'];
const PERIOD_LABEL = {day:'当日', yest:'昨日', week:'本周', month:'本月', lastmonth:'上月'};

/* ---------- 渲染辅助（不变） ---------- */
function fmt(n){ if(n===null||n===undefined||n==='') return '-'; const x=Number(n); return isNaN(x)? String(n): x.toLocaleString('en-US'); }
function esc(s){ return String(s===null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function rankColor(i){ return i===0?'#ff3b30':(i===1||i===2)?'#ff9500':'#34c759'; }
function tabLabel(p, period){
  if((p==='day'||p==='yest') && period && period.dates && period.dates.length){
    const d=period.dates[0]; return d.slice(4,6)+'-'+d.slice(6,8);
  }
  return PERIOD_LABEL[p]||p;
}
function metric(v,l,c,delta){
  return `<div class="metric"><div class="metric-value ${c||''}">${esc(v)}</div>`
    +`<div class="metric-label">${esc(l)}</div>`
    +(delta?`<div class="metric-delta ${c||''}">${esc(delta)}</div>`:'')+`</div>`;
}
function progress(pct,left,right,color){
  color = color || (pct>=90?'linear-gradient(90deg,#34c759,#30b94e)':'linear-gradient(90deg,#ff9500,#ff6b5a)');
  return `<div class="progress-bar"><div class="progress-fill" style="width:${Math.max(0,Math.min(100,pct))}%;background:${color}"></div></div>`
    +`<div class="progress-label"><span>${esc(left)}</span><span>${esc(right)}</span></div>`;
}
function insightBox(label, html){
  return `<div class="insight-box"><div class="insight-label">`
    +`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6z"/></svg>`
    +`${esc(label)}</div><div class="insight-text">${html}</div></div>`;
}
function actionBox(text){
  return `<div class="action-box"><div class="action-icon">!</div><div class="action-text">${text}</div></div>`;
}
function storeItem(name, meta, valNum, valLabel, valColor, highlight){
  const h = highlight? ' style="background:rgba(255,59,48,0.05);border:1px solid rgba(255,59,48,0.15)"':'';
  const hc = highlight? ' style="background:rgba(255,149,0,0.05)"':'';
  return `<div class="store-item"${h}><div class="store-info"><div class="store-name">${esc(name)}</div>`
    +`<div class="store-meta">${esc(meta)}</div></div>`
    +`<div class="store-value"><div class="store-value-num ${valColor||''}">${esc(valNum)}</div>`
    +`<div class="store-value-label">${esc(valLabel)}</div></div></div>`;
}
function detailItem(rankIdx, name, valueText, valueColor, barPct, barColor){
  const bar = (typeof barPct==='number'&&barPct>0)
    ? `<div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.max(8,Math.min(100,Math.round(barPct)))}%;background:${barColor||'#ff3b30'}"></div></div>` : '';
  const rc = (typeof rankIdx==='number')? `<div class="rank" style="background:${rankColor(rankIdx)}">${rankIdx+1}</div>`:'';
  return `<div class="detail-item"><div class="detail-item-name">${rc}${esc(name)}</div>`
    +`<div class="detail-item-bar">${bar}<div class="detail-item-value ${valueColor||''}">${esc(valueText)}</div></div></div>`;
}

/* ---------- 底层取数 ---------- */
async function fetchText(url){
  const r = await fetch(url, {cache:'no-store'});
  if(!r.ok) throw new Error('HTTP '+r.status+' '+url);
  return await r.text();
}
async function fetchJson(url){
  const r = await fetch(url, {cache:'no-store'});
  if(!r.ok) throw new Error('HTTP '+r.status+' '+url);
  return await r.json();
}
function enc(url){ return url.split('/').map(encodeURIComponent).join('/'); }

// 从 HTML 中抽取 var/let/const X = {...}|[...]; 的干净 JSON（括号配平方式，抗字符串内分号）
function extractJsonVar(html, name){
  const re = new RegExp('(?:var|let|const)\\s+'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*=\\s*');
  const m = re.exec(html);
  if(!m) return null;
  let i = m.index + m[0].length;
  while(i<html.length && /\s/.test(html[i])) i++;
  const open = html[i];
  if(open!=='{' && open!=='[') return null;
  const close = open==='{'?'}':']';
  let depth=0, inStr=false, esc=false;
  for(let j=i;j<html.length;j++){
    const ch=html[j];
    if(inStr){ if(esc) esc=false; else if(ch==='\\') esc=true; else if(ch==='"') inStr=false; continue; }
    if(ch==='"') inStr=true;
    else if(ch===open) depth++;
    else if(ch===close){ depth--; if(depth===0){ try{ return JSON.parse(html.slice(i,j+1)); }catch(e){ return null; } } }
  }
  return null;
}
function norm(d){ return String(d==null?'':d).replace(/-/g,''); }
function md(d){ d=norm(d); return d.slice(4,6)+'-'+d.slice(6,8); }
function periodDateSet(allDates, kind, latest){
  allDates = allDates.map(norm); latest = norm(latest);
  if(!allDates.length || !latest) return [];
  if(kind==='day') return [latest];
  if(kind==='yest'){ const i=allDates.indexOf(latest); return i>0?[allDates[i-1]]:[]; }
  if(kind==='week'){
    const d=new Date(latest.slice(0,4)+'-'+latest.slice(4,6)+'-'+latest.slice(6,8));
    const mon=new Date(d); mon.setDate(d.getDate()-d.getDay());
    return allDates.filter(x=>{ const t=new Date(x.slice(0,4)+'-'+x.slice(4,6)+'-'+x.slice(6,8)); return t>=mon && t<=d; });
  }
  if(kind==='month') return allDates.filter(x=>x.slice(0,6)===latest.slice(0,6));
  if(kind==='lastmonth'){
    const d=new Date(latest.slice(0,4)+'-'+latest.slice(4,6)+'-01'); d.setDate(0);
    const lm=d.getFullYear()+('0'+(d.getMonth()+1)).slice(-2);
    return allDates.filter(x=>x.slice(0,6)===lm);
  }
  return [];
}

/* ---------- 会员有效性 ---------- */
async function loadMember(){
  const html = await fetchText(enc('../d/index.html'));
  if(!html) return null;
  const VP = extractJsonVar(html, 'VAL_PERIODS');
  if(!VP) return null;
  const periods = {};
  for(const p of PERIOD_ORDER){
    const d = VP[p]; if(!d) continue;
    const dates=(d.dates||[]).map(norm);
    const total=d.total||0, valid=d.valid||0, invalid=d.invalid||0;
    periods[p]={ dates, total, valid, invalid,
      validRate: total?+(valid/total*100).toFixed(2):0,
      invalidRate: total?+(invalid/total*100).toFixed(2):0 };
  }
  const latestDate = (VP.day && VP.day.dates && VP.day.dates[0]) ? VP.day.dates[0] : '';
  let branchList=[], storeTop10=[], phoneTop=[], focusStore=null, rules='';
  try{
    const dd = await fetchJson(enc('../d/'+latestDate+'_dashboard_data.json'));
    if(dd){
      const bs = dd.branch_stats||[];
      branchList = bs.filter(b=>b['分公司']).map(b=>({name:b['分公司'], invalidRate:+(b['无效占比']||0).toFixed(2), invalid:b['无效会员订单']||0, total:b['总订单数']||0})).sort((a,b)=>b.invalidRate-a.invalidRate).slice(0,6);
      const ss = dd.store_stats||[];
      storeTop10 = ss.filter(s=>s['门店'] && (s['总订单数']||0)>=20).map(s=>({name:s['门店'], company:s['所属分公司']||'', total:s['总订单数']||0, invalid:s['无效会员订单']||0, rate:+(s['无效占比']||0).toFixed(2)})).sort((a,b)=>b.rate-a.rate).slice(0,10);
      const idl = dd.invalid_detail||[];
      phoneTop = idl.slice(0,6).map(x=>({phone:x['会员手机号']||'', count:x['当月使用次数']||0, stores:x['涉及门店数']||0, companies:x['涉及分公司']||'', meta:'涉及'+(x['涉及门店数']||0)+'家门店 · '+(x['涉及分公司']||'')}));
      if(ss.length){ const top=ss[0]; focusStore={name:top['门店'], company:top['所属分公司']||'', phone:(top['无效号码']||[])[0]||'', rate:+(top['无效占比']||0).toFixed(2), invalid:top['无效会员订单']||0, total:top['总订单数']||0}; }
      const fx = dd.fx_count||0;
      rules='≤2次有效 / >2次无效 / 跨门店救回。已剔除无会员号订单与福建精准FX '+fx+'单。';
      return { periods, latest_date: dd.latest_date||latestDate, branchList, storeTop10, phoneTop, focusStore, rules };
    }
  }catch(e){ /* 明细缺失仍可显示周期汇总 */ }
  return { periods, latest_date: latestDate, branchList, storeTop10, phoneTop, focusStore, rules };
}

/* ---------- 合规收银 ---------- */
function cashierBranch(D){
  const bs=D.branch_stat||{};
  return Object.keys(bs).filter(n=>n).map(n=>{ const v=bs[n]; return {name:n, noncompliant:v.noncomp||0, compliant:v.comp||0, total:v.count||0, rate:+(v.rate||0).toFixed(2)}; }).sort((a,b)=>b.noncompliant-a.noncompliant);
}
function cashierStore(D){
  const ss=D.store_stat||{};
  return Object.keys(ss).filter(n=>n).map(n=>{ const v=ss[n]; return {name:n, company:'', total:v.count||0, noncompliant:v.noncomp||0, rate:+(v.rate||0).toFixed(2)}; }).sort((a,b)=>(-b.noncompliant)||(a.rate-b.rate)).slice(0,10);
}
function cashierChannel(D){
  const cs=D.channel_stat||{};
  return Object.keys(cs).filter(n=>n).map(n=>{ const v=cs[n]; const cat=v.cat||{}; const nc=cat['不合规']||0; return {name:n, count:nc, meta:(nc===v.count?'不合规通道':'有条件合规 · 缺第三方订单号')}; }).filter(x=>x.count>0).sort((a,b)=>b.count-a.count);
}
function cashier100(D){
  const ss=D.store_stat||{};
  const all=Object.entries(ss).filter(([s,v])=>s && (v.count||0)>0);
  const total=all.length;
  const comp=all.filter(([,v])=>(v.noncomp||0)===0);
  const top=comp.sort((a,b)=>b[1].count-a[1].count).slice(0,5).map(([n,v])=>({name:n,count:v.count}));
  return {count:comp.length, total, pct: total?+(comp.length/total*100).toFixed(1):0, top5:top};
}
// 合规收银：直接 fetch 驾驶舱用的同一份 PC 看板（中文文件名，已验证 GitHub Pages 可取），
// 与 dashboard.html 读同一源、同一 var PERIODS，数据逐字一致、自动跟随 PC。
async function loadCashier(){
  const html = await fetchText('../cashier/收银合规看板.html');
  if(!html) return null;
  const P = extractJsonVar(html, 'PERIODS');
  if(!P) return null;
  const periods={};
  for(const p of PERIOD_ORDER){
    const d=P[p]; if(!d||!d.D) continue;
    const D=d.D;
    const total=D.total||0, comp=D.compliant||0, noncomp=D.noncompliant||0, excl=D.excluded||0;
    const base=comp+noncomp;
    periods[p]={ dates:(d.dates||[]).map(norm), total, compliant:comp, noncompliant:noncomp, excluded:excl,
      compliantRate: base?+(comp/base*100).toFixed(2):0,
      branchList: cashierBranch(D), storeTop10: cashierStore(D), channelList: cashierChannel(D), compliant100: cashier100(D) };
  }
  if(!Object.keys(periods).length) return null;
  return { periods };
}

/* ---------- 零售退货 ---------- */
// 零售退货：同上，直接 fetch 驾驶舱用的同一份 PC 看板（var RDATA），与 dashboard.html 同源一致。
async function loadReturn(){
  const html = await fetchText('../return_order/零售退货单看板.html');
  if(!html) return null;
  const R = extractJsonVar(html, 'RDATA');
  if(!R || !R.daily) return null;
  const daily=R.daily;
  const keys=Object.keys(daily).map(norm).sort();
  if(!keys.length) return null;
  const latest=norm(R.T||keys[keys.length-1]);
  const sb=R.store_branch||{};
  const periods={};
  for(const p of PERIOD_ORDER){
    let sel=keys.filter(k=>periodDateSet(keys,p,latest).includes(k));
    if(!sel.length) sel=(p==='day'||p==='yest')?[latest]:[];
    let rc=0,sc=0,ra=0; const br={},st={};
    for(const k of sel){
      const dk=daily[k]||{};
      rc+=dk.return_count||0; sc+=dk.sales_count||0; ra+=dk.return_amount||0;
      for(const [b,v] of Object.entries(dk.branch||{})){ br[b]=br[b]||{return_count:0,sales_count:0}; br[b].return_count+=(v.return_count||0); br[b].sales_count+=(v.sales_count||0); }
      for(const [s,v] of Object.entries(dk.store||{})){ st[s]=st[s]||{return_count:0,sales_count:0,return_amount:0}; st[s].return_count+=(v.return_count||0); st[s].sales_count+=(v.sales_count||0); st[s].return_amount+=(v.return_amount||0); }
    }
    const branchList=Object.entries(br).filter(([b])=>b).map(([b,x])=>({name:b, rate:x.sales_count?+(x.return_count/x.sales_count*100).toFixed(2):0, returnCount:x.return_count, salesCount:x.sales_count})).sort((a,b)=>b.rate-a.rate).slice(0,6);
    const storeTop10=Object.entries(st).filter(([s])=>s && st[s].sales_count>=20).map(([s,x])=>({name:s, company:sb[s]||'', rate:x.sales_count?+(x.return_count/x.sales_count*100).toFixed(2):0, returnCount:x.return_count, salesCount:x.sales_count, amount:Math.round(x.return_amount||0)})).sort((a,b)=>b.rate-a.rate).slice(0,10);
    const compMap={};
    for(const [s,x] of Object.entries(st)){ const c=sb[s]||'未知'; (compMap[c]=compMap[c]||[]).push({name:s, rate:x.sales_count?+(x.return_count/x.sales_count*100).toFixed(2):0, returnCount:x.return_count, salesCount:x.sales_count, amount:Math.round(x.return_amount||0)}); }
    const branchStore=Object.entries(compMap).map(([c,lst])=>{ const lst2=lst.slice().sort((a,b)=>b.rate-a.rate).slice(0,5); const crc=lst2.reduce((a,x)=>a+x.returnCount,0), csc=lst2.reduce((a,x)=>a+x.salesCount,0); return {company:c, rate:csc?+(crc/csc*100).toFixed(2):0, stores:lst2}; }).sort((a,b)=>b.rate-a.rate);
    periods[p]={ dates:sel.slice().sort(), returnCount:rc, salesCount:sc, rate:sc?+(rc/sc*100).toFixed(2):0, branchList, storeTop10, branchStore };
  }
  if(!Object.keys(periods).length) return null;
  return { periods, latest_date: R.generated||latest };
}

/* ---------- 付费会员 ---------- */
async function loadPaid(){
  let idx;
  try{ idx = await fetchJson(enc('../paid_member/daily_index.json')); }catch(e){ return null; }
  if(!idx || !idx.dates || !idx.dates.length) return null;
  const dates=idx.dates.map(norm).sort();
  const latest=dates[dates.length-1];
  const cache={};
  async function getDay(dt){ if(cache[dt]) return cache[dt]; const j=await fetchJson(enc('../paid_member/daily/'+dt+'.json')); cache[dt]=j||null; return cache[dt]; }
  const days=await Promise.all(dates.map(getDay));
  const validDays=days.filter(Boolean);
  if(!validDays.length) return null;
  const periods={};
  for(const p of PERIOD_ORDER){
    const ds=periodDateSet(dates,p,latest);
    const sel=validDays.filter(d=>ds.includes(norm(d.date||'')));
    if(!sel.length) continue;
    const tot={denominator:0,numerator:0,order_denom:0,order_num:0,amount:0,profit:0};
    const br={}; const st=[];
    for(const d of sel){
      const t=d.total||{}; for(const k in tot) tot[k]+=(t[k]||0);
      for(const [b,v] of Object.entries(d.branches||{})){ const acc=br[b]=br[b]||{denominator:0,numerator:0,order_denom:0,order_num:0,amount:0,profit:0}; for(const k in acc) acc[k]+=(v[k]||0); }
      if(d.stores) st.push(...d.stores);
    }
    const rate=tot.denominator?+(tot.numerator/tot.denominator*100).toFixed(2):0;
    const orderRate=tot.order_denom?+(tot.order_num/tot.order_denom*100).toFixed(2):0;
    const branchList=Object.entries(br).filter(([b])=>b).map(([b,v])=>({name:b, rate:v.denominator?+(v.numerator/v.denominator*100).toFixed(2):0, denominator:Math.round(v.denominator), numerator:Math.round(v.numerator), value:Math.round(v.amount), profit:Math.round(v.profit), meta:Math.round(v.denominator)+'台 · VIP'+Math.round(v.numerator)+' · 产值¥'+(v.amount/10000).toFixed(2)+'万 · 纯利¥'+(v.profit/10000).toFixed(2)+'万'})).sort((a,b)=>b.rate-a.rate);
    const storeTop10=st.filter(s=>s.store && (s.denominator||0)>=5).map(s=>({name:s.store, company:s.branch||'', rate:s.denominator?+(s.numerator/s.denominator*100).toFixed(2):0, denominator:Math.round(s.denominator||0), numerator:Math.round(s.numerator||0)})).sort((a,b)=>b.rate-a.rate).slice(0,10);
    periods[p]={ dates:ds.slice().sort(), denominator:Math.round(tot.denominator), numerator:Math.round(tot.numerator), rate, orderRate, value:Math.round(tot.amount), profit:Math.round(tot.profit), branchList, storeTop10 };
  }
  if(!Object.keys(periods).length) return null;
  return { periods, latest_date: latest };
}

/* ---------- 通用 boot（详情页） ---------- */
async function boot(loader, defaultPeriod){
  const el=document.getElementById('cards');
  el.innerHTML='<div class="loading">数据加载中…</div>';
  let dash;
  try{ dash=await loader(); }
  catch(e){ el.innerHTML='<div class="loading">数据加载失败：'+esc(e.message)+'</div>'; return; }
  if(!dash || !dash.periods || !Object.keys(dash.periods).length){
    el.innerHTML='<div class="loading">该看板暂无数据（待下次每日刷新后自动出现）</div>'; return;
  }
  const periods=dash.periods;
  const avail=Object.keys(periods);
  const latest=dash.latest_date || (periods[avail[avail.length-1]].dates||[])[0] || '';
  const dateEl=document.getElementById('hdrDate');
  if(dateEl) dateEl.innerHTML='<span class="dot"></span>'+(latest?('数据更新 '+latest):'');
  const genEl=document.getElementById('genTime');
  if(genEl) genEl.textContent='数据实时取自 PC 看板（纯展示，未改任何管线）';
  const tabRow=document.getElementById('tabRow');
  tabRow.innerHTML=avail.map(p=>`<div class="tab-item" data-p="${p}">${esc(tabLabel(p,periods[p]))}</div>`).join('');
  let active=(defaultPeriod && avail.includes(defaultPeriod))?defaultPeriod:avail[avail.length-1];
  function render(){
    document.querySelectorAll('.tab-item').forEach(t=>t.classList.toggle('active',t.dataset.p===active));
    try{ el.innerHTML=window.BUILD(periods[active], dash, active); }
    catch(e){ el.innerHTML='<div class="loading">渲染出错：'+esc(e.message)+'</div>'; return; }
    requestAnimationFrame(()=>{ document.querySelectorAll('.progress-fill').forEach(b=>{ const w=b.style.width; b.style.width='0'; setTimeout(()=>b.style.width=w,60); }); });
  }
  tabRow.addEventListener('click',e=>{ const t=e.target.closest('.tab-item'); if(!t) return; active=t.dataset.p; render(); });
  render();
}
