/* 管理页逻辑：用本机保存的 GitHub fine-grained token 读写 index.html。
   令牌只发往 api.github.com；页面本身不链接在站内。 */
(function () {
  'use strict';

  var cfg = window.SITE_CONFIG || {};
  var REPO = cfg.repo || 'liuxiaoshigay/liuxiaoshigay.github.io';
  var BRANCH = cfg.branch || 'main';
  var TOKEN_KEY = 'liuxiao:admin-token';

  var els = {
    token: document.getElementById('token-input'),
    save: document.getElementById('save-token'),
    clear: document.getElementById('clear-token'),
    authStatus: document.getElementById('auth-status'),
    editor: document.getElementById('editor-panel'),
    count: document.getElementById('quote-count'),
    reload: document.getElementById('reload'),
    form: document.getElementById('add-form'),
    speaker: document.getElementById('speaker-input'),
    text: document.getElementById('text-input'),
    status: document.getElementById('status'),
    list: document.getElementById('quote-list'),
    issues: document.getElementById('issues-link'),
    review: document.getElementById('review-panel'),
    issuesStatus: document.getElementById('issues-status'),
    issueList: document.getElementById('issue-list'),
    refreshIssues: document.getElementById('refresh-issues')
  };

  var state = {
    token: '',
    sha: '',
    html: '',
    doc: null,
    issues: [],
    busy: false
  };

  els.issues.href = 'https://github.com/' + REPO + '/issues';

  function b64encode(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64decode(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function setStatus(el, text, kind) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'status' + (kind ? ' is-' + kind : '');
  }

  async function api(method, path, body) {
    var headers = {
      'Authorization': 'token ' + state.token,
      'Accept': 'application/vnd.github+json'
    };
    if (body) headers['Content-Type'] = 'application/json';

    var res = await fetch('https://api.github.com' + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    });

    var data = {};
    try { data = await res.json(); } catch (err) {}

    if (!res.ok) {
      var e = new Error(data.message || ('HTTP ' + res.status));
      e.status = res.status;
      throw e;
    }
    return data;
  }

  function setEditor(show) {
    els.editor.hidden = !show;
    els.review.hidden = !show;
  }

  function render() {
    els.count.textContent = String(state.doc.count);
    els.list.textContent = '';

    state.doc.items.forEach(function (item, index) {
      var li = document.createElement('li');
      var main = document.createElement('div');
      main.className = 'quote-row__main';

      var text = document.createElement('p');
      text.className = 'quote-row__text';
      text.textContent = item.text;
      main.appendChild(text);

      if (item.speaker) {
        var who = document.createElement('p');
        who.className = 'quote-row__who';
        who.textContent = '—— ' + item.speaker;
        main.appendChild(who);
      }

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn--danger';
      del.textContent = '删除';
      del.addEventListener('click', function () { removeAt(index); });

      li.appendChild(main);
      li.appendChild(del);
      els.list.appendChild(li);
    });
  }

  async function load() {
    setStatus(els.status, '正在读取 index.html…');
    var file = await api(
      'GET',
      '/repos/' + REPO + '/contents/index.html?ref=' + encodeURIComponent(BRANCH)
    );
    state.sha = file.sha;
    state.html = b64decode(file.content);
    state.doc = window.QuoteDoc.parse(state.html);
    render();
    setEditor(true);
    setStatus(els.status, '已读取 ' + state.doc.count + ' 句。', 'ok');
  }

  async function saveHtml(next, message) {
    var data = await api('PUT', '/repos/' + REPO + '/contents/index.html', {
      message: message,
      content: b64encode(next),
      sha: state.sha,
      branch: BRANCH
    });
    state.html = next;
    state.sha = data.content.sha;
    state.doc = window.QuoteDoc.parse(next);
    render();
    setStatus(els.status, '已提交；GitHub Pages 约 1 分钟后更新。', 'ok');
  }

  function parseIssue(issue) {
    var body = String(issue.body || '').replace(/\r\n/g, '\n');
    var sm = /说话人[：:]\s*(.+)/.exec(body);
    var qm = /句子[：:]\s*([\s\S]+?)(?:\n\s*\n|$)/.exec(body);
    var speaker = sm ? sm[1].trim() : '';
    var text = qm ? qm[1].trim() : '';

    if (speaker === '（未填）' || speaker === '(未填)') speaker = '';
    if (!text) {
      text = String(issue.title || '').replace(/^【投稿】/, '').trim();
    }
    return { speaker: speaker, text: text };
  }

  function renderIssues() {
    els.issueList.textContent = '';

    state.issues.forEach(function (issue) {
      var parsed = parseIssue(issue);
      var li = document.createElement('li');
      li.className = 'issue-row';

      var main = document.createElement('div');
      main.className = 'issue-row__main';

      var text = document.createElement('p');
      text.className = 'issue-row__text';
      text.textContent = parsed.text || issue.title || '(空)';
      main.appendChild(text);

      var meta = document.createElement('p');
      meta.className = 'issue-row__meta';
      meta.textContent = '#' + issue.number + ' · ' +
        (issue.user && issue.user.login ? issue.user.login : '?') +
        (parsed.speaker ? ' · —— ' + parsed.speaker : '');
      main.appendChild(meta);

      if (issue.html_url) {
        var link = document.createElement('a');
        link.className = 'issue-row__link';
        link.href = issue.html_url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = '查看 Issue';
        main.appendChild(link);
      }

      var actions = document.createElement('div');
      actions.className = 'issue-row__actions';

      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn btn--primary';
      add.textContent = '加入词云';
      add.disabled = !parsed.text;
      add.addEventListener('click', function () { acceptIssue(issue); });

      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'btn btn--danger';
      close.textContent = '关闭';
      close.addEventListener('click', function () { dismissIssue(issue); });

      actions.appendChild(add);
      actions.appendChild(close);
      li.appendChild(main);
      li.appendChild(actions);
      els.issueList.appendChild(li);
    });
  }

  async function loadIssues() {
    setStatus(els.issuesStatus, '正在读取投稿…');
    var list = await api(
      'GET',
      '/repos/' + REPO + '/issues?state=open&per_page=50&sort=created&direction=desc'
    );

    state.issues = (Array.isArray(list) ? list : []).filter(function (issue) {
      return !issue.pull_request;
    });

    renderIssues();
    var n = state.issues.length;
    setStatus(els.issuesStatus,
      n ? ('共 ' + n + ' 条待审核。') : '暂时没有待审核投稿。', 'ok');
  }

  async function closeIssue(issue) {
    await api('PATCH', '/repos/' + REPO + '/issues/' + issue.number, { state: 'closed' });
  }

  async function acceptIssue(issue) {
    if (state.busy || !state.doc) return;

    var parsed = parseIssue(issue);
    if (!parsed.text) {
      setStatus(els.issuesStatus, '这条 Issue 里没解析出句子。', 'err');
      return;
    }

    state.busy = true;
    setStatus(els.issuesStatus, '正在加入…');
    try {
      var next = window.QuoteDoc.add(state.html, parsed.speaker, parsed.text);
      await saveHtml(next, 'Add submission #' + issue.number);

      var closed = true;
      try { await closeIssue(issue); } catch (err) { closed = false; }

      await loadIssues();
      setStatus(els.issuesStatus,
        closed ? ('已加入并关闭 Issue #' + issue.number) :
                 ('句子已加入，但关闭 Issue 失败，请手动关闭 #' + issue.number),
        closed ? 'ok' : 'warn');
    } catch (err) {
      setStatus(els.issuesStatus, '加入失败：' + err.message, 'err');
      if (err.status === 409) { try { await load(); } catch (e) {} }
    } finally {
      state.busy = false;
    }
  }

  async function dismissIssue(issue) {
    if (state.busy) return;
    if (!window.confirm('不加入这句，并关闭 Issue #' + issue.number + '？')) return;

    state.busy = true;
    setStatus(els.issuesStatus, '正在关闭…');
    try {
      await closeIssue(issue);
      await loadIssues();
      setStatus(els.issuesStatus, '已关闭 Issue #' + issue.number, 'ok');
    } catch (err) {
      setStatus(els.issuesStatus, '关闭失败：' + err.message, 'err');
    } finally {
      state.busy = false;
    }
  }

  async function verify() {
    setStatus(els.authStatus, '正在验证令牌…');
    var me = await api('GET', '/user');
    var repo = await api('GET', '/repos/' + REPO);
    setStatus(els.authStatus, '已连接：' + me.login + ' / ' + repo.full_name, 'ok');
    await load();

    try {
      await loadIssues();
    } catch (err) {
      setStatus(els.issuesStatus,
        '读取 Issues 失败：' + err.message + '（令牌需要 Issues 读权限）', 'err');
    }
  }

  async function connect(token) {
    state.token = token;
    try {
      await verify();
      try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
    } catch (err) {
      state.token = '';
      setEditor(false);
      setStatus(els.authStatus, '连接失败：' + err.message, 'err');
    }
  }

  async function removeAt(index) {
    if (state.busy || !state.doc) return;
    var item = state.doc.items[index];
    if (!item) return;
    if (!window.confirm('确定删除这一句？\n\n' + item.text)) return;

    state.busy = true;
    setStatus(els.status, '正在删除…');
    try {
      var next = window.QuoteDoc.removeAt(state.html, index);
      await saveHtml(next, 'Delete quote via admin');
    } catch (err) {
      setStatus(els.status, '删除失败：' + err.message, 'err');
      if (err.status === 409) { try { await load(); } catch (e) {} }
    } finally {
      state.busy = false;
    }
  }

  els.save.addEventListener('click', function () {
    var token = els.token.value.trim();
    if (!token) {
      setStatus(els.authStatus, '先粘贴 Fine-grained token。', 'err');
      return;
    }
    connect(token);
  });

  els.token.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      els.save.click();
    }
  });

  els.clear.addEventListener('click', function () {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    state.token = '';
    state.sha = '';
    state.html = '';
    state.doc = null;
    state.issues = [];
    els.token.value = '';
    if (els.issueList) els.issueList.textContent = '';
    setEditor(false);
    setStatus(els.authStatus, '已清除本机令牌。', 'ok');
    setStatus(els.status, '');
    setStatus(els.issuesStatus, '');
  });

  els.refreshIssues.addEventListener('click', function () {
    if (!state.token) return;
    loadIssues().catch(function (err) {
      setStatus(els.issuesStatus, '读取失败：' + err.message, 'err');
    });
  });

  els.reload.addEventListener('click', function () {
    if (!state.token) return;
    load().catch(function (err) {
      setStatus(els.status, '读取失败：' + err.message, 'err');
    });
  });

  els.form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (state.busy || !state.doc) return;

    var text = els.text.value.trim();
    var speaker = els.speaker.value.trim();
    if (!text) {
      setStatus(els.status, '先写一句。', 'err');
      els.text.focus();
      return;
    }

    state.busy = true;
    setStatus(els.status, '正在提交…');
    try {
      var next = window.QuoteDoc.add(state.html, speaker, text);
      await saveHtml(next, 'Add quote via admin');
      els.text.value = '';
      els.speaker.value = '';
      setStatus(els.status, '已添加并发布：' + text, 'ok');
    } catch (err) {
      setStatus(els.status, '提交失败：' + err.message, 'err');
      if (err.status === 409) { try { await load(); } catch (e) {} }
    } finally {
      state.busy = false;
    }
  });

  var saved = '';
  try { saved = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}
  if (saved) {
    els.token.value = saved;
    connect(saved);
  } else {
    setStatus(els.authStatus, '还没有连接。粘贴令牌后会自动读取句子。', '');
  }
})();
