/**
 * render/settings.js — 设置页渲染与 UI 同步
 *
 * P2-07：把「设置 → UI」的同步抽为 applySettingsToUI()，供 init() 与 renderSettings() 共用。
 */
import { state } from '../state.js';
import { DAY_ARR } from '../config.js';
import { $ } from '../utils.js';
import { parseISODate } from '../utils.js';

/** 应用深色模式到 <body> 与开关 */
export function applyDarkMode(on) {
  if (typeof document !== 'undefined') document.body.classList.toggle('dark', !!on);
  const sw = $('#setting-darkmode');
  if (sw) sw.checked = !!on;
}

/** 同步「模拟日期」相关 UI（日期框、显示文案、重置按钮可见性） */
export function updateSimulatedDateUI() {
  const dateInput = $('#setting-date');
  const dateDisplay = $('#simulated-date-display');
  const resetBtn = $('#btn-reset-date');

  if (state.simulatedDate) {
    const d = parseISODate(state.simulatedDate);
    if (dateInput) dateInput.value = state.simulatedDate;
    if (dateDisplay) dateDisplay.textContent = `${d.getMonth() + 1}月${d.getDate()}日 ${DAY_ARR[d.getDay() === 0 ? 6 : d.getDay() - 1]}`;
    if (resetBtn) resetBtn.style.display = 'inline-flex';
  } else {
    if (dateInput) dateInput.value = '';
    if (dateDisplay) dateDisplay.textContent = '';
    if (resetBtn) resetBtn.style.display = 'none';
  }
}

/**
 * 把 state 中的设置项同步到设置页控件（去重后的单点，P2-07）。
 */
export function applySettingsToUI() {
  const setVal = (sel, v) => { const el = $(sel); if (el) el.value = v; };
  const setChk = (sel, v) => { const el = $(sel); if (el) el.checked = !!v; };

  setVal('#setting-week', state.currentWeek);
  setChk('#setting-reminder', state.reminderEnabled);
  setVal('#setting-remind-time', state.remindTime);
  setChk('#setting-darkmode', state.darkMode);
  setChk('#setting-daily-reminder', state.dailyReminderEnabled);
  setVal('#setting-daily-hour', state.dailyReminderHour);

  applyDarkMode(state.darkMode);
  updateSimulatedDateUI();

  // P1-06：模拟态整体灰显 + 标注「预览」
  if (typeof document !== 'undefined') {
    document.body.setAttribute('data-simulated', state.simulatedDate ? '1' : '0');
  }
}

/** 渲染设置页（当前即同步所有控件） */
export function renderSettings() {
  applySettingsToUI();
}
