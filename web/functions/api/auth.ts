import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

const auth = new Hono<{ Bindings: Bindings }>();

// SHA-256 哈希
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 认证中间件
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, message: '未提供认证令牌' }, 401);
  }
  const token = authHeader.replace('Bearer ', '');
  if (!c.env?.JWT_SECRET || c.env.JWT_SECRET.startsWith('REPLACE_ME_')) {
    return c.json({ success: false, message: 'JWT_SECRET 未配置，请检查 wrangler.toml' }, 500);
  }
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    c.set('jwtPayload', payload);
    await next();
  } catch {
    return c.json({ success: false, message: '认证令牌无效或已过期' }, 401);
  }
};

// POST /api/auth/login - 登录
auth.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    if (!username || !password) {
      return c.json({ success: false, message: '用户名和密码不能为空' }, 400);
    }

    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE username = ?'
    )
      .bind(username)
      .first();

    if (!user) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401);
    }

    const passwordHash = await sha256(password);
    if (passwordHash !== user.password_hash) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401);
    }

    if (!c.env.JWT_SECRET || c.env.JWT_SECRET.startsWith('REPLACE_ME_')) {
      return c.json({ success: false, message: 'JWT_SECRET 未配置，请检查 wrangler.toml' }, 500);
    }
    const token = await sign(
      {
        id: user.id,
        username: user.username,
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7天过期
      },
      secret
    );

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
        },
      },
    });
  } catch (e: any) {
    return c.json({ success: false, message: '登录失败: ' + e.message }, 500);
  }
});

// POST /api/auth/change-password - 修改密码
auth.post('/change-password', authMiddleware, async (c: any) => {
  try {
    const { oldPassword, newPassword } = await c.req.json();
    if (!oldPassword || !newPassword) {
      return c.json({ success: false, message: '旧密码和新密码不能为空' }, 400);
    }

    const payload = c.get('jwtPayload');
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    )
      .bind(payload.id)
      .first();

    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }

    const oldPasswordHash = await sha256(oldPassword);
    if (oldPasswordHash !== user.password_hash) {
      return c.json({ success: false, message: '旧密码错误' }, 400);
    }

    const newPasswordHash = await sha256(newPassword);
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    )
      .bind(newPasswordHash, payload.id)
      .run();

    return c.json({ success: true, message: '密码修改成功' });
  } catch (e: any) {
    return c.json({ success: false, message: '修改密码失败: ' + e.message }, 500);
  }
});

// GET /api/auth/me - 获取当前用户信息
auth.get('/me', authMiddleware, async (c: any) => {
  try {
    const payload = c.get('jwtPayload');
    const user = await c.env.DB.prepare(
      'SELECT id, username, created_at FROM users WHERE id = ?'
    )
      .bind(payload.id)
      .first();

    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404);
    }

    return c.json({ success: true, data: user });
  } catch (e: any) {
    return c.json({ success: false, message: '获取用户信息失败: ' + e.message }, 500);
  }
});

export { auth, authMiddleware };
