const express = require("express")
const path = require("path")
const crypto = require("crypto")
const getDB = require("./db")
const port = 8080; 
const app = express()

app.use(express.json())
app.use(express.static(__dirname))

async function requireToken(req, res, next) {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({error: "Missing token"})
    }

    const db = await getDB();
    const session = await db.collection("sessions").findOne({token})

    if (!session) {
        return res.status(401).json({error: "Invalid Session"})
    }

    req.userId = session.userId
    next();
}

app.get("/home", function(req, res) {
    res.sendFile(path.join(__dirname, "index.html"))
})

app.get("/login", function(req, res) {
    res.sendFile(path.join(__dirname, "login.html"))
})

app.post("/login", async (req, res) => {
    const db = await getDB(); 
    const users = db.collection("users")

    const {username, email, password} = req.body;

    if (!username && !email) {
        return res.status(400).json({error: "Please provide username or email"})
    }

    const query = {password}

    if (username) {
        query.username = username
    }

    if (email) {
        query.email = email;
    }

    const user = await users.findOne(query)

    if (!user) {
        return res.status(401).json({error: "Invalid Login"})
    }

    const token = crypto.randomBytes(32).toString("hex")

    await db.collection("sessions").insertOne({
        token, userId: user._id, createdAt: new Date()
    })

    res.json({token})
})

app.get("/logout", async function(req, res) {
    const token = req.headers.authorization; 

    if (token) {
        const db = await getDB(); 
        await db.collection("sessions").deleteOne({token})
    }
    res.sendFile(path.join(__dirname, "logout.html"))
})

app.post("/register", async function(req, res) {
    const db = await getDB(); 
    const users = db.collection("users")

    const {username, email, password} = req.body;

    if (!password || !username || !email) {
        return res.status(400).json({error: "All fields required"})
    }

    const exists = await users.findOne({$or: [{username}, {email}]})

    if (exists) {
        return res.status(400).json({ error: "User already exists" });
    }

    await users.insertOne({username, email, password})

    return res.json({success: true})
})

app.get("/register", function(req, res) {
    res.sendFile(path.join(__dirname, "register.html"))
})

app.get("/checkout", function(req, res) {
    res.sendFile(path.join(__dirname, "checkout.html"))
})

app.get("/cart", function(req, res) {
    res.sendFile(path.join(__dirname, "cart.html"))
})

app.get("/api/profile", requireToken, async function(req, res) {
    const {ObjectId} = require("mongodb")
    const db = await getDB(); 
    const users = db.collection("users")

    const user = await users.findOne({_id: new ObjectId(req.userId)})

    if (!user) {
        return res.status(401).json({error: "User not found"})
    }

    res.json( {
        username: user.username, 
        email: user.email
    })
    
})

app.get("/profile", function(req, res) {
    res.sendFile(path.join(__dirname, "profile.html"))
})


app.get("/products", function(req, res) {
    res.sendFile(path.join(__dirname, "products.html"))
})

app.listen(port)