/* ============================================================
   微语 · Micro Posts
   纯原生 JS（非 ES Module，支持 file:// 直接打开）
   数据流：state -> localStorage -> render()
   ============================================================ */

(function () {
  'use strict';

  /* ------------------------------ 常量 ------------------------------ */

  var STORAGE_KEYS = {
    posts: 'weiyu:posts:v1',
    user: 'weiyu:user:v1'
  };

  var MAX_LEN = 200;
  var MAX_NAME_LEN = 16;
  var DEFAULT_NAME = '访客';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var MINUTE = 60 * 1000;
  var HOUR = 60 * MINUTE;
  var DAY = 24 * HOUR;

  /* ------------------------------ DOM ------------------------------ */

  var el = {
    form: document.getElementById('composer-form'),
    input: document.getElementById('composer-text'),
    counter: document.getElementById('composer-counter'),
    hint: document.getElementById('composer-hint'),
    publishBtn: document.getElementById('publish-btn'),
    feed: document.getElementById('feed'),
    feedEmpty: document.getElementById('feed-empty'),
    feedCount: document.getElementById('feed-count'),
    userChip: document.getElementById('user-chip'),
    userName: document.getElementById('user-name'),
    userAvatar: document.getElementById('user-avatar'),
    composerAvatar: document.getElementById('composer-avatar'),
    modal: document.getElementById('nickname-modal'),
    nicknameInput: document.getElementById('nickname-input'),
    nicknameError: document.getElementById('nickname-error'),
    nicknameSave: document.getElementById('nickname-save'),
    toast: document.getElementById('toast')
  };

  /* ------------------------------ 工具 ------------------------------ */

  function uid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /** 按「字符」计数，避免 emoji 被算成 2 个字 */
  function countChars(text) {
    return Array.from(String(text == null ? '' : text)).length;
  }

  function clampText(text, max) {
    return Array.from(String(text == null ? '' : text)).slice(0, max).join('');
  }

  function initialOf(name) {
    var chars = Array.from(String(name || DEFAULT_NAME).trim());
    return chars.length ? chars[0].toUpperCase() : '访';
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatFullTime(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function formatRelativeTime(ts) {
    var now = Date.now();
    var diff = Math.max(0, now - ts);

    if (diff < MINUTE) return '刚刚';
    if (diff < HOUR) return Math.floor(diff / MINUTE) + ' 分钟前';
    if (diff < DAY) return Math.floor(diff / HOUR) + ' 小时前';

    var d = new Date(ts);
    var today = new Date(now);
    var startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    var startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var dayGap = Math.round((startOfToday - startOfThatDay) / DAY);

    if (dayGap === 1) return '昨天';
    if (dayGap === 2) return '前天';
    if (d.getFullYear() === today.getFullYear()) {
      return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    }
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /* ------------------------------ store 层 ------------------------------ */

  var store = (function () {
    try {
      var probe = 'weiyu:__probe';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (err) {
      return null;
    }
  })();

  function readRaw(key) {
    if (!store) return null;
    try {
      return store.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function writeRaw(key, value) {
    if (!store) return false;
    try {
      store.setItem(key, value);
      return true;
    } catch (err) {
      // 常见原因：QuotaExceededError / 隐私模式限制
      return false;
    }
  }

  function normalizePost(raw) {
    if (!raw || typeof raw !== 'object') return null;

    var content = typeof raw.content === 'string' ? raw.content : '';
    if (!content.trim()) return null;
    if (countChars(content) > MAX_LEN * 4) return null;

    var author = typeof raw.author === 'string' ? raw.author.trim() : '';

    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      author: author ? clampText(author, MAX_NAME_LEN) : DEFAULT_NAME,
      content: content,
      likes: Number.isFinite(raw.likes) && raw.likes > 0 ? Math.floor(raw.likes) : 0,
      liked: raw.liked === true,
      createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now()
    };
  }

  function loadPosts() {
    var raw = readRaw(STORAGE_KEYS.posts);
    if (!raw) return [];

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      // 数据损坏：保留原始键，避免静默覆盖用户数据
      showToast('本地数据读取失败，已临时使用空列表');
      return [];
    }

    if (!Array.isArray(parsed)) {
      showToast('本地数据格式异常，已临时使用空列表');
      return [];
    }

    var list = [];
    for (var i = 0; i < parsed.length; i++) {
      var post = normalizePost(parsed[i]);
      if (post) list.push(post);
    }

    list.sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });
    return list;
  }

  function savePosts(posts) {
    var ok = writeRaw(STORAGE_KEYS.posts, JSON.stringify(posts));
    if (!ok) showToast('本地存储写入失败，内容可能无法保留');
    return ok;
  }

  function loadUser() {
    var raw = readRaw(STORAGE_KEYS.user);
    if (!raw) return { name: DEFAULT_NAME };

    try {
      var parsed = JSON.parse(raw);
      var name = parsed && typeof parsed.name === 'string' ? parsed.name.trim() : '';
      return { name: name ? clampText(name, MAX_NAME_LEN) : DEFAULT_NAME };
    } catch (err) {
      return { name: DEFAULT_NAME };
    }
  }

  function saveUser(user) {
    var ok = writeRaw(STORAGE_KEYS.user, JSON.stringify(user));
    if (!ok) showToast('昵称保存失败，请检查浏览器存储权限');
    return ok;
  }

  /* ------------------------------ 状态 ------------------------------ */

  var state = {
    posts: [],
    user: { name: DEFAULT_NAME }
  };

  /* ------------------------------ render 层 ------------------------------ */

  var toastTimer = null;

  function showToast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.toast.classList.remove('is-visible');
    }, 2200);
  }

  function setHint(message) {
    el.hint.textContent = message || '';
    el.hint.classList.toggle('is-visible', !!message);
  }

  function renderUser() {
    var name = state.user.name;
    var initial = initialOf(name);
    el.userName.textContent = name;
    el.userAvatar.textContent = initial;
    el.composerAvatar.textContent = initial;
    el.userChip.setAttribute('title', '当前昵称：' + name + '，点击修改');
  }

  function createHeartIcon() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'icon-heart');

    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M10 16.2S3.4 12.5 3.4 8.1a3.7 3.7 0 0 1 6.6-2.3 3.7 3.7 0 0 1 6.6 2.3c0 4.4-6.6 8.1-6.6 8.1Z');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  function createPostNode(post, isNew) {
    var article = document.createElement('article');
    article.className = 'post' + (isNew ? ' is-new' : '');
    article.dataset.id = post.id;

    var avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = initialOf(post.author);

    var body = document.createElement('div');
    body.className = 'post-body';

    var head = document.createElement('header');
    head.className = 'post-head';

    var author = document.createElement('span');
    author.className = 'post-author';
    author.textContent = post.author;

    var time = document.createElement('time');
    time.className = 'post-time';
    time.dateTime = new Date(post.createdAt).toISOString();
    time.title = formatFullTime(post.createdAt);
    time.textContent = formatRelativeTime(post.createdAt);

    head.appendChild(author);
    head.appendChild(time);

    var content = document.createElement('p');
    content.className = 'post-content';
    content.textContent = post.content;

    var actions = document.createElement('footer');
    actions.className = 'post-actions';

    var likeBtn = document.createElement('button');
    likeBtn.type = 'button';
    likeBtn.className = 'action action-like' + (post.liked ? ' is-liked' : '');
    likeBtn.dataset.action = 'like';
    likeBtn.setAttribute('aria-pressed', post.liked ? 'true' : 'false');
    likeBtn.setAttribute('aria-label', post.liked ? '取消点赞' : '点赞');
    likeBtn.appendChild(createHeartIcon());

    var likeCount = document.createElement('span');
    likeCount.className = 'like-count';
    likeCount.textContent = String(post.likes);
    likeBtn.appendChild(likeCount);

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'action action-delete';
    delBtn.dataset.action = 'delete';
    delBtn.setAttribute('aria-label', '删除这条内容');
    delBtn.textContent = '删除';

    actions.appendChild(likeBtn);
    actions.appendChild(delBtn);

    body.appendChild(head);
    body.appendChild(content);
    body.appendChild(actions);

    article.appendChild(avatar);
    article.appendChild(body);

    return article;
  }

  function renderFeed(highlightId) {
    var posts = state.posts;
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < posts.length; i++) {
      fragment.appendChild(createPostNode(posts[i], posts[i].id === highlightId));
    }

    if (typeof el.feed.replaceChildren === 'function') {
      el.feed.replaceChildren(fragment);
    } else {
      el.feed.textContent = '';
      el.feed.appendChild(fragment);
    }

    el.feedCount.textContent = posts.length + ' 条';
    el.feedEmpty.hidden = posts.length > 0;
  }

  function updateCounter() {
    var raw = el.input.value;
    var len = countChars(raw);
    var over = len > MAX_LEN;
    var warn = !over && len >= MAX_LEN - 20;

    el.counter.textContent = len + ' / ' + MAX_LEN;
    el.counter.classList.toggle('is-warn', warn);
    el.counter.classList.toggle('is-over', over);

    el.publishBtn.disabled = len === 0 || !raw.trim() || over;

    if (over) {
      setHint('内容最多 ' + MAX_LEN + ' 字，请精简后再发布');
    } else if (el.hint.classList.contains('is-visible')) {
      setHint('');
    }
  }

  function render() {
    renderUser();
    renderFeed();
    updateCounter();
  }

  /* ------------------------------ event 层 ------------------------------ */

  function publish() {
    var raw = el.input.value;
    var len = countChars(raw);

    if (!raw.trim()) {
      setHint('说点什么再发布吧');
      el.input.focus();
      return;
    }

    if (len > MAX_LEN) {
      setHint('内容最多 ' + MAX_LEN + ' 字，请精简后再发布');
      return;
    }

    var post = {
      id: uid(),
      author: state.user.name,
      content: raw.trim(),
      likes: 0,
      liked: false,
      createdAt: Date.now()
    };

    state.posts.unshift(post);
    savePosts(state.posts);

    el.input.value = '';
    setHint('');
    updateCounter();
    renderFeed(post.id);
    el.input.focus();
  }

  function toggleLike(id, button) {
    var post = null;
    for (var i = 0; i < state.posts.length; i++) {
      if (state.posts[i].id === id) {
        post = state.posts[i];
        break;
      }
    }
    if (!post) return;

    post.liked = !post.liked;
    post.likes = Math.max(0, post.likes + (post.liked ? 1 : -1));
    savePosts(state.posts);

    button.classList.toggle('is-liked', post.liked);
    button.classList.add('is-bumped');
    button.setAttribute('aria-pressed', post.liked ? 'true' : 'false');
    button.setAttribute('aria-label', post.liked ? '取消点赞' : '点赞');

    var countNode = button.querySelector('.like-count');
    if (countNode) countNode.textContent = String(post.likes);

    window.setTimeout(function () {
      button.classList.remove('is-bumped');
    }, 340);
  }

  function removePost(id, card) {
    if (card.classList.contains('is-removing')) return;
    if (!window.confirm('确定删除这条内容吗？删除后无法恢复。')) return;

    card.classList.add('is-removing');

    window.setTimeout(function () {
      var next = [];
      for (var i = 0; i < state.posts.length; i++) {
        if (state.posts[i].id !== id) next.push(state.posts[i]);
      }
      state.posts = next;
      savePosts(state.posts);
      renderFeed();
      showToast('已删除');
      el.input.focus();
    }, 130);
  }

  function bindFeedEvents() {
    el.feed.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('[data-action]') : null;
      if (!button || !el.feed.contains(button)) return;

      var card = button.closest('.post');
      if (!card) return;

      var id = card.dataset.id;
      var action = button.dataset.action;

      if (action === 'like') {
        toggleLike(id, button);
      } else if (action === 'delete') {
        removePost(id, card);
      }
    });
  }

  /* ----- 昵称弹窗 ----- */

  var lastFocused = null;

  function openNicknameModal() {
    if (!el.modal.hidden) return;

    lastFocused = document.activeElement;
    el.nicknameError.textContent = '';
    el.nicknameInput.value = state.user.name === DEFAULT_NAME ? '' : state.user.name;
    el.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    window.setTimeout(function () {
      el.nicknameInput.focus();
      el.nicknameInput.select();
    }, 0);
  }

  function closeNicknameModal() {
    if (el.modal.hidden) return;

    el.modal.hidden = true;
    el.nicknameError.textContent = '';
    document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
  }

  function saveNickname() {
    var name = el.nicknameInput.value.trim();
    var len = countChars(name);

    if (!name) {
      el.nicknameError.textContent = '昵称不能为空';
      el.nicknameInput.focus();
      return;
    }
    if (len > MAX_NAME_LEN) {
      el.nicknameError.textContent = '昵称最多 ' + MAX_NAME_LEN + ' 个字符';
      return;
    }

    var changed = name !== state.user.name;
    state.user.name = name;
    saveUser({ name: name });

    if (changed) {
      for (var i = 0; i < state.posts.length; i++) {
        state.posts[i].author = name;
      }
      savePosts(state.posts);
    }

    render();
    closeNicknameModal();
    showToast(changed ? '昵称已更新' : '昵称未变化');
  }

  function bindComposerEvents() {
    el.input.addEventListener('input', updateCounter);

    el.input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (el.form.requestSubmit) {
          el.form.requestSubmit();
        } else {
          el.form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      }
    });

    el.form.addEventListener('submit', function (event) {
      event.preventDefault();
      publish();
    });
  }

  function bindNicknameEvents() {
    el.userChip.addEventListener('click', openNicknameModal);
    el.nicknameSave.addEventListener('click', saveNickname);

    el.nicknameInput.addEventListener('input', function () {
      el.nicknameError.textContent = '';
    });

    el.nicknameInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveNickname();
      }
    });

    el.modal.addEventListener('click', function (event) {
      var target = event.target;
      if (target && target.getAttribute && target.getAttribute('data-close') === '1') {
        closeNicknameModal();
      }
    });

    // 焦点循环：Tab 只在弹窗内移动
    el.modal.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab' || el.modal.hidden) return;

      var focusables = el.modal.querySelectorAll('button, input');
      if (!focusables.length) return;

      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      var active = document.activeElement;

      if (event.shiftKey && (active === first || active === el.modal)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !el.modal.hidden) {
        closeNicknameModal();
      }
    });
  }

  function bindCrossTabSync() {
    if (!store) return;
    window.addEventListener('storage', function (event) {
      if (event.key === STORAGE_KEYS.posts) {
        state.posts = loadPosts();
        renderFeed();
      } else if (event.key === STORAGE_KEYS.user) {
        state.user = loadUser();
        renderUser();
      }
    });
  }

  /* ------------------------------ 初始化 ------------------------------ */

  function init() {
    state.posts = loadPosts();
    state.user = loadUser();

    bindComposerEvents();
    bindFeedEvents();
    bindNicknameEvents();
    bindCrossTabSync();

    render();

    if (!store) {
      showToast('浏览器已禁用本地存储，本次内容不会保留');
    }
  }

  init();
})();
