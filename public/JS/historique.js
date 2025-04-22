// public/JS/historique.js - VERSION COMPLETE FINALE (Affichage + Actions + Avis + Validation)

// Fonction utilitaire pour échapper le HTML (sécurité)
function escapeHtml(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return String(unsafe) // S'assurer que c'est une chaîne
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("historique.js chargé (avec Validation Participant).");

    // Récupérer les conteneurs et créer zone de message
    const participationsListDiv = document.getElementById('participations-list');
    const trajetsConduitsListDiv = document.getElementById('trajets-conduits-list');
    const trajetsConduitsSection = document.getElementById('trajets-conduits-section');
    const messageArea = document.createElement('div');
    messageArea.id = 'history-message-area';
    messageArea.className = 'mt-3';
    if (participationsListDiv) {
        participationsListDiv.parentNode.insertBefore(messageArea, participationsListDiv);
    }

     // Récupérer éléments modale avis
     const avisModalEl = document.getElementById('avisModal');
     const avisForm = document.getElementById('avis-form');
     let avisModalInstance = null;
     if (avisModalEl) { avisModalInstance = new bootstrap.Modal(avisModalEl); }

    // Vérifier éléments essentiels
    if (!participationsListDiv || !trajetsConduitsListDiv || !trajetsConduitsSection || !avisModalEl || !avisForm) {
        console.error("Erreur: Structure HTML manquante pour l'historique ou la modale d'avis.");
        if(document.body) document.body.innerHTML = '<div class="alert alert-danger m-5">Erreur: Page historique non chargée.</div>';
        return;
    }

    participationsListDiv.innerHTML = '<p>Chargement...</p>';
    trajetsConduitsListDiv.innerHTML = '<p>Chargement...</p>';
    trajetsConduitsSection.classList.add('d-none');

    try {
        // --- 1. Vérifier session & rôle ---
        const sessionResponse = await fetch('/api/session/status');
        if (!sessionResponse.ok) { throw new Error(`Erreur session: ${sessionResponse.status}`); }
        const sessionData = await sessionResponse.json();
        if (!sessionData.isLoggedIn) { /* ... redirection login ... */ return; }
        const userRole = sessionData.role;

        // --- 2. Charger historiques ---
        // L'API /participated DOIT renvoyer validation_passager maintenant
        const [participatedResponse, conductedResponse] = await Promise.all([
            fetch('/api/historique/me?type=participated'),
            fetch('/api/historique/me?type=conducted')
        ]);
        if (!participatedResponse.ok) { throw new Error("Erreur chargement participations"); }
        if (!conductedResponse.ok) { throw new Error("Erreur chargement trajets conduits"); }
        const participatedRides = await participatedResponse.json();
        const conductedRides = await conductedResponse.json();

        // --- 3 & 4. Afficher listes ---
        displayHistoryList(participatedRides, participationsListDiv, 'passenger');
        if (userRole === 'chauffeur' || userRole === 'passager_chauffeur') {
            trajetsConduitsSection.classList.remove('d-none');
            displayHistoryList(conductedRides, trajetsConduitsListDiv, 'driver');
        } else {
            trajetsConduitsSection.classList.add('d-none');
        }

        // --- 5. Ajouter écouteurs ---
        if (participationsListDiv) {
             participationsListDiv.addEventListener('click', handlePassengerActionsClick);
             console.log("Écouteur actions passager ajouté.");
        }
        if (trajetsConduitsListDiv) {
             trajetsConduitsListDiv.addEventListener('click', handleDriverActionClick);
             console.log("Écouteur actions chauffeur ajouté.");
         }
         if (avisForm) {
             avisForm.addEventListener('submit', handleReviewSubmit);
             console.log("Écouteur soumission avis ajouté.");
         }

    } catch (error) {
        console.error("Erreur chargement page historique:", error);
        const errorHtml = `<div class="alert alert-danger">Impossible de charger l'historique : ${error.message}</div>`;
        if(messageArea) messageArea.innerHTML = errorHtml;
        else if(participationsListDiv) participationsListDiv.innerHTML = errorHtml;
        if(trajetsConduitsSection) trajetsConduitsSection.classList.add('d-none');
    }
});


