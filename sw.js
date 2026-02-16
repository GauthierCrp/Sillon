self.addEventListener('install', (e) => {
    console.log('Service Worker installé !');
  });
  
  self.addEventListener('fetch', (e) => {
    // Nécessaire pour valider le critère PWA, 
    // même si on ne fait rien de spécial ici.
    e.respondWith(fetch(e.request));
  });