const iconPaths = {
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zm0 0v15M8 7h8m-8 4h8',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-16v6l4 2',
  check: 'm5 12 4 4L19 6',
  chart: 'M4 19V5m0 14h17M8 15l4-4 3 2 5-6',
  people: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7a4 4 0 0 1 0 8m2 3h1a4 4 0 0 1 4 4v2',
  message: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8z',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-13v2m0 15v2m9-9h-2m-14 0H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64',
  search: 'm20 20-4.5-4.5m2-5.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
  sparkle: 'm12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Zm7 12 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z',
  microphone: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Zm-7 10a7 7 0 0 0 14 0m-7 7v3m-4 0h8',
  hand: 'M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v7l1-2a2 2 0 0 1 3 2l-2 6a5 5 0 0 1-5 4h-3a5 5 0 0 1-4-2l-4-5a2 2 0 0 1 3-3l2 2',
  leaf: 'M20 4c-9 0-15 4-15 11a5 5 0 0 0 5 5c7 0 11-7 10-16Zm-14 15 9-9',
  openBook: 'M12 7v14m0-14C9 4 5 4 2 5v14c3-1 7-1 10 2m0-14c3-3 7-3 10-2v14c-3-1-7-1-10 2',
  bell: 'M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4',
  download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  arrow: 'M5 12h14m-7-7 7 7-7 7',
  sun: 'M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  camera: 'M14 4h-4L8 7H4v13h16V7h-4zm-2 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6m-10 4h6m-6 4h6'
};

function icon(name, className = '') {
  const path = iconPaths[name];
  if (!path) return '';
  return `<svg class="ui-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
}

const roles = {
  student: {
    name: 'Student', initial: 'S', title: 'My learning', greeting: 'Welcome',
    links: [['home', 'home', 'My learning'], ['subjects', 'book', 'My subjects'], ['classes', 'clock', 'Live classes'], ['assignments', 'check', 'Assignments'], ['progress', 'chart', 'My progress']]
  },
  parent: {
    name: 'Parent', initial: 'P', title: 'Family overview', greeting: 'Welcome',
    links: [['home', 'home', 'Overview'], ['children', 'people', 'My children'], ['progress', 'chart', 'Learning progress'], ['classes', 'clock', 'Classes & schedule'], ['messages', 'message', 'Messages']]
  },
  tutor: {
    name: 'Tutor', initial: 'T', title: 'Tutor workspace', greeting: 'Welcome',
    links: [['home', 'home', 'Overview'], ['classes', 'clock', 'My classes'], ['students', 'people', 'My students'], ['assignments', 'check', 'Assignments'], ['messages', 'message', 'Messages']]
  },
  developer: {
    name: 'Administrator', initial: 'A', title: 'Developer console', greeting: 'Welcome',
    links: [['home', 'home', 'Overview'], ['users', 'people', 'Users & roles'], ['content', 'book', 'Learning content'], ['health', 'chart', 'System health'], ['settings', 'settings', 'Settings']]
  }
};
const apiSettings = readApiSettings();
const initialApiUser = readApiUser();
const state = {
  role: initialApiUser?.role === 'admin' ? 'developer' : initialApiUser?.role || 'student',
  page: 'home', toastTimer: null,
  apiBase: apiSettings.base || window.BRIGHTPATH_CONFIG?.apiBase || '', apiStatus: '', apiUser: initialApiUser,
  androidDownloadUrl: window.BRIGHTPATH_CONFIG?.androidDownloadUrl || '',
  selectedFiles: new Map(), remoteAssignments: [], remoteAssignmentsLoaded: false,
  remoteTutorAssignments: [], remoteSubmissions: [], remoteTutorDataLoaded: false
};
const pageContent = document.querySelector('#page-content');
const sideNav = document.querySelector('#side-nav');
const mobileNav = document.querySelector('#mobile-nav');
const roleSelect = document.querySelector('#role-select');
window.BrightPathWeb = {
  onBiometricSaved(requestId, success, message) {
    setApiStatus(message, success ? 'success' : 'error');
    render();
  },
  onBiometricUnlockResult(requestId, success, message) {
    if (!success) {
      setApiStatus(message, 'error');
      render();
    }
  },
  onBiometricUnlocked(requestId, serializedSession) {
    try {
      const session = JSON.parse(serializedSession);
      if (!session.token || !session.user || !session.apiBase) throw new Error('Saved sign-in is incomplete.');
      saveApiBase(session.apiBase);
      sessionStorage.setItem('brightpath-token', session.token);
      sessionStorage.setItem('brightpath-user', JSON.stringify(session.user));
      state.apiUser = session.user;
      state.role = session.user.role === 'admin' ? 'developer' : session.user.role;
      state.page = 'home';
      state.remoteAssignments = [];
      state.remoteAssignmentsLoaded = false;
      state.remoteTutorDataLoaded = false;
      render();
      toast('Welcome back! Your school session is unlocked.');
    } catch (error) {
      window.BrightPathNative?.clearBiometricSessionFromApp?.();
      setApiStatus('Fingerprint sign-in could not be restored. Use your school password.', 'error');
      render();
    }
  }
};

function tutorSubmissionsPanel() {
  const canReview = state.apiUser && ['tutor', 'admin'].includes(state.apiUser.role);
  if (!canReview) {
    return '';
  }
  const items = state.remoteSubmissions;
  return `<section class="panel"><div class="panel-heading"><div><h2>Student work to review</h2><p>Only submissions on your assignments are listed.</p></div><span class="task-tag">${items.length} NEW</span></div>${items.length ? `<div class="submission-list">${items.map(item => {
    const isAnswer = item.submission_type === 'answer';
    let response = item.answer_text || '';
    if (item.assignment_type === 'choice') {
      try { response = JSON.parse(item.choices_json || '[]')[Number(item.selected_choice)] || 'Answer unavailable'; }
      catch { response = 'Answer unavailable'; }
    }
    return `<article class="submission-item"><div class="avatar avatar-purple">${escapeHTML((item.student_name || 'S')[0])}</div><div class="submission-copy"><strong>${escapeHTML(item.student_name)} · Grade ${escapeHTML(String(item.grade))}</strong><span>${escapeHTML(item.title)} · ${new Date(item.submitted_at).toLocaleDateString()}</span>${isAnswer ? `<p>${escapeHTML(response)}</p><span>${item.assignment_type === 'choice' ? Number(item.is_correct) === 1 ? 'Auto-marked correct' : 'Auto-marked incorrect' : 'Written answer · needs tutor review'}</span>` : `${item.notes ? `<p>${escapeHTML(item.notes)}</p>` : ''}<span>${escapeHTML(item.original_filename)} · ${(Number(item.file_size) / (1024 * 1024)).toFixed(2)} MB</span>`}</div>${!isAnswer ? `<button class="round-arrow" aria-label="Download ${escapeHTML(item.original_filename)}" data-action="download-submission" data-submission-id="${Number(item.id)}">↓</button>` : ''}</article>`;
  }).join('')}</div>` : '<div class="empty-state"><span>✓</span>No student work is waiting for review.</div>'}</section>`;
}

function tutorAssignmentsPanel() {
  if (!state.apiUser || !['tutor', 'admin'].includes(state.apiUser.role)) return '';
  return `<section class="panel"><div class="panel-heading"><div><h2>Your published assignments</h2><p>Student accounts in the selected grade can see published work.</p></div></div>${state.remoteTutorAssignments.length ? `<div class="lesson-list">${state.remoteTutorAssignments.map(item => `<article class="lesson-card"><div class="subject-art art-math">${icon('file')}</div><div class="lesson-info"><h3>${escapeHTML(item.title)}</h3><p>Grade ${escapeHTML(String(item.grade))} · ${escapeHTML(item.status)}</p></div><span class="task-tag">${escapeHTML(item.due_at || 'NO DUE DATE')}</span></article>`).join('')}</div>` : `<div class="empty-state">${icon('sparkle')}Publish an assignment above to get started.</div>`}</section>`;
}

function readApiSettings() {
  try { return JSON.parse(localStorage.getItem('brightpath-api') || '{}'); }
  catch { return {}; }
}

function readApiUser() {
  try { return JSON.parse(sessionStorage.getItem('brightpath-user') || 'null'); }
  catch { return null; }
}

function apiToken() {
  try { return sessionStorage.getItem('brightpath-token') || ''; }
  catch { return ''; }
}

function apiUrl(route) {
  return `${state.apiBase.replace(/\/+$/, '')}/api/index.php?r=${encodeURIComponent(route)}`;
}

async function loadTutorData(renderAfter = true) {
  state.remoteTutorDataLoaded = true;
  try {
    const [assignmentsResponse, submissionsResponse] = await Promise.all([
      apiRequest('assignments'),
      apiRequest('submissions')
    ]);
    state.remoteTutorAssignments = Array.isArray(assignmentsResponse.assignments) ? assignmentsResponse.assignments : [];
    state.remoteSubmissions = Array.isArray(submissionsResponse.submissions) ? submissionsResponse.submissions : [];
  } catch (error) {
    setApiStatus(`Tutor work could not load: ${error.message}`, 'error');
    if (error.message.includes('session expired') || error.message.includes('Sign in')) {
      sessionStorage.removeItem('brightpath-token');
      sessionStorage.removeItem('brightpath-user');
      window.BrightPathNative?.clearBiometricSessionFromApp?.();
      state.apiUser = null;
      roleSelect.disabled = false;
    }
    if (renderAfter) render();
    return false;
  }
  if (renderAfter) render();
  return true;
}

async function apiRequest(route, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = apiToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(apiUrl(route), { ...options, headers, mode: 'cors' });
  let result;
  try { result = await response.json(); }
  catch { throw new Error('The API returned an unreadable response. Check its PHP setup.'); }
  if (!response.ok || result.ok === false) throw new Error(result.error || `API request failed (${response.status}).`);
  return result;
}

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.remove('visible'), 2600);
}

function navMarkup() {
  const links = roles[state.role].links;
  const markup = links.map(([id, symbol, label, count]) => `
    <button class="nav-item ${state.page === id ? 'active' : ''}" data-page="${id}" ${state.page === id ? 'aria-current="page"' : ''}>
      <span class="nav-icon">${icon(symbol)}</span><span>${label}</span>${count ? `<span class="nav-count">${count}</span>` : ''}
    </button>`).join('');
  sideNav.innerHTML = markup;
  mobileNav.innerHTML = links.slice(0, 5).map(([id, symbol, label, count]) => `
    <button class="nav-item ${state.page === id ? 'active' : ''}" data-page="${id}" ${state.page === id ? 'aria-current="page"' : ''}>
      <span class="nav-icon">${icon(symbol)}</span><span>${label}</span>${count ? `<span class="nav-count">${count}</span>` : ''}
    </button>`).join('');
}

function header() {
  const user = roles[state.role];
  document.querySelector('#greeting').textContent = user.greeting;
  document.querySelector('#page-title').textContent = pageTitle();
  const displayName = state.apiUser?.name || (state.role === 'developer' ? 'Administrator setup' : state.role === 'student' ? 'Student' : `${roles[state.role].name} sign-in`);
  document.querySelector('#header-avatar').textContent = displayName[0].toUpperCase();
  document.querySelector('#header-name').textContent = displayName;
  document.querySelector('#profile-button').setAttribute(
    'aria-label',
    state.apiUser ? `Signed in as ${displayName}. Change workspace` : `${roles[state.role].name} sign-in. Change workspace`
  );
  document.querySelector('#header-avatar').className = `avatar ${state.role === 'parent' ? 'avatar-orange' : state.role === 'tutor' ? 'avatar-mint' : state.role === 'developer' ? 'avatar-blue' : 'avatar-purple'}`;
}

function pageTitle() {
  const link = roles[state.role].links.find(item => item[0] === state.page);
  return link ? link[2] : roles[state.role].title;
}

function welcome(title, subtitle) {
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  return `<div class="welcome-row"><div class="welcome-copy"><h1>${title}</h1><p>${subtitle}</p></div><div class="date-pill">${icon('clock')} ${date}</div></div>`;
}

function stat(label, value, note, iconName, theme, change = '') {
  return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${theme}">${icon(iconName)}</span></div><div class="stat-value">${value}${change ? `<span class="stat-change">${change}</span>` : ''}</div><div class="stat-foot">${note}</div></article>`;
}

