const starsCanvas = document.getElementById('starsCanvas');
const terrainCanvas = document.getElementById('terrainCanvas');
const grassCanvas = document.getElementById('grassCanvas');

const starsCtx = starsCanvas.getContext('2d');
const terrainCtx = terrainCanvas.getContext('2d', { alpha: true });
const grassCtx = grassCanvas.getContext('2d');

let width, height;
let stars = [];
let shootingStars = [];
let grassBlades = [];
let fireflies = [];
let flowerParticles = [];
let clouds = [];
let time = 0;
let clickStep = 0; // 0: Chưa bấm gì, 1: Đã hiện thư, 2: Đã hiện lời chúc
let isMusicPlaying = false;
let userMuted = false; // Ngăn nhạc tự phát lại nếu người dùng đã chủ động tắt

function init() {
    window.addEventListener('resize', resize);

    // Thêm listener bắt sự kiện chạm trên màn hình điện thoại hoặc click
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction, { passive: false });

    // Gọi thử play nhạc ngay khi trang load (Do có autoplay policy, có thể bị chặn)
    // Tương tác đầu tiên của người dùng (click vào bất kì đâu) sẽ giải quyết vấn đề bị chặn
    attemptPlayMusic();

    // Nút đóng băng nhạc / phát nhạc
    const musicToggle = document.getElementById('music-toggle');
    if (musicToggle) {
        const handleToggle = (e) => {
            if (e.type === 'touchstart') {
                e.preventDefault(); // Ngăn browser gửi thêm event click sau touchstart
            }
            e.stopPropagation(); // Phải dừng sự kiện để không ấn nhầm lệnh "chạm màn hình"

            let bgMusic = document.getElementById('bg-music');
            let musicIcon = document.getElementById('music-icon');
            let musicText = document.getElementById('music-text');

            if (bgMusic) {
                if (!bgMusic.paused) {
                    // Đang phát -> đóng băng
                    bgMusic.pause();
                    isMusicPlaying = false;
                    userMuted = true; // Người dùng đã chủ động tắt

                    if (musicIcon) {
                        musicIcon.innerText = "🔇";
                        musicIcon.classList.remove("animate-pulse");
                    }
                    if (musicText) musicText.innerText = "Đã tắt nhạc";

                    musicToggle.classList.remove("bg-white/10", "bg-white/20");
                    musicToggle.classList.add("bg-black/40"); // Nút mờ đi khi đóng băng
                } else {
                    // Đang tắt -> phát lại
                    userMuted = false;
                    attemptPlayMusic();
                }
            }
        };

        musicToggle.addEventListener('click', handleToggle);
        musicToggle.addEventListener('touchstart', handleToggle, { passive: false });
    }

    resize();
    requestAnimationFrame(animate);
}

function attemptPlayMusic() {
    let bgMusic = document.getElementById('bg-music');
    let musicIcon = document.getElementById('music-icon');
    let musicText = document.getElementById('music-text');
    if (bgMusic) {
        let playPromise = bgMusic.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                isMusicPlaying = true;
                if (musicIcon) {
                    musicIcon.innerText = "🔊";
                    musicIcon.classList.add("animate-pulse");
                }
                if (musicText) musicText.innerText = "Đang phát...";
                let musicToggle = document.getElementById('music-toggle');
                if (musicToggle) {
                    musicToggle.classList.remove("bg-black/40");
                    musicToggle.classList.add("bg-white/10");
                }
            }).catch(err => {
                console.log("Trình duyệt chặn Autoplay. Đợi người dùng tương tác.", err);
                isMusicPlaying = false;
                if (musicIcon) {
                    musicIcon.innerText = "🎵"; // Biểu tượng mặc định khi chưa rõ trạng thái bị chặn
                }
                if (musicText) musicText.innerText = "Nhạc nền";
            });
        }
    }
}

