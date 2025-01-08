var express = require("express");
const Moralis = require("moralis").default;
const { EvmChain } = require("@moralisweb3/common-evm-utils");
var Auction = require("../models/auction");
var Collection = require("../models/collection");
var Nft = require("../models/nft");
const { default: axios } = require("axios");
const { getNftDetail, verifyContract } = require("../utils/nft");
const { NetworkId, NFTSCAN } = require("../utils/config");

var auctionRouter = express.Router();
auctionRouter.route("/admin").post(function (request, response) {
  Auction.insertMany(request.body)
    .then(function () {
      console.log("Data inserted"); // Success
      response.status(201).send("success");
    })
    .catch(function (error) {
      console.log(error); // Failure
      response.status(500).send(error);
    });

  // response.status(201).send(auction);
});
auctionRouter
  .route("/auctions")
  .post(async (request, response) => {
    console.log("POST /auctions");
    const oldAuction = await Auction.findOne({
      network: request.body.network,
      id: request.body.id,
    });
    if (!oldAuction) {
      var auction = new Auction(request.body);
      await auction.save();
    }
    if (request.body.isERC721) {
      await Collection.deleteOne({
        token: request.body.token,
        network: request.body.network,
        platform: { $regex: `^${request.body.platform}$`, $options: "i" },
      });
    } else {
      const collection = await Collection.findOne({
        owner: request.body.owner,
        token: request.body.token,
        network: request.body.network,
        platform: { $regex: `^${request.body.platform}$`, $options: "i" },
      });
      if (collection) {
        if (collection.amount > 1) {
          collection.amount -= 1;
          await collection.save();
        } else {
          await Collection.deleteOne({
            token: request.body.token,
            network: request.body.network,
            platform: { $regex: `^${request.body.platform}$`, $options: "i" },
          });
        }
      }
    }
    console.info("saved auction and deleted collection");
    response.status(201).send(auction);
  })
  .get(async function (request, response) {
    console.log("GET /auctions");
    Auction.find(
      { network: request.query.chainId, paidOut: false },
      function (error, auctions) {
        if (error) {
          response.status(500).send(error);
          return;
        }
        response.json(auctions);
      }
    );
  });

auctionRouter
  .route("/auctions/:auctionId")
  .get(function (request, response) {
    console.log("GET /auctions/:auctionId");

    var auctionId = request.params.auctionId;
    var chainId = request.query.network;
    Auction.findOne(
      { id: auctionId, network: chainId },
      function (error, auction) {
        if (error) {
          response.status(500).send(error);
          return;
        }
        response.json(auction);
      }
    );
  })
  .put(function (request, response) {
    var auctionId = request.params.auctionId;

    console.log("PUT /auctions/:auctionId", auctionId);

    let update = new Auction(request.body);

    Auction.findOneAndUpdate(
      { id: auctionId, network: request.body.network },
      request.body,
      async (error, auction) => {
        if (error) {
          console.error(error.message);
          response.status(500).send(error);
          return;
        }

        if (auction) {
          console.log("success!!!!!!", request.body);
          const collection = new Collection(request.body);
          await collection.save();
          response.json(update);
          return;
        }

        response.status(404).json({
          message: "Auction with id " + auctionId + " was not found.",
        });
      }
    );
  })
  .delete(function (request, response) {
    console.log("DELETE /auctions/:auctionId");

    var auctionId = request.params.auctionId;

    Auction.findOne({ id: auctionId }, function (error, auction) {
      if (error) {
        response.status(500).send(error);
        return;
      }

      if (auction) {
        auction.remove(function (error) {
          if (error) {
            response.status(500).send(error);
            return;
          }

          response.status(200).json({
            message: "Auction with id " + auctionId + " was removed.",
          });
        });
      } else {
        response.status(404).json({
          message: "Auction with id " + auctionId + " was not found.",
        });
      }
    });
  });

