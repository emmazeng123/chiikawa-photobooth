const mode = sessionStorage.getItem("mode");
const camera = document.getElementById("camera");
const finalCanvas = document.getElementById("finalCanvas");
const ctx = finalCanvas.getContext("2d");
const ready = document.getElementById("ready");
const next = document.getElementById("next");
const countdown = document.getElementById("countdown");
const stickerCanvas = document.getElementById("stickerCanvas");

const WIDTH = 400;
const HEIGHT = 600;
const DPR = 2; // internal canvas resolution multiplier for better quality

const HALF = HEIGHT / 2;

// Photo slot positions within the 400x600 container (measured from frame PNG)
// Multiplied by DPR for the higher-res internal canvas
const SLOT1 = { x: 112 * DPR, y: 93 * DPR, w: 177 * DPR, h: 204 * DPR };
const SLOT2 = { x: 112 * DPR, y: 314 * DPR, w: 177 * DPR, h: 160 * DPR };

const HANDLE = 28; // resize handle size in canvas pixels

let photoNumber = 0;
let stickers = [];
let selectedSticker = null;
let activeSticker = null;
let resizing = false;
let resizeStart = { x: 0, y: 0, w: 0, h: 0 };
let dragOffset = { x: 0, y: 0 };

finalCanvas.width = WIDTH * DPR;
finalCanvas.height = HEIGHT * DPR;
stickerCanvas.width = WIDTH * DPR;
stickerCanvas.height = HEIGHT * DPR;

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

// start camera or upload
if (mode === "camera") {
    startCamera();
} else if (mode === "upload") {
    showUploadUI();
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        camera.srcObject = stream;
        camera.style.display = "block";
    } catch (error) {
        alert("failed to turn on camera: " + error.message);
    }
}

function showUploadUI() {
    camera.style.display = "none";
    document.getElementById("photoControls").style.display = "none";

    const zone1 = document.getElementById("uploadZone1");
    const zone2 = document.getElementById("uploadZone2");
    zone1.style.display = "flex";

    function makeInput(slot, onDone) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const img = new Image();
            img.onload = () => {
                drawPhotoToCanvas(img, slot);
                onDone();
            };
            img.src = URL.createObjectURL(file);
        });
        return input;
    }

    const input1 = makeInput(SLOT1, () => {
        zone1.style.display = "none";
        zone2.style.display = "flex";
        photoNumber = 1;

        const input2 = makeInput(SLOT2, () => {
            zone2.style.display = "none";
            photoNumber = 2;
            next.style.display = "inline-block";
            document.getElementById("photoControls").style.display = "flex";
            ready.style.display = "none";
        });
        zone2.addEventListener("click", () => input2.click(), { once: true });
    });
    zone1.addEventListener("click", () => input1.click(), { once: true });
}

// take photo
ready.addEventListener("click", () => {
    if (mode === "camera") {
        ready.disabled = true;
        startCountdown(() => capturePhoto());
    }
});

function startCountdown(callback) {
    let count = 3;
    countdown.textContent = count;
    countdown.style.display = "flex";
    
    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            countdown.textContent = count;
        } else {
            clearInterval(timer);
            countdown.style.display = "none";
            callback();
        }
    }, 1000);
}

function capturePhoto() {
    const slot = photoNumber === 0 ? SLOT1 : SLOT2;
    const vW = camera.videoWidth;
    const vH = camera.videoHeight;
    const targetAspect = slot.w / slot.h;
    const vAspect = vW / vH;

    let sx, sy, sw, sh;
    if (vAspect > targetAspect) {
        sh = vH;
        sw = vH * targetAspect;
        sx = (vW - sw) / 2;
        sy = 0;
    } else {
        sw = vW;
        sh = vW / targetAspect;
        sx = 0;
        sy = (vH - sh) / 2;
    }

    // flip horizontally within the slot
    ctx.save();
    ctx.translate(slot.x + slot.w, slot.y);
    ctx.scale(-1, 1);
    ctx.drawImage(camera, sx, sy, sw, sh, 0, 0, slot.w, slot.h);
    ctx.restore();

    // save photo to sessionStorage
    const photoData = finalCanvas.toDataURL("image/png");
    sessionStorage.setItem(`photo${photoNumber + 1}`, photoData);

    photoNumber++;
    ready.disabled = false;

    if (photoNumber === 1) {
        // move camera to slot 2
        camera.style.left = SLOT2.x + 'px';
        camera.style.top = SLOT2.y + 'px';
        camera.style.width = SLOT2.w + 'px';
        camera.style.height = SLOT2.h + 'px';
    } else if (photoNumber === 2) {
        camera.style.display = "none";
        ready.style.display = "none";
        next.style.display = "inline-block";
    }
}

