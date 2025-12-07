
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const { db, initializeDB } = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

initializeDB();

// Initialize Firebase Admin SDK if service account file is present
let admin;
try {
  admin = require('firebase-admin');
  const serviceAccountPath = path.join(__dirname, '../socially-843c5-firebase-adminsdk-fbsvc-1ad158ca8c.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    try {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('Firebase Admin SDK initialized using', serviceAccountPath);
    } catch (initErr) {
      console.warn('Failed to initialize Firebase Admin SDK:', initErr && initErr.message ? initErr.message : initErr);
    }
  } else {
    console.warn('Firebase service account not found at', serviceAccountPath, '- Firebase Admin not initialized.');
  }
} catch (e) {
  console.warn('firebase-admin package not available; skipping Admin SDK init');
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const { sendVerificationEmail, generateVerificationCode } = require('./email');
const webpush = require('web-push');

// Initialize VAPID keys for Web Push. Provide `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in .env
let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  try {
    const vapidKeys = webpush.generateVAPIDKeys();
    VAPID_PUBLIC_KEY = vapidKeys.publicKey;
    VAPID_PRIVATE_KEY = vapidKeys.privateKey;
    console.log('Generated VAPID keys (set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY in env to persist):');
    console.log('VAPID_PUBLIC_KEY=', VAPID_PUBLIC_KEY);
    console.log('VAPID_PRIVATE_KEY=', VAPID_PRIVATE_KEY);
  } catch (e) {
    console.warn('Failed to generate VAPID keys:', e && e.message ? e.message : e);
  }
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(`mailto:${process.env.ADMIN_EMAIL || 'admin@localhost'}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Middleware and helper functions
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Helper: check if a user is banned (simple DB lookup)
function isBanned(userId) {
  try {
    const ban = db.findOne('bans', { userId });
    return !!ban;
  } catch (e) {
    return false;
  }
}

// Helper: get user role from adminRoles collection
function getUserRole(userId) {
  try {
    const roleRecord = db.findOne('adminRoles', { userId });
    return roleRecord ? roleRecord.role : 'user';
  } catch (e) {
    return 'user';
  }
}

// Return VAPID public key for front-end subscription
app.get('/api/push/vapid-public-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) return res.status(500).json({ error: 'VAPID public key not configured' });
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Save push subscription for authenticated user
app.post('/api/push/subscribe', authenticateToken, (req, res) => {
  const subscription = req.body.subscription;
  if (!subscription) return res.status(400).json({ error: 'Subscription required' });
  const user = db.findOne('users', { id: req.user.id });
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.pushSubscription = subscription;
  db.update('users', { id: user.id }, user);
  res.json({ message: 'Push subscription saved' });
});

// Debug: send a push to the authenticated user's saved subscription
app.post('/api/push/send', authenticateToken, async (req, res) => {
  const user = db.findOne('users', { id: req.user.id });
  if (!user || !user.pushSubscription) return res.status(404).json({ error: 'No push subscription for user' });
  const { title, body } = req.body || {};
  try {
    await webpush.sendNotification(user.pushSubscription, JSON.stringify({ title: title || 'Socially', body: body || 'Test notification' }));
    res.json({ message: 'Push sent' });
  } catch (err) {
    console.error('Push send error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Push send failed', details: err && err.message ? err.message : String(err) });
  }
});

// Development helper: send a push without authentication (accepts subscription in body)
// Only enabled when NODE_ENV !== 'production'
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/push/send-unauth', async (req, res) => {
    const { subscription, title, body } = req.body || {};
    if (!subscription) return res.status(400).json({ error: 'Subscription required' });
    try {
      await webpush.sendNotification(subscription, JSON.stringify({ title: title || 'Socially (dev)', body: body || 'Test notification' }));
      res.json({ message: 'Push sent (unauthenticated dev endpoint)' });
    } catch (err) {
      console.error('Unauth push send error:', err && err.message ? err.message : err);
      res.status(500).json({ error: 'Push send failed', details: err && err.message ? err.message : String(err) });
    }
  });
}

// Request phone verification code (sends via SMS)
app.post('/api/auth/request-phone-verification', authenticateToken, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  const user = db.findOne('users', { id: req.user.id });
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Generate a 6-digit code and store phone on user record; send code to user's email
  const code = generateVerificationCode();
  user.phone = phone;
  user.phoneVerificationCode = code;
  user.phoneVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 min
  user.phoneVerified = false;
  db.update('users', { id: user.id }, user);
  console.log(`Storing phone verification code for user ${user.id}, will email code to ${user.email}`);

  try {
    // Push notifications disabled; send code via email (or SMS gateway if configured).
    const sent = await sendVerificationEmail(user.email, code);
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send verification code via email.' });
    }
    res.json({ message: 'Verification code sent to your account email.' });
  } catch (err) {
    console.error('Verification send error:', err);
    res.status(500).json({ error: 'Failed to send verification code.', details: err && err.message ? err.message : String(err) });
  }
});

// Save FCM registration token for authenticated user
// FCM endpoints disabled per preference

// Debug: server-side send verification via FCM to saved token
app.post('/api/fcm/send-verification', authenticateToken, async (req, res) => {
  const user = db.findOne('users', { id: req.user.id });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.fcmToken) return res.status(404).json({ error: 'No FCM token saved for user' });
  const code = generateVerificationCode();
  user.phoneVerificationCode = code;
  user.phoneVerificationExpires = Date.now() + 10 * 60 * 1000;
  user.phoneVerified = false;
  db.update('users', { id: user.id }, user);

  if (typeof admin !== 'undefined' && admin && admin.apps && admin.apps.length > 0) {
    const message = {
      token: user.fcmToken,
      notification: {
        title: 'Socially Verification',
        body: `Your code: ${code}`
      },
      data: { type: 'phone_verification', code: String(code) }
    };
    try {
      await admin.messaging().send(message);
      return res.json({ message: 'Verification sent via FCM' });
    } catch (err) {
      console.error('FCM send error:', err && err.message ? err.message : err);
      return res.status(500).json({ error: 'FCM send failed', details: err && err.message ? err.message : String(err) });
    }
  }

  res.status(500).json({ error: 'Firebase Admin not initialized' });
});

// Firebase/FCM debug endpoints removed — push notification logic stripped

// Verify phone code
app.post('/api/auth/verify-phone', authenticateToken, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  const user = db.findOne('users', { id: req.user.id });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.phoneVerificationCode || !user.phoneVerificationExpires) return res.status(400).json({ error: 'No verification code found.' });
  if (Date.now() > user.phoneVerificationExpires) return res.status(400).json({ error: 'Verification code expired.' });
  if (user.phoneVerificationCode !== code) return res.status(400).json({ error: 'Invalid verification code.' });
  user.phoneVerified = true;
  delete user.phoneVerificationCode;
  delete user.phoneVerificationExpires;
  db.update('users', { id: user.id }, user);
  res.json({ message: 'Phone number verified successfully.' });
});

// Request email verification
app.post('/api/auth/request-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = db.findOne('users', { email });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const code = generateVerificationCode();
  user.verificationCode = code;
  user.verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 min
  user.verified = false;
  db.update('users', { id: user.id }, user);

  // Log the code to server console for development debugging (remove in production)
  console.log(`Verification code for ${email}: ${code}`);

  const sent = await sendVerificationEmail(email, code);
  if (sent) {
    res.json({ message: 'Verification code sent to email.' });
  } else {
    res.status(500).json({ error: 'Failed to send verification email.' });
  }
});

// Resend verification for authenticated user
app.post('/api/auth/resend-verification', authenticateToken, async (req, res) => {
  try {
    const user = db.findOne('users', { id: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const code = generateVerificationCode();
    user.verificationCode = code;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 min
    user.verified = false;
    db.update('users', { id: user.id }, user);

    console.log(`Verification code for ${user.email}: ${code}`);
    const sent = await sendVerificationEmail(user.email, code);
    if (sent) {
      res.json({ message: 'Verification code sent to email.' });
    } else {
      res.status(500).json({ error: 'Failed to send verification email.' });
    }
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Resend failed' });
  }
});

// Verify code
app.post('/api/auth/verify-email', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code required' });
  const user = db.findOne('users', { email });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.verified) return res.json({ message: 'Email already verified.' });
  if (!user.verificationCode || !user.verificationCodeExpires) return res.status(400).json({ error: 'No verification code found.' });
  if (Date.now() > user.verificationCodeExpires) return res.status(400).json({ error: 'Verification code expired.' });
  if (user.verificationCode !== code) return res.status(400).json({ error: 'Invalid verification code.' });
  user.verified = true;
  delete user.verificationCode;
  delete user.verificationCodeExpires;
  db.update('users', { id: user.id }, user);
  res.json({ message: 'Email verified successfully.' });
});

// Allow overriding the uploads directory with UPLOADS_DIR env var so uploaded
// files can be stored outside the repo and permissioned for a service account.
const uploadDir = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(__dirname, '../uploads');

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadDir));
} catch (err) {
  console.warn('Warning: Could not create uploads directory:', err.message);
  console.warn('File uploads will not be available');
}

const publicDir = path.join(__dirname, '../../frontend/public');

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(publicDir, 'sitemap.xml'));
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(publicDir, 'robots.txt'));
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

const canViewPost = (post, viewerId) => {
  if (post.authorId === viewerId) return true;
  
  const author = db.findOne('users', { id: post.authorId });
  const viewer = db.findOne('users', { id: viewerId });
  
  if (!author || !viewer) return false;

  const privacy = post.privacy || 'public';
  
  if (privacy === 'public') return true;
  
  const isAuthorFriend = author.friends && author.friends.includes(viewerId);
  const isViewerFriendOfAuthor = viewer.friends && viewer.friends.includes(post.authorId);
  const isMutualFriend = isAuthorFriend && isViewerFriendOfAuthor;
  
  if (privacy === 'friends') {
    return isMutualFriend;
  }
  
  if (privacy === 'friendsOfFriends') {
    if (isMutualFriend) return true;
    if (author.friends) {
      for (const friendId of author.friends) {
        const friend = db.findOne('users', { id: friendId });
        if (friend && friend.friends && friend.friends.includes(viewerId)) {
          return true;
        }
      }
    }
    return false;
  }
  
  const isTagged = post.taggedUsers && post.taggedUsers.includes(viewerId);
  
  if (privacy === 'friendsAndTagged') {
    return isMutualFriend || isTagged;
  }
  
  if (privacy === 'friendsOfFriendsAndTagged') {
    if (isTagged) return true;
    if (isMutualFriend) return true;
    if (author.friends) {
      for (const friendId of author.friends) {
        const friend = db.findOne('users', { id: friendId });
        if (friend && friend.friends && friend.friends.includes(viewerId)) {
          return true;
        }
      }
    }
    return false;
  }
  
  return false;
};

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Socially API is running' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    console.log('Register attempt:', { username, email });

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // Check registration cap
    let capData = db.findOne('registrationCap', { id: 'default' });
    if (capData && capData.cap !== null && capData.currentCount >= capData.cap) {
      return res.status(403).json({ error: 'Sorry! The platform is currently full! Please check back in 1-2 weeks!' });
    }

    const existingUser = db.findOne('users', { username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const existingEmail = db.findOne('users', { email });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const userId = uuidv4();

    const newUser = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      avatar: null,
      bio: '',
      createdAt: new Date().toISOString(),
      followers: [],
      following: []
    };

    db.insert('users', newUser);
    console.log('User created:', userId);

    // Increment registration cap counter
    capData = db.findOne('registrationCap', { id: 'default' });
    if (capData) {
      capData.currentCount += 1;
      db.update('registrationCap', { id: 'default' }, { currentCount: capData.currentCount });
      console.log(`Registration counter incremented to ${capData.currentCount}`);
    }

    // Generate verification code and send email automatically on registration
    try {
      const code = generateVerificationCode();
      // store code on user record
      const userRecord = db.findOne('users', { id: userId });
      if (userRecord) {
        userRecord.verificationCode = code;
        userRecord.verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        userRecord.verified = false;
        db.update('users', userRecord.id, userRecord);
        console.log(`Verification code for ${email}: ${code}`);
        const sent = await sendVerificationEmail(email, code);
        console.log('Auto verification email sent:', sent);
      }
    } catch (sendErr) {
      console.error('Error sending auto verification email:', sendErr);
    }

    const token = jwt.sign({ id: userId, username }, JWT_SECRET);
    res.json({
      message: 'Account created successfully!',
      token,
      user: { ...newUser, password: undefined }
    });
  } catch (err) {
    console.error('Registration error:', err.message, err.stack);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  console.log('Login attempt with email:', email);
  const user = db.findOne('users', { email });
  
  if (!user) {
    console.log('User not found with email:', email);
    const allUsers = db.read('users');
    console.log('Available emails:', allUsers.map(u => u.email));
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  console.log('User found:', user.username);
  const passwordMatch = bcrypt.compareSync(password, user.password);
  console.log('Password match:', passwordMatch);
  
  if (!passwordMatch) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  if (isBanned(user.id)) {
    return res.status(403).json({ error: 'Your account has been banned' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
  // If user has 2FA enabled, require the TOTP code before returning token
  if (user.twoFA && user.twoFA.enabled) {
    return res.json({ twoFARequired: true, userId: user.id, message: 'Two-factor authentication code required' });
  }

  res.json({ token, user: { ...user, password: undefined } });
});

// Google OAuth login/signup
app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Google token required' });
  if (!googleClient) return res.status(500).json({ error: 'Google OAuth not configured' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub } = payload;

    // Check if user exists
    let user = db.findOne('users', { email });

    if (!user) {
      // Create new user from Google data
      const userId = uuidv4();
      user = {
        id: userId,
        username: name || email.split('@')[0],
        email,
        password: null, // OAuth users have no password
        avatar: picture || null,
        bio: '',
        googleId: sub,
        verified: true, // Google emails are verified
        createdAt: new Date().toISOString(),
        followers: [],
        following: [],
        friends: []
      };
      db.insert('users', user);
      console.log('New user created via Google OAuth:', userId);

      // Increment registration cap
      const capData = db.findOne('registrationCap', { id: 'default' });
      if (capData && capData.cap !== null && capData.currentCount >= capData.cap) {
        return res.status(403).json({ error: 'Platform registration is full' });
      }
      if (capData) {
        capData.currentCount += 1;
        db.update('registrationCap', { id: 'default' }, { currentCount: capData.currentCount });
      }
    } else {
      // Update user's Google ID if not set
      if (!user.googleId) {
        db.update('users', { id: user.id }, { googleId: sub });
        user.googleId = sub;
      }
    }

    if (isBanned(user.id)) {
      return res.status(403).json({ error: 'Your account has been banned' });
    }

    const jwtToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token: jwtToken, user: { ...user, password: undefined } });
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});
// Setup 2FA - generate secret and QR (does not enable yet)
app.post('/api/auth/2fa/setup', authenticateToken, async (req, res) => {
  try {
    const user = db.findOne('users', { id: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const secret = speakeasy.generateSecret({ name: `Socially (${user.username})` });

    // store temp secret for verification step
    const twoFA = user.twoFA || {};
    twoFA.tempSecret = secret.base32;
    twoFA.enabled = twoFA.enabled || false;
    db.update('users', { id: user.id }, { twoFA });

    // create QR data URL
    const otpauth = secret.otpauth_url;
    const qrDataUrl = await qrcode.toDataURL(otpauth);

    res.json({ otpauth_url: otpauth, qr: qrDataUrl, secret: secret.base32 });
  } catch (err) {
    console.error('2FA setup error:', err);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// Enable 2FA after verifying code
app.post('/api/auth/2fa/enable', authenticateToken, (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  const user = db.findOne('users', { id: req.user.id });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const tempSecret = user.twoFA && user.twoFA.tempSecret;
  if (!tempSecret) return res.status(400).json({ error: 'No pending 2FA setup found' });

  const verified = speakeasy.totp.verify({ secret: tempSecret, encoding: 'base32', token, window: 1 });
  if (!verified) return res.status(400).json({ error: 'Invalid 2FA token' });

  // enable and persist the secret
  const twoFA = { enabled: true, secret: tempSecret };
  db.update('users', { id: user.id }, { twoFA });
  res.json({ message: '2FA enabled' });
});

// Disable 2FA (require password or a valid TOTP code)
app.post('/api/auth/2fa/disable', authenticateToken, (req, res) => {
  const { password, token } = req.body;
  const user = db.findOne('users', { id: req.user.id });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const hasPassword = password && bcrypt.compareSync(password, user.password);
  const hasToken = user.twoFA && user.twoFA.secret && token && speakeasy.totp.verify({ secret: user.twoFA.secret, encoding: 'base32', token, window: 1 });

  if (!hasPassword && !hasToken) return res.status(400).json({ error: 'Password or valid 2FA token required to disable' });

  const twoFA = { enabled: false };
  db.update('users', { id: user.id }, { twoFA });
  res.json({ message: '2FA disabled' });
});

// Check 2FA status
app.get('/api/auth/2fa/status', authenticateToken, (req, res) => {
  const user = db.findOne('users', { id: req.user.id });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ twoFA: user.twoFA || { enabled: false } });
});

// Complete login using 2FA token
app.post('/api/auth/login-2fa', (req, res) => {
  const { userId, token } = req.body;
  if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });

  const user = db.findOne('users', { id: userId });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.twoFA || !user.twoFA.enabled || !user.twoFA.secret) return res.status(400).json({ error: '2FA not enabled for user' });

  const verified = speakeasy.totp.verify({ secret: user.twoFA.secret, encoding: 'base32', token, window: 1 });
  if (!verified) return res.status(400).json({ error: 'Invalid 2FA token' });

  const jwtToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
  res.json({ token: jwtToken, user: { ...user, password: undefined } });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.findOne('users', { id: req.user.id });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const role = getUserRole(user.id);
  res.json({ ...user, password: undefined, role });
});



app.get('/api/users', authenticateToken, (req, res) => {
  const users = db.read('users').map(u => ({
    id: u.id,
    username: u.username,
    avatar: u.avatar
  }));
  res.json(users);
});

app.get('/api/users/:id', authenticateToken, (req, res) => {
  const user = db.findOne('users', { id: req.params.id });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const role = getUserRole(user.id);
  res.json({ ...user, password: undefined, role });
});

app.put('/api/users/:id', authenticateToken, (req, res) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { bio, avatar, username, email } = req.body;
  const updates = { bio, avatar };

  if (username) {
    const existingUsername = db.findOne('users', { username });
    if (existingUsername && existingUsername.id !== req.params.id) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    updates.username = username;
  }

  if (email) {
    const existingEmail = db.findOne('users', { email });
    if (existingEmail && existingEmail.id !== req.params.id) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    updates.email = email;
  }

  const updated = db.update('users', { id: req.params.id }, updates);
  res.json({ ...updated, password: undefined });
});

app.post('/api/users/:id/avatar', authenticateToken, (req, res) => {
  upload.single('avatar')(req, res, (err) => {
    try {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'File upload error: ' + err.message });
      } else if (err) {
        return res.status(400).json({ error: 'Upload failed: ' + err.message });
      }

      if (req.user.id !== req.params.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const host = process.env.NODE_ENV === 'production' ? 'api.sociallyapp.org' : `localhost:${PORT}`;
      const avatarUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
      const user = db.findOne('users', { id: req.params.id });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updated = db.update('users', { id: req.params.id }, { avatar: avatarUrl });
      res.json({ ...updated, password: undefined });
    } catch (err) {
      console.error('Avatar upload error:', err);
      res.status(500).json({ error: 'Failed to upload avatar: ' + err.message });
    }
  });
});

app.post('/api/users/:id/change-password', authenticateToken, (req, res) => {
  const isOwnAccount = req.user.id === req.params.id;
  
  const user = db.findOne('users', { id: req.params.id });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!isOwnAccount) {
    const requesterRole = getUserRole(req.user.id);
    if (requesterRole !== 'owner') {
      return res.status(403).json({ error: 'Only the owner can change other users passwords' });
    }
  }

  const { currentPassword, newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: 'New password required' });
  }

  if (isOwnAccount) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password required' });
    }

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.update('users', { id: req.params.id }, { password: hashedPassword });

  res.json({ message: 'Password changed successfully' });
});

app.post('/api/posts', authenticateToken, (req, res) => {
  upload.array('media', 10)(req, res, (err) => {
    try {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'File upload error: ' + err.message });
      } else if (err) {
        return res.status(400).json({ error: 'Upload failed: ' + err.message });
      }

      if (isBanned(req.user.id)) {
        return res.status(403).json({ error: 'You are banned' });
      }

      const { content, type, privacy, taggedUsers } = req.body;
      const postId = uuidv4();
      const author = db.findOne('users', { id: req.user.id });

      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const host = process.env.NODE_ENV === 'production' ? 'api.sociallyapp.org' : `localhost:${PORT}`;
      const media = (req.files || []).map(file => ({
        url: `${protocol}://${host}/uploads/${file.filename}`,
        type: file.mimetype.startsWith('video') ? 'video' : file.mimetype.startsWith('image') ? 'image' : 'file',
        originalName: file.originalname
      }));

      const newPost = {
        id: postId,
        authorId: req.user.id,
        author: req.user.username,
        avatar: author?.avatar,
        content,
        type: type || (media.length > 0 ? 'media' : 'text'),
        media,
        likes: [],
        comments: [],
        shares: 0,
        privacy: privacy || 'public',
        taggedUsers: taggedUsers ? JSON.parse(taggedUsers) : [],
        createdAt: new Date().toISOString(),
        isDeleted: false
      };

      db.insert('posts', newPost);
      res.json(newPost);
    } catch (err) {
      console.error('Post creation error:', err);
      res.status(500).json({ error: 'Failed to create post: ' + err.message });
    }
  });
});

