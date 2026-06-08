/* ============================================
   Namanhsuit Risk Report · Animation Controller
   ============================================ */
(() => {
  'use strict';

  // 1. Enable animation layer (fallback: content visible if JS fails)
  document.documentElement.classList.add('anim');

  // 2. Inject scroll progress bar + back-to-top button
  const progress = document.createElement('div');
  progress.className = 'progress';
  document.body.appendChild(progress);

  const topBtn = document.createElement('button');
  topBtn.className = 'scroll-top';
  topBtn.innerHTML = '↑';
  topBtn.setAttribute('aria-label', 'Cuộn lên đầu trang');
  topBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(topBtn);

  // 3. Scroll handler — progress + back-to-top
  let ticking = false;
  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? window.scrollY / max : 0;
        progress.style.transform = `scaleX(${pct})`;
        topBtn.classList.toggle('show', window.scrollY > 400);
        ticking = false;
      });
      ticking = true;
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  // 4. IntersectionObserver — generic reveal on enter view
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -60px 0px' });

  // 5. Decorate everything that should animate
  const decorate = () => {
    // generic reveal targets
    const selectors = [
      '.gauge-card',
      '.chart-card',
      '.scorebar',
      '.kpi-strip',
      '.metric-grid',
      '.dual-col',
      '.qtable',
      '.bottom',
      '.sec-h',
      '.panel',
      '.split-2 .panel',
      '.page2-head'
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        // skip the hero items — they have CSS-only entrance
        const inHero = el.matches('.hero > *');
        if (!inHero) io.observe(el);
      });
    });

    // Score-bar widths → CSS variable, so we can animate via class swap
    document.querySelectorAll('.sb-fill').forEach(el => {
      const style = el.getAttribute('style') || '';
      const m = style.match(/width\s*:\s*([\d.]+%)/);
      if (m) {
        el.style.setProperty('--w', m[1]);
        el.style.removeProperty('width');
      }
    });

    // Gauge needle: read existing rotate(...) angle, store as --gauge-deg
    document.querySelectorAll('.gauge-svg g[transform*="rotate"]').forEach(g => {
      const t = g.getAttribute('transform') || '';
      const m = t.match(/rotate\(([-\d.]+)\s/);
      if (m) {
        g.classList.add('gauge-needle');
        g.style.setProperty('--gauge-deg', m[1] + 'deg');
        // remove the original transform so CSS controls it
        g.removeAttribute('transform');
        // observe the gauge-card so needle animates when it's in view
        const card = g.closest('.gauge-card');
        if (card) {
          const obs = new IntersectionObserver((es) => {
            es.forEach(e => {
              if (e.isIntersecting) {
                g.classList.add('in');
                obs.disconnect();
              }
            });
          }, { threshold: 0.3 });
          obs.observe(card);
        }
      }
    });

    // Chart line: tag the main price line + area + markers + labels + refs
    document.querySelectorAll('.chart-svg').forEach(svg => {
      const paths = svg.querySelectorAll('path');
      // Heuristic: first path = area (has fill=url), second = line (fill=none stroke)
      paths.forEach(p => {
        const fill = p.getAttribute('fill') || '';
        const stroke = p.getAttribute('stroke') || '';
        if (fill.startsWith('url') && (!stroke || stroke === 'none')) {
          p.classList.add('chart-area');
        } else if ((!fill || fill === 'none') && stroke) {
          p.classList.add('chart-line');
          // measure path for the dasharray
          try {
            const len = Math.ceil(p.getTotalLength());
            p.style.strokeDasharray = len;
            p.style.strokeDashoffset = len;
            // override after .in via inline + CSS
            p.dataset.len = len;
          } catch (e) { /* ignore */ }
        }
      });
      // Markers: all <circle> with stroke (not solid fill)
      const circles = svg.querySelectorAll('circle');
      circles.forEach((c, i) => {
        c.classList.add('chart-marker', 'm' + (i + 1));
      });
      // Marker rect labels + text labels (annotation boxes)
      const rects = svg.querySelectorAll('rect[stroke]');
      rects.forEach((r, i) => r.classList.add('chart-label', 'm' + (i + 1)));
      const annotTexts = svg.querySelectorAll('text[font-weight="600"]');
      annotTexts.forEach((t, i) => t.classList.add('chart-label', 'm' + (i + 1)));
      // dashed reference lines
      svg.querySelectorAll('line[stroke-dasharray]').forEach(l => l.classList.add('chart-ref'));
    });

    // When .chart-card enters view, also drive the chart-line offset to 0 via inline style
    const chartCards = document.querySelectorAll('.chart-card');
    chartCards.forEach(card => {
      const obs = new IntersectionObserver((es) => {
        es.forEach(e => {
          if (e.isIntersecting) {
            card.classList.add('in');
            // animate line dashoffset to 0
            card.querySelectorAll('.chart-line').forEach(p => {
              setTimeout(() => { p.style.strokeDashoffset = '0'; }, 50);
            });
            obs.disconnect();
          }
        });
      }, { threshold: 0.2 });
      obs.observe(card);
    });
  };

  // 6. Number counter for the gauge score + price (subtle)
  const animateNumber = (el, target, opts = {}) => {
    const dur = opts.duration || 1400;
    const from = opts.from ?? 0;
    const fmt = opts.format || ((v) => Math.round(v).toString());
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (target - from) * eased;
      el.firstChild.nodeValue = fmt(v);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // Count up gauge score (first text node before <span class="of">)
  const countGauge = () => {
    document.querySelectorAll('.gauge-score').forEach(el => {
      const txt = (el.firstChild && el.firstChild.nodeValue || '').trim();
      const target = parseInt(txt, 10);
      if (!isNaN(target)) {
        el.firstChild.nodeValue = '0';
        const obs = new IntersectionObserver((es) => {
          es.forEach(e => {
            if (e.isIntersecting) {
              setTimeout(() => animateNumber(el, target, { duration: 1500 }), 400);
              obs.disconnect();
            }
          });
        }, { threshold: 0.3 });
        obs.observe(el);
      }
    });
  };

  // Count up final sb-score values in score breakdown
  const countScoreBars = () => {
    const scorebars = document.querySelectorAll('.scorebar');
    scorebars.forEach(sb => {
      const obs = new IntersectionObserver((es) => {
        es.forEach(e => {
          if (e.isIntersecting) {
            sb.querySelectorAll('.sb-score').forEach((el, i) => {
              const txt = (el.firstChild && el.firstChild.nodeValue || '').trim();
              const target = parseInt(txt, 10);
              if (!isNaN(target)) {
                el.firstChild.nodeValue = '0';
                setTimeout(() => animateNumber(el, target, { duration: 1200 }), 600 + i * 180);
              }
            });
            obs.disconnect();
          }
        });
      }, { threshold: 0.3 });
      obs.observe(sb);
    });
  };

  // 7. Init
  const init = () => {
    decorate();
    countGauge();
    countScoreBars();
    onScroll(); // initial state
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
