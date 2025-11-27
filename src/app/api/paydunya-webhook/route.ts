import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// --- CONFIGURATION FIREBASE ADMIN ---
// Récupération de la clé du compte de service à partir de la variable d'environnement Vercel
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

// Initialisation de Firebase Admin
if (!admin.apps.length) {
  try {
    // ⚠️ On parse la chaîne JSON stockée dans la variable d'environnement
    const serviceAccount = JSON.parse(serviceAccountKey || '{}');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin Webhook Initialized successfully from ENV.");

  } catch (error) {
    console.warn("Firebase Admin Initialization Webhook Failed:", error);
  }
}

const db = admin.firestore();

// Clé à utiliser pour la vérification de l'intégrité de la requête PayDunya
const PAYDUNYA_MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY;
const __app_id = process.env.NEXT_PUBLIC_APP_ID || 'kpaya-recycling-app'; // ID d'application par défaut

// --- ROUTE DU WEBHOOK PAYDUNYA ---
export async function POST(req: NextRequest) {
    // Vérification de l'initialisation avant de procéder
    if (!admin.apps.length || !serviceAccountKey) {
        // Retourner un succès (200) même en cas d'erreur d'initialisation pour éviter
        // que PayDunya ne réessaie la requête en boucle, mais on log l'échec.
        console.error("WEBHOOK FAILED: Firebase Admin non initialisé.");
        return NextResponse.json({ success: true, message: 'Erreur d\'initialisation traitée.' }, { status: 200 });
    }

    try {
        // Le corps de la requête est le POST envoyé par PayDunya
        const body = await req.json();
        
        const invoiceToken = body.invoice_token;
        if (!invoiceToken) {
            return NextResponse.json({ success: false, message: 'Token de facture manquant.' }, { status: 400 });
        }

        // 1. Vérification de l'intégrité de la transaction via l'API PayDunya (Critique !)
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

        // Si la transaction n'est pas "completed" ou le code n'est pas '00', on ignore.
        if (verificationData.response_code !== '00' || verificationData.status !== 'completed') {
            console.warn("Paiement non complété ou échoué. Statut PayDunya:", verificationData.status);
            return NextResponse.json({ success: true, message: 'Paiement non complété ou échoué.' }, { status: 200 }); 
        }

        // Extraction des données
        const companyId = verificationData.custom_data.companyId; 
        const amountPaid = verificationData.invoice.total_amount;
        
        // --- LOGIQUE MÉTIER : CRÉDIT ---
        const pointsToCredit = amountPaid; // Simplification: 1 XOF = 1 Point.

        // 2. Exécution de la Transaction Atomique (Crédit)
        const companyRef = db.collection('recycling_companies').doc(companyId);

        await db.runTransaction(async (transaction) => {
            const companyDoc = await transaction.get(companyRef);

            if (!companyDoc.exists) {
                // Si l'entreprise n'existe pas, on log une erreur critique et on ne crédite pas
                throw new Error(`Entreprise ${companyId} introuvable. Échec du crédit.`);
            }

            // Crédit de l'entreprise (augmentation du solde de points)
            transaction.update(companyRef, {
                currentPoints: admin.firestore.FieldValue.increment(pointsToCredit),
            });

            // Ajout d'une transaction de type 'RECHARGE' dans l'historique
            // Nous utilisons une collection 'transactions' de base ici pour l'exemple.
            db.collection('transactions').doc().set({
                type: 'RECHARGE',
                companyId: companyId,
                amountXOF: amountPaid,
                pointsCredited: pointsToCredit,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                status: 'COMPLETED',
                source: 'PayDunya'
            });
        });

        // 3. Succès: Réponse 200 (CRITIQUE pour le Webhook)
        return NextResponse.json({ success: true, message: 'Solde de l\'entreprise crédité avec succès.' }, { status: 200 });

    } catch (error: any) {
        console.error("Erreur Webhook lors du traitement:", error.message);
        // Toujours retourner 200 pour éviter les tentatives de renvoi par PayDunya
        return NextResponse.json({ success: true, message: 'Erreur interne traitée.' }, { status: 200 }); 
    }
}