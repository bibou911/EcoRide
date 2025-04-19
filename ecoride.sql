-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : sam. 19 avr. 2025 à 11:16
-- Version du serveur : 8.3.0
-- Version de PHP : 8.2.18

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `ecoride`
--

-- --------------------------------------------------------

--
-- Structure de la table `avis`
--

DROP TABLE IF EXISTS `avis`;
CREATE TABLE IF NOT EXISTS `avis` (
  `id` int NOT NULL AUTO_INCREMENT,
  `participation_id` int NOT NULL COMMENT 'Lien vers la participation unique',
  `covoiturage_id` int DEFAULT NULL COMMENT 'FK vers le covoiturage (utile pour requêtes)',
  `chauffeur_id` int DEFAULT NULL COMMENT 'FK vers l utilisateur chauffeur (utile)',
  `passager_id` int DEFAULT NULL COMMENT 'FK vers l utilisateur passager (qui a écrit)',
  `note` tinyint UNSIGNED NOT NULL COMMENT 'Note donnée (ex: 1 à 5)',
  `commentaire` text COMMENT 'Commentaire laissé par le passager',
  `date_soumission` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de soumission de l avis',
  `statut_validation` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending' COMMENT 'Statut de validation par employé',
  PRIMARY KEY (`id`),
  UNIQUE KEY `participation_id` (`participation_id`),
  KEY `fk_avis_passager` (`passager_id`),
  KEY `idx_avis_covoiturage` (`covoiturage_id`),
  KEY `idx_avis_chauffeur` (`chauffeur_id`),
  KEY `idx_avis_statut` (`statut_validation`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Table pour stocker les avis laissés par les passagers sur les chauffeurs après un trajet';

--
-- Déchargement des données de la table `avis`
--

INSERT INTO `avis` (`id`, `participation_id`, `covoiturage_id`, `chauffeur_id`, `passager_id`, `note`, `commentaire`, `date_soumission`, `statut_validation`) VALUES
(1, 4, 11, 4, 6, 5, 'William est ponctuel est efficace, je recommande !', '2025-04-18 15:21:02', 'approved');

-- --------------------------------------------------------

--
-- Structure de la table `covoiturages`
--

DROP TABLE IF EXISTS `covoiturages`;
CREATE TABLE IF NOT EXISTS `covoiturages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `depart` varchar(255) NOT NULL,
  `arrivee` varchar(255) NOT NULL,
  `date_depart` datetime NOT NULL,
  `date_arrivee` datetime NOT NULL,
  `prix` decimal(10,2) NOT NULL,
  `place_restante` int NOT NULL,
  `conducteur_id` int NOT NULL,
  `marque` varchar(255) NOT NULL,
  `modele` varchar(255) NOT NULL,
  `energie` varchar(255) NOT NULL,
  `conducteur_note` int DEFAULT NULL,
  `is_ecologique` tinyint(1) DEFAULT NULL,
  `statut_trajet` varchar(20) DEFAULT 'prévu' COMMENT 'Statut actuel du trajet (prévu, en_cours, termine, annule)',
  PRIMARY KEY (`id`),
  KEY `conducteur_id` (`conducteur_id`)
) ENGINE=MyISAM AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `covoiturages`
--

INSERT INTO `covoiturages` (`id`, `depart`, `arrivee`, `date_depart`, `date_arrivee`, `prix`, `place_restante`, `conducteur_id`, `marque`, `modele`, `energie`, `conducteur_note`, `is_ecologique`, `statut_trajet`) VALUES
(1, 'Paris', 'Lyon', '2025-05-01 08:00:00', '2025-05-01 12:00:00', 20.00, 3, 1, 'Peugeot', '308', 'Essence', 3, NULL, 'prévu'),
(2, 'Paris', 'Lyon', '2025-07-10 08:00:00', '2025-07-10 14:00:00', 25.50, 3, 1, 'Tesla', 'Model 3', 'Electrique', 5, 1, 'prévu'),
(3, 'Paris', 'Lyon', '2025-07-10 09:00:00', '2025-07-10 13:30:00', 30.00, 1, 2, 'BMW', 'M3', 'Essence', 5, 0, 'prévu'),
(4, 'Paris', 'Lyon', '2025-07-15 10:00:00', '2025-07-15 16:00:00', 26.00, 2, 1, 'Renault', 'Zoe', 'Electrique', 5, 1, 'prévu'),
(5, 'Lyon', 'Marseille', '2025-07-12 07:00:00', '2025-07-12 11:00:00', 22.00, 0, 2, 'Audi', 'A4', 'Diesel', 5, 0, 'prévu'),
(6, 'Lille', 'Paris', '2025-04-15 18:00:00', '2025-04-15 21:00:00', 15.00, 1, 1, 'Tesla', 'Model 3', 'Electrique', 5, 1, 'prévu'),
(7, 'Annecy', 'Paris', '2025-04-18 12:20:00', '2025-04-18 15:20:00', 45.00, 3, 4, 'Nissan', 'qashqai', 'Diesel', NULL, 0, 'prévu'),
(8, 'Annecy', 'Paris', '2025-04-19 16:16:00', '2025-04-19 22:16:00', 30.00, 3, 4, 'Nissan', 'qashqai', 'Diesel', NULL, 0, 'annule'),
(9, 'Annecy', 'Paris', '2025-04-18 17:30:00', '2025-04-18 20:30:00', 25.00, 3, 4, 'Nissan', 'qashqai', 'Diesel', NULL, 0, 'termine'),
(10, 'Mennecy', 'Bondoufle', '2025-04-18 17:00:00', '2025-04-18 17:15:00', 10.00, 2, 4, 'Nissan', 'qashqai', 'Diesel', NULL, 0, 'prévu'),
(11, 'Mennecy', 'Bondoufle', '2025-04-20 17:03:00', '2025-04-20 18:03:00', 10.00, 2, 4, 'Nissan', 'qashqai', 'Diesel', NULL, 0, 'termine');

-- --------------------------------------------------------

--
-- Structure de la table `participations`
--

DROP TABLE IF EXISTS `participations`;
CREATE TABLE IF NOT EXISTS `participations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `utilisateur_id` int NOT NULL,
  `covoiturage_id` int NOT NULL,
  `date_reservation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `validation_passager` enum('pending','ok','probleme') NOT NULL DEFAULT 'pending' COMMENT 'Statut de validation par le passager',
  `probleme_commentaire` text COMMENT 'Commentaire si le passager signale un problème',
  PRIMARY KEY (`id`),
  KEY `utilisateur_id` (`utilisateur_id`),
  KEY `covoiturage_id` (`covoiturage_id`),
  KEY `idx_validation_passager` (`validation_passager`)
) ENGINE=MyISAM AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `participations`
--

INSERT INTO `participations` (`id`, `utilisateur_id`, `covoiturage_id`, `date_reservation`, `validation_passager`, `probleme_commentaire`) VALUES
(3, 6, 10, '2025-04-18 14:40:39', 'pending', NULL),
(4, 6, 11, '2025-04-18 15:04:03', 'ok', NULL);

-- --------------------------------------------------------

--
-- Structure de la table `utilisateurs`
--

DROP TABLE IF EXISTS `utilisateurs`;
CREATE TABLE IF NOT EXISTS `utilisateurs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pseudo` varchar(255) NOT NULL,
  `mot_de_passe` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `photo_url` varchar(255) DEFAULT NULL,
  `date_inscription` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `credits` int DEFAULT '20',
  `role` varchar(20) DEFAULT 'passager' COMMENT 'Roles: passager, chauffeur, passager_chauffeur',
  `statut` varchar(10) NOT NULL DEFAULT 'actif',
  `pref_fumeur` tinyint(1) DEFAULT NULL COMMENT 'NULL = non spécifié, 1 = fumeur OK, 0 = non-fumeur',
  `pref_animaux` tinyint(1) DEFAULT NULL COMMENT 'NULL = non spécifié, 1 = animaux OK, 0 = pas animaux',
  `pref_autres` text COMMENT 'Champ libre pour autres préférences',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `utilisateurs`
--

INSERT INTO `utilisateurs` (`id`, `pseudo`, `mot_de_passe`, `email`, `photo_url`, `date_inscription`, `credits`, `role`, `statut`, `pref_fumeur`, `pref_animaux`, `pref_autres`) VALUES
(1, 'JeanDupont', '12345', 'jean@example.com', NULL, '2025-04-16 14:53:09', 20, 'passager', 'actif', NULL, NULL, NULL),
(2, 'JeanD', 'motdepasse_securise1', 'jean.d@test.com', NULL, '2025-04-17 08:00:58', 20, 'passager', 'actif', NULL, NULL, NULL),
(3, 'AliceM', 'motdepasse_securise2', 'alice.m@test.com', 'images/profil/alice_m.png', '2025-04-17 08:00:58', 20, 'passager', 'actif', NULL, NULL, NULL),
(4, 'william', '$2b$10$hWeH9REZ2NXf/aNfbyn2Qe/HZB4d91inEgx87elySiFD03o6gI5ki', 'william@test.com', NULL, '2025-04-17 09:57:42', 200, 'admin', 'actif', 0, 1, 'Aime la vitesse'),
(5, 'julia', '$2b$10$vckofV49BAbzbP0D9fGNaeHP/jtYIK791GohYlPUbb0RT38vP1q0W', 'julia@test.com', NULL, '2025-04-17 10:06:23', 20, 'passager', 'actif', NULL, NULL, NULL),
(6, 'romain', '$2b$10$kbFMv1QP38/Y1KWlZsL/K.TVPZ5yoG9ZJ8Xzy3jKDChl3baTykV1C', 'romain@test.com', NULL, '2025-04-17 10:07:52', 26, 'chauffeur', 'actif', NULL, NULL, NULL),
(7, 'administrateur', '$2b$10$.5Swlyu.l/8L6jPlK3bMweEnCaHEQit0J7cQJsKcyS8yOJimM9ici', 'admin@test.com', NULL, '2025-04-19 08:49:47', 20, 'employe', 'actif', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `vehicules`
--

DROP TABLE IF EXISTS `vehicules`;
CREATE TABLE IF NOT EXISTS `vehicules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `utilisateur_id` int NOT NULL,
  `plaque_immat` varchar(20) DEFAULT NULL COMMENT 'Plaque d''immatriculation',
  `date_premiere_immat` date DEFAULT NULL COMMENT 'Date de 1ère immatriculation',
  `marque` varchar(50) NOT NULL,
  `modele` varchar(50) NOT NULL,
  `couleur` varchar(30) DEFAULT NULL,
  `energie` varchar(20) DEFAULT NULL COMMENT 'Electrique, Essence, Diesel, etc.',
  `nb_places` int NOT NULL COMMENT 'Nombre de places du véhicule (ex: 4)',
  `date_ajout` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `utilisateur_id` (`utilisateur_id`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `vehicules`
--

INSERT INTO `vehicules` (`id`, `utilisateur_id`, `plaque_immat`, `date_premiere_immat`, `marque`, `modele`, `couleur`, `energie`, `nb_places`, `date_ajout`) VALUES
(1, 6, 'FV-112-CM', '2020-01-18', 'Nissan', 'Juke', 'Noir', 'Essence', 4, '2025-04-18 08:40:20'),
(2, 4, 'GK-147-DB', '2018-06-18', 'Nissan', 'qashqai', 'Blanc', 'Diesel', 4, '2025-04-18 09:10:47');
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
