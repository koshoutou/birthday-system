#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生日提醒脚本（合并版 v2）

数据源优先级：
  1. 环境变量 / GitHub Secrets 里的 BIRTHDAYS_URL（显式指定远程链接，最高优先级）
  2. 仓库内 birthdays.txt 的【第一个有效行】如果是 http(s) 链接 → 抓取该链接内容
  3. 否则 → 直接用 birthdays.txt 的本地内容（小白默认用法）

统一数据格式（与 edit 平台外链输出一致）：
  姓名 | 日期 | 类型 | 分类
  张三 | 1990-01-15 | SOLAR      | 运营部
  李四 | 02-20      | LUNAR      | 助理部
  王五 | 1985-03-10 | SOLAR      | 办公室
  赵六 | 04-25      | LUNAR      | 网宣部
  宋七 | 1995-05-30 | LUNAR_LEAP | 运营部

  同时兼容旧版 - 分隔格式（a=公历 / b=农历，分类后缀 (闰) 表示闰月）。

邮件统一使用 QQ 邮箱 SMTP（smtp.qq.com:465 SSL）。
"""

import os
import re
import sys
import smtplib
import urllib.request
from datetime import datetime, timedelta, date
from email.mime.text import MIMEText
from email.header import Header
from html import escape as html_escape

from lunardate import LunarDate
import pytz

# ============================ 基础配置 ============================

BEIJING = pytz.timezone("Asia/Shanghai")

# 本地调试用：同目录下放 email.env（每行 KEY=VALUE），GitHub Actions 用 Secrets，不需要这个文件
ENV_FILE_NAMES = ("email.env", ".env")


def _load_dotenv():
    """可选：加载本地 email.env。环境变量（Secrets）优先级更高，不会被覆盖。"""
    here = os.path.dirname(os.path.abspath(__file__))
    for name in ENV_FILE_NAMES:
        for base in (here, os.path.dirname(here), os.getcwd()):
            path = os.path.join(base, name)
            if os.path.isfile(path):
                try:
                    with open(path, encoding="utf-8-sig") as f:
                        for line in f:
                            line = line.strip()
                            if not line or line.startswith("#") or "=" not in line:
                                continue
                            k, v = line.split("=", 1)
                            k, v = k.strip(), v.strip().strip('"').strip("'")
                            if k and k not in os.environ:
                                os.environ[k] = v
                except Exception as e:
                    print(f"[提示] 读取 {path} 失败：{e}")
                return


def env_bool(key, default=False):
    val = os.getenv(key, "").strip().lower()
    if val in ("1", "true", "yes", "on"):
        return True
    if val in ("0", "false", "no", "off"):
        return False
    return default


# ============================ 数据源 ============================

URL_RE = re.compile(r"^https?://\S+$")


def find_data_file():
    """按 脚本同目录 → 上级目录（仓库根）→ 当前目录 的顺序找 birthdays.txt。"""
    here = os.path.dirname(os.path.abspath(__file__))
    cands = [
        os.path.join(here, "birthdays.txt"),
        os.path.join(os.path.dirname(here), "birthdays.txt"),
        os.path.join(os.getcwd(), "birthdays.txt"),
    ]
    for p in cands:
        if os.path.isfile(p):
            return p
    return None


def fetch_url(url, timeout=25):
    """抓取 edit 平台外链内容（自动处理 UTF-8 BOM）。"""
    req = urllib.request.Request(url, headers={"User-Agent": "birthday-reminder/2.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    return raw.decode("utf-8-sig", errors="replace")


def load_source():
    """
    返回 (文本, 来源描述)。
    优先级：BIRTHDAYS_URL > txt 第一行为链接 > txt 本地内容。
    """
    url_env = os.getenv("BIRTHDAYS_URL", "").strip()
    if url_env:
        try:
            return fetch_url(url_env), f"远程链接(环境变量 BIRTHDAYS_URL)：{url_env}"
        except Exception as e:
            print(f"[错误] 抓取 BIRTHDAYS_URL 失败：{e}")

    path = find_data_file()
    if not path:
        raise SystemExit(
            "[错误] 找不到 birthdays.txt，也没有设置 BIRTHDAYS_URL。\n"
            "       请在仓库根目录创建 birthdays.txt，或配置 BIRTHDAYS_URL 指向 edit 平台外链。"
        )

    with open(path, encoding="utf-8-sig") as f:
        text = f.read()

    # 第一个有效行（跳过空行和 # 注释）
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if URL_RE.match(line):
            try:
                return fetch_url(line), f"远程链接(birthdays.txt 第一行)：{line}"
            except Exception as e:
                print(f"[错误] 抓取链接失败：{e}\n       已回退使用本地 birthdays.txt 内容。")
        break

    return text, f"本地文件：{path}"


# ============================ 解析 ============================

CAL_ALIAS = {
    "SOLAR": "SOLAR", "S": "SOLAR", "A": "SOLAR", "公历": "SOLAR", "阳历": "SOLAR",
    "LUNAR": "LUNAR", "L": "LUNAR", "B": "LUNAR", "农历": "LUNAR", "阴历": "LUNAR",
    "LUNAR_LEAP": "LUNAR_LEAP", "LEAP": "LUNAR_LEAP", "C": "LUNAR_LEAP", "闰月": "LUNAR_LEAP",
}

DATE_RE = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})$")
MD_RE = re.compile(r"^(\d{1,2})-(\d{1,2})$")

# 旧版 - 分隔格式
OLD_P4 = re.compile(r"^(.+)-(\d{4})-(\d{1,2})-(\d{1,2})-(a|b|c)-(.+)$")
OLD_P3 = re.compile(r"^(.+)-(\d{1,2})-(\d{1,2})-(a|b|c)-(.+)$")
OLD_P1 = re.compile(r"^(.+)-(\d{4})-(\d{1,2})-(\d{1,2})-(a|b|c)$")
OLD_P2 = re.compile(r"^(.+)-(\d{1,2})-(\d{1,2})-(a|b|c)$")


def parse_line(line):
    """解析一行，返回 dict 或 None。新格式（|）优先，旧格式（-）兜底。"""
    line = line.strip().lstrip("﻿")
    if not line or line.startswith("#"):
        return None

    # ---- 新格式：姓名 | 日期 | 类型 | 分类 ----
    if "|" in line:
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 3:
            return None
        name, date_str, cal_raw = parts[0], parts[1], parts[2]
        category = parts[3] if len(parts) > 3 and parts[3] else None

        cal = CAL_ALIAS.get(cal_raw.upper())
        if not cal:
            return None

        m = DATE_RE.match(date_str)
        if m:
            year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        else:
            m = MD_RE.match(date_str)
            if not m:
                return None
            year, month, day = None, int(m.group(1)), int(m.group(2))

        if not (1 <= month <= 12 and 1 <= day <= 31):
            return None
        return {"name": name, "year": year, "month": month, "day": day,
                "cal": cal, "category": category or None}

    # ---- 旧格式：姓名-年-月-日-类型[-分类] ----
    for pat, has_year, has_cat in (
        (OLD_P4, True, True), (OLD_P3, False, True),
        (OLD_P1, True, False), (OLD_P2, False, False),
    ):
        m = pat.match(line)
        if not m:
            continue
        g = m.groups()
        name = g[0].strip()
        if has_year:
            year, month, day = int(g[1]), int(g[2]), int(g[3])
            type_char = g[4]
            category = g[5].strip() if has_cat else None
        else:
            year = None
            month, day = int(g[1]), int(g[2])
            type_char = g[3]
            category = g[4].strip() if has_cat else None

        leap = False
        if category and re.search(r"\(闰\)\s*$", category):
            leap = True
            category = re.sub(r"\s*\(闰\)\s*$", "", category)

        if type_char == "a":
            cal = "SOLAR"
        elif type_char == "c":
            cal = "LUNAR_LEAP"
        else:
            cal = "LUNAR_LEAP" if leap else "LUNAR"

        if not (1 <= month <= 12 and 1 <= day <= 31):
            return None
        return {"name": name, "year": year, "month": month, "day": day,
                "cal": cal, "category": category or None}

    return None


def parse_all(text):
    """解析全部行，自动去重（同人同日同类型只提醒一次）。"""
    records, seen, bad = [], set(), []
    for i, line in enumerate(text.splitlines(), 1):
        rec = parse_line(line)
        if not rec:
            if line.strip() and not line.strip().startswith("#"):
                bad.append(f"第{i}行：{line.strip()}")
            continue
        key = (rec["name"], rec["year"], rec["month"], rec["day"], rec["cal"], rec["category"])
        if key in seen:
            continue
        seen.add(key)
        records.append(rec)
    return records, bad


# ============================ 显示与匹配 ============================

def date_str(rec):
    if rec["year"]:
        return f"{rec['year']}-{rec['month']:02d}-{rec['day']:02d}"
    return f"{rec['month']:02d}-{rec['day']:02d}"


def format_entry(rec, show_age=False, today=None):
    """输出统一格式：姓名 | 日期 | 类型 | 分类"""
    line = f"{rec['name']} | {date_str(rec)} | {rec['cal']} | {rec['category'] or '未分类'}"
    if show_age and today and rec["year"]:
        age = calc_age(rec, today)
        if age is not None:
            line += f" | {age}岁"
    return line


def calc_age(rec, today):
    """计算年龄；农历按出生年换算成公历后计算。"""
    try:
        if rec["cal"] == "SOLAR":
            birth = date(rec["year"], rec["month"], rec["day"])
        else:
            birth = LunarDate(
                rec["year"], rec["month"], rec["day"],
                isLeapMonth=(rec["cal"] == "LUNAR_LEAP"),
            ).toSolarDate()
    except Exception:
        return None
    age = today.year - birth.year
    if (today.month, today.day) < (birth.month, birth.day):
        age -= 1
    return age


def lunar_of(solar_date):
    """公历日期 → (农历月, 农历日, 是否闰月)"""
    ld = LunarDate.fromSolarDate(solar_date.year, solar_date.month, solar_date.day)
    return ld.month, ld.day, bool(getattr(ld, "isLeapMonth", False))


def is_match(rec, target):
    """
    判断某条记录是否落在 target（公历日期）这天。
    - SOLAR：直接比月日
    - LUNAR_LEAP：仅在农历闰月匹配
    - LUNAR：仅在农历平月匹配（避免同一年出现两个"六月初一"时重复提醒）
    """
    if rec["cal"] == "SOLAR":
        return rec["month"] == target.month and rec["day"] == target.day
    lm, ld, is_leap = lunar_of(target)
    if rec["month"] != lm or rec["day"] != ld:
        return False
    return is_leap if rec["cal"] == "LUNAR_LEAP" else not is_leap


# ============================ 邮件 ============================

def build_html(today_list, tomorrow_list, today, source_desc, show_age):
    def block(title, emoji, records):
        if not records:
            return ""
        items = "".join(
            f"<li class='entry'>{html_escape(format_entry(r, show_age, today))}</li>"
            for r in records
        )
        return f"""
        <div class="section">
          <h3>{emoji} {title}（{len(records)} 位）</h3>
          <ul class="list">{items}</ul>
        </div>"""

    body_html = block("今日生日", "🎂", today_list) + block("明日预告", "⏰", tomorrow_list)
    if not body_html:
        body_html = "<div class='section'><p class='empty'>今天和明天都没有生日记录。</p></div>"

    run_time = datetime.now(BEIJING).strftime("%Y-%m-%d %H:%M:%S")
    return f"""<html><head><meta charset="utf-8"><style>
