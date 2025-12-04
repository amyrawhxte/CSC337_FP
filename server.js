const express = require("express")
const path = require("path")
const port = 8080; 
const app = express()

app.use(express.static(__dirname))

app.get("/home", function(req, res) {
    res.sendFile(path.join(__dirname, "index.html"))
})

app.get("/login", function(req, res) {
    res.sendFile(path.join(__dirname, "login.html"))
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

app.get("/logout", function(req, res) {
    res.sendFile(path.join(__dirname, "logout.html"))
})

app.get("/profile", function(req, res) {
    res.sendFile(path.join(__dirname, "profile.html"))
})

app.get("/products", function(req, res) {
    res.sendFile(path.join(__dirname, "products.html"))
})

app.listen(port)