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

// Photo slot positions within the 400x600 container (measured from frame PNG)
// Multiplied by DPR for the higher-res internal canvas
const SLOT1 = { x: 112 * DPR, y: 93 * DPR, w: 177 * DPR, h: 204 * DPR };
const SLOT2 = { x: 112 * DPR, y: 314 * DPR, w: 177 * DPR, h: 160 * DPR };

const HANDLE = 28;     // handle size in canvas pixels
const ROT_OFFSET = 50; // distance above sticker top to rotation handle center

let photoNumber = 0;
let stickers = [];
let selectedSticker = null;
let activeSticker = null;
let resizing = false;
let rotating = false;
let resizeStart = { x: 0, y: 0, w: 0, h: 0 };
let rotateStartAngle = 0;
let rotateStartRotation = 0;
let dragOffset = { x: 0, y: 0 };

// rotate a point (px,py) around center (cx,cy) by angle
function rotatePoint(px, py, cx, cy, angle) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return {
        x: cos * (px - cx) - sin * (py - cy) + cx,
        y: sin * (px - cx) + cos * (py - cy) + cy
    };
}

// convert world mouse coords to sticker local space (origin = sticker top-left, unrotated)
function toLocal(mouseX, mouseY, s) {
    const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
    const p = rotatePoint(mouseX, mouseY, cx, cy, -s.rotation);
    return { x: p.x - s.x, y: p.y - s.y };
}

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

    function showUploadError(zone, message) {
        zone.innerHTML = `<span style="color:#c0392b;font-size:10px;padding:8px;text-align:center;">${message}<br><span style="font-size:9px;margin-top:4px;display:block">click to try again</span></span>`;
    }

    function makeInput(slot, zone, onDone) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";

        zone.addEventListener("click", () => input.click());

        input.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            input.value = ""; // reset so same file can be picked again

            if (file.size > 15 * 1024 * 1024) {
                showUploadError(zone, "file is too large (max 15MB). try compressing it first.");
                return;
            }

            if (!file.type.startsWith("image/")) {
                showUploadError(zone, "that doesn't look like an image file. try a jpg or png.");
                return;
            }

            const objectUrl = URL.createObjectURL(file);
            const img = new Image();

            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                drawPhotoToCanvas(img, slot);
                onDone();
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                let reason;
                if (file.type === "image/heic" || file.type === "image/heif") {
                    reason = "HEIC files aren't supported by browsers. convert to jpg first.";
                } else if (file.size < 100) {
                    reason = "file seems empty or corrupted.";
                } else {
                    reason = "file may be corrupted or an unsupported format.";
                }
                showUploadError(zone, reason);
            };

            img.src = objectUrl;
        });
        return input;
    }

    makeInput(SLOT1, zone1, () => {
        zone1.style.display = "none";
        zone2.style.display = "flex";
        photoNumber = 1;

        makeInput(SLOT2, zone2, () => {
            zone2.style.display = "none";
            photoNumber = 2;
            next.style.display = "inline-block";
            document.getElementById("photoControls").style.display = "flex";
            ready.style.display = "none";
        });
    });
}

// take photo
ready.addEventListener("click", () => {
    if (mode === "camera") {
        ready.disabled = true;
        startCountdown(() => capturePhoto());
    }
});

