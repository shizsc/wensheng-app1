/**
 * storage.js — 本地设置持久化 + 数据安全的两个关键标记
 *
 * 承担三项职责：
 *  1) 设置项读写（localStorage）
 *  2) 升级/刷新前的课程快照（逃生通道 A）
 *  3) 清空意图标记 clearedByUser 与一次性迁移标记 migrationV131
 */
import { DATA_VERSION } from './config.js';
import { state } from './state.js';
import { log } from './utils.js';

const K = {
  week: 'currentWeek',
  reminderEnabled: 'reminderEnabled',
  remindTime: 'remindTime',
  darkMode: 'darkMode',
  simulatedDate: 'simulatedDate',
  dailyReminderEnabled: 'dailyReminderEnabled',
  dailyReminderHour: 'dailyReminderHour',
  cleared: 'clearedByUser',
  migration: 'migrationV131',
  backup: 'coursesBackup',
  dataVersion: 'dataVersion',
};

/**
 * 从 localStorage 读取设置写入状态对象（**不触碰 DOM**，UI 同步见 render/settings.applySettingsToUI）。
 * @param {object} [st=state]
 * @returns {object} 传入的状态对象
 */
export function loadSettings(st = state) {
  const week = localStorage.getItem(K.week);
  if (week) st.currentWeek = parseInt(week, 10) || 1;
  st.reminderEnabled = localStorage.getItem(K.reminderEnabled) === 'true';
  st.remindTime = parseInt(localStorage.getItem(K.remindTime), 10) || 10;
  st.darkMode = localStorage.getItem(K.darkMode) === 'true';
  st.simulatedDate = localStorage.getItem(K.simulatedDate) || null;
  st.dailyReminderEnabled = localStorage.getItem(K.dailyReminderEnabled) === 'true';
  st.dailyReminderHour = parseInt(localStorage.getItem(K.dailyReminderHour), 10) || 7;
  return st;
}

/**
 * 将状态对象写回 localStorage。
 * @param {object} [st=state]
 */
export function saveSettings(st = state) {
  localStorage.setItem(K.week, st.currentWeek);
  localStorage.setItem(K.reminderEnabled, st.reminderEnabled);
  localStorage.setItem(K.remindTime, st.remindTime);
  localStorage.setItem(K.darkMode, st.darkMode);
  localStorage.setItem(K.simulatedDate, st.simulatedDate || '');
  localStorage.setItem(K.dailyReminderEnabled, st.dailyReminderEnabled);
  localStorage.setItem(K.dailyReminderHour, st.dailyReminderHour);
}

/**
 * 升级 / 刷新前把当前课程写入 localStorage 快照（逃生通道）。
 * 失败（配额满）仅告警，不阻断主流程。
 * @param {object[]} list
 */
export function snapshotCourses(list) {
  try {
    localStorage.setItem(K.backup, JSON.stringify({
      ts: Date.now(), dataVersion: DATA_VERSION, courses: list || [],
    }));
  } catch (err) {
    log('warn', 'snapshotCourses failed', err);
  }
}

/**
 * 读取最近的课程快照。
 * @returns {object[]|null}
 */
export function restoreSnapshot() {
  try {
    const s = localStorage.getItem(K.backup);
    if (!s) return null;
    const obj = JSON.parse(s);
    return Array.isArray(obj.courses) ? obj.courses : null;
  } catch (err) {
    log('warn', 'restoreSnapshot failed', err);
    return null;
  }
}

/** 用户是否显式执行过“清空所有课程”（P1-04） */
export function getClearedFlag() {
  return localStorage.getItem(K.cleared) === 'true';
}

/** @param {boolean} v */
export function setClearedFlag(v) {
  localStorage.setItem(K.cleared, v ? 'true' : 'false');
}

/** 老数据 origin 标记的一次性迁移是否已完成（与 DATA_VERSION 解耦） */
export function getMigrationDone() {
  return localStorage.getItem(K.migration) === 'done';
}

export function setMigrationDone() {
  localStorage.setItem(K.migration, 'done');
}

/** 读取已记录的默认数据内容版本（用于判断是否需要合并升级） */
export function getSavedDataVersion() {
  return parseInt(localStorage.getItem(K.dataVersion), 10) || 0;
}

/** 写入默认数据内容版本 */
export function setSavedDataVersion(v) {
  localStorage.setItem(K.dataVersion, String(v));
}
