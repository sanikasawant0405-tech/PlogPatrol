document.addEventListener('DOMContentLoaded', function () {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');

    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            const filter = this.getAttribute('data-filter');

            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            galleryItems.forEach(item => {
                item.style.display = (filter === 'all' || item.getAttribute('data-category') === filter) ? 'block' : 'none';
            });
        });
    });
});

function openFullscreen(imgElement) {
    console.log("Opening fullscreen with image:", imgElement.src);
    const fullscreenContainer = document.getElementById('fullscreen-container');
    const fullscreenImg = document.getElementById('fullscreen-img');
    fullscreenImg.src = imgElement.src;
    fullscreenContainer.classList.add('show');
}


function closeFullscreen() {
    const fullscreenContainer = document.getElementById('fullscreen-container');
    fullscreenContainer.classList.remove('show');
}