function lessonRows(items = lessons) {
  if (!items.length) return `<div class="empty-state">${icon('search')}No lessons match that search. Try another word.</div>`;
  return `<div class="lesson-list">${items.map(lesson => {
    const done = state.completed.has(lesson.id);
    const progress = done ? 100 : lesson.progress;
    return `<article class="lesson-card" data-search="${lesson.title} ${lesson.subject}">
      <div class="subject-art ${lesson.art}">${icon(lesson.icon)}</div>
      <div class="lesson-info"><h3>${lesson.title}${done ? ' ✓' : ''}</h3><p>${lesson.subject} · ${done ? 'Completed' : 'Lesson 2 of 5'}</p></div>
      <div class="lesson-trailing"><span class="progress-label">${progress}%</span><div class="progress-track ${lesson.color}"><span style="width:${progress}%"></span></div></div>
      <button class="round-arrow" data-lesson="${lesson.id}" aria-label="Open ${lesson.title}">${done ? '↗' : '›'}</button>
    </article>`;
  }).join('')}</div>`;
}

function taskRows() {
  return `<div class="task-list">${assignments.map(task => {
    const done = task.done || state.assignmentDone.has(task.id);
    return `<article class="task-card" data-search="${task.title} ${task.detail}">
      <button class="task-check ${done ? 'done' : ''}" data-task="${task.id}" aria-label="${done ? 'Mark incomplete' : 'Mark complete'}: ${task.title}">${done ? '✓' : ''}</button>
      <div class="task-copy"><strong>${task.title}</strong><span>${task.detail}</span></div>
      <span class="task-tag ${task.due && !done ? 'due' : ''}">${done ? 'DONE' : task.tag}</span>
    </article>`;
  }).join('')}</div>`;
}

function lessonPanel() {
  return `<section class="panel"><div class="panel-heading"><div><h2>Pick up where you left off</h2><p>Your learning path is ready when you are.</p></div><button class="text-button" data-page="subjects">All subjects&nbsp; ↗</button></div>${lessonRows()}</section>`;
}

function assignmentsPanel() {
  return `<section class="panel"><div class="panel-heading"><div><h2>Coming up</h2><p>Small steps add up to big things.</p></div><button class="text-button" data-page="assignments">See all</button></div>${taskRows()}</section>`;
}

function streakPanel() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return `<section class="streak-card"><div class="streak-main"><span class="streak-flame">${icon('sparkle')}</span><div><h3>4 day streak</h3><p>You’re building a brilliant habit!</p></div></div><div class="week-dots">${days.map((day, i) => `<span class="week-day">${day}<i class="${i < 4 ? 'complete' : i === 5 ? 'active' : ''}">${i < 4 ? '✓' : i === 5 ? '•' : ''}</i></span>`).join('')}</div></section>`;
}

function liveClassCard() {
  return `<section class="class-card"><div class="class-topline"><span class="live-pill"><i></i> UP NEXT</span><span class="class-time">Today · 4:30 PM</span></div><h3>Math explorers: fractions</h3><p>Let’s make fractions make sense!</p><div class="tutor-line"><span class="avatar avatar-mint">M</span><span>with Ms. Maya · Grade 5</span></div><button class="primary-button" data-action="join-class">Join classroom <span>→</span></button></section>`;
}

function adCard() {
  return `<article class="ad-card"><div class="ad-art" aria-label="Illustration of books"><div class="book-stack"><span class="book">${icon('sparkle')}</span><span class="book">Aa</span><span class="book">${icon('sun')}</span></div></div><div class="ad-body"><span class="ad-label">PARENT-APPROVED PICK</span><h3>Stories for curious minds</h3><p>A hand-picked collection of age-friendly reads for your next big adventure.</p><a class="ad-link" href="#" data-action="book-pick">Explore book picks&nbsp; ↗</a><p class="ad-disclosure">Sponsored recommendation · No personalized ads</p></div></article>`;
}

function studentHome() {
  return `${welcome(`Hey Alex ${icon('sun', 'welcome-icon')}`, 'Ready to discover something new today? You’re doing amazing!')}
    <div class="dashboard-grid"><div class="main-column"><div class="stats-grid">
      ${stat('Learning time', '2.5h', 'This week', 'clock', 'purple', '↗ 12%')}
      ${stat('Lessons finished', `${8 + state.completed.size}`, 'You’re on a roll', 'check', 'mint', '↗ 2')}
      ${stat('Learning points', `${240 + state.completed.size * 20}`, 'Earned this month', 'sparkle', 'peach', '↗ 40')}
    </div>${lessonPanel()}${assignmentsPanel()}</div>
    <div class="side-column">${streakPanel()}${liveClassCard()}${adCard()}</div></div>`;
}

function parentHome() {
  return `${welcome('Your family’s learning story', 'A little look at the wonderful progress Alex is making.')}
    <div class="dashboard-grid"><div class="main-column">
      ${apiConnectionPanel()}
      <div class="stats-grid">${stat('Learning this week', '4.8h', 'Across 5 learning days', 'clock', 'purple', '↗ 18%')}${stat('Lessons completed', '12', 'Across 3 subjects', 'check', 'mint', '↗ 3')}${stat('Assignments due', '2', 'Next one due today', 'file', 'peach')}</div>
      <section class="panel"><div class="panel-heading"><div><h2>Alex’s subject progress</h2><p>Updated as learning activities are completed.</p></div><span class="task-tag">GRADE 5</span></div>
        ${[['Mathematics', 72], ['Science', 58], ['Reading', 84], ['Creative arts', 46]].map(([label, value], i) => `<div class="bar-row"><span>${label}</span><div class="progress-track ${i === 1 ? 'green' : i === 3 ? 'orange' : ''}"><span style="width:${value}%"></span></div><strong>${value}%</strong></div>`).join('')}
      </section>
      <section class="panel"><div class="panel-heading"><div><h2>Recent activity</h2><p>Celebrate the little wins together.</p></div><button class="text-button" data-page="progress">Full report</button></div>
        <div class="activity-list"><div class="activity-item"><span class="avatar avatar-purple">✓</span><p><strong>Finished “The secret garden”</strong><small>Reading · Today at 10:42 AM</small></p></div><div class="activity-item"><span class="avatar avatar-mint">✦</span><p><strong>Earned 20 learning points</strong><small>Science · Yesterday</small></p></div><div class="activity-item"><span class="avatar avatar-orange">◷</span><p><strong>Joined a live math class</strong><small>Mathematics · Yesterday</small></p></div></div>
      </section>
    </div><div class="side-column">${liveClassCard()}<section class="panel"><div class="panel-heading"><div><h2>Coming up</h2><p>Alex’s learning plan</p></div></div>${taskRows()}</section>${adCard()}<div class="inset-note">Parent tip: a quick “what was your favorite part?” is a lovely way to keep the learning conversation going.</div></div></div>`;
}

