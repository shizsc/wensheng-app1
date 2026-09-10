/**
 * db.js — IndexedDB 课程持久化层（ES Module 版）
 *
 * 相对于 v1.3 的三处加固：
 *  1) openDB 生命周期兜底（P2-04）：onblocked 超时、onclose 置空缓存、reject 传 req.error
 *  2) onupgradeneeded 预留按 oldVersion 的分步迁移骨架（附条 B）
 *  3) 新增 replaceAllCourses()：单事务两阶段提交，实现真正的原子替换（P0-03）
 */
import { DB_NAME, DB_VERSION, STORE_NAME } from './config.js';
import { log, stripRuntimeFields } from './utils.js';

/** 模块级连接缓存；连接被系统回收后由 onclose 置空，避免“假死” */
let db = null;

/**
 * 打开（或复用）数据库连接。
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    // 其它标签页/连接占用旧版本时不会触发 success —— 用超时兜住，避免永久挂起
    let blockedTimer = null;
    req.onblocked = () => {
      log('warn', 'openDB blocked：存在占用旧连接的上下文');
      blockedTimer = setTimeout(() => {
        reject(new Error('数据库被占用，请关闭其它页面后重试'));
      }, 1500);
    };

    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      // 分步迁移骨架：将来 DB_VERSION 升级时在此按 oldVersion 递增补丁
      if (e.oldVersion < 1) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('day', 'day', { unique: false });
          store.createIndex('week', 'week', { unique: false });
        }
      }
    };

    req.onsuccess = (e) => {
      if (blockedTimer) clearTimeout(blockedTimer);
      db = e.target.result;
      // 连接被系统/浏览器回收时清空缓存，下次操作会重新 open
      db.onclose = () => { db = null; };
      db.onversionchange = () => { try { db.close(); } catch (err) { /* noop */ } db = null; };
      resolve(db);
    };

    // 传 req.error（而非 event），便于上层读取可读错误
    req.onerror = () => {
      if (blockedTimer) clearTimeout(blockedTimer);
      reject(req.error || new Error('openDB failed'));
    };
  });
}

/**
 * 读取全部课程。
 * @returns {Promise<object[]>}
 */
export async function getAllCourses() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 新增一条课程，返回自增主键。
 * @param {object} course
 * @returns {Promise<number>}
 */
export async function addCourse(course) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).add(stripRuntimeFields(course));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 更新一条课程（按主键 put）。
 * @param {object} course
 * @returns {Promise<number>}
 */
export async function updateCourse(course) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(stripRuntimeFields(course));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 删除一条课程。
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteCourse(id) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * 清空全部课程。
 * @returns {Promise<void>}
 */
export async function clearAllCourses() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * 批量新增（保留原语义，计数成功写入条数）。
 * @param {object[]} courses
 * @returns {Promise<number>}
 */
export async function bulkAdd(courses) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let count = 0;
    (courses || []).forEach((course) => {
      const req = store.add(stripRuntimeFields(course));
      req.onsuccess = () => { count++; };
    });
    tx.oncomplete = () => resolve(count);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 在一个已开启的 readwrite 事务上执行“清空 + 批量写入”两阶段提交（可单测、无 IDB 依赖）。
 *
 * P0-03 的关键：clear() 与全部 add() 必须在**同一事务**内；中途（含**同步异常**）失败
 * 必须显式 `tx.abort()`，否则已入队的 clear()/部分 add() 会被自动提交 → 库被清空或半写。
 *
 * @param {IDBTransaction} tx
 * @param {IDBObjectStore} store
 * @param {object[]} list
 * @returns {Promise<number>}
 */
export function performReplace(tx, store, list) {
  const items = list || [];
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(items.length);
    tx.onerror = () => reject(tx.error || new Error('replace 事务失败'));
    tx.onabort = () => reject(tx.error || new Error('replace 事务被中止'));
    try {
      store.clear();                                  // 阶段①：清空（同一事务内，尚未提交）
      for (const c of items) store.add(stripRuntimeFields(c)); // 阶段②：写入
    } catch (err) {
      // 同步异常（如结构化克隆失败 / 越界对象）：必须 abort 回滚，保住旧数据
      try { tx.abort(); } catch (e) { /* 事务可能已 abort，忽略 */ }
      reject(err);
    }
  });
}

/**
 * 原子替换全部课程（P0-03 两阶段提交）。
 *
 * 把 clear() 与全部 add() 放进**同一个 readwrite 事务**——
 * 中途任何一步失败（异步或**同步**）→ 事务 abort → IndexedDB 自动回滚，旧数据**完好无损**。
 * 因此无需 bump DB_VERSION，也不需要临时 store。
 *
 * @param {object[]} courses
 * @returns {Promise<number>} 写入条数
 */
export function replaceAllCourses(courses) {
  return openDB().then((database) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    return performReplace(tx, tx.objectStore(STORE_NAME), courses);
  });
}
