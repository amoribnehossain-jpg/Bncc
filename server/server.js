require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const BCRYPT_SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'password';

const users = new Map();
let defaultPasswordHash = null;

async function initializeUsers() {
  defaultPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_SALT_ROUNDS);
  
  users.set('001', {
    name: 'John Doe',
    cadetNo: '001',
    password: defaultPasswordHash,
    rollSec: '12A',
    batch: '02',
    rank: 'CUO',
    shift: 'EV',
    nationality: 'Bangladeshi',
    sex: 'Male',
    attendance: [{ date: '2026-11-20', status: 'Present' }, { date: '2026-11-21', status: 'Present' }],
    lastUpdated: new Date().toISOString()
  });
  users.set('002', {
    name: 'Jane Smith',
    cadetNo: '002',
    password: defaultPasswordHash,
    rollSec: '11B',
    batch: '01',
    rank: 'SGT',
    shift: 'BV',
    nationality: 'Bangladeshi',
    sex: 'Female',
    attendance: [{ date: '2026-11-20', status: 'Absent' }, { date: '2026-11-21', status: 'Present' }],
    lastUpdated: new Date().toISOString()
  });
  users.set('25561220', {
    name: 'Amor Ibne Hossain',
    cadetNo: '25561220',
    password: defaultPasswordHash,
    rollSec: '3279 H',
    batch: '2027',
    rank: 'Cadet Lance Corporal',
    shift: 'BV',
    nationality: 'Bangladeshi',
    sex: 'Male',
    attendance: [],
    lastUpdated: new Date().toISOString()
  });
}

app.post('/login', async (req, res) => {
  const { name, cadetNo, password } = req.body;
  
  if (!name || !cadetNo || !password) {
    return res.status(400).json({ error: 'Name, Cadet No, and Password are required' });
  }

  const user = users.get(cadetNo);
  if (!user) {
    return res.status(404).json({ error: 'Cadet not found' });
  }

  if (user.name.toLowerCase() !== name.toLowerCase()) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = await bcrypt.compare(password, user.password);
  
  if (isValid) {
    const token = Buffer.from(user.cadetNo).toString('base64');
    res.json({ 
      message: 'Login successful',
      token: token,
      cadet: {
        name: user.name,
        cadetNo: user.cadetNo,
        rollSec: user.rollSec,
        batch: user.batch,
        rank: user.rank,
        shift: user.shift,
        nationality: user.nationality,
        sex: user.sex,
        attendance: user.attendance,
        lastUpdated: user.lastUpdated
      }
    });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/register', async (req, res) => {
  const { name, cadetNo, password, rollSec, batch, rank, shift, nationality, sex } = req.body;
  
  if (!name || !cadetNo || !password) {
    return res.status(400).json({ error: 'Name, Cadet No, and Password are required' });
  }

  if (users.has(cadetNo)) {
    return res.status(409).json({ error: 'Cadet No already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  
  users.set(cadetNo, {
    name,
    cadetNo,
    password: hashedPassword,
    rollSec: rollSec || '',
    batch: batch || '',
    rank: rank || 'Cadet',
    shift: shift || 'EV',
    nationality: nationality || 'Bangladeshi',
    sex: sex || 'Male',
    attendance: [],
    lastUpdated: new Date().toISOString()
  });

  res.status(201).json({ message: 'User registered successfully', cadetNo });
});

initializeUsers().then(() => {
  app.listen(3000, () => console.log('Server running on port 3000'));
});