app.get('/api/posts', authenticateToken, (req, res) => {
  let posts = db.read('posts').filter(p => !p.isDeleted && canViewPost(p, req.user.id));
  const shares = db.read('shares');
  
  posts = posts.map(post => {
    const avatar = post.avatar || db.findOne('users', { id: post.authorId })?.avatar;
    const postShares = shares.filter(s => s.postId === post.id);
    return {
      ...post,
      avatar,
      isLiked: post.likes.includes(req.user.id),
      likes: post.likes.length,
      isShared: postShares.some(s => s.userId === req.user.id),
      shares: postShares.length
    };
  });

  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(posts);
});

app.get('/api/posts/user/:userId', authenticateToken, (req, res) => {
  const posts = db.find('posts', { authorId: req.params.userId }).filter(p => !p.isDeleted);
  const shares = db.read('shares');
  res.json(posts.map(p => {
    const avatar = p.avatar || db.findOne('users', { id: p.authorId })?.avatar;
    const postShares = shares.filter(s => s.postId === p.id);
    return {
      ...p,
      avatar,
      isLiked: p.likes.includes(req.user.id),
      likes: p.likes.length,
      isShared: postShares.some(s => s.userId === req.user.id),
      shares: postShares.length
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.get('/api/posts/:postId', authenticateToken, (req, res) => {
  const post = db.findOne('posts', { id: req.params.postId });
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  
  if (!canViewPost(post, req.user.id)) {
    return res.status(403).json({ error: 'You do not have permission to view this post' });
  }
  
  const avatar = post.avatar || db.findOne('users', { id: post.authorId })?.avatar;
  const postShares = db.read('shares').filter(s => s.postId === post.id);
  res.json({ 
    ...post, 
    avatar, 
    isLiked: post.likes.includes(req.user.id), 
    likes: post.likes.length,
    isShared: postShares.some(s => s.userId === req.user.id),
    shares: postShares.length
  });
});

app.post('/api/posts/:postId/like', authenticateToken, (req, res) => {
  const post = db.findOne('posts', { id: req.params.postId });
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (post.likes.includes(req.user.id)) {
    post.likes = post.likes.filter(id => id !== req.user.id);
  } else {
    post.likes.push(req.user.id);
  }

  db.update('posts', { id: req.params.postId }, { likes: post.likes });
  res.json({ likes: post.likes.length, isLiked: post.likes.includes(req.user.id) });
});

app.post('/api/posts/:postId/share', authenticateToken, (req, res) => {
  const post = db.findOne('posts', { id: req.params.postId });
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const shares = db.read('shares');
  const existingShare = shares.find(s => s.postId === req.params.postId && s.userId === req.user.id);
  
  if (existingShare) {
    db.delete('shares', { id: existingShare.id });
  } else {
    db.insert('shares', {
      id: uuidv4(),
      postId: req.params.postId,
      userId: req.user.id,
      username: req.user.username,
      createdAt: new Date().toISOString()
    });
  }

  const updatedShares = db.read('shares').filter(s => s.postId === req.params.postId);
  res.json({ shares: updatedShares.length, isShared: !existingShare });
});

app.get('/api/posts/:postId/shares', authenticateToken, (req, res) => {
  const shares = db.read('shares').filter(s => s.postId === req.params.postId);
  res.json(shares);
});

app.post('/api/posts/:postId/comment', authenticateToken, (req, res) => {
  const { content } = req.body;
  const post = db.findOne('posts', { id: req.params.postId });
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const comment = {
    id: uuidv4(),
    authorId: req.user.id,
    author: req.user.username,
    content,
    createdAt: new Date().toISOString(),
    likes: []
  };

  post.comments.push(comment);
  db.update('posts', { id: req.params.postId }, { comments: post.comments });
  res.json(comment);
});

app.get('/api/posts/:postId/comments', authenticateToken, (req, res) => {
  const post = db.findOne('posts', { id: req.params.postId });
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  res.json(post.comments);
});

app.delete('/api/posts/:postId', authenticateToken, (req, res) => {
  const post = db.findOne('posts', { id: req.params.postId });
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const userRole = getUserRole(req.user.id);
  const isAuthor = post.authorId === req.user.id;
  const isAdmin = ['owner', 'admin', 'moderator', 'co-owner', 'secondary-owner'].includes(userRole);
  
  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  db.update('posts', { id: req.params.postId }, { isDeleted: true });
  res.json({ message: 'Post deleted' });
});

app.post('/api/reports', authenticateToken, (req, res) => {
  const { targetId, targetType, reason, description } = req.body;

  const report = {
    id: uuidv4(),
    reporterId: req.user.id,
    targetId,
    targetType,
    reason,
    description,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.insert('reports', report);
  res.json(report);
});

app.get('/api/reports', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (!['owner', 'moderator', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const reports = db.read('reports');
  res.json(reports);
});

app.put('/api/reports/:reportId', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (!['owner', 'moderator', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { status, action } = req.body;
  const report = db.findOne('reports', { id: req.params.reportId });
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  db.update('reports', { id: req.params.reportId }, { status, action });
  res.json({ message: 'Report updated' });
});

app.post('/api/admin/ban', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (!['owner', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { userId, type, days } = req.body;
  const ban = {
    id: uuidv4(),
    userId,
    type,
    until: type === 'temporary' ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null,
    bannedBy: req.user.id,
    createdAt: new Date().toISOString()
  };

  db.insert('bans', ban);
  res.json(ban);
});

app.delete('/api/admin/ban/:userId', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (!['owner', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  db.delete('bans', { userId: req.params.userId });
  res.json({ message: 'Ban removed' });
});

app.post('/api/admin/role', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can assign roles' });
  }

  const { userId, newRole } = req.body;
  
  const existingRole = db.findOne('adminRoles', { userId });
  if (existingRole) {
    db.update('adminRoles', { userId }, { role: newRole });
  } else {
    db.insert('adminRoles', { userId, role: newRole, addedAt: new Date().toISOString() });
  }

  res.json({ message: 'Role assigned', userId, role: newRole });
});

app.delete('/api/admin/role/:userId', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can remove roles' });
  }

  db.delete('adminRoles', { userId: req.params.userId });
  res.json({ message: 'Role removed' });
});

app.get('/api/admin/users', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (!['owner', 'admin', 'moderator'].includes(role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const users = db.read('users').map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    createdAt: u.createdAt,
    role: getUserRole(u.id)
  }));

  res.json(users);
});

app.post('/api/admin/user', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can create users' });
  }

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const existingUsername = db.findOne('users', { username });
  const existingEmail = db.findOne('users', { email });
  if (existingUsername || existingEmail) {
    return res.status(400).json({ error: 'Username or email already exists' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = {
    id: uuidv4(),
    username,
    email,
    password: hashedPassword,
    avatar: null,
    bio: '',
    createdAt: new Date().toISOString(),
    followers: [],
    following: []
  };

  db.insert('users', newUser);
  res.json({ message: 'User created successfully', userId: newUser.id });
});

app.delete('/api/admin/user/:userId', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can delete users' });
  }

  if (req.user.id === req.params.userId) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }

  db.delete('users', { id: req.params.userId });
  db.delete('adminRoles', { userId: req.params.userId });
  db.delete('bans', { userId: req.params.userId });
  
  res.json({ message: 'User deleted successfully' });
});

app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;

  const contactMessage = {
    id: uuidv4(),
    name,
    email,
    subject,
    message,
    status: 'new',
    createdAt: new Date().toISOString()
  };

  db.insert('messages', contactMessage);
  res.json({ message: 'Message sent successfully' });
});

app.get('/api/contact', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (!['owner', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const messages = db.read('messages');
  res.json(messages);
});

app.put('/api/contact/:id', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (!['owner', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { status } = req.body;
  db.update('messages', { id: req.params.id }, { status });
  res.json({ message: 'Message updated' });
});

app.post('/api/follow/:userId', authenticateToken, (req, res) => {
  const currentUser = db.findOne('users', { id: req.user.id });
  const targetUser = db.findOne('users', { id: req.params.userId });

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!currentUser.following) currentUser.following = [];
  if (!targetUser.followers) targetUser.followers = [];

  if (currentUser.following.includes(req.params.userId)) {
    currentUser.following = currentUser.following.filter(id => id !== req.params.userId);
    targetUser.followers = targetUser.followers.filter(id => id !== req.user.id);
  } else {
    currentUser.following.push(req.params.userId);
    targetUser.followers.push(req.user.id);
  }

  db.update('users', { id: req.user.id }, { following: currentUser.following });
  db.update('users', { id: req.params.userId }, { followers: targetUser.followers });

  res.json({ following: currentUser.following.includes(req.params.userId) });
});

app.post('/api/groups', authenticateToken, (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Group name required' });
  }

  const groupId = uuidv4();
  const newGroup = {
    id: groupId,
    name,
    description: description || '',
    ownerId: req.user.id,
    members: [
      {
        userId: req.user.id,
        username: req.user.username,
        role: 'owner',
        joinedAt: new Date().toISOString()
      }
    ],
    banned: [],
    avatar: null,
    postingPermissions: 'admin',
    createdAt: new Date().toISOString()
  };

  db.insert('groups', newGroup);
  res.json(newGroup);
});

app.get('/api/groups', authenticateToken, (req, res) => {
  const groups = db.read('groups');
  const userGroups = groups.filter(g => 
    g.members.some(m => m.userId === req.user.id)
  );

  res.json(userGroups);
});

app.get('/api/groups/:groupId', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const isMember = group.members.some(m => m.userId === req.user.id);
  if (!isMember) {
    return res.status(403).json({ error: 'Not a member of this group' });
  }

  res.json(group);
});