body{{font-family:'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:#f5f6f8;margin:0;padding:16px;}}
.container{{max-width:640px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.08);}}
.header{{background:linear-gradient(135deg,#ff8a9b,#ff6a88);color:#fff;padding:22px;text-align:center;}}
.header h2{{margin:0;font-size:22px;}}
.content{{padding:18px 22px;}}
.section{{margin-bottom:18px;}}
.section h3{{margin:0 0 10px;font-size:16px;color:#333;border-left:4px solid #ff6a88;padding-left:8px;}}
.list{{list-style:none;margin:0;padding:0;}}
.entry{{background:#fafbfc;border:1px solid #eef0f2;border-radius:6px;padding:8px 12px;margin-bottom:6px;
       font-family:'SFMono-Regular',Consolas,monospace;font-size:13px;color:#24292e;}}
.empty{{color:#888;}}
.footer{{background:#fafafa;padding:14px;text-align:center;font-size:12px;color:#8a8a8a;border-top:1px solid #eee;}}
</style></head><body>
<div class="container">
  <div class="header"><h2>🎂 生日提醒</h2></div>
  <div class="content">{body_html}</div>
  <div class="footer">
    <div>数据源：{html_escape(source_desc)}</div>
    <div>运行时间：{run_time} (UTC+8)</div>
  </div>
</div></body></html>"""


def send_email(subject, html_body):
    """通过 QQ 邮箱 SMTP 发送；ADMIN_EMAIL 作为抄送。"""
    smtp_server = os.getenv("SMTP_SERVER", "smtp.qq.com").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "465"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
    admin = os.getenv("ADMIN_EMAIL", "").strip()

    if not smtp_user or not smtp_pass:
        print("[错误] 未配置 SMTP_USER / SMTP_PASSWORD，跳过发送。")
        return False

    msg = MIMEText(html_body, "html", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = f"生日提醒 <{smtp_user}>"
    msg["To"] = smtp_user
    recipients = [smtp_user]
    if admin and admin != smtp_user:
        msg["Cc"] = admin
        recipients.append(admin)

    try:
        with smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=30) as server:
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, recipients, msg.as_string())
        return True
    except smtplib.SMTPResponseException as e:
        print(f"[提示] 已发送但连接关闭异常（可忽略）：{e}")
        return True
    except Exception as e:
        print(f"[错误] 邮件发送失败：{e}")
        return False


# ============================ 主流程 ============================

def main():
    _load_dotenv()

    dry_run = env_bool("DRY_RUN", False)
    show_age = env_bool("SHOW_AGE", False)
    tomorrow_notice = env_bool("TOMORROW_NOTICE", True)
    always_send = env_bool("ALWAYS_SEND", False)

    # 今天（北京时间）；TODAY_OVERRIDE 仅用于本地测试
    override = os.getenv("TODAY_OVERRIDE", "").strip()
    if override:
        y, m, d = map(int, override.split("-"))
        today = date(y, m, d)
        print(f"[测试模式] 指定日期：{today}")
    else:
        today = datetime.now(BEIJING).date()
    tomorrow = today + timedelta(days=1)

    print("=" * 60)
    print("读取生日数据…")
    text, source_desc = load_source()
    records, bad_lines = parse_all(text)
    print(f"数据源：{source_desc}")
    print(f"成功解析：{len(records)} 条")
    if bad_lines:
        print(f"忽略无法识别的行 {len(bad_lines)} 条：")
        for b in bad_lines[:10]:
            print(f"  - {b}")
    print("=" * 60)

    today_list = [r for r in records if is_match(r, today)]
    tomorrow_list = [r for r in records if is_match(r, tomorrow)] if tomorrow_notice else []

    print(f"\n今日生日（{len(today_list)} 位）：")
    for r in today_list:
        print("  " + format_entry(r, show_age, today))
    if not today_list:
        print("  无")

    if tomorrow_notice:
        print(f"\n明日预告（{len(tomorrow_list)} 位）：")
        for r in tomorrow_list:
            print("  " + format_entry(r, show_age, today))
        if not tomorrow_list:
            print("  无")

    if not today_list and not tomorrow_list:
        print("\n今天和明天都没有人生日。")

    # 组装主题
    if today_list:
        names = "、".join(r["name"] for r in today_list[:5])
        more = "" if len(today_list) <= 5 else f" 等{len(today_list)}位"
        subject = f"🎂 今日{len(today_list)}位生日：{names}{more}"
    elif tomorrow_list:
        names = "、".join(r["name"] for r in tomorrow_list[:5])
        more = "" if len(tomorrow_list) <= 5 else f" 等{len(tomorrow_list)}位"
        subject = f"⏰ 明日{len(tomorrow_list)}位生日预告：{names}{more}"
    else:
        subject = "🎂 生日提醒：今日无生日"

    html_body = build_html(today_list, tomorrow_list, today, source_desc, show_age)

    if not today_list and not tomorrow_list and not always_send:
        print("\n（无生日且未开启 ALWAYS_SEND，不发送邮件）")
        return 0

    if dry_run:
        print(f"\n[DRY_RUN] 邮件主题：{subject}")
        print("[DRY_RUN] 已跳过实际发送（用于测试配置是否正确）。")
        return 0

    ok = send_email(subject, html_body)
    if ok:
        print(f"\n✅ 邮件已发送：{subject}")
        return 0
    print("\n❌ 邮件发送失败，请检查 SMTP_USER / SMTP_PASSWORD（QQ 邮箱授权码）是否正确。")
    return 1


if __name__ == "__main__":
    sys.exit(main())
