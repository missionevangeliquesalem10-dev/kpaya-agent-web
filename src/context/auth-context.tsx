"use client"; // <-- Ajouter cette ligne en tout premier

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase"; // Assure-toi que db exporte Firestore

import type { DocumentData } from "firebase/firestore";

interface AuthContextType {
  userData: DocumentData | null;
  setUserData: React.Dispatch<React.SetStateAction<DocumentData | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userData, setUserData] = useState<DocumentData | null>(null);

  useEffect(() => {
    const fetchUser = async (uid: string) => {
      const agentRef = doc(db, "agents", uid);
      const docSnap = await getDoc(agentRef);
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      }
    };

    // Exemple : fetchUser("user-id"); // remplace par logique réelle
  }, []);

  return (
    <AuthContext.Provider value={{ userData, setUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
