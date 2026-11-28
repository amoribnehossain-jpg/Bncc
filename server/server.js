require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const BCRYPT_SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'password';
const JWT_SECRET = process.env.JWT_SECRET || 'bmarpc-dev-secret-change-in-production';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('FATAL: SUPABASE_URL or SUPABASE_SECRET_KEY is not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Create uploads directory if not exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Seed default users on first deploy (only if table is empty)
async function seedDefaultUsers() {
  const { count } = await supabase
    .from('cadets')
    .select('*', { count: 'exact', head: true });

  if (count > 0) return;

  const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_SALT_ROUNDS);

  const seedUsers = [
    { name: 'John Doe', cadet_no: '001', password_hash: defaultHash, roll_sec: '12A', batch: '02', rank: 'CUO', shift: 'EV', nationality: 'Bangladeshi', sex: 'Male', is_admin: false },
    { name: 'Jane Smith', cadet_no: '002', password_hash: defaultHash, roll_sec: '11B', batch: '01', rank: 'SGT', shift: 'BV', nationality: 'Bangladeshi', sex: 'Female', is_admin: false },
    { name: 'Amor Ibne Hossain', cadet_no: '25561220', password_hash: defaultHash, roll_sec: '3279 H', batch: '2027', rank: 'Cadet Lance Corporal', shift: 'BV', nationality: 'Bangladeshi', sex: 'Male', is_admin: true },
  ];

  const { error } = await supabase.from('cadets').insert(seedUsers);
  if (error) console.error('Seed error:', error.message);
  else console.log('Seeded default users');
}

app.get('/', (req, res) => res.send('Server running'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve uploaded files
app.use('/uploads', express.static(uploadDir));

// ---------- Auth / RBAC ----------

// Reads the JWT from the Authorization header, verifies it, and attaches the
// decoded payload to req. Sets req.user = null when the token is absent/invalid.
function attachUser(req, res, next) {
  req.user = null;
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
  } catch (e) {
    req.user = null;
  }
  next();
}

// Guards admin-only routes: a valid JWT whose is_admin flag is true.
function verifyAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Attach the decoded JWT (if any) to every request.
app.use(attachUser);

app.post('/login', async (req, res) => {
  const { name, cadetNo, password } = req.body;

  if (!name || !cadetNo || !password) {
    return res.status(400).json({ error: 'Name, Cadet No, and Password are required' });
  }

  const { data: rows, error } = await supabase
    .from('cadets')
    .select('*')
    .eq('cadet_no', cadetNo)
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'Cadet not found' });

  const cadet = rows[0];
  if (cadet.name.toLowerCase() !== name.toLowerCase()) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = await bcrypt.compare(password, cadet.password_hash);
  if (!isValid) return res.status(401).json({ error: 'Invalid password' });

  const { password_hash, ...safe } = cadet;

  const token = jwt.sign(
    {
      id: cadet.id,
      cadetNo: cadet.cadet_no,
      name: cadet.name,
      is_admin: Boolean(cadet.is_admin),
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    message: 'Login successful',
    token,
    cadet: {
      ...safe,
      is_admin: Boolean(cadet.is_admin),
      attendance: safe.attendance || [],
      lastUpdated: safe.last_updated || safe.created_at
    }
  });
});

// ---------- Register ----------

