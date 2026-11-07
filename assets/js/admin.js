/* 管理页：Supabase 管理键 + 待审核 / 动态句子。 */
(function () {
  'use strict';

  var cfg = window.SITE_CONFIG || {};
  var BASE = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
  var ANON = cfg.supabaseAnonKey || '';
  var KEY_STORE = 'liuxiao:supabase-admin-key';

  var els = {
    siteLink: document.getElementById('site-link'),
    configStatus: document.getElementById('config-status'),
    key: document.getElementById('admin-key'),
    keyHint: document.getElementById('key-hint'),
    showKey: document.getElementById('show-key'),
    saveKey: document.getElementById('save-key'),
    clearKey: document.getElementById('clear-key'),
    authStatus: document.getElementById('auth-status'),
    editor: document.getElementById('editor-panel'),
    review: document.getElementById('review-panel'),
    count: document.getElementById('quote-count'),
    reload: document.getElementById('reload'),
    form: document.getElementById('add-form'),
    speaker: document.getElementById('speaker-input'),
    text: document.getElementById('text-input'),
    status: document.getElementById('status'),
    list: document.getElementById('quote-list'),
    pendingStatus: document.getElementById('pending-status'),
    pendingList: document.getElementById('pending-list'),
    refreshPending: document.getElementById('refresh-pending')
  };

  var state = { key: '', quotes: [], pending: [], busy: false };

  if (els.siteLink && cfg.siteUrl) els.siteLink.href = cfg.siteUrl;

  function configured() {
    return !!(BASE && ANON);
  }

  function setStatus(el, text, kind) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'status' + (kind ? ' is-' + kind : '');
  }

  function keyHint() {
    if (!els.keyHint) return;
    var value = els.key.value.trim();
    if (!value) {
      els.keyHint.textContent = '';
      return;
    }
    var text = '已输入 ' + value.length + ' 个字符';
    if (value.length < 20) text += ' · 看起来太短';
    els.keyHint.textContent = text;
  }

  function fmtTime(value) {
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      var n = Number(value);
      if (!n) return '';
      date = new Date(n);
    }
    try {
      return date.toLocaleString('zh-CN', { hour12: false });
    } catch (err) {
      return '';
    }
  }

  async function sb(path, options) {
    var opts = options || {};
    var headers = {
      'apikey': ANON,
      'Authorization': 'Bearer ' + ANON
    };
    if (opts.body) headers['Content-Type'] = 'application/json';
    if (opts.headers) Object.assign(headers, opts.headers);

    var res = await fetch(BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body
    });

    var text = await res.text();
    var data = null;
    if (text) {
      try { data = JSON.parse(text); } catch (err) { data = text; }
    }

    if (!res.ok) {
      var message = (data && (data.message || data.error)) || ('HTTP ' + res.status);
      var error = new Error(String(message));
      error.status = res.status;
      throw error;
    }
    return data;
  }

  function rpc(name, body) {
    return sb('/rest/v1/rpc/' + name, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  function showPanels(show) {
    els.editor.hidden = !show;
    els.review.hidden = !show;
  }

  function metaLine(item) {
    var parts = [];
    if (item.speaker) parts.push('—— ' + item.speaker);
    if (item.created_at) parts.push(fmtTime(item.created_at));
    return parts.join(' · ');
  }

  function renderQuotes() {
    els.count.textContent = String(state.quotes.length);
    els.list.textContent = '';

    state.quotes.forEach(function (item) {
      var li = document.createElement('li');
      var main = document.createElement('div');
      main.className = 'quote-row__main';

      var text = document.createElement('p');
      text.className = 'quote-row__text';
      text.textContent = item.text;
      main.appendChild(text);

      var meta = document.createElement('p');
      meta.className = 'quote-row__who';
      meta.textContent = metaLine(item);
      if (meta.textContent) main.appendChild(meta);

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn--danger';
      del.textContent = '删除';
      del.addEventListener('click', function () { removeQuote(item); });

      li.appendChild(main);
      li.appendChild(del);
      els.list.appendChild(li);
    });
  }

  function renderPending() {
    els.pendingList.textContent = '';

    state.pending.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'issue-row';

      var main = document.createElement('div');
      main.className = 'issue-row__main';

      var text = document.createElement('p');
      text.className = 'issue-row__text';
      text.textContent = item.text;
      main.appendChild(text);

      var meta = document.createElement('p');
      meta.className = 'issue-row__meta';
      meta.textContent = metaLine(item);
      if (meta.textContent) main.appendChild(meta);

      var actions = document.createElement('div');
      actions.className = 'issue-row__actions';

      var ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'btn btn--primary';
      ok.textContent = '通过';
      ok.addEventListener('click', function () { approve(item); });

      var no = document.createElement('button');
      no.type = 'button';
      no.className = 'btn btn--danger';
      no.textContent = '忽略';
      no.addEventListener('click', function () { ignore(item); });

      actions.appendChild(ok);
      actions.appendChild(no);
      li.appendChild(main);
      li.appendChild(actions);
      els.pendingList.appendChild(li);
    });
  }

  async function loadQuotes() {
    var rows = await sb('/rest/v1/quotes?select=id,speaker,text,created_at&order=created_at.asc');
    state.quotes = Array.isArray(rows) ? rows : [];
    renderQuotes();
  }

  async function loadPending() {
    var rows = await rpc('list_submissions', { admin_key: state.key });
    state.pending = Array.isArray(rows) ? rows : [];
    renderPending();
    setStatus(els.pendingStatus,
      state.pending.length ? ('共 ' + state.pending.length + ' 条待审核。') : '暂时没有待审核投稿。',
      'ok');
  }

  async function loadAll() {
    await Promise.all([loadQuotes(), loadPending()]);
    showPanels(true);
  }

  async function removeQuote(item) {
    if (state.busy) return;
    if (!window.confirm('确定删除这一句？\n\n' + item.text)) return;

    state.busy = true;
    setStatus(els.status, '正在删除…');
    try {
      await rpc('delete_quote', { quote_id: item.id, admin_key: state.key });
      await loadQuotes();
      setStatus(els.status, '已删除。', 'ok');
    } catch (err) {
      setStatus(els.status, '删除失败：' + err.message, 'err');
    } finally {
      state.busy = false;
    }
  }

  async function approve(item) {
    if (state.busy) return;

    state.busy = true;
    setStatus(els.pendingStatus, '正在通过…');
    try {
      await rpc('approve_submission', { submission_id: item.id, admin_key: state.key });
      await loadAll();
      setStatus(els.pendingStatus, '已通过并上线。', 'ok');
    } catch (err) {
      setStatus(els.pendingStatus, '通过失败：' + err.message, 'err');
    } finally {
      state.busy = false;
    }
  }

  async function ignore(item) {
    if (state.busy) return;
    if (!window.confirm('不通过这一句？\n\n' + item.text)) return;

    state.busy = true;
    setStatus(els.pendingStatus, '正在忽略…');
    try {
      await rpc('delete_submission', { submission_id: item.id, admin_key: state.key });
      await loadPending();
      setStatus(els.pendingStatus, '已忽略。', 'ok');
    } catch (err) {
      setStatus(els.pendingStatus, '忽略失败：' + err.message, 'err');
    } finally {
      state.busy = false;
    }
  }

  async function connect(key) {
    state.key = key;
    setStatus(els.authStatus, '正在验证管理键…');

    try {
      await loadAll();
      try { localStorage.setItem(KEY_STORE, key); } catch (err) {}
      setStatus(els.authStatus, '已连接 Supabase。', 'ok');
    } catch (err) {
      state.key = '';
      showPanels(false);

      if (err.status === 400 || err.status === 401) {
        setStatus(els.authStatus,
          '管理键不对（' + err.message + '）。请用 SQL 里设置的那串。', 'err');
      } else {
        setStatus(els.authStatus, '连接失败：' + err.message, 'err');
      }
    }
  }

  els.saveKey.addEventListener('click', function () {
    if (!configured()) {
      setStatus(els.authStatus, '站点还没配置 Supabase URL / anon key。', 'err');
      return;
    }
    var key = els.key.value.trim();
    if (!key) {
      setStatus(els.authStatus, '先粘贴管理键。', 'err');
      return;
    }
    connect(key);
  });

  els.key.addEventListener('input', keyHint);
  els.key.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      els.saveKey.click();
    }
  });

  if (els.showKey) {
    els.showKey.addEventListener('change', function () {
      els.key.type = this.checked ? 'text' : 'password';
    });
  }

  els.clearKey.addEventListener('click', function () {
    try { localStorage.removeItem(KEY_STORE); } catch (err) {}
    state.key = '';
    state.quotes = [];
    state.pending = [];
    els.key.value = '';
    keyHint();
    els.list.textContent = '';
    els.pendingList.textContent = '';
    showPanels(false);
    setStatus(els.authStatus, '已清除本机管理键。', 'ok');
    setStatus(els.status, '');
    setStatus(els.pendingStatus, '');
  });

  els.reload.addEventListener('click', function () {
    if (!state.key) return;
    loadAll().then(function () {
      setStatus(els.status, '已重新读取。', 'ok');
    }).catch(function (err) {
      setStatus(els.status, '读取失败：' + err.message, 'err');
    });
  });

  els.refreshPending.addEventListener('click', function () {
    if (!state.key) return;
    loadPending().catch(function (err) {
      setStatus(els.pendingStatus, '读取失败：' + err.message, 'err');
    });
  });

  els.form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (state.busy || !state.key) return;

    var text = els.text.value.trim();
    var speaker = els.speaker.value.trim();
    if (!text) {
      setStatus(els.status, '先写一句。', 'err');
      els.text.focus();
      return;
    }

    state.busy = true;
    setStatus(els.status, '正在添加…');
    try {
      await rpc('add_quote', {
        speaker: speaker,
        quote_text: text,
        admin_key: state.key
      });
      await loadQuotes();
      els.text.value = '';
      els.speaker.value = '';
      setStatus(els.status, '已添加并上线。', 'ok');
    } catch (err) {
      setStatus(els.status, '添加失败：' + err.message, 'err');
    } finally {
      state.busy = false;
    }
  });

  if (!configured()) {
    setStatus(els.configStatus,
      '还没有配置 Supabase：请在 assets/js/site-config.js 里填 supabaseUrl 和 supabaseAnonKey。',
      'err');
    setStatus(els.authStatus, '配置完成后再回来连接。', '');
    return;
  }

  setStatus(els.configStatus, 'Supabase：' + BASE, 'ok');

  var saved = '';
  try { saved = localStorage.getItem(KEY_STORE) || ''; } catch (err) {}
  if (saved) {
    els.key.value = saved;
    keyHint();
    connect(saved);
  } else {
    keyHint();
    setStatus(els.authStatus, '还没有连接。粘贴管理键后会自动读取。', '');
  }
})();