app.put('/api/groups/:groupId', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const userMember = group.members.find(m => m.userId === req.user.id);
  if (!userMember || userMember.role !== 'owner') {
    return res.status(403).json({ error: 'Only group owner can update group' });
  }

  const { name, description, avatar } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (avatar !== undefined) updates.avatar = avatar;

  const updated = db.update('groups', { id: req.params.groupId }, updates);
  res.json(updated);
});

app.delete('/api/groups/:groupId', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  // Check if user has platform admin role
  const adminRoles = db.read('adminRoles');
  const userRole = adminRoles.find(r => r.userId === req.user.id)?.role;
  const isAuthorized = ['admin', 'co-owner', 'secondary-owner', 'owner'].includes(userRole);

  if (!isAuthorized) {
    return res.status(403).json({ error: 'Only platform admins, co-owners, secondary owners, or owner can delete groups' });
  }

  // Delete the group and all its posts
  db.delete('groups', { id: req.params.groupId });
  
  // Delete all posts in this group
  const posts = db.read('groupPosts');
  const groupPosts = posts.filter(p => p.groupId === req.params.groupId);
  groupPosts.forEach(p => db.delete('groupPosts', { id: p.id }));

  res.json({ message: 'Group deleted successfully' });
});

app.post('/api/groups/:groupId/invite', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const userMember = group.members.find(m => m.userId === req.user.id);
  if (!userMember || !['owner', 'admin'].includes(userMember.role)) {
    return res.status(403).json({ error: 'Only owner/admin can invite members' });
  }

  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'User IDs required' });
  }

  const addedUsers = [];
  for (const userId of userIds) {
    const user = db.findOne('users', { id: userId });
    if (!user) continue;

    const alreadyMember = group.members.some(m => m.userId === userId);
    const isBanned = group.banned && group.banned.some(b => b.userId === userId);
    
    if (!alreadyMember && !isBanned) {
      group.members.push({
        userId,
        username: user.username,
        role: 'member',
        joinedAt: new Date().toISOString()
      });
      addedUsers.push(userId);
    }
  }

  db.update('groups', { id: req.params.groupId }, { members: group.members });
  res.json({ message: `Added ${addedUsers.length} members`, addedUsers });
});

