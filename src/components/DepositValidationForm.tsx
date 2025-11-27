'use client';

import React, { useState } from 'react';
// On garde db juste pour lire le solde (lecture seule), pas pour écrire
import { db } from '../../firebase'; 
import { doc, getDoc } from 'firebase/firestore'; 
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

export default function DepositValidationForm() {
    
    const { userData, user } = useAuth();
    const router = useRouter();

    const companyId = userData?.companyId as string | undefined; 
    const agentUid = user?.uid; 
    const PLASTIC_POINTS_RATE = 10; 

    const [userId, setUserId] = useState('');
    const [weightKg, setWeightKg] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    
    if (!companyId || !agentUid) {
        return (
             <div className="p-4 bg-red-100 dark:bg-red-900/50 rounded-lg text-red-800 dark:text-red-300">
                ⚠️ Configuration Agent incomplète.
            </div>
        );
    }

    const handleValidation = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setLoading(true);

        const weight = parseFloat(weightKg);
        if (!userId || isNaN(weight) || weight <= 0) {
            setMessage({ type: 'error', text: 'Veuillez saisir un ID et un poids valide.' });
            setLoading(false);
            return;
        }

        const pointsToTransfer = Math.floor(weight * PLASTIC_POINTS_RATE);

        try {
            // 1. Vérification Rapide du Solde (Lecture Client - UX uniquement)
            const companyRef = doc(db, 'recycling_companies', companyId);
            const companySnap = await getDoc(companyRef);
            const currentPoints = companySnap.exists() ? companySnap.data()?.currentPoints : 0;
            
            if (currentPoints < pointsToTransfer) {
                throw new Error("Solde insuffisant (vérification pré-envoi).");
            }

            // 2. APPEL API (Le vrai travail sécurisé)
            const response = await fetch('/api/validate-deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    agentUid,
                    companyId,
                    weightKg: weight,
                    points: pointsToTransfer
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la transaction.');
            }

            // 3. Succès
            setMessage({ 
                type: 'success', 
                text: `✅ Succès ! ${pointsToTransfer} points crédités.`
            });
            
            setUserId('');
            setWeightKg('');
            router.refresh(); 

        } catch (error: any) {
            console.error("Erreur:", error);
            setMessage({ 
                type: 'error', 
                text: `❌ Erreur: ${error.message}`
            });
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-xl mx-auto border-t-4 border-green-500">
             <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Nouvelle Validation de Dépôt</h3>
            
            {message && (
                <div className={`p-3 mb-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleValidation} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID Utilisateur (UID)</label>
                    <input
                        type="text"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value.trim())}
                        required
                        placeholder="UID de l'utilisateur"
                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Poids (Kg)</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        required
                        placeholder="Ex: 2.5"
                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                </div>

                <p className="text-xs text-gray-500">Total: {Math.floor((parseFloat(weightKg) || 0) * PLASTIC_POINTS_RATE)} points.</p>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-lg shadow-md text-lg font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 transition duration-150"
                >
                    {loading ? 'Traitement...' : 'Valider la Transaction'}
                </button>
            </form>
        </div>
    );
}