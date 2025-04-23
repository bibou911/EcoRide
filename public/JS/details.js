// ==================================================================
// Fichier: public/JS/details.js
// Description: Gère l'affichage de la page détaillée d'un covoiturage
//              et les interactions associées (participation, affichage avis).
// ==================================================================

// --- Fonctions Utilitaires ---

/**
 * Échappe les caractères HTML potentiellement dangereux dans une chaîne.
 * @param {string|null|undefined} unsafe La chaîne à échapper.
 * @returns {string} La chaîne échappée, ou une chaîne vide si l'entrée est null/undefined.
 */
function escapeHtml(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Génère le HTML pour afficher une note sous forme d'étoiles.
 * @param {number|string|null} note La note (entre 1 et 5).
 * @returns {string} Le HTML des étoiles ou 'N/A'.
 */
function renderStars(note) {
    const noteNum = parseInt(note, 10);
    if (isNaN(noteNum) || noteNum < 1 || noteNum > 5) return '<span class="text-muted">N/A</span>';
    let stars = '';
    for (let i = 0; i < 5; i++) {
        stars += (i < noteNum) ? '★' : '☆'; // ★ Pleine, ☆ Vide
    }
    return `<span style="color: orange;" title="${noteNum}/5">${stars}</span>`;
}

/**
 * Formate une valeur de préférence (0, 1, null/undefined) en HTML lisible.
 * @param {number|null|undefined} value La valeur de la préférence (0, 1 ou autre).
 * @returns {string} Le HTML formaté ('Oui', 'Non', 'Indifférent').
 */
const formatPreference = (value) => {
    if (value === 1) return '<strong class="text-success">Oui</strong>';
    if (value === 0) return '<strong class="text-danger">Non</strong>';
    return '<span class="text-muted">Indifférent</span>';
};

/**
 * Formate une chaîne de date/heure ISO (ou autre format reconnu par new Date()) en format local FR.
 * @param {string|null|undefined} dateTimeString La chaîne de date/heure.
 * @returns {string} La date/heure formatée (ex: '18/04/2025 15:00') ou 'N/A' ou un message d'erreur.
 */
function formatDateTime(dateTimeString) {
    if (!dateTimeString) return 'N/A';
    try {
        const date = new Date(dateTimeString);
        if (isNaN(date.getTime())) {
            return 'Date invalide';
        }
        const optionsDate = { year: 'numeric', month: '2-digit', day: '2-digit' };
        const optionsTime = { hour: '2-digit', minute: '2-digit', hour12: false };
        return `${date.toLocaleDateString('fr-FR', optionsDate)} ${date.toLocaleTimeString('fr-FR', optionsTime)}`;
    } catch (e) {
        console.error("Erreur formatage date:", dateTimeString, e);
        return 'Erreur date';
    }
}


// --- Logique Principale au chargement de la page ---

document.addEventListener('DOMContentLoaded', function() {
    console.log("details.js: DOM chargé.");

    // --- Récupérer les éléments HTML ---
    const titreDiv = document.getElementById('details-titre');
    const conducteurDiv = document.getElementById('details-conducteur');
    const trajetDiv = document.getElementById('details-trajet');
    const vehiculeDiv = document.getElementById('details-vehicule');
    const avisDiv = document.getElementById('details-avis');
    const preferencesDiv = document.getElementById('driver-preferences-display');
    const boutonParticiper = document.getElementById('bouton-participer');
    const messageAreaParticipation = document.getElementById('message-area-participation');

    // Initialiser les divs avec un message de chargement standard
    const loadingHtml = '<p class="text-muted">Chargement...</p>';
    if(titreDiv) titreDiv.textContent = 'Chargement des détails...';
    if(trajetDiv) trajetDiv.innerHTML = loadingHtml;
    if(conducteurDiv) conducteurDiv.innerHTML = loadingHtml;
    if(vehiculeDiv) vehiculeDiv.innerHTML = loadingHtml;
    if(preferencesDiv) preferencesDiv.innerHTML = loadingHtml;
    if(avisDiv) avisDiv.innerHTML = loadingHtml; // Avis aussi
    if(boutonParticiper) boutonParticiper.style.display = 'none'; // Cacher bouton pendant chargement

    // --- Lire l'ID du covoiturage depuis l'URL ---
    const params = new URLSearchParams(window.location.search);
    const covoiturageId = params.get('id');
    console.log("details.js: ID du covoiturage récupéré depuis l'URL :", covoiturageId);

    // --- Vérifier si l'ID est valide ---
    if (!covoiturageId || isNaN(parseInt(covoiturageId, 10))) {
        const errorMsg = "L'identifiant du covoiturage est manquant ou invalide dans l'URL.";
        console.error("details.js:", errorMsg);
        // Afficher l'erreur dans toutes les sections
        if (titreDiv) titreDiv.textContent = "Erreur";
        const errorMessageHtml = `<p class="text-danger"><small>${errorMsg}</small></p>`;
        if (trajetDiv) trajetDiv.innerHTML = errorMessageHtml;
        if (vehiculeDiv) vehiculeDiv.innerHTML = errorMessageHtml;
        if (conducteurDiv) conducteurDiv.innerHTML = errorMessageHtml;
        if (preferencesDiv) preferencesDiv.innerHTML = errorMessageHtml;
        if(avisDiv) avisDiv.innerHTML = ''; // Vider avis
        return; // Arrêter l'exécution
    }
    const idNum = parseInt(covoiturageId, 10);

    // --- Construire l'URL de l'API pour les détails ---
    const apiUrlDetails = `/api/covoiturages/${idNum}`;
    console.log("details.js: Appel API détails:", apiUrlDetails);

    // --- Appeler l'API pour les détails du covoiturage ---
    fetch(apiUrlDetails)
        .then(response => {
            // Gestion améliorée des réponses HTTP
            if (!response.ok) {
                console.error(`details.js: Erreur HTTP ! statut: ${response.status}`);
                return response.text().then(text => {
                    let errorMsg = `Erreur ${response.status}: ${response.statusText}`;
                    try {
                        const jsonData = JSON.parse(text);
                        errorMsg = `Erreur ${response.status}: ${jsonData.message || text}`;
                    } catch (e) {
                        errorMsg = `Erreur ${response.status}: ${text || response.statusText}`;
                    }
                    throw new Error(errorMsg); // Lancer l'erreur pour le .catch
                });
            }
            // Si statut OK (200-299)
            return response.json(); // Tenter de parser le JSON
        })
        .then(details => {
            // *** Succès: Affichage des données ***
            console.log("details.js: Détails covoiturage (avec prefs) reçus:", details);

            // Vérifier si l'objet details est valide (sécurité)
            if (!details || typeof details !== 'object') {
                throw new Error("Format de réponse invalide reçu du serveur.");
            }

            // Affichage Titre
            if (titreDiv) {
                titreDiv.textContent = `Détails : ${escapeHtml(details.depart)} → ${escapeHtml(details.arrivee)}`;
            }

            // Affichage Trajet
            if (trajetDiv) {
                trajetDiv.innerHTML = `
                    <h5>Informations sur le trajet</h5>
                    <p><strong>Départ :</strong> ${escapeHtml(details.depart)}</p>
                    <p><strong>Arrivée :</strong> ${escapeHtml(details.arrivee)}</p>
                    <p><strong>Date et heure de départ :</strong> ${formatDateTime(details.date_depart)}</p>
                    <p><strong>Date et heure d'arrivée :</strong> ${formatDateTime(details.date_arrivee)}</p>
                    <p><strong>Prix :</strong> ${escapeHtml(details.prix)} crédits</p>
                    <p id="places-restantes-affichage"><strong>Places restantes :</strong> ${escapeHtml(details.place_restante)}</p>
                    <p><strong>Trajet écologique :</strong> ${details.is_ecologique === 1 ? '<strong class="text-success">Oui</strong>' : '<strong class="text-danger">Non</strong>'}</p>
                `;
            }

            // Affichage Véhicule
            if (vehiculeDiv) {
                vehiculeDiv.innerHTML = `
                    <h5>Véhicule</h5>
                    <p><strong>Marque :</strong> ${escapeHtml(details.marque) || 'Non précisé'}</p>
                    <p><strong>Modèle :</strong> ${escapeHtml(details.modele) || 'Non précisé'}</p>
                    <p><strong>Énergie :</strong> ${escapeHtml(details.energie) || 'Non précisé'}</p>
                `;
            }

            // Affichage Conducteur
            if (conducteurDiv) {
                // Adapte le chemin de l'image par défaut si nécessaire
                const avatarUrl = details.photo_url ? escapeHtml(details.photo_url) : '/images/default_avatar.png';
                conducteurDiv.innerHTML = `
                    <h5>Conducteur/Conductrice</h5>
                    <p><img src="${avatarUrl}" alt="Avatar de ${escapeHtml(details.pseudo)}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 10px;"><strong>${escapeHtml(details.pseudo)}</strong></p>
                    <p><strong>Note moyenne :</strong> ${renderStars(details.conducteur_note)}</p>
                    `;
            }

            // Affichage Préférences (Utilise les fonctions globales)
            if (preferencesDiv) {
                 let prefsHtml = '<h5>Préférences</h5>';
                 prefsHtml += `<p>Fumeurs : ${formatPreference(details.pref_fumeur)}</p>`;
                 prefsHtml += `<p>Animaux : ${formatPreference(details.pref_animaux)}</p>`;
                 prefsHtml += `<p>Autres : ${details.pref_autres ? `<em>${escapeHtml(details.pref_autres)}</em>` : '<span class="text-muted">Aucune</span>'}</p>`;
                 preferencesDiv.innerHTML = prefsHtml;
            }

            // Gestion Bouton Participer
            if (boutonParticiper) {
                 if (details.place_restante > 0) {
                     boutonParticiper.disabled = false;
                     boutonParticiper.textContent = `Participer (${details.prix} crédits)`;
                     boutonParticiper.onclick = () => handleParticipation(details.id, details.prix, details.depart, details.arrivee);
                 } else {
                     boutonParticiper.disabled = true;
                     boutonParticiper.textContent = 'Complet';
                 }
                 boutonParticiper.style.display = 'block'; // Rendre visible
            }

            // Appel pour charger les avis (Approuvés pour CE trajet)
            if (avisDiv) {
                 // NB: Ceci charge les avis pour CE covoiturage.
                 // Si tu veux TOUS les avis approuvés du CONDUCTEUR, il faudrait adapter l'appel:
                 // fetchApprovedReviewsByDriver(details.conducteur_id, avisDiv);
                 // et créer cette fonction + la route API correspondante.
                 fetchApprovedReviews(idNum, avisDiv);
            }

        })
        .catch(error => {
            // *** Gestion centralisée des Erreurs ***
            console.error('details.js: Erreur lors de la récupération ou de l\'affichage des détails:', error);
            if (titreDiv) titreDiv.textContent = "Erreur";
            const errorMessageHtml = `<p class="text-danger"><small>Erreur chargement: ${escapeHtml(error.message)}</small></p>`;
            // Afficher l'erreur dans toutes les sections concernées
            if (trajetDiv) trajetDiv.innerHTML = errorMessageHtml;
            if (vehiculeDiv) vehiculeDiv.innerHTML = errorMessageHtml;
            if (conducteurDiv) conducteurDiv.innerHTML = errorMessageHtml;
            if (preferencesDiv) preferencesDiv.innerHTML = errorMessageHtml;
            if (avisDiv) avisDiv.innerHTML = ''; // Vider aussi les avis en cas d'erreur détails
            if (boutonParticiper) boutonParticiper.style.display = 'none'; // Cacher bouton si erreur
        });

}); // --- Fin DOMContentLoaded ---


// --- Fonctions pour les Avis (Approuvés pour un covoiturage donné) ---

/**
 * Récupère et affiche les avis approuvés pour un ID de covoiturage donné.
 * @param {number} covoiturageId L'ID du covoiturage.
 * @param {HTMLElement} targetDiv Le div où afficher les avis.
 */
async function fetchApprovedReviews(covoiturageId, targetDiv) {
    console.log(`details.js: Récupération des avis approuvés pour covoiturage ID: ${covoiturageId}`);
    targetDiv.innerHTML = '<p class="text-muted">Chargement des avis...</p>';
    // Demande les avis approuvés pour ce covoiturage spécifique
    const apiUrlAvis = `/api/avis?covoiturageId=${covoiturageId}&statut=approved`;

    try {
        const response = await fetch(apiUrlAvis);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({})); // Tente de lire l'erreur JSON
            throw new Error(errData.message || `Erreur ${response.status}`);
        }
        const reviews = await response.json();
        console.log("details.js: Avis approuvés reçus:", reviews);
        displayApprovedReviews(reviews, targetDiv);
    } catch (error) {
        console.error("details.js: Erreur fetch avis:", error);
        targetDiv.innerHTML = `<p class="text-danger"><small>Impossible de charger les avis: ${escapeHtml(error.message)}</small></p>`;
    }
}

