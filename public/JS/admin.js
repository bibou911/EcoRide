// ==================================================================
// Fichier: public/JS/admin.js
// Description: Gère l'Espace Administrateur
//              (Vérif accès, Création employé, Liste utilisateurs, Suspension/Réactivation, Total Crédits, Graphiques).
// ==================================================================

// --- Fonctions Utilitaires ---

function escapeHtml(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return String(unsafe).replace(/[&<>"']/g, match => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[match]));
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return 'N/A';
    try {
        const date = new Date(dateTimeString);
        if (isNaN(date.getTime())) { return 'Date invalide'; }
        const optionsDate = { year: 'numeric', month: '2-digit', day: '2-digit' };
        const optionsTime = { hour: '2-digit', minute: '2-digit', hour12: false };
        if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0) {
             return date.toLocaleDateString('fr-FR', optionsDate);
        }
        return `${date.toLocaleDateString('fr-FR', optionsDate)} ${date.toLocaleTimeString('fr-FR', optionsTime)}`;
    } catch (e) {
        console.error("Erreur formatage date:", dateTimeString, e);
        return 'Erreur date';
    }
}

// --- Fonction pour charger et afficher la liste des utilisateurs ---
async function loadUserList() {
    console.log("admin.js: Chargement de la liste des utilisateurs...");
    const tableBody = document.getElementById('user-list-body');
    const errorMessageDiv = document.getElementById('user-list-error-message');

    if (!tableBody) { /* ... gestion erreur ... */ return; }
    if (!errorMessageDiv) { console.warn("admin.js: Zone de message #user-list-error-message non trouvée."); }

    if(errorMessageDiv) errorMessageDiv.innerHTML = '';
    tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Chargement...</td></tr>';

    try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) { /* ... gestion erreur fetch ... */ throw new Error(/*...*/); }
        const users = await response.json();
        console.log("admin.js: Utilisateurs reçus:", users);
        tableBody.innerHTML = '';

        if (!users || users.length === 0) { /* ... afficher Aucun utilisateur ... */ return; }

        users.forEach(user => {
             // ... (code existant pour créer et remplir la ligne du tableau) ...
             const dateInscriptionFormatee = formatDateTime(user.date_inscription);
             const row = document.createElement('tr');
             if (user.statut === 'suspendu') row.classList.add('table-danger');
             row.innerHTML = `
                 <td>${escapeHtml(user.id)}</td>
                 <td>${escapeHtml(user.pseudo)}</td>
                 <td>${escapeHtml(user.email)}</td>
                 <td>${escapeHtml(user.role)}</td>
                 <td>${escapeHtml(user.statut || 'actif')}</td>
                 <td>${escapeHtml(dateInscriptionFormatee)}</td>
                 <td>${escapeHtml(user.credits)}</td>
                 <td id="actions-user-${user.id}">
                     ${user.statut !== 'suspendu'
                         ? `<button class="btn btn-warning btn-sm btn-suspend" data-user-id="${user.id}" ${user.role === 'admin' ? 'disabled title="Impossible de suspendre un admin"' : ''}>Suspendre</button>`
                         : `<button class="btn btn-success btn-sm btn-reactivate" data-user-id="${user.id}">Réactiver</button>`
                     }
                 </td>
             `;
             tableBody.appendChild(row);
        });

    } catch (error) { /* ... gestion erreur loadUserList ... */ }
}

// --- Fonction pour appeler l'API MAJ Statut et mettre à jour l'interface ---
async function updateUserStatus(userId, newStatus, buttonElement) {
    // ... (code existant de la fonction updateUserStatus) ...
    console.log(`admin.js: Tentative de MAJ statut pour User ID: ${userId} vers: ${newStatus}`);
    const messageArea = document.getElementById('user-list-error-message');
    if (messageArea) messageArea.innerHTML = '';
    buttonElement.disabled = true; buttonElement.textContent = '...';
    try {
        const response = await fetch(`/api/admin/users/${userId}/status`, { /* ... options PATCH ... */ });
        const responseData = await response.json().catch(() => ({}));
        if (response.ok) {
            if (messageArea) showMessage(messageArea, responseData.message || `Statut mis à jour à '${newStatus}'.`, 'success');
            const row = buttonElement.closest('tr');
            if (row) { /* ... code pour MAJ row (statusCell, actionCell, class) ... */ }
            else { loadUserList(); }
        } else { /* ... gestion erreur API ... */ }
    } catch (error) { /* ... gestion erreur réseau ... */ }
    // ... (gestion réactivation bouton en cas d'erreur) ...
}

