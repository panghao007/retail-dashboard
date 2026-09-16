/* 移动端共享逻辑：直读已发布 PC 看板（纯皮肤，零中间数据文件）
   各看板取数均来自 ghpages_repo 已发布的 PC 看板，PC 一更新手机自动跟随。 */
const PERIOD_ORDER = ['day', 'yest', 'week', 'lastweek', 'month', 'lastmonth'];
const PERIOD_LABEL = {day:'当日', yest:'昨日', week:'本周', lastweek:'上周', month:'本月', lastmonth:'上月', all:'全部'};
/* 预订单专用周期：在通用 6 档后追加「全部」（数据走服务端预聚合的 all_period.json，不逐日拉取） */
const PREORDER_PERIODS = PERIOD_ORDER.concat(['all']);

/* ---------- 分公司固定展示顺序（2026-09-12 逄总要求） ----------
   所有涉及分公司的列表（有效性/合规收银/付费会员/零售退货，含驾驶舱卡片与派生排名）
   一律按此固定顺序展示，不随指标高低浮动 —— 便于每日横向对比同一位置的变化。
   不在清单内的分公司排在末尾（按名称排序）。 */
const BRANCH_ORDER = ['北京中恒','北京易联','北京飞航','四川新跃','福建易联','上海爱飞'];
function branchIdx(n){ const i=BRANCH_ORDER.indexOf(String(n==null?'':n).trim()); return i<0? BRANCH_ORDER.length : i; }
function sortBranch(list, keyFn){
  const k = keyFn || function(x){ return (x&&x.name)||''; };
  return (list||[]).slice().sort((a,b)=>{
    const ka=String(k(a)||''), kb=String(k(b)||'');
    const ia=branchIdx(ka), ib=branchIdx(kb);
    if(ia!==ib) return ia-ib;
    return ka.localeCompare(kb,'zh');
  });
}

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
/* 分公司条目（固定顺序版）：序号徽章用中性色，不再以红/橙/绿暗示排名优劣 ——
   分公司列表已按 BRANCH_ORDER 固定排序，序号仅表示展示位置，不代表好坏。 */
function branchItem(rankIdx, name, valueText, valueColor, barPct, barColor){
  const bar = (typeof barPct==='number'&&barPct>0)
    ? `<div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.max(8,Math.min(100,Math.round(barPct)))}%;background:${barColor||'#0071E3'}"></div></div>` : '';
  const rc = (typeof rankIdx==='number')? `<div class="rank" style="background:#8e8e93">${rankIdx+1}</div>`:'';
  return `<div class="detail-item"><div class="detail-item-name">${rc}${esc(name)}</div>`
    +`<div class="detail-item-bar">${bar}<div class="detail-item-value ${valueColor||''}">${esc(valueText)}</div></div></div>`;
}
function detailItem(rankIdx, name, valueText, valueColor, barPct, barColor){
  const bar = (typeof barPct==='number'&&barPct>0)
    ? `<div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.max(8,Math.min(100,Math.round(barPct)))}%;background:${barColor||'#ff3b30'}"></div></div>` : '';
  const rc = (typeof rankIdx==='number')? `<div class="rank" style="background:${rankColor(rankIdx)}">${rankIdx+1}</div>`:'';
  return `<div class="detail-item"><div class="detail-item-name">${rc}${esc(name)}</div>`
    +`<div class="detail-item-bar">${bar}<div class="detail-item-value ${valueColor||''}">${esc(valueText)}</div></div></div>`;
}

/* ---------- 底层取数 ---------- */
/* 缓存策略（2026-09-12 提速）：GitHub Pages 响应带 ETag + cache-control:max-age=600。
   原用 cache:'no-store' → 每次进入都强制全量重下（d/index.html 357KB、cashier 379KB、
   paid 11 天×68KB…），移动端每次进都很慢。
   改用 cache:'no-cache'（no-cache = 每次向服务端重验证，而非禁用缓存）：
   文件未变更时服务端回 304（0 字节，~0.6s），既大幅省流量又保证数据新鲜（变更即 200 取新）。 */
