/**
 * default-courses.js — 出厂默认课程数据（89 条，外置）
 *
 * 数据与逻辑解耦（P2-08）：内容变更只需改此文件 + 递增 config.DATA_VERSION，
 * 不必触碰业务代码。条目不含 origin 字段，灌库时由 buildDefaultList() 统一补 'default'。
 *
 * cls: 'both' = 自动化1班+2班（合班） / 'one' = 自动化1班（仅第9–14周）
 */
export const DEFAULT_COURSES = [
  // ===== 第1周 (7/13-7/19) =====
  { name: '英语-1', day: '周三', time: '13:40-16:40', start: 5, end: 8, teacher: '耿老师', location: '505教室', week: 1 },
  { name: '模拟电子-1', day: '周五', time: '13:20-16:20', start: 5, end: 8, teacher: '吴老师', location: '304教室', week: 1 },
  { name: '计算机基础-1', day: '周六', time: '9:20-12:20', start: 1, end: 4, teacher: '梁老师1', location: '505教室', week: 1 },
  { name: '高数-1', day: '周六', time: '13:40-16:40', start: 5, end: 8, teacher: '郑老师', location: '513教室（西校区）', week: 1 },
  { name: '模拟电子-2', day: '周日', time: '9:20-12:20', start: 1, end: 4, teacher: '吴老师', location: '301教室', week: 1 },
  // ===== 第2周 (7/20-7/26) =====
  { name: '模拟电子-3', day: '周一', time: '9:00-12:00', start: 1, end: 4, teacher: '吴老师', location: '404教室', week: 2 },
  { name: '高数-2', day: '周一', time: '9:00-12:00', start: 1, end: 4, teacher: '郑老师', location: '407教室', week: 2 },
  { name: '英语-2', day: '周三', time: '13:20-16:20', start: 5, end: 8, teacher: '耿老师', location: '407教室', week: 2 },
  { name: '模拟电子-4', day: '周四', time: '13:20-16:20', start: 5, end: 8, teacher: '吴老师', location: '302教室', week: 2 },
  { name: '计算机基础-2', day: '周五', time: '9:00-12:00', start: 1, end: 4, teacher: '梁老师1', location: '422教室（西校区）', week: 2 },
  { name: '高数-3', day: '周六', time: '9:00-12:00', start: 1, end: 4, teacher: '郑老师', location: '421教室（西校区）', week: 2 },
  { name: '英语-3', day: '周六', time: '13:20-16:20', start: 5, end: 8, teacher: '耿老师', location: '407教室', week: 2 },
  { name: '模拟电子-5', day: '周日', time: '9:00-12:00', start: 1, end: 4, teacher: '吴老师', location: '404教室', week: 2 },
  { name: '模拟电子-6', day: '周一', time: '9:00-12:00', start: 1, end: 4, teacher: '吴老师', location: '204教室', week: 2 },
  { name: '模拟电子-7', day: '周二', time: '9:20-12:20', start: 1, end: 4, teacher: '吴老师', location: '301教室', week: 2 },
  { name: '高数-4', day: '周二', time: '9:00-12:00', start: 1, end: 4, teacher: '郑老师', location: '407教室', week: 2 },
  // ===== 第3周 (7/27-8/2) =====
  { name: '计算机基础-3', day: '周三', time: '13:40-16:40', start: 5, end: 8, teacher: '梁老师1', location: '514教室（西校区）', week: 3 },
  { name: '模拟电子-8', day: '周四', time: '13:20-16:20', start: 5, end: 8, teacher: '吴老师', location: '302教室', week: 3 },
  { name: '计算机基础-4', day: '周五', time: '9:00-12:00', start: 1, end: 4, teacher: '梁老师1', location: '422教室（西校区）', week: 3 },
  { name: '英语-4', day: '周五', time: '9:00-12:00', start: 1, end: 4, teacher: '耿老师', location: '420教室（西校区）', week: 3 },
  { name: '高数-5', day: '周六', time: '13:20-16:20', start: 5, end: 8, teacher: '郑老师', location: '421教室（西校区）', week: 3 },
  // ===== 第4周 (8/3-8/9) =====
  { name: '模拟电子-9', day: '周一', time: '9:00-12:00', start: 1, end: 4, teacher: '吴老师', location: '404教室', week: 4 },
  { name: '模拟电子-10', day: '周二', time: '9:20-12:20', start: 1, end: 4, teacher: '吴老师', location: '301教室', week: 4 },
  { name: '高数-6', day: '周二', time: '9:00-12:00', start: 1, end: 4, teacher: '郑老师', location: '407教室', week: 4 },
  { name: '英语-5', day: '周三', time: '13:20-16:20', start: 5, end: 8, teacher: '耿老师', location: '420教室（西校区）', week: 4 },
  { name: '模拟电子-11', day: '周四', time: '13:20-16:20', start: 5, end: 8, teacher: '吴老师', location: '302教室', week: 4 },
  { name: '计算机基础-5', day: '周五', time: '9:00-12:00', start: 1, end: 4, teacher: '梁老师1', location: '422教室（西校区）', week: 4 },
  { name: '高数-7', day: '周五', time: '9:00-12:00', start: 1, end: 4, teacher: '郑老师', location: '421教室（西校区）', week: 4 },
  { name: '英语-6', day: '周六', time: '13:20-16:20', start: 5, end: 8, teacher: '耿老师', location: '407教室', week: 4 },
  // ===== 第5周 (8/10-8/16) =====
  { name: '高数-8', day: '周一', time: '9:20-12:20', start: 1, end: 4, teacher: '郑老师', location: '505教室', week: 5 },
  { name: '计算机基础-6', day: '周一', time: '9:20-12:20', start: 1, end: 4, teacher: '梁老师1', location: '514教室（西校区）', week: 5 },
  { name: '高数-9', day: '周三', time: '13:40-16:40', start: 5, end: 8, teacher: '郑老师', location: '307教室', week: 5 },
  { name: '英语-7', day: '周四', time: '13:40-16:40', start: 5, end: 8, teacher: '耿老师', location: '307教室', week: 5 },
  { name: '计算机基础-7', day: '周五', time: '13:20-16:20', start: 5, end: 8, teacher: '梁老师1', location: '422教室（西校区）', week: 5 },
  { name: '模拟电子-12', day: '周六', time: '9:00-12:00', start: 1, end: 4, teacher: '吴老师', location: '401教室', week: 5 },
  { name: '电路-1', day: '周六', time: '13:20-16:20', start: 5, end: 8, teacher: '滕老师', location: '402教室', week: 5 },
  { name: '电路-2', day: '周六', time: '9:00-12:00', start: 1, end: 4, teacher: '滕老师', location: '402教室', week: 5 },
  { name: '数字电子-1', day: '周日', time: '13:20-16:20', start: 5, end: 8, teacher: '刘老师13', location: '402教室', week: 5 },
  { name: '高数-10', day: '周日', time: '9:00-12:00', start: 1, end: 4, teacher: '郑老师', location: '422教室（西校区）', week: 5 },
  // ===== 第6周 (8/17-8/23) =====
  { name: '计算机基础-8', day: '周一', time: '13:40-16:40', start: 5, end: 8, teacher: '梁老师1', location: '513教室（西校区）', week: 6 },
  { name: '电路-3', day: '周二', time: '9:20-12:20', start: 1, end: 4, teacher: '滕老师', location: '301教室', week: 6 },
  { name: '英语-8', day: '周三', time: '13:40-16:40', start: 5, end: 8, teacher: '耿老师', location: '514教室（西校区）', week: 6 },
  { name: '英语-9', day: '周四', time: '9:20-12:20', start: 1, end: 4, teacher: '耿老师', location: '505教室', week: 6 },
  { name: '高数-11', day: '周五', time: '13:40-16:40', start: 5, end: 8, teacher: '郑老师', location: '514教室（西校区）', week: 6 },
  { name: '电路-4', day: '周六', time: '9:20-12:20', start: 1, end: 4, teacher: '滕老师', location: '403教室', week: 6 },
  { name: '高数-12', day: '周六', time: '9:00-12:00', start: 1, end: 4, teacher: '郑老师', location: '420教室（西校区）', week: 6 },
  // ===== 第7周 (8/24-8/29) =====
  { name: '英语-10', day: '周一', time: '13:20-16:20', start: 5, end: 8, teacher: '耿老师', location: '420教室（西校区）', week: 7 },
  { name: '计算机基础-9', day: '周三', time: '13:40-16:40', start: 5, end: 8, teacher: '梁老师1', location: '514教室（西校区）', week: 7 },
  { name: '电路-5', day: '周四', time: '9:00-12:00', start: 1, end: 4, teacher: '滕老师', location: '402教室', week: 7 },
  { name: '计算机基础-10', day: '周五', time: '9:00-12:00', start: 1, end: 4, teacher: '梁老师1', location: '422教室（西校区）', week: 7 },
  { name: '数字电子-2', day: '周五', time: '9:00-12:00', start: 1, end: 4, teacher: '刘老师13', location: '401教室', week: 7 },
  { name: '电路-6', day: '周六', time: '13:20-16:20', start: 5, end: 8, teacher: '滕老师', location: '404教室', week: 7 },
  { name: '电路-7', day: '周二', time: '17:00-20:00', start: 9, end: 11, teacher: '滕老师', location: '210教室', week: 7 },
  { name: '高数-13', day: '周二', time: '13:20-16:20', start: 5, end: 8, teacher: '郑老师', location: '422教室（西校区）', week: 7 },
  // ===== 第8周 (9/2-9/6) =====
  { name: '数字电子-3', day: '周三', time: '17:00-20:00', start: 9, end: 11, teacher: '刘老师13', location: '205教室', week: 8 },
  { name: '英语-11', day: '周四', time: '13:20-16:20', start: 5, end: 8, teacher: '耿老师', location: '421教室（西校区）', week: 8 },
  { name: '计算机基础-11', day: '周五', time: '9:00-12:00', start: 1, end: 4, teacher: '梁老师1', location: '422教室（西校区）', week: 8 },
  { name: '电路-8', day: '周六', time: '9:20-12:20', start: 1, end: 4, teacher: '滕老师', location: '301教室', week: 8 },

  // ===== 第9周 (9/7-9/13) · 真实课表 =====
  { name: '计算机基础-12', day: '周一', time: '9:00-12:00',  start: 1, end: 4,  teacher: '梁老师1',  location: '421教室（西校区）', week: 9,  cls: 'both' },
  { name: '英语-12',       day: '周一', time: '13:20-16:20', start: 5, end: 8,  teacher: '耿老师',   location: '421教室（西校区）', week: 9,  cls: 'both' },
  { name: '数字电子-4',    day: '周三', time: '9:20-12:20',  start: 1, end: 4,  teacher: '刘老师13', location: '303教室',           week: 9,  cls: 'one'  },
  { name: '计算机基础-13', day: '周三', time: '13:40-16:40', start: 5, end: 8,  teacher: '梁老师1',  location: '514教室（西校区）', week: 9,  cls: 'both' },
  { name: '电路-9',        day: '周四', time: '17:00-20:00', start: 9, end: 11, teacher: '滕老师',   location: '205教室',           week: 9,  cls: 'one'  },
  { name: '高数-14',       day: '周五', time: '13:40-16:40', start: 5, end: 8,  teacher: '郑老师',   location: '514教室（西校区）', week: 9,  cls: 'both' },
  { name: '电路-10',       day: '周六', time: '13:20-16:20', start: 5, end: 8,  teacher: '滕老师',   location: '404教室',           week: 9,  cls: 'one'  },

  // ===== 第10周 (9/14-9/20) · 真实课表 =====
  { name: '英语-13',       day: '周一', time: '9:20-12:20',  start: 1, end: 4,  teacher: '耿老师',   location: '505教室',           week: 10, cls: 'both' },
  { name: '电路-11',       day: '周二', time: '17:00-20:00', start: 9, end: 11, teacher: '滕老师',   location: '205教室',           week: 10, cls: 'one'  },
  { name: '高数-15',       day: '周三', time: '13:20-16:20', start: 5, end: 8,  teacher: '郑老师',   location: '422教室（西校区）', week: 10, cls: 'both' },
  { name: '计算机基础-14', day: '周五', time: '9:20-12:20',  start: 1, end: 4,  teacher: '梁老师1',  location: '513教室（西校区）', week: 10, cls: 'both' },
  { name: '数字电子-5',    day: '周日', time: '9:00-12:00',  start: 1, end: 4,  teacher: '刘老师13', location: '203教室',           week: 10, cls: 'one'  },

  // ===== 第11周 (9/21-9/27) · 真实课表 =====
  { name: '高数-16',       day: '周一', time: '9:00-12:00',  start: 1, end: 4,  teacher: '郑老师',   location: '420教室（西校区）', week: 11, cls: 'both' },
  { name: '电路-12',       day: '周二', time: '17:00-20:00', start: 9, end: 11, teacher: '滕老师',   location: '205教室',           week: 11, cls: 'one'  },
  { name: '数字电子-6',    day: '周三', time: '9:00-12:00',  start: 1, end: 4,  teacher: '刘老师13', location: '401教室',           week: 11, cls: 'one'  },
  { name: '计算机基础-15', day: '周四', time: '9:20-12:20',  start: 1, end: 4,  teacher: '梁老师1',  location: '514教室（西校区）', week: 11, cls: 'both' },
  { name: '英语-14',       day: '周六', time: '13:20-16:20', start: 5, end: 8,  teacher: '耿老师',   location: '420教室（西校区）', week: 11, cls: 'both' },
  { name: '数字电子-7',    day: '周日', time: '13:20-16:20', start: 5, end: 8,  teacher: '刘老师13', location: '402教室',           week: 11, cls: 'one'  },

  // ===== 第12周 (9/28-10/4) · 真实课表 =====
  { name: '高数-17',       day: '周一', time: '9:00-12:00',  start: 1, end: 4, teacher: '郑老师',   location: '422教室（西校区）', week: 12, cls: 'both' },
  { name: '英语-15',       day: '周二', time: '13:20-16:20', start: 5, end: 8, teacher: '耿老师',   location: '422教室（西校区）', week: 12, cls: 'both' },
  { name: '计算机基础-16', day: '周三', time: '13:40-16:40', start: 5, end: 8, teacher: '梁老师1',  location: '514教室（西校区）', week: 12, cls: 'both' },

  // ===== 第13周 (10/5-10/11) · 真实课表 =====
  { name: '数字电子-8',    day: '周四', time: '9:20-12:20',  start: 1, end: 4, teacher: '刘老师13', location: '304教室',           week: 13, cls: 'one'  },
  { name: '数字电子-9',    day: '周五', time: '9:20-12:20',  start: 1, end: 4, teacher: '刘老师13', location: '502教室',           week: 13, cls: 'one'  },
  { name: '计算机基础-17', day: '周六', time: '9:00-12:00',  start: 1, end: 4, teacher: '梁老师1',  location: '422教室（西校区）', week: 13, cls: 'both' },
  { name: '数字电子-10',   day: '周日', time: '13:20-16:20', start: 5, end: 8, teacher: '刘老师13', location: '404教室',           week: 13, cls: 'one'  },

  // ===== 第14周 (10/12-10/18) · 真实课表 =====
  { name: '高数-18',       day: '周一', time: '9:20-12:20',  start: 1, end: 4,  teacher: '郑老师',   location: '513教室（西校区）', week: 14, cls: 'both' },
  { name: '数字电子-11',   day: '周三', time: '9:00-12:00',  start: 1, end: 4,  teacher: '刘老师13', location: '401教室',           week: 14, cls: 'one'  },
  { name: '计算机基础-18', day: '周四', time: '13:40-16:40', start: 5, end: 8,  teacher: '梁老师1',  location: '513教室（西校区）', week: 14, cls: 'both' },
  { name: '数字电子-12',   day: '周五', time: '17:00-20:00', start: 9, end: 11, teacher: '刘老师13', location: '205教室',           week: 14, cls: 'one'  },
  { name: '英语-16',       day: '周日', time: '13:40-16:40', start: 5, end: 8,  teacher: '耿老师',   location: '307教室',           week: 14, cls: 'both' },
];
