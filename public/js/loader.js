(function () {
    let currentSlide = 0;
    let sliderTimer;

    function showContent() {
        const loader = document.getElementById("loader");
        const content = document.getElementById("content");

        if (!loader || !content) {
            return;
        }

        loader.classList.add("fade-out");

        setTimeout(() => {
            loader.hidden = true;
            content.style.display = "block";
        }, 650);
    }

    function showSlide(index) {
        const slider = document.querySelector(".slider");
        const slides = document.querySelectorAll(".slider img");
        const thumbnails = document.querySelectorAll(".thumbnails img");

        if (!slider || slides.length === 0) {
            return;
        }

        if (index >= slides.length) {
            currentSlide = 0;
        } else if (index < 0) {
            currentSlide = slides.length - 1;
        } else {
            currentSlide = index;
        }

        slider.style.transform = `translateX(-${currentSlide * 100}%)`;

        thumbnails.forEach((thumbnail, thumbnailIndex) => {
            thumbnail.classList.toggle("active", thumbnailIndex === currentSlide);
        });
    }

    function nextSlide() {
        showSlide(currentSlide + 1);
    }

    function prevSlide() {
        showSlide(currentSlide - 1);
    }

    function startSlider() {
        showSlide(currentSlide);

        if (sliderTimer) {
            clearInterval(sliderTimer);
        }

        sliderTimer = setInterval(nextSlide, 5000);
    }

    window.showSlide = showSlide;
    window.nextSlide = nextSlide;
    window.prevSlide = prevSlide;

    window.addEventListener("load", () => {
        startSlider();
        setTimeout(showContent, 900);
    });
}());
