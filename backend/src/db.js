const fs = require('fs');
const path = require('path');

let dataDir;

const tryCreateDirectory = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return dirPath;
  } catch (err) {
    console.warn(`Warning: Could not create data directory at ${dirPath}:`, err.message);
    return null;
  }
};
// Allow overriding the data directory with the DATA_DIR environment variable.
// This makes it possible to store runtime data outside the repository and
// restrict filesystem permissions to a dedicated service account.
const localDataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '../data');
dataDir = tryCreateDirectory(localDataDir);

const dbFiles = dataDir ? {
  users: path.join(dataDir, 'users.json'),
  posts: path.join(dataDir, 'posts.json'),
  comments: path.join(dataDir, 'comments.json'),
  reports: path.join(dataDir, 'reports.json'),
  bans: path.join(dataDir, 'bans.json'),
  adminRoles: path.join(dataDir, 'adminRoles.json'),
  messages: path.join(dataDir, 'messages.json'),
  shares: path.join(dataDir, 'shares.json'),
  groups: path.join(dataDir, 'groups.json'),
  groupPosts: path.join(dataDir, 'groupPosts.json'),
  conversations: path.join(dataDir, 'conversations.json'),
  chatMessages: path.join(dataDir, 'chatMessages.json'),
  friendRequests: path.join(dataDir, 'friendRequests.json'),
  registrationCap: path.join(dataDir, 'registrationCap.json')
} : {};

const initializeDB = () => {
  try {
    if (!dataDir || Object.keys(dbFiles).length === 0) {
      console.log('Database persistence disabled - using in-memory storage');
      inMemoryDb.adminRoles = [];
      inMemoryDb.users = [];
      inMemoryDb.posts = [];
      inMemoryDb.comments = [];
      inMemoryDb.reports = [];
      inMemoryDb.bans = [];
      inMemoryDb.messages = [];
      inMemoryDb.shares = [];
      inMemoryDb.groups = [];
      inMemoryDb.groupPosts = [];
      inMemoryDb.conversations = [];
      inMemoryDb.chatMessages = [];
      inMemoryDb.friendRequests = [];
      inMemoryDb.registrationCap = [];
      
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync('admin', 10);
      inMemoryDb.users.push({
        id: '1',
        username: 'admin',
        email: 'admin@sociallyapp.org',
        password: hashedPassword,
        avatar: null,
        bio: 'Platform Owner',
        createdAt: new Date().toISOString(),
        followers: [],
        following: [],
        friends: []
      });
      inMemoryDb.adminRoles.push({
        userId: '1',
        role: 'owner',
        addedAt: new Date().toISOString()
      });
      inMemoryDb.registrationCap.push({
        id: 'default',
        cap: null,
        currentCount: 0
      });
      return;
    }

    Object.keys(dbFiles).forEach(key => {
      if (!fs.existsSync(dbFiles[key])) {
        fs.writeFileSync(dbFiles[key], JSON.stringify([], null, 2));
      }
    });

    const adminRoles = JSON.parse(fs.readFileSync(dbFiles.adminRoles, 'utf8'));
    const users = JSON.parse(fs.readFileSync(dbFiles.users, 'utf8'));

    users.forEach(user => {
      if (!user.friends) {
        user.friends = [];
      }
    });
    fs.writeFileSync(dbFiles.users, JSON.stringify(users, null, 2));

    const adminExists = users.some(u => u.username === 'admin');
    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync('admin', 10);
      const adminUser = {
        id: '1',
        username: 'admin',
        email: 'admin@sociallyapp.org',
        password: hashedPassword,
        avatar: null,
        bio: 'Platform Owner',
        createdAt: new Date().toISOString(),
        followers: [],
        following: [],
        friends: []
      };
      users.push(adminUser);
      fs.writeFileSync(dbFiles.users, JSON.stringify(users, null, 2));

      const adminRole = {
        userId: '1',
        role: 'owner',
        addedAt: new Date().toISOString()
      };
      adminRoles.push(adminRole);
      fs.writeFileSync(dbFiles.adminRoles, JSON.stringify(adminRoles, null, 2));
    }

    // Initialize registrationCap if it doesn't exist
    if (!fs.existsSync(dbFiles.registrationCap)) {
      const registrationCapData = [
        {
          id: 'default',
          cap: null,
          currentCount: 0
        }
      ];
      fs.writeFileSync(dbFiles.registrationCap, JSON.stringify(registrationCapData, null, 2));
    }
  } catch (err) {
    console.warn('Warning: Could not initialize database:', err.message);
  }
};

const inMemoryDb = {};

const db = {
  read: (collection) => {
    if (!inMemoryDb[collection]) {
      inMemoryDb[collection] = [];
    }
    if (!dbFiles[collection]) {
      return inMemoryDb[collection];
    }
    try {
      const data = fs.readFileSync(dbFiles[collection], 'utf8');
      inMemoryDb[collection] = JSON.parse(data);
      return inMemoryDb[collection];
    } catch (err) {
      return inMemoryDb[collection];
    }
  },

  write: (collection, data) => {
    inMemoryDb[collection] = data;
    if (!dbFiles[collection]) {
      return;
    }
    try {
      fs.writeFileSync(dbFiles[collection], JSON.stringify(data, null, 2));
    } catch (err) {
      console.warn('Warning: Could not write to database file:', err.message);
    }
  },

  findOne: (collection, query) => {
    const data = db.read(collection);
    return data.find(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
  },

  find: (collection, query) => {
    const data = db.read(collection);
    return data.filter(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
  },

  insert: (collection, item) => {
    const data = db.read(collection);
    data.push(item);
    db.write(collection, data);
    return item;
  },

  update: (collection, query, updates) => {
    const data = db.read(collection);
    const index = data.findIndex(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
    if (index !== -1) {
      data[index] = { ...data[index], ...updates };
      db.write(collection, data);
      return data[index];
    }
    return null;
  },

  delete: (collection, query) => {
    const data = db.read(collection);
    const filtered = data.filter(item => {
      return !Object.keys(query).every(key => item[key] === query[key]);
    });
    db.write(collection, filtered);
  }
};

module.exports = { db, initializeDB };
