(function () {
  'use strict';

  var ELLIPSIS = -1;
  var POLL_INTERVAL = 200;
  var POLL_MAX_TRIES = 40;
  var GUARD_INTERVAL = 2000;
  var REFRESH_DELAY = 300;
  var PER_PAGE_DEFAULT = 50;
  var SEARCH_MAX_FILES = 500;

  var currentPage = 1;
  var totalFiles = 0;
  var totalPages = 0;
  var perPage = PER_PAGE_DEFAULT;
  var loading = false;
  var el = null;
  var guardTimer = null;
  var pageUrlPattern = /\/server\/[^/]+\/files/;

  var ICONS = {
    first: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></svg>',
    prev: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    next: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    last: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/></svg>',
    spinner: '<svg class="fmp-spinner" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
  };

  function isFileManagerPage() {
    return pageUrlPattern.test(window.location.pathname);
  }

  function isInDOM(node) {
    return node && node.parentNode && document.body.contains(node);
  }

  function isSearchActive() {
    var input = document.getElementById('file-search-input');
    return input && input.value.trim().length > 0;
  }

  function getConfig() {
    return fetch('/api/public/filemanager-pagination/config', {
      headers: { Accept: 'application/json' }
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.success && d.data && d.data.per_page) {
        perPage = parseInt(d.data.per_page, 10) || PER_PAGE_DEFAULT;
      }
    }).catch(function () {});
  }

  function findRefreshBtn() {
    var icon = document.querySelector('.lucide-refresh-cw');
    return icon ? icon.closest('button') : null;
  }

  function getPageRange(current, total) {
    if (total <= 7) {
      var arr = [];
      for (var i = 1; i <= total; i++) arr.push(i);
      return arr;
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, ELLIPSIS, total];
    }
    if (current >= total - 3) {
      return [1, ELLIPSIS, total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, ELLIPSIS, current - 1, current, current + 1, ELLIPSIS, total];
  }

  function parseFileRequest(url) {
    if (typeof url !== 'string') return null;
    if (!isFileManagerPage()) return null;
    var m = url.match(/\/api\/user\/servers\/([^/]+)\/files(?:[?/]|$)/);
    if (!m) return null;
    if (/\/search|\/write|\/rename|\/delete|\/upload|\/download|\/create-directory|\/compress|\/decompress|\/copy|\/chmod|\/pull|\/hash|\/trash|\/wipe|\/archive|\/extract|\/paginated/.test(url)) return null;
    return m[1];
  }

  function createIconBtn(className, html, onClick, disabled, title) {
    var btn = document.createElement('button');
    btn.className = className;
    btn.disabled = !!disabled;
    btn.innerHTML = html;
    if (title) btn.title = title;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function createPageBtn(page, isActive) {
    var btn = document.createElement('button');
    btn.className = 'fmp-page' + (isActive ? ' active' : '');
    btn.textContent = page;
    return btn;
  }

  function buildUI() {
    var c = document.createElement('div');
    c.className = 'fmp-pagination' + (loading ? ' fmp-loading' : '');

    var status = document.createElement('span');
    status.className = 'fmp-status';

    if (loading) {
      var spinner = document.createElement('span');
      spinner.className = 'fmp-spinner-wrap';
      spinner.innerHTML = ICONS.spinner;
      status.appendChild(spinner);
      status.appendChild(document.createTextNode(' Loading\u2026'));
    } else if (isSearchActive()) {
      status.textContent = 'Searching all files\u2026';
    } else {
      var from = totalFiles > 0 ? (currentPage - 1) * perPage + 1 : 0;
      var to = Math.min(currentPage * perPage, totalFiles);
      status.textContent = 'Showing ' + from + '\u2013' + to + ' of ' + totalFiles;
    }

    var controls = document.createElement('div');
    controls.className = 'fmp-controls';

    if (!isSearchActive()) {
      controls.appendChild(createIconBtn('fmp-btn fmp-first', ICONS.first, function () { goTo(1); }, currentPage <= 1, 'First page'));
      controls.appendChild(createIconBtn('fmp-btn fmp-prev', ICONS.prev, function () { goTo(currentPage - 1); }, currentPage <= 1, 'Previous page'));

      var pagesDiv = document.createElement('div');
      pagesDiv.className = 'fmp-pages';
      var range = getPageRange(currentPage, totalPages);
      for (var i = 0; i < range.length; i++) {
        var p = range[i];
        if (p === ELLIPSIS) {
          var dot = document.createElement('span');
          dot.className = 'fmp-ellipsis';
          dot.textContent = '\u2026';
          pagesDiv.appendChild(dot);
        } else {
          var btn = createPageBtn(p, p === currentPage);
          btn.addEventListener('click', (function (page) { return function () { goTo(page); }; })(p));
          pagesDiv.appendChild(btn);
        }
      }
      controls.appendChild(pagesDiv);

      controls.appendChild(createIconBtn('fmp-btn fmp-next', ICONS.next, function () { goTo(currentPage + 1); }, currentPage >= totalPages, 'Next page'));
      controls.appendChild(createIconBtn('fmp-btn fmp-last', ICONS.last, function () { goTo(totalPages); }, currentPage >= totalPages, 'Last page'));
    }

    c.appendChild(status);
    c.appendChild(controls);
    return c;
  }

  function findInjectionTarget() {
    var lists = document.querySelectorAll('[class*="overflow-hidden"][class*="rounded-xl"][class*="border-black/5"]');
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].querySelector('[class*="divide-y"]')) {
        return lists[i];
      }
    }
    var toolbar = document.querySelector('.sticky');
    if (toolbar && toolbar.parentNode) {
      var next = toolbar.nextElementSibling;
      if (next) return next;
      return toolbar.parentNode;
    }
    return document.querySelector('[class*="min-h-screen"]') || document.body;
  }

  function inject() {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
    el = document.createElement('div');
    el.id = 'fmp-pagination-root';
    el.appendChild(buildUI());
    var target = findInjectionTarget();
    if (target && target.parentNode) {
      target.parentNode.insertBefore(el, target.nextSibling);
    } else {
      document.body.appendChild(el);
    }
  }

  function refresh() {
    if (isInDOM(el)) {
      el.innerHTML = '';
      el.appendChild(buildUI());
    }
  }

  function setLoading(v) {
    loading = v;
    if (isInDOM(el)) {
      if (!loading || isSearchActive()) {
        refresh();
      } else {
        el.innerHTML = '';
        el.appendChild(buildUI());
      }
    }
  }

  function goTo(p) {
    if (p < 1 || p > totalPages) return;
    currentPage = p;
    inject();
    setLoading(true);
    var btn = findRefreshBtn();
    if (btn) btn.click();
  }

  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
    var uuidShort = parseFileRequest(url);
    if (uuidShort) {
      var params = new URLSearchParams(url.indexOf('?') !== -1 ? url.split('?')[1] : '');
      var path = params.get('path') || '/';

      var activePerPage = isSearchActive() ? SEARCH_MAX_FILES : perPage;
      var activePage = isSearchActive() ? 1 : currentPage;

      url = '/api/user/servers/' + uuidShort + '/files/paginated?path=' + encodeURIComponent(path) + '&page=' + activePage + '&per_page=' + activePerPage;

      this.addEventListener('readystatechange', function () {
        if (this.readyState === 4) {
          setLoading(false);
          if (this.status === 200) {
            try {
              var d = JSON.parse(this.responseText);
              if (d && d.success && d.data && d.data.pagination) {
                totalFiles = d.data.pagination.total;
                totalPages = d.data.pagination.total_pages;
                if (currentPage > totalPages) currentPage = totalPages || 1;
                if (isInDOM(el)) setTimeout(refresh, 100);
              }
            } catch (e) {}
          }
        }
      });
    }
    return origOpen.call(this, method, url, async !== false, user, password);
  };

  function init() {
    if (!isFileManagerPage()) return;
    if (guardTimer) {
      clearInterval(guardTimer);
      guardTimer = null;
    }
    el = null;
    loading = false;

    getConfig().then(function () {
      if (!isFileManagerPage()) return;

      var tries = 0;
      var pollTimer = setInterval(function () {
        tries++;
        var target = findInjectionTarget();
        if (target && (target.querySelector('[class*="divide-y"]') || target.classList.contains('overflow-hidden'))) {
          clearInterval(pollTimer);
          inject();
          guardTimer = setInterval(function () {
            if (!isFileManagerPage()) { clearInterval(guardTimer); guardTimer = null; return; }
            if (!isInDOM(el)) inject();
          }, GUARD_INTERVAL);
          setTimeout(function () {
            var btn = findRefreshBtn();
            if (btn) btn.click();
          }, REFRESH_DELAY);
          return;
        }
        if (tries >= POLL_MAX_TRIES) {
          clearInterval(pollTimer);
          inject();
          guardTimer = setInterval(function () {
            if (!isFileManagerPage()) { clearInterval(guardTimer); guardTimer = null; return; }
            if (!isInDOM(el)) inject();
          }, GUARD_INTERVAL);
        }
      }, POLL_INTERVAL);
    });
  }

  var navUrl = window.location.pathname;
  setInterval(function () {
    var cur = window.location.pathname;
    if (cur !== navUrl) {
      navUrl = cur;
      loading = false;
      init();
    }
    if (isFileManagerPage() && el && isInDOM(el)) {
      var searching = isSearchActive();
      var showingSearch = el.querySelector('.fmp-status') && el.querySelector('.fmp-status').textContent.indexOf('Searching') !== -1;
      if (searching && !showingSearch) {
        refresh();
      } else if (!searching && showingSearch) {
        refresh();
      }
    }
    if (isFileManagerPage() && el && !isInDOM(el)) {
      inject();
    }
  }, 500);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  var origPushState = history.pushState;
  history.pushState = function () {
    origPushState.apply(this, arguments);
    setTimeout(init, 10);
  };

  var origReplaceState = history.replaceState;
  history.replaceState = function () {
    origReplaceState.apply(this, arguments);
    setTimeout(init, 10);
  };

  window.addEventListener('popstate', function () { setTimeout(init, 10); });
})();