function tutorHome() {
  return `${welcome('Your teaching hub', 'Here’s what’s happening with your learners today.')}
    <div class="dashboard-grid"><div class="main-column">
      <div class="stats-grid">${stat('Active learners', '24', 'Across 6 classes', 'people', 'purple', '↗ 3')}${stat('Classes today', '4', 'Next class at 4:30 PM', 'clock', 'mint')}${stat('To review', '7', 'Assignments awaiting feedback', 'file', 'peach')}</div>
      ${apiConnectionPanel()}${tutorSubmissionsPanel()}${tutorAssignmentsPanel()}
      <section class="panel"><div class="panel-heading"><div><h2>Today’s classes</h2><p>Your schedule, all in one place.</p></div><button class="text-button" data-action="schedule">+ Plan a class</button></div>
       <div class="table-wrap"><table class="simple-table"><thead><tr><th>TIME</th><th>CLASS</th><th>LEARNERS</th><th>STATUS</th><th></th></tr></thead><tbody><tr><td>4:30 PM</td><td>Math explorers · Grade 5</td><td>8 students</td><td><span class="status">UP NEXT</span></td><td><button class="text-button" data-action="join-class">Open</button></td></tr><tr><td>5:30 PM</td><td>Science lab · Grade 6</td><td>6 students</td><td><span class="muted">Upcoming</span></td><td><button class="text-button" data-action="schedule">Details</button></td></tr><tr><td>6:30 PM</td><td>Reading circle · Grade 4</td><td>10 students</td><td><span class="muted">Upcoming</span></td><td><button class="text-button" data-action="schedule">Details</button></td></tr></tbody></table></div>
      </section>
      <section class="panel"><div class="panel-heading"><div><h2>Assignments to review</h2><p>Thoughtful feedback helps every learner grow.</p></div><button class="text-button" data-page="assignments">View queue</button></div>${taskRows()}</section>
    </div><div class="side-column">${liveClassCard()}<section class="panel"><div class="panel-heading"><div><h2>Learner check-in</h2><p>Progress across your classes</p></div></div>
      <div class="activity-list"><div class="activity-item"><span class="avatar avatar-purple">A</span><p><strong>Alex Morgan</strong><small>Grade 5 · On track · Last active today</small></p></div><div class="activity-item"><span class="avatar avatar-orange">S</span><p><strong>Sam Patel</strong><small>Grade 6 · Needs a check-in · 3 days ago</small></p></div><div class="activity-item"><span class="avatar avatar-blue">J</span><p><strong>Jordan Lee</strong><small>Grade 4 · On track · Last active yesterday</small></p></div></div></section>
      <div class="inset-note">Student wellbeing matters. Keep all messages kind, age-appropriate, and within the classroom.</div></div></div>`;
}

function developerHome() {
  return `${welcome('Platform overview', 'A live look at your learning platform workspace.')}<div class="page-section">
    <div class="developer-banner"><h2>Developer workspace <span class="demo-badge">DEMO DATA</span></h2><p>This console uses sample data in your browser. Connect a secure backend before managing real students or accounts.</p></div>
    <div class="stats-grid">${stat('Registered learners', '1,284', 'Sample platform data', 'people', 'purple')}${stat('Classes this week', '86', 'Across all grade levels', 'clock', 'mint')}${stat('Platform availability', '99.9%', 'Demo health indicator', 'chart', 'peach')}</div>
    <div class="feature-grid"><section class="panel"><div class="panel-heading"><div><h2>Platform health</h2><p>Example service status — not connected to production monitoring.</p></div><span class="status">NOMINAL</span></div>
      <div class="activity-list"><div class="activity-item"><span class="avatar avatar-mint">✓</span><p><strong>Learning content</strong><small>All demo modules available</small></p></div><div class="activity-item"><span class="avatar avatar-mint">✓</span><p><strong>Classroom service</strong><small>Demo interface available; video provider not connected</small></p></div><div class="activity-item"><span class="avatar avatar-orange">!</span><p><strong>Notifications & accounts</strong><small>Browser-only demo; secure server setup required</small></p></div></div>
    </section><section class="panel"><div class="panel-heading"><div><h2>Active users by role</h2><p>Illustrative data for the admin dashboard.</p></div></div>
      ${[['Students', 84], ['Parents', 31], ['Tutors', 17], ['Developers', 5]].map(([label, value], i) => `<div class="bar-row"><span>${label}</span><div class="progress-track ${i === 1 ? 'green' : i === 2 ? 'orange' : ''}"><span style="width:${value}%"></span></div><strong>${value}</strong></div>`).join('')}
    </section></div><section class="panel"><div class="panel-heading"><div><h2>Production readiness</h2><p>Important steps before real families and students use the service.</p></div></div>
      <div class="feature-grid"><div class="feature-card"><span class="status">NEXT STEP</span><h3>Secure accounts & family consent</h3><p>Add server-side roles, protected sign-in, parent/guardian consent, and student data controls appropriate for your region.</p></div><div class="feature-card"><span class="demo-badge">NOT CONNECTED</span><h3>Real-time classroom provider</h3><p>Choose and configure a video service, access controls, moderation, and age-appropriate classroom safety.</p></div><div class="feature-card"><span class="demo-badge">NOT CONNECTED</span><h3>Database & backups</h3><p>Use a secure backend with access rules, encrypted connections, backups, and tested account recovery.</p></div><div class="feature-card"><span class="demo-badge">NOT CONNECTED</span><h3>Push notifications</h3><p>Web notifications need HTTPS and permission; reliable background delivery also requires a push service and server.</p></div></div>
    </section></div>`;
}

function fullPage() {
  if (state.page === 'home') {
    if (state.role === 'parent') return parentHome();
    if (state.role === 'tutor') return tutorHome();
    if (state.role === 'developer') return developerHome();
    return studentHome();
  }
  if (state.role === 'student' && state.page === 'subjects') return `${welcome('Your subjects', 'Your school’s learning materials will appear here.')}<div class="page-section">${!state.apiUser ? apiConnectionPanel() : emptyPanel('No lessons yet', 'Your school has not published lessons for your account yet.')}</div>`;
  if (state.page === 'classes') return classPage();
  if (state.page === 'assignments') return assignmentPage();
  if (state.page === 'progress') return progressPage();
  if (state.page === 'children') return parentChildrenPage();
  if (state.page === 'students') return tutorStudentsPage();
  if (state.page === 'messages') return messagePage();
  if (['users', 'content', 'health', 'settings'].includes(state.page)) return developerPage();
  return `${welcome(pageTitle(), 'Everything you need for a happy, healthy learning journey.')}<section class="panel"><div class="empty-state">${icon('sparkle')}This is your ${pageTitle().toLowerCase()} space. More tools are ready to connect as the platform grows.</div></section>`;
}

function classPage() {
  return `${welcome(state.role === 'student' ? 'Live classes' : state.role === 'parent' ? 'Classes & schedule' : 'Your classrooms', 'Learn together, ask questions, and share ideas in a safe classroom.')}
    <div class="page-section"><div class="feature-grid">${[['4:30 PM', 'Math explorers: fractions', 'Ms. Maya · Grade 5', 'UP NEXT'], ['Tomorrow · 3:00 PM', 'Science lab: plant life', 'Mr. Owen · Grade 5', 'TOMORROW'], ['Monday · 4:00 PM', 'Reading circle', 'Ms. Maya · Grade 5', 'MONDAY']].map((c, i) => `<article class="class-card"><div class="class-topline"><span class="${i === 0 ? 'live-pill' : 'task-tag'}">${i === 0 ? '<i></i> ' : ''}${c[3]}</span><span class="class-time">${c[0]}</span></div><h3>${c[1]}</h3><p>Interactive lesson · Classroom opens 5 minutes early</p><div class="tutor-line"><span class="avatar avatar-mint">${c[2][0]}</span><span>${c[2]}</span></div><button class="primary-button" data-action="join-class">${i === 0 ? 'Open classroom →' : 'View class details →'}</button></article>`).join('')}</div><div class="callout">Classroom preview: joining starts a local demo room. Real video calls, private class access, attendance records, and moderation require a configured backend and video provider.</div></div>`;
}

function assignmentPage() {
  const remoteAssignments = state.remoteAssignments || [];
  return `${welcome('Your assignments', 'Choose a task, add your work, and send it to your teacher.')}
    <div class="page-section">
      <div class="assignment-intro"><span class="assignment-illustration" aria-hidden="true">${icon('file')}</span><div><strong>Ready when you are, Alex!</strong><p>Take a photo of your work or pick a file from your device.</p></div></div>
      ${apiConnectionPanel()}
      ${remoteAssignments.length ? `<section class="panel"><div class="panel-heading"><div><h2>Assignments from your school</h2><p>Choose an assignment to attach and submit your work.</p></div><span class="status">CONNECTED</span></div>${remoteAssignments.map(remoteAssignmentCard).join('')}</section>` : ''}
      <section class="panel"><div class="panel-heading"><div><h2>Practice tasks</h2><p>These are sample tasks until your school connects its API.</p></div></div>${taskRows()}<div class="callout">Connect to the school API above to see assigned work and submit it for tutor review.</div></section>
      <div class="callout">Photos and documents are sent only after you press <strong>Submit work</strong> and sign in to a school server. Ask a parent or guardian before submitting personal information.</div>
    </div>`;
}

