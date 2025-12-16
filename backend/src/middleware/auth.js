const { auth } = require('../config/firebase');

// Verify Firebase ID token
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Check if user is admin
const requireAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Check custom claims or Firestore for admin role
  const { db } = require('../config/firebase');
  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (userDoc.exists && userDoc.data().role === 'admin') {
      next();
    } else {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { verifyToken, requireAdmin };
