import { Hono } from 'hono';
import { authMiddleware } from './auth';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

const shareLinks = new Hono<{ Bindings: Bindings }>();

// 所有外链管理接口都需要认证
shareLinks.use('*', authMiddleware);

// 生成随机 token
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// GET /api/share-links - 列表
shareLinks.get('/', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      `SELECT sl.*,
              CASE WHEN sl.is_all = 1 THEN
                (SELECT COUNT(*) FROM birthdays)
              ELSE
                (SELECT COUNT(*) FROM share_link_birthdays slb WHERE slb.share_link_id = sl.id)
              END as person_count
       FROM share_links sl
       ORDER BY sl.created_at DESC`
    ).all();

    return c.json({ success: true, data: result.results });
  } catch (e: any) {
    return c.json({ success: false, message: '获取外链列表失败: ' + e.message }, 500);
  }
});

// GET /api/share-links/all-persons - 一次性获取所有人员（不分页）
// 用于生成外链时的成员选择器
shareLinks.get('/all-persons', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      `SELECT b.*, d.name as department_name
       FROM birthdays b
       LEFT JOIN departments d ON b.department_id = d.id
       ORDER BY b.month ASC, b.day ASC, b.sort_order ASC, b.id ASC`
    ).all();

    return c.json({ success: true, data: result.results, total: result.results?.length || 0 });
  } catch (e: any) {
    return c.json({ success: false, message: '获取人员列表失败: ' + e.message }, 500);
  }
});

// POST /api/share-links - 创建
shareLinks.post('/', async (c) => {
  try {
    const { name, description, is_all, birthday_ids } = await c.req.json();

    if (!name || !name.trim()) {
      return c.json({ success: false, message: '外链名称不能为空' }, 400);
    }

    const token = generateToken();
    const isAll = is_all ? 1 : 0;

    const result = await c.env.DB.prepare(
      'INSERT INTO share_links (token, name, description, is_all) VALUES (?, ?, ?, ?)'
    )
      .bind(token, name.trim(), description || null, isAll)
      .run();

    const shareLinkId = result.meta.last_row_id;

    if (!isAll && Array.isArray(birthday_ids) && birthday_ids.length > 0) {
      // 限制单次最多 5000 条
      if (birthday_ids.length > 5000) {
        return c.json({ success: false, message: '单次最多关联 5000 条人员' }, 400);
      }
      const batchSize = 100;
      for (let i = 0; i < birthday_ids.length; i += batchSize) {
        const batch = birthday_ids.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?)').join(',');
        const values = batch.flatMap((id: number) => [shareLinkId, id]);
        await c.env.DB.prepare(
          `INSERT OR IGNORE INTO share_link_birthdays (share_link_id, birthday_id) VALUES ${placeholders}`
        )
          .bind(...values)
          .run();
      }
    }

    const shareLink = await c.env.DB.prepare(
      `SELECT sl.*,
              CASE WHEN sl.is_all = 1 THEN
                (SELECT COUNT(*) FROM birthdays)
              ELSE
                (SELECT COUNT(*) FROM share_link_birthdays slb WHERE slb.share_link_id = sl.id)
              END as person_count
       FROM share_links sl
       WHERE sl.id = ?`
    )
      .bind(shareLinkId)
      .first();

    return c.json({ success: true, data: shareLink });
  } catch (e: any) {
    return c.json({ success: false, message: '创建外链失败: ' + e.message }, 500);
  }
});

