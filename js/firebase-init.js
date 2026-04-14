// Configuração e inicialização partilhada do Firebase
// Inclui este ficheiro em todas as páginas depois dos SDKs Firebase.

// Evita inicializações duplicadas caso seja incluído em várias páginas
if (!firebase.apps.length) {
  const firebaseConfig = {
    apiKey: "AIzaSyBbTDfCCC9o5oxMSMRsvCUC50Iu6L0aqT8",
    authDomain: "calendario-trabalho-39a6c.firebaseapp.com",
    projectId: "calendario-trabalho-39a6c",
    storageBucket: "calendario-trabalho-39a6c.firebasestorage.app",
    messagingSenderId: "596069405321",
    appId: "1:596069405321:web:275bb9da220206d3da6c58"
  };

  firebase.initializeApp(firebaseConfig);
}

// Atalhos globais úteis (opcional usar)
window.firebaseAuth = firebase.auth();
window.firebaseDb   = firebase.firestore();

// ── Offline Persistence ──────────────────────────────────────────────────────
// Guarda dados no IndexedDB do browser. Navegações repetidas servem do cache
// local sem cobrar reads ao Firestore. Os listeners só disparam quando os dados
// mudaram no servidor. Reduz reads em 60-80% em sessões normais de uso.
window.firebaseDb.enablePersistence({ synchronizeTabs: true })
  .catch(function(err) {
    if (err.code === 'failed-precondition') {
      // Múltiplos tabs abertos em simultâneo — persistence ativa só num tab
      console.warn('[Firebase] Offline persistence indisponível: múltiplos tabs abertos.');
    } else if (err.code === 'unimplemented') {
      // Browser não suporta (ex: Safari antigo, modo privado)
      console.warn('[Firebase] Offline persistence não suportada neste browser.');
    }
  });

