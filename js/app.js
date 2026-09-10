/**
 * 文盛课程表 APP — 主逻辑
 * v1.3：全新视觉体系（靛蓝→紫渐变 / 双主题）+ 第9–14周真实课表数据
 */

// === 版本 ===
const APP_VERSION = '1.3';
const CURRENT_VERSION = 3; // versionCode，与 version.json 比对

// 更新检测源：按顺序尝试，第一个成功即返回
// 1) jsDelivr CDN —— 国内可达且最快
// 2) GitHub 官方 raw —— 官方源，国内网络有波动
// 3) ghproxy 加速 —— 兜底
const VERSION_URLS = [
  'https://cdn.jsdelivr.net/gh/shizsc/wensheng-app1@main/version.json',
  'https://raw.githubusercontent.com/shizsc/wensheng-app1/main/version.json',
  'https://ghproxy.net/https://raw.githubusercontent.com/shizsc/wensheng-app1/main/version.json'
];

// 版本号：课程数据更新时递增，触发本地强制刷新
const DATA_VERSION = 8;

// === 状态 ===
const state = {
  currentPage: 'today',
  currentWeek: 1,
  courses: [],
  reminderEnabled: false,
  remindTime: 10,
  darkMode: false,
  simulatedDate: null, // 手动模拟日期（null=使用真实日期）
  dailyReminderEnabled: false,
  dailyReminderHour: 7,
};

const DAY_MAP = { '周一':1, '周二':2, '周三':3, '周四':4, '周五':5, '周六':6, '周日':7 };
const DAY_ARR = ['周一','周二','周三','周四','周五','周六','周日'];
const MONTH_EN = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

// 三大节（与 Excel 的节数对应）
const TIME_SLOTS = [
  { key:'am',  label:'上午', time:'9:00-12:00',  periods:[1,4] },
  { key:'pm',  label:'下午', time:'13:20-16:20', periods:[5,8] },
  { key:'eve', label:'晚上', time:'17:00-20:00', periods:[9,11] },
];

// ================= 科目体系 =================
const SUBJECTS = {
  cs:   { label:'计算机基础', chip:'计' },
  en:   { label:'英语',       chip:'英' },
  math: { label:'高等数学',   chip:'高' },
  de:   { label:'数字电子',   chip:'数' },
  cir:  { label:'电路',       chip:'电' },
  gray: { label:'其他课程',   chip:'课' },
};

function getSubject(name) {
  const n = String(name || '');
  if (n.indexOf('计算机') >= 0) return 'cs';
  if (n.indexOf('英语') >= 0) return 'en';
  if (n.indexOf('高数') >= 0 || n.indexOf('高等数学') >= 0) return 'math';
  if (n.indexOf('数字电子') >= 0 || n.indexOf('模拟电子') >= 0) return 'de';
  if (n.indexOf('电路') >= 0) return 'cir';
  return 'gray';
}

// 返回该课程所处的三大节
function getSlot(course) {
  const s = parseInt(course.start) || 1;
  for (const slot of TIME_SLOTS) {
    if (s >= slot.periods[0] && s <= slot.periods[1]) return slot;
  }
  return TIME_SLOTS[0];
}

function slotLabelOf(course) {
  return getSlot(course).label;
}

// ================= 工具函数 =================
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function showToast(msg, type = '') {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast'; }, 2500);
}

function getTodayDate() {
  if (state.simulatedDate) return new Date(state.simulatedDate);
  return new Date();
}

function getTodayDayOfWeek() {
  const d = getTodayDate();
  const day = d.getDay(); // 0=Sunday
  return day === 0 ? '周日' : DAY_ARR[day - 1];
}

function getTodayDateStr() {
  const d = getTodayDate();
  return `${d.getMonth()+1}月${d.getDate()}日`;
}

