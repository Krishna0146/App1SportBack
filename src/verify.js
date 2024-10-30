import cors from 'cors';
import express from 'express';
import { connectToDB, db } from "./db.js";
import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';
import twilio from 'twilio';

dotenv.config();

const app = express();
const accountsid = process.env.TWILIO_SID;
const token = process.env.TWILIO_TOKEN;
const client = twilio(accountsid, token);

app.use(cors());
app.use(express.json());

const sendSMS = async (to, body) => {
    const msg = {
        from: process.env.TWILIO_FROM_NUM,
        to: to,
        body
    };
    try {
        const message = await client.messages.create(msg)
        console.log(message.sid);
    } catch (error) {
        console.error('Error sending SMS:', error);
    }
};

app.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        let result = await db.collection("buyer").findOne({ email });
        if (!result) {
            result = await db.collection("seller").findOne({ email });
        }
        if (result) {
            if (result.password === password) {
                return res.json({ message: "Login successful", values: result });
            } else {
                return res.status(401).json({ message: "Invalid password" });
            }
        } else {
            return res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        console.error('Error during sign-in:', error);
        return res.status(500).json({ message: "An error occurred during sign-in." });
    }
});

app.post('/signup', async (req, res) => {
    const { fname, email, password, phone, location, key } = req.body;
    const trimmedPhone = phone.trim();

    if (trimmedPhone.length !== 10 || isNaN(trimmedPhone)) {
        return res.status(400).json({ message: "Phone number must be exactly 10 digits." });
    }

    try {
        const existingUser = await db.collection("buyer").findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists." });
        }

        const newUser = {
            fname,
            email,
            password,
            phone,
            location,
            key,
            type: 'buyer',
            admin: false,
        };

        await sendSMS('+91' + phone, "You are successfully registered"); 
        await db.collection("buyer").insertOne(newUser);
        return res.status(201).json({ message: "Signup successful" });
    } catch (error) {
        console.error('Error during signup:', error);
        return res.status(500).json({ message: "An error occurred during signup." });
    }
});

app.post('/seller-registration', async (req, res) => {
    const { sellerName, email, password, phone, shopName, address, licenseNumber, location, key } = req.body;
    const trimmedPhone = phone.trim();

    if (trimmedPhone.length !== 10 || isNaN(trimmedPhone)) {
        return res.status(400).json({ message: "Phone number must be exactly 10 digits." });
    }

    try {
        const existingSeller = await db.collection("seller").findOne({ email });
        if (existingSeller) {
            return res.status(409).json({ message: "Email already registered" });
        }

        const newSeller = {
            sellerName,
            email,
            password,
            phone,
            shopName,
            address,
            licenseNumber,
            location,
            key,
            applicationStatus: 'pending',
            type: 'seller' 
        };
        await db.collection("seller").insertOne(newSeller);
        return res.status(201).json({ message: "Seller registration successful" });
    } catch (error) {
        console.error('Error during seller registration:', error);
        return res.status(500).json({ message: "An error occurred during seller registration." });
    }
});

app.post('/forgot-password', async (req, res) => {
    const { email, password, key } = req.body;
    try {
        let user = await db.collection("buyer").findOne({ email, key });
        if (!user) {
            user = await db.collection("seller").findOne({ email, key });
        }
        if (!user) {
            return res.status(404).json({ message: "Email does not exist" });
        } else {
            if (user.type === 'buyer') {
                await db.collection("buyer").updateOne({ email }, { $set: { password } });
            } else {
                await db.collection("seller").updateOne({ email }, { $set: { password } });
            }
            return res.json({ message: "Password reset successful" });
        }
    } catch (error) {
        console.error('Error during password reset:', error);
        return res.status(500).json({ message: "An error occurred during password reset." });
    }
});

app.get('/pending-sellers', async (req, res) => {
    try {
        const pendingSellers = await db.collection("seller").find({ applicationStatus: 'pending' }).toArray();
        return res.json(pendingSellers);
    } catch (error) {
        console.error('Error fetching pending sellers:', error);
        return res.status(500).json({ message: "An error occurred while fetching pending sellers." });
    }
});

