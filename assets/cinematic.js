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
  // On slower devices, finish using elapsed time rather than stretching the intro out.
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  const finishIntro = () => {
    gsap.set('.site-header .wordmark,.header-links > *,.hero-mask,.stage-scene-image,.hero-frame,.hero-animate,.stage-code,.stage-edition,.hero-footer > *', {
      clearProps: 'transform,opacity,visibility'
    });
  };
  intro
    .from('.site-header .wordmark', { y: -18, autoAlpha: 0, duration: .65 }, 0)
    .from('.header-links > *', { y: -14, autoAlpha: 0, duration: .55, stagger: .055 }, .08)
    .from('.hero-mask', { scale: .88, autoAlpha: 0, duration: 1.05, ease: 'power4.out' }, .05)
    .from('.stage-scene-image', { scale: 1.18, duration: 1.35, ease: 'power3.out' }, .05)
    .from('.hero-frame', { y: 28, scale: .94, autoAlpha: 0, duration: .85 }, .3)
    .from('.hero-animate', { y: 20, autoAlpha: 0, duration: .6, stagger: .07 }, .48)
    .from('.clapperboard', { y: 70, rotation: 5, autoAlpha: 0, duration: .9, ease: 'back.out(1.25)' }, .62)
    .from('.stage-code,.stage-edition', { autoAlpha: 0, duration: .65, stagger: .1 }, .9)
    .from('.hero-footer > *', { y: 12, autoAlpha: 0, duration: .55, stagger: .08 }, 1);
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

  // Very restrained depth on accurate pointers; touch devices simply get the composed scene.
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
  }

  // The app switches views without reloading. Settle the intro before hiding it,
  // then restore a visible, correctly measured hero when the visitor returns home.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('.start-rehearsal,#previewPlay')) {
      intro.progress(1);
      ambient.forEach(animation => animation.pause());
    }
    if (target.closest('#brandHome,#backHome,#homeNav')) {
      requestAnimationFrame(() => {
        intro.progress(1);
        gsap.set('.hero-copy', { clearProps: 'transform,opacity,visibility' });
        ScrollTrigger.refresh();
        if (!reduced.matches) ambient.forEach(animation => animation.play());
      });
    }
  });

  // Fonts change heading measurements, so refresh triggers once they are ready.
  if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

  reduced.addEventListener?.('change', () => {
    if (!reduced.matches) return;
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    gsap.globalTimeline.clear();
    gsap.set('.hero-mask,.stage-backdrop,.stage-scene-image,.hero-copy,.hero-frame,.hero-animate,.clapperboard,.cue-track,.section-heading > *,.three-steps article,.benefit-card,.closing-copy,.closing .btn,.site-footer .wrap > *', {
      clearProps: 'all'
    });
  });
})();
