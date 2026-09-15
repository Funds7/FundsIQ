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


// Paystack webhook MUST receive the raw body
// before express.json() processes requests.
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

const MINIMUM_WITHDRAWAL_NAIRA =
  2000;

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
        MARKETER_COMMISSION_PERCENT,

      minimumWithdrawal:
        MINIMUM_WITHDRAWAL_NAIRA

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


  if (
    transaction.status !==
    "success"
  ) {

    throw new Error(
      `Payment was not successful. Status: ${transaction.status}`
    );

  }


  if (
    Number(transaction.amount) !==
    PREMIUM_AMOUNT_KOBO
  ) {

    throw new Error(
      `Incorrect payment amount: ${transaction.amount}`
    );

  }


  if (
    transaction.currency !==
    "NGN"
  ) {

    throw new Error(
      `Incorrect payment currency: ${transaction.currency}`
    );

  }


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


  const userRef =
    db
      .collection("users")
      .doc(uid);

  const commissionRef =
    db
      .collection("premiumCommissions")
      .doc(reference);


  // --------------------------------------------------
  // READ CUSTOMER BEFORE TRANSACTION
  // --------------------------------------------------

  const customerSnap =
    await userRef.get();

  if (!customerSnap.exists) {

    throw new Error(
      `FundsIQ user not found: ${uid}`
    );

  }

  const customerData =
    customerSnap.data();

  const referredBy =
    customerData.referredBy || "";


  // --------------------------------------------------
  // FIND MARKETER
  // --------------------------------------------------

  let marketerRef =
    null;

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

    }

  }


  // --------------------------------------------------
  // FIRESTORE TRANSACTION
  // --------------------------------------------------

  let alreadyProcessed =
    false;

  await db.runTransaction(
    async firestoreTransaction => {

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


      if (!userSnap.exists) {

        throw new Error(
          `FundsIQ user not found: ${uid}`
        );

      }


      if (
        commissionSnap.exists
      ) {

        alreadyProcessed =
          true;

        return;

      }


      // ------------------------------------------------
      // ACTIVATE PREMIUM
      // ------------------------------------------------

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


      // ------------------------------------------------
      // CREDIT MARKETER
      // ------------------------------------------------

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

        firestoreTransaction.update(
          marketerRef,
          {

            marketerBalance:
              currentBalance +
              MARKETER_COMMISSION_NAIRA,

            totalEarnings:
              currentEarnings +
              MARKETER_COMMISSION_NAIRA,

            premiumReferrals:
              currentPremiumReferrals +
              1,

            lastCommissionAt:
              admin.firestore
                .FieldValue
                .serverTimestamp()

          }
        );

      }


      // ------------------------------------------------
      // COMMISSION RECORD
      // ------------------------------------------------

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


  const commission =
    marketerRef
      ? MARKETER_COMMISSION_NAIRA
      : 0;


  console.log(
    "PREMIUM PURCHASE COMPLETED:",
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
      "PAYSTACK CALLBACK RECEIVED:",
      reference
    );

    try {

      if (!reference) {

        return res.redirect(
          `${FRONTEND_URL}?payment=failed`
        );

      }

      const transaction =
        await verifyPremiumPayment(
          reference
        );

      await completePremiumPurchase(
        transaction
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

        return res.sendStatus(401);

      }

      if (!PAYSTACK_SECRET_KEY) {

        return res.sendStatus(500);

      }


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

        return res.sendStatus(400);

      }


      console.log(
        "PAYSTACK WEBHOOK:",
        event.event
      );


      // Acknowledge Paystack immediately.
      res.sendStatus(200);


      // ==================================================
      // PREMIUM PAYMENT
      // ==================================================

      if (
        event.event ===
        "charge.success"
      ) {

        const transaction =
          event.data;

        if (!transaction) {
          return;
        }


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

            return;

          }

        }


        if (
          !metadata ||
          metadata.product !==
          "FundsIQ Premium"
        ) {

          return;

        }


        transaction.metadata =
          metadata;


        try {

          await completePremiumPurchase(
            transaction
          );

          console.log(
            "Premium webhook completed:",
            transaction.reference
          );

        } catch (error) {

          console.error(
            "Premium webhook fulfillment error:",
            error
          );

        }

        return;

      }


      // ==================================================
      // WITHDRAWAL SUCCESS
      // ==================================================

      if (
        event.event ===
        "transfer.success"
      ) {

        await handleTransferWebhook(
          event.data,
          "Successful"
        );

        return;

      }


      // ==================================================
      // WITHDRAWAL FAILED
      // ==================================================

      if (
        event.event ===
        "transfer.failed"
      ) {

        await handleTransferWebhook(
          event.data,
          "Failed"
        );

        return;

      }


      // ==================================================
      // WITHDRAWAL REVERSED
      // ==================================================

      if (
        event.event ===
        "transfer.reversed"
      ) {

        await handleTransferWebhook(
          event.data,
          "Reversed"
        );

        return;

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
// PAYSTACK GENERIC REQUEST
// ======================================================

async function paystackRequest(
  endpoint,
  options = {}
) {

  if (!PAYSTACK_SECRET_KEY) {

    throw new Error(
      "Paystack secret key is not configured"
    );

  }


  const response =
    await fetch(
      `https://api.paystack.co${endpoint}`,
      {

        method:
          options.method ||
          "GET",

        headers: {

          Authorization:
            `Bearer ${PAYSTACK_SECRET_KEY}`,

          "Content-Type":
            "application/json"

        },

        body:
          options.body
            ? JSON.stringify(
                options.body
              )
            : undefined

      }
    );


  const data =
    await response.json();


  if (
    !response.ok ||
    !data.status
  ) {

    throw new Error(
      data.message ||
      "Paystack request failed"
    );

  }


  return data;

}


// ======================================================
// GET NIGERIAN BANKS
// ======================================================

app.get(
  "/api/withdrawal/banks",
  verifyFirebaseToken,
  async (req, res) => {

    try {

      const data =
        await paystackRequest(
          "/bank?currency=NGN"
        );


      const banks =
        (data.data || [])
          .filter(
            bank =>
              bank.active !== false &&
              bank.is_deleted !== true
          )
          .map(
            bank => ({

              name:
                bank.name,

              code:
                bank.code

            })
          );


      return res.json({

        status:
          true,

        banks

      });

    } catch (error) {

      console.error(
        "Get banks error:",
        error
      );

      return res.status(500).json({

        status:
          false,

        msg:
          "Unable to load Nigerian banks."

      });

    }

  }
);


// ======================================================
// VERIFY BANK ACCOUNT
// ======================================================

app.post(
  "/api/withdrawal/verify-account",
  verifyFirebaseToken,
  async (req, res) => {

    try {

      const {
        accountNumber,
        bankCode
      } = req.body;


      const cleanAccountNumber =
        String(
          accountNumber || ""
        ).trim();


      const cleanBankCode =
        String(
          bankCode || ""
        ).trim();


      if (
        !/^\d{10}$/.test(
          cleanAccountNumber
        )
      ) {

        return res.status(400).json({

          status:
            false,

          msg:
            "Enter a valid 10-digit account number."

        });

      }


      if (!cleanBankCode) {

        return res.status(400).json({

          status:
            false,

          msg:
            "Please select a bank."

        });

      }


      const data =
        await paystackRequest(

          `/bank/resolve?account_number=${encodeURIComponent(
            cleanAccountNumber
          )}&bank_code=${encodeURIComponent(
            cleanBankCode
          )}`

        );


      if (
        !data.data ||
        !data.data.account_name
      ) {

        return res.status(400).json({

          status:
            false,

          msg:
            "Bank account could not be verified."

        });

      }


      return res.json({

        status:
          true,

        accountNumber:
          data.data.account_number,

        accountName:
          data.data.account_name,

        bankId:
          data.data.bank_id || null

      });

    } catch (error) {

      console.error(
        "Bank verification error:",
        error
      );

      return res.status(400).json({

        status:
          false,

        msg:
          error.message ||
          "Unable to verify bank account."

      });

    }

  }
);


// ======================================================
// MARKETER WITHDRAWAL
// ======================================================

app.post(
  "/api/withdrawal/request",
  verifyFirebaseToken,
  async (req, res) => {

    const uid =
      req.firebaseUser.uid;

    let withdrawalRef =
      null;

    let withdrawalAmount =
      0;

    let transferWasCreated =
      false;

    try {

      const {
        accountNumber,
        bankCode,
        bankName
      } = req.body;


      const cleanAccountNumber =
        String(
          accountNumber || ""
        ).trim();


      const cleanBankCode =
        String(
          bankCode || ""
        ).trim();


      const cleanBankName =
        String(
          bankName || ""
        ).trim();


      if (
        !/^\d{10}$/.test(
          cleanAccountNumber
        )
      ) {

        return res.status(400).json({

          status:
            false,

          msg:
            "Invalid 10-digit account number."

        });

      }


      if (!cleanBankCode) {

        return res.status(400).json({

          status:
            false,

          msg:
            "Bank selection is required."

        });

      }


      if (!cleanBankName) {

        return res.status(400).json({

          status:
            false,

          msg:
            "Bank name is required."

        });

      }


      // ==================================================
      // VERIFY ACCOUNT AGAIN ON SERVER
      // ==================================================

      const verification =
        await paystackRequest(

          `/bank/resolve?account_number=${encodeURIComponent(
            cleanAccountNumber
          )}&bank_code=${encodeURIComponent(
            cleanBankCode
          )}`

        );


      if (
        !verification.data ||
        !verification.data.account_name
      ) {

        return res.status(400).json({

          status:
            false,

          msg:
            "Bank account could not be verified."

        });

      }


      const verifiedAccountName =
        verification.data.account_name;


      const userRef =
        db
          .collection("users")
          .doc(uid);


      // ==================================================
      // RESERVE BALANCE
      // ==================================================

      await db.runTransaction(
        async transaction => {

          const userSnap =
            await transaction.get(
              userRef
            );


          if (!userSnap.exists) {

            throw new Error(
              "User account not found."
            );

          }


          const userData =
            userSnap.data();


          const balance =
            Number(
              userData.marketerBalance ||
              0
            );


          if (
            balance <
            MINIMUM_WITHDRAWAL_NAIRA
          ) {

            throw new Error(
              `Minimum withdrawal is ₦${MINIMUM_WITHDRAWAL_NAIRA.toLocaleString()}`
            );

          }


          if (
            userData.withdrawalStatus ===
            "Initiating" ||
            userData.withdrawalStatus ===
            "Processing"
          ) {

            throw new Error(
              "You already have a withdrawal being processed."
            );

          }


          withdrawalAmount =
            balance;


          withdrawalRef =
            db
              .collection("users")
              .doc(uid)
              .collection("withdrawals")
              .doc();


          transaction.set(
            withdrawalRef,
            {

              amount:
                withdrawalAmount,

              bankName:
                cleanBankName,

              bankCode:
                cleanBankCode,

              accountNumber:
                cleanAccountNumber,

              accountName:
                verifiedAccountName,

              status:
                "Initiating",

              requestedAt:
                admin.firestore
                  .FieldValue
                  .serverTimestamp(),

              paystackReference:
                null,

              uid

            }
          );


          transaction.update(
            userRef,
            {

              marketerBalance:
                0,

              pendingWithdrawal:
                withdrawalAmount,

              withdrawalStatus:
                "Initiating",

              bankName:
                cleanBankName,

              bankCode:
                cleanBankCode,

              accountNumber:
                cleanAccountNumber,

              accountName:
                verifiedAccountName,

              lastWithdrawal:
                admin.firestore
                  .FieldValue
                  .serverTimestamp()

            }
          );

        }
      );


      // ==================================================
      // CREATE PAYSTACK RECIPIENT
      // ==================================================

      const recipientResponse =
        await paystackRequest(
          "/transferrecipient",
          {

            method:
              "POST",

            body: {

              type:
                "nuban",

              name:
                verifiedAccountName,

              account_number:
                cleanAccountNumber,

              bank_code:
                cleanBankCode,

              currency:
                "NGN"

            }

          }
        );


      const recipientCode =
        recipientResponse.data &&
        recipientResponse.data.recipient_code;


      if (!recipientCode) {

        throw new Error(
          "Paystack did not return a recipient code."
        );

      }


      // ==================================================
      // UNIQUE TRANSFER REFERENCE
      // ==================================================

      const transferReference =
        `FUNDSIQ-WD-${uid}-${Date.now()}`;


      // ==================================================
      // INITIATE TRANSFER
      // ==================================================

      const transferResponse =
        await paystackRequest(
          "/transfer",
          {

            method:
              "POST",

            body: {

              source:
                "balance",

              amount:
                withdrawalAmount * 100,

              recipient:
                recipientCode,

              reference:
                transferReference,

              reason:
                "FundsIQ Marketer Withdrawal",

              currency:
                "NGN"

            }

          }
        );


      const transfer =
        transferResponse.data;


      transferWasCreated =
        true;


      // ==================================================
      // SAVE TRANSFER INFORMATION
      // ==================================================

      await db.runTransaction(
        async transaction => {

          const withdrawalSnap =
            await transaction.get(
              withdrawalRef
            );


          const userSnap =
            await transaction.get(
              userRef
            );


          if (
            !withdrawalSnap.exists ||
            !userSnap.exists
          ) {

            throw new Error(
              "Withdrawal record could not be updated."
            );

          }


          transaction.update(
            withdrawalRef,
            {

              status:
                transfer.status ===
                "success"
                  ? "Successful"
                  : "Processing",

              paystackReference:
                transferReference,

              paystackTransferCode:
                transfer.transfer_code ||
                null,

              paystackRecipientCode:
                recipientCode,

              paystackTransferId:
                transfer.id ||
                null,

              updatedAt:
                admin.firestore
                  .FieldValue
                  .serverTimestamp()

            }
          );


          transaction.update(
            userRef,
            {

              withdrawalStatus:
                transfer.status ===
                "success"
                  ? "Successful"
                  : "Processing",

              pendingWithdrawal:
                transfer.status ===
                "success"
                  ? 0
                  : withdrawalAmount,

              lastWithdrawalReference:
                transferReference

            }
          );

        }
      );


      console.log(
        "FUNDSIQ WITHDRAWAL CREATED:",
        {

          uid,

          amount:
            withdrawalAmount,

          reference:
            transferReference,

          status:
            transfer.status

        }
      );


      return res.json({

        status:
          true,

        message:
          transfer.status ===
          "success"
            ? "Withdrawal sent successfully."
            : "Withdrawal is being processed.",

        amount:
          withdrawalAmount,

        reference:
          transferReference,

        transferStatus:
          transfer.status,

        accountName:
          verifiedAccountName

      });

    } catch (error) {

      console.error(
        "FUNDSIQ WITHDRAWAL ERROR:",
        error
      );


      // ==================================================
      // ONLY RESTORE BALANCE WHEN WE KNOW PAYSTACK
      // DID NOT CREATE THE TRANSFER.
      // ==================================================

      if (
        withdrawalRef &&
        withdrawalAmount > 0 &&
        !transferWasCreated
      ) {

        try {

          await restoreFailedWithdrawal(
            uid,
            withdrawalRef,
            withdrawalAmount,
            error.message ||
            "Withdrawal failed"
          );

        } catch (restoreError) {

          console.error(
            "Withdrawal balance restoration error:",
            restoreError
          );

        }

      }


      return res.status(400).json({

        status:
          false,

        msg:
          error.message ||
          "Withdrawal could not be processed."

      });

    }

  }
);


// ======================================================
// RESTORE FAILED WITHDRAWAL
// ======================================================

async function restoreFailedWithdrawal(
  uid,
  withdrawalRef,
  amount,
  reason
) {

  const userRef =
    db
      .collection("users")
      .doc(uid);


  await db.runTransaction(
    async transaction => {

      const userSnap =
        await transaction.get(
          userRef
        );

      const withdrawalSnap =
        await transaction.get(
          withdrawalRef
        );


      if (
        !userSnap.exists ||
        !withdrawalSnap.exists
      ) {

        return;

      }


      const withdrawalData =
        withdrawalSnap.data();


      if (
        withdrawalData.status !==
        "Initiating"
      ) {

        return;

      }


      const userData =
        userSnap.data();


      const currentBalance =
        Number(
          userData.marketerBalance ||
          0
        );


      transaction.update(
        userRef,
        {

          marketerBalance:
            currentBalance +
            amount,

          pendingWithdrawal:
            0,

          withdrawalStatus:
            "Failed"

        }
      );


      transaction.update(
        withdrawalRef,
        {

          status:
            "Failed",

          failureReason:
            reason,

          updatedAt:
            admin.firestore
              .FieldValue
              .serverTimestamp()

        }
      );

    }
  );

}


// ======================================================
// HANDLE TRANSFER WEBHOOK
// ======================================================

async function handleTransferWebhook(
  transfer,
  finalStatus
) {

  if (!transfer) {

    console.warn(
      "Transfer webhook contains no data."
    );

    return;

  }


  const reference =
    transfer.reference;


  if (!reference) {

    console.warn(
      "Transfer webhook has no reference."
    );

    return;

  }


  console.log(
    "Processing transfer webhook:",
    {
      reference,
      finalStatus
    }
  );


  // ----------------------------------------------------
  // FIND WITHDRAWAL BY PAYSTACK REFERENCE
  // ----------------------------------------------------

  const withdrawalQuery =
    await db
      .collectionGroup("withdrawals")
      .where(
        "paystackReference",
        "==",
        reference
      )
      .limit(1)
      .get();


  if (
    withdrawalQuery.empty
  ) {

    console.warn(
      "No FundsIQ withdrawal found for transfer:",
      reference
    );

    return;

  }


  const withdrawalDoc =
    withdrawalQuery.docs[0];

  const withdrawalRef =
    withdrawalDoc.ref;

  const withdrawalData =
    withdrawalDoc.data();


  const uid =
    withdrawalData.uid;


  if (!uid) {

    console.warn(
      "Withdrawal has no UID:",
      reference
    );

    return;

  }


  const userRef =
    db
      .collection("users")
      .doc(uid);


  await db.runTransaction(
    async transaction => {

      const freshWithdrawalSnap =
        await transaction.get(
          withdrawalRef
        );

      const userSnap =
        await transaction.get(
          userRef
        );


      if (
        !freshWithdrawalSnap.exists ||
        !userSnap.exists
      ) {

        return;

      }


      const freshWithdrawal =
        freshWithdrawalSnap.data();


      // ------------------------------------------------
      // SUCCESS
      // ------------------------------------------------

      if (
        finalStatus ===
        "Successful"
      ) {

        transaction.update(
          withdrawalRef,
          {

            status:
              "Successful",

            paystackStatus:
              transfer.status ||
              "success",

            updatedAt:
              admin.firestore
                .FieldValue
                .serverTimestamp()

          }
        );


        transaction.update(
          userRef,
          {

            pendingWithdrawal:
              0,

            withdrawalStatus:
              "Successful",

            lastWithdrawalCompletedAt:
              admin.firestore
                .FieldValue
                .serverTimestamp()

          }
        );


        return;

      }


      // ------------------------------------------------
      // FAILED OR REVERSED
      // ------------------------------------------------

      if (
        finalStatus ===
        "Failed" ||
        finalStatus ===
        "Reversed"
      ) {

        const userData =
          userSnap.data();


        const currentBalance =
          Number(
            userData.marketerBalance ||
            0
          );


        const withdrawalAmount =
          Number(
            freshWithdrawal.amount ||
            0
          );


        transaction.update(
          userRef,
          {

            marketerBalance:
              currentBalance +
              withdrawalAmount,

            pendingWithdrawal:
              0,

            withdrawalStatus:
              finalStatus,

            lastWithdrawalCompletedAt:
              admin.firestore
                .FieldValue
                .serverTimestamp()

          }
        );


        transaction.update(
          withdrawalRef,
          {

            status:
              finalStatus,

            paystackStatus:
              transfer.status ||
              finalStatus.toLowerCase(),

            failureReason:
              transfer.reason ||
              null,

            updatedAt:
              admin.firestore
                .FieldValue
                .serverTimestamp()

          }
        );

      }

    }
  );


  console.log(
    "Transfer webhook processed:",
    {
      reference,
      status:
        finalStatus
    }
  );

}


// ======================================================
// VERIFY PAYSTACK TRANSFER
// ======================================================

app.get(
  "/api/withdrawal/verify/:reference",
  verifyFirebaseToken,
  async (req, res) => {

    try {

      const reference =
        String(
          req.params.reference ||
          ""
        ).trim();


      if (!reference) {

        return res.status(400).json({

          status:
            false,

          msg:
            "Transfer reference is required."

        });

      }


      const data =
        await paystackRequest(

          `/transfer/verify/${encodeURIComponent(
            reference
          )}`

        );


      const transfer =
        data.data;


      return res.json({

        status:
          true,

        reference:
          transfer.reference,

        transferStatus:
          transfer.status,

        amount:
          transfer.amount,

        currency:
          transfer.currency,

        recipient:
          transfer.recipient ||
          null

      });

    } catch (error) {

      console.error(
        "Transfer verification error:",
        error
      );

      return res.status(400).json({

        status:
          false,

        msg:
          error.message ||
          "Unable to verify transfer."

      });

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

    console.log(
      "Minimum withdrawal:",
      `₦${MINIMUM_WITHDRAWAL_NAIRA}`
    );

  }
);
