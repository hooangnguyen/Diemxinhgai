// Cảnh hoàng hôn: bầu trời sao, dải ngân hà, mặt trời lặn, mây, đồi, cánh đồng hoa và đom đóm.
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, DPR = 1;
let time = 0;
let isMobile = false;

// Lớp nền vẽ sẵn (tĩnh) để tiết kiệm hiệu năng
let skyLayer, hillLayers = [];

let stars = [];
let shootingStars = [];
let clouds = [];
let grassBlades = [];
let fireflies = [];
let particles = [];

// Thị sai theo con trỏ / con quay
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
const PARALLAX = 18;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
}

// Sprite phát sáng dùng chung (nhanh hơn shadowBlur rất nhiều)
const glowCache = {};
function glow(color) {
    if (glowCache[color]) return glowCache[color];
    const s = 64;
    const c = makeCanvas(s, s);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.45, hexToRgba(color, 0.25));
    grad.addColorStop(1, hexToRgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    glowCache[color] = c;
    return c;
}

function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function drawGlow(color, x, y, size, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(glow(color), x - size / 2, y - size / 2, size, size);
}

// ---------- Thiết lập ----------

function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    isMobile = W < 768;
    DPR = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);

    buildSky();
    buildHills();
    initStars();
    initClouds();
    initGrass();
    initFireflies();
    particles = [];
}

const sunPos = () => ({
    x: W * 0.5,
    y: H * 0.6,
    r: isMobile ? W * 0.13 : Math.min(W, H) * 0.075
});

function buildSky() {
    const m = PARALLAX;
    skyLayer = makeCanvas((W + m * 2) * DPR, (H + m * 2) * DPR);
    const g = skyLayer.getContext('2d');
    g.scale(DPR, DPR);
    const w = W + m * 2, h = H + m * 2;

    // Gradient chạng vạng: đêm sâu ở trên, hồng cam ở chân trời
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.00, '#05040f');
    grad.addColorStop(0.22, '#0c0a24');
    grad.addColorStop(0.40, '#1d0f3a');
    grad.addColorStop(0.52, '#45164a');
    grad.addColorStop(0.60, '#8a2550');
    grad.addColorStop(0.67, '#d4544e');
    grad.addColorStop(0.73, '#f59a5a');
    grad.addColorStop(0.80, '#ffc98a');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    // Dải ngân hà chạy chéo bầu trời
    g.globalCompositeOperation = 'lighter';
    const ax = -w * 0.05, ay = h * 0.42, bx = w * 1.05, by = -h * 0.02;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    const band = Math.min(w, h) * 0.12;

    const nebula = ['rgba(150, 120, 255, 0.05)', 'rgba(255, 140, 210, 0.04)', 'rgba(120, 190, 255, 0.04)'];
    for (let i = 0; i < 70; i++) {
        const t = Math.random();
        const o = gauss() * band;
        const x = ax + dx * t + nx * o, y = ay + dy * t + ny * o;
        const r = rand(band * 0.6, band * 1.8);
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, pick(nebula));
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    const dust = Math.floor((w * h) / (isMobile ? 260 : 180));
    for (let i = 0; i < dust; i++) {
        const t = Math.random();
        const o = gauss() * band * 1.2;
        const x = ax + dx * t + nx * o, y = ay + dy * t + ny * o;
        g.fillStyle = `rgba(255, 245, 255, ${rand(0.04, 0.22) * (1 - y / h)})`;
        g.fillRect(x, y, rand(0.4, 1.1), rand(0.4, 1.1));
    }

    // Vệt tối nhẹ ở giữa dải ngân hà
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 40; i++) {
        const t = Math.random();
        const o = gauss() * band * 0.25;
        const x = ax + dx * t + nx * o, y = ay + dy * t + ny * o;
        const r = rand(band * 0.2, band * 0.5);
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(5, 4, 15, 0.12)');
        rg.addColorStop(1, 'rgba(5, 4, 15, 0)');
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
}

