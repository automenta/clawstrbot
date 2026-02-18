import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const port = 8000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for mock data
const mockPosts = [
  {
    id: 'post-1',
    title: 'Introduction to AI Agents',
    content: 'This is a discussion about the fundamentals of AI agents and their applications.',
    author: 'Alice',
    topic: 'AI',
    timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
  },
  {
    id: 'post-2',
    title: 'Machine Learning Trends 2024',
    content: 'Exploring the latest trends in machine learning and their impact on industry.',
    author: 'Bob',
    topic: 'ML',
    timestamp: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
  },
  {
    id: 'post-3',
    title: 'Ethics in AI Development',
    content: 'A thoughtful discussion on the ethical considerations when developing AI systems.',
    author: 'Charlie',
    topic: 'AI Ethics',
    timestamp: new Date(Date.now() - 10800000).toISOString() // 3 hours ago
  }
];

// Rate limiting tracking
const rateLimits = new Map<string, { count: number; timestamp: number }>();

// Helper function to check rate limits
function checkRateLimit(userId: string, action: string): boolean {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = 10; // Max 10 requests per minute

  const record = rateLimits.get(key);
  if (!record || now - record.timestamp > windowMs) {
    rateLimits.set(key, { count: 1, timestamp: now });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  rateLimits.set(key, { count: record.count + 1, timestamp: now });
  return true;
}

// API endpoints
app.post('/api/search/posts', (req, res) => {
  const { query, limit = 10 } = req.body;
  
  // Check rate limit
  if (!checkRateLimit(req.headers['user-agent'] as string || 'unknown', 'search')) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded for searches',
      rateLimited: true
    });
  }

  // Simple search based on topic
  const filteredPosts = mockPosts.filter(post => 
    post.topic.toLowerCase().includes(query.toLowerCase()) || 
    post.title.toLowerCase().includes(query.toLowerCase()) ||
    post.content.toLowerCase().includes(query.toLowerCase())
  );

  const results = filteredPosts.slice(0, limit);

  res.json({
    success: true,
    result: {
      posts: results,
      totalCount: results.length
    }
  });
});

app.post('/api/community/explore', (req, res) => {
  const { topic, maxPosts = 5 } = req.body;
  
  // Check rate limit
  if (!checkRateLimit(req.headers['user-agent'] as string || 'unknown', 'explore')) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded for exploration',
      rateLimited: true
    });
  }

  // Filter posts by topic
  const filteredPosts = mockPosts.filter(post => 
    post.topic.toLowerCase().includes(topic.toLowerCase())
  );

  const results = filteredPosts.slice(0, maxPosts);

  res.json({
    success: true,
    result: {
      topic,
      posts: results,
      exploredAt: new Date().toISOString()
    }
  });
});

app.post('/api/content/create', (req, res) => {
  const { title, content, topic, tags = [] } = req.body;
  
  // Check rate limit
  if (!checkRateLimit(req.headers['user-agent'] as string || 'unknown', 'create')) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded for content creation',
      rateLimited: true
    });
  }

  // Create a new post
  const newPost = {
    id: `post-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    content,
    author: 'ClawstrBot',
    topic,
    tags,
    timestamp: new Date().toISOString()
  };

  // Add to mock posts (in a real system, this would be stored in a database)
  mockPosts.unshift(newPost);

  res.json({
    success: true,
    result: {
      postId: newPost.id,
      message: 'Content created successfully',
      post: newPost
    }
  });
});

app.post('/api/post/engage', (req, res) => {
  const { postId, engagementType, content } = req.body;
  
  // Check rate limit
  if (!checkRateLimit(req.headers['user-agent'] as string || 'unknown', 'engage')) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded for engagement',
      rateLimited: true
    });
  }

  // Find the post
  const post = mockPosts.find(p => p.id === postId);
  if (!post) {
    return res.status(404).json({
      success: false,
      error: 'Post not found'
    });
  }

  let result;
  if (engagementType === 'reply' && content) {
    result = {
      engagementType,
      postId,
      replyId: `reply-${Date.now()}`,
      message: `Replied to post ${postId}`,
      content
    };
  } else if (engagementType === 'like') {
    result = {
      engagementType,
      postId,
      message: `Liked post ${postId}`
    };
  } else if (engagementType === 'share') {
    result = {
      engagementType,
      postId,
      message: `Shared post ${postId}`
    };
  } else {
    return res.status(400).json({
      success: false,
      error: `Unsupported engagement type: ${engagementType}`
    });
  }

  res.json({
    success: true,
    result
  });
});

app.get('/api/user/:userId/profile', (req, res) => {
  const { userId } = req.params;
  
  // Check rate limit
  if (!checkRateLimit(userId, 'profile')) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded for profile access',
      rateLimited: true
    });
  }

  res.json({
    success: true,
    result: {
      userId,
      username: `user_${userId}`,
      displayName: `User ${userId.substring(0, 8)}`,
      joinDate: new Date(Date.now() - 86400000 * 30).toISOString(), // 30 days ago
      postCount: Math.floor(Math.random() * 100),
      reputation: Math.floor(Math.random() * 1000)
    }
  });
});

app.get('/api/community/:communityId/info', (req, res) => {
  const { communityId } = req.params;
  
  // Check rate limit
  if (!checkRateLimit(communityId, 'community')) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded for community info',
      rateLimited: true
    });
  }

  res.json({
    success: true,
    result: {
      communityId,
      name: `Community ${communityId}`,
      description: `A community about ${communityId}`,
      memberCount: Math.floor(Math.random() * 10000),
      postCount: Math.floor(Math.random() * 5000),
      isActive: true
    }
  });
});

app.get('/api/rate-limits', (req, res) => {
  res.json({
    success: true,
    result: {
      limits: Object.fromEntries(rateLimits.entries()),
      message: 'Current rate limit status'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(port, () => {
  console.log(`Mock MCP Service running at http://localhost:${port}`);
  console.log('Available endpoints:');
  console.log('  POST /api/search/posts - Search for posts');
  console.log('  POST /api/community/explore - Explore community');
  console.log('  POST /api/content/create - Create content');
  console.log('  POST /api/post/engage - Engage with a post');
  console.log('  GET  /api/user/:userId/profile - Get user profile');
  console.log('  GET  /api/community/:communityId/info - Get community info');
  console.log('  GET  /api/rate-limits - Get rate limit status');
  console.log('  GET  /health - Health check');
});