import { Hono } from 'hono';
import { authMiddleware } from './auth';
import { solarToLunar, getNextLunarBirthday, getTodayLunar } from './lunar';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

const lunarApi = new Hono<{ Bindings: Bindings }>();

// 公开接口：今天的农历信息（仪表盘用）
lunarApi.get('/today', async (c) => {
  try {
    const info = await getTodayLunar(c.req.raw, c.env);
    if (!info) {
      return c.json({ success: false, message: '无法获取今日农历信息' }, 500);
    }
    return c.json({ success: true, data: info });
  } catch (e: any) {
    return c.json({ success: false, message: '获取农历失败: ' + e.message }, 500);
  }
});

// 需要认证：查询农历生日的下一个公历日期
lunarApi.get('/next-birthday', authMiddleware, async (c) => {
  try {
    const { lunarMonth, lunarDay, isLeap } = c.req.query();
    if (!lunarMonth || !lunarDay) {
      return c.json({ success: false, message: '缺少 lunarMonth 或 lunarDay 参数' }, 400);
    }

    const result = await getNextLunarBirthday(
      parseInt(lunarMonth, 10),
      parseInt(lunarDay, 10),
      isLeap === '1' || isLeap === 'true',
      c.req.raw,
      c.env
    );

    if (!result) {
      return c.json({ success: false, message: '无法找到对应的农历日期' }, 404);
    }

    return c.json({
      success: true,
      data: {
        year: result.date.getFullYear(),
        month: result.date.getMonth() + 1,
        day: result.date.getDate(),
        daysUntil: result.daysUntil,
      },
    });
  } catch (e: any) {
    return c.json({ success: false, message: '查询失败: ' + e.message }, 500);
  }
});

// 需要认证：公历日期转农历
lunarApi.get('/solar-to-lunar', authMiddleware, async (c) => {
  try {
    const { date } = c.req.query();
    const target = date ? new Date(date) : new Date();
    if (isNaN(target.getTime())) {
      return c.json({ success: false, message: '日期格式无效' }, 400);
    }

    const info = await solarToLunar(target, c.req.raw, c.env);
    if (!info) {
      return c.json({ success: false, message: '日期超出支持范围 (1901-2100)' }, 404);
    }

    return c.json({ success: true, data: info });
  } catch (e: any) {
    return c.json({ success: false, message: '查询失败: ' + e.message }, 500);
  }
});

export { lunarApi };