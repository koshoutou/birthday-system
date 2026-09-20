import { Hono } from 'hono';
import { authMiddleware } from './auth';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

const birthdays = new Hono<{ Bindings: Bindings }>();

// 所有生日接口都需要认证
birthdays.use('*', authMiddleware);

// 解析单行 birthdays.txt 格式
// 支持格式：
//   1. 姓名-月-日-类型 (如: 张三-10-18-a)        — 4 段
//   2. 姓名-年-月-日-类型 (如: 张三-1990-10-18-a) — 5 段，第 2 段是 4 位年份
//   3. 姓名-月-日-类型-部门 (如: 张三-10-18-a-技术部) — 5 段，第 2 段是 1-2 位月份
//   4. 姓名-年-月-日-类型-部门 (如: 张三-1990-10-18-a-技术部) — 6 段
//   5. 姓名-月-日-类型-部门(闰) — 在部门名后追加 "(闰)" 标记闰月
// 类型: a=公历(solar), b=农历(lunar)
function parseBirthdayLine(line: string): {
  name: string;
  month: number;
  day: number;
  year: number | null;
  type: string;
  isLeap: boolean;
  department: string | null;
} | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // 新格式（v2，与外链输出一致）：姓名 | 日期 | 类型 | 分类
  //   张三 | 1990-01-15 | SOLAR      | 运营部
  //   李四 | 02-20      | LUNAR      | 助理部
  //   王五 | 1985-03-10 | SOLAR      | 办公室
  //   赵六 | 04-25      | LUNAR      | 网宣部
  //   宋七 | 1995-05-30 | LUNAR_LEAP | 运营部
  if (trimmed.includes('|')) {
    const seg = trimmed.split('|').map((s) => s.trim());
    if (seg.length < 3) return null;

    const name = seg[0];
    const typeRaw = seg[2].toUpperCase();
    const categoryRaw = (seg[3] || '').trim();

    let year: number | null = null;
    let month = 0;
    let day = 0;
    const mFull = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(seg[1]);
    const mShort = /^(\d{1,2})-(\d{1,2})$/.exec(seg[1]);
    if (mFull) {
      year = parseInt(mFull[1], 10);
      month = parseInt(mFull[2], 10);
      day = parseInt(mFull[3], 10);
    } else if (mShort) {
      month = parseInt(mShort[1], 10);
      day = parseInt(mShort[2], 10);
    } else {
      return null;
    }

    let type = '';
    let isLeap = false;
    if (typeRaw === 'SOLAR' || typeRaw === 'S' || typeRaw === 'A') {
      type = 'solar';
    } else if (typeRaw === 'LUNAR_LEAP' || typeRaw === 'LEAP' || typeRaw === 'C') {
      type = 'lunar';
      isLeap = true;
    } else if (typeRaw === 'LUNAR' || typeRaw === 'L' || typeRaw === 'B') {
      type = 'lunar';
    } else {
      return null;
    }

    if (!name || month < 1 || month > 12 || day < 1 || day > 31) return null;
    if (year !== null && (isNaN(year) || year < 1900 || year > 2100)) year = null;

    // "未分类" 视为没有分类，避免导入时创建出垃圾分类
    const department = categoryRaw && categoryRaw !== '未分类' ? categoryRaw : null;
    return { name, month, day, year, type, isLeap, department };
  }

  const parts = trimmed.split('-');
  if (parts.length < 4 || parts.length > 6) return null;

  const name = parts[0].trim();
  if (!name) return null;

  let year: number | null = null;
  let month: number;
  let day: number;
  let type: string;
  let isLeap = false;
  let department: string | null = null;

  if (parts.length === 4) {
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
    type = parts[3] === 'a' ? 'solar' : parts[3] === 'b' ? 'lunar' : '';
    if (!type) return null;
  } else if (parts.length === 5) {
    const secondPart = parseInt(parts[1], 10);
    if (secondPart >= 1900 && secondPart <= 2100) {
      year = secondPart;
      month = parseInt(parts[2], 10);
      day = parseInt(parts[3], 10);
      type = parts[4] === 'a' ? 'solar' : parts[4] === 'b' ? 'lunar' : '';
    } else {
      month = secondPart;
      day = parseInt(parts[2], 10);
      type = parts[3] === 'a' ? 'solar' : parts[3] === 'b' ? 'lunar' : '';
      department = parts[4].trim() || null;
    }
    if (!type) return null;
  } else {
    // parts.length === 6
    const maybeYear = parseInt(parts[1], 10);
    if (maybeYear >= 1900 && maybeYear <= 2100) {
      year = maybeYear;
      month = parseInt(parts[2], 10);
      day = parseInt(parts[3], 10);
      type = parts[4] === 'a' ? 'solar' : parts[4] === 'b' ? 'lunar' : '';
      department = parts[5].trim() || null;
    } else {
      return null;
    }
    if (!type) return null;
  }

  if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // 闰月：检查部门名后缀 "(闰)"
  if (department && /\(闰\)$/.test(department)) {
    isLeap = true;
    department = department.replace(/\s*\(闰\)$/, '');
  }

  if (year !== null && (isNaN(year) || year < 1900 || year > 2100)) {
    year = null;
  }

  return { name, month, day, year, type, isLeap, department };
}

