// public/JS/index.js - VERSION COMPLÈTE AVEC FILTRES PRIX/ECO

// Fonction pour afficher les trajets (elle doit déjà exister ou être ajoutée)
function afficherTrajets(trajets) {
    const resultatsArea = document.getElementById('resultats-area');
    const messageInitial = document.getElementById('message-initial-recherche');
    if (messageInitial) messageInitial.style.display = 'none'; // Cacher message initial

    resultatsArea.innerHTML = ''; // Vider les anciens résultats

    if (!trajets || trajets.length === 0) {
        resultatsArea.innerHTML = '<p class="text-center text-muted">Aucun covoiturage trouvé pour ces critères.</p>';
        return;
    }

    // Créer une carte pour chaque trajet
    trajets.forEach(trajet => {
        const carte = document.createElement('div');
        carte.className = 'card mb-3 shadow-sm trajet-carte'; // Ajout classe pour style/event

        const dateDepart = new Date(trajet.date_depart);
        const dateArrivee = new Date(trajet.date_arrivee);
        const optionsDate = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };

        // Calcul simple de la durée
        let dureeStr = 'N/A';
        if (dateArrivee > dateDepart) {
            const dureeMs = dateArrivee - dateDepart;
            const dureeHeures = Math.floor(dureeMs / (1000 * 60 * 60));
            const dureeMinutes = Math.floor((dureeMs % (1000 * 60 * 60)) / (1000 * 60));
            dureeStr = `${dureeHeures}h ${dureeMinutes}min`;
        }

        const photoSrc = trajet.photo_url || '/images/default.png'; // Chemin depuis la racine

        carte.innerHTML = `
            <div class="row g-0">
                <div class="col-md-2 d-flex align-items-center justify-content-center p-2">
                     <img src="${photoSrc}" alt="Photo de ${trajet.pseudo}" class="img-fluid rounded-circle" style="width: 80px; height: 80px; object-fit: cover;">
                </div>
                <div class="col-md-7">
                    <div class="card-body">
                        <h5 class="card-title">${trajet.depart} ➜ ${trajet.arrivee}</h5>
                        <p class="card-text mb-1">
                            <small class="text-muted">Avec ${trajet.pseudo || 'Inconnu'} (Note: ${trajet.conducteur_note ?? 'N/A'} / 5)</small>
                        </p>
                        <p class="card-text mb-1">Départ: ${dateDepart.toLocaleDateString('fr-FR', optionsDate)}</p>
                        <p class="card-text mb-1">Arrivée: ${dateArrivee.toLocaleDateString('fr-FR', optionsDate)} (Durée estimée: ${dureeStr})</p>
                        <p class="card-text">Véhicule: ${trajet.marque || ''} ${trajet.modele || ''} (${trajet.energie || 'N/A'})</p>
                         ${trajet.is_ecologique == 1 ? '<span class="badge bg-success text-white mb-2">✅ Écologique</span>' : ''}
                    </div>
                </div>
                <div class="col-md-3 d-flex flex-column justify-content-center align-items-center p-3 bg-light">
                    <h4 class="text-success fw-bold">${parseFloat(trajet.prix).toFixed(2)} €</h4> <p class="mb-2">${trajet.place_restante} place(s) restante(s)</p>
                    <a href="/HTML/details.html?id=${trajet.id}" class="btn btn-primary btn-sm w-100">Détails</a>
                </div>
            </div>
        `;
        resultatsArea.appendChild(carte);
    });
}


// Attend que le DOM soit chargé
document.addEventListener('DOMContentLoaded', () => {
    console.log("index.js chargé et DOM prêt.");

    const searchForm = document.getElementById('search-form');
    const resultatsArea = document.getElementById('resultats-area');
    const messageInitial = document.getElementById('message-initial-recherche');

    if (!searchForm || !resultatsArea || !messageInitial) {
        console.error("Erreur: Le formulaire de recherche ou la zone de résultats est manquant.");
        if(resultatsArea) resultatsArea.innerHTML = "<p class='text-danger'>Erreur de chargement de la page.</p>";
        return;
    }

    // Écouteur pour la soumission du formulaire
    searchForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Empêche le rechargement de la page
        console.log("Formulaire de recherche soumis.");

        // Récupérer les valeurs des champs principaux
        const villeDepart = document.getElementById('villeDepart').value.trim();
        const villeArrivee = document.getElementById('villeArrivee').value.trim();
        const dateDepart = document.getElementById('dateDepart').value;

        // --- Lire les valeurs des nouveaux filtres ---
        const prixMaxInput = document.getElementById('filter-prix-max');
        const ecologiqueInput = document.getElementById('filter-ecologique');
        const prixMax = prixMaxInput.value.trim(); // "" si vide
        const ecologique = ecologiqueInput.checked; // true ou false
        // -------------------------------------------

        // Validation
        if (!villeDepart || !villeArrivee || !dateDepart) {
            alert('Veuillez remplir Ville de départ, Ville d\'arrivée et Date de départ.');
            return;
        }

        // Afficher message chargement
        resultatsArea.innerHTML = '<p class="text-center">Recherche en cours...</p>';
        messageInitial.style.display = 'none';

        // --- Construire l'URL de l'API avec les filtres ---
        let apiUrl = `/api/covoiturages?villeDepart=${encodeURIComponent(villeDepart)}&villeArrivee=${encodeURIComponent(villeArrivee)}&dateDepart=${encodeURIComponent(dateDepart)}`;

        if (prixMax) { // Ajouter seulement si une valeur est entrée
            apiUrl += `&prixMax=${encodeURIComponent(prixMax)}`;
        }
        if (ecologique) { // Ajouter seulement si la case est cochée
            apiUrl += `&ecologique=true`;
        }
        console.log("Appel API avec URL:", apiUrl);
        // --------------------------------------------------

        // --- Appel Fetch avec la nouvelle URL ---
        fetch(apiUrl)
            .then(response => {
                console.log("Réponse reçue de l'API:", response.status);
                if (!response.ok) {
                    return response.json().then(errData => { throw new Error(errData.message || `Erreur ${response.status}`); })
                           .catch(() => { throw new Error(`Erreur ${response.status}`); });
                }
                return response.json();
            })
            .then(data => {
                console.log("Données reçues:", data);
                 if (Array.isArray(data)) { // Tableau de trajets
                     afficherTrajets(data);
                 } else if (data.message && data.suggestion) { // Message avec suggestion
                     resultatsArea.innerHTML = `<div class="alert alert-warning">${data.message} ${data.suggestion}</div>`;
                 } else if (data.message) { // Juste un message
                      resultatsArea.innerHTML = `<div class="alert alert-info">${data.message}</div>`;
                 } else { // Réponse inconnue
                    afficherTrajets([]); // Afficher "aucun résultat"
                 }
            })
            .catch(error => {
                console.error('Erreur lors de la recherche de covoiturages:', error);
                resultatsArea.innerHTML = `<div class="alert alert-danger">Erreur lors de la recherche : ${error.message}</div>`;
            });
    }); // Fin listener submit

}); // Fin DOMContentLoaded