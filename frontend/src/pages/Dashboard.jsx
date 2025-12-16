import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { attendanceAPI, summaryAPI } from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const { user, userData } = useAuth();
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [currentPunch, setCurrentPunch] = useState(null);
  const [dailySummary, setDailySummary] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [punchLoading, setPunchLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, dashboardRes] = await Promise.all([
        attendanceAPI.getStatus(),
        summaryAPI.getDashboard(),
      ]);

      setIsPunchedIn(statusRes.data.isPunchedIn);
      setCurrentPunch(statusRes.data.currentPunch);
      setDailySummary(dashboardRes.data.today?.summary);
      setWeeklyData(dashboardRes.data.week);

      if (statusRes.data.currentPunch?.punchIn) {
        const elapsed = Math.floor(
          (new Date() - new Date(statusRes.data.currentPunch.punchIn)) / 1000
        );
        setElapsedTime(elapsed);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  // Update elapsed time every second when punched in
  useEffect(() => {
    let interval;
    if (isPunchedIn) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPunchedIn]);

  const handlePunchIn = async () => {
    try {
      setPunchLoading(true);
      setError('');
      const res = await attendanceAPI.punchIn();
      setIsPunchedIn(true);
      setCurrentPunch({ punchIn: res.data.punchIn });
      setElapsedTime(0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to punch in');
    } finally {
      setPunchLoading(false);
    }
  };

  const handlePunchOut = async () => {
    try {
      setPunchLoading(true);
      setError('');
      await attendanceAPI.punchOut();
      setIsPunchedIn(false);
      setCurrentPunch(null);
      setElapsedTime(0);
      // Refresh dashboard data to get updated summary
      await fetchDashboardData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to punch out');
    } finally {
      setPunchLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatHours = (hoursObj) => {
    if (!hoursObj) return '0h 0m';
    return `${hoursObj.hours}h ${hoursObj.minutes}m`;
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome, {userData?.name || 'User'}</h1>
        <p className="schedule-info">
          Schedule: {userData?.schedule?.start || '09:00'} - {userData?.schedule?.end || '18:00'}
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Punch Section */}
      <div className="punch-section">
        <div className="punch-card">
          <h2>Time Tracking</h2>
          <div className="punch-status">
            <div className={`status-indicator ${isPunchedIn ? 'active' : 'inactive'}`}>
              {isPunchedIn ? 'Currently Working' : 'Not Punched In'}
            </div>
            {isPunchedIn && (
              <div className="elapsed-time">
                <span className="time-label">Time Elapsed:</span>
                <span className="time-value">{formatTime(elapsedTime)}</span>
              </div>
            )}
          </div>
          <div className="punch-buttons">
            <button
              className={`punch-btn punch-in ${isPunchedIn ? 'disabled' : ''}`}
              onClick={handlePunchIn}
              disabled={isPunchedIn || punchLoading}
            >
              {punchLoading ? 'Processing...' : 'Punch In'}
            </button>
            <button
              className={`punch-btn punch-out ${!isPunchedIn ? 'disabled' : ''}`}
              onClick={handlePunchOut}
              disabled={!isPunchedIn || punchLoading}
            >
              {punchLoading ? 'Processing...' : 'Punch Out'}
            </button>
          </div>
          {currentPunch && (
            <p className="punch-info">
              Punched in at: {new Date(currentPunch.punchIn).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Daily Summary Section */}
      <div className="summary-section">
        <h2>Today&apos;s Summary</h2>
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon total">⏱</div>
            <div className="kpi-content">
              <span className="kpi-label">Total Worked</span>
              <span className="kpi-value">{formatHours(dailySummary?.totalWorked)}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon regular">📊</div>
            <div className="kpi-content">
              <span className="kpi-label">Regular Hours</span>
              <span className="kpi-value">{formatHours(dailySummary?.regular)}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon overtime">⚡</div>
            <div className="kpi-content">
              <span className="kpi-label">Overtime (OT)</span>
              <span className="kpi-value">{formatHours(dailySummary?.overtime)}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon night">🌙</div>
            <div className="kpi-content">
              <span className="kpi-label">Night Differential</span>
              <span className="kpi-value">{formatHours(dailySummary?.nightDifferential)}</span>
            </div>
          </div>
          <div className="kpi-card warning">
            <div className="kpi-icon late">⏰</div>
            <div className="kpi-content">
              <span className="kpi-label">Late</span>
              <span className="kpi-value">{formatHours(dailySummary?.late)}</span>
            </div>
          </div>
          <div className="kpi-card warning">
            <div className="kpi-icon undertime">📉</div>
            <div className="kpi-content">
              <span className="kpi-label">Undertime</span>
              <span className="kpi-value">{formatHours(dailySummary?.undertime)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Summary Section */}
      <div className="summary-section">
        <h2>This Week&apos;s Summary</h2>
        <div className="week-summary">
          <div className="week-stat">
            <span className="week-label">Days Worked</span>
            <span className="week-value">{weeklyData?.daysWorked || 0}</span>
          </div>
          <div className="week-stat">
            <span className="week-label">Total Hours</span>
            <span className="week-value">{formatHours(weeklyData?.totals?.totalWorked)}</span>
          </div>
          <div className="week-stat">
            <span className="week-label">Overtime</span>
            <span className="week-value">{formatHours(weeklyData?.totals?.overtime)}</span>
          </div>
          <div className="week-stat">
            <span className="week-label">Night Diff</span>
            <span className="week-value">{formatHours(weeklyData?.totals?.nightDifferential)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