// 将生日记录转换为统一格式行：姓名 | 日期 | 类型 | 分类
//   日期：有年份 YYYY-MM-DD，无年份 MM-DD
//   类型：SOLAR 公历 / LUNAR 农历 / LUNAR_LEAP 农历闰月
//   分类：无分类时输出"未分类"
// 例：张三 | 1990-01-15 | SOLAR | 运营部
function formatBirthdayLine(b: any, departmentName: string | null): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = b.year
    ? `${b.year}-${pad(b.month)}-${pad(b.day)}`
    : `${pad(b.month)}-${pad(b.day)}`;

  let type = 'SOLAR';
  if (b.type === 'lunar') {
    type = b.is_leap ? 'LUNAR_LEAP' : 'LUNAR';
  }

  const category = (departmentName || '').trim() || '未分类';
  return `${b.name} | ${datePart} | ${type} | ${category}`;
}

// GET /api/birthdays - 列表（分页 + 筛选）
birthdays.get('/', async (c) => {
  try {
    // 同时接受 search/name, page_size/pageSize, all=1（返回全部，不分页）
    const q = c.req.query();
    const search = (q.search || q.name || '').trim();
    const department_id = q.department_id;
    const type = q.type;
    const month = q.month;
    const isLeap = q.is_leap;

    const all = q.all === '1' || q.all === 'true';
    const currentPage = parseInt(q.page || '1', 10);
    let pageSizeNum = parseInt(q.page_size || q.pageSize || '20', 10);
    if (all) pageSizeNum = 100000;

    const offset = (currentPage - 1) * pageSizeNum;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND b.name LIKE ?';
      params.push(`%${search}%`);
    }

    if (department_id) {
      whereClause += ' AND b.department_id = ?';
      params.push(department_id);
    }

    if (type) {
      whereClause += ' AND b.type = ?';
      params.push(type);
    }

    if (month) {
      whereClause += ' AND b.month = ?';
      params.push(parseInt(month, 10));
    }

    if (isLeap === '1' || isLeap === 'true') {
      whereClause += ' AND b.is_leap = 1';
    }

    // 获取总数
    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM birthdays b ${whereClause}`
    )
      .bind(...params)
      .first();
    const total = (countResult?.total as number) || 0;

    // 获取列表
    const listResult = await c.env.DB.prepare(
      `SELECT b.*, d.name as department_name
       FROM birthdays b
       LEFT JOIN departments d ON b.department_id = d.id
       ${whereClause}
       ORDER BY b.month ASC, b.day ASC, b.sort_order ASC, b.id ASC
       LIMIT ? OFFSET ?`
    )
      .bind(...params, pageSizeNum, offset)
      .all();

    return c.json({
      success: true,
      data: listResult.results,
      total,
      page: currentPage,
      pageSize: pageSizeNum,
    });
  } catch (e: any) {
    return c.json({ success: false, message: '获取列表失败: ' + e.message }, 500);
  }
});

// POST /api/birthdays - 创建
birthdays.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { name, month, day, year, type, department_id, is_leap } = body;

    if (!name || !month || !day || !type) {
      return c.json({ success: false, message: '姓名、月、日、类型不能为空' }, 400);
    }
    if (type !== 'solar' && type !== 'lunar') {
      return c.json({ success: false, message: '类型必须是 solar 或 lunar' }, 400);
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO birthdays (name, month, day, year, type, is_leap, department_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        name,
        parseInt(month, 10),
        parseInt(day, 10),
        year || null,
        type,
        type === 'lunar' && is_leap ? 1 : 0,
        department_id || null,
        0
      )
      .run();

    const birthday = await c.env.DB.prepare(
      `SELECT b.*, d.name as department_name
       FROM birthdays b
       LEFT JOIN departments d ON b.department_id = d.id
       WHERE b.id = ?`
    )
      .bind(result.meta.last_row_id)
      .first();

    return c.json({ success: true, data: birthday });
  } catch (e: any) {
    return c.json({ success: false, message: '创建失败: ' + e.message }, 500);
  }
});

// PUT /api/birthdays/:id - 更新
birthdays.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { name, month, day, year, type, department_id, is_leap } = body;

    const existing = await c.env.DB.prepare('SELECT * FROM birthdays WHERE id = ?')
      .bind(id)
      .first();

    if (!existing) {
      return c.json({ success: false, message: '记录不存在' }, 404);
    }

    await c.env.DB.prepare(
      `UPDATE birthdays
       SET name = ?, month = ?, day = ?, year = ?, type = ?, is_leap = ?, department_id = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(
        name || existing.name,
        month || existing.month,
        day || existing.day,
        year !== undefined ? year : existing.year,
        type || existing.type,
        is_leap !== undefined
          ? (is_leap ? 1 : 0)
          : (existing.is_leap ?? 0),
        department_id !== undefined ? department_id : existing.department_id,
        id
      )
      .run();

    const birthday = await c.env.DB.prepare(
      `SELECT b.*, d.name as department_name
       FROM birthdays b
       LEFT JOIN departments d ON b.department_id = d.id
       WHERE b.id = ?`
    )
      .bind(id)
      .first();

    return c.json({ success: true, data: birthday });
  } catch (e: any) {
    return c.json({ success: false, message: '更新失败: ' + e.message }, 500);
  }
});

