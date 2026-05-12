// Configuração do Firebase (mantenha seus dados)
const firebaseConfig = {
    apiKey: "AIzaSyAE6OgotOg-Y36IGAqUScMvo_LymmTNdK4",
    authDomain: "food-delivery-fb89e.firebaseapp.com",
    databaseURL: "https://food-delivery-fb89e.firebaseio.com",
    projectId: "food-delivery-fb89e",
    storageBucket: "food-delivery-fb89e.firebasestorage.app",
    messagingSenderId: "1050430398596",
    appId: "1:1050430398596:web:1701ff1d161183105e22d1"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
