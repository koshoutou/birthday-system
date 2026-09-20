-- ============================================================
-- birthday-edit 平台数据库建表脚本
-- ============================================================
-- ⚠️ 部署到生产环境后，必须创建自己的管理员账号！
--
-- 初始化建表后（schema.sql 已建好 5 张表），请用 wrangler 执行：
--   1. 生成密码 SHA-256：
--      python3 -c "import hashlib; print(hashlib.sha256('你的密码'.encode()).hexdigest())"
--   2. 插入管理员：
--      npx wrangler d1 execute birthday-edit-db --remote \
--        --command "INSERT INTO users (username, password_hash) VALUES ('你的用户名', '上面得到的哈希值');"
--
-- 表结构如下 ↓
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 部门/分类表
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 生日记录表（含农历闰月支持）
CREATE TABLE IF NOT EXISTS birthdays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  year INTEGER,
  type TEXT NOT NULL DEFAULT 'solar',
  is_leap INTEGER NOT NULL DEFAULT 0,
  department_id INTEGER,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- 索引：按月日、分类、类型优化查询
CREATE INDEX IF NOT EXISTS idx_birthdays_month_day ON birthdays(month, day);
CREATE INDEX IF NOT EXISTS idx_birthdays_department ON birthdays(department_id);
CREATE INDEX IF NOT EXISTS idx_birthdays_type ON birthdays(type);

-- 外链表
CREATE TABLE IF NOT EXISTS share_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_all INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 外链与生日的关联表
CREATE TABLE IF NOT EXISTS share_link_birthdays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_link_id INTEGER NOT NULL,
  birthday_id INTEGER NOT NULL,
  FOREIGN KEY (share_link_id) REFERENCES share_links(id) ON DELETE CASCADE,
  FOREIGN KEY (birthday_id) REFERENCES birthdays(id) ON DELETE CASCADE,
  UNIQUE(share_link_id, birthday_id)
);

CREATE INDEX IF NOT EXISTS idx_share_link_birthdays ON share_link_birthdays(share_link_id);
