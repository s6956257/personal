const mongoose = require('mongoose');
const orderSchema = mongoose.Schema({
     userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user' 
    },
    productName: String,
    brand: String,
    price: Number,
    customer: {
        name: String,
        phone: String,
        address: String,
        email: String
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        default: 'Pending'
    }
});
module.exports = mongoose.model("order", orderSchema);