// retake 
document.getElementById("retake").addEventListener("click", () => {
    const retakeSlot = photoNumber === 1 ? 0 : 1;
    const slot = retakeSlot === 0 ? SLOT1 : SLOT2;

    // clear slot
    ctx.clearRect(slot.x, slot.y, slot.w, slot.h);
    photoNumber = retakeSlot;

    // reset cam in slot
    camera.style.display = "block";
    camera.style.left = slot.x / DPR + 'px';
    camera.style.top = slot.y / DPR + 'px';
    camera.style.width = slot.w / DPR + 'px';
    camera.style.height = slot.h / DPR + 'px';

    next.style.display = "none";
    ready.style.display = "inline-block";
    ready.disabled = true;
    document.getElementById("retake").style.display = "none";

    startCountdown(() => capturePhoto());
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

    photoNumber++;
    document.getElementById("retake").style.display = "inline-block";

    if (photoNumber === 1) {
        // move camera to slot 2
        ready.disabled = false;
        camera.style.left = SLOT2.x / DPR + 'px';
        camera.style.top = SLOT2.y / DPR + 'px';
        camera.style.width = SLOT2.w / DPR + 'px';
        camera.style.height = SLOT2.h / DPR + 'px';
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
        next.style.display = "none";
        document.getElementById("photoControls").style.display = "none";
        document.getElementById("stickerControls").style.display = "flex";
        document.getElementById("stickerSidebar").style.display = "flex";
        stickerCanvas.style.pointerEvents = "auto";

        // setup sticker canvas events
        stickerCanvas.addEventListener("mousedown", pointerDown);
        stickerCanvas.addEventListener("mousemove", pointerMove);
        stickerCanvas.addEventListener("mouseup", pointerUp);
        stickerCanvas.addEventListener("mouseleave", pointerUp);
        stickerCanvas.addEventListener("touchstart", pointerDown, { passive: false });
        stickerCanvas.addEventListener("touchmove", pointerMove, { passive: false });
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

document.getElementById("addSticker3").addEventListener("click", () => {
    addSticker("./Assets/hachi.png");
});

document.getElementById("addSticker4").addEventListener("click", () => {
    addSticker("./Assets/squirrel.png");
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
            rotation: 0,
            dragging: false
        });
        redrawStickers();
    };
}

function redrawStickers() {
    const sCtx = stickerCanvas.getContext("2d");
    sCtx.clearRect(0, 0, stickerCanvas.width, stickerCanvas.height);

    stickers.forEach(s => {
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;

        // draw sticker with rotation
        sCtx.save();
        sCtx.translate(cx, cy);
        sCtx.rotate(s.rotation);
        sCtx.translate(-s.width / 2, -s.height / 2);
        sCtx.drawImage(s.img, 0, 0, s.width, s.height);

        if (s === activeSticker) {
            const pad = HANDLE * 0.22;

            // — rotation handle (top-center, above sticker) —
            const rcx = s.width / 2;
            const rcy = -ROT_OFFSET;

            sCtx.strokeStyle = '#aaa';
            sCtx.lineWidth = 1.5;
            sCtx.setLineDash([4, 3]);
            sCtx.beginPath();
            sCtx.moveTo(rcx, 0);
            sCtx.lineTo(rcx, rcy + HANDLE / 2);
            sCtx.stroke();
            sCtx.setLineDash([]);

            sCtx.fillStyle = 'white';
            sCtx.strokeStyle = '#555';
            sCtx.lineWidth = 2;
            sCtx.beginPath();
            sCtx.arc(rcx, rcy, HANDLE / 2, 0, Math.PI * 2);
            sCtx.fill();
            sCtx.stroke();

            // circular arrow icon
            const r = HANDLE * 0.28;
            sCtx.strokeStyle = '#333';
            sCtx.lineWidth = 2.5;
            sCtx.lineCap = 'round';
            sCtx.beginPath();
            sCtx.arc(rcx, rcy, r, -Math.PI * 0.85, Math.PI * 0.15);
            sCtx.stroke();
            const endA = Math.PI * 0.15;
            const ax = rcx + r * Math.cos(endA), ay = rcy + r * Math.sin(endA);
            const as = HANDLE * 0.16;
            sCtx.beginPath();
            sCtx.moveTo(ax, ay);
            sCtx.lineTo(ax + Math.cos(endA + Math.PI * 0.55) * as, ay + Math.sin(endA + Math.PI * 0.55) * as);
            sCtx.moveTo(ax, ay);
            sCtx.lineTo(ax + Math.cos(endA - Math.PI * 0.55) * as, ay + Math.sin(endA - Math.PI * 0.55) * as);
            sCtx.stroke();

            // — resize handle (bottom-right) —
            const hx = s.width - HANDLE / 2, hy = s.height - HANDLE / 2;

            sCtx.fillStyle = 'white';
            sCtx.strokeStyle = '#555';
            sCtx.lineWidth = 2;
            sCtx.beginPath();
            sCtx.roundRect(hx, hy, HANDLE, HANDLE, 4);
            sCtx.fill();
            sCtx.stroke();

            sCtx.strokeStyle = '#333';
            sCtx.lineWidth = 3;
            sCtx.lineJoin = 'round';
            const x1 = hx + pad, y1 = hy + pad;
            const x2 = hx + HANDLE - pad, y2 = hy + HANDLE - pad;
            const arrowSize = HANDLE * 0.22;

            sCtx.beginPath();
            sCtx.moveTo(x1, y1); sCtx.lineTo(x2, y2); sCtx.stroke();
            sCtx.beginPath();
            sCtx.moveTo(x2, y2); sCtx.lineTo(x2 - arrowSize, y2);
            sCtx.moveTo(x2, y2); sCtx.lineTo(x2, y2 - arrowSize); sCtx.stroke();
            sCtx.beginPath();
            sCtx.moveTo(x1, y1); sCtx.lineTo(x1 + arrowSize, y1);
            sCtx.moveTo(x1, y1); sCtx.lineTo(x1, y1 + arrowSize); sCtx.stroke();

            // — delete handle (top-right) —
            const dx = s.width - HANDLE / 2, dy = -HANDLE / 2;

            sCtx.fillStyle = '#e74c3c';
            sCtx.strokeStyle = '#c0392b';
            sCtx.lineWidth = 2;
            sCtx.beginPath();
            sCtx.roundRect(dx, dy, HANDLE, HANDLE, 4);
            sCtx.fill();
            sCtx.stroke();

            const xp = HANDLE * 0.25;
            sCtx.strokeStyle = 'white';
            sCtx.lineWidth = 3;
            sCtx.beginPath();
            sCtx.moveTo(dx + xp, dy + xp); sCtx.lineTo(dx + HANDLE - xp, dy + HANDLE - xp);
            sCtx.moveTo(dx + HANDLE - xp, dy + xp); sCtx.lineTo(dx + xp, dy + HANDLE - xp);
            sCtx.stroke();
        }

        sCtx.restore();
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

// drag + resize + rotate stickers
function pointerDown(e) {
    if (e.cancelable) e.preventDefault();
    const { x: mouseX, y: mouseY } = getPointerPos(e);

    // check handles on active sticker first (all in local space)
    if (activeSticker) {
        const s = activeSticker;
        const loc = toLocal(mouseX, mouseY, s);

        // rotation handle: circle at (width/2, -ROT_OFFSET)
        if (Math.hypot(loc.x - s.width / 2, loc.y + ROT_OFFSET) < HANDLE / 2 + 4) {
            rotating = true;
            const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
            rotateStartAngle = Math.atan2(mouseY - cy, mouseX - cx);
            rotateStartRotation = s.rotation;
            return;
        }

        // delete handle: top-right (width - HANDLE/2, -HANDLE/2) in local
        if (loc.x >= s.width - HANDLE / 2 && loc.x <= s.width + HANDLE / 2 &&
            loc.y >= -HANDLE / 2 && loc.y <= HANDLE / 2) {
            stickers.splice(stickers.indexOf(s), 1);
            activeSticker = null;
            redrawStickers();
            return;
        }

        // resize handle: bottom-right (width - HANDLE/2, height - HANDLE/2) in local
        if (loc.x >= s.width - HANDLE / 2 && loc.x <= s.width + HANDLE / 2 &&
            loc.y >= s.height - HANDLE / 2 && loc.y <= s.height + HANDLE / 2) {
            resizing = true;
            resizeStart = { x: mouseX, y: mouseY, w: s.width, h: s.height };
            return;
        }
    }

    // check sticker body (in local space)
    for (let i = stickers.length - 1; i >= 0; i--) {
        const s = stickers[i];
        const loc = toLocal(mouseX, mouseY, s);
        if (loc.x >= 0 && loc.x <= s.width && loc.y >= 0 && loc.y <= s.height) {
            activeSticker = s;
            selectedSticker = s;
            s.dragging = true;
            // track offset from sticker center (works at any rotation)
            dragOffset.x = mouseX - (s.x + s.width / 2);
            dragOffset.y = mouseY - (s.y + s.height / 2);
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
    if (e.cancelable) e.preventDefault();
    const { x: mouseX, y: mouseY } = getPointerPos(e);

    if (rotating && activeSticker) {
        const cx = activeSticker.x + activeSticker.width / 2;
        const cy = activeSticker.y + activeSticker.height / 2;
        const currentAngle = Math.atan2(mouseY - cy, mouseX - cx);
        activeSticker.rotation = rotateStartRotation + (currentAngle - rotateStartAngle);
        redrawStickers();
        return;
    }

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
    // move by center offset so rotation doesn't affect drag
    selectedSticker.x = mouseX - dragOffset.x - selectedSticker.width / 2;
    selectedSticker.y = mouseY - dragOffset.y - selectedSticker.height / 2;
    redrawStickers();
}

function pointerUp() {
    resizing = false;
    rotating = false;
    if (selectedSticker) selectedSticker.dragging = false;
    selectedSticker = null;
}

// reset stickers button
document.getElementById("resetStickers").addEventListener("click", () => {
    stickers = [];
    activeSticker = null;
    selectedSticker = null;
    redrawStickers();
});

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
        // 3) stickers on top of frame (drawn directly, no handles)
        stickers.forEach(s => {
            saveCtx.save();
            saveCtx.translate(s.x + s.width / 2, s.y + s.height / 2);
            saveCtx.rotate(s.rotation);
            saveCtx.drawImage(s.img, -s.width / 2, -s.height / 2, s.width, s.height);
            saveCtx.restore();
        });
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
        document.getElementById("homeControls").style.display = "inline-block";
    }
});