function parseTime(timeStr) {
  const match = String(timeStr || '').match(/(\d{1,2}):(\d{2})\s*[-–—~]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return {
    startHour: parseInt(match[1]), startMin: parseInt(match[2]),
    endHour: parseInt(match[3]), endMin: parseInt(match[4])
  };
}

function startMinutes(course) {
  const t = parseTime(course.time);
  if (!t) return 0;
  return t.startHour * 60 + t.startMin;
}

function endMinutes(course) {
  const t = parseTime(course.time);
  if (!t) return 0;
  return t.endHour * 60 + t.endMin;
}

// 当前时间（分钟）
function nowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// 根据日期计算所属周次（基于 2026年7月13日 周一 为第1周）
function getWeekByDate(date) {
  const WEEK_1_START = new Date(2026, 6, 13);
  const diffTime = date.getTime() - WEEK_1_START.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

// 获取当前显示周每天的日期
function getWeekDates() {
  const WEEK_1_START = new Date(2026, 6, 13);
  const daysOffset = (state.currentWeek - 1) * 7;
  const monday = new Date(WEEK_1_START);
  monday.setDate(WEEK_1_START.getDate() + daysOffset);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(`${d.getMonth() + 1}.${String(d.getDate()).padStart(2,'0')}`);
  }
  return dates;
}

// ================= 更新检测 =================
// 依次尝试各源，返回第一个成功解析的版本信息；全部失败返回 null
async function fetchVersionInfo() {
  for (const url of VERSION_URLS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url + '?t=' + Date.now(), {
        cache: 'no-store',
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      if (data && typeof data.versionCode === 'number') return data;
    } catch(e) {
      // 该源不可用，继续尝试下一个
    }
  }
  return null;
}

async function checkUpdate() {
  try {
    const data = await fetchVersionInfo();
    if (!data) return;
    if (data.versionCode > CURRENT_VERSION) {
      const msg = `发现新版本 v${data.versionName}\n\n更新内容：${data.releaseNote || '无'}\n\n是否立即下载？`;
      if (confirm(msg)) {
        window.open(data.apkUrl, '_system');
      }
    }
  } catch(e) {
    // 网络错误静默失败，不影响正常使用
  }
}

// ================= 初始化 =================
async function init() {
  // 数据版本检查：版本不匹配时强制刷新
  const savedVersion = parseInt(localStorage.getItem('dataVersion')) || 0;
  if (savedVersion < DATA_VERSION) {
    await clearAllCourses();
    await importDefaultData();
    localStorage.setItem('dataVersion', DATA_VERSION);
    showToast('课程数据已更新至最新', 'success');
  }

  loadSettings();
  await loadCourses();
  bindNav();
  bindActions();
  renderPage('today');

  if (state.dailyReminderEnabled) {
    requestNotificationPermission();
    scheduleDailyReminder();
  }

  $('#version-display').textContent = `文盛课程表 v${APP_VERSION} · WENSHENGEDUCATION`;
  checkUpdate();
}

function loadSettings() {
  const week = localStorage.getItem('currentWeek');
  if (week) state.currentWeek = parseInt(week);
  state.reminderEnabled = localStorage.getItem('reminderEnabled') === 'true';
  state.remindTime = parseInt(localStorage.getItem('remindTime')) || 10;
  state.darkMode = localStorage.getItem('darkMode') === 'true';
  state.simulatedDate = localStorage.getItem('simulatedDate') || null;
  state.dailyReminderEnabled = localStorage.getItem('dailyReminderEnabled') === 'true';
  state.dailyReminderHour = parseInt(localStorage.getItem('dailyReminderHour')) || 7;

  $('#setting-week').value = state.currentWeek;
  $('#setting-reminder').checked = state.reminderEnabled;
  $('#setting-remind-time').value = state.remindTime;
  $('#setting-darkmode').checked = state.darkMode;
  $('#setting-daily-reminder').checked = state.dailyReminderEnabled;
  $('#setting-daily-hour').value = state.dailyReminderHour;

  applyDarkMode(state.darkMode);
  updateSimulatedDateUI();
}

function saveSettings() {
  localStorage.setItem('currentWeek', state.currentWeek);
  localStorage.setItem('reminderEnabled', state.reminderEnabled);
  localStorage.setItem('remindTime', state.remindTime);
  localStorage.setItem('darkMode', state.darkMode);
  localStorage.setItem('simulatedDate', state.simulatedDate || '');
  localStorage.setItem('dailyReminderEnabled', state.dailyReminderEnabled);
  localStorage.setItem('dailyReminderHour', state.dailyReminderHour);
}

function applyDarkMode(on) {
  document.body.classList.toggle('dark', !!on);
  const sw = $('#setting-darkmode');
  if (sw) sw.checked = !!on;
}

// ================= 每日自动推送 =================
let dailyTimer = null;

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function scheduleDailyReminder() {
  if (dailyTimer) clearInterval(dailyTimer);
  dailyTimer = setInterval(() => {
    const now = new Date();
    if (now.getHours() === state.dailyReminderHour && now.getMinutes() === 0) {
      sendDailyNotification();
    }
  }, 60000);
}

function sendDailyNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const today = getTodayDayOfWeek();
  const todayCourses = state.courses
    .filter(c => c.day === today && parseInt(c.week) === state.currentWeek)
    .sort((a, b) => startMinutes(a) - startMinutes(b));

  const dateStr = getTodayDateStr();

  if (todayCourses.length === 0) {
    new Notification('📅 文盛课程表', { body: `${dateStr} ${today} 今天没有课~`, icon: '📚' });
    return;
  }

  const courseList = todayCourses.map(c =>
    `${c.time} ${c.name}（${c.teacher || ''} · ${c.location || ''}）`
  ).join('\n');

  new Notification(`📅 ${dateStr} ${today} 共${todayCourses.length}节课`, {
    body: courseList,
    icon: '📚'
  });
}

function updateSimulatedDateUI() {
  const dateInput = $('#setting-date');
  const dateDisplay = $('#simulated-date-display');
  const resetBtn = $('#btn-reset-date');

  if (state.simulatedDate) {
    dateInput.value = state.simulatedDate;
    const d = new Date(state.simulatedDate);
    dateDisplay.textContent = `${d.getMonth()+1}月${d.getDate()}日 ${DAY_ARR[d.getDay()===0?6:d.getDay()-1]}`;
    resetBtn.style.display = 'inline-flex';
  } else {
    dateInput.value = '';
    dateDisplay.textContent = '';
    resetBtn.style.display = 'none';
  }
}

async function loadCourses() {
  state.courses = await getAllCourses();
  if (state.courses.length === 0) {
    await importDefaultData();
    state.courses = await getAllCourses();
  }
}

// ================= 导航 =================
function bindNav() {
  $$('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      $$('.tab-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderPage(page);
    });
  });
}

function renderPage(page) {
  state.currentPage = page;
  $$('.page').forEach(p => p.classList.remove('active'));
  const el = $('#page-' + page);
  if (el) el.classList.add('active');

  if (page === 'today') renderToday();
  else if (page === 'timetable') renderTimetable();
  else if (page === 'manage') renderManage();
  else if (page === 'settings') renderSettings();
}

