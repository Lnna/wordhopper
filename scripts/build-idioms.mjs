/**
 * 生成成语库 src/data/idioms.json
 *
 * 数据源（jsdelivr CDN，raw.githubusercontent 在国内不可达）：
 *   - 成语: pwxcoo/chinese-xinhua data/idiom.json（约 3.1 万条，含拼音/解释）
 *   - 常用字: NightFurySL2001/cjktables china/standard/xiandai_changyong.txt（3500：前 2500 常用 + 后 1000 次常用）
 *   - 词频: thunlp/THUOCL data/THUOCL_chengyu.txt（8519 条成语 + 使用频次，用于「常用」过滤）
 *
 * 用法: node scripts/build-idioms.mjs
 * 可选环境变量: IDIOM_SRC / HANZI_SRC / FREQ_SRC 指向本地文件以离线生成
 *
 * 输出每条: { t: "一心一意", p: "yi xin yi yi", m: "释义", d: ["专","致","志","诚"], f: 1234 }
 *   p 为去声调拼音（接龙匹配用），d 为 4 个预生成干扰字（2500 常用字内、与成语 4 字不重复）
 *   f 为 THUOCL 词频（难度分层用：容易 >=2000 / 中等 1000-1999 / 困难 400-999）
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/data/idioms.json');
const CACHE_DIR = join(ROOT, 'scripts/.cache');

const IDIOM_URL = 'https://cdn.jsdelivr.net/gh/pwxcoo/chinese-xinhua@master/data/idiom.json';
const HANZI_URL = 'https://cdn.jsdelivr.net/gh/NightFurySL2001/cjktables@master/china/standard/xiandai_changyong.txt';
const FREQ_URL = 'https://cdn.jsdelivr.net/gh/thunlp/THUOCL@master/data/THUOCL_chengyu.txt';

const COMMON_2500_COUNT = 2500;
const MEANING_MAX_LEN = 30;
/** THUOCL 词频下限：>=400 约 4000 条，兼顾常用度与接龙连通性 */
const MIN_FREQ = 400;

/** 确定性随机（重新生成结果一致） */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function fetchText(url, cacheFile, envOverride) {
  if (envOverride) return readFileSync(envOverride, 'utf8');
  mkdirSync(CACHE_DIR, { recursive: true });
  try {
    return readFileSync(join(CACHE_DIR, cacheFile), 'utf8');
  } catch { /* no cache */ }
  console.log(`fetching ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${url}`);
  const text = await res.text();
  writeFileSync(join(CACHE_DIR, cacheFile), text);
  return text;
}

/** 去声调：ǖǘǚǜü 先映射为 v（避免与 u 混淆），再 NFD 去掉声调组合符 */
function stripTone(syllable) {
  return syllable
    .replace(/[ǖǘǚǜü]/g, 'v')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zv]/g, '');
}

function parsePinyin(pinyin) {
  const first = String(pinyin || '').split(/[,，]/)[0];
  const syllables = first.trim().split(/\s+/).map(stripTone).filter(Boolean);
  return syllables.length === 4 ? syllables : null;
}

function cleanMeaning(explanation) {
  let m = String(explanation || '').replace(/[“”"《》]/g, '').replace(/\s+/g, '');
  if (m.length > MEANING_MAX_LEN) m = m.slice(0, MEANING_MAX_LEN) + '…';
  return m;
}

function parseHanziList(text) {
  return text
    .split(/\r?\n/)
    .slice(1) // 表头 "#规范字\tUnicode"
    .map((line) => line.split('\t')[0])
    .filter((ch) => ch && /\p{Script=Han}/u.test(ch));
}

/** THUOCL 词频表：成语 -> 频次 */
function parseFreqList(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const freq = parseInt(parts[parts.length - 1], 10);
    if (parts[0] && !Number.isNaN(freq)) map.set(parts[0], freq);
  }
  return map;
}

async function main() {
  const [idiomText, hanziText, freqText] = await Promise.all([
    fetchText(IDIOM_URL, 'idiom-raw.json', process.env.IDIOM_SRC),
    fetchText(HANZI_URL, 'changyong-raw.txt', process.env.HANZI_SRC),
    fetchText(FREQ_URL, 'thuocl-chengyu.txt', process.env.FREQ_SRC),
  ]);

  const hanzi = parseHanziList(hanziText);
  const allowed = new Set(hanzi); // 3500 内才算「常用成语用字」
  const distractorPool = hanzi.slice(0, COMMON_2500_COUNT); // 干扰字只用最常用 2500
  const freqMap = parseFreqList(freqText);
  console.log(`hanzi: ${hanzi.length}, distractor pool: ${distractorPool.length}, freq entries: ${freqMap.size}`);

  const raw = JSON.parse(idiomText);
  const rand = mulberry32(42);
  const seen = new Set();
  const out = [];
  let skipped = { len: 0, rare: 0, pinyin: 0, meaning: 0, dup: 0, uncommon: 0 };

  for (const entry of raw) {
    const word = String(entry.word || '');
    if (word.length !== 4) { skipped.len++; continue; }
    if (seen.has(word)) { skipped.dup++; continue; }
    if (![...word].every((ch) => allowed.has(ch))) { skipped.rare++; continue; }
    if ((freqMap.get(word) || 0) < MIN_FREQ) { skipped.uncommon++; continue; }
    const syllables = parsePinyin(entry.pinyin);
    if (!syllables) { skipped.pinyin++; continue; }
    const meaning = cleanMeaning(entry.explanation);
    if (!meaning) { skipped.meaning++; continue; }

    const idiomChars = new Set(word);
    const candidates = distractorPool.filter((ch) => !idiomChars.has(ch));
    const distractors = [];
    const usedIdx = new Set();
    while (distractors.length < 4) {
      const i = Math.floor(rand() * candidates.length);
      if (usedIdx.has(i)) continue;
      usedIdx.add(i);
      distractors.push(candidates[i]);
    }

    seen.add(word);
    out.push({ t: word, p: syllables.join(' '), m: meaning, d: distractors, f: freqMap.get(word) });
  }

  // 排序：首字音节 → 成语，保证输出稳定
  out.sort((a, b) => a.p.localeCompare(b.p) || a.t.localeCompare(b.t));

  // 链接通性统计：末字音节有至少一个可接成语的比例
  const firstSyllables = new Set(out.map((e) => e.p.split(' ')[0]));
  const chainable = out.filter((e) => firstSyllables.has(e.p.split(' ')[3])).length;

  // 难度词频带统计（容易 >=2000 / 中等 1000-1999 / 困难 <1000）及各带内部链接通性
  const tiers = {
    easy: out.filter((e) => e.f >= 2000),
    medium: out.filter((e) => e.f >= 1000 && e.f < 2000),
    hard: out.filter((e) => e.f < 1000),
  };
  const tierStats = Object.fromEntries(
    Object.entries(tiers).map(([name, list]) => {
      const firsts = new Set(list.map((e) => e.p.split(' ')[0]));
      const chain = list.filter((e) => firsts.has(e.p.split(' ')[3])).length;
      return [name, `${list.length} 条, 带内可接率 ${(chain / list.length * 100).toFixed(1)}%`];
    })
  );

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));

  console.log(`kept: ${out.length} / ${raw.length}`);
  console.log('skipped:', skipped);
  console.log(`chainable (last syllable has follower): ${chainable} (${(chainable / out.length * 100).toFixed(1)}%)`);
  console.log('tiers:', tierStats);
  console.log(`written: ${OUT} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