function apiConnectionPanel() {
  const connected = Boolean(apiToken() && state.apiUser);
  const canConfigureApi = state.role === 'developer';
  const learner = state.role === 'student';
  const biometricAvailable = Boolean(window.BrightPathNative?.isBiometricAvailable?.());
  const hasBiometricSession = Boolean(window.BrightPathNative?.hasBiometricSession?.());
  return `<section class="panel api-panel ${learner ? 'learner-login-panel' : ''}"><div class="panel-heading"><div><h2>${learner ? 'Let’s get learning!' : 'School sign-in'}</h2><p>${learner ? 'Your school sets up your account. Ask a parent or teacher if you need help.' : 'Sign in with the account provided by your school.'}</p></div><span class="demo-badge">${connected ? 'SIGNED IN' : learner ? 'STUDENT' : 'SCHOOL'}</span></div>
    ${canConfigureApi ? `<label class="form-label" for="api-base-input">Developer API test override</label>
      <div class="api-url-row"><input id="api-base-input" type="url" inputmode="url" placeholder="https://your-school-site.example" value="${escapeHTML(state.apiBase)}" autocomplete="url"><button class="secondary-button" data-action="test-api">Test connection</button></div>
      <p class="form-hint">This override is saved on this device only. For all users, set the public API origin in site-config.js. Database credentials stay on the PHP server.</p>`
      : learner ? '' : `<p class="form-hint">School API: ${escapeHTML(state.apiBase || 'Not configured. Ask your school administrator.')}</p>`}
    <div class="api-status ${state.apiStatus.startsWith('Connected') ? 'success' : state.apiStatus ? 'error' : ''}" id="api-status" role="status">${escapeHTML(state.apiStatus || (learner ? 'Your school account is ready when you sign in.' : 'Connection has not been tested on this device.'))}</div>
    ${connected ? `<div class="signed-in-row"><span>Signed in as <strong>${escapeHTML(state.apiUser.name || state.apiUser.email)}</strong></span><button class="text-button" data-action="api-signout">Sign out</button></div>
      ${biometricAvailable && !hasBiometricSession ? '<button class="secondary-button biometric-enroll" data-action="enable-biometric">Turn on fingerprint sign-in</button>' : ''}`
      : `<form class="api-login-form" id="api-login-form"><h3>${learner ? 'Sign in to your class' : 'School account'}</h3><div class="login-fields"><label class="form-label">${learner ? 'School email' : 'Email'}<input name="email" type="email" autocomplete="username" required maxlength="190" placeholder="${learner ? 'Your school email' : 'name@school.org'}"></label><label class="form-label">Password<input name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="128" placeholder="Your password"></label></div><button class="primary-button" type="submit">${learner ? 'Start learning' : 'Sign in securely'} <span aria-hidden="true">→</span></button>
      ${biometricAvailable && hasBiometricSession ? '<button class="secondary-button biometric-login" type="button" data-action="biometric-login">Sign in with fingerprint</button>' : ''}
      <p class="form-hint">${learner ? 'Need help signing in? Ask your parent, teacher, or tutor. You never need to set up a school connection.' : 'Your sign-in token stays in this app session and is not included in GitHub.'}</p>${learner ? '<button class="text-button role-entry-link" type="button" data-action="choose-workspace">Parent or tutor sign-in</button>' : ''}</form>`}
    ${!connected && state.role === 'developer' ? `<form class="api-login-form" id="api-bootstrap-form"><h3>One-time school administrator setup</h3><p class="form-hint">Use only once after importing the database. Keep the setup key private, then remove it from the server configuration.</p><div class="login-fields"><label class="form-label">Administrator name<input name="name" required maxlength="120" autocomplete="name"></label><label class="form-label">Administrator email<input name="email" type="email" required maxlength="190" autocomplete="email"></label><label class="form-label">Strong password<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label><label class="form-label">One-time setup key<input name="bootstrap_key" type="password" required autocomplete="off"></label></div><button class="primary-button" type="submit">Create first administrator</button></form>` : ''}
    ${connected && state.apiUser.role === 'admin' ? `<form class="api-login-form" id="api-create-user-form"><h3>Create a school account</h3><div class="login-fields"><label class="form-label">Full name<input name="name" required maxlength="120" autocomplete="name"></label><label class="form-label">Email<input name="email" type="email" required maxlength="190" autocomplete="email"></label><label class="form-label">Role<select name="role" required><option value="student">Student</option><option value="parent">Parent</option><option value="tutor">Tutor</option></select></label><label class="form-label" id="new-user-grade-label">Student grade<select name="grade" required>${Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}">Grade ${i + 1}</option>`).join('')}</select></label><label class="form-label">Temporary password<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label></div><button class="primary-button" type="submit">Create account</button><p class="form-hint">Share temporary credentials privately with a parent or guardian. A parent-student link must be verified before enabling family records.</p></form>` : ''}
    ${connected && ['tutor', 'admin'].includes(state.apiUser.role) ? `<form class="api-login-form" id="api-create-assignment-form"><h3>Create an assignment</h3><div class="login-fields"><label class="form-label">Assignment title<input name="title" required maxlength="180"></label><label class="form-label">Grade<select name="grade" required>${Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}">Grade ${i + 1}</option>`).join('')}</select></label><label class="form-label">Answer type<select name="assignment_type" id="assignment-type"><option value="file">Photo or file upload</option><option value="choice">Multiple choice · auto-marked</option><option value="text">Written answer · tutor review</option></select></label><label class="form-label">Due date<input name="due_at" type="date"></label><label class="form-label wide-field">Instructions<textarea name="description" rows="2" maxlength="5000" placeholder="What should learners do?"></textarea></label><div class="wide-field assignment-question-fields" id="assignment-question-fields" hidden><label class="form-label">Question<textarea name="question_text" rows="2" maxlength="3000" placeholder="Type your question"></textarea></label><div id="assignment-choice-fields" hidden><div class="choice-authoring">${[0, 1, 2, 3].map(index => `<label class="form-label">Answer ${String.fromCharCode(65 + index)}<input name="choice_${index}" maxlength="300" placeholder="Answer option ${String.fromCharCode(65 + index)}"></label>`).join('')}</div><label class="form-label">Correct answer<select name="correct_choice">${[0, 1, 2, 3].map(index => `<option value="${index}">Answer ${String.fromCharCode(65 + index)}</option>`).join('')}</select></label></div></div><label class="form-label wide-field">Optional assignment document (PDF or Word)<input name="resource_file" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"><span class="form-hint">Learners can securely download this file from their assignment. Maximum 8 MB.</span></label></div><button class="primary-button" type="submit">Publish assignment</button></form>` : ''}
    ${window.BrightPathNative && state.role === 'developer' ? '<button class="secondary-button reminder-test" data-action="schedule-reminder">Try a 1-minute notification</button>' : ''}
    ${learner ? '' : '<div class="callout api-safety">For student privacy, database credentials and setup keys stay on the server and must never be entered in this app.</div>'}
  </section>`;
}

function remoteAssignmentCard(item) {
  const id = Number(item.id);
  const due = item.due_at ? new Date(`${item.due_at}T00:00:00`).toLocaleDateString() : 'No due date';
  const type = item.assignment_type || 'file';
  const choices = type === 'choice' ? JSON.parse(item.choices_json || '[]') : [];
  const statusText = type === 'choice' && item.submitted
    ? Number(item.is_correct) === 1 ? 'CORRECT' : 'TRY AGAIN'
    : item.submitted ? 'SUBMITTED' : due;
  const questionContent = type === 'choice'
    ? `<fieldset class="question-answer"><legend>${escapeHTML(item.question_text || 'Choose the best answer')}</legend>${choices.map((choice, index) => `<label class="answer-choice"><input type="radio" name="answer-${id}" value="${index}" ${item.selected_choice !== null && Number(item.selected_choice) === index ? 'checked' : ''}><span>${escapeHTML(choice)}</span></label>`).join('')}</fieldset>`
    : type === 'text'
      ? `<label class="form-label question-answer">${escapeHTML(item.question_text || 'Write your answer')}<textarea maxlength="5000" rows="4" data-answer-text="${id}" placeholder="Write your answer here">${escapeHTML(item.answer_text || '')}</textarea></label>`
      : `<div class="attachment-picker">
      <label class="attachment-button camera-button">${icon('camera')} Take a photo<input type="file" accept="image/*" capture="environment" data-file-assignment="${id}" aria-label="Take a photo for ${escapeHTML(item.title)}"></label>
      <label class="attachment-button">${icon('file')} Choose a file<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" data-file-assignment="${id}" aria-label="Choose a file for ${escapeHTML(item.title)}"></label>
    </div>
    <div class="selected-file" id="selected-file-${id}">${item.submitted ? 'Your teacher has your work · You can send an updated file' : 'No file selected · Photos or PDF, up to 8 MB'}</div>
    <label class="form-label notes-label">Note for your tutor <textarea maxlength="1000" rows="2" data-note-assignment="${id}" placeholder="Add a short note (optional)"></textarea></label>`;
  return `<article class="remote-assignment" data-remote-assignment="${id}">
    <div class="remote-assignment-top"><div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description || 'Add your work for your teacher to review.')}</p></div><span class="task-tag ${item.submitted && !(type === 'choice' && Number(item.is_correct) === 0) ? '' : 'due'}">${escapeHTML(statusText)}</span></div>
    ${item.resource_original_filename ? `<button class="resource-download" data-action="download-assignment-resource" data-assignment-id="${id}">${icon('download')} Download ${escapeHTML(item.resource_original_filename)}</button>` : ''}
    ${questionContent}
    <button class="primary-button submit-work-button" data-action="submit-work" data-assignment-id="${id}">${type === 'file' ? 'Submit work' : 'Send answer'} <span>→</span></button>
  </article>`;
}

function progressPage() {
  return `${welcome(state.role === 'parent' ? 'Learning progress' : 'Look at you go!', 'Every lesson, question, and practice session adds up.')}<div class="page-section"><div class="stats-grid">${stat('Learning time', '4.8h', 'This week', 'clock', 'purple', '↗ 18%')}${stat('Learning days', '5', 'You showed up!', 'check', 'mint')}${stat('Learning streak', '4 days', 'Keep it going', 'sparkle', 'peach')}</div><section class="panel"><div class="panel-heading"><div><h2>Your learning week</h2><p>Minutes spent learning each day.</p></div></div><div class="chart-bars">${[32, 58, 45, 80, 68, 34, 17].map((v, i) => `<div class="chart-column"><i style="height:${v}%"></i><span>${['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span></div>`).join('')}</div></section><section class="panel"><div class="panel-heading"><div><h2>Subjects you’re growing in</h2><p>Your progress is personal. Keep exploring at your own pace.</p></div></div>${[['Mathematics', 72], ['Science', 58], ['Reading', 84], ['Creative arts', 46]].map(([label, value], i) => `<div class="bar-row"><span>${label}</span><div class="progress-track ${i === 1 ? 'green' : i === 3 ? 'orange' : ''}"><span style="width:${value}%"></span></div><strong>${value}%</strong></div>`).join('')}</section></div>`;
}

function parentChildrenPage() {
  return `${welcome('Your children', 'Stay close to their learning, at every age and every stage.')}<div class="page-section"><section class="panel"><div class="panel-heading"><div><h2>Family learning profiles</h2><p>Family view is a sample dashboard in this demo.</p></div><button class="text-button" data-action="family-info">+ Add child</button></div><div class="feature-grid"><article class="feature-card"><div class="activity-item"><span class="avatar avatar-purple">A</span><p><strong>Alex Morgan · Grade 5</strong><small>Active today · 4-day learning streak</small></p></div><h3>This week: 4.8 hours</h3><div class="progress-track"><span style="width:72%"></span></div><button class="primary-button" data-page="progress">View learning progress</button></article><article class="feature-card"><div class="activity-item"><span class="avatar avatar-orange">S</span><p><strong>Sam Morgan · Grade 2</strong><small>Active yesterday · 2-day learning streak</small></p></div><h3>This week: 2.2 hours</h3><div class="progress-track green"><span style="width:44%"></span></div><button class="primary-button" data-action="family-info">View learner summary</button></article></div></section><div class="callout">Family profiles, account linking, and private records need a secure parent account and server-side access controls before launch.</div></div>`;
}

function tutorStudentsPage() {
  return `${welcome('Your learners', 'Make space for every student to shine.')}<div class="page-section"><section class="panel"><div class="panel-heading"><div><h2>My students</h2><p>Sample learner roster · Grade-level views only.</p></div><button class="text-button" data-action="family-info">+ Invite learner</button></div><div class="table-wrap"><table class="simple-table"><thead><tr><th>LEARNER</th><th>GRADE</th><th>LAST ACTIVE</th><th>PROGRESS</th><th>STATUS</th></tr></thead><tbody><tr><td>Alex Morgan</td><td>5</td><td>Today</td><td>72%</td><td><span class="status">ON TRACK</span></td></tr><tr><td>Sam Patel</td><td>6</td><td>3 days ago</td><td>48%</td><td><span class="task-tag due">CHECK IN</span></td></tr><tr><td>Jordan Lee</td><td>4</td><td>Yesterday</td><td>67%</td><td><span class="status">ON TRACK</span></td></tr><tr><td>Riley Chen</td><td>5</td><td>Today</td><td>81%</td><td><span class="status">ON TRACK</span></td></tr></tbody></table></div></section><div class="callout">For student safety, real rosters and tutor access should be protected by verified school or family accounts, role-based permissions, and guardian consent.</div></div>`;
}

function messagePage() {
  return `${welcome('Messages', 'Keep learning conversations encouraging, helpful, and kind.')}<div class="page-section"><section class="panel"><div class="panel-heading"><div><h2>Your conversations</h2><p>Demo message previews — no messages are sent to a server.</p></div></div><div class="activity-list"><div class="activity-item"><span class="avatar avatar-mint">M</span><p><strong>Ms. Maya · Your math tutor</strong><small>“Great question about fractions, Alex! We’ll explore it together in class.” · Today</small></p></div><div class="activity-item"><span class="avatar avatar-orange">J</span><p><strong>Jamie · Parent</strong><small>“I’m proud of your reading streak!” · Yesterday</small></p></div></div><button class="primary-button" data-action="message-info">Start a conversation</button></section><div class="callout">Real messaging for children requires strict account permissions, moderation and reporting tools, guardian controls, and a secure service.</div></div>`;
}

function developerPage() {
  const titles = { users: 'Users & roles', content: 'Learning content', health: 'System health', settings: 'Platform settings' };
  const text = {
    users: 'Manage sample account roles. In production, role assignment and permissions must be enforced securely on the server.',
    content: 'Organize learning material for grades 1–8. Curated third-party recommendations should be clearly labeled and reviewed for age suitability.',
    health: 'This prototype does not connect to servers or third-party providers, so the indicators below are illustrative only.',
    settings: 'Configure accessibility, privacy, localization, and age-appropriate safety before launch.'
  };
  if (state.page === 'settings') {
    return `${welcome(titles.settings, 'Connect your Android app and website to a private, secure school API.')}
      <div class="page-section">${apiConnectionPanel()}
        <section class="panel"><div class="panel-heading"><div><h2>Android app setup</h2><p>Build and install the native BrightPath app.</p></div><span class="demo-badge">ANDROID PROJECT</span></div>
          <ol class="setup-steps"><li>Open the <strong>android</strong> folder in Android Studio and let it sync Gradle.</li><li>Install the Android SDK if Android Studio asks, then choose <strong>Build → Build APK(s)</strong>.</li><li>Install the debug APK on a test phone; the app opens as BrightPath and can work offline.</li><li>For the school server, enter its HTTPS address in the app’s School connection panel and sign in with a student account.</li></ol>
          <div class="callout">For command-line builds, use Java 17 and Android SDK platform 35/build-tools 35.0.0: <code>.\android\gradlew.bat assembleDebug</code>. Debug APKs are for testing; use the signed release workflow for public downloads.</div>
        </section>
      </div>`;
  }
  return `${welcome(titles[state.page], text[state.page])}<div class="page-section"><div class="developer-banner"><h2>${titles[state.page]} <span class="demo-badge">DEMO CONSOLE</span></h2><p>Changes here are not connected to user accounts or production services.</p></div><section class="panel"><div class="panel-heading"><div><h2>${state.page === 'users' ? 'Sample accounts' : state.page === 'content' ? 'Sample content library' : state.page === 'health' ? 'Service checklist' : 'Launch checklist'}</h2><p>Example entries for the developer workspace.</p></div><button class="text-button" data-action="family-info">+ Add item</button></div><div class="table-wrap"><table class="simple-table"><thead><tr><th>AREA</th><th>DETAIL</th><th>STATUS</th></tr></thead><tbody>${(state.page === 'users' ? [['Student', 'Grade 5 learner profile', 'Sample'], ['Parent', 'Guardian dashboard', 'Sample'], ['Tutor', 'Classroom instructor', 'Sample']] : state.page === 'content' ? [['Mathematics', 'Fractions · Grade 5', 'Draft'], ['Science', 'Plant life · Grade 5', 'Draft'], ['Reading', 'Story collection · Grade 5', 'Review']] : [['Authentication', 'Secure sign-in and role checks', 'Not connected'], ['Database', 'Protected student records', 'Not connected'], ['Video & messaging', 'Live classroom provider', 'Not connected']]).map(row => `<tr><td>${row[0]}</td><td>${row[1]}</td><td><span class="task-tag due">${row[2]}</span></td></tr>`).join('')}</tbody></table></div></section></div>`;
}

function emptyPanel(title, message) {
  return `<section class="panel"><div class="panel-heading"><div><h2>${escapeHTML(title)}</h2></div></div><div class="empty-state">${icon('book')}${escapeHTML(message)}</div></section>`;
}

function studentHome() {
  const name = escapeHTML(state.apiUser?.name || 'Learner');
  const content = !state.apiUser
  ? apiConnectionPanel()
  : !state.remoteAssignmentsLoaded
    ? emptyPanel('Assignments', 'Loading assignments from your school…')
    : state.remoteAssignments.length
      ? `<section class="panel"><div class="panel-heading"><div><h2>Your assignments</h2><p>Published by your school for your grade.</p></div></div>${state.remoteAssignments.map(remoteAssignmentCard).join('')}</section>`
      : emptyPanel('Assignments', 'Your school has not published an assignment for your grade yet.');
  return `${welcome(`Welcome, ${name}`, 'Your learning activity will appear here when your school publishes it.')}
  <div class="page-section">${content}${emptyPanel('Lessons', 'No lessons have been published to your account yet.')}${emptyPanel('Live classes', 'No live classes are scheduled for your account.')}</div>`;
}

function parentHome() {
  const content = !state.apiUser
  ? apiConnectionPanel()
  : emptyPanel('Linked learners', 'No learner accounts are linked to this parent account yet.');
  return `${welcome('Family overview', 'See learning activity for accounts securely linked to your family.')}
  <div class="page-section">${content}${emptyPanel('Recent activity', 'Activity will appear here after family linking and progress reporting are configured.')}</div>`;
}

function tutorHome() {
  if (!state.apiUser) {
  return `${welcome('Tutor workspace', 'Sign in with your school account to manage your assignments.')}<div class="page-section">${apiConnectionPanel()}</div>`;
  }
  if (!state.remoteTutorDataLoaded) {
  return `${welcome('Tutor workspace', 'Loading your school records.')}<div class="page-section">${emptyPanel('Tutor data', 'Loading assignments and submissions…')}</div>`;
  }
  return `${welcome(`Welcome, ${escapeHTML(state.apiUser.name || 'Tutor')}`, 'Your published assignments and student submissions from the school database.')}
  <div class="page-section">${apiConnectionPanel()}${tutorSubmissionsPanel()}${tutorAssignmentsPanel()}</div>`;
}

function developerHome() {
  return `${welcome('Developer workspace', 'Configure the school connection and manage real school records.')}
  <div class="page-section">${apiConnectionPanel()}${emptyPanel('Platform services', 'Class scheduling, live video, class chat, family linking, and lesson management are not connected to the school database yet.')}</div>`;
}

function fullPage() {
  if (state.page === 'home') {
  if (state.role === 'parent') return parentHome();
  if (state.role === 'tutor') return tutorHome();
  if (state.role === 'developer') return developerHome();
  return studentHome();
  }
  if (state.page === 'subjects') return emptyPanel('Lessons', 'No lessons have been published to your account yet.');
  if (state.page === 'classes') return classPage();
  if (state.page === 'assignments') return assignmentPage();
  if (state.page === 'progress') return progressPage();
  if (state.page === 'children') return parentChildrenPage();
  if (state.page === 'students') return tutorStudentsPage();
  if (state.page === 'messages') return messagePage();
  if (['users', 'content', 'health', 'settings'].includes(state.page)) return developerPage();
  return emptyPanel(pageTitle(), 'There is no school data available for this section yet.');
}

function classPage() {
  return `${welcome('Live classes', 'Scheduled classes from your school will appear here.')}
  <div class="page-section">${!state.apiUser ? apiConnectionPanel() : emptyPanel('No scheduled classes', 'Your school has not scheduled a class for your account. Live video and class chat require a school-configured Jitsi server.')}</div>`;
}

function assignmentPage() {
  const isSchoolStaff = ['tutor', 'admin'].includes(state.apiUser?.role);
  const content = !state.apiUser
  ? apiConnectionPanel()
  : !state.remoteAssignmentsLoaded
    ? emptyPanel('Assignments', 'Loading assignments from your school…')
    : state.remoteAssignments.length
      ? `<section class="panel"><div class="panel-heading"><div><h2>${isSchoolStaff ? 'School assignments' : 'Your assignments'}</h2><p>Current records loaded from the school database.</p></div></div>${state.remoteAssignments.map(remoteAssignmentCard).join('')}</section>`
      : emptyPanel('No assignments', 'There are no current assignments for this account.');
  return `${welcome('Assignments', 'Assignments and submissions are loaded from your school account.')}
  <div class="page-section">${isSchoolStaff ? apiConnectionPanel() : ''}${content}</div>`;
}

function progressPage() {
  return `${welcome('Learning progress', 'Progress reports are based on activity recorded by your school.')}
  <div class="page-section">${!state.apiUser ? apiConnectionPanel() : emptyPanel('No progress records', 'No learning activity has been recorded for this account yet.')}</div>`;
}

function parentChildrenPage() {
  return `${welcome('Linked learners', 'Only learners linked to your verified parent account can appear here.')}
  <div class="page-section">${!state.apiUser ? apiConnectionPanel() : emptyPanel('No linked learners', 'There are no learner accounts linked to this parent account.')}</div>`;
}

function tutorStudentsPage() {
  return `${welcome('My learners', 'Your school roster will appear here when learner assignments are configured.')}
  <div class="page-section">${!state.apiUser ? apiConnectionPanel() : emptyPanel('No learner roster', 'No learner records are available to this tutor account.')}</div>`;
}

function messagePage() {
  return `${welcome('Messages', 'Class conversations are available only in scheduled school classrooms.')}
  <div class="page-section">${!state.apiUser ? apiConnectionPanel() : emptyPanel('No conversations', 'No classroom conversations are available for this account yet.')}</div>`;
}

function developerPage() {
  const titles = { users: 'Users & roles', content: 'Learning content', health: 'System health', settings: 'Platform settings' };
  if (state.page === 'settings' || state.page === 'health' || state.page === 'users') {
  return `${welcome(titles[state.page], 'Developer-only controls and live school API status.')}
    <div class="page-section">${apiConnectionPanel()}${state.page === 'users' && state.apiUser?.role === 'admin'
      ? emptyPanel('School accounts', 'Use the account form above to create database-backed accounts. The API does not yet provide account listing or editing.')
      : ''}</div>`;
  }
  return `${welcome(titles.content, 'Published learning material for students will be managed here.')}
  <div class="page-section">${!state.apiUser ? apiConnectionPanel() : emptyPanel('No learning content', 'No learning content is available from the school database yet.')}</div>`;
}

function render() {
  navMarkup();
  header();
  document.body.classList.toggle('student-space', state.role === 'student');
  roleSelect.value = state.role;
  roleSelect.disabled = Boolean(state.apiUser);
  pageContent.innerHTML = fullPage();
  filterSearch(document.querySelector('#search-input').value);
  if (state.apiUser?.role === 'admin') {
    const roleInput = document.querySelector('#api-create-user-form [name="role"]');
    const gradeLabel = document.querySelector('#new-user-grade-label');
    if (roleInput && gradeLabel) {
      gradeLabel.hidden = roleInput.value !== 'student';
      gradeLabel.querySelector('select').required = roleInput.value === 'student';
    }
  }
  if (['home', 'assignments'].includes(state.page) && state.role === 'student' && apiToken()
      && !state.remoteAssignmentsLoaded) loadRemoteAssignments();
  if (state.page === 'home' && state.role === 'tutor' && apiToken()
      && ['tutor', 'admin'].includes(state.apiUser?.role) && !state.remoteTutorDataLoaded) loadTutorData();
}

function filterSearch(query) {
  const q = query.trim().toLowerCase();
  document.querySelectorAll('[data-search]').forEach(item => {
    item.hidden = Boolean(q) && !item.dataset.search.toLowerCase().includes(q);
  });
  const sections = document.querySelectorAll('.lesson-list, .task-list');
  sections.forEach(section => {
    const visible = [...section.children].some(child => !child.hidden);
    section.dataset.empty = visible ? '' : 'true';
  });
}

function showLesson(id) {
  const lesson = lessons.find(item => item.id === id);
  if (!lesson) return;
  const complete = state.completed.has(id);
  document.querySelector('#modal-root').innerHTML = `<div class="modal-backdrop" data-close-modal><section class="modal" role="dialog" aria-modal="true" aria-labelledby="lesson-title"><div class="modal-top"><div><span class="eyebrow">${lesson.subject} · GRADE 5</span><h2 id="lesson-title">${lesson.title}</h2></div><button class="modal-close" data-close-modal aria-label="Close">×</button></div><p>Let’s learn by trying a quick question. Take your time—you can always try again!</p><div class="quiz-question">${id === 'fractions' ? 'Which fraction is the same as one half?' : id === 'plants' ? 'Which part of a plant takes in water from the soil?' : 'What do we call the main character in a story?'}</div><div class="quiz-options">${(id === 'fractions' ? [['1/4', false], ['2/4', true], ['3/4', false]] : id === 'plants' ? [['Roots', true], ['Petals', false], ['Seeds', false]] : [['The narrator', false], ['The protagonist', true], ['The author', false]]).map(([answer, correct]) => `<button class="quiz-option" data-answer="${correct}">${answer}</button>`).join('')}</div><div class="quiz-feedback" role="status"></div><button class="primary-button" data-action="finish-lesson" data-lesson="${id}" ${complete ? 'disabled' : ''}>${complete ? 'Lesson completed ✓' : 'Finish lesson and earn 20 points'}</button></section></div>`;
}

function showRolePicker() {
  const entries = state.apiUser
    ? Object.entries(roles).filter(([id]) => id === (state.apiUser.role === 'admin' ? 'developer' : state.apiUser.role))
    : Object.entries(roles);
  const options = entries.map(([id, role]) => `
    <button class="search-result" data-role="${id}" ${state.role === id ? 'aria-current="true"' : ''}>
      <strong>${role.name}${state.role === id ? ' · Current workspace' : ''}</strong>
      <span>${role.title}</span>
    </button>`).join('');
  document.querySelector('#modal-root').innerHTML = `<div class="modal-backdrop" data-close-modal><section class="modal" role="dialog" aria-modal="true" aria-labelledby="role-title"><div class="modal-top"><div><span class="eyebrow">BRIGHTPATH</span><h2 id="role-title">Choose a workspace</h2></div><button class="modal-close" data-close-modal aria-label="Close">×</button></div><p>Sign in with the account for the workspace you need.</p><div class="search-results">${options}</div></section></div>`;
}

function joinClass() {
  const root = document.querySelector('#modal-root');
  root.innerHTML = `<section class="live-room" role="dialog" aria-modal="true" aria-label="Math explorers classroom">
    <div class="room-stage"><div class="room-heading"><strong>Math explorers: fractions <span class="demo-badge">CLASSROOM PREVIEW</span></strong><span>4:30 PM · Grade 5</span></div><div class="video-placeholder"><div class="teacher-visual">M</div><span class="teacher-label">Ms. Maya · Video provider not connected</span></div><div class="room-controls"><button class="room-control" data-room-control="Mic">${icon('microphone')} Mic on</button><button class="room-control" data-room-control="Camera">${icon('camera')} Camera on</button><button class="room-control" data-room-control="Hand">${icon('hand')} Raise hand</button><button class="room-control leave" data-action="leave-class">Leave class</button></div></div>
    <aside class="room-chat"><div class="chat-header">Class chat · Demo</div><div class="chat-messages" id="chat-messages"><div class="chat-message"><strong>Ms. Maya</strong>Welcome to class! What do you already know about fractions?</div><div class="chat-message"><strong>Alex</strong>I know a half means one of two equal parts!</div>${state.chat.map(msg => `<div class="chat-message"><strong>You</strong>${escapeHTML(msg)}</div>`).join('')}</div><form class="chat-compose" id="chat-form"><input name="message" maxlength="160" placeholder="Say something kind..." aria-label="Class chat message" required><button aria-label="Send message">➤</button></form></aside>
  </section>`;
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function setApiStatus(message, kind = '') {
  state.apiStatus = message;
  const status = document.querySelector('#api-status');
  if (status) {
    status.textContent = message;
    status.className = `api-status ${kind}`;
  }
}

function saveApiBase(value) {
  let url;
  try { url = new URL(value.trim()); }
  catch { throw new Error('Enter your complete HTTPS website address.'); }
  const localDevelopment = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(localDevelopment && url.protocol === 'http:')) {
    throw new Error('The school API must use HTTPS. HTTP is allowed only for local testing.');
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Enter only the website origin, without a path, password, or query string.');
  }
  if (state.apiBase && state.apiBase !== url.origin) {
    sessionStorage.removeItem('brightpath-token');
    sessionStorage.removeItem('brightpath-user');
    state.apiUser = null;
    state.remoteAssignments = [];
    state.remoteAssignmentsLoaded = false;
    state.remoteTutorAssignments = [];
    state.remoteSubmissions = [];
    state.remoteTutorDataLoaded = false;
    state.remoteTutorAssignments = [];
    state.remoteSubmissions = [];
    state.remoteTutorDataLoaded = false;
  }
  state.apiBase = url.origin;
  localStorage.setItem('brightpath-api', JSON.stringify({ base: state.apiBase }));
}

async function loadRemoteAssignments() {
  state.remoteAssignmentsLoaded = true;
  try {
    const data = await apiRequest('assignments');
    state.remoteAssignments = Array.isArray(data.assignments) ? data.assignments : [];
    setApiStatus(`Signed in. ${state.remoteAssignments.length} assignment${state.remoteAssignments.length === 1 ? '' : 's'} ready.`, 'success');
  } catch (error) {
    state.remoteAssignmentsLoaded = true;
    setApiStatus(`Your assignments could not load: ${error.message}`, 'error');
    if (error.message.includes('session expired') || error.message.includes('Sign in')) {
      sessionStorage.removeItem('brightpath-token');
      sessionStorage.removeItem('brightpath-user');
      window.BrightPathNative?.clearBiometricSessionFromApp?.();
      state.apiUser = null;
      roleSelect.disabled = false;
    }
  }
  render();
}

async function testApiConnection() {
  const input = document.querySelector('#api-base-input');
  try {
    if (input) saveApiBase(input.value);
    if (!state.apiBase) throw new Error('The school API has not been configured by the developer.');
    setApiStatus('Checking the API and database connection…');
    const result = await apiRequest('health');
    if (result.database !== 'connected') throw new Error('The API is online, but its MySQL database is not connected.');
    setApiStatus('Connected to the API and MySQL database.', 'success');
    toast('Your school API and database are connected.');
  } catch (error) {
    setApiStatus(error.message || 'Could not reach the API. Check the URL, HTTPS, and CORS settings.', 'error');
  }
}

async function signInToApi(form) {
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const input = document.querySelector('#api-base-input');
    if (input && state.role === 'developer') saveApiBase(input.value);
    if (!state.apiBase) throw new Error('The school API has not been configured by the developer.');
    setApiStatus('Signing in securely…');
    const result = await apiRequest('auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.elements.email.value.trim(),
        password: form.elements.password.value
      })
    });
    if (!result.token || !result.user) throw new Error('The server did not return a valid sign-in session.');
    sessionStorage.setItem('brightpath-token', result.token);
    sessionStorage.setItem('brightpath-user', JSON.stringify(result.user));
    state.apiUser = result.user;
    state.role = result.user.role === 'admin' ? 'developer' : result.user.role;
    state.page = 'home';
    if (window.BrightPathNative?.hasBiometricSession?.()) {
      window.BrightPathNative.clearBiometricSessionFromApp();
    }
    roleSelect.value = state.role;
    roleSelect.disabled = true;
    state.remoteAssignments = [];
    if (result.user.role === 'student') {
      state.remoteAssignmentsLoaded = true;
      try {
        const data = await apiRequest('assignments');
        state.remoteAssignments = Array.isArray(data.assignments) ? data.assignments : [];
        state.remoteAssignmentsLoaded = true;
        setApiStatus(`Signed in. ${state.remoteAssignments.length} assignment${state.remoteAssignments.length === 1 ? '' : 's'} ready.`, 'success');
      } catch (error) {
        state.remoteAssignmentsLoaded = false;
        setApiStatus(`Signed in, but assignments could not load: ${error.message}`, 'error');
      }
    } else if (['tutor', 'admin'].includes(result.user.role)) {
      state.remoteTutorDataLoaded = false;
      if (await loadTutorData(false)) {
        setApiStatus('Tutor workspace connected.', 'success');
      }
    } else {
      setApiStatus(`Signed in as ${result.user.role}.`, 'success');
    }
    render();
    toast('You’re signed in to your school account.');
  } catch (error) {
    setApiStatus(error.message || 'Sign-in failed. Check your account and API settings.', 'error');
    submit.disabled = false;
  }
}

document.addEventListener('click', event => {
  const target = event.target.closest('button, a, [data-close-modal]');
  if (!target) return;
  if (target.dataset.page) {
    event.preventDefault();
    state.page = target.dataset.page;
    render();
  } else if (target.dataset.role) {
    if (state.apiUser && target.dataset.role !== (state.apiUser.role === 'admin' ? 'developer' : state.apiUser.role)) {
      toast('Your signed-in account does not have access to that workspace.');
      return;
    }
    state.role = target.dataset.role;
    state.page = 'home';
    roleSelect.value = state.role;
    document.querySelector('#search-input').value = '';
    document.querySelector('#modal-root').innerHTML = '';
    render();
  } else if (target.dataset.lesson) {
    if (target.dataset.action === 'finish-lesson') {
      state.completed.add(target.dataset.lesson);
      saveState();
      document.querySelector('#modal-root').innerHTML = '';
      render();
      toast('Wonderful work! 20 learning points earned.');
    } else showLesson(target.dataset.lesson);
  } else if (target.dataset.task) {
    const task = assignments.find(item => item.id === target.dataset.task);
    if (task && !task.done) {
      if (state.assignmentDone.has(task.id)) state.assignmentDone.delete(task.id);
      else state.assignmentDone.add(task.id);
      saveState();
      render();
      toast(state.assignmentDone.has(task.id) ? 'Nice work! Assignment marked complete.' : 'Assignment moved back to your list.');
    }
  } else if (target.dataset.answer !== undefined) {
    const feedback = document.querySelector('.quiz-feedback');
    const correct = target.dataset.answer === 'true';
    feedback.textContent = correct ? 'That’s right! Brilliant thinking.' : 'Not quite—have another try. You’ve got this!';
    feedback.classList.toggle('incorrect', !correct);
  } else if (target.dataset.action === 'join-class') {
    if (state.role === 'developer') toast('Video classroom provider is not configured in this demo.');
    else joinClass();
  } else if (target.dataset.action === 'leave-class') {
    document.querySelector('#modal-root').innerHTML = '';
    toast('You left the classroom preview.');
  } else if (target.dataset.roomControl) {
    const name = target.dataset.roomControl;
    const active = target.classList.toggle('active');
    if (name === 'Hand') target.innerHTML = `${icon('hand')} ${active ? 'Hand raised' : 'Raise hand'}`;
    else target.innerHTML = `${icon(name === 'Mic' ? 'microphone' : 'camera')} ${name} ${active ? 'off' : 'on'}`;
  } else if (target.dataset.closeModal !== undefined) {
    document.querySelector('#modal-root').innerHTML = '';
  } else if (target.dataset.action === 'book-pick') {
    event.preventDefault();
    toast('Book picks are a sample. Add a parent-reviewed books partner to launch.');
  } else if (target.dataset.action === 'schedule') {
    toast('Class scheduling is a preview. Connect your secure tutor calendar to enable it.');
  } else if (target.dataset.action === 'family-info') {
    toast('This is a demo action. A secure backend is needed to save real accounts or content.');
  } else if (target.dataset.action === 'message-info') {
    toast('Messaging is a demo. Safe, moderated messaging needs a secure service.');
  } else if (target.dataset.action === 'test-api') {
    testApiConnection();
  } else if (target.dataset.action === 'choose-workspace') {
    showRolePicker();
  } else if (target.dataset.action === 'enable-biometric') {
    if (window.BrightPathNative?.saveBiometricSession && apiToken() && state.apiUser) {
      window.BrightPathNative.saveBiometricSession(
        apiToken(), JSON.stringify(state.apiUser), state.apiBase, String(Date.now()));
      setApiStatus('Confirm fingerprint unlock on your device.');
    }
  } else if (target.dataset.action === 'biometric-login') {
    if (window.BrightPathNative?.unlockBiometricSession) {
      window.BrightPathNative.unlockBiometricSession(String(Date.now()));
      setApiStatus('Confirm your fingerprint to sign in.');
    }
  } else if (target.dataset.action === 'schedule-reminder') {
    if (window.BrightPathNative?.scheduleNotification) {
      window.BrightPathNative.scheduleNotification('BrightPath reminder', 'Time for your next learning adventure!', 1);
      toast('If notifications are allowed, a reminder will arrive in about one minute.');
    } else toast('Scheduled reminders are available in the Android app.');
  } else if (target.dataset.action === 'api-signout') {
    signOutApi();
  } else if (target.dataset.action === 'submit-work') {
    submitAssignment(target.dataset.assignmentId);
  } else if (target.dataset.action === 'download-assignment-resource') {
    downloadAssignmentResource(target.dataset.assignmentId);
  } else if (target.dataset.action === 'download-submission') {
    downloadSubmission(target.dataset.submissionId);
  }
});

async function bootstrapSchoolAdmin(form) {
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const input = document.querySelector('#api-base-input');
    if (input) saveApiBase(input.value);
    if (!state.apiBase) throw new Error('The school API has not been configured by the developer.');
    setApiStatus('Creating the one-time administrator account…');
    await apiRequest('auth/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        password: form.elements.password.value,
        bootstrap_key: form.elements.bootstrap_key.value
      })
    });
    form.reset();
    setApiStatus('Administrator created. Remove the bootstrap key from server config, then sign in.', 'success');
    toast('Administrator account created. Sign in to manage school accounts.');
  } catch (error) {
    setApiStatus(error.message || 'Administrator setup failed.', 'error');
    submit.disabled = false;
  }
}

async function createSchoolUser(form) {
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const role = form.elements.role.value;
    const payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      role,
      password: form.elements.password.value
    };
    if (role === 'student') payload.grade = Number(form.elements.grade.value);
    await apiRequest('users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    form.reset();
    setApiStatus(`${role[0].toUpperCase()}${role.slice(1)} account created.`, 'success');
    toast('School account created.');
  } catch (error) {
    setApiStatus(error.message || 'Account creation failed.', 'error');
  } finally {
    submit.disabled = false;
  }
}

async function createSchoolAssignment(form) {
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const type = form.elements.assignment_type.value;
    const body = new FormData();
    body.set('title', form.elements.title.value.trim());
    body.set('description', form.elements.description.value.trim());
    body.set('grade', form.elements.grade.value);
    body.set('due_at', form.elements.due_at.value);
    body.set('assignment_type', type);
    if (type !== 'file') body.set('question_text', form.elements.question_text.value.trim());
    if (type === 'choice') {
      const choices = [0, 1, 2, 3].map(index => form.elements[`choice_${index}`].value.trim());
      if (choices.some(choice => !choice)) throw new Error('Add all four answer choices for this multiple-choice question.');
      body.set('choices_json', JSON.stringify(choices));
      body.set('correct_choice', form.elements.correct_choice.value);
    }
    if (form.elements.resource_file.files?.[0]) {
      const resource = form.elements.resource_file.files[0];
      if (resource.size > 8 * 1024 * 1024) throw new Error('Assignment documents must be 8 MB or smaller.');
      if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(resource.type)
        && !/\.(pdf|doc|docx)$/i.test(resource.name)) {
        throw new Error('Choose a PDF, DOC, or DOCX assignment document.');
      }
      body.set('resource_file', resource, resource.name);
    }
    await apiRequest('assignments', {
      method: 'POST',
      body
    });
    form.reset();
    state.remoteTutorDataLoaded = false;
    const refreshed = await loadTutorData(false);
    if (refreshed) setApiStatus('Assignment published for its grade.', 'success');
    else setApiStatus('Assignment published, but the tutor data could not refresh.', 'error');
    render();
    toast('Your assignment is published.');
  } catch (error) {
    setApiStatus(error.message || 'Assignment could not be published.', 'error');
    submit.disabled = false;
  }
}

async function downloadSubmission(id) {
  const item = state.remoteSubmissions.find(submission => String(submission.id) === String(id) && submission.submission_type !== 'answer');
  if (!item) {
    toast('That submission is no longer available.');
    return;
  }
  try {
    const response = await fetch(`${apiUrl('submissions/download')}&id=${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${apiToken()}` },
      mode: 'cors'
    });
    if (!response.ok) {
      let error = 'The submission could not be downloaded.';
      try { error = (await response.json()).error || error; }
      catch { error = 'The server returned an invalid download response.'; }
      throw new Error(error);
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = item.original_filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    setApiStatus(error.message || 'The submission could not be downloaded.', 'error');
  }
}

async function downloadAssignmentResource(id) {
  const assignment = state.remoteAssignments.find(item => String(item.id) === String(id))
    || state.remoteTutorAssignments.find(item => String(item.id) === String(id));
  if (!assignment?.resource_original_filename) {
    toast('This resource is no longer available.');
    return;
  }
  try {
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${apiToken()}`);
    const response = await fetch(`${apiUrl('assignments/download')}&id=${encodeURIComponent(id)}`, {
      headers,
      mode: 'cors'
    });
    if (!response.ok) {
      let message = 'The assignment document could not be downloaded.';
      try { message = (await response.json()).error || message; }
      catch { message = 'The server returned an invalid download response.'; }
      throw new Error(message);
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = assignment.resource_original_filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    setApiStatus(error.message || 'The assignment document could not be downloaded.', 'error');
  }
}

