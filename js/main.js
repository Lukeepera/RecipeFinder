
const authModal = document.getElementById('authModal');
const recipeModal = document.getElementById('recipeDetailModal');
const searchBar = document.querySelector('.search-bar');
const recipesGrid = document.getElementById('recipesGrid');
const selectedIngredientsContainer = document.getElementById('selectedIngredients');
const categorySelect = document.getElementById('categorySelect');
const closeModalBtn = document.getElementById('closeModal');
const closeRecipeModalBtn = document.getElementById('closeRecipeModal');
const authButton = document.getElementById('authButton');


let currentPage = 1;
const mealsPerPage = 9;
let meals = [];
const selectedIngredients = new Set();


document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    setupAuthListeners();
    setupRecipeListeners();
    fetchMeals();
});


closeModalBtn.addEventListener('click', () => {
    authModal.classList.add('hidden');
});


closeRecipeModalBtn.addEventListener('click', () => {
    recipeDetailModal.classList.add('hidden');
});


authButton.addEventListener('click', () => {
    authModal.classList.remove('hidden');
});


authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
        authModal.classList.add('hidden');
    }
});


recipeDetailModal.addEventListener('click', (e) => {
    if (e.target === recipeDetailModal) {
        recipeDetailModal.classList.add('hidden');
    }
});


searchBar.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        const ingredient = e.target.value.trim().toLowerCase();
        selectedIngredients.add(ingredient);
        renderSelectedIngredients();
        searchBar.value = '';
        currentPage = 1;
        fetchMeals();
    }
});


function renderSelectedIngredients() {
    selectedIngredientsContainer.innerHTML = Array.from(selectedIngredients)
        .map(ingredient => `
            <div class="ingredient-tag">
                ${ingredient} 
                <button class="remove-ingredient" onclick="removeIngredient('${ingredient}')">×</button>
            </div>
        `).join('');
}


function removeIngredient(ingredient) {
    selectedIngredients.delete(ingredient);
    renderSelectedIngredients();
    currentPage = 1;
    fetchMeals();
}


function setupAuthListeners() {
    const authButton = document.getElementById('authButton');
    const authForm = document.getElementById('authForm');
    const closeModalBtn = document.getElementById('closeModal');
    const switchModeBtn = document.getElementById('switchAuthMode');
    let isLogin = true;

    authButton.addEventListener('click', () => authModal.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => authModal.classList.add('hidden'));

    switchModeBtn.addEventListener('click', () => {
        isLogin = !isLogin;
        document.querySelector('.username-group').classList.toggle('hidden');
        document.getElementById('authTitle').textContent = isLogin ? 'Sign In' : 'Register';
        switchModeBtn.textContent = isLogin ? 'Need an account? Register' : 'Already registered? Sign in';
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const username = document.getElementById('username').value;

        try {
            if (isLogin) {
                await auth.signInWithEmailAndPassword(email, password);
            } else {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                await userCredential.user.updateProfile({ displayName: username });
            }
            authModal.classList.add('hidden');
            authForm.reset();
        } catch (error) {
            showError(error.message);
        }
    });

    auth.onAuthStateChanged(user => {
        const authButton = document.getElementById('authButton');
        const authContainer = document.getElementById('auth-container');
        const authModal = document.getElementById('authModal');

        if (user) {
            authButton.textContent = 'Sign Out';
            let userNameDisplay = document.querySelector('.user-name');
            if (!userNameDisplay) {
                userNameDisplay = document.createElement('span');
                userNameDisplay.className = 'user-name';
                authContainer.insertBefore(userNameDisplay, authButton);
            }
            userNameDisplay.textContent = user.displayName;

            authButton.onclick = () => {
                auth.signOut();
                authModal.classList.add('hidden');
            };
        } else {
            authButton.textContent = 'Sign In';
            const userNameDisplay = document.querySelector('.user-name');
            if (userNameDisplay) {
                userNameDisplay.remove();
            }

            authButton.onclick = () => {
                authModal.classList.remove('hidden');
            };
        }
    });
}


function setupRecipeListeners() {
    searchBar.addEventListener('keypress', handleSearchKeyPress);
    categorySelect.addEventListener('change', handleCategoryChange);
    document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(1));
}


