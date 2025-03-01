const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;

// Create an instance of MongoClient
const client = new MongoClient(process.env.DB_URL);
// Create a new DB named urlshortener
const db = client.db("exercisetracker");
// Create a new collection (table) named users
const users = db.collection("users");
const exercises = db.collection("exercises");

async function deleteDocs(params) {
  const deletedUsers = await users.deleteMany({});
  const deletedExercises = await exercises.deleteMany({});
  console.log("Deleted " + deletedUsers.deletedCount + " documents from users");
  console.log(
    "Deleted " + deletedExercises.deletedCount + " documents from exercises"
  );
}

//deleteDocs();

app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// middleware that run for every request (globally mounted) and parse URL-encoded (HTML forms) payload into req.body
app.use(express.urlencoded({ extended: true }));

app.get("/api/users", async (req, res) => {
  const usersAll = users.find({});

  // Print a message if no documents were found
  const nofDocs = await users.countDocuments({});

  if (nofDocs === 0) {
    console.log("No users found!");
  }

  const usersArray = [];

  // Print returned documents
  for await (const doc of usersAll) {
    usersArray.push({
      _id: doc._id,
      username: doc.username,
    });
  }

  res.json(usersArray);
});

// Handle POST requests at /api/users to insert form data into db
app.post("/api/users", async (req, res) => {
  // Insert one document (row) into the DB (exercisetracker) - into the users collection (table)
  const username = req.body.username;
  const usernameDB = { username };
  const result = await users.insertOne(usernameDB);
  const userID = result.insertedId.toString();

  console.log("Insert user...", userID);

  res.json({ username: username, _id: userID });
});

// Handle POST requests from exercise form
app.post("/api/users/:_id/exercises", async (req, res) => {
  // Look for user in db using _id
  try {
    const qUsername = await users.findOne({
      _id: new ObjectId(req.params._id),
    });

    console.log("Insert exercise:");
    console.log(req.params._id);
    console.log(req.body);

    // Check if there is a date input, otherwise use current date
    let dateEntry;
    if(req.body.date) {
      dateEntry = new Date(req.body.date);
      console.log("Date found", dateEntry);
    } else {
      dateEntry = new Date();
      console.log("Date not found, creating...", dateEntry);
    }

    const newEntry = {
      user_id: qUsername._id,
      username: qUsername.username,
      description: req.body.description,
      duration: parseInt(req.body.duration),
      date: dateEntry
    };

    const wResult = await exercises.insertOne(newEntry);
    console.log("Inserted a document into exercises:", wResult);

    res.json({
      _id: req.params._id,
      username: qUsername.username,
      description: req.body.description,
      duration: parseInt(req.body.duration),
      date: new Date(req.body.date).toDateString(),
    });
  } catch (err) {
    console.log(`Cannot find a user with id ${req.params._id}`);
    console.log("Error...", err);
    res.json({ error: `Cannot find a user with id ${req.params._id}` });
  }
});

// Handle GET requests at /api/users/:_id/logs?[from][&to][&limit]
app.get("/api/users/:_id/logs", async (req, res) => {
  try {
    // Look for user in db using _id
    const userResult = await users.findOne({
      _id: new ObjectId(req.params._id),
    });

    let query = {};

    console.log(
      "Found parameters:",
      req.query.from,
      req.query.to,
      req.query.limit
    );

    if (req.query.from !== undefined) {
      const dateStart = new Date(req.query.from);
      const dateEnd = new Date(req.query.to);
      // Query for exercises having user_id = _id ranging from dateStart to dateEnd
      query = {
        user_id: new ObjectId(req.params._id),
        date: { $gte: dateStart, $lte: dateEnd },
      };
    } else {
      // Query for exercises having user_id = _id
      query = { user_id: new ObjectId(req.params._id) };
    }

    // Execute query
    const exerciseResult = exercises.find(query).limit(parseInt(req.query.limit) || 0);

    // Print a message if no documents were found
    const nofDocs = await exercises.countDocuments(query);
    if (nofDocs === 0) {
      console.log("No documents found!");
    }

    // Limit the count number if the limit is less than total number of docs
    let count = 0;
    if (nofDocs > parseInt(req.query.limit)) {
      count = req.query.limit;
    } else {
      count = nofDocs;
    }

    // Print returned documents
    const logs = [];
    for await (const doc of exerciseResult) {
      logs.push({
        description: doc.description,
        duration: doc.duration,
        date: new Date(doc.date).toDateString(),
      });
    }

    res.json({
      _id: req.params._id,
      username: userResult.username,
      count: count,
      log: logs,
    });
  } catch (err) {
    console.log(err);
    res.json({ error: "There was an error", errorBody: err });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

// http://localhost:3000/api/users/67bf6f218edbec837aa9a885/logs?from=2025-01-01&to=2025-12-31&limit=5
// {"username":"cioana","_id":"67c0c121a0c88448e5b4da43"}
// 2024-08-18
// 2024-10-10
// 2025-02-10
// 2025-04-13
// 2025-10-05
// 2026-03-16
// 2025-12-25
