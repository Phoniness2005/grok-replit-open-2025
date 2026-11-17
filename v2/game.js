/**
 * Wimbledon Pong version 2.
 * Rule 9 framework exceptions (named functions the browser calls):
 * onKeyDown, onKeyUp, onMouseMove, onTouchStart, onTouchMove,
 * onUpPointerDown, onUpPointerUp, onDownPointerDown, onDownPointerUp,
 * onPauseClick, onFullScreenClick, onOverlayClick, onFrame, onFitCourt,
 * onAssetLoad, onAssetError.
 * onFrame is the rule 2 frame pump: the browser calls it, it does not call
 * itself, and every loop inside a frame has a constant cap.
 * One-shot OscillatorNode and GainNode objects are a Web Audio platform
 * exception to rule 3 (a stopped oscillator cannot be restarted).
 */
import { assertThat } from '../shared/power10.js';

const W = 1600;
const H = 900;
const WHITE = 8;
const PURPLE = 18;
const STAND = 74;
const PLAY_TOP = WHITE + PURPLE + STAND;
const PLAY_BOTTOM = H - WHITE - PURPLE - STAND;
const PLAY_LEFT = WHITE + PURPLE;
const PLAY_RIGHT = W - WHITE - PURPLE;
const MAX_SCORE = 10;
const BALL_R = 12;
const PADDLE_W = 22;
const PADDLE_H = 156;
const PREDICT_HOP_CAP = 700;
const MAX_SUBSTEPS = 4;
const TRAIL_CAP = 10;
const MAX_TOUCHES = 8;
const PADDLE_TILE_CAP = 8;
const STRIPE_CAP = 20;
const STRIPE_H = 48;
const NET_MESH_CAP = 80;
const CROWD_ROWS = 3;
const CROWD_COL_CAP = 96;
const ARIA_CAP = 4;
const ASSET_SLOTS = 4;

const STATE_MENU = 'menu';
const STATE_DIFFICULTY = 'difficulty';
const STATE_PLAYING = 'playing';
const STATE_PAUSED = 'paused';
const STATE_REMATCH = 'rematch';

const AMATEUR = {
  speed: 3.5, reaction: 38, error: 96, predict: 0, chaseAway: false,
  accel: 0.22, whiff: 0.2, label: 'Amateur'
};
const TOUR = {
  speed: 6.3, reaction: 14, error: 34, predict: 0.26, chaseAway: false,
  accel: 0.46, whiff: 0.05, label: 'Tour'
};
const PRO = {
  speed: 8.7, reaction: 5, error: 12, predict: 0.7, chaseAway: true,
  accel: 0.74, whiff: 0, label: 'Pro'
};

const CHEER_COLORS = ['#fff4a3', '#ffffff', '#d4ff3f'];
const SKINS = ['#f1d3b5', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'];
const COURT_DASH = [10, 12];
const NO_DASH = [];
const TRAIL_FILL = [];

const ball = { x: W / 2, y: H / 2, r: BALL_R, vx: 7, vy: 5 };
const p1 = { x: PLAY_LEFT + 28, y: H / 2 - 78, w: PADDLE_W, h: PADDLE_H, speed: 9.4, vy: 0, score: 0 };
const p2 = { x: PLAY_RIGHT - 50, y: H / 2 - 78, w: PADDLE_W, h: PADDLE_H, speed: 9.4, vy: 0, score: 0 };
const ai = { think: 0, target: H / 2 - 78, offset: 0 };
const keys = {
  w: false, W: false, s: false, S: false, ArrowUp: false, ArrowDown: false
};
const assets = { grass: null, woodLight: null, woodDark: null, seats: null, ready: false };
const patterns = { grass: null, seats: null };
const trailX = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const trailY = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

let canvas = null;
let ctx = null;
let overlay = null;
let scoreEl = null;
let metaEl = null;
let p1Label = null;
let p2Label = null;
let helpEl = null;
let touchBar = null;
let btnPause = null;
let btnUp = null;
let btnDown = null;
let fullBtn = null;
let courtFrame = null;
let courtInner = null;
let winnerTitle = null;
let rematchLead = null;
let menuButtons = null;
let diffButtons = null;
let pauseButtons = null;
let rematchButtons = null;
let frameFill = null;
let vignette = null;
let ballFill = null;
let paddleGloss = null;
let audioCtx = null;
let coarseQuery = null;
let state = STATE_MENU;
let selected = 0;
let mode = 'one';
let difficulty = 'Tour';
let gameNumber = 1;
let p1Wins = 0;
let p2Wins = 0;
let lastWinner = '';
let crowdCheer = 0;
let overlayDirty = true;
let serveHold = 0;
let mouseLive = 0;
let mouseLive2 = 0;
let coarse = false;
let trailCount = 0;
let trailNext = 0;
let assetsLeft = ASSET_SLOTS;
let booted = false;

function knownState(value) {
  const textOk = assertThat(typeof value === 'string');
  const listed = assertThat(
    value === STATE_MENU || value === STATE_DIFFICULTY || value === STATE_PLAYING
    || value === STATE_PAUSED || value === STATE_REMATCH
  );
  return textOk && listed;
}

function requireElement(id) {
  const idOk = assertThat(typeof id === 'string' && id.length > 0 && id.length < 40);
  const apiOk = assertThat(typeof document.getElementById === 'function');
  if (!idOk || !apiOk) {
    return null;
  }
  return document.getElementById(id);
}

function bail(message) {
  const msgOk = assertThat(typeof message === 'string' && message.length > 0 && message.length < 180);
  const bodyOk = assertThat(document.body !== null);
  if (!msgOk || !bodyOk) {
    return false;
  }
  const added = document.body.appendChild(document.createTextNode(message));
  return added !== null;
}

function randomUnit() {
  const sample = Math.random();
  const finite = assertThat(typeof sample === 'number' && Number.isFinite(sample));
  const range = assertThat(finite && sample >= 0 && sample < 1);
  if (!finite || !range) {
    return 0.5;
  }
  return sample;
}

function clamp(value, low, high) {
  const valueOk = assertThat(typeof value === 'number' && Number.isFinite(value));
  const rangeOk = assertThat(
    typeof low === 'number' && typeof high === 'number'
    && Number.isFinite(low) && Number.isFinite(high) && low <= high
  );
  if (!valueOk || !rangeOk) {
    return 0;
  }
  if (value < low) {
    return low;
  }
  if (value > high) {
    return high;
  }
  return value;
}

function assetBase() {
  const path = location.pathname;
  const pathOk = assertThat(typeof path === 'string');
  const bounded = assertThat(pathOk && path.length < 4096);
  if (!pathOk || !bounded) {
    return 'assets/';
  }
  if (path.indexOf('/play/') === 0) {
    return '/wp-content/themes/dabbuilds-child/play/v2/assets/';
  }
  return 'assets/';
}

const ASSET_BASE = assetBase();

function difficultyConfig(name) {
  const textOk = assertThat(typeof name === 'string');
  const known = assertThat(name === 'Amateur' || name === 'Tour' || name === 'Pro');
  if (!textOk || !known) {
    return TOUR;
  }
  if (name === 'Amateur') {
    return AMATEUR;
  }
  if (name === 'Pro') {
    return PRO;
  }
  return TOUR;
}

function initTrailFill() {
  const capOk = assertThat(TRAIL_CAP === 10);
  const listOk = assertThat(Array.isArray(TRAIL_FILL));
  if (!capOk || !listOk) {
    return false;
  }
  for (let i = 0; i < TRAIL_CAP; i += 1) {
    TRAIL_FILL[i] = 'rgba(212,255,63,' + (0.06 + i * 0.025) + ')';
  }
  return true;
}

function clearTrail() {
  const countOk = assertThat(trailCount >= 0 && trailCount <= TRAIL_CAP);
  const nextOk = assertThat(trailNext >= 0 && trailNext < TRAIL_CAP);
  trailCount = 0;
  trailNext = 0;
  return countOk && nextOk;
}

function pushTrail(x, y) {
  const xOk = assertThat(typeof x === 'number' && Number.isFinite(x));
  const yOk = assertThat(typeof y === 'number' && Number.isFinite(y));
  if (!xOk || !yOk) {
    return false;
  }
  trailX[trailNext] = x;
  trailY[trailNext] = y;
  trailNext = (trailNext + 1) % TRAIL_CAP;
  if (trailCount < TRAIL_CAP) {
    trailCount += 1;
  }
  return true;
}

function initFills() {
  const ctxOk = assertThat(ctx !== null);
  const sizeOk = assertThat(W === 1600 && H === 900 && BALL_R === 12);
  if (!ctxOk || !sizeOk) {
    return false;
  }
  frameFill = ctx.createLinearGradient(0, 0, W, H);
  ballFill = ctx.createRadialGradient(-3, -4, 2, 0, 0, BALL_R);
  vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.78);
  paddleGloss = ctx.createLinearGradient(0, 0, PADDLE_W, 0);
  if (frameFill === null || ballFill === null || vignette === null || paddleGloss === null) {
    return false;
  }
  frameFill.addColorStop(0, '#5a3480');
  frameFill.addColorStop(0.5, '#4b286d');
  frameFill.addColorStop(1, '#351c4d');
  ballFill.addColorStop(0, '#f7ffb0');
  ballFill.addColorStop(0.45, '#d4ff3f');
  ballFill.addColorStop(1, '#6f9800');
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(8, 16, 8, 0.28)');
  paddleGloss.addColorStop(0, 'rgba(255,255,255,0.32)');
  paddleGloss.addColorStop(0.45, 'rgba(255,255,255,0)');
  paddleGloss.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return true;
}

