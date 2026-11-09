/* 词云排版：包一层 d3-cloud，负责"铺不下就整体缩小重排"。
   浏览器里挂到 window.CloudLayout；Node 里可以 require 出来单独测。 */
(function (root) {
  'use strict';

  /* 必须和 SVG 里 <text> 的 font-family 一字不差：
     d3-cloud 用 canvas 量出来的宽度决定落位，字体重叠/留白都从这里来 */
  var FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif';

  var PADDING = 4;
  var TARGET_FILL = 0.4;   // 文字总面积大约占视口的四成，留出呼吸感
  var MAX_ATTEMPTS = 6;    // 每轮缩小 14%，最多六轮
  var SHRINK = 0.86;
  var ABS_FLOOR = 9;       // 再挤也不小于 9px

  var measureCanvas = null;

  function measureText(text, size) {
    if (!measureCanvas) {
      measureCanvas = root.document.createElement('canvas');
      measureCanvas.width = 8;
      measureCanvas.height = 8;
    }
    var ctx = measureCanvas.getContext('2d');
    ctx.font = '400 ' + size + 'px ' + FONT_FAMILY;
    return ctx.measureText(String(text)).width;
  }

  function charCount(text) {
    var s = String(text == null ? '' : text);
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < s.length) i++;
      n++;
    }
    return n;
  }

  /* 先估一个能铺下的整体缩放，省掉大部分重排。
     全角字宽约等于字号，行高约 1.25 倍字号，再算上词间距。 */
  function estimateScale(words, width, height) {
    var need = 0;
    for (var i = 0; i < words.length; i++) {
      var size = words[i].size || 0;
      need += charCount(words[i].text) * size * size * 1.25;
    }
    if (need <= 0 || width <= 0 || height <= 0) return 1;
    var target = width * height * TARGET_FILL;
    return Math.min(1, Math.sqrt(target / need));
  }

  function copyWord(w) {
    return {
      text: w.text,
      speaker: w.speaker,
      size: w.size,
      color: w.color,
      entry: w.entry,
      x: 0,
      y: 0
    };
  }

  /* d3-cloud 的螺旋落位整体常常偏上/偏左。这里把整块平移回视口中心，
     同时保证没有任何词被推出边界（平移量按各方向的可移动余量夹住）。 */
  function recenter(words, width, height) {
    if (!words.length) return;

    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      minX = Math.min(minX, w.x + (w.x0 || 0));
      maxX = Math.max(maxX, w.x + (w.x1 || 0));
      minY = Math.min(minY, w.y + (w.y0 || 0));
      maxY = Math.max(maxY, w.y + (w.y1 || 0));
    }

    var wantX = -(minX + maxX) / 2;
    var wantY = -(minY + maxY) / 2;
    var loX = -width / 2 - minX;
    var hiX = width / 2 - maxX;
    var loY = -height / 2 - minY;
    var hiY = height / 2 - maxY;

    var dx = Math.min(hiX, Math.max(loX, wantX));
    var dy = Math.min(hiY, Math.max(loY, wantY));

    for (var j = 0; j < words.length; j++) {
      words[j].x += dx;
      words[j].y += dy;
    }
  }

  /**
   * @param {{words: Array, width: number, height: number, random?: Function}} options
   * @returns {Promise<{words: Array, factor: number, complete: boolean, error?: string}>}
   */
  function layout(options) {
    var width = Math.max(1, Math.round(options.width));
    var height = Math.max(1, Math.round(options.height));
    var input = options.words || [];

    if (!root.d3 || !root.d3.layout || typeof root.d3.layout.cloud !== 'function') {
      return Promise.resolve({
        words: [],
        factor: 1,
        complete: false,
        error: 'd3-cloud 没有加载'
      });
    }

    if (!input.length) {
      return Promise.resolve({ words: [], factor: 1, complete: true });
    }

    var factory = root.d3.layout.cloud;
    var base = input.map(copyWord);
    var factor = estimateScale(base, width, height);
    var attempts = 0;
    var best = [];
    var bestFactor = factor;

    return new Promise(function (resolve) {
      function run() {
        var scaled = base.map(function (w) {
          var copy = copyWord(w);
          copy.size = Math.max(ABS_FLOOR, Math.round(w.size * factor));
          copy.x = 0;
          copy.y = 0;
          return copy;
        });

        factory()
          .size([width, height])
          .words(scaled)
          .padding(PADDING)
          .rotate(function () { return 0; })
          .font(FONT_FAMILY)
          .fontSize(function (d) { return d.size; })
          .on('end', function (placed) {
            if (placed.length > best.length) {
              best = placed;
              bestFactor = factor;
            }

            if (placed.length >= base.length || attempts >= MAX_ATTEMPTS) {
              recenter(best, width, height);
              resolve({
                words: best,
                factor: bestFactor,
                complete: best.length === base.length
              });
              return;
            }

            attempts += 1;
            factor *= SHRINK;
            run();
          })
          .start();
      }

      run();
    });
  }

  /* 旧版窄屏竖排散点，现已不再调用；保留函数只为兼容旧代码。 */
  function stack(options) {
    var width = Math.max(1, Math.round(options.width));
    var height = Math.max(1, Math.round(options.height));
    var input = options.words || [];

    if (!input.length) {
      return Promise.resolve({ words: [], complete: true, factor: 1 });
    }

    var padX = Math.max(18, Math.round(width * 0.055));
    var top = Math.max(82, Math.round(height * 0.11));
    var bottom = Math.max(92, Math.round(height * 0.12));
    var available = Math.max(140, height - top - bottom);
    var gap = Math.max(8, Math.round(width * 0.026));
    var LINE = 1.25;

    var items = input.map(function (w) {
      return {
        text: w.text,
        speaker: w.speaker,
        color: w.color,
        entry: w.entry,
        size: w.size,
        x: 0,
        y: 0
      };
    });

    // 高度不够时整体收字号，保证全部落得下
    var fixedGaps = gap * (items.length - 1);
    var textHeight = 0;
    for (var i = 0; i < items.length; i++) textHeight += items[i].size * LINE;

    if (textHeight + fixedGaps > available) {
      var fit = Math.max(0.4, (available - fixedGaps) / textHeight);
      for (var j = 0; j < items.length; j++) {
        items[j].size = Math.max(10, Math.round(items[j].size * fit));
      }
      textHeight = 0;
      for (var k = 0; k < items.length; k++) textHeight += items[k].size * LINE;
    }

    var used = textHeight + fixedGaps;
    var slack = Math.max(0, available - used);
    var extraGap = items.length > 1 ? Math.min(46, slack / (items.length + 1)) : 0;
    var blockHeight = used + extraGap * (items.length - 1);

    // 可用区域的中心相对视口中心有一点偏移（上下留白不同）
    var cursor = (top - bottom) / 2 - blockHeight / 2;

    for (var m = 0; m < items.length; m++) {
      var item = items[m];
      var lineHeight = item.size * LINE;
      item.y = cursor + lineHeight / 2;
      cursor += lineHeight + gap + extraGap;

      var textWidth = measureText(item.text, item.size);
      var room = (width - padX * 2 - textWidth) / 2;
      item.x = room > 0 ? (Math.random() * 2 - 1) * room * 0.72 : 0;
    }

    return Promise.resolve({ words: items, complete: true, factor: 1 });
  }

  root.CloudLayout = {
    layout: layout,
    stack: stack,
    estimateScale: estimateScale,
    FONT_FAMILY: FONT_FAMILY
  };
})(typeof self !== 'undefined' ? self : this);