// Xử lý logic tương tác khi người dùng chạm
function handleInteraction(e) {
    let clientX, clientY;
    if (e.type === 'touchstart') {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    // Phát nhạc ngay lần chạm đầu tiên (vượt qua cơ chế chặn autoplay của trình duyệt)
    if (!isMusicPlaying && !userMuted) {
        attemptPlayMusic();
    }

    // Mỗi lần chạm sẽ bung ra các đốm sáng ma thuật
    spawnBurst(clientX, clientY);

    if (clickStep === 0) {
        // Lần đầu chạm: Làm mờ dần thẻ chữ chào
        let instructionEl = document.getElementById('initial-instruction');
        instructionEl.style.opacity = '0';

        // Đợi 0.5s cho chữ mây mây bay đi rồi mới hiện phong thư
        setTimeout(() => {
            instructionEl.style.display = 'none'; // Xóa hẳn layout
            let envelopeEl = document.getElementById('envelope-container');
            // Cần set lại display trước để có thể animation opacity từ class hidden bóc ra
            envelopeEl.style.display = 'flex';
            // Bật con trỏ pointer events lại cho envelope 
            envelopeEl.style.pointerEvents = 'auto';
            // Đợi 10ms frame kế bắt đầu transition
            setTimeout(() => envelopeEl.classList.remove('is-hidden'), 10);
        }, 500);

        clickStep = 1;

    } else if (clickStep === 1) {
        // Phải bấm CỤ THỂ vào phong thư thì mới mở
        let envelopeEl = document.getElementById('envelope-container');
        if (envelopeEl.contains(e.target)) {
            // Lần 2 chạm: Ẩn phong thư từ từ, rồi hiện thiệp
            envelopeEl.classList.add('is-hidden'); // Kích hoạt CSS làm mờ đi trước
            envelopeEl.style.pointerEvents = 'none'; // Khóa click

            setTimeout(() => {
                envelopeEl.style.display = 'none'; // Quét sạch nhường chỗ
                let msgBox = document.getElementById('message-box');
                msgBox.style.display = 'block'; // Setup layout

                setTimeout(() => {
                    msgBox.classList.remove('is-hidden'); // Kích hoạt fade-in

                    // Hiệu ứng gõ chữ
                    const titleEl = document.getElementById('msg-title');
                    const contentEl = document.getElementById('msg-content');

                    const titleText = titleEl.getAttribute('data-text');
                    const contentText = contentEl.getAttribute('data-text');

                    titleEl.innerHTML = '';
                    contentEl.innerHTML = '';

                    function typeWriter(element, text, speed, callback) {
                        let i = 0;
                        let chars = [...text];
                        function type() {
                            if (i < chars.length) {
                                element.innerHTML += chars[i];
                                i++;
                                setTimeout(type, speed);
                            } else if (callback) {
                                callback();
                            }
                        }
                        type();
                    }

                    setTimeout(() => {
                        typeWriter(titleEl, titleText, 100, () => {
                            setTimeout(() => {
                                typeWriter(contentEl, contentText, 45, () => {
                                    // Sau khi gõ xong lời chúc, thêm nút/dòng chữ "Chạm để đóng" nhấp nháy
                                    let closeHint = document.createElement('div');
                                    closeHint.innerHTML = "Chạm để đóng...";
                                    closeHint.className = "mt-6 text-white/60 text-sm animate-pulse cursor-pointer";
                                    msgBox.appendChild(closeHint);

                                    // Chuyển sang bước 3: sẵn sàng tắt
                                    clickStep = 3;
                                });
                            }, 400);
                        });
                    }, 800); // Đợi message box mờ dần hiện ra rồi gõ (0.8s)

                }, 10);
            }, 800); // Đợi 0.8s cho lá thư mờ hẳn

            // Bắn vài đợt sao băng tráng lệ liên tiếp
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    shootingStars.push(createShootingStar());
                }, i * 400 + 400); // Chờ lá thư biến mất bắt đầu bắn sao băng
            }
            // Không set clickStep = 2 ở đây nữa vì sẽ set = 3 sau khi gõ xong
            clickStep = 2; // Tạm gọi là trạng thái đang gõ
        }
    } else if (clickStep === 3) {
        // Chạm lần nữa để ẩn trọn vẹn lời chúc
        let msgBox = document.getElementById('message-box');

        if (msgBox.contains(e.target) || true) { // Bấm vào đâu cũng đóng được
            msgBox.classList.add('is-hidden');
            setTimeout(() => {
                msgBox.style.display = 'none';

                // Mọi thứ đã đóng, người dùng tiếp tục ngắm cảnh
                // Không đưa phong thư trở lại nữa

                // Đập bỏ text "Chạm để đóng" cũ
                let hint = msgBox.querySelector('.mt-6');
                if (hint) hint.remove();

                // Set clickStep lên 4 hoặc giá trị nào đó để khóa mọi tương tác về sau
                clickStep = 4;
            }, 1000); // Thời gian fade out của box
        }
    }
}

