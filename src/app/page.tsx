'use client';

import { useAuth } from "@/context/auth-context";
import DepositValidationForm from "@/components/DepositValidationForm";
import CompanyBalance from "@/components/CompanyBalance"; 
import TransactionHistory from "@/components/TransactionHistory"; 
import { Loader2, LogOut, TrendingUp, Handshake } from 'lucide-react'; // Icônes pour le style

export default function Dashboard() {
    const { user, loading, logout, userData } = useAuth();
    
    // Affichage d'un loader stylisé pendant l'authentification
    if (loading || !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
                <Loader2 className="animate-spin h-10 w-10 text-green-500 mb-4" />
                <p className="text-xl">Chargement de l'espace Agent...</p>
            </div>
        );
    }

    const companyId = userData?.companyId as string | undefined;

    return (
        <div className="p-4 md:p-8 bg-gray-900 min-h-screen text-white">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-gray-700 pb-4">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-green-400 flex items-center">
                    <Handshake className="h-8 w-8 mr-3" />
                    Espace Agent & Validation
                </h1>
                <button
                    onClick={logout}
                    className="mt-4 sm:mt-0 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center shadow-lg"
                >
                    <LogOut className="h-5 w-5 mr-2" />
                    Déconnexion
                </button>
            </header>

            {/* Afficheur de Solde (Mis en évidence) */}
            {companyId ? (
                <div className="mb-10 p-6 bg-gray-800 rounded-xl shadow-2xl border-l-4 border-green-500">
                    <h2 className="text-xl font-semibold text-gray-400 flex items-center mb-4">
                        <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
                        Solde Actuel de l'Entreprise
                    </h2>
                    <CompanyBalance companyId={companyId} />
                </div>
            ) : (
                <div className="p-4 mb-8 bg-red-900/50 rounded-xl text-red-300 border border-red-700">
                    ⚠️ **Erreur de configuration :** Impossible de trouver l'ID de votre entreprise. Contactez l'administrateur.
                </div>
            )}
            
            {/* Grille des Actions Principales */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Colonne 1 : Formulaire de Dépôt */}
                <section>
                    <DepositValidationForm />
                </section>
                
                {/* Colonne 2 : Historique des Transactions */}
                <section>
                    <TransactionHistory /> 
                </section>
                
            </div>
            
            <footer className="mt-12 text-center text-sm text-gray-600 border-t border-gray-700 pt-4">
                <p>Application Agent Kpaya - Propulsé par Next.js & Firebase</p>
            </footer>
        </div>
    );
}