// ================= 今日页面 =================
function renderToday() {
  const d = getTodayDate();
  const todayDow = getTodayDayOfWeek();
  const week = getWeekByDate(d);

  $('#today-month').textContent = `${MONTH_EN[d.getMonth()]} · ${d.getFullYear()}`;
  $('#today-date').innerHTML = `${d.getMonth()+1}月${d.getDate()}日<small>${todayDow}</small>`;
  $('#today-week').textContent = `第 ${week} 周 · 基础精讲阶段`;
  $('#today-sub').textContent = state.simulatedDate
    ? '模拟日期查看中'
    : '文盛2027届基础精讲班';

  const list = $('#today-list');
  const todayCourses = state.courses
    .filter(c => c.day === todayDow && parseInt(c.week) === week)
    .sort((a, b) => startMinutes(a) - startMinutes(b));

  // 统计
  const totalMin = todayCourses.reduce((sum, c) => sum + Math.max(0, endMinutes(c) - startMinutes(c)), 0);
  $('#today-count').textContent = todayCourses.length
    ? `共 ${todayCourses.length} 节 · ${(totalMin/60).toFixed(1)} 小时`
    : '今天休息';

  if (todayCourses.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-ic">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="16" rx="3.5"/><path d="M3.5 9.5h17M8.5 3.5v3.2M15.5 3.5v3.2M9 14.5h6"/></svg>
        </div>
        <div class="empty-t">今天没有课~</div>
        <div class="empty-s">可到「课表」查看本周完整安排</div>
      </div>`;
    return;
  }

  const now = nowMinutes();
  list.innerHTML = todayCourses.map(c => {
    const sub = getSubject(c.name);
    const started = now >= startMinutes(c);
    const ended = now >= endMinutes(c);
    let cardClass = 'course-card';
    let badge = '';
    if (ended) {
      cardClass += ' past';
      badge = '<span class="badge badge-cls">已结束</span>';
    } else if (started) {
      cardClass += ' current';
      badge = '<span class="badge badge-now"><i class="dot"></i>上课中</span>';
    } else {
      cardClass += ' next';
      badge = '<span class="badge badge-next">待上</span>';
    }
    const clsTag = c.cls
      ? `<span class="badge badge-cls">${c.cls === 'both' ? '合班' : '1班'}</span>`
      : '';

    return `
      <div class="${cardClass}">
        <div class="cc-bar bar-${sub}"></div>
        <div class="cc-main">
          <div class="cc-top">
            <span class="cc-name">${c.name}</span>
            ${badge}
            ${clsTag}
          </div>
          <div class="cc-time">${slotLabelOf(c)} ${c.time}</div>
          <div class="cc-meta">
            <span class="m"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5"/></svg>${c.teacher || '未指定'}</span>
            <span class="m"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>${c.location || '未指定'}</span>
            <span class="m"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h6.5a1.5 1.5 0 0 1 1.5 1.5V20a1.5 1.5 0 0 0-1.5-1.5H4Z"/><path d="M20 5.5h-6.5A1.5 1.5 0 0 0 12 7v13a1.5 1.5 0 0 1 1.5-1.5H20Z"/></svg>第${c.start}-${c.end}节</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ================= 课表页面 =================
const WEEK_MIN = 1;
const WEEK_MAX = 14;

function renderTimetable() {
  const grid = $('#timetable-grid');
  const todayDow = getTodayDayOfWeek();
  const todayWeek = getWeekByDate(getTodayDate());
  const isCurrentWeek = state.currentWeek === todayWeek;
  const weekDates = getWeekDates();

  const start = new Date(2026, 6, 13);
  start.setDate(start.getDate() + (state.currentWeek - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d) => `${d.getMonth()+1}月${d.getDate()}日`;

  $('#current-week-label').innerHTML =
    `第 ${state.currentWeek} 周` +
    `<small>${fmt(start)} — ${fmt(end)}` +
    (state.simulatedDate ? ' · 模拟' : (isCurrentWeek ? ' · 本周' : '')) + '</small>';

  $('#prev-week').classList.toggle('disabled', state.currentWeek <= WEEK_MIN);
  $('#next-week').classList.toggle('disabled', state.currentWeek >= WEEK_MAX);

  let html = '<div class="tt-corner"></div>';

  // 表头
  DAY_ARR.forEach((day, i) => {
    const isToday = isCurrentWeek && day === todayDow;
    html += `<div class="tt-dow${isToday ? ' today' : ''}">${day}<span class="dnum">${weekDates[i]}${isToday ? ' 今天' : ''}</span></div>`;
  });

  // 三大节
  TIME_SLOTS.forEach(slot => {
    html += `<div class="tt-slot">${slot.label}</div>`;
    DAY_ARR.forEach(day => {
      const isTodayCol = isCurrentWeek && day === todayDow;
      const course = state.courses.find(c =>
        c.day === day &&
        parseInt(c.week) === state.currentWeek &&
        parseInt(c.start) >= slot.periods[0] && parseInt(c.start) <= slot.periods[1]
      );

      let inner;
      if (course) {
        const sub = getSubject(course.name);
        const tag = course.cls
          ? `<span class="b-tag ${course.cls === 'both' ? 'both' : 'one'}">${course.cls === 'both' ? '合班' : '1班'}</span>`
          : '';
        inner = `<div class="block b-${sub}${isTodayCol ? ' today-block' : ''}" data-id="${course.id}">
            <div class="b-name">${course.name}</div>
            ${tag}
            <div class="b-time">${course.time || slot.time}</div>
            <div class="b-meta">
              <span><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5"/></svg>${course.teacher || ''}</span>
              <span><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>${course.location || ''}</span>
            </div>
          </div>`;
      } else {
        inner = '<div class="cell-empty">—</div>';
      }
      html += `<div class="tt-cell${isTodayCol ? ' today-col' : ''}">${inner}</div>`;
    });
  });

  grid.innerHTML = html;

  // 让「今天」所在列居中可见
  const wrap = $('#tt-wrap');
  if (wrap && isCurrentWeek) {
    const colW = 88 + 6;
    const offset = 38 + 6;
    const idx = DAY_ARR.indexOf(todayDow);
    const target = idx * colW + offset - (wrap.clientWidth - colW) / 2;
    wrap.scrollLeft = Math.max(0, target);
  } else if (wrap) {
    wrap.scrollLeft = 0;
  }

  // 点击课程块 → 跳到管理页编辑
  grid.querySelectorAll('.block').forEach(el => {
    el.addEventListener('click', () => {
      const id = parseInt(el.dataset.id);
      const course = state.courses.find(c => c.id === id);
      if (course) openModal(course);
    });
  });
}

// ================= 管理页面 =================
function renderManage() {
  const list = $('#course-list');
  const courses = [...state.courses].sort((a, b) => {
    const wa = parseInt(a.week) || 0, wb = parseInt(b.week) || 0;
    if (wa !== wb) return wa - wb;
    const da = DAY_MAP[a.day] || 0, db = DAY_MAP[b.day] || 0;
    if (da !== db) return da - db;
    return startMinutes(a) - startMinutes(b);
  });

  $('#manage-sub').textContent = `共 ${courses.length} 条课程安排`;
  $('#course-count').textContent = '按周次 · 时间排序';

  if (courses.length === 0) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-ic">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </div>
        <div class="empty-t">暂无课程</div>
        <div class="empty-s">点击上方「添加课程」或「导入 Excel」</div>
      </div>`;
    return;
  }

  list.innerHTML = courses.map(c => {
    const sub = getSubject(c.name);
    const clsTag = c.cls ? (c.cls === 'both' ? '合班' : '1班') : '';
    return `
    <div class="mgmt-item">
      <div class="mi-chip chip-${sub}">${SUBJECTS[sub].chip}</div>
      <div class="mi-main">
        <div class="mi-name">${c.name}</div>
        <div class="mi-meta">
          <span>第${c.week}周 · ${c.day}</span>
          <span>${c.time}</span>
          <span>${c.location || '未指定'}</span>
          ${clsTag ? `<span>${clsTag}</span>` : ''}
        </div>
      </div>
      <div class="mi-ops">
        <div class="mini-btn" title="编辑" onclick="editCourse(${c.id})">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17l-1 3Z"/><path d="M13.5 6.5l3 3"/></svg>
        </div>
        <div class="mini-btn danger" title="删除" onclick="removeCourse(${c.id})">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/></svg>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ================= 设置页面 =================
function renderSettings() {
  $('#setting-week').value = state.currentWeek;
  $('#setting-reminder').checked = state.reminderEnabled;
  $('#setting-remind-time').value = state.remindTime;
  $('#setting-darkmode').checked = state.darkMode;
  $('#setting-daily-reminder').checked = state.dailyReminderEnabled;
  $('#setting-daily-hour').value = state.dailyReminderHour;
  updateSimulatedDateUI();
}

// ================= 操作绑定 =================
function bindActions() {
  // 主题切换（页头按钮）
  $$('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      state.darkMode = !state.darkMode;
      applyDarkMode(state.darkMode);
      saveSettings();
    });
  });

  // 周次切换
  $('#prev-week').addEventListener('click', () => {
    if (state.currentWeek > WEEK_MIN) { state.currentWeek--; saveSettings(); renderTimetable(); }
  });
  $('#next-week').addEventListener('click', () => {
    if (state.currentWeek < WEEK_MAX) { state.currentWeek++; saveSettings(); renderTimetable(); }
  });

  // 设置项
  $('#setting-week').addEventListener('change', (e) => {
    state.currentWeek = parseInt(e.target.value);
    saveSettings();
    if (state.currentPage === 'today') renderToday();
    if (state.currentPage === 'timetable') renderTimetable();
  });
  $('#setting-reminder').addEventListener('change', (e) => {
    state.reminderEnabled = e.target.checked;
    saveSettings();
  });
  $('#setting-remind-time').addEventListener('change', (e) => {
    state.remindTime = parseInt(e.target.value);
    saveSettings();
  });
  $('#setting-darkmode').addEventListener('change', (e) => {
    state.darkMode = e.target.checked;
    applyDarkMode(state.darkMode);
    saveSettings();
  });

  // 检查更新
  $('#btn-check-update').addEventListener('click', async () => {
    const btn = $('#btn-check-update');
    btn.textContent = '检查中...';
    btn.disabled = true;
    try {
      const data = await fetchVersionInfo();
      if (!data) {
        showToast('检查失败，请检查网络', 'error');
      } else if (data.versionCode > CURRENT_VERSION) {
        if (confirm(`发现新版本 v${data.versionName}\n\n更新内容：${data.releaseNote || '无'}\n\n是否立即下载？`)) {
          window.open(data.apkUrl, '_system');
        }
      } else {
        showToast('已是最新版本 v' + APP_VERSION, 'success');
      }
    } catch(e) {
      showToast('检查失败，请检查网络', 'error');
    }
    btn.textContent = '检查';
    btn.disabled = false;
  });

  // 测试推送
  $('#btn-test-notify').addEventListener('click', () => {
    if (!('Notification' in window)) {
      showToast('当前环境不支持通知功能', 'error');
      return;
    }
    if (Notification.permission !== 'granted') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') sendDailyNotification();
        else showToast('请允许通知权限', 'error');
      });
    } else {
      sendDailyNotification();
    }
  });

  // 每日自动推送
  $('#setting-daily-reminder').addEventListener('change', (e) => {
    state.dailyReminderEnabled = e.target.checked;
    saveSettings();
    if (state.dailyReminderEnabled) {
      requestNotificationPermission();
      scheduleDailyReminder();
    }
  });
  $('#setting-daily-hour').addEventListener('change', (e) => {
    state.dailyReminderHour = parseInt(e.target.value);
    saveSettings();
    if (state.dailyReminderEnabled) scheduleDailyReminder();
  });

  // 模拟日期
  $('#setting-date').addEventListener('change', (e) => {
    state.simulatedDate = e.target.value || null;
    saveSettings();
    updateSimulatedDateUI();
    if (state.currentPage === 'today') renderToday();
    if (state.currentPage === 'timetable') renderTimetable();
  });
  $('#btn-reset-date').addEventListener('click', () => {
    state.simulatedDate = null;
    saveSettings();
    updateSimulatedDateUI();
    if (state.currentPage === 'today') renderToday();
    if (state.currentPage === 'timetable') renderTimetable();
    showToast('已恢复为真实日期', 'success');
  });

  // 强制刷新数据
  $('#btn-refresh-data').addEventListener('click', async () => {
    if (confirm('将重新导入全部课程数据，继续吗？')) {
      await clearAllCourses();
      await importDefaultData();
      state.courses = await getAllCourses();
      renderManage();
      if (state.currentPage === 'today') renderToday();
      if (state.currentPage === 'timetable') renderTimetable();
      showToast(`已刷新 ${state.courses.length} 门课程`, 'success');
    }
  });

  // 清空
  $('#btn-clear-all').addEventListener('click', async () => {
    if (confirm('确定要清空所有课程数据吗？此操作不可撤销。')) {
      await clearAllCourses();
      state.courses = [];
      renderManage();
      if (state.currentPage === 'today') renderToday();
      if (state.currentPage === 'timetable') renderTimetable();
      showToast('已清空所有课程', 'success');
    }
  });

  // 导入 Excel
  $('#btn-import').addEventListener('click', () => $('#file-input').click());
  $('#file-input').addEventListener('change', handleFileImport);

  // 添加课程
  $('#btn-add').addEventListener('click', () => openModal());

  // 弹窗
  $('#btn-cancel').addEventListener('click', closeModal);
  $('#course-form').addEventListener('submit', handleSubmit);
  $('#modal-course').addEventListener('click', (e) => {
    if (e.target.id === 'modal-course') closeModal();
  });
}

