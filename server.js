const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fs = require("fs");
const admin = require("firebase-admin");

const app = express();


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());

// Paystack webhook needs the RAW request body
// for signature verification.
app.use(
  "/api/payments/paystack/webhook",
  express.raw({
    type: "application/json"
  })
);

app.use(express.json());


// ======================================================
// FIREBASE ADMIN
// ======================================================

const serviceAccountPath =
  "/etc/secrets/firebase-service-account.json";

if (!fs.existsSync(serviceAccountPath)) {
  console.error(
    "Firebase service account file not found"
  );

  process.exit(1);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(
    serviceAccountPath,
    "utf8"
  )
);

admin.initializeApp({
  credential:
    admin.credential.cert(serviceAccount)
});

const db =
  admin.firestore();

const auth =
  admin.auth();


// ======================================================
// CONFIGURATION
// ======================================================

const SECRET =
  process.env.JWT_SECRET ||
  "development_secret";

const PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY;

const PREMIUM_PRICE_NAIRA =
  2000;

const PREMIUM_AMOUNT_KOBO =
  PREMIUM_PRICE_NAIRA * 100;

const MARKETER_COMMISSION_PERCENT =
  20;

const MARKETER_COMMISSION_NAIRA =
  Math.floor(
    PREMIUM_PRICE_NAIRA *
    MARKETER_COMMISSION_PERCENT /
    100
  );

const FRONTEND_URL =
  "https://funds7.github.io/FundsIQ/";

const PAYSTACK_CALLBACK_URL =
  "https://fundsiq-api.onrender.com/api/payments/paystack/callback";

const PAYSTACK_WEBHOOK_URL =
  "https://fundsiq-api.onrender.com/api/payments/paystack/webhook";


// ======================================================
// TEMPORARY CBT DATA
// ======================================================

let users = [];

let questions = [
  {
    question: "What is 2 + 2?",
    options: [
      "1",
      "2",
      "3",
      "4"
    ],
    answer: 3
  },
  {
    question: "Capital of Nigeria?",
    options: [
      "Lagos",
      "Abuja",
      "Kano",
      "Ibadan"
    ],
    answer: 1
  }
];

let results = [];


// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  "/",
  (req, res) => {

    res.json({

      status:
        "online",

      service:
        "FundsIQ API",

      message:
        "FundsIQ backend is running",

      paystackConfigured:
        Boolean(
          PAYSTACK_SECRET_KEY
        ),

      webhook:
        PAYSTACK_WEBHOOK_URL,

      premiumPrice:
        PREMIUM_PRICE_NAIRA,

      marketerCommission:
        MARKETER_COMMISSION_NAIRA,

      commissionPercent:
        MARKETER_COMMISSION_PERCENT

    });

  }
);


// ======================================================
// FIREBASE AUTH MIDDLEWARE
// ======================================================

async function verifyFirebaseToken(
  req,
  res,
  next
) {

  try {

    const authHeader =
      req.headers.authorization || "";

    if (
      !authHeader.startsWith(
        "Bearer "
      )
    ) {

      return res.status(401).json({
        msg:
          "Authorization token required"
      });

    }

    const idToken =
      authHeader.substring(7);

    const decodedToken =
      await auth.verifyIdToken(
        idToken
      );

    req.firebaseUser =
      decodedToken;

    next();

  } catch (error) {

    console.error(
      "Firebase authentication error:",
      error
    );

    return res.status(401).json({
      msg:
        "Invalid or expired authentication token"
    });

  }

}


// ======================================================
// REGISTER
// ======================================================

app.post(
  "/api/auth/register",
  async (req, res) => {

    try {

      const {
        name,
        email,
        password
      } = req.body;

      if (
        !name ||
        !email ||
        !password
      ) {

        return res.status(400).json({
          msg:
            "Name, email and password are required"
        });

      }

      const existing =
        users.find(
          user =>
            user.email.toLowerCase() ===
            email.toLowerCase()
        );

      if (existing) {

        return res.status(400).json({
          msg:
            "User already exists"
        });

      }

      const hashed =
        await bcrypt.hash(
          password,
          10
        );

      const user = {

        id:
          Date.now().toString(),

        name,

        email:
          email.toLowerCase(),

        password:
          hashed

      };

      users.push(user);

      res.json({
        msg:
          "User registered successfully"
      });

    } catch (error) {

      console.error(
        "Registration error:",
        error
      );

      res.status(500).json({
        msg:
          "Registration failed"
      });

    }

  }
);


