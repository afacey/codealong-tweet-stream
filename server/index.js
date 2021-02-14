const http = require("http");
const path = require("path");
const express = require("express");
const socketIo = require("socket.io");
const needle = require("needle");
const config = require("dotenv").config();
const TOKEN = process.env.TWITTER_BEARER_TOKEN;
const PORT = process.env.PORT || 3000;

const app = express();

const server = http.createServer(app);
const io = socketIo(server);

app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../", "client", "index.html"));
});

const baseUrl = "https://api.twitter.com";
const rulesURL = baseUrl + "/2/tweets/search/stream/rules";
const streamURL =
  baseUrl +
  "/2/tweets/search/stream?tweet.fields=public_metrics&expansions=author_id";

const rules = [{ value: "coding" }];

// Get stream rules
async function getRules() {
  const response = await needle("get", rulesURL, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  return response.body;
}

// Set stream rules
async function setRules() {
  const data = {
    add: rules,
  };
  const response = await needle("post", rulesURL, data, {
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  return response.body;
}

// Delete stream rules
async function deleteRules(rules) {
  if (!Array.isArray(rules.data)) {
    return null;
  }

  const ids = rules.data.map((rule) => rule.id);

  const data = {
    delete: {
      ids,
    },
  };
  const response = await needle("post", rulesURL, data, {
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  return response.body;
}

function streamTweets(socket) {
  const stream = needle.get(streamURL, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  stream.on("data", (data) => {
    try {
      const json = JSON.parse(data);
      socket.emit("tweet", json);
    } catch (error) {}
  });
}

io.on("connection", async () => {
  console.log("Client connected...");
  let currentRules;

  try {
    // get all stream rules
    currentRules = await getRules();

    // delete all stream rules
    await deleteRules(currentRules);

    // set stream rules based off rules away above
    await setRules();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  streamTweets(io);
});

server.listen(PORT, () => {
  console.log("Server started on port", PORT);
});
