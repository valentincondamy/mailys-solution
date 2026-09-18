// Waven-inspired two-pass mask, using the overlapping squares of the brand.
const canvas = document.querySelector('#transition');
const ctx = canvas.getContext('2d');
const transitionLogo = new Image();
transitionLogo.src = 'outputs/assets/logo-mailys-original.png';
// The source PNG includes transparent padding around the mark. Keep the
// visible logo bounds so the wordmark is optically centered in the transition.
const logoCrop = { x: 157, y: 125, width: 1389, height: 387 };
let logoReady = transitionLogo.complete && transitionLogo.naturalWidth > 0;
let pendingTransition = null;
transitionLogo.addEventListener('load', () => {
  logoReady = true;
  if (pendingTransition) {
    const next = pendingTransition;
    pendingTransition = null;
    beginTransition(next.index, next.options);
  }
});
const intro = document.querySelector('#intro');
const destination = document.querySelector('#destination');
const siteHeader = document.querySelector('#site-header');
const mobileNavToggle = document.querySelector('#mobile-nav-toggle');
const headerLinks = [...document.querySelectorAll('#primary-nav a')];
const play = document.querySelector('#play');
const enter = document.querySelector('#enter');
const statusText = document.querySelector('#transition-status');
const screens = [...document.querySelectorAll('.screen')];
const screenLinks = [...document.querySelectorAll('a[href^="#"]')];
const previousButton = document.querySelector('#previous-screen');
const nextButton = document.querySelector('#next-screen');
const screenCount = document.querySelector('#screen-count');
const screenLabel = document.querySelector('#screen-label');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const SWEEP = 480;
const GROW = 270;
const REVEAL_SWEEP = 560;
const SHRINK = 340;
const PAIR_OFFSET = 45;
const COVERED = SWEEP + GROW;
const HOLD = 320;
const DURATION = COVERED + HOLD + REVEAL_SWEEP + SHRINK + PAIR_OFFSET;
let width = 0;
let height = 0;
let tiles = [];
let running = false;
let switched = false;
let raf = 0;
let autoTimer = 0;
let hasPlayed = false;
let wall;
let elapsed = 0;
let lastFrame = null;
let leadRemaining = 0;
let currentScreen = 0;
let targetScreen = 0;
let focusAfterTransition = false;
let pendingRoute = null;

function screenFromHash(hash) {
  const index = screens.findIndex(screen => `#${screen.id}` === hash);
  return index < 0 ? 0 : index;
}
targetScreen = screenFromHash(window.location.hash);

function updateControls() {
  previousButton.disabled = running || currentScreen === 0;
  nextButton.disabled = running || currentScreen === screens.length - 1;
  screenCount.textContent = `${String(currentScreen + 1).padStart(2, '0')} / ${String(screens.length).padStart(2, '0')}`;
  screenCount.setAttribute('aria-label', `Écran ${currentScreen + 1} sur ${screens.length}`);
  screenLabel.textContent = screens[currentScreen].dataset.title;
  for (const link of headerLinks) {
    if (link.getAttribute('href') === `#${screens[currentScreen].id}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function closeMobileNav() {
  siteHeader.classList.remove('nav-open');
  mobileNavToggle.setAttribute('aria-expanded', 'false');
}

function activateScreen(index) {
  currentScreen = index;
  screens.forEach((screen, i) => { screen.hidden = i !== index; });
  updateControls();
}

function navigateTo(index, { history = true, focus = true } = {}) {
  if (index < 0 || index >= screens.length) return;
  if (running) {
    // Browser back/forward still wins if it happens during a wipe.
    if (!history) pendingRoute = index;
    return;
  }
  if (history && window.location.hash !== `#${screens[index].id}`) {
    window.history.pushState(null, '', `#${screens[index].id}`);
  }
  if (index === currentScreen && !destination.hidden) return;
  beginTransition(index, { focus });
}

const clamp = value => Math.max(0, Math.min(1, value));
// Zero velocity and acceleration at both ends, without bounce or overshoot.
const ease = value => { const t = clamp(value); return t * t * t * (t * (t * 6 - 15) + 10); };

function layout() {
  width = window.innerWidth;
  height = window.innerHeight;
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // One screen-wide gradient matching the logo, shared by every square.
  wall = ctx.createLinearGradient(0, 0, width, height);
  wall.addColorStop(0, '#FF6B6B');
  wall.addColorStop(.5, '#E11D2A');
  wall.addColorStop(1, '#F97316');
  const size = Math.round(Math.max(48, Math.min(100, width / (width < 600 ? 7.5 : 18))));
  const columns = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const offsetX = (width - columns * size) / 2;
  const offsetY = (height - rows * size) / 2;
  tiles = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const nx = col / Math.max(1, columns - 1);
      const ny = row / Math.max(1, rows - 1);
      // A gently bowed closing front, followed by a more open diagonal reveal.
      // Every square stays anchored: all the movement comes from its scale.
      const phase = nx * .90 + Math.pow((ny - .45) / .55, 2) * .10;
      const revealDelay = (nx * .94 + ny * .06) * REVEAL_SWEEP;
      const x = offsetX + col * size;
      const y = offsetY + row * size;
      tiles.push({ x, y, size, phase, revealDelay, side: 0, drawX: 0, drawY: 0 });
    }
  }
  const phases = tiles.map(tile => tile.phase);
  const first = Math.min(...phases);
  const span = Math.max(...phases) - first || 1;
  for (const tile of tiles) tile.delay = (tile.phase - first) / span * SWEEP;
  if (running && leadRemaining <= 0) draw(elapsed);
}