// ======================================================
// LOGIN
// ======================================================

app.post(
  "/api/auth/login",
  async (req, res) => {

    try {

      const {
        email,
        password
      } = req.body;

      if (
        !email ||
        !password
      ) {

        return res.status(400).json({
          msg:
            "Email and password are required"
        });

      }

      const user =
        users.find(
          user =>
            user.email.toLowerCase() ===
            email.toLowerCase()
        );

      if (!user) {

        return res.status(400).json({
          msg:
            "User not found"
        });

      }

      const match =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!match) {

        return res.status(400).json({
          msg:
            "Wrong password"
        });

      }

      const token =
        jwt.sign(
          {
            id:
              user.id
          },
          SECRET,
          {
            expiresIn:
              "2h"
          }
        );

      res.json({

        token,

        user: {

          id:
            user.id,

          name:
            user.name,

          email:
            user.email

        }

      });

    } catch (error) {

      console.error(
        "Login error:",
        error
      );

      res.status(500).json({
        msg:
          "Login failed"
      });

    }

  }
);


// ======================================================
// PREMIUM STATUS
// ======================================================

app.get(
  "/api/premium/status",
  verifyFirebaseToken,
  async (req, res) => {

    try {

      const uid =
        req.firebaseUser.uid;

      const userRef =
        db
          .collection("users")
          .doc(uid);

      const userSnap =
        await userRef.get();

      if (!userSnap.exists) {

        return res.status(404).json({
          msg:
            "User account not found"
        });

      }

      const userData =
        userSnap.data();

      res.json({

        premium:
          userData.premium === true

      });

    } catch (error) {

      console.error(
        "Premium status error:",
        error
      );

      res.status(500).json({
        msg:
          "Unable to check Premium status"
      });

    }

  }
);


// ======================================================
// INITIALIZE PREMIUM PAYMENT
// ======================================================

