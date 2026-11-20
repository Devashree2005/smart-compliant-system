require("dotenv").config();
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");

const app = express();
const port = Number(process.env.PORT || 3000);
const client = new MongoClient(process.env.MONGODB_URI || "");
let reqDb;
app.use(express.json({ limit: "32kb" }));
app.use(express.static(__dirname));
app.use((req,res,next)=>{req.db=reqDb;next()});

function adminOnly(req, res, next) {
  if (!process.env.ADMIN_KEY) return res.status(503).json({ error: "ADMIN_KEY is not configured on the server." });
  if (req.get("X-Admin-Key") !== process.env.ADMIN_KEY) return res.status(401).json({ error: "Invalid admin key." });
  next();
}
const validText = (x, max) => typeof x === "string" && x.trim().length > 0 && x.length <= max;

app.get("/api/complaints", async (req, res, next) => {
  try {
    const suppliedKey=req.get("X-Admin-Key");
    const admin = process.env.ADMIN_KEY && suppliedKey === process.env.ADMIN_KEY;
    if(suppliedKey&&!admin)return res.status(401).json({error:"Invalid admin key."});
    if (!admin && !validText(req.query.uid, 100)) return res.status(400).json({ error: "A student ID is required." });
    const query = admin ? {} : { uid: req.query.uid };
    const rows = await req.db.collection("complaints").find(query).sort({ createdAt: -1 }).toArray();
    res.json(rows.map(({ _id, ...row }) => ({ ...row, id: String(_id) })));
  } catch (e) { next(e); }
});

app.post("/api/complaints", async (req, res, next) => {
  try {
    const b = req.body;
    for (const [key, max] of [["uid",100],["name",120],["roll",50],["category",80],["priority",20],["title",80],["description",5000]]) {
      if (!validText(b[key], max)) return res.status(400).json({ error: `Invalid ${key}.` });
    }
    const doc = { uid:b.uid, name:b.name.trim(), roll:b.roll.trim(), category:b.category.trim(), priority:b.priority.trim(), location:typeof b.location==="string"?b.location.trim().slice(0,200):"", title:b.title.trim(), description:b.description.trim(), status:"Pending", remark:"", ticket:String(Date.now()).slice(-6), createdAt:Date.now(), completedAt:null };
    const result = await req.db.collection("complaints").insertOne(doc);
    res.status(201).json({ id:String(result.insertedId), ticket:doc.ticket });
  } catch (e) { next(e); }
});

app.patch("/api/complaints/:id", adminOnly, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error:"Invalid complaint ID." });
    const { status, remark } = req.body;
    if (!["Pending","In Progress","Completed"].includes(status) || typeof remark!=="string" || remark.length>1000) return res.status(400).json({ error:"Invalid status or remark." });
    const collection=req.db.collection("complaints"), id=new ObjectId(req.params.id);
    const old=await collection.findOne({ _id:id });if(!old)return res.status(404).json({error:"Complaint not found."});
    const completedAt=status==="Completed"?(old.status==="Completed"?old.completedAt:Date.now()):null;
    await collection.updateOne({ _id:id },{ $set:{status,remark:remark.trim(),updatedAt:Date.now(),completedAt} });
    res.json({ ok:true });
  } catch(e){next(e)}
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error. Check the server logs." });
});

async function start(){
  if(!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI in .env before starting the app.");
  if(!process.env.ADMIN_KEY) throw new Error("Set ADMIN_KEY in .env before starting the app.");
  await client.connect();reqDb=client.db(process.env.MONGODB_DB || "campus_complaints");
  app.listen(port,()=>console.log(`Campus complaints running at http://localhost:${port}`));
}
start().catch(e=>{console.error(e.message);process.exit(1)});