async function fetchText(url){
  const r = await fetch(url, {cache:'no-cache'});
  if(!r.ok) throw new Error('HTTP '+r.status+' '+url);
  return await r.text();
}
async function fetchJson(url){
  const r = await fetch(url, {cache:'no-cache'});
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
/* 北京时间 YYYYMMDD；offset = 往前推的天数 */
function bjYMD(offset){
  const bj=new Date(Date.now()+8*3600000-(offset||0)*86400000);
  return bj.getUTCFullYear()+String(bj.getUTCMonth()+1).padStart(2,'0')+String(bj.getUTCDate()).padStart(2,'0');
}
function periodDateSet(allDates, kind, latest){
  allDates = allDates.map(norm); latest = norm(latest);
  if(!allDates.length || !latest) return [];
  if(kind==='day') return [latest];
  if(kind==='yest'){ const i=allDates.indexOf(latest); return i>0?[allDates[i-1]]:[]; }
  if(kind==='week'){
    const d=new Date(latest.slice(0,4)+'-'+latest.slice(4,6)+'-'+latest.slice(6,8));
    const mon=new Date(d); mon.setDate(d.getDate()-((d.getDay()+6)%7)); // 周一基准（周日=0→移6天）
    return allDates.filter(x=>{ const t=new Date(x.slice(0,4)+'-'+x.slice(4,6)+'-'+x.slice(6,8)); return t>=mon && t<=d; });
  }
  if(kind==='lastweek'){
    const d=new Date(latest.slice(0,4)+'-'+latest.slice(4,6)+'-'+latest.slice(6,8));
    const mon=new Date(d); mon.setDate(d.getDate()-((d.getDay()+6)%7));
    const pmon=new Date(mon); pmon.setDate(mon.getDate()-7);
    const psun=new Date(pmon); psun.setDate(pmon.getDate()+6);
    const fmt=x=>x.getFullYear()+('0'+(x.getMonth()+1)).slice(-2)+('0'+x.getDate()).slice(-2);
    const a=fmt(pmon), b=fmt(psun);
    return allDates.filter(x=>x>=a && x<=b);
  }
  if(kind==='month') return allDates.filter(x=>x.slice(0,6)===latest.slice(0,6));
  if(kind==='all') return allDates.slice();   // 全部（预订单用；其数据由 all_period.json 预聚合，不走逐日）
  if(kind==='lastmonth'){
    const d=new Date(latest.slice(0,4)+'-'+latest.slice(4,6)+'-01'); d.setDate(0);
    const lm=d.getFullYear()+('0'+(d.getMonth()+1)).slice(-2);
    return allDates.filter(x=>x.slice(0,6)===lm);
  }
  return [];
}

/* ---------- 会员有效性 ---------- */
function buildStorePhone(ss, idl){
  // 🔴 口径对齐 PC（2026-09-12 修「数据不对」）：PC 的 store_stats 按「无效会员订单笔数」降序
  //    （零售会员分析.py: store_stats.sort(key=lambda x: x["无效会员订单"], reverse=True)），
  //    卡片标题也是「无效会员订单最多门店 TOP20」。此前移动端按「无效占比」排、且额外加了
  //    「总订单数≥20」过滤 —— 与 PC 完全不符，导致看到的小店占比高但笔数少。现已对齐：
  //    不过滤、按无效订单笔数降序，展示值仍带无效占比供参考。
  const storeTop10 = (ss||[]).filter(s=>s && s['门店']).map(s=>({
    name:s['门店'], company:s['所属分公司']||'', total:s['总订单数']||0, invalid:s['无效会员订单']||0, rate:+(s['无效占比']||0).toFixed(2)
  })).sort((a,b)=>(b.invalid-a.invalid)||(b.rate-a.rate)).slice(0,10);
  const phoneTop = (idl||[]).slice(0,6).map(x=>({
    phone:x['会员手机号']||'', count:x['当月使用次数']||0, stores:x['涉及门店数']||0, companies:x['涉及分公司']||'',
    meta:'涉及'+(x['涉及门店数']||0)+'家门店 · '+(x['涉及分公司']||'')
  }));
  const focusStore = (ss&&ss.length)? (function(){ const top=ss[0]; return {
    name:top['门店'], company:top['所属分公司']||'', phone:(top['无效号码']||[])[0]||'',
    rate:+(top['无效占比']||0).toFixed(2), invalid:top['无效会员订单']||0, total:top['总订单数']||0
  }; })() : null;
  return { storeTop10, phoneTop, focusStore };
}
async function loadMember(opts){
  // 提速（2026-09-12）：opts.light=true 时跳过 188KB 详情 JSON。
  // 驾驶舱卡片只用周期 KPI/分公司（全在 VAL_PERIODS 里），那份额外的
  // store_stats/invalid_detail 兜底 JSON 只有详情页需要；省下一次请求与 188KB 下载。
  const light = !!(opts && opts.light);
  const html = await fetchText(enc('../d/index.html'));
  if(!html) return null;
  const VP = extractJsonVar(html, 'VAL_PERIODS');
  if(!VP) return null;
  // 🔴 口径铁律（2026-09-12 修「切日期下面不变」）：
  //    d/<日期>_dashboard_data.json 是「当月累计」快照（09-10→09-11 总量 9814→10845 递增），
  //    把它当单日/单周口径用是错的。每个周期（当日/昨日/本周/本月/上月）的分公司口径只存在于
  //    VAL_PERIODS[p].branches —— 与 PC 看板周期按钮联动分公司表用的是同一份数据，必须按周期取。
  // 当月累计快照：门店/号码维度的兜底源（仅当新管线未注入周期口径时使用）
  let monthSS=[], monthIDL=[], monthLatest='', fxCount=0;
  const _ld = (VP.day && VP.day.dates && VP.day.dates[0]) ? VP.day.dates[0] : '';
  if(!light && _ld){ try{ const dd=await fetchJson(enc('../d/'+_ld+'_dashboard_data.json')); if(dd){ monthSS=dd.store_stats||[]; monthIDL=dd.invalid_detail||[]; monthLatest=dd.latest_date||_ld; fxCount=dd.fx_count||0; } }catch(e){} }
  const periods={};
  for(const p of PERIOD_ORDER){
    const d=VP[p]; if(!d) continue;
    const dates=(d.dates||[]).map(norm);
    const total=d.total||0, valid=d.valid||0, invalid=d.invalid||0;
    const branchList=sortBranch(Object.keys(d.branches||{}).filter(n=>n).map(n=>{
      const v=(d.branches||{})[n]||{};
      const vd=v.valid||0, iv=v.invalid||0, tt=v.total||(vd+iv);
      return {name:n, valid:vd, invalid:iv, total:tt, invalidRate: tt?+(iv/tt*100).toFixed(2):0, validRate: tt?+(vd/tt*100).toFixed(2):0};
    }));
    // 分公司按固定顺序（不再按无效占比浮动）
    // 门店/号码维度：优先周期口径（新管线注入），否则回退当月累计
    const ss=(d.store_stats&&d.store_stats.length)?d.store_stats:monthSS;
    const idl=(d.invalid_detail&&d.invalid_detail.length)?d.invalid_detail:monthIDL;
    const sp=buildStorePhone(ss, idl);
    periods[p]={ dates, total, valid, invalid,
      validRate: total?+(valid/total*100).toFixed(2):0,
      invalidRate: total?+(invalid/total*100).toFixed(2):0,
      branchList, storeTop10:sp.storeTop10, phoneTop:sp.phoneTop, focusStore:sp.focusStore };
  }
  if(!Object.keys(periods).length) return null;
  const latestDate = _ld || monthLatest;
  const latest = monthLatest || latestDate;
  let branchList=(periods.month&&periods.month.branchList)||[];
  if(!branchList.length) branchList=(periods.day&&periods.day.branchList)||[];
  const storeTop10=(periods.month&&periods.month.storeTop10)||[];
  const phoneTop=(periods.month&&periods.month.phoneTop)||[];
  const focusStore=(periods.month&&periods.month.focusStore)||null;
  const rules='≤2次有效 / >2次无效 / 跨门店救回。已剔除无会员号订单与福建精准FX '+fxCount+'单。';
  const detailScope='本月累计（截至 '+latest+'）';
  return { periods, latest_date: latest, branchList, storeTop10, phoneTop, focusStore, rules, detailScope };
}

/* ---------- 合规收银 ---------- */
function cashierBranch(D){
  const bs=D.branch_stat||{};
  // 分公司按固定顺序（此前按不合规笔数降序浮动）
  return sortBranch(Object.keys(bs).filter(n=>n).map(n=>{ const v=bs[n]; return {name:n, noncompliant:v.noncomp||0, compliant:v.comp||0, total:v.count||0, rate:+(v.rate||0).toFixed(2)}; }));
}
function cashierStore(D){
  const ss=D.store_stat||{};
  // 🔴 口径对齐 PC（2026-09-12 修「数据不对」）：PC 门店表为
  //    filter(noncomp>0) + sort(noncomp desc)（收银合规分析.py:650）。
  //    此前移动端排序写成 (-b.noncompliant)||(a.rate-b.rate) —— 只用了 b、根本没比较 a，
  //    等于乱序；且未过滤 noncomp=0 的门店，导致合规门店混进「不合规门店 TOP10」。
  return Object.keys(ss).filter(n=>n && (ss[n].noncomp||0)>0).map(n=>{ const v=ss[n]; return {name:n, company:'', total:v.count||0, noncompliant:v.noncomp||0, rate:+(v.rate||0).toFixed(2)}; }).sort((a,b)=>(b.noncompliant-a.noncompliant)||(a.rate-b.rate)).slice(0,10);
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
  const tM = html.match(/var\s+T\s*=\s*"([^"]+)"/);
  const T = (tM && tM[1]) ? tM[1] : null;  // 合规收银数据日期 YYYYMMDD，供移动端"不合规明细 CSV"下载
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
  return { periods, latest_date: T || undefined };
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
    // 分公司按固定顺序（不再按退货率浮动）
    const branchList=sortBranch(Object.entries(br).filter(([b])=>b).map(([b,x])=>({name:b, rate:x.sales_count?+(x.return_count/x.sales_count*100).toFixed(2):0, returnCount:x.return_count, salesCount:x.sales_count})));
    const storeTop10=Object.entries(st).filter(([s])=>s && st[s].sales_count>=20).map(([s,x])=>({name:s, company:sb[s]||'', rate:x.sales_count?+(x.return_count/x.sales_count*100).toFixed(2):0, returnCount:x.return_count, salesCount:x.sales_count, amount:Math.round(x.return_amount||0)})).sort((a,b)=>b.rate-a.rate).slice(0,10);
    const compMap={};
    for(const [s,x] of Object.entries(st)){ const c=sb[s]||'未知'; (compMap[c]=compMap[c]||[]).push({name:s, rate:x.sales_count?+(x.return_count/x.sales_count*100).toFixed(2):0, returnCount:x.return_count, salesCount:x.sales_count, amount:Math.round(x.return_amount||0)}); }
    // 分公司→门店分组同样按固定顺序（此前按退货率浮动）
    const branchStore=sortBranch(Object.entries(compMap).map(([c,lst])=>{ const lst2=lst.slice().sort((a,b)=>b.rate-a.rate).slice(0,5); const crc=lst2.reduce((a,x)=>a+x.returnCount,0), csc=lst2.reduce((a,x)=>a+x.salesCount,0); return {company:c, rate:csc?+(crc/csc*100).toFixed(2):0, stores:lst2}; }), x=>x.company);
    periods[p]={ dates:sel.slice().sort(), returnCount:rc, salesCount:sc, rate:sc?+(rc/sc*100).toFixed(2):0, branchList, storeTop10, branchStore };
  }
  if(!Object.keys(periods).length) return null;
  return { periods, latest_date: R.generated||latest };
}

