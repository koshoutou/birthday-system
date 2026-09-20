import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from './auth';
import { departments } from './departments';
import { birthdays } from './birthdays';
import { shareLinks } from './share-links';
import { share } from './share';
import { dashboard } from './dashboard';
import { lunarApi } from './lunar-api';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS 中间件
app.use('*', cors());

// 健康检查
app.get('/', (c) => {
  return c.json({ success: true, message: 'Birthday Edit API is running' });
});

// 注册路由
app.route('/api/auth', auth);
app.route('/api/departments', departments);
app.route('/api/birthdays', birthdays);
app.route('/api/share-links', shareLinks);
app.route('/api/s', share);
app.route('/api/dashboard', dashboard);
app.route('/api/lunar', lunarApi);

// 404 处理
app.notFound((c) => {
  return c.json({ success: false, message: '接口不存在' }, 404);
});

// 全局错误处理
app.onError((err, c) => {
  console.error('Global error:', err);
  return c.json({ success: false, message: '服务器内部错误' }, 500);
});

// Cloudflare Pages Functions 导出
export const onRequest: PagesFunction<{ Bindings: Bindings }> = async (context) => {
  const env = context.env as any;
  // JWT_SECRET 必须在 wrangler.toml 里配置，不在代码里设默认值（避免泄漏）
  if (!env.JWT_SECRET || env.JWT_SECRET.startsWith('REPLACE_ME_')) {
    return new Response(
      JSON.stringify({ success: false, message: 'JWT_SECRET 未正确配置，请检查 wrangler.toml' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  // 设置默认 ORIGIN（如果不显式配置）
  if (!env.ORIGIN) {
    try {
      const url = new URL(context.request.url);
      env.ORIGIN = `${url.protocol}//${url.host}`;
    } catch {
      env.ORIGIN = '';
    }
  }
  return app.fetch(context.request, env, context);
};