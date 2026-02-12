# 💿 Sillon

**Domptez votre collection, un microsillon à la fois.**

[![Docker Support](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com/)
[![Node.js Version](https://img.shields.io/badge/Node.js-v22-green?logo=node.js)](https://nodejs.org/)

---

## 🎸 C'est quoi Sillon ?

Marre des fichiers Excel poussiéreux ou des étagères où l'on ne retrouve jamais rien ? **Sillon** est votre nouveau compagnon de route pour gérer votre audiothèque. Que vous soyez un collectionneur compulsif de vinyles colorés ou un puriste du pressage original, MyVinyl vous permet de cataloguer, visualiser et chérir votre musique avec une interface moderne, fluide et un brin rétro.

<img width="1841" height="989" alt="image" src="https://github.com/user-attachments/assets/0670c6cb-78aa-4723-a21a-ab58615eeec3" />
<img width="1841" height="989" alt="image" src="https://github.com/user-attachments/assets/cfebcb15-b015-41c4-8967-776baadbb072" />


---

## 🚀 Fonctionnalités du Groove

* **🗂️ Gestion de Collection :** Ajoutez vos albums, gérez les labels, les formats et les pressages.
* **📊 Stats Dashboard :** Visualisez votre collection avec des graphiques élégants (Top artistes, répartition par style, états des disques).
* **📂 Dossiers Intelligents :** Séparez votre collection réelle de votre **Wishlist** (pour ne plus jamais oublier ce que vous cherchez en brocante).
* **📸 Gestion des Visuels :** Upload de pochettes et optimisation automatique des images avec Sharp.
* **🌈 Support Vinyles Colorés :** Identifiez en un coup d'œil vos éditions limitées.
* **🔐 Accès Sécurisé :** Une page d'authentification robuste pour que vous soyez le seul maître à bord.
* **💾 Backup & Restore :** Exportez toute votre base de données et vos photos dans un seul fichier ZIP en un clic.

<img width="800" height="600" alt="image" src="https://github.com/user-attachments/assets/5e040548-c094-4fb5-91db-5afa7611d7f8" /> <img width="800" height="600" alt="image" src="https://github.com/user-attachments/assets/0afcf8c2-c8b0-46c3-ac9e-8a37aa420733" />

<img width="1841" height="989" alt="image" src="https://github.com/user-attachments/assets/d52a1185-d842-4ac0-9eb1-d6eec69db2d1" />


---

## 🛠️ Installation (Local)

### Prérequis
* **Node.js v22** ou supérieur
* Un navigateur qui aime la musique

### Étapes
1.  Clonez ce dépôt.
2.  Installez les dépendances :
    ```bash
    npm install
    ```
3.  Lancez le serveur :
    ```bash
    node app.js
    ```
4.  Rendez-vous sur `http://localhost:3002`.

---

## 🐳 Installation (Docker - La méthode VIP)

C'est la méthode recommandée pour garder vos données bien au chaud.

1.  Assurez-vous d'avoir **Docker** et **Docker Compose** installés.
2.  Lancez la commande magique :
    ```bash
    docker compose up -d --build
    ```
3.  **C'est tout.** Votre collection est persistante dans les dossiers `./database` et `./public/uploads`.



---

## 🎨 Design & Couleurs
L'application utilise une esthétique **Glassmorphism** avec des touches de violet profond (`#831a86`) et de bleu pastel (`#c1c4ef`) pour une expérience visuelle relaxante, idéale pour écouter un bon disque.

---

## 🎷 Le mot de la fin
> "La musique mérite mieux qu'un tableau de calcul. Elle mérite un écrin."

*Développé avec ❤️ pour les amoureux du son.*
