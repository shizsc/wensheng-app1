/**
 * 课程表 APP — 主逻辑
 */

// === 状态 ===
const state = {
  currentPage: 'today',
  currentWeek: 1,
  courses: [],
  reminderEnabled: false,
  remindTime: 10,
  darkMode: false,
  simulatedDate: null, // 手动模拟日期（null=使用真实日期）
  dailyReminderEnabled: false, // 每日自动发送课程
  dailyReminderHour: 7, // 每日提醒时间（默认7点）
};

const DAY_MAP = { '周一':1, '周二':2, '周三':3, '周四':4, '周五':5, '周六':6, '周日':7 };
const DAY_ARR = ['周一','周二','周三','周四','周五','周六','周日'];

// === 版本检测自动更新 ===
const CURRENT_VERSION = 1;
const VERSION_URL = 'https://raw.githubusercontent.com/你的用户名/wensheng-app/main/version.json';

async function checkUpdate() {
  try {
    const res = await fetch(VERSION_URL + '?t=' + Date.now());
    if (!res.ok) return;
    const data = await res.json();
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

// === 工具函数 ===
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function showToast(msg, type = '') {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast'; }, 2500);
}

function getTodayDayOfWeek() {
  let d;
  if (state.simulatedDate) {
    d = new Date(state.simulatedDate);
  } else {
    d = new Date();
  }
  const day = d.getDay(); // 0=Sunday
  return day === 0 ? '周日' : DAY_ARR[day - 1];
}

function getTodayDateStr() {
  let d;
  if (state.simulatedDate) {
    d = new Date(state.simulatedDate);
  } else {
    d = new Date();
  }
  return `${d.getMonth()+1}月${d.getDate()}日`;
}

function getTodayDate() {
  if (state.simulatedDate) return new Date(state.simulatedDate);
  return new Date();
}

function parseTime(timeStr) {
  // 解析 "13:40-16:40" 格式
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return {
    startHour: parseInt(match[1]), startMin: parseInt(match[2]),
    endHour: parseInt(match[3]), endMin: parseInt(match[4])
  };
}

function isCurrentClass(course) {
  const now = new Date();
  const currentDay = getTodayDayOfWeek();
  if (course.day !== currentDay) return false;
  const time = parseTime(course.time);
  if (!time) return false;
  const startMinutes = time.startHour * 60 + time.startMin;
  const endMinutes = time.endHour * 60 + time.endMin;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

function isNextClass(course) {
  const now = new Date();
  const currentDay = getTodayDayOfWeek();
  if (course.day !== currentDay) return false;
  const time = parseTime(course.time);
  if (!time) return false;
  const startMinutes = time.startHour * 60 + time.startMin;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes < startMinutes && (startMinutes - nowMinutes) <= 30;
}

// === 初始化 ===
async function init() {
  // 数据版本检查：版本不匹配时强制刷新
  const savedVersion = parseInt(localStorage.getItem('dataVersion')) || 0;
  if (savedVersion < DATA_VERSION) {
    await clearAllCourses();
    await importDefaultData();
    localStorage.setItem('dataVersion', DATA_VERSION);
    showToast('课程数据已自动更新', 'success');
  }
  
  loadSettings();
  await loadCourses();
  bindNav();
  bindActions();
  renderPage('today');
  
  // 启动每日自动推送
  if (state.dailyReminderEnabled) {
    requestNotificationPermission();
    scheduleDailyReminder();
  }
  
  // 显示版本号
  $('#version-display').textContent = `文盛课程表 v1.2.${CURRENT_VERSION} · WENSHENGEDUCATION`;
  
  // 检测版本更新
  checkUpdate();
}

// 版本号：数据更新时递增，触发强制刷新
const DATA_VERSION = 7;

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
  
  if (state.darkMode) document.body.classList.add('dark');
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

// === 每日自动推送课程 ===
let dailyTimer = null;

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function scheduleDailyReminder() {
  if (dailyTimer) clearInterval(dailyTimer);
  // 每分钟检查一次是否到达推送时间
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
    .filter(c => c.day === today && c.week === state.currentWeek)
    .sort((a, b) => {
      const ta = parseTime(a.time), tb = parseTime(b.time);
      if (!ta || !tb) return 0;
      return (ta.startHour * 60 + ta.startMin) - (tb.startHour * 60 + tb.startMin);
    });

  const dateStr = getTodayDateStr();
  
  if (todayCourses.length === 0) {
    new Notification('📅 文盛课程表', {
      body: `${dateStr} ${today} 今天没有课~`,
      icon: '📚'
    });
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
    dateDisplay.style.display = 'inline';
    resetBtn.style.display = 'inline-block';
  } else {
    dateInput.value = '';
    dateDisplay.textContent = '';
    dateDisplay.style.display = 'none';
    resetBtn.style.display = 'none';
  }
}

async function loadCourses() {
  state.courses = await getAllCourses();
  // 如果数据库为空，导入默认数据
  if (state.courses.length === 0) {
    await importDefaultData();
    state.courses = await getAllCourses();
  }
}

// === 导航 ===
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
  $('#page-' + page).classList.add('active');
  
  if (page === 'today') renderToday();
  else if (page === 'timetable') renderTimetable();
  else if (page === 'manage') renderManage();
  else if (page === 'settings') renderSettings();
}

// 根据日期计算所属周次（基于2026年7月13日周一为第1周）
function getWeekByDate(date) {
  const WEEK_1_START = new Date(2026, 6, 13); // 2026年7月13日（周一）
  const diffTime = date.getTime() - WEEK_1_START.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

// === 今日页面 ===
function renderToday() {
  const today = getTodayDayOfWeek();
  const dateStr = getTodayDateStr();
  $('#today-date').innerHTML = `${dateStr} ${today}`;
  
  // 自动根据今天日期计算所属周次
  const realToday = new Date();
  const todayWeek = getWeekByDate(realToday);
  
  const list = $('#today-list');
  const todayCourses = state.courses
    .filter(c => c.day === today && c.week === todayWeek)
    .sort((a, b) => {
      const ta = parseTime(a.time), tb = parseTime(b.time);
      if (!ta || !tb) return 0;
      return (ta.startHour * 60 + ta.startMin) - (tb.startHour * 60 + tb.startMin);
    });
  
  if (todayCourses.length === 0) {
    list.innerHTML = `
      <div class="today-empty">
        <div class="empty-icon">🎉</div>
        <p>今天没有课~</p>
      </div>`;
    return;
  }
  
  list.innerHTML = todayCourses.map(c => {
    const isCurrent = isCurrentClass(c);
    const isNext = isNextClass(c);
    let cardClass = 'today-card';
    if (isCurrent) cardClass += ' current';
    else if (isNext) cardClass += ' next';
    
    return `
      <div class="${cardClass}">
        <span class="course-time">${c.time}</span>
        <div class="course-name">
          ${c.name}
          ${isCurrent ? '<span class="current-badge">正在上课</span>' : ''}
        </div>
        <div class="course-info">
          <span>📍 ${c.location || '未指定'}</span>
          <span>👤 ${c.teacher || '未指定'}</span>
          <span>📚 第${c.start}-${c.end}节</span>
        </div>
      </div>`;
  }).join('');
}

// === 课表页面（文盛专属：上午/下午/晚上 三大节，左侧无时间列） ===
const TIME_SLOTS = [
  { label: '上午', time: '9:00-12:00', periods: [1, 4] },
  { label: '下午', time: '13:20-16:20', periods: [5, 8] },
  { label: '晚上', time: '17:00-20:00', periods: [9, 11] },
];

// 获取指定周每天的日期（基于课程表起始日：2026年7月13日周一）
function getWeekDates() {
  const WEEK_1_START = new Date(2026, 6, 13); // 2026年7月13日（周一）
  const daysOffset = (state.currentWeek - 1) * 7;
  const monday = new Date(WEEK_1_START);
  monday.setDate(WEEK_1_START.getDate() + daysOffset);
  
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return dates;
}

function renderTimetable() {
  $('#current-week-label').textContent = `第${state.currentWeek}周`;
  const grid = $('#timetable-grid');
  const today = getTodayDayOfWeek();
  const simLabel = state.simulatedDate ? ' (模拟)' : '';
  $('#current-week-label').textContent = `第${state.currentWeek}周${simLabel}`;
  const weekDates = getWeekDates();
  
  // 表头（使用 table 确保完美对齐）
  let html = '<table><thead><tr class="timetable-header">';
  DAY_ARR.forEach((d, i) => {
    const isToday = d === today ? ' today' : '';
    html += `<th class="th${isToday}"><div class="th-day">${d}</div><div class="th-date">${weekDates[i]}</div></th>`;
  });
  html += '</tr></thead><tbody>';
  
  // 行：上午/下午/晚上
  TIME_SLOTS.forEach(slot => {
    html += `<tr class="timetable-row">`;
    DAY_ARR.forEach(day => {
      // 找到匹配此时间段的课程（支持单节/连节，按开始节数匹配）
      const matchCourse = state.courses.find(c => 
        c.day === day && parseInt(c.week) === state.currentWeek && 
        parseInt(c.start) >= slot.periods[0] && parseInt(c.start) <= slot.periods[1]
      );
      if (matchCourse) {
        html += `<td class="cell">
          <div class="course-block" data-id="${matchCourse.id}">
            <div class="block-name">${matchCourse.name}</div>
            <div class="block-time">🕐 ${matchCourse.time || slot.time}</div>
            <div class="block-info">👤 ${matchCourse.teacher || ''}</div>
            <div class="block-info">📍 ${matchCourse.location || ''}</div>
          </div>
        </td>`;
      } else {
        html += '<td class="cell"></td>';
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  
  grid.innerHTML = html;
}

// === 管理页面 ===
function renderManage() {
  const list = $('#course-list');
  const courses = [...state.courses].sort((a, b) => {
    const da = DAY_MAP[a.day] || 0, db = DAY_MAP[b.day] || 0;
    if (da !== db) return da - db;
    const ta = parseTime(a.time), tb = parseTime(b.time);
    if (!ta || !tb) return 0;
    return (ta.startHour * 60 + ta.startMin) - (tb.startHour * 60 + tb.startMin);
  });
  
  if (courses.length === 0) {
    list.innerHTML = '<div class="today-empty"><div class="empty-icon">📝</div><p>暂无课程，点击右上角添加或导入</p></div>';
    return;
  }
  
  list.innerHTML = courses.map(c => `
    <div class="course-item">
      <div class="item-info">
        <div class="item-name">${c.name}</div>
        <div class="item-meta">${c.day} · 第${c.start}-${c.end}节 · ${c.time} · ${c.location || '未指定'} · ${c.teacher || '未指定'} · 第${c.week}周</div>
      </div>
      <div class="item-actions">
        <button class="icon-btn" onclick="editCourse(${c.id})">✏️</button>
        <button class="icon-btn" onclick="removeCourse(${c.id})">🗑️</button>
      </div>
    </div>
  `).join('');
}

// === 设置页面 ===
function renderSettings() {
  $('#setting-week').value = state.currentWeek;
  $('#setting-reminder').checked = state.reminderEnabled;
  $('#setting-remind-time').value = state.remindTime;
  $('#setting-darkmode').checked = state.darkMode;
}

// === 操作绑定 ===
function bindActions() {
  // 周次切换
  $('#prev-week').addEventListener('click', () => {
    if (state.currentWeek > 1) { state.currentWeek--; saveSettings(); renderTimetable(); }
  });
  $('#next-week').addEventListener('click', () => {
    if (state.currentWeek < 20) { state.currentWeek++; saveSettings(); renderTimetable(); }
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
    document.body.classList.toggle('dark', state.darkMode);
    saveSettings();
  });
  
  // 手动检查更新
  $('#btn-check-update').addEventListener('click', async () => {
    const btn = $('#btn-check-update');
    btn.textContent = '检查中...';
    btn.disabled = true;
    try {
      const res = await fetch(VERSION_URL + '?t=' + Date.now());
      const data = await res.json();
      if (data.versionCode > CURRENT_VERSION) {
        if (confirm(`发现新版本 v${data.versionName}\n\n更新内容：${data.releaseNote || '无'}\n\n是否立即下载？`)) {
          window.open(data.apkUrl, '_system');
        }
      } else {
        showToast('已是最新版本', 'success');
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
      showToast('浏览器不支持通知功能', 'error');
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
      showToast('已清空所有课程', 'success');
    }
  });
  
  // 导入Excel
  $('#btn-import').addEventListener('click', () => $('#file-input').click());
  $('#file-input').addEventListener('change', handleFileImport);
  
  // 添加课程
  $('#btn-add').addEventListener('click', () => openModal());
  
  // 弹窗
  $('#btn-cancel').addEventListener('click', closeModal);
  $('#course-form').addEventListener('submit', handleSubmit);
}

// === Excel 导入 ===
function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      
      // 解析数据（跳过标题行和空行）
      const courses = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue; // 无课程名跳过
        if (i < 4 && typeof row[0] === 'string' && row[0].includes('课程')) continue; // 跳过表头
        if (typeof row[0] === 'string' && row[0].includes('说明')) continue; // 跳过说明
        
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

// === 添加/编辑课程 ===
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
  renderManage();
  if (state.currentPage === 'today') renderToday();
}

// === 编辑/删除 ===
async function editCourse(id) {
  const course = state.courses.find(c => c.id === id);
  if (course) openModal(course);
}

async function removeCourse(id) {
  if (!confirm('确定删除此课程？')) return;
  await deleteCourse(id);
  state.courses = state.courses.filter(c => c.id !== id);
  renderManage();
  showToast('已删除', 'success');
  if (state.currentPage === 'today') renderToday();
}

// === 默认数据 ===
async function importDefaultData() {
  const defaults = [
    { name: "英语-1", day: "周三", time: "13:40-16:40", start: 5, end: 8, teacher: "耿老师", location: "505教室", week: 1 },
    { name: "模拟电子-1", day: "周五", time: "13:20-16:20", start: 5, end: 8, teacher: "吴老师", location: "304教室", week: 1 },
    { name: "计算机基础-1", day: "周六", time: "9:20-12:20", start: 1, end: 4, teacher: "梁老师1", location: "505教室", week: 1 },
    { name: "高数-1", day: "周六", time: "13:40-16:40", start: 5, end: 8, teacher: "郑老师", location: "513教室（西校区）", week: 1 },
    { name: "模拟电子-2", day: "周日", time: "9:20-12:20", start: 1, end: 4, teacher: "吴老师", location: "301教室", week: 1 },
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
    { name: "计算机基础-3", day: "周三", time: "13:40-16:40", start: 5, end: 8, teacher: "梁老师1", location: "514教室（西校区）", week: 3 },
    { name: "模拟电子-8", day: "周四", time: "13:20-16:20", start: 5, end: 8, teacher: "吴老师", location: "302教室", week: 3 },
    { name: "计算机基础-4", day: "周五", time: "9:00-12:00", start: 1, end: 4, teacher: "梁老师1", location: "422教室（西校区）", week: 3 },
    { name: "英语-4", day: "周五", time: "9:00-12:00", start: 1, end: 4, teacher: "耿老师", location: "420教室（西校区）", week: 3 },
    { name: "高数-5", day: "周六", time: "13:20-16:20", start: 5, end: 8, teacher: "郑老师", location: "421教室（西校区）", week: 3 },
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
    // ===== 第9周 (9/7-9/12) =====
    { name: "计算机基础-12", day: "周一", time: "9:00-12:00", start: 1, end: 4, teacher: "梁老师1", location: "421教室（西校区）", week: 9 },
    { name: "英语-12", day: "周一", time: "13:20-16:20", start: 5, end: 8, teacher: "耿老师", location: "421教室（西校区）", week: 9 },
    { name: "数字电子-4", day: "周三", time: "9:20-12:20", start: 1, end: 4, teacher: "刘老师13", location: "303教室", week: 9 },
    { name: "计算机基础-13", day: "周三", time: "13:40-16:40", start: 5, end: 8, teacher: "梁老师1", location: "514教室（西校区）", week: 9 },
    { name: "电路-9", day: "周四", time: "17:00-20:00", start: 9, end: 11, teacher: "滕老师", location: "205教室", week: 9 },
    { name: "高数-14", day: "周五", time: "13:40-16:40", start: 5, end: 8, teacher: "郑老师", location: "514教室（西校区）", week: 9 },
    { name: "电路-10", day: "周六", time: "13:20-16:20", start: 5, end: 8, teacher: "滕老师", location: "404教室", week: 9 },
    { name: "英语-13", day: "周六", time: "9:20-12:20", start: 1, end: 4, teacher: "耿老师", location: "505教室", week: 9 },
    // ===== 第10周 (9/14-9/20) =====
    { name: "电路-11", day: "周一", time: "17:00-20:00", start: 9, end: 11, teacher: "滕老师", location: "205教室", week: 10 },
    { name: "高数-15", day: "周三", time: "13:20-16:20", start: 5, end: 8, teacher: "郑老师", location: "422教室（西校区）", week: 10 },
    { name: "计算机基础-14", day: "周五", time: "9:20-12:20", start: 1, end: 4, teacher: "梁老师1", location: "513教室（西校区）", week: 10 },
    { name: "数字电子-5", day: "周日", time: "9:00-12:00", start: 1, end: 4, teacher: "刘老师13", location: "203教室", week: 10 },
    // ===== 第11周 (9/21-9/27) =====
    { name: "高数-16", day: "周一", time: "9:00-12:00", start: 1, end: 4, teacher: "郑老师", location: "420教室（西校区）", week: 11 },
    { name: "电路-12", day: "周二", time: "17:00-20:00", start: 9, end: 11, teacher: "滕老师", location: "205教室", week: 11 },
    { name: "数字电子-6", day: "周三", time: "9:00-12:00", start: 1, end: 4, teacher: "刘老师13", location: "401教室", week: 11 },
    { name: "计算机基础-15", day: "周四", time: "9:20-12:20", start: 1, end: 4, teacher: "梁老师1", location: "514教室（西校区）", week: 11 },
    { name: "英语-14", day: "周六", time: "13:20-16:20", start: 5, end: 8, teacher: "耿老师", location: "420教室（西校区）", week: 11 },
    { name: "数字电子-7", day: "周日", time: "13:20-16:20", start: 5, end: 8, teacher: "刘老师13", location: "402教室", week: 11 },
    { name: "高数-17", day: "周日", time: "9:00-12:00", start: 1, end: 4, teacher: "郑老师", location: "422教室（西校区）", week: 11 },
    // ===== 第12周 (9/28-10/8，含国庆假期) =====
    { name: "英语-15", day: "周一", time: "13:20-16:20", start: 5, end: 8, teacher: "耿老师", location: "422教室（西校区）", week: 12 },
    { name: "计算机基础-16", day: "周二", time: "13:40-16:40", start: 5, end: 8, teacher: "梁老师1", location: "514教室（西校区）", week: 12 },
    { name: "数字电子-8", day: "周四", time: "9:20-12:20", start: 1, end: 4, teacher: "刘老师13", location: "304教室", week: 12 },
    // ===== 第13周 (10/9-10/11) =====
    { name: "数字电子-9", day: "周五", time: "9:00-12:00", start: 1, end: 4, teacher: "刘老师13", location: "502教室", week: 13 },
    { name: "计算机基础-17", day: "周五", time: "13:20-16:20", start: 5, end: 8, teacher: "梁老师1", location: "422教室（西校区）", week: 13 },
    { name: "数字电子-10", day: "周日", time: "13:20-16:20", start: 5, end: 8, teacher: "刘老师13", location: "404教室", week: 13 },
    // ===== 第14周 (10/12-10/18) =====
    { name: "高数-18", day: "周一", time: "9:20-12:20", start: 1, end: 4, teacher: "郑老师", location: "513教室（西校区）", week: 14 },
    { name: "数字电子-11", day: "周三", time: "9:00-12:00", start: 1, end: 4, teacher: "刘老师13", location: "401教室", week: 14 },
    { name: "计算机基础-18", day: "周四", time: "13:40-16:40", start: 5, end: 8, teacher: "梁老师1", location: "513教室（西校区）", week: 14 },
    { name: "数字电子-12", day: "周五", time: "17:00-20:00", start: 9, end: 11, teacher: "刘老师13", location: "205教室", week: 14 },
    { name: "英语-16", day: "周日", time: "13:40-16:40", start: 5, end: 8, teacher: "耿老师", location: "307教室", week: 14 },
  ];
  await bulkAdd(defaults);
}

// === 启动 ===
document.addEventListener('DOMContentLoaded', init);
