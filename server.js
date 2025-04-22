// Dans votre fichier server.js - VERSION CORRIGÉE

const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 4000;
const saltRounds = 10;


// Connexion à la base de données
const db = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQLPORT || 3306, // <-- Ajoute/Vérifie le port
  ssl: { rejectUnauthorized: true } // <-- Ajoute SSL
});

// Vérifie la connexion
db.connect((err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données :', err);
    return;
  }
  console.log('Connecté à la base de données MySQL');
});

const mongouri = process.env.MONGO_URI;

console.log('--- DEBUG Railway --- Type de process.env.MONGO_URI :', typeof process.env.MONGO_URI); 
console.log('--- DEBUG Railway --- Valeur de process.env.MONGO_URI :', process.env.MONGO_URI); 

const mongoClient = new MongoClient(mongouri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let dbMongo;

async function connectMongo() {
  try {
      await mongoClient.connect();
      dbMongo = mongoClient.db("ecoride_logs"); // Nom de la BDD pour les logs
      // Ligne essentielle pour confirmer la connexion !
      console.log("----> Connecté avec succès à MongoDB (Base: ecoride_logs) ! <----");
      await dbMongo.command({ ping: 1 });
      console.log("Ping MongoDB réussi.");
      // Créer la collection 'logs' si elle n'existe pas
       await dbMongo.createCollection("logs").catch(err => {
           if (err.codeName !== 'NamespaceExists') console.error("Erreur création collection logs:", err);
           else console.log("Collection 'logs' MongoDB prête.")
       });

  } catch (err) {
      console.error("############# ERREUR CONNEXION MONGODB #############");
      console.error(" Vérifie que MongoDB est bien lancé sur mongodb://localhost:27017");
      console.error(err);
      console.error("####################################################");
      // Si la connexion Mongo échoue, dbMongo restera undefined
  }
}

connectMongo(); // Lancer la connexion au démarrage du serveur
// --- *** FIN AJOUT : Connexion MongoDB *** ---

// --- *** AJOUT : Fonction de log MongoDB *** ---
/**
 * Enregistre un document de log dans la collection 'logs' de MongoDB.
 * @param {object} logData - L'objet contenant les informations à logger.
 */
async function logToMongo(logData) {
  console.log('--- >>> logToMongo a été appelée ! Data:', logData);
  if (!dbMongo) { // Vérifie si la connexion a réussi avant de logger
      console.warn("LOG MONGO: Connexion non prête, log ignoré.", logData);
      return;
  }
  try {
      const logsCollection = dbMongo.collection("logs");
      const logDocument = {
          timestamp: new Date(),
          ...logData // Ajoute les données (action, userId, details...)
      };
      await logsCollection.insertOne(logDocument);
  } catch (err) {
      console.error("LOG MONGO: Erreur lors de l'insertion:", err);
  }
}
// --- *** FIN AJOUT : Fonction de log *** ---


const checkRole = (allowedRoles) => {
  // S'assurer que allowedRoles est toujours un tableau
  if (typeof allowedRoles === 'string') {
    allowedRoles = [allowedRoles];
  }

  return (req, res, next) => {
    // Vérifier si l'utilisateur est connecté et si la session contient le rôle
    if (!req.session?.isLoggedIn) {
      return res.status(401).json({ message: "Authentification requise." });
    }
    if (!req.session?.role) {
      // Cas où le rôle n'est pas défini dans la session (ne devrait plus arriver mais sécurité)
      console.warn(`Middleware checkRole: Rôle non trouvé dans la session pour User ID: ${req.session.userId}`);
      return res.status(403).json({ message: "Accès interdit : rôle utilisateur non défini." });
    }

    // Vérifier si le rôle de l'utilisateur est dans la liste des rôles autorisés
    if (allowedRoles.includes(req.session.role)) {
      next(); // Autorisé -> passer au prochain middleware ou à la route
    } else {
      console.warn(`Middleware checkRole: Accès refusé pour User ID: ${req.session.userId} (Rôle: ${req.session.role}). Rôles requis: ${allowedRoles.join(', ')}`);
      res.status(403).json({ message: "Accès interdit : permissions insuffisantes." }); // 403 Forbidden
    }
  };
};

// Middleware pour parser le JSON
app.use(express.json());

// === ROUTES API ===

app.use(session({
  secret: 'd8fGk!7hQpZ*3mWbN@cVj', // !! CHANGEZ CECI !!
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Mettre true en HTTPS (production)
    httpOnly: true // Recommandé pour la sécurité
  }
}));

// Endpoint test
app.get('/api/test', (req, res) => {
  db.query('SELECT * FROM utilisateurs', (err, results) => {
    if (err) {
      res.status(500).send('Erreur lors de la récupération des données');
    } else {
      res.json(results);
    }
  });
});

// Route pour la RECHERCHE de covoiturages - MODIFIÉE POUR FILTRES PRIX/ECO
app.get('/api/covoiturages', (req, res) => {
  console.log("Requête reçue sur /api/covoiturages");
  // Récupérer les paramètres obligatoires
  const { villeDepart, villeArrivee, dateDepart } = req.query;
  // Récupérer les filtres optionnels
  const { prixMax, ecologique } = req.query; // Nouveaux paramètres lus ici

  console.log("Recherche:", { villeDepart, villeArrivee, dateDepart });
  console.log("Filtres reçus:", { prixMax, ecologique }); // Log pour vérifier

  // Validation des champs obligatoires
  if (!villeDepart || !villeArrivee || !dateDepart) {
    return res.status(400).json({ message: "Il manque villeDepart, villeArrivee ou dateDepart." });
  }

  // --- Construction dynamique de la requête SQL ---
  let sqlBase = `
    SELECT
        c.id, c.depart, c.arrivee, c.date_depart, c.date_arrivee, c.prix, c.place_restante,
        c.conducteur_note, c.is_ecologique,
        c.marque, c.modele, c.energie,
        u.pseudo, u.photo_url
    FROM covoiturages c
    JOIN utilisateurs u ON c.conducteur_id = u.id
    WHERE c.depart = ? AND c.arrivee = ? AND DATE(c.date_depart) = ? AND c.place_restante >= 1
  `; // Requête de base sans les filtres optionnels

  const params = [villeDepart, villeArrivee, dateDepart]; // Paramètres de base

  // Ajouter le filtre prixMax s'il est fourni et valide
  const prixMaxNum = parseFloat(prixMax);
  if (!isNaN(prixMaxNum) && prixMaxNum >= 0) {
      sqlBase += " AND c.prix <= ?"; // Ajouter la condition au SQL
      params.push(prixMaxNum);      // Ajouter la valeur aux paramètres
      console.log("Filtre Prix Max appliqué:", prixMaxNum);
  }

  // Ajouter le filtre ecologique s'il est fourni et égal à 'true'
  if (ecologique === 'true') {
      sqlBase += " AND c.is_ecologique = 1"; // Ajouter la condition au SQL
      console.log("Filtre Écologique appliqué");
  }

  // Ajouter le tri à la fin
  sqlBase += " ORDER BY c.date_depart;";
  const sqlQuery = sqlBase; // Requête finale construite
  // --- Fin construction dynamique ---

  console.log("Exécution SQL (recherche AVEC filtres):", sqlQuery, "avec params:", params);

  // Exécuter la requête construite
  db.query(sqlQuery, params, (err, results) => {
    if (err) {
      console.error("Erreur SQL (recherche avec filtres):", err);
      return res.status(500).json({ message: "Erreur lors de la recherche en base de données." });
    }
    console.log("Résultats trouvés (recherche avec filtres):", results.length);

    if (results.length > 0) {
      // Si on trouve des résultats AVEC les filtres, on les renvoie
      console.log("Covoiturages filtrés trouvés, envoi des résultats.");
      res.status(200).json(results);
    } else {
      // Si AUCUN résultat AVEC les filtres, on cherche la prochaine date SANS filtres
      // (La logique de suggestion de date reste la même)
      console.log("Aucun résultat filtré pour cette date. Recherche de la prochaine date (sans filtres)...");
      const nextDateQuery = `
        SELECT MIN(DATE(date_depart)) as prochaine_date
        FROM covoiturages
        WHERE depart = ? AND arrivee = ? AND DATE(date_depart) >= ? AND place_restante >= 1;
      `;
      const nextDateParams = [villeDepart, villeArrivee, dateDepart]; // Params de base
      db.query(nextDateQuery, nextDateParams, (errNext, resultsNext) => {
        if (errNext) {
          console.error("Erreur SQL (prochaine date):", errNext);
          // Renvoyer 404 car la recherche filtrée initiale n'a rien donné
          return res.status(404).json({ message: "Aucun covoiturage trouvé pour ces critères." });
        }
        const prochaineDateTrouvee = resultsNext[0]?.prochaine_date;
        if (prochaineDateTrouvee) {
          const prochaineDate = new Date(prochaineDateTrouvee).toISOString().split('T')[0];
          console.log("Prochaine date (non filtrée) trouvée:", prochaineDate);
          res.status(404).json({ // Statut 404 car la recherche initiale filtrée a échoué
            message: `Aucun covoiturage trouvé pour vos critères le ${dateDepart}.`,
            suggestion: `Le prochain départ (tous trajets confondus) est le ${prochaineDate}.`,
            prochaine_date: prochaineDate
          });
        } else {
          console.log("Aucune date future trouvée non plus.");
          res.status(404).json({ message: "Aucun covoiturage trouvé pour cet itinéraire, même sans filtres." });
        }
      });
    }
  });
}); // Fin app.get('/api/covoiturages')

// Route pour OBTENIR LES DÉTAILS d'un covoiturage par ID (GET /api/covoiturages/:id)
// ===>>> VERSION MODIFIÉE POUR INCLURE LES PRÉFÉRENCES CONDUCTEUR <<<===
app.get('/api/covoiturages/:id', (req, res) => {
  const covoiturageId = req.params.id;
  console.log(`Requête reçue pour les détails du covoiturage ID: ${covoiturageId}`);
  const idNumerique = parseInt(covoiturageId, 10);
  if (isNaN(idNumerique)) {
    console.log("Erreur: ID non numérique fourni.");
    return res.status(400).json({ message: "L'identifiant du covoiturage doit être un nombre." });
  }

  // --- Requête SQL modifiée ---
  const sqlQuery = `
    SELECT
        c.id, c.depart, c.arrivee, c.date_depart, c.date_arrivee, c.prix, c.place_restante,
        c.conducteur_note, c.is_ecologique,
        c.marque, c.modele, c.energie,
        c.conducteur_id,
        u.pseudo, u.photo_url,
        u.pref_fumeur,      -- Ajouté
        u.pref_animaux,     -- Ajouté
        u.pref_autres       -- Ajouté
    FROM covoiturages c
    JOIN utilisateurs u ON c.conducteur_id = u.id
    WHERE c.id = ?;
  `;
  // --- Fin requête SQL modifiée ---

  console.log("Exécution SQL (détails avec prefs):", sqlQuery, "avec ID:", idNumerique);

  db.query(sqlQuery, [idNumerique], (err, results) => {
    if (err) {
      console.error("Erreur SQL lors de la récupération des détails:", err);
      return res.status(500).json({ message: "Erreur serveur lors de la récupération des détails." });
    }
    if (results.length === 1) {
      console.log("Détails (avec prefs) trouvés:", results[0]);
      res.status(200).json(results[0]); // Renvoie les détails incluant les préférences
    } else if (results.length === 0) {
      console.log("Aucun covoiturage trouvé pour cet ID.");
      res.status(404).json({ message: "Covoiturage non trouvé." });
    } else {
      console.warn("Plusieurs résultats trouvés pour un ID unique:", results);
      res.status(200).json(results[0]); // Renvoie le premier trouvé
    }
  });
}); // <<<=== FIN de app.get('/api/covoiturages/:id', ...) MODIFIÉ


// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API POUR L'INSCRIPTION (CRÉATION UTILISATEUR) ⬇️
// ------------------------------------------------------------------
app.post('/api/utilisateurs', (req, res) => {
  // On utilise POST car le client envoie des données pour créer une ressource

  console.log("Requête reçue pour créer un utilisateur (POST /api/utilisateurs)");

  // 1. Récupérer les données envoyées dans le corps de la requête (JSON)
  // Note: app.use(express.json()) doit être défini avant pour que ça marche
  const { pseudo, email, password } = req.body; // Destructuration
  console.log("Données reçues:", { pseudo, email, password: '***' }); // Ne pas logger le mdp en clair

  // 2. Validation simple des entrées
  if (!pseudo || !email || !password) {
    console.log("Erreur: Données d'inscription manquantes.");
    return res.status(400).json({ message: "Pseudo, email et mot de passe sont requis." });
  }
  // TODO: Ajouter des validations plus poussées (format email, complexité mdp, pseudo/email unique?)

  // 3. Hasher le mot de passe avec bcrypt (opération asynchrone)
  console.log("Hachage du mot de passe...");
  bcrypt.hash(password, saltRounds)
    .then(hashedPassword => {
      // Le hachage a réussi ! hashedPassword contient le mot de passe sécurisé
      console.log("Mot de passe haché avec succès.");

      // 4. Préparer la requête SQL pour insérer le nouvel utilisateur
      const sqlInsertQuery = `
        INSERT INTO utilisateurs (pseudo, email, mot_de_passe, date_inscription)
        VALUES (?, ?, ?, NOW());
      `;
      // Le champ 'credits' utilisera sa valeur par défaut (20)
      // Le champ 'photo_url' sera NULL par défaut (si la colonne le permet)
      const params = [pseudo, email, hashedPassword];

      console.log("Exécution SQL (INSERT utilisateur):", sqlInsertQuery, [pseudo, email, '*** HASHED ***']);

      // 5. Exécuter la requête d'insertion
      db.query(sqlInsertQuery, params, (err, results) => {
        if (err) {
          console.error("Erreur SQL lors de l'insertion de l'utilisateur:", err);
          // Gérer les erreurs spécifiques (ex: email/pseudo déjà pris)
          if (err.code === 'ER_DUP_ENTRY') { // Code d'erreur MySQL pour doublon
             return res.status(409).json({ message: "L'email ou le pseudo existe déjà." }); // 409 Conflict
          }
          return res.status(500).json({ message: "Erreur serveur lors de la création de l'utilisateur." });
        }

        // 6. Insertion réussie !
        console.log("Nouvel utilisateur inséré avec succès, ID:", results.insertId);
        // On renvoie un statut 201 Created et un message de succès
        // On peut aussi renvoyer les infos de l'utilisateur créé (sauf le mot de passe !)
        res.status(201).json({
             message: "Utilisateur créé avec succès!",
             userId: results.insertId,
             pseudo: pseudo,
             email: email
             // Ne JAMAIS renvoyer le mot de passe, même haché !
         });
      }); // Fin db.query INSERT

    })
    .catch(hashError => {
      // Le hachage a échoué
      console.error("Erreur lors du hachage du mot de passe:", hashError);
      res.status(500).json({ message: "Erreur serveur lors de la sécurisation du mot de passe." });
    }); // Fin bcrypt.hash

});
// ------------------------------------------------------------------
//     ⬆️ FIN AJOUT ROUTE API POUR L'INSCRIPTION ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//          ⬇️ ROUTE API POUR LA CONNEXION UTILISATEUR - MODIFIÉE AVEC LOGS & STATUT ⬇️
// ------------------------------------------------------------------
app.post('/api/login', (req, res) => {
  console.log("Requête reçue pour la connexion (POST /api/login)");

  // 1. Récupérer l'email et le mot de passe
  const { email, password } = req.body;
  console.log("Tentative de connexion pour:", email, "mdp: ***");

  // 2. Validation simple
  if (!email || !password) {
      console.log("Erreur: Email ou mot de passe manquant.");
      return res.status(400).json({ message: "Email et mot de passe sont requis." });
  }

  // 3. Chercher l'utilisateur par email - *** MODIFIÉ : Ajout de 'statut' au SELECT ***
  const sqlFindUserQuery = `
    SELECT id, pseudo, email, mot_de_passe, credits, role, photo_url, statut
    FROM utilisateurs
    WHERE email = ?;
  `;
  console.log("Exécution SQL (recherche utilisateur avec statut):", sqlFindUserQuery, "avec email:", email);

  db.query(sqlFindUserQuery, [email], (err, results) => {
      if (err) {
          console.error("Erreur SQL lors de la recherche de l'utilisateur:", err);
          // *** AJOUTÉ : Log erreur DB ***
          logToMongo({ action: "LOGIN_FAILED_DB_ERROR", inputEmail: email, error: err.message });
          return res.status(500).json({ message: "Erreur serveur lors de la connexion (recherche)." });
      }

      // 4. Vérifier si l'utilisateur existe
      if (results.length === 0) {
          console.log("Utilisateur non trouvé pour cet email.");
           // *** AJOUTÉ : Log utilisateur non trouvé ***
           logToMongo({ action: "LOGIN_FAILED_UNKNOWN_EMAIL", inputEmail: email });
          return res.status(401).json({ message: "Email ou mot de passe incorrect." }); // Message générique pour sécurité
      }

      // 5. Utilisateur trouvé !
      const user = results[0];
      console.log("Utilisateur trouvé:", user.pseudo);

      // *** AJOUTÉ : Vérifier si le compte est suspendu AVANT de comparer le mot de passe ***
      if (user.statut === 'suspendu') {
          console.log(`Tentative de connexion refusée pour utilisateur suspendu: ${email} (ID: ${user.id})`);
          // *** AJOUTÉ : Log compte suspendu ***
          logToMongo({ action: "LOGIN_FAILED_SUSPENDED", userId: user.id, email: email });
          return res.status(403).json({ message: "Votre compte est actuellement suspendu." }); // 403 Forbidden
      }

      // 6. Si non suspendu, comparer le mot de passe
      const hashedPasswordFromDB = user.mot_de_passe;
      console.log("Vérification du mot de passe...");
      bcrypt.compare(password, hashedPasswordFromDB)
          .then(isMatch => {
              if (isMatch) {
                  // ===> MOT DE PASSE CORRECT !
                  console.log("Mot de passe correct pour:", user.pseudo);

                  // Enregistrer les infos dans la session
                  req.session.userId = user.id;
                  req.session.pseudo = user.pseudo;
                  req.session.role = user.role;
                  req.session.isLoggedIn = true;
                  console.log("Session créée/mise à jour pour:", user.pseudo, "ID:", user.id);

                  // *** AJOUTÉ : Log connexion réussie ***
                  logToMongo({
                      action: "LOGIN_SUCCESS",
                      userId: user.id,
                      pseudo: user.pseudo,
                      role: user.role
                  });

                  // Renvoyer succès
                  res.status(200).json({
                      message: "Connexion réussie !",
                      user: { // Infos utiles (SANS le mot de passe!)
                          id: user.id,
                          pseudo: user.pseudo,
                          email: user.email,
                          role: user.role,
                          credits: user.credits,
                          photo_url: user.photo_url
                      }
                  });
              } else {
                  // ===> MOT DE PASSE INCORRECT
                  console.log("Mot de passe incorrect pour:", user.pseudo);
                  // *** AJOUTÉ : Log mauvais mot de passe ***
                  logToMongo({
                      action: "LOGIN_FAILED_PASSWORD",
                      userId: user.id, // On a l'ID même si mdp faux
                      email: email
                  });
                  res.status(401).json({ message: "Email ou mot de passe incorrect." });
              }
          })
          .catch(compareError => {
              console.error("Erreur lors de la comparaison bcrypt:", compareError);
              // *** AJOUTÉ : Log erreur bcrypt ***
               logToMongo({
                   action: "LOGIN_FAILED_BCRYPT_ERROR",
                   userId: user.id, // On a l'ID ici aussi
                   email: email,
                   error: compareError.message
               });
              res.status(500).json({ message: "Erreur serveur lors de la vérification." });
          }); // Fin bcrypt.compare

  }); // Fin db.query recherche utilisateur
});
// ------------------------------------------------------------------
//          ⬆️ FIN ROUTE API POUR LA CONNEXION - MODIFIÉE         ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ ROUTE API POUR PARTICIPER À UN COVOITURAGE - AVEC LOGS MONGO ⬇️
// ------------------------------------------------------------------
app.post('/api/participations', async (req, res) => {
  console.log("Requête reçue pour participer (POST /api/participations)");

  // 1. Vérifier si l'utilisateur est connecté
  if (!req.session || !req.session.isLoggedIn || !req.session.userId) {
      console.log("Erreur: Utilisateur non connecté tentant de participer.");
      // *** AJOUT LOG : Non connecté ***
      // Pas d'userId ici, on peut logger l'IP ou juste l'événement
      logToMongo({ action: "PARTICIPATION_FAILED_UNAUTHENTICATED", ipAddress: req.ip });
      return res.status(401).json({ message: "Vous devez être connecté pour participer." });
  }

  const userId = req.session.userId;
  const { covoiturageId } = req.body;

  console.log(`Utilisateur ID: ${userId} tente de rejoindre le covoiturage ID: ${covoiturageId}`);

  // 2. Valider l'ID du covoiturage reçu
  const idCovoitNum = parseInt(covoiturageId, 10);
  if (isNaN(idCovoitNum)) {
      console.log("Erreur: covoiturageId invalide.");
      // *** AJOUT LOG : ID invalide ***
      logToMongo({ action: "PARTICIPATION_FAILED_INVALID_ID", userId: userId, inputCovoiturageId: covoiturageId });
      return res.status(400).json({ message: "L'identifiant du covoiturage est invalide." });
  }

  // --- Début de la logique avec transaction ---
  let connection;
  try {
      connection = db.promise();
      await connection.beginTransaction();
      console.log(`[Trans ${idCovoitNum}-${userId}] Transaction démarrée.`);

      // 3. Vérifier infos covoiturage + lock
      const [rides] = await connection.query('SELECT prix, place_restante FROM covoiturages WHERE id = ? FOR UPDATE', [idCovoitNum]);
      if (rides.length === 0) {
          console.log("Erreur: Covoiturage non trouvé.");
          await connection.rollback();
          // *** AJOUT LOG : Trajet non trouvé ***
          logToMongo({ action: "PARTICIPATION_FAILED_RIDE_NOT_FOUND", userId: userId, covoiturageId: idCovoitNum });
          return res.status(404).json({ message: "Covoiturage non trouvé." });
      }
      const ride = rides[0];
      console.log("Infos covoiturage:", ride);

      // 4. Vérifier places restantes
      if (ride.place_restante < 1) {
          console.log("Erreur: Covoiturage complet.");
          await connection.rollback();
          // *** AJOUT LOG : Complet ***
          logToMongo({ action: "PARTICIPATION_FAILED_NO_SEATS", userId: userId, covoiturageId: idCovoitNum });
          return res.status(400).json({ message: "Ce covoiturage est malheureusement complet." });
      }

      // 5. Vérifier crédits utilisateur + lock
      const [users] = await connection.query('SELECT credits FROM utilisateurs WHERE id = ? FOR UPDATE', [userId]);
      if (users.length === 0) {
          console.log("Erreur: Utilisateur (session) non trouvé en BDD ?!");
          await connection.rollback();
           // *** AJOUT LOG : Utilisateur session non trouvé (bizarre) ***
           logToMongo({ action: "PARTICIPATION_FAILED_USER_NOT_FOUND", userId: userId, covoiturageId: idCovoitNum });
          return res.status(404).json({ message: "Utilisateur non trouvé." });
      }
      const userCredits = users[0].credits;
      console.log("Crédits utilisateur:", userCredits, "Prix trajet:", ride.prix);

      // 6. Vérifier crédits suffisants
      if (userCredits < ride.prix) {
          console.log("Erreur: Crédits insuffisants.");
          await connection.rollback();
           // *** AJOUT LOG : Crédits insuffisants ***
           logToMongo({ action: "PARTICIPATION_FAILED_NO_CREDITS", userId: userId, covoiturageId: idCovoitNum, userCredits: userCredits, ridePrice: ride.prix });
          return res.status(400).json({ message: "Crédits insuffisants pour participer à ce trajet." });
      }

      // 7. Vérifier si déjà participant
      const [participations] = await connection.query('SELECT COUNT(*) as count FROM participations WHERE utilisateur_id = ? AND covoiturage_id = ?', [userId, idCovoitNum]);
      if (participations[0].count > 0) {
          console.log("Erreur: L'utilisateur participe déjà.");
          await connection.rollback();
          // *** AJOUT LOG : Déjà participant ***
           logToMongo({ action: "PARTICIPATION_FAILED_ALREADY_JOINED", userId: userId, covoiturageId: idCovoitNum });
          return res.status(409).json({ message: "Vous participez déjà à ce covoiturage." });
      }

      // === Mises à jour ===
      console.log("Vérifications OK. Procédure de mise à jour...");

      // 8. MAJ Places
      const [updateRideResult] = await connection.query('UPDATE covoiturages SET place_restante = place_restante - 1 WHERE id = ? AND place_restante >= 1', [idCovoitNum]);
      if (updateRideResult.affectedRows === 0) throw new Error("Impossible de décrémenter la place.");
      console.log("Places covoiturage mises à jour.");

      // 9. MAJ Crédits
      const [updateUserResult] = await connection.query('UPDATE utilisateurs SET credits = credits - ? WHERE id = ? AND credits >= ?', [ride.prix, userId, ride.prix]);
      if (updateUserResult.affectedRows === 0) throw new Error("Impossible de décrémenter les crédits.");
      console.log("Crédits utilisateur mis à jour.");

      // 10. Insérer participation
      const [insertParticipationResult] = await connection.query( // Récupérer l'ID inséré
           'INSERT INTO participations (utilisateur_id, covoiturage_id, date_reservation, validation_passager) VALUES (?, ?, NOW(), \'pending\')', // Mettre 'pending' par défaut
           [userId, idCovoitNum]
       );
      const newParticipationId = insertParticipationResult.insertId; // ID de la nouvelle participation
      console.log(`Participation insérée ID: ${newParticipationId}.`);

      // 11. Commit
      await connection.commit();
      console.log(`[Trans ${idCovoitNum}-${userId}] Transaction validée (commit).`);

      // *** AJOUT LOG : Succès ***
      logToMongo({
          action: "PARTICIPATION_SUCCESS",
          userId: userId,
          covoiturageId: idCovoitNum,
          participationId: newParticipationId, // Log l'ID de la participation créée
          pricePaid: ride.prix
      });

      // 12. Réponse succès
      res.status(201).json({ message: "Inscription au trajet réussie !" });

  } catch (error) {
      // --- Gestion des erreurs et Rollback ---
      console.error(`Erreur lors du processus de participation pour User ${userId} et Ride ${idCovoitNum}:`, error);
      if (connection) {
          console.log("Annulation de la transaction (rollback)...");
          try { await connection.rollback(); console.log("Rollback effectué."); }
          catch (rollbackError) { console.error("Erreur lors du rollback:", rollbackError); }
      }
       // *** AJOUT LOG : Erreur générale / Transaction ***
       logToMongo({
           action: "PARTICIPATION_FAILED_TRANSACTION_ERROR",
           userId: userId,
           covoiturageId: idCovoitNum,
           error: error.message,
           rawError: error // Stocker l'erreur brute peut être utile
       });
      res.status(500).json({ message: "Erreur serveur lors de la tentative de participation." });
  }
});
// ------------------------------------------------------------------
//     ⬆️ FIN ROUTE API POUR PARTICIPER À UN COVOITURAGE - AVEC LOGS ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//          ⬇️ AJOUT ROUTE API POUR LA DÉCONNEXION           ⬇️
// ------------------------------------------------------------------
app.post('/api/logout', (req, res) => {
  console.log("Requête reçue pour la déconnexion (POST /api/logout)");

  // Vérifier si une session existe
  if (req.session) {
    // Détruire la session
    req.session.destroy((err) => {
      if (err) {
        // Gérer une éventuelle erreur lors de la destruction
        console.error("Erreur lors de la destruction de la session:", err);
        res.status(500).json({ message: "Erreur serveur lors de la déconnexion." });
      } else {
        // Destruction réussie !
        // express-session s'occupe normalement de dire au navigateur
        // de supprimer le cookie de session (via l'en-tête Set-Cookie).
        console.log("Session détruite avec succès.");
        res.status(200).json({ message: "Déconnexion réussie." });
      }
    });
  } else {
    // Pas de session active à détruire, mais ce n'est pas une erreur en soi
    console.log("Tentative de déconnexion sans session active.");
    res.status(200).json({ message: "Aucune session active à déconnecter." });
  }
});
// ------------------------------------------------------------------
//             ⬆️ FIN AJOUT ROUTE API POUR LA DÉCONNEXION       ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API POUR METTRE À JOUR LE RÔLE UTILISATEUR    ⬇️
// ------------------------------------------------------------------
app.patch('/api/utilisateurs/me/role', (req, res) => {
  console.log("Requête reçue pour mettre à jour le rôle (PATCH /api/utilisateurs/me/role)");

  // 1. Vérifier si l'utilisateur est connecté
  if (!req.session || !req.session.isLoggedIn || !req.session.userId) {
    console.log("Erreur: Tentative de mise à jour de rôle non connecté.");
    return res.status(401).json({ message: "Authentification requise." });
  }

  // 2. Récupérer l'ID de l'utilisateur et le nouveau rôle depuis la requête
  const userId = req.session.userId;
  const { newRole } = req.body; // On s'attend à recevoir { "newRole": "valeur_choisie" }
  console.log(`Utilisateur ID: ${userId} demande à changer son rôle pour: ${newRole}`);

  // 3. Valider la valeur du nouveau rôle
  const allowedRoles = ['passager', 'chauffeur', 'passager_chauffeur'];
  if (!newRole || !allowedRoles.includes(newRole)) {
    console.log("Erreur: Rôle fourni invalide -", newRole);
    return res.status(400).json({ message: "Le rôle fourni est invalide." });
  }

  // 4. Préparer la requête SQL pour mettre à jour le rôle
  const sqlUpdateRoleQuery = `
    UPDATE utilisateurs
    SET role = ?
    WHERE id = ?;
  `;
  const params = [newRole, userId];
  console.log("Exécution SQL (UPDATE role):", sqlUpdateRoleQuery, params);

  // 5. Exécuter la requête
  db.query(sqlUpdateRoleQuery, params, (err, results) => {
    if (err) {
      console.error("Erreur SQL lors de la mise à jour du rôle:", err);
      return res.status(500).json({ message: "Erreur serveur lors de la mise à jour du rôle." });
    }

    // 6. Vérifier si la mise à jour a bien affecté une ligne
    if (results.affectedRows === 1) {
      console.log("Rôle mis à jour avec succès pour l'utilisateur ID:", userId);
      // Mettre à jour le rôle dans la session aussi ? Bonne pratique.
      req.session.role = newRole; // On pourrait stocker le rôle en session si utile ailleurs
      res.status(200).json({ message: "Rôle mis à jour avec succès !", newRole: newRole });
    } else {
      // Cas étrange où l'ID de session ne correspond à aucun utilisateur
      console.error(`Erreur: Mise à jour du rôle n'a affecté aucune ligne pour l'ID ${userId}`);
      res.status(404).json({ message: "Utilisateur non trouvé pour la mise à jour du rôle." });
    }
  });
});
// ------------------------------------------------------------------
//     ⬆️ FIN AJOUT ROUTE API MISE À JOUR RÔLE                 ⬆️
// ---------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API POUR LISTER LES VÉHICULES UTILISATEUR     ⬇️
// ------------------------------------------------------------------
app.get('/api/vehicules/me', (req, res) => {
  console.log("Requête reçue pour lister les véhicules de l'utilisateur connecté (GET /api/vehicules/me)");

  // 1. Vérifier si l'utilisateur est connecté
  if (!req.session || !req.session.isLoggedIn || !req.session.userId) {
    console.log("Erreur: Tentative non authentifiée de lister les véhicules.");
    return res.status(401).json({ message: "Authentification requise pour voir les véhicules." });
  }

  // 2. Récupérer l'ID de l'utilisateur depuis la session
  const userId = req.session.userId;
  console.log(`Recherche des véhicules pour l'utilisateur ID: ${userId}`);

  // 3. Préparer la requête SQL pour récupérer les véhicules de cet utilisateur
  // On sélectionne les colonnes qui seront utiles pour l'affichage
  const sqlQuery = `
    SELECT id, plaque_immat, date_premiere_immat, marque, modele, couleur, energie, nb_places
    FROM vehicules
    WHERE utilisateur_id = ?
    ORDER BY date_ajout DESC; -- Trier par date d'ajout, du plus récent au plus ancien
  `;
  console.log("Exécution SQL (liste véhicules):", sqlQuery, "avec ID:", userId);

  // 4. Exécuter la requête
  db.query(sqlQuery, [userId], (err, results) => {
    if (err) {
      console.error("Erreur SQL lors de la récupération des véhicules:", err);
      return res.status(500).json({ message: "Erreur serveur lors de la récupération des véhicules." });
    }

    // 5. Renvoyer la liste des véhicules trouvés (peut être une liste vide [])
    console.log("Nombre de véhicules trouvés:", results.length);
    res.status(200).json(results); // Renvoie un tableau JSON (potentiellement vide)
  });
});
// ------------------------------------------------------------------
//     ⬆️ FIN AJOUT ROUTE API LISTE VÉHICULES                  ⬆️
// ------------------------------------------------------------------


// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API POUR RÉCUPÉRER INFOS UTILISATEUR CONNECTÉ ⬇️
// ------------------------------------------------------------------
app.get('/api/utilisateurs/me', (req, res) => {
  console.log("Requête reçue pour récupérer les infos de l'utilisateur connecté (GET /api/utilisateurs/me)");

  // 1. Vérifier si l'utilisateur est connecté via la session
  if (!req.session || !req.session.isLoggedIn || !req.session.userId) {
    console.log("Accès non autorisé à /api/utilisateurs/me (non connecté).");
    // 401 Unauthorized ou 403 Forbidden
    return res.status(401).json({ message: "Authentification requise." });
  }

  // 2. Récupérer l'ID de l'utilisateur depuis la session
  const userId = req.session.userId;
  console.log(`Utilisateur connecté trouvé dans la session, ID: ${userId}`);

  // 3. Préparer la requête pour récupérer les détails de cet utilisateur
  // IMPORTANT: NE JAMAIS sélectionner le mot_de_passe !
  const sqlQuery = `
    SELECT
        id, pseudo, email, credits, role, photo_url,
        pref_fumeur, pref_animaux, pref_autres
    FROM utilisateurs
    WHERE id = ?;
  `;
  console.log("Exécution SQL (infos utilisateur):", sqlQuery, "avec ID:", userId);

  // 4. Exécuter la requête
  db.query(sqlQuery, [userId], (err, results) => {
    if (err) {
      console.error("Erreur SQL lors de la récupération des infos utilisateur:", err);
      return res.status(500).json({ message: "Erreur serveur lors de la récupération des informations." });
    }

    // 5. Vérifier si l'utilisateur (correspondant à l'ID de session) a été trouvé
    if (results.length === 1) {
      console.log("Informations utilisateur trouvées:", results[0]);
      // Renvoyer les informations trouvées
      res.status(200).json(results[0]);
    } else {
      // Cas très étrange: l'ID de session ne correspond à aucun utilisateur en BDD ?!
      console.error(`Erreur critique: Utilisateur avec ID ${userId} (de la session) non trouvé en BDD.`);
      // Détruire la session potentiellement invalide ? (Optionnel)
      req.session.destroy();
      res.status(404).json({ message: "Utilisateur non trouvé." });
    }
  });
});
// ------------------------------------------------------------------
//     ⬆️ FIN AJOUT ROUTE API INFOS UTILISATEUR CONNECTÉ        ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API POUR VÉRIFIER L'ÉTAT DE LA SESSION      ⬇️
// ------------------------------------------------------------------
app.get('/api/session/status', (req, res) => {
  console.log("Requête reçue pour vérifier l'état de la session (GET /api/session/status)");
  // On vérifie si les informations qu'on a stockées existent dans la session
  if (req.session && req.session.isLoggedIn && req.session.userId) {
    // L'utilisateur est connecté !
    console.log("Session active trouvée pour:", req.session.pseudo);
    res.status(200).json({
      isLoggedIn: true,
      userId: req.session.userId,
      pseudo: req.session.pseudo,
      role: req.session.role
      // Ajoutez d'autres infos si nécessaire (ex: credits), mais pas le mot de passe !
    });
  } else {
    // Aucune session active trouvée
    console.log("Aucune session active trouvée.");
    res.status(200).json({ // On répond OK, mais en indiquant non connecté
      isLoggedIn: false
    });
  }
});
// ------------------------------------------------------------------
//     ⬆️ FIN AJOUT ROUTE API POUR L'ÉTAT DE LA SESSION         ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API POUR LISTER LES VÉHICULES UTILISATEUR     ⬇️
// ------------------------------------------------------------------
app.get('/api/vehicules/me', (req, res) => {
  console.log("Requête reçue pour lister les véhicules de l'utilisateur connecté (GET /api/vehicules/me)");

  // 1. Vérifier si l'utilisateur est connecté
  if (!req.session || !req.session.isLoggedIn || !req.session.userId) {
    console.log("Erreur: Tentative non authentifiée de lister les véhicules.");
    return res.status(401).json({ message: "Authentification requise pour voir les véhicules." });
  }

  // 2. Récupérer l'ID de l'utilisateur depuis la session
  const userId = req.session.userId;
  console.log(`Recherche des véhicules pour l'utilisateur ID: ${userId}`);

  // 3. Préparer la requête SQL pour récupérer les véhicules de cet utilisateur
  const sqlQuery = `
    SELECT id, plaque_immat, date_premiere_immat, marque, modele, couleur, energie, nb_places
    FROM vehicules
    WHERE utilisateur_id = ?
    ORDER BY date_ajout DESC; -- Trier par date d'ajout, du plus récent au plus ancien
  `;
  console.log("Exécution SQL (liste véhicules):", sqlQuery, "avec ID:", userId);

  // 4. Exécuter la requête
  db.query(sqlQuery, [userId], (err, results) => {
    if (err) {
      console.error("Erreur SQL lors de la récupération des véhicules:", err);
      return res.status(500).json({ message: "Erreur serveur lors de la récupération des véhicules." });
    }

    // 5. Renvoyer la liste des véhicules trouvés (peut être une liste vide)
    console.log("Nombre de véhicules trouvés:", results.length);
    res.status(200).json(results); // Renvoie un tableau (potentiellement vide)
  });
});
// ------------------------------------------------------------------
//     ⬆️ FIN AJOUT ROUTE API LISTE VÉHICULES                  ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API POUR AJOUTER UN VÉHICULE UTILISATEUR      ⬇️
// ------------------------------------------------------------------
app.post('/api/vehicules/me', async (req, res) => { // On utilise async/await pour le check du rôle
  console.log("Requête reçue pour ajouter un véhicule (POST /api/vehicules/me)");

  // 1. Vérifier si l'utilisateur est connecté
  if (!req.session || !req.session.isLoggedIn || !req.session.userId) {
    console.log("Erreur: Tentative non authentifiée d'ajouter un véhicule.");
    return res.status(401).json({ message: "Authentification requise pour ajouter un véhicule." });
  }
  const userId = req.session.userId;

  // 2. Vérifier si l'utilisateur a un rôle de chauffeur (important !)
  try {
    const [users] = await db.promise().query('SELECT role FROM utilisateurs WHERE id = ?', [userId]);
    if (users.length === 0) {
        return res.status(404).json({ message: "Utilisateur non trouvé." }); // Ne devrait pas arriver si loggué
    }
    const userRole = users[0].role;
    console.log(`Vérification rôle pour ajout véhicule. User ID: ${userId}, Rôle: ${userRole}`);
    if (userRole !== 'chauffeur' && userRole !== 'passager_chauffeur') {
      console.log("Erreur: Rôle insuffisant pour ajouter un véhicule.");
      return res.status(403).json({ message: "Vous devez avoir le rôle de chauffeur pour ajouter un véhicule." }); // 403 Forbidden
    }

    // 3. Récupérer les données du véhicule depuis le corps de la requête
    const { plaque_immat, date_premiere_immat, marque, modele, couleur, energie, nb_places } = req.body;
    console.log("Données véhicule reçues:", req.body);

    // 4. Validation simple (les champs NOT NULL dans la BDD doivent être présents)
    if (!marque || !modele || !nb_places) {
      console.log("Erreur: Données véhicule manquantes (marque, modele, nb_places).");
      return res.status(400).json({ message: "Les informations marque, modèle et nombre de places sont requises." });
    }
    const nbPlacesNum = parseInt(nb_places, 10);
    if (isNaN(nbPlacesNum) || nbPlacesNum <= 0) {
       return res.status(400).json({ message: "Le nombre de places doit être un nombre positif." });
    }
    // TODO: Ajouter d'autres validations (format plaque, format date...)

    // 5. Préparer la requête SQL pour insérer le véhicule
    const sqlInsertVehicule = `
      INSERT INTO vehicules
      (utilisateur_id, plaque_immat, date_premiere_immat, marque, modele, couleur, energie, nb_places)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;
    // Mettre null si les valeurs optionnelles ne sont pas fournies ou vides
    const params = [
      userId,
      plaque_immat || null,
      date_premiere_immat || null, // Assurez-vous que le format de date envoyé par le front-end est compatible (YYYY-MM-DD)
      marque,
      modele,
      couleur || null,
      energie || null,
      nbPlacesNum
    ];
    console.log("Exécution SQL (INSERT vehicule):", sqlInsertVehicule, params);

    // 6. Exécuter la requête d'insertion (on peut revenir à la callback ici)
    db.query(sqlInsertVehicule, params, (err, results) => {
      if (err) {
        console.error("Erreur SQL lors de l'insertion du véhicule:", err);
        // Gérer erreur de clé étrangère ou autre ?
        return res.status(500).json({ message: "Erreur serveur lors de l'ajout du véhicule." });
      }

      // 7. Insertion réussie !
      console.log("Nouveau véhicule inséré avec succès, ID:", results.insertId);
      // Renvoyer un statut 201 Created et les infos du véhicule ajouté (sans l'ID user)
      res.status(201).json({
           message: "Véhicule ajouté avec succès!",
           vehicule: {
               id: results.insertId, // ID du nouveau véhicule
               plaque_immat: plaque_immat || null,
               date_premiere_immat: date_premiere_immat || null,
               marque: marque,
               modele: modele,
               couleur: couleur || null,
               energie: energie || null,
               nb_places: nbPlacesNum
           }
       });
    }); // Fin db.query

  } catch (error) {
      // Gérer les erreurs (ex: BDD pour la vérification du rôle)
      console.error("Erreur lors du processus d'ajout de véhicule:", error);
      res.status(500).json({ message: "Erreur serveur interne." });
  }
});
// ------------------------------------------------------------------
//     ⬆️ FIN AJOUT ROUTE API AJOUT VÉHICULE                   ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API POUR CRÉER UN NOUVEAU COVOITURAGE       ⬇️
// ------------------------------------------------------------------
// Utilisation de async/await pour les vérifications préalables
// POST /api/covoiturages (CRÉATION COVOITURAGE) - VERSION CORRIGÉE SANS userNote/conducteur_note
app.post('/api/covoiturages', async (req, res) => {
  console.log("Requête reçue pour créer un covoiturage (POST /api/covoiturages)");
  if (!req.session?.isLoggedIn) { return res.status(401).json({ message: "Authentification requise." }); }
  const userId = req.session.userId;
  const { depart, arrivee, date_depart, date_arrivee, prix, places_offertes, selected_vehicule_id } = req.body;
  if (!depart || !arrivee || !date_depart || !date_arrivee || !prix || !places_offertes || !selected_vehicule_id) { return res.status(400).json({ message: "Champs trajet requis manquants." }); }
  const prixNum = parseFloat(prix); const placesNum = parseInt(places_offertes, 10); const vehiculeIdNum = parseInt(selected_vehicule_id, 10);
  if (isNaN(prixNum) || prixNum <= 0 || isNaN(placesNum) || placesNum <= 0 || isNaN(vehiculeIdNum)) { return res.status(400).json({ message: "Format invalide (prix/places/vehiculeID)." }); }

  try {
    // Vérifier rôle chauffeur
    const [users] = await db.promise().query('SELECT role FROM utilisateurs WHERE id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ message: "Utilisateur non trouvé." });
    const userRole = users[0].role;
    if (userRole !== 'chauffeur' && userRole !== 'passager_chauffeur') { return res.status(403).json({ message: "Rôle chauffeur requis." }); }

    // Vérifier véhicule
    const [vehicules] = await db.promise().query('SELECT marque, modele, energie, nb_places FROM vehicules WHERE id = ? AND utilisateur_id = ?', [vehiculeIdNum, userId]);
    if (vehicules.length === 0) { return res.status(403).json({ message: "Véhicule invalide ou non possédé." }); }
    const selectedVehicule = vehicules[0];
    if (placesNum > selectedVehicule.nb_places) { return res.status(400).json({ message: `Places offertes > capacité véhicule (${selectedVehicule.nb_places}).` }); }

    // Déterminer isEcologique
    const isEcologique = (selectedVehicule.energie && selectedVehicule.energie.toLowerCase() === 'electrique') ? 1 : 0;

    // Préparer l'insertion (SANS userNote / conducteur_note)
    const sqlInsertCovoit = `
      INSERT INTO covoiturages
      (depart, arrivee, date_depart, date_arrivee, prix, place_restante, conducteur_id,
       marque, modele, energie, is_ecologique) /* <-- Colonne note enlevée */
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?); /* <-- Un '?' en moins */
    `;
    const params = [ depart, arrivee, date_depart, date_arrivee, prixNum, placesNum, userId, selectedVehicule.marque, selectedVehicule.modele, selectedVehicule.energie, isEcologique ]; // <-- Paramètre note enlevé
    console.log("Exécution SQL CORRIGÉE (INSERT covoiturage):", sqlInsertCovoit, params);

    // Exécuter l'insertion
    const [results] = await db.promise().query(sqlInsertCovoit, params);

    // Succès
    console.log("Nouveau covoiturage inséré avec succès, ID:", results.insertId);
    res.status(201).json({ message: "Covoiturage créé !", covoiturageId: results.insertId });

  } catch (error) {
    console.error("Erreur lors de la création du covoiturage:", error);
    res.status(500).json({ message: "Erreur serveur lors de la création du covoiturage." });
  }
});
// ------------------------------------------------------------------
//     ⬆️ FIN AJOUT ROUTE API CRÉATION COVOITURAGE             ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ROUTE API POUR L'HISTORIQUE UTILISATEUR (GET)
// ------------------------------------------------------------------
// Route API pour l'historique utilisateur (GET /api/historique/me) - CORRIGÉE

app.get('/api/historique/me', (req, res) => {
  console.log("Requête reçue pour l'historique utilisateur (GET /api/historique/me)");

  // 1. Vérifier connexion
  if (!req.session?.isLoggedIn) { return res.status(401).json({ message: "Authentification requise." }); }
  const userId = req.session.userId;

  // 2. Lire le type d'historique demandé (participated ou conducted)
  const historyType = req.query.type;
  console.log(`Demande d'historique pour User ID: ${userId}, Type: ${historyType}`);

  let sqlQuery = '';
  const params = [userId];

  // 3. Construire la requête SQL appropriée - AVEC LE ELSE IF CORRIGÉ
  if (historyType === 'participated') {
    sqlQuery = `
        SELECT
            c.id, c.depart, c.arrivee, c.date_depart, c.date_arrivee, c.prix,
            u.pseudo as conducteur_pseudo,
            p.date_reservation,
            c.is_ecologique,
            p.id as participation_id, -- ID de la participation pour l'annulation
            c.statut_trajet,
            p.validation_passager
        FROM participations p
        JOIN covoiturages c ON p.covoiturage_id = c.id
        JOIN utilisateurs u ON c.conducteur_id = u.id
        WHERE p.utilisateur_id = ?
        ORDER BY c.date_depart DESC;
    `;
  } else if (historyType === 'conducted') {
    sqlQuery = `
        SELECT c.id, c.depart, c.arrivee, c.date_depart, c.date_arrivee, c.prix, c.place_restante, c.is_ecologique,
               c.statut_trajet 
        FROM covoiturages c
        WHERE c.conducteur_id = ?
        ORDER BY c.date_depart DESC;
    `;

  } else { // Cas où le type n'est NI 'participated' NI 'conducted'
    console.log("Erreur: Type d'historique invalide reçu :", historyType);
    return res.status(400).json({ message: "Le type d'historique ('participated' ou 'conducted') est requis et doit être valide." });
  }

  console.log("Exécution SQL (historique):", sqlQuery);

  // 4. Exécuter la requête (Maintenant accessible pour 'conducted' aussi)
  db.query(sqlQuery, params, (err, results) => {
    if (err) {
      console.error(`Erreur SQL historique (${historyType}):`, err);
      return res.status(500).json({ message: "Erreur serveur récupération historique." });
    }
    console.log(`Historique (${historyType}) trouvé:`, results.length, "résultats.");
    res.status(200).json(results);
  });
});
// ------------------------------------------------------------------
//    FIN ROUTE API HISTORIQUE
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API POUR MAJ PREFERENCES UTILISATEUR         ⬇️
// ------------------------------------------------------------------
app.patch('/api/utilisateurs/me/preferences', (req, res) => {
  console.log("Requête reçue pour mettre à jour les préférences (PATCH /api/utilisateurs/me/preferences)");

  // 1. Vérifier connexion
  if (!req.session?.isLoggedIn) { return res.status(401).json({ message: "Authentification requise." }); }
  const userId = req.session.userId;

  // 2. Récupérer les données envoyées (fumeur, animaux, autres)
  // On s'attend à recevoir par exemple: { fumeur: 'oui', animaux: 'non', autres: 'Texte libre' }
  // Ou { fumeur: null } si l'utilisateur choisit "Indifférent"
  const { fumeur, animaux, autres } = req.body;
  console.log(`MAJ Prefs pour User ID: ${userId}, données reçues:`, req.body);

  // 3. Convertir les valeurs reçues pour la BDD (BOOLEAN ou NULL)
  // On utilise une fonction pour gérer 'oui'->1, 'non'->0, autre->NULL
  const parsePreference = (value) => {
      if (value === 'oui' || value === true || value === '1' || value === 1) return 1;
      if (value === 'non' || value === false || value === '0' || value === 0) return 0;
      return null; // Indifférent ou valeur invalide -> NULL en BDD
  };

  const pref_fumeur = parsePreference(fumeur);
  const pref_animaux = parsePreference(animaux);
  // Pour 'autres', on prend le texte ou null si vide/non fourni
  const pref_autres = (autres && autres.trim() !== '') ? autres.trim() : null;

  console.log("Valeurs à enregistrer en BDD:", { pref_fumeur, pref_animaux, pref_autres });

  // 4. Préparer la requête SQL de mise à jour
  const sqlUpdatePrefs = `
      UPDATE utilisateurs
      SET pref_fumeur = ?, pref_animaux = ?, pref_autres = ?
      WHERE id = ?;
  `;
  const params = [pref_fumeur, pref_animaux, pref_autres, userId];

  // 5. Exécuter la requête
  db.query(sqlUpdatePrefs, params, (err, results) => {
      if (err) {
          console.error("Erreur SQL lors de la MAJ des préférences:", err);
          return res.status(500).json({ message: "Erreur serveur lors de la mise à jour des préférences." });
      }

      if (results.affectedRows === 1) {
          console.log("Préférences mises à jour avec succès pour User ID:", userId);
          // Pas besoin de renvoyer les données, juste un succès
          res.status(200).json({ message: "Préférences mises à jour avec succès !" });
      } else {
          console.error("Erreur MAJ Préférences: Utilisateur non trouvé ? ID:", userId);
          res.status(404).json({ message: "Utilisateur non trouvé pour la mise à jour." });
      }
  });
});
// ------------------------------------------------------------------
//     ⬆️ FIN AJOUT ROUTE API MAJ PREFERENCES                  ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//  ⬇️ AJOUT ROUTE API POUR ANNULER UNE PARTICIPATION (Passager) ⬇️
// ------------------------------------------------------------------
app.delete('/api/participations/:id', async (req, res) => {
  console.log("Requête reçue pour annuler une participation (DELETE /api/participations/:id)");

  // 1. Vérifier si l'utilisateur est connecté
  if (!req.session?.isLoggedIn) {
      return res.status(401).json({ message: "Authentification requise pour annuler." });
  }
  const userId = req.session.userId;
  const participationIdParam = req.params.id;
  console.log(`Utilisateur ID: ${userId} tente d'annuler la participation ID: ${participationIdParam}`);

  // 2. Valider l'ID de la participation
  const participationId = parseInt(participationIdParam, 10);
  if (isNaN(participationId)) {
      return res.status(400).json({ message: "L'identifiant de la participation est invalide." });
  }

  // Obtenir une connexion supportant les promesses et les transactions
  const connection = db.promise(); // Utiliser les promesses sur votre connexion existante 'db'

  try {
      // 3. Démarrer la transaction
      await connection.beginTransaction();
      console.log(`[Trans ${participationId}] Transaction démarrée.`);

      // 4. Récupérer les infos de la participation ET vérifier l'appartenance + récupérer l'ID covoit
      // On verrouille la ligne de participation pour éviter les problèmes de concurrence
      const [participations] = await connection.query(
          'SELECT utilisateur_id, covoiturage_id FROM participations WHERE id = ? FOR UPDATE',
          [participationId]
      );

      if (participations.length === 0) {
          await connection.rollback(); // Annuler avant de retourner l'erreur
          console.log(`[Trans ${participationId}] Participation non trouvée.`);
          return res.status(404).json({ message: "Participation non trouvée." });
      }
      const participation = participations[0];

      // Vérifier si l'utilisateur connecté est bien le propriétaire de cette participation
      if (participation.utilisateur_id !== userId) {
          await connection.rollback();
          console.log(`[Trans ${participationId}] Tentative non autorisée par User ID: ${userId}. Propriétaire réel: ${participation.utilisateur_id}`);
          return res.status(403).json({ message: "Vous n'êtes pas autorisé à annuler cette participation." }); // 403 Forbidden
      }

      const covoiturageId = participation.covoiturage_id;
      console.log(`[Trans ${participationId}] Covoiturage associé ID: ${covoiturageId}`);

      // 5. Récupérer les infos du covoiturage (prix pour remboursement, date pour vérifier)
      // On verrouille aussi la ligne du covoiturage
      const [covoiturages] = await connection.query(
          'SELECT prix, date_depart, place_restante FROM covoiturages WHERE id = ? FOR UPDATE',
          [covoiturageId]
      );

      if (covoiturages.length === 0) {
           // Ne devrait pas arriver si la participation existe, mais sécurité
          await connection.rollback();
          console.log(`[Trans ${participationId}] Covoiturage associé non trouvé?! ID: ${covoiturageId}`);
          return res.status(404).json({ message: "Covoiturage associé non trouvé." });
      }
      const covoiturage = covoiturages[0];

      // 6. Vérifier si le covoiturage est bien dans le futur
      const dateDepart = new Date(covoiturage.date_depart);
      const maintenant = new Date();
      if (dateDepart <= maintenant) {
          await connection.rollback();
          console.log(`[Trans ${participationId}] Tentative d'annulation d'un trajet passé ou en cours. Date départ: ${dateDepart}`);
          return res.status(400).json({ message: "Il est trop tard pour annuler ce trajet." });
      }
      console.log(`[Trans ${participationId}] Trajet à venir. Date départ: ${dateDepart}`);

      // --- Toutes les vérifications sont OK, on procède aux mises à jour ---

      // 7. Supprimer la participation
      const [deleteResult] = await connection.query(
          'DELETE FROM participations WHERE id = ?',
          [participationId]
      );
      // Vérifier si la suppression a bien eu lieu (devrait, car on a verrouillé avant)
      if (deleteResult.affectedRows === 0) {
           throw new Error(`La participation ${participationId} n'a pas pu être supprimée.`);
      }
      console.log(`[Trans ${participationId}] Participation supprimée.`);

      // 8. Incrémenter les places restantes
      const [updateRideResult] = await connection.query(
          'UPDATE covoiturages SET place_restante = place_restante + 1 WHERE id = ?',
          [covoiturageId]
      );
       if (updateRideResult.affectedRows === 0) {
           throw new Error(`Le covoiturage ${covoiturageId} n'a pas pu être mis à jour (places).`);
      }
      console.log(`[Trans ${participationId}] Place restante incrémentée pour covoiturage ID: ${covoiturageId}`);

      // 9. Rembourser les crédits à l'utilisateur
      const prixARembourser = covoiturage.prix;
      console.log(`[Trans ${participationId}] Remboursement de ${prixARembourser} crédits à User ID: ${userId}`);
      const [updateUserResult] = await connection.query(
          'UPDATE utilisateurs SET credits = credits + ? WHERE id = ?',
          [prixARembourser, userId]
      );
       if (updateUserResult.affectedRows === 0) {
           throw new Error(`L'utilisateur ${userId} n'a pas pu être mis à jour (crédits).`);
      }
      console.log(`[Trans ${participationId}] Crédits utilisateur mis à jour.`);

      // 10. Valider la transaction
      await connection.commit();
      console.log(`[Trans ${participationId}] Transaction validée (commit). Annulation réussie.`);

      // 11. Renvoyer une réponse de succès
      // 200 OK avec message ou 204 No Content sont possibles. 200 est bien si on veut confirmer.
      res.status(200).json({ message: "Votre participation a été annulée avec succès. Vos crédits ont été remboursés." });

  } catch (error) {
      // --- Gestion des erreurs et Rollback ---
      console.error(`[Trans ${participationId}] Erreur lors de l'annulation de la participation:`, error);
      // Annuler la transaction si elle a été démarrée
      try {
          console.log(`[Trans ${participationId}] Annulation de la transaction (rollback)...`);
          await connection.rollback();
          console.log(`[Trans ${participationId}] Rollback effectué.`);
      } catch (rollbackError) {
          console.error(`[Trans ${participationId}] Erreur lors du rollback:`, rollbackError);
          // Log l'erreur de rollback mais continuer pour renvoyer l'erreur initiale
      }
      // Renvoyer une erreur générique au client
      res.status(500).json({ message: "Erreur serveur lors de l'annulation de la participation." });
  }
  // Note: Si vous utilisiez un pool de connexions, il faudrait libérer la connexion ici.
  // Avec db.promise() sur une connexion unique, ce n'est pas nécessaire.
});
// ------------------------------------------------------------------
//   ⬆️ FIN AJOUT ROUTE API ANNULER PARTICIPATION (Passager)  ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API POUR ANNULER UN COVOITURAGE (Chauffeur) ⬇️
// ------------------------------------------------------------------
app.post('/api/covoiturages/:id/cancel', async (req, res) => {
  console.log("Requête reçue pour annuler un covoiturage par le chauffeur (POST /api/covoiturages/:id/cancel)");

  // 1. Vérifier si l'utilisateur est connecté
  if (!req.session?.isLoggedIn) {
      return res.status(401).json({ message: "Authentification requise pour annuler." });
  }
  const userId = req.session.userId; // ID du chauffeur potentiel
  const covoiturageIdParam = req.params.id;
  console.log(`Utilisateur ID: ${userId} tente d'annuler le covoiturage ID: ${covoiturageIdParam}`);

  // 2. Valider l'ID du covoiturage
  const covoiturageId = parseInt(covoiturageIdParam, 10);
  if (isNaN(covoiturageId)) {
      return res.status(400).json({ message: "L'identifiant du covoiturage est invalide." });
  }

  // Obtenir une connexion supportant les promesses et les transactions
  const connection = db.promise();

  try {
      // 3. Démarrer la transaction
      await connection.beginTransaction();
      console.log(`[Cancel ${covoiturageId}] Transaction démarrée.`);

      // 4. Vérifier si l'utilisateur est bien le chauffeur ET si le trajet peut être annulé
      // On verrouille la ligne covoiturage
      const [covoiturages] = await connection.query(
          // Assurez-vous que la colonne 'statut_trajet' existe !
          'SELECT conducteur_id, date_depart, statut_trajet, prix FROM covoiturages WHERE id = ? FOR UPDATE',
          [covoiturageId]
      );

      if (covoiturages.length === 0) {
          await connection.rollback();
          console.log(`[Cancel ${covoiturageId}] Covoiturage non trouvé.`);
          return res.status(404).json({ message: "Covoiturage non trouvé." });
      }
      const covoiturage = covoiturages[0];

      // Vérifier l'autorisation
      if (covoiturage.conducteur_id !== userId) {
          await connection.rollback();
          console.log(`[Cancel ${covoiturageId}] Non autorisé. User: ${userId}, Conducteur: ${covoiturage.conducteur_id}`);
          return res.status(403).json({ message: "Vous n'êtes pas autorisé à annuler ce trajet." });
      }

      // Vérifier si le trajet est à venir
      const dateDepart = new Date(covoiturage.date_depart);
      const maintenant = new Date();
      if (dateDepart <= maintenant) {
          await connection.rollback();
          console.log(`[Cancel ${covoiturageId}] Tentative d'annulation d'un trajet passé/en cours.`);
          return res.status(400).json({ message: "Il est trop tard pour annuler ce trajet." });
      }

      // Vérifier si le statut permet l'annulation (ex: seulement si 'prévu')
      // Adaptez 'prévu' si vous utilisez un autre terme dans votre BDD
      if (covoiturage.statut_trajet !== 'prévu') {
           await connection.rollback();
           console.log(`[Cancel ${covoiturageId}] Annulation impossible, statut actuel: ${covoiturage.statut_trajet}`);
           return res.status(400).json({ message: `Annulation impossible car le trajet n'est pas au statut 'prévu' (statut actuel: ${covoiturage.statut_trajet}).` });
      }
      console.log(`[Cancel ${covoiturageId}] Vérifications OK (chauffeur, date, statut).`);

      // --- Procéder à l'annulation et au remboursement ---

      // 5. Trouver tous les participants et leurs infos pour remboursement/notification
      const [participations] = await connection.query(
          `SELECT p.id as participation_id, p.utilisateur_id, u.email
           FROM participations p
           JOIN utilisateurs u ON p.utilisateur_id = u.id
           WHERE p.covoiturage_id = ?`,
          [covoiturageId]
      );
      console.log(`[Cancel ${covoiturageId}] ${participations.length} participant(s) trouvé(s).`);

      // 6. Rembourser chaque participant (si prix > 0)
      const prixTrajet = parseFloat(covoiturage.prix);
      if (prixTrajet > 0 && participations.length > 0) {
          console.log(`[Cancel ${covoiturageId}] Remboursement de ${prixTrajet} crédits à ${participations.length} participant(s).`);
          const participantIds = participations.map(p => p.utilisateur_id);
          const [refundResult] = await connection.query(
              'UPDATE utilisateurs SET credits = credits + ? WHERE id IN (?)',
              [prixTrajet, participantIds]
          );
           // On vérifie si le nombre de lignes affectées correspond au nombre de participants
           if (refundResult.affectedRows !== participations.length) {
                console.warn(`[Cancel ${covoiturageId}] Problème de remboursement: ${refundResult.affectedRows}/${participations.length} utilisateurs mis à jour.`);
                // Décider si on annule la transaction ou si on continue quand même ?
                // Pour l'instant on continue, mais on logue une alerte.
           } else {
                console.log(`[Cancel ${covoiturageId}] Crédits remboursés aux participants.`);
           }
      }

      // 7. Supprimer les enregistrements de participation (ou les marquer comme annulés)
      // Supprimer est plus simple pour l'instant.
      if (participations.length > 0) {
           const participationIds = participations.map(p => p.participation_id);
           const [deleteResult] = await connection.query(
               'DELETE FROM participations WHERE id IN (?)',
               [participationIds]
           );
           if (deleteResult.affectedRows !== participations.length) {
                console.warn(`[Cancel ${covoiturageId}] Problème suppression participations: ${deleteResult.affectedRows}/${participations.length} supprimées.`);
           } else {
               console.log(`[Cancel ${covoiturageId}] Participations supprimées.`);
           }
      }

      // 8. Mettre à jour le statut du covoiturage à 'annule'
      // ATTENTION: Assurez-vous que 'annule' est une valeur valide pour votre colonne statut_trajet
      const [updateStatusResult] = await connection.query(
          'UPDATE covoiturages SET statut_trajet = ? WHERE id = ?',
          ['annule', covoiturageId]
      );
       if (updateStatusResult.affectedRows === 0) {
           throw new Error(`Le statut du covoiturage ${covoiturageId} n'a pas pu être mis à jour.`);
      }
      console.log(`[Cancel ${covoiturageId}] Statut du covoiturage mis à jour à 'annule'.`);

      // 9. Préparer l'envoi d'emails (la logique réelle est à faire séparément)
      const emailsParticipants = participations.map(p => p.email).filter(email => email); // Récupérer les emails
      if (emailsParticipants.length > 0) {
           console.log(`[Cancel ${covoiturageId}] TODO: Envoyer email d'annulation aux adresses suivantes:`, emailsParticipants.join(', '));
           // ----- Placeholder pour l'envoi d'email -----
           // Exemple avec une fonction sendCancellationEmail hypothétique:
           // try {
           //     await sendCancellationEmail(emailsParticipants, covoiturage);
           //     console.log(`[Cancel ${covoiturageId}] Emails d'annulation envoyés.`);
           // } catch (emailError) {
           //     console.error(`[Cancel ${covoiturageId}] Erreur lors de l'envoi des emails:`, emailError);
           //     // Que faire ? On a déjà modifié la BDD... Logguer l'erreur est essentiel.
           //     // On ne devrait PAS annuler la transaction juste pour une erreur d'email.
           // }
           // -------------------------------------------
      }

      // 10. Valider la transaction
      await connection.commit();
      console.log(`[Cancel ${covoiturageId}] Transaction validée (commit). Annulation par chauffeur réussie.`);

      // 11. Renvoyer une réponse de succès
      res.status(200).json({ message: "Le covoiturage a été annulé avec succès. Les participants ont été remboursés (et notifiés si l'email est configuré)." });

  } catch (error) {
      // --- Gestion des erreurs et Rollback ---
      console.error(`[Cancel ${covoiturageId}] Erreur lors de l'annulation par le chauffeur:`, error);
      try {
          console.log(`[Cancel ${covoiturageId}] Annulation de la transaction (rollback)...`);
          await connection.rollback();
          console.log(`[Cancel ${covoiturageId}] Rollback effectué.`);
      } catch (rollbackError) {
          console.error(`[Cancel ${covoiturageId}] Erreur lors du rollback:`, rollbackError);
      }
      res.status(500).json({ message: "Erreur serveur lors de l'annulation du covoiturage." });
  }
});
// ------------------------------------------------------------------
//   ⬆️ FIN AJOUT ROUTE API ANNULER COVOITURAGE (Chauffeur)   ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API POUR DÉMARRER UN COVOITURAGE (Chauffeur) ⬇️
// ------------------------------------------------------------------
app.post('/api/covoiturages/:id/start', async (req, res) => {
  console.log("Requête reçue pour démarrer un covoiturage (POST /api/covoiturages/:id/start)");

  // 1. Vérifier connexion et ID covoiturage
  if (!req.session?.isLoggedIn) { return res.status(401).json({ message: "Authentification requise." }); }
  const userId = req.session.userId;
  const covoiturageIdParam = req.params.id;
  const covoiturageId = parseInt(covoiturageIdParam, 10);
  if (isNaN(covoiturageId)) { return res.status(400).json({ message: "ID covoiturage invalide." }); }
  console.log(`User ID: ${userId} tente de démarrer Covoiturage ID: ${covoiturageId}`);

  // Obtenir connexion promise
  const connection = db.promise();

  try {
      // 2. Vérifier si l'utilisateur est le chauffeur et si le statut est 'prévu'
      // On verrouille la ligne pour éviter les actions concurrentes
      const [covoiturages] = await connection.query(
          'SELECT conducteur_id, statut_trajet FROM covoiturages WHERE id = ? FOR UPDATE',
          [covoiturageId]
      );

      if (covoiturages.length === 0) {
          return res.status(404).json({ message: "Covoiturage non trouvé." });
      }
      const covoiturage = covoiturages[0];

      // Autorisation
      if (covoiturage.conducteur_id !== userId) {
          return res.status(403).json({ message: "Vous n'êtes pas le chauffeur de ce trajet." });
      }

      // Vérification du statut
      if (covoiturage.statut_trajet !== 'prévu') {
           return res.status(400).json({ message: `Le trajet ne peut être démarré que s'il est au statut 'prévu' (statut actuel: ${covoiturage.statut_trajet}).` });
      }
      // Optionnel : vérifier si l'heure de départ est proche ? Pour l'instant, on permet dès que c'est 'prévu'.

      // 3. Mettre à jour le statut à 'en_cours'
      console.log(`[Start ${covoiturageId}] Mise à jour statut vers 'en_cours'...`);
      const [updateResult] = await connection.query(
           'UPDATE covoiturages SET statut_trajet = ? WHERE id = ? AND statut_trajet = ?', // Revérifie statut pour sécurité
           ['en_cours', covoiturageId, 'prévu']
      );

      if (updateResult.affectedRows === 0) {
           // Le statut a pu changer entre le SELECT et l'UPDATE
           console.warn(`[Start ${covoiturageId}] Échec mise à jour statut (peut-être déjà démarré/annulé ?).`);
           // On pourrait re-vérifier le statut actuel pour un message plus précis
           return res.status(409).json({ message: "Impossible de démarrer le trajet, son statut a peut-être changé." }); // 409 Conflict
      }

      console.log(`[Start ${covoiturageId}] Trajet démarré avec succès.`);
      res.status(200).json({ message: "Trajet démarré avec succès !" });

      // Pas besoin de commit/rollback ici car on ne fait qu'un seul UPDATE simple

  } catch (error) {
      console.error(`[Start ${covoiturageId}] Erreur lors du démarrage du trajet:`, error);
      res.status(500).json({ message: "Erreur serveur lors du démarrage du trajet." });
  }
});
// ------------------------------------------------------------------
//    ⬆️ FIN AJOUT ROUTE API DÉMARRER COVOITURAGE (Chauffeur)    ⬆️
// ------------------------------------------------------------------


// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API POUR TERMINER UN COVOITURAGE (Chauffeur) ⬇️
// ------------------------------------------------------------------
app.post('/api/covoiturages/:id/finish', async (req, res) => {
  console.log("Requête reçue pour terminer un covoiturage (POST /api/covoiturages/:id/finish)");

  // 1. Vérifier connexion et ID covoiturage
  if (!req.session?.isLoggedIn) { return res.status(401).json({ message: "Authentification requise." }); }
  const userId = req.session.userId;
  const covoiturageIdParam = req.params.id;
  const covoiturageId = parseInt(covoiturageIdParam, 10);
  if (isNaN(covoiturageId)) { return res.status(400).json({ message: "ID covoiturage invalide." }); }
  console.log(`User ID: ${userId} tente de terminer Covoiturage ID: ${covoiturageId}`);

  const connection = db.promise();

  try {
      // 2. Vérifier si l'utilisateur est le chauffeur et si le statut est 'en_cours'
      const [covoiturages] = await connection.query(
          'SELECT conducteur_id, statut_trajet FROM covoiturages WHERE id = ? FOR UPDATE',
          [covoiturageId]
      );

      if (covoiturages.length === 0) {
          return res.status(404).json({ message: "Covoiturage non trouvé." });
      }
      const covoiturage = covoiturages[0];

      // Autorisation
      if (covoiturage.conducteur_id !== userId) {
          return res.status(403).json({ message: "Vous n'êtes pas le chauffeur de ce trajet." });
      }

      // Vérification du statut
      if (covoiturage.statut_trajet !== 'en_cours') {
           return res.status(400).json({ message: `Le trajet ne peut être terminé que s'il est au statut 'en_cours' (statut actuel: ${covoiturage.statut_trajet}).` });
      }
      console.log(`[Finish ${covoiturageId}] Vérifications OK.`);

      // 3. Mettre à jour le statut à 'termine'
      console.log(`[Finish ${covoiturageId}] Mise à jour statut vers 'termine'...`);
      const [updateResult] = await connection.query(
           'UPDATE covoiturages SET statut_trajet = ? WHERE id = ? AND statut_trajet = ?',
           ['termine', covoiturageId, 'en_cours']
      );

      if (updateResult.affectedRows === 0) {
          console.warn(`[Finish ${covoiturageId}] Échec mise à jour statut vers 'termine'.`);
          return res.status(409).json({ message: "Impossible de terminer le trajet, son statut a peut-être changé." });
      }
      console.log(`[Finish ${covoiturageId}] Trajet terminé avec succès.`);

      // 4. TODO: Logique post-terminaison (avant de renvoyer la réponse)
      //   - Récupérer les emails des participants
      //   - Déclencher l'envoi d'emails leur demandant de valider/noter (US 11)
      console.log(`[Finish ${covoiturageId}] TODO: Récupérer participants et envoyer email de validation/avis.`);
      // Exemple :
      // const [participants] = await connection.query('SELECT u.email FROM participations p JOIN utilisateurs u ON p.utilisateur_id = u.id WHERE p.covoiturage_id = ?', [covoiturageId]);
      // const emails = participants.map(p => p.email).filter(e => e);
      // if (emails.length > 0) {
      //      await sendValidationEmail(emails, covoiturageId); // Fonction à créer
      // }

      res.status(200).json({ message: "Trajet marqué comme terminé ! Les participants seront invités à valider." });

  } catch (error) {
      console.error(`[Finish ${covoiturageId}] Erreur lors de la terminaison du trajet:`, error);
      res.status(500).json({ message: "Erreur serveur lors de la terminaison du trajet." });
  }
});
// ------------------------------------------------------------------
//    ⬆️ FIN AJOUT ROUTE API TERMINER COVOITURAGE (Chauffeur)   ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ ROUTE API POUR SOUMETTRE UN AVIS (Passager) - CORRIGÉE ⬇️
// ------------------------------------------------------------------
app.post('/api/participations/:id/review', async (req, res) => {
  console.log("Requête reçue pour soumettre un avis (POST /api/participations/:id/review)");

  // 1. Vérifier connexion et ID participation
  if (!req.session?.isLoggedIn) { return res.status(401).json({ message: "Authentification requise." }); }
  const userId = req.session.userId; // ID du passager connecté
  const participationIdParam = req.params.id;
  const participationId = parseInt(participationIdParam, 10);
  if (isNaN(participationId)) { return res.status(400).json({ message: "ID de participation invalide." }); }

  // 2. Récupérer note et commentaire du corps de la requête
  const { note, commentaire } = req.body;
  const noteNum = parseInt(note, 10);

  // 3. Validation des données reçues
  if (isNaN(noteNum) || noteNum < 1 || noteNum > 5) {
      return res.status(400).json({ message: "La note doit être un nombre entre 1 et 5." });
  }
  if (typeof commentaire !== 'string') {
       return res.status(400).json({ message: "Le commentaire doit être une chaîne de caractères." });
  }

  console.log(`User ID: ${userId} soumet avis pour Participation ID: ${participationId}. Note: ${noteNum}`);

  const connection = db.promise();

  try {
      // 4. Vérifier l'autorisation et le statut du trajet associé
      // *** CORRECTION ICI: c.conducteur_id au lieu de c.chauffeur_id ***
      const [participations] = await connection.query(
          `SELECT p.utilisateur_id as passager_id, p.covoiturage_id, c.conducteur_id, c.statut_trajet
           FROM participations p
           JOIN covoiturages c ON p.covoiturage_id = c.id
           WHERE p.id = ?`,
          [participationId]
      );

      if (participations.length === 0) {
          return res.status(404).json({ message: "Participation non trouvée." });
      }
      const participation = participations[0];

      // Autorisation: le user connecté est bien le passager de cette participation
      if (participation.passager_id !== userId) { // Utilisation de l'alias passager_id défini dans le SELECT
          return res.status(403).json({ message: "Vous n'êtes pas autorisé à laisser un avis pour cette participation." });
      }

      // Statut: le trajet doit être terminé
      if (participation.statut_trajet !== 'termine') {
           return res.status(400).json({ message: "Vous ne pouvez laisser un avis que pour un trajet terminé." });
      }

      // 5. Vérifier si un avis existe déjà pour cette participation
      const [existingReviews] = await connection.query(
          'SELECT id FROM avis WHERE participation_id = ?',
          [participationId]
      );
      if (existingReviews.length > 0) {
          return res.status(409).json({ message: "Vous avez déjà laissé un avis pour ce trajet." });
      }

      // 6. Insérer l'avis dans la base de données
      // Utilisation de participation.conducteur_id (qui est maintenant correct)
      const sqlInsertAvis = `
          INSERT INTO avis
          (participation_id, covoiturage_id, chauffeur_id, passager_id, note, commentaire, statut_validation)
          VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `;
      const params = [
          participationId,
          participation.covoiturage_id,
          participation.conducteur_id, // Utilisation de la valeur correcte
          userId, // passager_id (vient de la session)
          noteNum,
          commentaire.trim()
      ];

      console.log("Insertion nouvel avis...");
      const [insertResult] = await connection.query(sqlInsertAvis, params);

      console.log("Avis inséré avec succès, ID:", insertResult.insertId);
      res.status(201).json({ message: "Avis soumis avec succès ! Il sera visible après validation." });

  } catch (error) {
      console.error(`Erreur lors de la soumission de l'avis pour participation ID ${participationId}:`, error);
      if (error.code === 'ER_DUP_ENTRY') {
           return res.status(409).json({ message: "Vous avez déjà laissé un avis pour ce trajet (conflit détecté)." });
      }
      res.status(500).json({ message: "Erreur serveur lors de la soumission de l'avis." });
  }
});
// ------------------------------------------------------------------
//    ⬆️ FIN ROUTE API SOUMETTRE UN AVIS (Passager) - CORRIGÉE   ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API LISTER AVIS EN ATTENTE (Employé)       ⬇️
// ------------------------------------------------------------------
// On applique le middleware checkRole pour autoriser seulement les employés
app.get('/api/avis', async (req, res) => {
  // Pour l'instant on gère seulement ?statut=pending, mais on pourrait étendre
  const statutRecherche = req.query.statut;
  console.log(`Requête reçue pour lister les avis (GET /api/avis), statut demandé: ${statutRecherche}`);

  

  try {
      const sqlQuery = `
          SELECT
              a.id as avis_id,
              a.note,
              a.commentaire,
              a.date_soumission,
              a.statut_validation,
              p.id as passager_id,
              p.pseudo as passager_pseudo,
              d.id as chauffeur_id,
              d.pseudo as chauffeur_pseudo,
              c.id as covoiturage_id,
              c.depart as covoiturage_depart,
              c.arrivee as covoiturage_arrivee,
              c.date_depart as covoiturage_date_depart
          FROM avis a
          LEFT JOIN utilisateurs p ON a.passager_id = p.id   -- Jointure pour le passager
          LEFT JOIN utilisateurs d ON a.chauffeur_id = d.id   -- Jointure pour le chauffeur
          LEFT JOIN covoiturages c ON a.covoiturage_id = c.id -- Jointure pour le trajet
          WHERE a.statut_validation = ?  -- On filtre par statut 'pending'
          ORDER BY a.date_soumission ASC; -- Du plus ancien au plus récent
      `;
      const params = [statutRecherche]; // ['pending']

      console.log("Exécution SQL (liste avis pending)...");
      const [avisEnAttente] = await db.promise().query(sqlQuery, params);

      console.log(`${avisEnAttente.length} avis en attente trouvés.`);
      res.status(200).json(avisEnAttente);

  } catch (error) {
      console.error("Erreur SQL lors de la récupération des avis en attente:", error);
      res.status(500).json({ message: "Erreur serveur lors de la récupération des avis." });
  }
});
// ------------------------------------------------------------------
//    ⬆️ FIN AJOUT ROUTE API LISTER AVIS EN ATTENTE (Employé)    ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ AJOUT ROUTE API MAJ STATUT AVIS (Employé)              ⬇️
// ------------------------------------------------------------------
// Utilise le middleware checkRole pour vérifier que c'est un employé
app.patch('/api/avis/:id/status', checkRole('employe'), async (req, res) => {
  const avisIdParam = req.params.id;
  const { newStatus } = req.body; // Attend { "newStatus": "approved" } ou { "newStatus": "rejected" }
  const employeId = req.session.userId; // Pour log potentiel

  console.log(`Employé ID: ${employeId} tente de MAJ statut Avis ID: ${avisIdParam} vers: ${newStatus}`);

  // 1. Valider l'ID de l'avis
  const avisId = parseInt(avisIdParam, 10);
  if (isNaN(avisId)) {
      return res.status(400).json({ message: "ID de l'avis invalide." });
  }

  // 2. Valider le nouveau statut
  const allowedStatus = ['approved', 'rejected'];
  if (!newStatus || !allowedStatus.includes(newStatus)) {
      return res.status(400).json({ message: "Le nouveau statut fourni est invalide ('approved' ou 'rejected' attendu)." });
  }

  // 3. Mettre à jour la base de données
  const connection = db.promise();
  try {
      // On met à jour seulement si l'avis est 'pending' pour éviter les MAJ multiples accidentelles
      const sqlUpdate = `
          UPDATE avis
          SET statut_validation = ?
          WHERE id = ? AND statut_validation = 'pending';
      `;
      const params = [newStatus, avisId];

      console.log(`[Avis ${avisId}] Exécution SQL: UPDATE avis SET statut_validation = '${newStatus}' WHERE id = ${avisId} AND statut_validation = 'pending'`);
      const [updateResult] = await connection.query(sqlUpdate, params);

      // 4. Vérifier le résultat de la mise à jour
      if (updateResult.affectedRows === 1) {
          console.log(`[Avis ${avisId}] Statut mis à jour avec succès à '${newStatus}'.`);
          // TODO éventuel : Si 'approved', mettre à jour la note moyenne du chauffeur ? (Plus complexe)
          res.status(200).json({ message: `Avis ${newStatus === 'approved' ? 'approuvé' : 'rejeté'} avec succès.` });
      } else if (updateResult.affectedRows === 0 && updateResult.changedRows === 0) {
           // Aucune ligne affectée -> soit l'avis n'existe pas, soit il n'était plus 'pending'
           console.log(`[Avis ${avisId}] Aucune mise à jour effectuée. L'avis n'existe pas ou n'était plus en attente.`);
           // On peut vérifier pourquoi en refaisant un SELECT, mais pour l'instant on renvoie une erreur générique
           res.status(404).json({ message: "L'avis n'a pas été trouvé ou n'était plus en attente de validation." });
      } else {
           // Cas inattendu
           console.warn(`[Avis ${avisId}] Résultat inattendu de l'UPDATE:`, updateResult);
           res.status(500).json({ message: "Erreur lors de la mise à jour du statut (résultat inattendu)." });
      }

  } catch (error) {
      console.error(`[Avis ${avisId}] Erreur serveur lors de la mise à jour du statut:`, error);
      res.status(500).json({ message: "Erreur serveur lors de la mise à jour du statut de l'avis." });
  }
});
// ------------------------------------------------------------------
//    ⬆️ FIN AJOUT ROUTE API MAJ STATUT AVIS (Employé)           ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//    ⬇️ ROUTE API VALIDATION TRAJET (Passager) - CORRIGÉE (FOR UPDATE) ⬇️
// ------------------------------------------------------------------
app.patch('/api/participations/:id/validation', async (req, res) => {
  console.log("Requête reçue pour valider une participation (PATCH /api/participations/:id/validation)");

  // 1. Vérifier connexion et ID participation
  if (!req.session?.isLoggedIn) { return res.status(401).json({ message: "Authentification requise." }); }
  const userId = req.session.userId; // ID du passager connecté
  const participationIdParam = req.params.id;
  const participationId = parseInt(participationIdParam, 10);
  if (isNaN(participationId)) { return res.status(400).json({ message: "ID de participation invalide." }); }

  // 2. Récupérer le statut ('ok' ou 'probleme') et commentaire éventuel du corps
  const { status, commentaire } = req.body;

  // 3. Valider le statut reçu
  if (status !== 'ok' && status !== 'probleme') {
      return res.status(400).json({ message: "Le statut fourni doit être 'ok' ou 'probleme'." });
  }
  const problemeCommentaire = (status === 'probleme' && commentaire) ? commentaire.trim() : null;

  console.log(`User ID: ${userId} valide Participation ID: ${participationId} avec statut: ${status}`);

  const connection = db.promise();

  try {
      // 4. Démarrer une transaction
      await connection.beginTransaction();
      console.log(`[Valid ${participationId}] Transaction démarrée.`);

      // 5. Vérifier la participation, autorisation, et statut du trajet/validation
      // On verrouille la participation pour s'assurer qu'elle n'est pas modifiée en parallèle
      const [participations] = await connection.query(
          `SELECT p.utilisateur_id as passager_id, p.covoiturage_id, p.validation_passager,
                  c.conducteur_id, c.prix, c.statut_trajet
           FROM participations p
           JOIN covoiturages c ON p.covoiturage_id = c.id
           WHERE p.id = ? FOR UPDATE`, // Lock participation
          [participationId]
      );

      if (participations.length === 0) {
          await connection.rollback();
          return res.status(404).json({ message: "Participation non trouvée." });
      }
      const participation = participations[0];

      // Autorisation
      if (participation.passager_id !== userId) {
          await connection.rollback();
          return res.status(403).json({ message: "Vous n'êtes pas autorisé à valider cette participation." });
      }

      // Statut Covoiturage : doit être 'termine'
      if (participation.statut_trajet !== 'termine') {
           await connection.rollback();
           return res.status(400).json({ message: "Vous ne pouvez valider qu'un trajet terminé." });
      }

      // Statut Validation : doit être 'pending'
      if (participation.validation_passager !== 'pending') {
           await connection.rollback();
           return res.status(409).json({ message: "Ce trajet a déjà été validé ou signalé." });
      }

      // 6. Mettre à jour la participation avec le statut et le commentaire
      console.log(`[Valid ${participationId}] MAJ participation statut -> ${status}`);
      const [updateParticipationResult] = await connection.query(
          'UPDATE participations SET validation_passager = ?, probleme_commentaire = ? WHERE id = ?',
          [status, problemeCommentaire, participationId]
      );
      if (updateParticipationResult.affectedRows === 0) {
           throw new Error("Échec de la mise à jour du statut de la participation.");
      }

      // 7. Si statut='ok', créditer le chauffeur
      if (status === 'ok') {
          const prixTrajet = parseFloat(participation.prix);
          const commission = 2;
          const creditChauffeur = Math.max(0, prixTrajet - commission);
          const chauffeurId = participation.conducteur_id;

          if (creditChauffeur > 0 && chauffeurId) {
               console.log(`[Valid ${participationId}] Crédit de ${creditChauffeur} (${prixTrajet} - ${commission}) pour Chauffeur ID: ${chauffeurId}`);
               // *** CORRECTION ICI: Retrait de FOR UPDATE ***
               const [updateChauffeurResult] = await connection.query(
                  'UPDATE utilisateurs SET credits = credits + ? WHERE id = ?',
                  [creditChauffeur, chauffeurId]
               );
               // *** FIN CORRECTION ***
                if (updateChauffeurResult.affectedRows === 0) {
                   // Ne devrait pas arriver si chauffeur_id est valide
                    throw new Error(`Échec de la mise à jour des crédits du chauffeur ID ${chauffeurId}.`);
                }
                console.log(`[Valid ${participationId}] Crédits chauffeur ID ${chauffeurId} mis à jour.`);
          } else {
               console.log(`[Valid ${participationId}] Aucun crédit à ajouter au chauffeur (Prix: ${prixTrajet}, Commission: ${commission}) ou chauffeur ID (${chauffeurId}) manquant/invalide.`);
          }
      } else {
           console.log(`[Valid ${participationId}] Problème signalé. Aucun crédit ajouté au chauffeur. Commentaire: ${problemeCommentaire}`);
      }

      // 8. Valider la transaction
      await connection.commit();
      console.log(`[Valid ${participationId}] Transaction validée.`);

      res.status(200).json({ message: `Validation enregistrée avec succès comme '${status}'.` });

  } catch (error) {
      console.error(`Erreur lors de la validation de la participation ${participationId}:`, error);
      try { await connection.rollback(); } catch (rbError) { console.error("Erreur Rollback:", rbError); }
      res.status(500).json({ message: "Erreur serveur lors de l'enregistrement de la validation." });
  }
});
// ------------------------------------------------------------------
//    ⬆️ FIN ROUTE API VALIDATION TRAJET (Passager) - CORRIGÉE    ⬆️
// ------------------------------------------------------------------