// --- Fonction pour afficher une liste de trajets ---
// (Inclut boutons validation participant)
function displayHistoryList(rides, targetElement, viewType /* 'passenger' ou 'driver' */) {
    targetElement.innerHTML = '';
    if (!rides || rides.length === 0) {
        targetElement.innerHTML = '<p class="text-muted">Aucun trajet trouvé dans cette catégorie.</p>';
        return;
    }

    const listHtml = rides.map(ride => {
        const dateDepart = new Date(ride.date_depart);
        const optionsDate = { day: '2-digit', month: '2-digit', year: 'numeric'};
        const optionsHeure = { hour: '2-digit', minute: '2-digit' };
        const dateDepartFormatee = dateDepart.toLocaleDateString('fr-FR', optionsDate);
        const heureDepartFormatee = dateDepart.toLocaleTimeString('fr-FR', optionsHeure);
        const maintenant = new Date();
        const isUpcoming = dateDepart > maintenant;
        // Statut trajet: utiliser celui de l'API ou déduire; donner priorité à 'annule'
        let statutTrajet = ride.statut_trajet;
        if (statutTrajet !== 'annule') { // Ne pas écraser 'annule'
            statutTrajet = statutTrajet || (isUpcoming ? 'prévu' : 'termine');
        }

        let statutBadge = '';
        switch (statutTrajet) {
            case 'prévu': statutBadge = isUpcoming ? '<span class="badge bg-success">À venir</span>' : '<span class="badge bg-secondary">Passé</span>'; break;
            case 'en_cours': statutBadge = '<span class="badge bg-primary">En cours</span>'; break;
            case 'termine': statutBadge = '<span class="badge bg-info text-dark">Terminé</span>'; break;
            case 'annule': statutBadge = '<span class="badge bg-danger">Annulé</span>'; break;
            default: statutBadge = '<span class="badge bg-secondary">Indéfini</span>'; // Cas imprévu
        }

        let infoSpecifique = '';
        if (viewType === 'passenger') {
            infoSpecifique = `Avec : <strong>${escapeHtml(ride.conducteur_pseudo || 'N/A')}</strong>`;
        } else if (viewType === 'driver') {
            infoSpecifique = `Places restantes : ${ride.place_restante ?? 'N/A'}`;
        }

        // Génération des boutons d'action
        let actionButtonsHtml = '';
        const trajetInfoData = `data-trajet-info="${escapeHtml(ride.depart || '?')} ➜ ${escapeHtml(ride.arrivee || '?')}"`;
        const validationStatus = ride.validation_passager || 'pending'; // Statut validation

        // Actions Chauffeur
        if (viewType === 'driver') {
            if (isUpcoming && statutTrajet === 'prévu') {
                actionButtonsHtml = `
                   <button class="btn btn-sm btn-danger mt-2 ms-1 btn-annuler-conduit" data-covoiturage-id="${ride.id}">Annuler Trajet</button>
                   <button class="btn btn-sm btn-primary mt-2 ms-1 btn-start-ride" data-covoiturage-id="${ride.id}">Démarrer</button>`;
            } else if (statutTrajet === 'en_cours') {
                actionButtonsHtml = `
                   <button class="btn btn-sm btn-info mt-2 ms-1 btn-finish-ride" data-covoiturage-id="${ride.id}">Arrivée à destination</button>`;
            }
        }
        // Actions Passager
        else if (viewType === 'passenger' && ride.participation_id) {
            if (isUpcoming && statutTrajet === 'prévu') {
                actionButtonsHtml += `
                   <button class="btn btn-sm btn-outline-danger mt-2 ms-1 btn-annuler-participation" data-participation-id="${ride.participation_id}">Annuler Participation</button>`;
            } else if (statutTrajet === 'termine') {
                // Afficher validation SI 'pending'
                if (validationStatus === 'pending') {
                    actionButtonsHtml += `
                       <button class="btn btn-sm btn-success mt-2 ms-1 btn-validate-ok" data-participation-id="${ride.participation_id}">Trajet OK</button>
                       <button class="btn btn-sm btn-danger mt-2 ms-1 btn-report-problem" data-participation-id="${ride.participation_id}">Signaler Problème</button>
                    `;
                } else if (validationStatus === 'ok') {
                    actionButtonsHtml += `<span class="badge bg-light text-success border border-success mt-2 ms-1">Validé OK</span>`;
                } else if (validationStatus === 'probleme') {
                    actionButtonsHtml += `<span class="badge bg-light text-danger border border-danger mt-2 ms-1">Problème Signalé</span>`;
                }
                // Afficher "Laisser un avis" si trajet terminé (et si pas déjà fait - TODO)
                 actionButtonsHtml += `
                     <button class="btn btn-sm btn-warning mt-2 ms-1 btn-leave-review"
                             data-participation-id="${ride.participation_id}"
                             ${trajetInfoData}
                             data-bs-toggle="modal"
                             data-bs-target="#avisModal">
                         Laisser un avis
                     </button>`;
                 // TODO: Conditionner l'affichage de ce bouton si API renvoie info "avis_laisse"
            }
        }

        // ID unique de la carte
        const cardId = viewType === 'passenger' ? `participation-card-${ride.participation_id}` : `covoiturage-card-${ride.id}`;

        // HTML de la carte
        return `
            <div class="card mb-3 shadow-sm" id="${cardId}">
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-8">
                            <h5 class="card-title mb-1">${escapeHtml(ride.depart || 'Inconnu')} ➜ ${escapeHtml(ride.arrivee || 'Inconnu')}</h5>
                            <p class="card-text text-muted mb-1">Le ${dateDepartFormatee} à ${heureDepartFormatee}</p>
                            <p class="card-text mb-1">${infoSpecifique}</p>
                            <p class="card-text"><small>Prix : ${parseFloat(ride.prix || 0).toFixed(2)} €</small></p>
                        </div>
                        <div class="col-md-4 text-md-end mt-2 mt-md-0">
                             <span class="status-badge-container">${statutBadge}</span><br>
                            <a href="/HTML/details.html?id=${ride.id}" class="btn btn-sm btn-outline-primary mt-2">Voir Détails</a>
                            <span class="action-buttons-container mt-1 d-inline-block">${actionButtonsHtml}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

    }).join('');

    targetElement.innerHTML = listHtml;
}


// --- Gestionnaire de clic pour Actions PASSAGER (Annuler, Avis, Valider OK, Signaler Pb) ---
function handlePassengerActionsClick(event) {
     const buttonCancel = event.target.closest('.btn-annuler-participation');
     const buttonReview = event.target.closest('.btn-leave-review');
     const buttonValidateOk = event.target.closest('.btn-validate-ok');
     const buttonReportProblem = event.target.closest('.btn-report-problem');
     const participationId = buttonCancel?.dataset.participationId ||
                             buttonReview?.dataset.participationId ||
                             buttonValidateOk?.dataset.participationId ||
                             buttonReportProblem?.dataset.participationId;

     if (!participationId) return; // Si aucun ID trouvé, sortir

     if (buttonCancel) {
         if (confirm("Êtes-vous sûr de vouloir annuler votre participation ? Vos crédits seront remboursés.")) {
             performPassengerCancellation(participationId, buttonCancel);
         }
     } else if (buttonReview) {
         const trajetInfo = buttonReview.dataset.trajetInfo || "ce trajet";
         prepareReviewModal(participationId, trajetInfo);
     } else if (buttonValidateOk) {
         if (confirm("Confirmez-vous que ce trajet s'est bien déroulé ?")) {
             performValidation(participationId, 'ok', null, buttonValidateOk.closest('.action-buttons-container'));
         }
     } else if (buttonReportProblem) {
         // Pour l'instant, on ne demande pas de commentaire
         if (confirm("Êtes-vous sûr de vouloir signaler un problème pour ce trajet ? L'équipe EcoRide examinera la situation. Le chauffeur ne sera pas crédité immédiatement.")) {
             performValidation(participationId, 'probleme', null, buttonReportProblem.closest('.action-buttons-container'));
         }
     }
 }

// --- Gestionnaire de clic pour Actions CHAUFFEUR ---
 function handleDriverActionClick(event) {
     const button = event.target.closest('button');
     if (!button) return;
     const covoiturageId = button.dataset.covoiturageId;
     if (!covoiturageId) return;

     if (button.classList.contains('btn-annuler-conduit')) {
         if (confirm("Êtes-vous sûr de vouloir annuler ce trajet ?\nCela annulera toutes les participations et remboursera les passagers.")) {
             performDriverCancellation(covoiturageId, button);
         }
     } else if (button.classList.contains('btn-start-ride')) {
         if (confirm("Confirmez-vous le départ de ce trajet ?")) {
             performStartRide(covoiturageId, button);
         }
     } else if (button.classList.contains('btn-finish-ride')) {
         if (confirm("Confirmez-vous l'arrivée à destination ? Les participants seront invités à valider.")) {
             performFinishRide(covoiturageId, button);
         }
     }
 }

// --- Préparer la modale d'avis ---
 function prepareReviewModal(participationId, trajetInfo) {
    const avisModalEl = document.getElementById('avisModal');
    const avisParticipationIdInput = document.getElementById('avis-participation-id');
    const avisModalLabel = document.getElementById('avisModalLabel');
    const avisForm = document.getElementById('avis-form');
    const avisMessageArea = document.getElementById('avis-message-area');
    if (!avisModalEl || !avisParticipationIdInput || !avisModalLabel || !avisForm || !avisMessageArea) { return; }
    avisParticipationIdInput.value = participationId;
    avisModalLabel.textContent = `Laisser un avis pour ${trajetInfo}`;
    avisForm.reset();
    avisMessageArea.innerHTML = '';
 }

// --- Gestionnaire de soumission du formulaire d'avis ---
 async function handleReviewSubmit(event) {
    event.preventDefault();
    const participationId = document.getElementById('avis-participation-id').value;
    const noteSelected = document.querySelector('input[name="avisNote"]:checked');
    const commentaire = document.getElementById('avis-commentaire').value;
    const messageArea = document.getElementById('avis-message-area');
    const submitButton = event.target.querySelector('button[type="submit"]');
    if (!messageArea || !submitButton) return;
    if (!noteSelected) { showMessage(messageArea, "Veuillez sélectionner une note.", 'warning'); return; }
    if (!participationId) { showMessage(messageArea, "Erreur : ID de participation manquant.", 'danger'); return; }
    const note = noteSelected.value;
    await submitReview(participationId, note, commentaire, messageArea, submitButton);
 }

// --- Fonction pour appeler l'API de soumission d'avis ---
 async function submitReview(participationId, note, commentaire, messageArea, submitButton) {
    messageArea.innerHTML = '';
    submitButton.disabled = true;
    submitButton.textContent = 'Envoi...';
    try {
        const response = await fetch(`/api/participations/${participationId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: parseInt(note, 10), commentaire: commentaire })
        });
        const responseData = await response.json().catch(() => ({}));
        if (response.ok && response.status === 201) {
             showMessage(messageArea, responseData.message || 'Avis soumis avec succès !', 'success');
             setTimeout(() => {
                 const avisModalEl = document.getElementById('avisModal');
                 const avisModalInstance = bootstrap.Modal.getInstance(avisModalEl); // Utiliser getInstance
                 if (avisModalInstance) avisModalInstance.hide();
                 const originalButton = document.querySelector(`.btn-leave-review[data-participation-id="${participationId}"]`);
                 if (originalButton) {
                     originalButton.textContent = 'Avis Laissé';
                     originalButton.disabled = true;
                     originalButton.classList.remove('btn-warning');
                     originalButton.classList.add('btn-secondary');
                     originalButton.removeAttribute('data-bs-toggle');
                     originalButton.removeAttribute('data-bs-target');
                 }
             }, 1500);
        } else {
            showMessage(messageArea, `Échec soumission: ${responseData.message || `Erreur ${response.status}`}`, 'danger');
            submitButton.disabled = false;
            submitButton.textContent = 'Envoyer l\'avis';
        }
    } catch (error) {
        showMessage(messageArea, "Erreur réseau lors de la soumission.", 'danger');
        submitButton.disabled = false;
        submitButton.textContent = 'Envoyer l\'avis';
    }
 }

