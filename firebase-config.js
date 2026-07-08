import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAUi6E2uw-0rOOAaw6J3HSxXcxUof3Egh4",
  authDomain: "my-dip-f50a2.firebaseapp.com",
  projectId: "my-dip-f50a2",
  storageBucket: "my-dip-f50a2.firebasestorage.app",
  messagingSenderId: "1084602185804",
  appId: "1:1084602185804:web:e53b695d39c0abd7c81ce9"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
