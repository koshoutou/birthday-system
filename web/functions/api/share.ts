import { Hono } from 'hono';
import { formatBirthdayLine } from './birthdays';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

const share = new Hono<{ Bindings: Bindings }>();

// 输出统一格式：姓名 | 日期 | 类型 | 分类
// 例：张三 | 1990-01-15 | SOLAR | 运营部
// Python 提醒脚本可直接抓取本链接作为数据源。

// GET /api/s/:token - 根据 token 获取 birthdays.txt 格式的纯文本内容（公开接口）
share.get('/:token', async (c) => {
  try {
    const token = c.req.param('token');

    const shareLink = await c.env.DB.prepare(
      'SELECT * FROM share_links WHERE token = ?'
    )
      .bind(token)
      .first();

    if (!shareLink) {
      return c.json({ success: false, message: '外链不存在' }, 404);
    }

    let birthdayList: any[];

    if (shareLink.is_all) {
      // 包含所有人员
      const result = await c.env.DB.prepare(
        `SELECT b.*, d.name as department_name
         FROM birthdays b
         LEFT JOIN departments d ON b.department_id = d.id
         ORDER BY b.month ASC, b.day ASC, b.sort_order ASC, b.id ASC`
      ).all();
      birthdayList = result.results as any[];
    } else {
      // 只包含选中的
      const result = await c.env.DB.prepare(
        `SELECT b.*, d.name as department_name
         FROM birthdays b
         LEFT JOIN departments d ON b.department_id = d.id
         INNER JOIN share_link_birthdays slb ON b.id = slb.birthday_id
         WHERE slb.share_link_id = ?
         ORDER BY b.month ASC, b.day ASC, b.sort_order ASC, b.id ASC`
      )
        .bind(shareLink.id)
        .all();
      birthdayList = result.results as any[];
    }

    const lines = birthdayList.map((b) =>
      formatBirthdayLine(b, b.department_name)
    );

    const content = lines.join('\n');
    
    // 添加 UTF-8 BOM 头，确保中文不乱码
    const BOM = '\uFEFF';
    const contentWithBOM = BOM + content;

    return new Response(contentWithBOM, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (e: any) {
    return c.json({ success: false, message: '获取分享内容失败: ' + e.message }, 500);
  }
});

export { share };