// ================= Excel 导入 =================
function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      if (typeof XLSX === 'undefined') {
        showToast('Excel 解析库未加载，请联网后重试', 'error');
        e.target.value = '';
        return;
      }
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      const courses = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        if (i < 4 && typeof row[0] === 'string' && row[0].includes('课程')) continue;
        if (typeof row[0] === 'string' && row[0].includes('说明')) continue;

        const name = String(row[0] || '').trim();
        const day = String(row[1] || '').trim();
        const time = String(row[2] || '').trim();
        const start = parseInt(row[3]) || 1;
        const end = parseInt(row[4]) || start;
        const teacher = String(row[5] || '').trim();
        const location = String(row[6] || '').trim();
        const week = parseInt(row[7]) || 1;

        if (!name || !day || !time) continue;
        if (!DAY_ARR.includes(day)) continue;

        courses.push({ name, day, time, start, end, teacher, location, week });
      }

      if (courses.length === 0) {
        showToast('未找到有效课程数据，请检查格式', 'error');
        return;
      }

      await bulkAdd(courses);
      state.courses = await getAllCourses();
      renderManage();
      showToast(`成功导入 ${courses.length} 门课程`, 'success');
    } catch (err) {
      console.error(err);
      showToast('文件解析失败：' + err.message, 'error');
    }
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}

