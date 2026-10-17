// The in-story web browser. Sites come from content/web/sites/*.md and search results from
// content/web/search/*.md. Every navigation goes through navigate(), so Back, Forward and
// Refresh work the same for sites, search results and error pages.

import { asList, escapeHtml, renderText } from './content.js';

export function mountBrowser(body, { sites, results, story }) {
  const home = normalize(story.apps?.browser?.homeUrl ?? 'search.com');
  const engineName = story.search?.engineName ?? 'SearchEngine';
  const noResultsHint = story.search?.noResultsHint ?? '';

  body.innerHTML = `
    <div class="browser-bar">
      <div class="nav-buttons">
        <button class="nav-btn" data-nav="back" aria-label="Back" title="Back" disabled>←</button>
        <button class="nav-btn" data-nav="forward" aria-label="Forward" title="Forward" disabled>→</button>
        <button class="nav-btn" data-nav="refresh" aria-label="Refresh" title="Refresh">⟳</button>
      </div>
      <form class="address-form">
        <input type="text" class="address-bar" aria-label="Address" placeholder="Search or enter website URL"
               autocomplete="off" spellcheck="false">
        <button class="search-btn">Go</button>
      </form>
    </div>
    <div class="browser-content"></div>`;

  const address = body.querySelector('.address-bar');
  const content = body.querySelector('.browser-content');
  const backButton = body.querySelector('[data-nav="back"]');
  const forwardButton = body.querySelector('[data-nav="forward"]');
  let history = [];
  let index = -1;

  body.querySelector('.address-form').addEventListener('submit', event => {
    event.preventDefault();
    navigate(address.value);
  });
  backButton.addEventListener('click', () => go(index - 1));
  forwardButton.addEventListener('click', () => go(index + 1));
  body.querySelector('[data-nav="refresh"]').addEventListener('click', () => go(index));

  function go(newIndex) {
    if (newIndex < 0 || newIndex >= history.length) return;
    index = newIndex;
    navigate(history[index], { push: false });
  }

  function navigate(input, { push = true } = {}) {
    const route = resolve(input);
    content.innerHTML = renderRoute(route);
    content.scrollTop = 0;
    address.value = route.url;

    const searchForm = content.querySelector('.search-form');
    searchForm?.addEventListener('submit', event => {
      event.preventDefault();
      const query = searchForm.querySelector('.search-box').value.trim();
      if (query) navigate(resultsUrl(query));
    });

    if (push && history[index] !== route.url) {
      history = history.slice(0, index + 1);
      history.push(route.url);
      index = history.length - 1;
    }
    backButton.disabled = index <= 0;
    forwardButton.disabled = index >= history.length - 1;
  }

  function resultsUrl(query) {
    return `${home}/results?q=${encodeURIComponent(query).replace(/%20/g, '+')}`;
  }

  function resolve(input) {
    const addr = normalize(input);
    if (!addr || addr === home) return { kind: 'home', url: home };
    if (addr.startsWith(`${home}/results`)) {
      const query = new URLSearchParams(addr.split('?')[1] ?? '').get('q') ?? '';
      return { kind: 'results', query, url: resultsUrl(query) };
    }
    const site = findSite(addr);
    if (site) return { kind: 'site', site, url: addr };
    if (/^[^\s/]+\.[a-z]{2,}(\/\S*)?$/.test(addr)) return { kind: 'unreachable', url: addr };
    return { kind: 'results', query: input.trim(), url: resultsUrl(input.trim()) };
  }

  // Exact address or alias first, then any page on the same domain. "*.gov" matches every .gov domain.
  function findSite(addr) {
    const patterns = site => [site.url, ...asList(site.aliases)].map(normalize).filter(Boolean);
    const host = hostOf(addr);
    return sites.find(site => patterns(site).some(p => p === addr || (p.startsWith('*.') && host.endsWith(p.slice(1)))))
      ?? sites.find(site => patterns(site).some(p => hostOf(p) === host));
  }

  function renderRoute(route) {
    switch (route.kind) {
      case 'home':
        return searchPage('');
      case 'results':
        return searchPage(route.query, searchResults(route.query));
      case 'site':
        return renderSite(route.site);
      default:
        return `
          <div class="error-page">
            <div class="error-code">:(</div>
            <h2>This site can't be reached</h2>
            <p>Check if there is a typo in <strong>${escapeHtml(route.url)}</strong>.</p>
          </div>`;
    }
  }

  function searchPage(query, resultsHtml) {
    return `
      <div class="search-engine${resultsHtml ? ' has-results' : ''}">
        <div class="search-logo">${escapeHtml(engineName)}</div>
        <form class="search-form">
          <input type="text" class="search-box" aria-label="Search" placeholder="Search the web..."
                 autocomplete="off" value="${escapeHtml(query)}">
        </form>
        ${resultsHtml ? `<div class="search-results">${resultsHtml}</div>` : ''}
      </div>`;
  }

  function searchResults(query) {
    const q = query.toLowerCase();
    const matches = q ? results.filter(r => asList(r.keywords).some(k => q.includes(String(k).toLowerCase()))) : [];
    if (!matches.length) {
      return `
        <div class="search-result">
          <div class="result-title">No relevant results found</div>
          <div class="result-url">${escapeHtml(home)}</div>
          <div class="result-snippet">${escapeHtml(noResultsHint)}</div>
        </div>`;
    }
    return matches.map(r => `
      <a href="#" class="search-result story-link" data-url="${escapeHtml(r.url)}">
        <div class="result-title">${escapeHtml(r.title)}</div>
        <div class="result-url">${escapeHtml(r.url)}</div>
        <div class="result-snippet">${renderText(r.body)}</div>
      </a>`).join('');
  }

  function renderSite(site) {
    const { intro, sections } = parseSections(site.body);
    const introHtml = intro ? `<div class="site-intro">${renderText(intro)}</div>` : '';

    if (site.template === 'error') {
      return `
        <div class="error-page">
          <div class="error-code">${escapeHtml(site.code ?? '')}</div>
          <h2>${escapeHtml(site.title)}</h2>
          ${introHtml}
        </div>`;
    }
    if (site.template === 'forum') {
      return `
        <div class="site forum-site">
          <div class="forum-header">
            <h2>${escapeHtml(site.title)}</h2>
            ${site.tagline ? `<small>${escapeHtml(site.tagline)}</small>` : ''}
          </div>
          ${introHtml}
          ${sections.map(post => `
            <div class="forum-post">
              <div class="post-header">
                <div class="post-user">${escapeHtml(post.heading)}</div>
                <div class="post-date">${escapeHtml(post.meta)}</div>
              </div>
              <div class="post-content">${renderText(post.text)}</div>
            </div>`).join('')}
        </div>`;
    }
    // "news" and "plain" share the article layout; news gets the coloured masthead.
    return `
      <div class="site ${site.template === 'news' ? 'news-site' : 'plain-site'}">
        <div class="site-header"><h1>${escapeHtml(site.title)}</h1></div>
        ${introHtml}
        ${sections.map(article => `
          <div class="news-article">
            <div class="article-title">${escapeHtml(article.heading)}</div>
            ${article.meta ? `<div class="article-meta">${escapeHtml(article.meta)}</div>` : ''}
            <div class="article-content">${renderText(article.text)}</div>
          </div>`).join('')}
      </div>`;
  }

  function reset() {
    history = [];
    index = -1;
    navigate(home);
  }

  reset();
  return { navigate, reset };
}

// Splits a page body on "## Heading" lines. A "meta: ..." line right after a heading
// becomes that section's byline/date.
function parseSections(body) {
  const parts = String(body ?? '').split(/^## +/m);
  const intro = parts.shift().trim();
  const sections = parts.map(part => {
    const [heading, ...rest] = part.split('\n');
    let text = rest.join('\n').trim();
    let meta = '';
    const metaLine = text.match(/^meta:[ \t]*(.*)(\n|$)/);
    if (metaLine) {
      meta = metaLine[1].trim();
      text = text.slice(metaLine[0].length).trim();
    }
    return { heading: heading.trim(), meta, text };
  });
  return { intro, sections };
}

function normalize(url) {
  return String(url ?? '').trim().toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

function hostOf(addr) {
  return addr.split(/[/?#]/)[0];
}
