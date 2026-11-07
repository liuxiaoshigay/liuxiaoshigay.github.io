/* 页面逻辑：读句子 → 排版 → 画词云 → 点击聚焦 / 列表 / 键盘。 */
(function () {
  'use strict';

  var doc = document;
  var docEl = doc.documentElement;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var cloudEl = doc.getElementById('cloud');
  var sourceList = doc.getElementById('quotes');
  var stageEl = doc.querySelector('.stage');
  var emptyEl = doc.getElementById('empty');
  var speakerEl = doc.getElementById('focus-speaker');
  var focusInfo = doc.getElementById('focus-info');
  var hintEl = doc.getElementById('hint');
  var countEl = doc.getElementById('quote-count');
  var dialog = doc.getElementById('list-dialog');
  var listBody = doc.getElementById('list-body');
  var filterEl = doc.getElementById('quote-filter');
  var listEmpty = doc.getElementById('list-empty');
  var noteEl = doc.getElementById('sheet-note');
  var shuffleBtn = doc.getElementById('shuffle');
  var openListBtn = doc.getElementById('open-list');
  var closeListBtn = doc.getElementById('close-list');
  var soloEl = doc.getElementById('solo');
  var soloTextEl = doc.getElementById('solo-text');
  var soloWhoEl = doc.getElementById('solo-who');

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  var finePointer = window.matchMedia
    ? window.matchMedia('(pointer: fine)')
    : { matches: true };

  var entries = [];      // 与 <li> 一一对应，包含空句
  var visible = [];      // 真正有文字的句子
  var svg = null;
  var textEls = [];
  var activeEl = null;
  var flyingEl = null;
  var animId = 0;
  var renderId = 0;
  var hasPainted = false;
  var hintTimer = 0;
  var soloOpen = false;
  var soloTimer = 0;

  /* 词云里不低于这个字号；再小就不如去列表里看 */
  var MIN_CLOUD_SIZE = 11;

  /* ---------- 读数据 ---------- */

  function readEntries() {
    if (!sourceList) return [];
    return Array.prototype.map.call(sourceList.children, function (li) {
      var text = (li.textContent || '').replace(/\s+/g, ' ').trim();
      var speaker = (li.getAttribute('data-speaker') || '').replace(/\s+/g, ' ').trim();
      return {
        el: li,
        text: text,
        speaker: speaker,
        textEl: null,
        btn: null
      };
    });
  }

  /* ---------- 尺寸 ---------- */

  function currentSize() {
    var w = cloudEl ? cloudEl.clientWidth : 0;
    var h = cloudEl ? cloudEl.clientHeight : 0;
    return {
      w: Math.max(320, Math.round(w || window.innerWidth || 320)),
      h: Math.max(320, Math.round(h || window.innerHeight || 480))
    };
  }

  /* ---------- 渲染 ---------- */

  function render() {
    var ticket = ++renderId;

    if (!visible.length) {
      showEmpty();
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    var size = currentSize();
    var cap = Math.max(26, Math.min(56, Math.min(size.w, size.h) * 0.062));
    var maxWidth = size.w * 0.8;
    var chosen = chooseShowcase(size);
    updateNote(chosen.length);

    var words = chosen.map(function (entry, index) {
      var natural = CloudCore.randomFontSize(chosen.length, Math.random, cap);
      var fitted = CloudCore.fitToWidth(entry.text, natural, maxWidth);
      return {
        entry: entry,
        text: entry.text,
        speaker: entry.speaker,
        size: Math.max(MIN_CLOUD_SIZE, Math.round(fitted)),
        color: CloudCore.colorFor(index, Math.random)
      };
    });

    /* 长句先落位：它们横向几乎占满，越晚放越难找位置。
       竖排散点不靠碰撞排布，顺序保持随机更好看。 */
    if (size.w >= 620) {
      words.sort(function (a, b) {
        return CloudCore.charCount(b.text) * b.size - CloudCore.charCount(a.text) * a.size;
      });
    }

    var job;
    try {
      job = size.w < 620
        ? CloudLayout.stack({ words: words, width: size.w, height: size.h })
        : CloudLayout.layout({ words: words, width: size.w, height: size.h });
    } catch (err) {
      fail(err);
      return;
    }

    job.then(function (result) {
      if (ticket !== renderId) return;
      if (result.error) {
        fail(new Error(result.error));
        return;
      }
      if (!result.words.length) {
        showEmpty();
        return;
      }
      if (!result.complete && window.console) {
        console.warn('[sentences] 屏幕太小，只铺下 ' + result.words.length + ' / ' + words.length + ' 句');
      }
      draw(result.words, size);
      updateNote(result.words.length);
    }).catch(function (err) {
      fail(err);
    });
  }

  /* 屏幕上放不下全部句子时，挑一批能看清的。
     手机取 12–18 句短句竖排；宽屏按面积最多 56 句。
     剩下的都在"全部句子"列表里，点开可单独看。 */
  function chooseShowcase(size) {
    var maxWidth = size.w * 0.8;
    var narrow = size.w < 620;
    var limit = narrow
      ? Math.max(12, Math.min(18, Math.round((size.w * size.h) / 20000)))
      : Math.max(20, Math.min(56, Math.round((size.w * size.h) / 22000)));

    var fits = visible.filter(function (entry) {
      return CloudCore.charCount(entry.text) * MIN_CLOUD_SIZE <= maxWidth;
    });

    // 极端情况：所有句子都长到放不下，退回最短的几条，至少别空白
    var pool = fits.length ? fits : visible.slice().sort(function (a, b) {
      return CloudCore.charCount(a.text) - CloudCore.charCount(b.text);
    });

    if (narrow && fits.length) {
      var short = fits.filter(function (entry) {
        return CloudCore.charCount(entry.text) <= 12;
      });
      if (short.length >= limit) pool = short;
    }

    if (pool.length <= limit) return pool;

    var picked = pool.slice();
    for (var i = picked.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = picked[i];
      picked[i] = picked[j];
      picked[j] = tmp;
    }
    return picked.slice(0, limit);
  }

  function updateNote(shown) {
    if (!noteEl) return;
    if (shown < visible.length) {
      noteEl.hidden = false;
      noteEl.textContent =
        '词云里随机显示 ' + shown + ' 句；全部 ' + visible.length +
        ' 句都在下面的列表里，点一条可以单独看。';
    } else {
      noteEl.hidden = true;
    }
  }

  function draw(words, size) {
    // 重排会换掉整棵 SVG，先把还在飞的动画作废
    animId++;
    flyingEl = null;
    resetFocus();

    if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
    svg = null;
    textEls = [];
    visible.forEach(function (entry) { entry.textEl = null; });

    svg = doc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size.w + ' ' + size.h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('focusable', 'false');

    var group = doc.createElementNS(SVG_NS, 'g');
    group.setAttribute('transform', 'translate(' + (size.w / 2) + ',' + (size.h / 2) + ')');

    words.forEach(function (word) {
      var wrap = doc.createElementNS(SVG_NS, 'g');
      wrap.setAttribute('class', 'word');

      var text = doc.createElementNS(SVG_NS, 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-family', CloudLayout.FONT_FAMILY);
      text.setAttribute('font-size', word.size + 'px');
      text.setAttribute('fill', word.color);
      text.setAttribute('x', word.x);
      text.setAttribute('y', word.y);
      text.textContent = word.text;
      text.__word = word;

      wrap.appendChild(text);
      group.appendChild(wrap);

      if (word.entry) word.entry.textEl = text;
      textEls.push(text);
    });

    svg.appendChild(group);
    cloudEl.appendChild(svg);
    bindCloud();

    if (!hasPainted) {
      hasPainted = true;
      if (!reduceMotion.matches) {
        var nodes = cloudEl.querySelectorAll('g.word');
        Array.prototype.forEach.call(nodes, function (node) {
          node.style.animation =
            'word-in 500ms ease ' + Math.round(Math.random() * 420) + 'ms backwards';
        });
      }
    }
  }

  function showEmpty() {
    resetFocus();
    if (emptyEl) emptyEl.hidden = false;
    if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
    svg = null;
    textEls = [];
    if (countEl) countEl.textContent = '0';
  }

  /* ---------- 点击与聚焦 ---------- */

  function bindCloud() {
    if (!svg) return;
    svg.addEventListener('click', function (ev) {
      var node = ev.target;
      while (node && node !== svg && !node.__word) node = node.parentNode;
      if (!node || !node.__word) return;

      ev.stopPropagation();
      if (activeEl) {
        clearFocus();
        return;
      }
      focusWord(node);
    });
  }

  function focusWord(node) {
    if (!node || !node.__word || activeEl) return;

    var d = node.__word;
    var size = currentSize();
    var scale = targetScale(node, size);
    d.scale = scale;

    activeEl = node;
    node.classList.add('is-active');
    applyRipple(node);
    cloudEl.classList.add('is-focused');

    var label = CloudCore.speakerLabel(d.speaker);
    if (speakerEl) speakerEl.textContent = label;
    if (focusInfo) focusInfo.classList.add('is-visible');
    hideHint();

    animate(node,
      { s: 1, cx: d.x, cy: d.y },
      { s: scale, cx: 0, cy: 0 });
  }

  function clearFocus() {
    if (!activeEl) return;

    var node = activeEl;
    var d = node.__word;
    var from = node.__state || { s: d.scale || 1, cx: 0, cy: 0 };

    activeEl = null;
    cloudEl.classList.remove('is-focused');
    if (focusInfo) focusInfo.classList.remove('is-visible');

    animate(node, from, { s: 1, cx: d.x, cy: d.y }, function () {
      node.classList.remove('is-active');
    });
  }

  /* 立刻回到静止态，不等动画结束（重排、跳转时用） */
  function resetFocus() {
    if (!activeEl) return;

    var node = activeEl;
    var d = node.__word;

    animId++;
    flyingEl = null;
    setState(node, 1, d.x, d.y);
    node.classList.remove('is-active');
    activeEl = null;
    cloudEl.classList.remove('is-focused');
    if (focusInfo) focusInfo.classList.remove('is-visible');
    if (speakerEl) speakerEl.textContent = '';
  }

  function targetScale(node, size) {
    var box;
    try {
      box = node.getBBox();
    } catch (err) {
      return 1;
    }
    var w = box.width || node.getComputedTextLength();
    var h = box.height || (parseFloat(node.getAttribute('font-size')) || 16) * 1.25;
    if (!w || !h) return 1;

    var fitW = (size.w * 0.84) / w;
    var fitH = (size.h * 0.46) / h;
    return Math.max(0.42, Math.min(24, Math.min(fitW, fitH)));
  }

  function applyRipple(origin) {
    var o = origin.__word;
    textEls.forEach(function (node) {
      if (node === origin) {
        node.style.transitionDelay = '0ms';
        return;
      }
      var d = node.__word;
      var dx = d.x - o.x;
      var dy = d.y - o.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      node.style.transitionDelay = Math.round(Math.min(160, dist / 6)) + 'ms';
    });
  }

  /* ---------- 动画 ---------- */

  function setState(node, s, cx, cy) {
    var d = node.__word;
    // scale(s) translate(t) 的合成是 p' = s * (p + t)，
    // 要让词心 (d.x, d.y) 落在 (cx, cy)，t 必须取 cx/s - d.x
    node.setAttribute('transform',
      'scale(' + s.toFixed(4) + ') translate(' +
      (cx / s - d.x).toFixed(3) + ',' + (cy / s - d.y).toFixed(3) + ')');
    node.__state = { s: s, cx: cx, cy: cy };
  }

  function travelMs(from, to) {
    var size = currentSize();
    var dx = to.cx - from.cx;
    var dy = to.cy - from.cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var halfDiagonal = 0.5 * Math.sqrt(size.w * size.w + size.h * size.h);
    var k = halfDiagonal ? Math.min(1, dist / halfDiagonal) : 0;
    return 320 + 260 * k;
  }

  function animate(node, from, to, done) {
    if (reduceMotion.matches) {
      setState(node, to.s, to.cx, to.cy);
      if (done) done();
      return;
    }

    if (flyingEl && flyingEl !== node) snapHome(flyingEl);

    var id = ++animId;
    flyingEl = node;
    var ms = travelMs(from, to);
    var start = performance.now();

    function frame(now) {
      if (id !== animId) return;

      var t = Math.min(1, (now - start) / ms);
      var e = 1 - Math.pow(1 - t, 3); // easeOutCubic

      setState(node,
        from.s + (to.s - from.s) * e,
        from.cx + (to.cx - from.cx) * e,
        from.cy + (to.cy - from.cy) * e);

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        if (flyingEl === node) flyingEl = null;
        if (done) done();
      }
    }

    requestAnimationFrame(frame);
  }

  function snapHome(node) {
    if (!node || !node.__word) return;
    var d = node.__word;
    animId++;
    setState(node, 1, d.x, d.y);
    node.classList.remove('is-active');
    if (flyingEl === node) flyingEl = null;
  }

  /* ---------- 句子列表 ---------- */

  function buildList() {
    if (!sourceList || !listBody) return;
    listBody.appendChild(sourceList);

    entries.forEach(function (entry) {
      if (!entry.text) {
        entry.el.hidden = true;
        return;
      }

      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'quote-btn';

      var text = doc.createElement('span');
      text.className = 'quote-btn__text';
      text.textContent = entry.text;
      btn.appendChild(text);

      if (entry.speaker) {
        var who = doc.createElement('span');
        who.className = 'quote-btn__who';
        who.textContent = entry.speaker;
        btn.appendChild(who);
      }

      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        pick(entry);
      });

      entry.btn = btn;
      entry.el.textContent = '';
      entry.el.appendChild(btn);
    });
  }

  function applyFilter() {
    var q = filterEl ? filterEl.value.trim().toLowerCase() : '';
    var shown = 0;

    entries.forEach(function (entry) {
      if (!entry.btn) return;
      var hit = !q || (entry.text + ' ' + entry.speaker).toLowerCase().indexOf(q) !== -1;
      entry.el.hidden = !hit;
      if (hit) shown++;
    });

    if (listEmpty) listEmpty.hidden = shown !== 0;
  }

  function openList() {
    if (!dialog) return;
    if (activeEl) clearFocus();
    if (dialog.open) return;

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    if (filterEl) filterEl.value = '';
    applyFilter();
    if (listBody) listBody.scrollTop = 0;

    if (finePointer.matches && filterEl) {
      window.setTimeout(function () { filterEl.focus(); }, 50);
    }
  }

  function closeList() {
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function pick(entry) {
    closeList();

    if (activeEl) resetFocus();

    if (entry.textEl) {
      window.setTimeout(function () {
        if (entry.textEl) focusWord(entry.textEl);
      }, 0);
      return;
    }

    // 没铺进词云的长句：用可换行的单句视图兜底
    showSolo(entry);
  }

  /* ---------- 单句视图 ---------- */

  function showSolo(entry) {
    if (!soloEl) return;

    if (soloTextEl) soloTextEl.textContent = entry.text;

    if (soloWhoEl) {
      var label = CloudCore.speakerLabel(entry.speaker);
      soloWhoEl.textContent = label;
      soloWhoEl.hidden = !label;
    }

    soloEl.hidden = false;
    soloOpen = true;
    window.requestAnimationFrame(function () {
      soloEl.classList.add('is-visible');
      try {
        soloEl.focus({ preventScroll: true });
      } catch (err) {
        soloEl.focus();
      }
    });

    hideHint();
  }

  function hideSolo() {
    if (!soloEl || !soloOpen) return;

    soloOpen = false;
    soloEl.classList.remove('is-visible');

    if (soloTimer) clearTimeout(soloTimer);
    soloTimer = window.setTimeout(function () {
      if (!soloOpen) soloEl.hidden = true;
    }, 320);

    if (openListBtn) openListBtn.focus({ preventScroll: true });
  }

  /* ---------- 提示与小按钮 ---------- */

  function hideHint() {
    if (!hintEl) return;
    hintEl.classList.add('is-hidden');
    if (hintTimer) {
      clearTimeout(hintTimer);
      hintTimer = 0;
    }
  }

  function bindUI() {
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        render();
      });
    }

    if (openListBtn) {
      openListBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openList();
      });
    }

    if (closeListBtn) {
      closeListBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        closeList();
      });
    }

    if (filterEl) filterEl.addEventListener('input', applyFilter);

    if (dialog) {
      dialog.addEventListener('click', function (ev) {
        if (ev.target === dialog) closeList();
      });
    }

    if (soloEl) {
      soloEl.addEventListener('click', function (ev) {
        ev.stopPropagation();
        hideSolo();
      });
    }

    doc.body.addEventListener('click', function (ev) {
      var target = ev.target;
      if (target && target.closest && target.closest('.hud, dialog')) return;
      if (activeEl) clearFocus();
    });

    doc.addEventListener('keydown', onKeydown);

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(render, 180);
    });
  }

  function onKeydown(ev) {
    if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;

    var target = ev.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if (ev.key === 'Escape') {
      if (soloOpen) {
        ev.preventDefault();
        hideSolo();
        return;
      }
      if (activeEl) {
        ev.preventDefault();
        clearFocus();
      }
      return;
    }

    if (soloOpen) return;

    if (ev.key === 'l' || ev.key === 'L') {
      if (dialog && !dialog.open) {
        ev.preventDefault();
        openList();
      }
      return;
    }

    if (ev.key === 'r' || ev.key === 'R') {
      if (dialog && dialog.open) return;
      ev.preventDefault();
      render();
    }
  }

  /* ---------- 兜底 ---------- */

  function fail(err) {
    if (window.console) console.error('[sentences]', err);
    docEl.classList.remove('js');
    docEl.setAttribute('data-ready', '');
    if (sourceList && listBody && sourceList.parentNode === listBody && stageEl) {
      stageEl.appendChild(sourceList);
    }
  }

  function init() {
    // 兜底计时器已经把页面切回"纯列表"了（比如脚本极慢），就不要再接管
    if (!docEl.classList.contains('js')) return;

    entries = readEntries();
    visible = entries.filter(function (entry) { return entry.text; });

    if (countEl) countEl.textContent = String(visible.length);

    if (!window.CloudCore || !window.CloudLayout) {
      fail(new Error('依赖脚本没有加载'));
      return;
    }

    // 脚本已经跑起来了，先告诉兜底计时器别再插手；排版慢不算失败
    docEl.setAttribute('data-ready', '');

    buildList();
    bindUI();

    if (!visible.length) {
      showEmpty();
    } else {
      render();
    }

    if (hintEl) hintTimer = window.setTimeout(hideHint, 7000);
  }

  try {
    init();
  } catch (err) {
    fail(err);
  }
})();
