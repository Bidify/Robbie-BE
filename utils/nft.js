const Web3 = require("web3");
const axios = require("axios");
const { exec } = require("child_process");
const path = require("path");

const {
  getLogUrl,
  URLS,
  ERC721,
  ERC1155,
  NetworkId,
  NFTSCAN,
  NetworkName,
} = require("./config");

const getNFTs = async (owner, chainId) => {
  // console.log(chainId)
  // console.log("before testing", new ethers.providers.Web3Provider(URLS[chainId]))
  const from = owner;
  const web3 = new Web3(new Web3.providers.HttpProvider(URLS[chainId]));
  const topic = "0x" + from.split("0x")[1].padStart(64, "0");
  let logs = [];
  let logs_1155 = [];
  if (
    chainId === 43114 ||
    chainId === 137 ||
    chainId === 56 ||
    chainId === 9001 ||
    chainId === 1285 ||
    chainId === 100
  ) {
    const ret = await axios
      .get(
        `${getLogUrl[chainId]}&fromBlock=0&${
          chainId === 9001 || chainId === 100 || chainId === 61
            ? "toBlock=latest&"
            : ""
        }topic0=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef&topic0_2_opr=and&topic2=${
          chainId === 9001 || chainId === 100 ? topic.toLowerCase() : topic
        }&apikey=${snowApi[chainId]}`
      )
      .catch((e) => console.log("getNft error"));
    // return console.log("return value", ret)
    logs = ret.data.result;
  }

  // Get all transfers to us
  // return console.log(web3.eth)
  else
    logs = await web3.eth
      .getPastLogs({
        fromBlock: 0,
        toBlock: "latest",
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          // "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62",
          // null,
          null,
          "0x" + from.split("0x")[1].padStart(64, "0"),
        ],
      })
      .catch((e) => {
        console.log("error on getpastlogs", e.message);
      });
  // Filter to just tokens which are still in our custody
  const res = [];
  const ids = {};
  console.log(logs);
  for (let log of logs) {
    // console.log(log)
    if (log.topics[3] !== undefined) {
      let platform = log.address;
      let token = log.topics[3];
      let owner = await new web3.eth.Contract(ERC721.abi, platform).methods
        .ownerOf(token)
        .call();
      if (owner.toLowerCase() !== from.toLowerCase()) {
        continue;
      }

      let jointID = platform + token;

      if (ids[jointID]) {
        continue;
      }
      token = parseInt(token, 16).toString();
      ids[jointID] = true;
      res.push({ platform, token });
    } else {
      continue;
    }
  }
  if (
    chainId === 43114 ||
    chainId === 137 ||
    chainId === 56 ||
    chainId === 9001 ||
    chainId === 1285 ||
    chainId === 100
  ) {
    const ret = await axios.get(
      `${getLogUrl[chainId]}&fromBlock=0&${
        chainId === 9001 || chainId === 100 || chainId === 61
          ? "toBlock=latest&"
          : ""
      }topic0=0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62&topic0_3_opr=and&topic3=${
        chainId === 9001 || chainId === 100 ? topic.toLowerCase() : topic
      }&apikey=${snowApi[chainId]}`
    );
    logs_1155 = ret.data.result;
  } else
    logs_1155 = await web3.eth.getPastLogs({
      fromBlock: 0,
      toBlock: "latest",
      topics: [
        // "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62",
        null,
        null,
        "0x" + from.split("0x")[1].padStart(64, "0"),
      ],
    });
  // console.log("1155 result", logs_1155)
  for (let log of logs_1155) {
    if (log.topics[3] !== undefined) {
      let platform = log.address;
      const decodeData = web3.eth.abi.decodeParameters(
        ["uint256", "uint256"],
        log.data
      );
      let token = web3.utils.toHex(decodeData[0]);
      let owner = await new web3.eth.Contract(ERC1155.abi, platform).methods
        .balanceOf(from, decodeData[0])
        .call();
      // console.log("owners", owner, platform)
      if (owner < 1) continue;
      // if (owner.toLowerCase() !== from.toLowerCase()) {
      //   continue;
      // }

      let jointID = platform + token;

      if (ids[jointID]) {
        continue;
      }
      token = token.toString();
      ids[jointID] = true;
      res.push({ platform, token });
    } else {
      continue;
    }
  }
  // console.log(res)
  return res;
};

