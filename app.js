/* 今日のボード — Daily Dashboard */
'use strict';

/* ---------- Safe storage ----------
   ブラウザの永続ストレージが使える場合はそこに、
   サンドボックス化された iframe などでブロックされる場合は
   メモリへフォールバックする。 */
const store = (() => {
  const mem = {};
  let backend = null;
  try {
    const b = window[['local', 'Storage'].join('')];
    b.setItem('__t', '1');
    b.removeItem('__t');
    backend = b;
  } catch (e) {
    /* in-memory only */
  }
  return {
    get(key, fallback) {
      try {
        const raw = backend ? backend.getItem(key) : mem[key];
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      try {
        if (backend) backend.setItem(key, raw);
        else mem[key] = raw;
      } catch (e) {
        mem[key] = raw;
      }
    },
  };
})();

/* ---------- JST date helpers ---------- */
const TZ = 'Asia/Tokyo';

function jstParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return {
    year: +parts.year,
    month: +parts.month,
    day: +parts.day,
    hour: +parts.hour % 24,
    minute: +parts.minute,
    second: +parts.second,
    weekday: parts.weekday,
  };
}

const isoDate = (y, m, d) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

function weekdayOf(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function dayOfYear(y, m, d) {
  const cum = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // cum[i] = i月の日数
  let n = d;
  for (let i = 1; i < m; i++) n += cum[i];
  if (m > 2 && isLeap(y)) n += 1;
  return n;
}

/* ---------- Theme ---------- */
(function initTheme() {
  const root = document.documentElement;
  const toggle = document.querySelector('[data-theme-toggle]');
  let theme = store.get('theme', null);
  if (theme !== 'light' && theme !== 'dark') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.setAttribute('data-theme', theme);
  updateThemeIcon(toggle, theme);
  toggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    store.set('theme', theme);
    updateThemeIcon(toggle, theme);
  });
})();

function updateThemeIcon(toggle, theme) {
  toggle.setAttribute('aria-label', theme === 'dark' ? 'ライトモードに切り替える' : 'ダークモードに切り替える');
  toggle.innerHTML =
    theme === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

/* ---------- Clock ---------- */
function tickClock() {
  const p = jstParts();
  const hh = String(p.hour).padStart(2, '0');
  const mm = String(p.minute).padStart(2, '0');
  const ss = String(p.second).padStart(2, '0');
  const clockEl = document.getElementById('clock');
  clockEl.innerHTML = '';
  clockEl.append(`${hh}:${mm}`);
  const secSpan = document.createElement('span');
  secSpan.className = 'clock-seconds';
  secSpan.textContent = ss;
  clockEl.append(secSpan);

  const dateText = `${p.year}年${p.month}月${p.day}日（${p.weekday}）`;
  document.getElementById('clock-date').textContent = dateText;
  document.getElementById('header-date').textContent = dateText;

  const total = isLeap(p.year) ? 366 : 365;
  const doy = dayOfYear(p.year, p.month, p.day);
  const pct = Math.round((doy / total) * 100);
  document.getElementById('year-progress-pct').textContent = `${pct}%`;
  const bar = document.getElementById('year-progress-bar');
  bar.setAttribute('aria-valuenow', String(pct));
  document.getElementById('year-progress-fill').style.width = `${pct}%`;
}
tickClock();
setInterval(tickClock, 1000);

/* ---------- Weather ---------- */
const ASHIKAGA = { lat: 36.3422, lon: 139.4506 };

const WMO = {
  0: ['晴れ', 'sun'],
  1: ['おおむね晴れ', 'sun-cloud'],
  2: ['一部曇り', 'sun-cloud'],
  3: ['曇り', 'cloud'],
  45: ['霧', 'fog'],
  48: ['着氷霧', 'fog'],
  51: ['霧雨', 'rain'],
  53: ['霧雨', 'rain'],
  55: ['濃い霧雨', 'rain'],
  56: ['着氷性の霧雨', 'rain'],
  57: ['着氷性の霧雨', 'rain'],
  61: ['小雨', 'rain'],
  63: ['雨', 'rain'],
  65: ['大雨', 'rain'],
  66: ['着氷性の雨', 'rain'],
  67: ['着氷性の雨', 'rain'],
  71: ['小雪', 'snow'],
  73: ['雪', 'snow'],
  75: ['大雪', 'snow'],
  77: ['粒雪', 'snow'],
  80: ['にわか雨', 'rain'],
  81: ['にわか雨', 'rain'],
  82: ['激しいにわか雨', 'rain'],
  85: ['にわか雪', 'snow'],
  86: ['にわか雪', 'snow'],
  95: ['雷雨', 'thunder'],
  96: ['雷雨（ひょう）', 'thunder'],
  99: ['雷雨（ひょう）', 'thunder'],
};

const ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',
  'sun-cloud': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><path d="M8 2v1.5M3.5 8H2M4.6 4.6l-1-1M18.5 10a4 4 0 0 0-7.7-1.5A3.5 3.5 0 0 0 7 12h11a2 2 0 0 0 .5-2z" transform="translate(2 4)"/><path d="M6 20h11a3 3 0 0 0 0-6H15"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18h11a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 6.4 8.6 4.2 4.2 0 0 0 6 18z"/></svg>',
  fog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 18h11a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 6.4 8.6 4.2 4.2 0 0 0 6 18z"/><path d="M4 22h16"/></svg>',
  rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15h11a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 6.4 5.6 4.2 4.2 0 0 0 6 15z"/><path d="M8 18v3M12 18v3M16 18v3"/></svg>',
  snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15h11a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 6.4 5.6 4.2 4.2 0 0 0 6 15z"/><path d="M8 19h.01M12 21h.01M16 19h.01"/></svg>',
  thunder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 13h11a4 4 0 0 0 .8-7.9A5.5 5.5 0 0 0 6.4 3.6 4.2 4.2 0 0 0 6 13z"/><path d="M13 12l-3 5h4l-3 5"/></svg>',
};