app.post(
  "/api/payments/premium/initialize",
  verifyFirebaseToken,
  async (req, res) => {

    try {

      if (!PAYSTACK_SECRET_KEY) {

        console.error(
          "PAYSTACK_SECRET_KEY is missing"
        );

        return res.status(500).json({
          msg:
            "Paystack is not configured"
        });

      }

      const uid =
        req.firebaseUser.uid;

      const email =
        req.firebaseUser.email;

      if (!email) {

        return res.status(400).json({
          msg:
            "Firebase account email is required"
        });

      }

      const userRef =
        db
          .collection("users")
          .doc(uid);

      const userSnap =
        await userRef.get();

      if (!userSnap.exists) {

        return res.status(404).json({
          msg:
            "User account not found"
        });

      }

      const userData =
        userSnap.data();

      if (
        userData.premium === true
      ) {

        return res.status(400).json({
          msg:
            "User is already Premium"
        });

      }

      const reference =
        `FUNDSIQ-PREMIUM-${uid}-${Date.now()}`;

      console.log(
        "Initializing Paystack payment:",
        {
          uid,
          email,
          reference,
          amount:
            PREMIUM_AMOUNT_KOBO
        }
      );

      const response =
        await fetch(
          "https://api.paystack.co/transaction/initialize",
          {

            method:
              "POST",

            headers: {

              Authorization:
                `Bearer ${PAYSTACK_SECRET_KEY}`,

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify({

                email,

                amount:
                  PREMIUM_AMOUNT_KOBO,

                currency:
                  "NGN",

                reference,

                callback_url:
                  PAYSTACK_CALLBACK_URL,

                metadata: {

                  product:
                    "FundsIQ Premium",

                  uid,

                  premiumPrice:
                    PREMIUM_PRICE_NAIRA

                }

              })

          }
        );

      const data =
        await response.json();

      console.log(
        "Paystack initialization response:",
        {
          ok:
            response.ok,

          status:
            data.status,

          message:
            data.message
        }
      );

      if (
        !response.ok ||
        !data.status ||
        !data.data
      ) {

        console.error(
          "Paystack initialization failed:",
          data
        );

        return res.status(500).json({
          msg:
            data.message ||
            "Unable to initialize Paystack payment"
        });

      }

      res.json({

        status:
          true,

        authorization_url:
          data.data.authorization_url,

        access_code:
          data.data.access_code,

        reference:
          data.data.reference

      });

    } catch (error) {

      console.error(
        "Premium payment initialization error:",
        error
      );

      res.status(500).json({
        msg:
          "Payment initialization failed"
      });

    }

  }
);


// ======================================================
// VERIFY PAYSTACK PAYMENT
// ======================================================

async function verifyPremiumPayment(
  reference
) {

  if (!PAYSTACK_SECRET_KEY) {

    throw new Error(
      "Paystack secret key is not configured"
    );

  }

  if (!reference) {

    throw new Error(
      "Transaction reference is missing"
    );

  }

  const response =
    await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {

        method:
          "GET",

        headers: {

          Authorization:
            `Bearer ${PAYSTACK_SECRET_KEY}`

        }

      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.status ||
    !data.data
  ) {

    throw new Error(
      data.message ||
      "Paystack verification failed"
    );

  }

  return data.data;

}


// ======================================================
// COMPLETE PREMIUM PURCHASE
// + MARKETER COMMISSION
// ======================================================

async function completePremiumPurchase(
  transaction
) {

  if (!transaction) {

    throw new Error(
      "Transaction data missing"
    );

  }

  console.log(
    "Starting Premium fulfillment:",
    transaction.reference
  );

  // --------------------------------------------------
  // PAYMENT STATUS
  // --------------------------------------------------

  if (
    transaction.status !==
    "success"
  ) {

    throw new Error(
      `Payment was not successful. Status: ${transaction.status}`
    );

  }

  // --------------------------------------------------
  // PAYMENT AMOUNT
  // --------------------------------------------------

  if (
    Number(transaction.amount) !==
    PREMIUM_AMOUNT_KOBO
  ) {

    throw new Error(
      `Incorrect payment amount: ${transaction.amount}`
    );

  }

  // --------------------------------------------------
  // PAYMENT CURRENCY
  // --------------------------------------------------

  if (
    transaction.currency !==
    "NGN"
  ) {

    throw new Error(
      `Incorrect payment currency: ${transaction.currency}`
    );

  }

  // --------------------------------------------------
  // METADATA
  // --------------------------------------------------

  let metadata =
    transaction.metadata;

  if (
    typeof metadata ===
    "string"
  ) {

    try {

      metadata =
        JSON.parse(metadata);

    } catch (error) {

      throw new Error(
        "Invalid payment metadata"
      );

    }

  }

  if (
    !metadata ||
    !metadata.uid
  ) {

    throw new Error(
      "Payment user information missing"
    );

  }

  if (
    metadata.product !==
    "FundsIQ Premium"
  ) {

    throw new Error(
      `Invalid payment product: ${metadata.product}`
    );

  }

  const uid =
    metadata.uid;

  const reference =
    transaction.reference;

  if (!reference) {

    throw new Error(
      "Payment reference missing"
    );

  }

  // --------------------------------------------------
  // USER REFERENCE
  // --------------------------------------------------

  const userRef =
    db
      .collection("users")
      .doc(uid);

  // --------------------------------------------------
  // COMMISSION REFERENCE
  // --------------------------------------------------

  const commissionRef =
    db
      .collection("premiumCommissions")
      .doc(reference);

  // --------------------------------------------------
  // IMPORTANT:
  // FIND THE MARKETER BEFORE STARTING THE
  // FIRESTORE TRANSACTION.
  //
  // Firestore transactions require reads to happen
  // before writes.
  // --------------------------------------------------

  let marketerRef =
    null;

  let referredBy =
    "";

  const customerSnap =
    await userRef.get();

  if (!customerSnap.exists) {

    throw new Error(
      `FundsIQ user not found: ${uid}`
    );

  }

  const customerData =
    customerSnap.data();

  referredBy =
    customerData.referredBy || "";

  console.log(
    "Customer referral information:",
    {
      uid,
      referredBy
    }
  );

  if (referredBy) {

    const marketerQuery =
      await db
        .collection("users")
        .where(
          "referralCode",
          "==",
          referredBy
        )
        .limit(1)
        .get();

    if (
      !marketerQuery.empty
    ) {

      marketerRef =
        marketerQuery
          .docs[0]
          .ref;

      console.log(
        "Marketer found:",
        {
          marketerUid:
            marketerRef.id,

          referralCode:
            referredBy
        }
      );

    } else {

      console.warn(
        "No marketer found for referral code:",
        referredBy
      );

    }

  } else {

    console.log(
      "Customer has no referredBy value."
    );

  }

  // --------------------------------------------------
  // FIRESTORE TRANSACTION
  // --------------------------------------------------

  let alreadyProcessed =
    false;

  await db.runTransaction(
    async firestoreTransaction => {

      // ==============================================
      // ALL READS FIRST
      // ==============================================

      const commissionSnap =
        await firestoreTransaction.get(
          commissionRef
        );

      const userSnap =
        await firestoreTransaction.get(
          userRef
        );

      let marketerSnap =
        null;

      if (marketerRef) {

        marketerSnap =
          await firestoreTransaction.get(
            marketerRef
          );

      }

      // ==============================================
      // USER MUST EXIST
      // ==============================================

      if (!userSnap.exists) {

        throw new Error(
          `FundsIQ user not found: ${uid}`
        );

      }

      // ==============================================
      // DUPLICATE PROTECTION
      // ==============================================

      if (
        commissionSnap.exists
      ) {

        alreadyProcessed =
          true;

        console.log(
          "Transaction already processed:",
          reference
        );

        return;

      }

      // ==============================================
      // ACTIVATE PREMIUM
      // ==============================================

      firestoreTransaction.update(
        userRef,
        {

          premium:
            true,

          premiumActivatedAt:
            admin.firestore
              .FieldValue
              .serverTimestamp(),

          premiumPaymentReference:
            reference,

          premiumPaymentAmount:
            Number(transaction.amount),

          premiumPaymentCurrency:
            transaction.currency

        }
      );

      // ==============================================
      // MARKETER COMMISSION
      // ==============================================

      if (
        marketerRef &&
        marketerSnap &&
        marketerSnap.exists
      ) {

        const marketerData =
          marketerSnap.data();

        const currentBalance =
          Number(
            marketerData.marketerBalance ||
            0
          );

        const currentEarnings =
          Number(
            marketerData.totalEarnings ||
            0
          );

        const currentPremiumReferrals =
          Number(
            marketerData.premiumReferrals ||
            0
          );

        const newBalance =
          currentBalance +
          MARKETER_COMMISSION_NAIRA;

        const newTotalEarnings =
          currentEarnings +
          MARKETER_COMMISSION_NAIRA;

        const newPremiumReferrals =
          currentPremiumReferrals +
          1;

        firestoreTransaction.update(
          marketerRef,
          {

            marketerBalance:
              newBalance,

            totalEarnings:
              newTotalEarnings,

            premiumReferrals:
              newPremiumReferrals,

            lastCommissionAt:
              admin.firestore
                .FieldValue
                .serverTimestamp()

          }
        );

        console.log(
          "MARKETER COMMISSION WILL BE CREDITED:",
          {
            marketerUid:
              marketerRef.id,

            commission:
              MARKETER_COMMISSION_NAIRA,

            newBalance,

            newTotalEarnings,

            premiumReferrals:
              newPremiumReferrals
          }
        );

      } else {

        console.log(
          "No valid marketer. No commission will be credited."
        );

      }

      // ==============================================
      // SAVE COMMISSION RECORD
      // ==============================================

      firestoreTransaction.set(
        commissionRef,
        {

          transactionReference:
            reference,

          customerUid:
            uid,

          marketerUid:
            marketerRef &&
            marketerSnap &&
            marketerSnap.exists
              ? marketerRef.id
              : null,

          referralCode:
            referredBy || null,

          premiumAmount:
            PREMIUM_PRICE_NAIRA,

          commissionPercent:
            MARKETER_COMMISSION_PERCENT,

          commissionAmount:
            marketerRef &&
            marketerSnap &&
            marketerSnap.exists
              ? MARKETER_COMMISSION_NAIRA
              : 0,

          currency:
            "NGN",

          status:
            marketerRef &&
            marketerSnap &&
            marketerSnap.exists
              ? "credited"
              : "no_referrer",

          createdAt:
            admin.firestore
              .FieldValue
              .serverTimestamp()

        }
      );

    }
  );

  // --------------------------------------------------
  // ALREADY PROCESSED
  // --------------------------------------------------

  if (alreadyProcessed) {

    return {

      uid,

      reference,

      commission:
        0,

      alreadyProcessed:
        true

    };

  }

  // --------------------------------------------------
  // SUCCESS
  // --------------------------------------------------

  const commission =
    marketerRef
      ? MARKETER_COMMISSION_NAIRA
      : 0;

  console.log(
    "PREMIUM PURCHASE COMPLETED SUCCESSFULLY:",
    {

      uid,

      reference,

      premiumAmount:
        PREMIUM_PRICE_NAIRA,

      marketerCommission:
        commission,

      marketerUid:
        marketerRef
          ? marketerRef.id
          : null

    }
  );

  return {

    uid,

    reference,

    commission,

    alreadyProcessed:
      false

  };

}


// ======================================================
// PAYSTACK CALLBACK
// ======================================================

app.get(
  "/api/payments/paystack/callback",
  async (req, res) => {

    const reference =
      req.query.reference;

    console.log(
      "================================================"
    );

    console.log(
      "PAYSTACK CALLBACK RECEIVED:",
      reference
    );

    console.log(
      "================================================"
    );

    try {

      if (!reference) {

        console.error(
          "Callback has no reference."
        );

        return res.redirect(
          `${FRONTEND_URL}?payment=failed`
        );

      }

      const transaction =
        await verifyPremiumPayment(
          reference
        );

      console.log(
        "Paystack transaction verified:",
        {
          reference:
            transaction.reference,

          status:
            transaction.status,

          amount:
            transaction.amount,

          currency:
            transaction.currency
        }
      );

      await completePremiumPurchase(
        transaction
      );

      console.log(
        "Callback Premium fulfillment successful."
      );

      return res.redirect(
        `${FRONTEND_URL}?payment=success`
      );

    } catch (error) {

      console.error(
        "PAYSTACK CALLBACK ERROR:",
        error
      );

      return res.redirect(
        `${FRONTEND_URL}?payment=failed`
      );

    }

  }
);


// ======================================================
// PAYSTACK WEBHOOK
// ======================================================

app.post(
  "/api/payments/paystack/webhook",
  async (req, res) => {

    try {

      const signature =
        req.headers[
          "x-paystack-signature"
        ];

      if (!signature) {

        console.warn(
          "Paystack webhook rejected: signature missing"
        );

        return res.sendStatus(401);

      }

      if (!PAYSTACK_SECRET_KEY) {

        console.error(
          "Paystack webhook rejected: secret key missing"
        );

        return res.sendStatus(500);

      }

      // -----------------------------------------------
      // RAW BODY FOR PAYSTACK SIGNATURE VERIFICATION
      // -----------------------------------------------

      const rawBody =
        Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(
              JSON.stringify(req.body)
            );

      const hash =
        crypto
          .createHmac(
            "sha512",
            PAYSTACK_SECRET_KEY
          )
          .update(rawBody)
          .digest("hex");

      if (
        hash !== signature
      ) {

        console.warn(
          "Paystack webhook rejected: invalid signature"
        );

        return res.sendStatus(401);

      }

      let event;

      try {

        event =
          JSON.parse(
            rawBody.toString(
              "utf8"
            )
          );

      } catch (error) {

        console.error(
          "Unable to parse Paystack webhook body:",
          error
        );

        return res.sendStatus(400);

      }

      console.log(
        "PAYSTACK WEBHOOK RECEIVED:",
        event.event
      );

      // -----------------------------------------------
      // ACKNOWLEDGE PAYSTACK
      // -----------------------------------------------

      res.sendStatus(200);

      // -----------------------------------------------
      // ONLY PROCESS SUCCESSFUL CHARGES
      // -----------------------------------------------

      if (
        event.event !==
        "charge.success"
      ) {

        console.log(
          "Ignoring Paystack event:",
          event.event
        );

        return;

      }

      const transaction =
        event.data;

      if (!transaction) {

        console.warn(
          "Webhook has no transaction data."
        );

        return;

      }

      console.log(
        "Webhook transaction:",
        {
          reference:
            transaction.reference,

          status:
            transaction.status,

          amount:
            transaction.amount,

          currency:
            transaction.currency
        }
      );

      // -----------------------------------------------
      // CHECK METADATA
      // -----------------------------------------------

      let metadata =
        transaction.metadata;

      if (
        typeof metadata ===
        "string"
      ) {

        try {

          metadata =
            JSON.parse(metadata);

        } catch (error) {

          console.error(
            "Webhook metadata JSON error:",
            error
          );

          return;

        }

      }

      if (!metadata) {

        console.warn(
          "Webhook has no metadata."
        );

        return;

      }

      if (
        metadata.product !==
        "FundsIQ Premium"
      ) {

        console.log(
          "Ignoring unrelated Paystack transaction:",
          transaction.reference
        );

        return;

      }

      // Put normalized metadata back
      // into transaction.
      transaction.metadata =
        metadata;

      try {

        await completePremiumPurchase(
          transaction
        );

        console.log(
          "WEBHOOK PREMIUM FULFILLMENT COMPLETED:",
          transaction.reference
        );

      } catch (error) {

        console.error(
          "WEBHOOK PREMIUM FULFILLMENT ERROR:",
          error
        );

      }

    } catch (error) {

      console.error(
        "PAYSTACK WEBHOOK ERROR:",
        error
      );

      if (!res.headersSent) {

        res.sendStatus(500);

      }

    }

  }
);


// ======================================================
// GET QUESTIONS
// ======================================================

app.get(
  "/api/exam/questions",
  (req, res) => {

    res.json(
      questions
    );

  }
);


// ======================================================
// SUBMIT EXAM
// ======================================================

app.post(
  "/api/exam/submit",
  (req, res) => {

    try {

      const {
        userId,
        answers
      } = req.body;

      if (
        !userId ||
        !answers
      ) {

        return res.status(400).json({
          msg:
            "User ID and answers are required"
        });

      }

      let score = 0;

      questions.forEach(
        (question, index) => {

          if (
            answers[index] ===
            question.answer
          ) {

            score++;

          }

        }
      );

      const result = {

        userId,

        score,

        total:
          questions.length,

        date:
          new Date()

      };

      results.push(
        result
      );

      res.json({

        score,

        total:
          questions.length

      });

    } catch (error) {

      console.error(
        "Exam submission error:",
        error
      );

      res.status(500).json({
        msg:
          "Exam submission failed"
      });

    }

  }
);


// ======================================================
// GET RESULTS
// ======================================================

app.get(
  "/api/results",
  (req, res) => {

    res.json(
      results
    );

  }
);


// ======================================================
// SERVER START
// ======================================================

const PORT =
  process.env.PORT ||
  5000;

app.listen(
  PORT,
  () => {

    console.log(
      `FundsIQ API running on port ${PORT}`
    );

    console.log(
      "Paystack webhook:",
      PAYSTACK_WEBHOOK_URL
    );

    console.log(
      "Paystack configured:",
      Boolean(
        PAYSTACK_SECRET_KEY
      )
    );

    console.log(
      "Premium price:",
      `₦${PREMIUM_PRICE_NAIRA}`
    );

    console.log(
      "Marketer commission:",
      `₦${MARKETER_COMMISSION_NAIRA}`
    );

    console.log(
      "Commission rate:",
      `${MARKETER_COMMISSION_PERCENT}%`
    );

  }
);
