/**
 * config.js — 全局常量与共享配置（单一真源）
 *
 * 约定：本文件顶层**不触碰** window / document / indexedDB，
 * 以便 Node 内置测试框架（node:test）可直接 `import` 使用其中的纯常量与纯函数。
 */

/** 星期 → 序号（周一起） */
export const DAY_MAP = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7 };

/** 星期有序数组（渲染与校验复用同一顺序，避免多处硬编码） */
export const DAY_ARR = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 月份英文名（今日页大标题用） */
export const MONTH_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

/** 三大节（与 Excel 节数对应） */
export const TIME_SLOTS = [
  { key: 'am',  label: '上午', time: '9:00-12:00',  periods: [1, 4] },
  { key: 'pm',  label: '下午', time: '13:20-16:20', periods: [5, 8] },
  { key: 'eve', label: '晚上', time: '17:00-20:00', periods: [9, 11] },
];

/** 科目分类与角标（getSubject 归类后的展示映射） */
export const SUBJECTS = {
  cs:   { label: '计算机基础', chip: '计' },
  en:   { label: '英语',       chip: '英' },
  math: { label: '高等数学',   chip: '高' },
  de:   { label: '数字电子',   chip: '数' },
  cir:  { label: '电路',       chip: '电' },
  gray: { label: '其他课程',   chip: '课' },
};

/** 学期第 1 周周一（本地时区构造，避免 new Date('YYYY-MM-DD') 的 UTC 陷阱） */
export const SEMESTER_START = new Date(2026, 6, 13);

/** 周次上下界（钳制用） */
export const WEEK_MIN = 1;
export const WEEK_MAX = 14;

/** 更新检测单源超时（ms）：4 源并行竞速，总上限约 4s，而非 4×6s */
export const FETCH_TIMEOUT = 4000;

/**
 * 默认课程数据“内容”版本。内容变更才 +1，触发**合并**（不清库）。
 * 与 IndexedDB 的 DB_VERSION（表结构版本）是两个独立概念，命名不得混用。
 */
export const DATA_VERSION = 9;

/** IndexedDB 数据库名 / 表结构版本 / 对象仓库名 */
export const DB_NAME = 'CourseScheduleDB';
export const DB_VERSION = 1;
export const STORE_NAME = 'courses';

/** 布局常量（原先散落在渲染代码里的魔法数字） */
export const LAYOUT = { colW: 88, slotW: 38, gap: 6, fallbackSafeBottom: 48 };

/**
 * 更新检测源，按“并行竞速”尝试，任一成功即返回。
 * 1) ghproxy 加速（国内可达、实时）2) GitHub 官方 raw 3) ghfast 加速 4) jsDelivr CDN 兜底
 */
export const VERSION_URLS = [
  'https://ghproxy.net/https://raw.githubusercontent.com/shizsc/wensheng-app1/main/version.json',
  'https://raw.githubusercontent.com/shizsc/wensheng-app1/main/version.json',
  'https://ghfast.top/https://raw.githubusercontent.com/shizsc/wensheng-app1/main/version.json',
  'https://cdn.jsdelivr.net/gh/shizsc/wensheng-app1@main/version.json',
];

/**
 * 运行期应用元信息（versionCode / versionName）。
 * 由 loadAppMeta() 从打包进 www 的 `./version.json` 填充 —— 全站唯一的版本显示来源。
 */
export const APP_META = { versionCode: 0, versionName: '' };

/**
 * 读取打包进包内的 version.json，填充 APP_META。
 * 失败仅告警、不阻塞启动（@see 设计 R8）。
 * @param {string} [url='./version.json']
 * @returns {Promise<{versionCode:number, versionName:string}>}
 */
export async function loadAppMeta(url = './version.json') {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res && res.ok) {
      const data = await res.json();
      if (data && typeof data.versionCode === 'number') APP_META.versionCode = data.versionCode;
      if (data && typeof data.versionName === 'string' && data.versionName) APP_META.versionName = data.versionName;
    }
  } catch (err) {
    // 版本信息缺失不应影响 App 使用：仅记录，不抛出
    if (typeof console !== 'undefined') console.warn('[warn] loadAppMeta failed', err);
  }
  return APP_META;
}
