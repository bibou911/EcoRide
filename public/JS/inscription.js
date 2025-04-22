// public/JS/inscription.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("inscription.js chargé et DOM prêt.");

    // Récupérer les éléments du formulaire et la zone de message
    const registrationForm = document.getElementById('registration-form');
    const pseudoInput = document.getElementById('pseudo-input');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const confirmPasswordInput = document.getElementById('confirm-password-input');
    const messageArea = document.getElementById('message-area');

    // Vérifier si le formulaire existe avant d'ajouter l'écouteur
    if (registrationForm) {
        registrationForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Empêcher l'envoi classique du formulaire
            console.log("Formulaire d'inscription soumis.");

            // Effacer les anciens messages
            messageArea.innerHTML = '';
            messageArea.className = ''; // Réinitialiser les classes CSS

            // Récupérer les valeurs saisies
            const pseudo = pseudoInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value; // Pas de .trim() pour le mot de passe
            const confirmPassword = confirmPasswordInput.value;

            // 1. Validation Côté Client : Vérifier si les mots de passe correspondent
            if (password !== confirmPassword) {
                console.log("Erreur: Mots de passe non identiques.");
                messageArea.innerHTML = '<div class="alert alert-danger">Les mots de passe ne correspondent pas.</div>';
                return; // Arrêter le processus
            }

            // TODO: Ajouter d'autres validations si besoin (longueur mdp, format email...)

            // 2. Préparer les données à envoyer à l'API (seulement les données nécessaires)
            const userData = {
                pseudo: pseudo,
                email: email,
                password: password // On envoie le mot de passe en clair ici, le backend le hachera
            };
            console.log("Données envoyées à l'API:", { pseudo: userData.pseudo, email: userData.email, password: '***' });

            // 3. Appeler l'API backend avec fetch (méthode POST)
            try {
                const response = await fetch('/api/utilisateurs', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json' // Indiquer qu'on envoie du JSON
                    },
                    body: JSON.stringify(userData) // Convertir l'objet JS en chaîne JSON
                });

                // Récupérer la réponse JSON du serveur (même en cas d'erreur HTTP)
                const responseData = await response.json();
                console.log("Réponse de l'API:", responseData);

                // 4. Gérer la réponse du serveur
                if (response.ok && response.status === 201) { // Statut 201 Created = Succès
                    console.log("Inscription réussie !");
                    messageArea.innerHTML = `<div class="alert alert-success">${responseData.message || 'Inscription réussie !'} Redirection...</div>`;
                    // Optionnel: Vider le formulaire
                    registrationForm.reset();
                    // Optionnel: Rediriger vers la page de connexion ou d'accueil après un court délai
                     setTimeout(() => {
                        window.location.href = '/'; // ou '/connexion.html'
                     }, 2000); // Attendre 2 secondes
                } else {
                    // Erreur renvoyée par l'API (ex: 400, 409, 500)
                    console.error("Erreur API:", responseData.message);
                    messageArea.innerHTML = `<div class="alert alert-danger">${responseData.message || 'Une erreur est survenue.'}</div>`;
                }

            } catch (error) {
                // Erreur réseau ou autre problème avec fetch
                console.error('Erreur lors de l\'appel fetch :', error);
                messageArea.innerHTML = '<div class="alert alert-danger">Impossible de contacter le serveur. Vérifiez votre connexion ou réessayez plus tard.</div>';
            }
        });
    } else {
        console.error("Formulaire avec id='registration-form' non trouvé.");
    }
});