function showDestination() {
  intro.hidden = true;
  destination.hidden = false;
  activateScreen(targetScreen);
  switched = true;
}

function finish() {
  cancelAnimationFrame(raf);
  clearTimeout(autoTimer);
  showDestination();
  if (ctx) ctx.clearRect(0, 0, width, height);
  running = false;
  lastFrame = null;
  play.disabled = false;
  enter.disabled = false;
  destination.removeAttribute('aria-busy');
  updateControls();
  statusText.textContent = `${screens[currentScreen].dataset.title} — écran ${currentScreen + 1} sur ${screens.length}.`;
  if (focusAfterTransition) screens[currentScreen].focus({ preventScroll: true });
  if (pendingRoute !== null) {
    const index = pendingRoute;
    pendingRoute = null;
    navigateTo(index, { history: false });
  }
}

function drawTransitionLogo() {
  if (!transitionLogo.complete || transitionLogo.naturalWidth === 0) return;
  const logoWidth = Math.min(560, width * .68);
  const logoHeight = logoWidth * logoCrop.height / logoCrop.width;
  const x = (width - logoWidth) / 2;
  const y = (height - logoHeight) / 2;

  ctx.save();
  ctx.filter = 'brightness(0) invert(1)';
  // The logo is clipped by the exact same animated squares as the gradient.
  // It is therefore assembled and disassembled by the transition itself.
  for (const tile of tiles) {
    if (tile.side <= 0) continue;
    const tileRight = tile.drawX + tile.side;
    const tileBottom = tile.drawY + tile.side;
    if (tileRight <= x || tile.drawX >= x + logoWidth || tileBottom <= y || tile.drawY >= y + logoHeight) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(tile.drawX, tile.drawY, tile.side, tile.side);
    ctx.clip();
    ctx.globalAlpha = Math.min(1, tile.side / (tile.size * .38));
    ctx.drawImage(
      transitionLogo,
      logoCrop.x, logoCrop.y, logoCrop.width, logoCrop.height,
      x, y, logoWidth, logoHeight,
    );
    ctx.restore();
  }
  ctx.restore();
}

function drawTransitionLogoFull() {
  if (!transitionLogo.complete || transitionLogo.naturalWidth === 0) return;
  const logoWidth = Math.min(560, width * .68);
  const logoHeight = logoWidth * logoCrop.height / logoCrop.width;
  ctx.save();
  ctx.filter = 'brightness(0) invert(1)';
  ctx.globalAlpha = .96;
  ctx.drawImage(
    transitionLogo,
    logoCrop.x, logoCrop.y, logoCrop.width, logoCrop.height,
    (width - logoWidth) / 2, (height - logoHeight) / 2, logoWidth, logoHeight,
  );
  ctx.restore();
}