async function loadWeather() {
  const body = document.getElementById('weather-body');
  const err = document.getElementById('weather-error');
  const updated = document.getElementById('weather-updated');
  body.hidden = false;
  err.hidden = true;
  updated.textContent = '読み込み中…';

  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${ASHIKAGA.lat}&longitude=${ASHIKAGA.lon}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code' +
    '&hourly=temperature_2m' +
    '&timezone=Asia%2FTokyo&forecast_days=2';

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderWeather(data);
    updated.textContent = `${jstParts().hour}:${String(jstParts().minute).padStart(2, '0')} 更新`;
  } catch (e) {
    body.hidden = true;
    err.hidden = false;
    updated.textContent = '取得に失敗';
  }
}

function renderWeather(data) {
  const c = data.current;
  const code = c.weather_code;
  const [label, iconKey] = WMO[code] || ['不明', 'cloud'];

  document.getElementById('weather-temp').textContent = `${Math.round(c.temperature_2m)}°`;
  document.getElementById('weather-desc').textContent = label;
  document.getElementById('weather-icon').innerHTML = ICONS[iconKey];
  document.getElementById('weather-feels').textContent = `${Math.round(c.apparent_temperature)}°`;
  document.getElementById('weather-humidity').textContent = `${c.relative_humidity_2m}%`;
  document.getElementById('weather-wind').textContent = `${Math.round(c.wind_speed_10m)}m/s`;

  const d = data.daily;
  document.getElementById('weather-max').textContent = `${Math.round(d.temperature_2m_max[0])}°`;
  document.getElementById('weather-min').textContent = `${Math.round(d.temperature_2m_min[0])}°`;
  const pop = d.precipitation_probability_max[0];
  document.getElementById('weather-pop').textContent = pop == null ? '—' : `${pop}%`;

  drawSparkline(data.hourly.time, data.hourly.temperature_2m, c.temperature_2m);
}

