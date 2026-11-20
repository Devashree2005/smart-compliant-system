const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tech';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'campus-complaints' directory and root
app.use(express.static(path.join(__dirname, 'campus-complaints')));
app.use(express.static(__dirname));

// MongoDB Complaint Schema
const complaintSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  uid: { type: String, required: true },
  name: { type: String, required: true },
  roll: { type: String, required: true },
  category: { type: String, required: true },
  priority: { type: String, default: 'Medium' },
  location: { type: String, default: '' },
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'In Progress', 'Completed'], 
    default: 'Pending' 
  },
  remark: { type: String, default: '' },
  ticket: { type: String, required: true },
  createdAt: { type: Number, default: () => Date.now() },
  completedAt: { type: Number, default: null },
  updatedAt: { type: Number, default: null }
}, {
  versionKey: false
});

const Complaint = mongoose.model('Complaint', complaintSchema);

// Database Health Check
app.get('/api/status', (req, res) => {
  const state = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    status: state === 1 ? 'ok' : 'degraded',
    database: 'tech',
    uri: MONGODB_URI,
    connectionState: states[state] || 'unknown'
  });
});

// API Routes
// 1. Get all complaints
app.get('/api/complaints', async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ error: 'Failed to fetch complaints', details: error.message });
  }
});

// 2. Submit a new complaint
app.post('/api/complaints', async (req, res) => {
  try {
    const {
      id,
      uid,
      name,
      roll,
      category,
      priority,
      location,
      title,
      description,
      status,
      remark,
      ticket,
      createdAt,
      completedAt
    } = req.body;

    if (!name || !roll || !title || !description) {
      return res.status(400).json({ error: 'Name, Roll ID, title, and description are required.' });
    }

    const complaintId = id || ('c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
    const ticketNum = ticket || String(Date.now()).slice(-6);

    const newComplaint = new Complaint({
      id: complaintId,
      uid: uid || 'anonymous',
      name,
      roll,
      category: category || 'Other',
      priority: priority || 'Medium',
      location: location || '',
      title,
      description,
      status: status || 'Pending',
      remark: remark || '',
      ticket: ticketNum,
      createdAt: createdAt || Date.now(),
      completedAt: completedAt || null,
      updatedAt: null
    });

    const saved = await newComplaint.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(500).json({ error: 'Failed to create complaint', details: error.message });
  }
});

// 3. Update complaint status / remark
app.patch('/api/complaints/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remark, completedAt, updatedAt } = req.body;

    const existing = await Complaint.findOne({ $or: [{ id }, { _id: mongoose.isValidObjectId(id) ? id : null }] });
    if (!existing) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    if (status !== undefined) {
      existing.status = status;
      if (status === 'Completed' && !existing.completedAt) {
        existing.completedAt = completedAt || Date.now();
      } else if (status !== 'Completed') {
        existing.completedAt = null;
      }
    }

    if (remark !== undefined) {
      existing.remark = remark;
    }

    existing.updatedAt = updatedAt || Date.now();

    const updated = await existing.save();
    res.json(updated);
  } catch (error) {
    console.error('Error updating complaint:', error);
    res.status(500).json({ error: 'Failed to update complaint', details: error.message });
  }
});

// 4. Delete a complaint
app.delete('/api/complaints/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Complaint.findOneAndDelete({ $or: [{ id }, { _id: mongoose.isValidObjectId(id) ? id : null }] });
    if (!result) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }
    res.json({ message: 'Complaint deleted successfully', id });
  } catch (error) {
    console.error('Error deleting complaint:', error);
    res.status(500).json({ error: 'Failed to delete complaint', details: error.message });
  }
});

// Fallback: serve index.html for root
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'campus-complaints', 'index.html'));
});

// Connect to MongoDB and start Express server
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log(`Connected to MongoDB successfully: ${MONGODB_URI}`);
    app.listen(PORT, () => {
      console.log(`Smart Campus Complaints server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(`MongoDB connection error to ${MONGODB_URI}:`, err.message);
    process.exit(1);
  });
