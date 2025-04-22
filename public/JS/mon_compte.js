// public/JS/mon_compte.js - VERSION 10 (Adapté à server.js pour Préférences)

document.addEventListener('DOMContentLoaded', async () => {
    console.log("mon_compte.js DEBUG v10 chargé et DOM prêt.");

    // --- Récupérer les éléments HTML ---
    const infoDiv = document.getElementById('compte-info');
    const roleDiv = document.getElementById('compte-role-selection');
    const chauffeurSection = document.getElementById('chauffeur-section');
    const vehiculesDiv = document.getElementById('vehicules-liste');
    const preferencesFormContainer = document.getElementById('preferences-form-container'); // Le conteneur

    // Éléments pour l'ajout de véhicule
    const btnAjouterVehicule = document.getElementById('btn-ajouter-vehicule');
    const addVehicleModalEl = document.getElementById('addVehicleModal');
    const addVehicleForm = document.getElementById('add-vehicle-form');
    const addVehicleMessageArea = document.getElementById('add-vehicle-message-area');
    let addVehicleModalInstance = null;

    if (addVehicleModalEl) {
        addVehicleModalInstance = new bootstrap.Modal(addVehicleModalEl);
    }

    // Vérification initiale des éléments essentiels
    if (!infoDiv || !roleDiv || !chauffeurSection || !vehiculesDiv || !preferencesFormContainer || !btnAjouterVehicule || !addVehicleModalEl || !addVehicleForm || !addVehicleMessageArea) {
        console.error("Arrêt script: Éléments HTML essentiels manquants.");
        if(infoDiv) infoDiv.innerHTML = '<div class="alert alert-danger">Erreur: Structure page HTML incomplète.</div>';
        return;
    }

    // --- Fonctions pour les VÉHICULES ---
    async function loadUserVehicles() {
         console.log("[DEBUG] Appel de loadUserVehicles().");
         if (!vehiculesDiv) { console.error("Erreur: #vehicules-liste non trouvé."); return; }
         vehiculesDiv.innerHTML = '<p>Chargement des véhicules...</p>';
         try {
             // API confirmée dans server.js
             const response = await fetch('/api/vehicules/me');
             console.log("[DEBUG] Statut réponse /api/vehicules/me:", response.status);
             if (!response.ok) { throw new Error((await response.json().catch(()=>({message: `Erreur HTTP ${response.status}`})))?.message || `Erreur HTTP ${response.status}`); }
             const vehicules = await response.json();
             console.log("[DEBUG] Véhicules reçus:", vehicules);
             vehiculesDiv.innerHTML = '';
             if (vehicules.length === 0) {
                 vehiculesDiv.innerHTML = '<p>Vous n\'avez pas encore ajouté de véhicule.</p>';
             } else {
                 const listHtml = vehicules.map(v => `
                     <div class="card mb-2 shadow-sm">
                         <div class="card-body">
                             <h6 class="card-title">${v.marque || '?'} ${v.modele || '?'} (${v.couleur || 'N/A'})</h6>
                             <p class="card-text mb-1">
                                 Immat: ${v.plaque_immat || 'N/A'} | Places: ${v.nb_places || '?'} | Énergie: ${v.energie || 'N/A'}
                                 ${v.date_premiere_immat ? `<br>1ère immat: ${new Date(v.date_premiere_immat).toLocaleDateString('fr-FR')}` : ''}
                             </p>
                             <button class="btn btn-sm btn-outline-secondary" disabled>Modifier (Bientôt)</button>
                             <button class="btn btn-sm btn-outline-danger" disabled>Supprimer (Bientôt)</button>
                         </div>
                     </div>
                 `).join('');
                 vehiculesDiv.innerHTML = listHtml;
             }
         } catch (error) {
             console.error("Erreur lors du chargement des véhicules:", error);
             vehiculesDiv.innerHTML = `<p class="text-danger">Impossible de charger les véhicules: ${error.message}</p>`;
         }
    }

    if (btnAjouterVehicule && addVehicleModalInstance) {
        btnAjouterVehicule.addEventListener('click', () => {
            console.log("Clic sur 'Ajouter un véhicule'");
            addVehicleForm.reset();
            addVehicleMessageArea.innerHTML = '';
            addVehicleModalInstance.show();
        });
    } else { console.warn("[DEBUG] Bouton Ajouter Véhicule ou Instance Modale non trouvés"); }

    if (addVehicleForm && addVehicleModalInstance) {
        addVehicleForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log("Soumission formulaire ajout véhicule");
            addVehicleMessageArea.innerHTML = '<div class="text-info">Enregistrement...</div>';
            const vehicleData = {
                marque: document.getElementById('add-marque').value.trim(),
                modele: document.getElementById('add-modele').value.trim(),
                nb_places: parseInt(document.getElementById('add-nb_places').value, 10),
                plaque_immat: document.getElementById('add-plaque').value.trim() || null,
                couleur: document.getElementById('add-couleur').value.trim() || null,
                energie: document.getElementById('add-energie').value || null, // Champ select, vide = null
                date_premiere_immat: document.getElementById('add-date_immat').value || null
            };
             // Validation incluant l'énergie (obligatoire d'après le HTML corrigé)
             if (!vehicleData.marque || !vehicleData.modele || !vehicleData.nb_places || vehicleData.nb_places <= 0 || !vehicleData.energie) {
                 addVehicleMessageArea.innerHTML = '<div class="alert alert-warning">Marque, modèle, nombre de places positif et énergie sont requis.</div>'; return;
             }
             if (!vehicleData.date_premiere_immat) { vehicleData.date_premiere_immat = null; }

            try {
                // API confirmée dans server.js
                const response = await fetch('/api/vehicules/me', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(vehicleData)
                });
                const responseData = await response.json();
                 if (response.ok && response.status === 201) {
                    addVehicleMessageArea.innerHTML = `<div class="alert alert-success">${responseData.message || 'Véhicule ajouté !'}</div>`;
                    setTimeout(() => {
                        addVehicleModalInstance.hide();
                        loadUserVehicles(); // Rafraîchir la liste !
                    }, 1000);
                } else { addVehicleMessageArea.innerHTML = `<div class="alert alert-danger">${responseData.message || 'Erreur ajout.'}</div>`; }
            } catch (error) { addVehicleMessageArea.innerHTML = '<div class="alert alert-danger">Erreur réseau.</div>'; console.error("Erreur fetch ajout véhicule:", error); }
        });
    } else { console.warn("[DEBUG] Formulaire Ajout Véhicule ou Instance Modale non trouvés"); }


    // --- Fonctions pour les PRÉFÉRENCES CHAUFFEUR (Adaptées à server.js) ---

    // Fonction pour charger et afficher les préférences + attacher listeners
    // Prend les données utilisateur complètes en paramètre (incluant les prefs)
    function loadAndDisplayPreferences(userData) {
        console.log("[DEBUG] Affichage/Initialisation du formulaire de préférences.");
        if (!preferencesFormContainer) return;

        // Récupérer les éléments du formulaire (qui sont dans preferencesFormContainer)
        const form = document.getElementById('form-preferences-chauffeur');
        const fumeursCheckbox = document.getElementById('pref-fumeurs');
        const animauxCheckbox = document.getElementById('pref-animaux');
        const autresTextarea = document.getElementById('pref-autres');
        const messageArea = document.getElementById('prefs-message-area');

        if (!form || !fumeursCheckbox || !animauxCheckbox || !autresTextarea || !messageArea) {
            console.error("Erreur: Éléments du formulaire de préférences non trouvés. Vérifiez mon_compte.html.");
            // Afficher le formulaire même si les éléments internes manquent (pour debug)
            // Vous pouvez ajouter un message d'erreur ici si nécessaire.
            return;
        }

        // Nettoyer les messages précédents
        messageArea.innerHTML = '';

        // Remplir le formulaire avec les données utilisateur (userData)
        // server.js retourne 1 (pour true) / 0 (pour false) / NULL pour pref_fumeur/animaux
        console.log("[DEBUG] Préférences reçues pour affichage:", {
            fumeur: userData.pref_fumeur,
            animaux: userData.pref_animaux,
            autres: userData.pref_autres
        });
        fumeursCheckbox.checked = userData.pref_fumeur === 1;
        animauxCheckbox.checked = userData.pref_animaux === 1;
        autresTextarea.value = userData.pref_autres || ''; // Mettre chaîne vide si NULL

        // Supprimer les anciens listeners (sécurité si la fonction est appelée plusieurs fois)
        form.removeEventListener('submit', handleSavePreferences);
        // Attacher le listener de soumission
        form.addEventListener('submit', handleSavePreferences);
        console.log("[DEBUG] Formulaire préférences initialisé et listener attaché.");

    }

    // Fonction pour sauvegarder les préférences (Adaptée à server.js)
    async function handleSavePreferences(event) {
        event.preventDefault();
        console.log("[DEBUG] Sauvegarde des préférences...");

        const fumeursCheckbox = document.getElementById('pref-fumeurs');
        const animauxCheckbox = document.getElementById('pref-animaux');
        const autresTextarea = document.getElementById('pref-autres');
        const messageArea = document.getElementById('prefs-message-area');

        if (!fumeursCheckbox || !animauxCheckbox || !autresTextarea || !messageArea) {
             console.error("Erreur: Impossible de trouver les éléments du formulaire lors de la sauvegarde.");
             return;
        }

        messageArea.innerHTML = '<div class="text-info">Enregistrement...</div>';

        // Récupérer les valeurs actuelles du formulaire
        // Envoyer true/false pour les booléens, string ou null pour autres
        const dataToSave = {
            fumeur: fumeursCheckbox.checked,
            animaux: animauxCheckbox.checked,
            autres: autresTextarea.value.trim() || null // Envoyer null si vide
        };

        console.log("[DEBUG] Données préférences à envoyer:", dataToSave);

        try {
             // Utiliser l'URL et la méthode de votre server.js
             const response = await fetch('/api/utilisateurs/me/preferences', {
                 method: 'PATCH', // <- Méthode PATCH confirmée dans server.js
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(dataToSave)
             });
             // Tenter de lire la réponse JSON même si !response.ok
             const responseData = await response.json().catch(() => ({ message: `Erreur serveur ${response.status} (réponse non-JSON)` }));

             if (response.ok) {
                 messageArea.innerHTML = `<div class="alert alert-success">${responseData.message || 'Préférences enregistrées avec succès !'}</div>`;
             } else {
                 messageArea.innerHTML = `<div class="alert alert-danger">${responseData.message || `Erreur ${response.status} lors de l\'enregistrement.`}</div>`;
             }
        } catch (error) {
             console.error("Erreur réseau lors de la sauvegarde des préférences:", error);
             messageArea.innerHTML = '<div class="alert alert-danger">Erreur réseau lors de la sauvegarde.</div>';
        } finally {
             // Faire disparaître le message après 5 secondes
             setTimeout(() => { if (messageArea) messageArea.innerHTML = ''; }, 5000);
        }
    }


    // --- Fonctions pour le RÔLE et AFFICHAGE CONDITIONNEL ---
    // Modifiée pour accepter et passer userData
    function displayRoleForm(currentRole, userData) {
         console.log("[DEBUG] Appel displayRoleForm avec role:", currentRole);
         const currentRoleSafe = currentRole || 'passager';

         if (roleDiv) {
             roleDiv.innerHTML = `
                 <p>Choisissez votre rôle :</p>
                 <form id="role-form">
                     <div class="form-check"><input class="form-check-input" type="radio" name="roleOption" id="rolePassager" value="passager" ${currentRoleSafe === 'passager' ? 'checked' : ''}><label class="form-check-label" for="rolePassager">Passager uniquement</label></div>
                     <div class="form-check"><input class="form-check-input" type="radio" name="roleOption" id="roleChauffeur" value="chauffeur" ${currentRoleSafe === 'chauffeur' ? 'checked' : ''}><label class="form-check-label" for="roleChauffeur">Chauffeur uniquement</label></div>
                     <div class="form-check"><input class="form-check-input" type="radio" name="roleOption" id="rolePassagerChauffeur" value="passager_chauffeur" ${currentRoleSafe === 'passager_chauffeur' ? 'checked' : ''}><label class="form-check-label" for="rolePassagerChauffeur">Passager et Chauffeur</label></div>
                     <button type="submit" id="save-role-button" class="btn btn-primary mt-3">Enregistrer le rôle</button>
                     <div id="role-message-area" class="mt-2"></div>
                 </form>
             `;
             const roleForm = document.getElementById('role-form');
             // Passer currentUserData à handleSaveRole lors de l'attachement du listener
             if (roleForm) { roleForm.addEventListener('submit', (e) => handleSaveRole(e, userData)); }
         } else { console.error("[DEBUG] roleDiv est null dans displayRoleForm"); }

         if(chauffeurSection){
             console.log("[DEBUG] Vérif affichage section chauffeur pour rôle:", currentRoleSafe);
             if (currentRoleSafe === 'chauffeur' || currentRoleSafe === 'passager_chauffeur') {
                 console.log("[DEBUG] Affichage section chauffeur, appel loadUserVehicles() et loadAndDisplayPreferences()");
                 chauffeurSection.classList.remove('d-none');
                 loadUserVehicles(); // Charge les véhicules
                 // Appeler la fonction d'affichage des préférences avec les données utilisateur
                 if (userData) {
                    loadAndDisplayPreferences(userData);
                 } else {
                    console.warn("userData non disponible immédiatement pour charger les préférences");
                    // Option: Re-fetcher userData si vraiment nécessaire, mais normalement il est passé depuis le load initial
                 }
             } else {
                 console.log("[DEBUG] Masquage section chauffeur.");
                 chauffeurSection.classList.add('d-none');
             }
         } else { console.error("[DEBUG] chauffeurSection est null dans displayRoleForm"); }
     }

     // Modifiée pour accepter et utiliser currentUserData pour le réaffichage
     async function handleSaveRole(event, currentUserData) {
          event.preventDefault();
          const messageArea = document.getElementById('role-message-area');
          messageArea.innerHTML = '<div class="text-info">Enregistrement...</div>';
          const selectedRoleInput = document.querySelector('input[name="roleOption"]:checked');
          if (!selectedRoleInput) { messageArea.innerHTML = '<div class="alert alert-warning">Veuillez sélectionner un rôle.</div>'; return; }
          const newRole = selectedRoleInput.value;
          try {
              // API confirmée dans server.js
              const response = await fetch('/api/utilisateurs/me/role', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newRole: newRole }) });
              const responseData = await response.json().catch(()=>({})); // Gérer réponse non-JSON

              if (response.ok) {
                  messageArea.innerHTML = `<div class="alert alert-success">${responseData.message || 'Rôle mis à jour !'}</div>`;
                  const roleBadge = document.querySelector('#compte-info .badge');
                  if (roleBadge) { roleBadge.textContent = responseData.newRole || newRole; } // Utiliser la valeur retournée ou celle envoyée
                  // Mettre à jour les données utilisateur locales avant de réafficher
                  const updatedUserData = { ...currentUserData, role: responseData.newRole || newRole };
                   displayRoleForm(responseData.newRole || newRole, updatedUserData); // Ré-afficher avec données à jour
              } else { messageArea.innerHTML = `<div class="alert alert-danger">${responseData.message || `Erreur ${response.status} mise à jour.`}</div>`; }
          } catch (error) { messageArea.innerHTML = '<div class="alert alert-danger">Erreur réseau.</div>'; console.error("Erreur fetch MAJ rôle:", error); }
           finally {
               setTimeout(() => { if(messageArea) messageArea.innerHTML = ''; }, 5000);
           }
     }

    // --- Chargement initial des données utilisateur ---
    try {
        // Utiliser l'API confirmée GET /api/utilisateurs/me
        const response = await fetch('/api/utilisateurs/me');
        if (!response.ok) { throw new Error((await response.json().catch(()=>({}))).message || `Erreur HTTP ${response.status}`); }
        const userData = await response.json(); // Contient id, pseudo, email, credits, role, pref_fumeur, pref_animaux, pref_autres
        console.log("[DEBUG] Données utilisateur initiales (avec prefs) reçues:", userData);

        // Affichage infos générales
        infoDiv.innerHTML = `
            <p><strong>Pseudo :</strong> ${userData.pseudo || 'Non défini'}</p>
            <p><strong>Email :</strong> ${userData.email || 'Non défini'}</p>
            <p><strong>Crédits :</strong> ${userData.credits ?? '0'} crédits</p>
            <p><strong>Rôle actuel :</strong> <span class="badge bg-info">${userData.role || 'Non défini'}</span></p>
        `;
        // Affichage initial rôle + section chauffeur + chargement véhicules/prefs si besoin
        // Passer les userData complets à displayRoleForm pour qu'il puisse les passer à loadAndDisplayPreferences
        displayRoleForm(userData.role, userData);

    } catch (error) {
        console.error("[DEBUG] Erreur chargement initial:", error);
         infoDiv.innerHTML = `<div class="alert alert-danger">Impossible de charger les informations (${error.message}). Vérifiez que vous êtes connecté.</div>`;
         if(roleDiv) roleDiv.innerHTML = '';
         if(chauffeurSection) chauffeurSection.classList.add('d-none');
         // Optionnel : rediriger si non connecté après un délai
         // setTimeout(() => { window.location.href = '/HTML/connexion.html'; }, 3000);
    }
});