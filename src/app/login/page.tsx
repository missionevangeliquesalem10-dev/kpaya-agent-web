// src/app/login/page.tsx

'use client';

import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../../firebase';
import { useAuth } from '@/context/auth-context';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const { user, loading } = useAuth();

    // Redirection automatique gérée par useAuth si l'utilisateur est déjà connecté.
    if (user && !loading) {
        return null; 
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // La redirection vers la page d'accueil est gérée par AuthProvider
        } catch (err: any) {
            console.error("Erreur de connexion:", err);
            // Gérer les erreurs de connexion spécifiques
            if (err.code === 'auth/invalid-email' || err.code === 'auth/wrong-password') {
                setError("Email ou mot de passe incorrect.");
            } else if (err.code === 'auth/user-not-found') {
                setError("Aucun agent trouvé avec cet email.");
            } else {
                setError("Échec de la connexion. Veuillez vérifier vos identifiants.");
            }
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl">
                <h1 className="text-3xl font-bold text-center text-green-700 dark:text-green-500 mb-6">
                    Kpaya Agent Connect
                </h1>
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Mot de passe
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                    
                    {error && (
                        <div className="text-red-600 text-sm p-3 bg-red-100 dark:bg-red-900/50 rounded-lg">
                            {error}
                        </div>
                    )}
                    
                    <button
                        type="submit"
                        className="w-full py-2 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150"
                    >
                        Se connecter
                    </button>
                </form>
            </div>
        </div>
    );
}