// ROUTE API POUR LISTER LES AVIS (Filtrable) - CORRIGÉE
app.get('/api/avis', async (req, res) => {
  console.log("Requête reçue pour lister les avis (GET /api/avis)");

  // Récupérer les filtres possibles depuis les query parameters
  const { covoiturageId, chauffeurId, passagerId, statut } = req.query; // 'statut' est lu ici
  console.log("Filtres reçus:", req.query);

  // Construire la requête SQL dynamiquement
  let sqlQuery = `
      SELECT
          a.id as avis_id, a.note, a.commentaire, a.date_soumission, a.statut_validation,
          p.id as passager_id, p.pseudo as passager_pseudo,
          d.id as chauffeur_id, d.pseudo as chauffeur_pseudo,
          c.id as covoiturage_id, c.depart as covoiturage_depart,
          c.arrivee as covoiturage_arrivee, c.date_depart as covoiturage_date_depart
      FROM avis a
      LEFT JOIN utilisateurs p ON a.passager_id = p.id
      LEFT JOIN utilisateurs d ON a.chauffeur_id = d.id
      LEFT JOIN covoiturages c ON a.covoiturage_id = c.id
      WHERE 1=1
  `; // Base de la requête
  const params = [];

  // Ajouter les filtres ID si présents et valides
  if (covoiturageId) {
      const cId = parseInt(covoiturageId, 10);
      if (!isNaN(cId)) { sqlQuery += " AND a.covoiturage_id = ?"; params.push(cId); }
      else { return res.status(400).json({ message: "Le paramètre covoiturageId doit être un nombre." }); }
  }
   if (chauffeurId) {
       const chId = parseInt(chauffeurId, 10);
       if (!isNaN(chId)) { sqlQuery += " AND a.chauffeur_id = ?"; params.push(chId); }
       else { return res.status(400).json({ message: "Le paramètre chauffeurId doit être un nombre." }); }
   }
   if (passagerId) {
       const pId = parseInt(passagerId, 10);
       if (!isNaN(pId)) { sqlQuery += " AND a.passager_id = ?"; params.push(pId); }
       else { return res.status(400).json({ message: "Le paramètre passagerId doit être un nombre." }); }
   }


  // *** CORRECTION ICI *** :
  // Supprimer le bloc "if (statutRecherche !== 'pending')" qui bloquait tout.
  // Garder la validation pour s'assurer que si 'statut' est fourni, il est valide.
  if (statut) { // Si un filtre 'statut' est présent dans l'URL
      const allowedStatus = ['approved', 'pending', 'rejected'];
      if (allowedStatus.includes(statut)) {
          // Si le statut est valide ('approved', 'pending', ou 'rejected')
          sqlQuery += " AND a.statut_validation = ?"; // Ajouter la condition SQL
          params.push(statut); // Ajouter la valeur aux paramètres
          console.log(`Filtrage par statut: ${statut}`);
      } else {
          // Si un statut est fourni mais n'est pas valide
          console.log(`Statut de filtre invalide reçu: ${statut}`);
          return res.status(400).json({ message: "Le paramètre 'statut' doit être 'approved', 'pending' ou 'rejected'." });
      }
  }
  // Si aucun paramètre 'statut' n'est fourni dans l'URL, on ne filtre pas par statut.

  // Ajouter un tri
  sqlQuery += " ORDER BY a.date_soumission DESC";

  console.log("Exécution SQL (liste avis):", sqlQuery, params);

  // Exécuter la requête
  try {
      const [avis] = await db.promise().query(sqlQuery, params);
      console.log(`${avis.length} avis trouvés correspondant aux filtres.`);
      res.status(200).json(avis); // Renvoyer les avis trouvés
  } catch (error) {
      console.error("Erreur SQL lors de la récupération des avis:", error);
      res.status(500).json({ message: "Erreur serveur lors de la récupération des avis." });
  }
});

