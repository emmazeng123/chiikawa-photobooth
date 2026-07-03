const mode = sessionStorage.getItem("mode");

if (mode === "camera") {
    startCamera();
} else if (mode === "upload") {
    loadUploadedPhoto();
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true
        });

        const video = document.getElementById("camera");
        video.srcObject = stream;

    } catch (error) {
        alert("Camera permission was denied.");
        console.error(error);
    }
}

function loadUploadedPhoto() {
    const fileInput = document.getElementById("fileInput");
    const userPhoto = document.getElementById("userPhoto");

    // open file 
    fileInput.click();

    // selects 1 file
    fileInput.addEventListener("change", function () {
        const file = fileInput.files[0];

        if (file) {
            const imageURL = URL.createObjectURL(file);
            userPhoto.src = imageURL;
        }
    });
}