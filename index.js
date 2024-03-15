const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const axios = require("axios");
const crypto = require("crypto");
const { MongoClient, ServerApiVersion } = require("mongodb");

const port = process.env.PORT || 5000;

// middleware
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rowBody = buf.toString();
    },
  })
);
app.use(cors());


// MongoDB server
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@nft-market-place.rndycg0.mongodb.net/?retryWrites=true&w=majority`;
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

    const db = await client.db("nft-market-place");
    const collection = await db.collection("nfts");

    // checkout routes
    app.post("/checkout", async (req, res) => {
      try {
        const { amount } = req.body;
        const invoice = await createInvoice(amount);

        const data = {
          ...req.body,
          order_id: invoice.result.order_id,
          payment_status: invoice.result.status,
        };

        const result = await collection.insertOne(data);

        const response = {
          invoice: invoice,
          mongodbResult: result,
        };

        res.json(response);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

// base url
const cryptomus = axios.create({
  baseURL: "https://api.cryptomus.com/v1",
});

const DEFAULT_CURRENCY = "USD";

// create invoice
const createInvoice = async (amount) => {
  try {
    const data = {
      amount: amount.toString(),
      currency: DEFAULT_CURRENCY,
      order_id: crypto.randomBytes(12).toString("hex"),
      url_callback: "https://nft-market-place-cyan.vercel.app/checkout/callback",
      url_success: "https://nft-market-place-cyan.vercel.app",
      lifetime: 300,
    };

    const sign = crypto
      .createHash("md5")
      .update(Buffer.from(JSON.stringify(data)).toString("base64") + process.env.PAYMENT_API_KEY)
      .digest("hex");

    const headers = {
      merchant: process.env.MERCHANT_ID,
      sign,
    };

    const response = await cryptomus.post("/payment", data, {
      headers,
    });

    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};



app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
