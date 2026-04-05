// Configuração e inicialização partilhada do Firebase
// Inclui este ficheiro em todas as páginas depois dos SDKs Firebase.

// Evita inicializações duplicadas caso seja incluído em várias páginas
if (!firebase.apps.length) {
  const firebaseConfig = {
    apiKey: "AIzaSyC1ud2xlyldZ6qedVMuwe99QX4im6p_J20",
    authDomain: "hub-algartempo.firebaseapp.com",
    projectId: "hub-algartempo",
    storageBucket: "hub-algartempo.firebasestorage.app",
    messagingSenderId: "759072763920",
    appId: "1:759072763920:web:80c5e56196eb4b7cd3da95",
    measurementId: "G-M7SPWT4507"
  };

  firebase.initializeApp(firebaseConfig);
}

// Atalhos globais úteis (opcional usar)
window.firebaseAuth = firebase.auth();
window.firebaseDb   = firebase.firestore();

