/* 纯字符串操作：从 index.html 里读出句子、加一句、删一句。
   不碰 DOM、不联网，浏览器和 Node 都能用。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.QuoteDoc = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIST_RE = /(<ul id="quotes" class="quotes">)([\s\S]*?)(<\/ul>)/;
  var MAX_LEN = 120;
  var MAX_SPEAKER = 20;

  function decode(s) {
    return String(s)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function findList(html) {
    var m = LIST_RE.exec(html);
    if (!m) throw new Error('找不到 <ul id="quotes"> 列表');
    return m;
  }

  function parseBody(body) {
    var items = [];
    var re = /<li\b([^>]*)>([\s\S]*?)<\/li>/g;
    var m;
    while ((m = re.exec(body))) {
      var sm = /data-speaker="([^"]*)"/.exec(m[1]);
      var text = m[2].replace(/<[^>]*>/g, '').trim();
      items.push({
        speaker: sm ? decode(sm[1]) : '',
        text: decode(text)
      });
    }
    return { count: items.length, items: items };
  }

  function parse(html) {
    return parseBody(findList(html)[2]);
  }

  function count(html) {
    return parse(html).count;
  }

  function updateCount(html, n) {
    return html.replace(
      /(<span id="quote-count">)\d+(<\/span>)/,
      '$1' + n + '$2'
    );
  }

  function rebuild(html, m, newBody) {
    var start = m.index + m[1].length;
    var out = html.slice(0, start) + newBody + html.slice(start + m[2].length);
    return updateCount(out, parseBody(newBody).count);
  }

  function add(html, speaker, text) {
    text = String(text == null ? '' : text).trim();
    if (!text) throw new Error('句子不能为空');
    if (text.length > MAX_LEN) throw new Error('句子最多 ' + MAX_LEN + ' 字');

    speaker = String(speaker == null ? '' : speaker).trim().slice(0, MAX_SPEAKER);

    var m = findList(html);
    var body = m[2];
    var line = '<li' + (speaker ? ' data-speaker="' + escapeHtml(speaker) + '"' : '') +
      '>' + escapeHtml(text) + '</li>';
    var trimmed = body.replace(/\s+$/, '');
    var newBody = trimmed + '\n    ' + line + '\n  ';
    return rebuild(html, m, newBody);
  }

  function removeAt(html, index) {
    var m = findList(html);
    var body = m[2];
    var re = /<li\b([^>]*)>([\s\S]*?)<\/li>/g;
    var matches = [];
    var x;
    while ((x = re.exec(body))) {
      matches.push({ start: x.index, end: x.index + x[0].length });
    }

    if (!Number.isInteger(index) || index < 0 || index >= matches.length) {
      throw new Error('句子序号不对');
    }

    var target = matches[index];
    var lineStart = body.lastIndexOf('\n', target.start - 1);
    lineStart = lineStart === -1 ? 0 : lineStart + 1;
    if (!/^\s*$/.test(body.slice(lineStart, target.start))) {
      lineStart = target.start;
    }

    var end = target.end;
    if (body.slice(end, end + 2) === '\r\n') end += 2;
    else if (body[end] === '\n') end += 1;

    var newBody = body.slice(0, lineStart) + body.slice(end);
    return rebuild(html, m, newBody);
  }

  return {
    parse: parse,
    count: count,
    add: add,
    removeAt: removeAt,
    escapeHtml: escapeHtml,
    updateCount: updateCount
  };
});
