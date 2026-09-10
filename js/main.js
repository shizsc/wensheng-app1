/**
 * main.js — 应用入口装配（副作用入口，无导出）
 *
 * 职责收敛（P1-01 收尾）：只负责**入口装配与事件绑定**；
 * 数据生命周期编排见 data-ops.js，导入导出见 import-export.js，页面分发见 rerender.js。
 * 设计要点：
 *  - P0-02：init 全程 try/catch，失败也绝不白屏（静态骨架始终在 DOM 中）
 *  - P0-03/04 + P1-04：统一走 data-ops（内部委托 data/migrate 的 planUpgrade / applyRefresh）
 *  - P1-01：内联 onclick 全部改为事件委托（见 bindActions）
 */
import { APP_META, loadAppMeta } from './config.js';
import {
  $, $$, showToast, log, sanitizeCourseInput, formatMonthDay,
} from './utils.js';
import { state, getTodayDate, getTodayDayOfWeek } from './state.js';
import { loadSettings, saveSettings } from './storage.js';
import { addCourse, updateCourse, deleteCourse } from './db.js';
import { doCheckUpdate } from './update.js';
import { createNotifier } from './notify.js';
import { bindManageEvents } from './render/manage.js';
import { applySettingsToUI, applyDarkMode, updateSimulatedDateUI } from './render/settings.js';
import { renderPage } from './rerender.js';
import {
  runDataMigration, loadCourses, refreshData, clearAll, coursesForToday,
} from './data-ops.js';
import { exportJson, handleJsonImport, handleFileImport } from './import-export.js';

/* =========================================================
 * 通知器（运行时按能力选择 Web / 站内降级实现）
 * ========================================================= */
const notifier = createNotifier({ showToast, showBanner: showReminderBanner });

/* =========================================================
 * 小工具
 * ========================================================= */

/** 站内提醒横幅（仅 App 内可见，诚实降级） */
function showReminderBanner(msg) {
  const el = $('#reminder-banner');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 8000);
}

/** 打开外部链接：优先 Capacitor 拦截的 _system，失败降级 location.href（R5 授权方案） */
function openExternalUrl(url) {
  try {
    const w = window.open(url, '_system');
    if (!w) window.location.href = url;
  } catch (err) {
    log('warn', 'window.open 失败，降级为 location.href', err);
    try { window.location.href = url; } catch (e) { log('error', 'location.href 亦失败', e); }
  }
}

/** addEventListener 空值保护的简写 */
function on(sel, evt, handler) {
  const el = $(sel);
  if (el) el.addEventListener(evt, handler);
}

/* =========================================================
 * 启动入口（P0-02 全程兜底）
 * ========================================================= */
async function init() {
  applyStoredTheme();   // 尽早应用主题，避免首帧闪白

  try {
    bindNav();
    bindActions();

    await loadAppMeta();
    loadSettings(state);
    applySettingsToUI();

    await runDataMigration();
    await loadCourses();

    renderPage('today');
    updateVersionDisplays();
    setupNotifier();
    maybeCatchUpReminder();
  } catch (err) {
    log('error', 'init 数据管线失败', err);
    if (!Array.isArray(state.courses)) state.courses = [];
    try { renderPage('today'); } catch (e) { log('error', '兜底渲染失败', e); }
    showToast('数据初始化失败，请重启 APP', 'error');
  }

  // 自动检查更新（版本未知时跳过，避免误报）
  if (APP_META.versionCode > 0) {
    doCheckUpdate({
      manual: false,
      currentVersion: APP_META.versionCode,
      currentName: APP_META.versionName,
      showToast,
      confirm: (m) => window.confirm(m),
      openUrl: openExternalUrl,
    });
  } else {
    log('warn', '版本信息不可用，跳过自动更新检查');
  }
}

/** 首帧前应用已保存主题 */
function applyStoredTheme() {
  try { applyDarkMode(localStorage.getItem('darkMode') === 'true'); } catch (err) { /* noop */ }
}

