/**
 * update.js — 更新检测：多源并行预取 + **优先级择优** + apkUrl 白名单校验
 *
 * P2-09：4 源并行发起、单源 4s 超时（总上限约 4s，而非 24s）。
 * ⚠ 优先级（不能丢）：不能直接 Promise.any（“最快成功者胜”会忽略源顺序）。
 *    jsDelivr 全局 CDN 通常最先返回，但其 @main 有 ~12h 缓存，会返回陈旧 versionCode，
 *    导致“发了新版却提示已是最新”（坑 13）。故采用：所有源并行预取，但只有
 *    **索引更小的源都已结束（成功或失败）**时，才允许用当前索引的成功结果——
 *    等价于“按序遍历、失败才继续”，同时保住并行带来的 4s 上限。
 * P1-09：apkUrl 必须为 https 且命中白名单域名，阻断经更新通道分发恶意包。
 */
import { VERSION_URLS, FETCH_TIMEOUT } from './config.js';
import { log } from './utils.js';

/** 允许的 APK 下载域名（命中其一或为其子域才放行） */
export const APK_HOSTS = ['github.com', 'objects.githubusercontent.com', 'ghproxy.net', 'ghfast.top'];

/**
 * 校验远程 apkUrl 是否可信（纯函数，可单测）。
 * @param {string} url
 * @returns {boolean}
 */
export function validateApkUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return APK_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch (err) {
    return false;
  }
}

/** 给 promise 工厂加超时（单源独立计时，便于竞速） */
function withTimeout(factory, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve()
      .then(factory)
      .then((v) => { clearTimeout(timer); resolve(v); },
            (e) => { clearTimeout(timer); reject(e); });
  });
}

/**
 * 并行预取多源，但按**源优先级**择优返回：索引越小优先级越高。
 *
 * 语义等价于“按序遍历、失败才继续”，但所有源同时发起（4s 上限）：
 *  - 索引 0 成功 → 立即返回（不等其它源）；
 *  - 仅当更优索引的源都已失败时，才轮到次优索引的已成功结果；
 *  - 全部失败 → 返回 null，并 log('warn', ...)。
 *
 * 依赖注入 urls / fetchFn / timeout，便于 node:test 用假 fetch 覆盖回落与优先级场景。
 * @param {string[]} [urls=VERSION_URLS]
 * @param {Function} [fetchFn=globalThis.fetch]
 * @param {number} [timeout=FETCH_TIMEOUT]
 * @returns {Promise<object|null>}
 */
export async function fetchVersionInfo(urls, fetchFn, timeout) {
  const list = Array.isArray(urls) && urls.length ? urls : VERSION_URLS;
  const doFetch = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
  const ms = timeout || FETCH_TIMEOUT;
  if (!doFetch) return null;

  // undefined = 尚未定；null = 该源失败；对象 = 该源成功
  const settled = new Array(list.length).fill(undefined);

  const attempts = list.map((url) => withTimeout(async () => {
    const res = await doFetch(url + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res || !res.ok) throw new Error('bad status ' + (res && res.status));
    const data = await res.json();
    if (!data || typeof data.versionCode !== 'number') throw new Error('bad versionCode');
    if (typeof data.versionName !== 'string' || !data.versionName) throw new Error('bad versionName');
    return data;
  }, ms));

  return new Promise((resolve) => {
    let pending = attempts.length;
    const check = () => {
      for (let i = 0; i < settled.length; i++) {
        if (settled[i] === undefined) return;                 // 更高优先级的源尚未结束 → 继续等
        if (settled[i] !== null) { resolve(settled[i]); return; } // 最高优先级的成功结果
      }
      if (pending === 0) {                                    // 全部源结束且无一成功
        log('warn', 'fetchVersionInfo：全部更新源不可用');
        resolve(null);
      }
    };
    attempts.forEach((p, i) => p.then(
      (d) => { settled[i] = d; pending--; check(); },
      () => { settled[i] = null; pending--; check(); },
    ));
  });
}

/**
 * 更新检测编排（checkUpdate 与按钮处理器共用，消除重复逻辑 P2-07）。
 * UI 访问仅在函数体内，import 本模块不会触碰 DOM。
 * @param {object} ctx
 * @param {boolean} ctx.manual 手动触发（用于区分文案）
 * @param {number}  ctx.currentVersion 当前 versionCode
 * @param {string}  ctx.currentName 当前 versionName
 * @param {(msg:string,type?:string)=>void} ctx.showToast
 * @param {(msg:string)=>boolean} ctx.confirm
 * @param {(url:string)=>void} ctx.openUrl
 * @returns {Promise<{status:'update'|'latest'|'fail'|'invalid', data?:object}>}
 */
export async function doCheckUpdate(ctx) {
  try {
    const data = await fetchVersionInfo();
    if (!data) {
      if (ctx.manual) ctx.showToast('检查失败，请检查网络', 'error');
      return { status: 'fail' };
    }
    // P1-09：apkUrl 白名单校验 + 展示待下载域名
    if (!validateApkUrl(data.apkUrl)) {
      log('error', 'doCheckUpdate：更新源 apkUrl 非法', data.apkUrl);
      if (ctx.manual) ctx.showToast('更新源异常，已忽略', 'error');
      return { status: 'invalid', data };
    }
    if (data.versionCode > ctx.currentVersion) {
      let host = '';
      try { host = new URL(data.apkUrl).hostname; } catch (err) { host = data.apkUrl; }
      const msg = `发现新版本 v${data.versionName}\n\n更新内容：${data.releaseNote || '无'}\n\n下载地址：${host}\n\n是否立即下载？`;
      if (ctx.confirm(msg)) ctx.openUrl(data.apkUrl);
      return { status: 'update', data };
    }
    if (ctx.manual) ctx.showToast(`已是最新版本 v${ctx.currentName}`, 'success');
    return { status: 'latest', data };
  } catch (err) {
    log('error', 'doCheckUpdate failed', err);
    if (ctx.manual) ctx.showToast('检查失败，请检查网络', 'error');
    return { status: 'fail' };
  }
}