async function loadCategories() {
    try {
        const response = await fetch('https://www.themealdb.com/api/json/v1/1/categories.php');
        const data = await response.json();
        categorySelect.innerHTML = '<option value="">All Categories</option>' +
            data.categories.map(category => 
                `<option value="${category.strCategory}">${category.strCategory}</option>`
            ).join('');
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}


async function fetchMeals() {
    try {
        let finalMeals = [];
        if (selectedIngredients.size > 0) {
            const promises = Array.from(selectedIngredients).map(ingredient =>
                fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${ingredient}`)
                    .then(res => res.json())
            );
            const results = await Promise.all(promises);
            const commonMealIds = findCommonMeals(results);
            finalMeals = await Promise.all(
                commonMealIds.map(id =>
                    fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`)
                        .then(res => res.json())
                        .then(data => data.meals[0])
                )
            );
        } else {
            const response = await fetch('https://www.themealdb.com/api/json/v1/1/search.php?s=');
            const data = await response.json();
            finalMeals = data.meals || [];
        }

        const category = categorySelect.value;
        if (category) {
            finalMeals = finalMeals.filter(meal => meal.strCategory === category);
        }

        meals = finalMeals;
        renderMeals();
        updatePagination();
    } catch (error) {
        console.error('Error fetching meals:', error);
    }
}


function renderMeals() {
    const startIndex = (currentPage - 1) * mealsPerPage;
    const endIndex = startIndex + mealsPerPage;
    const currentMeals = meals.slice(startIndex, endIndex);

    recipesGrid.innerHTML = currentMeals.length > 0 
        ? currentMeals.map(createMealCard).join('')
        : '<div class="no-recipes"><h2>No Recipes Found</h2><p>Try different ingredients or clear your search filters</p></div>';

    document.querySelectorAll('.recipe-card').forEach(card => {
        card.addEventListener('click', () => {
            const mealId = card.dataset.mealId;
            const meal = meals.find(m => m.idMeal === mealId);
            showRecipeModal(meal);
        });
    });
}


function createMealCard(meal) {
    return `
        <div class="recipe-card" data-meal-id="${meal.idMeal}">
            <div class="recipe-image">
                <img src="${meal.strMealThumb}" alt="${meal.strMeal}">
            </div>
            <div class="recipe-content">
                <h2 class="recipe-title">${meal.strMeal}</h2>
                <div class="recipe-category">${meal.strCategory}</div>
            </div>
        </div>
    `;
}


function showRecipeModal(meal) {
    document.getElementById('modalRecipeImage').src = meal.strMealThumb;
    document.getElementById('modalRecipeTitle').textContent = meal.strMeal;
    document.getElementById('modalRecipeCategory').textContent = meal.strCategory;
    document.getElementById('modalInstructions').textContent = meal.strInstructions;
    document.getElementById('modalIngredientsList').innerHTML = getIngredientsList(meal);

    recipeModal.classList.remove('hidden');
    document.getElementById('closeRecipeModal').onclick = () => {
        recipeModal.classList.add('hidden');
    };
}


function handleSearchKeyPress(e) {
    if (e.key === 'Enter' && e.target.value.trim()) {
        selectedIngredients.add(e.target.value.trim().toLowerCase());
        renderSelectedIngredients();
        e.target.value = '';
        currentPage = 1;
        fetchMeals();
    }
}


function handleCategoryChange() {
    currentPage = 1;
    fetchMeals();
}


function changePage(delta) {
    const newPage = currentPage + delta;
    const totalPages = Math.ceil(meals.length / mealsPerPage);

    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderMeals();
        updatePagination();
    }
}


function findCommonMeals(results) {
    return results.reduce((acc, curr) => {
        const mealIds = curr.meals?.map(meal => meal.idMeal) || [];
        if (acc.length === 0) return mealIds;
        return acc.filter(id => mealIds.includes(id));
    }, []);
}


function getIngredientsList(meal) {
    let ingredients = '';
    for (let i = 1; i <= 20; i++) {
        const ingredient = meal[`strIngredient${i}`];
        const measure = meal[`strMeasure${i}`];
        if (ingredient && measure) {
            ingredients += `<li>${measure} ${ingredient}</li>`;
        }
    }
    return ingredients;
}


function updatePagination() {
    const totalPages = Math.ceil(meals.length / mealsPerPage);
    document.getElementById('pageInfo').textContent = `${currentPage} of ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}


function showError(message) {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(el => el.textContent = message);
}



document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('cookieBanner');
    const acceptBtn = document.getElementById('acceptCookies');
    const declineBtn = document.getElementById('declineCookies');

    if (!getCookie('cookieConsent')) {
        banner.style.display = 'flex';
    }

    acceptBtn.addEventListener('click', () => {
        setCookie('cookieConsent', 'accepted', 30);
        banner.style.display = 'none';
    });

    declineBtn.addEventListener('click', () => {
        setCookie('cookieConsent', 'declined', 30);
        banner.style.display = 'none';
    });
});


function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days*24*60*60*1000));
    const expires = "expires=" + d.toUTCString();
    document.cookie = `${name}=${value};${expires};path=/`;
}

function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [cName, cValue] = cookie.trim().split('=');
        if (cName === name) return cValue;
    }
    return null;
}