async function signOutApi() {
  let message = 'Signed out on this device.';
  try {
    if (apiToken()) await apiRequest('auth/logout', { method: 'POST' });
  } catch (error) {
    message = `Signed out on this device. The server token could not be revoked: ${error.message}`;
  } finally {
    window.BrightPathNative?.clearBiometricSessionFromApp?.();
    sessionStorage.removeItem('brightpath-token');
    sessionStorage.removeItem('brightpath-user');
    state.apiUser = null;
    roleSelect.disabled = false;
    state.remoteAssignments = [];
    state.remoteAssignmentsLoaded = false;
    render();
    toast(message);
  }
}

async function submitAssignment(id) {
  const assignment = state.remoteAssignments.find(item => String(item.id) === String(id));
  if (!assignment) {
    toast('This assignment is no longer available.');
    return;
  }
  if (!apiToken() || !state.apiUser) {
    setApiStatus('Sign in to your school account before submitting work.', 'error');
    document.querySelector('#api-login-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Sign in to submit your answer to your teacher.');
    return;
  }
  if ((assignment.assignment_type || 'file') !== 'file') {
    const card = document.querySelector(`[data-remote-assignment="${CSS.escape(id)}"]`);
    const button = card?.querySelector('[data-action="submit-work"]');
    if (!card || !button) return;
    const body = { assignment_id: Number(id) };
    if (assignment.assignment_type === 'choice') {
      const selected = card.querySelector(`input[name="answer-${CSS.escape(id)}"]:checked`);
      if (!selected) {
        toast('Choose an answer first.');
        return;
      }
      body.selected_choice = Number(selected.value);
    } else {
      body.answer_text = card.querySelector(`[data-answer-text="${CSS.escape(id)}"]`).value.trim();
      if (!body.answer_text) {
        toast('Write your answer first.');
        return;
      }
    }
    button.disabled = true;
    button.textContent = 'Sending answer…';
    try {
      const result = await apiRequest('submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      await loadRemoteAssignments();
      toast(result.message || 'Your answer was sent to your teacher.');
    } catch (error) {
      setApiStatus(error.message || 'Answer could not be sent. Check your connection and try again.', 'error');
      button.disabled = false;
      button.textContent = 'Try again';
    }
    return;
  }
  const file = state.selectedFiles.get(id);
  if (!apiToken() || !state.apiUser) {
    setApiStatus('Sign in to your school account before submitting work.', 'error');
    document.querySelector('#api-login-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Connect and sign in to submit work to your teacher.');
    return;
  }
  if (!file) {
    toast('Choose a photo or file before submitting.');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    toast('This file is larger than 8 MB. Choose a smaller file.');
    return;
  }
  const card = document.querySelector(`[data-remote-assignment="${CSS.escape(id)}"]`);
  const button = card?.querySelector('[data-action="submit-work"]');
  if (!button) return;
  button.disabled = true;
  button.textContent = 'Sending securely…';
  try {
    const formData = new FormData();
    formData.set('assignment_id', id);
    formData.set('file', file, file.name);
    formData.set('notes', card.querySelector(`[data-note-assignment="${CSS.escape(id)}"]`).value.trim());
    await apiRequest('submissions', { method: 'POST', body: formData });
    state.selectedFiles.delete(id);
    state.remoteAssignments = state.remoteAssignments.filter(item => String(item.id) !== String(id));
    render();
    toast('Your work was sent to your teacher.');
  } catch (error) {
    setApiStatus(error.message || 'Submission failed. Check your connection and try again.', 'error');
    button.disabled = false;
    button.innerHTML = 'Try again <span>→</span>';
  }
}

document.addEventListener('submit', event => {
  if (event.target.id === 'api-login-form') {
    event.preventDefault();
    signInToApi(event.target);
    return;
  }
  if (event.target.id === 'api-bootstrap-form') {
    event.preventDefault();
    bootstrapSchoolAdmin(event.target);
    return;
  }
  if (event.target.id === 'api-create-user-form') {
    event.preventDefault();
    createSchoolUser(event.target);
    return;
  }
  if (event.target.id === 'api-create-assignment-form') {
    event.preventDefault();
    createSchoolAssignment(event.target);
    return;
  }
  if (event.target.id !== 'chat-form') return;
  event.preventDefault();
  const input = event.target.elements.message;
  const message = input.value.trim();
  if (!message) return;
  state.chat.push(message);
  joinClass();
  const chat = document.querySelector('#chat-messages');
  chat.scrollTop = chat.scrollHeight;
});

document.addEventListener('change', event => {
  if (event.target.name === 'role' && event.target.form?.id === 'api-create-user-form') {
    const grade = document.querySelector('#new-user-grade-label');
    grade.hidden = event.target.value !== 'student';
    grade.querySelector('select').required = event.target.value === 'student';
  }
  if (event.target.id === 'assignment-type') {
    const isQuestion = event.target.value !== 'file';
    const isChoice = event.target.value === 'choice';
    const questionFields = document.querySelector('#assignment-question-fields');
    const choiceFields = document.querySelector('#assignment-choice-fields');
    questionFields.hidden = !isQuestion;
    choiceFields.hidden = !isChoice;
    questionFields.querySelector('[name="question_text"]').required = isQuestion;
    choiceFields.querySelectorAll('input[name^="choice_"]').forEach(input => { input.required = isChoice; });
  }
  const input = event.target.closest('[data-file-assignment]');
  if (!input || !input.files?.length) return;
  const file = input.files[0];
  const id = input.dataset.fileAssignment;
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
    input.value = '';
    toast('Choose a JPG, PNG, WebP photo, or PDF file.');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    input.value = '';
    toast('This file is larger than 8 MB. Choose a smaller file.');
    return;
  }
  state.selectedFiles.set(id, file);
  const label = document.querySelector(`#selected-file-${CSS.escape(id)}`);
  if (label) label.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
});

