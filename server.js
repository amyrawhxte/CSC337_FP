// dependencies 
const express = require("express")
const path = require("path")
const crypto = require("crypto")
const getDB = require("./db")
const port = 8080; 
const app = express()


// json request bodies 
app.use(express.json())

// Serve static files
app.use(express.static(__dirname))

// ensures user is authenticated before accessign specific page 
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

    // store userId in sessions for access 
    req.userId = session.userId
    next();
}

// retrieves users cart 
async function getOrCreate(db, userId) {
    const carts = db.collection("carts")

    let cart = await carts.findOne({userId})

    if (!cart) {
        await carts.insertOne({userId, items: []})
        cart = await carts.findOne({userId})
    }

    return cart 
}

app.get("/home", function(req, res) {
    res.sendFile(path.join(__dirname, "index.html"))
})

app.get("/login", function(req, res) {
    res.sendFile(path.join(__dirname, "login.html"))
})

// post for login (authenticates user and creates session token)
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

    // generate secure token 
    const token = crypto.randomBytes(32).toString("hex")

    await db.collection("sessions").insertOne({
        token, userId: user._id, createdAt: new Date()
    })

    res.json({token})
})


// delete session token from db
app.get("/logout", async function(req, res) {
    const token = req.headers.authorization; 

    if (token) {
        const db = await getDB(); 
        await db.collection("sessions").deleteOne({token})
    }
    res.sendFile(path.join(__dirname, "logout.html"))
})

// creats new user 
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

// computers final cost and order entry in db, clears the cart afterwards 
app.post("/api/checkout", requireToken, async function(req, res) {
    const db = await getDB()
    const carts = db.collection("carts")
    const orders = db.collection("orders")

    const cart = await carts.findOne({userId: req.userId})

    if (!cart || cart.items.length === 0) {
        return res.status(400).json({error: "Cart is empty"})
    }

    // frontend sends product prices or list to server

    const {pricing} = req.body
    if (!pricing) {
        return res.status(400).json({error: "Missing pricing information"})
    }

    // calc price 
    let total = 0; 
    for (let i = 0; i < cart.items.length; i++) {
        let item = cart.items[i]
        const price = pricing[item.productId]

        if (!price) {
            return res.status(400).json({error: `Missing price for product ${item.productId}`})
        }

        total += price * item.qty
    }

    // create order
    const order = {
        userId: req.userId,
        items: cart.items,
        total, 
        createdAt: new Date()
    }

    const result = await orders.insertOne(order)

    // empty cart 
    await carts.updateOne(
        {userId: req.userId},
        {$set: {items:[]}}
    )

    res.json({
        success: true, 
        orderId: result.insertedId, 
        total
    })
})

app.get("/cart", function(req, res) {
    res.sendFile(path.join(__dirname, "cart.html"))
})

// gets user's cart
app.get("/api/cart", requireToken, async function(req, res) {
    const db = await getDB()

    const cart = await getOrCreate(db, req.userId)

    res.json(cart)
})

// adds item(s) to cart 
app.post("/api/cart/add", requireToken, async function(req, res) {
    const db = await getDB()
    const carts = db.collection("carts")

    const {productId, qty} = req.body
    
    if (!productId || qty == null) {
        return res.status(400).json({error: "productId and qty required"})
    }

    if (qty <= 0) {
        return res.status(400).json({error: "qty must be > 0"});
    }

    const cart = await getOrCreate(db, req.userId)

    const existing = cart.items.find( i => i.productId == productId)

    if (existing) {
        existing.qty += qty
    } else {
        cart.items.push({productId, qty})
    }

    await carts.updateOne({userId: req.userId}, {$set: {items: cart.items}})

    res.json({success:true, cart})
})

// removes specific product from cart
app.post("/api/cart/remove", requireToken, async function(req, res) {
    const db = await getDB()
    const carts = db.collection("carts")

    const {productId} = req.body
    
    if (!productId) {
        return res.status(400).json({error: "productId required"})
    }

    const cart = await getOrCreate(db, req.userId)

    cart.items = cart.items.filter( i => i.productId !== productId)

    await carts.updateOne({userId: req.userId}, {$set: {items: cart.items}})

    res.json({success:true, cart})
})

// clears the cart 
app.post("/api/cart/clear", requireToken, async function(req, res) {
    const db = await getDB()
    const carts = db.collection("carts")

    await carts.updateOne(
        { userId: req.userId}, 
        {$set: {items:[]}}
    )
    
    res.json({success:true})
})

// retursn profile info 
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