const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');
const { punchLimiter } = require('../middleware/rateLimiter');
const { calculateWorkMetrics } = require('../services/hoursCalculation');

// Punch In
router.post('/punch-in', punchLimiter, verifyToken, async (req, res) => {
  const { uid } = req.user;
  const timestamp = new Date().toISOString();
  const dateKey = timestamp.split('T')[0]; // YYYY-MM-DD
  
  try {
    // Check if user has an open punch (punched in but not out)
    const openPunchQuery = await db.collection('attendance')
      .where('userId', '==', uid)
      .where('punchOut', '==', null)
      .limit(1)
      .get();
    
    if (!openPunchQuery.empty) {
      return res.status(400).json({ error: 'Already punched in. Please punch out first.' });
    }
    
    // Create new punch record
    const punchRef = await db.collection('attendance').add({
      userId: uid,
      punchIn: timestamp,
      punchOut: null,
      date: dateKey,
      status: 'active',
      createdAt: timestamp,
    });
    
    res.status(201).json({
      message: 'Punch in recorded',
      punchId: punchRef.id,
      punchIn: timestamp,
    });
  } catch (error) {
    console.error('Punch in error:', error);
    res.status(500).json({ error: 'Failed to record punch in' });
  }
});

// Punch Out
router.post('/punch-out', punchLimiter, verifyToken, async (req, res) => {
  const { uid } = req.user;
  const timestamp = new Date().toISOString();
  
  try {
    // Find open punch
    const openPunchQuery = await db.collection('attendance')
      .where('userId', '==', uid)
      .where('punchOut', '==', null)
      .limit(1)
      .get();
    
    if (openPunchQuery.empty) {
      return res.status(400).json({ error: 'No active punch found. Please punch in first.' });
    }
    
    const punchDoc = openPunchQuery.docs[0];
    const punchData = punchDoc.data();
    
    // Get user schedule for calculation
    const userDoc = await db.collection('users').doc(uid).get();
    const schedule = userDoc.exists ? userDoc.data().schedule : { start: '09:00', end: '18:00' };
    
    // Calculate work metrics
    const metrics = calculateWorkMetrics(punchData.punchIn, timestamp, schedule);
    
    // Update punch record
    await db.collection('attendance').doc(punchDoc.id).update({
      punchOut: timestamp,
      status: 'completed',
      metrics,
      updatedAt: timestamp,
    });
    
    // Update or create daily summary
    const dateKey = punchData.date;
    await updateDailySummary(uid, dateKey);
    
    res.json({
      message: 'Punch out recorded',
      punchId: punchDoc.id,
      punchIn: punchData.punchIn,
      punchOut: timestamp,
      metrics,
    });
  } catch (error) {
    console.error('Punch out error:', error);
    res.status(500).json({ error: 'Failed to record punch out' });
  }
});

// Get current punch status
router.get('/status', verifyToken, async (req, res) => {
  const { uid } = req.user;
  
  try {
    const openPunchQuery = await db.collection('attendance')
      .where('userId', '==', uid)
      .where('punchOut', '==', null)
      .limit(1)
      .get();
    
    if (openPunchQuery.empty) {
      res.json({ isPunchedIn: false, currentPunch: null });
    } else {
      const punchData = openPunchQuery.docs[0].data();
      res.json({
        isPunchedIn: true,
        currentPunch: {
          punchId: openPunchQuery.docs[0].id,
          punchIn: punchData.punchIn,
        },
      });
    }
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check punch status' });
  }
});

// Get attendance history
router.get('/history', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { startDate, endDate, limit = 10 } = req.query;
  
  try {
    // Query by userId only, then filter/sort in memory
    // This avoids requiring a composite index in Firestore
    let query = db.collection('attendance')
      .where('userId', '==', uid);
    
    const snapshot = await query.get();
    
    // Filter and sort in memory
    let records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Apply date filters if provided
    if (startDate) {
      records = records.filter(r => r.date >= startDate);
    }
    if (endDate) {
      records = records.filter(r => r.date <= endDate);
    }
    
    // Sort by punchIn descending
    records.sort((a, b) => new Date(b.punchIn) - new Date(a.punchIn));
    
    // Apply limit
    records = records.slice(0, parseInt(limit));
    
    res.json({ records });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
});

// Helper function to update daily summary
const updateDailySummary = async (userId, date) => {
  const { aggregateDailyMetrics } = require('../services/hoursCalculation');
  
  try {
    // Get all completed punches for the day
    const punchesQuery = await db.collection('attendance')
      .where('userId', '==', userId)
      .where('date', '==', date)
      .where('status', '==', 'completed')
      .get();
    
    const punches = punchesQuery.docs.map(doc => doc.data().metrics);
    const aggregated = aggregateDailyMetrics(punches);
    
    // Update or create daily summary
    const summaryId = `${userId}_${date}`;
    await db.collection('dailySummary').doc(summaryId).set({
      userId,
      date,
      ...aggregated,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    
    return aggregated;
  } catch (error) {
    console.error('Daily summary update error:', error);
    throw error;
  }
};

module.exports = router;
