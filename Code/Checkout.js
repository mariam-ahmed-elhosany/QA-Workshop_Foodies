// Import the functions you need from the SDKs you need
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';
import { getFirestore, collection, addDoc, serverTimestamp, getDoc, updateDoc, doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAvgJ3w5nzFbx4QTWwN70s9_5Lo08fjfyg",
  authDomain: "foodieshomepage.firebaseapp.com",
  projectId: "foodieshomepage",
  storageBucket: "foodieshomepage.appspot.com",
  messagingSenderId: "845229655466",
  appId: "1:845229655466:web:d99eae57b29190927cd7d3",
  measurementId: "G-YQ93RVWZDJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Initialize auth
const auth = getAuth(app);

// Global Variables
let items = [];
let loyaltyPoints = 1000;
const requiredLoyaltyPoints = 1000;
let basePriceAfterOffer = 0;
let isPromoApplied = false;
let isLoyaltyApplied = false;

// Get user information consistently
function getUserData() {
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    
    const user = JSON.parse(userStr);
    return user && user.uid ? user : null;
  } catch (e) {
    console.error("Error parsing user data:", e);
    return null;
  }
}

const user = getUserData();
const uid = user ? user.uid : null;
let userRef = uid ? doc(db, "users", uid) : null;

// Load user data if logged in
if (uid && userRef) {
  getDoc(userRef)
    .then((docSnap) => {
      if (docSnap.exists()) {
        loyaltyPoints = docSnap.data().LoyalityPoints || 0;
        console.log("Current Loyalty Points:", loyaltyPoints);
        updateLoyaltyButton();
      } else {
        console.log("User document doesn't exist yet");
      }
    })
    .catch(err => {
      console.error("Error loading user data:", err);
    });
}

// Event Bindings
window.onload = () => {
  loadSelectedItems();
  displayItems();
  getItemsTotal();
  
  // Important: First check for offer from offers collection
  checkAndApplyOffer().then(() => {
    // After offer is applied (or not), update loyalty button and check for promo
    updateLoyaltyButton();
    checkAndApplyRestaurantPromo();
  });

  document.getElementById("promoBtn").addEventListener("click", afterPromo);
  document.getElementById("applyLoyaltyBtn").addEventListener("click", afterLoyalty);
};

window.confirmOrder = confirmOrder;
window.cancelOrder = cancelOrder;

// New function to check and apply offer from offers collection
async function checkAndApplyOffer() {
  try {
    // Check if user came from an offer
    const fromOffer = sessionStorage.getItem("fromOffer");
    const restaurantId = sessionStorage.getItem("restaurantId");
    
    if (fromOffer === "true" && restaurantId) {
      console.log("User came from offers section, loading offer for restaurant:", restaurantId);
      
      // Get the offer from Firebase
      const offersRef = doc(db, "offers", restaurantId);
      const offerSnap = await getDoc(offersRef);
      
      if (offerSnap.exists()) {
        const offerData = offerSnap.data();
        console.log("Found offer data:", offerData);
        
        // Get discount amount
        let discount = 0;
        if (offerData.discount) {
          discount = parseInt(offerData.discount);
        } else if (offerData.amount) {
          discount = parseInt(offerData.amount);
        } else if (offerData.value) {
          discount = parseInt(offerData.value);
        }
        
        if (discount > 0) {
          console.log("Applying offer discount:", discount);
          
          // Apply the offer to the base price
          const total = getItemsTotal();
          basePriceAfterOffer = Math.max(0, total - discount);
          
          // Update UI
          const afterOfferElement = document.getElementById("afterOffer");
          if (afterOfferElement) {
            afterOfferElement.innerText = `EGP ${basePriceAfterOffer.toFixed(2)}`;
          }
          
          // Add a visual indicator that an offer was applied
          const offerInfoElement = document.getElementById("offerInfo");
          if (offerInfoElement) {
            offerInfoElement.innerHTML = `<span class="offer-applied">Offer applied: EGP ${discount} off!</span>`;
          }
          
          return true;
        }
      } else {
        console.log("No offer found for this restaurant");
      }
    } else {
      console.log("User did not come from offers section or no restaurant ID");
    }
    
    // If no offer found or not coming from offers, apply the default offer
    applyDefaultOffer();
    return false;
  } catch (e) {
    console.error("Error applying offer from collection:", e);
    // Fallback to default offer if any error occurs
    applyDefaultOffer();
    return false;
  }
}