app.post('/approve-seller', async (req, res) => {
    const { id } = req.body;
    try {
        const seller = await db.collection("seller").updateOne(
            { _id: new ObjectId(id) },
            { $set: { applicationStatus: 'granted' } }
        );
        if (seller.modifiedCount > 0) {
            return res.json({ message: "Seller approved successfully." });
        } else {
            return res.status(404).json({ message: "Seller not found." });
        }
    } catch (error) {
        console.error('Error approving seller:', error);
        return res.status(500).json({ message: "An error occurred while approving the seller." });
    }
});

app.get('/seller-profile/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const seller = await db.collection("seller").findOne({ email });
        if (seller) {
            return res.json(seller);
        } else {
            return res.status(404).json({ message: "Seller not found." });
        }
    } catch (error) {
        console.error('Error fetching seller profile:', error);
        return res.status(500).json({ message: "An error occurred while fetching the seller profile." });
    }
});

app.get('/buyer-profile/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const buyer = await db.collection("buyer").findOne({ email });
        if (buyer) {
            return res.json(buyer);
        } else {
            return res.status(404).json({ message: "Buyer not found." });
        }
    } catch (error) {
        console.error('Error fetching buyer profile:', error);
        return res.status(500).json({ message: "An error occurred while fetching the buyer profile." });
    }
});

app.post('/profiles', async (req, res) => {
    const {
        imageUrl,
        itemName,
        category,
        refurbished,
        condition,
        discountPercentage,
        originalPrice,
        sellingPrice,
        availability,
        sizes,
        shopName,
        sellerName, 
    } = req.body;

    if (!itemName || !category || !sellingPrice || !shopName || !sellerName) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    try {
        await db.collection('items').insertOne({
            imageUrl,
            itemName,
            category,
            refurbished,
            condition, 
            discountPercentage,
            originalPrice,
            sellingPrice,
            availability,
            sizes,
            shopName,
            sellerName,
        });
        return res.status(201).json({ message: 'Item added successfully.' });
    } catch (error) {
        console.error('Error adding item:', error);
        return res.status(500).json({ message: 'An error occurred while adding the item.' });
    }
});

app.get('/user-items', async (req, res) => {
    const { shopName } = req. query;

    try {
        const items = await db.collection('items').find({ shopName }).toArray();
        return res.json(items);
    } catch (error) {
        console.error('Error fetching user items:', error);
        return res.status(500).json({ message: 'An error occurred while fetching user items.' });
    }
});

app.get('/orders', async (req, res) => {
    const { shopName, sellerName } = req.query;
    try {
        const orders = await db.collection('orders').find({ shopName, sellerName }).toArray();
        return res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).json({ message: 'An error occurred while fetching orders.' });
    }
});

app.get('/reviews', async (req, res) => {
    const { shopName, sellerEmail } = req.query;

    try {
        const reviews = await db.collection('reviews').find({ shopName, sellerEmail }).toArray();
        return res.json(reviews);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        return res.status(500).json({ message: 'An error occurred while fetching reviews.' });
    }
});

app.get('/items', async (req, res) => {
    try {
        const items = await db.collection("items").find().toArray();
        return res.json(items);
    } catch (error) {
        console.error('Error fetching items:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/items/refurbished', async (req, res) => {
    try {
        const refurbishedItems = await db.collection("items").find({ refurbished: true }).toArray();
        return res.json(refurbishedItems);
    } catch (error) {
        console.error('Error fetching refurbished items:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/cart', async (req, res) => {
    const { itemName, sellerName, cost, quantity, imageUrl, shopName } = req.body;
    try {
        const existingCartItem = await db.collection('cart').findOne({ itemName,sellerName });
        if (existingCartItem) {
            await db.collection('cart').updateOne(
                { _id: existingCartItem._id },
                { $set: { quantity: existingCartItem.quantity + quantity } }
            );
        } else {
            const newCartItem = {
                itemName,
                sellerName,
                cost,
                quantity,
                imageUrl,
                shopName,
            };
            await db.collection('cart').insertOne(newCartItem); 
        }
        return res.status(201).json({ message: 'Item added to cart successfully' });
    } catch (error) {
        console.error('Error adding item to cart:', error);
        return res.status(500).json({ message: 'An error occurred while adding item to cart.', error: error.message });
    }
});

connectToDB(() => {
    app.listen(9000, () => {
        console.log("Server running at 9000");
    });
});
