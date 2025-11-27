'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, onSnapshot, DocumentData } from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { RefreshCw, DollarSign, Wallet, Loader2 } from 'lucide-react';

interface CompanyBalanceProps {
    companyId: string;
}

const CompanyBalance: React.FC<CompanyBalanceProps> = ({ companyId }) => {
    const { user } = useAuth();
    const [currentPoints, setCurrentPoints] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [rechargeAmount, setRechargeAmount] = useState(10000); // Montant de recharge par défaut
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // 1. Abonnement au solde en temps réel
    useEffect(() => {
        if (!companyId) return;

        const companyRef = doc(db, 'recycling_companies', companyId);

        const unsubscribe = onSnapshot(companyRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as DocumentData;
                setCurrentPoints(data.currentPoints ?? 0);
            } else {
                setCurrentPoints(null); // Entreprise introuvable
            }
            setLoading(false);
        }, (error) => {
            console.error("Erreur de lecture du solde de l'entreprise:", error);
            setCurrentPoints(null);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [companyId]);
    
    // 2. Fonction pour appeler l'API de paiement
    const handleRecharge = async () => {
        if (rechargeAmount <= 0) return;

        setIsProcessing(true);
        setMessage(null);

        try {
            // Appel à l'API pour créer la facture PayDunya
            const response = await fetch('/api/paydunya-init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: rechargeAmount, // Montant en XOF (ou devise)
                    description: `Recharge de ${rechargeAmount} points pour l'entreprise ${companyId}`,
                    userEmail: user?.email || 'no-email@kpaya.com', // Email de l'agent pour le suivi
                    userId: companyId, // L'ID que nous allons créditer au Webhook
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Échec de l\'initialisation du paiement.');
            }

            // Redirection vers l'URL de paiement PayDunya
            window.location.href = data.paymentUrl; 
            
            // NOTE: L'Agent devra revenir manuellement à l'application après le paiement.
            // Le crédit réel se fait dans le Webhook (étape 1).

        } catch (error: any) {
            console.error("Erreur de recharge:", error);
            setMessage({ type: 'error', text: `Échec: ${error.message}. Vérifiez les clés API.` });
        } finally {
            setIsProcessing(false);
        }
    };


    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            
            {/* Affichage du Solde */}
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <Wallet className="h-10 w-10 text-green-500" />
                <div className="min-w-[150px]">
                    <p className="text-gray-400 font-medium">Points Disponibles</p>
                    {loading ? (
                        <Loader2 className="animate-spin h-6 w-6 text-green-500" />
                    ) : currentPoints !== null ? (
                        <p className="text-5xl font-extrabold text-white">
                            {currentPoints.toLocaleString('fr-FR')}
                        </p>
                    ) : (
                        <p className="text-red-500 text-2xl">-- ERREUR --</p>
                    )}
                </div>
            </div>
            
            {/* Formulaire de Recharge PayDunya */}
            <div className="bg-gray-700 p-4 rounded-lg shadow-inner w-full md:w-auto">
                <h4 className="text-lg font-semibold text-white mb-2 flex items-center">
                    <DollarSign className="h-5 w-5 mr-2 text-yellow-400" />
                    Recharger le Solde (XOF / Points)
                </h4>
                
                {message && (
                    <div className={`p-2 mb-2 text-xs rounded ${message.type === 'error' ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                        {message.text}
                    </div>
                )}

                <div className="flex space-x-2">
                    <input
                        type="number"
                        min="100"
                        step="100"
                        value={rechargeAmount}
                        onChange={(e) => setRechargeAmount(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:ring-yellow-500 focus:border-yellow-500"
                        disabled={isProcessing}
                    />
                    <button
                        onClick={handleRecharge}
                        disabled={isProcessing || rechargeAmount <= 0 || loading}
                        className="flex items-center py-2 px-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <Loader2 className="animate-spin h-5 w-5 mr-2" />
                        ) : (
                            <RefreshCw className="h-5 w-5 mr-2" />
                        )}
                        Payer
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    Montant en XOF. Assurez-vous que le montant corresponde au paiement mobile.
                </p>
            </div>
        </div>
    );
};

export default CompanyBalance;