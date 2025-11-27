import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// 1. Initialisation de Firebase Admin
// Cette vérification empêche de ré-initialiser l'app plusieurs fois (hot reload)
if (!admin.apps.length) {
  try {
    // On utilise require pour charger le JSON localement
    // Assurez-vous que le fichier est bien à la racine du projet
    const serviceAccount = require('../../../../service-account.json');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Erreur d'initialisation Firebase Admin:", error);
  }
}

const db = admin.firestore();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, agentUid, companyId, weightKg, points } = body;

    // 2. Validation des données reçues
    if (!userId || !agentUid || !companyId || !points || points <= 0) {
      return NextResponse.json(
        { error: 'Données invalides ou manquantes.' },
        { status: 400 }
      );
    }

    // 3. Exécution de la Transaction Atomique
    const result = await db.runTransaction(async (transaction) => {
      // Références
      const companyRef = db.collection('recycling_companies').doc(companyId);
      const userRef = db.collection('users').doc(userId);
      const transactionRef = db.collection('transactions').doc(); // Nouvel ID auto

      // A. Lecture (Doit se faire avant toute écriture)
      const companyDoc = await transaction.get(companyRef);
      const userDoc = await transaction.get(userRef);

      if (!companyDoc.exists) {
        throw new Error("L'entreprise de recyclage est introuvable.");
      }
      
      const currentCompanyPoints = companyDoc.data()?.currentPoints || 0;

      // B. Vérification du Solde
      if (currentCompanyPoints < points) {
        throw new Error(`Solde insuffisant. L'entreprise a ${currentCompanyPoints} points, mais ${points} sont requis.`);
      }

      // C. Débit Entreprise
      transaction.update(companyRef, {
        currentPoints: admin.firestore.FieldValue.increment(-points),
      });

      // D. Crédit Utilisateur (Création si inexistant)
      if (userDoc.exists) {
        transaction.update(userRef, {
          points: admin.firestore.FieldValue.increment(points),
        });
      } else {
        // Si c'est le premier dépôt de l'utilisateur, on crée son document
        transaction.set(userRef, {
          points: points,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          // Ajoutez d'autres champs par défaut si nécessaire (email, etc.)
        });
      }

      // E. Enregistrement de l'Historique
      transaction.set(transactionRef, {
        userId,
        agentUid,
        companyId,
        points,
        weightKg,
        type: 'CREDIT',
        status: 'COMPLETED', // Transaction validée directement
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { transactionId: transactionRef.id, points };
    });

    // 4. Réponse Succès
    return NextResponse.json(
      { success: true, data: result },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("Erreur API Transaction:", error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur interne.' },
      { status: 500 }
    );
  }
}