/* =========================================================
 * 版本显示（单点来源 APP_META，去掉所有硬编码）
 * ========================================================= */
function updateVersionDisplays() {
  const name = APP_META.versionName || '1.3.1';
  const vd = $('#version-display');
  if (vd) vd.textContent = `文盛课程表 v${name} · WENSHENGEDUCATION`;
  const av = $('#about-ver');
  if (av) av.textContent = `v${name} · WENSHENGEDUCATION · © 2026 文盛教育`;
}

/* =========================================================
 * 通知/提醒
 * ========================================================= */
function setupNotifier() {
  if (state.dailyReminderEnabled) {
    notifier.requestPermission();
    notifier.schedule(state.dailyReminderHour, sendDailyReminder);
  }
}

/** 每日提醒（到点触发；首行断言开关，杜绝“关了还响” P1-05） */
function sendDailyReminder() {
  if (!state.dailyReminderEnabled) return;
  notifier.notify('📅 文盛课程表', buildReminderBody());
}

/** “打开 App 时补提醒”：今日已过提醒时刻且有课 → 站内横幅（诚实降级） */
function maybeCatchUpReminder() {
  if (!state.dailyReminderEnabled) return;
  const now = new Date();
  if (now.getHours() < state.dailyReminderHour) return;
  const list = coursesForToday();
  if (list.length > 0) {
    showReminderBanner(`今日 ${list.length} 节课 · 提醒仅在本 App 打开时显示`);
  }
}

/** 「立即预览提醒」按钮逻辑 */
function previewReminder() {
  notifier.requestPermission().then(() => notifier.notify('📅 文盛课程表', buildReminderBody()));
}

/** 组装提醒正文（今日课程摘要） */
function buildReminderBody() {
  const list = coursesForToday();
  const dow = getTodayDayOfWeek();
  const dateStr = formatMonthDay(getTodayDate());
  if (list.length === 0) return `${dateStr} ${dow} 今天没有课~`;
  return `${dateStr} ${dow} 共${list.length}节课：` + list.map((c) => `${c.time} ${c.name}`).join('；');
}

/* =========================================================
 * 导航与页面
 * ========================================================= */
function bindNav() {
  $$('.tab-item').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.tab-item').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderPage(tab.dataset.page);
    });
  });
}

/* =========================================================
 * 操作绑定
 * ========================================================= */
