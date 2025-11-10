// Get references to DOM elements
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateButton = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const directionToggle = document.getElementById("directionToggle");
const loadingIndicator = document.getElementById("loadingIndicator");

// Track if a routine has been generated
let routineGenerated = false;

// Initialize state
let allProducts = [];
let selectedProducts = new Set();
let conversationHistory = [];

// Load selected products from localStorage
function loadSelectedProducts() {
  const saved = localStorage.getItem("selectedProducts");
  return saved ? new Set(JSON.parse(saved)) : new Set();
}

// Save selected products to localStorage
function saveSelectedProducts() {
  localStorage.setItem("selectedProducts", JSON.stringify([...selectedProducts]));
}

// Load product data from JSON file
async function loadProducts() {
  if (allProducts.length === 0) {
    const response = await fetch("products.json");
    const data = await response.json();
    allProducts = data.products;
  }
  return allProducts;
}

// Filter products based on category and search term
function filterProducts(products, category, searchTerm = "") {
  return products.filter(product => {
    const matchesCategory = !category || product.category === category;
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });
}

// Create HTML for displaying product cards
function displayProducts(products) {
  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found. Try adjusting your search or category filter.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map(product => `
      <div class="product-card ${selectedProducts.has(product.id) ? 'selected' : ''}"
           data-product-id="${product.id}">
        <img src="${product.image}" alt="${product.name}">
        <div class="product-info">
          <h3>${product.name}</h3>
          <p>${product.brand}</p>
        </div>
        <div class="product-description">
          <h4>About this product</h4>
          <p>${product.description}</p>
        </div>
      </div>
    `)
    .join("");

  // Add click handlers for product cards
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => toggleProductSelection(card));
  });
}

// Toggle product selection
function toggleProductSelection(card) {
  const productId = card.dataset.productId;
  if (selectedProducts.has(productId)) {
    selectedProducts.delete(productId);
    card.classList.remove('selected');
  } else {
    selectedProducts.add(productId);
    card.classList.add('selected');
  }
  
  // Get the product data
  const product = allProducts.find(p => p.id.toString() === productId);
  console.log('Toggled product:', product); // Debug log
  
  updateSelectedProductsList();
  saveSelectedProducts();
}

// Update the selected products list
function updateSelectedProductsList() {
  const selectedProductsArray = [...selectedProducts].map(id => 
    allProducts.find(p => p.id.toString() === id)
  ).filter(product => product !== null);

  if (selectedProductsArray.length === 0) {
    selectedProductsList.innerHTML = `
      <div class="placeholder-message">
        No products selected yet
      </div>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProductsArray
    .map(product => `
      <div class="selected-product-item">
        <span>${product.name}</span>
        <button class="remove-product" data-product-id="${product.id}">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
    `)
    .join("");

  // Add click handlers for remove buttons
  document.querySelectorAll('.remove-product').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const productId = button.dataset.productId;
      selectedProducts.delete(productId);
      updateSelectedProductsList();
      saveSelectedProducts();
      
      // Update product card selection state
      const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
      if (card) card.classList.remove('selected');
    });
  });
}

// Show/hide loading indicator helpers
function showLoading() {
  loadingIndicator.style.display = "flex";
  userInput.disabled = true;
}
function hideLoading() {
  loadingIndicator.style.display = "none";
  userInput.disabled = false;
}

// Add message to chat window
function addMessageToChat(message, isUser = false) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', isUser ? 'user-message' : 'ai-message');
  messageDiv.textContent = message;
  chatWindow.appendChild(messageDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Generate routine using OpenAI API
async function generateRoutine() {
  if (selectedProducts.size === 0) {
    addMessageToChat("Please select at least one product to generate a routine.");
    return;
  }
  showLoading();
  const selectedProductsData = [...selectedProducts].map(id => {
    const product = allProducts.find(p => p.id.toString() === id);
    if (!product) {
      console.error('Product not found:', id);
      return null;
    }
    return {
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description
    };
  }).filter(product => product !== null);
  try {
    const response = await fetch('https://loreal-worker.salbrecht-228.workers.dev/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You are a L'Oréal beauty advisor expert. Create a personalized routine based on the selected products."
          },
          {
            role: "user",
            content: `Create a personalized routine using these products: ${JSON.stringify(selectedProductsData)}`
          }
        ]
      })
    });
    const data = await response.json();
    if (data.choices && data.choices[0].message) {
      const routine = data.choices[0].message.content;
      addMessageToChat(routine);
      routineGenerated = true;
      conversationHistory = [
        { role: "system", content: "You are a L'Oréal beauty advisor expert. Only answer questions related to the previously generated routine, skincare, haircare, makeup, beauty products, or L'Oréal brands." },
        { role: "assistant", content: routine }
      ];
    }
  } catch (error) {
    console.error('Error:', error);
    addMessageToChat("Sorry, there was an error generating your routine. Please try again.");
  } finally {
    hideLoading();
  }
}

// Handle chat form submission
async function handleChat(userMessage) {
  if (!routineGenerated) {
    addMessageToChat("Please generate a routine first by selecting products and clicking the 'Generate Routine' button.");
    return;
  }
  addMessageToChat(userMessage, true);
  showLoading();
  try {
    const response = await fetch('https://loreal-worker.salbrecht-228.workers.dev/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You are a L'Oréal beauty advisor expert. Only answer questions related to the previously generated routine, skincare, haircare, makeup, beauty products, or L'Oréal brands. If the question is unrelated, politely explain that you can only discuss beauty-related topics and the current routine."
          },
          ...conversationHistory,
          { role: "user", content: userMessage }
        ]
      })
    });
    const data = await response.json();
    if (data.choices && data.choices[0].message) {
      const aiResponse = data.choices[0].message.content;
      addMessageToChat(aiResponse);
      conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: aiResponse }
      );
    }
  } catch (error) {
    console.error('Error:', error);
    addMessageToChat("Sorry, there was an error. Please try again.");
  } finally {
    hideLoading();
  }
}

// Event Listeners
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const filteredProducts = filterProducts(
    products, 
    e.target.value, 
    productSearch.value
  );
  displayProducts(filteredProducts);
});

productSearch.addEventListener("input", async (e) => {
  const products = await loadProducts();
  const filteredProducts = filterProducts(
    products,
    categoryFilter.value,
    e.target.value
  );
  displayProducts(filteredProducts);
});

generateButton.addEventListener("click", generateRoutine);

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = userInput.value.trim();
  if (message) {
    userInput.value = "";
    await handleChat(message);
  }
});

directionToggle.addEventListener("click", () => {
  const isRTL = document.documentElement.dir === "rtl";
  document.documentElement.dir = isRTL ? "ltr" : "rtl";
});

// Initialize
window.addEventListener("DOMContentLoaded", async () => {
  selectedProducts = loadSelectedProducts();
  const products = await loadProducts();
  updateSelectedProductsList();
  
  // Show initial placeholder
  productsContainer.innerHTML = `
    <div class="placeholder-message">
      Select a category or search for products
    </div>
  `;
});
