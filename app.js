const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');

const app = express();
const port = 3002;

// --- 1. CONFIGURATION DE LA BASE DE DONNÉES ---
const db = new Database('./database/collection.db');
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
    is_wishlist INTEGER DEFAULT 0
  )
`);

// --- 2. CONFIGURATION DE MULTER (UPLOADS) ---
const uploadDir = './public/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// --- 3. MIDDLEWARES DE BASE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'ton_secret_ultra_confidentiel', 
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 } // Session de 1 heure
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
    res.redirect('/login.html');
};

// --- 5. ROUTES D'AUTHENTIFICATION ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Identifiants à personnaliser
    if (username === 'admin' && password === 'vinyl2024') {
        req.session.isLoggedIn = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "Identifiants incorrects" });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});

// --- 6. PROTECTION DES PAGES HTML ---
// On protège les pages sensibles individuellement AVANT d'exposer le dossier public

app.get('/', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/inventory.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'inventory.html'));
});

app.get('/add.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'add.html'));
});

// Libère l'accès aux fichiers statiques (CSS, images, login.html)
app.use(express.static('public'));

// --- 7. ROUTES API (PROTÉGÉES) ---

app.get('/api/stats', isAuthenticated, (req, res) => {
    try {
        const count = db.prepare('SELECT COUNT(*) as total FROM albums WHERE is_wishlist = 0').get();
        const topArtist = db.prepare('SELECT artist, COUNT(*) as count FROM albums WHERE is_wishlist = 0 GROUP BY artist ORDER BY count DESC LIMIT 1').get();
        const wishCount = db.prepare('SELECT COUNT(*) as total FROM albums WHERE is_wishlist = 1').get();

        res.json({
            totalVinyls: count.total,
            topArtist: topArtist ? topArtist.artist : "Aucun",
            wishlistCount: wishCount.total
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/albums', isAuthenticated, (req, res) => {
    const isWishlist = req.query.wishlist === 'true' ? 1 : 0;
    const albums = db.prepare('SELECT * FROM albums WHERE is_wishlist = ? ORDER BY artist ASC').all(isWishlist);
    res.json(albums);
});

app.post('/api/albums', isAuthenticated, upload.single('cover_file'), (req, res) => {
    try {
        const { catalog_id, artist, title, label, format, year, style, vinyl_condition, sleeve_condition, tracklist, notes } = req.body;
        const cover_url = req.file ? `/uploads/${req.file.filename}` : null;
        const insert = db.prepare(`
            INSERT INTO albums (catalog_id, artist, title, label, format, year, style, vinyl_condition, sleeve_condition, tracklist, notes, cover_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insert.run(catalog_id, artist, title, label, format, parseInt(year) || null, style, vinyl_condition, sleeve_condition, tracklist, notes, cover_url);
        res.status(201).json({ message: "Album ajouté !" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/albums/:id', isAuthenticated, upload.single('cover_file'), (req, res) => {
    const albumId = req.params.id;
    const { title, artist, year, format, style, catalog_id, label, vinyl_condition, sleeve_condition, tracklist, notes } = req.body;
    try {
        const oldAlbum = db.prepare('SELECT cover_url FROM albums WHERE id = ?').get(albumId);
        let query = `UPDATE albums SET title=?, artist=?, year=?, format=?, style=?, catalog_id=?, label=?, vinyl_condition=?, sleeve_condition=?, tracklist=?, notes=?`;
        let params = [title, artist, year, format, style, catalog_id, label, vinyl_condition, sleeve_condition, tracklist, notes];

        if (req.file) {
            query += `, cover_url=?`;
            params.push(`/uploads/${req.file.filename}`);
            if (oldAlbum && oldAlbum.cover_url) {
                const oldFilePath = path.join(__dirname, 'public', oldAlbum.cover_url);
                if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
            }
        }
        query += ` WHERE id=?`;
        params.push(albumId);
        db.prepare(query).run(...params);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/albums/:id', isAuthenticated, (req, res) => {
    db.prepare('DELETE FROM albums WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// --- 8. LANCEMENT ---
app.listen(port, () => {
    console.log(`MyVinyl tourne sur http://localhost:${port}`);
});