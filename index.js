import express, { response } from "express";
import dotenv from "dotenv";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
// import bcrypt from "bcrypt";
import cors from "cors";
// import jwt from "jsonwebtoken";
dotenv.config();
const app = express();
const port = process.env.PORT;

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
    await client.connect();

    const parcelDB = client.db("parcelDB");
    const parcelCollection = parcelDB.collection("allparcel");

    //  All parcel API
    app.get("/parcel", async (req, res) => {
      const query = {};

      const { email } = req.query;

      if (email) {
        query.senderemail = email;
      }
       const options = {sort: {creatAtime: -1}}

      const result = await parcelCollection.find(query,options).toArray();
      res.status(200).json({
        message: "Your All Parcel",
        result,
      });
    });
    // payment data
    app.get("/parcel/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await parcelCollection.findOne(query);
      res.status(201).json({
        message:"This Parcel Payment Done",
        result
      })
    })

    app.post("/parcel", async (req, res) => {
      const parcel = req.body;
      // creat a parcel Time 
      parcel.creatAtime= new Date();
     
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

    await client.db("admin").command({ ping: 1 });
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
