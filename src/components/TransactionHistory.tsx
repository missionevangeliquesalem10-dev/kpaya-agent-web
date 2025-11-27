'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase'; 
import { collection, query, orderBy, limit, onSnapshot, DocumentData } from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { Clock, DollarSign, Users, CheckSquare } from 'lucide-react'; // Nouvelles Icônes

// Définition de l'interface pour une transaction
interface Transaction {
    id: string;
    userId: string;
    agentUid: string;
    companyId: string;
    type: 'CREDIT' | 'DEBIT'; 
    points: number;
    weightKg: number;
    timestamp: {
        seconds: number; 
        toDate: () => Date; // Assurez-vous d'avoir toDate si le Timestamp n'est pas converti
    };
    status: 'COMPLETED' | 'FAILED'; // Nous utilisons COMPLETED maintenant
}

const TransactionHistory: React.FC = () => {
    
    const { user, userData, loading: authLoading } = useAuth();
    
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const isAgent = !!userData?.companyId; 

    useEffect(() => {
        if (authLoading || !isAgent) {
            setLoading(false);
            return;
        }

        const transactionsRef = collection(db, 'transactions');
        
        // Requête : 100 dernières transactions, triées par date
        const q = query(
            transactionsRef, 
            orderBy('timestamp', 'desc'), 
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const history: Transaction[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as DocumentData; 
                
                // Conversion sécurisée du Timestamp
                const ts = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate() : new Date();

                history.push({
                    id: doc.id,
                    ...data,
                    timestamp: { seconds: ts.getTime() / 1000, toDate: () => ts } 
                } as Transaction);
            });
            setTransactions(history);
            setLoading(false);
        }, (error) => {
            console.error("Erreur de lecture des transactions:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [authLoading, isAgent]);

    if (!isAgent) {
        return <div className="p-4 bg-red-900/50 rounded-xl text-red-300 border border-red-700">Accès non autorisé.</div>;
    }

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700">
            <h3 className="text-2xl font-bold mb-6 text-white flex items-center">
                <Clock className="h-6 w-6 mr-3 text-blue-400" />
                Historique des 100 Derniers Dépôts
            </h3>
            
            {loading && <div className="text-center p-4 text-gray-500">Chargement de l'historique...</div>}
            
            {!loading && transactions.length === 0 && (
                <div className="text-center p-4 text-gray-500 border border-dashed border-gray-700 rounded-lg">
                    Aucune transaction enregistrée pour l'instant.
                </div>
            )}

            <ul className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {transactions.map((tx) => (
                    <li key={tx.id} className="p-4 rounded-lg bg-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center transition duration-150 hover:bg-gray-600 border-l-4 border-blue-500">
                        
                        {/* Détails de la transaction */}
                        <div className="flex-1">
                            <p className="font-semibold text-sm text-gray-200 flex items-center">
                                <Clock className="h-4 w-4 mr-2 text-blue-400" />
                                {new Date(tx.timestamp.seconds * 1000).toLocaleString('fr-FR')}
                            </p>
                            <p className="text-xs text-gray-400 mt-1 flex items-center">
                                <Users className="h-4 w-4 mr-2" />
                                Utilisateur: {tx.userId.substring(0, 10)}...
                            </p>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-900 text-green-300 mt-1 inline-flex items-center">
                                <CheckSquare className="h-3 w-3 mr-1" /> VALIDÉ
                            </span>
                        </div>
                        
                        {/* Points et Poids */}
                        <div className="mt-2 sm:mt-0 sm:text-right">
                            <p className="font-bold text-xl text-green-400 flex items-center justify-end">
                                {/* CORRECTION: Utilisation de l'opérateur de chaînage optionnel pour éviter le TypeError */}
                                +{tx.points?.toLocaleString() || 0} <DollarSign className="h-5 w-5 ml-1" />
                            </p>
                            <p className="text-sm text-gray-400">
                                {/* CORRECTION: Utilisation de l'opérateur de chaînage optionnel et fallback à 0.00 */}
                                ({tx.weightKg?.toFixed(2) || '0.00'} Kg)
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default TransactionHistory;