/* BrightPath production app
   Works as a normal website and inside the BrightPath Android WebView app. */
(function () {
  'use strict';

  var CONFIG = window.BRIGHTPATH_CONFIG || {};
  var API_BASE = String(CONFIG.apiBase || '').replace(/\/+$/, '');
  if (!API_BASE && /^https?:$/.test(location.protocol) && location.hostname !== 'appassets.androidplatform.net') {
    API_BASE = location.origin;
  }

  var KEYS = {
    token: 'bp_token',
    user: 'bp_user',
    remember: 'bp_remember',
    tour: 'bp_tour_done'
  };

  var session = {
    token: readToken(),
    user: readUser(),
    settings: {},
    unread: 0,
    booted: false
  };

  var currentPage = 'home';
  var routeParams = {};
  var pageCleanup = null;
  var currentConversation = null;
  var currentLessonId = null;
  var gameState = null;
  var jitsiState = null;
  var notificationTimer = null;
  var sponsorSeen = {};
  var modalCloseHandler = null;

  /* ---------------------------------------------------------------------
   * Storage and small helpers
   * ------------------------------------------------------------------ */

  function readToken() {
    try {
      return localStorage.getItem(KEYS.token) || sessionStorage.getItem(KEYS.token) || '';
    } catch (error) {
      return '';
    }
  }

  function readUser() {
    try {
      var raw = localStorage.getItem(KEYS.user) || sessionStorage.getItem(KEYS.user) || '';
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveToken(token, remember) {
    try {
      localStorage.removeItem(KEYS.token);
      sessionStorage.removeItem(KEYS.token);
      if (remember) localStorage.setItem(KEYS.token, token);
      else sessionStorage.setItem(KEYS.token, token);
      localStorage.setItem(KEYS.remember, remember ? '1' : '0');
      if (session.user) {
        localStorage.removeItem(KEYS.user);
        sessionStorage.removeItem(KEYS.user);
        (remember ? localStorage : sessionStorage).setItem(KEYS.user, JSON.stringify(session.user));
      }
    } catch (error) { /* storage can be disabled */ }
  }

  function clearSession() {
    session.token = '';
    session.user = null;
    session.unread = 0;
    try {
      localStorage.removeItem(KEYS.token);
      localStorage.removeItem(KEYS.user);
      sessionStorage.removeItem(KEYS.token);
      sessionStorage.removeItem(KEYS.user);
    } catch (error) { /* ignore */ }
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function icon(name, extra) {
    return '<svg class="icon ' + (extra || '') + '" aria-hidden="true"><use href="#i-' + esc(name) + '"/></svg>';
  }

  function sticker(name, theme) {
    return '<span class="sticker' + (theme ? ' sticker-' + esc(theme) : '') + '">' + icon(name) + '</span>';
  }

  function plural(count, word) {
    return count + ' ' + word + (count === 1 ? '' : 's');
  }

  function roleLabel(role) {
    var labels = { student: 'Student', parent: 'Parent', tutor: 'Tutor', school_admin: 'School admin', admin: 'Administrator' };
    return labels[role] || 'Learner';
  }

  function firstName(user) {
    var name = user && user.name ? String(user.name).trim() : 'Learner';
    return name.split(/\s+/)[0];
  }

  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return (parts[0] ? parts[0].charAt(0) : '?') + (parts[1] ? parts[1].charAt(0) : '');
  }

  var AVATAR_ICONS = {
    star: 'star', rocket: 'rocket', book: 'book', fox: 'heart', panda: 'leaf',
    owl: 'eye', cat: 'heart', robot: 'settings', flower: 'sun', moon: 'moon'
  };
  var AVATAR_TONES = {
    star: '', rocket: 'avatar-orange', book: 'avatar-blue', fox: 'avatar-peach',
    panda: 'avatar-mint', owl: 'avatar-blue', cat: 'avatar-orange', robot: 'avatar-blue',
    flower: 'avatar-orange', moon: 'avatar-mint'
  };

  function avatarMarkup(user, size) {
    var avatar = user && user.avatar ? String(user.avatar) : 'star';
    return '<span class="avatar ' + (size || '') + ' ' + (AVATAR_TONES[avatar] || '') + '" title="' + esc(user && user.name ? user.name : 'Learner') + '">' +
      icon(AVATAR_ICONS[avatar] || 'star') + '</span>';
  }

  function parseDate(value) {
    if (!value) return null;
    var text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(text + 'T00:00:00');
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(text)) return new Date(text.replace(' ', 'T') + 'Z');
    var parsed = new Date(text);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(value) {
    var date = parseDate(value);
    if (!date) return '—';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(value) {
    var date = parseDate(value);
    if (!date) return '—';
    var today = new Date();
    var sameDay = date.toDateString() === today.toDateString();
    var tomorrow = new Date(today.getTime() + 86400000);
    var day = sameDay ? 'Today' : (date.toDateString() === tomorrow.toDateString() ? 'Tomorrow' :
      date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
    return day + ' · ' + date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function timeAgo(value) {
    var date = parseDate(value);
    if (!date) return '';
    var seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return 'just now';
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.round(hours / 24);
    if (days < 8) return days + 'd ago';
    return formatDate(value);
  }

  function toUtcSql(localValue) {
    if (!localValue) return '';
    var date = new Date(localValue);
    if (isNaN(date.getTime())) return '';
    function pad(number) { return String(number).padStart(2, '0'); }
    return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) +
      ' ' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':00';
  }

  function localDateTimeValue(value) {
    var date = parseDate(value);
    if (!date) return '';
    function pad(number) { return String(number).padStart(2, '0'); }
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function fileSize(bytes) {
    var size = Number(bytes) || 0;
    if (size < 1024) return size + ' B';
    if (size < 1048576) return (size / 1024).toFixed(0) + ' KB';
    return (size / 1048576).toFixed(1) + ' MB';
  }

  /* ---------------------------------------------------------------------
   * API
   * ------------------------------------------------------------------ */

  function api(route, options) {
    options = options || {};
    if (!API_BASE) {
      return Promise.reject(new Error('The BrightPath server address is missing. Ask your school administrator to check site-config.js.'));
    }
    var query = options.query || {};
    var url = API_BASE + '/api/index.php?r=' + encodeURIComponent(route);
    Object.keys(query).forEach(function (key) {
      var value = query[key];
      if (value !== undefined && value !== null && value !== '') {
        url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(value);
      }
    });
    var headers = { Accept: 'application/json' };
    if (session.token) {
      headers.Authorization = 'Bearer ' + session.token;
      headers['X-Auth-Token'] = session.token;
    }
    var fetchOptions = { method: options.method || 'GET', headers: headers, cache: 'no-store' };
    if (options.form) {
      fetchOptions.body = options.form;
    } else if (options.body) {
      headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(options.body);
    }
    return fetch(url, fetchOptions).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : {}; } catch (error) { data = null; }
        if (!response.ok || !data || data.ok === false) {
          var message = data && data.error ? data.error : 'BrightPath could not complete that request. Please try again.';
          var problem = new Error(message);
          problem.status = response.status;
          throw problem;
        }
        return data;
      });
    }).catch(function (error) {
      if (!error.status) {
        error = new Error('We could not reach BrightPath. Check your internet connection and try again.');
      }
      if (error.status === 401 && route !== 'auth/login' && route !== 'auth/me') {
        clearSession();
        showAuth();
        toast('Your session ended. Please sign in again.', 'error');
      }
      throw error;
    });
  }

  function apiError(error) {
    return error && error.message ? error.message : 'Something went wrong. Please try again.';
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var existing = $$('script').filter(function (tag) { return tag.src === url; })[0];
      if (existing) { resolve(); return; }
      var script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('The live class tool could not load. Check the internet connection and try again.')); };
      document.head.appendChild(script);
    });
  }

  /* ---------------------------------------------------------------------
   * Toast and modal
   * ------------------------------------------------------------------ */

  var toastTimer = null;
  function toast(message, type) {
    var node = $('#toast');
    if (!node) return;
    node.textContent = message;
    node.className = 'toast is-visible' + (type === 'error' ? ' is-error' : (type === 'success' ? ' is-success' : ''));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.className = 'toast'; }, 4200);
  }

  function modal(options) {
    closeModal();
    var root = $('#modal-root');
    var footer = options.footer || '';
    var body = options.body || '';
    root.innerHTML =
      '<div class="modal-backdrop" data-modal-backdrop="1">' +
        '<section class="modal-card' + (options.wide ? ' modal-wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(options.title || 'BrightPath') + '">' +
          '<div class="modal-head"><div><h2>' + esc(options.title || '') + '</h2>' +
            (options.subtitle ? '<p>' + esc(options.subtitle) + '</p>' : '') +
          '</div><button class="modal-close" type="button" data-modal-close="1" aria-label="Close">' + icon('close') + '</button></div>' +
          '<div class="modal-body">' + body + '</div>' +
          (footer ? '<div class="modal-actions">' + footer + '</div>' : '') +
        '</section>' +
      '</div>';
    document.body.classList.add('modal-open');
    modalCloseHandler = options.onClose || null;
    var card = $('.modal-card', root);
    if (options.onMount) options.onMount(card);
    var focusTarget = card.querySelector('input, select, textarea, button');
    if (focusTarget && window.innerWidth > 720) setTimeout(function () { focusTarget.focus(); }, 60);
    return card;
  }

  function closeModal() {
    var root = $('#modal-root');
    if (root && root.innerHTML) root.innerHTML = '';
    document.body.classList.remove('modal-open');
    if (typeof modalCloseHandler === 'function') {
      var handler = modalCloseHandler;
      modalCloseHandler = null;
      try { handler(); } catch (error) { /* ignore */ }
    } else {
      modalCloseHandler = null;
    }
  }

  function confirmDialog(options) {
    return new Promise(function (resolve) {
      var settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        resolve(value);
        closeModal();
      }
      var card = modal({
        title: options.title || 'Are you sure?',
        subtitle: options.message || '',
        body: options.body || '',
        footer: '<button class="button button-quiet" type="button" data-cancel="1">' + esc(options.cancelLabel || 'Cancel') + '</button>' +
          '<button class="button ' + (options.danger ? 'button-danger' : 'button-primary') + '" type="button" data-confirm="1">' + esc(options.confirmLabel || 'Yes, continue') + '</button>',
        onClose: function () { finish(false); }
      });
      card.querySelector('[data-confirm]').addEventListener('click', function () { finish(true); });
      card.querySelector('[data-cancel]').addEventListener('click', function () { finish(false); });
    });
  }

  /* ---------------------------------------------------------------------
   * Navigation structure
   * ------------------------------------------------------------------ */

  var NAV = {
    student: [
      ['home', 'home', 'My learning'], ['lessons', 'book', 'Lessons'], ['assignments', 'tasks', 'My work'],
      ['classes', 'video', 'Live classes'], ['games', 'game', 'Brain games'], ['rewards', 'trophy', 'Rewards'],
      ['messages', 'message', 'Messages'], ['family', 'family', 'Family'], ['progress', 'chart', 'My progress'],
      ['help', 'help', 'Help']
    ],
    parent: [
      ['home', 'home', 'Overview'], ['family', 'family', 'My family'], ['progress', 'chart', 'Learning progress'],
      ['assignments', 'tasks', 'School work'], ['classes', 'video', 'Classes'], ['messages', 'message', 'Messages'],
      ['help', 'help', 'Help']
    ],
    tutor: [
      ['home', 'home', 'Workspace'], ['students', 'users', 'My students'], ['assignments', 'tasks', 'Assignments'],
      ['reviews', 'check', 'Review work'], ['classes', 'video', 'Live classes'], ['messages', 'message', 'Messages'],
      ['help', 'help', 'Help']
    ],
    school_admin: [
      ['home', 'home', 'Overview'], ['users', 'users', 'People'], ['admin', 'shield', 'School tools'],
      ['classes', 'video', 'Classes'], ['messages', 'message', 'Messages'], ['help', 'help', 'Help']
    ],
    admin: [
      ['home', 'home', 'Overview'], ['users', 'users', 'People'], ['admin', 'shield', 'Admin tools'],
      ['sponsors', 'heart', 'Sponsors'], ['classes', 'video', 'Classes'], ['messages', 'message', 'Messages'],
      ['help', 'help', 'Help']
    ]
  };

  var PAGE_TITLES = {
    home: 'My learning', lessons: 'Lessons', lesson: 'Lesson', assignments: 'My work', classes: 'Live classes',
    games: 'Brain games', rewards: 'Rewards', messages: 'Messages', family: 'Family', progress: 'Progress',
    students: 'My students', reviews: 'Review work', users: 'People', admin: 'Admin tools', sponsors: 'Sponsors',
    help: 'Help', profile: 'My profile', search: 'Search'
  };

  var PAGE_GREETINGS = {
    home: 'Hello', lessons: 'Let’s learn', lesson: 'Let’s learn', assignments: 'Your work', classes: 'See you there',
    games: 'Brain break', rewards: 'Look what you earned', messages: 'Stay connected', family: 'Your people',
    progress: 'Look how far you’ve come', students: 'Your learners', reviews: 'Help them grow', users: 'People',
    admin: 'School tools', sponsors: 'Partner cards', help: 'We are here', profile: 'About you', search: 'Find something'
  };

  function navItems() {
    return NAV[(session.user && session.user.role) || 'student'] || NAV.student;
  }

  function buildShell() {
    var sideNav = $('#side-nav');
    var mobileNav = $('#mobile-nav');
    var items = navItems();
    sideNav.innerHTML = items.map(function (item) {
      return '<button class="nav-link" type="button" data-page="' + item[0] + '">' + icon(item[1]) + '<span>' + esc(item[2]) + '</span></button>';
    }).join('');
    mobileNav.innerHTML = items.slice(0, 5).map(function (item) {
      return '<a href="#/' + item[0] + '" data-page="' + item[0] + '">' + icon(item[1]) + '<span>' + esc(item[2].split(' ')[0]) + '</span></a>';
    }).join('');
    updateActiveNav();
  }

  function updateActiveNav() {
    $$('[data-page]').forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('data-page') === currentPage);
    });
  }

  function applyUser() {
    var user = session.user;
    if (!user) return;
    var role = user.role;
    $('#sidebar-avatar').outerHTML = avatarMarkup(user, 'avatar-lg').replace('class="avatar ', 'id="sidebar-avatar" class="avatar ');
    $('#header-avatar').outerHTML = avatarMarkup(user, '').replace('class="avatar ', 'id="header-avatar" class="avatar ');
    $('#sidebar-name').textContent = user.name || 'Learner';
    $('#sidebar-role').textContent = roleLabel(role) + (user.grade ? ' · Grade ' + user.grade : '');
    $('#header-name').textContent = firstName(user);
    var tip = session.settings && session.settings.welcome_message ? session.settings.welcome_message : 'A little progress every day adds up to something brilliant.';
    $('#sidebar-tip').textContent = tip;
  }

  function closeSidebar() {
    var sidebar = $('#sidebar');
    var scrim = $('#nav-scrim');
    if (sidebar) sidebar.classList.remove('is-open');
    if (scrim) scrim.hidden = true;
  }

  function openSidebar() {
    var sidebar = $('#sidebar');
    var scrim = $('#nav-scrim');
    if (sidebar) sidebar.classList.add('is-open');
    if (scrim) scrim.hidden = false;
  }

  function routeFromHash() {
    var hash = String(location.hash || '').replace(/^#\/?/, '');
    var parts = hash.split('?');
    var page = parts[0] || 'home';
    var params = {};
    if (parts[1]) {
      parts[1].split('&').forEach(function (pair) {
        var bits = pair.split('=');
        if (bits[0]) params[decodeURIComponent(bits[0])] = decodeURIComponent(bits[1] || '');
      });
    }
    if (!PAGE_TITLES[page] && page !== 'home') page = 'home';
    currentPage = page;
    routeParams = params;
    if (session.user) renderPage();
  }

  function navigate(page, params, replace) {
    if (!session.user) return;
    routeParams = params || {};
    currentPage = page;
    var hash = '#/' + page;
    var query = Object.keys(routeParams).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(routeParams[key]);
    }).join('&');
    if (query) hash += '?' + query;
    closeSidebar();
    if (replace) {
      history.replaceState(null, '', hash);
      renderPage();
    } else if (location.hash === hash) {
      renderPage();
    } else {
      location.hash = hash;
    }
  }

  function cleanupPage() {
    if (typeof pageCleanup === 'function') {
      try { pageCleanup(); } catch (error) { /* ignore */ }
    }
    pageCleanup = null;
    if (gameState) {
      if (gameState.timer) { clearInterval(gameState.timer); gameState.timer = null; }
      if (gameState.timers && gameState.timers.length) {
        gameState.timers.forEach(function (id) { clearTimeout(id); clearInterval(id); });
        gameState.timers = [];
      }
    }
    gameState = null;
    if (messagePoll) { clearInterval(messagePoll); messagePoll = null; }
    if (jitsiState && jitsiState.chatTimer) { clearInterval(jitsiState.chatTimer); jitsiState.chatTimer = null; }
    if (jitsiState && jitsiState.api) {
      try { jitsiState.api.dispose(); } catch (error) { /* ignore */ }
      jitsiState = null;
    }
  }

  function pageLoading() {
    return '<div class="loading"><span class="spinner"></span><span>Getting things ready…</span></div>';
  }

  function emptyState(iconName, title, body, action) {
    return '<div class="empty-state">' + icon(iconName) + '<h3>' + esc(title) + '</h3><p>' + esc(body) + '</p>' + (action || '') + '</div>';
  }

  function errorState(error, retryPage) {
    return '<div class="empty-state">' + icon('cloud') + '<h3>That did not load</h3><p>' + esc(apiError(error)) + '</p>' +
      '<button class="button button-primary button-small" type="button" data-retry="' + esc(retryPage || currentPage) + '">Try again</button></div>';
  }

  function renderPage() {
    if (!session.user) return;
    cleanupPage();
    closeDrawer();
    updateActiveNav();
    var title = PAGE_TITLES[currentPage] || 'BrightPath';
    $('#page-title').textContent = title;
    $('#greeting').textContent = PAGE_GREETINGS[currentPage] || 'Hello';
    var content = $('#page-content');
    content.innerHTML = pageLoading();
    content.scrollTop = 0;
    window.scrollTo(0, 0);
    var renderer = RENDERERS[currentPage] || RENDERERS.home;
    Promise.resolve().then(function () { return renderer(); }).catch(function (error) {
      if (error && error.status === 401) return;
      content.innerHTML = errorState(error, currentPage);
    });
  }

  function setPageUserIntro() {
    var user = session.user;
    if (!user) return;
    var title = PAGE_TITLES[currentPage] || 'BrightPath';
    $('#page-title').textContent = title;
    $('#greeting').textContent = (PAGE_GREETINGS[currentPage] || 'Hello') + ', ' + firstName(user);
  }

  /* ---------------------------------------------------------------------
   * Notifications
   * ------------------------------------------------------------------ */

  var NOTIFICATION_ICONS = {
    welcome: 'sparkle', family: 'family', assignment: 'tasks', class: 'video', submission: 'check',
    review: 'star', message: 'message', badge: 'trophy', progress: 'chart', support: 'help', admin: 'shield', general: 'bell'
  };

  function updateUnreadBadge() {
    var dot = $('#notification-dot');
    if (dot) dot.hidden = !session.unread;
    var bell = $('#notification-button');
    if (bell) bell.setAttribute('aria-label', session.unread ? 'Notifications, ' + session.unread + ' unread' : 'Notifications');
  }

  function loadNotifications(openAfter) {
    return api('notifications').then(function (data) {
      session.unread = Number(data.unread) || 0;
      updateUnreadBadge();
      renderNotificationList(data.notifications || []);
      if (openAfter) openDrawer();
    }).catch(function (error) {
      if (openAfter) toast(apiError(error), 'error');
    });
  }

  function notificationMarkup(item) {
    return '<button class="notification-item' + (item.read_at ? '' : ' is-unread') + '" type="button" data-notification="' + Number(item.id) + '" data-notification-page="' + esc(item.page || 'home') + '">' +
      '<span class="sticker sticker-blue">' + icon(NOTIFICATION_ICONS[item.kind] || 'bell') + '</span>' +
      '<span class="grow"><strong>' + esc(item.title) + '</strong>' +
      (item.body ? '<p>' + esc(item.body) + '</p>' : '') +
      '<time>' + esc(timeAgo(item.created_at)) + '</time></span></button>';
  }

  function renderNotificationList(items) {
    var list = $('#notification-list');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = emptyState('bell', 'All quiet', 'New lessons, class reminders, and messages will appear here.');
      return;
    }
    list.innerHTML = items.map(notificationMarkup).join('');
  }

  function openDrawer() {
    var drawer = $('#notification-drawer');
    if (!drawer) return;
    drawer.hidden = false;
    if (!drawer.querySelector('.notification-item')) loadNotifications(false);
  }

  function closeDrawer() {
    var drawer = $('#notification-drawer');
    if (drawer) drawer.hidden = true;
  }

  async function markNotificationRead(id) {
    try {
      await api('notifications/read', { method: 'POST', body: id ? { id: id } : {} });
      session.unread = Math.max(0, session.unread - 1);
      updateUnreadBadge();
      var item = $('[data-notification="' + id + '"]');
      if (item) item.classList.remove('is-unread');
    } catch (error) { /* not important */ }
  }

  /* ---------------------------------------------------------------------
   * Guided tour
   * ------------------------------------------------------------------ */

  var TOUR_STEPS = [
    { icon: 'home', title: 'This is your home base', body: 'Your dashboard shows the next lesson, class, and anything waiting for you. Start here every day.' },
    { icon: 'book', title: 'Lessons are little adventures', body: 'Open a lesson card, read the friendly story, then answer the check questions to earn points and stickers.' },
    { icon: 'video', title: 'Live classes use Jitsi', body: 'Tap Join class to enter the video room. You can turn your camera off or use audio only if that feels better.' },
    { icon: 'game', title: 'Brain breaks count too', body: 'Play real learning games, beat your best score, and collect points on the leaderboard.' },
    { icon: 'family', title: 'Your family can help', body: 'Share your family code with a parent so they can see progress and cheer you on. A grown-up can always help you sign in.' }
  ];

  var tourIndex = 0;
  var tourReturnFocus = null;

  function showTour() {
    tourIndex = 0;
    tourReturnFocus = document.activeElement;
    $('#tour').hidden = false;
    renderTourStep();
  }

  function renderTourStep() {
    var step = TOUR_STEPS[tourIndex];
    $('#tour-count').textContent = (tourIndex + 1) + ' of ' + TOUR_STEPS.length;
    $('#tour-illustration').innerHTML = '<span class="sticker sticker-' + ['purple', 'mint', 'blue', 'orange', 'yellow'][tourIndex % 5] + '">' + icon(step.icon) + '</span>';
    $('#tour-title').textContent = step.title;
    $('#tour-body').textContent = step.body;
    $('#tour-dots').innerHTML = TOUR_STEPS.map(function (unused, index) {
      return '<span class="' + (index === tourIndex ? 'is-active' : '') + '"></span>';
    }).join('');
    $('#tour-back').style.visibility = tourIndex === 0 ? 'hidden' : 'visible';
    $('#tour-next').textContent = tourIndex === TOUR_STEPS.length - 1 ? 'Start learning' : 'Next';
  }

  function finishTour() {
    $('#tour').hidden = true;
    try { localStorage.setItem(KEYS.tour, '1'); } catch (error) { /* ignore */ }
    if (tourReturnFocus && tourReturnFocus.focus) tourReturnFocus.focus();
  }

  /* ---------------------------------------------------------------------
   * Authentication and session
   * ------------------------------------------------------------------ */

  function showAuth(formName) {
    if (notificationTimer) { clearInterval(notificationTimer); notificationTimer = null; }
    cleanupPage();
    closeDrawer();
    closeSidebar();
    closeModal();
    $('#app-view').hidden = true;
    $('#auth-view').hidden = false;
    document.body.classList.remove('modal-open');
    selectAuthForm(formName || 'login');
    var biometricButton = $('#biometric-unlock');
    if (biometricButton) {
      var available = nativeApp() && bridge().hasBiometricSession && bridge().hasBiometricSession();
      biometricButton.hidden = !available;
    }
  }

  function selectAuthForm(formName) {
    $$('.auth-tab').forEach(function (tab) {
      var active = tab.getAttribute('data-auth-tab') === formName;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $('#login-form').hidden = formName !== 'login';
    $('#register-form').hidden = formName !== 'register';
    $('#forgot-form').hidden = formName !== 'forgot';
    var panel = $('.auth-panel');
    if (panel) panel.scrollTop = 0;
  }

  function setFormMessage(form, message, type) {
    var existing = form.querySelector('.form-message');
    if (!existing) {
      existing = document.createElement('div');
      existing.className = 'form-message';
      form.insertBefore(existing, form.querySelector('button[type="submit"]'));
    }
    existing.className = 'form-message ' + (type === 'error' ? 'form-error' : 'form-success');
    existing.textContent = message;
  }

  function clearFormMessage(form) {
    var existing = form.querySelector('.form-message');
    if (existing) existing.remove();
  }

  function enterSession(token, user, remember) {
    session.token = token;
    session.user = user;
    saveToken(token, remember !== false);
    return api('auth/me').then(function (data) {
      session.user = data.user;
      session.settings = data.settings || {};
      session.unread = Number(data.unread_notifications) || 0;
      saveToken(token, remember !== false);
      startApp();
      if (data.user.must_change_password) setTimeout(showPasswordChangeRequired, 500);
      setTimeout(maybeOfferBiometrics, 1500);
    });
  }

  function startApp() {
    if (!session.user) { showAuth(); return; }
    $('#auth-view').hidden = true;
    $('#app-view').hidden = false;
    document.body.classList.remove('modal-open');
    applyUser();
    buildShell();
    updateUnreadBadge();
    setPageUserIntro();
    loadNotifications(false);
    if (notificationTimer) clearInterval(notificationTimer);
    notificationTimer = setInterval(function () {
      if (session.user && !document.hidden) loadNotifications(false);
    }, 120000);
    routeFromHash();
    if (currentPage === 'home' && !location.hash) {
      try { history.replaceState(null, '', '#/home'); } catch (error) { /* ignore */ }
    }
    try {
      if (!localStorage.getItem(KEYS.tour)) setTimeout(showTour, 800);
    } catch (error) { /* ignore */ }
    if (!nativeApp()) {
      var installButton = $('#install-button');
      if (installButton) installButton.hidden = false;
    }
    updateConnection(true);
  }

  function updateConnection(online) {
    var label = $('#connection-label');
    var dot = $('.online-dot');
    if (label) label.textContent = online ? 'Connected' : 'Offline';
    if (dot) dot.classList.toggle('is-off', !online);
  }

  function bootSession() {
    if (!session.token) { showAuth(); return; }
    showAuth('login');
    $('#login-submit').disabled = true;
    $('#login-submit').textContent = 'Checking your session…';
    api('auth/me').then(function (data) {
      session.user = data.user;
      session.settings = data.settings || {};
      session.unread = Number(data.unread_notifications) || 0;
      startApp();
      if (data.user.must_change_password) setTimeout(showPasswordChangeRequired, 500);
      setTimeout(maybeOfferBiometrics, 1500);
    }).catch(function () {
      clearSession();
      showAuth('login');
    }).finally(function () {
      var button = $('#login-submit');
      if (button) { button.disabled = false; button.textContent = 'Sign in'; }
    });
  }

  function handleLogin(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var email = $('#login-email').value.trim();
    var password = $('#login-password').value;
    var remember = $('#login-remember').checked;
    clearFormMessage(form);
    if (!email || !password) {
      setFormMessage(form, 'Type your email and password to sign in.', 'error');
      return;
    }
    var button = $('#login-submit');
    button.disabled = true;
    button.textContent = 'Signing in…';
    api('auth/login', { method: 'POST', body: { email: email, password: password } })
      .then(function (data) { return enterSession(data.token, data.user, remember); })
      .then(function () { toast('Welcome back, ' + firstName(session.user) + '!', 'success'); })
      .catch(function (error) {
        setFormMessage(form, apiError(error), 'error');
        if (error && error.status === 403) {
          setFormMessage(form, apiError(error) + ' A school administrator can help.', 'error');
        }
      })
      .finally(function () {
        button.disabled = false;
        button.textContent = 'Sign in';
      });
  }

  function handleRegister(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var role = (form.querySelector('input[name="register-role"]:checked') || {}).value || 'student';
    var password = $('#register-password').value;
    var consent = $('#register-consent').checked;
    clearFormMessage(form);
    if ($('#register-name').value.trim().length < 2) {
      setFormMessage(form, 'Please write your name.', 'error'); return;
    }
    if (!$('#register-email').value.trim()) {
      setFormMessage(form, 'Please add an email address.', 'error'); return;
    }
    if (password.length < 8) {
      setFormMessage(form, 'Use at least 8 characters for your password.', 'error'); return;
    }
    if (role === 'student' && !$('#register-grade').value) {
      setFormMessage(form, 'Choose your grade.', 'error'); return;
    }
    if (role === 'student' && !$('#register-guardian').value.trim()) {
      setFormMessage(form, 'A parent or guardian email is needed for a student account.', 'error'); return;
    }
    if (role === 'student' && !consent) {
      setFormMessage(form, 'Ask your parent or guardian to tick the consent box.', 'error'); return;
    }
    var body = {
      role: role,
      name: $('#register-name').value.trim(),
      email: $('#register-email').value.trim(),
      password: password,
      avatar: $('#register-avatar').value,
      invite_code: $('#register-invite').value.trim(),
      guardian_email: role === 'student' ? $('#register-guardian').value.trim() : '',
      guardian_consent: role === 'student' ? consent : false,
      grade: role === 'student' ? Number($('#register-grade').value) : null
    };
    var button = $('#register-submit');
    button.disabled = true;
    button.textContent = 'Creating your space…';
    api('auth/register', { method: 'POST', body: body }).then(function (data) {
      if (data.pending) {
        modal({
          title: 'Almost there!',
          subtitle: 'Your tutor account is waiting for approval.',
          body: '<div class="center stack"><span class="sticker sticker-orange" style="margin:0 auto">' + icon('clock') + '</span><p class="muted">' + esc(data.message) + '</p></div>',
          footer: '<button class="button button-primary" type="button" data-auth-go="login">Back to sign in</button>'
        });
        selectAuthForm('login');
        return;
      }
      return enterSession(data.token, data.user, $('#login-remember').checked).then(function () {
        toast('Welcome to BrightPath, ' + firstName(session.user) + '!', 'success');
      });
    }).catch(function (error) {
      setFormMessage(form, apiError(error), 'error');
    }).finally(function () {
      button.disabled = false;
      button.textContent = 'Create my account';
    });
  }

  function handleForgot(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var email = $('#forgot-email').value.trim();
    clearFormMessage(form);
    api('auth/forgot', { method: 'POST', body: { email: email } }).then(function (data) {
      setFormMessage(form, data.message, 'success');
      form.reset();
    }).catch(function (error) {
      setFormMessage(form, apiError(error), 'error');
    });
  }

  function openResetForm(token) {
    var card = modal({
      title: 'Choose a new password',
      subtitle: 'Your recovery link is ready. Use at least 8 characters.',
      body: '<form id="reset-form" class="stack">' +
        '<label class="field"><span>New password</span><input id="reset-password" type="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters"></label>' +
        '<label class="field"><span>Type it again</span><input id="reset-password-2" type="password" autocomplete="new-password" minlength="8" required placeholder="Same password"></label>' +
        '<div class="form-message"></div></form>',
      footer: '<button class="button button-quiet" type="button" data-modal-close="1">Cancel</button><button class="button button-primary" type="submit" form="reset-form">Save password</button>',
      onMount: function (element) {
        element.querySelector('#reset-form').addEventListener('submit', function (event) {
          event.preventDefault();
          var form = event.currentTarget;
          var password = form.querySelector('#reset-password').value;
          var again = form.querySelector('#reset-password-2').value;
          var message = form.querySelector('.form-message');
          if (password.length < 8) {
            message.className = 'form-message form-error';
            message.textContent = 'Use at least 8 characters.';
            return;
          }
          if (password !== again) {
            message.className = 'form-message form-error';
            message.textContent = 'The two passwords do not match.';
            return;
          }
          api('auth/reset', { method: 'POST', body: { token: token, password: password } }).then(function (data) {
            closeModal();
            history.replaceState(null, '', location.pathname + location.search.replace(/([?&])reset=[^&]*/g, '$1').replace(/[?&]$/, ''));
            toast(data.message, 'success');
            selectAuthForm('login');
          }).catch(function (error) {
            message.className = 'form-message form-error';
            message.textContent = apiError(error);
          });
        });
      }
    });
    return card;
  }

  function showPasswordChangeRequired() {
    modal({
      title: 'Make your password your own',
      subtitle: 'A grown-up gave you a temporary password. Choose a new one before you continue.',
      body: '<form id="forced-password-form" class="stack">' +
        '<label class="field"><span>Current password</span><input id="forced-current" type="password" autocomplete="current-password" required></label>' +
        '<label class="field"><span>New password</span><input id="forced-new" type="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters"></label>' +
        '<div class="form-message"></div></form>',
      footer: '<button class="button button-primary" type="submit" form="forced-password-form">Save new password</button>',
      onMount: function (element) {
        element.querySelector('#forced-password-form').addEventListener('submit', function (event) {
          event.preventDefault();
          var form = event.currentTarget;
          api('auth/change-password', {
            method: 'POST',
            body: {
              current_password: form.querySelector('#forced-current').value,
              new_password: form.querySelector('#forced-new').value
            }
          }).then(function (data) {
            closeModal();
            if (session.user) session.user.must_change_password = false;
            toast(data.message, 'success');
          }).catch(function (error) {
            var message = form.querySelector('.form-message');
            message.className = 'form-message form-error';
            message.textContent = apiError(error);
          });
        });
      }
    });
  }

  function logout() {
    confirmDialog({
      title: 'Sign out?',
      message: 'Your saved work stays safe. You can sign in again anytime.',
      confirmLabel: 'Sign out',
      danger: true
    }).then(function (yes) {
      if (!yes) return;
      api('auth/logout', { method: 'POST', body: {} }).catch(function () { /* ignore */ });
      clearSession();
      try {
        if (nativeApp() && bridge().clearBiometricSessionFromApp) bridge().clearBiometricSessionFromApp();
      } catch (error) { /* ignore */ }
      showAuth('login');
      toast('You are signed out.');
    });
  }

  /* ---------------------------------------------------------------------
   * Native bridge and biometrics
   * ------------------------------------------------------------------ */

  function bridge() {
    return window.BrightPathNative || null;
  }

  function nativeApp() {
    try {
      return !!(bridge() && bridge().isNativeApp && bridge().isNativeApp());
    } catch (error) {
      return false;
    }
  }

  function biometricReady() {
    try {
      return !!(nativeApp() && bridge().isBiometricAvailable && bridge().isBiometricAvailable());
    } catch (error) {
      return false;
    }
  }

  function maybeOfferBiometrics() {
    if (!session.user || !biometricReady()) return;
    if (bridge().hasBiometricSession && bridge().hasBiometricSession()) return;
    modal({
      title: 'Sign in faster next time',
      subtitle: 'Use your fingerprint to unlock BrightPath on this device.',
      body: '<div class="center stack">' + sticker('fingerprint', 'purple') +
        '<p class="muted">Your saved session is locked inside this phone’s secure chip. BrightPath cannot read it without your fingerprint, and your password is never saved.</p></div>',
      footer: '<button class="button button-quiet" type="button" data-modal-close="1">Not now</button>' +
        '<button class="button button-primary" type="button" id="enable-biometric">' + icon('fingerprint') + ' Enable fingerprint</button>',
      onMount: function (element) {
        element.querySelector('#enable-biometric').addEventListener('click', function () {
          closeModal();
          var requestId = 'save-' + Date.now();
          try {
            bridge().saveBiometricSession(session.token, JSON.stringify(session.user), API_BASE, requestId);
          } catch (error) {
            toast('Fingerprint setup is not available. Use your password instead.', 'error');
          }
        });
      }
    });
  }

  window.BrightPathWeb = {
    onBiometricUnlocked: function (requestId, payload) {
      try {
        var data = JSON.parse(payload);
        if (!data || !data.token) throw new Error('Missing session');
        session.token = data.token;
        session.user = data.user || null;
        saveToken(data.token, true);
        if (data.user) {
          try { localStorage.setItem(KEYS.user, JSON.stringify(data.user)); } catch (error) { /* ignore */ }
        }
        api('auth/me').then(function (fresh) {
          session.user = fresh.user;
          session.settings = fresh.settings || {};
          session.unread = Number(fresh.unread_notifications) || 0;
          startApp();
          toast('Unlocked with fingerprint.', 'success');
        }).catch(function (error) {
          clearSession();
          showAuth('login');
          toast(apiError(error), 'error');
        });
      } catch (error) {
        toast('Could not unlock that session. Sign in with your password.', 'error');
        showAuth('login');
      }
    },
    onBiometricSaved: function (requestId, success, message) {
      toast(message || (success ? 'Fingerprint sign-in is ready.' : 'Fingerprint could not be saved.'), success ? 'success' : 'error');
      var button = $('#biometric-unlock');
      if (button) button.hidden = !(success && biometricReady());
    },
    onBiometricUnlockResult: function (requestId, success, message) {
      var button = $('#biometric-unlock');
      if (button) {
        button.disabled = false;
        button.innerHTML = icon('fingerprint') + ' Unlock with fingerprint';
      }
      if (!success && message) toast(message, 'error');
    }
  };

  function startBiometricUnlock() {
    var button = $('#biometric-unlock');
    if (!nativeApp() || !bridge().unlockBiometricSession) {
      toast('Fingerprint sign-in only works in the BrightPath Android app.', 'error');
      return;
    }
    if (button) {
      button.disabled = true;
      button.textContent = 'Waiting for your fingerprint…';
    }
    try {
      bridge().unlockBiometricSession('unlock-' + Date.now());
    } catch (error) {
      if (button) { button.disabled = false; button.innerHTML = icon('fingerprint') + ' Unlock with fingerprint'; }
      toast('Fingerprint sign-in is unavailable. Use your password.', 'error');
    }
  }

  /* ---------------------------------------------------------------------
   * Sponsors and downloads
   * ------------------------------------------------------------------ */

  function sponsorMarkup(sponsor) {
    var id = Number(sponsor.id);
    if (!sponsorSeen[id]) {
      sponsorSeen[id] = true;
      api('sponsors/event', { method: 'POST', body: { id: id, event: 'impression' } }).catch(function () { /* ignore */ });
    }
    var media = sponsor.image_url
      ? '<img src="' + esc(sponsor.image_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
      : sticker('heart', 'orange');
    return '<article class="sponsor-card">' + media +
      '<div class="grow"><span class="badge badge-yellow">' + esc(sponsor.label || 'Family pick') + '</span>' +
      '<strong>' + esc(sponsor.title) + '</strong>' +
      (sponsor.body ? '<p>' + esc(sponsor.body) + '</p>' : '') + '</div>' +
      (sponsor.target_url ? '<a class="button button-quiet button-small" href="' + esc(sponsor.target_url) + '" target="_blank" rel="noopener noreferrer" data-sponsor-click="' + id + '">Open</a>' : '') +
      '</article>';
  }

  function loyaltyButton() {
    return '<button class="button button-quiet button-small" type="button" data-app-link="' + (CONFIG.androidDownloadUrl ? 'download' : 'android') + '">' +
      icon('download') + (CONFIG.androidDownloadUrl ? ' Android app' : ' Get the app') + '</button>';
  }

  function fetchBlob(route, query) {
    var url = API_BASE + '/api/index.php?r=' + encodeURIComponent(route);
    var params = query || {};
    Object.keys(params).forEach(function (key) {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      }
    });
    return fetch(url, {
      headers: { Authorization: 'Bearer ' + session.token, 'X-Auth-Token': session.token },
      cache: 'no-store'
    }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (text) {
          var data = null;
          try { data = JSON.parse(text); } catch (error) { /* ignore */ }
          throw new Error(data && data.error ? data.error : 'That file could not be downloaded.');
        });
      }
      return response.blob();
    });
  }

  function downloadStored(route, query, filename) {
    toast('Preparing your file…');
    fetchBlob(route, query).then(function (blob) {
      if (nativeApp() && bridge().saveBase64File) {
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var result = String(reader.result || '');
            var base64 = result.indexOf(',') >= 0 ? result.split(',')[1] : result;
            bridge().saveBase64File(filename || 'brightpath-file', blob.type || 'application/octet-stream', base64);
            toast('Saved to your Downloads folder.', 'success');
          } catch (error) {
            toast('The file could not be saved on this device.', 'error');
          }
        };
        reader.onerror = function () { toast('The file could not be read.', 'error'); };
        reader.readAsDataURL(blob);
        return;
      }
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = filename || 'brightpath-file';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    }).catch(function (error) {
      toast(apiError(error), 'error');
    });
  }

  function bindShellEvents() {
    var menuButton = $('#menu-button');
    if (menuButton) menuButton.addEventListener('click', openSidebar);
    var scrim = $('#nav-scrim');
    if (scrim) scrim.addEventListener('click', closeSidebar);
    var profileButton = $('#profile-button');
    if (profileButton) profileButton.addEventListener('click', function () { navigate('profile'); });
    var notificationButton = $('#notification-button');
    if (notificationButton) notificationButton.addEventListener('click', function () {
      var drawer = $('#notification-drawer');
      if (drawer.hidden) { openDrawer(); loadNotifications(false); }
      else closeDrawer();
    });
    var notificationClose = $('#notification-close');
    if (notificationClose) notificationClose.addEventListener('click', closeDrawer);
    var markAll = $('#mark-all-read');
    if (markAll) markAll.addEventListener('click', function () {
      api('notifications/read', { method: 'POST', body: {} }).then(function () {
        session.unread = 0;
        updateUnreadBadge();
        $$('#notification-list .notification-item').forEach(function (item) { item.classList.remove('is-unread'); });
        toast('All notifications marked as read.');
      }).catch(function (error) { toast(apiError(error), 'error'); });
    });
    var enableNotifications = $('#enable-notifications');
    if (enableNotifications) enableNotifications.addEventListener('click', function () {
      if (nativeApp() && bridge().requestNotificationPermission) {
        bridge().requestNotificationPermission();
      } else if ('Notification' in window) {
        Notification.requestPermission().then(function (permission) {
          toast(permission === 'granted' ? 'Notifications are on.' : 'Notifications were not allowed.', permission === 'granted' ? 'success' : 'error');
        });
      } else {
        toast('This browser does not support notifications.');
      }
    });
    var installButton = $('#install-button');
    if (installButton) installButton.addEventListener('click', function () {
      window.open('./index.html#android', '_blank', 'noopener');
    });
    var searchForm = $('#search-form');
    if (searchForm) searchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var query = $('#search-input').value.trim();
      if (query) navigate('search', { q: query });
    });
    var sidebarHelp = $('#sidebar-help');
    if (sidebarHelp) sidebarHelp.addEventListener('click', function () { navigate('help'); });
    var tourSkip = $('#tour-skip');
    if (tourSkip) tourSkip.addEventListener('click', finishTour);
    var tourNext = $('#tour-next');
    if (tourNext) tourNext.addEventListener('click', function () {
      if (tourIndex >= TOUR_STEPS.length - 1) { finishTour(); return; }
      tourIndex += 1;
      renderTourStep();
    });
    var tourBack = $('#tour-back');
    if (tourBack) tourBack.addEventListener('click', function () {
      if (tourIndex > 0) { tourIndex -= 1; renderTourStep(); }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        if (!$('#modal-root').innerHTML && $('#notification-drawer').hidden === false) closeDrawer();
        else closeModal();
        closeSidebar();
      }
      if (event.key === '/' && document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(document.activeElement.tagName) === -1) {
        var search = $('#search-input');
        if (search && search.offsetParent !== null) { event.preventDefault(); search.focus(); }
      }
    });
    document.addEventListener('click', function (event) {
      var pageLink = event.target.closest ? event.target.closest('[data-page]') : null;
      if (pageLink && pageLink.getAttribute('data-page')) {
        if (pageLink.tagName === 'A') event.preventDefault();
        navigate(pageLink.getAttribute('data-page'));
        return;
      }
      var retry = event.target.closest ? event.target.closest('[data-retry]') : null;
      if (retry) { navigate(retry.getAttribute('data-retry') || currentPage, routeParams, true); return; }
      var authGo = event.target.closest ? event.target.closest('[data-auth-go]') : null;
      if (authGo) { selectAuthForm(authGo.getAttribute('data-auth-go')); return; }
      var modalClose = event.target.closest ? event.target.closest('[data-modal-close]') : null;
      if (modalClose || (event.target.hasAttribute && event.target.hasAttribute('data-modal-backdrop'))) { closeModal(); return; }
      var notification = event.target.closest ? event.target.closest('[data-notification]') : null;
      if (notification) {
        var id = notification.getAttribute('data-notification');
        var page = notification.getAttribute('data-notification-page') || 'home';
        markNotificationRead(id);
        closeDrawer();
        navigate(page);
        return;
      }
      var sponsorClick = event.target.closest ? event.target.closest('[data-sponsor-click]') : null;
      if (sponsorClick) {
        api('sponsors/event', { method: 'POST', body: { id: Number(sponsorClick.getAttribute('data-sponsor-click')), event: 'click' } }).catch(function () { /* ignore */ });
        return;
      }
      var appLink = event.target.closest ? event.target.closest('[data-app-link]') : null;
      if (appLink) {
        if (CONFIG.androidDownloadUrl) window.open(CONFIG.androidDownloadUrl, '_blank', 'noopener');
        else window.location.href = './index.html#android';
        return;
      }
      if (event.target.closest && event.target.closest('[data-logout]')) { logout(); return; }
    });
  }

  function bindAuthEvents() {
    $$('.auth-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { selectAuthForm(tab.getAttribute('data-auth-tab')); });
    });
    $('#login-form').addEventListener('submit', handleLogin);
    $('#register-form').addEventListener('submit', handleRegister);
    $('#forgot-form').addEventListener('submit', handleForgot);
    $('#forgot-button').addEventListener('click', function () { selectAuthForm('forgot'); $('#forgot-email').value = $('#login-email').value; });
    $('#forgot-back').addEventListener('click', function () { selectAuthForm('login'); });
    $('#biometric-unlock').addEventListener('click', startBiometricUnlock);
    $$('.peek').forEach(function (button) {
      button.addEventListener('click', function () {
        var input = document.getElementById(button.getAttribute('data-peek'));
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        button.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
      });
    });
    $$('input[name="register-role"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        $$('.role-option').forEach(function (option) {
          option.classList.toggle('is-active', !!option.querySelector('input:checked'));
        });
        var role = radio.value;
        $('#student-consent-fields').hidden = role !== 'student';
        $('#grade-field').hidden = role !== 'student';
        $('#register-tutor-note').hidden = role !== 'tutor';
      });
    });
  }

  function boot() {
    if (!API_BASE) {
      showAuth('login');
      setFormMessage($('#login-form'), 'Server address missing. Upload site-config.js with your BrightPath address.', 'error');
      return;
    }
    bindAuthEvents();
    bindShellEvents();
    var resetToken = new URLSearchParams(location.search).get('reset');
    bootSession();
    if (resetToken) setTimeout(function () { showAuth('login'); openResetForm(resetToken); }, 400);
  }

  /* ---------------------------------------------------------------------
   * Shared page pieces
   * ------------------------------------------------------------------ */

  var RENDERERS = {};

  function gradeOptions(selected) {
    var html = '<option value="">Choose grade</option>';
    for (var grade = 1; grade <= 8; grade += 1) {
      html += '<option value="' + grade + '"' + (Number(selected) === grade ? ' selected' : '') + '>Grade ' + grade + '</option>';
    }
    return html;
  }

  function mascotSvg() {
    return '<svg viewBox="0 0 220 220" role="img" aria-label="Pip the BrightPath guide">' +
      '<path class="mascot-body" d="M110 28c42 0 72 25 72 62 0 19 8 31 8 46 0 38-34 60-80 60s-80-22-80-60c0-15 8-27 8-46 0-37 30-62 72-62Z"/>' +
      '<circle cx="84" cy="112" r="8" class="mascot-eye"/><circle cx="136" cy="112" r="8" class="mascot-eye"/>' +
      '<path d="M96 136c8 8 20 8 28 0" class="mascot-smile"/>' +
      '<path d="M110 26c-6-12 2-20 12-22 0 11-4 18-12 22Z" class="mascot-leaf"/>' +
      '<circle cx="58" cy="142" r="8" class="mascot-cheek"/><circle cx="162" cy="142" r="8" class="mascot-cheek"/></svg>';
  }

  function statCard(iconName, value, label, theme) {
    return '<article class="card stat-card"><span class="sticker' + (theme ? ' sticker-' + theme : '') + '">' + icon(iconName) + '</span>' +
      '<div><strong>' + esc(value) + '</strong><span>' + esc(label) + '</span></div></article>';
  }

  function lessonStatus(progress) {
    if (progress === 'completed') return '<span class="lesson-status">' + icon('check') + ' Finished</span>';
    if (progress === 'started') return '<span class="lesson-status">In progress</span>';
    return '<span class="lesson-status">New</span>';
  }

  function classCard(item, options) {
    var isLive = item.status === 'live';
    var ended = item.status === 'ended' || item.status === 'cancelled';
    var actions = '';
    if (!ended) {
      actions += '<button class="button button-primary button-small" type="button" data-join-class="' + Number(item.id) + '">' + icon('video') + ' Join class</button>';
    }
    if (options && options.canManage) {
      if (!ended) {
        actions += '<button class="button button-quiet button-small" type="button" data-attendance="' + Number(item.id) + '">' + icon('users') + ' Attendance</button>';
        actions += '<button class="button button-outline button-small" type="button" data-end-class="' + Number(item.id) + '">End</button>';
      }
    }
    if (options && options.canRemind && !ended) {
      actions += '<button class="button button-quiet button-small" type="button" data-remind-class="' + Number(item.id) + '" data-class-title="' + esc(item.title) + '" data-class-time="' + esc(item.scheduled_at) + '">' + icon('bell') + ' Remind me</button>';
    }
    return '<article class="card class-card">' +
      '<div class="row-between"><span class="badge ' + (isLive ? 'badge-peach' : 'badge-blue') + '">' + (isLive ? '<span class="pulse"></span> Live now' : esc(item.status || 'scheduled')) + '</span>' +
        (Number(item.audio_only) === 1 ? '<span class="badge badge-mint">' + icon('mic') + ' Audio only</span>' : '') + '</div>' +
      '<h3>' + esc(item.title) + '</h3>' +
      '<div class="class-when">' + esc(formatDateTime(item.scheduled_at)) + '</div>' +
      '<div class="meta-row"><span>' + icon('book') + esc(item.subject || 'General') + '</span><span>' + icon('users') + 'Grade ' + esc(item.grade) + '</span><span>' + icon('clock') + esc(item.duration_minutes) + ' min</span></div>' +
      '<div class="meta-row"><span>' + icon('people') + 'With ' + esc(item.tutor_name || 'your tutor') + '</span><span>' + icon('users') + plural(Number(item.attendee_count) || 0, 'learner') + '</span></div>' +
      (options && options.showCode && item.join_code ? '<div class="feedback-box"><strong>Join code</strong>' + esc(item.join_code) + '</div>' : '') +
      '<div class="class-actions">' + actions + '</div></article>';
  }

  function childPicker(children, selectedId, page) {
    if (!children || children.length <= 1) return '';
    return '<div class="filter-chips" style="margin-bottom:15px">' + children.map(function (child) {
      return '<button class="chip' + (Number(selectedId) === Number(child.id) ? ' is-active' : '') + '" type="button" data-child-page="' + esc(page) + '" data-child="' + Number(child.id) + '">' +
        esc(child.name) + '</button>';
    }).join('') + '</div>';
  }

  async function parentLinks() {
    var data = await api('parent/links');
    return (data.links || []).filter(function (link) { return link.status === 'active'; });
  }

  /* ---------------------------------------------------------------------
   * Dashboard
   * ------------------------------------------------------------------ */

  function dashboardHero(title, message, quickActions) {
    return '<section class="dashboard-hero"><div class="dash-welcome">' +
      '<h1>' + esc(title) + '</h1><p>' + esc(message) + '</p>' +
      '<div class="quick-actions">' + quickActions + '</div></div>' +
      '<div class="dash-mascot">' + mascotSvg() + '<div class="mascot-bubble">One small step today is a big win this week.</div></div></section>';
  }

  function upcomingList(items, emptyText) {
    if (!items || !items.length) return '<p class="muted small">' + esc(emptyText) + '</p>';
    return '<div class="stack">' + items.map(function (item) {
      return '<div class="schedule-row"><div class="schedule-date"><small>' +
        esc(parseDate(item.scheduled_at) ? parseDate(item.scheduled_at).toLocaleDateString(undefined, { month: 'short' }) : '') + '</small><strong>' +
        esc(parseDate(item.scheduled_at) ? parseDate(item.scheduled_at).getDate() : '') + '</strong></div>' +
        '<div class="schedule-info grow"><strong>' + esc(item.title) + '</strong><span>' + esc(formatDateTime(item.scheduled_at)) + ' · ' + esc(item.subject || 'General') + '</span></div>' +
        '<button class="button button-quiet button-small" type="button" data-join-class="' + Number(item.id) + '">Join</button></div>';
    }).join('') + '</div>';
  }

  function activityLabel(type) {
    var labels = { lesson: 'Lesson finished', assignment: 'Assignment work', class: 'Live class', game: 'Brain game', badge: 'Sticker earned' };
    return labels[type] || 'Learning activity';
  }

  function activityIcon(type) {
    var icons = { lesson: 'book', assignment: 'tasks', class: 'video', game: 'game', badge: 'trophy' };
    return icons[type] || 'sparkle';
  }

  function studentDashboard(data) {
    var user = session.user;
    var stats = data.stats || {};
    var extras = data.extras || {};
    var next = extras.next_lesson;
    var html = dashboardHero('Hi, ' + firstName(user) + '!', data.settings && data.settings.welcome_message ? data.settings.welcome_message : 'Ready for a little learning adventure? Pick up where you left off.',
      '<a class="quick-action" href="#/lessons">' + icon('book') + ' Lessons</a>' +
      '<a class="quick-action" href="#/assignments">' + icon('tasks') + ' My work</a>' +
      '<a class="quick-action" href="#/games">' + icon('game') + ' Brain break</a>' +
      '<a class="quick-action" href="#/classes">' + icon('video') + ' Live classes</a>');
    html += '<div class="stat-grid">' +
      statCard('star', stats.points || 0, 'Learning points', 'yellow') +
      statCard('rocket', (stats.streak || 0) + ' day' + (Number(stats.streak) === 1 ? '' : 's'), 'Learning streak', 'orange') +
      statCard('book', (stats.lessons_completed || 0) + ' / ' + (stats.lessons_total || 0), 'Lessons finished', 'mint') +
      statCard('tasks', stats.assignments_pending || 0, 'Work waiting', 'blue') + '</div>';
    html += '<div class="grid grid-2" style="margin-top:16px">';
    html += '<section class="card"><div class="row-between"><h2 style="margin:0">Your next step</h2><a class="link-button" href="#/lessons">All lessons</a></div>';
    if (next) {
      html += '<div class="next-card" style="padding:14px 0 0"><span class="sticker sticker-' + esc(next.theme || 'purple') + '">' + icon(next.icon || 'book') + '</span>' +
        '<div class="grow"><span class="badge badge-purple">' + esc(next.subject) + '</span><h3>' + esc(next.title) + '</h3>' +
        '<div class="meta-row"><span>' + icon('clock') + esc(next.estimated_minutes) + ' min</span><span>' + icon('star') + esc(next.points) + ' points</span><span>' + lessonStatus(next.progress_status) + '</span></div></div>' +
        '<button class="button button-primary button-small" type="button" data-lesson="' + Number(next.id) + '">' + (next.progress_status === 'completed' ? 'Revisit' : 'Start') + '</button></div>';
    } else {
      html += '<p class="muted" style="margin-top:12px">Your lessons will appear here when your school adds them.</p>';
    }
    html += '</section>';
    html += '<section class="card"><div class="row-between"><h2 style="margin:0">Coming up</h2><a class="link-button" href="#/classes">All classes</a></div>' +
      '<div style="margin-top:10px">' + upcomingList(extras.upcoming_classes, 'No live classes are scheduled yet.') + '</div></section>';
    html += '</div>';
    html += '<div class="grid grid-2" style="margin-top:16px"><section class="card"><h2>Recent wins</h2>';
    var activity = extras.recent_activity || [];
    if (activity.length) {
      html += activity.map(function (item) {
        return '<div class="activity-row"><span class="sticker sticker-mint">' + icon(activityIcon(item.activity_type)) + '</span><div class="grow"><strong>' + esc(item.detail || activityLabel(item.activity_type)) + '</strong><span>' + esc(timeAgo(item.created_at)) + ' · ' + esc(item.minutes || 0) + ' min</span></div>' +
          (Number(item.points) ? '<span class="badge badge-yellow">+' + esc(item.points) + '</span>' : '') + '</div>';
      }).join('');
    } else {
      html += '<p class="muted small">Finish a lesson or play a game to start your wins list.</p>';
    }
    html += '</section><section class="card"><div class="row-between"><h2 style="margin:0">Stickers</h2><a class="link-button" href="#/rewards">See all</a></div>';
    var badges = extras.recent_badges || [];
    if (badges.length) {
      html += '<div class="badge-grid" style="margin-top:12px">' + badges.map(function (badge) {
        return '<div class="badge-card"><span class="sticker sticker-' + esc(badge.theme || 'purple') + '">' + icon(badge.icon || 'star') + '</span><strong>' + esc(badge.title) + '</strong></div>';
      }).join('') + '</div>';
    } else {
      html += '<p class="muted small" style="margin-top:12px">Your first sticker is waiting in your next lesson.</p>';
    }
    html += '</section></div>';
    return html;
  }

  function parentDashboard(data) {
    var children = (data.extras && data.extras.children) || [];
    var pending = (data.stats && data.stats.pending_links) || 0;
    var html = dashboardHero('Family overview', 'See how your learners are doing and keep the encouragement going.',
      '<a class="quick-action" href="#/family">' + icon('family') + ' Link a child</a>' +
      '<a class="quick-action" href="#/progress">' + icon('chart') + ' Progress</a>' +
      '<a class="quick-action" href="#/messages">' + icon('message') + ' Messages</a>');
    html += '<div class="stat-grid">' +
      statCard('people', children.length, 'Linked children', 'purple') +
      statCard('family', pending, 'Requests waiting', 'orange') +
      statCard('book', children.reduce(function (sum, child) { return sum + Number(child.lessons_completed || 0); }, 0), 'Lessons finished', 'mint') +
      statCard('tasks', children.reduce(function (sum, child) { return sum + Number(child.assignments_pending || 0); }, 0), 'Assignments waiting', 'blue') + '</div>';
    if (pending) {
      html += '<div class="notice notice-warm" style="margin-top:16px">' + icon('shield') + '<span>You have a family request waiting. <a href="#/family">Review it in Family</a>.</span></div>';
    }
    html += '<div class="section-head"><h2>Your children</h2><a class="link-button" href="#/family">Manage family</a></div>';
    if (!children.length) {
      html += emptyState('family', 'Link your first child', 'Ask your child for their family code, or send a family request from the Family page.', '<a class="button button-primary button-small" href="#/family">Open Family</a>');
    } else {
      html += '<div class="grid grid-2">' + children.map(function (child) {
        return '<article class="card child-card">' + avatarMarkup(child, 'avatar-lg') +
          '<div class="grow"><strong>' + esc(child.name) + '</strong><span>Grade ' + esc(child.grade) + '</span>' +
          '<div class="mini-stats"><span class="mini-stat"><b>' + esc(child.points || 0) + '</b><small>Points</small></span>' +
          '<span class="mini-stat"><b>' + esc(child.streak || 0) + '</b><small>Streak</small></span>' +
          '<span class="mini-stat"><b>' + esc(child.lessons_completed || 0) + '</b><small>Lessons</small></span>' +
          '<span class="mini-stat"><b>' + esc(child.assignments_pending || 0) + '</b><small>To do</small></span></div></div>' +
          '<button class="button button-quiet button-small" type="button" data-child-page="progress" data-child="' + Number(child.id) + '">Progress</button></article>';
      }).join('') + '</div>';
    }
    return html;
  }

  function tutorDashboard(data) {
    var stats = data.stats || {};
    var extras = data.extras || {};
    var html = dashboardHero('Welcome back, ' + firstName(session.user), 'Your learners, classes, and work to review are all here.',
      '<a class="quick-action" href="#/students">' + icon('users') + ' Students</a>' +
      '<a class="quick-action" href="#/assignments">' + icon('plus') + ' New assignment</a>' +
      '<a class="quick-action" href="#/classes">' + icon('video') + ' Start a class</a>' +
      '<a class="quick-action" href="#/reviews">' + icon('check') + ' Review work</a>');
    html += '<div class="stat-grid">' +
      statCard('users', stats.students || 0, 'Active students', 'purple') +
      statCard('video', stats.upcoming_classes || 0, 'Classes coming up', 'blue') +
      statCard('check', stats.reviews_pending || 0, 'Work to review', 'orange') +
      statCard('tasks', stats.assignments || 0, 'Assignments made', 'mint') + '</div>';
    html += '<div class="grid grid-2" style="margin-top:16px"><section class="card"><div class="row-between"><h2 style="margin:0">Next classes</h2><a class="link-button" href="#/classes">All classes</a></div>' +
      '<div style="margin-top:10px">' + upcomingList(extras.upcoming_classes, 'Schedule a live class to meet your learners.') + '</div></section>' +
      '<section class="card"><h2>Quick guide</h2><ul class="list-clean">' +
      '<li>' + icon('check') + '<span>Add students by email so they appear in your group.</span></li>' +
      '<li>' + icon('check') + '<span>Set assignments for a grade, then review photos or answers here.</span></li>' +
      '<li>' + icon('check') + '<span>Live classes open in Jitsi. Use audio-only when video is not needed.</span></li>' +
      '</ul></section></div>';
    return html;
  }

  function adminDashboard(data) {
    var stats = data.stats || {};
    var html = dashboardHero('School overview', 'A calm view of accounts, classes, help requests, and partner cards.',
      '<a class="quick-action" href="#/users">' + icon('users') + ' People</a>' +
      '<a class="quick-action" href="#/admin">' + icon('shield') + ' Admin tools</a>' +
      (session.user.role === 'admin' ? '<a class="quick-action" href="#/sponsors">' + icon('heart') + ' Sponsors</a>' : ''));
    html += '<div class="stat-grid">' +
      statCard('users', stats.users || 0, 'All accounts', 'purple') +
      statCard('star', stats.students || 0, 'Active students', 'mint') +
      statCard('check', stats.tutors_pending || 0, 'Tutors waiting', 'orange') +
      statCard('video', stats.classes_upcoming || 0, 'Classes coming up', 'blue') +
      statCard('help', stats.support_open || 0, 'Open help requests', 'peach') + '</div>';
    html += '<div class="grid grid-2" style="margin-top:16px"><section class="card"><h2>Keep things moving</h2><ul class="list-clean">' +
      (Number(stats.tutors_pending) ? '<li>' + icon('clock') + '<span>Some tutor accounts are waiting for approval in People.</span></li>' : '') +
      (Number(stats.support_open) ? '<li>' + icon('help') + '<span>Reply to open help requests in Admin tools.</span></li>' : '') +
      '<li>' + icon('check') + '<span>Check that class schedules match your school calendar.</span></li>' +
      '<li>' + icon('shield') + '<span>Review the audit log after account changes.</span></li></ul></section>' +
      '<section class="card"><h2>Shortcuts</h2><div class="stack">' +
      '<a class="button button-quiet" href="#/users">' + icon('users') + ' Find a person</a>' +
      '<a class="button button-quiet" href="#/admin">' + icon('help') + ' Help requests</a>' +
      '<a class="button button-quiet" href="#/classes">' + icon('video') + ' Classes</a></div></section></div>';
    return html;
  }

  RENDERERS.home = async function () {
    setPageUserIntro();
    var data = await api('dashboard');
    if (data.user) {
      session.user = data.user;
      applyUser();
    }
    var role = session.user.role;
    var html = '';
    if (role === 'student') html = studentDashboard(data);
    else if (role === 'parent') html = parentDashboard(data);
    else if (role === 'tutor') html = tutorDashboard(data);
    else html = adminDashboard(data);
    if (data.sponsors && data.sponsors.length) {
      html += '<div class="section-head"><h2>Family-approved picks</h2><span class="badge badge-yellow">' + icon('shield') + ' Safe links</span></div>' +
        '<div class="grid grid-auto">' + data.sponsors.map(sponsorMarkup).join('') + '</div>';
    }
    html += '<div class="notice notice-mint" style="margin-top:20px">' + icon('shield') +
      '<span>Need help? Open <a href="#/help">Help</a> to message a grown-up. Never share your password with anyone.</span></div>';
    $('#page-content').innerHTML = html;
  };

  /* ---------------------------------------------------------------------
   * Lessons
   * ------------------------------------------------------------------ */

  RENDERERS.lessons = async function () {
    setPageUserIntro();
    var data = await api('lessons');
    var lessons = data.lessons || [];
    var role = session.user.role;
    var html = '<div class="page-head"><div><h1>Lessons</h1><p>' +
      (role === 'student' ? 'Short adventures made for grade ' + esc(session.user.grade) + '.' : 'All published lessons across grades 1 to 8.') +
      '</p></div>' + (role === 'tutor' ? '<a class="button button-primary" href="#/assignments">' + icon('plus') + ' New assignment</a>' : '') + '</div>';
    html += '<div class="guide-strip">' + sticker('book', 'purple') + '<span>Tap a card to read the lesson. Answer the check questions to earn points and stickers.</span></div>';
    if (!lessons.length) {
      html += emptyState('book', 'No lessons yet', 'Your school has not published lessons for this grade yet. Check back soon.');
      $('#page-content').innerHTML = html;
      return;
    }
    html += '<div class="lesson-grid">' + lessons.map(function (lesson) {
      var done = lesson.progress_status === 'completed';
      return '<button class="lesson-card lesson-card theme-' + esc(lesson.theme || 'purple') + (done ? ' is-done' : '') + '" type="button" data-lesson="' + Number(lesson.id) + '">' +
        '<span class="row-between">' + sticker(lesson.icon || 'book', lesson.theme || 'purple') + lessonStatus(lesson.progress_status) + '</span>' +
        '<h3>' + esc(lesson.title) + '</h3><p>' + esc(lesson.description || 'Open this lesson to begin.') + '</p>' +
        '<div class="lesson-foot"><span class="meta-row"><span>' + icon('clock') + esc(lesson.estimated_minutes) + ' min</span><span>' + icon('star') + esc(lesson.points) + ' pts</span></span>' +
        (done ? '<span class="badge badge-mint">' + esc(lesson.score || 0) + '%</span>' : '<span class="badge badge-purple">Grade ' + esc(lesson.grade) + '</span>') + '</div></button>';
    }).join('') + '</div>';
    $('#page-content').innerHTML = html;
  };

  function lessonContentHtml(content) {
    var blocks = String(content || '').split(/\n\s*\n/).filter(function (block) { return block.trim() !== ''; });
    if (!blocks.length) return '<p class="muted">This lesson is getting ready. Ask your tutor for the activity while you wait.</p>';
    return blocks.map(function (block) {
      var text = block.trim();
      var isTip = /^fun tip|^tip:|^remember:|^try this:/i.test(text);
      return '<p' + (isTip ? ' class="reader-callout"' : '') + '>' + esc(text).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  RENDERERS.lesson = async function () {
    setPageUserIntro();
    var id = Number(routeParams.id);
    if (!id) { navigate('lessons', {}, true); return; }
    currentLessonId = id;
    var data = await api('lessons', { query: { id: id } });
    var lesson = data.lesson || {};
    var questions = data.questions || [];
    var progress = data.progress || null;
    var role = session.user.role;
    var isStudent = role === 'student';
    if (isStudent) {
      api('lessons/start', { method: 'POST', body: { lesson_id: id } }).catch(function () { /* not important */ });
    }
    var html = '<button class="link-button" type="button" data-page="lessons">' + icon('arrow') + ' Back to lessons</button>';
    html += '<div class="page-head"><div><span class="badge badge-purple">Grade ' + esc(lesson.grade) + ' · ' + esc(lesson.subject) + '</span><h1>' + esc(lesson.title) + '</h1><p>' + esc(lesson.description) + '</p></div>' +
      '<div class="row">' + sticker(lesson.icon || 'book', lesson.theme || 'purple') + '</div></div>';
    html += '<div class="lesson-reader"><article class="card reader-main"><div class="reader-body">' + lessonContentHtml(lesson.content) + '</div>';
    if (questions.length) {
      html += '<div class="divider"></div><h2>Check what you learned</h2>' +
        '<p class="muted small">' + (isStudent ? 'Choose one answer for each question, then finish the lesson.' : 'Answer key for tutors and administrators.') + '</p>';
      html += '<form id="lesson-quiz" class="quiz">' + questions.map(function (question, qIndex) {
        return '<div class="quiz-question" data-question="' + Number(question.id) + '"><h4>' + (qIndex + 1) + '. ' + esc(question.prompt) + '</h4>' +
          (question.choices || []).map(function (choice, choiceIndex) {
            var letter = String.fromCharCode(65 + choiceIndex);
            if (!isStudent) {
              return '<div class="quiz-option' + (Number(question.correct_choice) === choiceIndex ? ' is-right' : '') + '"><span class="letter">' + letter + '</span>' + esc(choice) + '</div>';
            }
            return '<label class="quiz-option"><input type="radio" name="q-' + Number(question.id) + '" value="' + choiceIndex + '" required><span class="letter">' + letter + '</span>' + esc(choice) + '</label>';
          }).join('') + '</div>';
      }).join('') + '</form>';
      if (isStudent) {
        html += '<div class="row" style="margin-top:18px"><button class="button button-primary" type="button" id="finish-lesson">' + icon('check') + ' Finish lesson</button>' +
          '<span class="muted small">You can try again if you want a higher score.</span></div>';
      }
    } else {
      html += '<div class="notice" style="margin-top:18px">' + icon('book') + '<span>Read the lesson slowly. Ask your tutor if you want an activity to go with it.</span></div>';
    }
    html += '</article><aside class="reader-side">';
    html += '<section class="card"><h3>Lesson plan</h3><dl class="kv"><dt>Subject</dt><dd>' + esc(lesson.subject) + '</dd><dt>Grade</dt><dd>' + esc(lesson.grade) + '</dd>' +
      '<dt>Time</dt><dd>' + esc(lesson.estimated_minutes) + ' minutes</dd><dt>Points</dt><dd>' + esc(lesson.points) + ' + question points</dd>' +
      '<dt>Status</dt><dd>' + (progress && progress.status === 'completed' ? 'Finished · ' + esc(progress.score) + '%' : 'Ready to start') + '</dd></dl></section>';
    html += '<section class="card card-soft"><div class="row">' + sticker('sparkle', 'yellow') + '<strong>A little tip</strong></div><p class="small muted" style="margin:8px 0 0">Read one paragraph at a time. If a word feels tricky, say it out loud or ask a grown-up helper.</p></section>';
    if (progress && progress.status === 'completed') {
      html += '<section class="card"><h3>Your score</h3><div class="quiz-result"><strong>' + esc(progress.score) + '%</strong><span class="muted small">' + esc(formatDate(progress.completed_at)) + '</span></div></section>';
    }
    html += '</aside></div>';
    $('#page-content').innerHTML = html;

    var finishButton = $('#finish-lesson');
    if (finishButton) {
      finishButton.addEventListener('click', function () {
        var form = $('#lesson-quiz');
        var answers = {};
        var missing = false;
        questions.forEach(function (question) {
          var picked = form.querySelector('input[name="q-' + question.id + '"]:checked');
          if (!picked) missing = true;
          else answers[String(question.id)] = Number(picked.value);
        });
        if (missing) {
          toast('Answer every question before finishing.', 'error');
          return;
        }
        finishButton.disabled = true;
        finishButton.textContent = 'Checking your answers…';
        api('lessons/complete', { method: 'POST', body: { lesson_id: id, answers: answers } }).then(function (result) {
          var body = '<div class="quiz-result">' + sticker(result.score >= 80 ? 'trophy' : 'sparkle', result.score >= 80 ? 'yellow' : 'purple') +
            '<strong>' + esc(result.score) + '%</strong><p class="muted">' + esc(result.message) + '</p>' +
            '<div class="row" style="justify-content:center"><span class="badge badge-mint">' + esc(result.correct) + ' of ' + esc(result.total) + ' correct</span>' +
            (result.points_earned ? '<span class="badge badge-yellow">+' + esc(result.points_earned) + ' points</span>' : '') + '</div></div>';
          if (result.new_badges && result.new_badges.length) {
            body += '<div class="notice notice-warm">' + icon('trophy') + '<span>New sticker' + (result.new_badges.length > 1 ? 's' : '') + ': <strong>' + esc(result.new_badges.join(', ')) + '</strong></span></div>';
          }
          body += '<div class="stack">' + (result.review || []).map(function (item) {
            return '<div class="card card-flat"><strong>' + esc(item.prompt) + '</strong><p class="small ' + (item.is_correct ? '' : 'muted') + '" style="margin:6px 0 0">' +
              (item.is_correct ? icon('check') + ' Correct. ' : icon('refresh') + ' Correct answer: ' + esc((item.choices || [])[item.correct_choice]) + '. ') +
              esc(item.explanation || '') + '</p></div>';
          }).join('') + '</div>';
          modal({
            title: result.score >= 80 ? 'Brilliant work!' : 'Good try!',
            subtitle: 'Lesson: ' + lesson.title,
            body: body,
            footer: '<button class="button button-quiet" type="button" id="quiz-again">Try again</button><button class="button button-primary" type="button" data-page="lessons">Back to lessons</button>',
            onMount: function (element) {
              element.querySelector('#quiz-again').addEventListener('click', function () {
                closeModal();
                pageCleanup = null;
                RENDERERS.lesson();
              });
            }
          });
          api('auth/me').then(function (fresh) { session.unread = Number(fresh.unread_notifications) || 0; updateUnreadBadge(); }).catch(function () {});
        }).catch(function (error) {
          toast(apiError(error), 'error');
          finishButton.disabled = false;
          finishButton.innerHTML = icon('check') + ' Finish lesson';
        });
      });
    }
  };

  /* ---------------------------------------------------------------------
   * Assignments
   * ------------------------------------------------------------------ */

  function assignmentIcon(type) {
    return type === 'choice' ? 'check' : (type === 'text' ? 'pencil' : 'download');
  }

  function assignmentWorkForm(assignment) {
    var id = Number(assignment.id);
    if (assignment.assignment_type === 'file') {
      return '<form class="work-form" data-work-file="' + id + '">' +
        '<label class="file-drop">' + icon('camera') + '<span>Choose a photo or PDF of your work</span><span class="file-name" data-file-label>No file chosen</span>' +
        '<input type="file" name="file" accept="image/*,.pdf,.doc,.docx" required></label>' +
        '<label class="field"><span>Note for your tutor <em>(optional)</em></span><textarea name="notes" rows="2" placeholder="Tell your tutor what you worked on"></textarea></label>' +
        '<button class="button button-primary button-small" type="submit">' + icon('send') + ' Send my work</button></form>';
    }
    if (assignment.assignment_type === 'choice') {
      return '<form class="work-form" data-work-choice="' + id + '">' +
        '<strong class="small">' + esc(assignment.question_text || 'Choose your answer') + '</strong>' +
        (assignment.choices || []).map(function (choice, index) {
          return '<label class="quiz-option"><input type="radio" name="choice" value="' + index + '" required><span class="letter">' + String.fromCharCode(65 + index) + '</span>' + esc(choice) + '</label>';
        }).join('') +
        '<button class="button button-primary button-small" type="submit">' + icon('send') + ' Send my answer</button></form>';
    }
    return '<form class="work-form" data-work-text="' + id + '">' +
      '<strong class="small">' + esc(assignment.question_text || 'Write your answer') + '</strong>' +
      '<textarea name="answer_text" rows="4" required placeholder="Write in your own words"></textarea>' +
      '<button class="button button-primary button-small" type="submit">' + icon('send') + ' Send my answer</button></form>';
  }

  function assignmentStatus(assignment) {
    if (assignment.submission_id) {
      var score = assignment.score_grade;
      return '<div class="feedback-box"><strong>' + (assignment.submission_status === 'reviewed' ? 'Reviewed' : 'Sent to your tutor') + '</strong>' +
        (score !== null && score !== undefined ? 'Score: ' + esc(score) + '% ' : '') + esc(assignment.submission_feedback || '') + '</div>';
    }
    if (assignment.answer_id) {
      return '<div class="feedback-box"><strong>Answer sent</strong>' +
        (assignment.is_correct !== null && assignment.is_correct !== undefined ? (Number(assignment.is_correct) === 1 ? 'Correct answer. ' : 'Keep practising. ') : 'Waiting for review. ') +
        esc(assignment.answer_feedback || '') + (assignment.answer_points !== null && assignment.answer_points !== undefined ? ' · ' + esc(assignment.answer_points) + ' points' : '') + '</div>';
    }
    return '';
  }

  RENDERERS.assignments = async function () {
    setPageUserIntro();
    var role = session.user.role;
    var children = [];
    var childId = Number(routeParams.student_id) || 0;
    if (role === 'parent') {
      children = await parentLinks();
      if (!children.length) {
        $('#page-content').innerHTML = emptyState('family', 'Link a child first', 'Once a child is linked, their school work appears here.', '<a class="button button-primary button-small" href="#/family">Open Family</a>');
        return;
      }
      if (!childId) childId = Number(children[0].id);
    }
    var query = childId ? { student_id: childId } : {};
    var data = await api('assignments', { query: query });
    var assignments = data.assignments || [];
    var html = '<div class="page-head"><div><h1>' + (role === 'student' ? 'My work' : 'Assignments') + '</h1>' +
      '<p>' + (role === 'student' ? 'Send photos, choose answers, or write a reply. Your tutor will see it.' : (role === 'parent' ? 'See what your child has finished and what is still waiting.' : 'Create work for your learners and review what they send.')) + '</p></div>' +
      (role === 'tutor' || role === 'school_admin' || role === 'admin' ? '<button class="button button-primary" type="button" data-new-assignment="1">' + icon('plus') + ' New assignment</button>' : '') + '</div>';
    if (role === 'parent') html += childPicker(children, childId, 'assignments');
    html += '<div class="guide-strip">' + sticker('tasks', 'blue') + '<span>' +
      (role === 'student' ? 'Open one task at a time. You can send your work again if you want to improve it.' : 'Keep instructions short and friendly. Learners can send a photo, pick an answer, or write a reply.') + '</span></div>';
    if (!assignments.length) {
      html += emptyState('tasks', 'No work waiting', role === 'student' ? 'You are all caught up. Try a lesson or a brain game.' : 'New assignments will appear here.');
      $('#page-content').innerHTML = html;
      bindAssignmentForms();
      return;
    }
    html += '<div class="grid grid-2">' + assignments.map(function (assignment) {
      var submitted = !!assignment.submitted;
      var top = '<div class="assignment-top">' + sticker(assignmentIcon(assignment.assignment_type), 'blue') +
        '<div class="grow"><div class="row-between"><h3>' + esc(assignment.title) + '</h3>' +
        (assignment.due_at ? '<span class="badge badge-orange">Due ' + esc(formatDate(assignment.due_at)) + '</span>' : '') + '</div>' +
        '<p>' + esc(assignment.description || '') + '</p>' +
        '<div class="meta-row"><span>' + icon('star') + esc(assignment.points) + ' points</span><span>' + icon('book') + 'Grade ' + esc(assignment.grade) + '</span>' +
        (assignment.question_text ? '<span>' + icon('pencil') + esc(String(assignment.question_text).slice(0, 70)) + '</span>' : '') + '</div></div></div>';
      var body = '';
      if (role === 'student') {
        body = submitted ? assignmentStatus(assignment) : assignmentWorkForm(assignment);
      } else if (role === 'parent') {
        body = submitted ? assignmentStatus(assignment) : '<div class="notice notice-warm">' + icon('clock') + '<span>Still waiting for your child to send this.</span></div>';
      } else {
        body = '<div class="row-between"><span class="meta-row"><span>' + icon('check') + esc(assignment.submission_count || 0) + ' files</span><span>' + icon('pencil') + esc(assignment.answer_count || 0) + ' answers</span></span>' +
          '<div class="row"><button class="button button-quiet button-small" type="button" data-assignment-status="' + Number(assignment.id) + '" data-current-status="' + esc(assignment.status) + '">' +
          (assignment.status === 'closed' ? 'Reopen' : 'Close') + '</button>' +
          '<button class="button button-primary button-small" type="button" data-review-page="1">Review</button></div></div>';
      }
      return '<article class="card assignment-card">' + top + body + '</article>';
    }).join('') + '</div>';
    $('#page-content').innerHTML = html;
    bindAssignmentForms();
  };

  function bindAssignmentForms() {
    $$('form[data-work-file]').forEach(function (form) {
      var input = form.querySelector('input[type="file"]');
      if (input) input.addEventListener('change', function () {
        var label = form.querySelector('[data-file-label]');
        if (label) label.textContent = input.files && input.files[0] ? input.files[0].name : 'No file chosen';
      });
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var button = form.querySelector('button[type="submit"]');
        var file = input.files && input.files[0];
        if (!file) { toast('Choose a photo or PDF first.', 'error'); return; }
        var data = new FormData();
        data.append('assignment_id', form.getAttribute('data-work-file'));
        data.append('notes', form.querySelector('textarea[name="notes"]').value);
        data.append('file', file);
        button.disabled = true;
        button.textContent = 'Sending…';
        api('submissions', { method: 'POST', form: data }).then(function (result) {
          toast(result.message, 'success');
          renderPage();
        }).catch(function (error) {
          toast(apiError(error), 'error');
          button.disabled = false;
          button.innerHTML = icon('send') + ' Send my work';
        });
      });
    });
    $$('form[data-work-choice]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var picked = form.querySelector('input[name="choice"]:checked');
        if (!picked) { toast('Choose an answer first.', 'error'); return; }
        var body = { assignment_id: Number(form.getAttribute('data-work-choice')), selected_choice: Number(picked.value) };
        form.querySelectorAll('input, button').forEach(function (field) { field.disabled = true; });
        api('submissions', { method: 'POST', body: body }).then(function (result) {
          toast(result.message, result.is_correct === 0 ? '' : 'success');
          renderPage();
        }).catch(function (error) {
          toast(apiError(error), 'error');
          form.querySelectorAll('input, button').forEach(function (field) { field.disabled = false; });
        });
      });
    });
    $$('form[data-work-text]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var answer = form.querySelector('textarea').value.trim();
        if (!answer) { toast('Write your answer first.', 'error'); return; }
        var body = { assignment_id: Number(form.getAttribute('data-work-text')), answer_text: answer };
        var button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        api('submissions', { method: 'POST', body: body }).then(function (result) {
          toast(result.message, 'success');
          renderPage();
        }).catch(function (error) {
          toast(apiError(error), 'error');
          button.disabled = false;
        });
      });
    });
  }

  function openAssignmentModal(assignment) {
    var editing = !!assignment;
    var type = editing ? assignment.assignment_type : 'file';
    var choices = editing && assignment.choices ? assignment.choices : ['', '', ''];
    var card = modal({
      title: editing ? 'Edit assignment' : 'New assignment',
      subtitle: 'Keep it short and clear. Learners see this right away.',
      wide: true,
      body: '<form id="assignment-form" class="stack">' +
        '<div class="form-grid"><label class="field"><span>Title</span><input name="title" required maxlength="180" value="' + esc(editing ? assignment.title : '') + '"></label>' +
        '<label class="field"><span>Grade</span><select name="grade" required>' + gradeOptions(editing ? assignment.grade : (session.user.grade || '')) + '</select></label></div>' +
        '<div class="form-grid"><label class="field"><span>Type</span><select name="assignment_type" id="assignment-type">' +
        '<option value="file"' + (type === 'file' ? ' selected' : '') + '>Photo or file upload</option>' +
        '<option value="choice"' + (type === 'choice' ? ' selected' : '') + '>Multiple choice</option>' +
        '<option value="text"' + (type === 'text' ? ' selected' : '') + '>Written answer</option></select></label>' +
        '<label class="field"><span>Due date <em>(optional)</em></span><input name="due_at" type="date" value="' + esc(editing && assignment.due_at ? assignment.due_at : '') + '"></label></div>' +
        '<label class="field"><span>Instructions</span><textarea name="description" rows="3" maxlength="5000" placeholder="What should learners do?">' + esc(editing ? assignment.description : '') + '</textarea></label>' +
        '<div id="question-fields" class="stack"' + (type === 'file' ? ' hidden' : '') + '>' +
        '<label class="field"><span>Question</span><textarea name="question_text" rows="2" placeholder="Ask one clear question">' + esc(editing ? assignment.question_text : '') + '</textarea></label>' +
        '<div id="choice-fields" class="stack"' + (type === 'choice' ? '' : ' hidden') + '>' +
        choices.map(function (choice, index) {
          return '<label class="field"><span>Answer ' + (index + 1) + '</span><input name="choice-' + index + '" maxlength="300" value="' + esc(choice) + '" placeholder="Answer option"></label>';
        }).join('') +
        '<label class="field"><span>Correct answer</span><select name="correct_choice"><option value="0">Answer 1</option><option value="1">Answer 2</option><option value="2">Answer 3</option><option value="3">Answer 4</option></select></label></div></div>' +
        '<div class="form-grid"><label class="field"><span>Points</span><input name="points" type="number" min="0" max="100" value="' + esc(editing ? assignment.points : 10) + '"></label>' +
        '<label class="field"><span>Status</span><select name="status"><option value="published"' + (!editing || assignment.status === 'published' ? ' selected' : '') + '>Published</option><option value="draft"' + (editing && assignment.status === 'draft' ? ' selected' : '') + '>Draft</option><option value="closed"' + (editing && assignment.status === 'closed' ? ' selected' : '') + '>Closed</option></select></label></div>' +
        '<div class="form-message"></div></form>',
      footer: '<button class="button button-quiet" type="button" data-modal-close="1">Cancel</button><button class="button button-primary" type="submit" form="assignment-form">' + (editing ? 'Save assignment' : 'Create assignment') + '</button>',
      onMount: function (element) {
        var form = element.querySelector('#assignment-form');
        var typeSelect = form.querySelector('#assignment-type');
        if (editing && assignment.correct_choice !== undefined && assignment.correct_choice !== null) {
          form.querySelector('[name="correct_choice"]').value = String(assignment.correct_choice);
        }
        typeSelect.addEventListener('change', function () {
          var value = typeSelect.value;
          form.querySelector('#question-fields').hidden = value === 'file';
          form.querySelector('#choice-fields').hidden = value !== 'choice';
        });
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var message = form.querySelector('.form-message');
          var choiceValues = [];
          if (typeSelect.value === 'choice') {
            for (var index = 0; index < 4; index += 1) {
              var field = form.querySelector('[name="choice-' + index + '"]');
              if (field && field.value.trim()) choiceValues.push(field.value.trim());
            }
            if (choiceValues.length < 2) {
              message.className = 'form-message form-error';
              message.textContent = 'Add at least two answer options.';
              return;
            }
          }
          var body = {
            id: editing ? Number(assignment.id) : undefined,
            title: form.querySelector('[name="title"]').value.trim(),
            grade: Number(form.querySelector('[name="grade"]').value),
            assignment_type: typeSelect.value,
            description: form.querySelector('[name="description"]').value.trim(),
            question_text: form.querySelector('[name="question_text"]').value.trim(),
            due_at: form.querySelector('[name="due_at"]').value || '',
            points: Number(form.querySelector('[name="points"]').value) || 10,
            status: form.querySelector('[name="status"]').value,
            choices: choiceValues,
            correct_choice: Number(form.querySelector('[name="correct_choice"]').value)
          };
          api('assignments', { method: 'POST', body: body }).then(function (result) {
            closeModal();
            toast(result.message, 'success');
            if (currentPage === 'assignments') renderPage();
          }).catch(function (error) {
            message.className = 'form-message form-error';
            message.textContent = apiError(error);
          });
        });
      }
    });
    return card;
  }

  /* ---------------------------------------------------------------------
   * Live classes and Jitsi
   * ------------------------------------------------------------------ */

  RENDERERS.classes = async function () {
    setPageUserIntro();
    var role = session.user.role;
    var children = [];
    var childId = Number(routeParams.student_id) || 0;
    if (role === 'parent') {
      children = await parentLinks();
      if (!children.length) {
        $('#page-content').innerHTML = emptyState('family', 'Link a child first', 'Classes appear after a child is linked to your account.', '<a class="button button-primary button-small" href="#/family">Open Family</a>');
        return;
      }
      if (!childId) childId = Number(children[0].id);
    }
    var data = await api('classes', { query: childId ? { student_id: childId } : {} });
    var items = data.classes || [];
    var canManage = role === 'tutor' || role === 'school_admin' || role === 'admin';
    var now = Date.now();
    var upcoming = items.filter(function (item) {
      return item.status !== 'ended' && item.status !== 'cancelled' && parseDate(item.scheduled_at) && parseDate(item.scheduled_at).getTime() > now - 21600000;
    });
    var past = items.filter(function (item) { return upcoming.indexOf(item) === -1; });
    var html = '<div class="page-head"><div><h1>Live classes</h1><p>Join from your phone or computer. Camera and microphone always need your permission first.</p></div>' +
      (canManage ? '<button class="button button-primary" type="button" data-new-class="1">' + icon('plus') + ' Schedule class</button>' : '') + '</div>';
    if (role === 'parent') html += childPicker(children, childId, 'classes');
    html += '<div class="notice notice-mint">' + icon('video') + '<span>Classes run in Jitsi, a free open-source classroom. You can choose audio only if you do not want to use your camera.</span></div>';
    html += '<div class="section-head"><h2>Coming up</h2><span class="badge badge-blue">' + plural(upcoming.length, 'class') + '</span></div>';
    if (!upcoming.length) {
      html += emptyState('video', 'No classes scheduled', canManage ? 'Schedule a class and your learners will see it here.' : 'When your tutor schedules a class, it appears here with a Join button.');
    } else {
      html += '<div class="class-grid">' + upcoming.map(function (item) {
        return classCard(item, { canManage: canManage, showCode: canManage, canRemind: !canManage });
      }).join('') + '</div>';
    }
    if (past.length) {
      html += '<div class="section-head"><h2>Finished classes</h2></div><div class="class-grid">' + past.slice(0, 6).map(function (item) {
        return classCard(item, { canManage: canManage, showCode: false });
      }).join('') + '</div>';
    }
    html += '<div class="card card-soft" style="margin-top:20px"><div class="row">' + sticker('shield', 'mint') +
      '<div class="grow"><strong>A safer class space</strong><p class="small muted" style="margin:2px 0 0">Everyone joins with a school-approved account. Tutors can see attendance for their own classes.</p></div></div></div>';
    $('#page-content').innerHTML = html;
  };

  function openClassModal() {
    var card = modal({
      title: 'Schedule a live class',
      subtitle: 'Learners in the chosen grade will get a notification.',
      body: '<form id="class-form" class="stack">' +
        '<label class="field"><span>Class title</span><input name="title" required maxlength="180" placeholder="For example: Fractions made easy"></label>' +
        '<div class="form-grid"><label class="field"><span>Subject</span><input name="subject" maxlength="60" placeholder="Mathematics" value="General"></label>' +
        '<label class="field"><span>Grade</span><select name="grade" required>' + gradeOptions(session.user.grade || '') + '</select></label></div>' +
        '<div class="form-grid"><label class="field"><span>Date and time</span><input name="scheduled_at" type="datetime-local" required></label>' +
        '<label class="field"><span>Minutes</span><input name="duration_minutes" type="number" min="10" max="240" value="45"></label></div>' +
        '<label class="check check-box"><input name="audio_only" type="checkbox"> <span>Audio-only class (camera starts off for everyone)</span></label>' +
        '<label class="check check-box"><input name="allow_recording" type="checkbox"> <span>Allow recording if everyone agrees</span></label>' +
        '<div class="form-message"></div></form>',
      footer: '<button class="button button-quiet" type="button" data-modal-close="1">Cancel</button><button class="button button-primary" type="submit" form="class-form">Schedule class</button>',
      onMount: function (element) {
        var form = element.querySelector('#class-form');
        form.querySelector('[name="scheduled_at"]').value = localDateTimeValue(new Date(Date.now() + 3600000));
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var message = form.querySelector('.form-message');
          var body = {
            title: form.querySelector('[name="title"]').value.trim(),
            subject: form.querySelector('[name="subject"]').value.trim() || 'General',
            grade: Number(form.querySelector('[name="grade"]').value),
            scheduled_at: toUtcSql(form.querySelector('[name="scheduled_at"]').value),
            duration_minutes: Number(form.querySelector('[name="duration_minutes"]').value) || 45,
            audio_only: form.querySelector('[name="audio_only"]').checked,
            allow_recording: form.querySelector('[name="allow_recording"]').checked
          };
          api('classes', { method: 'POST', body: body }).then(function (result) {
            closeModal();
            toast('Class scheduled. Join code: ' + result.join_code, 'success');
            renderPage();
          }).catch(function (error) {
            message.className = 'form-message form-error';
            message.textContent = apiError(error);
          });
        });
      }
    });
    return card;
  }

  async function joinClass(classId) {
    try {
      toast('Opening your class…');
      var data = await api('classes/join', { method: 'POST', body: { class_id: classId } });
      var join = data.join;
      var overlay = $('#jitsi-overlay');
      var container = $('#jitsi-container');
      $('#jitsi-title').textContent = join.subject || 'BrightPath class';
      container.innerHTML = '<div class="loading" style="color:#fff"><span class="spinner"></span><span>Loading the class room…</span></div>';
      $('#class-chat-panel').hidden = true;
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      var scriptUrl = join.script_url || ('https://' + join.domain + '/external_api.js');
      await loadScript(scriptUrl);
      if (!window.JitsiMeetExternalAPI) throw new Error('The live class tool did not start. Please try again.');
      container.innerHTML = '';
      var apiInstance = new window.JitsiMeetExternalAPI(join.domain, {
        roomName: join.room,
        parentNode: container,
        width: '100%',
        height: '100%',
        userInfo: { displayName: join.display_name, email: join.email },
        configOverwrite: Object.assign({
          prejoinPageEnabled: true,
          disableDeepLinking: true,
          startWithAudioMuted: false,
          startWithVideoMuted: !!(join.start_with_video_muted || join.audio_only),
          startAudioOnly: !!join.audio_only
        }, join.config || {}),
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          MOBILE_APP_PROMO: false,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          DEFAULT_BACKGROUND: '#0b0d16'
        }
      });
      jitsiState = { api: apiInstance, classId: classId, startedAt: Date.now(), chatTimer: null };
      apiInstance.addEventListener('videoConferenceLeft', function () { leaveClass(true); });
      apiInstance.addEventListener('readyToClose', function () { leaveClass(true); });
      apiInstance.addEventListener('errorOccurred', function (event) {
        toast((event && event.message) ? event.message : 'The class had a connection problem.', 'error');
      });
    } catch (error) {
      var containerAgain = $('#jitsi-container');
      if (containerAgain) {
        containerAgain.innerHTML = '<div class="empty-state" style="margin:30px;background:#fff">' + icon('cloud') +
          '<h3>The class could not open</h3><p>' + esc(apiError(error)) + '</p><button class="button button-primary button-small" type="button" id="close-jitsi-error">Close</button></div>';
        var closeButton = $('#close-jitsi-error');
        if (closeButton) closeButton.addEventListener('click', function () { leaveClass(false); });
      }
      toast(apiError(error), 'error');
    }
  }

  function leaveClass(sendLeave) {
    var classId = jitsiState ? jitsiState.classId : null;
    var startedAt = jitsiState ? jitsiState.startedAt : 0;
    if (jitsiState && jitsiState.chatTimer) clearInterval(jitsiState.chatTimer);
    if (jitsiState && jitsiState.api) {
      try { jitsiState.api.dispose(); } catch (error) { /* ignore */ }
    }
    jitsiState = null;
    $('#jitsi-overlay').hidden = true;
    $('#jitsi-container').innerHTML = '';
    $('#class-chat-panel').hidden = true;
    document.body.style.overflow = '';
    if (sendLeave && classId) {
      var minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      api('classes/leave', { method: 'POST', body: { class_id: classId, minutes: minutes } }).catch(function () { /* ignore */ });
    }
  }

  function renderClassMessages(messages, userName) {
    var list = $('#class-chat-messages');
    if (!list) return;
    if (!messages.length) {
      list.innerHTML = '<div class="chat-empty">' + icon('message') + '<span>No class messages yet. Say hello!</span></div>';
      return;
    }
    list.innerHTML = messages.map(function (message) {
      var mine = String(message.user_name) === String(userName);
      return '<div class="chat-bubble' + (mine ? ' is-mine' : '') + '"><strong class="small">' + esc(message.user_name) + '</strong><div>' + esc(message.body) + '</div><small>' + esc(timeAgo(message.created_at)) + '</small></div>';
    }).join('');
    list.scrollTop = list.scrollHeight;
  }

  function loadClassMessages(classId) {
    api('classes/messages', { query: { id: classId } }).then(function (data) {
      renderClassMessages(data.messages || [], session.user.name);
    }).catch(function () { /* ignore chat errors */ });
  }

  function bindJitsiChat(classId) {
    var toggle = $('#jitsi-chat-toggle');
    var panel = $('#class-chat-panel');
    var close = $('#class-chat-close');
    if (toggle) toggle.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        loadClassMessages(classId);
        if (jitsiState && jitsiState.chatTimer) clearInterval(jitsiState.chatTimer);
        if (jitsiState) jitsiState.chatTimer = setInterval(function () {
          if (!panel.hidden) loadClassMessages(classId);
        }, 6000);
      }
    });
    if (close) close.addEventListener('click', function () { panel.hidden = true; });
    var form = $('#class-chat-form');
    if (form) form.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = $('#class-chat-input');
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      api('classes/messages', { method: 'POST', body: { class_id: classId, body: text } }).then(function () {
        loadClassMessages(classId);
      }).catch(function (error) { toast(apiError(error), 'error'); });
    });
    loadClassMessages(classId);
  }

  function openAttendance(classId) {
    api('classes/attendance', { query: { id: classId } }).then(function (data) {
      var rows = data.attendance || [];
      var body = rows.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>Learner</th><th>Role</th><th>Joined</th><th>Left</th><th>Minutes</th></tr></thead><tbody>' +
        rows.map(function (row) {
          return '<tr><td><div class="table-person">' + avatarMarkup({ name: row.name, avatar: row.avatar }, '') + '<div><strong>' + esc(row.name) + '</strong><span>' + (row.grade ? 'Grade ' + esc(row.grade) : roleLabel(row.role)) + '</span></div></div></td>' +
            '<td>' + esc(roleLabel(row.role)) + '</td><td>' + esc(formatDateTime(row.joined_at)) + '</td><td>' + esc(row.left_at ? formatDateTime(row.left_at) : 'In class') + '</td><td>' + esc(row.minutes || 0) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted">No one has joined this class yet.</p>';
      modal({ title: 'Class attendance', subtitle: 'Only joined and left times are recorded.', body: body, wide: true, footer: '<button class="button button-primary" type="button" data-modal-close="1">Close</button>' });
    }).catch(function (error) { toast(apiError(error), 'error'); });
  }

  function openEndClass(classId) {
    var card = modal({
      title: 'Finish this class?',
      subtitle: 'Attendance stays saved. You can add a recording link if there is one.',
      body: '<form id="end-class-form" class="stack"><label class="field"><span>Recording link <em>(optional)</em></span><input name="recording_url" type="url" placeholder="https://…"></label><div class="form-message"></div></form>',
      footer: '<button class="button button-quiet" type="button" data-modal-close="1">Not yet</button><button class="button button-danger" type="submit" form="end-class-form">End class</button>',
      onMount: function (element) {
        element.querySelector('#end-class-form').addEventListener('submit', function (event) {
          event.preventDefault();
          var form = event.currentTarget;
          api('classes/end', { method: 'POST', body: { class_id: classId, recording_url: form.querySelector('[name="recording_url"]').value.trim() } }).then(function (result) {
            closeModal();
            toast(result.message, 'success');
            renderPage();
          }).catch(function (error) {
            var message = form.querySelector('.form-message');
            message.className = 'form-message form-error';
            message.textContent = apiError(error);
          });
        });
      }
    });
    return card;
  }

  /* ---------------------------------------------------------------------
   * Games
   * ------------------------------------------------------------------ */

  var GAME_META = {
    math: { title: 'Number pop', icon: 'star', body: 'Solve quick adding and taking-away puzzles before the timer runs out.', className: 'math' },
    memory: { title: 'Memory pairs', icon: 'sparkle', body: 'Flip the cards and find matching pairs. Train your remembering brain.', className: 'memory' },
    words: { title: 'Word detective', icon: 'book', body: 'Pick the missing word that finishes each friendly sentence.', className: 'words' },
    focus: { title: 'Focus lights', icon: 'sun', body: 'Watch the colours, then tap them back in the same order.', className: 'focus' }
  };

  var GAME_WORDS = [
    { sentence: 'The sun rises in the ___.', answer: 'morning', options: ['morning', 'bottle', 'purple', 'ladder'] },
    { sentence: 'A baby dog is called a ___.', answer: 'puppy', options: ['kitten', 'puppy', 'cub', 'calf'] },
    { sentence: 'We use a ___ to write on paper.', answer: 'pencil', options: ['spoon', 'pencil', 'cloud', 'basket'] },
    { sentence: 'Water turns into ice when it is ___.', answer: 'cold', options: ['loud', 'round', 'cold', 'tall'] },
    { sentence: 'The opposite of big is ___.', answer: 'small', options: ['wide', 'small', 'fast', 'green'] },
    { sentence: 'A group of stars is called a ___.', answer: 'galaxy', options: ['garden', 'galaxy', 'guitar', 'ginger'] },
    { sentence: 'We wear a ___ when it rains.', answer: 'raincoat', options: ['raincoat', 'sandwich', 'pillow', 'candle'] },
    { sentence: 'Three plus four equals ___.', answer: 'seven', options: ['six', 'eight', 'seven', 'five'] }
  ];

  var GAME_ICONS = ['star', 'heart', 'book', 'rocket', 'leaf', 'moon', 'sun', 'game'];

  function shuffle(list) {
    var copy = list.slice();
    for (var index = copy.length - 1; index > 0; index -= 1) {
      var swap = Math.floor(Math.random() * (index + 1));
      var temp = copy[index];
      copy[index] = copy[swap];
      copy[swap] = temp;
    }
    return copy;
  }

  function gameSchedule(state, fn, delay) {
    var id = setTimeout(function () {
      if (gameState === state) fn();
    }, delay);
    state.timers.push(id);
  }

  function gameFinish(game, score, startedAt) {
    var state = gameState;
    if (state) {
      state.timers.forEach(function (id) { clearTimeout(id); clearInterval(id); });
      state.timers = [];
    }
    var seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    api('games/score', { method: 'POST', body: { game: game, score: score, duration_seconds: seconds } }).then(function (result) {
      var meta = GAME_META[game];
      modal({
        title: 'Brain break finished!',
        subtitle: meta ? meta.title : 'Nice playing',
        body: '<div class="quiz-result">' + sticker(score > 0 ? 'trophy' : 'sparkle', 'yellow') +
          '<strong>' + esc(score) + '</strong><p class="muted">' + esc(result.message) + '</p>' +
          '<div class="row" style="justify-content:center"><span class="badge badge-blue">Best ' + esc(result.best) + '</span>' +
          '<span class="badge badge-purple">Rank ' + esc(result.rank) + '</span>' +
          (result.points_awarded ? '<span class="badge badge-yellow">+' + esc(result.points_awarded) + ' points</span>' : '') + '</div></div>',
        footer: '<button class="button button-quiet" type="button" data-game="' + esc(game) + '">Play again</button>' +
          '<button class="button button-primary" type="button" data-page="games">All games</button>'
      });
    }).catch(function (error) {
      toast(apiError(error), 'error');
    });
    gameState = null;
    navigate('games', {}, true);
  }

  RENDERERS.games = async function () {
    setPageUserIntro();
    var chosen = routeParams.game;
    if (chosen && GAME_META[chosen]) {
      renderGameStage(chosen);
      return;
    }
    var boards = await api('games/leaderboard', { query: { game: 'math' } }).catch(function () { return { leaders: [], my_best: 0 }; });
    var html = '<div class="page-head"><div><h1>Brain games</h1><p>Short, real games. Your best score is saved and new records earn points.</p></div></div>';
    html += '<div class="guide-strip">' + sticker('game', 'orange') + '<span>Games are a brain break, not a test. Play for five minutes, then go back to lessons.</span></div>';
    html += '<div class="game-grid">' + Object.keys(GAME_META).map(function (key) {
      var meta = GAME_META[key];
      return '<button class="game-card ' + meta.className + '" type="button" data-game="' + key + '">' + icon(meta.icon) +
        '<strong>' + esc(meta.title) + '</strong><span>' + esc(meta.body) + '</span></button>';
    }).join('') + '</div>';
    html += '<div class="grid grid-2" style="margin-top:20px"><section class="card"><div class="row-between"><h2 style="margin:0">Math leaderboard</h2>' +
      (boards.my_best ? '<span class="badge badge-yellow">Your best ' + esc(boards.my_best) + '</span>' : '') + '</div>';
    if (boards.leaders && boards.leaders.length) {
      html += '<div class="leaderboard" style="margin-top:10px">' + boards.leaders.map(function (leader, index) {
        var me = Number(leader.id) === Number(session.user.id);
        return '<div class="leader-row' + (me ? ' is-me' : '') + '"><span class="leader-rank">' + (index + 1) + '</span>' + avatarMarkup(leader, '') +
          '<div class="grow"><strong>' + esc(leader.name) + (me ? ' (you)' : '') + '</strong><span>Grade ' + esc(leader.grade) + '</span></div>' +
          '<span class="badge badge-purple">' + esc(leader.best) + '</span></div>';
      }).join('') + '</div>';
    } else {
      html += '<p class="muted small" style="margin-top:10px">No scores yet. Play Number pop to be the first on the board.</p>';
    }
    html += '</section><section class="card card-soft"><h2>How points work</h2><ul class="list-clean">' +
      '<li>' + icon('check') + '<span>Beat your own best score in any game to earn 10 points.</span></li>' +
      '<li>' + icon('check') + '<span>Scores are saved to your account, so a grown-up can celebrate with you.</span></li>' +
      '<li>' + icon('check') + '<span>Leaderboards only show first names and grades.</span></li></ul></section></div>';
    $('#page-content').innerHTML = html;
  };

  function renderGameStage(game) {
    var meta = GAME_META[game];
    var startedAt = Date.now();
    var html = '<button class="link-button" type="button" data-page="games">' + icon('arrow') + ' All games</button>' +
      '<div class="page-head"><div><span class="badge badge-purple">' + esc(meta.title) + '</span><h1>' + esc(meta.body) + '</h1></div></div>' +
      '<div class="card game-stage"><div class="game-hud"><span class="score" id="game-score">0</span>' +
      '<span class="badge badge-blue" id="game-status">Ready</span></div><div class="game-board" id="game-board"></div></div>';
    $('#page-content').innerHTML = html;
    if (game === 'math') startMathGame(startedAt);
    else if (game === 'memory') startMemoryGame(startedAt);
    else if (game === 'words') startWordGame(startedAt);
    else startFocusGame(startedAt);
  }

  function setGameScore(score) {
    var node = $('#game-score');
    if (node) node.textContent = String(score);
  }

  function setGameStatus(text, theme) {
    var node = $('#game-status');
    if (node) { node.textContent = text; node.className = 'badge ' + (theme || 'badge-blue'); }
  }

  function startMathGame(startedAt) {
    var state = { timers: [], score: 0, round: 0 };
    var total = 10;
    gameState = state;
    function nextRound() {
      if (gameState !== state) return;
      if (state.round >= total) { gameFinish('math', state.score, startedAt); return; }
      state.round += 1;
      setGameStatus('Question ' + state.round + ' of ' + total, 'badge-purple');
      var a = 1 + Math.floor(Math.random() * 20);
      var b = 1 + Math.floor(Math.random() * 15);
      var plus = Math.random() > 0.35 || a - b < 0;
      var answer = plus ? a + b : a - b;
      var options = [answer];
      while (options.length < 4) {
        var candidate = answer + (Math.floor(Math.random() * 13) - 6);
        if (candidate !== answer && candidate >= 0 && options.indexOf(candidate) === -1) options.push(candidate);
      }
      options = shuffle(options);
      var board = $('#game-board');
      board.innerHTML = '<div class="math-question">' + a + (plus ? ' + ' : ' − ') + b + ' = ?</div>' +
        '<div class="math-answers">' + options.map(function (value) {
          return '<button class="math-answer" type="button" data-math-answer="' + value + '">' + value + '</button>';
        }).join('') + '</div>';
      $$('[data-math-answer]', board).forEach(function (button) {
        button.addEventListener('click', function () {
          if (gameState !== state) return;
          var picked = Number(button.getAttribute('data-math-answer'));
          if (picked === answer) {
            state.score += 10;
            setGameScore(state.score);
            button.classList.add('is-right');
          } else {
            button.classList.add('is-wrong');
            var right = $('[data-math-answer="' + answer + '"]', board);
            if (right) right.classList.add('is-right');
          }
          $$('[data-math-answer]', board).forEach(function (item) { item.disabled = true; });
          gameSchedule(state, nextRound, 700);
        });
      });
    }
    nextRound();
  }

  function startMemoryGame(startedAt) {
    var state = { timers: [], score: 0, open: [], matched: 0 };
    gameState = state;
    var deck = shuffle(GAME_ICONS.concat(GAME_ICONS));
    var board = $('#game-board');
    board.innerHTML = '<div class="memory-grid">' + deck.map(function (iconName, index) {
      return '<button class="memory-tile is-hidden-card" type="button" data-memory="' + index + '" data-icon="' + iconName + '" aria-label="Card ' + (index + 1) + '">' + icon(iconName) + '</button>';
    }).join('') + '</div>';
    setGameStatus('Find all 8 pairs', 'badge-purple');
    $$('[data-memory]', board).forEach(function (tile) {
      tile.addEventListener('click', function () {
        if (gameState !== state || state.open.length >= 2 || tile.classList.contains('is-matched') || tile.classList.contains('is-open')) return;
        tile.classList.remove('is-hidden-card');
        tile.classList.add('is-open');
        state.open.push(tile);
        if (state.open.length < 2) return;
        var first = state.open[0];
        var second = state.open[1];
        var same = first.getAttribute('data-icon') === second.getAttribute('data-icon');
        gameSchedule(state, function () {
          if (same) {
            first.classList.add('is-matched');
            second.classList.add('is-matched');
            state.matched += 1;
            state.score += 10;
            setGameScore(state.score);
            setGameStatus(state.matched + ' of 8 pairs', 'badge-mint');
          } else {
            [first, second].forEach(function (tileBack) {
              tileBack.classList.remove('is-open');
              tileBack.classList.add('is-hidden-card');
            });
          }
          state.open = [];
          if (state.matched === 8) gameFinish('memory', state.score, startedAt);
        }, same ? 320 : 720);
      });
    });
  }

  function startWordGame(startedAt) {
    var state = { timers: [], score: 0, round: 0 };
    var rounds = shuffle(GAME_WORDS).slice(0, 8);
    gameState = state;
    function nextRound() {
      if (gameState !== state) return;
      if (state.round >= rounds.length) { gameFinish('words', state.score, startedAt); return; }
      var item = rounds[state.round];
      state.round += 1;
      setGameStatus('Sentence ' + state.round + ' of ' + rounds.length, 'badge-purple');
      var board = $('#game-board');
      board.innerHTML = '<div class="word-stage"><p class="muted">Pick the word that fits</p>' +
        '<div class="word-target">' + esc(item.sentence).replace('___', '<span style="color:var(--purple)">___</span>') + '</div>' +
        '<div class="word-options">' + item.options.map(function (option) {
          return '<button class="button button-quiet" type="button" data-word="' + esc(option) + '">' + esc(option) + '</button>';
        }).join('') + '</div></div>';
      $$('[data-word]', board).forEach(function (button) {
        button.addEventListener('click', function () {
          if (gameState !== state) return;
          $$('[data-word]', board).forEach(function (item2) { item2.disabled = true; });
          if (button.getAttribute('data-word') === item.answer) {
            state.score += 10;
            setGameScore(state.score);
            button.className = 'button button-primary';
          } else {
            button.className = 'button button-danger';
            $$('[data-word]', board).forEach(function (item2) {
              if (item2.getAttribute('data-word') === item.answer) item2.className = 'button button-primary';
            });
          }
          gameSchedule(state, nextRound, 900);
        });
      });
    }
    nextRound();
  }

  function startFocusGame(startedAt) {
    var state = { timers: [], score: 0, sequence: [], step: 0, playing: false, accepting: false };
    gameState = state;
    var colors = ['green', 'red', 'yellow', 'blue'];
    var board = $('#game-board');
    board.innerHTML = '<div class="simon-grid">' + colors.map(function (color) {
      return '<button class="simon-btn ' + color + '" type="button" data-simon="' + color + '" aria-label="' + color + ' light"></button>';
    }).join('') + '</div><p class="center muted small" style="margin-top:14px" id="simon-hint">Watch the lights, then copy them.</p>';
    function flash(color, duration) {
      var node = $('[data-simon="' + color + '"]');
      if (!node) return;
      node.classList.add('is-lit');
      gameSchedule(state, function () { node.classList.remove('is-lit'); }, duration || 380);
    }
    function showSequence() {
      if (gameState !== state) return;
      state.accepting = false;
      state.playing = true;
      setGameStatus('Watch closely', 'badge-blue');
      state.sequence.forEach(function (color, index) {
        gameSchedule(state, function () { flash(color, 400); }, 600 * index + 300);
      });
      gameSchedule(state, function () {
        state.playing = false;
        state.accepting = true;
        state.step = 0;
        setGameStatus('Your turn', 'badge-mint');
        var hint = $('#simon-hint');
        if (hint) hint.textContent = 'Now tap the same colours in order.';
      }, 600 * state.sequence.length + 400);
    }
    function addRound() {
      state.sequence.push(colors[Math.floor(Math.random() * colors.length)]);
      showSequence();
    }
    $$('[data-simon]', board).forEach(function (button) {
      button.addEventListener('click', function () {
        if (gameState !== state || !state.accepting) return;
        var color = button.getAttribute('data-simon');
        button.classList.add('is-lit');
        gameSchedule(state, function () { button.classList.remove('is-lit'); }, 180);
        if (state.sequence[state.step] !== color) {
          state.accepting = false;
          gameFinish('focus', state.score, startedAt);
          return;
        }
        state.step += 1;
        if (state.step === state.sequence.length) {
          state.accepting = false;
          state.score += 10;
          setGameScore(state.score);
          setGameStatus('Level ' + state.score / 10 + ' complete', 'badge-yellow');
          gameSchedule(state, addRound, 800);
        }
      });
    });
    addRound();
  }

  /* ---------------------------------------------------------------------
   * Rewards
   * ------------------------------------------------------------------ */

  RENDERERS.rewards = async function () {
    setPageUserIntro();
    var results = await Promise.all([api('badges'), api('progress'), api('games/leaderboard', { query: { game: 'math' } }).catch(function () { return { leaders: [] }; })]);
    var badges = results[0].badges || [];
    var progress = results[1] || {};
    var leaders = results[2].leaders || [];
    var earned = badges.filter(function (badge) { return badge.awarded_at; });
    var html = '<div class="page-head"><div><h1>Rewards</h1><p>Points and stickers are a record of the effort you put in.</p></div></div>';
    html += '<section class="card reward-hero"><div><span class="badge badge-yellow">Learning points</span>' +
      '<div class="reward-points">' + esc(progress.points || 0) + '</div>' +
      '<p class="muted" style="margin:4px 0 0">' + plural(Number(progress.streak) || 0, 'day') + ' in a row · ' + earned.length + ' of ' + badges.length + ' stickers earned</p></div>' +
      sticker('trophy', 'yellow') + '</section>';
    html += '<div class="section-head"><h2>Sticker book</h2><span class="badge badge-purple">' + earned.length + ' earned</span></div>';
    html += '<div class="badge-grid">' + badges.map(function (badge) {
      return '<article class="badge-card' + (badge.awarded_at ? '' : ' is-locked') + '">' + sticker(badge.icon, badge.theme) +
        '<strong>' + esc(badge.title) + '</strong><span>' + esc(badge.description) + '</span>' +
        (badge.awarded_at ? '<span class="badge badge-mint">' + esc(formatDate(badge.awarded_at)) + '</span>' : '<span class="badge badge-blue">Locked</span>') + '</article>';
    }).join('') + '</div>';
    if (leaders.length) {
      html += '<div class="grid grid-2" style="margin-top:20px"><section class="card"><h2>Math leaders</h2><div class="leaderboard" style="margin-top:10px">' + leaders.map(function (leader, index) {
        return '<div class="leader-row"><span class="leader-rank">' + (index + 1) + '</span>' + avatarMarkup(leader, '') +
          '<div class="grow"><strong>' + esc(leader.name) + '</strong><span>Grade ' + esc(leader.grade) + '</span></div><span class="badge badge-purple">' + esc(leader.best) + '</span></div>';
      }).join('') + '</div></section>';
      html += '<section class="card card-soft"><h2>Ways to earn</h2><ul class="list-clean">' +
        '<li>' + icon('check') + '<span>Finish a lesson check to earn lesson points and a sticker.</span></li>' +
        '<li>' + icon('check') + '<span>Answer assignment questions correctly the first time.</span></li>' +
        '<li>' + icon('check') + '<span>Beat your best score in a brain game.</span></li></ul></section></div>';
    }
    $('#page-content').innerHTML = html;
  };

  /* ---------------------------------------------------------------------
   * Progress
   * ------------------------------------------------------------------ */

  RENDERERS.progress = async function () {
    setPageUserIntro();
    var role = session.user.role;
    var children = [];
    var childId = Number(routeParams.student_id) || 0;
    if (role === 'parent') {
      children = await parentLinks();
      if (!children.length) {
        $('#page-content').innerHTML = emptyState('family', 'Link a child first', 'Progress reports appear after a child is linked.', '<a class="button button-primary button-small" href="#/family">Open Family</a>');
        return;
      }
      if (!childId) childId = Number(children[0].id);
    }
    var data = await api('progress', { query: childId ? { student_id: childId } : {} });
    var lessons = data.lessons || [];
    var activity = data.activity || [];
    var completed = lessons.filter(function (lesson) { return lesson.status === 'completed'; });
    var average = completed.length ? Math.round(completed.reduce(function (sum, lesson) { return sum + Number(lesson.score || 0); }, 0) / completed.length) : 0;
    var html = '<div class="page-head"><div><h1>Learning progress</h1><p>A calm view of finished lessons and recent activity.</p></div></div>';
    if (role === 'parent') html += childPicker(children, childId, 'progress');
    html += '<div class="stat-grid">' +
      statCard('star', data.points || 0, 'Points', 'yellow') +
      statCard('rocket', data.streak || 0, 'Day streak', 'orange') +
      statCard('book', completed.length, 'Lessons finished', 'mint') +
      statCard('chart', average + '%', 'Average score', 'blue') + '</div>';
    html += '<div class="grid grid-2" style="margin-top:16px"><section class="card"><h2>Finished lessons</h2>';
    if (completed.length) {
      html += '<div style="margin-top:10px">' + completed.map(function (lesson) {
        var score = Math.max(0, Math.min(100, Number(lesson.score) || 0));
        return '<div style="margin-bottom:12px"><div class="row-between"><strong class="small">' + esc(lesson.title) + '</strong><span class="badge badge-purple">' + score + '%</span></div>' +
          '<div style="height:9px;background:var(--bg);border-radius:999px;margin-top:5px;overflow:hidden"><span style="display:block;height:100%;width:' + score + '%;background:linear-gradient(90deg,var(--purple),#8b6cff)"></span></div>' +
          '<span class="muted" style="font-size:.72rem">' + esc(lesson.subject) + ' · ' + esc(formatDate(lesson.completed_at)) + '</span></div>';
      }).join('') + '</div>';
    } else {
      html += '<p class="muted small" style="margin-top:10px">Finish a lesson to see your score here.</p>';
    }
    html += '</section><section class="card"><h2>Recent activity</h2>';
    if (activity.length) {
      html += activity.slice(0, 12).map(function (item) {
        return '<div class="activity-row"><span class="sticker sticker-mint">' + icon(activityIcon(item.activity_type)) + '</span>' +
          '<div class="grow"><strong>' + esc(item.detail || activityLabel(item.activity_type)) + '</strong><span>' + esc(timeAgo(item.created_at)) + '</span></div>' +
          (Number(item.points) ? '<span class="badge badge-yellow">+' + esc(item.points) + '</span>' : '') + '</div>';
      }).join('');
    } else {
      html += '<p class="muted small" style="margin-top:10px">Learning activity will show up here.</p>';
    }
    html += '</section></div>';
    $('#page-content').innerHTML = html;
  };

  /* ---------------------------------------------------------------------
   * Messages
   * ------------------------------------------------------------------ */

  var messagePoll = null;

  function conversationTitle(conversation) {
    if (conversation.title) return conversation.title;
    return 'Conversation';
  }

  RENDERERS.messages = async function () {
    setPageUserIntro();
    var data = await api('conversations');
    var conversations = data.conversations || [];
    var html = '<div class="page-head"><div><h1>Messages</h1><p>Talk with your tutors, parents, or school helpers.</p></div>' +
      '<button class="button button-primary" type="button" data-new-conversation="1">' + icon('plus') + ' New message</button></div>';
    html += '<div class="guide-strip">' + sticker('shield', 'mint') + '<span>Messages stay inside BrightPath. Never share personal details or your password.</span></div>';
    if (!conversations.length) {
      html += emptyState('message', 'No messages yet', 'Start a conversation with someone in your school, family, or tutoring group.', '<button class="button button-primary button-small" type="button" data-new-conversation="1">New message</button>');
      $('#page-content').innerHTML = html;
      return;
    }
    html += '<div class="messages-layout"><div class="conversation-list" id="conversation-list">' + conversations.map(function (conversation) {
      return '<button class="conversation-item" type="button" data-conversation="' + Number(conversation.id) + '">' +
        avatarMarkup((conversation.members || []).filter(function (member) { return Number(member.id) !== Number(session.user.id); })[0] || { name: conversationTitle(conversation) }, '') +
        '<span class="grow"><strong>' + esc(conversationTitle(conversation)) + '</strong><span>' + esc(conversation.last_message || 'No messages yet') + '</span></span>' +
        (Number(conversation.unread) ? '<span class="unread-pill">' + Number(conversation.unread) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    html += '<section class="chat-pane"><div class="chat-head" id="chat-head"><strong>Choose a conversation</strong></div>' +
      '<div class="chat-messages" id="chat-messages"><div class="chat-empty">' + icon('message') + '<span>Pick a person on the left.</span></div></div>' +
      '<form class="chat-form" id="chat-form"><input id="chat-input" maxlength="2000" placeholder="Write a message" autocomplete="off" disabled>' +
      '<button class="icon-button send" type="submit" aria-label="Send" disabled>' + icon('send') + '</button></form></section></div>';
    $('#page-content').innerHTML = html;

    var activeId = Number(routeParams.c) || Number(conversations[0].id);
    selectConversation(activeId);

    var form = $('#chat-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = $('#chat-input');
      var text = input.value.trim();
      if (!text || !currentConversation) return;
      input.value = '';
      api('messages', { method: 'POST', body: { conversation_id: currentConversation, body: text } }).then(function () {
        loadMessages(currentConversation);
      }).catch(function (error) { toast(apiError(error), 'error'); });
    });
  };

  function selectConversation(conversationId) {
    currentConversation = conversationId;
    $$('.conversation-item').forEach(function (item) {
      item.classList.toggle('is-active', Number(item.getAttribute('data-conversation')) === Number(conversationId));
    });
    var head = $('#chat-head');
    var item = $('[data-conversation="' + conversationId + '"]');
    if (head && item) head.innerHTML = '<strong>' + esc(item.querySelector('strong').textContent) + '</strong>';
    var input = $('#chat-input');
    var send = $('#chat-form button');
    if (input) { input.disabled = false; input.focus(); }
    if (send) send.disabled = false;
    var dot = item ? item.querySelector('.unread-pill') : null;
    if (dot) dot.remove();
    history.replaceState(null, '', '#/messages?c=' + conversationId);
    loadMessages(conversationId);
    if (messagePoll) clearInterval(messagePoll);
    messagePoll = setInterval(function () {
      if (document.hidden || currentPage !== 'messages') return;
      loadMessages(conversationId, true);
    }, 9000);
    pageCleanup = function () { if (messagePoll) { clearInterval(messagePoll); messagePoll = null; } };
  }

  function loadMessages(conversationId, quiet) {
    api('messages', { query: { conversation_id: conversationId } }).then(function (data) {
      if (currentPage !== 'messages') return;
      var list = $('#chat-messages');
      if (!list) return;
      var messages = data.messages || [];
      if (!messages.length) {
        list.innerHTML = '<div class="chat-empty">' + icon('message') + '<span>Say hello to start the conversation.</span></div>';
        return;
      }
      list.innerHTML = messages.map(function (message) {
        var mine = Number(message.sender_id) === Number(session.user.id);
        return '<div class="chat-bubble' + (mine ? ' is-mine' : '') + '">' +
          (mine ? '' : '<strong class="small">' + esc(message.sender_name) + '</strong>') +
          '<div>' + esc(message.body) + '</div><small>' + esc(timeAgo(message.created_at)) + '</small></div>';
      }).join('');
      list.scrollTop = list.scrollHeight;
    }).catch(function (error) {
      if (!quiet) toast(apiError(error), 'error');
    });
  }

  function openNewConversation() {
    api('contacts').then(function (data) {
      var contacts = data.contacts || [];
      var card = modal({
        title: 'New message',
        subtitle: 'Choose someone from your school, family, or tutoring group.',
        body: '<form id="new-conversation-form" class="stack">' +
          (contacts.length ? '<div class="stack">' + contacts.map(function (contact) {
            return '<label class="quiz-option" style="cursor:pointer"><input type="radio" name="contact" value="' + Number(contact.id) + '" required>' +
              '<span class="letter">' + esc(initials(contact.name)) + '</span><span class="grow"><strong>' + esc(contact.name) + '</strong><br><span class="muted small">' + esc(roleLabel(contact.role)) + (contact.grade ? ' · Grade ' + esc(contact.grade) : '') + '</span></span></label>';
          }).join('') + '</div>' : '<p class="muted">No contacts yet. Ask your school to connect you with a tutor or parent.</p>') +
          '<div class="form-message"></div></form>',
        footer: '<button class="button button-quiet" type="button" data-modal-close="1">Cancel</button>' +
          (contacts.length ? '<button class="button button-primary" type="submit" form="new-conversation-form">Start message</button>' : ''),
        onMount: function (element) {
          var form = element.querySelector('#new-conversation-form');
          form.addEventListener('submit', function (event) {
            event.preventDefault();
            var picked = form.querySelector('input[name="contact"]:checked');
            if (!picked) return;
            api('conversations', { method: 'POST', body: { user_id: Number(picked.value) } }).then(function (result) {
              closeModal();
              selectConversation(Number(result.conversation_id));
            }).catch(function (error) {
              var message = form.querySelector('.form-message');
              message.className = 'form-message form-error';
              message.textContent = apiError(error);
            });
          });
        }
      });
      return card;
    }).catch(function (error) { toast(apiError(error), 'error'); });
  }

  /* ---------------------------------------------------------------------
   * Family
   * ------------------------------------------------------------------ */

  RENDERERS.family = async function () {
    setPageUserIntro();
    var role = session.user.role;
    var data = await api('parent/links');
    var links = data.links || [];
    var active = links.filter(function (link) { return link.status === 'active'; });
    var pending = links.filter(function (link) { return link.status === 'pending'; });
    var html = '<div class="page-head"><div><h1>Family</h1><p>' +
      (role === 'student' ? 'Your family code lets a grown-up see how you are doing. Only share it with someone you trust.' : 'Link your children so you can follow their learning and celebrate wins.') + '</p></div></div>';
    if (role === 'student') {
      html += '<section class="family-code"><small>Your family code</small><strong id="family-code-value">' + esc(data.family_code || '—') + '</strong>' +
        '<p>Give this code to a parent or guardian. They can use it once to join your family space.</p>' +
        '<button class="button button-quiet button-small" type="button" id="copy-family-code" style="margin:10px auto 0">' + icon('copy') + ' Copy code</button></section>';
    }
    if (pending.length) {
      html += '<div class="section-head"><h2>Waiting for a reply</h2></div>';
      html += pending.map(function (link) {
        var other = role === 'student' ? link.parent_name : link.student_name;
        return '<article class="card child-card" style="margin-bottom:10px">' + avatarMarkup({ name: other, avatar: role === 'student' ? link.parent_avatar : link.student_avatar }, '') +
          '<div class="grow"><strong>' + esc(other) + '</strong><span>' + (link.can_respond ? 'Wants to link family accounts' : 'You sent a request') + '</span></div>' +
          (link.can_respond ? '<button class="button button-primary button-small" type="button" data-link-accept="' + Number(link.id) + '">Approve</button>' +
            '<button class="button button-quiet button-small" type="button" data-link-decline="' + Number(link.id) + '">Not now</button>' :
            '<button class="button button-quiet button-small" type="button" data-link-revoke="' + Number(link.id) + '">Cancel</button>') + '</article>';
      }).join('');
    }
    html += '<div class="section-head"><h2>' + (role === 'student' ? 'Your grown-ups' : 'Your children') + '</h2></div>';
    if (!active.length) {
      html += emptyState('family', role === 'student' ? 'No family linked yet' : 'No children linked yet',
        role === 'student' ? 'Share your code above, or send an invite to a parent email.' : 'Use a family code from your child, or send an invite to their email.');
    } else {
      html += '<div class="grid grid-2">' + active.map(function (link) {
        var person = role === 'student'
          ? { id: link.parent_id, name: link.parent_name, avatar: link.parent_avatar, grade: null }
          : { id: link.student_id, name: link.student_name, avatar: link.student_avatar, grade: link.student_grade };
        return '<article class="card child-card">' + avatarMarkup(person, 'avatar-lg') +
          '<div class="grow"><strong>' + esc(person.name) + '</strong><span>' + (person.grade ? 'Grade ' + esc(person.grade) : roleLabel('parent')) + '</span>' +
          (role === 'parent' ? '<div class="mini-stats"><span class="mini-stat"><b>' + esc(link.points || 0) + '</b><small>Points</small></span>' +
            '<span class="mini-stat"><b>' + esc(link.streak || 0) + '</b><small>Streak</small></span>' +
            '<span class="mini-stat"><b>' + esc(link.lessons_completed || 0) + '</b><small>Lessons</small></span></div>' : '') + '</div>' +
          '<div class="row">' +
          (role === 'parent' ? '<button class="button button-quiet button-small" type="button" data-child-page="progress" data-child="' + Number(person.id) + '">Progress</button>' : '') +
          '<button class="button button-quiet button-small" type="button" data-message-user="' + Number(person.id) + '">' + icon('message') + '</button>' +
          '<button class="button button-quiet button-small" type="button" data-link-revoke="' + Number(link.id) + '" aria-label="Unlink">' + icon('close') + '</button></div></article>';
      }).join('') + '</div>';
    }
    html += '<div class="grid grid-2" style="margin-top:18px"><section class="card"><h2>' + (role === 'student' ? 'Invite a parent by email' : 'Link a child by email') + '</h2>' +
      '<form id="family-invite-form" class="stack" style="margin-top:10px"><label class="field"><span>Email address</span>' +
      '<input name="email" type="email" placeholder="' + (role === 'student' ? 'parent@example.com' : 'child@example.com') + '" required></label>' +
      '<div class="form-message"></div><button class="button button-primary" type="submit">' + icon('send') + ' Send family request</button></form></section>' +
      '<section class="card card-soft"><h2>Family safety</h2><ul class="list-clean">' +
      '<li>' + icon('shield') + '<span>Parents can see progress and school work, but never your password.</span></li>' +
      '<li>' + icon('shield') + '<span>You can unlink an account at any time. Ask a school administrator if you need help.</span></li>' +
      '<li>' + icon('shield') + '<span>A family code is private. Do not post it in a message or on a website.</span></li></ul></section></div>';
    $('#page-content').innerHTML = html;
    var copy = $('#copy-family-code');
    if (copy) copy.addEventListener('click', function () {
      var code = data.family_code || '';
      if (navigator.clipboard && code) {
        navigator.clipboard.writeText(code).then(function () { toast('Family code copied.', 'success'); }).catch(function () { toast('Copy failed. Write the code down instead.', 'error'); });
      } else {
        toast('Family code: ' + code);
      }
    });
    var form = $('#family-invite-form');
    if (form) form.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = form.querySelector('[name="email"]').value.trim();
      api('parent/link', { method: 'POST', body: { email: email } }).then(function (result) {
        toast(result.message, 'success');
        renderPage();
      }).catch(function (error) {
        var message = form.querySelector('.form-message');
        message.className = 'form-message form-error';
        message.textContent = apiError(error);
      });
    });
  };

  function respondToLink(linkId, action) {
    api('parent/respond', { method: 'POST', body: { link_id: linkId, action: action } }).then(function (result) {
      toast(result.message, 'success');
      renderPage();
    }).catch(function (error) { toast(apiError(error), 'error'); });
  }

  /* ---------------------------------------------------------------------
   * Tutor pages
   * ------------------------------------------------------------------ */

  RENDERERS.students = async function () {
    setPageUserIntro();
    var data = await api('tutor/students');
    var students = (data.students || []).filter(function (student) { return student.status === 'active'; });
    var html = '<div class="page-head"><div><h1>My students</h1><p>Everyone in your tutoring group. Add a student by their account email.</p></div>' +
      '<button class="button button-primary" type="button" data-add-student="1">' + icon('plus') + ' Add student</button></div>';
    html += '<div class="guide-strip">' + sticker('users', 'purple') + '<span>Only add learners you are actually teaching. Their parents can see the connection.</span></div>';
    if (!students.length) {
      html += emptyState('users', 'No students yet', 'Add a student by email. They must already have a BrightPath student account.', '<button class="button button-primary button-small" type="button" data-add-student="1">Add your first student</button>');
    } else {
      html += '<div class="table-wrap"><table class="data-table"><thead><tr><th>Learner</th><th>Grade</th><th>Points</th><th>Streak</th><th></th></tr></thead><tbody>' +
        students.map(function (student) {
          return '<tr><td><div class="table-person">' + avatarMarkup(student, '') + '<div><strong>' + esc(student.name) + '</strong><span>' + esc(student.email) + '</span></div></div></td>' +
            '<td>Grade ' + esc(student.grade) + '</td><td>' + esc(student.points || 0) + '</td><td>' + esc(student.streak || 0) + ' days</td>' +
            '<td><div class="row"><button class="button button-quiet button-small" type="button" data-child-page="progress" data-child="' + Number(student.id) + '">Progress</button>' +
            '<button class="button button-quiet button-small" type="button" data-message-user="' + Number(student.id) + '">' + icon('message') + '</button>' +
            '<button class="button button-quiet button-small" type="button" data-remove-student="' + Number(student.id) + '" data-student-name="' + esc(student.name) + '">' + icon('trash') + '</button></div></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    $('#page-content').innerHTML = html;
  };

  function addStudentModal() {
    modal({
      title: 'Add a student',
      subtitle: 'Use the email address on their BrightPath student account.',
      body: '<form id="add-student-form" class="stack"><label class="field"><span>Student email</span>' +
        '<input name="email" type="email" required placeholder="student@example.com"></label><div class="form-message"></div></form>',
      footer: '<button class="button button-quiet" type="button" data-modal-close="1">Cancel</button>' +
        '<button class="button button-primary" type="submit" form="add-student-form">Add student</button>',
      onMount: function (element) {
        element.querySelector('#add-student-form').addEventListener('submit', function (event) {
          event.preventDefault();
          var form = event.currentTarget;
          api('tutor/students', { method: 'POST', body: { email: form.querySelector('[name="email"]').value.trim() } }).then(function (result) {
            closeModal();
            toast(result.message, 'success');
            renderPage();
          }).catch(function (error) {
            var message = form.querySelector('.form-message');
            message.className = 'form-message form-error';
            message.textContent = apiError(error);
          });
        });
      }
    });
  }

  RENDERERS.reviews = async function () {
    setPageUserIntro();
    var data = await api('submissions');
    var submissions = data.submissions || [];
    var waiting = submissions.filter(function (item) { return item.submission_type === 'answer' ? !item.reviewed_at : item.status === 'submitted'; });
    var done = submissions.filter(function (item) { return waiting.indexOf(item) === -1; });
    var html = '<div class="page-head"><div><h1>Review work</h1><p>Read what learners sent, add a friendly note, and give a score when you are ready.</p></div></div>';
    html += '<div class="stat-grid">' + statCard('clock', waiting.length, 'Waiting for review', 'orange') + statCard('check', done.length, 'Already reviewed', 'mint') + '</div>';
    html += '<div class="section-head"><h2>Waiting for you</h2></div>';
    if (!waiting.length) {
      html += emptyState('check', 'All caught up', 'New student work will appear here as soon as it is sent.');
    } else {
      html += '<div class="grid grid-2">' + waiting.map(function (item) { return reviewCard(item, true); }).join('') + '</div>';
    }
    if (done.length) {
      html += '<div class="section-head"><h2>Recently reviewed</h2></div><div class="grid grid-2">' + done.slice(0, 8).map(function (item) { return reviewCard(item, false); }).join('') + '</div>';
    }
    $('#page-content').innerHTML = html;
  };

  function reviewCard(item, waiting) {
    var isFile = item.submission_type === 'file';
    var detail = isFile
      ? '<div class="feedback-box"><strong>' + esc(item.original_filename) + '</strong>' + esc(fileSize(item.file_size)) + (item.notes ? ' · ' + esc(item.notes) : '') + '</div>'
      : '<div class="feedback-box"><strong>Answer</strong>' +
        (item.answer_text ? esc(item.answer_text) : (item.choices && item.choices[item.selected_choice] ? esc(item.choices[item.selected_choice]) : 'No answer text')) +
        (item.is_correct !== null && item.is_correct !== undefined ? ' · ' + (Number(item.is_correct) === 1 ? 'Correct' : 'Needs practice') : '') + '</div>';
    return '<article class="card assignment-card"><div class="assignment-top">' + sticker(isFile ? 'download' : 'pencil', 'blue') +
      '<div class="grow"><h3>' + esc(item.title) + '</h3><p>' + esc(item.student_name) + ' · Grade ' + esc(item.grade) + ' · ' + esc(timeAgo(item.submitted_at)) + '</p></div></div>' +
      detail + '<div class="assignment-actions">' +
      (isFile ? '<button class="button button-quiet button-small" type="button" data-download-submission="' + Number(item.id) + '">' + icon('download') + ' Open file</button>' : '') +
      '<button class="button ' + (waiting ? 'button-primary' : 'button-quiet') + ' button-small" type="button" data-review="' + esc(item.submission_type) + ':' + Number(item.id) + '">' +
      (waiting ? 'Review and score' : 'Edit feedback') + '</button></div></article>';
  }

  function openReviewModal(type, id) {
    modal({
      title: 'Review this work',
      subtitle: 'A short, kind note helps more than a score.',
      body: '<form id="review-form" class="stack"><div class="form-grid"><label class="field"><span>Score (0–100)</span>' +
        '<input name="grade" type="number" min="0" max="100" placeholder="Optional"></label>' +
        '<label class="field"><span>Feedback</span><input name="feedback" maxlength="2000" placeholder="What went well?"></label></div>' +
        '<div class="form-message"></div></form>',
      footer: '<button class="button button-quiet" type="button" data-modal-close="1">Cancel</button>' +
        '<button class="button button-primary" type="submit" form="review-form">Save review</button>',
      onMount: function (element) {
        element.querySelector('#review-form').addEventListener('submit', function (event) {
          event.preventDefault();
          var form = event.currentTarget;
          var score = form.querySelector('[name="grade"]').value;
          api('submissions/review', {
            method: 'POST',
            body: {
              submission_type: type,
              id: id,
              grade: score === '' ? null : Number(score),
              feedback: form.querySelector('[name="feedback"]').value.trim()
            }
          }).then(function (result) {
            closeModal();
            toast(result.message, 'success');
            renderPage();
          }).catch(function (error) {
            var message = form.querySelector('.form-message');
            message.className = 'form-message form-error';
            message.textContent = apiError(error);
          });
        });
      }
    });
  }

  /* ---------------------------------------------------------------------
   * School administration
   * ------------------------------------------------------------------ */

  var peopleFilters = { search: '', role: '' };

  RENDERERS.users = async function () {
    setPageUserIntro();
    var data = await api('admin/users', { query: { search: peopleFilters.search, role: peopleFilters.role } });
    var users = data.users || [];
    var pendingTutors = users.filter(function (user) { return user.role === 'tutor' && !Number(user.active); });
    var html = '<div class="page-head"><div><h1>People</h1><p>Accounts in your school. Tutor accounts must be approved before first sign-in.</p></div>' +
      '<button class="button button-primary" type="button" data-new-user="1">' + icon('plus') + ' Add account</button></div>';
    if (pendingTutors.length) {
      html += '<div class="notice notice-warm">' + icon('clock') + '<span>' + pendingTutors.length + ' tutor account' + (pendingTutors.length === 1 ? '' : 's') + ' waiting for approval. Use Approve in the list below.</span></div>';
    }
    html += '<div class="toolbar"><form class="field" id="people-search" style="display:flex;gap:8px"><input name="search" type="search" placeholder="Search name or email" value="' + esc(peopleFilters.search) + '" style="flex:1">' +
      '<button class="button button-quiet button-small" type="submit">' + icon('search') + ' Search</button></form>' +
      '<div class="filter-chips">' + ['', 'student', 'parent', 'tutor', 'school_admin', 'admin'].map(function (role) {
        return '<button class="chip' + (peopleFilters.role === role ? ' is-active' : '') + '" type="button" data-role-filter="' + role + '">' + (role ? roleLabel(role) : 'Everyone') + '</button>';
      }).join('') + '</div></div>';
    if (!users.length) {
      html += emptyState('users', 'No accounts found', 'Try a different search or add a new account.');
    } else {
      html += '<div class="table-wrap"><table class="data-table"><thead><tr><th>Person</th><th>Type</th><th>Grade</th><th>Status</th><th></th></tr></thead><tbody>' + users.map(function (user) {
        var active = Number(user.active) === 1;
        return '<tr><td><div class="table-person">' + avatarMarkup(user, '') + '<div><strong>' + esc(user.name) + '</strong><span>' + esc(user.email) + '</span></div></div></td>' +
          '<td>' + esc(roleLabel(user.role)) + '</td><td>' + (user.grade ? 'Grade ' + esc(user.grade) : '—') + '</td>' +
          '<td><span class="badge ' + (active ? 'badge-mint' : 'badge-orange') + '">' + (active ? 'Active' : (user.role === 'tutor' ? 'Needs approval' : 'Paused')) + '</span></td>' +
          '<td><div class="row">' +
          (!active ? '<button class="button button-primary button-small" type="button" data-approve-user="' + Number(user.id) + '">Approve</button>' : '') +
          '<button class="button button-quiet button-small" type="button" data-edit-user="' + Number(user.id) + '">' + icon('edit') + '</button>' +
          '<button class="button button-quiet button-small" type="button" data-reset-user="' + Number(user.id) + '" data-user-name="' + esc(user.name) + '">' + icon('lock') + '</button></div></td></tr>';
      }).join('') + '</tbody></table></div>';
    }
    $('#page-content').innerHTML = html;
    var search = $('#people-search');
    if (search) search.addEventListener('submit', function (event) {
      event.preventDefault();
      peopleFilters.search = search.querySelector('[name="search"]').value.trim();
      renderPage();
    });
  };

  function openUserModal(user) {
    var editing = !!user;
    var role = editing ? user.role : 'student';
    modal({
      title: editing ? 'Edit account' : 'Add an account',
      subtitle: editing ? 'Change the name, type, grade, or pause the account.' : 'A temporary password is created if you leave the password blank.',
      body: '<form id="user-form" class="stack">' +
        '<label class="field"><span>Name</span><input name="name" required maxlength="120" value="' + esc(editing ? user.name : '') + '"></label>' +
        (!editing ? '<label class="field"><span>Email</span><input name="email" type="email" required></label>' : '') +
        '<div class="form-grid"><label class="field"><span>Account type</span><select name="role">' +
        ['student', 'parent', 'tutor'].concat(session.user.role === 'admin' ? ['school_admin'] : []).map(function (item) {
          return '<option value="' + item + '"' + (role === item ? ' selected' : '') + '>' + roleLabel(item) + '</option>';
        }).join('') + '</select></label>' +
        '<label class="field"><span>Grade (students)</span><select name="grade">' + gradeOptions(editing ? user.grade : '') + '</select></label></div>' +
        (!editing ? '<label class="field"><span>Password <em>(optional)</em></span><input name="password" type="password" minlength="8" placeholder="Leave blank for a temporary password"></label>' : '') +
        (editing ? '<label class="check check-box"><input name="active" type="checkbox"' + (Number(user.active) ? ' checked' : '') + '> <span>Account can sign in</span></label>' : '') +
        '<div class="form-message"></div></form>',
      footer: '<button class="button button-quiet" type="button" data-modal-close="1">Cancel</button>' +
        '<button class="button button-primary" type="submit" form="user-form">' + (editing ? 'Save account' : 'Create account') + '</button>',
      onMount: function (element) {
        var form = element.querySelector('#user-form');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var message = form.querySelector('.form-message');
          var body = {
            name: form.querySelector('[name="name"]').value.trim(),
            role: form.querySelector('[name="role"]').value,
            grade: form.querySelector('[name="grade"]').value ? Number(form.querySelector('[name="grade"]').value) : null
          };
          if (editing) {
            body.id = Number(user.id);
            body.active = form.querySelector('[name="active"]').checked;
          } else {
            body.email = form.querySelector('[name="email"]').value.trim();
            body.password = form.querySelector('[name="password"]').value;
          }
          api(editing ? 'admin/users/update' : 'admin/users', { method: 'POST', body: body }).then(function (result) {
            if (result.temp_password) {
              closeModal();
              modal({
                title: 'Account created',
                subtitle: 'Share this temporary password privately.',
                body: '<div class="family-code"><small>Temporary password</small><strong style="font-size:1.3rem;letter-spacing:.04em">' + esc(result.temp_password) + '</strong><p>The person must choose a new password at first sign-in.</p></div>',
                footer: '<button class="button button-primary" type="button" data-modal-close="1">Done</button>'
              });
              renderPage();
              return;
            }
            closeModal();
            toast(result.message, 'success');
            renderPage();
          }).catch(function (error) {
            message.className = 'form-message form-error';
            message.textContent = apiError(error);
          });
        });
      }
    });
  }

  function resetUserPassword(userId, name) {
    confirmDialog({
      title: 'Create a temporary password?',
      message: 'This signs ' + name + ' out of every device and gives them a temporary password.',
      confirmLabel: 'Create password'
    }).then(function (yes) {
      if (!yes) return;
      api('admin/users/reset', { method: 'POST', body: { id: userId } }).then(function (result) {
        modal({
          title: 'Temporary password',
          subtitle: 'Give this to ' + name + ' privately. They must change it at sign-in.',
          body: '<div class="family-code"><small>Temporary password</small><strong style="font-size:1.3rem;letter-spacing:.04em">' + esc(result.temp_password) + '</strong></div>',
          footer: '<button class="button button-primary" type="button" data-modal-close="1">Done</button>'
        });
      }).catch(function (error) { toast(apiError(error), 'error'); });
    });
  }

  RENDERERS.admin = async function () {
    setPageUserIntro();
    var tab = routeParams.tab || 'support';
    var tabs = ['support', 'audit'].concat(session.user.role === 'admin' ? ['family', 'settings'] : []);
    if (tabs.indexOf(tab) === -1) tab = 'support';
    var html = '<div class="page-head"><div><h1>Admin tools</h1><p>Help requests, family links, and the school audit log.</p></div></div>';
    html += '<div class="tabs">' + tabs.map(function (item) {
      var labels = { support: 'Help requests', audit: 'Audit log', family: 'Family links', settings: 'Settings' };
      return '<button class="tab' + (tab === item ? ' is-active' : '') + '" type="button" data-admin-tab="' + item + '">' + labels[item] + '</button>';
    }).join('') + '</div>';
    html += '<div id="admin-panel">' + pageLoading() + '</div>';
    $('#page-content').innerHTML = html;

    if (tab === 'support') {
      var support = await api('admin/support');
      var rows = support.support || [];
      var body = rows.length ? rows.map(function (item) {
        return '<article class="card support-card"><div class="row-between"><div><strong>' + esc(item.name) + '</strong> ' +
          '<span class="muted small">' + esc(item.email) + ' · from ' + esc(item.page || 'app') + '</span></div>' +
          '<span class="badge ' + (item.status === 'open' ? 'badge-orange' : 'badge-mint') + '">' + esc(item.status) + '</span></div>' +
          '<p>' + esc(item.body) + '</p><div class="row-between"><span class="muted" style="font-size:.72rem">' + esc(timeAgo(item.created_at)) + '</span>' +
          '<div class="row">' + (item.status === 'open' ? '<button class="button button-quiet button-small" type="button" data-support-close="' + Number(item.id) + '">Mark handled</button>' : '') +
          '<button class="button button-quiet button-small" type="button" data-mailto="' + esc(item.email) + '">' + icon('send') + ' Reply by email</button></div></div></article>';
      }).join('') : '<p class="muted">No help requests yet.</p>';
      $('#admin-panel').innerHTML = '<div class="stack">' + body + '</div>';
    } else if (tab === 'audit') {
      var audit = await api('admin/audit');
      var entries = audit.audit || [];
      $('#admin-panel').innerHTML = entries.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Item</th></tr></thead><tbody>' +
        entries.map(function (entry) {
          return '<tr><td>' + esc(formatDateTime(entry.created_at)) + '</td><td>' + esc(entry.actor_name || 'System') + '</td><td>' + esc(entry.action) + '</td><td>' + esc(entry.entity) + (entry.entity_id ? ' #' + esc(entry.entity_id) : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted">No audit entries yet.</p>';
    } else if (tab === 'family') {
      var links = await api('admin/parent-links');
      var family = links.links || [];
      $('#admin-panel').innerHTML = family.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>Parent</th><th>Student</th><th>Status</th><th>Created</th></tr></thead><tbody>' +
        family.map(function (link) {
          return '<tr><td><strong>' + esc(link.parent_name) + '</strong><br><span class="muted small">' + esc(link.parent_email) + '</span></td>' +
            '<td><strong>' + esc(link.student_name) + '</strong><br><span class="muted small">Grade ' + esc(link.grade) + '</span></td>' +
            '<td><span class="badge ' + (link.status === 'active' ? 'badge-mint' : 'badge-orange') + '">' + esc(link.status) + '</span></td>' +
            '<td>' + esc(formatDate(link.created_at)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted">No family links yet.</p>';
    } else {
      var settings = await api('admin/settings');
      var values = {};
      (settings.settings || []).forEach(function (row) { values[row.setting_key] = row.setting_value; });
      $('#admin-panel').innerHTML = '<form id="settings-form" class="card stack" style="max-width:640px">' +
        '<label class="field"><span>App name</span><input name="app_name" maxlength="190" value="' + esc(values.app_name || 'BrightPath') + '"></label>' +
        '<label class="field"><span>Welcome message</span><textarea name="welcome_message" rows="2" maxlength="500">' + esc(values.welcome_message || '') + '</textarea></label>' +
        '<label class="field"><span>Support email</span><input name="support_email" type="email" maxlength="190" value="' + esc(values.support_email || '') + '"></label>' +
        '<label class="field"><span>Jitsi domain</span><input name="jitsi_domain" maxlength="190" value="' + esc(values.jitsi_domain || 'meet.jit.si') + '"></label>' +
        '<div class="form-message"></div><button class="button button-primary" type="submit">' + icon('check') + ' Save settings</button></form>';
      $('#settings-form').addEventListener('submit', function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        var body = {
          app_name: form.querySelector('[name="app_name"]').value.trim(),
          welcome_message: form.querySelector('[name="welcome_message"]').value.trim(),
          support_email: form.querySelector('[name="support_email"]').value.trim(),
          jitsi_domain: form.querySelector('[name="jitsi_domain"]').value.trim()
        };
        api('admin/settings', { method: 'POST', body: body }).then(function (result) {
          toast(result.message, 'success');
          if (session.settings) session.settings.welcome_message = body.welcome_message;
          applyUser();
        }).catch(function (error) {
          var message = form.querySelector('.form-message');
          message.className = 'form-message form-error';
          message.textContent = apiError(error);
        });
      });
    }
  };

  RENDERERS.sponsors = async function () {
    setPageUserIntro();
    var data = await api('admin/sponsors');
    var sponsors = data.sponsors || [];
    var html = '<div class="page-head"><div><h1>Sponsor cards</h1><p>Non-personalised cards shown to students. Parent-approved, school-controlled.</p></div>' +
      '<button class="button button-primary" type="button" data-new-sponsor="1">' + icon('plus') + ' New card</button></div>';
    html += '<div class="notice notice-warm">' + icon('shield') + '<span>Only add real partners your school has approved. No tracking links or personal data collection.</span></div>';
    if (!sponsors.length) {
      html += emptyState('heart', 'No sponsor cards', 'Add a card for a local library, sports club, or school partner.');
    } else {
      html += '<div class="card">' + sponsors.map(function (sponsor) {
        return '<div class="sponsor-admin-row">' + (sponsor.image_url ? '<img src="' + esc(sponsor.image_url) + '" alt="" style="width:52px;height:52px;border-radius:12px;object-fit:cover">' : sticker('heart', 'orange')) +
          '<div class="grow"><strong>' + esc(sponsor.title) + '</strong><span class="muted small">' + esc(sponsor.label || '') + ' · Grades ' + esc(sponsor.grade_min) + '–' + esc(sponsor.grade_max) + '</span></div>' +
          '<span class="badge badge-blue">' + esc(sponsor.impressions || 0) + ' views</span><span class="badge badge-purple">' + esc(sponsor.clicks || 0) + ' clicks</span>' +
          '<span class="badge ' + (Number(sponsor.active) ? 'badge-mint' : 'badge-orange') + '">' + (Number(sponsor.active) ? 'Live' : 'Paused') + '</span>' +
          '<button class="button button-quiet button-small" type="button" data-edit-sponsor="' + Number(sponsor.id) + '">' + icon('edit') + '</button>' +
          '<button class="button button-quiet button-small" type="button" data-delete-sponsor="' + Number(sponsor.id) + '">' + icon('trash') + '</button></div>';
      }).join('') + '</div>';
    }
    $('#page-content').innerHTML = html;
    window.__sponsorCache = sponsors;
  };

  function openSponsorModal(sponsor) {
    var editing = !!sponsor;
    modal({
      title: editing ? 'Edit sponsor card' : 'New sponsor card',
      subtitle: 'Short, useful, and safe for young learners.',
      body: '<form id="sponsor-form" class="stack">' +
        '<label class="field"><span>Title</span><input name="title" required maxlength="160" value="' + esc(editing ? sponsor.title : '') + '"></label>' +
        '<label class="field"><span>Short description</span><textarea name="body" rows="2" maxlength="500">' + esc(editing ? sponsor.body : '') + '</textarea></label>' +
        '<div class="form-grid"><label class="field"><span>Label</span><input name="label" maxlength="60" value="' + esc(editing ? sponsor.label : 'Parent-approved pick') + '"></label>' +
        '<label class="field"><span>Image URL (https)</span><input name="image_url" type="url" maxlength="500" value="' + esc(editing ? sponsor.image_url : '') + '"></label></div>' +
        '<label class="field"><span>Link URL (https)</span><input name="target_url" type="url" maxlength="500" value="' + esc(editing ? sponsor.target_url : '') + '"></label>' +
        '<div class="form-grid"><label class="field"><span>Lowest grade</span><input name="grade_min" type="number" min="1" max="8" value="' + esc(editing ? sponsor.grade_min : 1) + '"></label>' +
        '<label class="field"><span>Highest grade</span><input name="grade_max" type="number" min="1" max="8" value="' + esc(editing ? sponsor.grade_max : 8) + '"></label></div>' +
        '<label class="check check-box"><input name="active" type="checkbox"' + (!editing || Number(sponsor.active) ? ' checked' : '') + '> <span>Show this card</span></label>' +
        '<div class="form-message"></div></form>',
      footer: '<button class="button button-quiet" type="button" data-modal-close="1">Cancel</button>' +
        '<button class="button button-primary" type="submit" form="sponsor-form">Save card</button>',
      onMount: function (element) {
        element.querySelector('#sponsor-form').addEventListener('submit', function (event) {
          event.preventDefault();
          var form = event.currentTarget;
          var body = {
            title: form.querySelector('[name="title"]').value.trim(),
            body: form.querySelector('[name="body"]').value.trim(),
            label: form.querySelector('[name="label"]').value.trim(),
            image_url: form.querySelector('[name="image_url"]').value.trim(),
            target_url: form.querySelector('[name="target_url"]').value.trim(),
            grade_min: Number(form.querySelector('[name="grade_min"]').value) || 1,
            grade_max: Number(form.querySelector('[name="grade_max"]').value) || 8,
            active: form.querySelector('[name="active"]').checked
          };
          if (editing) body.id = Number(sponsor.id);
          api('admin/sponsors', { method: 'POST', body: body }).then(function (result) {
            closeModal();
            toast(result.message, 'success');
            renderPage();
          }).catch(function (error) {
            var message = form.querySelector('.form-message');
            message.className = 'form-message form-error';
            message.textContent = apiError(error);
          });
        });
      }
    });
  }

  /* ---------------------------------------------------------------------
   * Help, profile, search
   * ------------------------------------------------------------------ */

  RENDERERS.help = async function () {
    setPageUserIntro();
    var contacts = await api('contacts').catch(function () { return { contacts: [] }; });
    var html = '<div class="page-head"><div><h1>Help</h1><p>Ask a grown-up helper, or find a quick answer below.</p></div></div>';
    html += '<div class="grid grid-2"><section class="card"><h2>Send a message</h2><p class="muted small">A school administrator will reply by email.</p>' +
      '<form id="support-form" class="stack" style="margin-top:12px">' +
      '<label class="field"><span>Your message</span><textarea name="body" rows="4" required maxlength="2000" placeholder="Tell us what happened and what you need help with"></textarea></label>' +
      '<div class="form-message"></div><button class="button button-primary" type="submit">' + icon('send') + ' Send to a helper</button></form></section>';
    html += '<section class="card card-soft"><h2>Quick answers</h2><div class="stack" style="margin-top:10px">' +
      '<div><strong>I forgot my password</strong><p class="muted small" style="margin:2px 0 0">Sign out, then use “Forgot password?” on the sign-in screen. If email is not set up, ask your school administrator for a temporary password.</p></div>' +
      '<div><strong>My class will not open</strong><p class="muted small" style="margin:2px 0 0">Allow camera and microphone when your browser asks. If the room still does not open, ask your tutor for a new class link.</p></div>' +
      '<div><strong>How do I link a parent?</strong><p class="muted small" style="margin:2px 0 0">Open Family, copy your family code, and share it privately with your parent.</p></div>' +
      '<div><strong>Is my work saved?</strong><p class="muted small" style="margin:2px 0 0">Yes. Lessons, assignments, and game scores are saved to your account.</p></div>' +
      '</div></section></div>';
    html += '<div class="section-head"><h2>People you can message</h2></div>';
    if (contacts.contacts && contacts.contacts.length) {
      html += '<div class="grid grid-3">' + contacts.contacts.map(function (person) {
        return '<article class="card child-card">' + avatarMarkup(person, '') + '<div class="grow"><strong>' + esc(person.name) + '</strong><span>' + esc(roleLabel(person.role)) + '</span></div>' +
          '<button class="button button-quiet button-small" type="button" data-message-user="' + Number(person.id) + '">' + icon('message') + ' Message</button></article>';
      }).join('') + '</div>';
    } else {
      html += '<p class="muted small">Your school has not connected any contacts yet.</p>';
    }
    $('#page-content').innerHTML = html;
    var form = $('#support-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var body = form.querySelector('[name="body"]').value.trim();
      if (body.length < 5) { toast('Tell us a little more.', 'error'); return; }
      api('support', { method: 'POST', body: { name: session.user.name, email: session.user.email, page: currentPage, body: body } }).then(function (result) {
        form.reset();
        toast(result.message, 'success');
      }).catch(function (error) {
        var message = form.querySelector('.form-message');
        message.className = 'form-message form-error';
        message.textContent = apiError(error);
      });
    });
  };

  RENDERERS.profile = async function () {
    setPageUserIntro();
    var user = session.user;
    var avatars = ['star', 'rocket', 'book', 'fox', 'panda', 'owl', 'cat', 'robot', 'flower', 'moon'];
    var html = '<div class="page-head"><div><h1>My profile</h1><p>Choose how your name and picture look inside BrightPath.</p></div></div>';
    html += '<div class="grid grid-2"><section class="card"><div class="profile-card">' + avatarMarkup(user, 'avatar-xl') +
      '<div><strong style="font-size:1.2rem">' + esc(user.name) + '</strong><p class="muted" style="margin:2px 0 0">' + esc(roleLabel(user.role)) + (user.grade ? ' · Grade ' + esc(user.grade) : '') + '</p>' +
      '<p class="muted small" style="margin:2px 0 0">' + esc(user.email) + '</p></div></div>' +
      '<form id="profile-form" class="stack" style="margin-top:18px">' +
      '<label class="field"><span>Name</span><input name="name" required maxlength="120" value="' + esc(user.name) + '"></label>' +
      '<div><span class="small" style="font-weight:800">Avatar</span><div class="avatar-picker" id="avatar-picker">' +
      avatars.map(function (avatar) {
        return '<button class="avatar-choice' + (user.avatar === avatar ? ' is-active' : '') + '" type="button" data-avatar="' + avatar + '" aria-label="' + avatar + '">' + avatarMarkup({ avatar: avatar, name: avatar }, '') + '</button>';
      }).join('') + '</div><input type="hidden" name="avatar" value="' + esc(user.avatar || 'star') + '"></div>' +
      '<div class="form-message"></div><button class="button button-primary" type="submit">' + icon('check') + ' Save profile</button></form></section>';
    html += '<div class="stack"><section class="card"><h2>Password</h2><p class="muted small">Use at least 8 characters. Never share it with anyone.</p>' +
      '<form id="password-form" class="stack" style="margin-top:10px">' +
      '<label class="field"><span>Current password</span><input name="current" type="password" autocomplete="current-password" required></label>' +
      '<label class="field"><span>New password</span><input name="next" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<div class="form-message"></div><button class="button button-quiet" type="submit">Change password</button></form></section>';
    html += '<section class="card"><h2>Fingerprint sign-in</h2><p class="muted small">' + (nativeApp() ? 'Unlock BrightPath with your fingerprint on this phone. Your password is never stored.' : 'Available in the BrightPath Android app. Install it to unlock with your fingerprint.') + '</p>' +
      '<div class="row" style="margin-top:10px">' + (nativeApp() && biometricReady() ? '<button class="button button-primary" type="button" id="profile-biometric">' + icon('fingerprint') + ' Set up fingerprint</button>' : '') +
      '<button class="button button-quiet" type="button" data-app-link="download">' + icon('download') + ' Get the Android app</button></div></section>';
    html += '<section class="card"><h2>Account</h2><div class="stack" style="margin-top:10px">' +
      '<button class="button button-quiet" type="button" data-tour="1">' + icon('sparkle') + ' Replay the guided tour</button>' +
      '<button class="button button-danger" type="button" data-logout="1">' + icon('logout') + ' Sign out</button></div></section></div></div>';
    $('#page-content').innerHTML = html;

    var picker = $('#avatar-picker');
    picker.addEventListener('click', function (event) {
      var choice = event.target.closest('[data-avatar]');
      if (!choice) return;
      $$('.avatar-choice', picker).forEach(function (item) { item.classList.remove('is-active'); });
      choice.classList.add('is-active');
      $('#profile-form [name="avatar"]').value = choice.getAttribute('data-avatar');
    });
    $('#profile-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var form = event.currentTarget;
      api('profile/update', { method: 'POST', body: { name: form.querySelector('[name="name"]').value.trim(), avatar: form.querySelector('[name="avatar"]').value } }).then(function (result) {
        session.user.name = result.name;
        session.user.avatar = result.avatar;
        saveToken(session.token, true);
        applyUser();
        toast(result.message, 'success');
        renderPage();
      }).catch(function (error) {
        var message = form.querySelector('.form-message');
        message.className = 'form-message form-error';
        message.textContent = apiError(error);
      });
    });
    $('#password-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var form = event.currentTarget;
      api('auth/change-password', { method: 'POST', body: { current_password: form.querySelector('[name="current"]').value, new_password: form.querySelector('[name="next"]').value } }).then(function (result) {
        form.reset();
        toast(result.message, 'success');
      }).catch(function (error) {
        var message = form.querySelector('.form-message');
        message.className = 'form-message form-error';
        message.textContent = apiError(error);
      });
    });
    var biometric = $('#profile-biometric');
    if (biometric) biometric.addEventListener('click', function () {
      try {
        bridge().saveBiometricSession(session.token, JSON.stringify(session.user), API_BASE, 'save-' + Date.now());
      } catch (error) { toast('Fingerprint setup is not available.', 'error'); }
    });
  };

  RENDERERS.search = async function () {
    setPageUserIntro();
    var query = String(routeParams.q || '').trim();
    var data = await api('lessons');
    var lessons = data.lessons || [];
    var matches = query ? lessons.filter(function (lesson) {
      var haystack = [lesson.title, lesson.description, lesson.subject].join(' ').toLowerCase();
      return haystack.indexOf(query.toLowerCase()) !== -1;
    }) : [];
    var html = '<div class="page-head"><div><h1>Search</h1><p>' + (query ? 'Results for “' + esc(query) + '”' : 'Type something in the search box above.') + '</p></div></div>';
    if (!query) {
      html += emptyState('search', 'What would you like to find?', 'Try a lesson name, a subject, or a word like fractions.');
    } else if (!matches.length) {
      html += emptyState('search', 'Nothing matched', 'Try a shorter word, or open Help to ask a grown-up.', '<a class="button button-primary button-small" href="#/help">Open Help</a>');
    } else {
      html += '<div class="lesson-grid">' + matches.map(function (lesson) {
        return '<button class="lesson-card theme-' + esc(lesson.theme || 'purple') + '" type="button" data-lesson="' + Number(lesson.id) + '">' +
          '<span class="row-between">' + sticker(lesson.icon || 'book', lesson.theme || 'purple') + '<span class="badge badge-blue">Grade ' + esc(lesson.grade) + '</span></span>' +
          '<h3>' + esc(lesson.title) + '</h3><p>' + esc(lesson.description || '') + '</p>' +
          '<div class="lesson-foot"><span class="meta-row"><span>' + icon('book') + esc(lesson.subject) + '</span></span><span class="badge badge-purple">Open</span></div></button>';
      }).join('') + '</div>';
    }
    $('#page-content').innerHTML = html;
  };

  /* ---------------------------------------------------------------------
   * Remaining event wiring
   * ------------------------------------------------------------------ */

  function openReminder(classId, title, scheduledAt) {
    var when = parseDate(scheduledAt);
    var minutes = when ? Math.max(1, Math.round((when.getTime() - Date.now()) / 60000)) : 30;
    if (nativeApp() && bridge().scheduleNotification) {
      try {
        bridge().scheduleNotification('BrightPath class soon', title + ' starts soon. Tap to join.', Math.min(minutes, 60));
        toast('Reminder set for this device.', 'success');
        return;
      } catch (error) { /* fall through */ }
    }
    toast('Open the app a few minutes before ' + (when ? formatDateTime(scheduledAt) : 'class') + '.');
  }

  function messageUser(userId) {
    api('conversations', { method: 'POST', body: { user_id: userId } }).then(function (result) {
      navigate('messages', { c: Number(result.conversation_id) });
    }).catch(function (error) { toast(apiError(error), 'error'); });
  }

  function bindRemainingEvents() {
    var jitsiLeave = $('#jitsi-leave');
    if (jitsiLeave) jitsiLeave.addEventListener('click', function () { leaveClass(true); });
    window.addEventListener('hashchange', routeFromHash);
    window.addEventListener('online', function () { updateConnection(true); });
    window.addEventListener('offline', function () { updateConnection(false); });

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      function pick(attribute) { return target.closest('[' + attribute + ']'); }

      var lesson = pick('data-lesson');
      if (lesson) { navigate('lesson', { id: lesson.getAttribute('data-lesson') }); return; }
      var join = pick('data-join-class');
      if (join) { joinClass(Number(join.getAttribute('data-join-class'))); return; }
      var newClass = pick('data-new-class');
      if (newClass) { openClassModal(); return; }
      var attendance = pick('data-attendance');
      if (attendance) { openAttendance(Number(attendance.getAttribute('data-attendance'))); return; }
      var endClass = pick('data-end-class');
      if (endClass) { openEndClass(Number(endClass.getAttribute('data-end-class'))); return; }
      var remind = pick('data-remind-class');
      if (remind) {
        openReminder(Number(remind.getAttribute('data-remind-class')), remind.getAttribute('data-class-title'), remind.getAttribute('data-class-time'));
        return;
      }
      var newAssignment = pick('data-new-assignment');
      if (newAssignment) { openAssignmentModal(null); return; }
      var editAssignment = pick('data-edit-assignment');
      if (editAssignment) {
        var assignment = (window.__assignmentCache || []).filter(function (item) { return Number(item.id) === Number(editAssignment.getAttribute('data-edit-assignment')); })[0];
        if (assignment) openAssignmentModal(assignment);
        return;
      }
      var assignmentStatus = pick('data-assignment-status');
      if (assignmentStatus) {
        var nextStatus = assignmentStatus.getAttribute('data-current-status') === 'closed' ? 'published' : 'closed';
        api('assignments/update', { method: 'POST', body: { id: Number(assignmentStatus.getAttribute('data-assignment-status')), status: nextStatus } }).then(function (result) {
          toast(result.message, 'success');
          renderPage();
        }).catch(function (error) { toast(apiError(error), 'error'); });
        return;
      }
      var reviewPage = pick('data-review-page');
      if (reviewPage) { navigate('reviews'); return; }
      var childPage = pick('data-child-page');
      if (childPage) { navigate(childPage.getAttribute('data-child-page'), { student_id: childPage.getAttribute('data-child') }); return; }
      var game = pick('data-game');
      if (game) { navigate('games', { game: game.getAttribute('data-game') }); return; }
      var conversation = pick('data-conversation');
      if (conversation) { selectConversation(Number(conversation.getAttribute('data-conversation'))); return; }
      var newConversation = pick('data-new-conversation');
      if (newConversation) { openNewConversation(); return; }
      var messageUserButton = pick('data-message-user');
      if (messageUserButton) { messageUser(Number(messageUserButton.getAttribute('data-message-user'))); return; }
      var linkAccept = pick('data-link-accept');
      if (linkAccept) { respondToLink(Number(linkAccept.getAttribute('data-link-accept')), 'accept'); return; }
      var linkDecline = pick('data-link-decline');
      if (linkDecline) { respondToLink(Number(linkDecline.getAttribute('data-link-decline')), 'decline'); return; }
      var linkRevoke = pick('data-link-revoke');
      if (linkRevoke) {
        confirmDialog({ title: 'Remove this family link?', message: 'They will no longer see progress or school work.', confirmLabel: 'Remove link', danger: true })
          .then(function (yes) { if (yes) respondToLink(Number(linkRevoke.getAttribute('data-link-revoke')), 'revoke'); });
        return;
      }
      var addStudent = pick('data-add-student');
      if (addStudent) { addStudentModal(); return; }
      var removeStudent = pick('data-remove-student');
      if (removeStudent) {
        confirmDialog({ title: 'Remove student?', message: 'Remove ' + removeStudent.getAttribute('data-student-name') + ' from your tutoring group?', confirmLabel: 'Remove', danger: true })
          .then(function (yes) {
            if (!yes) return;
            api('tutor/students/remove', { method: 'POST', body: { student_id: Number(removeStudent.getAttribute('data-remove-student')) } }).then(function (result) {
              toast(result.message, 'success');
              renderPage();
            }).catch(function (error) { toast(apiError(error), 'error'); });
          });
        return;
      }
      var review = pick('data-review');
      if (review) {
        var bits = review.getAttribute('data-review').split(':');
        openReviewModal(bits[0], Number(bits[1]));
        return;
      }
      var downloadSubmission = pick('data-download-submission');
      if (downloadSubmission) {
        downloadStored('submissions/download', { id: Number(downloadSubmission.getAttribute('data-download-submission')) }, 'brightpath-work');
        return;
      }
      var newUser = pick('data-new-user');
      if (newUser) { openUserModal(null); return; }
      var editUser = pick('data-edit-user');
      if (editUser) {
        var account = (window.__userCache || []).filter(function (item) { return Number(item.id) === Number(editUser.getAttribute('data-edit-user')); })[0];
        if (account) openUserModal(account);
        return;
      }
      var resetUser = pick('data-reset-user');
      if (resetUser) { resetUserPassword(Number(resetUser.getAttribute('data-reset-user')), resetUser.getAttribute('data-user-name')); return; }
      var approveUser = pick('data-approve-user');
      if (approveUser) {
        api('admin/users/update', { method: 'POST', body: { id: Number(approveUser.getAttribute('data-approve-user')), active: true } }).then(function (result) {
          toast(result.message, 'success');
          renderPage();
        }).catch(function (error) { toast(apiError(error), 'error'); });
        return;
      }
      var roleFilter = pick('data-role-filter');
      if (roleFilter) {
        peopleFilters.role = roleFilter.getAttribute('data-role-filter');
        renderPage();
        return;
      }
      var adminTab = pick('data-admin-tab');
      if (adminTab) { navigate('admin', { tab: adminTab.getAttribute('data-admin-tab') }); return; }
      var supportClose = pick('data-support-close');
      if (supportClose) {
        api('admin/support/close', { method: 'POST', body: { id: Number(supportClose.getAttribute('data-support-close')) } }).then(function (result) {
          toast(result.message, 'success');
          renderPage();
        }).catch(function (error) { toast(apiError(error), 'error'); });
        return;
      }
      var mailto = pick('data-mailto');
      if (mailto) { location.href = 'mailto:' + mailto.getAttribute('data-mailto'); return; }
      var newSponsor = pick('data-new-sponsor');
      if (newSponsor) { openSponsorModal(null); return; }
      var editSponsor = pick('data-edit-sponsor');
      if (editSponsor) {
        var sponsor = (window.__sponsorCache || []).filter(function (item) { return Number(item.id) === Number(editSponsor.getAttribute('data-edit-sponsor')); })[0];
        if (sponsor) openSponsorModal(sponsor);
        return;
      }
      var deleteSponsor = pick('data-delete-sponsor');
      if (deleteSponsor) {
        confirmDialog({ title: 'Delete this card?', message: 'It will disappear from student dashboards.', confirmLabel: 'Delete', danger: true })
          .then(function (yes) {
            if (!yes) return;
            api('admin/sponsors/delete', { method: 'POST', body: { id: Number(deleteSponsor.getAttribute('data-delete-sponsor')) } }).then(function (result) {
              toast(result.message, 'success');
              renderPage();
            }).catch(function (error) { toast(apiError(error), 'error'); });
          });
        return;
      }
      var tour = pick('data-tour');
      if (tour) { showTour(); return; }
    });

    $$('.auth-form input').forEach(function (input) {
      input.addEventListener('input', function () {
        var form = input.closest('form');
        if (form) clearFormMessage(form);
      });
    });
  }

  // Cache list data used by delegated row actions.
  var originalAssignmentsRender = RENDERERS.assignments;
  RENDERERS.assignments = async function () {
    await originalAssignmentsRender.apply(null, arguments);
    try {
      var box = $('#page-content');
      var cards = $$('[data-assignment-status]', box);
      if (!cards.length) return;
      var data = await api('assignments', { query: routeParams.student_id ? { student_id: routeParams.student_id } : {} });
      window.__assignmentCache = data.assignments || [];
      window.__assignmentCache.forEach(function (assignment) {
        var closeButton = $('[data-assignment-status="' + Number(assignment.id) + '"]');
        if (closeButton && !$('[data-edit-assignment="' + Number(assignment.id) + '"]')) {
          var edit = document.createElement('button');
          edit.className = 'button button-quiet button-small';
          edit.type = 'button';
          edit.setAttribute('data-edit-assignment', String(assignment.id));
          edit.innerHTML = icon('edit');
          closeButton.parentNode.insertBefore(edit, closeButton);
        }
      });
    } catch (error) { /* cache is optional */ }
  };

  var originalUsersRender = RENDERERS.users;
  RENDERERS.users = async function () {
    await originalUsersRender.apply(null, arguments);
    try {
      var data = await api('admin/users', { query: { search: peopleFilters.search, role: peopleFilters.role } });
      window.__userCache = data.users || [];
    } catch (error) { /* ignore */ }
  };

  document.addEventListener('DOMContentLoaded', function () {
    bindRemainingEvents();
    boot();
  });
})();