// Ba lớp đồi, xa → gần, có viền sáng hắt từ mặt trời
function buildHills() {
    const defs = [
        { base: 0.60, dip: 0.04, amps: [0.03, 0.012, 0.006], top: '#4a1a46', bottom: '#1e0c24', rim: 0.45, depth: 0.25 },
        { base: 0.69, amps: [0.04, 0.02, 0.008], top: '#25102a', bottom: '#110714', rim: 0.3, depth: 0.55 },
        { base: 0.79, amps: [0.03, 0.018, 0.01], top: '#120814', bottom: '#060308', rim: 0.18, depth: 0.85 }
    ];
    const m = PARALLAX * 2;
    hillLayers = defs.map(d => {
        const w = W + m * 2;
        const c = makeCanvas(w * DPR, H * DPR);
        const g = c.getContext('2d');
        g.scale(DPR, DPR);

        const phases = d.amps.map(() => rand(0, Math.PI * 2));
        const freqs = [rand(1.2, 2), rand(3, 5), rand(8, 12)];
        const yAt = x => {
            let y = d.base * H;
            d.amps.forEach((a, i) => { y += Math.sin((x / w) * freqs[i] * Math.PI + phases[i]) * a * H; });
            // Thung lũng ở giữa để mặt trời luôn ló ra
            if (d.dip) y += Math.exp(-(((x / w - 0.5) / 0.14) ** 2)) * d.dip * H;
            return y;
        };

        const path = new Path2D();
        path.moveTo(0, H);
        for (let x = 0; x <= w; x += 4) path.lineTo(x, yAt(x));
        path.lineTo(w, H);
        path.closePath();

        const grad = g.createLinearGradient(0, (d.base - 0.06) * H, 0, H);
        grad.addColorStop(0, d.top);
        grad.addColorStop(1, d.bottom);
        g.fillStyle = grad;
        g.fill(path);

        // Viền sáng đỉnh đồi, mạnh nhất ở phía mặt trời
        const rim = g.createLinearGradient(0, 0, w, 0);
        rim.addColorStop(0, 'rgba(255, 150, 130, 0)');
        rim.addColorStop(0.5, `rgba(255, 180, 140, ${d.rim})`);
        rim.addColorStop(1, 'rgba(255, 150, 130, 0)');
        g.strokeStyle = rim;
        g.lineWidth = 1.4;
        g.beginPath();
        for (let x = 0; x <= w; x += 4) x === 0 ? g.moveTo(x, yAt(x)) : g.lineTo(x, yAt(x));
        g.stroke();

        // Sương mờ ở chân đồi
        g.save();
        g.clip(path);
        const mist = g.createLinearGradient(0, d.base * H, 0, (d.base + 0.16) * H);
        mist.addColorStop(0, 'rgba(255, 140, 160, 0)');
        mist.addColorStop(0.5, `rgba(255, 140, 160, ${0.06 * (1 - d.depth)})`);
        mist.addColorStop(1, 'rgba(255, 140, 160, 0)');
        g.fillStyle = mist;
        g.fillRect(0, d.base * H, w, 0.16 * H);
        g.restore();

        return { canvas: c, depth: d.depth, margin: m };
    });
}

function initStars() {
    stars = [];
    const n = Math.floor((W * H) / (isMobile ? 1400 : 1100));
    const colors = ['#ffffff', '#ffffff', '#ffffff', '#cfe0ff', '#ffe6f0', '#fff3d6'];
    for (let i = 0; i < n; i++) {
        const y = Math.pow(Math.random(), 1.4) * H * 0.62;
        const bright = Math.random() > 0.96;
        stars.push({
            x: Math.random() * W,
            y,
            size: bright ? rand(1.1, 1.9) : rand(0.3, 1.1),
            bright,
            phase: rand(0, Math.PI * 2),
            speed: rand(0.01, 0.04),
            fade: 1 - y / (H * 0.66),
            color: pick(colors)
        });
    }
    shootingStars = [];
}

function createShootingStar(x, y) {
    const dir = Math.random() > 0.5 ? 1 : -1;
    const angle = rand(Math.PI / 7, Math.PI / 4);
    return {
        x: x ?? rand(W * 0.1, W * 0.9),
        y: y ?? rand(0, H * 0.25),
        vx: Math.cos(angle) * dir,
        vy: Math.sin(angle),
        speed: rand(9, 16),
        len: rand(90, 200),
        life: 1
    };
}

function initClouds() {
    clouds = [];
    const n = isMobile ? 6 : 10;
    for (let i = 0; i < n; i++) clouds.push(makeCloud(Math.random() * W));
}