function bindActions() {
  // 主题切换（页头按钮）
  $$('.theme-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.darkMode = !state.darkMode;
      applyDarkMode(state.darkMode);
      saveSettings(state);
    });
  });

  // 周次切换
  const prev = $('#prev-week');
  if (prev) prev.addEventListener('click', () => {
    if (state.currentWeek > 1) { state.currentWeek--; saveSettings(state); renderPage('timetable'); }
  });
  const next = $('#next-week');
  if (next) next.addEventListener('click', () => {
    if (state.currentWeek < 14) { state.currentWeek++; saveSettings(state); renderPage('timetable'); }
  });

  // 设置项
  on('#setting-week', 'change', (e) => {
    state.currentWeek = parseInt(e.target.value, 10) || 1;
    saveSettings(state);
    if (state.currentPage === 'today') renderPage('today');
    if (state.currentPage === 'timetable') renderPage('timetable');
  });
  on('#setting-reminder', 'change', (e) => { state.reminderEnabled = e.target.checked; saveSettings(state); });
  on('#setting-remind-time', 'change', (e) => { state.remindTime = parseInt(e.target.value, 10) || 10; saveSettings(state); });
  on('#setting-darkmode', 'change', (e) => { state.darkMode = e.target.checked; applyDarkMode(state.darkMode); saveSettings(state); });

  // 检查更新（与自动检查共用 doCheckUpdate，P2-07）
  const btnCheck = $('#btn-check-update');
  if (btnCheck) btnCheck.addEventListener('click', async () => {
    btnCheck.textContent = '检查中...';
    btnCheck.disabled = true;
    try {
      await doCheckUpdate({
        manual: true,
        currentVersion: APP_META.versionCode || 0,
        currentName: APP_META.versionName || '1.3.1',
        showToast,
        confirm: (m) => window.confirm(m),
        openUrl: openExternalUrl,
      });
    } finally {
      btnCheck.textContent = '检查';
      btnCheck.disabled = false;
    }
  });

  // 立即预览提醒
  const btnTest = $('#btn-test-notify');
  if (btnTest) btnTest.addEventListener('click', previewReminder);

  // 每日提醒开关（P1-05：取消勾选必须清除定时器）
  const dailyRem = $('#setting-daily-reminder');
  if (dailyRem) dailyRem.addEventListener('change', (e) => {
    state.dailyReminderEnabled = e.target.checked;
    saveSettings(state);
    if (state.dailyReminderEnabled) {
      notifier.requestPermission().then(() => notifier.schedule(state.dailyReminderHour, sendDailyReminder));
    } else {
      notifier.stop();
    }
  });
  const dailyHour = $('#setting-daily-hour');
  if (dailyHour) dailyHour.addEventListener('change', (e) => {
    state.dailyReminderHour = parseInt(e.target.value, 10) || 7;
    saveSettings(state);
    if (state.dailyReminderEnabled) notifier.schedule(state.dailyReminderHour, sendDailyReminder);
  });

  // 模拟日期
  const setDate = $('#setting-date');
  if (setDate) setDate.addEventListener('change', (e) => {
    state.simulatedDate = e.target.value || null;
    saveSettings(state);
    updateSimulatedDateUI();
    if (state.currentPage === 'today') renderPage('today');
    if (state.currentPage === 'timetable') renderPage('timetable');
  });
  const resetDate = $('#btn-reset-date');
  if (resetDate) resetDate.addEventListener('click', () => {
    state.simulatedDate = null;
    saveSettings(state);
    updateSimulatedDateUI();
    if (state.currentPage === 'today') renderPage('today');
    if (state.currentPage === 'timetable') renderPage('timetable');
    showToast('已恢复为真实日期', 'success');
  });

  // 强制刷新数据（P0-03 原子替换 + 逃生快照）
  const btnRefresh = $('#btn-refresh-data');
  if (btnRefresh) btnRefresh.addEventListener('click', () => {
    if (window.confirm('将重新导入全部课程数据（用户自建课程会被覆盖，请先导出备份），继续吗？')) {
      refreshData();
    }
  });

  // 清空（P1-04 持久化清空意图）
  const btnClear = $('#btn-clear-all');
  if (btnClear) btnClear.addEventListener('click', () => {
    if (window.confirm('确定要清空所有课程数据吗？此操作不可撤销。')) clearAll();
  });

  // 数据导出/导入 JSON（逃生通道 B）
  on('#btn-export-json', 'click', exportJson);
  const btnImportJson = $('#btn-import-json');
  if (btnImportJson) btnImportJson.addEventListener('click', () => { const f = $('#file-json'); if (f) f.click(); });
  on('#file-json', 'change', handleJsonImport);

  // 导入 Excel
  on('#btn-import', 'click', () => { const f = $('#file-input'); if (f) f.click(); });
  on('#file-input', 'change', handleFileImport);

  // 添加课程
  on('#btn-add', 'click', () => openModal());

  // 弹窗
  on('#btn-cancel', 'click', closeModal);
  on('#course-form', 'submit', handleSubmit);
  const modal = $('#modal-course');
  if (modal) modal.addEventListener('click', (e) => { if (e.target.id === 'modal-course') closeModal(); });

  // 管理页事件委托（P1-01，替代内联 onclick）
  bindManageEvents({ onEdit: editCourse, onDelete: removeCourse });

  // 课表课程块点击 → 打开编辑（委托绑定在容器上，重渲染不失效）
  const grid = $('#timetable-grid');
  if (grid) grid.addEventListener('click', (e) => {
    const block = e.target.closest('.block');
    if (!block) return;
    const id = parseInt(block.dataset.id, 10);
    const course = state.courses.find((c) => c.id === id);
    if (course) openModal(course);
  });
}

