(function () {
  'use strict';

  function normalizeSearch(value) {
    return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function initializeSearch() {
    document.querySelectorAll('[data-article-index]').forEach(function (index) {
      var input = index.querySelector('#article-search');
      var control = index.querySelector('.search-control');
      var empty = index.querySelector('[data-search-empty]');
      var status = index.querySelector('[data-search-status]');
      var entries = Array.from(index.querySelectorAll('[data-article]')).map(function (element) {
        return {
          element: element,
          text: normalizeSearch((element.getAttribute('data-search') || '') + ' ' + element.textContent)
        };
      });
      if (!input || !entries.length) return;

      var composing = false;
      function updateResults() {
        if (composing) return;
        var query = normalizeSearch(input.value);
        var words = query ? query.split(' ') : [];
        var count = 0;
        entries.forEach(function (entry) {
          var matches = words.every(function (word) { return entry.text.includes(word); });
          entry.element.hidden = !matches;
          if (matches) count += 1;
        });
        if (empty) empty.hidden = !words.length || count > 0;
        if (status) status.textContent = words.length ? '找到 ' + count + ' 篇文章' : '共 ' + count + ' 篇文章';
      }

      if (control) control.hidden = false;
      input.addEventListener('compositionstart', function () { composing = true; });
      input.addEventListener('compositionend', function () {
        composing = false;
        updateResults();
      });
      input.addEventListener('input', updateResults);
      input.addEventListener('search', updateResults);
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !composing) {
          input.value = '';
          updateResults();
        }
      });
      updateResults();
    });
  }

  function initializeImages(body) {
    body.querySelectorAll('img').forEach(function (image) {
      function showFallback() {
        if (image.dataset.failed === 'true') return;
        image.dataset.failed = 'true';
        image.hidden = true;
        var fallback = document.createElement('span');
        var description = image.getAttribute('alt') || '';
        fallback.className = 'image-fallback';
        fallback.setAttribute('role', 'img');
        fallback.setAttribute('aria-label', description ? '照片未能加载：' + description : '照片暂时无法加载');
        fallback.textContent = '这张照片暂时无法加载。';
        image.insertAdjacentElement('afterend', fallback);
      }
      image.addEventListener('error', showFallback, { once: true });
      // An image can fail before this deferred script runs.
      if (image.complete && image.naturalWidth === 0 && image.getAttribute('src')) showFallback();
    });
  }

  function initializeTableOfContents(body) {
    var toc = document.querySelector('[data-toc]');
    if (!toc) return;
    var headings = Array.from(body.querySelectorAll('h2, h3')).filter(function (heading) {
      return heading.textContent.trim();
    });
    if (!headings.length) return;

    var ids = new Set(Array.from(document.querySelectorAll('[id]')).map(function (element) {
      return element.id;
    }));
    var list = toc.querySelector('ol');
    if (!list) {
      list = document.createElement('ol');
      toc.appendChild(list);
    }
    var fragment = document.createDocumentFragment();
    headings.forEach(function (heading) {
      if (!heading.id || document.getElementById(heading.id) !== heading) {
        var slug = normalizeSearch(heading.textContent).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
        var base = 'section-' + (slug || 'heading');
        var candidate = base;
        var suffix = 2;
        while (ids.has(candidate)) candidate = base + '-' + suffix++;
        heading.id = candidate;
        ids.add(candidate);
      }
      var item = document.createElement('li');
      if (heading.tagName === 'H3') item.className = 'toc-subheading';
      var link = document.createElement('a');
      link.href = '#' + encodeURIComponent(heading.id);
      link.textContent = heading.textContent.trim();
      item.appendChild(link);
      fragment.appendChild(item);
    });
    list.replaceChildren(fragment);
    toc.hidden = false;
  }

  function initialize() {
    initializeSearch();
    document.querySelectorAll('[data-post-body]').forEach(function (body) {
      initializeImages(body);
      initializeTableOfContents(body);
    });
    document.querySelectorAll('[data-reload]').forEach(function (button) {
      button.addEventListener('click', function () { window.location.reload(); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
}());