app.post('/register', verifyAdmin, upload.single('photo'), async (req, res) => {
  const { name, cadetNo, password, rollSec, batch, rank, shift, nationality, sex } = req.body;

  if (!name || !cadetNo || !password) {
    return res.status(400).json({ error: 'Name, Cadet No, and Password are required' });
  }

  const { data: existing } = await supabase
    .from('cadets')
    .select('id')
    .eq('cadet_no', cadetNo)
    .limit(1);

  if (existing && existing.length > 0) {
    return res.status(409).json({ error: 'Cadet No already exists' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  let photoUrl = '';
  if (req.file) {
    photoUrl = `/uploads/${req.file.filename}`;
  }

  const { error } = await supabase.from('cadets').insert({
    name,
    cadet_no: cadetNo,
    password_hash: passwordHash,
    roll_sec: rollSec || '',
    batch: batch || '',
    rank: rank || 'Cadet',
    shift: shift || 'EV',
    nationality: nationality || 'Bangladeshi',
    sex: sex || 'Male',
    photo_url: photoUrl,
  });

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ message: 'User registered successfully', cadetNo, photoUrl });
});

// ---------- Notices ----------

app.get('/notices', async (req, res) => {
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const mapped = (data || []).map((n, i) => ({
    _id: i + 1,
    id: n.id,
    title: n.title,
    content: n.content,
    type: n.type || 'info',
    imageUrl: n.image_url || '',
    createdAt: n.created_at,
  }));

  res.json({ notices: mapped });
});

app.post('/notices', verifyAdmin, upload.single('image'), async (req, res) => {
  const { title, content, type } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  let imageUrl = '';
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  }

  const { data, error } = await supabase
    .from('notices')
    .insert({ title, content, type: type || 'info', image_url: imageUrl })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({
    message: 'Notice added successfully',
    notice: {
      _id: 1,
      id: data.id,
      title: data.title,
      content: data.content,
      type: data.type,
      imageUrl: data.image_url || '',
      createdAt: data.created_at,
    },
  });
});

app.delete('/notices/:id', verifyAdmin, async (req, res) => {
  const { data: deleted, error } = await supabase
    .from('notices')
    .delete({ eq: 'id', value: req.params.id })
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (deleted.length === 0) return res.status(404).json({ error: 'Notice not found' });

  res.json({ message: 'Notice deleted successfully', notice: deleted[0] });
});

// ---------- Students / Cadets ----------

app.get('/students', async (req, res) => {
  const { data, error } = await supabase.from('cadets').select('*');
  if (error) return res.status(500).json({ error: error.message });

  const students = (data || []).map(({ password_hash, ...safe }) => ({
    ...safe,
    cadetNo: safe.cadet_no,
    rollSec: safe.roll_sec,
    photoUrl: safe.photo_url,
    lastUpdated: safe.last_updated,
  }));

  res.json({ students });
});

app.get('/students/:cadetNo', async (req, res) => {
  const { data, error } = await supabase
    .from('cadets')
    .select('*')
    .eq('cadet_no', req.params.cadetNo)
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Cadet not found' });

  const { password_hash, ...safe } = data[0];
  res.json({
    cadet: {
      ...safe,
      cadetNo: safe.cadet_no,
      rollSec: safe.roll_sec,
      photoUrl: safe.photo_url,
      lastUpdated: safe.last_updated,
    },
  });
});

app.put('/students/:cadetNo', verifyAdmin, upload.single('photo'), async (req, res) => {
  const { name, rollSec, batch, rank, shift, nationality, sex } = req.body;

  const updatePayload = {};
  if (name) updatePayload.name = name;
  if (rollSec) updatePayload.roll_sec = rollSec;
  if (batch) updatePayload.batch = batch;
  if (rank) updatePayload.rank = rank;
  if (shift) updatePayload.shift = shift;
  if (nationality) updatePayload.nationality = nationality;
  if (sex) updatePayload.sex = sex;
  if (req.file) updatePayload.photo_url = `/uploads/${req.file.filename}`;

  updatePayload.last_updated = new Date().toISOString();

  const { data, error } = await supabase
    .from('cadets')
    .update(updatePayload)
    .eq('cadet_no', req.params.cadetNo)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (data.length === 0) return res.status(404).json({ error: 'Cadet not found' });

  const { password_hash, ...safe } = data[0];
  res.json({
    message: 'Cadet updated successfully',
    cadet: {
      ...safe,
      cadetNo: safe.cadet_no,
      rollSec: safe.roll_sec,
      photoUrl: safe.photo_url,
      lastUpdated: safe.last_updated,
    },
  });
});

// Alias routes matching spec: /api/cadets
const apiCadetsHandler = async (req, res) => {
  const cadetNo = req.params.cadet_no;
  const { data, error } = await supabase.from('cadets').select('*').eq('cadet_no', cadetNo).limit(1);
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Cadet not found' });
  const { password_hash, ...safe } = data[0];
  res.json({
    cadet: {
      ...safe,
      cadetNo: safe.cadet_no,
      rollSec: safe.roll_sec,
      photoUrl: safe.photo_url,
      lastUpdated: safe.last_updated,
    },
  });
};

