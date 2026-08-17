import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import env from "dotenv";
import { error } from "node:console";
import http from "http";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

env.config();

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let wsClients = [];

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
});

db.on("connect", (client) => {
  client.query("SET search_path TO public");
});

db.query(
  `
  SELECT
    current_database(),
    current_user,
    current_schema(),
    current_setting('search_path')
`,
)
  .then((result) => console.log("Database connection:", result.rows[0]))
  .catch(console.error);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.json());
const __dirname = dirname(fileURLToPath(import.meta.url));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, //max 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Ivalid file type"));
    } else {
      cb(null, true);
    }
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUDNAIRY_NAME,
  api_key: process.env.CLOUDNAIRY_API_KEY,
  api_secret: process.env.CLOUDNAIRY_API_SECRET,
});

app.get("/", async (req, res) => {
  res.sendFile(`${__dirname}/public/index.html`);
});

wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "identify") {
        wsClients.push({ userId: data.userId, ws });
        console.log(`User ${data.userId} connected`);
        ws.userId = data.userId;
        // ws.send(
        //   JSON.stringify({
        //     type: "welcome",
        //     message: `Welcome user ${ws.userId}`,
        //   }),
        // );

        wsClients.forEach((client) => {
          client.ws.send(
            JSON.stringify({
              type: "statusUpdate",
              userId: client.userId,
            }),
          );
        });

        console.log(`Current connected clients:${wsClients.length}`);
      } else if (data.cmt) {
        console.log(
          `Received comment from user ${ws.userId}: ${data.cmt} to user ${data.Receiver}`,
        );

        let result = await db.query(
          "insert into  messages (sender_id, reciver_id, content) values ($1, $2, $3) returning *",
          [ws.userId, data.Receiver, data.cmt],
        );

        let msgData = result.rows[0];

        wsClients.forEach((client) => {
          if (
            Number(client.userId) === msgData.reciver_id ||
            Number(client.userId) === msgData.sender_id
          ) {
            client.ws.send(
              JSON.stringify({
                type: "chatMessage",
                messageId: msgData.id,
                senderId: msgData.sender_id,
                msg: msgData.content,
              }),
            );
          }
        });
      }
    } catch (err) {
      console.error("Error parsing message:", err.message);
    }
  });

  ws.on("close", () => {
    const index = wsClients.findIndex((client) => client.ws === ws);

    if (index !== -1) {
      const disconnectedClient = wsClients[index]; // get client first
      console.log("================================");
      wsClients.splice(index, 1);
      console.log("Disconnected userId:", disconnectedClient.userId);
    }
    wsClients.forEach((client) => {
      client.ws.send(
        JSON.stringify({
          type: "statusUpdate",
          userId: client.userId,
        }),
      );
    });
  });
});

///////////////////////////////////////////////////////////////

app.get("/log", async (req, res) => {
  try {
    let result = await db.query("SELECT * from public.users ORDER BY id ASC");

    let posts = result.rows;

    res.status(200).json({ posts });
    console.log("dsfgsd>?");
  } catch (er) {
    console.log(er);
  }
});

app.post("/verify", async (req, res) => {
  try {
    const { email } = req.body;
    let result = await db.query("SELECT * from users ORDER BY id ASC");

    const user = result.rows.find((post) => post.email === email);

    if (user) {
      return res.json({ access: true, userId: user.id });
    }

    return res.json({ access: false });
  } catch (er) {
    console.log(er);
  }
});

app.get("/status", async (req, res) => {
  try {
    let status = [];
    let result = await db.query("SELECT * from users ORDER BY id ASC");
    let posts = result.rows;
    // console.log(wsClients);
    console.log(posts[0]);
    posts.forEach((post) => {
      const exists = wsClients.some(
        (client) => Number(client.userId) === Number(post.id),
      );

      let availability;

      exists ? (availability = "Online") : (availability = "Offline");

      console.log(`user ${post.id}: ${availability}`);
      console.log(post.profile_pic_url);
      status.push({
        userId: post.id,
        first_name: post.first_name,
        last_name: post.last_name,
        email: post.email,
        url: post.profile_pic_url,
        status: availability,
      });
    });

    res.status(200).json({ data: status });
  } catch (er) {
    console.log(er);
  }
});

app.post("/chat", async (req, res) => {
  const user1 = req.body.senderId;
  const user2 = req.body.receiverId;

  const result = await db.query(
    `SELECT *
FROM messages
WHERE
    (sender_id = $1 AND reciver_id = $2)
    OR
    (sender_id = $2 AND reciver_id = $1)
ORDER BY created_at ASC, id ASC
LIMIT 50;`,
    [user1, user2],
  );

  res.json(result.rows);
});

app.post("/reset-unread", async (req, res) => {
  const receiverId = req.body.userId;
  const senderId = req.body.receiverId;
  try {
    await db.query(
      `UPDATE messages
       SET read_at = NOW()
       WHERE reciver_id = $1
       AND sender_id = $2
       AND read_at IS NULL`,
      [receiverId, senderId],
    );
    res.status(200).json({ message: "successfully" });
  } catch (error) {
    console.error("Error resetting unread count:", error);
    res.status(500).json({ message: "Error resetting unread count" });
  }
});

app.post("/unread-count", async (req, res) => {
  const userId = req.body.userId;
  try {
    const result = await db.query(
      `SELECT
  sender_id,
  COUNT(*) AS unread_count
FROM messages
WHERE reciver_id = $1
  AND read_at IS NULL
GROUP BY sender_id
ORDER BY sender_id;`,
      [userId],
    );
    console.log("Unread count result:", result.rows);
    res.json({ data: result.rows });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ message: "Error fetching unread count" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});

app.post("/image", upload.single("file"), async (req, res) => {
  let url;
  let public_id;
  const id = req.body.id;
  console.log(id);

  // const stream = cloudinary.uploader.upload_stream(
  //   { folder: "test" },
  //   (error, result) => {
  //     try {
  //       if (error) throw error;
  //       res.json({ message: "upload sucess" });
  //       url=result.secure_url;
  //     } catch (err) {
  //       console.log(err);
  //       return res.status(500).json({ error: err.message });
  //     }
  //   }
  // );

  // stream.end(req.file.buffer);

  try {
    if (!req.file) throw new Error("No file uploaded");

    function cloudnairyUpload(buffer) {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "test" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        );

        stream.end(buffer);
      });
    }
    const result = await cloudnairyUpload(req.file.buffer);
    res.json({ message: "upload sucess" });

    url = result.secure_url;
    public_id = result.public_id;

    console.log(url, public_id);

    await db.query(
      `UPDATE users
SET profile_pic_url = $1
WHERE id = $2; `,
      [url, id],
    );

    console.log("Done");
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/Profile", async (req, res) => {
  console.log("here");
  let id = req.body.id;
  console.log(id);
  try {
    let status = [];
    let result = await db.query(
      "SELECT * from users WHERE id= $1 ORDER BY id ASC",
      [id],
    );
    let post = result.rows[0];
    // console.log(wsClients);
    console.log(post);

    status.push({
      userId: post.id,
      first_name: post.first_name,
      last_name: post.last_name,
      email: post.email,
      url: post.profile_pic_url,
    });

    res.status(200).json({ data: status });
  } catch (er) {
    console.log(er);
  }
});
