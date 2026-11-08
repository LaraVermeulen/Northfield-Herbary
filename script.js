/* ==========================================================
   Northfield Herbary – kleine animaties en de carrousel
   Alles werkt ook zonder dit script: dan staat de inhoud gewoon vast.
   ========================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function calm() { return reduceMotion.matches; }

  /* ---------- 1. In- en uitfaden bij het scrollen ----------
     Komt een element in beeld, dan fadet het in (na elkaar, 80 ms ertussen).
     Is het helemaal uit beeld, dan fadet het weer uit, klaar voor de volgende keer.
     Het verschil tussen "in" (12% zichtbaar) en "uit" (0%) voorkomt geflikker aan de rand. */
  var revealTargets = document.querySelectorAll('[data-reveal], .leaves');

  if (!('IntersectionObserver' in window)) {
    revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      var order = 0;
      entries.forEach(function (entry) {
        var el = entry.target;
        var shown = el.classList.contains('is-visible');
        var enterAt = el.classList.contains('leaves') ? 0.05 : 0.12;

        if (!shown && entry.intersectionRatio >= enterAt) {
          if (!el.classList.contains('leaves')) {
            el.style.setProperty('--stagger', Math.min(order, 5) * 80 + 'ms');
            order++;
          }
          el.classList.add('is-visible');
          if (el.classList.contains('tag-carousel')) nudgeTags();
        } else if (shown && !entry.isIntersecting) {
          el.classList.remove('is-visible');
        }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: [0, 0.05, 0.12] });

    revealTargets.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- 2. Carrousel met theelabels ---------- */
  var carousel = document.querySelector('.tag-carousel');
  var track = carousel && carousel.querySelector('.tag-carousel__track');
  var tags = track ? Array.prototype.slice.call(track.querySelectorAll('.tea-tag')) : [];
  var arrows = carousel ? carousel.querySelectorAll('.tag-carousel__btn') : [];
  var dots = carousel ? Array.prototype.slice.call(carousel.querySelectorAll('.tag-carousel__dot')) : [];
  var range = carousel && carousel.querySelector('.tag-carousel__range');

  function step() {
    var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return tags[0].offsetWidth + gap;
  }

  function scrollToTag(i) {
    var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    var left = track.scrollLeft + tags[i].getBoundingClientRect().left - track.getBoundingClientRect().left - pad;
    track.scrollTo({ left: left, behavior: calm() ? 'auto' : 'smooth' });
  }

  function updateCarousel() {
    var max = track.scrollWidth - track.clientWidth;
    var s = step();
    var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    var visibleCount = Math.max(1, Math.floor((track.clientWidth - 2 * pad + 4) / s + 0.05));
    var first = Math.round(track.scrollLeft / s);
    if (track.scrollLeft >= max - 2) first = tags.length - visibleCount;
    first = Math.max(0, Math.min(first, tags.length - visibleCount));
    var last = first + visibleCount - 1;

    dots.forEach(function (dot, i) {
      var on = i >= first && i <= last;
      dot.classList.toggle('is-active', on);
      dot.setAttribute('aria-current', on ? 'true' : 'false');
    });
    if (range) range.textContent = first === last ? String(first + 1) : (first + 1) + '–' + (last + 1);

    arrows[0].disabled = track.scrollLeft <= 2;
    arrows[1].disabled = track.scrollLeft >= max - 2;
    carousel.classList.toggle('is-scrolled', track.scrollLeft > 2);
    carousel.classList.toggle('at-end', track.scrollLeft >= max - 2);
  }

  /* ---- Het zwaaien: elk label is een slinger aan zijn touwtje ----
     Als de rij beweegt, blijft het label even achter en zwaait het licht uit.
     Een gedempte veer (ongeveer 0,9 zwaai per seconde), hoogstens 5 graden. */
  var swing = tags.map(function (_, i) { return { a: 0, v: 0, weight: 0.85 + (i % 3) * 0.12 }; });
  var K = 32;        // stijfheid
  var C = 2.1;       // demping: een paar zachte zwaaien, dan rust
  var MAX_A = 5;
  var running = false;
  var lastTime = 0;
  var lastScroll = 0;

  // amount in graden per seconde; only = index van één label (bij hover), anders alle labels
  function kick(amount, only) {
    if (calm()) return;
    swing.forEach(function (s, i) {
      if (only !== undefined && i !== only) return;
      s.v = Math.max(-45, Math.min(45, s.v + amount * s.weight));
    });
    if (!running) {
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    var dt = Math.min(0.032, (now - lastTime) / 1000);
    lastTime = now;
    var moving = false;
    swing.forEach(function (s, i) {
      var acc = -K * s.a - C * s.v;
      s.v += acc * dt;
      s.a += s.v * dt;
      s.a = Math.max(-MAX_A, Math.min(MAX_A, s.a));
      if (Math.abs(s.a) > 0.02 || Math.abs(s.v) > 0.05) moving = true;
      tags[i].style.setProperty('--swing', s.a.toFixed(3) + 'deg');
    });
    if (moving) {
      requestAnimationFrame(tick);
    } else {
      running = false;
      swing.forEach(function (s, i) { s.a = 0; s.v = 0; tags[i].style.setProperty('--swing', '0deg'); });
    }
  }

  // Een klein duwtje als de labels voor het eerst in beeld komen
  function nudgeTags() { setTimeout(function () { kick(14); }, 450); }

  if (track && tags.length) {
    lastScroll = track.scrollLeft;
    track.addEventListener('scroll', function () {
      var dx = track.scrollLeft - lastScroll;
      lastScroll = track.scrollLeft;
      // Rij schuift naar links → onderkant blijft achter → draait tegen de klok in
      kick(-dx * 0.07);
      updateCarousel();
    }, { passive: true });

    arrows.forEach(function (btn) {
      btn.addEventListener('click', function () {
        track.scrollBy({ left: step() * Number(btn.dataset.dir), behavior: calm() ? 'auto' : 'smooth' });
      });
    });
    // Hover: het label zwaait weg van de kant waar de muis binnenkomt, zoals een aangetikt label
    tags.forEach(function (tag, i) {
      tag.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = tag.getBoundingClientRect();
        var fromLeft = e.clientX < r.left + r.width / 2;
        kick(fromLeft ? -16 : 16, i);
      });
    });

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () { scrollToTag(Number(dot.dataset.index)); });
    });
    window.addEventListener('resize', updateCarousel);
    updateCarousel();
  }

  /* ---------- 2b. Hero-slider ----------
     Elke 5 seconden schuift de volgende foto in beeld. Na de derde komt de eerste
     weer van rechts (een kopie die meteen wordt ingewisseld), dus nooit terugspoelen.
     De slider pauzeert zolang je erover hovert, hem met het toetsenbord bedient,
     hem aanraakt, hij uit beeld is of het tabblad niet actief is; en hij wisselt
     niet vanzelf bij "minder beweging" (dan kies je zelf met de bolletjes of swipen). */
  (function heroSlider() {
    var slider = document.querySelector('.hero-slider');
    if (!slider) return;
    var heroTrack = slider.querySelector('.hero-slider__track');
    var slides = Array.prototype.slice.call(heroTrack.querySelectorAll('.hero-slider__slide'));
    var heroDots = Array.prototype.slice.call(slider.querySelectorAll('.hero-slider__dot'));
    var INTERVAL = 5000;
    var count = slides.length;

    // Kopie van de eerste foto achteraan, voor een naadloze lus
    var clone = slides[0].cloneNode(true);
    clone.removeAttribute('fetchpriority');
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('alt', '');
    clone.removeAttribute('aria-roledescription');
    clone.removeAttribute('aria-label');
    heroTrack.appendChild(clone);

    var userPaused = calm();   // bij "minder beweging" geen automatisch wisselen
    var hovering = false, focused = false, touching = false, inView = true;
    var timer = null, settleTimer = null;

    function width() { return heroTrack.clientWidth || 1; }
    function index() { return Math.round(heroTrack.scrollLeft / width()); }

    function goTo(i, smooth) {
      heroTrack.scrollTo({ left: i * width(), behavior: smooth && !calm() ? 'smooth' : 'auto' });
    }

    function setActive(i) {
      var real = i % count;
      heroDots.forEach(function (dot, d) {
        var on = d === real;
        dot.classList.toggle('is-active', on);
        dot.setAttribute('aria-current', on ? 'true' : 'false');
      });
    }

    function playing() {
      return !userPaused && !hovering && !focused && !touching && inView && !document.hidden;
    }

    function schedule() {
      clearTimeout(timer);
      var play = playing();
      if (play) timer = setTimeout(function () { goTo(index() + 1, true); }, INTERVAL);
    }

    // Als het scrollen tot rust komt: kopie inwisselen, stip bijwerken, timer herstarten
    function settled() {
      var i = index();
      if (i >= count) { goTo(0, false); i = 0; }
      setActive(i);
      schedule();
    }
    heroTrack.addEventListener('scroll', function () {
      setActive(index());
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settled, 140);
    }, { passive: true });

    heroDots.forEach(function (dot) {
      dot.addEventListener('click', function () { goTo(Number(dot.dataset.index), true); });
    });

    slider.addEventListener('mouseenter', function () { hovering = true; schedule(); });
    slider.addEventListener('mouseleave', function () { hovering = false; schedule(); });
    slider.addEventListener('focusin', function () { focused = true; schedule(); });
    slider.addEventListener('focusout', function () { focused = false; schedule(); });
    heroTrack.addEventListener('touchstart', function () { touching = true; schedule(); }, { passive: true });
    heroTrack.addEventListener('touchend', function () { touching = false; schedule(); }, { passive: true });
    document.addEventListener('visibilitychange', schedule);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        schedule();
      }, { threshold: 0.3 }).observe(slider);
    }

    // Slepen met de muis (touch en trackpad swipen al vanzelf)
    var drag = null;
    heroTrack.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: heroTrack.scrollLeft, start: index() };
      heroTrack.classList.add('is-dragging');
      heroTrack.setPointerCapture(e.pointerId);
    });
    heroTrack.addEventListener('pointermove', function (e) {
      if (!drag) return;
      heroTrack.scrollLeft = drag.left - (e.clientX - drag.x);
    });
    function endDrag(e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      var target = drag.start;
      if (dx < -40) target = drag.start + 1;      // genoeg naar links gesleept: volgende
      else if (dx > 40) target = drag.start - 1;  // naar rechts: vorige
      target = Math.max(0, Math.min(count, target));
      heroTrack.classList.remove('is-dragging');
      drag = null;
      goTo(target, true);
    }
    heroTrack.addEventListener('pointerup', endDrag);
    heroTrack.addEventListener('pointercancel', endDrag);

    window.addEventListener('resize', function () { goTo(index(), false); });

    setActive(0);
    schedule();
  })();

  /* ---------- 3. Blaadjes dwarrelen mee bij elke scroll ---------- */
  var leafGroups = Array.prototype.slice.call(document.querySelectorAll('.leaves'));
  var ticking = false;

  /* Dwarrelen: de positie van een blad hangt rechtstreeks af van de scrollpositie.
     Scrol je naar beneden, dan zakt het blad door zijn sectie (sneller dan de pagina
     het meeneemt); scrol je naar boven, dan dwarrelt het langs dezelfde weg terug omhoog.
     Onderweg zwiert het heen en weer zoals een vallend blad, en kantelt het licht
     in de richting waarin het zwiert. */
  function flutter(group, vh) {
    var r = group.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh + 100) return;
    var offset = (r.top + r.height / 2) - vh / 2;     // afstand tot het midden van het scherm
    group.querySelectorAll('.leaf').forEach(function (leaf, i) {
      var depth = 0.28 + (i % 3) * 0.08;              // elk blad valt op zijn eigen tempo
      var fall = -offset * depth;                      // + = lager in de sectie
      var phase = fall / (38 + (i % 2) * 14) + i * 1.7;
      var amp = 16 + (i % 3) * 6;                      // breedte van het zwieren in px
      var fx = Math.sin(phase) * amp;
      var tilt = Math.cos(phase) * (9 + (i % 2) * 4);  // kantelt mee met de zwierbeweging
      leaf.style.setProperty('--py', fall.toFixed(1) + 'px');
      leaf.style.setProperty('--fx', fx.toFixed(1) + 'px');
      leaf.style.setProperty('--tilt', tilt.toFixed(2) + 'deg');
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var vh = window.innerHeight;

      if (!calm()) {
        leafGroups.forEach(function (group) { flutter(group, vh); });
      }
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
})();
