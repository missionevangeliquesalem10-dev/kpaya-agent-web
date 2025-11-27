import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Structure des données que l'application Agent envoie à la Cloud Function
interface DepositData {
    userId: string;
    weightKg: number;
}

// Initialisation de l'application Admin
admin.initializeApp();
const db = admin.firestore();

// Taux de conversion
const PLASTIC_POINTS_RATE = 10;

/**
 * Valide un dépôt de plastique via une transaction sécurisée avec permissions Admin.
 * Débite l'entreprise et crédite l'utilisateur.
 */
export const validateDeposit = functions.https.onCall(async (data: DepositData, context) => {
    
    // 1. Vérification de l'Authentification (Gère l'erreur de permission)
    // Nous vérifions que context n'est pas null et qu'il contient l'auth
    if (!context || !context.auth) { 
        throw new functions.https.HttpsError(
            'unauthenticated', 
            'Seuls les agents connectés peuvent valider un dépôt.'
        );
    }
    
    // Récupération des données d'entrée (Typées par DepositData)
    const { userId, weightKg } = data; 
    
    // Récupération de l'UID de l'agent qui fait l'appel
    // Utilisation de l'assertion de non-nullité pour rassurer TypeScript
    const agentUid = context.auth.uid; 

    const weight = typeof weightKg === 'number' ? weightKg : parseFloat(weightKg as any); 
    
    if (!userId || isNaN(weight) || weight <= 0) {
        throw new functions.https.HttpsError(
            'invalid-argument', 
            'Les données de validation (ID utilisateur et poids) sont invalides.'
        );
    }

    const pointsToTransfer = Math.floor(weight * PLASTIC_POINTS_RATE);

    try {
        // --- 3. Récupération du companyId de l'Agent ---
        const agentSnap = await db.collection('agents').doc(agentUid).get();
        
        // 🚨 Correction: .exists est une propriété (Boolean) dans le SDK Admin, pas une méthode.
        if (!agentSnap.exists || !agentSnap.data()?.companyId) { 
            throw new functions.https.HttpsError(
                'failed-precondition', 
                "L'agent n'est pas associé à une entreprise (companyId manquant)."
            );
        }
        const companyId = agentSnap.data()!.companyId as string;

        // --- 4. Exécution de la Transaction Atomique ---
        const userRef = db.collection('users').doc(userId);
        const companyBalanceRef = db.collection('recycling_companies').doc(companyId);

        await db.runTransaction(async (transaction) => {
            
            // a. Lecture des documents
            const companySnap = await transaction.get(companyBalanceRef);
            const userSnap = await transaction.get(userRef);

            // b. Vérification d'existence et du type 
            // 🚨 Correction: .exists est une propriété.
            if (!companySnap.exists || typeof companySnap.data()?.currentPoints !== 'number') { 
                throw new Error("L'entreprise n'existe pas ou solde mal configuré.");
            }
            // 🚨 Correction: .exists est une propriété.
            if (!userSnap.exists || typeof userSnap.data()?.points !== 'number') { 
                throw new Error("Utilisateur non trouvé ou solde mal configuré.");
            }

            const currentCompanyPoints = companySnap.data()!.currentPoints || 0;
            const currentUserPoints = userSnap.data()!.points || 0;

            // c. Vérification du Solde (Règle métier)
            if (currentCompanyPoints < pointsToTransfer) {
                throw new functions.https.HttpsError(
                    'resource-exhausted', 
                    `Solde de l'entreprise insuffisant. Il manque ${pointsToTransfer - currentCompanyPoints} points.`
                );
            }
            
            // d. Mise à Jour (Débit et Crédit)
            const newCompanyPoints = currentCompanyPoints - pointsToTransfer;
            const newUserPoints = currentUserPoints + pointsToTransfer;
            
            transaction.update(companyBalanceRef, { currentPoints: newCompanyPoints });
            transaction.update(userRef, { points: newUserPoints });
        });

        // 5. Succès
        return { 
            status: 'success', 
            pointsCredited: pointsToTransfer,
            message: `Validation réussie. ${pointsToTransfer} points crédités.`
        };

    } catch (error: any) {
        // Gérer les erreurs de sécurité ou d'arguments
        if (error.code) {
             throw error; 
        }
        // Renvoyer une erreur générique de transaction
        throw new functions.https.HttpsError(
            'internal', 
            `Échec de la transaction. Détail: ${error.message}`
        );
    }
});