// DELETE /api/birthdays/:id - 删除
birthdays.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const existing = await c.env.DB.prepare('SELECT * FROM birthdays WHERE id = ?')
      .bind(id)
      .first();

    if (!existing) {
      return c.json({ success: false, message: '记录不存在' }, 404);
    }

    await c.env.DB.prepare('DELETE FROM birthdays WHERE id = ?').bind(id).run();

    return c.json({ success: true, message: '删除成功' });
  } catch (e: any) {
    return c.json({ success: false, message: '删除失败: ' + e.message }, 500);
  }
});

// POST /api/birthdays/batch-delete - 批量删除
birthdays.post('/batch-delete', async (c) => {
  try {
    const { ids } = await c.req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ success: false, message: '请选择要删除的记录' }, 400);
    }

    // 限制单次最多 5000 条，防止滥用
    if (ids.length > 5000) {
      return c.json({ success: false, message: '单次最多删除 5000 条记录' }, 400);
    }

    const placeholders = ids.map(() => '?').join(',');
    await c.env.DB.prepare(`DELETE FROM birthdays WHERE id IN (${placeholders})`)
      .bind(...ids)
      .run();

    return c.json({ success: true, message: `成功删除 ${ids.length} 条记录` });
  } catch (e: any) {
    return c.json({ success: false, message: '批量删除失败: ' + e.message }, 500);
  }
});

