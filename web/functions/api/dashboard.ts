import { Hono } from 'hono';
import { authMiddleware } from './auth';
import { getNextLunarBirthday } from './lunar';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

const dashboard = new Hono<{ Bindings: Bindings }>();

// 仪表盘接口需要认证
dashboard.use('*', authMiddleware);

// 计算公历生日距离今天的天数
function getDaysUntilSolarBirthday(month: number, day: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  let birthday = new Date(currentYear, month - 1, day);
  birthday.setHours(0, 0, 0, 0);

  if (birthday < today) {
    birthday = new Date(currentYear + 1, month - 1, day);
    birthday.setHours(0, 0, 0, 0);
  }

  const diffTime = birthday.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function getDaysSinceSolarBirthday(month: number, day: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  let birthday = new Date(currentYear, month - 1, day);
  birthday.setHours(0, 0, 0, 0);

  if (birthday > today) {
    birthday = new Date(currentYear - 1, month - 1, day);
    birthday.setHours(0, 0, 0, 0);
  }

  const diffTime = today.getTime() - birthday.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function formatDate(month: number, day: number): string {
  return `${month}月${day}日`;
}

// GET /api/dashboard - 仪表盘统计
dashboard.get('/', async (c) => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // 总人数
    const totalResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM birthdays'
    ).first();
    const totalPeople = (totalResult?.count as number) || 0;

    // 部门数量
    const deptResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM departments'
    ).first();
    const totalDepartments = (deptResult?.count as number) || 0;

    // 获取所有生日记录（包含公历和农历）
    const allBirthdaysResult = await c.env.DB.prepare(
      `SELECT b.*, d.name as department_name
       FROM birthdays b
       LEFT JOIN departments d ON b.department_id = d.id`
    ).all();
    const allBirthdays = allBirthdaysResult.results as any[];

    // === 公历生日统计 ===
    const solarBirthdays = allBirthdays.filter((b) => b.type === 'solar');
    const monthBirthdaysCount = solarBirthdays.filter((b) => b.month === currentMonth).length;
    const todayBirthdaysCount = solarBirthdays.filter(
      (b) => b.month === currentMonth && b.day === currentDay
    ).length;

    // === 即将过生日（近30天，公历）===
    const upcomingSolar = solarBirthdays
      .map((b) => ({
        ...b,
        days_until: getDaysUntilSolarBirthday(b.month, b.day),
        date: formatDate(b.month, b.day),
        department: b.department_name,
        birth_type: 'solar',
      }))
      .filter((b) => b.days_until <= 30)
      .sort((a, b) => a.days_until - b.days_until)
      .slice(0, 50);

    // === 已过生日（近7天，公历）===
    const recentSolar = solarBirthdays
      .map((b) => ({
        ...b,
        days_ago: getDaysSinceSolarBirthday(b.month, b.day),
        date: formatDate(b.month, b.day),
        department: b.department_name,
        birth_type: 'solar',
      }))
      .filter((b) => b.days_ago > 0 && b.days_ago <= 7)
      .sort((a, b) => a.days_ago - b.days_ago)
      .slice(0, 50);

    // === 农历生日（查表法计算）===
    // 只取近 60 天的农历生日（避免对所有记录都查询）
    const lunarBirthdays = allBirthdays.filter((b) => b.type === 'lunar');

    // 异步并发查询，但限制并发数为 10
    const lunarUpcomingResults = await Promise.all(
      lunarBirthdays.slice(0, 200).map(async (b) => {
        const result = await getNextLunarBirthday(
          b.month,
          b.day,
          b.is_leap === 1,
          c.req.raw,
          c.env
        );
        return result ? { b, date: result.date, daysUntil: result.daysUntil } : null;
      })
    );

    const upcomingLunar = lunarUpcomingResults
      .filter((x): x is { b: any; date: Date; daysUntil: number } => x !== null)
      .filter((x) => x.daysUntil <= 30)
      .map((x) => ({
        ...x.b,
        days_until: x.daysUntil,
        date: `${x.date.getMonth() + 1}月${x.date.getDate()}日`,
        department: x.b.department_name,
        birth_type: 'lunar',
        lunar_date: `农历${x.b.is_leap ? '闰' : ''}${x.b.month}月${x.b.day}日`,
      }))
      .sort((a, b) => a.days_until - b.days_until)
      .slice(0, 50);

    // 合并：公历 + 农历，按 days_until 排序
    const upcomingBirthdays = [...upcomingSolar, ...upcomingLunar]
      .sort((a, b) => a.days_until - b.days_until)
      .slice(0, 50);

    // 最近已过（农历）：查表法
    const lunarRecentResults = await Promise.all(
      lunarBirthdays.slice(0, 200).map(async (b) => {
        const result = await getNextLunarBirthday(
          b.month,
          b.day,
          b.is_leap === 1,
          c.req.raw,
          c.env
        );
        if (!result) return null;
        // 计算上一次过生日的天数 = daysUntil - 365 或 354 大概，但更精确地：
        // 如果 daysUntil > 200，说明上次刚过（约 365 - daysUntil 天前）
        if (result.daysUntil > 300) {
          const daysAgo = 365 - result.daysUntil;
          if (daysAgo > 0 && daysAgo <= 7) {
            return { b, date: result.date, daysAgo };
          }
        }
        return null;
      })
    );

    const recentLunar = lunarRecentResults
      .filter((x): x is { b: any; date: Date; daysAgo: number } => x !== null)
      .map((x) => ({
        ...x.b,
        days_ago: x.daysAgo,
        date: `${x.date.getMonth() + 1}月${x.date.getDate()}日`,
        department: x.b.department_name,
        birth_type: 'lunar',
        lunar_date: `农历${x.b.is_leap ? '闰' : ''}${x.b.month}月${x.b.day}日`,
      }))
      .sort((a, b) => a.days_ago - b.days_ago)
      .slice(0, 50);

    const recentBirthdays = [...recentSolar, ...recentLunar]
      .sort((a, b) => a.days_ago - b.days_ago)
      .slice(0, 50);

    // 按部门统计人数
    const deptStatsResult = await c.env.DB.prepare(
      `SELECT d.id, d.name, COUNT(b.id) as count
       FROM departments d
       LEFT JOIN birthdays b ON d.id = b.department_id
       GROUP BY d.id, d.name
       ORDER BY count DESC, d.name ASC`
    ).all();

    // 按公农历统计人数
    const typeStatsResult = await c.env.DB.prepare(
      `SELECT type, COUNT(*) as count
       FROM birthdays
       GROUP BY type`
    ).all();

    const typeStats = (typeStatsResult.results as any[]).map((item) => ({
      type: item.type === 'solar' ? '公历' : '农历',
      count: item.count,
    }));

    return c.json({
      success: true,
      data: {
        totalPeople,
        totalDepartments,
        monthBirthdays: monthBirthdaysCount,
        todayBirthdays: todayBirthdaysCount,
        upcomingBirthdays,
        recentBirthdays,
        departmentStats: deptStatsResult.results,
        typeStats,
      },
    });
  } catch (e: any) {
    return c.json({ success: false, message: '获取仪表盘数据失败: ' + e.message }, 500);
  }
});

export { dashboard };