// --- Gestionnaire de clic pour les boutons Suspendre/Réactiver ---
function handleStatusChangeClick(event) {
    // ... (code existant de la fonction handleStatusChangeClick) ...
    const button = event.target.closest('button.btn-suspend, button.btn-reactivate');
    if (!button || button.disabled) return;
    const userId = button.dataset.userId; if (!userId) return;
    let newStatus, actionText;
    if (button.classList.contains('btn-suspend')) { /* ... */ newStatus = 'suspendu'; actionText = 'suspendre'; }
    else if (button.classList.contains('btn-reactivate')) { /* ... */ newStatus = 'actif'; actionText = 'réactiver'; }
    else { return; }
    if (confirm(`Êtes-vous sûr de vouloir ${actionText} l'utilisateur ID ${userId} ?`)) { updateUserStatus(userId, newStatus, button); }
}

// --- Fonction pour afficher les messages ---
function showMessage(areaElement, message, type = 'info') {
     // ... (code existant de la fonction showMessage) ...
     if (!areaElement) { console.warn("Zone de message introuvable pour:", message); return; }
     const alertId = `alert-${Date.now()}`;
     areaElement.innerHTML = `<div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">...</div>`;
}

// --- Fonction pour charger et afficher le total des crédits gagnés ---
async function loadTotalCredits() {
    // ... (code existant de la fonction loadTotalCredits) ...
    console.log("admin.js: Chargement du total des crédits gagnés...");
    const targetElement = document.getElementById('total-credits-gagnes');
    if (!targetElement) { /* ... */ return; }
    targetElement.textContent = 'Chargement...';
    try {
        const response = await fetch('/api/admin/stats/credits-total');
        if (!response.ok) { /* ... gestion erreur fetch ... */ throw new Error(/*...*/); }
        const data = await response.json();
        if (typeof data.totalCreditsGagnes !== 'undefined') { targetElement.textContent = data.totalCreditsGagnes; }
        else { /* ... gestion erreur données ... */ }
    } catch (error) { /* ... gestion erreur loadTotalCredits ... */ }
}


// --- *** AJOUTÉ : Fonctions pour charger et afficher les graphiques *** ---

/**
 * Charge les données et affiche le graphique des covoiturages par jour.
 */