// Tạo hiệu ứng tỏa đóm sáng từ vị trí chạm
function spawnBurst(x, y) {
    let numSparks = 25; // Số lượng đốm sáng bung ra
    let colors = ['#ffffff', '#ffb6c1', '#b3d9ff', '#ffd1dc', '#fff9e6', '#ffdf80'];
    for (let i = 0; i < numSparks; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 5 + 2;
        flowerParticles.push({
            x: x,
            y: y,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 3 + 1,
            speedX: Math.cos(angle) * speed,
            speedY: Math.sin(angle) * speed,
            life: 1.5,
            isBurst: true // Cờ riêng đánh dấu cho các hạt nổ bung
        });
    }
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;

    starsCanvas.width = width;
    starsCanvas.height = height;
    terrainCanvas.width = width;
    terrainCanvas.height = height;
    grassCanvas.width = width;
    grassCanvas.height = height;

    initStars();
    initClouds();
    initGrass();
}

function initStars() {
    stars = [];
    let isMobile = width < 768;
    // Thiên hà rõ và phân tán đều
    const numStars = Math.floor((width * height) / (isMobile ? 800 : 600));

    for (let i = 0; i < numStars; i++) {
        let x = Math.random() * width;
        let y = Math.random() * height;

        stars.push({
            x: x,
            y: y,
            // Một số sao lác đác sẽ to và sáng mạnh hơn hẳn giống trong ảnh
            size: Math.random() > 0.95 ? Math.random() * 1.5 + 1.2 : Math.random() * 1.2 + 0.3,
            alpha: Math.random(),
            speed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
            color: Math.random() > 0.8 ? '#b8d4ff' : '#ffffff'
        });
    }

    shootingStars = [];
    // Giảm số lượng sao băng để bầu trời tĩnh lặng hơn
    for (let i = 0; i < 2; i++) {
        shootingStars.push(createShootingStar());
    }
}

function createShootingStar() {
    // Xác định sao băng xuất phát từ nửa trên của các mép màn hình (trái, phải hoặc trên cùng)
    let startX = Math.random() * (width * 1.2) - (width * 0.1);
    let startY = Math.random() * (height * 0.5) - (height * 0.2);

    // Hướng xéo xuống ngẫu nhiên
    let angle = (Math.PI / 6) + (Math.random() * (Math.PI / 4));

    // 50% cơ may sao băng sẽ bay từ trái sang phải, 50% chiều ngược lại
    let directionX = Math.random() > 0.5 ? 1 : -1;

    return {
        x: startX,
        y: startY,
        len: Math.random() * 100 + 80,
        speed: Math.random() * 20 + 15,
        angle: angle,
        directionX: directionX,
        opacity: 0,
        active: false,
        delay: Math.random() * 300 + 50
    };
}

