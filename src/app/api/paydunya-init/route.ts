import { NextRequest, NextResponse } from "next/server";

// Exécution côté Node.js pour fetch sécurisé et accès aux variables
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Variables d'environnement PayDunya
const {
  PAYDUNYA_MASTER_KEY,
  PAYDUNYA_PRIVATE_KEY,
  PAYDUNYA_PUBLIC_KEY,
  PAYDUNYA_TOKEN,
  PAYDUNYA_API_BASE_URL,
  APP_DOMAIN,
} = process.env;

// Domaine de ton application
const DOMAIN = APP_DOMAIN || "https://kpaya-agent-web.vercel.app";
const IPN_URL = `${DOMAIN}/api/paydunya-webhook`;

/* -------------------- UTILITAIRE DE VÉRIFICATION DES CLÉS -------------------- */
function checkEnvVars() {
  const missing = [];
  if (!PAYDUNYA_MASTER_KEY) missing.push("PAYDUNYA_MASTER_KEY");
  if (!PAYDUNYA_PRIVATE_KEY) missing.push("PAYDUNYA_PRIVATE_KEY");
  if (!PAYDUNYA_PUBLIC_KEY) missing.push("PAYDUNYA_PUBLIC_KEY");
  if (!PAYDUNYA_TOKEN) missing.push("PAYDUNYA_TOKEN");
  if (!PAYDUNYA_API_BASE_URL) missing.push("PAYDUNYA_API_BASE_URL");
  if (!DOMAIN) missing.push("APP_DOMAIN");
  return missing;
}

/* -------------------- ENDPOINT PAYDUNYA INIT -------------------- */
export async function POST(req: NextRequest) {
  try {
    // Vérifie les variables d'environnement
    const missingVars = checkEnvVars();
    if (missingVars.length > 0) {
      console.error("❌ Variables manquantes :", missingVars);
      return NextResponse.json(
        { success: false, error: `Variables d'environnement manquantes: ${missingVars.join(", ")}` },
        { status: 500 }
      );
    }

    // Récupère les données du client
    const { amount, description, userEmail, userId } = await req.json();

    // Validation simple
    if (!amount || amount <= 0)
      return NextResponse.json({ success: false, error: "Montant invalide." }, { status: 400 });
    if (!userEmail || !userId)
      return NextResponse.json({ success: false, error: "Email ou ID utilisateur manquant." }, { status: 400 });

    // Prépare les données pour PayDunya
    const invoiceData = {
      invoice: {
        total_amount: amount,
        description: description || `Recharge de points Kpaya pour l'utilisateur ${userId}`,
        custom_data: { userId, email: userEmail },
      },
      store: { name: "Kpaya Recyclage Store" },
      actions: {
        return_url: `${DOMAIN}/success?user=${userId}`,
        cancel_url: `${DOMAIN}/cancel?user=${userId}`,
        callback_url: IPN_URL,
      },
    };

    // Appel à PayDunya
    const response = await fetch(`${PAYDUNYA_API_BASE_URL}/checkout/invoices/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYDUNYA-MASTER-KEY": PAYDUNYA_MASTER_KEY,
        "PAYDUNYA-PRIVATE-KEY": PAYDUNYA_PRIVATE_KEY,
        "PAYDUNYA-TOKEN": PAYDUNYA_TOKEN,
      },
      body: JSON.stringify(invoiceData),
    });

    const data = await response.json();

    // Vérification du succès
    if (data.response_code !== "00") {
      console.error("🚨 Erreur PayDunya:", data);
      return NextResponse.json(
        { success: false, error: data.response_text || "Échec création facture PayDunya." },
        { status: 500 }
      );
    }

    // Succès
    return NextResponse.json(
      {
        success: true,
        invoiceToken: data.token,
        paymentUrl: data.response_data.checkout_url,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Erreur PayDunya init:", error.message || error);
    return NextResponse.json(
      { success: false, error: error.message || "Impossible d'initialiser le paiement." },
      { status: 500 }
    );
  }
}