app.delete('/api/groups/:groupId/members/:userId', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const userMember = group.members.find(m => m.userId === req.user.id);
  if (!userMember || !['owner', 'admin', 'moderator'].includes(userMember.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  if (req.params.userId === group.ownerId && req.user.id !== group.ownerId) {
    return res.status(403).json({ error: 'Cannot remove group owner' });
  }

  group.members = group.members.filter(m => m.userId !== req.params.userId);
  db.update('groups', { id: req.params.groupId }, { members: group.members });
  res.json({ message: 'Member removed' });
});

app.put('/api/groups/:groupId/members/:userId/role', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const userMember = group.members.find(m => m.userId === req.user.id);
  if (!userMember || !['owner', 'admin'].includes(userMember.role)) {
    return res.status(403).json({ error: 'Only owner/admin can assign roles' });
  }

  const { role } = req.body;
  const validRoles = ['member', 'moderator', 'admin'];

  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const memberIndex = group.members.findIndex(m => m.userId === req.params.userId);
  if (memberIndex === -1) {
    return res.status(404).json({ error: 'Member not found' });
  }

  if (group.members[memberIndex].role === 'owner') {
    return res.status(400).json({ error: 'Cannot change owner role' });
  }

  group.members[memberIndex].role = role;
  db.update('groups', { id: req.params.groupId }, { members: group.members });
  res.json({ message: 'Role updated', member: group.members[memberIndex] });
});