function initClouds() {
    clouds = [];
    let isMobile = width < 768;
    let numClouds = isMobile ? 6 : 12;
    for (let i = 0; i < numClouds; i++) {
        clouds.push({
            x: Math.random() * width,
            y: Math.random() * height * 0.45,
            size: Math.random() * 50 + 30, // base size
            speed: Math.random() * 0.3 + 0.1,
            opacity: Math.random() * 0.25 + 0.15,
            scaleX: Math.random() * 1.5 + 1.5 // make them stretching horizontally
        });
    }
}

function drawTerrainAndClouds() {
    terrainCtx.clearRect(0, 0, width, height);

    let isMobile = width < 768;

    // 1. Vẽ Mặt Trời Hoàng Hôn (lấp ló ở chân trời chỉ còn dư một chút)
    let sunX = width * 0.5;
    // Chìm sâu xuống đồi (ngọn đồi ở khoảng y=0.55), nên dìm mặt trời xuống y=0.62 hoặc hơn
    let sunY = height * 0.61;
    // Kích thước mặt trời to hơn gấp đôi trên mobile để nổi bật vừa vặn màn hình
    let sunSize = isMobile ? width * 0.22 : Math.min(width, height) * 0.12;

    // Hào quang tỏa sáng của mặt trời
    let gradSun = terrainCtx.createRadialGradient(sunX, sunY, sunSize * 0.2, sunX, sunY, sunSize * 2.5);
    gradSun.addColorStop(0, 'rgba(255, 230, 150, 0.9)');
    gradSun.addColorStop(0.2, 'rgba(255, 120, 40, 0.6)');
    gradSun.addColorStop(0.6, 'rgba(180, 30, 20, 0.15)');
    gradSun.addColorStop(1, 'rgba(180, 30, 20, 0)');

    terrainCtx.fillStyle = gradSun;
    terrainCtx.beginPath();
    terrainCtx.arc(sunX, sunY, sunSize * 2.5, 0, Math.PI * 2);
    terrainCtx.fill();

    // Lõi mặt trời rực rỡ
    terrainCtx.fillStyle = '#ffdf80';
    terrainCtx.beginPath();
    terrainCtx.arc(sunX, sunY, sunSize * 0.6, 0, Math.PI * 2);
    terrainCtx.shadowColor = '#ff8800';
    terrainCtx.shadowBlur = 40;
    terrainCtx.fill();
    terrainCtx.shadowBlur = 0;

    // 2. Vẽ đám mây bay
    clouds.forEach(c => {
        c.x -= c.speed; // Mây bay từ phải qua trái
        if (c.x < -c.size * c.scaleX * 2) c.x = width + c.size * c.scaleX * 2;

        terrainCtx.fillStyle = `rgba(180, 80, 70, ${c.opacity})`; // Mây màu hồng sậm để hợp với trời tối
        terrainCtx.beginPath();
        terrainCtx.save();
        terrainCtx.translate(c.x, c.y);
        terrainCtx.scale(c.scaleX, 1);

        // Vẽ các gợn mây
        terrainCtx.arc(0, 0, c.size, 0, Math.PI * 2);
        terrainCtx.arc(c.size * 0.5, -c.size * 0.4, c.size * 0.8, 0, Math.PI * 2);
        terrainCtx.arc(c.size * 1.2, 0, c.size * 0.9, 0, Math.PI * 2);

        terrainCtx.fill();
        terrainCtx.restore();
    });

    // 3. Vẽ mặt đất có NGỌN ĐỒI che mặt trời
    terrainCtx.fillStyle = '#0a0305'; // Đất tối
    terrainCtx.beginPath();
    terrainCtx.moveTo(0, height * 0.7);

    // Đường lượn lên đỉnh đồi ở giữa (x=0.5, y=0.55 che ngang nửa mặt trời)
    terrainCtx.bezierCurveTo(width * 0.15, height * 0.7, width * 0.35, height * 0.55, width * 0.5, height * 0.55);
    // Đường lượn xuống bên phải
    terrainCtx.bezierCurveTo(width * 0.65, height * 0.55, width * 0.85, height * 0.65, width, height * 0.65);

    terrainCtx.lineTo(width, height);
    terrainCtx.lineTo(0, height);
    terrainCtx.fill();

    // Lớp đồi thứ hai phía trước để tạo chi tiết khuất lấp
    terrainCtx.fillStyle = '#110508';
    terrainCtx.beginPath();
    terrainCtx.moveTo(0, height * 0.78);
    terrainCtx.bezierCurveTo(width * 0.2, height * 0.65, width * 0.4, height * 0.8, width * 0.6, height * 0.68);
    terrainCtx.bezierCurveTo(width * 0.8, height * 0.58, width * 0.9, height * 0.72, width, height * 0.75);
    terrainCtx.lineTo(width, height);
    terrainCtx.lineTo(0, height);
    terrainCtx.fill();

    // Phủ mờ phần chân đồi hòa vào bóng tối để làm nền cho cỏ
    let gradGr = terrainCtx.createLinearGradient(0, height * 0.7, 0, height);
    gradGr.addColorStop(0, 'rgba(17, 5, 8, 0)'); // Trong suốt ở đỉnh dải màu (không còn vệt cắt ngang)
    gradGr.addColorStop(1, '#030102'); // Đen kịt ở dưới đáy
    terrainCtx.fillStyle = gradGr;
    terrainCtx.fillRect(0, height * 0.6, width, height * 0.4);
}

