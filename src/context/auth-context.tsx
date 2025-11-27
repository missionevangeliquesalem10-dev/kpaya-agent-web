// src/context/auth-context.tsx

'use client'; // Indique que c'est un composant côté client

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../../firebase'; // Importe l'authentification Firebase
import { useRouter, usePathname } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';


// --- 1. Définition du Contexte ---
interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
    userData: any; // Pour stocker les données spécifiques à l'agent (ID de l'entreprise)
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- 2. Le Provider (Le Cœur du Système) ---
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const router = useRouter();
    const pathname = usePathname();

    const PUBLIC_PATHS = ['/login'];
    const isPublicPath = PUBLIC_PATHS.includes(pathname);

    useEffect(() => {
        // Écoute les changements d'état d'authentification
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // Récupérer les données de l'agent (ex: pour l'ID de l'entreprise)
                const agentRef = doc(db, 'agents', currentUser.uid);
                const docSnap = await getDoc(agentRef);
                if (docSnap.exists()) {
                    setUserData(docSnap.data());
                }

                // Rediriger si l'utilisateur est connecté et essaie d'accéder à /login
                if (pathname === '/login') {
                    router.replace('/');
                }
            } else {
                setUserData(null);
                // Si non connecté et pas sur une page publique, rediriger vers login
                if (!isPublicPath) {
                    router.replace('/login');
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [pathname, router, isPublicPath]);

    const logout = async () => {
        await signOut(auth);
    };

    if (loading) {
        // Écran de chargement initial simple
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Chargement de l'application...</p>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, loading, logout, userData }}>
            {children}
        </AuthContext.Provider>
    );
};

// --- 3. Le Hook pour l'Utilisation Facile ---
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};