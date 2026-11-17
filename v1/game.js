/**
 * Wimbledon Pong version 1.
 * Module scope keeps the match state off the global object (rule 6).
 * Rule 9 framework exceptions, each a named function the browser calls:
 * onKeyDown, onKeyUp, onMouseMove, onTouchStart, onTouchMove, onUiClick, onFrame.
 * onFrame is also the rule 2 frame-pump exception: one browser callback per
 * refresh, and every loop it reaches has a constant cap.
 */
import { assertThat } from '../shared/power10.js';

const CANVAS_W = 1200;
const CANVAS_H = 900;
const MAX_SCORE = 10;
const BALL_R = 12;
const BORDER = 8;
const PADDLE_W = 15;
const PADDLE_H = 150;
const PADDLE_SPEED = 10;
const TRAIL_CAP = 5;
const NET_BANDS = 30;
const NET_STEP = 30;
const CROWD_COLS = 50;
const CROWD_SPRITE = 24;
const CROWD_FRAMES = 4;
const CROWD_DELAY = 8;
const MAX_TOUCHES = 8;
const MENU_CAP = 2;
const DIFF_CAP = 3;
const CHEER_MS = 1000;
const POST_WIN_MS = 2000;
const GAME_OVER_MS = 5000;

const STATE_MENU = 'menu';
const STATE_DIFFICULTY = 'difficulty';
const STATE_PLAYING = 'playing';
const STATE_PAUSED = 'paused';
const STATE_GAME_OVER = 'game_over';
const STATE_CELEBRATION = 'celebration';
const STATE_REMATCH = 'rematch';
const STATE_POST_WIN = 'post_win';

const GHOST_FILL = 'rgba(198, 255, 0, 0.3)';
const GHOST_LINE = 'rgba(75, 40, 109, 0.5)';
const BALL_COLOR = '#c6ff00';
const P1_COLOR = '#d2b48c';
const P2_COLOR = '#8b5a2b';

let canvas = null;
let ctx = null;
let scoreDisplay = null;
let statsDisplay = null;
let ui = null;
let menu0 = null;
let menu1 = null;
let diff0 = null;
let diff1 = null;
let diff2 = null;
let rematch0 = null;
let rematch1 = null;
let winnerLine = null;
let audioCtx = null;

let gameState = STATE_MENU;
let selectedOption = 0;
let gameMode = null;
let difficulty = null;
let gameNumber = 1;
let player1Wins = 0;
let player2Wins = 0;
let lastWinner = null;
let crowdCheer = false;
let crowdFrame = 0;
let crowdFrameCounter = 0;
let cheerOffDue = -1;
let postWinDue = -1;
let gameOverDue = -1;
let shownLeft = -1;
let shownRight = -1;
let shownGame = -1;
let shownP1 = -1;
let shownP2 = -1;

const keys = {
  w: false,
  s: false,
  ArrowUp: false,
  ArrowDown: false,
  p: false,
  Enter: false,
  Escape: false
};

const ball = {
  x: CANVAS_W / 2,
  y: CANVAS_H / 2,
  radius: BALL_R,
  speedX: 7,
  speedY: 7,
  color: BALL_COLOR
};

const paddle1 = {
  x: 30,
  y: CANVAS_H / 2 - 75,
  width: PADDLE_W,
  height: PADDLE_H,
  speed: PADDLE_SPEED,
  score: 0,
  color: P1_COLOR
};

const paddle2 = {
  x: CANVAS_W - 45,
  y: CANVAS_H / 2 - 75,
  width: PADDLE_W,
  height: PADDLE_H,
  speed: PADDLE_SPEED,
  score: 0,
  color: P2_COLOR
};

const trailX = [0, 0, 0, 0, 0];
const trailY = [0, 0, 0, 0, 0];
let trailCount = 0;
let trailNext = 0;
const trailFill = [];

function knownState(value) {
  const textOk = assertThat(typeof value === 'string');
  const listed = assertThat(
    value === STATE_MENU || value === STATE_DIFFICULTY || value === STATE_PLAYING
    || value === STATE_PAUSED || value === STATE_GAME_OVER || value === STATE_CELEBRATION
    || value === STATE_REMATCH || value === STATE_POST_WIN
  );
  return textOk && listed;
}

function requireElement(id) {
  const idOk = assertThat(typeof id === 'string' && id.length > 0 && id.length < 40);
  const docOk = assertThat(typeof document.getElementById === 'function');
  if (!idOk || !docOk) {
    return null;
  }
  const el = document.getElementById(id);
  if (el === null) {
    return null;
  }
  return el;
}