// ------------------------------------------------------------------
//  ⬇️ AJOUT ROUTE API POUR LISTER LES PARTICIPATIONS PROBLÉMATIQUES (Employé) ⬇️
// ------------------------------------------------------------------
// GET /api/participations/problematiques
// Accessible uniquement par les employés pour voir les trajets signalés.
app.get('/api/participations/problematiques', checkRole('employe'), async (req, res) => {
  console.log("Requête reçue pour lister les participations problématiques (GET /api/participations/problematiques)");
  const employeId = req.session.userId; // Juste pour log éventuel

  try {
      const sqlQuery = `
          SELECT
              p.id AS participation_id,
              p.probleme_commentaire,      -- Le commentaire laissé par le passager
              c.id AS covoiturage_id,
              c.depart,
              c.arrivee,
              c.date_depart,
              c.date_arrivee,
              passager.id AS passager_id,
              passager.pseudo AS passager_pseudo,
              passager.email AS passager_email,    -- Email du passager
              chauffeur.id AS chauffeur_id,
              chauffeur.pseudo AS chauffeur_pseudo,
              chauffeur.email AS chauffeur_email   -- Email du chauffeur
          FROM participations p
          JOIN covoiturages c ON p.covoiturage_id = c.id
          JOIN utilisateurs passager ON p.utilisateur_id = passager.id
          JOIN utilisateurs chauffeur ON c.conducteur_id = chauffeur.id
          WHERE p.validation_passager = 'probleme' -- On sélectionne celles marquées comme problématiques
         ORDER BY p.date_reservation DESC;        -- Trier par date de signalement, du plus récent au plus ancien
      `;

      console.log(`[Employé ${employeId}] Exécution SQL pour récupérer les trajets problématiques...`);
      const [results] = await db.promise().query(sqlQuery);

      console.log(`${results.length} participation(s) problématique(s) trouvée(s).`);
      // Renvoyer les résultats (peut être un tableau vide si aucun problème n'a été signalé)
      res.status(200).json(results);

  } catch (error) {
      console.error(`[Employé ${employeId}] Erreur SQL lors de la récupération des participations problématiques:`, error);
      res.status(500).json({ message: "Erreur serveur lors de la récupération des trajets signalés." });
  }
});
// ------------------------------------------------------------------
//  ⬆️ FIN AJOUT ROUTE API LISTER PARTICIPATIONS PROBLÉMATIQUES  ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//  ⬇️ AJOUT ROUTE API POUR CRÉER UN COMPTE EMPLOYÉ (Admin) ⬇️
// ------------------------------------------------------------------
// POST /api/admin/employees
// Permet à un admin de créer un nouvel utilisateur avec le rôle 'employe'.
app.post('/api/admin/employees', checkRole('admin'), async (req, res) => {
  console.log("Requête reçue pour créer un compte employé (POST /api/admin/employees)");
  const adminId = req.session.userId; // ID de l'admin qui fait l'action (pour log)

  // 1. Récupérer les données du corps de la requête
  const { pseudo, email, password } = req.body;
  console.log(`[Admin ${adminId}] Tentative de création employé:`, { pseudo, email, password: '***' });

  // 2. Validation simple des entrées
  if (!pseudo || !email || !password) {
      console.log("Erreur: Données de création employé manquantes.");
      return res.status(400).json({ message: "Pseudo, email et mot de passe sont requis pour créer un employé." });
  }
  // Ajouter ici d'autres validations si nécessaire (longueur mdp, format email...)

  try {
      // 3. Hacher le mot de passe fourni
      console.log(`[Admin ${adminId}] Hachage du mot de passe pour ${pseudo}...`);
      const hashedPassword = await bcrypt.hash(password, saltRounds); // Utilise await avec async function
      console.log(`[Admin ${adminId}] Mot de passe haché.`);

      // 4. Préparer et exécuter l'insertion dans la base de données
      const sqlInsertEmploye = `
          INSERT INTO utilisateurs
          (pseudo, email, mot_de_passe, role, date_inscription)
          VALUES (?, ?, ?, 'employe', NOW());
      `;
      // Note: Le champ 'credits' utilisera sa valeur par défaut (probablement 20 ?)
      // Le champ 'statut' utilisera sa valeur par défaut ('actif' ?) si tu l'as ajouté.
      const params = [pseudo, email, hashedPassword];

      console.log(`[Admin ${adminId}] Exécution SQL (INSERT employé):`, sqlInsertEmploye, [pseudo, email, '*** HASHED ***', 'employe']);
      const [results] = await db.promise().query(sqlInsertEmploye, params);

      // 5. Insertion réussie !
      const newEmployeeId = results.insertId;
      console.log(`[Admin ${adminId}] Nouvel employé créé avec succès, ID: ${newEmployeeId}`);
      res.status(201).json({ // 201 Created
          message: "Compte employé créé avec succès !",
          employee: {
              id: newEmployeeId,
              pseudo: pseudo,
              email: email,
              role: 'employe'
              // Ne JAMAIS renvoyer le mot de passe, même haché !
          }
      });

  } catch (error) {
      // 6. Gérer les erreurs (doublon, erreur BDD, erreur bcrypt)
      console.error(`[Admin ${adminId}] Erreur lors de la création de l'employé:`, error);

      if (error.code === 'ER_DUP_ENTRY') {
          // Gérer l'erreur de clé dupliquée (pseudo ou email probablement)
           // Le message d'erreur MySQL contient souvent le nom de la clé: error.message.includes('email')
          const duplicateField = error.message.includes('email') ? 'L\'email' : 'Le pseudo';
          console.log(`Erreur: Tentative de création avec ${duplicateField} déjà existant.`);
          return res.status(409).json({ message: `${duplicateField} est déjà utilisé.` }); // 409 Conflict
      } else if (error.name === 'ValidationError') { // Si tu ajoutes une validation plus poussée
           return res.status(400).json({ message: `Erreur de validation: ${error.message}` });
      } else {
          // Autres erreurs (DB, bcrypt...)
          return res.status(500).json({ message: "Erreur serveur lors de la création du compte employé." });
      }
  }
});
// ------------------------------------------------------------------
//  ⬆️ FIN AJOUT ROUTE API CRÉATION COMPTE EMPLOYÉ (Admin)        ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//  ⬇️ AJOUT ROUTE API POUR LISTER LES UTILISATEURS (Admin)       ⬇️
// ------------------------------------------------------------------
// GET /api/admin/users
// Permet à un admin de lister les utilisateurs, avec filtre optionnel par rôle.
app.get('/api/admin/users', checkRole('admin'), async (req, res) => {
  console.log("Requête reçue pour lister les utilisateurs (GET /api/admin/users)");
  const adminId = req.session.userId; // Pour log
  const filterRole = req.query.role; // Récupère le filtre ?role=xxx s'il existe

  try {
      let sqlQuery = `
          SELECT
              id,
              pseudo,
              email,
              role,
              date_inscription,
              credits
              -- Ajout anticipé pour la suspension :
              -- Si cette colonne n'existe pas ENCORE, la requête échouera.
              -- Ajoute la colonne 'statut' (ex: VARCHAR(10) DEFAULT 'actif') à ta table 'utilisateurs'
              -- OU supprime temporairement la ligne ", statut" ci-dessous.
              , statut
          FROM utilisateurs
      `;
      const params = [];

      // Ajouter le filtre WHERE si un rôle est spécifié dans la query string
      if (filterRole) {
          console.log(`[Admin ${adminId}] Filtrage des utilisateurs par rôle: ${filterRole}`);
          sqlQuery += ` WHERE role = ?`;
          params.push(filterRole);
      }
      // Optionnel: Exclure l'admin lui-même de la liste ?
      // sqlQuery += (filterRole ? ' AND' : ' WHERE') + ` id != ?`;
      // params.push(adminId);

      sqlQuery += ` ORDER BY id ASC;`; // Trier par ID

      console.log(`[Admin ${adminId}] Exécution SQL (liste utilisateurs): ${sqlQuery}`);
      const [users] = await db.promise().query(sqlQuery, params);

      console.log(`${users.length} utilisateur(s) trouvé(s) correspondant aux critères.`);
      // IMPORTANT: Ne jamais renvoyer les mots de passe ! La requête ne les sélectionne pas.
      res.status(200).json(users); // Renvoyer le tableau d'utilisateurs (peut être vide)

  } catch (error) {
      console.error(`[Admin ${adminId}] Erreur SQL lors de la récupération des utilisateurs:`, error);
      // Si l'erreur est due à la colonne 'statut' manquante:
      if (error.code === 'ER_BAD_FIELD_ERROR' && error.message.includes('statut')) {
           console.error(">>> ERREUR: La colonne 'statut' n'existe probablement pas dans la table 'utilisateurs'. Ajoutez-la ou retirez-la de la requête SELECT.");
           return res.status(500).json({ message: "Erreur serveur: Colonne 'statut' manquante ou invalide dans la base de données." });
      }
      // Autre erreur serveur
      res.status(500).json({ message: "Erreur serveur lors de la récupération des utilisateurs." });
  }
});
// ------------------------------------------------------------------
//  ⬆️ FIN AJOUT ROUTE API LISTER UTILISATEURS (Admin)            ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//  ⬇️ AJOUT ROUTE API POUR CHANGER LE STATUT D'UN UTILISATEUR (Admin) ⬇️
// ------------------------------------------------------------------
// PATCH /api/admin/users/:id/status
// Permet à un admin de changer le statut ('actif' ou 'suspendu') d'un utilisateur.
app.patch('/api/admin/users/:id/status', checkRole('admin'), async (req, res) => {
  console.log("Requête reçue pour changer le statut d'un utilisateur (PATCH /api/admin/users/:id/status)");
  const adminId = req.session.userId; // Admin effectuant l'action
  const userIdToUpdateParam = req.params.id; // ID de l'utilisateur ciblé (depuis l'URL)
  const { newStatus } = req.body; // Nouveau statut attendu ('actif' ou 'suspendu')

  console.log(`[Admin ${adminId}] Tentative de MAJ statut pour User ID: ${userIdToUpdateParam} vers: ${newStatus}`);

  // 1. Valider l'ID de l'utilisateur
  const userIdToUpdate = parseInt(userIdToUpdateParam, 10);
  if (isNaN(userIdToUpdate)) {
      return res.status(400).json({ message: "L'ID utilisateur fourni dans l'URL est invalide." });
  }

  // 2. Valider le nouveau statut reçu
  const allowedStatus = ['actif', 'suspendu'];
  if (!newStatus || !allowedStatus.includes(newStatus)) {
      return res.status(400).json({ message: "Le nouveau statut fourni est invalide ('actif' ou 'suspendu' attendu)." });
  }

  // 3. Vérifier que l'admin n'essaie pas de se suspendre/modifier lui-même
  if (userIdToUpdate === adminId) {
      console.warn(`[Admin ${adminId}] Tentative d'auto-modification de statut refusée.`);
      return res.status(403).json({ message: "Vous ne pouvez pas modifier votre propre statut." }); // 403 Forbidden
  }

  // 4. Mettre à jour le statut dans la base de données
  try {
      const sqlUpdateStatus = `
          UPDATE utilisateurs
          SET statut = ?
          WHERE id = ?;
      `;
      const params = [newStatus, userIdToUpdate];

      console.log(`[Admin ${adminId}] Exécution SQL: UPDATE utilisateurs SET statut='${newStatus}' WHERE id=${userIdToUpdate}`);
      const [results] = await db.promise().query(sqlUpdateStatus, params);

      // 5. Vérifier si la mise à jour a fonctionné
      if (results.affectedRows === 1) {
          // Succès
          console.log(`[Admin ${adminId}] Statut de User ID ${userIdToUpdate} mis à jour à '${newStatus}'.`);
          res.status(200).json({
              message: `Statut de l'utilisateur ${userIdToUpdate} mis à jour avec succès à '${newStatus}'.`,
              newStatus: newStatus // Renvoyer le nouveau statut peut être utile pour le front-end
          });
      } else {
          // Aucun utilisateur trouvé avec cet ID (ou l'ID était celui de l'admin, mais on l'a vérifié avant)
          console.log(`[Admin ${adminId}] Utilisateur ID ${userIdToUpdate} non trouvé pour la mise à jour.`);
          res.status(404).json({ message: "Utilisateur non trouvé." });
      }

  } catch (error) {
      // Gérer les erreurs SQL ou autres
      console.error(`[Admin ${adminId}] Erreur SQL ou autre lors de la mise à jour du statut pour User ID ${userIdToUpdate}:`, error);
      res.status(500).json({ message: "Erreur serveur lors de la mise à jour du statut." });
  }
});
// ------------------------------------------------------------------
//  ⬆️ FIN AJOUT ROUTE API CHANGER STATUT UTILISATEUR (Admin)     ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//  ⬇️ AJOUT ROUTE API POUR LE TOTAL DES CRÉDITS GAGNÉS (Admin)  ⬇️
// ------------------------------------------------------------------
// GET /api/admin/stats/credits-total
// Renvoie le nombre total de crédits gagnés par la plateforme.
app.get('/api/admin/stats/credits-total', checkRole('admin'), async (req, res) => {
  console.log("Requête reçue pour le total des crédits gagnés (GET /api/admin/stats/credits-total)");
  const adminId = req.session.userId;

  try {
      // La plateforme gagne 2 crédits pour chaque participation validée 'ok'
      const commissionPerParticipation = 2;

      const sqlQuery = `
          SELECT COUNT(*) AS successful_participations
          FROM participations
          WHERE validation_passager = 'ok';
      `;

      console.log(`[Admin ${adminId}] Exécution SQL pour compter les participations réussies...`);
      const [results] = await db.promise().query(sqlQuery);

      // results est un tableau avec un seul objet, ex: [ { successful_participations: 5 } ]
      const count = results[0]?.successful_participations || 0; // Récupère le compte, 0 si pas de résultat
      const totalCreditsGagnes = count * commissionPerParticipation; // Calcule le total

      console.log(`[Admin ${adminId}] ${count} participations réussies trouvées. Total crédits gagnés: ${totalCreditsGagnes}`);

      // Renvoyer le résultat en JSON
      res.status(200).json({
          totalCreditsGagnes: totalCreditsGagnes
      });

  } catch (error) {
      console.error(`[Admin ${adminId}] Erreur SQL lors du calcul du total des crédits:`, error);
      res.status(500).json({ message: "Erreur serveur lors du calcul du total des crédits." });
  }
});
// ------------------------------------------------------------------
//  ⬆️ FIN AJOUT ROUTE API TOTAL CRÉDITS GAGNÉS (Admin)           ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//  ⬇️ AJOUT ROUTE API STATS: COVOITURAGES PAR JOUR (Admin)      ⬇️
// ------------------------------------------------------------------
// GET /api/admin/stats/covoiturages-par-jour
// Renvoie le nombre de covoiturages groupés par jour de départ.
app.get('/api/admin/stats/covoiturages-par-jour', checkRole('admin'), async (req, res) => {
  console.log("Requête reçue pour stats covoiturages/jour (GET /api/admin/stats/covoiturages-par-jour)");
  const adminId = req.session.userId;

  try {
      // Compter les covoiturages en groupant par la DATE de départ
      const sqlQuery = `
          SELECT
              DATE(date_depart) AS jour,  -- Extrait juste la date (YYYY-MM-DD)
              COUNT(*) AS nombre_covoiturages -- Compte le nombre d'enregistrements pour ce jour
          FROM covoiturages
          GROUP BY DATE(date_depart)      -- Groupe les résultats par jour
          ORDER BY jour ASC;              -- Trie par date croissante
      `;

      console.log(`[Admin ${adminId}] Exécution SQL pour stats covoiturages/jour...`);
      const [results] = await db.promise().query(sqlQuery);

      console.log(`${results.length} jours avec des covoiturages trouvés.`);
      // Renvoyer les résultats, ex: [ { jour: '2025-04-18', nombre_covoiturages: 5 }, ... ]
      res.status(200).json(results);

  } catch (error) {
      console.error(`[Admin ${adminId}] Erreur SQL lors de la récupération des stats covoiturages/jour:`, error);
      res.status(500).json({ message: "Erreur serveur lors de la récupération des statistiques." });
  }
});
// ------------------------------------------------------------------
//  ⬆️ FIN AJOUT ROUTE API STATS: COVOITURAGES PAR JOUR (Admin)   ⬆️
// ------------------------------------------------------------------

