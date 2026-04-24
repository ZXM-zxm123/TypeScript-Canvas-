/**
 * @typedef {'up' | 'down' | 'left' | 'right'} Direction
 * @typedef {{ x: number; y: number }} Point
 * @typedef {{ name: string; canvasBackground: string; gridColor: string; snakeHead: string; snakeBody: string; food: string; obstacle: string }} GameTheme
 * @typedef {'idle' | 'playing' | 'paused' | 'gameover'} GameStatus
 */

/** @type {Record<string, GameTheme>} */
const themes = {
  classic: {
    name: '经典主题',
    canvasBackground: '#e8f5e9',
    gridColor: 'rgba(0, 128, 0, 0.1)',
    snakeHead: '#2e7d32',
    snakeBody: '#4caf50',
    food: '#f44336',
    obstacle: '#795548'
  },
  dark: {
    name: '暗夜主题',
    canvasBackground: '#0f0f23',
    gridColor: 'rgba(100, 200, 255, 0.05)',
    snakeHead: '#00d4ff',
    snakeBody: '#0097a7',
    food: '#ff4081',
    obstacle: '#ff5722'
  }
};

class Snake {
  /**
   * @param {number} initialLength
   * @param {number} startX
   * @param {number} startY
   */
  constructor(initialLength = 3, startX = 10, startY = 10) {
    this.initialLength = initialLength;
    /** @type {Direction} */
    this.direction = 'right';
    /** @type {Direction} */
    this.nextDirection = 'right';
    /** @type {Point[]} */
    this.body = [];

    for (let i = 0; i < initialLength; i++) {
      this.body.push({ x: startX - i, y: startY });
    }
  }

  /** @returns {Point} */
  get head() {
    return this.body[0];
  }

  /**
   * @param {Direction} newDirection
   */
  setDirection(newDirection) {
    /** @type {Record<Direction, Direction>} */
    const opposites = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left'
    };

    if (opposites[this.direction] !== newDirection) {
      this.nextDirection = newDirection;
    }
  }

  /**
   * @param {boolean} grow
   */
  move(grow = false) {
    this.direction = this.nextDirection;
    const head = { ...this.head };

    switch (this.direction) {
      case 'up':
        head.y -= 1;
        break;
      case 'down':
        head.y += 1;
        break;
      case 'left':
        head.x -= 1;
        break;
      case 'right':
        head.x += 1;
        break;
    }

    this.body.unshift(head);

    if (!grow) {
      this.body.pop();
    }
  }

  reset() {
    this.body = [];
    this.direction = 'right';
    this.nextDirection = 'right';

    for (let i = 0; i < this.initialLength; i++) {
      this.body.push({ x: 10 - i, y: 10 });
    }
  }
}

class Food {
  /**
   * @param {number} gridSize
   */
  constructor(gridSize) {
    this.gridSize = gridSize;
    /** @type {Point} */
    this.position = { x: 0, y: 0 };
    this.respawn([]);
  }

  /**
   * @param {Point[]} excludedPositions
   */
  respawn(excludedPositions) {
    /** @type {Point} */
    let newPosition;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
      newPosition = {
        x: Math.floor(Math.random() * this.gridSize),
        y: Math.floor(Math.random() * this.gridSize)
      };
      attempts++;
    } while (
      this.isPositionExcluded(newPosition, excludedPositions) &&
      attempts < maxAttempts
    );

    this.position = newPosition;
  }

  /**
   * @param {Point} position
   * @param {Point[]} excluded
   * @returns {boolean}
   */
  isPositionExcluded(position, excluded) {
    return excluded.some(p => p.x === position.x && p.y === position.y);
  }
}

class Obstacle {
  /**
   * @param {number} gridSize
   * @param {number} count
   */
  constructor(gridSize, count = 10) {
    this.gridSize = gridSize;
    this.count = count;
    /** @type {Point[]} */
    this.positions = [];
    this.generate([]);
  }

  /**
   * @param {Point[]} excludedPositions
   */
  generate(excludedPositions) {
    this.positions = [];
    let attempts = 0;
    const maxAttempts = 1000;

    while (this.positions.length < this.count && attempts < maxAttempts) {
      /** @type {Point} */
      const newPosition = {
        x: Math.floor(Math.random() * this.gridSize),
        y: Math.floor(Math.random() * this.gridSize)
      };

      if (!this.isPositionExcluded(newPosition, excludedPositions) &&
          !this.isPositionExcluded(newPosition, this.positions)) {
        this.positions.push(newPosition);
      }
      attempts++;
    }
  }

  /**
   * @param {Point} position
   * @param {Point[]} excluded
   * @returns {boolean}
   */
  isPositionExcluded(position, excluded) {
    return excluded.some(p => p.x === position.x && p.y === position.y);
  }

