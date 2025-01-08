var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var nftSchema = new Schema(
  {
    platform: String,
    verified: Boolean,
    network: Number,
  },
  { collection: "Nfts" }
);

module.exports = mongoose.model("NFT", nftSchema);