function makeCloud(x) {
    const y = rand(0.12, 0.52) * H;
    const s = rand(40, 90) * (isMobile ? 0.7 : 1);
    const w = s * rand(4, 7), h = s * 1.6;
    const c = makeCanvas(w * DPR, h * DPR);
    const g = c.getContext('2d');
    g.scale(DPR, DPR);

    // Càng gần chân trời mây càng ấm và sáng
    const warm = y / (H * 0.55);
    const lit = [Math.round(140 + 115 * warm), Math.round(70 + 80 * warm), Math.round(120 - 20 * warm)];
    g.filter = `blur(${Math.round(s * 0.18)}px)`;
    const puffs = Math.floor(rand(10, 16));
    for (let i = 0; i < puffs; i++) {
        const px = rand(s * 1.1, w - s * 1.1);
        const py = h * 0.55 + gauss() * s * 0.12;
        const r = rand(s * 0.35, s * 0.6) * (1 - Math.abs(px / w - 0.5));
        const rg = g.createRadialGradient(px, py + r * 0.3, 0, px, py, r * 1.6);
        rg.addColorStop(0, `rgba(${lit[0]}, ${lit[1]}, ${lit[2]}, 0.22)`);
        rg.addColorStop(0.6, `rgba(${lit[0] - 40}, ${lit[1] - 30}, ${lit[2]}, 0.08)`);
        rg.addColorStop(1, 'rgba(60, 20, 60, 0)');
        g.fillStyle = rg;
        g.beginPath();
        g.ellipse(px, py, r * 2.4, r, 0, 0, Math.PI * 2);
        g.fill();
    }
    return { canvas: c, x, y, w, h, speed: rand(0.06, 0.22), alpha: rand(0.6, 1), depth: rand(0.1, 0.35) };
}

function initGrass() {
    grassBlades = [];
    const n = Math.floor(W * (isMobile ? 1.8 : 1.2));
    const flowerColors = ['#ffffff', '#fff4e0', '#ffd6e4', '#ffb3c8', '#c9dcff', '#e8d6ff', '#ffe3a8'];
    for (let i = 0; i < n; i++) {
        const layer = Math.random();
        const hasFlower = layer > 0.2 && Math.random() > 0.55;
        grassBlades.push({
            x: rand(-20, W + 20),
            y: H + 10,
            h: H * 0.03 + layer * H * 0.15 + Math.random() * H * 0.04,
            layer,
            stiffness: rand(0.6, 1),
            color: `hsl(${rand(150, 170)}, ${30 + layer * 15}%, ${3 + layer * 9}%)`,
            hasFlower,
            flowerColor: hasFlower ? pick(flowerColors) : null,
            flowerSize: hasFlower ? layer * 2.6 + rand(2, 5) : 0,
            sway: rand(0, Math.PI * 2)
        });
    }
    grassBlades.sort((a, b) => a.layer - b.layer);
}

function initFireflies() {
    fireflies = [];
    const n = isMobile ? 22 : 36;
    for (let i = 0; i < n; i++) {
        fireflies.push({
            x: Math.random() * W,
            y: H - Math.random() * H * 0.35,
            size: rand(1, 2.4),
            seed: rand(0, 1000),
            blink: rand(0.02, 0.06),
            color: pick(['#d9ff7a', '#b6ff5c', '#fff3a0'])
        });
    }
}

// ---------- Vẽ ----------

function drawSky() {
    const m = PARALLAX;
    ctx.drawImage(skyLayer, -m - pointer.x * 0.15, -m - pointer.y * 0.15, W + m * 2, H + m * 2);
}

