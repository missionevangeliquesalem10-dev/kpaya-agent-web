import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// --- CONFIG FIREBASE ADMIN SUR VERCEL ---
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ Firebase Admin Webhook non initialisé : variables manquantes.");
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log("✅ Firebase Admin Webhook initialisé.");
    } catch (error) {
      console.error("❌ Erreur Firebase Admin Webhook :", error);
    }
  }
}

const db = admin.firestore();

// PAYDUNYA
const PAYDUNYA_MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY;
const PAYDUNYA_PRIVATE_KEY = process.env.PAYDUNYA_PRIVATE_KEY;
const PAYDUNYA_TOKEN = process.env.PAYDUNYA_TOKEN;
const PAYDUNYA_API_BASE_URL = process.env.PAYDUNYA_API_BASE_URL;

const APP_ID = process.env.NEXT_PUBLIC_APP_ID || "kpaya-recycling-app";

// --- ROUTE WEBHOOK ---
export async function POST(req: NextRequest) {
  if (!admin.apps.length) {
    console.error("❌ Webhook : Firebase Admin non initialisé.");
    return NextResponse.json(
      { success: true, message: "Firebase non initialisé, ignoré." },
      { status: 200 }
    );
  }

  try {
    const body = await req.json();
    const invoiceToken = body.invoice_token;

    if (!invoiceToken) {
      return NextResponse.json(
        { success: true, message: "Token manquant, ignoré." },
        { status: 200 }
      );
    }

    // Vérification PayDunya
    const verifyResponse = await fetch(`${PAYDUNYA_API_BASE_URL}/checkout/invoices/verify/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": PAYDUNYA_MASTER_KEY || "",
        "PAYDUNYA-PRIVATE-KEY": PAYDUNYA_PRIVATE_KEY || "",
        "PAYDUNYA-TOKEN": PAYDUNYA_TOKEN || "",
      },
      body: JSON.stringify({ token: invoiceToken }),
    });

    const verificationData = await verifyResponse.json();

    if (
      verificationData.response_code !== "00" ||
      verificationData.status !== "completed"
    ) {
      console.warn("⚠ Paiement non terminé :", verificationData.status);
      return NextResponse.json(
        { success: true, message: "Paiement non terminé." },
        { status: 200 }
      );
    }

    // Extraction des données
    const companyId = verificationData.custom_data.companyId;
    const amountPaid = verificationData.invoice.total_amount;

    const pointsToCredit = amountPaid; // 1 XOF = 1 point

    // Transaction Firestore
    const companyRef = db.collection("recycling_companies").doc(companyId);

    await db.runTransaction(async (tx) => {
      const companyDoc = await tx.get(companyRef);

      if (!companyDoc.exists) {
        throw new Error(`Entreprise ${companyId} introuvable.`);
      }

      tx.update(companyRef, {
        currentPoints: admin.firestore.FieldValue.increment(pointsToCredit),
      });

      // Ajout historique
      db.collection("transactions").doc().set({
        type: "RECHARGE",
        companyId,
        amountXOF: amountPaid,
        pointsCredited: pointsToCredit,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: "COMPLETED",
        source: "PayDunya",
      });
    });

    return NextResponse.json(
      { success: true, message: "Crédit effectué." },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("❌ Erreur Webhook :", error);
    return NextResponse.json(
      { success: true, message: "Erreur interne ignorée." },
      { status: 200 }
    );
  }
}