async function loadAndRenderCovoituragesChart() {
    console.log("admin.js: Chargement données pour graphique Covoiturages/Jour...");
    const ctx = document.getElementById('covoituragesChart')?.getContext('2d');
    const errorDiv = document.getElementById('covoituragesChartError');
    if (!ctx) { console.error("Élément canvas #covoituragesChart non trouvé."); return; }
    if(errorDiv) errorDiv.textContent = '';

    try {
        const response = await fetch('/api/admin/stats/covoiturages-par-jour');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Erreur ${response.status}`);
        }
        const data = await response.json();
        console.log("admin.js: Données Covoiturages/Jour reçues:", data);

        // Préparer les données pour Chart.js
        const labels = data.map(item => item.jour ? new Date(item.jour).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'}) : 'Date inconnue');
        const values = data.map(item => item.nombre_covoiturages || 0);

        // Créer le graphique
        new Chart(ctx, {
            type: 'bar', // Type de graphique
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nombre de Covoiturages',
                    data: values,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, // Axe Y commence à 0, pas de décimales
                responsive: true,
                plugins: { legend: { display: false }, title: { display: true, text: 'Covoiturages par Jour' } }
            }
        });

    } catch (error) {
        console.error("admin.js: Erreur chargement graphique covoiturages:", error);
         if(errorDiv) errorDiv.textContent = `Erreur: ${escapeHtml(error.message)}`;
    }
}

/**
 * Charge les données et affiche le graphique des crédits gagnés par jour.
 */
async function loadAndRenderCreditsChart() {
    console.log("admin.js: Chargement données pour graphique Crédits/Jour...");
    const ctx = document.getElementById('creditsChart')?.getContext('2d');
    const errorDiv = document.getElementById('creditsChartError');
    if (!ctx) { console.error("Élément canvas #creditsChart non trouvé."); return; }
    if(errorDiv) errorDiv.textContent = '';

    try {
        const response = await fetch('/api/admin/stats/credits-par-jour');
        if (!response.ok) {
             const errorData = await response.json().catch(() => ({}));
             throw new Error(errorData.message || `Erreur ${response.status}`);
         }
        const data = await response.json();
        console.log("admin.js: Données Crédits/Jour reçues:", data);

        // Préparer les données
        const labels = data.map(item => item.jour ? new Date(item.jour).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'}) : 'Date inconnue');
        const values = data.map(item => item.credits_gagnes || 0);

        // Créer le graphique
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Crédits Gagnés',
                    data: values,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
             options: {
                scales: { y: { beginAtZero: true } },
                responsive: true,
                 plugins: { legend: { display: false }, title: { display: true, text: 'Crédits Gagnés par Jour' } }
            }
        });

    } catch (error) {
        console.error("admin.js: Erreur chargement graphique crédits:", error);
         if(errorDiv) errorDiv.textContent = `Erreur: ${escapeHtml(error.message)}`;
    }
}

// --- *** Fin des fonctions ajoutées pour les graphiques *** ---


// --- Écouteur d'événement Principal ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("admin.js: DOM chargé pour la page admin.");

    // Récupération des éléments (garder celles dont on a besoin)
    const createEmployeeForm = document.getElementById('create-employee-form');
    const messageAreaCreate = document.getElementById('create-employee-message');
    const userListTableBody = document.getElementById('user-list-body');
    const userListErrorMessage = document.getElementById('user-list-error-message');
    const totalCreditsElement = document.getElementById('total-credits-gagnes');
    const covoituragesChartCanvas = document.getElementById('covoituragesChart'); // Pour vérifier existence
    const creditsChartCanvas = document.getElementById('creditsChart');       // Pour vérifier existence

    // --- Vérification Accès Admin ---
    try {
        console.log("admin.js: Vérification session/rôle admin...");
        const sessionResponse = await fetch('/api/session/status');
        if (!sessionResponse.ok) throw new Error("Erreur vérification session.");
        const sessionData = await sessionResponse.json();

        if (!sessionData.isLoggedIn || sessionData.role !== 'admin') {
            // ... (gestion accès refusé) ...
            console.warn("admin.js: Accès refusé. Rôle:", sessionData.role);
            document.body.innerHTML = '<div class="container mt-5"><p class="alert alert-danger">Accès interdit...</p>...</div>';
            return;
        }
        console.log("admin.js: Administrateur connecté:", sessionData.pseudo);

        // --- Initialisation des différentes parties si admin connecté ---

        // Init Formulaire Création Employé
        if (createEmployeeForm && messageAreaCreate) {
             createEmployeeForm.addEventListener('submit', async (event) => { /* ... code existant ... */ });
        } else { console.warn("admin.js: Formulaire/message création employé non trouvé."); }

        // Init Liste Utilisateurs
        if (userListTableBody) {
            await loadUserList(); // Charger liste
            userListTableBody.addEventListener('click', handleStatusChangeClick); // Attacher écouteur boutons
            console.log("admin.js: Écouteur actions liste utilisateurs ajouté.");
        } else { console.warn("admin.js: Zone liste utilisateurs (user-list-body) non trouvée."); }

        // Init Total Crédits
        if (totalCreditsElement) {
             loadTotalCredits();
        } else { console.warn("admin.js: Zone total crédits (total-credits-gagnes) non trouvée."); }

        // *** AJOUTÉ : Init Graphiques ***
        if (covoituragesChartCanvas) {
            loadAndRenderCovoituragesChart();
        } else { console.warn("admin.js: Zone graphique covoiturages (covoituragesChart) non trouvée."); }

        if (creditsChartCanvas) {
            loadAndRenderCreditsChart();
        } else { console.warn("admin.js: Zone graphique crédits (creditsChart) non trouvée."); }


    } catch (error) { // Catch pour l'erreur initiale de vérif session
        console.error("admin.js: Erreur critique initialisation page admin:", error);
        document.body.innerHTML = '<div class="container mt-5"><p class="alert alert-danger">Impossible d\'initialiser la page administrateur...</p></div>';
        return;
    }

}); // --- Fin DOMContentLoaded ---