function makePattern(img, tile) {
  const imgOk = assertThat(img === null || img instanceof Image);
  const tileOk = assertThat(tile === 256 || tile === 192);
  if (!imgOk || !tileOk || img === null || ctx === null) {
    return null;
  }
  const off = document.createElement('canvas');
  off.width = tile;
  off.height = tile;
  const offCtx = off.getContext('2d');
  if (offCtx === null) {
    return null;
  }
  offCtx.drawImage(img, 0, 0, tile, tile);
  return ctx.createPattern(off, 'repeat');
}

function storeAsset(slot, image) {
  const slotOk = assertThat(slot === 0 || slot === 1 || slot === 2 || slot === 3);
  const imageOk = assertThat(image === null || image instanceof Image);
  if (!slotOk || !imageOk) {
    return false;
  }
  if (slot === 0) {
    assets.grass = image;
  } else if (slot === 1) {
    assets.woodLight = image;
  } else if (slot === 2) {
    assets.woodDark = image;
  } else {
    assets.seats = image;
  }
  assetsLeft -= 1;
  if (assetsLeft === 0) {
    patterns.grass = makePattern(assets.grass, 256);
    patterns.seats = makePattern(assets.seats, 192);
    assets.ready = true;
  }
  return true;
}

function onAssetLoad(event) {
  const eventOk = assertThat(event !== null && event.currentTarget instanceof Image);
  const slotOk = assertThat(eventOk && (event.currentTarget.assetSlot === 0 || event.currentTarget.assetSlot === 1 || event.currentTarget.assetSlot === 2 || event.currentTarget.assetSlot === 3));
  if (!eventOk || !slotOk) {
    return false;
  }
  return storeAsset(event.currentTarget.assetSlot, event.currentTarget);
}

function onAssetError(event) {
  const eventOk = assertThat(event !== null && event.currentTarget instanceof Image);
  const slotOk = assertThat(eventOk && typeof event.currentTarget.assetSlot === 'number');
  if (!eventOk || !slotOk) {
    return false;
  }
  return storeAsset(event.currentTarget.assetSlot, null);
}

function loadAsset(src, slot) {
  const srcOk = assertThat(typeof src === 'string' && src.length > 0 && src.length < 400);
  const slotOk = assertThat(slot === 0 || slot === 1 || slot === 2 || slot === 3);
  if (!srcOk || !slotOk) {
    return false;
  }
  const img = new Image();
  img.assetSlot = slot;
  img.addEventListener('load', onAssetLoad);
  img.addEventListener('error', onAssetError);
  img.src = src;
  return true;
}

function beginAssetLoads() {
  const baseOk = assertThat(ASSET_BASE === 'assets/' || ASSET_BASE.indexOf('/wp-content/') === 0);
  const countOk = assertThat(assetsLeft === ASSET_SLOTS);
  if (!baseOk || !countOk) {
    return false;
  }
  loadAsset(ASSET_BASE + 'grass.jpg', 0);
  loadAsset(ASSET_BASE + 'wood-light.jpg', 1);
  loadAsset(ASSET_BASE + 'wood-dark.jpg', 2);
  loadAsset(ASSET_BASE + 'seats.jpg', 3);
  return true;
}

function resetBall(toRight) {
  const argOk = assertThat(toRight === undefined || toRight === true || toRight === false);
  const placeOk = assertThat(Number.isFinite(PLAY_TOP) && Number.isFinite(PLAY_BOTTOM));
  if (!argOk || !placeOk) {
    return false;
  }
  ball.x = W / 2;
  ball.y = (PLAY_TOP + PLAY_BOTTOM) / 2;
  const dir = toRight === undefined ? (randomUnit() > 0.5 ? 1 : -1) : (toRight ? 1 : -1);
  const speed = 6.8;
  const angle = (randomUnit() * 0.7 - 0.35);
  ball.vx = dir * speed * Math.cos(angle);
  ball.vy = speed * Math.sin(angle) * 1.35;
  if (Math.abs(ball.vy) < 2.2) {
    ball.vy = (randomUnit() > 0.5 ? 2.6 : -2.6);
  }
  clearTrail();
  serveHold = 55;
  return true;
}

function setHelpMode() {
  const elOk = assertThat(helpEl !== null);
  const stateOk = assertThat(knownState(state));
  if (!elOk || !stateOk) {
    return false;
  }
  helpEl.classList.remove('mode-menu', 'mode-play', 'mode-play2', 'mode-paused', 'mode-difficulty');
  if (state === STATE_PLAYING && mode === 'two') {
    helpEl.classList.add('mode-play2');
  } else if (state === STATE_PLAYING) {
    helpEl.classList.add('mode-play');
  } else if (state === STATE_PAUSED) {
    helpEl.classList.add('mode-paused');
  } else if (state === STATE_DIFFICULTY) {
    helpEl.classList.add('mode-difficulty');
  } else {
    helpEl.classList.add('mode-menu');
  }
  return true;
}

function updateHud() {
  const elsOk = assertThat(scoreEl !== null && metaEl !== null && p2Label !== null && p1Label !== null);
  const modeOk = assertThat(mode === 'one' || mode === 'two');
  if (!elsOk || !modeOk || touchBar === null || btnPause === null || coarseQuery === null) {
    return false;
  }
  const rightName = mode === 'two' ? 'Player 2' : 'Computer';
  const cfg = difficultyConfig(difficulty);
  scoreEl.textContent = p1.score + ' \u2014 ' + p2.score;
  metaEl.textContent = 'First to ' + MAX_SCORE + ' \u00b7 Game ' + gameNumber + ' \u00b7 You ' + p1Wins + ' \u2014 ' + rightName + ' ' + p2Wins;
  if (mode === 'two') {
    p1Label.classList.add('mode-two');
  } else {
    p1Label.classList.remove('mode-two');
  }
  p2Label.textContent = mode === 'two' ? 'Player 2 \u2014 \u2191 \u2193' : cfg.label + ' opponent';
  setHelpMode();
  const wide = Number.isFinite(window.innerWidth) && window.innerWidth < 720;
  touchBar.classList.toggle('show', coarse === true || coarseQuery.matches === true || wide);
  touchBar.classList.toggle('two-player', mode === 'two' && state === STATE_PLAYING);
  btnPause.textContent = state === STATE_PAUSED ? 'Resume' : 'Pause';
  return true;
}