// ================= 添加/编辑课程 =================
function openModal(course = null) {
  $('#modal-title').textContent = course ? '编辑课程' : '添加课程';
  $('#f-id').value = course?.id || '';
  $('#f-name').value = course?.name || '';
  $('#f-day').value = course?.day || '周一';
  $('#f-time').value = course?.time || '';
  $('#f-start').value = course?.start || '';
  $('#f-end').value = course?.end || '';
  $('#f-teacher').value = course?.teacher || '';
  $('#f-location').value = course?.location || '';
  $('#f-week').value = String(course?.week || state.currentWeek);
  $('#modal-course').classList.add('active');
}

function closeModal() {
  $('#modal-course').classList.remove('active');
  $('#course-form').reset();
}

async function handleSubmit(e) {
  e.preventDefault();
  const id = $('#f-id').value;
  const course = {
    name: $('#f-name').value.trim(),
    day: $('#f-day').value,
    time: $('#f-time').value.trim(),
    start: parseInt($('#f-start').value),
    end: parseInt($('#f-end').value),
    teacher: $('#f-teacher').value.trim(),
    location: $('#f-location').value.trim(),
    week: parseInt($('#f-week').value),
  };

  if (id) {
    course.id = parseInt(id);
    await updateCourse(course);
    showToast('课程已更新', 'success');
  } else {
    await addCourse(course);
    showToast('课程已添加', 'success');
  }

  state.courses = await getAllCourses();
  closeModal();
  if (state.currentPage === 'manage') renderManage();
  if (state.currentPage === 'today') renderToday();
  if (state.currentPage === 'timetable') renderTimetable();
}

