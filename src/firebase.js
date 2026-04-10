import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBrw5PB8aQCWwQ6k023X71cp3AKLH5jUVM",
  authDomain: "medilens-ai-c5afc.firebaseapp.com",
  projectId: "medilens-ai-c5afc",
  storageBucket: "medilens-ai-c5afc.firebasestorage.app",
  messagingSenderId: "681571207260",
  appId: "1:681571207260:web:0416f047cb3c368543fe99"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);