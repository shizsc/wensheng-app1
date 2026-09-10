/**
 * state.js — 全局应用状态（纯对象）与派生选择器
 *
 * 约定：顶层不触碰 window / document；仅返回派生值，不改动 DOM。
 */
import { DAY_ARR } from './config.js';
import { parseISODate } from './utils.js';

/**
 * 应用运行期状态。
 * 说明：`courses` 为内存中的课程数组（每项含 origin 字段，见设计 §8.1）。
 */
export const state = {
  currentPage: 'today',
  currentWeek: 1,
  courses: [],
  reminderEnabled: false,
  remindTime: 10,
  darkMode: false,
  simulatedDate: null,      // 手动模拟日期（'YYYY-MM-DD'），null = 使用真实日期
  dailyReminderEnabled: false,
  dailyReminderHour: 7,
};

/**
 * 当前“今天”的日期：模拟态返回模拟日期（本地解析），否则返回真实现在。
 * @param {object} [st=state]
 * @returns {Date}
 */
export function getTodayDate(st = state) {
  if (st && st.simulatedDate) return parseISODate(st.simulatedDate);
  return new Date();
}

/**
 * 当前“今天”的星期（中文）。
 * @param {object} [st=state]
 * @returns {'周一'|'周二'|'周三'|'周四'|'周五'|'周六'|'周日'}
 */
export function getTodayDayOfWeek(st = state) {
  const d = getTodayDate(st);
  const day = d.getDay(); // 0 = 周日
  return day === 0 ? '周日' : DAY_ARR[day - 1];
}

/**
 * 是否处于“模拟日期”预览态。
 * @param {object} [st=state]
 * @returns {boolean}
 */
export function isSimulated(st = state) {
  return !!(st && st.simulatedDate);
}
