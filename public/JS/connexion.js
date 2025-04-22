// public/JS/connexion.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("connexion.js chargé et DOM prêt.");

    // Récupérer les éléments du formulaire et la zone de message
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email-login-input');
    const passwordInput = document.getElementById('password-login-input');
    const messageArea = document.getElementById('message-area-login');

    if (!loginForm || !emailInput || !passwordInput || !messageArea) {
        console.error("ERREUR: Le formulaire de connexion ou un de ses éléments est manquant. Vérifiez les IDs dans connexion.html.");
        return;
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Empêcher le rechargement de la page
        console.log("Formulaire de connexion soumis.");

        // Effacer les anciens messages
        messageArea.innerHTML = '';
        messageArea.className = '';

        // Récupérer les valeurs saisies
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Validation simple
        if (!email || !password) {
            messageArea.innerHTML = '<div class="alert alert-warning">Veuillez remplir l\'email et le mot de passe.</div>';
            return;
        }

        // Préparer les données à envoyer
        const loginData = { email, password };
        console.log("Données envoyées à l'API login:", { email: loginData.email, password: '***' });

        // Appeler l'API de connexion (POST /api/login)
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });

            const responseData = await response.json(); // Toujours lire la réponse JSON
            console.log("Réponse de l'API login:", responseData);

            if (response.ok && response.status === 200) { // Statut 200 OK pour succès connexion
                // === Connexion réussie ! ===
                messageArea.innerHTML = `<div class="alert alert-success">${responseData.message || 'Connexion réussie !'} Redirection vers l'accueil...</div>`;
                console.log("Utilisateur connecté:", responseData.user); // Afficher les infos user reçues

                // TODO IMPORTANT pour la suite :
                // Ici, il faudrait stocker une information indiquant que l'utilisateur est connecté
                // (par exemple, un token JWT reçu du serveur et stocké dans localStorage/sessionStorage,
                // ou se baser sur un cookie de session créé par le serveur).
                // Pour l'instant, on redirige simplement.

                // Rediriger vers la page d'accueil après un court délai
                setTimeout(() => {
                   window.location.href = '/'; // Redirige vers la page d'accueil
                }, 1500); // Attendre 1.5 secondes

            } else {
                // === Erreur de connexion (email/mdp incorrect, etc.) ===
                console.error("Erreur API login:", responseData.message);
                messageArea.innerHTML = `<div class="alert alert-danger">${responseData.message || 'Erreur de connexion.'}</div>`;
            }

        } catch (error) {
            // Erreur réseau ou autre problème avec fetch
            console.error('Erreur lors de l\'appel fetch pour la connexion :', error);
            messageArea.innerHTML = '<div class="alert alert-danger">Impossible de contacter le serveur pour la connexion.</div>';
        }
    });
});