  /**
   * @param {Point[]} excludedPositions
   */
  reset(excludedPositions) {
    this.generate(excludedPositions);
  }
}

class GameEngine {
  /**
   * @param {string} canvasId
   */
  constructor(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }

    /** @type {HTMLCanvasElement} */
    this.canvas = /** @type {HTMLCanvasElement} */ (canvas);
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

    this.gridSize = 20;
    this.cellSize = canvas.width / this.gridSize;

    this.snake = new Snake(3);
    this.food = new Food(this.gridSize);
    /** @type {Obstacle | null} */
    this.obstacle = null;

    this.score = 0;
    this.highScore = 0;
    /** @type {GameStatus} */
    this.status = 'idle';

    this.normalSpeed = 150;
    this.fastSpeed = 80;
    this.slowSpeed = 250;
    this.currentSpeed = this.normalSpeed;

    this.lastUpdateTime = 0;
    /** @type {number | null} */
    this.animationFrameId = null;

    this.currentTheme = themes.classic;
    this.obstacleMode = false;

    /** @type {((current: number, high: number) => void) | null} */
    this.onScoreUpdate = null;
    /** @type {((status: GameStatus) => void) | null} */
    this.onGameStatusChange = null;

    this.loadHighScore();
    this.setupKeyboardControls();
    this.render();
  }

  /**
   * @param {(current: number, high: number) => void} callback
   */
  setOnScoreUpdate(callback) {
    this.onScoreUpdate = callback;
  }

  /**
   * @param {(status: GameStatus) => void} callback
   */
  setOnGameStatusChange(callback) {
    this.onGameStatusChange = callback;
  }

  loadHighScore() {
    const saved = localStorage.getItem('snakeGameHighScore');
    this.highScore = saved ? parseInt(saved, 10) : 0;
  }

  saveHighScore() {
    localStorage.setItem('snakeGameHighScore', this.highScore.toString());
  }

  /**
   * @param {number} points
   */
  updateScore(points) {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }
    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.score, this.highScore);
    }
  }

  /**
   * @param {GameStatus} status
   */
  setStatus(status) {
    this.status = status;
    if (this.onGameStatusChange) {
      this.onGameStatusChange(status);
    }
  }

  setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
      if (this.status !== 'playing' && this.status !== 'paused') return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          this.snake.setDirection('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.snake.setDirection('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.snake.setDirection('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.snake.setDirection('right');
          break;
        case ' ':
          e.preventDefault();
          if (this.status === 'playing') {
            this.currentSpeed = this.fastSpeed;
          }
          break;
        case 'Shift':
          e.preventDefault();
          if (this.status === 'playing') {
            this.currentSpeed = this.slowSpeed;
          }
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          this.togglePause();
          break;
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Shift') {
        this.currentSpeed = this.normalSpeed;
      }
    });
  }

  /**
   * @param {Point} head
   * @returns {boolean}
   */
  checkWallCollision(head) {
    return head.x < 0 || head.x >= this.gridSize ||
           head.y < 0 || head.y >= this.gridSize;
  }

  /**
   * @param {Point} head
   * @returns {boolean}
   */
  checkSelfCollision(head) {
    return this.snake.body.slice(1).some(
      segment => segment.x === head.x && segment.y === head.y
    );
  }

  /**
   * @param {Point} head
   * @returns {boolean}
   */
  checkFoodCollision(head) {
    return head.x === this.food.position.x && head.y === this.food.position.y;
  }

  /**
   * @param {Point} head
   * @returns {boolean}
   */
  checkObstacleCollision(head) {
    if (!this.obstacle) return false;
    return this.obstacle.positions.some(
      obs => obs.x === head.x && obs.y === head.y
    );
  }

  /**
   * @returns {Point[]}
   */
  getExcludedPositions() {
    const excluded = [...this.snake.body];
    if (this.obstacle) {
      excluded.push(...this.obstacle.positions);
    }
    return excluded;
  }

  /**
   * @param {number} timestamp
   */
  gameLoop(timestamp) {
    if (this.status !== 'playing') {
      this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
      return;
    }

    const deltaTime = timestamp - this.lastUpdateTime;

    if (deltaTime >= this.currentSpeed) {
      this.lastUpdateTime = timestamp;
      this.update();
    }

    this.render();
    this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  update() {
    const nextHead = this.getNextHeadPosition();

    if (this.checkWallCollision(nextHead)) {
      this.gameOver('撞到边界了！');
      return;
    }

    if (this.checkSelfCollision(nextHead)) {
      this.gameOver('撞到自己了！');
      return;
    }

    if (this.checkObstacleCollision(nextHead)) {
      this.gameOver('撞到障碍物了！');
      return;
    }

    let grow = false;
    if (this.checkFoodCollision(nextHead)) {
      grow = true;
      this.updateScore(10);
      this.food.respawn(this.getExcludedPositions());
    }

    this.snake.move(grow);
  }

  /**
   * @returns {Point}
   */
  getNextHeadPosition() {
    const head = { ...this.snake.head };
    const direction = this.snake.nextDirection;

    switch (direction) {
      case 'up':
        head.y -= 1;
        break;
      case 'down':
        head.y += 1;
        break;
      case 'left':
        head.x -= 1;
        break;
      case 'right':
        head.x += 1;
        break;
    }

    return head;
  }

  render() {
    this.ctx.fillStyle = this.currentTheme.canvasBackground;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawGrid();

    if (this.obstacle && this.obstacleMode) {
      this.drawObstacles();
    }

    this.drawFood();
    this.drawSnake();
  }

  drawGrid() {
    this.ctx.strokeStyle = this.currentTheme.gridColor;
    this.ctx.lineWidth = 1;

    for (let i = 0; i <= this.gridSize; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * this.cellSize, 0);
      this.ctx.lineTo(i * this.cellSize, this.canvas.height);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(0, i * this.cellSize);
      this.ctx.lineTo(this.canvas.width, i * this.cellSize);
      this.ctx.stroke();
    }
  }

  drawSnake() {
    const padding = 1;

    this.snake.body.forEach((segment, index) => {
      const isHead = index === 0;
      this.ctx.fillStyle = isHead
        ? this.currentTheme.snakeHead
        : this.currentTheme.snakeBody;

      const x = segment.x * this.cellSize + padding;
      const y = segment.y * this.cellSize + padding;
      const size = this.cellSize - padding * 2;

      const radius = size * 0.25;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, size, size, radius);
      this.ctx.fill();

      if (isHead) {
        this.drawSnakeEyes(segment);
      }
    });
  }

  /**
   * @param {Point} head
   */
  drawSnakeEyes(head) {
    const eyeSize = this.cellSize * 0.12;
    const offset = this.cellSize * 0.2;
    const centerX = head.x * this.cellSize + this.cellSize / 2;
    const centerY = head.y * this.cellSize + this.cellSize / 2;

    this.ctx.fillStyle = '#ffffff';

    const direction = this.snake.direction;

    let eye1X, eye1Y;
    let eye2X, eye2Y;

    switch (direction) {
      case 'up':
        eye1X = centerX - offset;
        eye1Y = centerY - offset;
        eye2X = centerX + offset;
        eye2Y = centerY - offset;
        break;
      case 'down':
        eye1X = centerX - offset;
        eye1Y = centerY + offset;
        eye2X = centerX + offset;
        eye2Y = centerY + offset;
        break;
      case 'left':
        eye1X = centerX - offset;
        eye1Y = centerY - offset;
        eye2X = centerX - offset;
        eye2Y = centerY + offset;
        break;
      case 'right':
        eye1X = centerX + offset;
        eye1Y = centerY - offset;
        eye2X = centerX + offset;
        eye2Y = centerY + offset;
        break;
      default:
        return;
    }

    this.ctx.beginPath();
    this.ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawFood() {
    const centerX = this.food.position.x * this.cellSize + this.cellSize / 2;
    const centerY = this.food.position.y * this.cellSize + this.cellSize / 2;
    const radius = this.cellSize * 0.4;

    this.ctx.fillStyle = this.currentTheme.food;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.beginPath();
    this.ctx.arc(centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawObstacles() {
    if (!this.obstacle) return;

    const padding = 1;

    this.obstacle.positions.forEach(obs => {
      this.ctx.fillStyle = this.currentTheme.obstacle;

      const x = obs.x * this.cellSize + padding;
      const y = obs.y * this.cellSize + padding;
      const size = this.cellSize - padding * 2;

      this.ctx.fillRect(x, y, size, size);

      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x, y, size, size);
    });
  }

  /**
   * @param {string} message
   */
  gameOver(message) {
    this.setStatus('gameover');
    this.showGameOverOverlay(message);
  }

  /**
   * @param {string} message
   */
  showGameOverOverlay(message) {
    const overlay = document.getElementById('game-overlay');
    const title = document.getElementById('overlay-title');
    const score = document.getElementById('overlay-score');
    const msg = document.getElementById('overlay-message');

    if (overlay) overlay.classList.remove('hidden');
    if (title) title.textContent = '游戏结束';
    if (score) score.textContent = `最终分数: ${this.score}`;
    if (msg) msg.textContent = message;
  }

  hideGameOverOverlay() {
    const overlay = document.getElementById('game-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  start() {
    if (this.status === 'playing') return;

    this.reset();
    this.hideGameOverOverlay();
    this.setStatus('playing');
    this.lastUpdateTime = performance.now();

    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  pause() {
    if (this.status !== 'playing') return;
    this.setStatus('paused');
  }

  resume() {
    if (this.status !== 'paused') return;
    this.setStatus('playing');
    this.lastUpdateTime = performance.now();
  }

  togglePause() {
    if (this.status === 'playing') {
      this.pause();
    } else if (this.status === 'paused') {
      this.resume();
    }
  }

  reset() {
    this.score = 0;
    this.currentSpeed = this.normalSpeed;
    this.snake.reset();

    if (this.obstacleMode && this.obstacle) {
      this.obstacle.reset(this.snake.body);
    }

    this.food.respawn(this.getExcludedPositions());
    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.score, this.highScore);
    }
    this.render();
  }

  restart() {
    this.reset();
    this.hideGameOverOverlay();
    this.setStatus('playing');
    this.lastUpdateTime = performance.now();

    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  /**
   * @param {string} themeName
   */
  setTheme(themeName) {
    const theme = themes[themeName];
    if (theme) {
      this.currentTheme = theme;
      document.documentElement.setAttribute('data-theme', themeName);
      this.render();
    }
  }

  /**
   * @param {boolean} enabled
   */
  setObstacleMode(enabled) {
    this.obstacleMode = enabled;

    if (enabled && !this.obstacle) {
      this.obstacle = new Obstacle(this.gridSize, 15);
      this.obstacle.reset(this.getExcludedPositions());
    }

    if (this.status === 'idle') {
      if (this.obstacle) {
        this.obstacle.reset(this.getExcludedPositions());
      }
      this.food.respawn(this.getExcludedPositions());
      this.render();
    }
  }

  getCurrentScore() {
    return this.score;
  }

  getHighScore() {
    return this.highScore;
  }

  getStatus() {
    return this.status;
  }
}

/**
 * @returns {void}
 */
function initializeGame() {
  const game = new GameEngine('game-canvas');

  const currentScoreEl = document.getElementById('current-score');
  const highScoreEl = document.getElementById('high-score');
  const startBtn = /** @type {HTMLButtonElement} */ (document.getElementById('btn-start'));
  const pauseBtn = /** @type {HTMLButtonElement} */ (document.getElementById('btn-pause'));
  const restartBtn = /** @type {HTMLButtonElement} */ (document.getElementById('btn-restart'));
  const obstacleCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('obstacle-mode'));
  const themeSelect = /** @type {HTMLSelectElement} */ (document.getElementById('theme-select'));

  /**
   * @param {number} current
   * @param {number} high
   */
  const updateScoreDisplay = (current, high) => {
    if (currentScoreEl) currentScoreEl.textContent = current.toString();
    if (highScoreEl) highScoreEl.textContent = high.toString();
  };

  /**
   * @param {GameStatus} status
   */
  const updateButtonStates = (status) => {
    if (!startBtn || !pauseBtn || !restartBtn) return;

    switch (status) {
      case 'idle':
        startBtn.disabled = false;
        startBtn.textContent = '开始游戏';
        pauseBtn.disabled = true;
        pauseBtn.textContent = '暂停';
        restartBtn.disabled = true;
        obstacleCheckbox.disabled = false;
        break;
      case 'playing':
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        pauseBtn.textContent = '暂停';
        restartBtn.disabled = false;
        obstacleCheckbox.disabled = true;
        break;
      case 'paused':
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        pauseBtn.textContent = '继续';
        restartBtn.disabled = false;
        obstacleCheckbox.disabled = true;
        break;
      case 'gameover':
        startBtn.disabled = false;
        startBtn.textContent = '再来一局';
        pauseBtn.disabled = true;
        pauseBtn.textContent = '暂停';
        restartBtn.disabled = true;
        obstacleCheckbox.disabled = false;
        break;
    }
  };

  game.setOnScoreUpdate(updateScoreDisplay);
  game.setOnGameStatusChange(updateButtonStates);

  updateScoreDisplay(game.getCurrentScore(), game.getHighScore());
  updateButtonStates(game.getStatus());

  startBtn?.addEventListener('click', () => {
    game.start();
  });

  pauseBtn?.addEventListener('click', () => {
    game.togglePause();
  });

  restartBtn?.addEventListener('click', () => {
    game.restart();
  });

  obstacleCheckbox?.addEventListener('change', (e) => {
    const checked = /** @type {HTMLInputElement} */ (e.target).checked;
    game.setObstacleMode(checked);
  });

  themeSelect?.addEventListener('change', (e) => {
    const theme = /** @type {HTMLSelectElement} */ (e.target).value;
    game.setTheme(theme);
  });
}

document.addEventListener('DOMContentLoaded', initializeGame);
