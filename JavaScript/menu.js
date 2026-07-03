const upload = document.querySelector(".upload");
const camera = document.querySelector(".camera");

// differentiate between modes 
camera.addEventListener("click", () => {
    sessionStorage.setItem("mode", "camera");
    window.location.href = "photobooth.html";
});

upload.addEventListener("click", () => {
    sessionStorage.setItem("mode", "upload");
    window.location.href = "photobooth.html";
});