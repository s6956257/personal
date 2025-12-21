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

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}
function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'admin') {
        return next();
    }
    res.redirect('/');
}
app.get('/', (req, res) => {
    fs.readdir('./files', function(err, files) { 
        res.render("index", { files: files || [] });
    });
});
app.get('/login', (req, res) => {
    res.render('login');
});
app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login'
}), (req, res) => {});
app.get('/register', (req, res) => {
    res.render('register');
});
app.post('/register', (req, res) => {
    const newUser = new userModel({ username: req.body.username, email: req.body.email });
    userModel.register(newUser, req.body.password, (err, user) => {
        if (err) {
            console.log(err);
            return res.redirect('/register');
        }
        passport.authenticate('local')(req, res, () => {
            res.redirect('/');
        });
    });
});
app.get('/logout', (req, res, next) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
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
app.get('/my-orders', isLoggedIn, async (req, res) => {
    const userOrders = await orderModel.find({ userId: req.user._id });
    res.render('my-orders', { orders: userOrders });
});
app.get('/profile', isLoggedIn, (req, res) => {
    res.render('profile', { user: req.user });
});
app.post('/profile/update', isLoggedIn, async (req, res) => {
    const user = await userModel.findById(req.user._id);
    if (req.body.email) user.email = req.body.email;
    if (req.body.newpassword) await user.setPassword(req.body.newpassword);
    await user.save();
    res.redirect('/profile');
});
app.post('/orders/cancel/:id', isLoggedIn, async (req, res) => {
    const order = await orderModel.findOne({ _id: req.params.id, userId: req.user._id });
    if (order && order.status === 'Pending') {
        order.status = 'Cancelled';
        await order.save();
    }
    res.redirect('/my-orders');
});
app.get('/Delivery', isLoggedIn, isAdmin, async (req, res) => {
    const allOrders = await orderModel.find({});
    res.render("delivery", { orders: allOrders });
});
app.post('/orders/delete/:id', isLoggedIn, isAdmin, async (req, res) => {
    await orderModel.findByIdAndDelete(req.params.id);
    res.redirect('/Delivery');
});
app.post('/send-message', (req, res) => {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
        to: 'rahaafinternational@gmail.com', 
        from: 'website-notifications@yourdomain.com',
        subject: `New Message from ${req.body.name}`,
        text: `You have a new message from:
        Name: ${req.body.name}
        Email: ${req.body.email}
        Message:
        ${req.body.message}`,
        replyTo: req.body.email, 
    };
    sgMail
        .send(msg)
        .then(() => {
            console.log('Email sent successfully via SendGrid');
            res.redirect('/#contact'); 
        })
        .catch((error) => {
            console.error('SendGrid Error:', error);
            res.redirect('/#contact'); 
        });
});
app.listen(3000, function() {
  console.log('Server is running on http://localhost:3000');
});
