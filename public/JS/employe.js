// ==================================================================
// Fichier: public/JS/employe.js
// Description: Gère l'affichage et les actions de l'Espace Employé
//              (Validation avis, Visualisation trajets problématiques).
// ==================================================================

// --- Fonctions Utilitaires ---

function escapeHtml(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// *** AJOUTÉ : Fonction pour formater les dates/heures ***
function formatDateTime(dateTimeString) {
    if (!dateTimeString) return 'N/A';
    try {
        const date = new Date(dateTimeString);
        if (isNaN(date.getTime())) { return 'Date invalide'; }
        const optionsDate = { year: 'numeric', month: '2-digit', day: '2-digit' };
        const optionsTime = { hour: '2-digit', minute: '2-digit', hour12: false };
        return `${date.toLocaleDateString('fr-FR', optionsDate)} ${date.toLocaleTimeString('fr-FR', optionsTime)}`;
    } catch (e) {
        console.error("Erreur formatage date:", dateTimeString, e);
        return 'Erreur date';
    }
}

function renderStars(note) { // Fonction que tu avais déjà
    const noteNum = parseInt(note, 10);
    if (isNaN(noteNum) || noteNum < 1 || noteNum > 5) return 'N/A';
    let stars = '';
    for (let i = 0; i < 5; i++) {
        stars += (i < noteNum) ? '★' : '☆';
    }
    return `<span style="color: orange;">${stars}</span>`;
}

// --- Fonctions liées aux Avis en Attente ---

// Fonction pour afficher la liste des avis en attente (ton code existant)
function displayPendingReviews(reviews) {
    const listDiv = document.getElementById('pending-reviews-list');
    if (!listDiv) return; // Sécurité
    listDiv.innerHTML = '';

    if (!reviews || reviews.length === 0) {
        listDiv.innerHTML = '<p class="text-center text-muted">Aucun avis en attente de validation.</p>';
        return;
    }

    const reviewsHtml = reviews.map(review => {
        let dateSoumissionFormatee = 'N/A';
        try { dateSoumissionFormatee = new Date(review.date_soumission).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short'}); } catch(e) {}
        let dateTrajetFormatee = 'N/A';
         try { dateTrajetFormatee = new Date(review.covoiturage_date_depart).toLocaleDateString('fr-FR', { dateStyle: 'short'}); } catch(e) {}

        const cardId = `review-card-${review.avis_id}`;

        return `
            <div class="card mb-3 shadow-sm review-card" id="${cardId}">
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-9">
                            <h5 class="card-title">Avis ID: ${review.avis_id} - Note: ${renderStars(review.note)} (${review.note}/5)</h5>
                            <p class="card-text"><strong>Commentaire :</strong><br>${escapeHtml(review.commentaire) || '<i>Aucun commentaire</i>'}</p>
                            <hr>
                            <p class="card-text mb-0"><small class="text-muted">Soumis par: ${escapeHtml(review.passager_pseudo || '?')} (ID: ${review.passager_id || '?'})</small></p>
                            <p class="card-text mb-0"><small class="text-muted">Concernant le chauffeur: ${escapeHtml(review.chauffeur_pseudo || '?')} (ID: ${review.chauffeur_id || '?'})</small></p>
                            <p class="card-text mb-0"><small class="text-muted">Pour le trajet: ${escapeHtml(review.covoiturage_depart || '?')} ➜ ${escapeHtml(review.covoiturage_arrivee || '?')} du ${dateTrajetFormatee}</small></p>
                            <p class="card-text"><small class="text-muted">Date soumission avis: ${dateSoumissionFormatee}</small></p>
                        </div>
                        <div class="col-md-3 text-md-end d-flex flex-column justify-content-center action-buttons">
                            <button class="btn btn-success btn-sm mb-2 btn-approve-review" data-avis-id="${review.avis_id}">
                                <i class="bi bi-check-lg"></i> Approuver
                            </button>
                            <button class="btn btn-danger btn-sm btn-reject-review" data-avis-id="${review.avis_id}">
                                <i class="bi bi-x-lg"></i> Rejeter
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    listDiv.innerHTML = reviewsHtml;
}

// Gestionnaire de clic pour les boutons Approuver/Rejeter (ton code existant)
function handleValidationClick(event) {
    const button = event.target.closest('button');
    if (!button) return;

    const avisId = button.dataset.avisId;
    if (!avisId) return;

    let newStatus = null;

    if (button.classList.contains('btn-approve-review')) {
         console.log(`Clic sur Approuver pour Avis ID: ${avisId}`);
         newStatus = 'approved';
    } else if (button.classList.contains('btn-reject-review')) {
         console.log(`Clic sur Rejeter pour Avis ID: ${avisId}`);
         newStatus = 'rejected';
    }

    if (newStatus) {
         if (confirm(`Êtes-vous sûr de vouloir ${newStatus === 'approved' ? 'approuver' : 'rejeter'} cet avis (ID: ${avisId}) ?`)) {
             updateReviewStatus(avisId, newStatus, button);
         } else {
             console.log("Action annulée par l'employé.");
         }
    }
}

// Fonction pour appeler l'API de MAJ Statut Avis (ton code existant)
async function updateReviewStatus(avisId, newStatus, buttonElement) {
    const messageArea = document.getElementById('employee-message-area');
    if(messageArea) messageArea.innerHTML = '';

    const buttonContainer = buttonElement.closest('.action-buttons');
    const buttonsToDisable = buttonContainer ? buttonContainer.querySelectorAll('button') : [buttonElement];
    buttonsToDisable.forEach(btn => btn.disabled = true);
    buttonElement.textContent = 'Traitement...';

    try {
        const response = await fetch(`/api/avis/${avisId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newStatus: newStatus })
        });

        const responseData = await response.json().catch(() => ({}));

        if (response.ok) {
            console.log(`Avis ID ${avisId} statut mis à jour à ${newStatus}`);
            showMessage(messageArea, responseData.message || `Avis ${newStatus === 'approved' ? 'approuvé' : 'rejeté'} !`, 'success');

            const cardToRemove = document.getElementById(`review-card-${avisId}`);
            if (cardToRemove) {
                 cardToRemove.remove();
                 const listDiv = document.getElementById('pending-reviews-list');
                 if(listDiv && listDiv.children.length === 0) {
                     listDiv.innerHTML = '<p class="text-center text-muted">Aucun avis en attente de validation.</p>';
                 }
            } else {
                 console.warn(`Impossible de trouver la carte review-card-${avisId} à supprimer.`);
            }

        } else {
            console.error("Erreur API MAJ statut avis:", responseData);
            showMessage(messageArea, `Échec MAJ: ${responseData.message || `Erreur ${response.status}`}`, 'danger');
            buttonsToDisable.forEach(btn => btn.disabled = false);
             buttonElement.textContent = newStatus === 'approved' ? 'Approuver' : 'Rejeter';
        }

    } catch (error) {
        console.error("Erreur réseau MAJ statut avis:", error);
        showMessage(messageArea, "Erreur réseau lors de la mise à jour.", 'danger');
        buttonsToDisable.forEach(btn => btn.disabled = false);
        buttonElement.textContent = newStatus === 'approved' ? 'Approuver' : 'Rejeter';
    }
}