/**
 * Met en forme et affiche une liste d'avis dans un élément HTML cible.
 * @param {Array} reviews Le tableau d'objets avis.
 * @param {HTMLElement} targetDiv Le div où injecter le HTML.
 */
function displayApprovedReviews(reviews, targetDiv) {
    targetDiv.innerHTML = ''; // Vider la zone cible
    if (!reviews || reviews.length === 0) {
        targetDiv.innerHTML = '<p class="text-muted">Aucun avis approuvé pour ce trajet pour le moment.</p>';
        return;
    }

    let reviewsHtml = '<h5>Avis sur le conducteur (pour ce trajet)</h5>'; // Préciser le contexte
    reviews.forEach(review => {
        let dateAvisFormatee = 'N/A';
        try { dateAvisFormatee = new Date(review.date_soumission).toLocaleDateString('fr-FR', { dateStyle: 'short' }); } catch (e) {}

        reviewsHtml += `
            <div class="mb-3 border-bottom pb-2">
                <p class="mb-0">
                    ${renderStars(review.note)} par <strong>${escapeHtml(review.passager_pseudo || 'Utilisateur')}</strong>
                    <small class="text-muted float-end">${dateAvisFormatee}</small>
                </p>
                <p class="card-text fst-italic mb-0">${escapeHtml(review.commentaire) || '<i>Aucun commentaire</i>'}</p>
            </div>
        `;
    });
    targetDiv.innerHTML = reviewsHtml;
}


