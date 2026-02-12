const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const sharp = require('sharp');
const axios = require('axios');
const session = require('express-session');
const archiver = require('archiver');
const unzipper = require('unzipper');
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const port = 3002;


// --- CRÉATION AUTOMATIQUE DES DOSSIERS ---
const dirs = [
    path.join(__dirname, 'database'),
    path.join(__dirname, 'public', 'uploads')
];

dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Dossier créé : ${dir}`);
    }
});

// --- 1. CONFIGURATION DE LA BASE DE DONNÉES ---
const dbPath = path.join(__dirname, 'database', 'collection.db');
let db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    catalog_id TEXT,
    artist TEXT,
    title TEXT,
    label TEXT,
    format TEXT,
    year INTEGER,
    style TEXT,
    vinyl_condition TEXT,
    sleeve_condition TEXT,
    notes TEXT,
    tracklist TEXT,
    cover_url TEXT,
    is_wishlist INTEGER DEFAULT 0,
    label_url TEXT,
    vinyl_color TEXT DEFAULT '#111'
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run('token_discogs', '');
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run('admin_login', 'admin');
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run('admin_password', 'admin');

console.log("✅ Configuration initiale vérifiée.");

// --- 2. CONFIGURATION DE MULTER (UPLOADS) ---
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });
const uploadFields = upload.fields([
    { name: 'cover_file', maxCount: 1 },
    { name: 'label_file', maxCount: 1 }
]);

// --- 3. MIDDLEWARES DE BASE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'ton_secret_ultra_confidentiel', 
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: { 
        maxAge: 3600000,
        secure: false,
        sameSite: 'lax'
    }
}));

// --- 4. MIDDLEWARES DE SÉCURITÉ ---

// Middleware pour vérifier si l'utilisateur est connecté
const isAuthenticated = (req, res, next) => {
    if (req.session.isLoggedIn) {
        return next();
    }
    // Si c'est une requête API, on envoie une erreur 401
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: "Non autorisé" });
    }
    // Sinon, on redirige vers la page de login
    res.redirect('/login');
};

// --- 5. ROUTES D'AUTHENTIFICATION ---

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const adminLogin = db.prepare("SELECT value FROM settings WHERE key = 'admin_login'").get();
    const adminPass = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get();

    const validUser = adminLogin ? adminLogin.value : 'admin';
    const validPass = adminPass ? adminPass.value : 'admin';

    if (username === validUser && password === validPass) {
        req.session.isLoggedIn = true;
        res.status(200).json({ success: true });
    } else {
        res.status(401).json({ success: false, message: "Identifiants invalides" });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- 6.a MIDDLEWARE STATIQUE ---
app.use(express.static(path.join(__dirname, 'public')));

// --- 6.b PROTECTION DES PAGES HTML ---

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/inventory', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'inventory.html'));
});

app.get('/add', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'add.html'));
});

app.get('/wishlist', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'wishlist.html'));
});

app.get('/add-wishlist', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'add-wishlist.html'));
});

app.get('/stats', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'stats.html'));
});

app.get('/settings', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'settings.html'));
});

app.use((req, res, next) => {
    if (req.url.startsWith('/api') || req.url.includes('.')) {
        return next();
    }
    
    if (req.session.admin) {
        res.redirect('/inventory');
    } else {
        res.redirect('/login');
    }
});


// --- 7. ROUTES API (PROTÉGÉES) ---

app.get('/api/albums', isAuthenticated, (req, res) => {
    const isWishlist = req.query.wishlist === 'true' ? 1 : 0;
    const albums = db.prepare('SELECT * FROM albums WHERE is_wishlist = ? ORDER BY artist ASC, year DESC').all(isWishlist);
    res.json(albums);
});

app.post('/api/albums', isAuthenticated, uploadFields, async (req, res) => {
    try {
        const { catalog_id, artist, title, label, format, year, style, vinyl_condition, sleeve_condition, tracklist, notes, vinyl_color, is_wishlist } = req.body;
        
        const wishlistVal = is_wishlist === '1' ? 1 : 0;

        let cover_url = null;
        let label_url = null;

        const processImage = async (file, prefix) => {
            const filename = `${prefix}-${Date.now()}.jpg`;
            const outputPath = path.join(__dirname, 'public/uploads', filename);
            await sharp(file.path)
                .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toFile(outputPath);
            fs.unlinkSync(file.path);
            return `/uploads/${filename}`;
        };

        if (req.files['cover_file']) {
            cover_url = await processImage(req.files['cover_file'][0], 'opti-cover');
        }
        if (req.files['label_file']) {
            label_url = await processImage(req.files['label_file'][0], 'opti-label');
        }

        const insert = db.prepare(`
            INSERT INTO albums (catalog_id, artist, title, label, format, year, style, vinyl_condition, sleeve_condition, tracklist, notes, cover_url, label_url, vinyl_color, is_wishlist)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        insert.run(
            catalog_id, 
            artist, 
            title, 
            label, 
            format, 
            parseInt(year) || null, 
            style, 
            vinyl_condition, 
            sleeve_condition, 
            tracklist, 
            notes, 
            cover_url, 
            label_url, 
            vinyl_color || '#111111',
            wishlistVal 
        );
        
        res.status(201).json({ message: "Album ajouté avec succès !" });
    } catch (err) { 
        console.error("Erreur lors de l'ajout de l'album:", err);
        res.status(500).json({ error: err.message }); 
    }
});

