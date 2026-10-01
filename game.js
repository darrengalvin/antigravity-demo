/**
 * ANTIGRAVITY - Zero-G Vector Protocol Game Engine
 * High-precision canvas physics, particle simulation, and orbital mechanics.
 */

// Utility helpers
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const rand = (min, max) => Math.random() * (max - min) + min;

class AntigravityGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.radarCanvas = document.getElementById('radar-canvas');
    this.radarCtx = this.radarCanvas.getContext('2d');

    // Display elements
    this.scoreVal = document.getElementById('score-val');
    this.coresVal = document.getElementById('cores-val');
    this.multiplierVal = document.getElementById('multiplier-val');
    this.fpsVal = document.getElementById('fps-val');
    this.hullFill = document.getElementById('hull-fill');
    this.hullPct = document.getElementById('hull-pct');
    this.energyFill = document.getElementById('energy-fill');
    this.energyPct = document.getElementById('energy-pct');
    this.boostFill = document.getElementById('boost-fill');
    this.boostPct = document.getElementById('boost-pct');
    this.velVal = document.getElementById('vel-val');
    this.gVal = document.getElementById('g-val');
    this.timeVal = document.getElementById('time-val');
    this.anomalyVal = document.getElementById('anomaly-val');
    this.audioToggle = document.getElementById('audio-toggle');
    this.audioText = document.getElementById('audio-text');
    this.modalScreen = document.getElementById('modal-screen');
    this.startBtn = document.getElementById('start-btn');
    this.gameOverStats = document.getElementById('game-over-stats');
    this.finalScore = document.getElementById('final-score');
    this.finalCores = document.getElementById('final-cores');
    this.finalMultiplier = document.getElementById('final-multiplier');
    this.finalTime = document.getElementById('final-time');

    // Screen dimensions
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // State
    this.isRunning = false;
    this.score = 0;
    this.coresHarvested = 0;
    this.combo = 1.0;
    this.comboTimer = 0;
    this.maxCombo = 1.0;
    this.gameStartTime = 0;
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    // Input state
    this.keys = {};
    this.mouse = { x: this.width / 2, y: this.height / 2, isDown: false, rightDown: false };

    // World & Camera
    this.worldSize = { width: 3600, height: 2600 };
    this.camera = { x: 0, y: 0, shake: 0 };

    // Stars background
    this.stars = [];
    this.initStars(250);

    // Game Entities
    this.ship = null;
    this.particles = [];
    this.debris = [];
    this.cores = [];
    this.anomalies = [];
    this.floatingTexts = [];
    this.shockwaves = [];

    // Bindings
    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);

    this.initListeners();
    this.resize();
  }

  initStars(count) {
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: rand(0, this.worldSize.width),
        y: rand(0, this.worldSize.height),
        size: rand(0.8, 2.4),
        alpha: rand(0.3, 0.9),
        speedLayer: rand(0.15, 0.8)
      });
    }
  }

  initListeners() {
    window.addEventListener('resize', this.resize);

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyM') {
        this.toggleAudio();
      }
      if (e.code === 'Space' && this.isRunning) {
        e.preventDefault();
        this.triggerRepulsor();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.isDown = true;
      if (e.button === 2) {
        e.preventDefault();
        this.mouse.rightDown = true;
        if (this.isRunning) this.triggerRepulsor();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.isDown = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    this.audioToggle.addEventListener('click', () => this.toggleAudio());
    this.startBtn.addEventListener('click', () => this.startGame());
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
  }

  toggleAudio() {
    window.soundEngine.init();
    const isMuted = window.soundEngine.toggleMute();
    this.audioText.textContent = isMuted ? "SOUND OFF" : "SOUND ON";
    this.audioToggle.classList.toggle('muted', isMuted);
  }

  startGame() {
    window.soundEngine.init();

    this.score = 0;
    this.coresHarvested = 0;
    this.combo = 1.0;
    this.maxCombo = 1.0;
    this.comboTimer = 0;
    this.gameStartTime = performance.now();
    this.particles = [];
    this.floatingTexts = [];
    this.shockwaves = [];
    this.debris = [];
    this.cores = [];
    this.anomalies = [];

    // Initialize Ship in center
    this.ship = {
      x: this.worldSize.width / 2,
      y: this.worldSize.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      angularVelocity: 0,
      radius: 16,
      hull: 100,
      energy: 100,
      boostEnergy: 100,
      isThrusting: false,
      isBoosting: false,
      invulnerable: 60
    };

    // Spawn Gravitational Singularity Anomalies
    this.anomalies.push({
      x: this.worldSize.width / 2 - 400,
      y: this.worldSize.height / 2 - 300,
      radius: 45,
      pullRadius: 520,
      mass: 8500,
      rotation: 0
    });
    this.anomalies.push({
      x: this.worldSize.width / 2 + 450,
      y: this.worldSize.height / 2 + 350,
      radius: 55,
      pullRadius: 650,
      mass: 11000,
      rotation: 0
    });

    // Populate initial entities
    this.spawnEntities();

    this.modalScreen.classList.remove('active');
    this.gameOverStats.classList.add('hidden');
    this.isRunning = true;

    this.lastFrameTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  spawnEntities() {
    // Spawn Cores
    for (let i = 0; i < 24; i++) {
      this.spawnCore();
    }
    // Spawn Debris Asteroids
    for (let i = 0; i < 35; i++) {
      this.spawnDebris();
    }
  }

  spawnCore() {
    this.cores.push({
      x: rand(100, this.worldSize.width - 100),
      y: rand(100, this.worldSize.height - 100),
      radius: 12,
      rotation: rand(0, Math.PI * 2),
      rotSpeed: rand(0.02, 0.05),
      pulse: 0,
      value: 250
    });
  }

  spawnDebris() {
    const sides = Math.floor(rand(5, 8));
    const vertices = [];
    const baseRadius = rand(15, 38);
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const r = baseRadius * rand(0.7, 1.3);
      vertices.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }

    this.debris.push({
      x: rand(50, this.worldSize.width - 50),
      y: rand(50, this.worldSize.height - 50),
      vx: rand(-1.2, 1.2),
      vy: rand(-1.2, 1.2),
      angle: rand(0, Math.PI * 2),
      rotSpeed: rand(-0.03, 0.03),
      radius: baseRadius,
      vertices: vertices,
      danger: true
    });
  }

  triggerRepulsor() {
    if (!this.ship || this.ship.energy < 25) return;
    this.ship.energy -= 25;

    window.soundEngine.playRepulsorBlast();
    this.camera.shake = 18;

    // Shockwave entity
    this.shockwaves.push({
      x: this.ship.x,
      y: this.ship.y,
      radius: 10,
      maxRadius: 280,
      alpha: 1.0
    });

    // Deflect Debris
    const pulseStrength = 16;
    for (let d of this.debris) {
      const dDistance = dist(this.ship.x, this.ship.y, d.x, d.y);
      if (dDistance < 280) {
        const nx = (d.x - this.ship.x) / (dDistance || 1);
        const ny = (d.y - this.ship.y) / (dDistance || 1);
        const force = (1 - dDistance / 280) * pulseStrength;
        d.vx += nx * force;
        d.vy += ny * force;

        // Emit deflection sparks
        for (let k = 0; k < 6; k++) {
          this.particles.push({
            x: d.x,
            y: d.y,
            vx: nx * force * 0.5 + rand(-2, 2),
            vy: ny * force * 0.5 + rand(-2, 2),
            life: 1.0,
            color: '#00f2fe',
            size: rand(2, 4)
          });
        }
      }
    }
  }

  updatePhysics(dt) {
    if (!this.isRunning || !this.ship) return;

    // Ship Input & Steering
    let turn = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) turn -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) turn += 1;

    // Smooth rotational inertia
    this.ship.angularVelocity += turn * 0.007;
    this.ship.angularVelocity *= 0.88;
    this.ship.angle += this.ship.angularVelocity;

    // Thrust & Boost
    const thrusting = this.keys['KeyW'] || this.keys['ArrowUp'] || this.mouse.isDown;
    const boosting = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && thrusting && this.ship.boostEnergy > 5;

    this.ship.isThrusting = thrusting;
    this.ship.isBoosting = boosting;

    window.soundEngine.setThrusterActive(thrusting, boosting);

    let thrustPower = 0.22;
    if (boosting) {
      thrustPower = 0.48;
      this.ship.boostEnergy = Math.max(0, this.ship.boostEnergy - 0.7);
    } else {
      this.ship.boostEnergy = Math.min(100, this.ship.boostEnergy + 0.25);
    }

    // Energy passive recovery
    this.ship.energy = Math.min(100, this.ship.energy + 0.15);

    if (thrusting) {
      const ax = Math.cos(this.ship.angle) * thrustPower;
      const ay = Math.sin(this.ship.angle) * thrustPower;
      this.ship.vx += ax;
      this.ship.vy += ay;

      // Exhaust particle emission from dual nozzle ports
      const rearDist = -16;
      const offset = 6;
      [-offset, offset].forEach(portOffset => {
        const px = this.ship.x + Math.cos(this.ship.angle) * rearDist + Math.sin(this.ship.angle) * portOffset;
        const py = this.ship.y + Math.sin(this.ship.angle) * rearDist - Math.cos(this.ship.angle) * portOffset;
        const spread = rand(-0.25, 0.25);
        const pSpeed = boosting ? rand(5, 9) : rand(3, 5.5);

        this.particles.push({
          x: px,
          y: py,
          vx: -Math.cos(this.ship.angle + spread) * pSpeed + this.ship.vx * 0.25,
          vy: -Math.sin(this.ship.angle + spread) * pSpeed + this.ship.vy * 0.25,
          life: 1.0,
          size: boosting ? rand(3, 6) : rand(2, 4),
          color: boosting ? '#ff007f' : '#00f2fe'
        });
      });
    }

    // Space drag / resistance
    this.ship.vx *= 0.992;
    this.ship.vy *= 0.992;

    // Apply Gravitational Singularity Fields
    let totalGravForce = 0;
    this.anomalies.forEach(anomaly => {
      anomaly.rotation += 0.015;
      const d = dist(this.ship.x, this.ship.y, anomaly.x, anomaly.y);
      if (d < anomaly.pullRadius) {
        const pull = (anomaly.mass / (d * d + 800)) * 0.35;
        totalGravForce += pull;
        const nx = (anomaly.x - this.ship.x) / d;
        const ny = (anomaly.y - this.ship.y) / d;
        this.ship.vx += nx * pull;
        this.ship.vy += ny * pull;

        // Singularity horizon collision (black hole crush)
        if (d < anomaly.radius) {
          this.damageShip(50);
          this.ship.vx = -nx * 10;
          this.ship.vy = -ny * 10;
          this.addFloatingText("GRAVITATIONAL CRUSH", this.ship.x, this.ship.y, '#ff0055');
        }
      }
    });

    // Update ship position
    this.ship.x += this.ship.vx;
    this.ship.y += this.ship.vy;

    // World boundary bounce
    const pad = this.ship.radius;
    if (this.ship.x < pad) { this.ship.x = pad; this.ship.vx *= -0.7; }
    if (this.ship.x > this.worldSize.width - pad) { this.ship.x = this.worldSize.width - pad; this.ship.vx *= -0.7; }
    if (this.ship.y < pad) { this.ship.y = pad; this.ship.vy *= -0.7; }
    if (this.ship.y > this.worldSize.height - pad) { this.ship.y = this.worldSize.height - pad; this.ship.vy *= -0.7; }

    if (this.ship.invulnerable > 0) this.ship.invulnerable--;

    // Update Debris Physics
    for (let d of this.debris) {
      d.x += d.vx;
      d.y += d.vy;
      d.angle += d.rotSpeed;

      // Wrap around world borders
      if (d.x < 0) d.x = this.worldSize.width;
      if (d.x > this.worldSize.width) d.x = 0;
      if (d.y < 0) d.y = this.worldSize.height;
      if (d.y > this.worldSize.height) d.y = 0;

      // Anomaly pull on debris
      this.anomalies.forEach(anomaly => {
        const dDist = dist(d.x, d.y, anomaly.x, anomaly.y);
        if (dDist < anomaly.pullRadius) {
          const pull = (anomaly.mass / (dDist * dDist + 600)) * 0.25;
          d.vx += ((anomaly.x - d.x) / dDist) * pull;
          d.vy += ((anomaly.y - d.y) / dDist) * pull;
        }
      });

      // Ship Collision check
      const dShip = dist(this.ship.x, this.ship.y, d.x, d.y);
      if (dShip < this.ship.radius + d.radius && this.ship.invulnerable <= 0) {
        this.damageShip(25);
        window.soundEngine.playCollision();
        this.camera.shake = 14;

        // Bounce back
        const nx = (this.ship.x - d.x) / dShip;
        const ny = (this.ship.y - d.y) / dShip;
        this.ship.vx += nx * 6;
        this.ship.vy += ny * 6;
        d.vx -= nx * 4;
        d.vy -= ny * 4;

        // Impact spark explosion
        for (let s = 0; s < 12; s++) {
          this.particles.push({
            x: this.ship.x,
            y: this.ship.y,
            vx: rand(-4, 4),
            vy: rand(-4, 4),
            life: 1.0,
            size: rand(2, 5),
            color: '#ff0055'
          });
        }
      }
    }

    // Update Quantum Cores & Pickups
    for (let i = this.cores.length - 1; i >= 0; i--) {
      const c = this.cores[i];
      c.rotation += c.rotSpeed;
      c.pulse = Math.sin(performance.now() * 0.005) * 4;

      const dCore = dist(this.ship.x, this.ship.y, c.x, c.y);

      // Magnetic attractor when close
      if (dCore < 120) {
        const pull = (120 - dCore) * 0.08;
        c.x += ((this.ship.x - c.x) / dCore) * pull;
        c.y += ((this.ship.y - c.y) / dCore) * pull;
      }

      // Collect Core!
      if (dCore < this.ship.radius + c.radius) {
        this.coresHarvested++;
        this.combo = Math.min(8.0, +(this.combo + 0.5).toFixed(1));
        this.comboTimer = 220; // ~3.5 seconds
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;

        const earned = Math.floor(c.value * this.combo);
        this.score += earned;
        this.ship.energy = Math.min(100, this.ship.energy + 20);

        window.soundEngine.playPickup(this.combo);
        this.addFloatingText(`+${earned} (${this.combo}x)`, c.x, c.y, '#00f2fe');

        // Burst particles
        for (let p = 0; p < 15; p++) {
          this.particles.push({
            x: c.x,
            y: c.y,
            vx: rand(-5, 5),
            vy: rand(-5, 5),
            life: 1.0,
            size: rand(2, 5),
            color: '#00f2fe'
          });
        }

        this.cores.splice(i, 1);
        setTimeout(() => this.spawnCore(), rand(1500, 3000));
      }
    }

    // Combo timer decay
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer <= 0) {
        this.combo = 1.0;
      }
    }

    // Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * 0.18;
      sw.alpha -= 0.035;
      if (sw.alpha <= 0) this.shockwaves.splice(i, 1);
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.025;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Update Floating Text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 1.2;
      ft.life -= 0.02;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Smooth Camera Follow
    const targetCamX = this.ship.x - this.width / 2;
    const targetCamY = this.ship.y - this.height / 2;
    this.camera.x += (targetCamX - this.camera.x) * 0.1;
    this.camera.y += (targetCamY - this.camera.y) * 0.1;

    if (this.camera.shake > 0) {
      this.camera.shake *= 0.88;
      if (this.camera.shake < 0.2) this.camera.shake = 0;
    }

    // Update Telemetry Display
    this.updateHUD(totalGravForce);
  }

  damageShip(amount) {
    if (!this.ship) return;
    this.ship.hull -= amount;
    this.ship.invulnerable = 40;
    this.combo = 1.0;

    if (this.ship.hull <= 0) {
      this.ship.hull = 0;
      this.endGame();
    }
  }

  addFloatingText(text, x, y, color = '#fff') {
    this.floatingTexts.push({ text, x, y, life: 1.0, color });
  }

  updateHUD(gravForce) {
    this.scoreVal.textContent = String(this.score).padStart(5, '0');
    this.coresVal.textContent = this.coresHarvested;
    this.multiplierVal.textContent = `${this.combo.toFixed(1)}x`;

    const vel = Math.hypot(this.ship.vx, this.ship.vy) * 28;
    this.velVal.textContent = `${vel.toFixed(1)} km/s`;
    this.gVal.textContent = `${(1.0 + gravForce * 4.2).toFixed(2)} G`;

    this.hullFill.style.width = `${this.ship.hull}%`;
    this.hullPct.textContent = `${Math.ceil(this.ship.hull)}%`;

    this.energyFill.style.width = `${this.ship.energy}%`;
    this.energyPct.textContent = `${Math.ceil(this.ship.energy)}%`;

    this.boostFill.style.width = `${this.ship.boostEnergy}%`;
    this.boostPct.textContent = `${Math.ceil(this.ship.boostEnergy)}%`;

    // Time elapsed
    const elapsedSecs = Math.floor((performance.now() - this.gameStartTime) / 1000);
    const mins = String(Math.floor(elapsedSecs / 60)).padStart(2, '0');
    const secs = String(elapsedSecs % 60).padStart(2, '0');
    this.timeVal.textContent = `${mins}:${secs}`;
  }

  endGame() {
    this.isRunning = false;
    window.soundEngine.setThrusterActive(false);
    window.soundEngine.playGameOver();

    const elapsedSecs = Math.floor((performance.now() - this.gameStartTime) / 1000);
    const mins = String(Math.floor(elapsedSecs / 60)).padStart(2, '0');
    const secs = String(elapsedSecs % 60).padStart(2, '0');

    this.finalScore.textContent = this.score;
    this.finalCores.textContent = this.coresHarvested;
    this.finalMultiplier.textContent = `${this.maxCombo.toFixed(1)}x`;
    this.finalTime.textContent = `${mins}:${secs}`;

    this.gameOverStats.classList.remove('hidden');
    this.startBtn.textContent = "RE-INITIALIZE FLIGHT";
    this.modalScreen.classList.add('active');
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Apply Camera Transform & Shake
    ctx.save();
    const shakeX = (Math.random() - 0.5) * this.camera.shake * 2;
    const shakeY = (Math.random() - 0.5) * this.camera.shake * 2;
    ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

    // Render Starfield Background (Parallax layers)
    this.stars.forEach(s => {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.beginPath();
      // Warp stretch during boost
      if (this.ship && this.ship.isBoosting) {
        ctx.fillRect(s.x, s.y, s.size * 3, s.size * 0.8);
      } else {
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Render World Boundaries
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.2)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, this.worldSize.width, this.worldSize.height);

    // Render Gravitational Singularities / Accretion Disks
    this.anomalies.forEach(anomaly => {
      // Outer gravity distortion halo
      const grad = ctx.createRadialGradient(anomaly.x, anomaly.y, anomaly.radius, anomaly.x, anomaly.y, anomaly.pullRadius);
      grad.addColorStop(0, 'rgba(255, 0, 127, 0.22)');
      grad.addColorStop(0.4, 'rgba(0, 242, 254, 0.08)');
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(anomaly.x, anomaly.y, anomaly.pullRadius, 0, Math.PI * 2);
      ctx.fill();

      // Rotating Accretion Ring
      ctx.save();
      ctx.translate(anomaly.x, anomaly.y);
      ctx.rotate(anomaly.rotation);
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.6)';
      ctx.lineWidth = 4;
      ctx.setLineDash([18, 12]);
      ctx.beginPath();
      ctx.arc(0, 0, anomaly.radius + 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Event Horizon (Black Core)
      ctx.fillStyle = '#05070c';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(anomaly.x, anomaly.y, anomaly.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Render Debris
    this.debris.forEach(d => {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fillStyle = 'rgba(20, 28, 45, 0.8)';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      d.vertices.forEach((v, idx) => {
        if (idx === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // Render Quantum Cores (Pickups)
    this.cores.forEach(c => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);

      // Glowing Aura
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = '#00f2fe';
      ctx.fillStyle = 'rgba(0, 242, 254, 0.25)';
      ctx.lineWidth = 2;

      // Rotating diamond / octahedron
      const r = c.radius + c.pulse;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // Render Shockwaves
    this.shockwaves.forEach(sw => {
      ctx.save();
      ctx.strokeStyle = `rgba(0, 242, 254, ${sw.alpha})`;
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 20;
      ctx.lineWidth = 6 * sw.alpha;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // Render Particles
    this.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Render Ship
    if (this.ship) {
      ctx.save();
      ctx.translate(this.ship.x, this.ship.y);
      ctx.rotate(this.ship.angle);

      // Invulnerability flicker
      if (this.ship.invulnerable > 0 && Math.floor(this.ship.invulnerable / 4) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      // Ship Neon Vector Wireframe
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#00f2fe';
      ctx.fillStyle = 'rgba(7, 10, 20, 0.9)';
      ctx.lineWidth = 2;

      ctx.beginPath();
      // Arrowhead aerodynamic stealth fighter geometry
      ctx.moveTo(18, 0);
      ctx.lineTo(-14, -12);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cockpit Glow
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(2, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Energy Shield Bubble if protected
      if (this.ship.energy > 30) {
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Render Floating Text
    this.floatingTexts.forEach(ft => {
      ctx.save();
      ctx.font = 'bold 14px "Orbitron", sans-serif';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10;
      ctx.globalAlpha = ft.life;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    ctx.restore();

    // Render Radar Mini-map
    this.renderRadar();
  }

  renderRadar() {
    const rctx = this.radarCtx;
    rctx.clearRect(0, 0, 120, 120);

    const scaleX = 120 / this.worldSize.width;
    const scaleY = 120 / this.worldSize.height;

    // Anomalies on radar
    this.anomalies.forEach(a => {
      rctx.fillStyle = 'rgba(255, 0, 127, 0.7)';
      rctx.beginPath();
      rctx.arc(a.x * scaleX, a.y * scaleY, 4, 0, Math.PI * 2);
      rctx.fill();
    });

    // Cores on radar
    this.cores.forEach(c => {
      rctx.fillStyle = '#00f2fe';
      rctx.fillRect(c.x * scaleX - 1, c.y * scaleY - 1, 2.5, 2.5);
    });

    // Ship on radar
    if (this.ship) {
      rctx.fillStyle = '#ffffff';
      rctx.shadowColor = '#00f2fe';
      rctx.shadowBlur = 6;
      rctx.beginPath();
      rctx.arc(this.ship.x * scaleX, this.ship.y * scaleY, 3, 0, Math.PI * 2);
      rctx.fill();
      rctx.shadowBlur = 0;
    }
  }

  loop(timestamp) {
    if (!this.isRunning) return;

    const dt = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;

    // FPS calculation
    this.frameCount++;
    if (timestamp - this.fpsTimer >= 500) {
      const fps = Math.round((this.frameCount * 1000) / (timestamp - this.fpsTimer));
      this.fpsVal.textContent = fps;
      this.frameCount = 0;
      this.fpsTimer = timestamp;
    }

    this.updatePhysics(dt);
    this.render();

    requestAnimationFrame(this.loop);
  }
}

// Boot game on window load
window.addEventListener('DOMContentLoaded', () => {
  window.game = new AntigravityGame();
});
