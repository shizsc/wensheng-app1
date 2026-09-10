/**
 * render/timetable.js — 课表页渲染
 *
 * 要点：同格多课不再静默丢弃（P2-05，改 filter + 并列渲染 + 撞课徽标）；
 * 所有课程字段经 html`` 转义（P0-01）；网格滚动按 LAYOUT 常量居中“今天”列。
 */
import { state, getTodayDate, getTodayDayOfWeek } from '../state.js';
import { DAY_ARR, TIME_SLOTS, SEMESTER_START, WEEK_MIN, WEEK_MAX, LAYOUT } from '../config.js';
import { $, html, raw, getSubject, getWeekByDate, getWeekDates, formatMonthDay } from '../utils.js';

const ICON_TEACHER = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5"/></svg>';
const ICON_LOCATION = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>';

/** 单个课程块（转义动态值） */
function renderBlock(course, slot, isTodayCol) {
  const sub = getSubject(course.name);
  const tag = course.cls
    ? html`<span class="b-tag ${course.cls === 'both' ? 'both' : 'one'}">${course.cls === 'both' ? '合班' : '1班'}</span>`
    : '';
  return html`<div class="block b-${sub}${isTodayCol ? ' today-block' : ''}" data-id="${course.id}">
      <div class="b-name">${course.name}</div>
      ${raw(tag)}
      <div class="b-time">${course.time || slot.time}</div>
      <div class="b-meta">
        <span>${raw(ICON_TEACHER)}${course.teacher || ''}</span>
        <span>${raw(ICON_LOCATION)}${course.location || ''}</span>
      </div>
    </div>`;
}

/**
 * 生成课表网格 HTML（纯函数，便于单测）。
 * @param {object[]} courses
 * @param {number} currentWeek
 * @param {string} todayDow
 * @param {boolean} isCurrentWeek
 * @returns {string}
 */
export function buildGridHtml(courses, currentWeek, todayDow, isCurrentWeek) {
  const weekDates = getWeekDates(currentWeek);
  let out = '<div class="tt-corner"></div>';

  DAY_ARR.forEach((day, i) => {
    const isToday = isCurrentWeek && day === todayDow;
    out += html`<div class="tt-dow${isToday ? ' today' : ''}">${day}<span class="dnum">${weekDates[i]}${isToday ? ' 今天' : ''}</span></div>`;
  });

  TIME_SLOTS.forEach((slot) => {
    out += html`<div class="tt-slot">${slot.label}</div>`;
    DAY_ARR.forEach((day) => {
      const isTodayCol = isCurrentWeek && day === todayDow;
      // P2-05：同格可能有多门课 → filter 并列展示，不再 find 丢课
      const matched = (courses || []).filter((c) =>
        c.day === day
        && parseInt(c.week, 10) === currentWeek
        && parseInt(c.start, 10) >= slot.periods[0]
        && parseInt(c.start, 10) <= slot.periods[1]);

      let inner;
      if (matched.length === 0) {
        inner = '<div class="cell-empty">—</div>';
      } else {
        const clash = matched.length > 1
          ? html`<div class="clash-badge">⚠ 撞课 ${matched.length}</div>`
          : '';
        inner = clash + matched.map((course) => renderBlock(course, slot, isTodayCol)).join('');
      }
      out += `<div class="tt-cell${isTodayCol ? ' today-col' : ''}${matched.length > 1 ? ' clash' : ''}">${inner}</div>`;
    });
  });

  return out;
}

/** 渲染课表页（含滚动居中与周切换按钮禁用态） */
export function renderTimetable() {
  const grid = $('#timetable-grid');
  if (!grid) return;

  const todayDow = getTodayDayOfWeek(state);
  const todayWeek = getWeekByDate(getTodayDate(state));
  const isCurrentWeek = state.currentWeek === todayWeek;

  const start = new Date(SEMESTER_START);
  start.setDate(start.getDate() + (state.currentWeek - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const label = $('#current-week-label');
  if (label) {
    const suffix = state.simulatedDate ? ' · 模拟' : (isCurrentWeek ? ' · 本周' : '');
    label.innerHTML = html`第 ${state.currentWeek} 周<small>${formatMonthDay(start)} — ${formatMonthDay(end)}${suffix}</small>`;
  }

  const prev = $('#prev-week');
  if (prev) prev.classList.toggle('disabled', state.currentWeek <= WEEK_MIN);
  const next = $('#next-week');
  if (next) next.classList.toggle('disabled', state.currentWeek >= WEEK_MAX);

  grid.innerHTML = buildGridHtml(state.courses, state.currentWeek, todayDow, isCurrentWeek);

  // 让「今天」所在列居中可见
  const wrap = $('#tt-wrap');
  if (wrap && isCurrentWeek) {
    const colW = LAYOUT.colW + LAYOUT.gap;
    const offset = LAYOUT.slotW + LAYOUT.gap;
    const idx = DAY_ARR.indexOf(todayDow);
    const target = idx * colW + offset - (wrap.clientWidth - colW) / 2;
    wrap.scrollLeft = Math.max(0, target);
  } else if (wrap) {
    wrap.scrollLeft = 0;
  }
}