function drawPhotoToCanvas(img, slot) {
    const targetAspect = slot.w / slot.h;
    const imgAspect = img.width / img.height;

    let sx, sy, sw, sh;
    if (imgAspect > targetAspect) {
        sh = img.height;
        sw = img.height * targetAspect;
        sx = (img.width - sw) / 2;
        sy = 0;
    } else {
        sw = img.width;
        sh = sw / targetAspect;
        sx = 0;
        sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, slot.x, slot.y, slot.w, slot.h);
}

// go to decoration mode
next.addEventListener("click", () => {
    if (photoNumber === 2) {
        camera.style.display = "none";
        next.style.display = "none";
        document.getElementById("photoControls").style.display = "none";
        document.getElementById("stickerControls").style.display = "flex";
        stickerCanvas.style.display = "block";
        
        // setup sticker canvas events
        stickerCanvas.addEventListener("mousedown", pointerDown);
        stickerCanvas.addEventListener("mousemove", pointerMove);
        stickerCanvas.addEventListener("mouseup", pointerUp);
        stickerCanvas.addEventListener("mouseleave", pointerUp);
        stickerCanvas.addEventListener("touchstart", pointerDown);
        stickerCanvas.addEventListener("touchmove", pointerMove);
        stickerCanvas.addEventListener("touchend", pointerUp);
        stickerCanvas.addEventListener("touchcancel", pointerUp);
    }
});

// sticker buttons
document.getElementById("addSticker1").addEventListener("click", () => {
    addSticker("./Assets/sticker1.png");
});

document.getElementById("addSticker2").addEventListener("click", () => {
    addSticker("./Assets/sticker2.png");
});

function addSticker(src) {
    const img = new Image();
    img.src = src;
    img.onload = () => {
        stickers.push({
            img,
            x: 50,
            y: 50,
            width: img.width / 3,
            height: img.height / 3,
            dragging: false
        });
        redrawStickers();
    };
}

function redrawStickers() {
    const sCtx = stickerCanvas.getContext("2d");
    sCtx.clearRect(0, 0, stickerCanvas.width, stickerCanvas.height);
    stickers.forEach(s => {
        sCtx.drawImage(s.img, s.x, s.y, s.width, s.height);
        if (s === activeSticker) {
            const hx = s.x + s.width - HANDLE / 2;
            const hy = s.y + s.height - HANDLE / 2;
            const cx = hx + HANDLE / 2;
            const cy = hy + HANDLE / 2;
            const pad = HANDLE * 0.22;

            // background circle
            sCtx.fillStyle = 'white';
            sCtx.strokeStyle = '#555';
            sCtx.lineWidth = 2;
            sCtx.beginPath();
            sCtx.roundRect(hx, hy, HANDLE, HANDLE, 4);
            sCtx.fill();
            sCtx.stroke();

            // diagonal arrow ↘
            sCtx.strokeStyle = '#333';
            sCtx.lineWidth = 3;
            sCtx.lineCap = 'round';
            sCtx.lineJoin = 'round';

            const x1 = hx + pad, y1 = hy + pad;
            const x2 = hx + HANDLE - pad, y2 = hy + HANDLE - pad;
            const arrowSize = HANDLE * 0.22;

            // shaft
            sCtx.beginPath();
            sCtx.moveTo(x1, y1);
            sCtx.lineTo(x2, y2);
            sCtx.stroke();

            // arrowhead at bottom-right
            sCtx.beginPath();
            sCtx.moveTo(x2, y2);
            sCtx.lineTo(x2 - arrowSize, y2);
            sCtx.moveTo(x2, y2);
            sCtx.lineTo(x2, y2 - arrowSize);
            sCtx.stroke();

            // arrowhead at top-left
            sCtx.beginPath();
            sCtx.moveTo(x1, y1);
            sCtx.lineTo(x1 + arrowSize, y1);
            sCtx.moveTo(x1, y1);
            sCtx.lineTo(x1, y1 + arrowSize);
            sCtx.stroke();
        }
    });
}