function draw(elapsed) {
  ctx.clearRect(0, 0, width, height);
  if (elapsed >= COVERED && elapsed <= COVERED + HOLD) {
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, width, height);
    drawTransitionLogoFull();
    return;
  }
  const opening = elapsed >= COVERED + HOLD;
  const localTime = opening ? elapsed - COVERED - HOLD : elapsed;
  for (const tile of tiles) {
    const delay = opening ? tile.revealDelay : tile.delay;
    const duration = opening ? SHRINK : GROW;
    const progress = ease((localTime - delay) / duration);
    const scale = opening ? 1 - progress : progress;
    const pairProgress = ease((localTime - delay + (opening ? -PAIR_OFFSET : PAIR_OFFSET)) / duration);
    const pairScale = opening ? 1 - pairProgress : pairProgress;
    const side = (tile.size + 1.5) * scale;
    const x = tile.x + (tile.size - side) / 2;
    const y = tile.y + (tile.size - side) / 2;
    tile.side = side;
    tile.drawX = x;
    tile.drawY = y;
    // The rear square anticipates the closure and follows the opening by 45ms.
    // Its outline vanishes before joining, preserving an entirely smooth surface.
    const backSide = (tile.size + 1.5) * pairScale;
    const outlineAlpha = .24 * (1 - ease((Math.max(scale, pairScale) - .45) / .35)) * ease(pairScale / .15);
    if (outlineAlpha > 0 && backSide > 2) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(225, 29, 42, ${outlineAlpha})`;
      ctx.strokeRect(tile.x + (tile.size - backSide) / 2 - backSide * .6, tile.y + (tile.size - backSide) / 2 - backSide * .6, backSide, backSide);
    }
  }
  ctx.fillStyle = wall;
  for (const tile of tiles) {
    if (tile.side > 0) ctx.fillRect(tile.drawX, tile.drawY, tile.side, tile.side);
  }
  drawTransitionLogo();
}

function frame(now) {
  if (!running) return;
  if (document.hidden) { lastFrame = null; return; }
  const delta = lastFrame === null ? 0 : Math.max(0, now - lastFrame);
  lastFrame = now;
  const lead = Math.min(leadRemaining, delta);
  leadRemaining -= lead;
  elapsed += delta - lead;
  if (leadRemaining > 0) {
    raf = requestAnimationFrame(frame);
    return;
  }
  // Switch content only when every tile completely covers the viewport.
  if (elapsed >= COVERED && !switched) showDestination();
  draw(elapsed);
  if (elapsed >= DURATION) finish();
  else raf = requestAnimationFrame(frame);
}

function beginTransition(index, { replay = false, focus = false } = {}) {
  if (!logoReady) {
    pendingTransition = { index, options: { replay, focus } };
    return;
  }
  if (running) return;
  clearTimeout(autoTimer);
  hasPlayed = true;
  targetScreen = index;
  focusAfterTransition = focus;
  running = true;
  switched = false;
  elapsed = 0;
  lastFrame = null;
  leadRemaining = replay ? 650 : 0;
  play.disabled = true;
  enter.disabled = true;
  destination.setAttribute('aria-busy', 'true');
  updateControls();
  statusText.textContent = '';
  if (reducedMotion.matches || !ctx) { finish(); return; }
  if (replay) {
    destination.hidden = true;
    intro.hidden = false;
  }
  raf = requestAnimationFrame(frame);
}

function start() {
  beginTransition(destination.hidden ? targetScreen : currentScreen, { replay: !destination.hidden });
}

function scheduleIntro() {
  clearTimeout(autoTimer);
  if (hasPlayed || document.hidden || reducedMotion.matches) return;
  autoTimer = setTimeout(start, 1100);
}

play.addEventListener('click', start);
enter.addEventListener('click', () => beginTransition(targetScreen, { focus: true }));
for (const link of screenLinks) {
  link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    event.preventDefault();
    if (headerLinks.includes(link)) closeMobileNav();
    const index = screenFromHash(link.getAttribute('href'));
    if (link.classList.contains('skip-link')) {
      hasPlayed = true;
      targetScreen = index;
      focusAfterTransition = true;
      pendingRoute = null;
      finish();
      return;
    }
    navigateTo(index);
  });
}
mobileNavToggle.addEventListener('click', () => {
  const open = !siteHeader.classList.contains('nav-open');
  siteHeader.classList.toggle('nav-open', open);
  mobileNavToggle.setAttribute('aria-expanded', String(open));
});
window.addEventListener('resize', () => { if (window.innerWidth > 760) closeMobileNav(); });
previousButton.addEventListener('click', () => navigateTo(currentScreen - 1));
nextButton.addEventListener('click', () => navigateTo(currentScreen + 1));
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (destination.hidden || running) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    navigateTo(currentScreen + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
window.addEventListener('popstate', () => navigateTo(screenFromHash(window.location.hash), { history: false }));
window.addEventListener('hashchange', () => navigateTo(screenFromHash(window.location.hash), { history: false }));
window.addEventListener('resize', layout);
reducedMotion.addEventListener('change', () => { if (running) finish(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearTimeout(autoTimer);
    cancelAnimationFrame(raf);
    lastFrame = null;
  } else if (running) {
    lastFrame = null;
    raf = requestAnimationFrame(frame);
  } else scheduleIntro();
});
layout();
activateScreen(targetScreen);
// Opening a shared section link goes straight to that screen, with no page scroll.
if (window.location.hash) { hasPlayed = true; finish(); }
window.addEventListener('load', scheduleIntro, { once: true });
if (document.readyState === 'complete') scheduleIntro();
