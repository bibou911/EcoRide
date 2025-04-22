// public/JS/proposer_trajet.js - VERSION 2 (Avec log session data)

document.addEventListener('DOMContentLoaded', async () => {
    console.log("proposer_trajet.js DEBUG v2 chargé et DOM prêt.");

    // Récupérer les éléments du formulaire et la zone de message
    const proposeForm = document.getElementById('propose-form');
    const departInput = document.getElementById('propose-depart');
    const arriveeInput = document.getElementById('propose-arrivee');
    const dateDepartInput = document.getElementById('propose-date-depart');
    const dateArriveeInput = document.getElementById('propose-date-arrivee');
    const prixInput = document.getElementById('propose-prix');
    const placesInput = document.getElementById('propose-places');
    const vehiculeSelect = document.getElementById('propose-vehicule');
    const messageArea = document.getElementById('propose-message-area');

    if (!proposeForm || !vehiculeSelect || !messageArea || !departInput || !arriveeInput || !dateDepartInput || !dateArriveeInput || !prixInput || !placesInput) {
        console.error("Erreur: Éléments HTML essentiels manquants sur la page proposer_trajet.html.");
        messageArea.innerHTML = '<div class="alert alert-danger">Erreur de chargement de la page (éléments manquants).</div>';
        return;
    }

    let userVehicles = []; // Pour stocker les véhicules de l'utilisateur

    // --- Vérification de l'authentification et du rôle + chargement des véhicules ---
    try {
        console.log("Vérification session et rôle...");
        const sessionResponse = await fetch('/api/session/status');
        if (!sessionResponse.ok) {
             const errorText = await sessionResponse.text(); // Lire comme texte si JSON échoue
             throw new Error(`Statut session non OK: ${response.status} ${errorText}`);
        }
        const sessionData = await sessionResponse.json();

        // === LE LOG IMPORTANT EST ICI ===
        // Affiche exactement ce qui est reçu de l'API session/status
        console.log('[DEBUG proposer_trajet.js] Données de session reçues:', JSON.stringify(sessionData, null, 2));
        // ===========================

        // Vérifier si connecté ET si rôle chauffeur
        if (!sessionData.isLoggedIn || (sessionData.role !== 'chauffeur' && sessionData.role !== 'passager_chauffeur')) {
            console.log("Utilisateur non connecté ou rôle insuffisant. Role reçu:", sessionData.role); // Log ajouté ici aussi
            messageArea.innerHTML = '<div class="alert alert-danger">Accès refusé. Vous devez être connecté en tant que chauffeur pour proposer un trajet. Redirection...</div>';
            // Désactiver le formulaire en cas d'erreur
             proposeForm.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
            setTimeout(() => { window.location.href = '/HTML/connexion.html'; }, 3000);
            return; // Bloquer le reste
        }
        console.log("Utilisateur connecté et rôle chauffeur confirmé.");

        // Charger les véhicules de l'utilisateur
        console.log("Chargement des véhicules...");
        const vehiclesResponse = await fetch('/api/vehicules/me');
        if (!vehiclesResponse.ok) { throw new Error("Impossible de charger les véhicules"); }
        userVehicles = await vehiclesResponse.json();
        console.log("Véhicules reçus:", userVehicles);

        // Remplir la liste déroulante des véhicules
        vehiculeSelect.innerHTML = '<option value="" selected disabled>-- Choisissez votre véhicule --</option>'; // Option par défaut
        if (userVehicles.length === 0) {
            vehiculeSelect.innerHTML = '<option value="" selected disabled>Vous n\'avez aucun véhicule ! Ajoutez-en un via Mon Compte.</option>';
            proposeForm.querySelector('button[type="submit"]').disabled = true; // Désactiver soumission si pas de véhicule
        } else {
            userVehicles.forEach(v => {
                const option = document.createElement('option');
                option.value = v.id; // La valeur sera l'ID du véhicule
                option.textContent = `${v.marque || '?'} ${v.modele || '?'} (${v.plaque_immat || 'N/A'}) - ${v.nb_places || '?'} places`;
                vehiculeSelect.appendChild(option);
            });
             proposeForm.querySelector('button[type="submit"]').disabled = false; // Activer soumission
        }

    } catch (error) {
        console.error("Erreur lors de la vérification initiale ou du chargement des véhicules:", error);
        messageArea.innerHTML = `<div class="alert alert-danger">Erreur au chargement : ${error.message}. Vous allez être redirigé.</div>`;
        proposeForm.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
        setTimeout(() => { window.location.href = '/HTML/connexion.html'; }, 3000);
        return;
    }

    // --- Gérer la soumission du formulaire ---
    proposeForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log("Soumission formulaire proposer trajet");
        messageArea.innerHTML = '<div class="alert alert-info">Enregistrement du trajet...</div>';

        // Récupérer toutes les valeurs
        const rideData = {
            depart: departInput.value.trim(),
            arrivee: arriveeInput.value.trim(),
            date_depart: dateDepartInput.value, // Le format doit être YYYY-MM-DDTHH:MM
            date_arrivee: dateArriveeInput.value,
            prix: parseFloat(prixInput.value),
            places_offertes: parseInt(placesInput.value, 10),
            selected_vehicule_id: parseInt(vehiculeSelect.value, 10)
        };
        console.log("Données du trajet à envoyer:", rideData);

        // Validation simple front-end
        if (!rideData.depart || !rideData.arrivee || !rideData.date_depart || !rideData.date_arrivee || isNaN(rideData.prix) || rideData.prix <= 0 || isNaN(rideData.places_offertes) || rideData.places_offertes <= 0 || isNaN(rideData.selected_vehicule_id)) {
            messageArea.innerHTML = '<div class="alert alert-warning">Veuillez remplir tous les champs correctement (prix et places doivent être positifs, véhicule sélectionné).</div>';
            return;
        }
        if (new Date(rideData.date_arrivee) <= new Date(rideData.date_depart)) {
             messageArea.innerHTML = '<div class="alert alert-warning">La date d\'arrivée doit être après la date de départ.</div>';
             return;
        }
         const selectedVehicleData = userVehicles.find(v => v.id === rideData.selected_vehicule_id);
         if (selectedVehicleData && rideData.places_offertes > selectedVehicleData.nb_places) {
            messageArea.innerHTML = `<div class="alert alert-warning">Le nombre de places (${rideData.places_offertes}) dépasse la capacité du véhicule sélectionné (${selectedVehicleData.nb_places}).</div>`;
            return;
         }

        // Appeler l'API POST /api/covoiturages
        try {
            const response = await fetch('/api/covoiturages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rideData)
            });
            const responseData = await response.json();
            console.log("Réponse API création covoiturage:", responseData);

            if (response.ok && response.status === 201) {
                messageArea.innerHTML = `<div class="alert alert-success">${responseData.message || 'Trajet créé avec succès !'} Vous pouvez proposer un autre trajet ou retourner à l'accueil.</div>`;
                proposeForm.reset(); // Vider le formulaire
                // Re-remplir la liste des véhicules au cas où (même si elle ne change pas ici)
                 vehiculeSelect.innerHTML = '<option value="" selected disabled>-- Choisissez votre véhicule --</option>';
                 userVehicles.forEach(v => {
                    const option = document.createElement('option');
                    option.value = v.id;
                    option.textContent = `${v.marque || '?'} ${v.modele || '?'} (${v.plaque_immat || 'N/A'}) - ${v.nb_places || '?'} places`;
                    vehiculeSelect.appendChild(option);
                 });

            } else {
                messageArea.innerHTML = `<div class="alert alert-danger">${responseData.message || 'Erreur lors de la création du trajet.'}</div>`;
            }
        } catch (error) {
            console.error("Erreur fetch création covoiturage:", error);
            messageArea.innerHTML = '<div class="alert alert-danger">Erreur réseau lors de la création du trajet.</div>';
        }
    }); // Fin du listener submit

}); // Fin du DOMContentLoaded