import { NextRequest, NextResponse } from 'next/server';

// Clés d'API PayDunya (Doivent être dans les variables d'environnement!)
const PAYDUNYA_MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY;
const PAYDUNYA_PRIVATE_KEY = process.env.PAYDUNYA_PRIVATE_KEY;
const PAYDUNYA_TOKEN = process.env.PAYDUNYA_TOKEN;
const PAYDUNYA_BASE_URL = process.env.PAYDUNYA_API_BASE_URL;

// URL vers laquelle PayDunya enverra la confirmation de paiement (à créer plus tard)
const IPN_URL = 'https://votredomaine.vercel.app/api/paydunya-webhook'; 

export async function POST(req: NextRequest) {
    
    // Cette API serait appelée par l'application mobile de l'utilisateur (ou par le web si l'entreprise recharge son compte)
    try {
        const { amount, description, userEmail, userId } = await req.json();

        if (!amount || amount <= 0 || !userEmail || !userId) {
            return NextResponse.json({ error: 'Montant, email ou ID utilisateur manquant.' }, { status: 400 });
        }

        // 1. Préparation de la requête PayDunya
        const invoiceData = {
            // L'identifiant unique de votre transaction (important pour le Webhook)
            invoice: {
                // Montant en devise locale (XOF, USD, etc. - PayDunya gère la conversion)
                total_amount: amount, 
                description: description || `Recharge de points Kpaya pour l'utilisateur ${userId}`,
                // Les clés sont passées dans les headers par sécurité
                custom_data: { userId: userId } // Données que vous voulez récupérer au Webhook
            },
            store: {
                name: "Kpaya Recyclage Store",
            },
            actions: {
                // L'URL où l'utilisateur est redirigé après le paiement
                return_url: `https://votredomaine.vercel.app/success?user=${userId}`,
                // L'URL où PayDunya enverra la confirmation POST (IPN)
                cancel_url: `https://votredomaine.vercel.app/cancel?user=${userId}`,
                callback_url: IPN_URL,
            },
        };

        // 2. Appel à l'API PayDunya
        const response = await fetch(`${PAYDUNYA_BASE_URL}/checkout/invoices/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY || '',
                'PAYDUNYA-PRIVATE-KEY': PAYDUNYA_PRIVATE_KEY || '',
                'PAYDUNYA-TOKEN': PAYDUNYA_TOKEN || '',
            },
            body: JSON.stringify(invoiceData),
        });

        const paydunyaResponse = await response.json();

        if (paydunyaResponse.response_code !== '00') {
             console.error("Erreur PayDunya:", paydunyaResponse);
             throw new Error(paydunyaResponse.response_text || "Échec de la création de la facture PayDunya.");
        }

        // 3. Succès : Retourne l'URL de redirection à l'application cliente
        return NextResponse.json({ 
            success: true, 
            invoiceToken: paydunyaResponse.token,
            paymentUrl: paydunyaResponse.response_data.checkout_url 
        }, { status: 200 });

    } catch (error: any) {
        console.error("Erreur d'initialisation de paiement:", error.message);
        return NextResponse.json({ 
            error: error.message || "Impossible d'initialiser le paiement.",
        }, { status: 500 });
    }
}