function resetMatch() {
  const scoresOk = assertThat(Number.isFinite(p1.score) && Number.isFinite(p2.score));
  const sizeOk = assertThat(p1.h === PADDLE_H && p2.h === PADDLE_H);
  p1.score = 0;
  p2.score = 0;
  p1.y = (PLAY_TOP + PLAY_BOTTOM) / 2 - p1.h / 2;
  p2.y = (PLAY_TOP + PLAY_BOTTOM) / 2 - p2.h / 2;
  resetBall(undefined);
  updateHud();
  return scoresOk && sizeOk;
}

function paddleBounds(paddle) {
  const paddleOk = assertThat(paddle === p1 || paddle === p2);
  const yOk = assertThat(paddleOk && Number.isFinite(paddle.y) && Number.isFinite(paddle.h));
  if (!paddleOk || !yOk) {
    return false;
  }
  const low = PLAY_TOP + 4;
  const high = PLAY_BOTTOM - paddle.h - 4;
  if (high < low) {
    paddle.y = low;
    return false;
  }
  paddle.y = clamp(paddle.y, low, high);
  return true;
}

function predictIntercept() {
  const velOk = assertThat(Number.isFinite(ball.vx) && Number.isFinite(ball.vy));
  const posOk = assertThat(Number.isFinite(ball.x) && Number.isFinite(ball.y));
  if (!velOk || !posOk) {
    return (PLAY_TOP + PLAY_BOTTOM) / 2;
  }
  let x = ball.x;
  let y = ball.y;
  const vx = ball.vx;
  let vy = ball.vy;
  const top = PLAY_TOP + ball.r + 4;
  const bot = PLAY_BOTTOM - ball.r - 4;
  const goal = p2.x;
  if (vx <= 0) {
    return y;
  }
  for (let hop = 0; hop < PREDICT_HOP_CAP; hop += 1) {
    if (x >= goal) {
      break;
    }
    x += vx;
    y += vy;
    if (y < top) {
      y = top + (top - y);
      vy = -vy;
    }
    if (y > bot) {
      y = bot - (y - bot);
      vy = -vy;
    }
  }
  return y;
}

function updateAI() {
  const cfg = difficultyConfig(difficulty);
  const cfgOk = assertThat(Number.isFinite(cfg.speed) && Number.isFinite(cfg.reaction) && Number.isFinite(cfg.accel));
  const ballOk = assertThat(Number.isFinite(ball.vx) && Number.isFinite(ball.y));
  if (!cfgOk || !ballOk) {
    return false;
  }
  const coming = ball.vx > 0;
  ai.think += 1;
  if (ai.think >= cfg.reaction) {
    ai.think = 0;
    if (!coming && !cfg.chaseAway) {
      ai.target = (PLAY_TOP + PLAY_BOTTOM) / 2 - p2.h / 2;
      ai.offset = 0;
    } else {
      const predicted = coming ? predictIntercept() : ball.y;
      const mix = ball.y * (1 - cfg.predict) + predicted * cfg.predict;
      ai.offset = (randomUnit() * 2 - 1) * cfg.error;
      if (cfg.whiff && randomUnit() < cfg.whiff) {
        ai.offset += (randomUnit() > 0.5 ? 1 : -1) * (p2.h * 0.85);
      }
      ai.target = mix + ai.offset - p2.h / 2;
    }
  }
  const dy = ai.target - p2.y;
  const step = clamp(dy * cfg.accel, -cfg.speed, cfg.speed);
  if (Math.abs(dy) > 3) {
    p2.y += step;
  }
  paddleBounds(p2);
  return true;
}

function beep(freq, dur) {
  const freqOk = assertThat(typeof freq === 'number' && Number.isFinite(freq) && freq > 0 && freq < 8000);
  const durOk = assertThat(typeof dur === 'number' && Number.isFinite(dur) && dur > 0 && dur <= 2);
  if (!freqOk || !durOk) {
    return false;
  }
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (audioCtx === null) {
      if (typeof Ctor !== 'function') {
        return false;
      }
      audioCtx = new Ctor();
    }
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const nodesOk = assertThat(oscillator !== null && gain !== null);
    const timeOk = assertThat(typeof audioCtx.currentTime === 'number' && Number.isFinite(audioCtx.currentTime));
    if (!nodesOk || !timeOk) {
      return false;
    }
    oscillator.type = 'square';
    oscillator.frequency.value = freq;
    gain.gain.value = 0.035;
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + dur);
  } catch (err) {
    return err instanceof Error || typeof err === 'object';
  }
  return true;
}

function startPlaying() {
  const modeOk = assertThat(mode === 'one' || mode === 'two');
  const overlayOk = assertThat(overlay !== null);
  if (!modeOk || !overlayOk) {
    return false;
  }
  state = STATE_PLAYING;
  overlay.classList.remove('mode-menu', 'mode-difficulty', 'mode-paused', 'mode-rematch');
  overlay.classList.add('hidden');
  overlayDirty = true;
  resetMatch();
  updateHud();
  return true;
}

function goMenu() {
  const stateOk = assertThat(knownState(state));
  const winsOk = assertThat(Number.isFinite(p1Wins) && Number.isFinite(p2Wins));
  if (!stateOk || !winsOk) {
    return false;
  }
  state = STATE_MENU;
  selected = 0;
  gameNumber = 1;
  p1Wins = 0;
  p2Wins = 0;
  resetMatch();
  overlayDirty = true;
  return true;
}

function chooseMenu(action) {
  const actionOk = assertThat(typeof action === 'string');
  const stateOk = assertThat(state === STATE_MENU);
  if (!actionOk || !stateOk) {
    return false;
  }
  if (action === 'one') {
    mode = 'one';
    state = STATE_DIFFICULTY;
    selected = 1;
  } else if (action === 'two') {
    mode = 'two';
    startPlaying();
    beep(620, 0.08);
    return true;
  } else {
    return false;
  }
  overlayDirty = true;
  beep(620, 0.08);
  return true;
}

function chooseDifficulty(action) {
  const actionOk = assertThat(typeof action === 'string');
  const stateOk = assertThat(state === STATE_DIFFICULTY);
  if (!actionOk || !stateOk) {
    return false;
  }
  if (action === 'Amateur' || action === 'Tour' || action === 'Pro') {
    difficulty = action;
    startPlaying();
    beep(620, 0.08);
    return true;
  }
  if (action === 'back') {
    state = STATE_MENU;
    selected = 0;
  }
  overlayDirty = true;
  beep(500, 0.08);
  return true;
}

function choosePaused(action) {
  const actionOk = assertThat(typeof action === 'string');
  const stateOk = assertThat(state === STATE_PAUSED);
  if (!actionOk || !stateOk) {
    return false;
  }
  if (action === 'resume') {
    state = STATE_PLAYING;
  } else {
    goMenu();
  }
  overlayDirty = true;
  beep(500, 0.08);
  return true;
}