roleSelect.addEventListener('change', () => {
  if (state.apiUser) {
    roleSelect.value = state.apiUser.role === 'admin' ? 'developer' : state.apiUser.role;
    toast('Your workspace is set by your signed-in school account.');
    return;
  }
  state.role = roleSelect.value;
  state.page = 'home';
  document.querySelector('#search-input').value = '';
  render();
});
document.querySelector('#mobile-home').addEventListener('click', () => {
  state.page = 'home';
  render();
});
document.querySelector('#profile-button').addEventListener('click', () => {
  showRolePicker();
});
document.querySelector('#search-input').addEventListener('input', event => filterSearch(event.target.value));
document.querySelector('.search-box').addEventListener('click', () => {
  if (window.matchMedia('(max-width: 680px)').matches) {
    const input = document.querySelector('#search-input');
    input.style.display = 'block';
    input.style.position = 'fixed';
    input.style.top = '61px';
    input.style.right = '16px';
    input.style.zIndex = '6';
    input.style.width = 'min(260px, calc(100vw - 32px))';
    input.style.padding = '12px';
    input.style.border = '1px solid #eeeef4';
    input.style.borderRadius = '9px';
    input.style.background = '#fff';
    input.focus();
  }
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    document.querySelector('#search-input').focus();
  }
  if (event.key === 'Escape') document.querySelector('#modal-root').innerHTML = '';
});

