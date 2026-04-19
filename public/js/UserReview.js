// Get modal and close button
const modal = document.getElementById('thankYouModal');
const closeModal = document.getElementById('closeModal');

// Function to show the modal
function showThankYouModal() {
    modal.style.display = 'block';
}

// Close the modal when the user clicks on <span> (x)
closeModal.onclick = function() {
    modal.style.display = 'none';
}

// Close the modal when the user clicks anywhere outside of the modal
window.onclick = function(event) {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Load reviews from localStorage on page load
window.onload = function() {
    const savedReviews = JSON.parse(localStorage.getItem('reviews')) || [];
    displayReviews(savedReviews);
    displayAverageRating(savedReviews);
};

// Handling form submission
document.getElementById('reviewForm').addEventListener('submit', function (e) {
    e.preventDefault();

    // Get user input values
    const username = document.getElementById('username').value;
    const rating = document.getElementById('rating').value;
    const reviewText = document.getElementById('reviewText').value;
    const editIndex = document.getElementById('editIndex').value;

    // Create a new review object
    const newReview = {
        username,
        rating,
        reviewText,
        date: new Date().toLocaleDateString(),
    };

    // Get existing reviews from localStorage
    const reviews = JSON.parse(localStorage.getItem('reviews')) || [];

    if (editIndex) {
        // Update existing review
        reviews[editIndex] = newReview;
        document.getElementById('formTitle').innerText = "Add Your Review";
        document.getElementById('editIndex').value = '';
    } else {
        // Add the new review
        reviews.push(newReview);
    }

    // Save back to localStorage
    localStorage.setItem('reviews', JSON.stringify(reviews));

    // Display the updated reviews and average rating
    displayReviews(reviews);
    displayAverageRating(reviews);

    // Clear the form
    document.getElementById('reviewForm').reset();

    // Show thank you modal
    showThankYouModal();
});

// Function to display reviews
function displayReviews(reviews) {
    const reviewsContainer = document.getElementById('reviewsContainer');
    reviewsContainer.innerHTML = ''; // Clear the container

    reviews.forEach((review, index) => {
        const reviewDiv = document.createElement('div');
        reviewDiv.classList.add('review');
        reviewDiv.style.opacity = 0; // Start with opacity 0

        reviewDiv.innerHTML = `
            <h3>${review.username} (Rating: ${review.rating}/5)</h3>
            <p>${review.reviewText}</p>
            <small>${review.date}</small>
            <div class="review-actions">
                <button onclick="editReview(${index})" class="btn-edit">Edit</button>
                <button onclick="deleteReview(${index})" class="btn-delete">Delete</button>
            </div>
        `;

        reviewsContainer.appendChild(reviewDiv);

        // Animate fade in and slide up
        setTimeout(() => {
            reviewDiv.classList.add('fade-in');
            reviewDiv.style.opacity = 1;
        }, 10); // Delay to allow for transition
    });
}

// Function to display average rating
function displayAverageRating(reviews) {
    const averageRatingContainer = document.getElementById('averageRating');
    const averageStars = document.getElementById('averageStars');

    if (reviews.length === 0) {
        averageRatingContainer.innerText = '0';
        averageStars.innerHTML = ''; // No stars
        return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + parseInt(review.rating), 0);
    const averageRating = (totalRating / reviews.length).toFixed(1);

    averageRatingContainer.innerText = averageRating;

    // Generate stars based on average rating
    averageStars.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.classList.add('star');
        star.innerHTML = i <= averageRating ? '★' : '☆';
        averageStars.appendChild(star);
    }
}

// Function to edit a review
function editReview(index) {
    const reviews = JSON.parse(localStorage.getItem('reviews')) || [];
    const reviewToEdit = reviews[index];

    document.getElementById('username').value = reviewToEdit.username;
    document.getElementById('rating').value = reviewToEdit.rating;
    document.getElementById('reviewText').value = reviewToEdit.reviewText;
    document.getElementById('editIndex').value = index;
    document.getElementById('formTitle').innerText = "Edit Your Review";
}

// Function to delete a review
function deleteReview(index) {
    const reviews = JSON.parse(localStorage.getItem('reviews')) || [];
    reviews.splice(index, 1); // Remove the review at the specified index

    // Save back to localStorage
    localStorage.setItem('reviews', JSON.stringify(reviews));

    // Display the updated reviews and average rating
    displayReviews(reviews);
    displayAverageRating(reviews);
}
