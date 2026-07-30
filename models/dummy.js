const mongoose = require("mongoose");

const abc = new mongoose.Schema({
  class:{
    type: String,
    required: false,
  },
  name:{
    type: String,
    required: false,
  },
});

const dummy = new mongoose.model("dummymodal", abc);
module.exports = dummy;