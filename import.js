const fs = require('fs');
const csv = require('csv-parser');
const Database = require('better-sqlite3');
const db = new Database('database/collection.db');

// On s'assure que la table est prête
db.exec(`
    CREATE TABLE IF NOT EXISTS albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        catalog_id TEXT,
        artist TEXT,
        title TEXT,
        label TEXT,
        format TEXT,
        year INTEGER,
        vinyl_condition TEXT,
        sleeve_condition TEXT,
        notes TEXT,
        tracklist TEXT,
        cover_url TEXT,
        is_wishlist INTEGER DEFAULT 0
    )
`);

const insert = db.prepare(`
    INSERT INTO albums (catalog_id, artist, title, label, format, year, vinyl_condition, sleeve_condition, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

console.log("Début de l'importation (Séparateur ;) ...");

fs.createReadStream('albums.csv')
  .pipe(csv({
      separator: ';', // <-- C'est ici qu'on précise le point-virgule
      headers: ['catalog', 'artist', 'title', 'label', 'format', 'year', 'vinyl_cond', 'sleeve_cond', 'notes'],
      skipLines: 0 
  }))
  .on('data', (row) => {
    try {
        insert.run(
            row.catalog,
            row.artist,
            row.title,
            row.label,
            row.format,
            parseInt(row.year) || null,
            row.vinyl_cond,
            row.sleeve_cond,
            row.notes
        );
        console.log(`✅ Importé : ${row.artist} - ${row.title}`);
    } catch (err) {
        console.error(`❌ Erreur sur la ligne : ${row.title}`, err.message);
    }
  })
  .on('end', () => {
    console.log('--- Importation terminée avec succès ! ---');
    process.exit();
  });