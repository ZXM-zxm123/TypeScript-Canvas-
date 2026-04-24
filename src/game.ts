type Direction = 'up' | 'down' | 'left' | 'right';

interface Point {
  x: number;
  y: number;
}

interface GameTheme {
  name: string;
  canvasBackground: string;
  gridColor: string;
  snakeHead: string;
  snakeBody: string;
  food: string;
  obstacle: string;
}

const themes: Record<string, GameTheme> = {
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
  body: Point[];
  direction: Direction;
  nextDirection: Direction;
  initialLength: number;

  constructor(initialLength: number = 3, startX: number = 10, startY: number = 10) {
    this.initialLength = initialLength;
    this.direction = 'right';
    this.nextDirection = 'right';
    this.body = [];

    for (let i = 0; i < initialLength; i++) {
      this.body.push({ x: startX - i, y: startY });
    }
  }

  get head(): Point {
    return this.body[0];
  }

  setDirection(newDirection: Direction): void {
    const opposites: Record<Direction, Direction> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left'
    };

    if (opposites[this.direction] !== newDirection) {
      this.nextDirection = newDirection;
    }
  }

  move(grow: boolean = false): void {
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

  reset(): void {
    this.body = [];
    this.direction = 'right';
    this.nextDirection = 'right';

    for (let i = 0; i < this.initialLength; i++) {
      this.body.push({ x: 10 - i, y: 10 });
    }
  }
}

class Food {
  position: Point;
  gridSize: number;

  constructor(gridSize: number) {
    this.gridSize = gridSize;
    this.position = { x: 0, y: 0 };
    this.respawn([]);
  }

  respawn(excludedPositions: Point[]): void {
    let newPosition: Point;
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

  private isPositionExcluded(position: Point, excluded: Point[]): boolean {
    return excluded.some(p => p.x === position.x && p.y === position.y);
  }
}

class Obstacle {
  positions: Point[];
  gridSize: number;
  count: number;

  constructor(gridSize: number, count: number = 10) {
    this.gridSize = gridSize;
    this.count = count;
    this.positions = [];
    this.generate([]);
  }

  generate(excludedPositions: Point[]): void {
    this.positions = [];
    let attempts = 0;
    const maxAttempts = 1000;

    while (this.positions.length < this.count && attempts < maxAttempts) {
      const newPosition: Point = {
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

  private isPositionExcluded(position: Point, excluded: Point[]): boolean {
    return excluded.some(p => p.x === position.x && p.y === position.y);
  }

  reset(excludedPositions: Point[]): void {
    this.generate(excludedPositions);
  }
}

type GameStatus = 'idle' | 'playing' | 'paused' | 'gameover';

class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gridSize: number = 20;
  private cellSize: number = 20;

  private snake: Snake;
  private food: Food;
  private obstacle: Obstacle | null = null;

  private score: number = 0;
  private highScore: number = 0;
  private status: GameStatus = 'idle';

  private normalSpeed: number = 150;
  private fastSpeed: number = 80;
  private slowSpeed: number = 250;
  private currentSpeed: number = this.normalSpeed;

  private lastUpdateTime: number = 0;
  private animationFrameId: number | null = null;

  private currentTheme: GameTheme = themes.classic;
  private obstacleMode: boolean = false;

  private onScoreUpdate: ((current: number, high: number) => void) | null = null;
  private onGameStatusChange: ((status: GameStatus) => void) | null = null;

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    this.cellSize = canvas.width / this.gridSize;

    this.snake = new Snake(3);
    this.food = new Food(this.gridSize);

    this.loadHighScore();
    this.setupKeyboardControls();
    this.render();
  }

  setOnScoreUpdate(callback: (current: number, high: number) => void): void {
    this.onScoreUpdate = callback;
  }

  setOnGameStatusChange(callback: (status: GameStatus) => void): void {
    this.onGameStatusChange = callback;
  }

  private loadHighScore(): void {
    const saved = localStorage.getItem('snakeGameHighScore');
    this.highScore = saved ? parseInt(saved, 10) : 0;
  }

  private saveHighScore(): void {
    localStorage.setItem('snakeGameHighScore', this.highScore.toString());
  }

  private updateScore(points: number): void {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }
    this.onScoreUpdate?.(this.score, this.highScore);
  }

  private setStatus(status: GameStatus): void {
    this.status = status;
    this.onGameStatusChange?.(status);
  }

