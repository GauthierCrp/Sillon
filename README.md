> **Redonnez du relief à votre collection de vinyles.**
>
> Sillon est l'écrin numérique que mérite votre discothèque. Conçu pour les passionnés, cet outil allie une interface **Glassmorphism** moderne à la puissance de l'API **Discogs**. Ne vous contentez plus d'une liste textuelle : transformez votre inventaire en une galerie interactive, fluide et automatisée.

---

## ✨ Fonctionnalités clés

* **🎨 Interface Glassmorphism** : Un design premium avec flous dynamiques et transparences, pensé pour mettre en valeur les visuels de vos albums.
* **💿 Scan Intelligent Discogs** : Récupération automatique des pochettes originales via l'API Discogs avec une **barre de progression en temps réel** (via Server-Sent Events).
* **📥 Importation Massive** : Migrez votre collection instantanément grâce à l'import CSV structuré (gestion de 9 colonnes spécifiques).
* **🖼️ Optimisation des Médias** : Traitement automatique via **Sharp** pour des images légères, rapides à charger et parfaitement dimensionnées (600px).
* **⚙️ Gestion des Paramètres** : Contrôle total sur votre Token API et vos données, avec masquage de sécurité pour vos clés privées.
* **🛡️ Base de Données Locale** : Vos données vous appartiennent, stockées en toute sécurité dans une base SQLite ultra-rapide.
* 
<img width="1200" height="720" alt="image" src="https://github.com/user-attachments/assets/63f7969f-3848-4f53-840b-cb8ab0b4db85" />
---

## 🚀 Guide de déploiement

### 1. Prérequis
* **Node.js** (v18.x ou supérieur recommandé)
* **NPM**
* Un compte **Discogs** (pour obtenir votre Token personnel)

### 2. Installation
Clonez le dépôt et installez les dépendances :
```bash
git clone [https://github.com/votre-utilisateur/sillon.git](https://github.com/votre-utilisateur/sillon.git)
cd sillon
npm install

### 3. Lancement de l'application

Démarrez le serveur :
Bash

node app.js

L'application est maintenant accessible sur : http://localhost:3002

### 4. Configuration initiale

    Connectez-vous à l'interface.

    Rendez-vous dans la page Paramètres.

    Saisissez votre Token Discogs et enregistrez-le.

    Vous pouvez désormais lancer un scan des pochettes ou importer votre fichier CSV.

📊 Format d'importation CSV

Pour un import réussi, votre fichier .csv doit respecter l'ordre suivant :

    Id Catalog | 2. Artiste | 3. Titre | 4. Label | 5. Format | 6. Année | 7. État Vinyle | 8. État Pochette | 9. Notes

🛠️ Stack Technique

    Backend : Node.js & Express

    Base de données : SQLite (via better-sqlite3)

    Traitement d'image : Sharp

    Communication API : Axios & Server-Sent Events (SSE)

    Frontend : HTML5, CSS3, Vanilla JS

📝 Licence

Ce projet est sous licence MIT.

<p align="center">Fait avec passion pour les amoureux du 33 tours. 🎶</p>