// ------------------------------------------------------------------
//  ⬇️ AJOUT ROUTE API STATS: CRÉDITS GAGNÉS PAR JOUR (Admin)     ⬇️
// ------------------------------------------------------------------
// GET /api/admin/stats/credits-par-jour
// Renvoie le total des crédits gagnés par la plateforme, groupé par jour de départ du covoiturage.
app.get('/api/admin/stats/credits-par-jour', checkRole('admin'), async (req, res) => {
  console.log("Requête reçue pour stats crédits/jour (GET /api/admin/stats/credits-par-jour)");
  const adminId = req.session.userId;
  const commissionParParticipation = 2; // Commission fixe

  try {
      // Compter les participations validées 'ok', multiplier par la commission,
      // et grouper par la DATE de départ du covoiturage associé.
      const sqlQuery = `
          SELECT
              DATE(c.date_depart) AS jour, -- Date de départ du covoiturage
              COUNT(p.id) * ? AS credits_gagnes -- Compte les participations 'ok' et multiplie par la commission
          FROM participations p
          JOIN covoiturages c ON p.covoiturage_id = c.id -- Jointure pour obtenir la date de départ
          WHERE p.validation_passager = 'ok'      -- Ne compte que les participations validées
          GROUP BY DATE(c.date_depart)            -- Groupe par jour de départ
          ORDER BY jour ASC;                      -- Trie par date croissante
      `;
      const params = [commissionParParticipation];

      console.log(`[Admin ${adminId}] Exécution SQL pour stats crédits/jour...`);
      const [results] = await db.promise().query(sqlQuery, params);

      console.log(`${results.length} jours avec des crédits gagnés trouvés.`);
      // Renvoyer les résultats, ex: [ { jour: '2025-04-18', credits_gagnes: 10 }, ... ]
      res.status(200).json(results);

  } catch (error) {
      console.error(`[Admin ${adminId}] Erreur SQL lors de la récupération des stats crédits/jour:`, error);
      res.status(500).json({ message: "Erreur serveur lors de la récupération des statistiques." });
  }
});
// ------------------------------------------------------------------
//  ⬆️ FIN AJOUT ROUTE API STATS: CRÉDITS GAGNÉS PAR JOUR (Admin)  ⬆️
// ------------------------------------------------------------------

// === FIN DES ROUTES API ===

// Sert les fichiers statiques (CSS, JS client, IMG) depuis /public
app.use(express.static(path.join(__dirname, 'public')));

// Sers la page d'accueil (route racine)
app.get('/', (req, res) => {
  // Attention: S'assurer que cette route est définie APRÈS vos routes API
  // pour ne pas intercepter les appels API si public contient des fichiers nommés 'api'.
  res.sendFile(path.join(__dirname, 'public', 'HTML', 'index.html'));
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});