app.post('/api/groups/:groupId/transfer-ownership', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  if (group.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Only group owner can transfer ownership' });
  }

  const { newOwnerId } = req.body;
  if (!newOwnerId) {
    return res.status(400).json({ error: 'New owner ID is required' });
  }

  const newOwnerMember = group.members.find(m => m.userId === newOwnerId);
  if (!newOwnerMember) {
    return res.status(404).json({ error: 'User is not a member of this group' });
  }

  const currentOwnerIndex = group.members.findIndex(m => m.userId === group.ownerId);
  const newOwnerIndex = group.members.findIndex(m => m.userId === newOwnerId);

  if (currentOwnerIndex !== -1) {
    group.members[currentOwnerIndex].role = 'admin';
  }
  group.members[newOwnerIndex].role = 'owner';

  group.ownerId = newOwnerId;

  db.update('groups', { id: req.params.groupId }, { 
    ownerId: group.ownerId,
    members: group.members 
  });

  res.json({ message: 'Ownership transferred successfully', group });
});

app.get('/api/groups/:groupId/members', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const isMember = group.members.some(m => m.userId === req.user.id);
  if (!isMember) {
    return res.status(403).json({ error: 'Not a member of this group' });
  }

  res.json(group.members);
});

app.post('/api/groups/:groupId/ban/:userId', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const userMember = group.members.find(m => m.userId === req.user.id);
  if (!userMember || !['owner', 'admin'].includes(userMember.role)) {
    return res.status(403).json({ error: 'Only owner/admin can ban members' });
  }

  const targetUser = db.findOne('users', { id: req.params.userId });
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (req.params.userId === group.ownerId) {
    return res.status(400).json({ error: 'Cannot ban group owner' });
  }

  const isBanned = group.banned && group.banned.some(b => b.userId === req.params.userId);
  if (isBanned) {
    return res.status(400).json({ error: 'User is already banned' });
  }

  if (!group.banned) {
    group.banned = [];
  }

  group.banned.push({
    userId: req.params.userId,
    username: targetUser.username,
    bannedAt: new Date().toISOString(),
    bannedBy: req.user.id
  });

  group.members = group.members.filter(m => m.userId !== req.params.userId);
  
  db.update('groups', { id: req.params.groupId }, { 
    members: group.members,
    banned: group.banned
  });

  res.json({ message: 'User banned successfully' });
});