// Default offer (moved from applyOffer function)
function applyDefaultOffer() {
  const total = getItemsTotal();
  const offer = 100; // Default fixed offer
  basePriceAfterOffer = Math.max(0, total - offer);
  
  const afterOfferElement = document.getElementById("afterOffer");
  if (afterOfferElement) {
    afterOfferElement.innerText = `EGP ${basePriceAfterOffer.toFixed(2)}`;
  }
  
  const offerInfoElement = document.getElementById("offerInfo");
  if (offerInfoElement) {
    offerInfoElement.innerHTML = `<span class="offer-applied">Default offer applied: EGP ${offer} off!</span>`;
  }
  
  const afterPromoElement = document.getElementById("afterPromo");
  if (afterPromoElement) {
    afterPromoElement.innerText = "EGP 0";
  }
  
  const afterLoyaltyElement = document.getElementById("afterLoyalty");
  if (afterLoyaltyElement) {
    afterLoyaltyElement.innerText = "EGP 0";
  }
  
  isPromoApplied = false;
  isLoyaltyApplied = false;
}

// New function to auto-fill restaurant promo code (but not apply it)
function checkAndApplyRestaurantPromo() {
  try {
    const promoData = sessionStorage.getItem("promoCode");
    if (promoData) {
      const promo = JSON.parse(promoData);
      console.log("Found restaurant promo:", promo);
      
      if (promo && promo.id) {
        // Set the promo code in the input field
        const promoInput = document.getElementById("promoCode");
        if (promoInput) {
          promoInput.value = promo.id;
          console.log("Auto-filled promo code:", promo.id);
          
          // No auto-apply, wait for user to click the Apply button
        }
      }
    } else {
      console.log("No restaurant promo found");
    }
  } catch (e) {
    console.error("Error auto-filling restaurant promo:", e);
  }
}

// Load selected items - Fixed version
function loadSelectedItems() {
  try {
    console.log("Checking sessionStorage...");
    const selected = sessionStorage.getItem("selectedItems");
    const offer = sessionStorage.getItem("restaurantOffer");
    
    console.log("Found in storage:", { selected, offer });
    
    if (selected) {
      items = JSON.parse(selected);
      console.log("Parsed items:", items);
      
      if (!Array.isArray(items)) {
        throw new Error("Items is not an array");
      }
      
      // Validate each item
      items.forEach(item => {
        if (!item.name || isNaN(item.price) || isNaN(item.quantity)) {
          throw new Error(`Invalid item: ${JSON.stringify(item)}`);
        }
      });
    } else {
      throw new Error("No items in sessionStorage");
    }
  } catch (e) {
    console.error("Load error details:", e);
    alert(`Error: ${e.message}`);
    window.location.href = "RestaurantPage.html";
  }
}

