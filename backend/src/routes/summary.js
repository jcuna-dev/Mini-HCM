const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');
const { aggregateDailyMetrics } = require('../services/hoursCalculation');

// Get daily summary for user
router.get('/daily', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  try {
    const summaryId = `${uid}_${targetDate}`;
    const summaryDoc = await db.collection('dailySummary').doc(summaryId).get();
    
    if (!summaryDoc.exists) {
      // Return empty summary if no data for the day
      res.json({
        userId: uid,
        date: targetDate,
        totalWorked: { hours: 0, minutes: 0, totalMinutes: 0 },
        regular: { hours: 0, minutes: 0, totalMinutes: 0 },
        overtime: { hours: 0, minutes: 0, totalMinutes: 0 },
        nightDifferential: { hours: 0, minutes: 0, totalMinutes: 0 },
        late: { hours: 0, minutes: 0, totalMinutes: 0 },
        undertime: { hours: 0, minutes: 0, totalMinutes: 0 },
        punchCount: 0,
      });
    } else {
      res.json(summaryDoc.data());
    }
  } catch (error) {
    console.error('Daily summary fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch daily summary' });
  }
});

// Get weekly summary for user
router.get('/weekly', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { startDate } = req.query;
  
  // Default to current week (last 7 days)
  const end = new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startDateStr = start.toISOString().split('T')[0];
  const endDateStr = end.toISOString().split('T')[0];
  
  try {
    // Query by date range first, then filter by userId
    const summariesQuery = await db.collection('dailySummary')
      .where('date', '>=', startDateStr)
      .where('date', '<=', endDateStr)
      .get();
    
    // Filter by userId and sort by date descending
    const dailySummaries = summariesQuery.docs
      .map(doc => doc.data())
      .filter(summary => summary.userId === uid)
      .sort((a, b) => b.date.localeCompare(a.date));
    
    // Aggregate weekly totals
    const weeklyTotals = {
      totalWorkedMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      nightDifferentialMinutes: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      totalPunches: 0,
    };
    
    dailySummaries.forEach(summary => {
      weeklyTotals.totalWorkedMinutes += summary.totalWorked?.totalMinutes || 0;
      weeklyTotals.regularMinutes += summary.regular?.totalMinutes || 0;
      weeklyTotals.overtimeMinutes += summary.overtime?.totalMinutes || 0;
      weeklyTotals.nightDifferentialMinutes += summary.nightDifferential?.totalMinutes || 0;
      weeklyTotals.lateMinutes += summary.late?.totalMinutes || 0;
      weeklyTotals.undertimeMinutes += summary.undertime?.totalMinutes || 0;
      weeklyTotals.totalPunches += summary.punchCount || 0;
    });
    
    const minutesToHours = (minutes) => ({
      hours: Math.floor(minutes / 60),
      minutes: minutes % 60,
      totalMinutes: minutes,
    });
    
    res.json({
      userId: uid,
      startDate: startDateStr,
      endDate: endDateStr,
      dailySummaries,
      weeklyTotals: {
        totalWorked: minutesToHours(weeklyTotals.totalWorkedMinutes),
        regular: minutesToHours(weeklyTotals.regularMinutes),
        overtime: minutesToHours(weeklyTotals.overtimeMinutes),
        nightDifferential: minutesToHours(weeklyTotals.nightDifferentialMinutes),
        late: minutesToHours(weeklyTotals.lateMinutes),
        undertime: minutesToHours(weeklyTotals.undertimeMinutes),
        totalPunches: weeklyTotals.totalPunches,
        daysWorked: dailySummaries.length,
      },
    });
  } catch (error) {
    console.error('Weekly summary fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly summary' });
  }
});

// Get summary dashboard data
router.get('/dashboard', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Get today's summary
    const todaySummaryId = `${uid}_${today}`;
    const todaySummaryDoc = await db.collection('dailySummary').doc(todaySummaryId).get();
    
    // Get current punch status
    const openPunchQuery = await db.collection('attendance')
      .where('userId', '==', uid)
      .where('punchOut', '==', null)
      .limit(1)
      .get();
    
    const isPunchedIn = !openPunchQuery.empty;
    let currentPunch = null;
    if (isPunchedIn) {
      const punchData = openPunchQuery.docs[0].data();
      currentPunch = {
        punchId: openPunchQuery.docs[0].id,
        punchIn: punchData.punchIn,
        elapsedMinutes: Math.floor((new Date() - new Date(punchData.punchIn)) / 60000),
      };
    }
    
    // Get user schedule
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    // Get week summary
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    // Query by date range first, then filter by userId in memory
    const weekSummariesQuery = await db.collection('dailySummary')
      .where('date', '>=', weekStartStr)
      .get();
    
    const weekSummaries = weekSummariesQuery.docs
      .map(doc => doc.data())
      .filter(summary => summary.userId === uid);
    const weeklyTotals = aggregateDailyMetrics(weekSummaries.map(s => ({
      totalWorked: s.totalWorked,
      regular: s.regular,
      overtime: s.overtime,
      nightDifferential: s.nightDifferential,
      late: s.late,
      undertime: s.undertime,
    })));
    
    res.json({
      user: {
        name: userData.name,
        schedule: userData.schedule,
      },
      today: {
        date: today,
        isPunchedIn,
        currentPunch,
        summary: todaySummaryDoc.exists ? todaySummaryDoc.data() : null,
      },
      week: {
        startDate: weekStartStr,
        daysWorked: weekSummaries.length,
        totals: weeklyTotals,
      },
    });
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