function initGrass() {
    grassBlades = [];
    flowerParticles = [];
    let isMobile = width < 768;

    // Tăng mật độ cỏ cho điện thoại vì chiều ngang hẹp
    // Desktop giữ nguyên mật độ 1.5
    let numGrass = isMobile ? Math.floor(width * 2.5) : Math.floor(width * 1.5);

    for (let i = 0; i < numGrass; i++) {
        let layer = Math.random();
        let gX = Math.random() * width;

        let l = 3 + layer * 10;
        let color = `hsl(140, 40%, ${l}%)`;
        let hasFlower = false;
        let flowerColor = '';
        let flowerSize = 0;

        // Cánh đồng hoa hoang dã điểm xuyết trắng, xanh nhạt, hồng
        if (layer > 0.1 && Math.random() > 0.25) {
            hasFlower = true;
            // Trắng nguyên bản + Xanh dương nhạt + Hồng phấn
            let colors = ['#ffffff', '#fcf6db', '#fff9e6', '#b3d9ff', '#d9e8ff', '#ffb6c1', '#ffd1dc', '#fdfdfd'];
            flowerColor = colors[Math.floor(Math.random() * colors.length)];
            flowerSize = (layer * 3.0) + Math.random() * 4.0 + 2.0; // Hoa to hơn
        }

        // Chiều cao của cỏ bình thường
        let baseHeight = (height * 0.03 + layer * (height * 0.15));

        grassBlades.push({
            x: gX,
            y: height + 10,
            baseHeight: baseHeight + Math.random() * (height * 0.05),
            layer: layer,
            stiffness: Math.random() * 0.4 + 0.6,
            color: color,
            hasFlower: hasFlower,
            flowerColor: flowerColor,
            flowerSize: flowerSize,
            swayOffset: Math.random() * Math.PI * 2
        });
    }
    grassBlades.sort((a, b) => a.layer - b.layer);

    // Đom đóm bay lượn trên cỏ
    fireflies = [];
    // Rút gọn bớt số lượng đom đóm
    for (let i = 0; i < 30; i++) {
        fireflies.push({
            x: Math.random() * width,
            y: height - Math.random() * (height * 0.4),
            size: Math.random() * 2 + 1,
            // Tăng tốc độ cơ bản của đom đóm
            speedX: (Math.random() - 0.5) * 1.5,
            speedY: (Math.random() - 0.5) * 1.5,
            opacity: Math.random(),
            // Tông màu xanh lá phát sáng (lime green / neon green)
            color: Math.random() > 0.5 ? '#7cfc00' : '#32cd32'
        });
    }
}

