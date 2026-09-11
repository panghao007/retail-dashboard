/* 移动端共享逻辑：加载 data.json、周期切换、渲染辅助 */
let DATA = null;
const PERIOD_LABEL = {day:'当日', yest:'昨日', week:'本周', month:'本月', lastmonth:'上月'};

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

async function boot(dashKey, defaultPeriod){
  const el = document.getElementById('cards');
  el.innerHTML = '<div class="loading">数据加载中…</div>';
  try{
    const res = await fetch('./data.json', {cache:'no-store'});
    DATA = await res.json();
  }catch(e){
    el.innerHTML = '<div class="loading">数据加载失败，请检查网络或稍后重试</div>';
    return;
  }
  const dash = DATA[dashKey];
  if(!dash || !dash.periods){ el.innerHTML='<div class="loading">该看板暂无数据（待下次每日刷新后自动出现）</div>'; return; }
  const periods = dash.periods;
  const avail = Object.keys(periods);
  const latest = dash.latest_date || (periods[avail[avail.length-1]].dates||[])[0] || '';
  const dateEl = document.getElementById('hdrDate');
  if(dateEl) dateEl.innerHTML = '<span class="dot"></span>' + esc(latest? ('数据更新 '+latest):'');
  const genEl = document.getElementById('genTime');
  if(genEl) genEl.textContent = '数据生成于 ' + (DATA.generated||'');
  const tabRow = document.getElementById('tabRow');
  tabRow.innerHTML = avail.map(p=>`<div class="tab-item" data-p="${p}">${esc(tabLabel(p, periods[p]))}</div>`).join('');
  let active = (defaultPeriod && avail.includes(defaultPeriod)) ? defaultPeriod : avail[avail.length-1];
  function render(){
    document.querySelectorAll('.tab-item').forEach(t=>t.classList.toggle('active', t.dataset.p===active));
    try{
      el.innerHTML = window.BUILD(periods[active], dash, active);
    }catch(e){ el.innerHTML='<div class="loading">渲染出错：'+esc(e.message)+'</div>'; return; }
    requestAnimationFrame(()=>{ document.querySelectorAll('.progress-fill').forEach(b=>{ const w=b.style.width; b.style.width='0'; setTimeout(()=>b.style.width=w,60); }); });
  }
  tabRow.addEventListener('click', e=>{ const t=e.target.closest('.tab-item'); if(!t) return; active=t.dataset.p; render(); });
  render();
}
