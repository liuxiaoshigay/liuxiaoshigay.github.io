/* 纯函数：字号、配色、说话人标签。
   不碰 DOM，方便单独测试；浏览器里挂到 window.CloudCore。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CloudCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FONT_MIN = 12;
  var FONT_MAX = 56;
  var FONT_SHRINK_AFTER = 55;
  var FONT_SHRINK_RATE = 0.16;

  /* 黄金角取色：相邻索引的色相拉得足够开，
     比纯随机更容易铺出一片干净、不糊的彩色。 */
  var GOLDEN_ANGLE = 137.508;
  var SAT_MIN = 56;
  var SAT_RANGE = 28;
  var LIGHT_MIN = 31;
  var LIGHT_RANGE = 15;

  function fontSizeRange(count, maxCap) {
    var n = Math.max(0, Number(count) || 0);
    var max = FONT_MAX - Math.max(0, n - FONT_SHRINK_AFTER) * FONT_SHRINK_RATE;
    if (maxCap) max = Math.min(max, maxCap);
    max = Math.round(max);
    return {
      min: Math.min(FONT_MIN, max),
      max: Math.max(FONT_MIN, max)
    };
  }

  function randomFontSize(count, rand, maxCap) {
    var range = fontSizeRange(count, maxCap);
    var t = Math.pow(typeof rand === 'function' ? rand() : Math.random(), 1.2);
    return Math.round(range.min + t * (range.max - range.min));
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

  /* 单句的字号上限：先保证这句话横着放得下，再谈随机大小。
     没有这一步，一句 30 字的句子抽到大字号会逼着整个词云一起缩小。 */
  function fitToWidth(text, size, maxWidth) {
    var n = charCount(text);
    if (!n || !maxWidth) return size;
    return Math.min(size, maxWidth / n);
  }

  function colorFor(index, rand) {
    var r = typeof rand === 'function' ? rand : Math.random;
    var hue = (index * GOLDEN_ANGLE + 14 + r() * 10) % 360;
    var sat = SAT_MIN + r() * SAT_RANGE;
    var light = LIGHT_MIN + r() * LIGHT_RANGE;
    return 'hsl(' + hue.toFixed(1) + ', ' + sat.toFixed(0) + '%, ' + light.toFixed(0) + '%)';
  }

  function speakerLabel(speaker) {
    var s = speaker == null ? '' : String(speaker).trim();
    return s ? '—— ' + s : '';
  }

  return {
    fontSizeRange: fontSizeRange,
    randomFontSize: randomFontSize,
    colorFor: colorFor,
    speakerLabel: speakerLabel,
    charCount: charCount,
    fitToWidth: fitToWidth
  };
});
