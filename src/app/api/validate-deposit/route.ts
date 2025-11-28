import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";

// Empêche l'exécution en Edge Runtime (Firebase ne fonctionne pas en Edge)
export const runtime = "nodejs";
// Empêche Next.js de générer la route statiquement
export const dynamic = "force-dynamic";

/* ------------------------------ CONFIG FIREBASE ADMIN ------------------------------ */
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Initialisation sécurisée Firebase Admin
if (!admin.apps.length) {
  if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ Firebase Admin non initialisé (variables manquantes).");
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log("✅ Firebase Admin initialisé.");
    } catch (error) {
      console.error("❌ Erreur d'initialisation Firebase Admin :", error);
    }
  }
}

const db = admin.firestore();

/* -------------------------------------- ROUTE -------------------------------------- */
export async function POST(req: NextRequest) {
  if (!admin.apps.length) {
    return NextResponse.json(
      {
        success: false,
        error: "Firebase Admin n'est pas initialisé. Vérifiez vos variables d'environnement Vercel.",
      },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { userId, agentUid, companyId, weightKg, points } = body;

    /* ------------------------------ VALIDATION ------------------------------ */
    if (!userId || !agentUid || !companyId || !points || points <= 0) {
      return NextResponse.json(
        { success: false, error: "Données invalides ou incomplètes." },
        { status: 400 }
      );
    }

    /* ------------------------------ TRANSACTION FIRESTORE ------------------------------ */
    const result = await db.runTransaction(async (transaction) => {
      const companyRef = db.collection("recycling_companies").doc(companyId);
      const userRef = db.collection("users").doc(userId);
      const transactionRef = db.collection("transactions").doc();

      const companyDoc = await transaction.get(companyRef);
      const userDoc = await transaction.get(userRef);

      if (!companyDoc.exists) {
        throw new Error("Entreprise introuvable.");
      }

      const currentCompanyPoints = companyDoc.data()?.currentPoints || 0;

      if (currentCompanyPoints < points) {
        throw new Error(
          `Solde insuffisant. L'entreprise possède ${currentCompanyPoints} points, mais ${points} sont requis.`
        );
      }

      /* -------- Débit entreprise -------- */
      transaction.update(companyRef, {
        currentPoints: admin.firestore.FieldValue.increment(-points),
      });

      /* -------- Crédit utilisateur -------- */
      if (userDoc.exists) {
        transaction.update(userRef, {
          points: admin.firestore.FieldValue.increment(points),
        });
      } else {
        transaction.set(userRef, {
          points,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      /* -------- Historique -------- */
      transaction.set(transactionRef, {
        userId,
        agentUid,
        companyId,
        weightKg,
        points,
        type: "CREDIT",
        status: "COMPLETED",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        transactionId: transactionRef.id,
        points,
      };
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    console.error("❌ Erreur API Transaction :", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erreur serveur interne." },
      { status: 500 }
    );
  }
}
