// Luồng chính chỉ lo nhận sự kiện và phát nhạc; việc vẽ cảnh nằm trong scene.js.
// Ưu tiên chạy scene.js trong Web Worker với OffscreenCanvas, nếu không được thì chạy ngay trên luồng chính.
let canvas = document.getElementById('scene');
let send = () => {};

// ?gio=21 hoặc ?gio=21:30 để xem cảnh ở một giờ cố định; bỏ trống thì theo giờ thật
function parseHour() {
    const q = new URLSearchParams(location.search).get('gio');
    if (!q) return null;
    const [h, m = '0'] = q.split(':');
    const v = Number(h) + Number(m) / 60;
    return Number.isFinite(v) ? ((v % 24) + 24) % 24 : null;
}
const hour = parseHour();

// scene.js báo độ tối viền màn hình theo khung giờ (ban ngày gần như không có viền tối)
const vignette = document.querySelector('.vignette');
function onSceneMessage(m) {
    if (m.type === 'tone' && vignette) vignette.style.opacity = m.vignette;
}

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
    worker.postMessage({ type: 'init', canvas: offscreen, hour, ...viewport() }, [offscreen]);
    send = msg => worker.postMessage(msg);
    worker.addEventListener('message', e => onSceneMessage(e.data));

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
        self.Scene.onmessage = onSceneMessage;
        send = msg => self.Scene.post(msg);
        send({ type: 'init', canvas, hour, ...viewport() });
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
    if (e.target.closest && e.target.closest('#controls')) return;
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

// ---------- Đồng hồ: chỉnh giờ của cảnh ----------

const controls = document.getElementById('controls');
const clockBtn = document.getElementById('clock-toggle');
const timePanel = document.getElementById('time-panel');
const timeRange = document.getElementById('time-range');
const timeLabel = document.getElementById('time-label');
const timeAuto = document.getElementById('time-auto');
let manualHour = hour;

const realHour = () => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
};

function formatHour(h) {
    const m = Math.round(h * 60) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function refreshClock() {
    const h = manualHour === null ? realHour() : manualHour;
    timeRange.value = h;
    timeLabel.textContent = formatHour(h);
    timeAuto.classList.toggle('active', manualHour === null);
    clockBtn.classList.toggle('manual', manualHour !== null);
}

// Ghi giờ đang chọn lên link để có thể gửi cho người khác
function updateUrl() {
    const params = new URLSearchParams(location.search);
    params.delete('gio');
    let query = params.toString();
    if (manualHour !== null) query = (query ? query + '&' : '') + 'gio=' + formatHour(manualHour);
    history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
}

// Kéo thanh trượt gửi liên tục, nên giới hạn tần suất dựng lại cảnh
let lastHourSend = 0, hourTimer;
function sendHour() {
    clearTimeout(hourTimer);
    const go = () => {
        lastHourSend = performance.now();
        send({ type: 'hour', hour: manualHour });
    };
    if (performance.now() - lastHourSend > 150) go();
    else hourTimer = setTimeout(go, 150);
}

function setPanel(open) {
    timePanel.hidden = !open;
    clockBtn.setAttribute('aria-expanded', String(open));
    if (open) refreshClock();
}

// Bấm vào cụm nút không tạo hiệu ứng chạm lên cảnh
controls.addEventListener('pointerdown', e => e.stopPropagation());
clockBtn.addEventListener('click', () => setPanel(timePanel.hidden));

timeRange.addEventListener('input', () => {
    manualHour = Number(timeRange.value) % 24;
    refreshClock();
    sendHour();
    updateUrl();
});

timeAuto.addEventListener('click', () => {
    manualHour = null;
    refreshClock();
    sendHour();
    updateUrl();
});

setInterval(() => { if (manualHour === null && !timePanel.hidden) refreshClock(); }, 30000);
refreshClock();

// ---------- Nhạc nền ----------

const music = document.getElementById('bg-music');
const musicBtn = document.getElementById('music-toggle');
let userMuted = false;

function playMusic() {
    const p = music.play();
    if (p) p.then(() => musicBtn.classList.add('playing')).catch(() => {});
}

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
    if (!timePanel.hidden) setPanel(false);
    if (!userMuted && music.paused) playMusic();
    send({ type: 'tap', x: e.clientX, y: e.clientY });
});

playMusic();
