# Birthday Edit - 生日管理平台

一个基于 Cloudflare Pages + D1 + Hono + Vue 3 的生日管理系统，支持 birthdays.txt 标准格式导入导出，可生成外链供 Python 提醒程序对接。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vue Router + Pinia + TailwindCSS 4 + Lucide Icons |
| 后端 | Hono (Cloudflare Pages Functions) |
| 数据库 | Cloudflare D1 (SQLite) |
| 部署 | Cloudflare Pages (Wrangler CLI) |
| 构建工具 | Vite 6 |

## 项目结构

```
birthday-edit/
├── functions/                  # Cloudflare Pages Functions (后端)
│   ├── api/
│   │   ├── [[route]].ts         # 路由入口，Hono 应用注册
│   │   ├── auth.ts              # 认证（登录/登出/修改密码/用户信息）
│   │   ├── birthdays.ts         # 生日 CRUD、导入导出
│   │   ├── dashboard.ts         # 仪表盘统计
│   │   ├── departments.ts       # 人员分类 CRUD
│   │   ├── share-links.ts       # 外链管理 CRUD
│   │   └── share.ts             # 外链访问（birthdays.txt 格式输出）
│   └── db/
│       └── schema.sql           # 数据库建表语句
├── src/                         # 前端源码
│   ├── views/
│   │   ├── Login.vue            # 登录页
│   │   ├── Dashboard.vue        # 仪表盘
│   │   ├── Birthdays.vue        # 生日管理
│   │   ├── Departments.vue      # 人员分类
│   │   └── ShareLinks.vue       # 外链管理
│   ├── stores/
│   │   └── auth.js              # 认证状态管理
│   ├── utils/
│   │   └── api.js               # HTTP 请求封装
│   ├── router/
│   │   └── index.js             # 路由配置
│   ├── App.vue                  # 根组件（布局、导航、Toast、修改密码）
│   └── main.js                  # 入口文件
├── wrangler.toml                # Cloudflare Pages 配置
├── vite.config.js               # Vite 配置
├── package.json
└── index.html
```

## 功能

### 仪表盘

- 总人数、分类数量、本月生日、今日生日统计
- 按分类统计人数
- 按公历/农历统计人数
- 近 30 天即将过生日的人员列表
- 近 7 天已过生日的人员列表

### 生日管理

- 增删改查，支持公历/农历、出生年份、所属分类
- 点击条目弹窗显示详情（下次生日日期、距离天数）
- 搜索筛选（姓名、分类、类型、月份）
- 跨页勾选，批量删除、批量修改分类
- 导入 birthdays.txt 格式数据（自动创建不存在的分类）
- 导出全部或勾选的数据为 birthdays.txt 格式

### 人员分类

- 分类的增删改查，显示每个分类下的人数

### 外链管理

- 创建外链（全部人员或按分类筛选后选择部分人员）
- 编辑外链关联的人员
- 复制外链地址
- 外链访问输出标准 birthdays.txt 格式纯文本

### 认证

- JWT Token 认证
- 修改密码（右上角用户菜单）

## 统一数据格式（v2）

导出与外链均输出统一格式，用 `|` 分隔 4 段：

```
姓名 | 日期 | 类型 | 分类
```

```
张三 | 1990-01-15 | SOLAR      | 运营部
李四 | 02-20      | LUNAR      | 助理部
王五 | 1985-03-10 | SOLAR      | 办公室
赵六 | 04-25      | LUNAR      | 网宣部
宋七 | 1995-05-30 | LUNAR_LEAP | 运营部
```

| 字段 | 说明 |
|------|------|
| 日期 | 有年份 `YYYY-MM-DD`，无年份 `MM-DD` |
| 类型 | `SOLAR` 公历 ｜ `LUNAR` 农历 ｜ `LUNAR_LEAP` 农历闰月 |
| 分类 | 无分类时输出 `未分类` |