const getERC721Uri = async (contractAddress, token, chainId) => {
  const web3 = new Web3(new Web3.providers.HttpProvider(URLS[chainId]));
  const tokenUri = await new web3.eth.Contract(
    ERC721.abi,
    contractAddress
  ).methods
    .tokenURI(token)
    .call();
  return tokenUri;
};

const getERC1155Uri = async (contractAddress, token, chainId) => {
  const web3 = new Web3(new Web3.providers.HttpProvider(URLS[chainId]));
  const tokenUri = await new web3.eth.Contract(
    ERC1155.abi,
    contractAddress
  ).methods
    .uri(token)
    .call();
  return tokenUri;
};

const getNftDetail = async (platform, token, chainId, isERC721 = true) => {
  if (chainId !== NetworkId.INK) {
    const response = await axios.get(
      `${NFTSCAN[chainId]}/assets/${platform}/${token}?show_attribute=false`,
      {
        headers: {
          "X-API-KEY": process.env.NFTSCAN_KEY,
        },
      }
    );
    if (response.status === 200) {
      const asset = response.data.data;
      if (asset)
        return {
          amount: asset.amount,
          description: asset.description,
          image: asset.image_uri,
          isERC721: asset.erc_type === "erc721",
          metadataUrl: asset.token_uri,
          name: asset.name,
          network: chainId,
          owner: asset.owner,
          platform: asset.contract_address,
          token: Number(asset.token_id).toString(),
        };
    }
    return { name: "", image: "", description: "", metadataUrl: "" };
  } else {
    let url = "";
    if (isERC721) {
      url = await getERC721Uri(platform, token, chainId);
    } else {
      url = await getERC1155Uri(platform, token, chainId);
    }

    if (url && url.includes("ipfs://"))
      url = url.replace("ipfs://", "https://ipfs.io/ipfs/");
    if (url && url.includes("{id}")) url = url.replace("{id}", data.token_id);
    try {
      const metadata = await axios.get(url);

      const { name, image, description } = metadata.data;
      return { name, image, description, url };
    } catch (e) {
      return { name: "", image: "", description: "", metadataUrl: url };
    }
  }
};

const atomic = (value, decimals) => {
  let quantity = decimals;
  if (value.indexOf(".") !== -1) {
    quantity -= value.length - value.indexOf(".") - 1;
  }
  let atomicized = value.replace(".", "");
  for (let i = 0; i < quantity; i++) {
    atomicized += "0";
  }
  while (atomicized[0] === "0") {
    atomicized = atomicized.substr(1);
  }
  return Web3.utils.toBN(atomicized);
};

// Convert to a human readable value
const unatomic = (value, decimals) => {
  value = value.padStart(decimals + 1, "0");
  let temp =
    value.substr(0, value.length - decimals) +
    "." +
    value.substr(value.length - decimals);
  while (temp[0] === "0") {
    temp = temp.substr(1);
  }
  while (temp.endsWith("0")) {
    temp = temp.slice(0, -1);
  }
  if (temp.endsWith(".")) {
    temp = temp.slice(0, -1);
  }
  if (temp.startsWith(".")) {
    temp = "0" + temp;
  }

  if (temp == "") {
    return "0";
  }
  return temp;
};

const verifyContract = (network, platform) => {
  return new Promise((resolve, reject) => {
    if (network === NetworkId.INK) resolve(false);
    const directory = path.join(__dirname, "../../bidify-mint-smart-contract/"); // Target directory
    const command = `npx hardhat verify ${platform} --network ${NetworkName[network]}`; // Replace with your command (e.g., ls, npm install, etc.)

    exec(command, { cwd: directory }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error.message}`);
        reject(error);
      }

      if (stderr) {
        console.error(`Error output: ${stderr}`);
        reject(stderr);
      }

      console.log(`Command output:\n${stdout}`);
      resolve(true);
    });
  });
};

module.exports = {
  getNFTs,
  getERC721Uri,
  getNftDetail,
  getERC1155Uri,
  atomic,
  unatomic,
  verifyContract,
};
