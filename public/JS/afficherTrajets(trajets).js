function afficherTrajets(trajets) {
    const container = document.getElementById('results');
    container.innerHTML = ''; // Vide les anciens résultats

    if (!trajets || trajets.length === 0) {
        container.innerHTML = '<p>Aucun trajet trouvé.</p>';
        return;
    }

    trajets.forEach(trajet => {
        const card = document.createElement('div');
        card.className = 'card mb-3';

        card.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${trajet.depart} ➜ ${trajet.arrivee}</h5>
                <p class="card-text">
                    <strong>Départ :</strong> ${trajet.date_depart}<br>
                    <strong>Arrivée :</strong> ${trajet.date_arrivee}<br>
                    <strong>Prix :</strong> ${trajet.prix} €<br>
                    <strong>Places restantes :</strong> ${trajet.place_restante}<br>
                    <strong>Véhicule :</strong> ${trajet.marque} ${trajet.modele} (${trajet.energie})<br>
                    <strong>Conducteur ID :</strong> ${trajet.conducteur_id}<br>
                    <strong>Note :</strong> ${trajet.conducteur_note}/5<br>
                    ${trajet.is_ecologique == 1 ? '<span style="color:green;">🌱 Écologique</span>' : ''}
                </p>
            </div>
        `;

        container.appendChild(card);
    });
}
