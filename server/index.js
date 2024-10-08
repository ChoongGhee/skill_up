const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// MongoDB 연결
mongoose.connect('mongodb://localhost:27017/boardapp');

// 사용자 모델
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model('User', UserSchema);

// 게시물 모델
const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  imageUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const Post = mongoose.model('Post', PostSchema);


// Multer 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });


// 라우트
// 회원가입
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: '회원가입 성공' });
  } catch (error) {
    res.status(500).json({ message: '회원가입 실패', error: error.message });
  }
});


// 로그인
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: '사용자를 찾을 수 없습니다.' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: '비밀번호가 일치하지 않습니다.' });
    }
    const token = jwt.sign({ id: user._id }, 'your_jwt_secret', { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: '로그인 실패', error: error.message });
  }
});

// 게시물 작성
app.post('/api/posts', upload.single('image'), async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'your_jwt_secret');
    
    const post = new Post({
      title: req.body.title,
      content: req.body.content,
      author: decoded.id,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : null
    });

    await post.save();
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ message: '게시물 작성 실패', error: error.message });
  }
});

// 게시물 목록 조회
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await Post.find().populate('author', 'username');
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: '게시물 조회 실패', error: error.message });
  }
});

// 게시물 상세 조회
app.get('/api/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'username');
    if (!post) {
      return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
    }
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: '게시물 조회 실패', error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));