function drawTulip(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);

    // Bầu trái
    ctx.bezierCurveTo(x - size * 1.5, y - size * 0.2, x - size * 1.5, y - size * 1.8, x - size * 0.6, y - size * 1.8);
    // Lượn nhấp nhô củ tỏi ở cánh giữa trái
    ctx.bezierCurveTo(x - size * 0.4, y - size * 1.8, x - size * 0.3, y - size * 2.2, x, y - size * 2.2);
    // Lượn nhấp nhô ở cánh giữa phải
    ctx.bezierCurveTo(x + size * 0.3, y - size * 2.2, x + size * 0.4, y - size * 1.8, x + size * 0.6, y - size * 1.8);
    // Bầu phải
    ctx.bezierCurveTo(x + size * 1.5, y - size * 1.8, x + size * 1.5, y - size * 0.2, x, y);

    ctx.fill();

    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
}

function animate() {
    time += 1;

    // 1. NGÔI SAO LẤP LÁNH
    starsCtx.clearRect(0, 0, width, height);
    stars.forEach(star => {
        star.alpha += star.speed;
        if (star.alpha >= 1) { star.alpha = 1; star.speed *= -1; }
        else if (star.alpha <= 0.1) { star.alpha = 0.1; star.speed *= -1; }

        starsCtx.fillStyle = star.color;
        starsCtx.globalAlpha = star.alpha;
        starsCtx.beginPath();
        starsCtx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        starsCtx.fill();
    });
    starsCtx.globalAlpha = 1;

    // 2. SAO BĂNG
    shootingStars.forEach(ss => {
        if (!ss.active) {
            ss.delay--;
            if (ss.delay <= 0) {
                ss.active = true;
                ss.opacity = 1;
            }
        } else {
            ss.x -= Math.cos(ss.angle) * ss.speed * ss.directionX;
            ss.y += Math.sin(ss.angle) * ss.speed;
            ss.opacity -= 0.012;

            if (ss.opacity <= 0 || ss.y > height || ss.x < -200 || ss.x > width + 200) {
                Object.assign(ss, createShootingStar());
            } else {
                starsCtx.save();
                starsCtx.globalAlpha = ss.opacity;

                let tailX = ss.x + Math.cos(ss.angle) * ss.len * ss.directionX;
                let tailY = ss.y - Math.sin(ss.angle) * ss.len;

                let grad = starsCtx.createLinearGradient(ss.x, ss.y, tailX, tailY);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(1, 'rgba(255,255,255,0)');

                starsCtx.strokeStyle = grad;
                starsCtx.lineWidth = 1.8;
                starsCtx.lineCap = 'round';
                starsCtx.beginPath();
                starsCtx.moveTo(ss.x, ss.y);
                starsCtx.lineTo(tailX, tailY);
                starsCtx.stroke();
                starsCtx.restore();
            }
        }
    });

    // 3. MÂY BAY VÀ MẶT TRỜI (TERRAIN CANVAS MỚI)
    drawTerrainAndClouds();

    // 4. CỎ & ĐOM ĐÓM
    grassCtx.clearRect(0, 0, width, height);
    let globalWind = Math.sin(time * 0.015) * 0.2;

    grassBlades.forEach(g => {
        let wind = globalWind + Math.sin(time * 0.02 + g.x * 0.01 + g.swayOffset) * 0.15;
        wind *= g.stiffness * g.layer;

        grassCtx.beginPath();
        grassCtx.moveTo(g.x, g.y);
        grassCtx.strokeStyle = g.color;
        grassCtx.lineWidth = 0.5 + g.layer * 2;
        grassCtx.lineCap = 'round';

        let cx = g.x;
        let cy = g.y;
        let segments = 3 + Math.floor(g.layer * 2);
        let segmentLen = g.baseHeight / segments;

        for (let j = 1; j <= segments; j++) {
            let angle = wind * (j / segments);
            cx += Math.sin(angle) * segmentLen;
            cy -= Math.cos(angle) * segmentLen;
            grassCtx.lineTo(cx, cy);
        }
        grassCtx.stroke();

        if (g.hasFlower) {
            // Lưu trạng thái canvas để xoay bông hoa theo thân cỏ
            grassCtx.save();
            grassCtx.translate(cx, cy);

            // Xoay bông hoa theo góc nghiêng của ngọn gió (wind) cộng với một chút ngẫu nhiên nhỏ giật giật
            let flowerAngle = wind * 0.8 + Math.sin(time * 0.05 + g.x) * 0.05;
            grassCtx.rotate(flowerAngle);

            // Vẽ hoa tại gốc toạ độ (0, 0) vì đã translate tới cx, cy
            drawTulip(grassCtx, 0, 0, g.flowerSize, g.flowerColor);

            grassCtx.restore();

            if (Math.random() > 0.995) {
                flowerParticles.push({
                    x: cx,
                    y: cy,
                    color: g.flowerColor,
                    size: Math.random() * 2.5 + 1.0,
                    speedX: (Math.random() - 0.5) * 0.5,
                    speedY: -Math.random() * 1.5 - 0.5,
                    life: 1,
                    isBurst: false
                });
            }
        }
    });

    for (let i = flowerParticles.length - 1; i >= 0; i--) {
        let p = flowerParticles[i];

        if (p.isBurst) {
            // Hạt chạm nổ ma sát không khí chậm lại, chịu đôi chút trọng lực
            p.x += p.speedX;
            p.y += p.speedY;
            p.speedX *= 0.92; // Ma sát không khí
            p.speedY *= 0.92;
            p.speedY += 0.08; // Trọng lực nhẹ rơi xuống
            p.life -= 0.015;
        } else {
            // Hạt hoa thông thường mọc từ dưới cỏ
            p.x += p.speedX + Math.sin(time * 0.05 + p.y) * 0.5;
            p.y += p.speedY;
            p.life -= 0.005;
        }

        if (p.life <= 0) {
            flowerParticles.splice(i, 1);
            continue;
        }

        grassCtx.globalAlpha = Math.max(0, p.life);
        grassCtx.fillStyle = p.color;
        grassCtx.beginPath();
        grassCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        grassCtx.fill();
        grassCtx.shadowColor = p.color;
        grassCtx.shadowBlur = 5;
        grassCtx.fill();
        grassCtx.shadowBlur = 0;
    }
    grassCtx.globalAlpha = 1;

    // Vẽ đom đóm
    fireflies.forEach(f => {
        // Tăng độ dao động bằng hàm sin để nó bay lảo đảo ngẫu nhiên nhanh hơn
        f.x += f.speedX + Math.sin(time * 0.03 + f.y) * 1.5;
        f.y += f.speedY + Math.cos(time * 0.02 + f.x) * 0.8;

        if (f.y > height) f.y = height - Math.random() * (height * 0.25);
        if (f.y < height - (height * 0.35)) f.speedY = Math.abs(f.speedY);
        if (f.x < 0) f.x = width;
        if (f.x > width) f.x = 0;

        f.opacity += Math.sin(time * 0.08 + f.x) * 0.1;
        let a = Math.max(0.05, Math.min(0.8, f.opacity));

        grassCtx.fillStyle = f.color;
        grassCtx.globalAlpha = a;
        grassCtx.beginPath();
        grassCtx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        grassCtx.fill();
        grassCtx.shadowColor = f.color;
        grassCtx.shadowBlur = 10;
        grassCtx.fill();
        grassCtx.shadowBlur = 0;
    });
    grassCtx.globalAlpha = 1;

    requestAnimationFrame(animate);
}

init();