function chooseRematch(action) {
  const actionOk = assertThat(typeof action === 'string');
  const stateOk = assertThat(state === STATE_REMATCH);
  if (!actionOk || !stateOk) {
    return false;
  }
  if (action === 'again') {
    gameNumber += 1;
    startPlaying();
  } else {
    goMenu();
  }
  beep(620, 0.08);
  return true;
}

function chooseAction(action) {
  const actionOk = assertThat(typeof action === 'string' && action.length > 0 && action.length < 20);
  const stateOk = assertThat(knownState(state));
  if (!actionOk || !stateOk) {
    return false;
  }
  if (state === STATE_MENU) {
    return chooseMenu(action);
  }
  if (state === STATE_DIFFICULTY) {
    return chooseDifficulty(action);
  }
  if (state === STATE_PAUSED) {
    return choosePaused(action);
  }
  if (state === STATE_REMATCH) {
    return chooseRematch(action);
  }
  return false;
}

function chooseIndex(index) {
  const indexOk = assertThat(typeof index === 'number' && Number.isFinite(index));
  const stateOk = assertThat(knownState(state));
  if (!indexOk || !stateOk) {
    return false;
  }
  if (state === STATE_MENU) {
    return chooseAction(index === 0 ? 'one' : 'two');
  }
  if (state === STATE_DIFFICULTY) {
    if (index === 0) {
      return chooseAction('Amateur');
    }
    if (index === 1) {
      return chooseAction('Tour');
    }
    if (index === 2) {
      return chooseAction('Pro');
    }
    return chooseAction('back');
  }
  if (state === STATE_PAUSED) {
    return chooseAction(index === 0 ? 'resume' : 'menu');
  }
  if (state === STATE_REMATCH) {
    return chooseAction(index === 0 ? 'again' : 'menu');
  }
  return false;
}

function menuMax() {
  const stateOk = assertThat(knownState(state));
  const selOk = assertThat(Number.isFinite(selected));
  if (!stateOk || !selOk) {
    return 0;
  }
  if (state === STATE_DIFFICULTY) {
    return 3;
  }
  if (state === STATE_MENU || state === STATE_PAUSED || state === STATE_REMATCH) {
    return 1;
  }
  return 0;
}

function moveMenu(delta) {
  const deltaOk = assertThat(delta === 1 || delta === -1);
  const selOk = assertThat(Number.isFinite(selected));
  if (!deltaOk || !selOk) {
    return false;
  }
  selected = clamp(selected + delta, 0, menuMax());
  overlayDirty = true;
  beep(480, 0.045);
  return true;
}

function togglePause() {
  const stateOk = assertThat(knownState(state));
  const selOk = assertThat(Number.isFinite(selected));
  if (!stateOk || !selOk) {
    return false;
  }
  if (state === STATE_PLAYING) {
    state = STATE_PAUSED;
    selected = 0;
    overlayDirty = true;
  } else if (state === STATE_PAUSED) {
    state = STATE_PLAYING;
    overlayDirty = true;
  }
  return true;
}

function onEscape() {
  const stateOk = assertThat(knownState(state));
  const selOk = assertThat(Number.isFinite(selected));
  if (!stateOk || !selOk) {
    return false;
  }
  if (state === STATE_DIFFICULTY) {
    state = STATE_MENU;
    selected = 0;
    overlayDirty = true;
  } else {
    goMenu();
  }
  return true;
}

function setKey(name, down) {
  const nameOk = assertThat(typeof name === 'string');
  const downOk = assertThat(down === true || down === false);
  if (!nameOk || !downOk) {
    return false;
  }
  if (name === 'w') {
    keys.w = down;
  } else if (name === 'W') {
    keys.W = down;
  } else if (name === 's') {
    keys.s = down;
  } else if (name === 'S') {
    keys.S = down;
  } else if (name === 'ArrowUp') {
    keys.ArrowUp = down;
  } else if (name === 'ArrowDown') {
    keys.ArrowDown = down;
  } else {
    return false;
  }
  return true;
}

function onKeyAction(key) {
  const keyOk = assertThat(typeof key === 'string');
  const stateOk = assertThat(knownState(state));
  if (!keyOk || !stateOk) {
    return false;
  }
  if (key === 'p' || key === 'P') {
    return togglePause();
  }
  if (key === 'Escape') {
    return onEscape();
  }
  if (state === STATE_MENU || state === STATE_DIFFICULTY || state === STATE_PAUSED || state === STATE_REMATCH) {
    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      return moveMenu(-1);
    }
    if (key === 'ArrowDown' || key === 's' || key === 'S') {
      return moveMenu(1);
    }
    if (key === 'Enter') {
      return chooseIndex(selected);
    }
  }
  return true;
}

function onKeyDown(event) {
  const eventOk = assertThat(event !== null && typeof event.key === 'string');
  const repeatOk = assertThat(eventOk && (event.repeat === true || event.repeat === false));
  if (!eventOk || !repeatOk) {
    return false;
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === ' ') {
    event.preventDefault();
  }
  setKey(event.key, true);
  if (event.repeat) {
    return true;
  }
  return onKeyAction(event.key);
}

function onKeyUp(event) {
  const eventOk = assertThat(event !== null && typeof event.key === 'string');
  const typeOk = assertThat(eventOk && event.type === 'keyup');
  if (!eventOk || !typeOk) {
    return false;
  }
  setKey(event.key, false);
  return true;
}

function pointerToPaddle(paddle, clientY, which) {
  const paddleOk = assertThat(paddle === p1 || paddle === p2);
  const yOk = assertThat(typeof clientY === 'number' && Number.isFinite(clientY));
  if (!paddleOk || !yOk || canvas === null) {
    return false;
  }
  const rect = canvas.getBoundingClientRect();
  if (!Number.isFinite(rect.height) || rect.height <= 0 || !Number.isFinite(rect.top)) {
    return false;
  }
  const y = ((clientY - rect.top) / rect.height) * H;
  paddle.y = y - paddle.h / 2;
  paddleBounds(paddle);
  if (which === 2) {
    mouseLive2 = 24;
  } else {
    mouseLive = 24;
  }
  return true;
}

function applyPointer(clientX, clientY) {
  const xOk = assertThat(typeof clientX === 'number' && Number.isFinite(clientX));
  const yOk = assertThat(typeof clientY === 'number' && Number.isFinite(clientY));
  if (!xOk || !yOk || state !== STATE_PLAYING || canvas === null) {
    return false;
  }
  const rect = canvas.getBoundingClientRect();
  if (!Number.isFinite(rect.width) || rect.width <= 0) {
    return false;
  }
  const x = ((clientX - rect.left) / rect.width) * W;
  if (mode === 'two' && x > W / 2) {
    return pointerToPaddle(p2, clientY, 2);
  }
  return pointerToPaddle(p1, clientY, 1);
}

function onMouseMove(event) {
  const eventOk = assertThat(event !== null && Number.isFinite(event.clientX) && Number.isFinite(event.clientY));
  const stateOk = assertThat(knownState(state));
  if (!eventOk || !stateOk) {
    return false;
  }
  return applyPointer(event.clientX, event.clientY);
}

function dispatchTouches(list) {
  const listOk = assertThat(list !== null && typeof list.length === 'number' && list.length >= 0 && list.length < 64);
  const apiOk = assertThat(listOk && typeof list.item === 'function');
  if (!listOk || !apiOk) {
    return false;
  }
  const count = list.length > MAX_TOUCHES ? MAX_TOUCHES : list.length;
  for (let i = 0; i < MAX_TOUCHES; i += 1) {
    if (i >= count) {
      break;
    }
    const touch = list.item(i);
    if (touch !== null && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
      applyPointer(touch.clientX, touch.clientY);
    }
  }
  return true;
}

