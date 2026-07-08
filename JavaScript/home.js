// hover "start"
// usagi chills out 

const start = document.querySelector(".start");
const rabbit = document.querySelector(".rabbit");

start.addEventListener("mouseenter", () => {
    rabbit.src = "Assets/rabbit-still.png";
})

start.addEventListener("mouseleave", () => {
    rabbit.src = "Assets/rabbit.gif";
})

start.addEventListener("touchstart", () => {
    rabbit.src = "Assets/rabbit-still.png";
}, { passive: true })

start.addEventListener("touchend", () => {
    rabbit.src = "Assets/rabbit.gif";
})

start.addEventListener("click", () => {
    window.location.href = "menu.html";
})