// read mode from menu
const mode = sessionStorage.getItem("mode");

// elements
const video = document.getElementById("camera");
const canvas = document.getElementById("snapshot");
const readyButton = document.getElementById("ready");
const countdown = document.getElementById("countdown");

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
    let count = 3;
    countdown.textContent = count;

    const timer = setInterval(() => {
        count--;

        if (count > 0) {
            countdown.textContent = count;
        } else {
            clearInterval(timer);
            countdown.textContent = "📸";

            setTimeout(() => {
                countdown.textContent = "";
                capturePhoto();
            }, 1000);
        }
    }, 1000);
}

function capturePhoto() {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    console.log("snapshot taken");
}