/* 零售退货·总览页专用轻量版：只取最近一天的退货明细（约 26KB），
   与 dashboard.html 所用的 RDATA.daily 逐字同构（同一次管线同时生成），
   仅为一张卡片避免下载 1.1MB 看板全文。失败则由调用方回退 loadReturn()。 */
async function loadReturnLight(){
  for(let back=0; back<=7; back++){
    const dt=bjYMD(back);
    let j=null;
    try{ j=await fetchJson(enc('../return_order/daily/'+dt+'.json')); }catch(e){ continue; }
    if(!j || j.return_count==null) continue;
    const dk=norm(j.date||dt);
    const br={};
    for(const [b,v] of Object.entries(j.branch||{})){
      if(!b) continue;
      br[b]={return_count:v.return_count||0, sales_count:v.sales_count||0};
    }
    // 分公司按固定顺序（此前按退货率浮动）
    const branchList=sortBranch(Object.entries(br).map(([b,x])=>({
      name:b,
      rate:x.sales_count?+(x.return_count/x.sales_count*100).toFixed(2):0,
      returnCount:x.return_count, salesCount:x.sales_count
    }))).slice(0,6);
    const period={
      dates:[dk], returnCount:j.return_count||0, salesCount:j.sales_count||0,
      rate:j.sales_count?+(j.return_count/j.sales_count*100).toFixed(2):0,
      branchList, storeTop10:[], branchStore:[]
    };
    return { periods:{ day: period }, latest_date: dk };
  }
  return null;
}