function onTouchStart(event) {
  const eventOk = assertThat(event !== null && event.touches !== null);
  const barOk = assertThat(touchBar !== null);
  if (!eventOk || !barOk) {
    return false;
  }
  coarse = true;
  touchBar.classList.add('show');
  if (state !== STATE_PLAYING) {
    return true;
  }
  event.preventDefault();
  return dispatchTouches(event.touches);
}

function onTouchMove(event) {
  const eventOk = assertThat(event !== null && event.touches !== null);
  const stateOk = assertThat(knownState(state));
  if (!eventOk || !stateOk || state !== STATE_PLAYING) {
    return false;
  }
  event.preventDefault();
  return dispatchTouches(event.touches);
}

function onUpPointerDown(event) {
  const eventOk = assertThat(event !== null && typeof event.preventDefault === 'function');
  const flagOk = assertThat(coarse === true || coarse === false);
  if (!eventOk || !flagOk) {
    return false;
  }
  event.preventDefault();
  keys.w = true;
  coarse = true;
  return true;
}

function onUpPointerUp() {
  const keyOk = assertThat(keys.w === true || keys.w === false);
  const flagOk = assertThat(typeof coarse === 'boolean');
  keys.w = false;
  return keyOk && flagOk;
}

function onDownPointerDown(event) {
  const eventOk = assertThat(event !== null && typeof event.preventDefault === 'function');
  const flagOk = assertThat(coarse === true || coarse === false);
  if (!eventOk || !flagOk) {
    return false;
  }
  event.preventDefault();
  keys.s = true;
  coarse = true;
  return true;
}

function onDownPointerUp() {
  const keyOk = assertThat(keys.s === true || keys.s === false);
  const flagOk = assertThat(typeof coarse === 'boolean');
  keys.s = false;
  return keyOk && flagOk;
}

function onPauseClick() {
  const stateOk = assertThat(knownState(state));
  const selOk = assertThat(Number.isFinite(selected));
  if (!stateOk || !selOk) {
    return false;
  }
  if (state === STATE_PLAYING) {
    state = STATE_PAUSED;
    selected = 0;
    overlayDirty = true;
  } else if (state === STATE_PAUSED) {
    state = STATE_PLAYING;
    overlayDirty = true;
  }
  updateHud();
  return true;
}

function enterFullscreen(root) {
  const rootOk = assertThat(root !== null);
  const apiOk = assertThat(rootOk && (typeof root.requestFullscreen === 'function' || typeof root.webkitRequestFullscreen === 'function'));
  if (!rootOk || !apiOk) {
    return null;
  }
  if (typeof root.requestFullscreen === 'function') {
    return root.requestFullscreen();
  }
  root.webkitRequestFullscreen();
  return true;
}

function leaveFullscreen() {
  const exitOk = assertThat(typeof document.exitFullscreen === 'function' || typeof document.webkitExitFullscreen === 'function');
  const docOk = assertThat(document.documentElement !== null);
  if (!exitOk || !docOk) {
    return null;
  }
  if (typeof document.exitFullscreen === 'function') {
    return document.exitFullscreen();
  }
  document.webkitExitFullscreen();
  return true;
}

async function onFullScreenClick() {
  const rootOk = assertThat(document.documentElement !== null);
  const fnOk = assertThat(typeof onFitCourt === 'function');
  if (!rootOk || !fnOk) {
    return false;
  }
  const active = document.fullscreenElement || document.webkitFullscreenElement;
  try {
    const pending = active ? leaveFullscreen() : enterFullscreen(document.documentElement);
    if (pending !== null && pending !== true && typeof pending.then === 'function') {
      await pending;
    }
  } catch (err) {
    const caught = err instanceof Error || typeof err === 'object' || typeof err === 'string';
    if (!caught) {
      return false;
    }
  }
  const handle = requestAnimationFrame(onFitCourt);
  if (typeof handle !== 'number') {
    onFitCourt();
  }
  return true;
}

function onFitCourt() {
  const nodesOk = assertThat(courtFrame !== null && courtInner !== null);
  const sizeOk = assertThat(Number.isFinite(W) && Number.isFinite(H) && H !== 0);
  if (!nodesOk || !sizeOk) {
    return false;
  }
  const fw = courtFrame.clientWidth;
  const fh = courtFrame.clientHeight;
  if (!Number.isFinite(fw) || !Number.isFinite(fh) || fw < 8 || fh < 8) {
    return true;
  }
  const aspect = W / H;
  const portrait = fh / fw > 1.05;
  let w = fw;
  let h = fh;
  if (!portrait) {
    h = w / aspect;
    if (h > fh) {
      h = fh;
      w = h * aspect;
    }
  }
  const pxW = Math.floor(w);
  const pxH = Math.floor(h);
  if (!Number.isFinite(pxW) || !Number.isFinite(pxH)) {
    return false;
  }
  courtInner.style.width = pxW + 'px';
  courtInner.style.height = pxH + 'px';
  return true;
}

function paintAria(buttons, selectedIndex, count) {
  const listOk = assertThat(buttons !== null && typeof buttons.length === 'number');
  const selOk = assertThat(Number.isFinite(selectedIndex) && count >= 1 && count <= ARIA_CAP);
  if (!listOk || !selOk) {
    return false;
  }
  for (let i = 0; i < ARIA_CAP; i += 1) {
    if (i >= count || i >= buttons.length || buttons[i] === null) {
      break;
    }
    buttons[i].setAttribute('aria-selected', i === selectedIndex ? 'true' : 'false');
  }
  return true;
}

function syncOverlay() {
  const dirtyOk = assertThat(overlayDirty === true || overlayDirty === false);
  const elOk = assertThat(overlay !== null);
  if (!dirtyOk || !elOk || !overlayDirty) {
    return dirtyOk && elOk;
  }
  overlayDirty = false;
  if (state === STATE_PLAYING) {
    overlay.classList.add('hidden');
    updateHud();
    return true;
  }
  overlay.classList.remove('hidden', 'mode-menu', 'mode-difficulty', 'mode-paused', 'mode-rematch');
  if (state === STATE_MENU) {
    overlay.classList.add('mode-menu');
    paintAria(menuButtons, selected, 2);
  } else if (state === STATE_DIFFICULTY) {
    overlay.classList.add('mode-difficulty');
    paintAria(diffButtons, selected, 4);
  } else if (state === STATE_PAUSED) {
    overlay.classList.add('mode-paused');
    paintAria(pauseButtons, selected, 2);
  } else if (state === STATE_REMATCH) {
    overlay.classList.add('mode-rematch');
    paintAria(rematchButtons, selected, 2);
    if (winnerTitle !== null) {
      winnerTitle.textContent = lastWinner + ' takes it';
    }
    if (rematchLead !== null) {
      rematchLead.textContent = p1.score + ' \u2014 ' + p2.score + '. Another game, or back to the menu?';
    }
  }
  updateHud();
  return true;
}

function onOverlayClick(event) {
  const eventOk = assertThat(event !== null && event.target !== null);
  const targetOk = assertThat(eventOk && typeof event.target.closest === 'function');
  if (!eventOk || !targetOk) {
    return false;
  }
  const button = event.target.closest('button');
  if (button === null) {
    return false;
  }
  const action = button.getAttribute('data-action');
  if (typeof action !== 'string' || action.length === 0) {
    return false;
  }
  return chooseAction(action);
}

function hitPaddle(paddle) {
  const paddleOk = assertThat(paddle === p1 || paddle === p2);
  const ballOk = assertThat(Number.isFinite(ball.x) && Number.isFinite(ball.y));
  if (!paddleOk || !ballOk) {
    return false;
  }
  return ball.x + ball.r > paddle.x
    && ball.x - ball.r < paddle.x + paddle.w
    && ball.y + ball.r > paddle.y
    && ball.y - ball.r < paddle.y + paddle.h;
}