app.get('/api/cadets', async (req, res) => {
  const { data, error } = await supabase.from('cadets').select('*');
  if (error) return res.status(500).json({ error: error.message });
  const students = (data || []).map(({ password_hash, ...safe }) => ({
    ...safe,
    cadetNo: safe.cadet_no,
    rollSec: safe.roll_sec,
    photoUrl: safe.photo_url,
    lastUpdated: safe.last_updated,
  }));
  res.json({ students });
});

app.get('/api/cadets/:cadet_no', apiCadetsHandler);

app.put('/api/cadets/:cadet_no', verifyAdmin, upload.single('photo'), async (req, res) => {
  const { name, rollSec, batch, rank, shift, nationality, sex } = req.body;
  const updatePayload = {};
  if (name) updatePayload.name = name;
  if (rollSec) updatePayload.roll_sec = rollSec;
  if (batch) updatePayload.batch = batch;
  if (rank) updatePayload.rank = rank;
  if (shift) updatePayload.shift = shift;
  if (nationality) updatePayload.nationality = nationality;
  if (sex) updatePayload.sex = sex;
  if (req.file) updatePayload.photo_url = `/uploads/${req.file.filename}`;
  updatePayload.last_updated = new Date().toISOString();

  const { data, error } = await supabase
    .from('cadets')
    .update(updatePayload)
    .eq('cadet_no', req.params.cadet_no)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (data.length === 0) return res.status(404).json({ error: 'Cadet not found' });
  const { password_hash, ...safe } = data[0];
  res.json({ message: 'Cadet updated successfully', cadet: { ...safe, cadetNo: safe.cadet_no, rollSec: safe.roll_sec, photoUrl: safe.photo_url, lastUpdated: safe.last_updated } });
});

app.delete('/api/cadets/:cadet_no', verifyAdmin, async (req, res) => {
  const { data: deleted, error } = await supabase
    .from('cadets')
    .delete({ eq: 'cadet_no', value: req.params.cadet_no })
    .select();
  if (error) return res.status(500).json({ error: error.message });
  if (!deleted || deleted.length === 0) return res.status(404).json({ error: 'Cadet not found' });
  res.json({ message: 'Cadet deleted successfully' });
});

// Toggle a cadet's admin flag. Only admins may promote/demote.
// Pass { is_admin: true/false }, or omit to toggle the current value.
async function toggleAdminStatus(cadetNo, req, res) {
  const { data: rows, error } = await supabase
    .from('cadets')
    .select('is_admin')
    .eq('cadet_no', cadetNo)
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'Cadet not found' });

  const current = Boolean(rows[0].is_admin);
  const target = typeof req.body.is_admin === 'boolean' ? req.body.is_admin : !current;

  const { data, error: updErr } = await supabase
    .from('cadets')
    .update({ is_admin: target, last_updated: new Date().toISOString() })
    .eq('cadet_no', cadetNo)
    .select()
    .limit(1);

  if (updErr) return res.status(500).json({ error: updErr.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Cadet not found' });

  const { password_hash, ...safe } = data[0];
  res.json({
    message: target ? 'Cadet promoted to admin' : 'Cadet demoted from admin',
    cadet: { ...safe, cadetNo: safe.cadet_no, is_admin: target },
  });
}

app.put('/students/:cadetNo/promote', verifyAdmin, (req, res) => {
  toggleAdminStatus(req.params.cadetNo, req, res);
});

// Alias route matching spec: /api/cadets/:cadet_no/promote
app.put('/api/cadets/:cadet_no/promote', verifyAdmin, (req, res) => {
  toggleAdminStatus(req.params.cadet_no, req, res);
});

app.delete('/students/:cadetNo', verifyAdmin, async (req, res) => {
  const { data: deleted, error } = await supabase
    .from('cadets')
    .delete({ eq: 'cadet_no', value: req.params.cadetNo })
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (!deleted || deleted.length === 0) return res.status(404).json({ error: 'Cadet not found' });

  res.json({ message: 'Cadet deleted successfully' });
});

// ---------- Boot ----------

seedDefaultUsers().catch(err => console.error('Seed failed:', err.message));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;