  private setupKeyboardControls(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
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

    document.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Shift') {
        this.currentSpeed = this.normalSpeed;
      }
    });
  }

  private checkWallCollision(head: Point): boolean {
    return head.x < 0 || head.x >= this.gridSize ||
           head.y < 0 || head.y >= this.gridSize;
  }

  private checkSelfCollision(head: Point): boolean {
    return this.snake.body.slice(1).some(
      segment => segment.x === head.x && segment.y === head.y
    );
  }

  private checkFoodCollision(head: Point): boolean {
    return head.x === this.food.position.x && head.y === this.food.position.y;
  }

  private checkObstacleCollision(head: Point): boolean {
    if (!this.obstacle) return false;
    return this.obstacle.positions.some(
      obs => obs.x === head.x && obs.y === head.y
    );
  }

  private getExcludedPositions(): Point[] {
    const excluded = [...this.snake.body];
    if (this.obstacle) {
      excluded.push(...this.obstacle.positions);
    }
    return excluded;
  }

  private gameLoop(timestamp: number): void {
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

  private update(): void {
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

  private getNextHeadPosition(): Point {
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

  private render(): void {
    this.ctx.fillStyle = this.currentTheme.canvasBackground;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawGrid();

    if (this.obstacle && this.obstacleMode) {
      this.drawObstacles();
    }

    this.drawFood();
    this.drawSnake();
  }

  private drawGrid(): void {
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

  private drawSnake(): void {
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

  private drawSnakeEyes(head: Point): void {
    const eyeSize = this.cellSize * 0.12;
    const offset = this.cellSize * 0.2;
    const centerX = head.x * this.cellSize + this.cellSize / 2;
    const centerY = head.y * this.cellSize + this.cellSize / 2;

    this.ctx.fillStyle = '#ffffff';

    const direction = this.snake.direction;

    let eye1X: number, eye1Y: number;
    let eye2X: number, eye2Y: number;

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

  private drawFood(): void {
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

  private drawObstacles(): void {
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

  private gameOver(message: string): void {
    this.setStatus('gameover');
    this.showGameOverOverlay(message);
  }

  private showGameOverOverlay(message: string): void {
    const overlay = document.getElementById('game-overlay');
    const title = document.getElementById('overlay-title');
    const score = document.getElementById('overlay-score');
    const msg = document.getElementById('overlay-message');

    if (overlay) overlay.classList.remove('hidden');
    if (title) title.textContent = '游戏结束';
    if (score) score.textContent = `最终分数: ${this.score}`;
    if (msg) msg.textContent = message;
  }

  private hideGameOverOverlay(): void {
    const overlay = document.getElementById('game-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  start(): void {
    if (this.status === 'playing') return;

    this.reset();
    this.hideGameOverOverlay();
    this.setStatus('playing');
    this.lastUpdateTime = performance.now();

    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  pause(): void {
    if (this.status !== 'playing') return;
    this.setStatus('paused');
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.setStatus('playing');
    this.lastUpdateTime = performance.now();
  }

  togglePause(): void {
    if (this.status === 'playing') {
      this.pause();
    } else if (this.status === 'paused') {
      this.resume();
    }
  }

  reset(): void {
    this.score = 0;
    this.currentSpeed = this.normalSpeed;
    this.snake.reset();

    if (this.obstacleMode && this.obstacle) {
      this.obstacle.reset(this.snake.body);
    }

    this.food.respawn(this.getExcludedPositions());
    this.onScoreUpdate?.(this.score, this.highScore);
    this.render();
  }

  restart(): void {
    this.reset();
    this.hideGameOverOverlay();
    this.setStatus('playing');
    this.lastUpdateTime = performance.now();

    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    }
  }

  setTheme(themeName: string): void {
    const theme = themes[themeName];
    if (theme) {
      this.currentTheme = theme;
      document.documentElement.setAttribute('data-theme', themeName);
      this.render();
    }
  }

  setObstacleMode(enabled: boolean): void {
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

  getCurrentScore(): number {
    return this.score;
  }

  getHighScore(): number {
    return this.highScore;
  }

  getStatus(): GameStatus {
    return this.status;
  }
}

function initializeGame(): void {
  const game = new GameEngine('game-canvas');

  const currentScoreEl = document.getElementById('current-score');
  const highScoreEl = document.getElementById('high-score');
  const startBtn = document.getElementById('btn-start') as HTMLButtonElement;
  const pauseBtn = document.getElementById('btn-pause') as HTMLButtonElement;
  const restartBtn = document.getElementById('btn-restart') as HTMLButtonElement;
  const obstacleCheckbox = document.getElementById('obstacle-mode') as HTMLInputElement;
  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;

  const updateScoreDisplay = (current: number, high: number): void => {
    if (currentScoreEl) currentScoreEl.textContent = current.toString();
    if (highScoreEl) highScoreEl.textContent = high.toString();
  };

  const updateButtonStates = (status: GameStatus): void => {
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
    const checked = (e.target as HTMLInputElement).checked;
    game.setObstacleMode(checked);
  });

  themeSelect?.addEventListener('change', (e) => {
    const theme = (e.target as HTMLSelectElement).value;
    game.setTheme(theme);
  });
}

document.addEventListener('DOMContentLoaded', initializeGame);
