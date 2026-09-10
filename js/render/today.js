/**
 * render/today.js — 今日页渲染
 *
 * 所有动态值经 html`` 转义（P0-01）；状态徽标按“模拟日期优先”的口径着色（P1-06）。
 */
import { state, getTodayDate, getTodayDayOfWeek } from '../state.js';
import { MONTH_EN } from '../config.js';
import {
  $, html, raw, escapeHtml, getSubject, slotLabelOf, startMinutes, endMinutes,
  nowMinutes, getWeekByDate, courseStatus, formatMonthDay, getSemesterPhase,
} from '../utils.js';

/* 内联 SVG 图标（静态可信，使用 raw 透传，避免被转义） */
const ICON_TEACHER = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5"/></svg>';
const ICON_LOCATION = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>';
const ICON_PERIOD = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h6.5a1.5 1.5 0 0 1 1.5 1.5V20a1.5 1.5 0 0 0-1.5-1.5H4Z"/><path d="M20 5.5h-6.5A1.5 1.5 0 0 0 12 7v13a1.5 1.5 0 0 1 1.5-1.5H20Z"/></svg>';

const EMPTY_HTML = `
  <div class="empty">
    <div class="empty-ic">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="16" rx="3.5"/><path d="M3.5 9.5h17M8.5 3.5v3.2M15.5 3.5v3.2M9 14.5h6"/></svg>
    </div>
    <div class="empty-t">今天没有课~</div>
    <div class="empty-s">可到「课表」查看本周完整安排</div>
  </div>`;

/**
 * 生成今日课程卡片 HTML（纯函数，便于单测 XSS 转义）。
 * @param {object[]} courses
 * @param {number} nowMin 当前分钟（由调用方注入，保证确定性）
 * @returns {string}
 */
export function buildTodayCardsHtml(courses, nowMin) {
  return (courses || []).map((c) => {
    const sub = getSubject(c.name);
    const st = courseStatus(c, nowMin);
    let cardClass = 'course-card';
    let badge = '';
    if (st === 'past') {
      cardClass += ' past';
      badge = '<span class="badge badge-cls">已结束</span>';
    } else if (st === 'current') {
      cardClass += ' current';
      badge = '<span class="badge badge-now"><i class="dot"></i>上课中</span>';
    } else {
      cardClass += ' next';
      badge = '<span class="badge badge-next">待上</span>';
    }
    const clsTag = c.cls
      ? html`<span class="badge badge-cls">${c.cls === 'both' ? '合班' : '1班'}</span>`
      : '';

    return html`
      <div class="${cardClass}">
        <div class="cc-bar bar-${sub}"></div>
        <div class="cc-main">
          <div class="cc-top">
            <span class="cc-name">${c.name}</span>
            ${raw(badge)}
            ${raw(clsTag)}
          </div>
          <div class="cc-time">${slotLabelOf(c)} ${c.time}</div>
          <div class="cc-meta">
            <span class="m">${raw(ICON_TEACHER)}${c.teacher || '未指定'}</span>
            <span class="m">${raw(ICON_LOCATION)}${c.location || '未指定'}</span>
            <span class="m">${raw(ICON_PERIOD)}第${c.start}-${c.end}节</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

/** 渲染今日页 */
export function renderToday() {
  const d = getTodayDate(state);
  const todayDow = getTodayDayOfWeek(state);
  const week = getWeekByDate(d);

  const monthEl = $('#today-month');
  if (monthEl) monthEl.textContent = `${MONTH_EN[d.getMonth()]} · ${d.getFullYear()}`;

  const dateEl = $('#today-date');
  if (dateEl) dateEl.innerHTML = html`${formatMonthDay(d)}<small>${todayDow}</small>`;

  const weekEl = $('#today-week');
  if (weekEl) {
    // P2-01 越界文案：早于学期起始 → 未开课；晚于第 WEEK_MAX 周末 → 已结课
    const phase = getSemesterPhase(d);
    if (phase === 'before') weekEl.textContent = '未开课';
    else if (phase === 'after') weekEl.textContent = '已结课';
    else weekEl.textContent = `第 ${week} 周 · 基础精讲阶段`;
  }

  const subEl = $('#today-sub');
  if (subEl) subEl.textContent = state.simulatedDate ? '模拟日期查看中（预览）' : '文盛2027届基础精讲班';

  const todayCourses = state.courses
    .filter((c) => c.day === todayDow && parseInt(c.week, 10) === week)
    .sort((a, b) => startMinutes(a) - startMinutes(b));

  const totalMin = todayCourses.reduce((sum, c) => sum + Math.max(0, endMinutes(c) - startMinutes(c)), 0);
  const countEl = $('#today-count');
  if (countEl) {
    countEl.textContent = todayCourses.length
      ? `共 ${todayCourses.length} 节 · ${(totalMin / 60).toFixed(1)} 小时`
      : '今天休息';
  }

  const list = $('#today-list');
  if (!list) return;
  if (todayCourses.length === 0) {
    list.innerHTML = EMPTY_HTML;
    return;
  }
  // 模拟态用模拟日期的时分；真实态用系统时间（P1-06）
  const nowMin = state.simulatedDate ? nowMinutes(d) : nowMinutes();
  list.innerHTML = buildTodayCardsHtml(todayCourses, nowMin);
}

/** 供 main 复用：导出转义助手，避免其它模块重复 import（同时保持 today 内部一致性） */
export { escapeHtml };