app.delete('/api/groups/:groupId/ban/:userId', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  if (group.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Only group owner can unban members' });
  }

  if (!group.banned) {
    group.banned = [];
  }

  const userWasBanned = group.banned.some(b => b.userId === req.params.userId);
  if (!userWasBanned) {
    return res.status(400).json({ error: 'User is not banned' });
  }

  group.banned = group.banned.filter(b => b.userId !== req.params.userId);
  db.update('groups', { id: req.params.groupId }, { banned: group.banned });
  res.json({ message: 'User unbanned successfully' });
});

app.get('/api/groups/:groupId/banned', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const userMember = group.members.find(m => m.userId === req.user.id);
  if (!userMember || !['owner', 'admin'].includes(userMember.role)) {
    return res.status(403).json({ error: 'Only owner/admin can view banned members' });
  }

  res.json(group.banned || []);
});

app.get('/api/admin/groups', authenticateToken, (req, res) => {
  const adminRole = db.findOne('adminRoles', { userId: req.user.id });
  if (!adminRole || !['owner', 'admin', 'co-owner', 'secondary-owner'].includes(adminRole.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const groups = db.read('groups');
  res.json(groups);
});

app.put('/api/groups/:groupId/posting-permissions', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const userMember = group.members.find(m => m.userId === req.user.id);
  if (!userMember || userMember.role !== 'owner') {
    return res.status(403).json({ error: 'Only group owner can update posting permissions' });
  }

  const { postingPermissions } = req.body;
  const validPermissions = ['moderator', 'admin', 'owner', 'everyone'];

  if (!postingPermissions || !validPermissions.includes(postingPermissions)) {
    return res.status(400).json({ error: 'Invalid posting permission' });
  }

  const updated = db.update('groups', { id: req.params.groupId }, { postingPermissions });
  res.json(updated);
});

app.put('/api/admin/groups/:groupId', authenticateToken, (req, res) => {
  const adminRole = db.findOne('adminRoles', { userId: req.user.id });
  if (!adminRole || !['owner', 'admin', 'co-owner', 'secondary-owner'].includes(adminRole.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const { name, description, avatar, postingPermissions } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (avatar !== undefined) updates.avatar = avatar;
  if (postingPermissions) updates.postingPermissions = postingPermissions;

  const updated = db.update('groups', { id: req.params.groupId }, updates);
  res.json(updated);
});

app.post('/api/groups/:groupId/posts', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const userMember = group.members.find(m => m.userId === req.user.id);
  if (!userMember) {
    return res.status(403).json({ error: 'Not a member of this group' });
  }

  const permissions = group.postingPermissions || 'everyone';
  let canPost = false;

  if (permissions === 'everyone') {
    canPost = true;
  } else if (permissions === 'moderator') {
    canPost = ['owner', 'admin', 'moderator'].includes(userMember.role);
  } else if (permissions === 'admin') {
    canPost = ['owner', 'admin'].includes(userMember.role);
  } else if (permissions === 'owner') {
    canPost = userMember.role === 'owner';
  }

  if (!canPost) {
    return res.status(403).json({ error: 'You do not have permission to post in this group' });
  }

  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Post content is required' });
  }

  const postId = uuidv4();
  const author = db.findOne('users', { id: req.user.id });

  const newPost = {
    id: postId,
    groupId: req.params.groupId,
    authorId: req.user.id,
    author: req.user.username,
    avatar: author?.avatar,
    content: content.trim(),
    likes: [],
    comments: [],
    createdAt: new Date().toISOString()
  };

  let groupPosts = db.read('groupPosts') || [];
  groupPosts.push(newPost);
  db.write('groupPosts', groupPosts);

  res.json(newPost);
});

app.get('/api/groups/:groupId/posts', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const userMember = group.members.find(m => m.userId === req.user.id);
  if (!userMember) {
    return res.status(403).json({ error: 'Not a member of this group' });
  }

  const groupPosts = (db.read('groupPosts') || []).filter(p => p.groupId === req.params.groupId);
  const posts = groupPosts.map(post => ({
    ...post,
    isLiked: post.likes.includes(req.user.id),
    likeCount: post.likes.length
  }));

  res.json(posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.delete('/api/groups/:groupId/posts/:postId', authenticateToken, (req, res) => {
  const group = db.findOne('groups', { id: req.params.groupId });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const userMember = group.members.find(m => m.userId === req.user.id);
  if (!userMember) {
    return res.status(403).json({ error: 'Not a member of this group' });
  }

  const groupPosts = db.read('groupPosts') || [];
  const post = groupPosts.find(p => p.id === req.params.postId);

  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (post.authorId !== req.user.id && userMember.role !== 'owner' && userMember.role !== 'admin') {
    return res.status(403).json({ error: 'You cannot delete this post' });
  }

  const updated = groupPosts.filter(p => p.id !== req.params.postId);
  db.write('groupPosts', updated);

  res.json({ message: 'Post deleted' });
});

app.get('/api/search', authenticateToken, (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.json([]);

  const query = q.toLowerCase().trim();
  const users = db.read('users').filter(u => 
    u.id !== req.user.id && (
      u.username.toLowerCase().includes(query) ||
      (u.bio && u.bio.toLowerCase().includes(query))
    )
  );

  res.json(users.map(u => ({ 
    id: u.id, 
    username: u.username, 
    email: u.email,
    avatar: u.avatar,
    bio: u.bio
  })));
});

app.post('/api/conversations', authenticateToken, (req, res) => {
  const { participantIds } = req.body;
  
  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ error: 'Invalid participants' });
  }

  const allParticipants = [...new Set([req.user.id, ...participantIds])].sort();
  
  const conversations = db.read('conversations');
  let existing = conversations.find(c => 
    c.participants.length === allParticipants.length &&
    c.participants.every(p => allParticipants.includes(p))
  );

  if (existing) {
    return res.json(existing);
  }

  const conversation = {
    id: uuidv4(),
    participants: allParticipants,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastMessage: null,
    lastMessageTime: null
  };

  db.insert('conversations', conversation);
  res.json(conversation);
});

