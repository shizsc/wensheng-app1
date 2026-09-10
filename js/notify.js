/**
 * notify.js — 通知/提醒统一抽象（P1-03 诚实降级 + P1-05 定时器生命周期）
 *
 * 事实：Android System WebView 未实现 Notification API（`'Notification' in window` 恒为 false），
 * 故 APK 内的“每日推送”在 v1.3 静默失效。本模块运行时二选一：
 *   - webNotifier：保留原 Notification 路径（浏览器内仍可用）
 *   - inAppNotifier：站内提醒降级（toast + 顶部横幅），**不谎称已推送**
 *
 * 定时器由本模块统一持有，勾选/取消勾选走 schedule/stop，杜绝“关了还响”（P1-05）。
 */
import { log } from './utils.js';

/**
 * 当前环境是否支持原生 Notification。
 * @returns {boolean}
 */
export function supportsNativeNotification() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * 创建通知器（运行时按能力选择实现）。
 * @param {{showToast?:(msg:string,type?:string)=>void, showBanner?:(msg:string)=>void}} [ui]
 * @returns {object} Notifier
 */
export function createNotifier(ui) {
  const uiHooks = ui || {};
  const useWeb = supportsNativeNotification();
  let timer = null;
  let enabled = false;

  return {
    /** @returns {'web'|'inapp'} */
    get kind() { return useWeb ? 'web' : 'inapp'; },

    /**
     * 请求通知权限（仅 web 路径有意义）。
     * @returns {Promise<string>}
     */
    requestPermission() {
      if (useWeb && Notification.permission === 'default') {
        try { return Promise.resolve(Notification.requestPermission()); }
        catch (err) { log('warn', 'requestPermission failed', err); }
      }
      return Promise.resolve(useWeb ? Notification.permission : 'unsupported');
    },

    /**
     * 启动每日定时器。到点触发 onFire（由调用方在触发时会实时检查业务开关）。
     * @param {number} hour 24 小时制小时
     * @param {()=>void} onFire
     */
    schedule(hour, onFire) {
      this.stop();
      enabled = true;
      timer = setInterval(() => {
        if (!enabled) return;
        const now = new Date();
        if (now.getHours() === hour && now.getMinutes() === 0) {
          try { onFire && onFire(); } catch (err) { log('error', 'reminder onFire failed', err); }
        }
      }, 60000);
    },

    /** 停止并清除定时器（P1-05） */
    stop() {
      enabled = false;
      if (timer) { clearInterval(timer); timer = null; }
    },

    /** @returns {boolean} */
    isEnabled() { return enabled; },

    /**
     * 立即提醒（测试推送/补提醒共用）。
     * @param {string} title
     * @param {string} body
     * @returns {boolean} 是否使用了原生通知
     */
    notify(title, body) {
      if (useWeb && Notification.permission === 'granted') {
        try { new Notification(title, { body }); return true; }
        catch (err) { log('warn', 'Notification failed，降级为站内提醒', err); }
      }
      if (uiHooks.showBanner) uiHooks.showBanner(body);
      if (uiHooks.showToast) uiHooks.showToast('站内提醒：' + body, 'success');
      return false;
    },
  };
}
