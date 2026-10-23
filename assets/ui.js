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

  // 纯数值单元格：数字/金额/百分比/带单位数字（不含日期、比率、括号复合值）
  var NUM_RE = /^[¥￥$+-]?[\d,]+(\.\d+)?\s*(%|万|亿|元|台|笔|单|家|人|个|天|次|件)?$/;

  function isNum(txt) {
    var t = (txt || '').replace(/\s/g, '');
    if (!t) return false;
    if (t === '—' || t === '-' || t === '无') return true;   // 占位符随列对齐
    return NUM_RE.test(t);
  }

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

  // 纯符号/数字类短标签（如「38/39（97.44%）」「¥1,234万」）：不换行，宁可整表横向滚动
  var COMPACT_RE = /^[\d\s\/\\（）()%.,¥￥+\-—~·]+$/;

  function markCells(root) {
    var cells = root.querySelectorAll ? root.querySelectorAll('td, th') : [];
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (c.getAttribute('data-ui-l') === '1') continue;
      c.setAttribute('data-ui-l', '1');
      var txt = (c.textContent || '').trim();
      if (txt.length > WRAP_THRESHOLD && !COMPACT_RE.test(txt)) c.classList.add('ui-w');
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

  /* 数字列自动右对齐：按列统计「像数字的单元格」占比，超过 60% 即判为数值列，
     给该列的 th 与 td 都打上 .ui-num（CSS 里统一 text-align:right + 等宽数字）。
     这样各看板表头与数值方向一致，不再出现「列头居左、数字居中」的错位。 */
  function markNumeric(root) {
    var tables = root.querySelectorAll ? root.querySelectorAll('table') : [];
    for (var i = 0; i < tables.length; i++) {
      var rows = tables[i].rows;
      var cols = [], r, c;
      for (r = 0; r < rows.length; r++) {
        var cells = rows[r].cells, ci = 0;
        for (c = 0; c < cells.length; c++) {
          var span = cells[c].colSpan || 1;
          if (span === 1) {
            var txt = (cells[c].textContent || '').trim();
            if (txt) {
              var st = cols[ci] || (cols[ci] = [0, 0]);
              st[1]++;
              if (isNum(txt)) st[0]++;
            }
          }
          ci += span;
        }
      }
      var numCol = {};
      var hit = false;
      for (var k = 0; k < cols.length; k++) {
        var s = cols[k];
        if (s && s[1] >= 2 && s[0] / s[1] >= 0.6) { numCol[k] = 1; hit = true; }
      }
      if (!hit) continue;
      for (r = 0; r < rows.length; r++) {
        var cs = rows[r].cells, ci2 = 0;
        for (c = 0; c < cs.length; c++) {
          var sp = cs[c].colSpan || 1;
          if (sp === 1 && numCol[ci2]) {
            if (cs[c].tagName === 'TH' || (cs[c].textContent || '').trim()) cs[c].classList.add('ui-num');
          }
          ci2 += sp;
        }
      }
    }
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    try { wrapTables(root); } catch (e) {}
    try { markCells(root); } catch (e) {}
    try { markNumeric(root); } catch (e) {}
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