function bounceOffPaddle(paddle, dir) {
  const paddleOk = assertThat(paddle === p1 || paddle === p2);
  const dirOk = assertThat(dir === 1 || dir === -1);
  if (!paddleOk || !dirOk) {
    return false;
  }
  const rel = clamp((ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2), -1, 1);
  const mag = Math.min(13.2, Math.hypot(ball.vx, ball.vy) * 1.048 + 0.18);
  const ang = rel * 0.72;
  ball.vx = dir * mag * Math.cos(ang);
  ball.vy = mag * Math.sin(ang);
  if (Math.abs(ball.vx) < 4.2) {
    ball.vx = dir * 4.4;
  }
  ball.x = dir > 0 ? paddle.x + paddle.w + ball.r + 0.5 : paddle.x - ball.r - 0.5;
  crowdCheer = 14;
  beep(430, 0.07);
  return true;
}

function scorePoint(scorer) {
  const whoOk = assertThat(scorer === 1 || scorer === 2);
  const scoresOk = assertThat(Number.isFinite(p1.score) && Number.isFinite(p2.score));
  if (!whoOk || !scoresOk) {
    return false;
  }
  crowdCheer = 42;
  beep(scorer === 1 ? 620 : 180, 0.22);
  if (scorer === 1) {
    p1.score += 1;
  } else {
    p2.score += 1;
  }
  const scored = scorer === 1 ? p1.score : p2.score;
  if (scored >= MAX_SCORE) {
    if (scorer === 1) {
      lastWinner = mode === 'two' ? 'Player 1' : 'You';
      p1Wins += 1;
    } else {
      lastWinner = mode === 'two' ? 'Player 2' : 'The computer';
      p2Wins += 1;
    }
    state = STATE_REMATCH;
    selected = 0;
    overlayDirty = true;
  } else {
    resetBall(scorer === 2);
  }
  updateHud();
  return true;
}

function limitBallSpeed() {
  const vxOk = assertThat(typeof ball.vx === 'number' && Number.isFinite(ball.vx));
  const vyOk = assertThat(typeof ball.vy === 'number' && Number.isFinite(ball.vy));
  if (!vxOk || !vyOk) {
    ball.vx = 6.8;
    ball.vy = 2.2;
    return false;
  }
  const dist = Math.hypot(ball.vx, ball.vy);
  if (!Number.isFinite(dist) || dist > 16) {
    const base = dist > 0 && Number.isFinite(dist) ? dist : 1;
    ball.vx *= 13.2 / base;
    ball.vy *= 13.2 / base;
    return false;
  }
  return true;
}

function stepBall() {
  const limited = limitBallSpeed();
  const finite = assertThat(limited === true || limited === false);
  const speedOk = assertThat(Number.isFinite(ball.vx) && Number.isFinite(ball.vy));
  if (!finite || !speedOk) {
    resetBall(undefined);
    return true;
  }
  const dist = Math.hypot(ball.vx, ball.vy);
  let steps = Math.ceil(dist / 7);
  if (!Number.isFinite(steps) || steps < 1) {
    steps = 1;
  }
  if (steps > MAX_SUBSTEPS) {
    steps = MAX_SUBSTEPS;
  }
  const sx = ball.vx / steps;
  const sy = ball.vy / steps;
  for (let i = 0; i < MAX_SUBSTEPS; i += 1) {
    if (i >= steps) {
      break;
    }
    ball.x += sx;
    ball.y += sy;
    if (ball.y - ball.r < PLAY_TOP) {
      ball.y = PLAY_TOP + ball.r;
      ball.vy = Math.abs(ball.vy);
      beep(280, 0.05);
    } else if (ball.y + ball.r > PLAY_BOTTOM) {
      ball.y = PLAY_BOTTOM - ball.r;
      ball.vy = -Math.abs(ball.vy);
      beep(280, 0.05);
    }
    if (ball.vx < 0 && hitPaddle(p1)) {
      bounceOffPaddle(p1, 1);
    } else if (ball.vx > 0 && hitPaddle(p2)) {
      bounceOffPaddle(p2, -1);
    }
    if (ball.x + ball.r < PLAY_LEFT) {
      scorePoint(2);
      return true;
    }
    if (ball.x - ball.r > PLAY_RIGHT) {
      scorePoint(1);
      return true;
    }
  }
  return false;
}

function moveHumans() {
  const liveOk = assertThat(Number.isFinite(mouseLive) && Number.isFinite(mouseLive2));
  const modeOk = assertThat(mode === 'one' || mode === 'two');
  if (!liveOk || !modeOk) {
    return false;
  }
  if (mouseLive > 0) {
    mouseLive -= 1;
  }
  if (mouseLive2 > 0) {
    mouseLive2 -= 1;
  }
  if (mouseLive === 0) {
    if (keys.w || keys.W) {
      p1.y -= p1.speed;
    }
    if (keys.s || keys.S) {
      p1.y += p1.speed;
    }
    paddleBounds(p1);
  }
  if (mode === 'two') {
    if (mouseLive2 === 0) {
      if (keys.ArrowUp) {
        p2.y -= p2.speed;
      }
      if (keys.ArrowDown) {
        p2.y += p2.speed;
      }
      paddleBounds(p2);
    }
  } else {
    updateAI();
  }
  return true;
}

function update() {
  const stateOk = assertThat(knownState(state));
  const modeOk = assertThat(mode === 'one' || mode === 'two');
  if (!stateOk || !modeOk) {
    state = STATE_MENU;
    return false;
  }
  if (state !== STATE_PLAYING) {
    return true;
  }
  moveHumans();
  if (serveHold > 0) {
    serveHold -= 1;
    return true;
  }
  if (stepBall()) {
    return true;
  }
  pushTrail(ball.x, ball.y);
  if (crowdCheer > 0) {
    crowdCheer -= 1;
  }
  return true;
}

function drawRoundRect(x, y, w, h, r) {
  const ctxOk = assertThat(ctx !== null);
  const numsOk = assertThat(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h) && Number.isFinite(r));
  if (!ctxOk || !numsOk) {
    return false;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  return true;
}

function drawPaddleWood(paddle, img) {
  const paddleOk = assertThat(paddle === p1 || paddle === p2);
  const imgOk = assertThat(img === null || img instanceof Image);
  if (!paddleOk || !imgOk || ctx === null) {
    return false;
  }
  if (img === null) {
    ctx.fillStyle = '#c4a574';
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    return true;
  }
  const tileH = paddle.w * 2.4;
  for (let n = 0; n < PADDLE_TILE_CAP; n += 1) {
    const yy = paddle.y - 4 + n * tileH;
    if (yy >= paddle.y + paddle.h + 4) {
      break;
    }
    ctx.drawImage(img, paddle.x, yy, paddle.w, tileH);
  }
  return true;
}

function drawPaddleGloss(paddle) {
  const paddleOk = assertThat(paddle === p1 || paddle === p2);
  const glossOk = assertThat(paddleGloss !== null && ctx !== null);
  if (!paddleOk || !glossOk) {
    return false;
  }
  ctx.save();
  ctx.translate(paddle.x, paddle.y);
  ctx.fillStyle = paddleGloss;
  ctx.fillRect(0, 0, paddle.w, paddle.h);
  ctx.restore();
  ctx.fillStyle = 'rgba(250,250,250,0.28)';
  ctx.fillRect(paddle.x, paddle.y + paddle.h / 2 - 11, paddle.w, 22);
  return true;
}

