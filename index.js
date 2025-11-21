import express from "express";
import dotenv from "dotenv";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
// import bcrypt from "bcrypt";
import cors from "cors";
import crypto from "crypto";
dotenv.config();
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
    const paymentParcelCollection = parcelDB.collection("paymentParcel");

    //  All parcel API
    app.get("/parcel", async (req, res) => {
      const query = {};

      const { email } = req.query;

      if (email) {
        query.senderemail = email;
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
                name: `Please Pay For Parcel : ${paymentInfo?.percilname}`,
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
        const id = seccions.metadata.parcelid;
        const query = { _id: new ObjectId(id) };
        const seter = {
          $set: {
            paymentStutas: "Paid",
            trakingId: generateTrackingId(),
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
          trakingId: seccions.trakingId,
        };
        console.log("New", paymentInfo);

        if (seccions.payment_status === "Paid") {
          const resultPayment = await paymentParcelCollection.insertOne(
            paymentInfo
          );
          res.send({
            success: true,
            modifyParcel: result,
            paymentInfo: resultPayment,
          });
        }
      }

      // console.log("Seccions Id", seccions);
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