function drawStars() {
    const ox = -pointer.x * 0.2, oy = -pointer.y * 0.2;
    for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(time * s.speed + s.phase);
        const a = Math.max(0, tw * s.fade);
        if (a < 0.02) continue;
        const x = s.x + ox, y = s.y + oy;
        if (s.bright) {
            drawGlow(s.color, x, y, s.size * 10, a * 0.6);
            // Tia sáng chữ thập cho sao lớn
            ctx.globalAlpha = a * 0.35;
            ctx.fillStyle = s.color;
            ctx.fillRect(x - s.size * 4, y - 0.4, s.size * 8, 0.8);
            ctx.fillRect(x - 0.4, y - s.size * 4, 0.8, s.size * 8);
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(x, y, s.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawShootingStars() {
    if (Math.random() < 0.004 && shootingStars.length < 3) shootingStars.push(createShootingStar());

    ctx.globalCompositeOperation = 'lighter';
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.x += s.vx * s.speed;
        s.y += s.vy * s.speed;
        s.life -= 0.012;
        if (s.life <= 0 || s.y > H * 0.7) { shootingStars.splice(i, 1); continue; }

        const tx = s.x - s.vx * s.len, ty = s.y - s.vy * s.len;
        const grad = ctx.createLinearGradient(s.x, s.y, tx, ty);
        grad.addColorStop(0, `rgba(255, 255, 255, ${s.life})`);
        grad.addColorStop(0.3, `rgba(255, 210, 230, ${s.life * 0.4})`);
        grad.addColorStop(1, 'rgba(255, 200, 230, 0)');
        ctx.globalAlpha = 1;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        drawGlow('#ffffff', s.x, s.y, 16, s.life);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
}

function drawSun() {
    const { x: sx, y: sy, r } = sunPos();
    const x = sx - pointer.x * 0.3, y = sy - pointer.y * 0.3;
    const pulse = 1 + Math.sin(time * 0.01) * 0.04;

    ctx.globalCompositeOperation = 'lighter';

    // Quầng sáng rộng trải dọc chân trời
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(3.2, 1);
    let g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 4);
    g.addColorStop(0, 'rgba(255, 170, 90, 0.35)');
    g.addColorStop(0.5, 'rgba(255, 90, 80, 0.1)');
    g.addColorStop(1, 'rgba(255, 60, 80, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Hào quang tròn
    g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3 * pulse);
    g.addColorStop(0, 'rgba(255, 220, 150, 0.7)');
    g.addColorStop(0.3, 'rgba(255, 130, 70, 0.3)');
    g.addColorStop(1, 'rgba(255, 80, 60, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 3 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';

    // Lõi mặt trời
    g = ctx.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, '#fffbe8');
    g.addColorStop(0.6, '#ffe2a0');
    g.addColorStop(1, '#ffb070');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

function drawClouds() {
    for (const c of clouds) {
        c.x -= c.speed;
        if (c.x < -c.w - PARALLAX) {
            Object.assign(c, makeCloud(W + PARALLAX));
        }
        ctx.globalAlpha = c.alpha;
        ctx.drawImage(c.canvas, c.x - pointer.x * c.depth, c.y - c.h / 2 - pointer.y * c.depth, c.w, c.h);
    }
    ctx.globalAlpha = 1;
}

function drawHills() {
    for (const l of hillLayers) {
        ctx.drawImage(l.canvas, -l.margin - pointer.x * l.depth, -pointer.y * l.depth * 0.5, W + l.margin * 2, H);
    }
    // Bóng tối phủ chân màn hình làm nền cho cỏ
    const g = ctx.createLinearGradient(0, H * 0.72, 0, H);
    g.addColorStop(0, 'rgba(4, 2, 6, 0)');
    g.addColorStop(1, 'rgba(4, 2, 6, 0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);
}

function drawFlower(x, y, size, color, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-size * 1.5, -size * 0.2, -size * 1.5, -size * 1.8, -size * 0.6, -size * 1.8);
    ctx.bezierCurveTo(-size * 0.4, -size * 1.8, -size * 0.3, -size * 2.2, 0, -size * 2.2);
    ctx.bezierCurveTo(size * 0.3, -size * 2.2, size * 0.4, -size * 1.8, size * 0.6, -size * 1.8);
    ctx.bezierCurveTo(size * 1.5, -size * 1.8, size * 1.5, -size * 0.2, 0, 0);
    ctx.fill();
    // Ánh sáng hắt nhẹ trên cánh hoa
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-size * 0.35, -size * 1.3, size * 0.25, size * 0.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawGrass() {
    const wind = Math.sin(time * 0.012) * 0.22 + Math.sin(time * 0.031) * 0.06;
    const flowers = [];

    ctx.save();
    ctx.translate(-pointer.x * 1.1, 0);
    ctx.lineCap = 'round';

    for (const b of grassBlades) {
        let w = wind + Math.sin(time * 0.02 + b.x * 0.01 + b.sway) * 0.15;
        w *= b.stiffness * b.layer;

        ctx.strokeStyle = b.color;
        ctx.lineWidth = 0.5 + b.layer * 2;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        let cx = b.x, cy = b.y;
        const segs = 3 + Math.floor(b.layer * 2);
        const sl = b.h / segs;
        for (let j = 1; j <= segs; j++) {
            const a = w * (j / segs);
            cx += Math.sin(a) * sl;
            cy -= Math.cos(a) * sl;
            ctx.lineTo(cx, cy);
        }
        ctx.stroke();

        if (b.hasFlower) {
            drawGlow(b.flowerColor, cx, cy - b.flowerSize, b.flowerSize * 6, 0.12 * b.layer);
            ctx.globalAlpha = 0.6 + b.layer * 0.4;
            drawFlower(cx, cy, b.flowerSize, b.flowerColor, w * 0.8 + Math.sin(time * 0.05 + b.x) * 0.05);
            ctx.globalAlpha = 1;

            // Phấn hoa bay lên
            if (Math.random() > 0.9985) {
                particles.push({
                    x: cx - pointer.x * 1.1, y: cy, color: b.flowerColor,
                    size: rand(1, 2.4), vx: rand(-0.25, 0.25), vy: rand(-1.4, -0.4),
                    life: 1, decay: 0.005, burst: false
                });
            }
        }
    }
    ctx.restore();
}

function drawParticles() {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.burst) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.93;
            p.vy = p.vy * 0.93 + 0.05;
        } else {
            p.x += p.vx + Math.sin(time * 0.04 + p.y * 0.05) * 0.4;
            p.y += p.vy;
        }
        p.life -= p.decay;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const a = Math.min(1, p.life);
        const x = p.x;
        drawGlow(p.color, x, p.y, p.size * 8, a * 0.7);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
}

function drawFireflies() {
    ctx.globalCompositeOperation = 'lighter';
    for (const f of fireflies) {
        const t = time * 0.01 + f.seed;
        f.x += Math.sin(t * 1.3) * 0.6 + Math.cos(t * 0.7) * 0.4;
        f.y += Math.cos(t * 1.1) * 0.4 + Math.sin(t * 0.5) * 0.2;
        if (f.x < -10) f.x = W + 10;
        if (f.x > W + 10) f.x = -10;
        if (f.y < H * 0.6) f.y += 1;
        if (f.y > H) f.y -= 1;

        const a = Math.max(0, Math.sin(time * f.blink + f.seed)) ** 2;
        if (a < 0.02) continue;
        const x = f.x - pointer.x * 0.9;
        drawGlow(f.color, x, f.y, f.size * 14, a * 0.8);
        ctx.globalAlpha = a;
        ctx.fillStyle = '#fffbe0';
        ctx.beginPath();
        ctx.arc(x, f.y, f.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
}

function animate() {
    time++;
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    drawSky();
    drawStars();
    drawShootingStars();
    drawSun();
    drawClouds();
    drawHills();
    drawGrass();
    drawFireflies();
    drawParticles();

    requestAnimationFrame(animate);
}

// ---------- Tương tác ----------

function burst(x, y) {
    const colors = ['#ffffff', '#ffd6e4', '#ffb3c8', '#c9dcff', '#ffe3a8', '#e8d6ff'];
    for (let i = 0; i < 34; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rand(1.5, 6.5);
        particles.push({
            x, y, color: pick(colors), size: rand(1, 3),
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 1.4, decay: rand(0.012, 0.022), burst: true
        });
    }
    // Chạm lên bầu trời thì có thêm sao băng
    if (y < H * 0.6) {
        for (let i = 0; i < 2; i++) {
            setTimeout(() => shootingStars.push(createShootingStar()), i * 250);
        }
    }
}

const music = document.getElementById('bg-music');
const musicBtn = document.getElementById('music-toggle');
let userMuted = false;

function playMusic() {
    const p = music.play();
    if (p) p.then(() => musicBtn.classList.add('playing')).catch(() => {});
}

musicBtn.addEventListener('pointerdown', e => e.stopPropagation());
musicBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (music.paused) {
        userMuted = false;
        playMusic();
    } else {
        music.pause();
        userMuted = true;
        musicBtn.classList.remove('playing');
    }
});

window.addEventListener('pointerdown', e => {
    if (!userMuted && music.paused) playMusic();
    burst(e.clientX, e.clientY);
});

window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    pointer.tx = (e.clientX / W - 0.5) * 2 * PARALLAX;
    pointer.ty = (e.clientY / H - 0.5) * 2 * PARALLAX * 0.5;
});

window.addEventListener('deviceorientation', e => {
    if (e.gamma == null) return;
    pointer.tx = Math.max(-1, Math.min(1, e.gamma / 30)) * PARALLAX;
    pointer.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30)) * PARALLAX * 0.5;
});

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
});

resize();
playMusic();
requestAnimationFrame(animate);
