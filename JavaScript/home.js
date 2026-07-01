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