// POST /api/birthdays/batch-update-department - 批量修改部门
birthdays.post('/batch-update-department', async (c) => {
  try {
    const { ids, department_id } = await c.req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ success: false, message: '请选择要更新的记录' }, 400);
    }

    if (ids.length > 5000) {
      return c.json({ success: false, message: '单次最多更新 5000 条记录' }, 400);
    }

    const placeholders = ids.map(() => '?').join(',');
    await c.env.DB.prepare(
      `UPDATE birthdays SET department_id = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
    )
      .bind(department_id || null, ...ids)
      .run();

    return c.json({ success: true, message: `成功更新 ${ids.length} 条记录` });
  } catch (e: any) {
    return c.json({ success: false, message: '批量更新失败: ' + e.message }, 500);
  }
});

// POST /api/birthdays/import - 批量导入
birthdays.post('/import', async (c) => {
  try {
    const { content } = await c.req.json();
    if (!content || typeof content !== 'string') {
      return c.json({ success: false, message: '请提供导入内容' }, 400);
    }

    const lines = content.split(/\r?\n/);
    const results: {
      success: number;
      failed: number;
      errors: string[];
      createdDepartments: string[];
    } = {
      success: 0,
      failed: 0,
      errors: [],
      createdDepartments: [],
    };

    const departmentCache = new Map<string, number>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parsed = parseBirthdayLine(line);

      if (!parsed) {
        if (line.trim()) {
          results.failed++;
          results.errors.push(`第 ${i + 1} 行: 格式无法识别 - "${line.trim()}"`);
        }
        continue;
      }

      let departmentId: number | null = null;
      if (parsed.department) {
        const deptName = parsed.department.trim();
        if (departmentCache.has(deptName)) {
          departmentId = departmentCache.get(deptName)!;
        } else {
          const dept = await c.env.DB.prepare(
            'SELECT id FROM departments WHERE name = ?'
          )
            .bind(deptName)
            .first();

          if (dept) {
            departmentId = dept.id as number;
          } else {
            try {
              const insertResult = await c.env.DB.prepare(
                'INSERT INTO departments (name, sort_order) VALUES (?, ?)'
              )
                .bind(deptName, 0)
                .run();
              departmentId = insertResult.meta.last_row_id;
              results.createdDepartments.push(deptName);
            } catch {
              results.errors.push(`第 ${i + 1} 行: 创建部门失败 (${deptName})`);
            }
          }
          if (departmentId !== null) {
            departmentCache.set(deptName, departmentId);
          }
        }
      }

      try {
        await c.env.DB.prepare(
          `INSERT INTO birthdays (name, month, day, year, type, is_leap, department_id, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            parsed.name,
            parsed.month,
            parsed.day,
            parsed.year,
            parsed.type,
            parsed.isLeap ? 1 : 0,
            departmentId,
            0
          )
          .run();
        results.success++;
      } catch {
        results.failed++;
        results.errors.push(`第 ${i + 1} 行: 导入失败 (${parsed.name})`);
      }
    }

    return c.json({
      success: true,
      data: results,
      message: `导入完成: 成功 ${results.success} 条, 失败 ${results.failed} 条${results.createdDepartments.length > 0 ? ', 新建部门: ' + results.createdDepartments.join(', ') : ''}`,
    });
  } catch (e: any) {
    return c.json({ success: false, message: '导入失败: ' + e.message }, 500);
  }
});

// POST /api/birthdays/export-selected - 导出选中的记录
birthdays.post('/export-selected', async (c) => {
  try {
    const { ids } = await c.req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ success: false, message: '请选择要导出的记录' }, 400);
    }

    const placeholders = ids.map(() => '?').join(',');
    const result = await c.env.DB.prepare(
      `SELECT b.*, d.name as department_name
       FROM birthdays b
       LEFT JOIN departments d ON b.department_id = d.id
       WHERE b.id IN (${placeholders})
       ORDER BY b.month ASC, b.day ASC, b.sort_order ASC, b.id ASC`
    )
      .bind(...ids)
      .all();

    const lines = (result.results as any[]).map((b) =>
      formatBirthdayLine(b, b.department_name)
    );

    const content = lines.join('\n');
    const BOM = '\uFEFF';
    const contentWithBOM = BOM + content;

    return new Response(contentWithBOM, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename=birthdays.txt',
      },
    });
  } catch (e: any) {
    return c.json({ success: false, message: '导出失败: ' + e.message }, 500);
  }
});

// GET /api/birthdays/export - 导出全部
birthdays.get('/export', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      `SELECT b.*, d.name as department_name
       FROM birthdays b
       LEFT JOIN departments d ON b.department_id = d.id
       ORDER BY b.month ASC, b.day ASC, b.sort_order ASC, b.id ASC`
    ).all();

    const lines = (result.results as any[]).map((b) =>
      formatBirthdayLine(b, b.department_name)
    );

    const content = lines.join('\n');
    const BOM = '\uFEFF';
    const contentWithBOM = BOM + content;

    return new Response(contentWithBOM, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename=birthdays.txt',
      },
    });
  } catch (e: any) {
    return c.json({ success: false, message: '导出失败: ' + e.message }, 500);
  }
});

export { birthdays, parseBirthdayLine, formatBirthdayLine };