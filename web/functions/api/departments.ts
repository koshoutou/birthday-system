import { Hono } from 'hono';
import { authMiddleware } from './auth';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

const departments = new Hono<{ Bindings: Bindings }>();

// 所有部门接口都需要认证
departments.use('*', authMiddleware);

// GET /api/departments - 列表
departments.get('/', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT d.*, (SELECT COUNT(*) FROM birthdays WHERE department_id = d.id) as birthday_count FROM departments d ORDER BY d.sort_order ASC, d.id ASC'
    ).all();

    return c.json({ success: true, data: result.results });
  } catch (e: any) {
    return c.json({ success: false, message: '获取部门列表失败: ' + e.message }, 500);
  }
});

// POST /api/departments - 创建
departments.post('/', async (c) => {
  try {
    const { name, sort_order } = await c.req.json();
    if (!name || !name.trim()) {
      return c.json({ success: false, message: '部门名称不能为空' }, 400);
    }

    // 检查是否已存在
    const existing = await c.env.DB.prepare(
      'SELECT id FROM departments WHERE name = ?'
    )
      .bind(name.trim())
      .first();

    if (existing) {
      return c.json({ success: false, message: '部门名称已存在' }, 400);
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO departments (name, sort_order) VALUES (?, ?)'
    )
      .bind(name.trim(), sort_order || 0)
      .run();

    const department = await c.env.DB.prepare(
      'SELECT * FROM departments WHERE id = ?'
    )
      .bind(result.meta.last_row_id)
      .first();

    return c.json({ success: true, data: department });
  } catch (e: any) {
    return c.json({ success: false, message: '创建部门失败: ' + e.message }, 500);
  }
});

// PUT /api/departments/:id - 更新
departments.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { name, sort_order } = await c.req.json();

    const existing = await c.env.DB.prepare(
      'SELECT * FROM departments WHERE id = ?'
    )
      .bind(id)
      .first();

    if (!existing) {
      return c.json({ success: false, message: '部门不存在' }, 404);
    }

    if (name !== undefined && name.trim()) {
      // 检查名称是否被其他部门使用
      const nameConflict = await c.env.DB.prepare(
        'SELECT id FROM departments WHERE name = ? AND id != ?'
      )
        .bind(name.trim(), id)
        .first();

      if (nameConflict) {
        return c.json({ success: false, message: '部门名称已存在' }, 400);
      }
    }

    const updateName = name !== undefined ? name.trim() : existing.name;
    const updateSortOrder = sort_order !== undefined ? sort_order : existing.sort_order;

    await c.env.DB.prepare(
      'UPDATE departments SET name = ?, sort_order = ? WHERE id = ?'
    )
      .bind(updateName, updateSortOrder, id)
      .run();

    const department = await c.env.DB.prepare(
      'SELECT * FROM departments WHERE id = ?'
    )
      .bind(id)
      .first();

    return c.json({ success: true, data: department });
  } catch (e: any) {
    return c.json({ success: false, message: '更新部门失败: ' + e.message }, 500);
  }
});

// GET /api/departments/:id/persons - 查看某分类下的所有人员
departments.get('/:id/persons', async (c) => {
  try {
    const id = c.req.param('id');

    const dept = await c.env.DB.prepare(
      'SELECT * FROM departments WHERE id = ?'
    )
      .bind(id)
      .first();

    if (!dept) {
      return c.json({ success: false, message: '分类不存在' }, 404);
    }

    const result = await c.env.DB.prepare(
      `SELECT b.*, d.name as department_name
       FROM birthdays b
       LEFT JOIN departments d ON b.department_id = d.id
       WHERE b.department_id = ?
       ORDER BY b.month ASC, b.day ASC, b.sort_order ASC, b.id ASC`
    )
      .bind(id)
      .all();

    return c.json({
      success: true,
      data: {
        department: dept,
        persons: result.results,
        total: result.results?.length || 0,
      },
    });
  } catch (e: any) {
    return c.json({ success: false, message: '获取分类人员失败: ' + e.message }, 500);
  }
});

// DELETE /api/departments/:id - 删除
departments.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const existing = await c.env.DB.prepare(
      'SELECT * FROM departments WHERE id = ?'
    )
      .bind(id)
      .first();

    if (!existing) {
      return c.json({ success: false, message: '部门不存在' }, 404);
    }

    // 先将该部门下的生日记录的 department_id 设为 NULL
    await c.env.DB.prepare(
      'UPDATE birthdays SET department_id = NULL WHERE department_id = ?'
    )
      .bind(id)
      .run();

    await c.env.DB.prepare('DELETE FROM departments WHERE id = ?')
      .bind(id)
      .run();

    return c.json({ success: true, message: '删除成功' });
  } catch (e: any) {
    return c.json({ success: false, message: '删除部门失败: ' + e.message }, 500);
  }
});

export { departments };