// Display items - Fixed version
function displayItems() {
  const tbody = document.getElementById("itemsTable");
  if (!tbody) {
    console.error("Items table not found");
    return;
  }
  
  tbody.innerHTML = "";
  
  if (!items || items.length === 0) {
    console.warn("No items to display");
    return;
  }

  items.forEach(item => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>EGP ${(item.price * item.quantity).toFixed(2)}</td>
    `;
    tbody.appendChild(row);
  });
}

// Total
function getItemsTotal() {
  const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const totalElement = document.getElementById("totalAmount");
  if (totalElement) {
    totalElement.innerText = `EGP ${total.toFixed(2)}`;
  }
  return total;
}

// Promo Code - Updated to handle restaurant promos
function afterPromo() {
  const promoCodeElement = document.getElementById("promoCode");
  if (!promoCodeElement) {
    console.error("Promo code input not found");
    return;
  }
  
  const code = promoCodeElement.value.trim().toUpperCase();
  if (!code) {
    alert("Please enter a promo code");
    return;
  }
  
  // Check first in restaurant promo from sessionStorage
  let discount = 0;
  try {
    const promoData = sessionStorage.getItem("promoCode");
    if (promoData) {
      const promo = JSON.parse(promoData);
      if (promo && promo.id && promo.id.toUpperCase() === code) {
        // Make sure we have a valid discount value
        if (promo.value) {
          // Handle both number and string formats
          discount = parseInt(promo.value);
        } else if (promo.amount) {
          // For backward compatibility
          discount = parseInt(promo.amount);
        }
        
        console.log("Using restaurant promo discount:", discount);
      }
    }
  } catch (e) {
    console.error("Error parsing restaurant promo:", e);
  }
  
  // If not found in restaurant promo, check hardcoded values
  if (discount === 0) {
    const validCodes = { "FOOD50": 50, "BURGER30": 30 };
    if (!validCodes[code]) {
      alert("Invalid promo code. Try 'FOOD50' or a restaurant-specific code.");
      isPromoApplied = false;
      
      const afterPromoElement = document.getElementById("afterPromo");
      if (afterPromoElement) {
        afterPromoElement.innerText = `EGP ${basePriceAfterOffer.toFixed(2)}`;
      }
      return;
    }
    discount = validCodes[code];
  }

  const discounted = Math.max(0, basePriceAfterOffer - discount);
  isPromoApplied = true;
  
  const afterPromoElement = document.getElementById("afterPromo");
  if (afterPromoElement) {
    afterPromoElement.innerText = `EGP ${discounted.toFixed(2)}`;
  }
  
  alert(`Promo applied! EGP ${discount} off.`);

  // Reset loyalty discount if applied to recalculate
  if (isLoyaltyApplied) {
    isLoyaltyApplied = false;
    
    const afterLoyaltyElement = document.getElementById("afterLoyalty");
    if (afterLoyaltyElement) {
      afterLoyaltyElement.innerText = "EGP 0";
    }
  }
}

// Loyalty
function afterLoyalty() {
  if (loyaltyPoints < requiredLoyaltyPoints) {
    alert(`Need ${requiredLoyaltyPoints} points (you have ${loyaltyPoints}).`);
    return;
  }

  let currentPrice;
  if (isPromoApplied) {
    const afterPromoElement = document.getElementById("afterPromo");
    if (afterPromoElement) {
      currentPrice = parseFloat(afterPromoElement.textContent.replace("EGP ", ""));
    } else {
      currentPrice = basePriceAfterOffer;
    }
  } else {
    currentPrice = basePriceAfterOffer;
  }

  const discounted = currentPrice * 0.9;
  
  const afterLoyaltyElement = document.getElementById("afterLoyalty");
  if (afterLoyaltyElement) {
    afterLoyaltyElement.innerText = `EGP ${discounted.toFixed(2)}`;
  }
  
  isLoyaltyApplied = true;
  alert("10% loyalty discount applied!");
}

// Final price
function getCurrentPrice() {
  let elementId;
  
  if (isLoyaltyApplied) {
    elementId = "afterLoyalty";
  } else if (isPromoApplied) {
    elementId = "afterPromo";
  } else {
    elementId = "afterOffer";
  }
  
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`${elementId} element not found`);
    return 0;
  }
  
  return parseFloat(element.textContent.replace("EGP ", ""));
}

// Confirm order
async function confirmOrder() {
  console.log("Confirm order function called");
  
  if (items.length === 0) {
    alert("Your cart is empty. Please add items first.");
    return;
  }

  const addressElement = document.getElementById("address");
  if (!addressElement) {
    console.error("Address input not found");
    alert("Form error: Address field not found");
    return;
  }
  
  const address = addressElement.value.trim();
  if (!address) {
    alert("Please enter your address.");
    return;
  }

  try {
    // Get current authenticated user
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      console.error("User not authenticated");
      alert("Please log in to complete your order.");
      window.location.href = "login2.html";
      return;
    }

    console.log("Creating order for user:", user.uid);
    
    const orderData = {
      userId: user.uid,
      items: JSON.parse(JSON.stringify(items)), // Create a deep copy
      restaurantId: sessionStorage.getItem("restaurantId") || null,
      totalAmount: getItemsTotal(),
      finalPrice: getCurrentPrice(),
      address,
      promoCode: isPromoApplied ? document.getElementById("promoCode").value.trim().toUpperCase() : null,
      loyaltyPointsUsed: isLoyaltyApplied ? requiredLoyaltyPoints : 0,
      fromOffer: sessionStorage.getItem("fromOffer") === "true",
      status: "pending",
      timestamp: serverTimestamp(),
      userEmail: user.email || null
    };

    console.log("Order data prepared:", orderData);
    
    // Save order to Firestore
    const ordersCollection = collection(db, "orders");
    console.log("Adding document to collection:", ordersCollection);
    
    const orderRef = await addDoc(ordersCollection, orderData);
    console.log("Order created with ID:", orderRef.id);

    // Update loyalty points - ALWAYS add 100 points after successful order
    try {
      const userRef = doc(db, "users", user.uid);
      console.log("Updating user document:", userRef);
      
      // Get current points
      const docSnap = await getDoc(userRef);
      let currentPoints = 0;
      
      if (docSnap.exists()) {
        currentPoints = docSnap.data().LoyalityPoints || 0;
        console.log("Current points before update:", currentPoints);
      }

      // Deduct points if loyalty discount was used
      if (isLoyaltyApplied) {
        currentPoints -= requiredLoyaltyPoints;
        console.log(`Deducted ${requiredLoyaltyPoints} points for discount`);
      }
      
      // ALWAYS add 100 points for completing order
      currentPoints += 100;
      console.log("Added 100 loyalty points for order completion");
      console.log("New points balance:", currentPoints);

      // Update Firestore
      await updateDoc(userRef, { 
        LoyalityPoints: currentPoints 
      });

      // Update local state
      loyaltyPoints = currentPoints;
      updateLoyaltyButton();
      
      // Show success message with points info
      alert(`Order placed Successfully!
Thank you for your order. One of our team members will
contact you shortly to confirm it.
You will also be able to track your order using your order number.`);
    } catch (error) {
      console.error("Error updating loyalty points:", error);
      // Continue with order even if points update fails
      alert("Order placed successfully! (Loyalty points update failed)");
    }

    // Clear cart and redirect
    sessionStorage.removeItem("selectedItems");
    sessionStorage.removeItem("restaurantOffer");
    sessionStorage.removeItem("promoCode");
    sessionStorage.removeItem("fromOffer");
    window.location.href = "foodies-html.html";
  } catch (err) {
    console.error("Order failed with detailed error:", err);
    
    if (err.code === "permission-denied") {
      alert("Order failed: You don't have permission to perform this action. Please login again.");
      window.location.href = "login2.html";
    } else if (err.code) {
      alert(`Order failed: ${err.code}. Please try again.`);
    } else {
      alert("Order failed. Please try again.");
    }
  }
}

// Cancel
function cancelOrder() {
  sessionStorage.removeItem("selectedItems");
  sessionStorage.removeItem("promoCode");
  sessionStorage.removeItem("fromOffer");
  window.location.href = "foodies-html.html";
}


// Update loyalty display
function updateLoyaltyButton() {
  const btn = document.getElementById("loyaltyBtn");
  const input = document.getElementById("applyLoyaltyBtn");
  
  if (btn) {
    btn.textContent = `Loyalty: ${loyaltyPoints} pts`;
  }
  
  if (input) {
    if (loyaltyPoints >= requiredLoyaltyPoints) {
      input.value = `Use ${requiredLoyaltyPoints} pts for 10% off`;
    } else {
      input.value = `Need ${requiredLoyaltyPoints - loyaltyPoints} more pts`;
    }
  }
}
