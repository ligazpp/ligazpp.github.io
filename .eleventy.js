const pathPrefix = process.env.PATH_PREFIX || '';

module.exports = function (eleventyConfig) {
  // Прямое копирование статики
  eleventyConfig.addPassthroughCopy('src/style.css');
  eleventyConfig.addPassthroughCopy('src/script.js');
  eleventyConfig.addPassthroughCopy('src/doc');
  if (process.env.CUSTOM_DOMAIN !== 'off') {
    eleventyConfig.addPassthroughCopy('src/CNAME');
  }

  // Базовый адрес публикации (для canonical, sitemap, Open Graph)
  eleventyConfig.addGlobalData('siteUrl', () => process.env.SITE_URL || 'https://ligazpp.ru');
  // Префикс пути при деплое в подпапку (например /mysite-test/)
  eleventyConfig.addGlobalData('pathPrefix', () => pathPrefix);
  // Запрет индексации (для тестовых сборок)
  eleventyConfig.addGlobalData('noindex', () => process.env.NOINDEX === '1');

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