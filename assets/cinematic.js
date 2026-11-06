/* Cinematic presentation only. Rehearsal, speech and scoring logic live in index.html. */
(() => {
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Keep the lightweight reading-progress indicator independent of GSAP.
  const progress = document.createElement('div');
  progress.className = 'scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  body.append(progress);

  let scrollQueued = false;
  function updateProgress() {
    const maximum = Math.max(1, root.scrollHeight - window.innerHeight);
    const y = window.scrollY || root.scrollTop;
    root.style.setProperty('--scroll-progress', `${Math.min(100, y / maximum * 100)}%`);
    root.style.setProperty('--header-glow', String(Math.min(1, y / 240)));
    scrollQueued = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(updateProgress);
    }
  }, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();

  // No hidden-by-default CSS: if the local libraries cannot load, the whole page remains usable.
  if (reduced.matches || !window.gsap || !window.ScrollTrigger) return;

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(window.SplitText);
  // On slower devices, finish using elapsed time rather than stretching the intro out.
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // Lenis shares GSAP's clock, keeping smooth scrolling and ScrollTrigger in sync.
  // Touch remains native; wheel users get the restrained smoothing.
  let lenis = null;
  const lenisRaf = time => lenis?.raf(time * 1000);
  if (window.Lenis) {
    lenis = new window.Lenis({
      autoRaf: false,
      duration: 1.05,
      easing: value => Math.min(1, 1.001 - Math.pow(2, -10 * value)),
      smoothWheel: true,
      wheelMultiplier: .9,
      syncTouch: false,
      touchMultiplier: 1,
      overscroll: false
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(lenisRaf);
    // Preserve native scrolling inside the rehearsal script and cue reader.
    document.querySelectorAll('#rehearsalTool textarea,#rehearsalTool .lineBox').forEach(element => {
      element.setAttribute('data-lenis-prevent', '');
    });
  }

  const scrollToTop = () => {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const refreshMotion = () => {
    lenis?.resize();
    ScrollTrigger.refresh();
  };

  // SplitText supplies accessible, masked word reveals without changing the copy.
  let headlineSplit = null;
  if (window.SplitText) {
    try {
      headlineSplit = new window.SplitText('#headline', {
        type: 'words',
        wordsClass: 'split-word',
        mask: 'words'
      });
    } catch {
      headlineSplit = null;
    }
  }

  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  const finishIntro = () => {
    gsap.set('.site-header .wordmark,.header-links > *,.hero-mask,.stage-scene-image,.hero-frame,.hero-animate,.split-word,.stage-code,.stage-edition,.hero-footer > *', {
      clearProps: 'transform,opacity,visibility'
    });
  };
  intro
    .from('.site-header .wordmark', { y: -18, autoAlpha: 0, duration: .65 }, 0)
    .from('.header-links > *', { y: -14, autoAlpha: 0, duration: .55, stagger: .055 }, .08)
    .from('.hero-mask', { scale: .88, autoAlpha: 0, duration: 1.05, ease: 'power4.out' }, .05)
    .from('.stage-scene-image', { scale: 1.18, duration: 1.35, ease: 'power3.out' }, .05)
    .from('.hero-frame', { y: 28, scale: .94, autoAlpha: 0, duration: .85 }, .3)
    .from('.hero-animate:not(#headline)', { y: 20, autoAlpha: 0, duration: .6, stagger: .07 }, .48)
    .from('.clapperboard', { y: 70, rotation: 5, autoAlpha: 0, duration: .9, ease: 'back.out(1.25)' }, .62)
    .from('.stage-code,.stage-edition', { autoAlpha: 0, duration: .65, stagger: .1 }, .9)
    .from('.hero-footer > *', { y: 12, autoAlpha: 0, duration: .55, stagger: .08 }, 1);

  if (headlineSplit) {
    intro.from(headlineSplit.words, {
      yPercent: 118,
      rotation: 2,
      duration: .85,
      stagger: .045,
      ease: 'power4.out'
    }, .52);
  } else {
    intro.from('#headline', { y: 24, autoAlpha: 0, duration: .75 }, .52);
  }

  // Content must never remain hidden if a background tab or slow GPU throttles rAF.
  const introSafety = window.setTimeout(() => intro.progress(1), 2400);
  intro.eventCallback('onComplete', () => {
    window.clearTimeout(introSafety);
    finishIntro();
  });

  // Quiet ambient movement keeps the stage feeling alive after the title has arrived.
  const ambient = [
    gsap.to('.clapperboard', {
      y: -8,
      rotation: -6,
      duration: 3.4,
      delay: 1.8,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    }),
    gsap.fromTo('.cue-track', { xPercent: 0 }, {
      xPercent: -50,
      duration: 30,
      repeat: -1,
      ease: 'none'
    }),
    gsap.fromTo('.scroll-line', { '--scroll-line-x': '-100%' }, {
      '--scroll-line-x': '100%',
      duration: 2,
      repeat: -1,
      repeatDelay: .45,
      ease: 'power1.inOut'
    }),
    gsap.to('.aurora-field', {
      rotation: 7,
      xPercent: 3,
      yPercent: -2,
      scale: 1.08,
      duration: 14,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    })
  ];

  // Scroll-linked movement is applied to parents so pointer parallax can use nested layers.
  gsap.to('.stage-backdrop', {
    yPercent: 12,
    scale: 1.06,
    ease: 'none',
    scrollTrigger: {
      trigger: '.landing-hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 1
    }
  });
  gsap.to('.hero-copy', {
    yPercent: -5,
    autoAlpha: .32,
    ease: 'none',
    scrollTrigger: {
      trigger: '.landing-hero',
      start: '35% top',
      end: 'bottom top',
      scrub: 1
    }
  });

  // Headings arrive as editorial blocks; cards lift and unfold in small groups.
  gsap.utils.toArray('.section-heading > div,.section-heading > p,.closing-copy,.closing .btn').forEach(element => {
    gsap.from(element, {
      y: 42,
      autoAlpha: 0,
      duration: .9,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: element,
        start: 'top 88%',
        toggleActions: 'play none none none',
        // A fast scrollbar drag must not skip an intro and leave a blank section.
        onLeave: self => self.animation?.progress(1)
      }
    });
  });
  ScrollTrigger.batch('.three-steps article,.benefit-card', {
    start: 'top 88%',
    onEnter: batch => gsap.from(batch, {
      y: 48,
      rotateX: -8,
      autoAlpha: 0,
      transformOrigin: '50% 0%',
      duration: .85,
      stagger: .11,
      ease: 'power3.out',
      clearProps: 'transform',
      overwrite: true
    }),
    onLeave: batch => gsap.set(batch, { y: 0, rotateX: 0, autoAlpha: 1, clearProps: 'transform' })
  });

  // React Bits-style depth, magnetic buttons and spotlight cards for accurate pointers.
  if (window.matchMedia('(pointer: fine)').matches) {
    const stage = document.querySelector('.hero-stage');
    const imageX = gsap.quickTo('.stage-scene-image', 'x', { duration: 1.1, ease: 'power3.out' });
    const imageY = gsap.quickTo('.stage-scene-image', 'y', { duration: 1.1, ease: 'power3.out' });
    const frameX = gsap.quickTo('.hero-frame', 'x', { duration: 1.25, ease: 'power3.out' });
    stage.addEventListener('pointermove', event => {
      const bounds = stage.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - .5;
      const y = (event.clientY - bounds.top) / bounds.height - .5;
      imageX(x * -18);
      imageY(y * -12);
      frameX(x * 9);
    });
    stage.addEventListener('pointerleave', () => {
      imageX(0);
      imageY(0);
      frameX(0);
    });

    document.querySelectorAll('.landing-hero .btn,.closing .btn').forEach(button => {
      const buttonX = gsap.quickTo(button, 'x', { duration: .45, ease: 'power3.out' });
      const buttonY = gsap.quickTo(button, 'y', { duration: .45, ease: 'power3.out' });
      button.addEventListener('pointermove', event => {
        const bounds = button.getBoundingClientRect();
        buttonX((event.clientX - bounds.left - bounds.width / 2) * .12);
        buttonY((event.clientY - bounds.top - bounds.height / 2) * .16);
      });
      button.addEventListener('pointerleave', () => {
        buttonX(0);
        buttonY(0);
      });
    });

    document.querySelectorAll('.benefit-card').forEach(card => {
      card.addEventListener('pointermove', event => {
        const bounds = card.getBoundingClientRect();
        card.style.setProperty('--spotlight-x', `${event.clientX - bounds.left}px`);
        card.style.setProperty('--spotlight-y', `${event.clientY - bounds.top}px`);
      });
    });
  }

  // The app switches views without reloading. Settle the intro before hiding it,
  // then restore a visible, correctly measured hero when the visitor returns home.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest('.start-rehearsal,#previewPlay')) {
      intro.progress(1);
      ambient.forEach(animation => animation.pause());
      requestAnimationFrame(() => {
        scrollToTop();
        lenis?.resize();
      });
    }

    if (target.closest('#brandHome,#backHome,#homeNav')) {
      requestAnimationFrame(() => {
        intro.progress(1);
        scrollToTop();
        gsap.set('.hero-copy', { clearProps: 'transform,opacity,visibility' });
        refreshMotion();
        if (!reduced.matches) ambient.forEach(animation => animation.play());
      });
    }

    const anchor = target.closest('a[href^="#"]:not(#brandHome):not(#homeNav):not(.sr-only)');
    if (anchor && !body.classList.contains('rehearsal-open')) {
      const hash = anchor.getAttribute('href');
      const destination = hash && hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
      if (destination) {
        event.preventDefault();
        if (lenis) {
          // Lenis already accounts for the document's scroll padding and margins.
          lenis.scrollTo(destination, { duration: 1.15 });
        } else {
          destination.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  });

  // Fonts change heading measurements, so refresh triggers once they are ready.
  if (document.fonts?.ready) document.fonts.ready.then(refreshMotion);
  window.addEventListener('load', refreshMotion, { once: true });

  reduced.addEventListener?.('change', () => {
    if (!reduced.matches) return;
    if (lenis) {
      lenis.destroy();
      lenis = null;
    }
    gsap.ticker.remove(lenisRaf);
    headlineSplit?.revert();
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    gsap.globalTimeline.clear();
    gsap.set('.hero-mask,.stage-backdrop,.stage-scene-image,.hero-copy,.hero-frame,.hero-animate,.split-word,.clapperboard,.aurora-field,.cue-track,.landing-hero .btn,.section-heading > *,.three-steps article,.benefit-card,.closing-copy,.closing .btn,.site-footer .wrap > *', {
      clearProps: 'all'
    });
  });
})();