function drawPaddle(paddle, img) {
  const ctxOk = assertThat(ctx !== null);
  const paddleOk = assertThat(paddle === p1 || paddle === p2);
  if (!ctxOk || !paddleOk) {
    return false;
  }
  ctx.save();
  drawRoundRect(paddle.x, paddle.y, paddle.w, paddle.h, 8);
  ctx.clip();
  drawPaddleWood(paddle, img);
  drawPaddleGloss(paddle);
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  drawRoundRect(paddle.x + 0.8, paddle.y + 0.8, paddle.w - 1.6, paddle.h - 1.6, 8);
  ctx.stroke();
  return true;
}

function drawTrail() {
  const ctxOk = assertThat(ctx !== null);
  const countOk = assertThat(trailCount >= 0 && trailCount <= TRAIL_CAP);
  if (!ctxOk || !countOk || trailCount === 0) {
    return ctxOk && countOk;
  }
  const oldest = (trailNext - trailCount + TRAIL_CAP) % TRAIL_CAP;
  for (let i = 0; i < TRAIL_CAP; i += 1) {
    if (i >= trailCount) {
      break;
    }
    const slot = (oldest + i) % TRAIL_CAP;
    ctx.beginPath();
    ctx.arc(trailX[slot], trailY[slot], ball.r * (0.3 + i / 18), 0, Math.PI * 2);
    ctx.fillStyle = TRAIL_FILL[i];
    ctx.fill();
  }
  return true;
}

function drawBall() {
  const ctxOk = assertThat(ctx !== null && ballFill !== null);
  const posOk = assertThat(Number.isFinite(ball.x) && Number.isFinite(ball.y));
  if (!ctxOk || !posOk) {
    return false;
  }
  drawTrail();
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.beginPath();
  ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = ballFill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-ball.r * 0.12, 0, ball.r * 0.92, -1.2, 1.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ball.r * 0.12, 0, ball.r * 0.92, Math.PI - 1.2, Math.PI + 1.2);
  ctx.stroke();
  ctx.restore();
  return true;
}

function drawCrowdRow(row, y, h, bounce) {
  const rowOk = assertThat(row === 0 || row === 1 || row === 2);
  const sizeOk = assertThat(Number.isFinite(y) && Number.isFinite(h) && Number.isFinite(bounce) && h > 0);
  if (!rowOk || !sizeOk || ctx === null) {
    return false;
  }
  const rowH = h / CROWD_ROWS;
  const baseY = y + row * rowH + rowH * 0.38;
  const startX = PLAY_LEFT + 12 + (row % 2) * 9;
  for (let n = 0; n < CROWD_COL_CAP; n += 1) {
    const x = startX + n * 17;
    if (x >= PLAY_RIGHT - 10) {
      break;
    }
    const j = ((x * 13 + row * 7) % 5) - 2;
    const headY = baseY + j + bounce * ((x + row) % 2 === 0 ? 1 : 0.4);
    const cheerIndex = (x / 17 + (crowdCheer >> 2)) % 3;
    ctx.fillStyle = crowdCheer ? CHEER_COLORS[cheerIndex] : '#f3eee4';
    ctx.fillRect(x + 2, headY + 5, 9, rowH * 0.5);
    ctx.beginPath();
    ctx.fillStyle = SKINS[(x + row) % 5];
    ctx.arc(x + 6.5, headY, 4.6, 0, Math.PI * 2);
    ctx.fill();
  }
  return true;
}

function drawCrowd(y, h) {
  const yOk = assertThat(Number.isFinite(y) && Number.isFinite(h) && h > 0);
  const ctxOk = assertThat(ctx !== null);
  if (!yOk || !ctxOk) {
    return false;
  }
  const width = PLAY_RIGHT - PLAY_LEFT;
  ctx.fillStyle = patterns.seats ? patterns.seats : '#4b286d';
  ctx.fillRect(PLAY_LEFT, y, width, h);
  ctx.fillStyle = 'rgba(20, 8, 32, 0.28)';
  ctx.fillRect(PLAY_LEFT, y, width, h);
  const bounce = crowdCheer > 0 ? Math.sin(Date.now() / 75) * 3 : 0;
  for (let row = 0; row < CROWD_ROWS; row += 1) {
    drawCrowdRow(row, y, h, bounce);
  }
  return true;
}

function drawStripes(innerX, innerY, innerW) {
  const numsOk = assertThat(Number.isFinite(innerX) && Number.isFinite(innerY) && Number.isFinite(innerW));
  const capOk = assertThat(STRIPE_CAP === 20 && STRIPE_H === 48);
  if (!numsOk || !capOk || ctx === null) {
    return false;
  }
  for (let i = 0; i < STRIPE_CAP; i += 1) {
    const y = innerY + i * STRIPE_H;
    if (y >= PLAY_BOTTOM) {
      break;
    }
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(0,20,0,0.1)';
    ctx.fillRect(innerX, y, innerW, STRIPE_H);
  }
  return true;
}