app.get('/api/conversations', authenticateToken, (req, res) => {
  const conversations = db.read('conversations').filter(c => 
    c.participants.includes(req.user.id)
  );

  const users = db.read('users');
  const chatMessages = db.read('chatMessages');

  const enriched = conversations.map(conv => {
    const participants = conv.participants
      .map(id => users.find(u => u.id === id))
      .filter(Boolean)
      .map(u => ({ id: u.id, username: u.username, avatar: u.avatar }));

    const otherParticipants = participants.filter(p => p.id !== req.user.id);

    const messages = chatMessages.filter(m => m.conversationId === conv.id);
    const lastMsg = messages[messages.length - 1];

    return {
      ...conv,
      participants,
      otherParticipants,
      messageCount: messages.length,
      lastMessage: lastMsg?.content || null,
      lastMessageTime: lastMsg?.timestamp || null
    };
  }).sort((a, b) => 
    new Date(b.updatedAt) - new Date(a.updatedAt)
  );

  res.json(enriched);
});

app.get('/api/conversations/:conversationId', authenticateToken, (req, res) => {
  const conversation = db.read('conversations').find(c => c.id === req.params.conversationId);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  if (!conversation.participants.includes(req.user.id)) {
    return res.status(403).json({ error: 'Not a participant' });
  }

  const users = db.read('users');
  const messages = db.read('chatMessages').filter(m => m.conversationId === req.params.conversationId);

  const participants = conversation.participants
    .map(id => users.find(u => u.id === id))
    .filter(Boolean)
    .map(u => ({ id: u.id, username: u.username, avatar: u.avatar }));

  res.json({
    ...conversation,
    participants,
    messages
  });
});

app.post('/api/conversations/:conversationId/messages', authenticateToken, (req, res) => {
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content required' });
  }

  const conversation = db.read('conversations').find(c => c.id === req.params.conversationId);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  if (!conversation.participants.includes(req.user.id)) {
    return res.status(403).json({ error: 'Not a participant' });
  }

  const message = {
    id: uuidv4(),
    conversationId: req.params.conversationId,
    authorId: req.user.id,
    authorName: req.user.username,
    authorAvatar: req.user.avatar,
    content: content.trim(),
    timestamp: new Date().toISOString(),
    edited: false,
    editedAt: null
  };

  db.insert('chatMessages', message);

  conversation.lastMessage = content.trim();
  conversation.lastMessageTime = message.timestamp;
  conversation.updatedAt = new Date().toISOString();
  db.update('conversations', { id: req.params.conversationId }, conversation);

  res.json(message);
});

app.get('/api/conversations/:conversationId/messages', authenticateToken, (req, res) => {
  const conversation = db.read('conversations').find(c => c.id === req.params.conversationId);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  if (!conversation.participants.includes(req.user.id)) {
    return res.status(403).json({ error: 'Not a participant' });
  }

  const messages = db.read('chatMessages')
    .filter(m => m.conversationId === req.params.conversationId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  res.json(messages);
});

app.put('/api/conversations/:conversationId/messages/:messageId', authenticateToken, (req, res) => {
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content required' });
  }

  const messages = db.read('chatMessages');
  const message = messages.find(m => m.id === req.params.messageId);

  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  if (message.authorId !== req.user.id) {
    return res.status(403).json({ error: 'Can only edit your own messages' });
  }

  message.content = content.trim();
  message.edited = true;
  message.editedAt = new Date().toISOString();

  db.update('chatMessages', { id: req.params.messageId }, message);
  res.json(message);
});

app.delete('/api/conversations/:conversationId/messages/:messageId', authenticateToken, (req, res) => {
  const messages = db.read('chatMessages');
  const message = messages.find(m => m.id === req.params.messageId);

  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  if (message.authorId !== req.user.id) {
    return res.status(403).json({ error: 'Can only delete your own messages' });
  }

  db.delete('chatMessages', { id: req.params.messageId });
  res.json({ message: 'Message deleted' });
});

app.post('/api/conversations/:conversationId/add-participants', authenticateToken, (req, res) => {
  const { userIds } = req.body;

  if (!userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ error: 'Invalid user IDs' });
  }

  const conversation = db.read('conversations').find(c => c.id === req.params.conversationId);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  if (!conversation.participants.includes(req.user.id)) {
    return res.status(403).json({ error: 'Not a participant' });
  }

  const newParticipants = [...new Set([...conversation.participants, ...userIds])];
  conversation.participants = newParticipants.sort();
  conversation.updatedAt = new Date().toISOString();

  db.update('conversations', { id: req.params.conversationId }, conversation);
  res.json(conversation);
});

