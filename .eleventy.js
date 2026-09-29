const pathPrefix = process.env.PATH_PREFIX || '';
const MarkdownIt = require('markdown-it');
const markdownItAnchor = require('markdown-it-anchor');
const laws = require('./src/_data/laws.js');

// Отдельный инстанс markdown-it для рендера markdown-строк из frontmatter страниц
const mdString = new MarkdownIt({ html: true });

// Транслитерация русских заголовков для якорей (например «Статья 5» → «statya-5»)
const ruMap = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya'
};
function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[а-яё]/g, (ch) => ruMap[ch] || ch)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-');
}

// Оглавление из заголовков h2/h3 готового HTML (аккордеон на <details>)
function buildToc(html) {
  const chapters = [...html.matchAll(/<h[23][^>]*id="([^"]+)"[^>]*>([^<]+)<\/h[23]>/g)];
  if (!chapters.length) return '';
  const nodes = [];
  let current = null;
  for (const m of chapters) {
    const isArticle = m[0].startsWith('<h3');
    const text = m[2];
    if (!isArticle) {
      current = { href: m[1], text, children: [] };
      nodes.push(current);
    } else if (current) {
      current.children.push({ href: m[1], text });
    } else {
      nodes.push({ href: m[1], text, children: [] });
    }
  }
  const chapter = (n) => `    <li class="law-toc__chapter"><a href="#${n.href}">${n.text}</a>
${n.children.length ? `      <ul>
${n.children.map((c) => `        <li><a href="#${c.href}">${c.text}</a></li>`).join('\n')}
      </ul>` : ''}
    </li>`;
  return `<nav class="law-toc" aria-label="Содержание">
  <details class="law-toc__acc">
    <summary>Содержание</summary>
    <ol class="law-toc__list">
${nodes.map(chapter).join('\n')}
    </ol>
  </details>
</nav>`;
}

// Формат даты «ГГГГ-ММ-ДД ЧЧ:ММ» → «ДД.ММ.ГГГГ»
function formatRuDate(value) {
  const d = String(value || '').slice(0, 10);
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

module.exports = function (eleventyConfig) {
  // Прямое копирование статики
  eleventyConfig.addPassthroughCopy('src/style.css');
  eleventyConfig.addPassthroughCopy('src/script.js');
  eleventyConfig.addPassthroughCopy('src/doc');

  // Базовый адрес публикации (для canonical, sitemap, Open Graph)
  eleventyConfig.addGlobalData('siteUrl', () => process.env.SITE_URL || 'https://ligazpp.github.io');
  // Префикс пути при деплое в подпапку (например /mysite-test/)
  eleventyConfig.addGlobalData('pathPrefix', () => pathPrefix);
  // Запрет индексации (для тестовых сборок)
  eleventyConfig.addGlobalData('noindex', () => process.env.NOINDEX === '1');

  // Якоря для глав и статей законов
  eleventyConfig.amendLibrary('md', (mdLib) => {
    mdLib.use(markdownItAnchor, { level: [2, 3], slugify, tabIndex: false });
  });

  // Рендер markdown-строки из frontmatter страниц (карточки «О нас» и «Контакты»)
  // Сначала раскрываем njk-переменные (например {{ site.phone1 }}), затем рендерим markdown
  eleventyConfig.addNunjucksFilter('md', function (str) {
    let source = String(str || '');
    if (this.env && typeof this.env.renderString === 'function') {
      source = this.env.renderString(source, this.ctx || {});
    }
    return mdString.render(source);
  });

  // Оглавление закона (главы со статьями в аккордеоне)
  eleventyConfig.addNunjucksFilter('toc', buildToc);

  // Дата в формате ДД.ММ.ГГГГ
  eleventyConfig.addNunjucksFilter('ruDate', formatRuDate);

  // Находит закон в реестре по его slug (для layout-ов страниц законов)
  eleventyConfig.addNunjucksFilter('findLaw', (slug) => laws.find((l) => l.slug === slug));

  return {
    dir: {
      input: 'src',
      output: '_site',
      includes: '_includes',
      data: '_data'
    },
    pathPrefix,
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk'
  };
};