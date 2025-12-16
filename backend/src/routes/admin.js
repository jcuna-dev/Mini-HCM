const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { calculateWorkMetrics, aggregateDailyMetrics } = require('../services/hoursCalculation');

// Get all employees (admin only)
router.get('/employees', verifyToken, requireAdmin, async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const employees = usersSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));
    res.json({ employees });
  } catch (error) {
    console.error('Fetch employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get all punches for a specific date (admin only)
router.get('/punches', verifyToken, requireAdmin, async (req, res) => {
  const { date, userId } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  try {
    let query = db.collection('attendance')
      .where('date', '==', targetDate);
    
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    const snapshot = await query.get();
    const punches = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Enrich with user data
    const userIds = [...new Set(punches.map(p => p.userId))];
    const userDocs = await Promise.all(
      userIds.map(id => db.collection('users').doc(id).get())
    );
    const userMap = {};
    userDocs.forEach(doc => {
      if (doc.exists) {
        userMap[doc.id] = doc.data();
      }
    });
    
    const enrichedPunches = punches.map(punch => ({
      ...punch,
      userName: userMap[punch.userId]?.name || 'Unknown',
      userEmail: userMap[punch.userId]?.email || 'Unknown',
    }));
    
    res.json({ punches: enrichedPunches });
  } catch (error) {
    console.error('Fetch punches error:', error);
    res.status(500).json({ error: 'Failed to fetch punches' });
  }
});

// Edit a punch record (admin only)
router.put('/punches/:punchId', verifyToken, requireAdmin, async (req, res) => {
  const { punchId } = req.params;
  const { punchIn, punchOut } = req.body;
  
  try {
    const punchRef = db.collection('attendance').doc(punchId);
    const punchDoc = await punchRef.get();
    
    if (!punchDoc.exists) {
      return res.status(404).json({ error: 'Punch record not found' });
    }
    
    const punchData = punchDoc.data();
    const updates = {
      updatedAt: new Date().toISOString(),
      editedByAdmin: true,
    };
    
    if (punchIn) updates.punchIn = punchIn;
    if (punchOut) updates.punchOut = punchOut;
    
    // Recalculate metrics if both times are available
    const newPunchIn = punchIn || punchData.punchIn;
    const newPunchOut = punchOut || punchData.punchOut;
    
    if (newPunchIn && newPunchOut) {
      // Get user schedule
      const userDoc = await db.collection('users').doc(punchData.userId).get();
      const schedule = userDoc.exists ? userDoc.data().schedule : { start: '09:00', end: '18:00' };
      
      updates.metrics = calculateWorkMetrics(newPunchIn, newPunchOut, schedule);
      updates.status = 'completed';
    }
    
    await punchRef.update(updates);
    
    // Update daily summary
    if (newPunchIn && newPunchOut) {
      await updateDailySummaryForUser(punchData.userId, punchData.date);
    }
    
    const updatedDoc = await punchRef.get();
    res.json({
      message: 'Punch record updated',
      punch: { id: punchId, ...updatedDoc.data() },
    });
  } catch (error) {
    console.error('Edit punch error:', error);
    res.status(500).json({ error: 'Failed to edit punch record' });
  }
});

// Delete a punch record (admin only)
router.delete('/punches/:punchId', verifyToken, requireAdmin, async (req, res) => {
  const { punchId } = req.params;
  
  try {
    const punchRef = db.collection('attendance').doc(punchId);
    const punchDoc = await punchRef.get();
    
    if (!punchDoc.exists) {
      return res.status(404).json({ error: 'Punch record not found' });
    }
    
    const punchData = punchDoc.data();
    await punchRef.delete();
    
    // Update daily summary
    await updateDailySummaryForUser(punchData.userId, punchData.date);
    
    res.json({ message: 'Punch record deleted' });
  } catch (error) {
    console.error('Delete punch error:', error);
    res.status(500).json({ error: 'Failed to delete punch record' });
  }
});

// Get daily report for all employees (admin only)
router.get('/reports/daily', verifyToken, requireAdmin, async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  try {
    // Get all daily summaries for the date
    const summariesSnapshot = await db.collection('dailySummary')
      .where('date', '==', targetDate)
      .get();
    
    const summaries = summariesSnapshot.docs.map(doc => doc.data());
    
    // Get user data for each summary
    const userIds = [...new Set(summaries.map(s => s.userId))];
    const userDocs = await Promise.all(
      userIds.map(id => db.collection('users').doc(id).get())
    );
    const userMap = {};
    userDocs.forEach(doc => {
      if (doc.exists) {
        userMap[doc.id] = doc.data();
      }
    });
    
    const enrichedSummaries = summaries.map(summary => ({
      ...summary,
      userName: userMap[summary.userId]?.name || 'Unknown',
      userEmail: userMap[summary.userId]?.email || 'Unknown',
      schedule: userMap[summary.userId]?.schedule,
    }));
    
    // Calculate totals across all employees
    const totals = {
      totalEmployees: enrichedSummaries.length,
      totalWorkedMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      nightDifferentialMinutes: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
    };
    
    enrichedSummaries.forEach(summary => {
      totals.totalWorkedMinutes += summary.totalWorked?.totalMinutes || 0;
      totals.regularMinutes += summary.regular?.totalMinutes || 0;
      totals.overtimeMinutes += summary.overtime?.totalMinutes || 0;
      totals.nightDifferentialMinutes += summary.nightDifferential?.totalMinutes || 0;
      totals.lateMinutes += summary.late?.totalMinutes || 0;
      totals.undertimeMinutes += summary.undertime?.totalMinutes || 0;
    });
    
    res.json({
      date: targetDate,
      employeeSummaries: enrichedSummaries,
      totals,
    });
  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({ error: 'Failed to generate daily report' });
  }
});

// Get weekly report for all employees (admin only)
router.get('/reports/weekly', verifyToken, requireAdmin, async (req, res) => {
  const { startDate } = req.query;
  
  // Default to current week
  const end = new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  try {
    // Get all daily summaries for the week
    const summariesSnapshot = await db.collection('dailySummary')
      .where('date', '>=', start.toISOString().split('T')[0])
      .where('date', '<=', end.toISOString().split('T')[0])
      .get();
    
    const allSummaries = summariesSnapshot.docs.map(doc => doc.data());
    
    // Group by user
    const userSummaries = {};
    allSummaries.forEach(summary => {
      if (!userSummaries[summary.userId]) {
        userSummaries[summary.userId] = [];
      }
      userSummaries[summary.userId].push(summary);
    });
    
    // Get user data
    const userIds = Object.keys(userSummaries);
    const userDocs = await Promise.all(
      userIds.map(id => db.collection('users').doc(id).get())
    );
    const userMap = {};
    userDocs.forEach(doc => {
      if (doc.exists) {
        userMap[doc.id] = doc.data();
      }
    });
    
    // Aggregate weekly totals per employee
    const employeeWeeklyReports = userIds.map(userId => {
      const summaries = userSummaries[userId];
      const totals = {
        totalWorkedMinutes: 0,
        regularMinutes: 0,
        overtimeMinutes: 0,
        nightDifferentialMinutes: 0,
        lateMinutes: 0,
        undertimeMinutes: 0,
      };
      
      summaries.forEach(s => {
        totals.totalWorkedMinutes += s.totalWorked?.totalMinutes || 0;
        totals.regularMinutes += s.regular?.totalMinutes || 0;
        totals.overtimeMinutes += s.overtime?.totalMinutes || 0;
        totals.nightDifferentialMinutes += s.nightDifferential?.totalMinutes || 0;
        totals.lateMinutes += s.late?.totalMinutes || 0;
        totals.undertimeMinutes += s.undertime?.totalMinutes || 0;
      });
      
      const minutesToHours = (minutes) => ({
        hours: Math.floor(minutes / 60),
        minutes: minutes % 60,
        totalMinutes: minutes,
      });
      
      return {
        userId,
        userName: userMap[userId]?.name || 'Unknown',
        userEmail: userMap[userId]?.email || 'Unknown',
        schedule: userMap[userId]?.schedule,
        daysWorked: summaries.length,
        dailySummaries: summaries,
        weeklyTotals: {
          totalWorked: minutesToHours(totals.totalWorkedMinutes),
          regular: minutesToHours(totals.regularMinutes),
          overtime: minutesToHours(totals.overtimeMinutes),
          nightDifferential: minutesToHours(totals.nightDifferentialMinutes),
          late: minutesToHours(totals.lateMinutes),
          undertime: minutesToHours(totals.undertimeMinutes),
        },
      };
    });
    
    res.json({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      employeeReports: employeeWeeklyReports,
      totalEmployees: employeeWeeklyReports.length,
    });
  } catch (error) {
    console.error('Weekly report error:', error);
    res.status(500).json({ error: 'Failed to generate weekly report' });
  }
});

// Helper function to update daily summary
const updateDailySummaryForUser = async (userId, date) => {
  try {
    const punchesQuery = await db.collection('attendance')
      .where('userId', '==', userId)
      .where('date', '==', date)
      .where('status', '==', 'completed')
      .get();
    
    const punches = punchesQuery.docs.map(doc => doc.data().metrics);
    const aggregated = aggregateDailyMetrics(punches);
    
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