app.post('/api/friends/request/:userId', authenticateToken, (req, res) => {
  if (req.user.id === req.params.userId) {
    return res.status(400).json({ error: 'Cannot send friend request to yourself' });
  }

  const targetUser = db.findOne('users', { id: req.params.userId });
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const requestingUser = db.findOne('users', { id: req.user.id });
  if (!requestingUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isMutualFriend = requestingUser.friends && requestingUser.friends.includes(req.params.userId) &&
                         targetUser.friends && targetUser.friends.includes(req.user.id);
  if (isMutualFriend) {
    return res.status(400).json({ error: 'Already friends with this user' });
  }

  const friendRequests = db.read('friendRequests');
  const existingRequest = friendRequests.find(r => 
    (r.fromId === req.user.id && r.toId === req.params.userId) ||
    (r.fromId === req.params.userId && r.toId === req.user.id)
  );

  if (existingRequest) {
    return res.status(400).json({ error: 'Friend request already exists' });
  }

  const newRequest = {
    id: uuidv4(),
    fromId: req.user.id,
    fromUsername: requestingUser.username,
    toId: req.params.userId,
    toUsername: targetUser.username,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.insert('friendRequests', newRequest);
  res.json(newRequest);
});

app.get('/api/friends/requests', authenticateToken, (req, res) => {
  const friendRequests = db.read('friendRequests');
  const pendingRequests = friendRequests.filter(r => r.toId === req.user.id && r.status === 'pending');
  res.json(pendingRequests);
});

app.post('/api/friends/requests/:requestId/accept', authenticateToken, (req, res) => {
  const friendRequest = db.findOne('friendRequests', { id: req.params.requestId });
  
  if (!friendRequest) {
    return res.status(404).json({ error: 'Request not found' });
  }

  if (friendRequest.toId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot accept this request' });
  }

  const fromUser = db.findOne('users', { id: friendRequest.fromId });
  const toUser = db.findOne('users', { id: friendRequest.toId });

  if (!fromUser || !toUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!fromUser.friends) fromUser.friends = [];
  if (!toUser.friends) toUser.friends = [];

  if (!fromUser.friends.includes(toUser.id)) {
    fromUser.friends.push(toUser.id);
  }
  if (!toUser.friends.includes(fromUser.id)) {
    toUser.friends.push(fromUser.id);
  }

  db.update('users', { id: fromUser.id }, fromUser);
  db.update('users', { id: toUser.id }, toUser);
  db.update('friendRequests', { id: req.params.requestId }, { status: 'accepted' });

  res.json({ message: 'Friend request accepted' });
});

app.post('/api/friends/requests/:requestId/reject', authenticateToken, (req, res) => {
  const friendRequest = db.findOne('friendRequests', { id: req.params.requestId });
  
  if (!friendRequest) {
    return res.status(404).json({ error: 'Request not found' });
  }

  if (friendRequest.toId !== req.user.id) {
    return res.status(403).json({ error: 'Cannot reject this request' });
  }

  db.update('friendRequests', { id: req.params.requestId }, { status: 'rejected' });
  res.json({ message: 'Friend request rejected' });
});

app.delete('/api/friends/:userId', authenticateToken, (req, res) => {
  const user = db.findOne('users', { id: req.user.id });
  const friendToRemove = db.findOne('users', { id: req.params.userId });

  if (!user || !friendToRemove) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!user.friends || !user.friends.includes(req.params.userId)) {
    return res.status(400).json({ error: 'Not friends with this user' });
  }

  user.friends = user.friends.filter(id => id !== req.params.userId);
  friendToRemove.friends = friendToRemove.friends.filter(id => id !== req.user.id);

  db.update('users', { id: req.user.id }, user);
  db.update('users', { id: req.params.userId }, friendToRemove);

  res.json({ message: 'Friend removed' });
});

app.get('/api/friends', authenticateToken, (req, res) => {
  const user = db.findOne('users', { id: req.user.id });
  
  if (!user || !user.friends) {
    return res.json([]);
  }

  const friends = user.friends.map(friendId => {
    const friend = db.findOne('users', { id: friendId });
    if (friend) {
      return {
        id: friend.id,
        username: friend.username,
        avatar: friend.avatar,
        bio: friend.bio
      };
    }
    return null;
  }).filter(f => f !== null);

  res.json(friends);
});

app.get('/api/friends/status/:userId', authenticateToken, (req, res) => {
  const currentUser = db.findOne('users', { id: req.user.id });
  const otherUser = db.findOne('users', { id: req.params.userId });

  if (!currentUser || !otherUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (req.user.id === req.params.userId) {
    return res.json({ status: 'self' });
  }

  const isMutualFriend = currentUser.friends && currentUser.friends.includes(req.params.userId) &&
                         otherUser.friends && otherUser.friends.includes(req.user.id);

  if (isMutualFriend) {
    return res.json({ status: 'friends' });
  }

  const friendRequests = db.read('friendRequests');
  const pendingRequest = friendRequests.find(r =>
    (r.fromId === req.user.id && r.toId === req.params.userId && r.status === 'pending') ||
    (r.fromId === req.params.userId && r.toId === req.user.id && r.status === 'pending')
  );

  if (pendingRequest) {
    return res.json({ 
      status: 'pending',
      direction: pendingRequest.fromId === req.user.id ? 'outgoing' : 'incoming',
      requestId: pendingRequest.id
    });
  }

  res.json({ status: 'none' });
});

// Registration cap management endpoints
app.get('/api/admin/registration-cap', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can view registration cap' });
  }

  const capData = db.findOne('registrationCap', { id: 'default' });
  if (!capData) {
    return res.status(404).json({ error: 'Registration cap data not found' });
  }

  res.json(capData);
});

app.post('/api/admin/registration-cap/set', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can set registration cap' });
  }

  const { cap } = req.body;

  if (cap === null || cap === undefined || cap < 1) {
    return res.status(400).json({ error: 'Cap must be a positive number' });
  }

  const capData = db.findOne('registrationCap', { id: 'default' });
  if (capData) {
    db.update('registrationCap', { id: 'default' }, { cap: cap, currentCount: 0 });
  }

  res.json({ message: 'Registration cap set successfully', cap, currentCount: 0 });
});

app.post('/api/admin/registration-cap/remove', authenticateToken, (req, res) => {
  const role = getUserRole(req.user.id);
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can remove registration cap' });
  }

  const capData = db.findOne('registrationCap', { id: 'default' });
  if (capData) {
    db.update('registrationCap', { id: 'default' }, { cap: null, currentCount: 0 });
  }

  res.json({ message: 'Registration cap removed successfully' });
});

// Store FCM token for a user (called from frontend after user logs in)
app.post('/api/auth/store-fcm-token', authenticateToken, (req, res) => {
  const { fcmToken } = req.body;
  if (!fcmToken) return res.status(400).json({ error: 'FCM token required' });
  const user = db.findOne('users', { id: req.user.id });
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.fcmToken = fcmToken;
  db.update('users', { id: user.id }, user);
  console.log(`store-fcm-token: saved token for user ${user.id}: ${fcmToken}`);
  res.json({ message: 'FCM token stored successfully', fcmToken });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message, err.stack);
  res.status(500).json({ error: 'Internal server error: ' + err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