function drawCourtMarkings(innerX, innerY, innerW, innerH) {
  const numsOk = assertThat(Number.isFinite(innerX) && Number.isFinite(innerY) && Number.isFinite(innerW) && Number.isFinite(innerH));
  const ctxOk = assertThat(ctx !== null);
  if (!numsOk || !ctxOk) {
    return false;
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.lineWidth = 4;
  ctx.strokeRect(innerX + 14, innerY + 12, innerW - 28, innerH - 24);
  ctx.strokeRect(innerX + 52, innerY + 12, innerW - 104, innerH - 24);
  ctx.beginPath();
  ctx.moveTo(W / 2, innerY + 12);
  ctx.lineTo(W / 2, PLAY_BOTTOM - 12);
  ctx.stroke();
  ctx.setLineDash(COURT_DASH);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(innerX + 52, (innerY + PLAY_BOTTOM) / 2);
  ctx.lineTo(PLAY_RIGHT - 52, (innerY + PLAY_BOTTOM) / 2);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
  return true;
}

function drawCourtLines() {
  const ctxOk = assertThat(ctx !== null);
  const readyOk = assertThat(assets.ready === true || assets.ready === false);
  if (!ctxOk || !readyOk) {
    return false;
  }
  const innerX = PLAY_LEFT;
  const innerY = PLAY_TOP;
  const innerW = PLAY_RIGHT - PLAY_LEFT;
  const innerH = PLAY_BOTTOM - PLAY_TOP;
  ctx.save();
  ctx.beginPath();
  ctx.rect(innerX, innerY, innerW, innerH);
  ctx.clip();
  ctx.fillStyle = patterns.grass ? patterns.grass : '#2e7d32';
  ctx.fillRect(innerX, innerY, innerW, innerH);
  drawStripes(innerX, innerY, innerW);
  drawCourtMarkings(innerX, innerY, innerW, innerH);
  ctx.restore();
  return true;
}

function drawNetMesh(x, top, bot) {
  const numsOk = assertThat(Number.isFinite(x) && Number.isFinite(top) && Number.isFinite(bot) && bot > top);
  const ctxOk = assertThat(ctx !== null);
  if (!numsOk || !ctxOk) {
    return false;
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1;
  for (let n = 0; n < NET_MESH_CAP; n += 1) {
    const y = top + 8 + n * 10;
    if (y >= bot - 6) {
      break;
    }
    ctx.beginPath();
    ctx.moveTo(x - 11, y);
    ctx.lineTo(x + 11, y + 5);
    ctx.stroke();
  }
  return true;
}

function drawNet() {
  const ctxOk = assertThat(ctx !== null);
  const boundsOk = assertThat(PLAY_BOTTOM > PLAY_TOP);
  if (!ctxOk || !boundsOk) {
    return false;
  }
  const x = W / 2;
  const top = PLAY_TOP;
  const bot = PLAY_BOTTOM;
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(x - 7, top - 6, 14, 16);
  ctx.fillRect(x - 7, bot - 10, 14, 16);
  ctx.fillStyle = '#f4f7f2';
  ctx.fillRect(x - 3, top, 6, bot - top);
  drawNetMesh(x, top, bot);
  ctx.fillStyle = '#efe7ff';
  ctx.fillRect(x - 5, top, 10, 7);
  ctx.fillRect(x - 5, bot - 7, 10, 7);
  return true;
}

function drawFrame() {
  const ctxOk = assertThat(ctx !== null && frameFill !== null);
  const sizeOk = assertThat(WHITE === 8);
  if (!ctxOk || !sizeOk) {
    return false;
  }
  ctx.fillStyle = '#f4f7f2';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = frameFill;
  ctx.fillRect(WHITE, WHITE, W - WHITE * 2, H - WHITE * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(WHITE + 4, WHITE + 4, W - WHITE * 2 - 8, H - WHITE * 2 - 8);
  return true;
}

function drawServe() {
  const ctxOk = assertThat(ctx !== null);
  const holdOk = assertThat(Number.isFinite(serveHold) && serveHold > 0);
  if (!ctxOk || !holdOk) {
    return false;
  }
  const mid = (PLAY_TOP + PLAY_BOTTOM) / 2;
  ctx.fillStyle = 'rgba(20,8,32,0.35)';
  ctx.fillRect(W / 2 - 120, mid - 36, 240, 72);
  ctx.fillStyle = '#f7f3ff';
  ctx.font = 'bold 34px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(serveHold > 18 ? 'Ready' : 'Play', W / 2, mid);
  return true;
}

function drawVignette() {
  const ctxOk = assertThat(ctx !== null && vignette !== null);
  const boxOk = assertThat(PLAY_RIGHT > PLAY_LEFT && PLAY_BOTTOM > PLAY_TOP);
  if (!ctxOk || !boxOk) {
    return false;
  }
  ctx.fillStyle = vignette;
  ctx.fillRect(PLAY_LEFT, PLAY_TOP, PLAY_RIGHT - PLAY_LEFT, PLAY_BOTTOM - PLAY_TOP);
  return true;
}

function draw() {
  const ctxOk = assertThat(ctx !== null);
  const stateOk = assertThat(knownState(state));
  if (!ctxOk || !stateOk) {
    return false;
  }
  ctx.clearRect(0, 0, W, H);
  drawFrame();
  drawCrowd(WHITE + PURPLE, STAND);
  drawCrowd(PLAY_BOTTOM, STAND);
  drawCourtLines();
  drawNet();
  if (state === STATE_PLAYING || state === STATE_PAUSED || state === STATE_REMATCH) {
    drawPaddle(p1, assets.woodLight);
    drawPaddle(p2, assets.woodDark);
    drawBall();
  }
  drawVignette();
  if (state === STATE_PLAYING && serveHold > 0) {
    drawServe();
  }
  syncOverlay();
  return true;
}

function onFrame() {
  const updated = update();
  const drawn = draw();
  const handle = requestAnimationFrame(onFrame);
  const scheduled = assertThat(typeof handle === 'number' && handle > 0);
  const workOk = assertThat(updated === true && drawn === true);
  return scheduled && workOk;
}

function bindDom() {
  canvas = requireElement('gameCanvas');
  overlay = requireElement('overlay');
  scoreEl = requireElement('score');
  metaEl = requireElement('meta');
  p1Label = requireElement('p1Label');
  p2Label = requireElement('p2Label');
  helpEl = requireElement('help');
  touchBar = requireElement('touchBar');
  btnPause = requireElement('btnPause');
  btnUp = requireElement('btnUp');
  btnDown = requireElement('btnDown');
  fullBtn = requireElement('fullBtn');
  courtFrame = requireElement('courtFrame');
  courtInner = requireElement('courtInner');
  winnerTitle = requireElement('winnerTitle');
  rematchLead = requireElement('rematchLead');
  const coreOk = assertThat(canvas !== null && overlay !== null && scoreEl !== null && helpEl !== null);
  const controlsOk = assertThat(btnUp !== null && btnDown !== null && btnPause !== null && fullBtn !== null);
  if (!coreOk || !controlsOk || courtFrame === null || courtInner === null || winnerTitle === null || rematchLead === null || metaEl === null || p1Label === null || p2Label === null || touchBar === null) {
    return false;
  }
  menuButtons = [requireElement('actOne'), requireElement('actTwo')];
  diffButtons = [requireElement('actAmateur'), requireElement('actTour'), requireElement('actPro'), requireElement('actBack')];
  pauseButtons = [requireElement('actResume'), requireElement('actPauseMenu')];
  rematchButtons = [requireElement('actAgain'), requireElement('actRematchMenu')];
  if (canvas.width !== W) {
    canvas.width = W;
  }
  if (canvas.height !== H) {
    canvas.height = H;
  }
  ctx = canvas.getContext('2d');
  return ctx !== null && menuButtons[0] !== null && diffButtons[3] !== null && pauseButtons[1] !== null && rematchButtons[1] !== null;
}

function bindInput() {
  const winOk = assertThat(typeof window.addEventListener === 'function');
  const canvasOk = assertThat(canvas !== null && overlay !== null && btnUp !== null && btnDown !== null);
  if (!winOk || !canvasOk || btnPause === null || fullBtn === null) {
    return false;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  btnUp.addEventListener('pointerdown', onUpPointerDown);
  window.addEventListener('pointerup', onUpPointerUp);
  window.addEventListener('pointercancel', onUpPointerUp);
  btnDown.addEventListener('pointerdown', onDownPointerDown);
  window.addEventListener('pointerup', onDownPointerUp);
  window.addEventListener('pointercancel', onDownPointerUp);
  btnPause.addEventListener('click', onPauseClick);
  fullBtn.addEventListener('click', onFullScreenClick);
  overlay.addEventListener('click', onOverlayClick);
  window.addEventListener('resize', onFitCourt);
  document.addEventListener('fullscreenchange', onFitCourt);
  const viewport = window.visualViewport;
  if (viewport !== null && viewport !== undefined && typeof viewport.addEventListener === 'function') {
    viewport.addEventListener('resize', onFitCourt);
  }
  return true;
}

function bindMedia() {
  const apiOk = assertThat(typeof window.matchMedia === 'function');
  const widthOk = assertThat(Number.isFinite(window.innerWidth));
  if (!apiOk || !widthOk) {
    return false;
  }
  try {
    coarseQuery = window.matchMedia('(pointer: coarse)');
  } catch (err) {
    coarseQuery = null;
    return err instanceof Error || typeof err === 'object';
  }
  if (coarseQuery === null || typeof coarseQuery.matches !== 'boolean') {
    return false;
  }
  coarse = coarseQuery.matches;
  return true;
}

function boot() {
  const domOk = bindDom();
  const mediaOk = bindMedia();
  if (!domOk || !mediaOk || ctx === null) {
    bail('Wimbledon Pong cannot start because the page is missing a required element.');
    return false;
  }
  const fillsOk = initFills();
  const trailOk = initTrailFill();
  if (!fillsOk || !trailOk) {
    bail('Wimbledon Pong cannot start because the drawing surface is unavailable.');
    return false;
  }
  beginAssetLoads();
  bindInput();
  resetMatch();
  overlayDirty = true;
  updateHud();
  onFitCourt();
  const fitHandle = requestAnimationFrame(onFitCourt);
  const frameHandle = requestAnimationFrame(onFrame);
  const scheduled = assertThat(typeof frameHandle === 'number' && frameHandle > 0);
  const sized = assertThat(canvas.width === W && canvas.height === H && typeof fitHandle === 'number');
  booted = scheduled && sized;
  return booted;
}

boot();
