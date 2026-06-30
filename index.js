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
        // await client.connect();

        const db = client.db('sell-it');
        const productCollection = db.collection('product');
        const userCollection = db.collection('user');
        const categoryCollection = db.collection('categories');
        const paymentCollection = db.collection('payments');
        const orderCollection = db.collection('orders');
        const wishlistCollection = db.collection('wishlist');

        // Public
        app.get("/api/categories", async (req, res) => {
            const cursor = await categoryCollection.find();
            const result = await cursor.toArray();

            res.status(200).send(result);
        })

        // public
        app.get("/api/product/slug", async (req, res) => {
            try {
                const { slug } = req.query;
                console.log(slug);

                const query = { category: slug };
                const result = await productCollection.find(query).toArray()

                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });

        // Save paymenent info
        app.post("/api/payment/success", async (req, res) => {
            const data = req.body;

            const result = await paymentCollection.insertOne(data);
            res.status(201).send(result);
        });

        // Confirm Order & Update Stock
        app.post("/api/confirm-order", async (req, res) => {
            const data = req.body;

            const result = await orderCollection.insertOne(data);

            const productQuery = {
                _id: new ObjectId(data.productId)
            };

            const updateDoc = {
                $inc: { stock: -1 }
            };

            const updateProductQuantity = await productCollection.updateOne(productQuery, updateDoc);

            res.status(201).send(result);
        });

        // Buyer only
        app.get("/api/my-orders", async (req, res) => {
            try {
                const { userId } = req.query;

                if (!userId) {
                    return res.status(400).send({ message: "userId is required" });
                }

                const pipeline = [
                    {
                        $match: {
                            "buyerInfo.userId": userId
                        }
                    },
                    {
                        $addFields: {
                            productObjId: { $toObjectId: "$productId" }
                        }
                    },
                    {
                        $lookup: {
                            from: "product",
                            localField: "productObjId",
                            foreignField: "_id",
                            as: "productDetails"
                        }
                    },
                    {
                        $unwind: {
                            path: "$productDetails",
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            productObjId: 0
                        }
                    }
                ];

                const result = await orderCollection.aggregate(pipeline).toArray();
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });

        // Buyer only
        app.get("/api/payment-history", async (req, res) => {
            try {
                const { userId } = req.query;

                if (!userId) {
                    return res.status(400).send({ message: "userId is required" });
                }

                const result = await paymentCollection.find({ userId }).sort({ createdAt: -1 }).toArray();

                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });

        // Buyer only
        app.get("/api/buyer/dashboard-stats", async (req, res) => {
            try {
                const { userId } = req.query;

                if (!userId) {
                    return res.status(400).send({ message: "userId parameter is required" });
                }

                const orderCountQuery = { "buyerInfo.userId": userId };
                const wishlistCountQuery = { userId: userId };

                const orderCount = await orderCollection.countDocuments(orderCountQuery);
                const wishlistCount = await wishlistCollection.countDocuments(wishlistCountQuery);

                const recentOrders = await orderCollection
                    .find(orderCountQuery)
                    .sort({ _id: -1 })
                    .limit(5)
                    .toArray();

                const enrichedOrders = [];

                for (const order of recentOrders) {
                    const product = await productCollection.findOne(
                        { _id: new ObjectId(order.productId) },
                        { projection: { title: 1, image: 1, price: 1 } }
                    );

                    enrichedOrders.push({
                        _id: order._id,
                        status: order.orderStatus,
                        price: product?.price,
                        productName: product ? product.title : "Product Unavailable",
                        productImage: product ? product.image : null
                    });
                }

                return res.status(200).send({
                    orderCount,
                    wishlistCount,
                    recentOrders: enrichedOrders
                });

            } catch (error) {
                return res.status(500).send({ error: "Server error" });
            }
        });

        // For all
        app.post("/api/wishlist", async (req, res) => {
            try {
                const { userId, productId } = req.body;

                const query = { userId, productId };
                const existing = await wishlistCollection.findOne(query);

                if (existing) {
                    const result = await wishlistCollection.deleteOne(query);
                    return res.status(200).send(result);
                }

                const result = await wishlistCollection.insertOne({
                    userId,
                    productId,
                    createdAt: new Date()
                });

                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });

        // For all
        app.get("/api/wishlist", async (req, res) => {
            try {
                const { userId } = req.query;

                if (!userId) {
                    return res.status(400).send({ message: "userId is required" });
                }

                const pipeline = [
                    {
                        $match: {
                            userId: userId
                        }
                    },
                    {
                        $addFields: {
                            productObjId: { $toObjectId: "$productId" }
                        }
                    },
                    {
                        $lookup: {
                            from: "product",
                            localField: "productObjId",
                            foreignField: "_id",
                            as: "productDetails"
                        }
                    },
                    {
                        $unwind: {
                            path: "$productDetails",
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            productObjId: 0
                        }
                    }
                ];

                const result = await db.collection("wishlist").aggregate(pipeline).toArray();
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });

        // For all
        app.get("/api/products", async (req, res) => {
            try {
                const query = { status: "APPROVED" };

                const result = await productCollection.find(query).toArray();

                return res.status(200).send(result);
            } catch (error) {
                return res.status(500).send("Server error");
            }
        });

        // For all
        app.get("/api/product-details", async (req, res) => {
            const { productId } = req.query;

            if (!productId) {
                return res.status(400).send("Product ID is required");
            }

            const result = await productCollection.findOne({ _id: new ObjectId(productId) });

            if (!result) {
                return res.status(404).send("Product not found");
            }

            return res.status(200).send(result);
        });

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

        // Seller only
        app.get("/api/seller/orders", async (req, res) => {
            try {
                const { userId } = req.query;

                const query = { "sellerInfo.userId": userId };

                const orders = await orderCollection
                    .find(query)
                    .sort({ _id: -1 })
                    .toArray();

                const enrichedOrders = [];

                for (const order of orders) {
                    const product = await productCollection.findOne(
                        { _id: new ObjectId(order.productId) },
                        { projection: { title: 1, image: 1 } }
                    );

                    enrichedOrders.push({
                        _id: order._id,
                        price: order.price,
                        status: order.orderStatus,
                        productName: product ? product.title : "Product Unavailable",
                        productImage: product ? product.image : null
                    });
                }

                return res.status(200).send(enrichedOrders);

            } catch (error) {
                return res.status(500).send({ error: "Server error" });
            }
        });

        // Seller only
        app.patch("/api/seller/update-orders/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const { orderStatus } = req.body;

                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: { orderStatus: orderStatus.toUpperCase() }
                };

                const result = await orderCollection.updateOne(filter, updateDoc);
                return res.status(200).send(result);
            } catch (error) {
                return res.status(500).send({ message: "Internal server error", error });
            }
        });

        // Admin only - Dashboard Stats
        app.get("/api/admin/dashboard-stats", async (req, res) => {
            try {
                const query = { role: { $ne: "ADMIN" } };

                const totalUsers = await userCollection.countDocuments(query);
                const totalProducts = await productCollection.estimatedDocumentCount();

                return res.status(200).send({
                    totalUsers,
                    totalProducts,
                    totalOrders: 0
                });

            } catch (error) {
                return res.status(500).send("Server error");
            }
        });

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
        app.get("/api/admin/products", async (req, res) => {
            const cursor = await productCollection.find();
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

        // Admin only
        app.patch("/api/update-product-status", async (req, res) => {
            const { productId } = req.query;
            const { status } = req.body;

            const result = await productCollection.updateOne(
                { _id: new ObjectId(productId) },
                { $set: { status } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).send("Product not found");
            }

            return res.status(200).send(result);
        });

        // Admin only
        app.delete("/api/admin/delete-product", async (req, res) => {
            const { productId } = req.query;

            if (!productId) {
                return res.status(400).send("Product ID is required");
            }

            const result = await productCollection.deleteOne({ _id: new ObjectId(productId) });

            if (result.deletedCount === 0) {
                return res.status(404).send("Product not found");
            }

            return res.status(200).send(result);
        });

        // Admin only
        app.get("/api/orders", async (req, res) => {
            try {
                const orders = await orderCollection.find().toArray();
                return res.status(200).send(orders);
            } catch (error) {
                return res.status(500).send({ message: "Internal server error", error });
            }
        })

        // Admin only
        app.patch("/api/update-orders/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const { orderStatus } = req.body;

                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: { orderStatus: orderStatus }
                };

                const result = await orderCollection.updateOne(filter, updateDoc);
                return res.status(200).send(result);
            } catch (error) {
                return res.status(500).send({ message: "Internal server error", error });
            }
        });

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