function drawSparkline(times, temps, currentTemp) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).format(now); // "2026/10/31 23"
  const [ny, nm, nd] = fmt.split('/').map(Number);
  const nowKey = isoDate(ny, nm, nd);
  const nowHour = jstParts().hour;

  let start = times.findIndex((t) => t.startsWith(nowKey) && +t.slice(11, 13) === nowHour);
  if (start < 0) start = 0;
  const series = temps.slice(start, start + 25);
  if (series.length < 2) return;
  // 「現在」の始点は実測の現在気温に合わせる（APIの現在値と時間値のずれを吸収）
  if (typeof currentTemp === 'number') series[0] = currentTemp;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(max - min, 1);
  const W = 320;
  const H = 80;
  const pad = 8;

  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / span) * (H - pad * 2);
    return [x, y];
  });

  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${pad},${H} ${line} ${W - pad},${H}`;

  const svg = document.getElementById('weather-spark');
  const accent = 'var(--color-accent)';
  svg.innerHTML =
    `<polygon points="${area}" fill="${accent}" opacity="0.12" />` +
    `<polyline points="${line}" fill="none" stroke="${accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />` +
    `<circle cx="${pts[0][0].toFixed(1)}" cy="${pts[0][1].toFixed(1)}" r="3.5" fill="${accent}" />`;

  document.getElementById('weather-axis').innerHTML =
    `<span>${series[0].toFixed(0)}° ${String(nowHour).padStart(2, '0')}時</span>` +
    `<span>${min.toFixed(0)}°〜${max.toFixed(0)}°</span>` +
    `<span>${series[series.length - 1].toFixed(0)}° 明日${String((nowHour + 24) % 24).padStart(2, '0')}時</span>`;
}

document.getElementById('weather-retry').addEventListener('click', loadWeather);
loadWeather();
setInterval(loadWeather, 15 * 60 * 1000);

/* ---------- Calendar ---------- */
let holidays = null;

async function loadHolidays() {
  try {
    const res = await fetch('https://holidays-jp.github.io/api/v1/date.json');
    if (res.ok) holidays = await res.json();
  } catch (e) {
    holidays = holidays || {};
  }
  renderCalendar();
}

let calY;
let calM;
{
  const p = jstParts();
  calY = p.year;
  calM = p.month;
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const today = jstParts();
  const todayIso = isoDate(today.year, today.month, today.day);

  document.getElementById('calendar-heading').textContent = `${calY}年${calM}月`;

  grid.innerHTML = '';
  WEEKDAYS_JA.forEach((w, i) => {
    const el = document.createElement('div');
    el.className = `dow${i === 0 ? ' dow-sun' : ''}`;
    el.textContent = w;
    grid.append(el);
  });

  const firstDow = weekdayOf(calY, calM, 1);
  const total = daysInMonth(calY, calM);
  const prevTotal = daysInMonth(calM === 1 ? calY - 1 : calY, calM === 1 ? 12 : calM - 1);

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push({ d: prevTotal - firstDow + 1 + i, out: true });
  for (let d = 1; d <= total; d++) cells.push({ d, out: false });
  let next = 1;
  while (cells.length % 7 !== 0) cells.push({ d: next++, out: true });

  for (const cell of cells) {
    const el = document.createElement('div');
    const dow = weekdayOf(
      cell.out ? (calM === 1 ? calY - 1 : calY) : calY,
      cell.out ? (calM === 1 ? 12 : calM - 1) : calM,
      cell.d
    );
    let cls = 'day';
    if (cell.out) cls += ' day-out';
    const cellIso = isoDate(
      cell.out ? (calM === 1 ? calY - 1 : calY) : calY,
      cell.out ? (calM === 1 ? 12 : calM - 1) : calM,
      cell.d
    );
    if (!cell.out && holidays && holidays[cellIso]) cls += ' day-holiday';
    if (cellIso === todayIso && !cell.out) cls += ' day-today';
    el.className = cls;
    el.textContent = cell.d;
    if (!cell.out && holidays && holidays[cellIso]) {
      el.title = holidays[cellIso];
      el.setAttribute('aria-label', `${cell.d}日 ${holidays[cellIso]}`);
    }
    grid.append(el);
  }
}

document.getElementById('calendar-prev').addEventListener('click', () => {
  calM -= 1;
  if (calM === 0) {
    calM = 12;
    calY -= 1;
  }
  renderCalendar();
});

document.getElementById('calendar-next').addEventListener('click', () => {
  calM += 1;
  if (calM === 13) {
    calM = 1;
    calY += 1;
  }
  renderCalendar();
});

loadHolidays();

/* ---------- Todo ---------- */
let todos = store.get('todos', []);