// --- Fonction pour gérer la participation ---

/**
 * Gère le processus de participation à un covoiturage.
 * Vérifie la connexion, demande confirmation, appelle l'API et met à jour l'interface.
 * @param {number} covoiturageId L'ID du covoiturage à rejoindre.
 * @param {number|string} prix Le prix en crédits du covoiturage.
 */
async function handleParticipation(covoiturageId, prix, depart, arrivee) {
    console.log(`details.js: Tentative de participation au covoiturage ID: ${covoiturageId} pour ${prix} crédits.`);
    const messageAreaParticipation = document.getElementById('message-area-participation');
    if(messageAreaParticipation) messageAreaParticipation.innerHTML = ''; // Reset

    // 1. Vérifier si l'utilisateur est connecté (Exemple avec /api/session/status)
    try {
        console.log("details.js: Vérification statut session...");
        const sessionRes = await fetch('/api/session/status');
        const sessionData = await sessionRes.json();
        console.log("details.js: Statut session reçu:", sessionData);

        if (!sessionData.isLoggedIn) {
            alert("Vous devez être connecté pour participer. Vous allez être redirigé...");
            // Rediriger vers la page de connexion (adapte le chemin si besoin)
            window.location.href = '/HTML/connexion.html';
            return; // Arrêter le processus
        }
        // Si connecté, continuer...
        console.log("details.js: Utilisateur connecté. Demande de confirmation...");

    } catch (e) {
        console.error("details.js: Erreur vérification session:", e);
        alert("Impossible de vérifier votre statut de connexion. Veuillez réessayer.");
        return;
    }

    // 2. Demander confirmation à l'utilisateur
    if (confirm(`Confirmez-vous vouloir utiliser ${prix} crédits pour rejoindre ce trajet ?\nDépart: ${depart || 'N/A'}\nArrivée: ${arrivee || 'N/A'}`)) {
        console.log("details.js: Confirmation reçue. Appel API /api/participations...");
        if (messageAreaParticipation) messageAreaParticipation.innerHTML = '<p class="text-info">Traitement de votre demande...</p>';
        const boutonParticiper = document.getElementById('bouton-participer');
        if(boutonParticiper) boutonParticiper.disabled = true; // Désactiver pendant traitement

        // 3. Appeler l'API pour enregistrer la participation
        try {
            const response = await fetch('/api/participations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Envoyer l'ID du covoiturage dans le corps de la requête
                body: JSON.stringify({ covoiturageId: covoiturageId })
            });

            // Tenter de lire la réponse JSON même si erreur HTTP pour avoir le message serveur
            const responseData = await response.json().catch(() => ({ message: `Réponse invalide du serveur (Statut ${response.status})` }));

            if (response.ok && response.status === 201) { // 201 Created = Succès
                console.log("details.js: Participation réussie !");
                alert(responseData.message || "Inscription au trajet réussie !");

                // Mettre à jour l'interface utilisateur
                if (boutonParticiper) {
                    boutonParticiper.textContent = 'Participation enregistrée';
                    // Garder désactivé pour éviter double participation
                }
                const placesAffichage = document.getElementById('places-restantes-affichage');
                if (placesAffichage) {
                    // Essayer de décrémenter le nombre affiché
                    try {
                        let currentPlacesText = placesAffichage.textContent.match(/\d+/);
                        if (currentPlacesText) {
                            let currentPlaces = parseInt(currentPlacesText[0], 10);
                            if (!isNaN(currentPlaces) && currentPlaces > 0) {
                                placesAffichage.textContent = `Places restantes : ${currentPlaces - 1}`;
                            } else if (currentPlaces === 0){
                                // Si c'était la dernière place
                                placesAffichage.textContent = `Places restantes : 0`;
                            }
                        }
                    } catch (e) { console.error("details.js: Erreur MAJ places restantes:", e); }
                }
                if (messageAreaParticipation) messageAreaParticipation.innerHTML = `<p class="text-success"><strong>${responseData.message || "Inscription réussie !"}</strong></p>`;

            } else {
                // Gérer les erreurs renvoyées par l'API (400, 401, 403, 404, 409, 500...)
                console.error("details.js: Échec participation API:", response.status, responseData);
                alert(`Échec de la participation : ${responseData.message || `Erreur ${response.status}`}`);
                if (messageAreaParticipation) messageAreaParticipation.innerHTML = `<p class="text-danger"><strong>Échec :</strong> ${escapeHtml(responseData.message || `Erreur ${response.status}`)}</p>`;
                if(boutonParticiper) boutonParticiper.disabled = false; // Réactiver si erreur ? Ou laisser désactivé ? À décider.
            }
        } catch (error) {
            // Gérer les erreurs réseau
            console.error("details.js: Erreur réseau participation:", error);
            alert("Une erreur réseau est survenue lors de la tentative de participation.");
            if (messageAreaParticipation) messageAreaParticipation.innerHTML = '<p class="text-danger"><strong>Erreur réseau.</strong> Veuillez vérifier votre connexion.</p>';
            if(boutonParticiper) boutonParticiper.disabled = false; // Réactiver si erreur réseau
        } finally {
             // Effacer le message après un délai
             if(messageAreaParticipation) setTimeout(() => { messageAreaParticipation.innerHTML = ''; }, 7000);
        }
    } else {
        console.log("details.js: Participation annulée par l'utilisateur.");
    }
}