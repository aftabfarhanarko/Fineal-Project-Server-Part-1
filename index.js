import express from "express";
import dotenv from "dotenv";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
// import bcrypt from "bcrypt";
import cors from "cors";
import admin from "firebase-admin";
import crypto from "crypto";
dotenv.config();
const serviceAccount = "./firebase-adminSdk.json";
// import jwt from "jsonwebtoken";
import Stripe from "stripe";
const stripe = new Stripe(process.env.PAYMENT_KEY);
const app = express();
const port = process.env.PORT;

function generateTrackingId() {
  const prefix = "PRCL";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();

  return `${prefix}-${date}-${random}`;
}

app.use(express.json());
app.use(cors());

// Fb Verify
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const vreifyFirebase = async (req, res, next) => {
  const token = req.headers.authorization;
  // console.log(token);
  if (!token) {
    return res.status(401).send({
      message: "Unauthorized Access",
    });
  }

  try {
    const itToken = token.split(" ")[1];
    const verify = await admin.auth().verifyIdToken(itToken);

    req.verify_email = verify?.email;
    next();
  } catch (err) {
    return res.status(401).send({
      message: "Unauthorized Access",
      err,
    });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@clustermyfirstmongodbpr.2cecfoe.mongodb.net/?appName=ClusterMyFirstMongoDbProject`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const parcelDB = client.db("parcelDB");
    const parcelCollection = parcelDB.collection("allparcel");
    const userCollection = parcelDB.collection("user");
    const paymentParcelCollection = parcelDB.collection("paymentParcel");
    const riderCollection = parcelDB.collection("rider");

    // middle admin before allowing admin activity
    // must be used after verifyFBToken middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.verify_email;
      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "Forbitien Access" });
      }
      next();
    };

    // User Roll
    app.post("/svuser", async (req, res) => {
      const user = req.body;

      user.role = "user";
      user.creatWb = new Date();

      // Check if email already exists
      const userIsExist = await userCollection.findOne({ email: user?.email });

      if (userIsExist) {
        return res.json({ message: "User Already Saved" });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", vreifyFirebase, async (req, res) => {
      const searchText = req.query.searchText;
      console.log(searchText);

      const query = {};
      if (searchText) {
        // single search text
        // query.displayName = { $regex: searchText, $options: "i" };

        // Double SearchText
        query.$or = [
          { displayName: { $regex: searchText, $options: "i" } },
          { email: { $regex: searchText, $options: "i" } },
        ];
      }

      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/users/:id", async (req, res) => {});

    app.get("/users/:email/role", async (req, res) => {
      const email = req?.params?.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });

    app.patch(
      "/users/:id/role",
      vreifyFirebase,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const data = req?.body;
        console.log(id, data);

        const updeatDoc = {
          $set: {
            role: data?.role,
          },
        };
        const result = await userCollection.updateOne(query, updeatDoc);
        res.send(result);
      }
    );

    app.delete("/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    //  All parcel API
    app.get("/parcel", async (req, res) => {
      const query = {};

      const { email, deliveryStatus } = req.query;
      console.log(deliveryStatus);

      if (email) {
        query.senderemail = email;
      }
      if (deliveryStatus) {
        query.deliveryStatus = deliveryStatus;
      }
      const options = { sort: { creatAtime: -1 } };

      const result = await parcelCollection.find(query, options).toArray();
      res.status(200).json({
        message: "Your All Parcel",
        result,
      });
    });
    // data
    app.get("/parcel/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelCollection.findOne(query);
      res.status(201).json({
        message: "This Parcel Payment Done",
        result,
      });
    });

    app.post("/parcel", async (req, res) => {
      const parcel = req.body;
      // creat a parcel Time
      parcel.creatAtime = new Date();

      const result = await parcelCollection.insertOne(parcel);
      res.status(200).json({
        message: "Successfully Post Data Now",
        result,
      });
    });

    app.patch("/parcel/:id", async (req, res) => {
      const id = req.params.id;
      const { riderId, riderEmail, riderName } = req.body;
      const newIdTest = { _id: new ObjectId(id) };
      const updeatDocParcel = {
        $set: {
          deliveryStatus: "driver-assigned",
          riderId: riderId,
          riderEmail: riderEmail,
          riderName: riderName,
        },
      };
      const parcelResult = await parcelCollection.updateOne(
        newIdTest,
        updeatDocParcel
      );

      // Updeat Rider

      const id2 = { _id: new ObjectId(riderId) };
      const updeatDocRider = {
        $set: {
          workStatus: "in-delivery",
        },
      };

      const resultRider = await riderCollection.updateOne(id2, updeatDocRider);

      res.send(parcelResult, resultRider);
    });

    app.delete("/parcel/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelCollection.deleteOne(query);
      res.status(204).json({
        message: "Item deleted successfully",
        result,
      });
    });

    // New Payment
    app.post("/payment-checkout", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo?.totalCost * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              unit_amount: amount,
              product_data: {
                name: `Pay For Parcel  Name : ${paymentInfo?.percilname}`,
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          parcelid: paymentInfo?.parcelid,
          percilname: paymentInfo?.percilname,
        },
        customer_email: paymentInfo?.senderemail,
        success_url: `${process.env.YOUR_DOMAIN}/dasbord/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.YOUR_DOMAIN}/dasbord/cancel`,
      });
      res.send({ url: session.url });
    });

    // updet Payment Data
    app.patch("/success-payment", async (req, res) => {
      const data = req.query.session_id;

      const seccions = await stripe.checkout.sessions.retrieve(data);
      if (seccions.payment_status) {
        const trakingId = generateTrackingId();

        // No Repet Saved Database Chack
        const transactionId = seccions.payment_intent;
        const query2 = { transactionId: transactionId };
        const isExgisted = await paymentParcelCollection.findOne(query2);
        if (isExgisted) {
          return res.send({
            message: "Is Exgisted Payment Data",
            transactionId,
            trakingId: isExgisted.trakingId,
          });
        }

        const id = seccions.metadata.parcelid;
        const query = { _id: new ObjectId(id) };
        const seter = {
          $set: {
            paymentStutas: "Paid",
            deliveryStatus: "pending-pickup",
            trakingId: trakingId,
          },
        };
        const result = await parcelCollection.updateOne(query, seter);

        const paymentInfo = {
          amount: seccions.amount_total / 100,
          currency: seccions.currency,
          customerEmail: seccions.customer_email,
          parcelid: seccions.metadata.parcelid,
          parcelName: seccions.metadata.percilname,
          transactionId: seccions.payment_intent,
          paymentStatus: seccions.payment_status,
          paidAt: new Date(),
          trakingId: trakingId,
        };
        // console.log("New", paymentInfo);

        if (seccions.payment_status === "paid") {
          const resultPayment = await paymentParcelCollection.insertOne(
            paymentInfo
          );
          res.send({
            modifyParcel: result,
            paymentInfo: resultPayment,
            trakingId: trakingId,
            transactionId: seccions.payment_intent,
            success: true,
          });
        }
      }
    });

    // get payment data user
    app.get("/payment", vreifyFirebase, async (req, res) => {
      const { email } = req.query;
      const query = {};
      if (email) {
        query.customerEmail = email;
        if (email !== req.verify_email) {
          return res.status(403).send({
            message: "Forbident Access",
          });
        }
      }

      const data = paymentParcelCollection.find(query).sort({ paidAt: -1 });
      const result = await data.toArray();
      res.send(result);
    });

    //Old Payment Api
    app.post("/checkout", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo?.totalCost * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              unit_amount: amount,
              product_data: {
                name: `Please Pay For : ${paymentInfo?.percilname}`,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo?.senderemail,
        mode: "payment",
        metadata: {
          parcelid: paymentInfo?.parcelid,
          parcelName: paymentInfo?.percilname,
        },
        success_url: `${process.env.YOUR_DOMAIN}/dasbord/success`,
        cancel_url: `${process.env.YOUR_DOMAIN}/dasbord/cancel`,
      });

      res.send({ url: session.url });
    });

    // Rider Roll
    app.post("/rider", async (req, res) => {
      const rider = req.body;

      (rider.status = "pending"),
        (rider.creatAtime = new Date()),
        (rider.roll = "Rider");
      console.log(rider);

      const result = await riderCollection.insertOne(rider);
      res.status(200).send({ message: "Saved Creat Rider Data", result });
    });

    app.get("/riders", async (req, res) => {
      const { status } = req.query;

      const query = {};
      if (status) {
        query.status = req.query.status;
      }

      const cursor = riderCollection.find(query).sort({ creatAtime: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/ridereas", async (req, res) => {
      const { yourDistrict, workStatus } = req.query;
      console.log(yourDistrict, workStatus);
      const query = {};
      if (yourDistrict) {
        query.yourDistrict = yourDistrict;
      }

      if (workStatus) {
        query.workStatus = workStatus;
      }
      const result = await riderCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/riderUb/:id", vreifyFirebase, verifyAdmin, async (req, res) => {
      const status = req.body.status;
      console.log(status);

      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const seter = {
        $set: {
          status: status,
          workStatus: "available",
        },
      };
      const result = await riderCollection.updateOne(query, seter);

      if (status == "approved") {
        const email = req.body.email;
        const queryUser = { email };
        const seter2 = {
          $set: {
            role: "Rider",
          },
        };

        const result2 = await userCollection.updateOne(queryUser, seter2);
      }
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