auctionRouter
  .route("/admincollection")
  .delete(function (request, response) {
    console.log(request.body);
  })
  .post(function (request, response) {
    // const data = request.body;
    // const { network, platform } = request.body[0];
    // const collection = await Nft.findOne({
    //   network,
    //   platform,
    // });
    // if (!collection) {
    //   const verified = await verifyContract(network, platform).catch(
    //     console.log
    //   );
    //   const nft = new Nft({
    //     network,
    //     platform,
    //     verified: verified ? verified : false,
    //   });
    //   await nft.save().catch(console.log);
    // }
    // if (network !== NetworkId.INK) {
    //   return response.status(201).send("success");
    // }
    Collection.insertMany(request.body)
      .then(function () {
        console.log("Data inserted"); // Success
        response.status(201).send("success");
      })
      .catch(function (error) {
        console.log(error); // Failure
        response.status(500).send(error);
      });

    // response.status(201).send(auction);
  })
  .put(async function (request, response) {
    await Collection.deleteMany({
      network: request.body.chainId,
      owner: request.body.owner,
    });
    Collection.insertMany(request.body.data)
      .then(function () {
        console.log("data inserted");
        response.status(201).send("success");
      })
      .catch(function (error) {
        console.log(error);
        response.status(500).send(error);
      });
  });
auctionRouter.route("/collection").get(function (request, response) {
  const { chainId, owner } = request.query;

  console.log("GET /collections", owner);

  if (Number(chainId) === NetworkId.INK)
    Collection.find({ network: chainId, owner: owner }, function (error, nfts) {
      if (error) {
        response.status(500).send(error);
        return;
      }

      // console.log(auctions);

      response.json(nfts);
    });
  else {
    fetchNFTScan(owner, chainId)
      .then((nfts) => {
        console.log("total counts", nfts.length);
        response.status(201).send(nfts);
        console.log(nfts);
      })
      .catch((error) => {
        console.log("error", response);
        response.status(500).send(error);
      });
  }
});
auctionRouter
  .route("/collection/:platform/:id")
  .get(async function (request, response) {
    const { platform, id } = request.params;
    const { chainId, owner } = request.query;

    console.log("GET /collection/:platform/:id", platform, id, chainId, owner);
    if (chainId !== NetworkId.INK) {
      const retData = await getNftDetail(platform, id, chainId);
      return response.json(retData);
    } else {
      Collection.find(
        {
          network: chainId,
          owner: owner,
          platform: { $regex: `^${platform}$`, $options: "i" },
          token: id,
        },
        function (error, nfts) {
          if (error) {
            response.status(500).send(error);
            return;
          }
          if (nfts.length == 0) {
            Auction.findOne(
              {
                network: chainId,
                platform: { $regex: `^${platform}$`, $options: "i" },
                token: id,
              },
              function (error, auction) {
                if (error) {
                  response.status(500).send(error);
                  return;
                }
                response.json(auction);
              }
            );
          } else {
            response.json(nfts[0]);
          }
        }
      );
    }
  });

const fetchNFTScan = async (address, chainId) => {
  console.log(
    "nftscan chainid: ",
    chainId,
    address.toLowerCase(),
    `${NFTSCAN[chainId]}/account/own/all/${address}?erc_type=&show_attribute=false&sort_field=&sort_direction=`
  );
  const response = await axios.get(
    `${NFTSCAN[chainId]}/account/own/all/${address}?erc_type=&show_attribute=false&sort_field=&sort_direction=`,
    {
      headers: {
        "X-API-KEY": process.env.NFTSCAN_KEY,
      },
    }
  );
  if (response.status === 200) {
    const assets_res = response.data.data.flatMap(
      (contract) => contract.assets
    );
    const assets = assets_res.map((asset) => ({
      amount: asset.amount || "1",
      description: asset.description || "",
      image: asset.image_uri || "",
      isERC721: asset.erc_type === "erc721",
      metadataUrl: asset.token_uri || "",
      name: asset.name || "",
      network: chainId,
      owner: asset.owner || "",
      platform: asset.contract_address || "",
      token: asset.token_id || "",
    }));

    return (
      assets.filter(
        (asset) =>
          asset.owner?.toLowerCase() === address.toLowerCase() &&
          asset.name &&
          asset.description &&
          asset.metadataUrl &&
          asset.image
      ) || []
    );
  }
  return [];
};

module.exports = auctionRouter;
