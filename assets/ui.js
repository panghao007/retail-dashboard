/* ==========================================================================
   首茂零售数据看板 · 统一界面层脚本  v=20261023
   职责只有两件：
     1. 给每张 table 套一层 .tblx 横向滚动容器 —— 手机端不再把表格压变形；
     2. 给长文本单元格加 .ui-w（允许换行），短文本保持不换行，
        彻底消除中文被挤成“一字一行”的竖排现象。
   配合 ui.css 使用；动态渲染（fetch 后重绘）的表格由 MutationObserver 兜住。
   ========================================================================== */
(function () {
  'use strict';

  var WRAP_THRESHOLD = 10;   // 超过这个字数才允许换行并限宽（中文按字符计）

  function isInTblx(el) {
    var p = el.parentNode;
    return !!(p && p.classList && p.classList.contains('tblx'));
  }

  function wrapTables(root) {
    var tables = root.querySelectorAll ? root.querySelectorAll('table') : [];
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      if (!t.parentNode || isInTblx(t)) continue;
      var box = document.createElement('div');
      box.className = 'tblx';
      t.parentNode.insertBefore(box, t);
      box.appendChild(t);
    }
  }

  function markCells(root) {
    var cells = root.querySelectorAll ? root.querySelectorAll('td, th') : [];
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (c.getAttribute('data-ui-l') === '1') continue;
      c.setAttribute('data-ui-l', '1');
      var txt = (c.textContent || '').trim();
      if (txt.length > WRAP_THRESHOLD) c.classList.add('ui-w');
    }
  }

  function markScrollable() {
    var boxes = document.querySelectorAll('.tblx');
    for (var i = 0; i < boxes.length; i++) {
      var bx = boxes[i];
      if (bx.scrollWidth > bx.clientWidth + 4) bx.classList.add('is-scroll');
      else bx.classList.remove('is-scroll');
    }
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    try { wrapTables(root); } catch (e) {}
    try { markCells(root); } catch (e) {}
    try { markScrollable(); } catch (e) {}
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      if (t) clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  var runAll = debounce(function () { scan(document.body); }, 120);

  function boot() {
    scan(document.body);
    if (window.MutationObserver) {
      var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          for (var j = 0; j < muts[i].addedNodes.length; j++) {
            if (muts[i].addedNodes[j].nodeType === 1) { runAll(); return; }
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    // 兜底：图表/异步内容二次渲染
    setTimeout(function () { scan(document.body); }, 600);
    setTimeout(function () { scan(document.body); }, 2000);
    window.addEventListener('resize', debounce(markScrollable, 150));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
