import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Initialisation de Firebase Admin (réutilisé depuis validate-deposit)
if (!admin.apps.length) {
  try {
    const serviceAccount = require('../../../../service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.warn("Firebase Admin déjà initialisé ou erreur d'initialisation du Webhook.");
  }
}

const db = admin.firestore();

// Clé à utiliser pour la vérification de l'intégrité de la requête PayDunya
const PAYDUNYA_MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY;

export async function POST(req: NextRequest) {
    try {
        // Le corps de la requête est le POST envoyé par PayDunya
        const body = await req.json();
        
        const invoiceToken = body.invoice_token;
        if (!invoiceToken) {
            return NextResponse.json({ success: false, message: 'Token de facture manquant.' }, { status: 400 });
        }

        // 1. Vérification de l'intégrité de la transaction via l'API PayDunya (Critique !)
        // C'est pour s'assurer que la requête vient bien de PayDunya et que le paiement est OK.
        const verifyResponse = await fetch(`${process.env.PAYDUNYA_API_BASE_URL}/checkout/invoices/verify/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY || '',
                'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY || '',
                'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN || '',
            },
            body: JSON.stringify({ token: invoiceToken }),
        });

        const verificationData = await verifyResponse.json();

        if (verificationData.response_code !== '00' || verificationData.status !== 'completed') {
            console.error("Vérification PayDunya échouée:", verificationData);
            // Retourne 200 pour éviter que PayDunya ne renvoie la notification en boucle
            return NextResponse.json({ success: true, message: 'Paiement non complété ou échoué.' }, { status: 200 }); 
        }

        // Extraction des données
        const companyId = verificationData.custom_data.companyId; 
        const amountPaid = verificationData.invoice.total_amount;
        
        // --- LOGIQUE MÉTIER ---
        // 2. Conversion Monnaie -> Points (Ex: 1000 XOF = 1000 points)
        const pointsToCredit = amountPaid; // Simplification: 1 XOF = 1 Point. À ajuster !

        // 3. Exécution de la Transaction Atomique (Crédit)
        const companyRef = db.collection('recycling_companies').doc(companyId);

        await db.runTransaction(async (transaction) => {
            const companyDoc = await transaction.get(companyRef);

            if (!companyDoc.exists) {
                throw new Error(`Entreprise ${companyId} introuvable.`);
            }

            // Crédit de l'entreprise (augmentation du solde de points)
            transaction.update(companyRef, {
                currentPoints: admin.firestore.FieldValue.increment(pointsToCredit),
            });

            // Ajout d'une transaction de type 'RECHARGE' dans l'historique
            transaction.collection('transactions').doc().set({
                type: 'RECHARGE',
                companyId: companyId,
                amountXOF: amountPaid,
                pointsCredited: pointsToCredit,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                status: 'COMPLETED',
                source: 'PayDunya'
            });
        });

        // 4. Succès
        return NextResponse.json({ success: true, message: 'Solde de l\'entreprise crédité avec succès.' }, { status: 200 });

    } catch (error: any) {
        console.error("Erreur Webhook:", error.message);
        // Retourne 200 pour éviter que PayDunya ne renvoie la notification en boucle en cas d'erreur interne.
        return NextResponse.json({ success: true, message: 'Erreur interne traitée.' }, { status: 200 });
    }
}