// Luồng chính chỉ lo nhận sự kiện và phát nhạc; việc vẽ cảnh nằm trong scene.js.
// Ưu tiên chạy scene.js trong Web Worker với OffscreenCanvas, nếu không được thì chạy ngay trên luồng chính.
let canvas = document.getElementById('scene');
let send = () => {};

const viewport = () => ({
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2)
});

function startWorker() {
    if (typeof Worker === 'undefined' || !('transferControlToOffscreen' in canvas)) return false;
    let worker;
    try {
        worker = new Worker('scene.js');
    } catch (e) {
        // Ví dụ: mở trực tiếp file:// trên Chrome không cho tạo Worker
        return false;
    }
    const offscreen = canvas.transferControlToOffscreen();
    worker.postMessage({ type: 'init', canvas: offscreen, ...viewport() }, [offscreen]);
    send = msg => worker.postMessage(msg);

    // Worker hỏng giữa chừng: thay canvas mới và vẽ trên luồng chính
    worker.addEventListener('error', () => {
        worker.terminate();
        const fresh = canvas.cloneNode(false);
        canvas.replaceWith(fresh);
        canvas = fresh;
        startMainThread();
    }, { once: true });
    return true;
}

function startMainThread() {
    send = () => {};
    const script = document.createElement('script');
    script.src = 'scene.js';
    script.onload = () => {
        send = msg => self.Scene.post(msg);
        send({ type: 'init', canvas, ...viewport() });
    };
    document.body.appendChild(script);
}

if (!startWorker()) startMainThread();

// ---------- Sự kiện ----------

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => send({ type: 'resize', ...viewport() }), 150);
});

document.addEventListener('visibilitychange', () => {
    send({ type: 'visibility', visible: !document.hidden });
});

let lastTrail = 0;
window.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') {
        send({
            type: 'pointer',
            x: (e.clientX / window.innerWidth - 0.5) * 2,
            y: (e.clientY / window.innerHeight - 0.5) * 2
        });
    }
    // Vệt sáng theo con trỏ / ngón tay, giới hạn tần suất gửi
    const now = performance.now();
    if (now - lastTrail > 24) {
        lastTrail = now;
        send({ type: 'trail', x: e.clientX, y: e.clientY });
    }
});

window.addEventListener('deviceorientation', e => {
    if (e.gamma == null) return;
    send({
        type: 'pointer',
        x: Math.max(-1, Math.min(1, e.gamma / 30)),
        y: Math.max(-1, Math.min(1, (e.beta - 45) / 30))
    });
});

// ---------- Nhạc nền ----------

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
    send({ type: 'tap', x: e.clientX, y: e.clientY });
});

playMusic();
