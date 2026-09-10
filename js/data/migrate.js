/**
 * data/migrate.js — 数据安全模型（P0-04 / P1-04 统一建模）
 *
 * 核心优先级规则（设计 §3.3）：通过“是否升级 + 是否被用户显式清空 + 库是否为空”
 * 三个正交条件决定「是否灌默认 / 是否合并 / 是否保持空」，避免 P0-04 与 P1-04 互相打架。
 *
 * 本文件为纯逻辑（不触碰 DOM / IndexedDB），可被 node:test 直接 import。
 */
import { dedupeKey, log } from '../utils.js';
import { DEFAULT_COURSES } from './default-courses.js';

export { dedupeKey };

/**
 * 出厂默认课程 → 带 origin='default' 的可入库列表。
 * @returns {object[]}
 */
export function buildDefaultList() {
  return DEFAULT_COURSES.map((c) => ({ ...c, origin: 'default' }));
}

/**
 * 一次性智能打标（migrationV131）：老记录缺 origin 时，
 * 与默认数据按 dedupeKey 命中 → 'default'，否则 → 'user'（保守，先保命）。
 * @param {object[]} list
 * @param {object[]} [defaults=DEFAULT_COURSES]
 * @returns {object[]} 新数组
 */
export function tagOrigins(list, defaults = DEFAULT_COURSES) {
  const defKeys = new Set(defaults.map(dedupeKey));
  return (list || []).map((c) => {
    if (c.origin === 'default' || c.origin === 'user') return { ...c };
    return { ...c, origin: defKeys.has(dedupeKey(c)) ? 'default' : 'user' };
  });
}

/**
 * 按 origin 拆分；缺省 origin 视为 'user'（保命）。
 * @param {object[]} list
 * @returns {{defaults:object[], users:object[]}}
 */
export function partitionByOrigin(list) {
  const defaults = [];
  const users = [];
  for (const c of (list || [])) {
    if (c.origin === 'default') defaults.push(c);
    else users.push(c);
  }
  return { defaults, users };
}

/**
 * 合并“新默认 + 现有课程”，按 dedupeKey 去重。
 *
 * 合并优先级（自高到低）：**user 课程 > 新 default > 旧 default**。
 * 修复点（QA #4）：旧实现把 userList 里的旧 default 先入队，导致同一 dedupeKey 上
 * **旧 default 压过新 default**——将来改课程内容并递增 DATA_VERSION 时会刷新失败。
 * 现以“显式优先级”覆盖：先放 user，再放新 default，最后放“新默认已不含但库里仍有”的旧 default。
 *
 * @param {object[]} defaults 新默认课程（可为 buildDefaultList() 结果）
 * @param {object[]} userList 现有课程（含 user 自建 与 旧 default）
 * @returns {object[]}
 */
export function mergeCourses(defaults, userList) {
  const users = [];
  const oldDefaults = [];
  for (const c of (userList || [])) {
    if (c.origin === 'default') oldDefaults.push({ ...c, origin: 'default' });
    else users.push({ ...c, origin: c.origin || 'user' });
  }
  const newDefaults = (defaults || []).map((d) => ({ ...d, origin: d.origin || 'default' }));

  const out = [];
  const emitted = new Set();
  const pushIfNew = (c) => {
    const k = dedupeKey(c);
    if (emitted.has(k)) return;
    emitted.add(k);
    out.push(c);
  };
  // 优先级顺序即入队顺序：user > 新 default > 旧 default
  for (const u of users) pushIfNew(u);
  for (const d of newDefaults) pushIfNew(d);
  for (const d of oldDefaults) pushIfNew(d);
  return out;
}

/**
 * 启动决策：根据升级/清空/空库三个条件给出统一迁移计划（设计 §3.4 状态机）。
 * @param {number} savedVersion localStorage 中记录的 DATA_VERSION
 * @param {number} dataVersion 当前 DATA_VERSION
 * @param {boolean} cleared 用户是否显式清空过（clearedByUser）
 * @param {object[]} list 当前库中课程
 * @returns {{action:string, write:object[], snapshot:boolean, courses:object[]}}
 *   action ∈ 'merge' | 'trimUser' | 'fillDefault' | 'keepEmpty' | 'none'
 */
export function planUpgrade(savedVersion, dataVersion, cleared, list) {
  const arr = Array.isArray(list) ? list : [];
  const upgrading = (savedVersion || 0) < (dataVersion || 0);

  if (upgrading) {
    if (cleared) {
      // 规则 4：clearedByUser 优先，不灌默认，仅保留用户课程
      const users = arr.filter((c) => c.origin === 'user').map((c) => ({ ...c }));
      return { action: 'trimUser', write: users, snapshot: false, courses: users };
    }
    // 规则 3：★ 合并（新默认 + 用户课程去重），绝不清空；升级前需快照
    const merged = mergeCourses(buildDefaultList(), arr);
    return { action: 'merge', write: merged, snapshot: true, courses: merged };
  }

  if (arr.length === 0) {
    if (cleared) {
      // 规则 2：库空 & clearedByUser → 保持空（P1-04）
      return { action: 'keepEmpty', write: [], snapshot: false, courses: [] };
    }
    // 规则 1：首次安装 → 灌全量默认
    const defaults = buildDefaultList();
    return { action: 'fillDefault', write: defaults, snapshot: false, courses: defaults };
  }

  return { action: 'none', write: [], snapshot: false, courses: arr };
}

/**
 * “强制刷新”链路（P0-03）的纯逻辑封装：先快照，再原子替换；失败保留原数据。
 * IO（replaceAllCourses）由调用方以依赖注入方式传入，便于测试失败分支。
 * @param {object[]} current 当前课程
 * @param {(list:object[])=>Promise<*>} replaceFn 原子替换函数
 * @param {(list:object[])=>void} [snapshotFn] 快照函数
 * @returns {Promise<{ok:boolean, courses:object[], error?:Error}>}
 */
export async function applyRefresh(current, replaceFn, snapshotFn) {
  const defaults = buildDefaultList();
  if (snapshotFn) {
    try { snapshotFn(current); } catch (err) { log('warn', 'refresh snapshot failed', err); }
  }
  try {
    await replaceFn(defaults);
    return { ok: true, courses: defaults };
  } catch (err) {
    log('error', 'refreshData replace failed', err);
    return { ok: false, courses: current, error: err };
  }
}