/* ---------- 付费会员 ---------- */
async function loadPaid(onlyPeriods){
  let idx;
  try{ idx = await fetchJson(enc('../paid_member/daily_index.json')); }catch(e){ return null; }
  if(!idx || !idx.dates || !idx.dates.length) return null;
  const dates=idx.dates.map(norm).sort();
  const latest=dates[dates.length-1];
  // 只算指定周期时，仅拉取这些周期覆盖的日期（总览页只看当月 → 从 42 天降到约 11 天）
  const wantP=(Array.isArray(onlyPeriods)&&onlyPeriods.length)?onlyPeriods:PERIOD_ORDER;
  const needSet=new Set();
  for(const p of wantP) periodDateSet(dates,p,latest).forEach(d=>needSet.add(norm(d)));
  const needDates=[...needSet].filter(d=>dates.includes(d)).sort();
  const cache={};
  async function getDay(dt){ if(cache[dt]) return cache[dt]; const j=await fetchJson(enc('../paid_member/daily/'+dt+'.json')); cache[dt]=j||null; return cache[dt]; }
  const days=await Promise.all(needDates.map(getDay));
  const validDays=days.filter(Boolean);
  if(!validDays.length) return null;
  const periods={};
  for(const p of wantP){
    const ds=periodDateSet(dates,p,latest);
    const sel=validDays.filter(d=>ds.includes(norm(d.date||'')));
    if(!sel.length) continue;
    const tot={denominator:0,numerator:0,order_denom:0,order_num:0,amount:0,profit:0};
    const br={}; const stMap={};
    // VIP 档位（vip_items）按 code 归并：{code:{name,qty}}
    function addTier(bucket, items){
      (items||[]).forEach(it=>{
        if(!it || !it.code) return;
        const t=bucket[it.code]=bucket[it.code]||{name:(it.name||it.code).replace(/会员套餐?/,''),qty:0};
        t.qty+=(it.qty||0);
      });
    }
    // 档位对象 -> 按销量降序的数组
    function tierArr(o){ return Object.keys(o||{}).map(k=>({code:k,name:o[k].name,qty:Math.round(o[k].qty)})).sort((a,b)=>b.qty-a.qty); }
    for(const d of sel){
      const t=d.total||{}; for(const k in tot) tot[k]+=(t[k]||0);
      for(const [b,v] of Object.entries(d.branches||{})){
        const acc=br[b]=br[b]||{denominator:0,numerator:0,order_denom:0,order_num:0,amount:0,profit:0,tiers:{}};
        for(const k in tot) acc[k]+=(v[k]||0);
        addTier(acc.tiers, v.vip_items);
      }
      // 门店按店名跨天合并（此前逐天 push 会让同一门店重复上榜 / 档位缺失）
      (d.stores||[]).forEach(s=>{
        if(!s || !s.store) return;
        const o=stMap[s.store]=stMap[s.store]||{store:s.store,branch:s.branch||'',denominator:0,numerator:0,amount:0,profit:0,tiers:{}};
        o.denominator+=(s.denominator||0); o.numerator+=(s.numerator||0);
        o.amount+=(s.amount||0); o.profit+=(s.profit||0);
        if(!o.branch && s.branch) o.branch=s.branch;
        addTier(o.tiers, s.vip_items);
      });
    }
    const rate=tot.denominator?+(tot.numerator/tot.denominator*100).toFixed(2):0;
    const orderRate=tot.order_denom?+(tot.order_num/tot.order_denom*100).toFixed(2):0;
    // 分公司按固定顺序（此前按连带率浮动）
    const branchList=sortBranch(Object.entries(br).filter(([b])=>b).map(([b,v])=>({name:b, rate:v.denominator?+(v.numerator/v.denominator*100).toFixed(2):0, denominator:Math.round(v.denominator), numerator:Math.round(v.numerator), value:Math.round(v.amount), profit:Math.round(v.profit), tiers:tierArr(v.tiers), meta:Math.round(v.denominator)+'台 · VIP'+Math.round(v.numerator)+' · 产值¥'+(v.amount/10000).toFixed(2)+'万 · 纯利¥'+(v.profit/10000).toFixed(2)+'万'})));
    const storeTop10=Object.values(stMap).filter(s=>s.store && (s.denominator||0)>=5).map(s=>({name:s.store, company:s.branch||'', rate:s.denominator?+(s.numerator/s.denominator*100).toFixed(2):0, denominator:Math.round(s.denominator||0), numerator:Math.round(s.numerator||0), tiers:tierArr(s.tiers)})).sort((a,b)=>b.rate-a.rate).slice(0,10);
    periods[p]={ dates:ds.slice().sort(), denominator:Math.round(tot.denominator), numerator:Math.round(tot.numerator), rate, orderRate, value:Math.round(tot.amount), profit:Math.round(tot.profit), branchList, storeTop10 };
  }
  if(!Object.keys(periods).length) return null;
  return { periods, latest_date: latest };
}

