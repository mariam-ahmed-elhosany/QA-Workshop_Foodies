
// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAvgJ3w5nzFbx4QTWwN70s9_5Lo08fjfyg",
    authDomain: "foodieshomepage.firebaseapp.com",
    projectId: "foodieshomepage",
    storageBucket: "foodieshomepage.firebasestorage.app",
    messagingSenderId: "845229655466",
    appId: "1:845229655466:web:d99eae57b29190927cd7d3",
    measurementId: "G-YQ93RVWZDJ"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();



// Redirect function (static redirect to RestaurantPage.html)
function redirectToRestaurant(id) {
  console.log(`Redirecting to restaurant ${id}`);
  window.location.href = `RestaurantPage.html?restaurantId=${id}`;
}


// DOM logic
document.addEventListener('DOMContentLoaded', function () {
    const carousel = document.querySelector('.carousel-inner');
    const prevBtn = document.querySelector('.carousel-prev');
    const nextBtn = document.querySelector('.carousel-next');

    let cardIndex = 0;
    let cardWidth, visibleCards, maxIndex;

    function calculateCarouselDimensions() {
        const card = document.querySelector('.offer-card');
        if (!card) return;
        const cardStyle = window.getComputedStyle(card);
        cardWidth = card.offsetWidth + parseInt(cardStyle.marginRight);
        const carouselWidth = carousel.parentElement.offsetWidth - 80;
        visibleCards = Math.floor(carouselWidth / cardWidth);
        maxIndex = Math.max(0, document.querySelectorAll('.offer-card').length - visibleCards);
        updateCarouselPosition();
    }

    prevBtn.addEventListener('click', () => {
    if (cardIndex > 0) {
        cardIndex--;
        updateCarouselPosition();
    }
    // Else: do nothing — prevent bounce
});

nextBtn.addEventListener('click', () => {
    if (cardIndex < maxIndex) {
        cardIndex++;
        updateCarouselPosition();
    }
    // Else: do nothing — prevent bounce
});

    function updateCarouselPosition() {
        carousel.style.transform = `translateX(-${cardIndex * cardWidth}px)`;
    }

    // Fetch restaurants from Firestore
    async function fetchRestaurants() {
        try {
            const snapshot = await db.collection("restaurants").get();
            const container = document.querySelector('.restaurants-section');
            container.innerHTML = '<h2>Restaurants</h2>';

            snapshot.forEach(doc => {
                const data = doc.data();
                const div = document.createElement('div');
                div.className = 'restaurant-item';
                div.setAttribute('data-restaurant-id', doc.id);
                div.innerHTML = `
                    <img src="${data.imageUrl || '/api/placeholder/120/80'}" alt="${data.name}" class="restaurant-image">
                    <div class="restaurant-name">${data.name}</div>
                `;
                div.addEventListener('click', () => redirectToRestaurant(doc.id));
                container.appendChild(div);
            });

            fetchOffers();
        } catch (err) {
            console.error("Error fetching restaurants:", err);
        }
    }

    // Fetch offers from Firestore
    async function fetchOffers() {
  try {
    const snapshot = await db.collection("offers").get();
    const container = document.querySelector('.carousel-inner');
    container.innerHTML = '';

    snapshot.forEach(doc => {
      const data = doc.data();
      const restaurantId = data.restaurantId;

      const div = document.createElement('div');
      div.className = 'offer-card';
      div.setAttribute('data-restaurant-id', restaurantId || '1');
      div.innerHTML = `
        <img src="${data.imageUrl || '/api/placeholder/200/120'}" alt="${data.title}" class="offer-image">
        <div class="offer-title">${data.title}</div>
      `;

      div.addEventListener('click', () => {
        if (restaurantId) {
          redirectToRestaurant(restaurantId);
        } else {
          console.warn("Offer is missing restaurantId:", doc.id);
          alert("This offer is not linked to a restaurant.");
        }
      });

      container.appendChild(div);
    });

    calculateCarouselDimensions();
  } catch (err) {
    console.error("Error fetching offers:", err);
  }
}


    // Search
    const searchInput = document.querySelector('.search-bar input');
    searchInput.addEventListener('input', function (e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        const restaurants = document.querySelectorAll('.restaurant-item');
        restaurants.forEach(item => {
            const name = item.querySelector('.restaurant-name').textContent.toLowerCase();
            item.style.display = name.includes(searchTerm) ? 'flex' : 'none';
        });
    });

    // Init
    fetchRestaurants();
});
