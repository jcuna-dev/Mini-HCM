const express = require('express');
const router = express.Router();
const { db, auth } = require('../config/firebase');

// Register a new user
router.post('/register', async (req, res) => {
  const { email, password, name, role = 'employee', timezone = 'UTC', schedule } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }
  
  // Default schedule: 9 AM to 6 PM
  const userSchedule = schedule || { start: '09:00', end: '18:00' };
  
  try {
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });
    
    // Store user details in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      name,
      email,
      role,
      timezone,
      schedule: userSchedule,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    res.status(201).json({
      message: 'User registered successfully',
      uid: userRecord.uid,
      user: {
        name,
        email,
        role,
        timezone,
        schedule: userSchedule,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

// Get user profile
router.get('/profile/:uid', async (req, res) => {
  const { uid } = req.params;
  
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ uid, ...userDoc.data() });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile/:uid', async (req, res) => {
  const { uid } = req.params;
  const { name, timezone, schedule } = req.body;
  
  try {
    const updates = {
      updatedAt: new Date().toISOString(),
    };
    
    if (name) updates.name = name;
    if (timezone) updates.timezone = timezone;
    if (schedule) updates.schedule = schedule;
    
    await db.collection('users').doc(uid).update(updates);
    
    const updatedDoc = await db.collection('users').doc(uid).get();
    res.json({ uid, ...updatedDoc.data() });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