// --- Fonction pour afficher les messages (ton code existant) ---
function showMessage(areaElement, message, type = 'info') {
     if (!areaElement) return;
     areaElement.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
                                ${escapeHtml(message)}
                                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                              </div>`;
}

// --- *** NOUVEAU : Fonction pour charger les trajets problématiques *** ---
/**
 * Charge et affiche la liste des participations signalées comme problématiques.
 */
async function loadProblematicTrips() {
    console.log("employe.js: Chargement des trajets problématiques...");
    const targetDiv = document.getElementById('problematic-trips-list');
    if (!targetDiv) {
        console.error("employe.js: Div 'problematic-trips-list' non trouvé !");
        return;
    }
    targetDiv.innerHTML = '<p class="text-muted">Chargement des trajets signalés...</p>';

    try {
        const response = await fetch('/api/participations/problematiques'); // Appel de la nouvelle API

        if (!response.ok) {
             const errorData = await response.json().catch(() => ({ message: `Erreur ${response.status} ${response.statusText}` }));
             throw new Error(errorData.message || `Erreur ${response.status}`);
        }

        const problematicParticipations = await response.json();
        console.log("employe.js: Participations problématiques reçues:", problematicParticipations);

        targetDiv.innerHTML = ''; // Vider la zone

        if (!problematicParticipations || problematicParticipations.length === 0) {
            targetDiv.innerHTML = '<p class="text-success">Aucun trajet problématique signalé pour le moment.</p>';
            return;
        }

        let htmlContent = '';
        problematicParticipations.forEach(p => {
            htmlContent += `
                <div class="card mb-3">
                    <div class="card-header">
                        Trajet ID: ${escapeHtml(p.covoiturage_id)} (${escapeHtml(p.depart)} → ${escapeHtml(p.arrivee)})
                        <small class="text-muted float-end">Signalé le: ${formatDateTime(p.date_signalement) || 'N/A'}</small>
                    </div>
                    <div class="card-body">
                        <p class="card-text"><strong>Commentaire du passager :</strong> <em>${escapeHtml(p.probleme_commentaire) || 'Aucun commentaire'}</em></p>
                        <hr>
                        <div class="row">
                            <div class="col-md-6">
                                <p class="mb-1"><strong>Passager :</strong> ${escapeHtml(p.passager_pseudo)} (ID: ${escapeHtml(p.passager_id)})</p>
                                <p class="mb-1"><small><strong>Email Passager :</strong> ${escapeHtml(p.passager_email) || 'Non fourni'}</small></p>
                            </div>
                            <div class="col-md-6">
                                <p class="mb-1"><strong>Chauffeur :</strong> ${escapeHtml(p.chauffeur_pseudo)} (ID: ${escapeHtml(p.chauffeur_id)})</p>
                                <p class="mb-1"><small><strong>Email Chauffeur :</strong> ${escapeHtml(p.chauffeur_email) || 'Non fourni'}</small></p>
                            </div>
                        </div>
                        <hr>
                        <p class="card-text"><small class="text-muted">Détails trajet: Départ le ${formatDateTime(p.date_depart)}, Arrivée le ${formatDateTime(p.date_arrivee)}</small></p>
                        <p class="card-text"><small class="text-muted">ID Participation: ${escapeHtml(p.participation_id)}</small></p>
                        </div>
                </div>
            `;
        });
        targetDiv.innerHTML = htmlContent; // Injecter le HTML

    } catch (error) {
        console.error("employe.js: Erreur lors du chargement des trajets problématiques:", error);
        targetDiv.innerHTML = `<p class="text-danger">Impossible de charger les trajets signalés : ${escapeHtml(error.message)}</p>`;
    }
}


// --- Appel Initial ---
// S'exécute quand le DOM est prêt
document.addEventListener('DOMContentLoaded', async () => {
    console.log("employe.js: DOM chargé (avec validation + trajets problématiques).");

    const pendingListDiv = document.getElementById('pending-reviews-list');
    const messageArea = document.getElementById('employee-message-area');
    const problematicTripsListDiv = document.getElementById('problematic-trips-list'); // Récupérer aussi ce div

    // Vérifier si les éléments principaux existent
    if (!pendingListDiv || !messageArea || !problematicTripsListDiv) {
        console.error("Erreur: Éléments HTML #pending-reviews-list, #employee-message-area ou #problematic-trips-list manquants.");
        // Afficher une erreur globale si possible
        document.body.innerHTML = '<p class="text-danger text-center mt-5">Erreur critique: La structure HTML de la page employé est incorrecte.</p>';
        return;
    }

    // Initialiser les zones
    messageArea.innerHTML = '';
    pendingListDiv.innerHTML = '<p class="text-center text-muted">Chargement des avis...</p>';
    problematicTripsListDiv.innerHTML = '<p class="text-center text-muted">Chargement des trajets signalés...</p>';

    try {
        // 1. Vérifier le statut de session et le rôle employé (ton code existant)
        console.log("employe.js: Vérification session/rôle...");
        const sessionResponse = await fetch('/api/session/status');
        if (!sessionResponse.ok) { throw new Error("Erreur de vérification de session."); }
        const sessionData = await sessionResponse.json();

        if (!sessionData.isLoggedIn || sessionData.role !== 'employe') {
             console.warn("Accès refusé à l'espace employé. Rôle:", sessionData.role);
             showMessage(messageArea, "Accès refusé. Vous devez être connecté en tant qu'employé.", 'danger');
             pendingListDiv.innerHTML = '';
             problematicTripsListDiv.innerHTML = ''; // Vider aussi cette zone
             return;
        }
        console.log("employe.js: Employé connecté:", sessionData.pseudo);

        // 2. Charger les avis en attente (ton code existant)
        console.log("employe.js: Récupération des avis en attente...");
        const avisResponse = await fetch('/api/avis?statut=pending');
        if (!avisResponse.ok) {
            const errorData = await avisResponse.json().catch(() => ({}));
            throw new Error(errorData.message || `Erreur ${avisResponse.status} lors de la récupération des avis.`);
        }
        const pendingReviews = await avisResponse.json();
        console.log("employe.js: Avis en attente reçus:", pendingReviews);
        displayPendingReviews(pendingReviews); // Afficher les avis

        // Ajouter l'écouteur pour les boutons Approuver/Rejeter
        pendingListDiv.addEventListener('click', handleValidationClick);
        console.log("employe.js: Écouteur d'actions de validation ajouté.");

        // 3. *** AJOUTÉ : Charger les trajets problématiques ***
        await loadProblematicTrips(); // Appeler la nouvelle fonction

    } catch (error) {
        // Gérer les erreurs globales (session, fetch avis, etc.)
        console.error("employe.js: Erreur sur la page employé:", error);
        showMessage(messageArea, `Erreur: ${error.message}`, 'danger');
        // Mettre un message d'erreur dans les deux zones si le chargement initial échoue
        pendingListDiv.innerHTML = '<p class="text-danger text-center">Impossible de charger les avis.</p>';
        problematicTripsListDiv.innerHTML = '<p class="text-danger text-center">Impossible de charger les trajets signalés.</p>';
    }

}); // --- Fin DOMContentLoaded ---