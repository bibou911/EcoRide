# Projet EcoRide - Covoiturage Écologique

Application web de covoiturage développée dans le cadre de l'ECF Développeur Web et Web Mobile.

## Technologies Utilisées

 Node.js (v20.x)
* Express.js (v5.1+)
* MySQL (via le pilote mysql2 v3.14+)
* MongoDB (via le pilote mongodb v6.16+)
* HTML5
* CSS3
* Bootstrap 5.3.3
* JavaScript (côté client)
* bcrypt (pour le hachage des mots de passe)
* dotenv (pour les variables d'environnement)
* express-session (pour les sessions utilisateur)
* npm (gestionnaire de paquets Node.js)

## Prérequis

* Node.js (version 20.x recommandée)
* npm (normalement installé avec Node.js)
* Un serveur MySQL fonctionnel
* Un serveur MongoDB fonctionnel
* Git (pour cloner le projet)

## Installation et Lancement Local

git clone [(https://github.com/bibou911/EcoRide.git)]

*cd projetecoride

Installer les dépendances (outils nécessaires listés dans package.json

npm install

4.  **Configurer l'environnement :**
    * Copiez le fichier d'exemple `.env.example` et renommez la copie en `.env`.
        ```bash
        cp .env.example .env
        ```
    * Modifiez le fichier `.env` pour y mettre vos propres informations :
        * Votre chaîne de connexion MongoDB (`MONGO_URI`).
        * Vos identifiants MySQL (`MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`). Assurez-vous que l'utilisateur et la base de données existent sur votre serveur MySQL.
        * Le port si vous voulez utiliser autre chose que `4000` (`PORT`).
        * Une clé secrète longue et aléatoire pour `SESSION_SECRET`.

5.  **Mise en place des bases de données :**

* **Pour MySQL :**
        1.  Assurez-vous que votre serveur MySQL est démarré.
        2.  Connectez-vous à MySQL (via la ligne de commande, phpMyAdmin, MySQL Workbench, etc.).
        3.  Créez la base de données qui est spécifiée dans votre fichier `.env` (par défaut `ecoride`) si elle n'existe pas déjà. Par exemple, en ligne de commande :
            ```sql
            CREATE DATABASE IF NOT EXISTS ecoride CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            ```
        4.  Importez la structure et les données initiales en utilisant le fichier `ecoride.sql` fourni à la racine du projet. Adaptez la commande suivante avec votre nom d'utilisateur MySQL :
            ```bash
            # Depuis le terminal, à la racine du projet :
            mysql -u votre_utilisateur_mysql -p ecoride < ecoride.sql
            ```
            *(Entrez votre mot de passe MySQL quand il vous sera demandé).*

6.  **Lancer l'application :**
    * Une fois que les dépendances sont installées, le fichier `.env` est configuré et les bases de données sont prêtes, vous pouvez démarrer le serveur Node.js :
        ```bash
        node server.js
        ```
    * Si tout se passe bien, le serveur devrait indiquer qu'il écoute sur le port spécifié dans le fichier `.env` (par défaut `4000`).
    * Ouvrez votre navigateur web et allez à l'adresse : `http://localhost:4000` (ou le port que vous avez configuré).            