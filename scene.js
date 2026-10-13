// Cảnh hoàng hôn: bầu trời sao, dải ngân hà, mặt trời lặn, mây, đồi, cánh đồng hoa, cánh hoa bay và đom đóm.
// File này chạy được ở hai nơi:
//  - Trong Web Worker với OffscreenCanvas (luồng chính rảnh hoàn toàn).
//  - Ngay trên luồng chính khi trình duyệt không hỗ trợ (index.js tự chọn).
(function (global) {
    'use strict';

    const IN_WORKER = typeof WorkerGlobalScope !== 'undefined' && global instanceof WorkerGlobalScope;
    const raf = typeof global.requestAnimationFrame === 'function'
        ? cb => global.requestAnimationFrame(cb)
        : cb => setTimeout(() => cb(performance.now()), 1000 / 60);

    let canvas, ctx;
    let W = 0, H = 0, DPR = 1, isMobile = false;

    // Thời gian tính theo khung hình chuẩn 60fps, nên màn 120Hz không làm cảnh chạy nhanh gấp đôi
    let time = 0, step = 1, lastT = 0;
    let running = true, looping = false;

    // Chất lượng tự hạ khi máy yếu
    let quality = 1, frameAcc = 0, frameCount = 0, warmup = 90, lastSize = null;

    const PARALLAX = 18;
    const MAX_PARTICLES = 450;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const gust = { x: 0, s: 0 };

    let skyLayer, sunSprites, raysSprite, hillLayers = [];
    let stars = [], shootingStars = [], clouds = [], grassBuckets = [];
    let fireflies = [], particles = [], petals = [], rings = [], wisps = [];
    const grassPts = new Float32Array(32);

    const FLOWER_COLORS = ['#ffffff', '#fff4e0', '#ffd6e4', '#ffb3c8', '#c9dcff', '#e8d6ff', '#ffe3a8'];
    const SPARK_COLORS = ['#ffffff', '#ffd6e4', '#ffb3c8', '#c9dcff', '#ffe3a8', '#e8d6ff'];
    const PETAL_COLORS = ['#ffc2d6', '#ffd9e6', '#ffb0c8', '#fff0f5'];

    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

    function makeCanvas(w, h) {
        w = Math.max(1, Math.ceil(w));
        h = Math.max(1, Math.ceil(h));
        if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    }

    function hexToRgba(hex, a) {
        const n = parseInt(hex.slice(1), 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }

    // ---------- Sprite vẽ sẵn (thay cho shadowBlur / gradient mỗi khung hình) ----------

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
        return (glowCache[color] = c);
    }

    function drawGlow(color, x, y, size, alpha) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(glow(color), x - size / 2, y - size / 2, size, size);
    }

    function tulipPath(g, s) {
        g.beginPath();
        g.moveTo(0, 0);
        g.bezierCurveTo(-s * 1.5, -s * 0.2, -s * 1.5, -s * 1.8, -s * 0.6, -s * 1.8);
        g.bezierCurveTo(-s * 0.4, -s * 1.8, -s * 0.3, -s * 2.2, 0, -s * 2.2);
        g.bezierCurveTo(s * 0.3, -s * 2.2, s * 0.4, -s * 1.8, s * 0.6, -s * 1.8);
        g.bezierCurveTo(s * 1.5, -s * 1.8, s * 1.5, -s * 0.2, 0, 0);
    }

    const FU = 16, FPAD = 8, FRES = 2;
    const flowerCache = {};
    function flowerSprite(color) {
        if (flowerCache[color]) return flowerCache[color];
        const w = FU * 3.2 + FPAD * 2, h = FU * 2.4 + FPAD * 2;
        const ax = w / 2, ay = FPAD + FU * 2.2;
        const c = makeCanvas(w * FRES, h * FRES);
        const g = c.getContext('2d');
        g.scale(FRES, FRES);
        g.translate(ax, ay);

        g.shadowColor = color;
        g.shadowBlur = 7;
        g.fillStyle = color;
        tulipPath(g, FU);
        g.fill();
        g.shadowBlur = 0;

        // Đổ bóng nhẹ ở gốc cánh cho có khối
        const shade = g.createLinearGradient(0, 0, 0, -FU * 2.2);
        shade.addColorStop(0, 'rgba(90, 20, 60, 0.4)');
        shade.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
        g.fillStyle = shade;
        tulipPath(g, FU);
        g.fill();

        g.globalAlpha = 0.25;
        g.strokeStyle = 'rgb(120, 40, 80)';
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(0, -FU * 0.3);
        g.lineTo(0, -FU * 1.9);
        g.stroke();

        g.globalAlpha = 0.45;
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.ellipse(-FU * 0.4, -FU * 1.3, FU * 0.2, FU * 0.48, -0.3, 0, Math.PI * 2);
        g.fill();

        return (flowerCache[color] = { canvas: c, w, h, ax, ay });
    }

    const petalCache = {};
    function petalSprite(color) {
        if (petalCache[color]) return petalCache[color];
        const w = 32, h = 22;
        const c = makeCanvas(w, h);
        const g = c.getContext('2d');
        g.translate(w / 2, h / 2);
        const grad = g.createRadialGradient(-4, -2, 1, 0, 0, 16);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, color);
        grad.addColorStop(1, hexToRgba(color, 0.7));
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(-14, 0);
        g.bezierCurveTo(-8, -10, 8, -10, 14, -2);
        g.lineTo(10, 0);
        g.lineTo(14, 2);
        g.bezierCurveTo(8, 10, -8, 10, -14, 0);
        g.fill();
        return (petalCache[color] = c);
    }

    function setTransform(x, y, angle, sx, sy) {
        const cos = Math.cos(angle), sin = Math.sin(angle);
        ctx.setTransform(DPR * sx * cos, DPR * sx * sin, -DPR * sy * sin, DPR * sy * cos, DPR * x, DPR * y);
    }

    function resetTransform() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    // ---------- Dựng cảnh ----------

    let dprCap = 2;

    function setSize(m) {
        W = m.width;
        H = m.height;
        DPR = Math.min(m.dpr, dprCap);
        lastSize = m;
        isMobile = W < 768;
        canvas.width = Math.floor(W * DPR);
        canvas.height = Math.floor(H * DPR);

        buildSky();
        buildSun();
        buildHills();
        initStars();
        initClouds();
        initGrass();
        initFireflies();
        initPetals();
        particles = [];
        rings = [];
        wisps = [];
        breeze.active = false;
        breeze.next = rand(120, 300);
        shootingStars = [];
    }

    const sunPos = () => ({
        x: W * 0.5,
        y: H * 0.6,
        r: isMobile ? W * 0.13 : Math.min(W, H) * 0.075
    });

    function buildSky() {
        const m = PARALLAX;
        const w = W + m * 2, h = H + m * 2;
        skyLayer = makeCanvas(w * DPR, h * DPR);
        const g = skyLayer.getContext('2d');
        g.scale(DPR, DPR);

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
        for (let i = 0; i < 80; i++) {
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

        // Vệt bụi tối ở giữa dải ngân hà
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

    // Quầng sáng, lõi mặt trời và tia nắng được vẽ sẵn một lần
    function buildSun() {
        const { r } = sunPos();

        const horizon = makeCanvas(256, 64);
        let g = horizon.getContext('2d');
        g.translate(128, 32);
        g.scale(4, 1);
        let rg = g.createRadialGradient(0, 0, 0, 0, 0, 32);
        rg.addColorStop(0, 'rgba(255, 170, 90, 0.4)');
        rg.addColorStop(0.5, 'rgba(255, 90, 80, 0.12)');
        rg.addColorStop(1, 'rgba(255, 60, 80, 0)');
        g.fillStyle = rg;
        g.fillRect(-32, -32, 64, 64);

        const halo = makeCanvas(256, 256);
        g = halo.getContext('2d');
        rg = g.createRadialGradient(128, 128, 21, 128, 128, 128);
        rg.addColorStop(0, 'rgba(255, 220, 150, 0.75)');
        rg.addColorStop(0.3, 'rgba(255, 130, 70, 0.3)');
        rg.addColorStop(1, 'rgba(255, 80, 60, 0)');
        g.fillStyle = rg;
        g.fillRect(0, 0, 256, 256);

        const cs = Math.ceil(r * 2 * DPR) + 2;
        const core = makeCanvas(cs, cs);
        g = core.getContext('2d');
        const c = cs / 2;
        rg = g.createRadialGradient(c, c - c * 0.3, 0, c, c, c - 1);
        rg.addColorStop(0, '#fffbe8');
        rg.addColorStop(0.6, '#ffe2a0');
        rg.addColorStop(0.97, '#ffb070');
        rg.addColorStop(1, 'rgba(255, 176, 112, 0)');
        g.fillStyle = rg;
        g.beginPath();
        g.arc(c, c, c - 1, 0, Math.PI * 2);
        g.fill();

        sunSprites = { horizon, halo, core };

        // Tia nắng: các nan sáng mảnh, mờ dần ra xa
        const rs = 512;
        raysSprite = makeCanvas(rs, rs);
        g = raysSprite.getContext('2d');
        g.translate(rs / 2, rs / 2);
        const n = 18;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + rand(-0.1, 0.1);
            const spread = rand(0.015, 0.05);
            g.fillStyle = `rgba(255, 210, 160, ${rand(0.25, 0.6)})`;
            g.beginPath();
            g.moveTo(0, 0);
            g.arc(0, 0, rs / 2, a - spread, a + spread);
            g.closePath();
            g.fill();
        }
        g.globalCompositeOperation = 'destination-in';
        rg = g.createRadialGradient(0, 0, 0, 0, 0, rs / 2);
        rg.addColorStop(0, 'rgba(0,0,0,1)');
        rg.addColorStop(0.25, 'rgba(0,0,0,0.6)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg;
        g.fillRect(-rs / 2, -rs / 2, rs, rs);
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
            const w = W + m * 2, hh = H + m;
            const c = makeCanvas(w * DPR, hh * DPR);
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
            path.moveTo(0, hh);
            for (let x = 0; x <= w; x += 4) path.lineTo(x, yAt(x));
            path.lineTo(w, hh);
            path.closePath();

            const grad = g.createLinearGradient(0, (d.base - 0.06) * H, 0, H);
            grad.addColorStop(0, d.top);
            grad.addColorStop(1, d.bottom);
            g.fillStyle = grad;
            g.fill(path);

            const rim = g.createLinearGradient(0, 0, w, 0);
            rim.addColorStop(0, 'rgba(255, 150, 130, 0)');
            rim.addColorStop(0.5, `rgba(255, 180, 140, ${d.rim})`);
            rim.addColorStop(1, 'rgba(255, 150, 130, 0)');
            g.strokeStyle = rim;
            g.lineWidth = 1.4;
            g.beginPath();
            for (let x = 0; x <= w; x += 4) x === 0 ? g.moveTo(x, yAt(x)) : g.lineTo(x, yAt(x));
            g.stroke();

            g.save();
            g.clip(path);
            const mist = g.createLinearGradient(0, d.base * H, 0, (d.base + 0.16) * H);
            mist.addColorStop(0, 'rgba(255, 140, 160, 0)');
            mist.addColorStop(0.5, `rgba(255, 140, 160, ${0.06 * (1 - d.depth)})`);
            mist.addColorStop(1, 'rgba(255, 140, 160, 0)');
            g.fillStyle = mist;
            g.fillRect(0, d.base * H, w, 0.16 * H);
            g.restore();

            return { canvas: c, depth: d.depth, margin: m, h: hh };
        });

        // Bóng tối phủ chân màn hình làm nền cho cỏ (vẽ sẵn vào lớp đồi gần nhất)
        const near = hillLayers[hillLayers.length - 1];
        const g = near.canvas.getContext('2d');
        const shade = g.createLinearGradient(0, H * 0.72, 0, H);
        shade.addColorStop(0, 'rgba(4, 2, 6, 0)');
        shade.addColorStop(1, 'rgba(4, 2, 6, 0.95)');
        g.fillStyle = shade;
        g.fillRect(0, H * 0.72, W + near.margin * 2, H * 0.28 + near.margin);
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
                size: bright ? rand(1.1, 1.9) : rand(0.4, 1.3),
                bright,
                phase: rand(0, Math.PI * 2),
                speed: rand(0.01, 0.04),
                fade: 1 - y / (H * 0.66),
                color: pick(colors)
            });
        }
        // Sao lớn vẽ sau cùng để nổi lên trên
        stars.sort((a, b) => a.bright - b.bright);
    }

    function createShootingStar() {
        const dir = Math.random() > 0.5 ? 1 : -1;
        const angle = rand(Math.PI / 7, Math.PI / 4);
        return {
            x: rand(W * 0.1, W * 0.9),
            y: rand(0, H * 0.25),
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

    // Cỏ chia nhóm theo độ sâu để hoa được vẽ xen đúng lớp.
    // Các lớp xa gần như không đung đưa nên được vẽ sẵn một lần vào grassBack.
    const NB = 8, STATIC_BUCKETS = 2;
    let grassBack = null;

    function initGrass() {
        grassBuckets = [];
        for (let i = 0; i < NB; i++) {
            const layer = (i + 0.5) / NB;
            grassBuckets.push({ layer, hw: (1.2 + layer * 3) * 0.5, blades: [], flowers: [] });
        }

        const n = Math.floor(W * (isMobile ? 1.8 : 1.2) * quality);
        const m = PARALLAX * 2;
        for (let i = 0; i < n; i++) {
            const layer = Math.random();
            const bi = Math.min(NB - 1, Math.floor(layer * NB));
            const blade = {
                x: rand(-m, W + m),
                h: H * 0.03 + layer * H * 0.15 + Math.random() * H * 0.04,
                layer,
                segs: 3 + Math.floor(layer * 2),
                stiffness: rand(0.6, 1),
                sway: rand(0, Math.PI * 2),
                color: `hsl(${rand(148, 172)}, ${28 + layer * 18}%, ${3 + layer * 9 + rand(-1, 1.5)}%)`,
                tx: 0, ty: 0, wind: 0
            };
            grassBuckets[bi].blades.push(blade);
            if (bi >= STATIC_BUCKETS && Math.random() > 0.55) {
                const color = pick(FLOWER_COLORS);
                grassBuckets[bi].flowers.push({
                    blade,
                    color,
                    sprite: flowerSprite(color),
                    size: layer * 2.6 + rand(2, 5),
                    alpha: 0.6 + layer * 0.4
                });
            }
        }

        // Vẽ sẵn các lớp cỏ xa, rộng hơn màn hình để chừa chỗ cho thị sai
        grassBack = makeCanvas((W + m * 2) * DPR, H * DPR);
        const g = grassBack.getContext('2d');
        g.scale(DPR, DPR);
        g.translate(m, 0);
        for (let i = 0; i < STATIC_BUCKETS; i++) {
            const b = grassBuckets[i];
            for (const blade of b.blades) {
                g.fillStyle = blade.color;
                bladePath(g, blade, rand(-0.05, 0.05), b.hw);
                g.fill();
            }
        }
    }

    // Lá cỏ là hình thon nhọn uốn theo gió; trả về ngọn lá qua blade.tx / blade.ty
    function bladePath(c, g, w, hw0) {
        let cx = g.x, cy = H + 10;
        const n = g.segs;
        const sl = g.h / n;
        const rx = grassPts;
        c.beginPath();
        c.moveTo(cx - hw0, cy);
        for (let j = 1; j <= n; j++) {
            const a = w * (j / n);
            const sin = Math.sin(a), cos = Math.cos(a);
            cx += sin * sl;
            cy -= cos * sl;
            const hw = hw0 * (1 - j / n);
            rx[j * 2] = cx + cos * hw;
            rx[j * 2 + 1] = cy + sin * hw;
            c.lineTo(cx - cos * hw, cy - sin * hw);
        }
        for (let j = n - 1; j >= 1; j--) c.lineTo(rx[j * 2], rx[j * 2 + 1]);
        c.lineTo(g.x + hw0, H + 10);
        c.closePath();
        g.tx = cx;
        g.ty = cy;
    }

    function initFireflies() {
        fireflies = [];
        const n = Math.round((isMobile ? 22 : 36) * Math.max(0.6, quality));
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

    function newPetal(anywhere) {
        return {
            x: anywhere ? rand(0, W) : W + rand(10, 60),
            y: anywhere ? rand(0, H) : rand(-H * 0.2, H * 0.7),
            size: rand(6, 11) * (isMobile ? 0.85 : 1),
            vx: -rand(0.5, 1.3),
            vy: rand(0.15, 0.5),
            rot: rand(0, Math.PI * 2),
            spin: rand(-0.03, 0.03),
            flip: rand(0, Math.PI * 2),
            flipSpeed: rand(0.02, 0.06),
            sprite: petalSprite(pick(PETAL_COLORS)),
            alpha: rand(0.55, 0.9)
        };
    }

    function initPetals() {
        petals = [];
        const n = Math.round((isMobile ? 12 : 22) * quality);
        for (let i = 0; i < n; i++) petals.push(newPetal(true));
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
            const a = tw * s.fade;
            if (a < 0.02) continue;
            const x = s.x + ox, y = s.y + oy;
            ctx.fillStyle = s.color;
            if (s.bright) {
                drawGlow(s.color, x, y, s.size * 10, a * 0.6);
                // Tia sáng chữ thập cho sao lớn
                ctx.globalAlpha = a * 0.35;
                ctx.fillRect(x - s.size * 4, y - 0.4, s.size * 8, 0.8);
                ctx.fillRect(x - 0.4, y - s.size * 4, 0.8, s.size * 8);
            }
            // Sao nhỏ dùng fillRect, rẻ hơn nhiều so với arc
            ctx.globalAlpha = a;
            const d = s.size;
            ctx.fillRect(x - d / 2, y - d / 2, d, d);
        }
        ctx.globalAlpha = 1;
    }

    function drawShootingStars() {
        if (Math.random() < 0.004 * step && shootingStars.length < 3) shootingStars.push(createShootingStar());

        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (let i = shootingStars.length - 1; i >= 0; i--) {
            const s = shootingStars[i];
            s.x += s.vx * s.speed * step;
            s.y += s.vy * s.speed * step;
            s.life -= 0.012 * step;
            if (s.life <= 0 || s.y > H * 0.7) { shootingStars.splice(i, 1); continue; }

            const tx = s.x - s.vx * s.len, ty = s.y - s.vy * s.len;
            const grad = ctx.createLinearGradient(s.x, s.y, tx, ty);
            grad.addColorStop(0, `rgba(255, 255, 255, ${s.life})`);
            grad.addColorStop(0.3, `rgba(255, 210, 230, ${s.life * 0.4})`);
            grad.addColorStop(1, 'rgba(255, 200, 230, 0)');
            ctx.globalAlpha = 1;
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            drawGlow('#ffffff', s.x, s.y, 18, s.life);

            // Bụi sao rơi lại phía sau
            if (Math.random() < 0.5 * step) {
                addParticle({
                    x: s.x, y: s.y, color: pick(SPARK_COLORS), size: rand(0.6, 1.4),
                    vx: rand(-0.3, 0.3), vy: rand(-0.1, 0.4), life: s.life * 0.8, decay: 0.03, burst: true
                });
            }
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }

    function drawSun() {
        const { x: sx, y: sy, r } = sunPos();
        const x = sx - pointer.x * 0.3, y = sy - pointer.y * 0.3;
        const pulse = 1 + Math.sin(time * 0.01) * 0.04;

        ctx.globalCompositeOperation = 'lighter';

        // Tia nắng xoay rất chậm
        const rs = r * 9 * pulse;
        ctx.globalAlpha = 0.14 + Math.sin(time * 0.013) * 0.04;
        setTransform(x, y, time * 0.0008, 1, 1);
        ctx.drawImage(raysSprite, -rs, -rs, rs * 2, rs * 2);
        resetTransform();

        ctx.globalAlpha = 1;
        const hw = r * 26, hh = r * 8;
        ctx.drawImage(sunSprites.horizon, x - hw / 2, y - hh / 2, hw, hh);
        const hs = r * 6 * pulse;
        ctx.drawImage(sunSprites.halo, x - hs / 2, y - hs / 2, hs, hs);

        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(sunSprites.core, x - r, y - r, r * 2, r * 2);
    }

    function drawClouds() {
        for (const c of clouds) {
            c.x -= c.speed * step;
            if (c.x < -c.w - PARALLAX) Object.assign(c, makeCloud(W + PARALLAX));
            ctx.globalAlpha = c.alpha;
            ctx.drawImage(c.canvas, c.x - pointer.x * c.depth, c.y - c.h / 2 - pointer.y * c.depth, c.w, c.h);
        }
        ctx.globalAlpha = 1;
    }

    function drawHills() {
        for (const l of hillLayers) {
            ctx.drawImage(l.canvas, -l.margin - pointer.x * l.depth, -pointer.y * l.depth * 0.5, W + l.margin * 2, l.h);
        }
    }

    function drawGrass() {
        const wind = Math.sin(time * 0.012) * 0.22 + Math.sin(time * 0.031) * 0.06;
        const ox = -pointer.x * 1.1;
        gust.s *= Math.pow(0.95, step);

        const m = PARALLAX * 2;
        ctx.drawImage(grassBack, ox - m, 0, W + m * 2, H);

        // Trên trình vẽ phần mềm, tô từng lá nhỏ nhanh hơn gộp một path khổng lồ
        for (let i = STATIC_BUCKETS; i < NB; i++) {
            const b = grassBuckets[i];
            ctx.translate(ox, 0);
            for (const g of b.blades) {
                let w = wind + Math.sin(time * 0.02 + g.x * 0.01 + g.sway) * 0.15;
                // Cơn gió nhỏ thổi ra từ chỗ chạm
                if (gust.s > 0.01) {
                    const dx = g.x - gust.x;
                    w += gust.s * Math.sign(dx) * Math.exp(-(dx * dx) / 40000) * Math.cos(time * 0.15 + g.sway);
                }
                w += breezeAt(g.x + ox) * (1 + 0.3 * Math.sin(time * 0.2 + g.sway));
                w *= g.stiffness * g.layer;
                g.wind = w;
                ctx.fillStyle = g.color;
                bladePath(ctx, g, w, b.hw);
                ctx.fill();
            }
            resetTransform();

            // Hoa của lớp này vẽ ngay sau cỏ cùng lớp để giữ đúng chiều sâu
            for (const f of b.flowers) {
                const g = f.blade;
                const x = g.tx + ox;
                const k = f.size / FU;
                ctx.globalAlpha = f.alpha;
                setTransform(x, g.ty, g.wind * 0.8 + Math.sin(time * 0.05 + g.x) * 0.05, k, k);
                ctx.drawImage(f.sprite.canvas, -f.sprite.ax, -f.sprite.ay, f.sprite.w, f.sprite.h);

                // Phấn hoa bay lên
                if (Math.random() < 0.0015 * step) {
                    addParticle({
                        x, y: g.ty - f.size, color: f.color, size: rand(1, 2.4),
                        vx: rand(-0.25, 0.25), vy: rand(-1.4, -0.4), life: 1, decay: 0.005, burst: false
                    });
                }
            }
            resetTransform();
        }
        ctx.globalAlpha = 1;
    }

    function drawPetals() {
        for (const p of petals) {
            const pb = breezeAt(p.x);
            p.x += (p.vx - Math.sin(time * 0.01) * 0.3 + pb * 6) * step;
            p.spin += pb * 0.002 * step;
            p.y += (p.vy + Math.sin(time * 0.03 + p.flip) * 0.25) * step;
            p.rot += p.spin * step;
            p.flip += p.flipSpeed * step;
            if (p.x < -40 || p.y > H + 40) Object.assign(p, newPetal(false));

            const x = p.x - pointer.x * 1.3;
            const k = p.size / 14;
            ctx.globalAlpha = p.alpha;
            // Lật cánh hoa bằng cách co trục y theo cos để trông như đang xoay trong gió
            setTransform(x, p.y, p.rot, k, k * (0.25 + 0.75 * Math.abs(Math.cos(p.flip))));
            ctx.drawImage(p.sprite, -16, -11, 32, 22);
        }
        resetTransform();
        ctx.globalAlpha = 1;
    }

    function addParticle(p) {
        if (particles.length < MAX_PARTICLES) particles.push(p);
    }

    function drawParticles() {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            if (p.burst) {
                p.x += p.vx * step;
                p.y += p.vy * step;
                const f = Math.pow(0.93, step);
                p.vx *= f;
                p.vy = p.vy * f + 0.05 * step;
            } else {
                p.x += (p.vx + Math.sin(time * 0.04 + p.y * 0.05) * 0.4) * step;
                p.y += p.vy * step;
            }
            p.life -= p.decay * step;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            drawGlow(p.color, p.x, p.y, p.size * 8, Math.min(1, p.life) * 0.8);
        }

        // Vòng sóng sáng lan ra từ chỗ chạm
        ctx.lineWidth = 1.5;
        for (let i = rings.length - 1; i >= 0; i--) {
            const r = rings[i];
            r.r += (r.max - r.r) * 0.06 * step;
            r.life -= 0.022 * step;
            if (r.life <= 0) { rings.splice(i, 1); continue; }
            ctx.globalAlpha = r.life * 0.6;
            ctx.strokeStyle = r.color;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }

    function drawFireflies() {
        ctx.globalCompositeOperation = 'lighter';
        for (const f of fireflies) {
            const t = time * 0.01 + f.seed;
            f.x += (Math.sin(t * 1.3) * 0.6 + Math.cos(t * 0.7) * 0.4 + breezeAt(f.x) * 3) * step;
            f.y += (Math.cos(t * 1.1) * 0.4 + Math.sin(t * 0.5) * 0.2) * step;
            if (f.x < -10) f.x = W + 10;
            if (f.x > W + 10) f.x = -10;
            if (f.y < H * 0.6) f.y += step;
            if (f.y > H) f.y -= step;

            const a = Math.max(0, Math.sin(time * f.blink + f.seed)) ** 2;
            if (a < 0.02) continue;
            const x = f.x - pointer.x * 0.9;
            drawGlow(f.color, x, f.y, f.size * 14, a * 0.8);
            drawGlow('#fffbe0', x, f.y, f.size * 3, a);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }

    // ---------- Cơn gió thoảng: dải đốm sáng bay lượn ngang màn hình ----------

    const breeze = { active: false, next: 240, x: 0, dir: 1, speed: 0, fade: 0, curve: null };

    function startBreeze() {
        breeze.active = true;
        breeze.dir = Math.random() > 0.5 ? 1 : -1;
        breeze.speed = Math.max(3, W / rand(260, 340));
        breeze.x = breeze.dir > 0 ? -120 : W + 120;
        breeze.fade = 1;
        // Mỗi cơn gió đi theo một đường lượn sóng riêng
        breeze.curve = {
            y: rand(0.42, 0.8) * H,
            amp: rand(0.04, 0.1) * H,
            freq: (rand(1.2, 2.6) * Math.PI) / W,
            phase: rand(0, Math.PI * 2),
            spread: rand(0.04, 0.07) * H
        };
    }

    const curveY = (c, x) => c.y + Math.sin(x * c.freq + c.phase) * c.amp;

    // Độ nghiêng do gió tại toạ độ x: mạnh nhất ở đầu cơn gió, nhạt dần phía sau
    function breezeAt(x) {
        if (!breeze.active) return 0;
        const d = (x - breeze.x) * breeze.dir;
        const k = d > 0 ? Math.exp(-(d * d) / 40000) : Math.exp(d / 600);
        return breeze.dir * k * 0.42 * breeze.fade;
    }

    function updateBreeze() {
        if (!breeze.active) {
            breeze.next -= step;
            if (breeze.next <= 0) startBreeze();
            return;
        }
        breeze.x += breeze.dir * breeze.speed * step;
        const inside = breeze.x > -100 && breeze.x < W + 100;

        if (inside && wisps.length < 70 && Math.random() < 0.4 * step * quality) {
            const c = breeze.curve;
            wisps.push({
                bx: breeze.x - breeze.dir * rand(0, 220),
                dir: breeze.dir,
                speed: breeze.speed * rand(1, 1.6),
                off: gauss() * c.spread,
                curve: c,
                age: 0,
                max: rand(140, 260),
                size: rand(0.8, 2),
                loop: Math.random() < 0.3 ? rand(10, 22) : 0,
                seed: rand(0, 100),
                color: pick(['#ffffff', '#fff1c9', '#ffd6e4', '#d9e8ff', '#ffe3a8']),
                trail: []
            });
        }

        // Cơn gió đã đi qua hết màn hình: lặng dần rồi chờ cơn sau
        const past = breeze.dir > 0 ? breeze.x > W + 300 : breeze.x < -300;
        if (past) {
            breeze.fade -= 0.01 * step;
            if (breeze.fade <= 0) {
                breeze.active = false;
                breeze.next = rand(420, 900);
            }
        }
    }

    function drawWisps() {
        if (!wisps.length) return;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const ox = -pointer.x * 0.8;
        for (let i = wisps.length - 1; i >= 0; i--) {
            const w = wisps[i];
            w.age += step;
            w.bx += w.dir * w.speed * step;
            if (w.age >= w.max) { wisps.splice(i, 1); continue; }

            let x = w.bx, y = curveY(w.curve, w.bx) + w.off;
            if (w.loop) {
                // Đốm sáng xoáy một vòng nhỏ trong gió
                const a = w.age * 0.11 + w.seed;
                x += Math.cos(a) * w.loop * w.dir;
                y += Math.sin(a) * w.loop;
            } else {
                y += Math.sin(w.age * 0.06 + w.seed) * 5;
            }
            x += ox;
            w.trail.push(x, y);
            if (w.trail.length > 40) w.trail.splice(0, 2);

            const a = Math.sin((Math.PI * w.age) / w.max);
            const t = w.trail;
            if (t.length >= 6) {
                const grad = ctx.createLinearGradient(x, y, t[0], t[1]);
                grad.addColorStop(0, hexToRgba(w.color, 0.55 * a));
                grad.addColorStop(1, hexToRgba(w.color, 0));
                ctx.globalAlpha = 1;
                ctx.strokeStyle = grad;
                ctx.lineWidth = w.size * 0.9;
                ctx.beginPath();
                ctx.moveTo(t[0], t[1]);
                for (let j = 2; j < t.length; j += 2) ctx.lineTo(t[j], t[j + 1]);
                ctx.stroke();
            }
            drawGlow(w.color, x, y, w.size * 11, a * 0.85);

            if (Math.random() < 0.06 * step) {
                addParticle({
                    x, y, color: w.color, size: rand(0.5, 1.2),
                    vx: w.dir * rand(0.2, 0.8), vy: rand(-0.2, 0.3), life: 0.8, decay: 0.03, burst: true
                });
            }
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }

    // ---------- Vòng lặp ----------

    function frame(now) {
        if (!running) { looping = false; return; }
        const dt = lastT ? now - lastT : 16.67;
        lastT = now;
        step = Math.min(dt / 16.67, 3);
        time += step;

        adaptQuality(dt);

        const ease = 1 - Math.pow(0.96, step);
        pointer.x += (pointer.tx - pointer.x) * ease;
        pointer.y += (pointer.ty - pointer.y) * ease;

        resetTransform();
        ctx.clearRect(0, 0, W, H);

        drawSky();
        drawStars();
        drawShootingStars();
        drawSun();
        drawClouds();
        drawHills();
        drawGrass();
        drawPetals();
        updateBreeze();
        drawFireflies();
        drawWisps();
        drawParticles();

        raf(frame);
    }

    // Nếu trung bình mỗi khung hình chậm hơn ~40fps: giảm độ phân giải vẽ trước,
    // sau đó mới giảm mật độ cỏ và cánh hoa
    function adaptQuality(dt) {
        if (warmup > 0) { warmup--; return; }
        frameAcc += Math.min(dt, 100);
        frameCount++;
        if (frameAcc < 2000) return;
        const avg = frameAcc / frameCount;
        frameAcc = 0;
        frameCount = 0;
        if (avg <= 25) return;
        if (DPR > 1.25) {
            dprCap = Math.max(1.25, DPR - 0.5);
            setSize(lastSize);
        } else if (quality > 0.4) {
            quality = Math.max(0.4, quality - 0.2);
            initGrass();
            initPetals();
        }
        warmup = 30;
    }

    function startLoop() {
        if (looping || !running) return;
        looping = true;
        lastT = 0;
        raf(frame);
    }

    // ---------- Tương tác ----------

    function burst(x, y) {
        for (let i = 0; i < 36; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = rand(1.5, 6.5);
            addParticle({
                x, y, color: pick(SPARK_COLORS), size: rand(1, 3),
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                life: 1.4, decay: rand(0.012, 0.022), burst: true
            });
        }
        rings.push({ x, y, r: 4, max: rand(70, 110), life: 1, color: pick(['#ffd6e4', '#c9dcff', '#ffe3a8']) });

        if (y < H * 0.6) {
            // Chạm lên bầu trời: thêm sao băng
            for (let i = 0; i < 2; i++) setTimeout(() => shootingStars.push(createShootingStar()), i * 250);
        } else {
            // Chạm xuống cánh đồng: gió thổi dạt cỏ và tung cánh hoa
            gust.x = x + pointer.x * 1.1;
            gust.s = 0.9;
            for (let i = 0; i < 6; i++) {
                const p = newPetal(false);
                p.x = x;
                p.y = y;
                p.vx = rand(-2.5, 2.5);
                p.vy = rand(-2.5, -0.8);
                petals.push(p);
            }
            if (petals.length > 60) petals.splice(0, petals.length - 60);
        }
    }

    function trail(x, y) {
        addParticle({
            x: x + rand(-4, 4), y: y + rand(-4, 4), color: pick(SPARK_COLORS), size: rand(0.6, 1.6),
            vx: rand(-0.3, 0.3), vy: rand(-0.6, 0), life: 0.9, decay: rand(0.02, 0.035), burst: true
        });
    }

    function handle(m) {
        switch (m.type) {
            case 'init':
                canvas = m.canvas;
                ctx = canvas.getContext('2d');
                setSize(m);
                startLoop();
                break;
            case 'resize':
                if (ctx) setSize(m);
                break;
            case 'pointer':
                pointer.tx = m.x * PARALLAX;
                pointer.ty = m.y * PARALLAX * 0.5;
                break;
            case 'tap':
                burst(m.x, m.y);
                break;
            case 'trail':
                trail(m.x, m.y);
                break;
            case 'visibility':
                running = m.visible;
                if (running && ctx) startLoop();
                break;
        }
    }

    if (IN_WORKER) global.onmessage = e => handle(e.data);
    else global.Scene = { post: handle };
})(self);