/* =========================================================
 * 添加 / 编辑 / 删除课程（表单与弹窗属 UI 绑定职责，保留在入口）
 * ========================================================= */
function openModal(course = null) {
  const setVal = (sel, v) => { const el = $(sel); if (el) el.value = v; };
  const title = $('#modal-title');
  if (title) title.textContent = course ? '编辑课程' : '添加课程';

  setVal('#f-id', course && course.id != null ? course.id : '');
  setVal('#f-name', course ? (course.name || '') : '');
  setVal('#f-day', course ? (course.day || '周一') : '周一');
  setVal('#f-time', course ? (course.time || '') : '');
  setVal('#f-start', course ? (course.start || '') : '');
  setVal('#f-end', course ? (course.end || '') : '');
  setVal('#f-teacher', course ? (course.teacher || '') : '');
  setVal('#f-location', course ? (course.location || '') : '');
  setVal('#f-week', String(course ? (course.week || state.currentWeek) : state.currentWeek));

  const modal = $('#modal-course');
  if (modal) modal.classList.add('active');
}

function closeModal() {
  const modal = $('#modal-course');
  if (modal) modal.classList.remove('active');
  const form = $('#course-form');
  if (form) form.reset();
}

async function handleSubmit(e) {
  e.preventDefault();
  const idEl = $('#f-id');
  const id = idEl ? idEl.value : '';
  const input = {
    name: $('#f-name') ? $('#f-name').value : '',
    day: $('#f-day') ? $('#f-day').value : '',
    time: $('#f-time') ? $('#f-time').value : '',
    start: $('#f-start') ? $('#f-start').value : '',
    end: $('#f-end') ? $('#f-end').value : '',
    teacher: $('#f-teacher') ? $('#f-teacher').value : '',
    location: $('#f-location') ? $('#f-location').value : '',
    week: $('#f-week') ? $('#f-week').value : '',
  };

  // P0-01③ / P2-02：入口白名单校验；不过则保留弹窗
  const res = sanitizeCourseInput(input);
  if (!res.ok) { showToast(res.error, 'error'); return; }
  const course = res.course;

  try {
    if (id) {
      course.id = parseInt(id, 10);
      const existing = state.courses.find((c) => c.id === course.id);
      if (existing && existing.cls) course.cls = existing.cls;  // 保留原合班/班级标记
      course.origin = 'user';                                   // 编辑默认课程 → 提升为用户数据
      await updateCourse(course);
    } else {
      await addCourse(course);
    }
    await loadCourses();     // 重载并补时间缓存
    closeModal();
    renderPage(state.currentPage);
    showToast(id ? '课程已更新' : '课程已添加', 'success');
  } catch (err) {
    log('error', '保存课程失败', err);
    showToast('保存失败：' + err.message, 'error');   // 保留弹窗，state 不变（P2-02）
  }
}

function editCourse(id) {
  const course = state.courses.find((c) => c.id === id);
  if (course) openModal(course);
}

async function removeCourse(id) {
  if (!window.confirm('确定删除此课程？')) return;
  try {
    await deleteCourse(id);
    state.courses = state.courses.filter((c) => c.id !== id);
    renderPage(state.currentPage);
    showToast('已删除', 'success');
  } catch (err) {
    log('error', '删除课程失败', err);
    showToast('删除失败：' + err.message, 'error');
  }
}

/* =========================================================
 * 启动
 * ========================================================= */
document.addEventListener('DOMContentLoaded', init);