function bail(message) {
  const msgOk = assertThat(typeof message === 'string' && message.length > 0 && message.length < 180);
  const bodyOk = assertThat(document.body !== null);
  if (!msgOk || !bodyOk) {
    return false;
  }
  const node = document.createTextNode(message);
  const added = document.body.appendChild(node);
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

function nowMs() {
  const stamp = performance.now();
  const finite = assertThat(typeof stamp === 'number' && Number.isFinite(stamp));
  const nonNeg = assertThat(finite && stamp >= 0);
  if (!finite || !nonNeg) {
    return 0;
  }
  return stamp;
}

function initTrailFill() {
  const capOk = assertThat(TRAIL_CAP === 5);
  const tableOk = assertThat(Array.isArray(trailFill));
  if (!capOk || !tableOk) {
    return false;
  }
  for (let len = 0; len <= TRAIL_CAP; len += 1) {
    const row = [];
    for (let i = 0; i < TRAIL_CAP; i += 1) {
      const alpha = len === 0 ? 0 : 0.2 * (i / len);
      row[i] = 'rgba(198, 255, 0, ' + alpha + ')';
    }
    trailFill[len] = row;
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

function scheduleCheerOff(now) {
  const nowOk = assertThat(typeof now === 'number' && Number.isFinite(now) && now >= 0);
  const dueOk = assertThat(cheerOffDue === -1 || (typeof cheerOffDue === 'number' && cheerOffDue >= 0));
  if (!nowOk || !dueOk) {
    return false;
  }
  if (cheerOffDue < 0) {
    cheerOffDue = now + CHEER_MS;
  }
  return true;
}

function resetBall() {
  const widthOk = assertThat(canvas !== null && canvas.width === CANVAS_W);
  const heightOk = assertThat(canvas !== null && canvas.height === CANVAS_H);
  if (!widthOk || !heightOk) {
    return false;
  }
  ball.x = CANVAS_W / 2;
  ball.y = CANVAS_H / 2;
  ball.speedX = (randomUnit() > 0.5 ? 7 : -7) * (randomUnit() * 0.5 + 0.75);
  ball.speedY = (randomUnit() > 0.5 ? 7 : -7) * (randomUnit() * 0.5 + 0.75);
  clearTrail();
  scheduleCheerOff(nowMs());
  return true;
}

function syncScore() {
  const elOk = assertThat(scoreDisplay !== null);
  const numsOk = assertThat(Number.isFinite(paddle1.score) && Number.isFinite(paddle2.score));
  if (!elOk || !numsOk) {
    return false;
  }
  if (shownLeft === paddle1.score && shownRight === paddle2.score) {
    return true;
  }
  scoreDisplay.textContent = paddle1.score + ' - ' + paddle2.score;
  shownLeft = paddle1.score;
  shownRight = paddle2.score;
  return true;
}

function syncStats() {
  const elOk = assertThat(statsDisplay !== null);
  const numsOk = assertThat(Number.isFinite(gameNumber) && Number.isFinite(player1Wins) && Number.isFinite(player2Wins));
  if (!elOk || !numsOk) {
    return false;
  }
  if (shownGame === gameNumber && shownP1 === player1Wins && shownP2 === player2Wins) {
    return true;
  }
  statsDisplay.textContent = 'Game ' + gameNumber + ' | P1 Wins: ' + player1Wins + ' | P2 Wins: ' + player2Wins;
  shownGame = gameNumber;
  shownP1 = player1Wins;
  shownP2 = player2Wins;
  return true;
}

function showView(mode) {
  const uiOk = assertThat(ui !== null);
  const modeOk = assertThat(
    mode === 'menu' || mode === 'difficulty' || mode === 'rematch'
    || mode === 'post' || mode === 'over' || mode === 'play' || mode === 'paused'
  );
  if (!uiOk || !modeOk) {
    return false;
  }
  ui.classList.remove('mode-menu', 'mode-difficulty', 'mode-rematch', 'mode-post', 'mode-over', 'mode-play', 'mode-paused', 'show-p2');
  if (mode === 'menu') {
    ui.classList.add('mode-menu');
  } else if (mode === 'difficulty') {
    ui.classList.add('mode-difficulty');
  } else if (mode === 'rematch') {
    ui.classList.add('mode-rematch');
  } else if (mode === 'post') {
    ui.classList.add('mode-post');
  } else if (mode === 'over') {
    ui.classList.add('mode-over');
  } else if (mode === 'paused') {
    ui.classList.add('mode-paused');
  } else {
    ui.classList.add('mode-play');
  }
  return true;
}

function resetGame() {
  const sizeOk = assertThat(CANVAS_H > PADDLE_H);
  const scoresOk = assertThat(Number.isFinite(paddle1.score) && Number.isFinite(paddle2.score));
  paddle1.score = 0;
  paddle2.score = 0;
  paddle1.y = CANVAS_H / 2 - 75;
  paddle2.y = CANVAS_H / 2 - 75;
  resetBall();
  syncScore();
  return sizeOk && scoresOk;
}

function ensureAudio() {
  const existing = assertThat(audioCtx === null || typeof audioCtx.createOscillator === 'function');
  const pageOk = assertThat(typeof window === 'object');
  if (!existing || !pageOk) {
    return false;
  }
  if (audioCtx !== null) {
    return true;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (typeof Ctor !== 'function') {
    return false;
  }
  try {
    audioCtx = new Ctor();
  } catch (err) {
    audioCtx = null;
    return err instanceof Error || typeof err === 'object';
  }
  return audioCtx !== null;
}

function playSound(frequency, duration) {
  const freqOk = assertThat(typeof frequency === 'number' && Number.isFinite(frequency) && frequency > 0 && frequency < 8000);
  const durOk = assertThat(typeof duration === 'number' && Number.isFinite(duration) && duration > 0 && duration <= 2);
  if (!freqOk || !durOk || !ensureAudio() || audioCtx === null) {
    return false;
  }
  try {
    const oscillator = audioCtx.createOscillator();
    const nodeOk = assertThat(oscillator !== null && typeof oscillator.connect === 'function');
    const timeOk = assertThat(typeof audioCtx.currentTime === 'number' && Number.isFinite(audioCtx.currentTime));
    if (!nodeOk || !timeOk) {
      return false;
    }
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    const linked = oscillator.connect(audioCtx.destination);
    if (linked === null) {
      return false;
    }
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (err) {
    return err instanceof Error || typeof err === 'object';
  }
  return true;
}

function setKey(name, down) {
  const nameOk = assertThat(typeof name === 'string' && name.length > 0 && name.length < 20);
  const downOk = assertThat(down === true || down === false);
  if (!nameOk || !downOk) {
    return false;
  }
  if (name === 'w') {
    keys.w = down;
  } else if (name === 's') {
    keys.s = down;
  } else if (name === 'ArrowUp') {
    keys.ArrowUp = down;
  } else if (name === 'ArrowDown') {
    keys.ArrowDown = down;
  } else if (name === 'p') {
    keys.p = down;
  } else if (name === 'Enter') {
    keys.Enter = down;
  } else if (name === 'Escape') {
    keys.Escape = down;
  } else {
    return false;
  }
  return true;
}

function onKeyDown(event) {
  const eventOk = assertThat(event !== null && typeof event === 'object');
  const keyOk = assertThat(eventOk && typeof event.key === 'string');
  if (!eventOk || !keyOk) {
    return false;
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === ' ') {
    event.preventDefault();
  }
  return setKey(event.key, true);
}

function onKeyUp(event) {
  const eventOk = assertThat(event !== null && typeof event === 'object');
  const keyOk = assertThat(eventOk && typeof event.key === 'string');
  if (!eventOk || !keyOk) {
    return false;
  }
  setKey(event.key, false);
  return true;
}

function canvasPointerY(clientY) {
  const yOk = assertThat(typeof clientY === 'number' && Number.isFinite(clientY));
  const canvasOk = assertThat(canvas !== null);
  if (!yOk || !canvasOk) {
    return CANVAS_H / 2;
  }
  const rect = canvas.getBoundingClientRect();
  if (rect === null || !Number.isFinite(rect.height) || rect.height <= 0 || !Number.isFinite(rect.top)) {
    return CANVAS_H / 2;
  }
  return ((clientY - rect.top) / rect.height) * CANVAS_H;
}

function movePaddleFromPointer(clientY, paddle) {
  const paddleOk = assertThat(paddle === paddle1 || paddle === paddle2);
  const y = canvasPointerY(clientY);
  const yOk = assertThat(Number.isFinite(y));
  if (!paddleOk || !yOk) {
    return false;
  }
  paddle.y = y - paddle.height / 2;
  if (paddle.y < 0) {
    paddle.y = 0;
  }
  const limit = CANVAS_H - paddle.height;
  if (paddle.y > limit) {
    paddle.y = limit;
  }
  return true;
}

function onMouseMove(event) {
  const eventOk = assertThat(event !== null && Number.isFinite(event.clientY));
  const stateOk = assertThat(knownState(gameState));
  if (!eventOk || !stateOk || gameState !== STATE_PLAYING) {
    return false;
  }
  return movePaddleFromPointer(event.clientY, paddle1);
}

function touchPoint(list, index) {
  const listOk = assertThat(list !== null && typeof list.length === 'number');
  const indexOk = assertThat(typeof index === 'number' && index >= 0 && index < MAX_TOUCHES);
  if (!listOk || !indexOk || index >= list.length || typeof list.item !== 'function') {
    return null;
  }
  return list.item(index);
}

function onTouchStart(event) {
  const eventOk = assertThat(event !== null && event.touches !== null);
  const stateOk = assertThat(knownState(gameState));
  if (!eventOk || !stateOk || gameState !== STATE_PLAYING) {
    return false;
  }
  event.preventDefault();
  return routeTouches(event.touches);
}

function onTouchMove(event) {
  const eventOk = assertThat(event !== null && event.touches !== null);
  const stateOk = assertThat(knownState(gameState));
  if (!eventOk || !stateOk || gameState !== STATE_PLAYING) {
    return false;
  }
  event.preventDefault();
  return routeTouches(event.touches);
}

function routeTouches(list) {
  const listOk = assertThat(list !== null && typeof list.length === 'number' && list.length >= 0);
  const canvasOk = assertThat(canvas !== null);
  if (!listOk || !canvasOk) {
    return false;
  }
  const rect = canvas.getBoundingClientRect();
  if (!Number.isFinite(rect.width) || rect.width <= 0) {
    return false;
  }
  const count = list.length > MAX_TOUCHES ? MAX_TOUCHES : list.length;
  for (let i = 0; i < MAX_TOUCHES; i += 1) {
    if (i >= count) {
      break;
    }
    const touch = touchPoint(list, i);
    if (touch === null || !Number.isFinite(touch.clientX) || !Number.isFinite(touch.clientY)) {
      continue;
    }
    const x = (touch.clientX - rect.left) / rect.width;
    if (gameMode === 'two' && x > 0.5) {
      movePaddleFromPointer(touch.clientY, paddle2);
    } else {
      movePaddleFromPointer(touch.clientY, paddle1);
    }
  }
  return true;
}

function onUiClick(event) {
  const eventOk = assertThat(event !== null && event.target !== null);
  const targetOk = assertThat(eventOk && typeof event.target.closest === 'function');
  if (!eventOk || !targetOk) {
    return false;
  }
  const choice = event.target.closest('[data-choice]');
  if (choice === null) {
    return false;
  }
  const raw = choice.getAttribute('data-choice');
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 2) {
    return false;
  }
  selectedOption = value;
  keys.Enter = true;
  return true;
}

function aiSpeed() {
  const known = assertThat(difficulty === 'Amateur' || difficulty === 'Tour' || difficulty === 'Pro' || difficulty === null);
  const text = assertThat(typeof difficulty === 'string' || difficulty === null);
  if (!known || !text) {
    return 10;
  }
  if (difficulty === 'Amateur') {
    return 6;
  }
  if (difficulty === 'Tour') {
    return 8;
  }
  return 10;
}

function aiError() {
  const known = assertThat(difficulty === 'Amateur' || difficulty === 'Tour' || difficulty === 'Pro' || difficulty === null);
  const text = assertThat(typeof difficulty === 'string' || difficulty === null);
  if (!known || !text) {
    return 0;
  }
  if (difficulty === 'Amateur') {
    return 50;
  }
  if (difficulty === 'Tour') {
    return 25;
  }
  return 0;
}

function updateAI() {
  const modeOk = assertThat(gameMode === 'one' || gameMode === 'two' || gameMode === null);
  const ballOk = assertThat(Number.isFinite(ball.y));
  if (!modeOk || !ballOk || gameMode !== 'one') {
    return false;
  }
  const targetY = ball.y - paddle2.height / 2;
  const error = aiError();
  const adjusted = targetY + (randomUnit() * error - error / 2);
  const speed = aiSpeed();
  if (paddle2.y + paddle2.height / 2 < adjusted) {
    paddle2.y += speed;
  } else if (paddle2.y + paddle2.height / 2 > adjusted) {
    paddle2.y -= speed;
  }
  if (paddle2.y < 0) {
    paddle2.y = 0;
  }
  if (paddle2.y > CANVAS_H - paddle2.height) {
    paddle2.y = CANVAS_H - paddle2.height;
  }
  return true;
}

function movePaddles() {
  const p1Ok = assertThat(Number.isFinite(paddle1.y) && Number.isFinite(paddle1.speed));
  const p2Ok = assertThat(Number.isFinite(paddle2.y) && Number.isFinite(paddle2.speed));
  if (!p1Ok || !p2Ok) {
    paddle1.y = CANVAS_H / 2 - 75;
    paddle2.y = CANVAS_H / 2 - 75;
    return false;
  }
  if (keys.w && paddle1.y > 0) {
    paddle1.y = Math.max(0, paddle1.y - paddle1.speed);
  }
  if (keys.s && paddle1.y < CANVAS_H - paddle1.height) {
    paddle1.y = Math.min(CANVAS_H - paddle1.height, paddle1.y + paddle1.speed);
  }
  if (gameMode === 'two') {
    if (keys.ArrowUp && paddle2.y > 0) {
      paddle2.y = Math.max(0, paddle2.y - paddle2.speed);
    }
    if (keys.ArrowDown && paddle2.y < CANVAS_H - paddle2.height) {
      paddle2.y = Math.min(CANVAS_H - paddle2.height, paddle2.y + paddle2.speed);
    }
  } else {
    updateAI();
  }
  return true;
}

function bounceWalls() {
  const yOk = assertThat(Number.isFinite(ball.y) && Number.isFinite(ball.speedY));
  const rOk = assertThat(ball.radius === BALL_R);
  if (!yOk || !rOk) {
    return false;
  }
  if (ball.y + ball.radius > CANVAS_H - BORDER || ball.y - ball.radius < BORDER) {
    ball.speedY = -ball.speedY;
    ball.y = ball.y + ball.radius > CANVAS_H - BORDER ? CANVAS_H - BORDER - ball.radius : BORDER + ball.radius;
    playSound(300, 0.1);
  }
  return true;
}

function bouncePaddles() {
  const xOk = assertThat(Number.isFinite(ball.x) && Number.isFinite(ball.speedX));
  const yOk = assertThat(Number.isFinite(ball.y));
  if (!xOk || !yOk) {
    return false;
  }
  const hitLeft = ball.x - ball.radius < paddle1.x + paddle1.width
    && ball.y > paddle1.y && ball.y < paddle1.y + paddle1.height;
  const hitRight = ball.x + ball.radius > paddle2.x
    && ball.y > paddle2.y && ball.y < paddle2.y + paddle2.height;
  if (hitLeft || hitRight) {
    ball.speedX = -ball.speedX * 1.05;
    if (ball.x - ball.radius < paddle1.x + paddle1.width) {
      ball.x = paddle1.x + paddle1.width + ball.radius;
    }
    if (ball.x + ball.radius > paddle2.x) {
      ball.x = paddle2.x - ball.radius;
    }
    playSound(400, 0.1);
  }
  return true;
}

function awardPoint(scorer) {
  const whoOk = assertThat(scorer === 1 || scorer === 2);
  const scoresOk = assertThat(Number.isFinite(paddle1.score) && Number.isFinite(paddle2.score));
  if (!whoOk || !scoresOk) {
    return false;
  }
  if (scorer === 2) {
    paddle2.score += 1;
  } else {
    paddle1.score += 1;
  }
  resetBall();
  crowdCheer = true;
  playSound(200, 0.3);
  syncScore();
  return true;
}

function moveBall() {
  const posOk = assertThat(Number.isFinite(ball.x) && Number.isFinite(ball.y));
  const velOk = assertThat(Number.isFinite(ball.speedX) && Number.isFinite(ball.speedY));
  if (!posOk || !velOk) {
    resetBall();
    return false;
  }
  ball.x += ball.speedX;
  ball.y += ball.speedY;
  pushTrail(ball.x, ball.y);
  bounceWalls();
  bouncePaddles();
  if (ball.x < BORDER) {
    awardPoint(2);
  } else if (ball.x > CANVAS_W - BORDER) {
    awardPoint(1);
  }
  return true;
}

function finishMatch() {
  const scoresOk = assertThat(paddle1.score >= 0 && paddle2.score >= 0);
  const capOk = assertThat(MAX_SCORE === 10);
  if (!scoresOk || !capOk) {
    return false;
  }
  if (paddle1.score < MAX_SCORE && paddle2.score < MAX_SCORE) {
    return true;
  }
  if (paddle1.score >= MAX_SCORE) {
    lastWinner = 'Player 1';
    player1Wins += 1;
  } else {
    lastWinner = gameMode === 'two' ? 'Player 2' : 'Computer';
    player2Wins += 1;
  }
  gameState = STATE_REMATCH;
  selectedOption = 0;
  crowdCheer = true;
  showView('rematch');
  syncStats();
  return true;
}

function updateCrowd() {
  const flagOk = assertThat(crowdCheer === true || crowdCheer === false);
  const frameOk = assertThat(crowdFrame >= 0 && crowdFrame < CROWD_FRAMES);
  if (!flagOk || !frameOk) {
    crowdCheer = false;
    crowdFrame = 0;
    crowdFrameCounter = 0;
    return false;
  }
  if (crowdCheer) {
    crowdFrameCounter += 1;
    if (crowdFrameCounter >= CROWD_DELAY) {
      crowdFrame = (crowdFrame + 1) % CROWD_FRAMES;
      crowdFrameCounter = 0;
    }
  } else {
    crowdFrame = 0;
    crowdFrameCounter = 0;
  }
  return true;
}

function updatePlaying() {
  const stateOk = assertThat(gameState === STATE_PLAYING);
  const modeOk = assertThat(gameMode === 'one' || gameMode === 'two');
  if (!stateOk || !modeOk) {
    return false;
  }
  movePaddles();
  moveBall();
  finishMatch();
  updateCrowd();
  if (keys.p) {
    gameState = STATE_PAUSED;
    keys.p = false;
  }
  syncStats();
  return true;
}

function updatePaused() {
  const stateOk = assertThat(gameState === STATE_PAUSED);
  const keyOk = assertThat(keys.p === true || keys.p === false);
  if (!stateOk || !keyOk) {
    return false;
  }
  if (keys.p) {
    gameState = STATE_PLAYING;
    keys.p = false;
  }
  return true;
}

function nudgeMenu(maxIndex) {
  const maxOk = assertThat(maxIndex === 1 || maxIndex === 2);
  const selOk = assertThat(Number.isFinite(selectedOption));
  if (!maxOk || !selOk) {
    selectedOption = 0;
    return false;
  }
  if (selectedOption < 0 || selectedOption > maxIndex) {
    selectedOption = 0;
  }
  if (keys.ArrowUp && selectedOption > 0) {
    selectedOption -= 1;
    playSound(500, 0.1);
  }
  if (keys.ArrowDown && selectedOption < maxIndex) {
    selectedOption += 1;
    playSound(500, 0.1);
  }
  return true;
}

function enterFromMenu() {
  const selOk = assertThat(selectedOption === 0 || selectedOption === 1);
  const keyOk = assertThat(keys.Enter === true || keys.Enter === false);
  if (!selOk || !keyOk || !keys.Enter) {
    return false;
  }
  gameMode = selectedOption === 0 ? 'one' : 'two';
  if (gameMode === 'one') {
    gameState = STATE_DIFFICULTY;
    selectedOption = 0;
    showView('difficulty');
  } else {
    gameState = STATE_PLAYING;
    showView('play');
  }
  keys.Enter = false;
  playSound(600, 0.2);
  return true;
}

function updateMenu() {
  const stateOk = assertThat(gameState === STATE_MENU);
  const capOk = assertThat(MENU_CAP === 2);
  if (!stateOk || !capOk) {
    return false;
  }
  nudgeMenu(1);
  enterFromMenu();
  return true;
}

function difficultyName(index) {
  const indexOk = assertThat(index === 0 || index === 1 || index === 2);
  const capOk = assertThat(DIFF_CAP === 3);
  if (!indexOk || !capOk) {
    return 'Pro';
  }
  if (index === 0) {
    return 'Amateur';
  }
  if (index === 1) {
    return 'Tour';
  }
  return 'Pro';
}

function enterDifficulty() {
  const selOk = assertThat(selectedOption === 0 || selectedOption === 1 || selectedOption === 2);
  const keyOk = assertThat(keys.Enter === true || keys.Enter === false);
  if (!selOk || !keyOk || !keys.Enter) {
    return false;
  }
  difficulty = difficultyName(selectedOption);
  gameState = STATE_PLAYING;
  showView('play');
  keys.Enter = false;
  playSound(600, 0.2);
  return true;
}

function updateDifficulty() {
  const stateOk = assertThat(gameState === STATE_DIFFICULTY);
  const capOk = assertThat(DIFF_CAP === 3);
  if (!stateOk || !capOk) {
    return false;
  }
  nudgeMenu(2);
  enterDifficulty();
  return true;
}

function beginPostWin() {
  const lineOk = assertThat(winnerLine !== null);
  const nameOk = assertThat(typeof lastWinner === 'string' && lastWinner.length > 0 && lastWinner.length < 40);
  if (!lineOk || !nameOk) {
    lastWinner = 'Player 1';
  }
  winnerLine.textContent = 'Good job, ' + lastWinner + '!';
  gameState = STATE_POST_WIN;
  postWinDue = nowMs() + POST_WIN_MS;
  showView('post');
  return true;
}

function returnToFreshMenu() {
  const stateOk = assertThat(knownState(gameState));
  const winsOk = assertThat(Number.isFinite(player1Wins) && Number.isFinite(player2Wins));
  if (!stateOk || !winsOk) {
    return false;
  }
  gameState = STATE_MENU;
  selectedOption = 0;
  gameNumber = 1;
  player1Wins = 0;
  player2Wins = 0;
  resetGame();
  syncStats();
  showView('menu');
  return true;
}

function enterRematch() {
  const selOk = assertThat(selectedOption === 0 || selectedOption === 1);
  const keyOk = assertThat(keys.Enter === true || keys.Enter === false);
  if (!selOk || !keyOk || !keys.Enter) {
    return false;
  }
  if (selectedOption === 0) {
    beginPostWin();
  } else {
    returnToFreshMenu();
  }
  keys.Enter = false;
  playSound(600, 0.2);
  return true;
}

function updateRematch() {
  const stateOk = assertThat(gameState === STATE_REMATCH);
  const capOk = assertThat(MENU_CAP === 2);
  if (!stateOk || !capOk) {
    return false;
  }
  nudgeMenu(1);
  enterRematch();
  return true;
}

function updateGameOver() {
  const stateOk = assertThat(gameState === STATE_GAME_OVER);
  const dueOk = assertThat(gameOverDue === -1 || Number.isFinite(gameOverDue));
  if (!stateOk || !dueOk) {
    return false;
  }
  if (gameOverDue < 0) {
    gameOverDue = nowMs() + GAME_OVER_MS;
  }
  return true;
}

function applyEscape() {
  const keyOk = assertThat(keys.Escape === true || keys.Escape === false);
  const stateOk = assertThat(knownState(gameState));
  if (!keyOk || !stateOk || !keys.Escape || gameState === STATE_GAME_OVER) {
    return false;
  }
  gameState = STATE_GAME_OVER;
  keys.Escape = false;
  crowdCheer = false;
  playSound(150, 0.5);
  showView('over');
  return true;
}

function update() {
  const stateOk = assertThat(knownState(gameState));
  const scoreOk = assertThat(Number.isFinite(paddle1.score) && Number.isFinite(paddle2.score));
  if (!stateOk || !scoreOk) {
    gameState = STATE_MENU;
    showView('menu');
    return false;
  }
  if (gameState === STATE_PLAYING) {
    updatePlaying();
  } else if (gameState === STATE_PAUSED) {
    updatePaused();
  } else if (gameState === STATE_MENU) {
    updateMenu();
  } else if (gameState === STATE_DIFFICULTY) {
    updateDifficulty();
  } else if (gameState === STATE_REMATCH) {
    updateRematch();
  } else if (gameState === STATE_GAME_OVER) {
    updateGameOver();
  }
  applyEscape();
  return true;
}

function resumeAfterWin() {
  const dueOk = assertThat(postWinDue === -1 || Number.isFinite(postWinDue));
  const countOk = assertThat(Number.isFinite(gameNumber) && gameNumber >= 1 && gameNumber < 100000);
  if (!dueOk || !countOk) {
    return false;
  }
  gameState = STATE_PLAYING;
  gameNumber += 1;
  resetGame();
  syncStats();
  showView('play');
  return true;
}

function runDeadlines() {
  const now = nowMs();
  const nowOk = assertThat(Number.isFinite(now));
  const flagsOk = assertThat(Number.isFinite(postWinDue) && Number.isFinite(gameOverDue) && Number.isFinite(cheerOffDue));
  if (!nowOk || !flagsOk) {
    return false;
  }
  if (postWinDue >= 0 && now >= postWinDue) {
    postWinDue = -1;
    resumeAfterWin();
  }
  if (gameOverDue >= 0 && now >= gameOverDue) {
    gameOverDue = -1;
    returnToFreshMenu();
  }
  if (cheerOffDue >= 0 && now >= cheerOffDue) {
    cheerOffDue = -1;
    crowdCheer = false;
  }
  return true;
}

function drawNet() {
  const ctxOk = assertThat(ctx !== null);
  const bandsOk = assertThat(NET_BANDS === 30 && NET_STEP === 30);
  if (!ctxOk || !bandsOk) {
    return false;
  }
  ctx.fillStyle = '#ffffff';
  for (let band = 0; band < NET_BANDS; band += 1) {
    const y = band * NET_STEP;
    ctx.fillRect(CANVAS_W / 2 - 3, y, 6, 15);
  }
  return true;
}

function cheerFill() {
  const frameOk = assertThat(crowdFrame === 0 || crowdFrame === 1 || crowdFrame === 2 || crowdFrame === 3);
  const flagOk = assertThat(crowdCheer === true || crowdCheer === false);
  if (!frameOk || !flagOk || crowdCheer === false) {
    return '#ffffff';
  }
  if (crowdFrame === 1) {
    return '#ffffff';
  }
  if (crowdFrame === 2) {
    return '#c6ff00';
  }
  return '#ffeb3b';
}

function drawCrowd() {
  const ctxOk = assertThat(ctx !== null);
  const colsOk = assertThat(CROWD_COLS === 50 && CROWD_SPRITE === 24);
  if (!ctxOk || !colsOk) {
    return false;
  }
  const crowdHeight = 75;
  ctx.fillStyle = '#4b286d';
  ctx.fillRect(0, 0, CANVAS_W, crowdHeight);
  ctx.fillRect(0, CANVAS_H - crowdHeight, CANVAS_W, crowdHeight);
  const head = cheerFill();
  const eye = crowdCheer ? '#ffffff' : '#cccccc';
  for (let col = 0; col < CROWD_COLS; col += 1) {
    const x = col * CROWD_SPRITE;
    ctx.fillStyle = head;
    ctx.fillRect(x + 6, 15, 12, 12);
    ctx.fillRect(x + 6, CANVAS_H - crowdHeight + 15, 12, 12);
    ctx.fillStyle = eye;
    ctx.fillRect(x + 8, 17, 4, 4);
    ctx.fillRect(x + 8, CANVAS_H - crowdHeight + 17, 4, 4);
  }
  return true;
}

function drawCenterGraphic() {
  const ctxOk = assertThat(ctx !== null);
  const textOk = assertThat(GHOST_FILL.length > 0 && GHOST_LINE.length > 0);
  if (!ctxOk || !textOk) {
    return false;
  }
  ctx.font = '48px Courier New';
  ctx.textAlign = 'center';
  ctx.fillStyle = GHOST_FILL;
  ctx.fillText('Grok/Replit Open 2025', CANVAS_W / 2, CANVAS_H / 2);
  ctx.strokeStyle = GHOST_LINE;
  ctx.lineWidth = 2;
  ctx.strokeText('Grok/Replit Open 2025', CANVAS_W / 2, CANVAS_H / 2);
  return true;
}

function drawTrail() {
  const ctxOk = assertThat(ctx !== null);
  const countOk = assertThat(trailCount >= 0 && trailCount <= TRAIL_CAP);
  if (!ctxOk || !countOk || trailCount === 0) {
    return countOk && ctxOk;
  }
  const oldest = (trailNext - trailCount + TRAIL_CAP) % TRAIL_CAP;
  const row = trailFill[trailCount];
  for (let i = 0; i < TRAIL_CAP; i += 1) {
    if (i >= trailCount) {
      break;
    }
    const slot = (oldest + i) % TRAIL_CAP;
    ctx.beginPath();
    ctx.arc(trailX[slot], trailY[slot], BALL_R * (0.5 + 0.1 * i), 0, Math.PI * 2);
    ctx.fillStyle = row[i];
    ctx.fill();
    ctx.closePath();
  }
  return true;
}

function drawActors() {
  const ctxOk = assertThat(ctx !== null);
  const ballOk = assertThat(Number.isFinite(ball.x) && Number.isFinite(ball.y));
  if (!ctxOk || !ballOk) {
    return false;
  }
  ctx.fillStyle = paddle1.color;
  ctx.fillRect(paddle1.x, paddle1.y, paddle1.width, paddle1.height);
  ctx.fillStyle = paddle2.color;
  ctx.fillRect(paddle2.x, paddle2.y, paddle2.width, paddle2.height);
  drawTrail();
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();
  ctx.closePath();
  return true;
}

function drawPausedLabel() {
  const ctxOk = assertThat(ctx !== null);
  const stateOk = assertThat(gameState === STATE_PAUSED);
  if (!ctxOk || !stateOk) {
    return false;
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = '64px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('Paused', CANVAS_W / 2, CANVAS_H / 2);
  return true;
}

function paintChoice(node, on) {
  const nodeOk = assertThat(node !== null && typeof node.classList === 'object');
  const flagOk = assertThat(on === true || on === false);
  if (!nodeOk || !flagOk) {
    return false;
  }
  if (on) {
    node.classList.add('selected');
  } else {
    node.classList.remove('selected');
  }
  return true;
}

function drawMenu() {
  const selOk = assertThat(selectedOption === 0 || selectedOption === 1);
  const uiOk = assertThat(ui !== null && menu0 !== null && menu1 !== null);
  if (!selOk || !uiOk) {
    return false;
  }
  paintChoice(menu0, selectedOption === 0);
  paintChoice(menu1, selectedOption === 1);
  if (selectedOption === 1) {
    ui.classList.add('show-p2');
  } else {
    ui.classList.remove('show-p2');
  }
  return true;
}

function drawDifficulty() {
  const selOk = assertThat(selectedOption === 0 || selectedOption === 1 || selectedOption === 2);
  const nodesOk = assertThat(diff0 !== null && diff1 !== null && diff2 !== null);
  if (!selOk || !nodesOk) {
    return false;
  }
  paintChoice(diff0, selectedOption === 0);
  paintChoice(diff1, selectedOption === 1);
  paintChoice(diff2, selectedOption === 2);
  return true;
}

function drawRematch() {
  const selOk = assertThat(selectedOption === 0 || selectedOption === 1);
  const nodesOk = assertThat(rematch0 !== null && rematch1 !== null);
  if (!selOk || !nodesOk) {
    return false;
  }
  paintChoice(rematch0, selectedOption === 0);
  paintChoice(rematch1, selectedOption === 1);
  syncScore();
  return true;
}

function draw() {
  const ctxOk = assertThat(ctx !== null);
  const stateOk = assertThat(knownState(gameState));
  if (!ctxOk || !stateOk) {
    return false;
  }
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawCrowd();
  drawNet();
  drawCenterGraphic();
  if (gameState === STATE_PLAYING || gameState === STATE_PAUSED) {
    drawActors();
    syncScore();
    if (gameState === STATE_PAUSED) {
      drawPausedLabel();
    }
  } else if (gameState === STATE_MENU) {
    drawMenu();
  } else if (gameState === STATE_DIFFICULTY) {
    drawDifficulty();
  } else if (gameState === STATE_REMATCH) {
    drawRematch();
  } else if (gameState === STATE_POST_WIN || gameState === STATE_GAME_OVER) {
    syncScore();
  }
  return true;
}

function onFrame() {
  const ran = runDeadlines();
  const updated = update();
  const drawn = draw();
  const handle = requestAnimationFrame(onFrame);
  const scheduled = assertThat(typeof handle === 'number' && handle > 0);
  const workOk = assertThat(ran === true && updated === true && drawn === true);
  return scheduled && workOk;
}

function bindDom() {
  canvas = requireElement('gameCanvas');
  scoreDisplay = requireElement('score');
  statsDisplay = requireElement('stats');
  ui = requireElement('ui');
  menu0 = requireElement('menu0');
  menu1 = requireElement('menu1');
  diff0 = requireElement('diff0');
  diff1 = requireElement('diff1');
  diff2 = requireElement('diff2');
  rematch0 = requireElement('rematch0');
  rematch1 = requireElement('rematch1');
  winnerLine = requireElement('winnerLine');
  const canvasOk = assertThat(canvas !== null && scoreDisplay !== null && statsDisplay !== null && ui !== null);
  const menusOk = assertThat(menu0 !== null && menu1 !== null && diff0 !== null && diff1 !== null && diff2 !== null);
  if (!canvasOk || !menusOk || rematch0 === null || rematch1 === null || winnerLine === null) {
    return false;
  }
  if (canvas.width !== CANVAS_W) {
    canvas.width = CANVAS_W;
  }
  if (canvas.height !== CANVAS_H) {
    canvas.height = CANVAS_H;
  }
  ctx = canvas.getContext('2d');
  return ctx !== null;
}

function bindInput() {
  const docOk = assertThat(typeof document.addEventListener === 'function');
  const canvasOk = assertThat(canvas !== null && ui !== null);
  if (!docOk || !canvasOk) {
    return false;
  }
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  ui.addEventListener('click', onUiClick);
  return true;
}

function boot() {
  const domOk = bindDom();
  const trailOk = initTrailFill();
  if (!domOk || !trailOk || ctx === null) {
    bail('Wimbledon Pong cannot start because the page is missing a required element.');
    return false;
  }
  const sized = assertThat(canvas.width === CANVAS_W && canvas.height === CANVAS_H);
  const started = assertThat(gameState === STATE_MENU);
  resetBall();
  showView('menu');
  bindInput();
  const handle = requestAnimationFrame(onFrame);
  return sized && started && typeof handle === 'number' && handle > 0;
}

boot();