// PUT /api/share-links/:id - 更新
shareLinks.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { name, description, is_all, birthday_ids } = await c.req.json();

    const existing = await c.env.DB.prepare(
      'SELECT * FROM share_links WHERE id = ?'
    )
      .bind(id)
      .first();

    if (!existing) {
      return c.json({ success: false, message: '外链不存在' }, 404);
    }

    const updateName = name !== undefined ? name.trim() : existing.name;
    const updateDescription = description !== undefined ? (description || null) : existing.description;
    const updateIsAll = is_all !== undefined ? (is_all ? 1 : 0) : existing.is_all;

    await c.env.DB.prepare(
      'UPDATE share_links SET name = ?, description = ?, is_all = ? WHERE id = ?'
    )
      .bind(updateName, updateDescription, updateIsAll, id)
      .run();

    if (birthday_ids !== undefined) {
      await c.env.DB.prepare(
        'DELETE FROM share_link_birthdays WHERE share_link_id = ?'
      )
        .bind(id)
        .run();

      if (!updateIsAll && Array.isArray(birthday_ids) && birthday_ids.length > 0) {
        if (birthday_ids.length > 5000) {
          return c.json({ success: false, message: '单次最多关联 5000 条人员' }, 400);
        }
        const batchSize = 100;
        for (let i = 0; i < birthday_ids.length; i += batchSize) {
          const batch = birthday_ids.slice(i, i + batchSize);
          const placeholders = batch.map(() => '(?, ?)').join(',');
          const values = batch.flatMap((bid: number) => [id, bid]);
          await c.env.DB.prepare(
            `INSERT OR IGNORE INTO share_link_birthdays (share_link_id, birthday_id) VALUES ${placeholders}`
          )
            .bind(...values)
            .run();
        }
      }
    }

    const shareLink = await c.env.DB.prepare(
      `SELECT sl.*,
              CASE WHEN sl.is_all = 1 THEN
                (SELECT COUNT(*) FROM birthdays)
              ELSE
                (SELECT COUNT(*) FROM share_link_birthdays slb WHERE slb.share_link_id = sl.id)
              END as person_count
       FROM share_links sl
       WHERE sl.id = ?`
    )
      .bind(id)
      .first();

    return c.json({ success: true, data: shareLink });
  } catch (e: any) {
    return c.json({ success: false, message: '更新外链失败: ' + e.message }, 500);
  }
});

// DELETE /api/share-links/:id - 删除
shareLinks.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const existing = await c.env.DB.prepare(
      'SELECT * FROM share_links WHERE id = ?'
    )
      .bind(id)
      .first();

    if (!existing) {
      return c.json({ success: false, message: '外链不存在' }, 404);
    }

    await c.env.DB.prepare(
      'DELETE FROM share_link_birthdays WHERE share_link_id = ?'
    )
      .bind(id)
      .run();

    await c.env.DB.prepare('DELETE FROM share_links WHERE id = ?')
      .bind(id)
      .run();

    return c.json({ success: true, message: '删除成功' });
  } catch (e: any) {
    return c.json({ success: false, message: '删除外链失败: ' + e.message }, 500);
  }
});

// GET /api/share-links/:id/birthdays - 获取外链关联的生日列表
shareLinks.get('/:id/birthdays', async (c) => {
  try {
    const id = c.req.param('id');

    const shareLink = await c.env.DB.prepare(
      'SELECT * FROM share_links WHERE id = ?'
    )
      .bind(id)
      .first();

    if (!shareLink) {
      return c.json({ success: false, message: '外链不存在' }, 404);
    }

    let birthdayList: any[];

    if (shareLink.is_all) {
      const result = await c.env.DB.prepare(
        `SELECT b.*, d.name as department_name
         FROM birthdays b
         LEFT JOIN departments d ON b.department_id = d.id
         ORDER BY b.month ASC, b.day ASC, b.sort_order ASC, b.id ASC`
      ).all();
      birthdayList = result.results as any[];
    } else {
      const result = await c.env.DB.prepare(
        `SELECT b.*, d.name as department_name
         FROM birthdays b
         LEFT JOIN departments d ON b.department_id = d.id
         INNER JOIN share_link_birthdays slb ON b.id = slb.birthday_id
         WHERE slb.share_link_id = ?
         ORDER BY b.month ASC, b.day ASC, b.sort_order ASC, b.id ASC`
      )
        .bind(id)
        .all();
      birthdayList = result.results as any[];
    }

    return c.json({ success: true, data: birthdayList });
  } catch (e: any) {
    return c.json({ success: false, message: '获取外链生日列表失败: ' + e.message }, 500);
  }
});

export { shareLinks };