- 导入时分类不存在会自动创建；`未分类` 会被当作无分类处理
- 兼容旧格式（`姓名-月-日-a-分类名`，`a`=公历 / `b`=农历 / 分类后缀 `(闰)` 表示闰月）

### 外链对接 Python 提醒程序

外链地址输出上述统一格式的纯文本，可直接作为提醒脚本的数据源：

```
https://<你的部署域名>/api/s/<token>
```

用法：把该链接填到仓库根目录 `birthdays.txt` 的**第一行**，或配置到环境变量 `BIRTHDAYS_URL`，
Python 提醒脚本会自动抓取并识别。详见仓库根目录 README 第四节。

## 数据库

使用 Cloudflare D1 (SQLite)，共 5 张表：

| 表名 | 说明 |
|------|------|
| `users` | 管理员账号 |
| `departments` | 人员分类 |
| `birthdays` | 生日记录 |
| `share_links` | 外链 |
| `share_link_birthdays` | 外链与生日记录的关联 |

建表语句见 `functions/db/schema.sql`。

## 本地开发

### 前置条件

- Node.js >= 18
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare 账号并登录 (`wrangler login`)

### 安装依赖

```bash
cd birthday-edit
npm install
```

### 启动前端开发服务器

```bash
npm run dev
```

Vite 开发服务器默认运行在 `http://localhost:5173`，已配置代理将 `/api` 请求转发到 `http://localhost:8788`。

### 启动后端本地开发

```bash
npx wrangler pages dev dist --d1 birthday-edit-db --binding DB=birthday-edit-db
```

或使用 Wrangler 配置文件：

```bash
npx wrangler pages dev
```

### 初始化远程数据库

```bash
npx wrangler d1 execute birthday-edit-db --remote --file functions/db/schema.sql
```

## 部署

### 构建前端

```bash
npm run build
```

### 部署到 Cloudflare Pages

```bash
npx wrangler pages deploy dist --project-name=birthday-edit --branch=main
```

### 配置说明

`wrangler.toml` 中的关键配置：

```toml
name = "birthday-edit"
pages_build_output_dir = "./dist"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[vars]
JWT_SECRET = "REPLACE_ME_WITH_RANDOM_STRING_BEFORE_DEPLOY"  # ⚠️ 必须替换为随机强密码（用 openssl rand -hex 32 生成）

[[d1_databases]]
binding = "DB"
database_name = "birthday-edit-db"
database_id = "<your-database-id>"  # 替换为你自己的 D1 数据库 ID
```

## API 接口

所有接口前缀为 `/api`，除登录外均需要 JWT Token 认证。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/login` | 登录 |
| GET | `/auth/me` | 获取当前用户信息 |
| POST | `/auth/change-password` | 修改密码 |
| GET | `/dashboard` | 仪表盘统计 |
| GET | `/birthdays` | 生日列表（分页、筛选） |
| POST | `/birthdays` | 创建生日记录 |
| PUT | `/birthdays/:id` | 更新生日记录 |
| DELETE | `/birthdays/:id` | 删除生日记录 |
| POST | `/birthdays/batch-delete` | 批量删除 |
| POST | `/birthdays/batch-update-department` | 批量修改分类 |
| POST | `/birthdays/import` | 批量导入 |
| GET | `/birthdays/export` | 导出全部 |
| POST | `/birthdays/export-selected` | 导出选中 |
| GET | `/departments` | 分类列表 |
| POST | `/departments` | 创建分类 |
| PUT | `/departments/:id` | 更新分类 |
| DELETE | `/departments/:id` | 删除分类 |
| GET | `/share-links` | 外链列表 |
| POST | `/share-links` | 创建外链 |
| PUT | `/share-links/:id` | 更新外链 |
| DELETE | `/share-links/:id` | 删除外链 |
| GET | `/share-links/:id/birthdays` | 获取外链关联的生日记录 |
| GET | `/s/:token` | 访问外链（纯文本输出） |

## License

MIT
