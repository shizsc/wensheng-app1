/**
 * rerender.js — 页面渲染分发（唯一入口，供 main 与各数据/导入模块复用）
 *
 * 抽出的原因（P1-01 收尾）：`renderPage` 被 main 与数据编排、导入导出多处需要，
 * 集中一处避免重复实现；本模块只做“切换 active 页 + 调对应 render”。
 */
import { $, $$ } from './utils.js';
import { state } from './state.js';
import { renderToday } from './render/today.js';
import { renderTimetable } from './render/timetable.js';
import { renderManage } from './render/manage.js';
import { renderSettings } from './render/settings.js';

/**
 * 切换并渲染指定页面。
 * @param {'today'|'timetable'|'manage'|'settings'} page
 */
export function renderPage(page) {
  state.currentPage = page;
  $$('.page').forEach((p) => p.classList.remove('active'));
  const el = $('#page-' + page);
  if (el) el.classList.add('active');

  if (page === 'today') renderToday();
  else if (page === 'timetable') renderTimetable();
  else if (page === 'manage') renderManage();
  else if (page === 'settings') renderSettings();
}

/** 重新渲染当前页面 */
export function rerenderCurrent() {
  renderPage(state.currentPage || 'today');
}
