// read mode from menu
const mode = sessionStorage.getItem("mode");

// elements
const video = document.getElementById("camera");
const canvas = document.getElementById("snapshot");
const readyButton = document.getElementById("ready");
const countdown = document.getElementById("countdown");
const frame = document.querySelector(".frame");
const photoSlots = [
    document.getElementById("photo1"),
    document.getElementById("photo2")
];

let photoNumber = 0;

// start camera only if user chose camera
if (mode === "camera") {
    startCamera();
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
    } catch (error) {
        console.error(error);
        alert("Camera did not start.");
    }
}

readyButton.addEventListener("click", readyFunction);

function readyFunction() {
    // let count = 3;
    // countdown.textContent = count;

    // const timer = setInterval(() => {
    //     count--;

    //     if (count > 0) {
    //         countdown.textContent = count;
    //     } else {
    //         clearInterval(timer);
    //         countdown.textContent = "📸";

    //         setTimeout(() => {
    //             countdown.textContent = "";
    //             capturePhoto();
    //             moveFrameDown();
    //         }, 1000);
    //     }
    // }, 1000);
    capturePhoto();
    moveFrameDown();

}

function capturePhoto() {
    if (photoNumber >= photoSlots.length) {
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    
    ctx.scale(-1, 1);
    ctx.drawImage(video, -video.videoWidth, 0);
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Different crop values for first vs second photo
    let cropX, cropY, cropWidth, cropHeight;
    
    if (photoNumber === 0) {
        // First photo
        cropX = video.videoWidth * 0.2;
        cropY = video.videoHeight * 0;
        cropWidth = video.videoWidth * 0.6;
        cropHeight = video.videoHeight * 1;
    } else {
        // Second photo (adjust these values)
        cropX = video.videoWidth * 0.2;
        cropY = video.videoHeight * 0;  // try different value
        cropWidth = video.videoWidth * 0.6;
        cropHeight = video.videoHeight * 0.75;  // smaller height
    }

    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    
    const croppedCtx = croppedCanvas.getContext("2d");
    croppedCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    photoSlots[photoNumber].src = croppedCanvas.toDataURL("image/png");
    photoNumber++;
}

function moveFrameDown() {
    if (photoNumber === 1) {
        // lower is higher
        frame.style.top = "41%";
        video.style.transform = "translateY(80px) scaleX(-1)";
    }  else if (photoNumber === 2) {
        readyButton.disabled = true;
        readyButton.textContent = "Done";
        
        // Hide the camera feed
        video.style.display = "none";
        
        // Make sure the frame is visible (in case it was hidden)
        frame.style.display = "block";
    }
}