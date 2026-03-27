// ============================================================
// engine.js — Asset loader, screen manager, audio, main loop
// ============================================================

const TactixEngine = (() => {

  // ── State ────────────────────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const uiLayer = document.getElementById('ui-layer');
  const loadingScreen = document.getElementById('loading-screen');
  const loadingBar = document.getElementById('loading-bar');
  const loadingLabel = document.getElementById('loading-label');

  const assets = {
    images: {},
    audio: {}
  };

  let currentScreen = null;
  let animFrameId = null;
  let lastTime = 0;

  // ── Asset manifest ───────────────────────────────────────
  const IMAGE_MANIFEST = [
    // Tiles
    { key: 'dirt_texture',  src: 'assets/tiles/dirt_texture.png' },
    { key: 'rock_texture',  src: 'assets/tiles/rock_texture.png' },
    { key: 'acid_texture',  src: 'assets/tiles/acid_texture.png' },
    { key: 'fire_texture',  src: 'assets/tiles/fire_texture.png' },
    // Sprites (full soldier for game board) — legacy fallbacks
    { key: 'azure_soldier_sprite',      src: 'assets/sprites/azure_soldier_sprite.png' },
    { key: 'phlox_soldier_sprite',      src: 'assets/sprites/phlox_soldier_sprite.png' },
    { key: 'vermillion_soldier_sprite', src: 'assets/sprites/vermillion_soldier_sprite.png' },
    { key: 'virent_soldier_sprite',     src: 'assets/sprites/virent_soldier_sprite.png' },
    { key: 'magma_soldier_sprite',      src: 'assets/sprites/magma_soldier_sprite.png' },
    // Per-unit sprites — Azure
    { key: 'azure_infantry_sprite',     src: 'assets/sprites/azure_infantry_sprite.png' },
    { key: 'azure_sniper_sprite',       src: 'assets/sprites/azure_sniper_sprite.png' },
    { key: 'azure_elite_sprite',        src: 'assets/sprites/azure_elite_sprite.png' },
    // Per-unit sprites — Phlox
    { key: 'phlox_infantry_sprite',       src: 'assets/sprites/phlox_infantry_sprite.png' },
    { key: 'phlox_sniper_sprite',         src: 'assets/sprites/phlox_sniper_sprite.png' },
    { key: 'phlox_shock_trooper_sprite',  src: 'assets/sprites/phlox_shock_trooper_sprite.png' },
    // Per-unit sprites — Vermillion
    { key: 'vermillion_infantry_sprite',  src: 'assets/sprites/vermillion_infantry_sprite.png' },
    { key: 'vermillion_sniper_sprite',    src: 'assets/sprites/vermillion_sniper_sprite.png' },
    { key: 'vermillion_grenadier_sprite', src: 'assets/sprites/vermillion_grenadier_sprite.png' },
    // Per-unit sprites — Virent
    { key: 'virent_slasher_sprite',       src: 'assets/sprites/virent_slasher_sprite.png' },
    { key: 'virent_assassin_sprite',      src: 'assets/sprites/virent_assassin_sprite.png' },
    { key: 'virent_acid_thrower_sprite',  src: 'assets/sprites/virent_acid_thrower_sprite.png' },
    // Per-unit sprites — Magma
    { key: 'magma_grunt_sprite',          src: 'assets/sprites/magma_grunt_sprite.png' },
    { key: 'magma_sparkshooter_sprite',   src: 'assets/sprites/magma_sparkshooter_sprite.png' },
    { key: 'magma_flame_thrower_sprite',  src: 'assets/sprites/magma_flame_thrower_sprite.png' },
    // Portraits (for squad builder / team select)
    { key: 'azure-soldier',     src: 'assets/soldiers/azure-soldier.png' },
    { key: 'phlox-soldier',     src: 'assets/soldiers/phlox-soldier.png' },
    { key: 'vermillion-soldier',src: 'assets/soldiers/vermillion-soldier.png' },
    { key: 'virent-soldier',    src: 'assets/soldiers/virent-soldier.png' },
    { key: 'magma_soldier',     src: 'assets/soldiers/magma_soldier.png' },
    // UI icons
    { key: 'melee_icon',              src: 'assets/icons/melee_icon.png' },
    { key: 'capture_the_flag_icon',   src: 'assets/icons/capture_the_flag_icon.png' },
    { key: 'infantry_icon',           src: 'assets/icons/infantry_icon.png' },
    { key: 'sniper_icon',             src: 'assets/icons/sniper_icon.png' },
    { key: 'grenadier_icon',          src: 'assets/icons/grenaider_icon.png' },
    { key: 'elite_icon',              src: 'assets/icons/elite_icon.png' },
    { key: 'shock_trooper_icon',      src: 'assets/icons/shock_trooper_icon.png' },
    { key: 'slasher_icon',            src: 'assets/icons/slasher_icon.png' },
    { key: 'assassin_icon',           src: 'assets/icons/assassin_icon.png' },
    { key: 'acid_thrower_icon',       src: 'assets/icons/acid_thrower_icon.png' },
    { key: 'med_pack_icon',           src: 'assets/icons/med_pack_icon.png' },
    { key: 'mine_icon',               src: 'assets/icons/mine_icon.png' },
    { key: 'teleporter_icon',         src: 'assets/icons/teleporter_icon.png' },
    { key: 'fire_caller_icon',        src: 'assets/icons/fire_caller_icon.png' },
    // Backgrounds
    { key: 'bg1', src: 'assets/backgrounds/tactix_background.png' },
    { key: 'bg2', src: 'assets/backgrounds/tactix_background_2.png' },
    // Logo
    { key: 'logo', src: 'assets/logo/tactix_logo.png' }
  ];

  const AUDIO_MANIFEST = [
    { key: 'score',    src: 'assets/music/tactix_score.mp3',  loop: true,  volume: 0.4 },
    { key: 'gunshot',  src: 'assets/sounds/Gun_Shot.mp3',     loop: false, volume: 0.6 },
    { key: 'ricochet', src: 'assets/sounds/Gun_Ricochet.mp3', loop: false, volume: 0.5 }
  ];

  // ── Asset loading ────────────────────────────────────────
  function loadAssets() {
    const total = IMAGE_MANIFEST.length + AUDIO_MANIFEST.length;
    let loaded = 0;

    function progress(label) {
      loaded++;
      const pct = Math.round((loaded / total) * 100);
      loadingBar.style.width = pct + '%';
      loadingLabel.textContent = label.toUpperCase();
    }

    const imagePromises = IMAGE_MANIFEST.map(({ key, src }) =>
      new Promise(resolve => {
        const img = new Image();
        img.onload = () => { assets.images[key] = img; progress(key); resolve(); };
        img.onerror = () => { console.warn('Failed to load image:', src); progress(key); resolve(); };
        img.src = src;
      })
    );

    const audioPromises = AUDIO_MANIFEST.map(({ key, src, loop, volume }) =>
      new Promise(resolve => {
        const audio = new Audio();
        audio.loop = loop;
        audio.volume = volume;
        audio.preload = 'auto';
        let resolved = false;
        function done() {
          if (resolved) return;
          resolved = true;
          progress(key);
          resolve();
        }
        audio.oncanplaythrough = () => { assets.audio[key] = audio; done(); };
        audio.onerror = () => { console.warn('Failed to load audio:', src); done(); };
        // Fallback: resolve after 3s even if canplaythrough never fires
        setTimeout(done, 3000);
        audio._src = src;
        audio._volume = volume;
        audio._loop = loop;
        audio.src = src;
      })
    );

    return Promise.all([...imagePromises, ...audioPromises]);
  }

  // ── Audio ────────────────────────────────────────────────
  let currentMusic = null;
  let musicUnlocked = false;
  let musicVolume = 0.4;
  let sfxVolume = 0.6;

  function playMusic(key) {
    if (currentMusic) {
      currentMusic.pause();
      currentMusic.currentTime = 0;
    }
    const track = assets.audio[key];
    if (!track) return;
    track.volume = musicVolume;
    currentMusic = track;
    if (musicUnlocked) {
      track.currentTime = 0;
      track.play().catch(() => {});
    }
  }

  function unlockAudio() {
    if (musicUnlocked) return;
    musicUnlocked = true;
    if (currentMusic) currentMusic.play().catch(() => {});
  }

  function playSFX(key) {
    const src = assets.audio[key];
    if (!src || !musicUnlocked) return;
    const sfx = new Audio(src._src || src.src);
    sfx.volume = sfxVolume;
    sfx.play().catch(() => {});
  }

  function setMusicVolume(v) {
    musicVolume = Math.max(0, Math.min(1, v));
    if (currentMusic) currentMusic.volume = musicVolume;
  }

  function setSFXVolume(v) {
    sfxVolume = Math.max(0, Math.min(1, v));
  }

  function getMusicVolume() { return musicVolume; }
  function getSFXVolume()   { return sfxVolume; }

  // ── Screen management ────────────────────────────────────
  function setScreen(screen) {
    if (currentScreen && currentScreen.destroy) currentScreen.destroy();
    // Clear HTML UI layer
    uiLayer.innerHTML = '';
    currentScreen = screen;
    if (currentScreen && currentScreen.enter) currentScreen.enter();
  }

  // ── Main render loop ─────────────────────────────────────
  function tick(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    ctx.clearRect(0, 0, 1280, 720);

    if (currentScreen) {
      if (currentScreen.update) currentScreen.update(dt);
      if (currentScreen.render) currentScreen.render(ctx, dt);
    }

    animFrameId = requestAnimationFrame(tick);
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    canvas.addEventListener('click', unlockAudio, { once: true });

    loadAssets().then(() => {
      // Fade out loading screen
      loadingScreen.classList.add('hidden');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 600);

      // Start main loop
      lastTime = performance.now();
      animFrameId = requestAnimationFrame(tick);

      // Go to title screen
      setScreen(Screens.Title());
      playMusic('score');
    });
  }

  // ── Helpers ──────────────────────────────────────────────
  function getImage(key) { return assets.images[key] || null; }
  function getCtx() { return ctx; }
  function getCanvas() { return canvas; }
  function getUI() { return uiLayer; }

  // Draw background helper used by all screens
  function drawBackground(ctx, key = 'bg1', alpha = 1) {
    const img = getImage(key);
    if (!img) {
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, 1280, 720);
      return;
    }
    ctx.globalAlpha = alpha;
    // Cover-fit
    const scale = Math.max(1280 / img.width, 720 / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (1280 - w) / 2, (720 - h) / 2, w, h);
    ctx.globalAlpha = 1;
  }

  // Dim overlay
  function drawDim(ctx, alpha = 0.6) {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, 1280, 720);
  }

  // Text helper
  function drawText(ctx, text, x, y, opts = {}) {
    const {
      font = '18px Iceberg',
      color = '#ffffff',
      align = 'left',
      alpha = 1,
      shadow = false,
      shadowColor = 'rgba(0,0,0,0.8)',
      shadowBlur = 6
    } = opts;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (shadow) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // Hexagon path helper (flat-top)
  function hexPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  return {
    init,
    setScreen,
    getImage,
    getCtx,
    getCanvas,
    getUI,
    playMusic,
    playSFX,
    unlockAudio,
    setMusicVolume,
    setSFXVolume,
    getMusicVolume,
    getSFXVolume,
    drawBackground,
    drawDim,
    drawText,
    hexPath
  };
})();