/* ---------- 预订单（频繁预订风险识别） ----------
   直读 ghpages_repo/preorder/ 的索引 + 每日原子 JSON（与 PC 同一次管线生成），
   复用 periodDateSet 周期拉齐（含「上周」），分公司固定顺序、ASP 已在 Python 侧剔除。
   重点：会员手机号维度识别同号码周期内频繁预订（≥freq_threshold 红标风险）。 */
/* ---------- 预订单加密包：解密 / 会话缓存（index 与 preorder 页共用） ----------
   预订单明文 JSON 已不再发布，全部数据加密为 ../preorder/preorder_bundle.enc
   （PBKDF2-SHA256 10万次 → AES-256-GCM，格式 base64(salt16‖iv12‖ct‖tag16)）。
   🔴 解密包 JSON 约 10.9MB，远超 sessionStorage 约 5MB 配额（会抛 QuotaExceededError），
   故会话内只缓存「访问密码」（几十字节），两页均以密码静默重解密，避免重复输入。 */
const PO_PWKEY='po_pw_v1';
const PO_ENC_PATH='../preorder/preorder_bundle.enc';
async function poDeriveKey(pw, salt){
  const bk=await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:100000, hash:'SHA-256'}, bk, {name:'AES-GCM', length:256}, false, ['decrypt']);
}
async function poDecryptBundle(b64, pw){
  const bin=new Uint8Array(atob(b64).split('').map(c=>c.charCodeAt(0)));
  const salt=bin.slice(0,16), iv=bin.slice(16,28), data=bin.slice(28);
  const key=await poDeriveKey(pw, salt);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, data);
  return JSON.parse(new TextDecoder().decode(plain));
}
function poCachedPass(){ try{ return sessionStorage.getItem(PO_PWKEY)||null; }catch(e){ return null; } }
function poRememberPass(pw){ try{ sessionStorage.setItem(PO_PWKEY, pw); }catch(e){} }
function poForgetPass(){ try{ sessionStorage.removeItem(PO_PWKEY); }catch(e){} }
/* 用密码解密并落地（成功返回 true；密码错误 / 数据损坏抛异常） */
async function poUnlockWith(pw){
  const b64=await (await fetch(enc(PO_ENC_PATH), {cache:'no-cache'})).text();
  const bundle=await poDecryptBundle(b64, pw);
  if(!bundle || !bundle.files) throw new Error('bad bundle');
  window.__PO=bundle.files;
  poRememberPass(pw);
  return true;
}
/* 会话内已解锁过 → 用缓存密码静默解密；成功返回 true，无缓存/失败返回 false */
async function poAutoUnlock(){
  if(window.__PO) return true;
  const pw=poCachedPass();
  if(!pw) return false;
  try{ await poUnlockWith(pw); return true; }
  catch(e){ poForgetPass(); return false; }
}
/* 预订单加密后，所有数据来自本地解密包 window.__PO（输密码后注入，或会话内静默解密）。
   明文 JSON 已不再发布，此处改为读内存对象。 */
