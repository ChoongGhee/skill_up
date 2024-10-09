const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB 연결
mongoose.connect('mongodb://localhost:27017/boardapp', { useNewUrlParser: true, useUnifiedTopology: true });

// 사용자 모델
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = mongoose.model('User', UserSchema);

// 게시물 모델 (이미지 URL 필드 제거)
const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

const Post = mongoose.model('Post', PostSchema);

// 댓글 모델
const CommentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  createdAt: { type: Date, default: Date.now },
});

const Comment = mongoose.model('Comment', CommentSchema);
//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

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
app.post('/api/posts', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'your_jwt_secret');
    
    const post = new Post({
      title: req.body.title,
      content: req.body.content,
      author: decoded.id,
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

// 게시물 수정
app.put('/api/posts/:id', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'your_jwt_secret');
    const postId = req.params.id;
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
    }

    if (post.author.toString() !== decoded.id) {
      return res.status(403).json({ message: '게시물 수정 권한이 없습니다.' });
    }

    post.title = req.body.title || post.title;
    post.content = req.body.content || post.content;

    await post.save();
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: '게시물 수정 실패', error: error.message });
  }
});

// 게시물 삭제
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'your_jwt_secret');
    const postId = req.params.id;
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
    }

    if (post.author.toString() !== decoded.id) {
      return res.status(403).json({ message: '게시물 삭제 권한이 없습니다.' });
    }

    await Post.findByIdAndDelete(postId);
    res.json({ message: '게시물이 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ message: '게시물 삭제 실패', error: error.message });
  }
});

// 사용자 삭제 (회원탈퇴)
app.delete('/api/users', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, 'your_jwt_secret'); // 'your_jwt_secret'은 실제 JWT 비밀 키로 대체
    const userId = decoded.id;

    // 사용자 삭제
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 사용자가 작성한 모든 게시물도 삭제하거나, 다른 방식으로 처리할 수 있습니다.
    // 여기서는 예시로 삭제하는 것으로 가정:
    await Post.deleteMany({ author: userId });

    res.json({ message: '사용자 계정이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    res.status(500).json({ message: '사용자 삭제 실패', error: error.message });
  }
});

app.post('/api/posts/:postId/comments', async (req, res) => {
  try {
    // 로그 추가
    console.log('요청 헤더:', req.headers);
    console.log('요청 본문:', req.body);  
    console.log('요청 파라미터:', req.params);


    const token = req.headers.authorization?.split(' ')[1]; // optional chaining for safety

    if (!token) {
      return res.status(401).json({ message: '토큰이 없습니다.' });
    }

    const decoded = jwt.verify(token, 'your_jwt_secret');
    const { content } = req.body;
    const { postId } = req.params;

    if (!content) {
      return res.status(400).json({ message: '댓글 내용을 입력하세요.' });
    }

    // 로그 추가
    console.log('토큰 디코딩 결과:', decoded);
    console.log('댓글 내용:', content);
    console.log('게시글 ID:', postId);


    const comment = new Comment({
      content,
      author: decoded.id, // decoded.id 가 아니라 decoded.userId라고 가정
      post: postId,
    });

    await comment.save();
    res.status(201).json(comment); // 저장된 댓글 객체 응답
  } catch (error) {
    console.error('댓글 추가 중 오류 발생:', error);
    // 에러 메시지 상세히 출력
    console.error('에러 스택:', error.stack);
    res.status(500).json({ message: '댓글 추가 실패', error: error.message });
  }
});

// 댓글 조회
app.get('/api/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const comments = await Comment.find({ post: postId }).populate('author', 'username').populate('post', 'title');
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: '댓글 조회 실패', error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
