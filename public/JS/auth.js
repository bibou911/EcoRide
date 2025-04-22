// public/JS/auth.js

// Fonction pour mettre à jour la barre de navigation en fonction de l'état de connexion
async function updateNavbar() {
    console.log("Mise à jour de la Navbar demandée.");
    // Récupérer les éléments de la navbar par leur ID
    const navAuthLinks = document.getElementById('nav-auth-links');
    const navConnexion = document.getElementById('nav-connexion');
    const navInscription = document.getElementById('nav-inscription');
    const navWelcome = document.getElementById('nav-welcome');
    const navPseudo = document.getElementById('nav-pseudo');
    const navMonCompte = document.getElementById('nav-mon-compte');
    const navLogout = document.getElementById('nav-logout');
    const logoutButton = document.getElementById('logout-button');

    // Vérifier si tous les éléments existent (sécurité)
    if (!navAuthLinks || !navConnexion || !navInscription || !navWelcome || !navPseudo || !navMonCompte || !navLogout || !logoutButton) {
        console.error("Erreur: Un ou plusieurs éléments de la navbar sont manquants dans le HTML.");
        return;
    }

    try {
        // Appeler l'API pour connaître l'état de la session
        const response = await fetch('/api/session/status');
        if (!response.ok) {
            // Si l'API renvoie une erreur, on suppose déconnecté par sécurité
             console.error("Erreur lors de la récupération du statut de session:", response.status);
             throw new Error('Erreur statut session');
        }

        const data = await response.json();
        console.log("Statut de session reçu:", data);

        if (data.isLoggedIn && data.pseudo) {
            // === Utilisateur CONNECTÉ ===
            console.log("Utilisateur connecté:", data.pseudo);
            // Cacher les liens Connexion/Inscription
            navConnexion.classList.add('d-none');
            navInscription.classList.add('d-none');
            // Afficher les liens/infos utilisateur connecté
            navWelcome.classList.remove('d-none');
            navMonCompte.classList.remove('d-none');
            navLogout.classList.remove('d-none');
            // Mettre à jour le pseudo
            navPseudo.textContent = data.pseudo;

            // Ajouter l'écouteur pour le bouton Déconnexion (s'il n'est pas déjà là)
            // On le fait ici pour être sûr que le bouton est visible quand on ajoute l'écouteur
             if (!logoutButton.dataset.listenerAttached) { // Evite d'ajouter l'écouteur plusieurs fois
                logoutButton.addEventListener('click', handleLogout);
                logoutButton.dataset.listenerAttached = 'true'; // Marquer comme attaché
             }

        } else {
            // === Utilisateur DÉCONNECTÉ ===
            console.log("Utilisateur déconnecté.");
            // Afficher les liens Connexion/Inscription
            navConnexion.classList.remove('d-none');
            navInscription.classList.remove('d-none');
            // Cacher les liens/infos utilisateur connecté
            navWelcome.classList.add('d-none');
            navMonCompte.classList.add('d-none');
            navLogout.classList.add('d-none');
            // Vider le pseudo (au cas où)
            navPseudo.textContent = '';
             // Optionnel: enlever l'écouteur du bouton logout s'il existe
            // logoutButton.removeEventListener('click', handleLogout);
            // delete logoutButton.dataset.listenerAttached;
        }

    } catch (error) {
        console.error("Impossible de vérifier le statut de la session:", error);
        // En cas d'erreur, afficher l'état déconnecté par défaut/sécurité
        if (navConnexion) navConnexion.classList.remove('d-none');
        if (navInscription) navInscription.classList.remove('d-none');
        if (navWelcome) navWelcome.classList.add('d-none');
        if (navMonCompte) navMonCompte.classList.add('d-none');
        if (navLogout) navLogout.classList.add('d-none');
    }
}

// Fonction pour gérer la déconnexion
async function handleLogout() {
    console.log("Tentative de déconnexion...");
    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        const data = await response.json();

        if (response.ok) {
            console.log("Déconnexion réussie:", data.message);
            // Mettre à jour immédiatement la navbar et rediriger
            updateNavbar(); // Met à jour l'affichage des liens
            // Optionnel : rediriger vers l'accueil ou la page de connexion
            // window.location.href = '/';
            alert("Vous avez été déconnecté."); // Simple alerte pour confirmation
        } else {
             console.error("Erreur lors de la déconnexion:", data.message);
             alert(`Erreur lors de la déconnexion: ${data.message || 'Erreur inconnue'}`);
        }
    } catch (error) {
        console.error("Erreur réseau lors de la déconnexion:", error);
        alert("Erreur réseau lors de la déconnexion.");
    }
}

// Exécuter la mise à jour de la navbar une fois que le HTML est chargé
document.addEventListener('DOMContentLoaded', updateNavbar);
