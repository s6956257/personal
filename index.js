const express = require('express');
const fetch = require('node-fetch');
const app = express();
const path = require('path');
const fs = require('fs');
const userModel = require('./models/user');
const orderModel = require('./models/order');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const sgMail = require('@sendgrid/mail');

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
    secret: 'rahaaf-perfumes-secret',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.user = req.user;
    next();
});

passport.use(new LocalStrategy(userModel.authenticate()));
passport.serializeUser(userModel.serializeUser());
passport.deserializeUser(userModel.deserializeUser());

app.get('/', (req, res) => {
    fs.readdir('./files', function(err, files) { 
        res.render("index", { files: files || [] });
    });
});

app.post('/create-order', async (req, res) => {
    try {
        const { productName, productBrand, productPrice, customerName, customerPhone, customerAddress, customerEmail } = req.body;
        let userIdForOrder = null;
        if (req.isAuthenticated()) {
            userIdForOrder = req.user._id;
        }
        let newOrder = new orderModel({
            userId: userIdForOrder,
            productName: productName,
            brand: productBrand,
            price: parseFloat(productPrice),
            customer: {
                name: customerName,
                phone: customerPhone,
                address: customerAddress,
                email: customerEmail || 'No email provided'
            }
        })
        await newOrder.save();
        try {
            await fetch('https://formspree.io/f/xwpwkeya', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    _subject: `🎉 NEW PERFUME ORDER: ${productName}`,
                    "Product": productName,
                    "Brand": productBrand,
                    "Price": `$${productPrice}`,
                    "--- Customer Details ---": "",
                    "Customer Name": customerName,
                    "Customer Phone": customerPhone,
                    "Customer Address": customerAddress,
                    "Customer Email": customerEmail || 'No email provided'
                })
            });
            console.log('Order notification email sent to admin successfully.');
        } catch (emailError) {
            console.error('Failed to send order notification email:', emailError);
        }
        res.redirect(`/order-confirmation/${newOrder._id}`);
        
    } catch (error) {
        console.log("Error creating order:", error);
        res.redirect('/shop');
    }
});
app.get('/order-confirmation/:id', async (req, res) => {
    try {
        const order = await orderModel.findById(req.params.id);
        if (order) {
            res.render('confirmation', { order: order });
        } else {
            res.status(404).send('Order not found');
        }
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

const PORT = process.env.PORT || 8080; 

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
