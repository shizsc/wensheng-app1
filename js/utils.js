/**
 * utils.js — 纯工具函数集合（除 showToast/`$` 外均无副作用）
 *
 * 设计约定：本文件顶层**不触碰** window / document / indexedDB，
 * 所有 DOM 访问仅发生在函数体内（如 showToast），因此可被 Node 直接 import 做单测。
 */
import {
  DAY_ARR, TIME_SLOTS, SEMESTER_START, WEEK_MIN, WEEK_MAX,
} from './config.js';

/* =========================================================
 * ① HTML 转义与安全拼接（P0-01 / P3-06 的主防线）
 * ========================================================= */

/**
 * 转义任意值，使其可安全插入 innerHTML。
 * @param {*} s
 * @returns {string}
 */
export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 标记“已构建且已转义”的 HTML 片段，避免 html`` 二次转义。
 * @param {string} s
 * @returns {{__raw:string}}
 */
export function raw(s) {
  return { __raw: String(s == null ? '' : s) };
}

/**
 * 标签模板：字面量片段视为可信，插值一律转义（除非是 raw() 包装的片段）。
 * @param {TemplateStringsArray} strings
 * @param {...*} vals
 * @returns {string}
 */
export function html(strings, ...vals) {
  return strings.reduce((acc, str, i) => {
    if (i === 0) return str;
    const v = vals[i - 1];
    const piece = (v && v.__raw != null) ? v.__raw : escapeHtml(v);
    return acc + piece + str;
  }, '');
}

/* =========================================================
 * ② DOM 便捷助手（函数体内访问 DOM，导入安全）
 * ========================================================= */

/** @param {string} sel */
export function $(sel) {
  return (typeof document !== 'undefined') ? document.querySelector(sel) : null;
}

/** @param {string} sel */
export function $$(sel) {
  return (typeof document !== 'undefined') ? document.querySelectorAll(sel) : [];
}

/**
 * 顶部提示条。type ∈ {'', 'success', 'error'}（@see 设计 §8.6）。
 * 使用 textContent 赋值，天然免疫 XSS。
 * @param {string} msg
 * @param {string} [type]
 */
export function showToast(msg, type = '') {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast'; }, 2500);
}

/* =========================================================
 * ③ 日志接口（P2-06）
 * ========================================================= */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * 分级日志封装。最小实现 = console[level]，封装后便于将来转发服务端。
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} msg
 * @param {*} [detail]
 */
export function log(level, msg, detail) {
  const fn = (typeof console !== 'undefined' && console[level]) ? console[level] : (typeof console !== 'undefined' ? console.log : null);
  if (!fn) return;
  try {
    fn(`[${level}] ${msg}`, detail === undefined ? '' : detail);
  } catch (err) {
    /* 日志失败绝不影响主流程 */
  }
}

/* =========================================================
 * ④ 时间解析与课程状态
 * ========================================================= */

/**
 * 解析 "13:40-16:40" / "9:00—12:00" 之类的时间串。
 * @param {string} timeStr
 * @returns {{startHour:number,startMin:number,endHour:number,endMin:number}|null}
 */
