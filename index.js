const express = require("express");
const app = express();
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
        const userCollection = db.collection('user');

        // Seller only
        app.post("/api/add-products", async (req, res) => {
            const productData = req.body;
            const result = await productCollection.insertOne(productData)

            res.status(200).send(result);
        });

        // Seller only
        app.get("/api/my-products", async (req, res) => {
            const query = {}

            const sellerId = req.query.sellerId;
            if (sellerId) {
                query["sellerInfo.userId"] = sellerId;
            }

            const cursor = await productCollection.find(query);
            const result = await cursor.toArray();

            res.status(200).send(result);
        })

        // Seller only
        app.patch("/api/update-product", async (req, res) => {
            const { productId } = req.query;
            const data = req.body;

            if (!productId) {
                return res.status(400).send({ message: "Product ID is required" });
            }

            const query = { _id: new ObjectId(productId) };
            const updateDoc = {
                $set: data
            };

            const result = await productCollection.updateOne(query, updateDoc);

            if (result.matchedCount === 0) {
                return res.status(404).send({ message: "Product not found" });
            }

            res.status(200).send(result);
        });

        // Seller only
        app.delete("/api/delete-product", async (req, res) => {
            const { productId } = req.query;

            const query = { _id: new ObjectId(productId) };
            const result = await productCollection.deleteOne(query);

            if (result.deletedCount === 0) {
                return res.status(404).send("Product not found or already deleted.");
            }

            return res.status(200).send(result);
        })

        // Admin only
        app.get("/api/users", async (req, res) => {
            const query = {
                role: { $ne: "ADMIN" }
            };

            const cursor = await userCollection.find(query);
            const result = await cursor.toArray();

            res.status(200).send(result);
        })

        // Admin only
        app.patch("/api/user/:userId/status", async (req, res) => {
            const { userId } = req.params;
            const { status } = req.body;

            const result = await userCollection.updateOne(
                { _id: new ObjectId(userId) },
                { $set: { status: status } }
            );

            if (result.modifiedCount === 0) {
                return res.status(404).send({
                    message: "User account not found."
                });
            }

            res.status(200).send(result);
        })

        // Admin only
        app.delete("/api/user/:userId", async (req, res) => {
            const { userId } = req.params;

            const result = await userCollection.deleteOne(
                { _id: new ObjectId(userId) }
            );

            if (result.deletedCount === 0) {
                return res.status(404).send({
                    message: "User account not found."
                });
            }

            res.status(200).send(result);
        })

        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Welcome to Sell It server!')
})

app.listen((PORT), () => {
    console.log(`Server is running on PORT: ${PORT}`);
})