document.querySelector('#notification-button').addEventListener('click', async () => {
  if (window.BrightPathNative?.requestNotificationPermission) {
    window.BrightPathNative.requestNotificationPermission();
    toast('Allow notifications in Android to receive learning reminders.');
    return;
  }
  if (!('Notification' in window)) {
    toast('This browser does not support web notifications.');
    return;
  }
  if (Notification.permission === 'denied') {
    toast('Notifications are blocked in browser settings.');
    return;
  }
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission === 'granted') {
    new Notification('BrightPath', { body: 'You’re all set for your next learning adventure!' });
    toast('Notifications are on for this device.');
  } else toast('Notifications were not enabled. You can change this in browser settings.');
});

render();
if (window.BrightPathNative?.isNativeApp?.()) document.documentElement.classList.add('native-app');
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {
    toast('Offline install is unavailable here. Try a secure HTTPS website.');
  }));
}

let installPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  document.querySelector('#install-button').hidden = false;
});
window.addEventListener('appinstalled', () => toast('BrightPath has been installed on your device.'));
document.querySelector('#install-button').addEventListener('click', async () => {
  if (!installPrompt) {
    toast('Open your browser menu and choose “Install app” or “Add to Home screen”.');
    return;
  }
  installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  if (choice.outcome === 'accepted') toast('BrightPath is being installed on your device.');
  installPrompt = null;
  document.querySelector('#install-button').hidden = true;
});

function configureAndroidDownload() {
  const banner = document.querySelector('#android-install-banner');
  const link = document.querySelector('#android-download-link');
  if (window.BrightPathNative?.isNativeApp?.()) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  link.href = 'https://github.com/Alexander12xx/BPATH/releases';
  link.textContent = 'Get Android app';
  link.hidden = false;
  try {
    if (!state.androidDownloadUrl) return;
    const url = new URL(state.androidDownloadUrl);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('The Android download link must use HTTPS and cannot include credentials.');
    }
    link.href = url.href;
    link.textContent = 'Download APK';
  } catch (error) {
    const message = document.createElement('small');
    message.className = 'android-download-error';
    message.textContent = 'The Android download link is not configured correctly. Please contact the school.';
    banner.append(message);
    console.error('BrightPath Android download configuration error:', error);
  }
}

configureAndroidDownload();