// --- Fonction pour appeler l'API de VALIDATION participant ---
async function performValidation(participationId, status, commentaire, buttonContainer) {
    const messageArea = document.getElementById('history-message-area');
    if(messageArea) messageArea.innerHTML = '';

    const buttons = buttonContainer ? buttonContainer.querySelectorAll('button') : [];
    buttons.forEach(btn => btn.disabled = true); // Désactiver tous les boutons dans le conteneur

    try {
        const body = { status: status };
        // if (commentaire) { body.commentaire = commentaire; } // Ajouter si besoin

        const response = await fetch(`/api/participations/${participationId}/validation`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const responseData = await response.json().catch(() => ({}));

        if (response.ok) {
             console.log(`Validation participation ${participationId} enregistrée comme '${status}'.`);
             showMessage(messageArea, responseData.message || 'Validation enregistrée !', 'success');
             // Remplacer les boutons de validation par un message
             if (buttonContainer) {
                  let confirmationText = '';
                  if (status === 'ok') {
                       confirmationText = '<span class="badge bg-light text-success border border-success mt-2 ms-1">Trajet Validé OK</span>';
                  } else if (status === 'probleme') {
                       confirmationText = '<span class="badge bg-light text-danger border border-danger mt-2 ms-1">Problème Signalé</span>';
                  }
                  // Garder le bouton "Laisser un avis" s'il existe
                  const reviewButton = buttonContainer.querySelector('.btn-leave-review');
                  // Vider le conteneur et remettre le texte + le bouton avis
                  buttonContainer.innerHTML = confirmationText + (reviewButton ? reviewButton.outerHTML : '');
             }
        } else {
             console.error("Erreur API validation participation:", responseData);
             showMessage(messageArea, `Échec validation: ${responseData.message || `Erreur ${response.status}`}`, 'danger');
             buttons.forEach(btn => btn.disabled = false); // Réactiver si erreur
        }

    } catch(error) {
        console.error("Erreur réseau validation participation:", error);
        showMessage(messageArea, "Erreur réseau lors de la validation.", 'danger');
        buttons.forEach(btn => btn.disabled = false); // Réactiver si erreur
    }
}


// --- Fonctions d'annulation et start/finish ---
async function performPassengerCancellation(participationId, buttonElement) {
    const messageArea = document.getElementById('history-message-area');
    if(messageArea) messageArea.innerHTML = '';
    buttonElement.disabled = true;
    buttonElement.textContent = 'Annulation...';
    const cardId = `participation-card-${participationId}`;
    try {
        const response = await fetch(`/api/participations/${participationId}`, { method: 'DELETE' });
        const responseData = await response.json().catch(() => ({}));
        if (response.ok) {
            if (messageArea) { showMessage(messageArea, responseData.message || 'Participation annulée avec succès !', 'success'); }
            removeCard(cardId, 'participations-list');
        } else {
            if (messageArea) { showMessage(messageArea, `Échec annulation: ${responseData.message || `Erreur ${response.status}`}`, 'danger'); }
            buttonElement.disabled = false; buttonElement.textContent = 'Annuler Participation';
        }
    } catch (error) {
        if (messageArea) { showMessage(messageArea, "Erreur réseau lors de l'annulation.", 'danger'); }
        buttonElement.disabled = false; buttonElement.textContent = 'Annuler Participation';
    }
}

async function performDriverCancellation(covoiturageId, buttonElement) {
    const messageArea = document.getElementById('history-message-area');
    if(messageArea) messageArea.innerHTML = '';
    buttonElement.disabled = true;
    buttonElement.textContent = 'Annulation...';
    const cardId = `covoiturage-card-${covoiturageId}`;
    try {
        const response = await fetch(`/api/covoiturages/${covoiturageId}/cancel`, { method: 'POST' });
        const responseData = await response.json().catch(() => ({}));
        if (response.ok) {
            if (messageArea) { showMessage(messageArea, responseData.message || 'Trajet annulé avec succès !', 'success'); }
            removeCard(cardId, 'trajets-conduits-list');
        } else {
            if (messageArea) { showMessage(messageArea, `Échec annulation: ${responseData.message || `Erreur ${response.status}`}`, 'danger'); }
            buttonElement.disabled = false; buttonElement.textContent = 'Annuler Trajet';
        }
    } catch (error) {
        if (messageArea) { showMessage(messageArea, "Erreur réseau lors de l'annulation.", 'danger'); }
        buttonElement.disabled = false; buttonElement.textContent = 'Annuler Trajet';
    }
}

async function performStartRide(covoiturageId, buttonElement) {
    const messageArea = document.getElementById('history-message-area');
    if(messageArea) messageArea.innerHTML = '';
    buttonElement.disabled = true;
    buttonElement.textContent = 'Démarrage...';
    const cardElement = buttonElement.closest('.card');
    try {
        const response = await fetch(`/api/covoiturages/${covoiturageId}/start`, { method: 'POST' });
        const responseData = await response.json().catch(() => ({}));
        if (response.ok) {
            if (messageArea) { showMessage(messageArea, responseData.message || 'Trajet démarré !', 'success'); }
            if (cardElement) {
                const badgeContainer = cardElement.querySelector('.status-badge-container');
                if (badgeContainer) badgeContainer.innerHTML = '<span class="badge bg-primary">En cours</span>';
                const buttonContainer = cardElement.querySelector('.action-buttons-container');
                if (buttonContainer) {
                    buttonContainer.innerHTML = `<button class="btn btn-sm btn-info mt-2 ms-1 btn-finish-ride" data-covoiturage-id="${covoiturageId}">Arrivée à destination</button>`;
                }
            }
        } else {
            if (messageArea) { showMessage(messageArea, `Échec démarrage: ${responseData.message || `Erreur ${response.status}`}`, 'danger'); }
            buttonElement.disabled = false; buttonElement.textContent = 'Démarrer';
        }
    } catch (error) {
        if (messageArea) { showMessage(messageArea, "Erreur réseau lors du démarrage.", 'danger'); }
        buttonElement.disabled = false; buttonElement.textContent = 'Démarrer';
    }
}

async function performFinishRide(covoiturageId, buttonElement) {
    const messageArea = document.getElementById('history-message-area');
    if(messageArea) messageArea.innerHTML = '';
    buttonElement.disabled = true;
    buttonElement.textContent = 'Terminaison...';
    const cardElement = buttonElement.closest('.card');
    try {
        const response = await fetch(`/api/covoiturages/${covoiturageId}/finish`, { method: 'POST' });
        const responseData = await response.json().catch(() => ({}));
        if (response.ok) {
            if (messageArea) { showMessage(messageArea, responseData.message || 'Trajet terminé !', 'success'); }
             if (cardElement) {
                const badgeContainer = cardElement.querySelector('.status-badge-container');
                if (badgeContainer) badgeContainer.innerHTML = '<span class="badge bg-info text-dark">Terminé</span>';
                const buttonContainer = cardElement.querySelector('.action-buttons-container');
                // Après terminaison par chauffeur, on ne met PAS le bouton "Laisser un avis" ici.
                if (buttonContainer) buttonContainer.innerHTML = '';
                 // On pourrait potentiellement relancer un displayHistoryList pour rafraîchir les boutons passager,
                 // mais c'est plus complexe et peut-être pas nécessaire si le passager recharge la page.
             }
        } else {
            if (messageArea) { showMessage(messageArea, `Échec terminaison: ${responseData.message || `Erreur ${response.status}`}`, 'danger'); }
            buttonElement.disabled = false; buttonElement.textContent = 'Arrivée à destination';
        }
    } catch (error) {
        if (messageArea) { showMessage(messageArea, "Erreur réseau lors de la terminaison.", 'danger'); }
        buttonElement.disabled = false; buttonElement.textContent = 'Arrivée à destination';
    }
}


// --- Fonctions utilitaires ---
function showMessage(areaElement, message, type = 'info') {
     if (!areaElement) return;
     areaElement.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
                                 ${escapeHtml(message)}
                                 <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                              </div>`;
     setTimeout(() => { if(areaElement && areaElement.innerHTML !== '') areaElement.innerHTML = ''; }, 7000);
}

function removeCard(cardId, listId) {
    const cardToRemove = document.getElementById(cardId);
    if (cardToRemove) {
         cardToRemove.remove();
         const listDiv = document.getElementById(listId);
         if(listDiv && !listDiv.querySelector('.card')) { // Vérifie s'il reste des cartes
            listDiv.innerHTML = '<p class="text-muted">Aucun trajet trouvé dans cette catégorie.</p>';
         }
    } else {
        console.warn(`Impossible de trouver la carte avec l'ID ${cardId} pour la supprimer.`);
    }
}

// Fonction escapeHtml déjà définie au début