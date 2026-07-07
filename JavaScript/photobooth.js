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

const HALF = HEIGHT / 2;

let photoNumber = 0;
let stickers = [];
let selectedSticker = null;
let dragOffset = { x: 0, y: 0 };

finalCanvas.width = WIDTH;
finalCanvas.height = HEIGHT;
stickerCanvas.width = WIDTH;
stickerCanvas.height = HEIGHT;

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
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const img = new Image();
            img.onload = () => {
                photoNumber = 1;
                drawPhotoToCanvas(img, 0);
                ready.textContent = "Upload Second Photo";
            };
            img.src = URL.createObjectURL(file);
        }
    });
    input.click();
    ready.onclick = () => input.click();
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
    const yOffset = photoNumber === 0 ? 0 : HALF;
    const vW = camera.videoWidth;
    const vH = camera.videoHeight;
    const targetAspect = WIDTH / HALF;
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
    
    // flip horizontally
    ctx.save();
    ctx.translate(WIDTH, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(camera, sx, sy, sw, sh, 0, yOffset, WIDTH, HALF);
    ctx.restore();
    
    // save photo to sessionStorage
    const photoData = finalCanvas.toDataURL("image/png");
    sessionStorage.setItem(`photo${photoNumber + 1}`, photoData);
    
    photoNumber++;
    ready.disabled = false;
    
    if (photoNumber === 1) {
        camera.style.top = "50%";  // move camera down
    } else if (photoNumber === 2) {
        camera.style.display = "none";
        ready.style.display = "none";
        next.style.display = "inline-block";
    }
}

function drawPhotoToCanvas(img, yOffset) {
    const targetAspect = WIDTH / HALF;
    const imgAspect = img.width / img.height;
    
    let sx, sy, sw, sh;
    if (imgAspect > targetAspect) {
        sh = img.height;
        sw = img.height * targetAspect;
        sx = (img.width - sw) / 2;
        sy = 0;
    } else {
        sw = img.width;
        sh = img.width / targetAspect;
        sx = 0;
        sy = (img.height - sh) / 2;
    }
    
    ctx.drawImage(img, sx, sy, sw, sh, 0, yOffset, WIDTH, HALF);
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
    sCtx.clearRect(0, 0, WIDTH, HEIGHT);
    stickers.forEach(s => sCtx.drawImage(s.img, s.x, s.y, s.width, s.height));
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

// drag stickers
function pointerDown(e) {
    const { x: mouseX, y: mouseY } = getPointerPos(e);
    for (let i = stickers.length - 1; i >= 0; i--) {
        const s = stickers[i];
        if (mouseX >= s.x && mouseX <= s.x + s.width && mouseY >= s.y && mouseY <= s.y + s.height) {
            selectedSticker = s;
            s.dragging = true;
            dragOffset.x = mouseX - s.x;
            dragOffset.y = mouseY - s.y;
            stickers.splice(i, 1);
            stickers.push(s);
            redrawStickers();
            break;
        }
    }
}

function pointerMove(e) {
    if (!selectedSticker?.dragging) return;
    const { x: mouseX, y: mouseY } = getPointerPos(e);
    selectedSticker.x = mouseX - dragOffset.x;
    selectedSticker.y = mouseY - dragOffset.y;
    redrawStickers();
}

function pointerUp() {
    if (selectedSticker) selectedSticker.dragging = false;
    selectedSticker = null;
}

// save button
document.getElementById("savePolaroid").addEventListener("click", () => {
    const saveCanvas = document.createElement("canvas");
    saveCanvas.width = WIDTH;
    saveCanvas.height = HEIGHT;

    const saveCtx = saveCanvas.getContext("2d");

    // 1) photos
    saveCtx.drawImage(finalCanvas, 0, 0);

    // 2) stickers
    saveCtx.drawImage(stickerCanvas, 0, 0);

    // 3) frame last
    const frameImg = document.querySelector(".polaroid-frame"); // or use your frame id
    if (frameImg && frameImg.complete) {
        saveCtx.drawImage(frameImg, 0, 0, WIDTH, HEIGHT);
        downloadImage(saveCanvas);
    } else if (frameImg) {
        frameImg.onload = () => {
            saveCtx.drawImage(frameImg, 0, 0, WIDTH, HEIGHT);
            downloadImage(saveCanvas);
        };
    } else {
        downloadImage(saveCanvas);
    }

    function downloadImage(canvas) {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "my-polaroid.png";
        link.click();
    }
});