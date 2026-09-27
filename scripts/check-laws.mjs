// Проверка актуальности редакций законов.

// Источник «pravo.gov.ru»: у страницы документа есть выпадающий список всех
// редакций в тегах <option>. Загружаем только «оболочку» документа (~40 КБ),
// вытаскиваем даты всех редакций, берём самую позднюю и сравниваем с датой,
// сохранённой в реестре src/_data/laws.js. Полный текст закона НЕ скачивается.
//
// Источник «Consultant+»: карточка документа на www.consultant.ru, у акта
// с изменениями в титуле стоит «(ред. от ДД.ММ.ГГГГ)» (либо «(с изм. от …)»).
// Сравниваем эту дату с локальной; если изменений нет — используем дату
// принятия (law.adopted).
//
// Результат записывается в src/_data/lawStatus.json, откуда его читают
// страницы при сборке (зелёная/оранжевая отметка актуальности).
//
// Запуск: npm run laws:check

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import laws from '../src/_data/laws.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statusFile = path.join(__dirname, '..', 'src', '_data', 'lawStatus.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// Декодирование ответа портала (кодировка windows-1251)
function decodeCp1251(bytes) {
  return new TextDecoder('windows-1251').decode(bytes);
}

// Преобразование даты «ДД.ММ.ГГГГ» в сортируемую «ГГГГ-ММ-ДД»
function toIso(ddmmyyyy) {
  const [d, m, y] = ddmmyyyy.split('.');
  return `${y}-${m}-${d}`;
}

// Последняя (самая поздняя) редакция из выпадающего списка документа
function parseLatestRevision(html) {
  const dates = [];
  const re = /<option[^>]*>\s*\d+\s*-\s*от\s+(\d{2}\.\d{2}\.\d{4})/gi;
  let m;
  while ((m = re.exec(html)) !== null) dates.push(m[1]);
  if (!dates.length) return null;
  dates.sort((a, b) => toIso(b).localeCompare(toIso(a)));
  return dates[0];
}

async function fetchPravoRevision(law) {
  const url = `http://pravo.gov.ru/proxy/ips/?docbody=&nd=${law.nd}`;
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html' },
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return parseLatestRevision(decodeCp1251(bytes));
}

async function fetchConsultantRevision(law) {
  const url = `https://www.consultant.ru/document/cons_doc_LAW_${law.docId}/`;
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html' },
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const m = /\(ред\. от (\d{2}\.\d{2}\.\d{4})\)/.exec(html)
    || /\(с изм\. от (\d{2}\.\d{2}\.\d{4})\)/.exec(html);
  return m ? m[1] : law.adopted;
}

async function fetchOnlineRevision(law) {
  if (law.source === 'consultant') return fetchConsultantRevision(law);
  return fetchPravoRevision(law);
}

function loadStatus() {
  try {
    return JSON.parse(fs.readFileSync(statusFile, 'utf8'));
  } catch {
    return {};
  }
}

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function main() {
  const status = loadStatus();
  const results = [];

  for (const law of laws) {
    const slug = law.slug;
    const prev = status[slug] || { onlineRevision: null, localRevision: law.lastRevision, status: 'unknown', checkedAt: null };
    try {
      const online = await fetchOnlineRevision(law);
      if (!online) {
        console.log(`[${slug}] не удалось найти редакции на pravo.gov.ru — статус не изменён`);
        results.push({ slug, ok: false, reason: 'список редакций не найден' });
        continue;
      }
      const next = {
        ...prev,
        onlineRevision: online,
        localRevision: law.lastRevision,
        status: online === law.lastRevision ? 'ok' : 'update',
        checkedAt: nowIso()
      };
      status[slug] = next;
      const flag = next.status === 'ok' ? 'ОК' : 'ЕСТЬ НОВАЯ РЕДАКЦИЯ';
      console.log(`[${slug}] онлайн: ${online}, локально: ${law.lastRevision} → ${flag}`);
      results.push({ slug, ok: true, status: next.status });
    } catch (err) {
      console.log(`[${slug}] ошибка проверки (${err.message}) — сохранён прежний статус`);
      results.push({ slug, ok: false, reason: String(err.message) });
    }
  }

  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2) + '\n');
  console.log(`\nЗаписано: ${statusFile}`);

  const failed = results.filter((r) => !r.ok).length;
  if (failed > 0) {
    console.log(`Внимание: ${failed} проверок завершилось с ошибкой (сеть/портал могут быть недоступны).`);
  }
}

main().catch((err) => {
  console.error('Критическая ошибка:', err);
  process.exitCode = 1;
});