(function () {
  'use strict';

  var supported = typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal === 'function';
  var viewer, stage, photo, message, title, counter, caption, previous, next, thumbnails, zoom, fullscreen, close;
  var album = [], index = 0, token = 0, dimensions = null, savedStyle, scrollPosition, opener;
  var ownsFullscreen = false, fullscreenPending = false, exitPending = false, relayering = false, sessionOpen = false;
  var lastWheel = 0, suppressClickUntil = 0, touchStart, thumbnailObserver;
  var imageCache = new Map(), imageCacheLimit = 12, thumbnailAlbum = [];
  var requestedImages = new Set(), backgroundLimit = 2;

  function element(tag, name, text) {
    var node = document.createElement(tag);
    node.className = name;
    if (text) node.textContent = text;
    return node;
  }

  function button(name, text, action) {
    var node = element('button', 'photo-viewer__button photo-viewer__' + name, text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  function imageURL(value) {
    if (!value || !String(value).trim()) return '';
    try {
      var url = new URL(value, document.baseURI);
      return /^(https?:|blob:)$/.test(url.protocol) || /^data:image\//i.test(value) ? url.href : '';
    } catch (error) { return ''; }
  }

  function usable(item) {
    return item.valid && !item.image.hidden && item.image.dataset.failed !== 'true' && !(item.image.complete && item.image.naturalWidth === 0);
  }

  function setZoom(enabled) {
    viewer.classList.toggle('photo-viewer--zoomed', enabled);
    photo.style.width = enabled && dimensions ? dimensions.width + 'px' : '';
    photo.style.height = enabled && dimensions ? dimensions.height + 'px' : '';
    zoom.textContent = enabled ? '适应屏幕' : '放大';
    zoom.setAttribute('aria-pressed', String(enabled));
    if (enabled) window.requestAnimationFrame(function () {
      if (!viewer.open || !viewer.classList.contains('photo-viewer--zoomed')) return;
      stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
      stage.scrollTop = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
    });
    else { stage.scrollLeft = 0; stage.scrollTop = 0; }
  }

  function updateZoom() {
    zoom.disabled = !dimensions || (!viewer.classList.contains('photo-viewer--zoomed') && dimensions.width <= stage.clientWidth && dimensions.height <= stage.clientHeight);
    if (zoom.disabled && viewer.classList.contains('photo-viewer--zoomed')) setZoom(false);
  }

  function syncFullscreen() {
    var active = document.fullscreenElement;
    if (active !== document.documentElement) ownsFullscreen = false;
    fullscreen.textContent = ownsFullscreen ? '退出全屏' : '全屏';
    fullscreen.setAttribute('aria-pressed', String(ownsFullscreen));
    fullscreen.disabled = fullscreenPending || exitPending || Boolean(active && !ownsFullscreen);
  }

  function leaveFullscreen() {
    if (exitPending || !ownsFullscreen || document.fullscreenElement !== document.documentElement || typeof document.exitFullscreen !== 'function') return;
    exitPending = true;
    syncFullscreen();
    var request;
    try { request = document.exitFullscreen(); }
    catch (error) { exitPending = false; syncFullscreen(); return; }
    Promise.resolve(request).catch(function () {}).finally(function () {
      exitPending = false;
      syncFullscreen();
    });
  }

  function finishClose() {
    if (!sessionOpen) return;
    sessionOpen = false;
    ++token;
    viewer.hidden = true;
    setZoom(false);
    if (thumbnailObserver) thumbnailObserver.disconnect();
    leaveFullscreen();
    if (savedStyle === null) document.body.removeAttribute('style');
    else document.body.setAttribute('style', savedStyle);
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    var restore = scrollPosition;
    window.requestAnimationFrame(function () { if (!viewer.open) window.scrollTo(restore.x, restore.y); });
  }

  function restoreDialogLayer() {
    var position = { x: stage.scrollLeft, y: stage.scrollTop, tx: thumbnails.scrollLeft, ty: thumbnails.scrollTop };
    // Fullscreen puts html last in the top layer; reinsert the modal above it.
    relayering = true;
    try { viewer.close(); viewer.showModal(); }
    catch (error) { finishClose(); }
    finally { relayering = false; }
    if (!viewer.open) return;
    stage.scrollLeft = position.x;
    stage.scrollTop = position.y;
    thumbnails.scrollLeft = position.tx;
    thumbnails.scrollTop = position.ty;
  }

  function toggleFullscreen() {
    if (fullscreenPending || exitPending) return;
    if (ownsFullscreen) { leaveFullscreen(); return; }
    if (document.fullscreenElement) return;
    var focused = document.activeElement;
    function restoreFocus() {
      if (viewer.open && focused && viewer.contains(focused)) focused.focus({ preventScroll: true });
    }
    fullscreenPending = true;
    syncFullscreen();
    var request;
    try { request = document.documentElement.requestFullscreen(); }
    catch (error) { fullscreenPending = false; syncFullscreen(); restoreFocus(); return; }
    Promise.resolve(request).then(function () {
      ownsFullscreen = document.fullscreenElement === document.documentElement;
      if (!viewer.open) leaveFullscreen();
      else if (ownsFullscreen) restoreDialogLayer();
    }).catch(function () {}).finally(function () {
      fullscreenPending = false;
      syncFullscreen();
      restoreFocus();
    });
  }

  function trimImageMemory(source) {
    imageCache.forEach(function (entry, url) {
      if (imageCache.size > imageCacheLimit && entry.state !== 'loading' && entry.image !== photo && url !== source) imageCache.delete(url);
    });
  }

  function cachedImage(source, priority) {
    var cached = imageCache.get(source);
    if (cached) {
      // Keep the most recently viewed images, including loads still in flight.
      imageCache.delete(source);
      imageCache.set(source, cached);
      cached.image.fetchPriority = priority;
      return cached;
    }
    var image = new Image(), resolveReady;
    image.className = 'photo-viewer__image';
    image.draggable = false;
    image.decoding = 'async';
    image.fetchPriority = priority;
    image.hidden = true;
    cached = { image: image, state: 'loading' };
    cached.ready = new Promise(function (resolve) { resolveReady = resolve; });
    imageCache.set(source, cached);
    requestedImages.add(source);
    function finish(success) {
      if (cached.state !== 'loading') return;
      success = success && image.naturalWidth > 0;
      cached.state = success ? 'loaded' : 'failed';
      image.onload = null;
      image.onerror = null;
      if (!success && imageCache.get(source) === cached) imageCache.delete(source);
      trimImageMemory(source);
      resolveReady(success);
      Promise.resolve().then(preloadImages);
    }
    image.onload = function () { finish(true); };
    image.onerror = function () { finish(false); };
    image.src = source;
    if (image.complete) finish(image.naturalWidth > 0);
    // Keep active requests so selecting a background photo reuses its download.
    trimImageMemory(source);
    return cached;
  }

  function preloadImages() {
    if (!sessionOpen || !viewer.open) return;
    var backgroundLoads = 0;
    imageCache.forEach(function (entry) {
      if (entry.state === 'loading' && entry.image !== photo) backgroundLoads++;
    });
    for (var offset = 1; offset < album.length && backgroundLoads < backgroundLimit; offset++) {
      var item = album[(index + offset) % album.length];
      if (!usable(item) || requestedImages.has(item.source)) continue;
      if (cachedImage(item.source, 'low').state === 'loading') backgroundLoads++;
    }
  }

  function showImage(position) {
    if (position < 0 || position >= album.length) return;
    index = position;
    var item = album[index], request = ++token;
    dimensions = null;
    setZoom(false);
    updateZoom();
    photo.hidden = true;
    imageCache.forEach(function (entry) { entry.image.fetchPriority = 'low'; });
    var cached = cachedImage(item.source, 'high');
    if (photo !== cached.image) {
      photo.replaceWith(cached.image);
      photo = cached.image;
    }
    photo.alt = item.alt;
    photo.style.width = '';
    photo.style.height = '';
    photo.hidden = true;
    message.replaceChildren(document.createTextNode('照片加载中…'));
    message.hidden = false;
    stage.setAttribute('aria-busy', 'true');
    counter.textContent = (index + 1) + ' / ' + album.length;
    caption.textContent = item.caption;
    previous.disabled = index === 0;
    next.disabled = index === album.length - 1;
    Array.from(thumbnails.children).forEach(function (thumb, number) {
      if (number === index) thumb.setAttribute('aria-current', 'true');
      else thumb.removeAttribute('aria-current');
    });
    window.requestAnimationFrame(function () {
      if (viewer.open && request === token) thumbnails.children[index].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    function finish(success) {
      if (request !== token || !viewer.open) return;
      stage.setAttribute('aria-busy', 'false');
      if (success) {
        dimensions = { width: photo.naturalWidth, height: photo.naturalHeight };
        photo.hidden = false;
        message.hidden = true;
        updateZoom();
      } else {
        var retry = button('retry', '重试', function () { showImage(index); });
        var link = element('a', '', '打开原图');
        link.href = item.source;
        link.target = '_blank';
        link.rel = 'noopener';
        message.replaceChildren(document.createTextNode('这张照片未能加载。'), retry, link);
      }
    }
    if (cached.state === 'loaded') finish(true);
    else if (cached.state === 'failed') finish(false);
    else cached.ready.then(finish);
    // Each original completes independently; background work never gates display.
    preloadImages();
  }

  function buildViewer() {
    viewer = element('dialog', 'photo-viewer');
    viewer.hidden = true;
    viewer.setAttribute('aria-labelledby', 'photo-viewer-title');
    var header = element('header', 'photo-viewer__header');
    title = element('h2', 'photo-viewer__title');
    title.id = 'photo-viewer-title';
    counter = element('span', 'photo-viewer__counter');
    counter.setAttribute('role', 'status');
    counter.setAttribute('aria-live', 'polite');
    counter.setAttribute('aria-atomic', 'true');
    zoom = button('zoom', '放大', function () { setZoom(!viewer.classList.contains('photo-viewer--zoomed')); });
    fullscreen = button('fullscreen', '全屏', toggleFullscreen);
    fullscreen.hidden = typeof document.documentElement.requestFullscreen !== 'function';
    close = button('close', '关闭', function () { viewer.close(); });
    close.autofocus = true;
    header.append(title, counter, zoom, fullscreen, close);
    var body = element('div', 'photo-viewer__body');
    previous = button('previous', '‹', function () { showImage(index - 1); });
    previous.setAttribute('aria-label', '上一张照片');
    next = button('next', '›', function () { showImage(index + 1); });
    next.setAttribute('aria-label', '下一张照片');
    stage = element('div', 'photo-viewer__stage');
    photo = element('img', 'photo-viewer__image');
    photo.draggable = false;
    message = element('p', 'photo-viewer__message');
    message.setAttribute('role', 'status');
    stage.append(photo, message);
    thumbnails = element('nav', 'photo-viewer__thumbnails');
    thumbnails.setAttribute('aria-label', '照片缩略图');
    body.append(previous, stage, next, thumbnails);
    var footer = element('footer', 'photo-viewer__footer');
    caption = element('p', 'photo-viewer__caption');
    var hint = element('p', 'photo-viewer__hint', window.matchMedia('(pointer: coarse)').matches ? '左右滑动切换 · 点按图片关闭' : '方向键切换 · Esc 关闭');
    footer.append(caption, hint);
    viewer.append(header, body, footer);
    document.body.appendChild(viewer);
    viewer.addEventListener('close', function () {
      // close is queued, so ignore the internal close/showModal round trip.
      if (!relayering && !viewer.open) finishClose();
    });
    viewer.addEventListener('keydown', function (event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      var position = { ArrowLeft: index - 1, ArrowUp: index - 1, ArrowRight: index + 1, ArrowDown: index + 1, Home: 0, End: album.length - 1 }[event.key];
      if (position !== undefined) { event.preventDefault(); showImage(position); }
    });
    viewer.addEventListener('click', function (event) {
      if (Date.now() < suppressClickUntil) return;
      if (event.target === viewer || event.target === stage || (event.target === photo && !viewer.classList.contains('photo-viewer--zoomed'))) viewer.close();
    });
    stage.addEventListener('wheel', function (event) {
      if (viewer.classList.contains('photo-viewer--zoomed')) return;
      var delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (Math.abs(delta) < 4) return;
      event.preventDefault();
      if (Date.now() - lastWheel < 200) return;
      lastWheel = Date.now();
      showImage(index + (delta > 0 ? 1 : -1));
    }, { passive: false });
    stage.addEventListener('touchstart', function (event) {
      touchStart = !viewer.classList.contains('photo-viewer--zoomed') && event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    }, { passive: true });
    stage.addEventListener('touchmove', function (event) {
      if (!touchStart || event.touches.length !== 1) { touchStart = null; return; }
      var dx = event.touches[0].clientX - touchStart.x, dy = event.touches[0].clientY - touchStart.y;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) event.preventDefault();
    }, { passive: false });
    stage.addEventListener('touchend', function (event) {
      if (!touchStart || !event.changedTouches.length) return;
      var dx = event.changedTouches[0].clientX - touchStart.x, dy = event.changedTouches[0].clientY - touchStart.y;
      touchStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 10) suppressClickUntil = Date.now() + 500;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.25) showImage(index + (dx < 0 ? 1 : -1));
    }, { passive: true });
    stage.addEventListener('touchcancel', function () { touchStart = null; }, { passive: true });
    document.addEventListener('fullscreenchange', function () { syncFullscreen(); if (viewer.open) updateZoom(); });
    window.addEventListener('resize', function () { if (viewer.open) updateZoom(); });
  }

  function openAlbum(items, selected, control, heading) {
    if (!supported) return false;
    if (!viewer) buildViewer();
    var available = items.filter(usable), selectedIndex = available.indexOf(selected);
    if (selectedIndex < 0) return false;
    album = available;
    title.textContent = heading;
    if (thumbnailObserver) thumbnailObserver.disconnect();
    var observer = typeof window.IntersectionObserver === 'function' ? new window.IntersectionObserver(function (entries) {
      if (observer !== thumbnailObserver) return;
      entries.forEach(function (entry) {
        if (!viewer.open || entry.target.parentNode !== thumbnails || !entry.isIntersecting) return;
        var preview = entry.target.children[0];
        if (!preview.hasAttribute('src')) preview.src = preview.dataset.src;
        observer.unobserve(entry.target);
      });
    }, { root: thumbnails, rootMargin: '100px' }) : null;
    thumbnailObserver = observer;
    var sameAlbum = album.length === thumbnailAlbum.length && album.every(function (item, number) { return item === thumbnailAlbum[number]; });
    if (!sameAlbum) {
      thumbnails.replaceChildren();
      album.forEach(function (item, number) {
        var thumb = button('thumbnail', '', function () { showImage(number); });
        thumb.setAttribute('aria-label', '查看第 ' + (number + 1) + ' 张照片' + (item.alt ? '：' + item.alt : ''));
        var preview = element('img', '');
        preview.alt = '';
        preview.loading = 'lazy';
        preview.decoding = 'async';
        preview.fetchPriority = 'low';
        preview.dataset.src = item.thumbnail;
        preview.onerror = function () { preview.removeAttribute('src'); };
        if (!thumbnailObserver) preview.src = item.thumbnail;
        thumb.appendChild(preview);
        thumbnails.appendChild(thumb);
      });
      thumbnailAlbum = album.slice();
    }
    Array.from(thumbnails.children).forEach(function (thumb) {
      var preview = thumb.children[0];
      if (preview.hasAttribute('src')) return;
      if (thumbnailObserver) thumbnailObserver.observe(thumb);
      else preview.src = preview.dataset.src;
    });
    opener = control;
    savedStyle = document.body.getAttribute('style');
    scrollPosition = { x: window.scrollX, y: window.scrollY };
    viewer.hidden = false;
    try { viewer.showModal(); }
    catch (error) { viewer.hidden = true; if (thumbnailObserver) thumbnailObserver.disconnect(); return false; }
    sessionOpen = true;
    document.body.style.overflow = 'hidden';
    lastWheel = 0;
    suppressClickUntil = 0;
    syncFullscreen();
    showImage(selectedIndex);
    return true;
  }

  document.querySelectorAll('[data-post-body]').forEach(function (body) {
    if (body.dataset.photoGalleryReady) return;
    body.dataset.photoGalleryReady = 'true';
    var items = [];
    var headingNode = body.closest('article') && body.closest('article').querySelector('h1');
    var heading = headingNode ? headingNode.textContent.trim() : document.title;
    body.querySelectorAll('img').forEach(function (image) {
      if (image.closest('[data-gallery-ignore], .emoji, .gemoji, .twemoji, .emoticon') || image.hidden || image.dataset.failed === 'true' || (image.complete && !image.naturalWidth)) return;
      var source = imageURL(image.currentSrc || image.getAttribute('src') || '');
      if (!source || /(?:\/twemoji\/|\/emoji\/)/i.test(source)) return;
      var link = image.closest('a'), generated = !link;
      if (link) {
        var target = imageURL(link.getAttribute('href') || '');
        if (!target || link.hasAttribute('download') || link.hasAttribute('onclick') || (target !== source && !/\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:[?#]|$)/i.test(target))) return;
        source = target;
      } else {
        link = element('a', 'photo-link');
        link.href = source;
        var picture = image.closest('picture') || image;
        picture.parentNode.insertBefore(link, picture);
        link.appendChild(picture);
      }
      var figure = image.closest('figure'), figcaption = figure && figure.querySelector('figcaption');
      var alt = image.getAttribute('alt') || '';
      var description = figcaption ? Array.from(figcaption.childNodes).map(function (node) { return node.textContent.trim(); }).filter(Boolean).join(' ') : alt;
      var item = { image: image, link: link, source: source, thumbnail: imageURL(image.dataset.galleryThumb || image.currentSrc || image.getAttribute('src')) || source, alt: alt, caption: description, valid: true };
      image.classList.add('photo-zoomable');
      if (!link.hasAttribute('aria-label')) link.setAttribute('aria-label', alt ? '查看照片：' + alt : '查看第 ' + (items.length + 1) + ' 张照片');
      link.addEventListener('click', function (event) {
        if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !usable(item)) return;
        if (openAlbum(items, item, link, heading)) event.preventDefault();
      });
      image.addEventListener('error', function () {
        item.valid = false;
        image.classList.remove('photo-zoomable');
        if (generated) { link.removeAttribute('href'); link.removeAttribute('aria-label'); link.classList.remove('photo-link'); }
      }, { once: true });
      items.push(item);
    });
  });
}());
