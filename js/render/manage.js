/**
 * render/manage.js — 管理页渲染 + 事件委托
 *
 * P1-01：删除内联 onclick，改用 data-action + 在 #course-list 上绑一个 click 委托。
 * P0-01：课程字段统一经 html`` 转义。
 */
import { state } from '../state.js';
import { SUBJECTS } from '../config.js';
import { $, html, raw, getSubject, sortCoursesForManage } from '../utils.js';

const ICON_EDIT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17l-1 3Z"/><path d="M13.5 6.5l3 3"/></svg>';
const ICON_DEL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/></svg>';

const EMPTY_HTML = `
  <div class="empty">
    <div class="empty-ic">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    </div>
    <div class="empty-t">暂无课程</div>
    <div class="empty-s">点击上方「添加课程」或「导入 Excel」</div>
  </div>`;

/** 渲染管理页课程列表 */
export function renderManage() {
  const list = $('#course-list');
  if (!list) return;

  const courses = sortCoursesForManage(state.courses);

  const subEl = $('#manage-sub');
  if (subEl) subEl.textContent = `共 ${courses.length} 条课程安排`;
  const countEl = $('#course-count');
  if (countEl) countEl.textContent = '按周次 · 时间排序';

  if (courses.length === 0) {
    list.innerHTML = EMPTY_HTML;
    return;
  }

  list.innerHTML = courses.map((c) => {
    const subj = getSubject(c.name);
    const clsTag = c.cls ? (c.cls === 'both' ? '合班' : '1班') : '';
    return html`
    <div class="mgmt-item">
      <div class="mi-chip chip-${subj}">${SUBJECTS[subj].chip}</div>
      <div class="mi-main">
        <div class="mi-name">${c.name}</div>
        <div class="mi-meta">
          <span>第${c.week}周 · ${c.day}</span>
          <span>${c.time}</span>
          <span>${c.location || '未指定'}</span>
          ${clsTag ? raw(html`<span>${clsTag}</span>`) : ''}
        </div>
      </div>
      <div class="mi-ops">
        <div class="mini-btn" title="编辑" role="button" data-action="edit" data-id="${c.id}">${raw(ICON_EDIT)}</div>
        <div class="mini-btn danger" title="删除" role="button" data-action="delete" data-id="${c.id}">${raw(ICON_DEL)}</div>
      </div>
    </div>`;
  }).join('');
}

/**
 * 在 #course-list 上绑定事件委托（只绑一次）。
 * @param {{onEdit?:(id:number)=>void, onDelete?:(id:number)=>void}} handlers
 */
export function bindManageEvents(handlers) {
  const list = $('#course-list');
  if (!list) return;
  const h = handlers || {};
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    const action = btn.dataset.action;
    if (action === 'edit' && h.onEdit) h.onEdit(id);
    else if (action === 'delete' && h.onDelete) h.onDelete(id);
  });
}