// get pointer position
function getPointerPos(e) {
    const rect = stickerCanvas.getBoundingClientRect();
    const scaleX = stickerCanvas.width / rect.width;
    const scaleY = stickerCanvas.height / rect.height;
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

// drag + resize stickers
function pointerDown(e) {
    const { x: mouseX, y: mouseY } = getPointerPos(e);

    // check resize handle on active sticker first
    if (activeSticker) {
        const hx = activeSticker.x + activeSticker.width - HANDLE / 2;
        const hy = activeSticker.y + activeSticker.height - HANDLE / 2;
        if (mouseX >= hx && mouseX <= hx + HANDLE && mouseY >= hy && mouseY <= hy + HANDLE) {
            resizing = true;
            resizeStart = { x: mouseX, y: mouseY, w: activeSticker.width, h: activeSticker.height };
            return;
        }
    }

    // check drag
    for (let i = stickers.length - 1; i >= 0; i--) {
        const s = stickers[i];
        if (mouseX >= s.x && mouseX <= s.x + s.width && mouseY >= s.y && mouseY <= s.y + s.height) {
            activeSticker = s;
            selectedSticker = s;
            s.dragging = true;
            dragOffset.x = mouseX - s.x;
            dragOffset.y = mouseY - s.y;
            stickers.splice(i, 1);
            stickers.push(s);
            redrawStickers();
            return;
        }
    }

    // clicked empty space — deselect
    activeSticker = null;
    redrawStickers();
}

function pointerMove(e) {
    const { x: mouseX, y: mouseY } = getPointerPos(e);

    if (resizing && activeSticker) {
        const dx = mouseX - resizeStart.x;
        const aspect = resizeStart.w / resizeStart.h;
        const newW = Math.max(20, resizeStart.w + dx);
        activeSticker.width = newW;
        activeSticker.height = newW / aspect;
        redrawStickers();
        return;
    }

    if (!selectedSticker?.dragging) return;
    selectedSticker.x = mouseX - dragOffset.x;
    selectedSticker.y = mouseY - dragOffset.y;
    redrawStickers();
}

function pointerUp() {
    resizing = false;
    if (selectedSticker) selectedSticker.dragging = false;
    selectedSticker = null;
}

// save button
document.getElementById("savePolaroid").addEventListener("click", () => {
    const saveCanvas = document.createElement("canvas");
    saveCanvas.width = WIDTH * DPR;
    saveCanvas.height = HEIGHT * DPR;

    const saveCtx = saveCanvas.getContext("2d");
    saveCtx.imageSmoothingEnabled = true;
    saveCtx.imageSmoothingQuality = 'high';

    // 1) photos
    saveCtx.drawImage(finalCanvas, 0, 0);

    // 2) frame on top of photos
    const frameImg = document.querySelector(".polaroid-frame");
    const finish = () => {
        // 3) stickers on top of frame
        saveCtx.drawImage(stickerCanvas, 0, 0);
        downloadImage(saveCanvas);
    };
    if (frameImg && frameImg.complete) {
        saveCtx.drawImage(frameImg, 0, 0, WIDTH * DPR, HEIGHT * DPR);
        finish();
    } else if (frameImg) {
        frameImg.onload = () => {
            saveCtx.drawImage(frameImg, 0, 0, WIDTH * DPR, HEIGHT * DPR);
            finish();
        };
    } else {
        finish();
    }

    function downloadImage(canvas) {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "my-polaroid.png";
        link.click();
    }
});