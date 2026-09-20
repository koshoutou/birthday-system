/**
 * 农历查表法模块
 * 基于香港天文台发布的公历-农历对照表（1901-2100年）
 * 数据文件存放在 public/data/，可通过 HTTP 访问
 */

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

interface LunarMeta {
  months: string[];
  dates: string[];
  years: string[];
  zodiacs: string[];
  days: string[];
  terms: string[];
}

// 模块级缓存（worker 实例内复用）
const metaCache: { data: LunarMeta | null } = { data: null };
const yearCache: Map<number, Record<string, number[]>> = new Map();

async function loadMeta(origin: string): Promise<LunarMeta> {
  if (metaCache.data) return metaCache.data;
  const res = await fetch(`${origin}/data/lunar-meta.json`);
  if (!res.ok) throw new Error('Failed to load lunar-meta.json');
  metaCache.data = await res.json();
  return metaCache.data!;
}

async function loadYearData(year: number, origin: string): Promise<Record<string, number[]>> {
  if (yearCache.has(year)) return yearCache.get(year)!;
  const res = await fetch(`${origin}/data/min/${year}.json`);
  if (!res.ok) {
    yearCache.set(year, {});
    return {};
  }
  const data = await res.json();
  yearCache.set(year, data);
  return data;
}

function buildOrigin(request: Request, env: Bindings): string {
  // 优先使用 env.ORIGIN (部署时设置)，否则根据 request URL 推断
  if ((env as any).ORIGIN) return (env as any).ORIGIN;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

const MONTH_NAMES = ['', '正月', '二月', '三月', '四月', '五月', '六月',
                     '七月', '八月', '九月', '十月', '十一月', '十二月'];

const MONTH_NUM_MAP: Record<string, number> = {
  '正月': 1, '二月': 2, '三月': 3, '四月': 4, '五月': 5, '六月': 6,
  '七月': 7, '八月': 8, '九月': 9, '十月': 10, '十一月': 11, '十二月': 12,
};

const DAY_NUM_MAP: Record<string, number> = {
  '初一': 1, '初二': 2, '初三': 3, '初四': 4, '初五': 5,
  '初六': 6, '初七': 7, '初八': 8, '初九': 9, '初十': 10,
  '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
  '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
  '廿一': 21, '廿二': 22, '廿三': 23, '廿四': 24, '廿五': 25,
  '廿六': 26, '廿七': 27, '廿八': 28, '廿九': 29, '三十': 30,
};

const DAY_NAMES = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七',
                   '初八', '初九', '初十', '十一', '十二', '十三', '十四',
                   '十五', '十六', '十七', '十八', '十九', '二十', '廿一',
                   '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八',
                   '廿九', '三十'];

/**
 * 公历日期 → 农历信息
 */
export async function solarToLunar(
  date: Date,
  request: Request,
  env: Bindings
): Promise<{
  year: string;
  month: number;
  monthName: string;
  day: number;
  dayName: string;
  isLeap: boolean;
  zodiac: string;
  solarTerm: string | null;
  dayOfWeek: string;
} | null> {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();

  if (y < 1901 || y > 2100) return null;

  const origin = buildOrigin(request, env);
  const [meta, yearData] = await Promise.all([
    loadMeta(origin),
    loadYearData(y, origin),
  ]);

  const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const rec = yearData[key];
  if (!rec) return null;

  const [monthIdx, dateIdx, yearIdx, zodiacIdx, dayIdx, termIdx, leapFlag] = rec;
  const monthNameRaw = meta.months[monthIdx] || '';
  const isLeap = leapFlag === 1;
  const baseMonth = monthNameRaw.replace(/^[闰閏]/, '');
  const monthNum = MONTH_NUM_MAP[baseMonth] || 0;
  const dayNum = DAY_NUM_MAP[meta.dates[dateIdx]] || 0;

  return {
    year: meta.years[yearIdx] || '',
    month: monthNum,
    monthName: baseMonth,
    day: dayNum,
    dayName: meta.dates[dateIdx] || '',
    isLeap,
    zodiac: meta.zodiacs[zodiacIdx] || '',
    solarTerm: termIdx > 0 ? meta.terms[termIdx] : null,
    dayOfWeek: meta.days[dayIdx] || '',
  };
}

/**
 * 农历生日 → 下一次公历日期（含今天）
 */
export async function getNextLunarBirthday(
  lunarMonth: number,
  lunarDay: number,
  isLeap: boolean,
  request: Request,
  env: Bindings
): Promise<{ date: Date; daysUntil: number } | null> {
  const monthName = MONTH_NAMES[lunarMonth];
  if (!monthName) return null;

  const dayName = DAY_NAMES[lunarDay];
  if (!dayName) return null;

  const origin = buildOrigin(request, env);
  const meta = await loadMeta(origin);
  const targetDateIdx = meta.dates.indexOf(dayName);
  if (targetDateIdx < 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let yearOffset = 0; yearOffset < 3; yearOffset++) {
    const y = today.getFullYear() + yearOffset;
    if (y > 2100) break;
    const yearData = await loadYearData(y, origin);

    for (const key of Object.keys(yearData)) {
      const rec = yearData[key];
      const [monthIdx, dateIdx, , , , , leapFlag] = rec;
      if (dateIdx !== targetDateIdx) continue;

      const recMonthName = meta.months[monthIdx];

      if (isLeap) {
        if (leapFlag !== 1) continue;
        if (!recMonthName.startsWith('闰') && !recMonthName.startsWith('閏')) continue;
      } else {
        if (leapFlag !== 0) continue;
        if (recMonthName.startsWith('闰') || recMonthName.startsWith('閏')) continue;
      }

      const recBaseMonth = recMonthName.replace(/^[闰閏]/, '');
      if (recBaseMonth !== monthName) continue;

      const parts = key.split('-');
      const solarDate = new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2])
      );
      solarDate.setHours(0, 0, 0, 0);

      const diffMs = solarDate.getTime() - today.getTime();
      const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (daysUntil >= 0) {
        return { date: solarDate, daysUntil };
      }
    }
  }
  return null;
}

/**
 * 获取今天的农历信息（用于仪表盘）
 */
export async function getTodayLunar(
  request: Request,
  env: Bindings,
  date: Date = new Date()
): Promise<{
  gregorian: string;
  lunarYear: string;
  lunarDate: string;
  dayOfWeek: string;
  zodiac: string;
  solarTerm: string | null;
} | null> {
  const info = await solarToLunar(date, request, env);
  if (!info) return null;

  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const leapStr = info.isLeap ? '(闰)' : '';
  return {
    gregorian: `${y}年${m}月${d}日`,
    lunarYear: info.year,
    lunarDate: `${leapStr}${info.monthName}${info.dayName}`,
    dayOfWeek: info.dayOfWeek,
    zodiac: `${info.zodiac}年`,
    solarTerm: info.solarTerm,
  };
}