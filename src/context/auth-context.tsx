"use client"; // Nécessaire pour les hooks React

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { doc, getDoc, DocumentData } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth } from "../../firebase"; // Assurez-vous que db et auth sont exportés

// Typage du contexte
interface AuthContextType {
  user: User | null;
  userData: DocumentData | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Écoute les changements d'authentification
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setUser(firebaseUser);

      if (firebaseUser) {
        // Récupère les données de l'agent dans Firestore
        const agentRef = doc(db, "agents", firebaseUser.uid);
        const docSnap = await getDoc(agentRef);
        setUserData(docSnap.exists() ? docSnap.data() : null);
      } else {
        setUserData(null);
      }

      setLoading(false);
    });

    return () => unsubscribe(); // Nettoyage à la destruction du composant
  }, []);

  const logout = async () => {
    await auth.signOut();
    setUser(null);
    setUserData(null);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personnalisé pour utiliser le contexte
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
