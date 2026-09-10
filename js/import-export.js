/**
 * import-export.js — 数据导入导出（JSON 备份 + Excel 导入）
 *
 * 从 main.js 抽出原因（P1-01 收尾）：这是独立的 IO 职责（文件读写 + 校验 + 入库）。
 *  - JSON 导出/导入：逃生通道 B
 *  - Excel 导入：P2-03（大小上限 / onerror / 去重 / 多 sheet 提示）+ P0-01③（白名单校验）
 */
import {
  $, showToast, log, sanitizeCourseInput, parseRowsToCoursesDetailed, dedupeKey,
  cacheCourseTimes, stripRuntimeFields,
} from './utils.js';
import { state } from './state.js';
import { snapshotCourses } from './storage.js';
import { getAllCourses, bulkAdd, replaceAllCourses } from './db.js';
import { rerenderCurrent } from './rerender.js';

/** 导出当前课程为 JSON 文件（剥除运行期缓存字段，备份干净） */
export function exportJson() {
  try {
    const clean = state.courses.map(stripRuntimeFields);
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wensheng-courses-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('已导出课程 JSON', 'success');
  } catch (err) {
    log('error', 'exportJson 失败', err);
    showToast('导出失败：' + err.message, 'error');
  }
}

/**
 * 把 JSON 备份数组分区为「合法可入库」与「非法条目」，并保留最多 3 条非法原因。
 * 纯函数（无 DOM / 无 IO），供 `handleJsonImport` 与单测共用。
 *
 * 背景：JSON 导入是**备份恢复**语义（整体替换），任何被静默丢弃的条目
 * 都会造成“用户以为恢复成功、实则丢数据”。故这里**必须计数并给出原因**。
 *
 * @param {*} data 解析后的 JSON（期望数组）
 * @returns {{clean:object[], skipped:number, reasons:string[]}}
 */
export function partitionImportItems(data) {
  const clean = [];
  const reasons = [];
  let skipped = 0;
  for (const item of (Array.isArray(data) ? data : [])) {
    const r = sanitizeCourseInput(item);
    if (r.ok) {
      clean.push(Object.assign({}, r.course, { origin: item.origin === 'default' ? 'default' : 'user' }));
    } else {
      skipped++;
      if (reasons.length < 3) reasons.push(String(r.error || '格式不合法')); // 最多 3 条，避免 toast 过长
    }
  }
  return { clean, skipped, reasons };
}

/**
 * 构造“全部非法”时的错误（含总数与最多 3 条原因），便于用户自查。
 * @param {number} total
 * @param {string[]} reasons
 * @returns {Error}
 */
export function buildJsonImportError(total, reasons) {
  const detail = (reasons && reasons.length) ? '，例如：' + reasons.join('；') : '';
  return new Error(`未发现有效课程（共 ${total} 条${detail}）`);
}

/**
 * 构造导入结果提示：只要有条目被跳过，必须让用户看到（用 error 类型强调）。
 * @param {number} count 实际入库条数
 * @param {number} skipped 被跳过的非法条数
 * @returns {{msg:string, type:''|'success'|'error'}}
 */
export function buildJsonImportToast(count, skipped) {
  if (skipped > 0) return { msg: `已导入 ${count} 门，跳过非法 ${skipped} 条`, type: 'error' };
  return { msg: `已导入 ${count} 门课程`, type: 'success' };
}

/**
 * 导入 JSON 备份：逐条走 sanitizeCourseInput 校验，**如实计数**非法条目后原子替换入库。
 * @param {Event} e
 */
export async function handleJsonImport(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('JSON 顶层必须是数组');

    const { clean, skipped, reasons } = partitionImportItems(data);
    if (clean.length === 0) throw buildJsonImportError(data.length, reasons);

    snapshotCourses(state.courses);
    await replaceAllCourses(clean);
    state.courses = await getAllCourses();
    cacheCourseTimes(state.courses);
    rerenderCurrent();

    // skipped > 0 用 error 类型：静默丢弃比报错更危险，必须让用户注意到
    const toast = buildJsonImportToast(state.courses.length, skipped);
    showToast(toast.msg, toast.type);
  } catch (err) {
    log('error', 'handleJsonImport 失败', err);
    showToast('导入失败：' + err.message, 'error');
  }
  e.target.value = '';
}

/**
 * Excel 导入（P2-03）：大小上限 / 读取失败反馈 / 表头与非法行计数 / 去重 / 多 sheet 提示。
 * @param {Event} e
 */
export function handleFileImport(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('文件过大（>5MB）', 'error');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => {
    log('error', 'Excel 文件读取失败');
    showToast('文件读取失败', 'error');
    e.target.value = '';
  };
  reader.onload = async (evt) => {
    try {
      if (typeof XLSX === 'undefined') {
        showToast('Excel 解析库未加载，请重启 App 后重试', 'error');
        e.target.value = '';
        return;
      }
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      if (workbook.SheetNames.length > 1) showToast('检测到多个工作表，仅读取第一个', 'error');

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const parsed = parseRowsToCoursesDetailed(rows);   // 解析层：结构 + 范围
      let invalid = parsed.invalid;

      // 入口层：长度等白名单校验（与表单路径共用 sanitizeCourseInput）
      const valid = [];
      for (const c of parsed.courses) {
        const r = sanitizeCourseInput(c);
        if (!r.ok) { invalid++; continue; }
        valid.push(r.course);
      }

      if (valid.length === 0) {
        showToast(`未找到有效课程数据（跳过非法 ${invalid} 行），请检查格式`, 'error');
        e.target.value = '';
        return;
      }

      // 与现有库比对去重，跳过重复（按 dedupeKey）
      const existing = new Set(state.courses.map(dedupeKey));
      const fresh = [];
      let skipped = 0;
      for (const c of valid) {
        const k = dedupeKey(c);
        if (existing.has(k)) { skipped++; continue; }
        existing.add(k);
        fresh.push(c);
      }

      if (fresh.length === 0) {
        showToast(`导入 0 条，跳过非法 ${invalid} 行，跳过重复 ${skipped} 条`, 'error');
        e.target.value = '';
        return;
      }

      await bulkAdd(fresh);
      state.courses = await getAllCourses();
      cacheCourseTimes(state.courses);
      rerenderCurrent();
      showToast(`导入 ${fresh.length} 条，跳过非法 ${invalid} 行，跳过重复 ${skipped} 条`, 'success');
    } catch (err) {
      log('error', 'Excel 解析失败', err);
      showToast('文件解析失败：' + err.message, 'error');
    }
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}