app.put('/api/albums/:id', isAuthenticated, upload.fields([
    { name: 'cover_file', maxCount: 1 },
    { name: 'label_file', maxCount: 1 }
]), async (req, res) => {
    const albumId = req.params.id;
    const { 
        title, artist, year, format, style, catalog_id, label, 
        vinyl_condition, sleeve_condition, tracklist, notes, vinyl_color 
    } = req.body;
    
    try {
        // 1. On récupère les anciennes infos pour gérer la suppression des fichiers remplacés
        const oldAlbum = db.prepare('SELECT cover_url, label_url FROM albums WHERE id = ?').get(albumId);
        
        // Base de la requête
        let query = `UPDATE albums SET title=?, artist=?, year=?, format=?, style=?, catalog_id=?, label=?, vinyl_condition=?, sleeve_condition=?, tracklist=?, notes=?, vinyl_color=?`;
        let params = [title, artist, year, format, style, catalog_id, label, vinyl_condition, sleeve_condition, tracklist, notes, vinyl_color];

        // 2. Gestion de la POCHETTE (cover_file)
        if (req.files && req.files['cover_file']) {
            const file = req.files['cover_file'][0];
            const filename = `opti-cover-${Date.now()}.jpg`;
            const outputPath = path.join(__dirname, 'public/uploads', filename);

            await sharp(file.path)
                .resize(600, 600, { fit: 'cover' })
                .jpeg({ quality: 80 })
                .toFile(outputPath);

            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

            query += `, cover_url=?`;
            params.push(`/uploads/${filename}`);

            // Supprimer l'ancienne cover physique
            if (oldAlbum && oldAlbum.cover_url) {
                const oldPath = path.join(__dirname, 'public', oldAlbum.cover_url);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        // 3. Gestion du MACARON (label_file)
        if (req.files && req.files['label_file']) {
            const file = req.files['label_file'][0];
            const filename = `opti-label-${Date.now()}.jpg`;
            const outputPath = path.join(__dirname, 'public/uploads', filename);

            await sharp(file.path)
                .resize(400, 400, { fit: 'cover' })
                .jpeg({ quality: 80 })
                .toFile(outputPath);

            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

            query += `, label_url=?`;
            params.push(`/uploads/${filename}`);

            // Supprimer l'ancien label physique
            if (oldAlbum && oldAlbum.label_url) {
                const oldPath = path.join(__dirname, 'public', oldAlbum.label_url);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        query += ` WHERE id=?`;
        params.push(albumId);

        db.prepare(query).run(...params);
        res.json({ success: true, message: "Album mis à jour avec succès" });

    } catch (err) {
        console.error("Erreur lors de la mise à jour :", err);
        // Nettoyage en cas d'erreur
        if (req.files) {
            Object.values(req.files).forEach(fileArray => {
                fileArray.forEach(file => {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                });
            });
        }
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/albums/:id', isAuthenticated, (req, res) => {
    const album = db.prepare('SELECT cover_url, label_url FROM albums WHERE id = ?').get(req.params.id);
    
    // Suppression des fichiers physiques
    [album.cover_url, album.label_url].forEach(url => {
        if (url) {
            const filePath = path.join(__dirname, 'public', url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    });

    db.prepare('DELETE FROM albums WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});
///////////////////////////////////////////////////////////////////////////////////
//PAGE STATS////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
app.get('/api/stats', isAuthenticated, (req, res) => {
    try {
        // Compteurs de base
        const total = db.prepare("SELECT COUNT(*) as count FROM albums WHERE is_wishlist = 0").get()?.count || 0;
        const coloredCount = db.prepare("SELECT COUNT(*) as count FROM albums WHERE is_wishlist = 0 AND vinyl_color NOT IN ('#111111', '#000000', 'black', '#111')").get()?.count || 0;
        
        // Vinyle le plus ancien et le plus récent
        const oldest = db.prepare("SELECT artist, title, year FROM albums WHERE is_wishlist = 0 AND year > 0 ORDER BY year ASC LIMIT 1").get() || null;
        const newest = db.prepare("SELECT artist, title, year FROM albums WHERE is_wishlist = 0 AND year > 0 ORDER BY year DESC LIMIT 1").get() || null;
        
        // Listes pour les graphiques (on force un tableau vide [] si aucun résultat)
        const topArtists = db.prepare("SELECT artist, COUNT(*) as count FROM albums WHERE is_wishlist = 0 GROUP BY artist ORDER BY count DESC LIMIT 5").all() || [];
        const styles = db.prepare("SELECT style, COUNT(*) as count FROM albums WHERE is_wishlist = 0 GROUP BY style ORDER BY count DESC").all() || [];
        const conditionsVinyl = db.prepare("SELECT vinyl_condition as condition, COUNT(*) as count FROM albums WHERE is_wishlist = 0 GROUP BY vinyl_condition").all() || [];
        const conditionsSleeve = db.prepare("SELECT sleeve_condition as condition, COUNT(*) as count FROM albums WHERE is_wishlist = 0 GROUP BY sleeve_condition").all() || [];

        res.json({ 
            total, 
            coloredCount, 
            oldest, 
            newest, 
            topArtists, 
            styles, 
            conditionsVinyl, 
            conditionsSleeve 
        });
    } catch (err) {
        console.error("Erreur API Stats:", err);
        res.status(500).json({ error: err.message });
    }
});

///////////////////////////////////////////////////////////////////////////////////
//PAGE SETTINGS////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////

//// Route pour SAUVEGARDER le token
app.post('/api/settings/token', (req, res) => {
    const { token } = req.body;
    try {
        const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
        stmt.run('token_discogs', token);
        res.json({ success: true, message: "Token enregistré" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route pour RÉCUPÉRER le token (pour l'afficher dans l'input au chargement)
app.get('/api/settings/token', (req, res) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get('token_discogs');
    res.json({ token: row ? row.value : "" });
});

//// Route pour vider la base et supprimer les images
app.post('/api/settings/reset', isAuthenticated, (req, res) => {
    try {
        // 1. Vider la table des albums
        db.prepare('DELETE FROM albums').run();

        // 2. Nettoie physiquement le fichier et réduit sa taille
        db.prepare('VACUUM').run();

        // 3. Vider le dossier des images
        const uploadsPath = path.join(__dirname, 'public', 'uploads');
        
        if (fs.existsSync(uploadsPath)) {
            const files = fs.readdirSync(uploadsPath);
            
            for (const file of files) {
                const filePath = path.join(uploadsPath, file);
                
                // On vérifie si c'est un fichier (pour ne pas supprimer les sous-dossiers par erreur)
                // ou on utilise l'option recursive pour tout nettoyer
                if (fs.lstatSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                } else if (fs.lstatSync(filePath).isDirectory()) {
                    // Si vous avez des sous-dossiers (comme 'labels'), on les vide aussi
                    fs.rmSync(filePath, { recursive: true, force: true });
                }
            }
        }

        res.json({ success: true, message: "Base de données vidée et images supprimées" });
    } catch (err) { 
        console.error("Erreur lors du reset :", err);
        res.status(500).json({ error: err.message }); 
    }
});

// Route pour passer un album de Wishlist à Collection
app.post('/api/albums/:id/collect', isAuthenticated, (req, res) => {
    try {
        const result = db.prepare('UPDATE albums SET is_wishlist = 0 WHERE id = ?').run(req.params.id);
        if (result.changes > 0) {
            res.json({ success: true, message: "Album ajouté à la collection !" });
        } else {
            res.status(404).json({ error: "Album non trouvé" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//// API : Scan Discogs (Téléchargement local + Sharp)

function normalizeSearchTerm(term) {
    if (!term) return "";
    return term
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

app.get('/api/settings/scan-covers', isAuthenticated, async (req, res) => {
    // Configuration pour le streaming vers le navigateur
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get('token_discogs');
    const DISCOGS_TOKEN = row ? row.value : null;

    if (!DISCOGS_TOKEN || DISCOGS_TOKEN.trim() === "") {
        res.write(`data: ${JSON.stringify({ error: "Token Discogs manquant dans les réglages" })}\n\n`);
        return res.end();
    }

    // Sélection des albums qui n'ont pas encore de pochette
    const albums = db.prepare("SELECT id, artist, title FROM albums WHERE cover_url IS NULL OR cover_url = '' OR cover_url = 'undefined'").all();
    const total = albums.length;
    let count = 0;

    console.log(`--- Lancement du scan pour ${total} albums ---`);

    for (let i = 0; i < albums.length; i++) {
        const album = albums[i];
        let success = false;
        let attempts = 0;

        while (!success && attempts < 2) {
            try {
                // Recherche sur Discogs
                const searchResponse = await axios.get(`https://api.discogs.com/database/search`, {
                    params: {
                        q: `${album.artist} ${album.title}`,
                        type: 'release',
                        token: DISCOGS_TOKEN.trim()
                    },
                    headers: {
                        // User-Agent de navigateur réel pour éviter le blocage 403
                        'User-Agent': 'Sillon/1.1 sillon.mail@gmail.com',
                        'Authorization': `Discogs token=${DISCOGS_TOKEN.trim()}`
                    }
                });

                const results = searchResponse.data.results;

                if (results && results.length > 0) {
                    // On cherche le premier résultat avec une image valide
                    const match = results.find(r => r.cover_image && !r.cover_image.includes('spacer.gif'));

                    if (match) {
                        const imgUrl = match.cover_image;

                        // Téléchargement de l'image
                        const imageResponse = await axios.get(imgUrl, {
                            responseType: 'arraybuffer',
                            headers: { 
                                'User-Agent': 'Sillon/1.1 sillon.mail@gmail.com',
                                'Authorization': `Discogs token=${DISCOGS_TOKEN.trim()}`
                            }
                        });

                        const filename = `discogs-${album.id}.jpg`;
                        const outputPath = path.join(__dirname, 'public', 'uploads', filename);

                        // Traitement de l'image avec Sharp
                        await sharp(imageResponse.data)
                            .resize(600, 600, { fit: 'cover' })
                            .jpeg({ quality: 80 })
                            .toFile(outputPath);

                        // Mise à jour de la base de données
                        db.prepare("UPDATE albums SET cover_url = ? WHERE id = ?").run(`/uploads/${filename}`, album.id);
                        count++;
                        console.log(`✅ ${album.title} : Image sauvegardée.`);
                    }
                }

                success = true; // On sort de la boucle while
                
                // Envoi de la progression au navigateur
                res.write(`data: ${JSON.stringify({ 
                    progress: Math.round(((i + 1) / total) * 100), 
                    current: i + 1, 
                    total: total, 
                    title: album.title 
                })}\n\n`);

                // Pause de sécurité entre chaque album (Important pour éviter le 429)
                await new Promise(r => setTimeout(r, 3500));

            } catch (error) {
                attempts++;
                if (error.response && error.response.status === 429) {
                    console.error(`⚠️ Limite atteinte (429) pour ${album.title}. Pause de 60s...`);
                    await new Promise(r => setTimeout(r, 60000));
                } else if (error.response && error.response.status === 403) {
                    console.error("❌ Erreur 403 : Accès refusé par Discogs. Arrêt du scan.");
                    res.write(`data: ${JSON.stringify({ error: "L'API Discogs bloque l'accès (403). Réessayez plus tard ou changez d'IP." })}\n\n`);
                    return res.end();
                } else {
                    console.error(`❌ Erreur sur ${album.title}:`, error.message);
                    success = true; // On passe à l'album suivant malgré l'erreur
                }
            }
        }
    }

    console.log(`--- Scan terminé : ${count} images récupérées ---`);
    res.write(`data: ${JSON.stringify({ success: true, message: `${count} pochettes récupérées !` })}\n\n`);
    res.end();
});


////Import en Masse via csv//////////

const csv = require('csv-parser');

app.post('/api/settings/import-csv', isAuthenticated, upload.single('csv_file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

    const results = [];

    // Lecture du flux CSV
    fs.createReadStream(req.file.path)
        .pipe(csv({ separator: ';',
            headers: [
                'catalog_id', 'artist', 'title', 'label', 'format', 
                'year', 'vinyl_condition', 'sleeve_condition', 'notes'
            ],
            skipLines: 1 // On saute la ligne d'en-tête du fichier CSV
        }))
        .on('data', (data) => {
            // Nettoyage et préparation des données
            results.push({
                catalog_id: data.catalog_id?.trim() || '',
                artist: data.artist?.trim() || 'Inconnu',
                title: data.title?.trim() || 'Sans titre',
                label: data.label?.trim() || '',
                format: data.format?.trim() || '',
                year: parseInt(data.year) || 0,
                vinyl_condition: data.vinyl_condition?.trim() || '',
                sleeve_condition: data.sleeve_condition?.trim() || '',
                notes: data.notes?.trim() || ''
            });
        })
        .on('end', () => {
            if (results.length === 0) {
                return res.status(400).json({ error: "Le fichier CSV est vide." });
            }

            // Insertion en masse dans la base de données
            const insert = db.prepare(`
                INSERT INTO albums (
                    catalog_id, artist, title, label, format, 
                    year, vinyl_condition, sleeve_condition, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const insertMany = db.transaction((albums) => {
                for (const album of albums) {
                    insert.run(
                        album.catalog_id,
                        album.artist,
                        album.title,
                        album.label,
                        album.format,
                        album.year,
                        album.vinyl_condition,
                        album.sleeve_condition,
                        album.notes
                    );
                }
            });

            try {
                insertMany(results);
                // Suppression du fichier temporaire après import
                fs.unlinkSync(req.file.path);
                res.json({ success: true, message: `${results.length} albums importés avec succès !` });
            } catch (err) {
                console.error("Erreur insertion BDD:", err);
                res.status(500).json({ error: "Erreur lors de l'écriture en base de données." });
            }
        });
});

//// Route de Backup Complet (DB + Images)
app.get('/api/settings/backup', isAuthenticated, (req, res) => {
    // Nom du fichier avec la date du jour
    const fileName = `backup-myvinyl-${new Date().toISOString().split('T')[0]}.zip`;

    // Configuration des headers pour le téléchargement
    res.attachment(fileName);

    const archive = archiver('zip', { zlib: { level: 9 } });

    // Gestion des erreurs d'archivage
    archive.on('error', (err) => {
        res.status(500).send({ error: err.message });
    });

    // Envoi du zip directement dans la réponse HTTP (streaming)
    archive.pipe(res);

    // 1. Ajouter le fichier de base de données
    const dbPath = path.join(__dirname, 'database', 'collection.db');
    if (fs.existsSync(dbPath)) {
        archive.file(dbPath, { name: 'collection.db' });
    }

    // 2. Ajouter tout le dossier d'images
    const uploadsPath = path.join(__dirname, 'public', 'uploads');
    if (fs.existsSync(uploadsPath)) {
        // 'uploads/' définit le nom du dossier à l'intérieur du ZIP
        archive.directory(uploadsPath, 'uploads');
    }

    // Finaliser l'archive
    archive.finalize();
});

//// Route de Restauration (Upload ZIP)
app.post('/api/settings/restore', isAuthenticated, multer({ dest: 'temp/' }).single('backup'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier fourni" });

    const zipPath = req.file.path;

    try {
        db.close();
        console.log("🔒 Base de données fermée pour restauration");

        // 2. Ouvrir le ZIP et traiter chaque fichier
        const directory = await unzipper.Open.file(zipPath);
        
        for (const file of directory.files) {
            if (file.path === 'collection.db') {
                const targetPath = path.join(__dirname, 'database', 'collection.db');
                const content = await file.buffer();
                fs.writeFileSync(targetPath, content);
                console.log("✅ Base de données restaurée dans /database/");
            } 
            
            else if (file.path.startsWith('uploads/')) {
                const relativePath = file.path.replace('uploads/', '');
                const targetPath = path.join(__dirname, 'public', 'uploads', relativePath);
                
                const destDir = path.dirname(targetPath);
                if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

                const content = await file.buffer();
                fs.writeFileSync(targetPath, content);
            }
        }

        db = new Database('./database/collection.db');
        console.log("🔓 Base de données ré-ouverte");

        // 4. Nettoyage
        fs.unlinkSync(zipPath);

        res.json({ success: true, message: "Restauration terminée et fichiers placés correctement." });

    } catch (err) {
        console.error("Erreur Restauration détaillée:", err);
        // Tenter de ré-ouvrir la BDD même en cas d'erreur pour ne pas bloquer l'app
        try { db = new Database('./database/collection.db'); } catch(e) {}
        res.status(500).json({ error: "Échec de la restauration : " + err.message });
    }
});

//// Route pour modifier les identifiants de connexion
app.post('/api/settings/update-auth', isAuthenticated, (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).json({ error: "Le login et le mot de passe ne peuvent pas être vides." });
    }

    try {
        const updateLogin = db.prepare("UPDATE settings SET value = ? WHERE key = 'admin_login'");
        const updatePass = db.prepare("UPDATE settings SET value = ? WHERE key = 'admin_password'");

        // On utilise une transaction pour être sûr que les deux sont mis à jour
        const updateAuth = db.transaction((l, p) => {
            updateLogin.run(l);
            updatePass.run(p);
        });

        updateAuth(login, password);

        res.json({ success: true, message: "Identifiants mis à jour avec succès !" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 8. LANCEMENT ---
app.listen(port, () => {
    console.log(`Sillon tourne sur http://localhost:${port}`);
});