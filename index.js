const express = require("express");
const app = express();
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const PORT = process.env.PORT || 8000;

// middlewares
const cors = require("cors");
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.DB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const db = client.db('sell-it');
        const productCollection = db.collection('product');

        app.post("/products", async (req, res) => {
            const productData = req.body;

            const result = await productCollection.insertOne(productData)

            res.status(200).send(result)
        })

        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen((PORT), () => {
    console.log(`Server is running on PORT: ${PORT}`);
})