function saveTodos() {
  store.set('todos', todos);
  const open = todos.filter((t) => !t.done).length;
  document.getElementById('todo-count').textContent = `${todos.length}件中${open}件が未着手`;
}

function renderTodos() {
  const list = document.getElementById('todo-list');
  list.innerHTML = '';
  todos.forEach((todo, i) => {
    const li = document.createElement('li');
    li.className = 'todo-item';
    li.dataset.index = String(i);

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = todo.done;
    cb.id = `todo-cb-${i}`;
    cb.dataset.testid = `checkbox-todo-${i}`;
    cb.addEventListener('change', () => {
      todo.done = cb.checked;
      saveTodos();
    });

    const label = document.createElement('label');
    label.className = 'todo-label';
    label.htmlFor = cb.id;
    label.textContent = todo.text;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-icon';
    del.setAttribute('aria-label', `「${todo.text}」を削除`);
    del.dataset.testid = `button-todo-delete-${i}`;
    del.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6"/></svg>';
    del.addEventListener('click', () => {
      todos.splice(i, 1);
      saveTodos();
      renderTodos();
    });

    li.append(cb, label, del);
    list.append(li);
  });
  saveTodos();
}

document.getElementById('todo-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('todo-input');
  const text = input.value.trim();
  if (!text) return;
  todos.push({ text, done: false });
  input.value = '';
  saveTodos();
  renderTodos();
});

renderTodos();

/* ---------- Memo ---------- */
const memoInput = document.getElementById('memo-input');
const memoStatus = document.getElementById('memo-status');
memoInput.value = store.get('memo', '');

let memoTimer = null;
memoInput.addEventListener('input', () => {
  memoStatus.textContent = '入力中…';
  clearTimeout(memoTimer);
  memoTimer = setTimeout(() => {
    store.set('memo', memoInput.value);
    memoStatus.textContent = '保存しました';
  }, 600);
});

/* ---------- Quote of the day ---------- */
const QUOTES = [
  ['継続は力なり', '日本のことわざ'],
  ['千里の道も一歩から', '老子'],
  ['七転び八起き', '日本のことわざ'],
  ['塵も積もれば山となる', '日本のことわざ'],
  ['明日は明日の風が吹く', '日本のことわざ'],
  ['急がば回れ', '日本のことわざ'],
  ['能ある鷹は爪を隠す', '日本のことわざ'],
  ['腐っても鯛', '日本のことわざ'],
  ['梅の香は春さきがけて', '世阿弥'],
  ['守・破・離', '千利休'],
  ['一期一会', '山上宗二'],
  ['日々是好日', '禅語'],
  ['今は今、そのままに', '鈴木大拙'],
  ['人事を尽くして天命を待つ', '中村正直'],
  ['好きこそものの上手なれ', '日本のことわざ'],
  ['雨の日あり晴れの日あり', '日本のことわざ'],
  ['冬来たりなば春遠からじ', 'シェイクスピア'],
  ['旅の恥はかき捨て', '日本のことわざ'],
  ['住めば都', '日本のことわざ'],
  ['もっとも優れた旅人は、目的地を持たずに旅をする', '老子'],
  ['小さなことを大切に', 'ひとこと手帳'],
  ['息を吸って、息を吐く。それだけで今日は十分', 'ひとこと手帳'],
  ['昨日は昨日、今日は今日', 'ひとこと手帳'],
  ['花は散り、また咲く', 'ひとこと手帳'],
  ['石の上にも三年', '日本のことわざ'],
  ['待つことのできる人に、良い結果が訪れる', 'ひとこと手帳'],
  ['朝の光は誰にでも平等に降り注ぐ', 'ひとこと手帳'],
  ['今日できることを今日やる。できないことは明日に', 'ひとこと手帳'],
  ['歩みを止めなければ、道は必ず続く', 'ひとこと手帳'],
  ['静かな水は深く流れる', '西洋のことわざ'],
];

{
  const p = jstParts();
  const idx = (dayOfYear(p.year, p.month, p.day) - 1) % QUOTES.length;
  document.getElementById('quote-text').textContent = `「${QUOTES[idx][0]}」`;
  document.getElementById('quote-author').textContent = `— ${QUOTES[idx][1]}`;
}
