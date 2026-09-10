/**
 * data-ops.js — 数据编排（迁移 / 加载 / 刷新 / 清空）与“今日课程”选择
 *
 * 从 main.js 抽出原因（P1-01 收尾）：这些是数据生命周期操作，职责内聚、边界清晰，
 * 与“入口装配 / 事件绑定”无关。数据安全模型（P0-03/04、P1-04）集中在此。
 */
import { DATA_VERSION } from './config.js';
import {
  showToast, log, startMinutes, getWeekByDate, cacheCourseTimes,
} from './utils.js';
import { state, getTodayDate, getTodayDayOfWeek } from './state.js';
import {
  snapshotCourses, getClearedFlag, setClearedFlag, getMigrationDone, setMigrationDone,
  getSavedDataVersion, setSavedDataVersion,
} from './storage.js';
import { getAllCourses, clearAllCourses, replaceAllCourses } from './db.js';
import { DEFAULT_COURSES } from './data/default-courses.js';
import { tagOrigins, planUpgrade, applyRefresh } from './data/migrate.js';
import { rerenderCurrent } from './rerender.js';

/**
 * 今日（含模拟日期）应上的课程，按开始时间排序。
 * @param {object} [st=state]
 * @returns {object[]}
 */
export function coursesForToday(st = state) {
  const dow = getTodayDayOfWeek(st);
  const week = getWeekByDate(getTodayDate(st));
  return state.courses
    .filter((c) => c.day === dow && parseInt(c.week, 10) === week)
    .sort((a, b) => startMinutes(a) - startMinutes(b));
}

/**
 * 数据安全迁移（P0-04 / P1-04）：一次 origin 打标 + 统一 planUpgrade 决策。
 * 注意：plan.write / tagOrigins 结果交给 replaceAllCourses 入库，
 * 入库前由 db 层 stripRuntimeFields 剥掉 _startMin/_endMin。
 */
export async function runDataMigration() {
  let list = await getAllCourses();

  // ① 老数据一次性补 origin（与 DATA_VERSION 解耦的独立迁移键）
  if (!getMigrationDone()) {
    list = tagOrigins(list, DEFAULT_COURSES);
    await replaceAllCourses(list);
    setMigrationDone();
  }

  // ② 统一决策：升级合并 / 尊重清空 / 首装灌默认 / 保持现状
  const plan = planUpgrade(getSavedDataVersion(), DATA_VERSION, getClearedFlag(), list);
  if (plan.snapshot) snapshotCourses(list);
  if (plan.action !== 'none') {
    await replaceAllCourses(plan.write);
    setSavedDataVersion(DATA_VERSION);
  }
  log('info', 'dataMigration', { action: plan.action, count: plan.write.length });
}

/** 加载课程（独立兜底，DB 失败不阻塞其它初始化），并补齐运行期时间缓存 */
export async function loadCourses() {
  try {
    state.courses = await getAllCourses();
    cacheCourseTimes(state.courses);
  } catch (err) {
    log('error', 'loadCourses 失败', err);
    state.courses = [];
    showToast('课程数据读取失败', 'error');
  }
}

/** 强制刷新（P0-03 原子替换 + 逃生快照）；失败保留原数据 */
export async function refreshData() {
  const before = state.courses;
  const res = await applyRefresh(before, (list) => replaceAllCourses(list), (cur) => snapshotCourses(cur));
  if (res.ok) {
    setClearedFlag(false);
    try {
      state.courses = await getAllCourses();
      cacheCourseTimes(state.courses);
    } catch (err) {
      log('error', '刷新后重读失败', err);
      state.courses = res.courses;
    }
    rerenderCurrent();
    showToast(`已刷新 ${state.courses.length} 门课程`, 'success');
  } else {
    state.courses = before;   // 保命：旧数据仍在
    showToast('刷新失败，已保留原课程', 'error');
  }
}

/** 清空所有课程（P1-04 持久化清空意图，重启不重灌） */
export async function clearAll() {
  try {
    await clearAllCourses();
    setClearedFlag(true);
    state.courses = [];
    rerenderCurrent();
    showToast('已清空所有课程', 'success');
  } catch (err) {
    log('error', 'clearAll 失败', err);
    showToast('清空失败：' + err.message, 'error');
  }
}