export function parseTime(timeStr) {
  const match = String(timeStr || '').match(/(\d{1,2}):(\d{2})\s*[-–—~]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return {
    startHour: parseInt(match[1], 10), startMin: parseInt(match[2], 10),
    endHour: parseInt(match[3], 10), endMin: parseInt(match[4], 10),
  };
}

/** 从时间串直接解析起始分钟（忽略缓存，供缓存构建器使用） */
function parseStartMinutes(timeStr) {
  const t = parseTime(timeStr);
  return t ? t.startHour * 60 + t.startMin : 0;
}

/** 从时间串直接解析结束分钟（忽略缓存） */
function parseEndMinutes(timeStr) {
  const t = parseTime(timeStr);
  return t ? t.endHour * 60 + t.endMin : 0;
}

/**
 * 起始分钟。优先复用运行期缓存 `_startMin`（P3-03），否则现算。
 * @param {{time?:string,_startMin?:number}} course
 * @returns {number}
 */
export function startMinutes(course) {
  if (course && typeof course._startMin === 'number') return course._startMin;
  return parseStartMinutes(course && course.time);
}

/**
 * 结束分钟。优先复用运行期缓存 `_endMin`（P3-03），否则现算。
 * @param {{time?:string,_endMin?:number}} course
 * @returns {number}
 */
export function endMinutes(course) {
  if (course && typeof course._endMin === 'number') return course._endMin;
  return parseEndMinutes(course && course.time);
}

/**
 * 当前时间（分钟）。支持注入日期，保证测试确定性（P1-06）。
 * @param {Date} [date]
 * @returns {number}
 */
export function nowMinutes(date) {
  const d = date instanceof Date ? date : new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * 课程相对当前时刻的状态（P1-06；入参注入 nowMin 保证确定性）。
 * @param {{time?:string}} course
 * @param {number} nowMin
 * @returns {'next'|'current'|'past'}
 */
export function courseStatus(course, nowMin) {
  const s = startMinutes(course);
  const e = endMinutes(course);
  if (nowMin < s) return 'next';
  if (nowMin >= e) return 'past';
  return 'current';
}

/* =========================================================
 * ⑤ 日期与周次
 * ========================================================= */

/**
 * 以**本地时区**解析 'YYYY-MM-DD'，避免 new Date('2026-07-13') 的 UTC 偏移（P1-06/附注2）。
 * @param {string|Date} s
 * @returns {Date}
 */
export function parseISODate(s) {
  if (s instanceof Date) return s;
  const m = String(s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return new Date(s);
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

/**
 * 根据日期计算所属周次（第 1 周周一 = 2026-07-13），并钳制到 [WEEK_MIN, WEEK_MAX]（P2-01）。
 * @param {Date} date
 * @returns {number} 1..14
 */
export function getWeekByDate(date) {
  const diffDays = Math.floor((date.getTime() - SEMESTER_START.getTime()) / 86400000);
  const w = Math.floor(diffDays / 7) + 1;
  return Math.min(WEEK_MAX, Math.max(WEEK_MIN, w));
}

/** 格式化 "M月D日"（P3-01） */
export function formatMonthDay(d) {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 格式化 "M.DD"（补零，P3-01 / P3-07 表头日期） */
export function formatMonthDayPadded(d) {
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
}

/** 兼容别名（原 getTodayDateStr 语义），统一走 formatMonthDay */
export function formatDateStr(d) {
  return formatMonthDay(d);
}

/**
 * 指定周次的 7 个日期标签（"M.DD"）。
 * @param {number} currentWeek
 * @returns {string[]}
 */
export function getWeekDates(currentWeek) {
  const monday = new Date(SEMESTER_START);
  monday.setDate(SEMESTER_START.getDate() + (currentWeek - 1) * 7);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(formatMonthDayPadded(d));
  }
  return dates;
}

/* =========================================================
 * ⑥ 节次 / 科目归类
 * ========================================================= */

/**
 * 返回课程所处的三大节；越界（>11）返回明确的“其他”，不再静默回退上午（P3-04）。
 * @param {{start?:number|string}} course
 * @returns {{key:string,label:string,time:string,periods:number[]}}
 */
export function getSlot(course) {
  const s = parseInt(course && course.start, 10) || 1;
  for (const slot of TIME_SLOTS) {
    if (s >= slot.periods[0] && s <= slot.periods[1]) return slot;
  }
  return { key: 'other', label: '其他', time: '', periods: [] };
}

/** @param {{start?:number|string}} course @returns {string} */
export function slotLabelOf(course) {
  return getSlot(course).label;
}

/** 按课程名归类到科目 key */
export function getSubject(name) {
  const n = String(name || '');
  if (n.indexOf('计算机') >= 0) return 'cs';
  if (n.indexOf('英语') >= 0) return 'en';
  if (n.indexOf('高数') >= 0 || n.indexOf('高等数学') >= 0) return 'math';
  if (n.indexOf('数字电子') >= 0 || n.indexOf('模拟电子') >= 0) return 'de';
  if (n.indexOf('电路') >= 0) return 'cir';
  return 'gray';
}

/* =========================================================
 * ⑦ 课程输入校验 / 去重（P0-01③ / P2-02 / P2-03）
 * ========================================================= */

/**
 * 去重键：课程名 | 星期 | 周次 | 起始节。
 * @param {{name?:string,day?:string,week?:number|string,start?:number|string}} c
 * @returns {string}
 */
export function dedupeKey(c) {
  return `${String(c.name || '').trim()}|${String(c.day || '').trim()}|${parseInt(c.week, 10) || 0}|${parseInt(c.start, 10) || 0}`;
}

/**
 * 共享的“结构/范围”校验（**不含长度限制**）：供 `sanitizeCourseInput`（入口白名单）
 * 与 `parseRowsToCoursesDetailed`（导入解析）共用**同一套**规则。
 * @param {string} day
 * @param {number} start
 * @param {number} end
 * @param {number} week
 * @returns {string|null} 错误信息；null 表示通过
 */
function courseRangeError(day, start, end, week) {
  if (DAY_ARR.indexOf(day) < 0) return '星期无效';
  if (!(start >= 1 && start <= 11)) return '开始节数需在 1–11';
  if (!(end >= 1 && end <= 11)) return '结束节数需在 1–11';
  if (start > end) return '开始节数不能大于结束节数';
  if (!(week >= WEEK_MIN && week <= WEEK_MAX)) return `周次需在 ${WEEK_MIN}–${WEEK_MAX}`;
  return null;
}

/**
 * 入口层白名单校验（枚举 + 范围 + **长度**）。表单与导入入口共用。
 * @param {object} input 原始输入
 * @returns {{ok:boolean, course?:object, error?:string}}
 */
export function sanitizeCourseInput(input) {
  const src = input || {};
  const name = String(src.name || '').trim();
  if (!name) return { ok: false, error: '课程名称不能为空' };
  if (name.length > 60) return { ok: false, error: '课程名称过长（≤60 字）' };

  const day = String(src.day || '').trim();
  const start = parseInt(src.start, 10);
  const end = parseInt(src.end, 10);
  const week = parseInt(src.week, 10);
  const rangeErr = courseRangeError(day, start, end, week);
  if (rangeErr) return { ok: false, error: rangeErr };

  const teacher = String(src.teacher || '').trim();
  if (teacher.length > 40) return { ok: false, error: '老师名过长（≤40 字）' };
  const location = String(src.location || '').trim();
  if (location.length > 40) return { ok: false, error: '地点过长（≤40 字）' };

  const time = String(src.time || '').trim();
  const cls = (src.cls === 'both' || src.cls === 'one') ? src.cls : undefined;

  const course = { name, day, time, start, end, teacher, location, week, origin: 'user' };
  if (cls) course.cls = cls;
  return { ok: true, course };
}

/**
 * Excel 行 → 课程数组（纯函数，便于 node:test 覆盖边界）。
 *
 * 分层契约（P0-01③）：
 *  - **解析层（本函数）**：只做“结构 + 范围”校验——name/day/time 非空、day∈DAY_ARR、
 *    start/end∈[1,11] 且 start≤end、week∈[1,14]；**不设长度上限**（大字段透传不崩溃）。
 *  - **入口层**：真正落库前，再对每条走 `sanitizeCourseInput`（含长度限制）。
 *  两层共用同一个 `courseRangeError`，保证规则一致。
 *
 * 计数口径：空行与表头行不计入 invalid；**看起来像课程但结构/范围不过的行**才计入 invalid。
 * @param {Array<Array<*>>} rows
 * @returns {{courses:object[], invalid:number}}
 */
export function parseRowsToCoursesDetailed(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const courses = [];
  let invalid = 0;
  for (let i = 0; i < list.length; i++) {
    const row = list[i] || [];
    if (!row[0]) continue;                                   // 空行 / 首列空
    if (typeof row[0] === 'string' && (row[0].indexOf('课程') >= 0 || row[0].indexOf('说明') >= 0)) continue; // 表头

    const name = String(row[0]).trim();
    if (!name) continue;                                     // 无名称 → 非课程行

    const day = String(row[1] == null ? '' : row[1]).trim();
    const time = String(row[2] == null ? '' : row[2]).trim();
    const teacher = String(row[5] == null ? '' : row[5]).trim();
    const location = String(row[6] == null ? '' : row[6]).trim();
    const start = parseInt(row[3], 10) || 1;
    const end = parseInt(row[4], 10) || start;
    const week = parseInt(row[7], 10) || 1;

    if (!day || !time) { invalid++; continue; }              // 结构：day/time 必填（防不可见脏数据）
    if (courseRangeError(day, start, end, week)) { invalid++; continue; }

    courses.push({ name, day, time, start, end, teacher, location, week, origin: 'user' });
  }
  return { courses, invalid };
}

/**
 * Excel 行 → 课程数组（对外保持数组返回，兼容既有调用与测试）。
 * @param {Array<Array<*>>} rows
 * @returns {object[]}
 */
export function parseRowsToCourses(rows) {
  return parseRowsToCoursesDetailed(rows).courses;
}

/* =========================================================
 * ⑧ 运行期时间缓存（P3-03）——预解析，避免排序/状态判定反复正则
 * ========================================================= */

/**
 * 为单条课程补 `_startMin/_endMin` 运行期缓存，返回浅拷贝（不污染入参）。
 * @param {object} course
 * @returns {object}
 */
export function withTimeCache(course) {
  return { ...course, _startMin: parseStartMinutes(course && course.time), _endMin: parseEndMinutes(course && course.time) };
}

/**
 * 就地为课程数组补齐时间缓存（列表通常来自 state.courses）。
 * @param {object[]} list
 * @returns {object[]} 同一数组（已就地带缓存）
 */
export function cacheCourseTimes(list) {
  for (const c of (list || [])) {
    if (!c) continue;
    c._startMin = parseStartMinutes(c.time);
    c._endMin = parseEndMinutes(c.time);
  }
  return list || [];
}

/**
 * 剥除运行期缓存字段（入库 / 导出前必须调用，避免污染 IndexedDB 与备份 JSON）。
 * @param {object} course
 * @returns {object} 浅拷贝，且不含 _startMin/_endMin
 */
export function stripRuntimeFields(course) {
  const out = { ...(course || {}) };
  delete out._startMin;
  delete out._endMin;
  return out;
}

/* =========================================================
 * ⑨ 学期阶段（P2-01 越界文案：未开课 / 已结课）
 * ========================================================= */

/**
 * 判断日期相对学期（第 1 周周一起、共 WEEK_MAX 周）的阶段。
 * @param {Date|string} date
 * @returns {'before'|'during'|'after'}
 */
export function getSemesterPhase(date) {
  const d = date instanceof Date ? date : new Date(date);
  const start = new Date(SEMESTER_START.getFullYear(), SEMESTER_START.getMonth(), SEMESTER_START.getDate());
  const endExclusive = new Date(start);
  endExclusive.setDate(start.getDate() + WEEK_MAX * 7);
  if (d < start) return 'before';
  if (d >= endExclusive) return 'after';
  return 'during';
}

/**
 * 按 (周次, 星期, 起始时间) 升序排序，供管理页与通知复用（P3-03，避免重复正则）。
 * @param {object[]} list
 * @returns {object[]} 新数组
 */
export function sortCoursesForManage(list) {
  const dayOrder = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7 };
  return [...(list || [])].sort((a, b) => {
    const wa = parseInt(a.week, 10) || 0;
    const wb = parseInt(b.week, 10) || 0;
    if (wa !== wb) return wa - wb;
    const da = dayOrder[a.day] || 0;
    const db = dayOrder[b.day] || 0;
    if (da !== db) return da - db;
    return startMinutes(a) - startMinutes(b);
  });
}
