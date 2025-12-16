import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { attendanceAPI, summaryAPI } from '../services/api';
import './History.css';

const History = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: '',
  });

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 50 };
      if (dateFilter.startDate) params.startDate = dateFilter.startDate;
      if (dateFilter.endDate) params.endDate = dateFilter.endDate;

      const [historyRes, weeklyRes] = await Promise.all([
        attendanceAPI.getHistory(params),
        summaryAPI.getWeekly(dateFilter.startDate || undefined),
      ]);

      setRecords(historyRes.data.records || []);
      setWeeklySummary(weeklyRes.data);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFilter.startDate, dateFilter.endDate]);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user, fetchHistory]);

  const handleFilterChange = (e) => {
    setDateFilter({ ...dateFilter, [e.target.name]: e.target.value });
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchHistory();
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString();
  };

  const formatHours = (hoursObj) => {
    if (!hoursObj) return '0h 0m';
    return `${hoursObj.hours}h ${hoursObj.minutes}m`;
  };

  if (loading) {
    return (
      <div className="history-loading">
        <div className="spinner"></div>
        <p>Loading history...</p>
      </div>
    );
  }

  return (
    <div className="history-page">
      <h1>Attendance History</h1>

      {/* Filter Section */}
      <div className="filter-section">
        <form onSubmit={handleFilterSubmit} className="filter-form">
          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              name="startDate"
              value={dateFilter.startDate}
              onChange={handleFilterChange}
            />
          </div>
          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              name="endDate"
              value={dateFilter.endDate}
              onChange={handleFilterChange}
            />
          </div>
          <button type="submit" className="btn-filter">
            Apply Filter
          </button>
        </form>
      </div>

      {/* Weekly Summary Card */}
      {weeklySummary && (
        <div className="summary-card">
          <h2>Weekly Summary</h2>
          <p className="date-range">
            {weeklySummary.startDate} to {weeklySummary.endDate}
          </p>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="label">Days Worked</span>
              <span className="value">{weeklySummary.dailySummaries?.length || 0}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Hours</span>
              <span className="value">{formatHours(weeklySummary.weeklyTotals?.totalWorked)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Regular Hours</span>
              <span className="value">{formatHours(weeklySummary.weeklyTotals?.regular)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Overtime</span>
              <span className="value highlight">{formatHours(weeklySummary.weeklyTotals?.overtime)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Night Differential</span>
              <span className="value">{formatHours(weeklySummary.weeklyTotals?.nightDifferential)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Late</span>
              <span className="value warning">{formatHours(weeklySummary.weeklyTotals?.late)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Undertime</span>
              <span className="value warning">{formatHours(weeklySummary.weeklyTotals?.undertime)}</span>
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="table-container">
        <table className="history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Punch In</th>
              <th>Punch Out</th>
              <th>Status</th>
              <th>Total</th>
              <th>Regular</th>
              <th>OT</th>
              <th>ND</th>
              <th>Late</th>
              <th>Undertime</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan="10" className="no-data">
                  No attendance records found
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id}>
                  <td>{record.date}</td>
                  <td>{formatDateTime(record.punchIn)}</td>
                  <td>{formatDateTime(record.punchOut)}</td>
                  <td>
                    <span className={`status-badge ${record.status}`}>
                      {record.status}
                    </span>
                  </td>
                  <td>{formatHours(record.metrics?.totalWorked)}</td>
                  <td>{formatHours(record.metrics?.regular)}</td>
                  <td>{formatHours(record.metrics?.overtime)}</td>
                  <td>{formatHours(record.metrics?.nightDifferential)}</td>
                  <td className="warning-text">{formatHours(record.metrics?.late)}</td>
                  <td className="warning-text">{formatHours(record.metrics?.undertime)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default History;