// ================= 编辑/删除 =================
async function editCourse(id) {
  const course = state.courses.find(c => c.id === id);
  if (course) openModal(course);
}

async function removeCourse(id) {
  if (!confirm('确定删除此课程？')) return;
  await deleteCourse(id);
  state.courses = state.courses.filter(c => c.id !== id);
  renderManage();
  if (state.currentPage === 'today') renderToday();
  if (state.currentPage === 'timetable') renderTimetable();
  showToast('已删除', 'success');
}

// ================= 默认数据 =================
// cls: 'both' = 自动化1班+2班（合班） / 'one' = 自动化1班
async function importDefaultData() {
  const defaults = [
    // ===== 第1周 (7/13-7/19) =====
    { name: "英语-1", day: "周三", time: "13:40-16:40", start: 5, end: 8, teacher: "耿老师", location: "505教室", week: 1 },
    { name: "模拟电子-1", day: "周五", time: "13:20-16:20", start: 5, end: 8, teacher: "吴老师", location: "304教室", week: 1 },
    { name: "计算机基础-1", day: "周六", time: "9:20-12:20", start: 1, end: 4, teacher: "梁老师1", location: "505教室", week: 1 },
    { name: "高数-1", day: "周六", time: "13:40-16:40", start: 5, end: 8, teacher: "郑老师", location: "513教室（西校区）", week: 1 },
    { name: "模拟电子-2", day: "周日", time: "9:20-12:20", start: 1, end: 4, teacher: "吴老师", location: "301教室", week: 1 },
    // ===== 第2周 (7/20-7/26) =====
    { name: "模拟电子-3", day: "周一", time: "9:00-12:00", start: 1, end: 4, teacher: "吴老师", location: "404教室", week: 2 },
    { name: "高数-2", day: "周一", time: "9:00-12:00", start: 1, end: 4, teacher: "郑老师", location: "407教室", week: 2 },
    { name: "英语-2", day: "周三", time: "13:20-16:20", start: 5, end: 8, teacher: "耿老师", location: "407教室", week: 2 },
    { name: "模拟电子-4", day: "周四", time: "13:20-16:20", start: 5, end: 8, teacher: "吴老师", location: "302教室", week: 2 },
    { name: "计算机基础-2", day: "周五", time: "9:00-12:00", start: 1, end: 4, teacher: "梁老师1", location: "422教室（西校区）", week: 2 },
    { name: "高数-3", day: "周六", time: "9:00-12:00", start: 1, end: 4, teacher: "郑老师", location: "421教室（西校区）", week: 2 },
    { name: "英语-3", day: "周六", time: "13:20-16:20", start: 5, end: 8, teacher: "耿老师", location: "407教室", week: 2 },
    { name: "模拟电子-5", day: "周日", time: "9:00-12:00", start: 1, end: 4, teacher: "吴老师", location: "404教室", week: 2 },
    { name: "模拟电子-6", day: "周一", time: "9:00-12:00", start: 1, end: 4, teacher: "吴老师", location: "204教室", week: 2 },
    { name: "模拟电子-7", day: "周二", time: "9:20-12:20", start: 1, end: 4, teacher: "吴老师", location: "301教室", week: 2 },
    { name: "高数-4", day: "周二", time: "9:00-12:00", start: 1, end: 4, teacher: "郑老师", location: "407教室", week: 2 },
    // ===== 第3周 (7/27-8/2) =====
    { name: "计算机基础-3", day: "周三", time: "13:40-16:40", start: 5, end: 8, teacher: "梁老师1", location: "514教室（西校区）", week: 3 },
    { name: "模拟电子-8", day: "周四", time: "13:20-16:20", start: 5, end: 8, teacher: "吴老师", location: "302教室", week: 3 },
    { name: "计算机基础-4", day: "周五", time: "9:00-12:00", start: 1, end: 4, teacher: "梁老师1", location: "422教室（西校区）", week: 3 },
    { name: "英语-4", day: "周五", time: "9:00-12:00", start: 1, end: 4, teacher: "耿老师", location: "420教室（西校区）", week: 3 },
    { name: "高数-5", day: "周六", time: "13:20-16:20", start: 5, end: 8, teacher: "郑老师", location: "421教室（西校区）", week: 3 },
    // ===== 第4周 (8/3-8/9) =====
    { name: "模拟电子-9", day: "周一", time: "9:00-12:00", start: 1, end: 4, teacher: "吴老师", location: "404教室", week: 4 },
    { name: "模拟电子-10", day: "周二", time: "9:20-12:20", start: 1, end: 4, teacher: "吴老师", location: "301教室", week: 4 },
    { name: "高数-6", day: "周二", time: "9:00-12:00", start: 1, end: 4, teacher: "郑老师", location: "407教室", week: 4 },
    { name: "英语-5", day: "周三", time: "13:20-16:20", start: 5, end: 8, teacher: "耿老师", location: "420教室（西校区）", week: 4 },
    { name: "模拟电子-11", day: "周四", time: "13:20-16:20", start: 5, end: 8, teacher: "吴老师", location: "302教室", week: 4 },
    { name: "计算机基础-5", day: "周五", time: "9:00-12:00", start: 1, end: 4, teacher: "梁老师1", location: "422教室（西校区）", week: 4 },
    { name: "高数-7", day: "周五", time: "9:00-12:00", start: 1, end: 4, teacher: "郑老师", location: "421教室（西校区）", week: 4 },
    { name: "英语-6", day: "周六", time: "13:20-16:20", start: 5, end: 8, teacher: "耿老师", location: "407教室", week: 4 },
    // ===== 第5周 (8/10-8/16) =====
    { name: "高数-8", day: "周一", time: "9:20-12:20", start: 1, end: 4, teacher: "郑老师", location: "505教室", week: 5 },
    { name: "计算机基础-6", day: "周一", time: "9:20-12:20", start: 1, end: 4, teacher: "梁老师1", location: "514教室（西校区）", week: 5 },
    { name: "高数-9", day: "周三", time: "13:40-16:40", start: 5, end: 8, teacher: "郑老师", location: "307教室", week: 5 },
    { name: "英语-7", day: "周四", time: "13:40-16:40", start: 5, end: 8, teacher: "耿老师", location: "307教室", week: 5 },
    { name: "计算机基础-7", day: "周五", time: "13:20-16:20", start: 5, end: 8, teacher: "梁老师1", location: "422教室（西校区）", week: 5 },
    { name: "模拟电子-12", day: "周六", time: "9:00-12:00", start: 1, end: 4, teacher: "吴老师", location: "401教室", week: 5 },
    { name: "电路-1", day: "周六", time: "13:20-16:20", start: 5, end: 8, teacher: "滕老师", location: "402教室", week: 5 },
    { name: "电路-2", day: "周六", time: "9:00-12:00", start: 1, end: 4, teacher: "滕老师", location: "402教室", week: 5 },
    { name: "数字电子-1", day: "周日", time: "13:20-16:20", start: 5, end: 8, teacher: "刘老师13", location: "402教室", week: 5 },
    { name: "高数-10", day: "周日", time: "9:00-12:00", start: 1, end: 4, teacher: "郑老师", location: "422教室（西校区）", week: 5 },
    // ===== 第6周 (8/17-8/22) =====
    { name: "计算机基础-8", day: "周一", time: "13:40-16:40", start: 5, end: 8, teacher: "梁老师1", location: "513教室（西校区）", week: 6 },
    { name: "电路-3", day: "周二", time: "9:20-12:20", start: 1, end: 4, teacher: "滕老师", location: "301教室", week: 6 },
    { name: "英语-8", day: "周三", time: "13:40-16:40", start: 5, end: 8, teacher: "耿老师", location: "514教室（西校区）", week: 6 },
    { name: "英语-9", day: "周四", time: "9:20-12:20", start: 1, end: 4, teacher: "耿老师", location: "505教室", week: 6 },
    { name: "高数-11", day: "周五", time: "13:40-16:40", start: 5, end: 8, teacher: "郑老师", location: "514教室（西校区）", week: 6 },
    { name: "电路-4", day: "周六", time: "9:20-12:20", start: 1, end: 4, teacher: "滕老师", location: "403教室", week: 6 },
    { name: "高数-12", day: "周六", time: "9:00-12:00", start: 1, end: 4, teacher: "郑老师", location: "420教室（西校区）", week: 6 },
    // ===== 第7周 (8/24-8/29) =====
    { name: "英语-10", day: "周一", time: "13:20-16:20", start: 5, end: 8, teacher: "耿老师", location: "420教室（西校区）", week: 7 },
    { name: "计算机基础-9", day: "周三", time: "13:40-16:40", start: 5, end: 8, teacher: "梁老师1", location: "514教室（西校区）", week: 7 },
    { name: "电路-5", day: "周四", time: "9:00-12:00", start: 1, end: 4, teacher: "滕老师", location: "402教室", week: 7 },
    { name: "计算机基础-10", day: "周五", time: "9:00-12:00", start: 1, end: 4, teacher: "梁老师1", location: "422教室（西校区）", week: 7 },
    { name: "数字电子-2", day: "周五", time: "9:00-12:00", start: 1, end: 4, teacher: "刘老师13", location: "401教室", week: 7 },
    { name: "电路-6", day: "周六", time: "13:20-16:20", start: 5, end: 8, teacher: "滕老师", location: "404教室", week: 7 },
    { name: "电路-7", day: "周二", time: "17:00-20:00", start: 9, end: 11, teacher: "滕老师", location: "210教室", week: 7 },
    { name: "高数-13", day: "周二", time: "13:20-16:20", start: 5, end: 8, teacher: "郑老师", location: "422教室（西校区）", week: 7 },
    // ===== 第8周 (9/2-9/6) =====
    { name: "数字电子-3", day: "周三", time: "17:00-20:00", start: 9, end: 11, teacher: "刘老师13", location: "205教室", week: 8 },
    { name: "英语-11", day: "周四", time: "13:20-16:20", start: 5, end: 8, teacher: "耿老师", location: "421教室（西校区）", week: 8 },
    { name: "计算机基础-11", day: "周五", time: "9:00-12:00", start: 1, end: 4, teacher: "梁老师1", location: "422教室（西校区）", week: 8 },
    { name: "电路-8", day: "周六", time: "9:20-12:20", start: 1, end: 4, teacher: "滕老师", location: "301教室", week: 8 },

    // ===== 第9周 (9/7-9/13) · 真实课表 =====
    { name: "计算机基础-12", day: "周一", time: "9:00-12:00",  start: 1, end: 4, teacher: "梁老师1", location: "421教室（西校区）", week: 9,  cls: "both" },
    { name: "英语-12",       day: "周一", time: "13:20-16:20", start: 5, end: 8, teacher: "耿老师",  location: "421教室（西校区）", week: 9,  cls: "both" },
    { name: "数字电子-4",    day: "周三", time: "9:20-12:20",  start: 1, end: 4, teacher: "刘老师13", location: "303教室",           week: 9,  cls: "one"  },
    { name: "计算机基础-13", day: "周三", time: "13:40-16:40", start: 5, end: 8, teacher: "梁老师1", location: "514教室（西校区）", week: 9,  cls: "both" },
    { name: "电路-9",        day: "周四", time: "17:00-20:00", start: 9, end: 11, teacher: "滕老师", location: "205教室",           week: 9,  cls: "one"  },
    { name: "高数-14",       day: "周五", time: "13:40-16:40", start: 5, end: 8, teacher: "郑老师",  location: "514教室（西校区）", week: 9,  cls: "both" },
    { name: "电路-10",       day: "周六", time: "13:20-16:20", start: 5, end: 8, teacher: "滕老师",  location: "404教室",           week: 9,  cls: "one"  },

    // ===== 第10周 (9/14-9/20) · 真实课表 =====
    { name: "英语-13",       day: "周一", time: "9:20-12:20",  start: 1, end: 4, teacher: "耿老师",  location: "505教室",           week: 10, cls: "both" },
    { name: "电路-11",       day: "周二", time: "17:00-20:00", start: 9, end: 11, teacher: "滕老师", location: "205教室",           week: 10, cls: "one"  },
    { name: "高数-15",       day: "周三", time: "13:20-16:20", start: 5, end: 8, teacher: "郑老师",  location: "422教室（西校区）", week: 10, cls: "both" },
    { name: "计算机基础-14", day: "周五", time: "9:20-12:20",  start: 1, end: 4, teacher: "梁老师1", location: "513教室（西校区）", week: 10, cls: "both" },
    { name: "数字电子-5",    day: "周日", time: "9:00-12:00",  start: 1, end: 4, teacher: "刘老师13", location: "203教室",           week: 10, cls: "one"  },

    // ===== 第11周 (9/21-9/27) · 真实课表 =====
    { name: "高数-16",       day: "周一", time: "9:00-12:00",  start: 1, end: 4, teacher: "郑老师",  location: "420教室（西校区）", week: 11, cls: "both" },
    { name: "电路-12",       day: "周二", time: "17:00-20:00", start: 9, end: 11, teacher: "滕老师", location: "205教室",           week: 11, cls: "one"  },
    { name: "数字电子-6",    day: "周三", time: "9:00-12:00",  start: 1, end: 4, teacher: "刘老师13", location: "401教室",           week: 11, cls: "one"  },
    { name: "计算机基础-15", day: "周四", time: "9:20-12:20",  start: 1, end: 4, teacher: "梁老师1", location: "514教室（西校区）", week: 11, cls: "both" },
    { name: "英语-14",       day: "周六", time: "13:20-16:20", start: 5, end: 8, teacher: "耿老师",  location: "420教室（西校区）", week: 11, cls: "both" },
    { name: "数字电子-7",    day: "周日", time: "13:20-16:20", start: 5, end: 8, teacher: "刘老师13", location: "402教室",           week: 11, cls: "one"  },

    // ===== 第12周 (9/28-10/4) · 真实课表 =====
    { name: "高数-17",       day: "周一", time: "9:00-12:00",  start: 1, end: 4, teacher: "郑老师",  location: "422教室（西校区）", week: 12, cls: "both" },
    { name: "英语-15",       day: "周二", time: "13:20-16:20", start: 5, end: 8, teacher: "耿老师",  location: "422教室（西校区）", week: 12, cls: "both" },
    { name: "计算机基础-16", day: "周三", time: "13:40-16:40", start: 5, end: 8, teacher: "梁老师1", location: "514教室（西校区）", week: 12, cls: "both" },

    // ===== 第13周 (10/5-10/11) · 真实课表 =====
    { name: "数字电子-8",    day: "周四", time: "9:20-12:20",  start: 1, end: 4, teacher: "刘老师13", location: "304教室",           week: 13, cls: "one"  },
    { name: "数字电子-9",    day: "周五", time: "9:20-12:20",  start: 1, end: 4, teacher: "刘老师13", location: "502教室",           week: 13, cls: "one"  },
    { name: "计算机基础-17", day: "周六", time: "9:00-12:00",  start: 1, end: 4, teacher: "梁老师1", location: "422教室（西校区）", week: 13, cls: "both" },
    { name: "数字电子-10",   day: "周日", time: "13:20-16:20", start: 5, end: 8, teacher: "刘老师13", location: "404教室",           week: 13, cls: "one"  },

    // ===== 第14周 (10/12-10/18) · 真实课表 =====
    { name: "高数-18",       day: "周一", time: "9:20-12:20",  start: 1, end: 4, teacher: "郑老师",  location: "513教室（西校区）", week: 14, cls: "both" },
    { name: "数字电子-11",   day: "周三", time: "9:00-12:00",  start: 1, end: 4, teacher: "刘老师13", location: "401教室",           week: 14, cls: "one"  },
    { name: "计算机基础-18", day: "周四", time: "13:40-16:40", start: 5, end: 8, teacher: "梁老师1", location: "513教室（西校区）", week: 14, cls: "both" },
    { name: "数字电子-12",   day: "周五", time: "17:00-20:00", start: 9, end: 11, teacher: "刘老师13", location: "205教室",          week: 14, cls: "one"  },
    { name: "英语-16",       day: "周日", time: "13:40-16:40", start: 5, end: 8, teacher: "耿老师",  location: "307教室",           week: 14, cls: "both" },
  ];
  await bulkAdd(defaults);
}

// === 启动 ===
document.addEventListener('DOMContentLoaded', init);
