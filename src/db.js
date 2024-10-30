import { MongoClient } from "mongodb";
import dotenv from 'dotenv';

dotenv.config();

let db;
async function connectToDB(cb) {
    // Use your MongoDB Atlas connection string here
    const url = 'mongodb+srv://krishna:1710800@cluster0.xjo2wzd.mongodb.net/vvhack?retryWrites=true&w=majority&tls=true'; // Changed to use consistent single quotes
    
    const client = new MongoClient(url);
    
    try {
        await client.connect();
        db = client.db("vvhack");
        console.log("Connected to MongoDB Atlas");
        cb();
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}

// connectToDB()

export { connectToDB, db };