function poFile(rel){ return (window.__PO && window.__PO[rel]) || null; }
async function loadPreorder(onlyPeriods){
  let idx;
  try{ idx = poFile('preorder_index.json'); }catch(e){ return null; }
  if(!idx || !idx.dates || !idx.dates.length) return null;
  const dates=idx.dates.map(norm).sort();
  const latest=dates[dates.length-1];
  const freq=idx.freq_threshold||3;
  const wantP=(Array.isArray(onlyPeriods)&&onlyPeriods.length)?onlyPeriods:PREORDER_PERIODS;
  const needSet=new Set();
  // 「全部」不逐日拉取（280 个请求太重），改用服务端预聚合的 all_period.json
  for(const p of wantP){ if(p==='all') continue; periodDateSet(dates,p,latest).forEach(d=>needSet.add(norm(d))); }
  const needDates=[...needSet].filter(d=>dates.includes(d)).sort();
  const cache={};
  async function getDay(dt){ if(cache[dt]) return cache[dt]; const j=poFile('daily/'+dt+'.json'); cache[dt]=j||null; return cache[dt]; }
  const days=await Promise.all(needDates.map(getDay));
  const validDays=days.filter(Boolean);
  if(!validDays.length) return null;
  const periods={};
  for(const p of wantP){
    const ds=periodDateSet(dates,p,latest);
    const sel=validDays.filter(d=>ds.includes(norm(d.date||'')));
    if(!sel.length) continue;
    let count=0, amount=0, recv=0, verified=0, refund=0;
    const br={}, st={}, ph={};
    for(const d of sel){
      count+=(d.count||0); amount+=(d.amount||0); recv+=(d.recv||0); verified+=(d.verified||0); refund+=(d.refund||0);
      for(const [b,v] of Object.entries(d.branch||{})){
        if(!b) continue;
        const acc=br[b]=br[b]||{count:0,amount:0,recv:0,verified:0,refund:0};
        acc.count+=(v.count||0); acc.amount+=(v.amount||0); acc.recv+=(v.recv||0); acc.verified+=(v.verified||0); acc.refund+=(v.refund||0);
      }
      for(const [s,v] of Object.entries(d.store||{})){
        if(!s) continue;
        const acc=st[s]=st[s]||{count:0,amount:0,recv:0,verified:0,refund:0,branch:''};
        acc.count+=(v.count||0); acc.amount+=(v.amount||0); acc.recv+=(v.recv||0); acc.verified+=(v.verified||0); acc.refund+=(v.refund||0);
        if(!acc.branch && v.branch) acc.branch=v.branch;
      }
      for(const [phn,v] of Object.entries(d.phone||{})){
        if(!phn) continue;
        const acc=ph[phn]=ph[phn]||{count:0,amount:0,recv:0,verified:0,refund:0,stores:new Set()};
        acc.count+=(v.count||0); acc.amount+=(v.amount||0); acc.recv+=(v.recv||0); acc.verified+=(v.verified||0); acc.refund+=(v.refund||0);
        (v.stores||[]).forEach(s=>acc.stores.add(s));
      }
    }
    // 分公司按固定顺序（此前按笔数浮动）
    const branchList=sortBranch(Object.entries(br).filter(([b])=>b).map(([b,v])=>({name:b, count:v.count, amount:Math.round(v.amount), recv:Math.round(v.recv), verified:Math.round(v.verified), refund:Math.round(v.refund)})));
    // 门店 TOP10（按预订单数降序，展示值带金额）
    const storeTop10=Object.entries(st).filter(([s])=>s).map(([s,v])=>({name:s, company:v.branch||'', count:v.count, amount:Math.round(v.amount), recv:Math.round(v.recv), verified:Math.round(v.verified), refund:Math.round(v.refund)})).sort((a,b)=>b.count-a.count).slice(0,10);
    // 会员手机号维度：全量按次数降序，频繁(≥freq)红标风险
    const phoneList=Object.keys(ph).map(phn=>{ const v=ph[phn]; return {phone:phn, count:v.count, amount:Math.round(v.amount), recv:Math.round(v.recv), verified:Math.round(v.verified), refund:Math.round(v.refund), stores:[...v.stores], risk:v.count>=freq}; }).sort((a,b)=>b.count-a.count);
    const riskCount=phoneList.filter(x=>x.risk).length;
    const storeCount=Object.keys(st).length;
    const storeBreakdown=Object.entries(st).filter(([s])=>s).map(([s,v])=>({company:v.branch||'', count:v.count, amount:Math.round(v.amount)}));
    periods[p]={ dates:ds.slice().sort(), count, amount:Math.round(amount), recv:Math.round(recv), verified:Math.round(verified), refund:Math.round(refund), storeCount, branchList, storeTop10, phoneList, riskCount, freq, storeBreakdown };
  }
  // 「全部」周期：读服务端预聚合快照（单请求），保证与逐日口径一致且不压垮移动端
  if(wantP.includes('all')){
    try{
      const ap=poFile('all_period.json');
      if(ap){
        periods.all={
          dates:[ap.first_date, ap.last_date].filter(Boolean),
          days:ap.days||0,
          count:ap.count||0,
          amount:Math.round(ap.amount||0), recv:Math.round(ap.recv||0),
          verified:Math.round(ap.verified||0), refund:Math.round(ap.refund||0),
          storeCount:ap.storeCount||0,
          branchList:sortBranch((ap.branch||[]).map(b=>({name:b.name, count:b.count, amount:Math.round(b.amount||0),
            recv:Math.round(b.recv||0), verified:Math.round(b.verified||0), refund:Math.round(b.refund||0)}))),
          storeTop10:(ap.storeTop10||[]).map(s=>({name:s.name, company:s.company||'', count:s.count,
            amount:Math.round(s.amount||0), recv:Math.round(s.recv||0), verified:Math.round(s.verified||0), refund:Math.round(s.refund||0)})),
          phoneList:(ap.phoneList||[]).map(x=>({phone:x.phone, count:x.count, amount:Math.round(x.amount||0),
            recv:Math.round(x.recv||0), verified:Math.round(x.verified||0), refund:Math.round(x.refund||0),
            stores:x.stores||[], risk:!!x.risk})),
          riskCount:ap.riskCount||0, freq,
          storeBreakdown: ap.storeBreakdown||{},
        };
      }
    }catch(e){}
  }
  // 充值未核销（沉淀）快照：独立快照，不随周期切换
  let rechargeUnused=null;
  try{ rechargeUnused=poFile('recharge_unused.json'); }catch(e){}
  if(!Object.keys(periods).length) return null;
  return { periods, latest_date: idx.latest_date||latest, freq, rechargeUnused };
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
    // 页面可选钩子：BUILD 返回纯字符串，需在插入 DOM 后再做交互初始化/懒渲染（如预订单的沉淀分档列表）
    if(typeof window.AFTER_BUILD==='function'){ try{ window.AFTER_BUILD(periods[active], dash, active); }catch(e){} }
    requestAnimationFrame(()=>{ document.querySelectorAll('.progress-fill').forEach(b=>{ const w=b.style.width; b.style.width='0'; setTimeout(()=>b.style.width=w,60); }); });
  }
  tabRow.addEventListener('click',e=>{ const t=e.target.closest('.tab-item'); if(!t) return; active=t.dataset.p; render(); });
  render();
}
