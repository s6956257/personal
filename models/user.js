const mongoose = require('mongoose');
const plm = require('passport-local-mongoose');
mongoose.connect("mongodb+srv://rahaafinternational_db_user:g2SARe2fyQri6vlH@rahaaf.9hceoli.mongodb.net/?appName=Rahaaf");
const userSchema = mongoose.Schema({
     email: String,
      role: {
        type: String,
        default: 'customer'
    }
});
userSchema.plugin(plm);
module.exports = mongoose.model("user", userSchema);
