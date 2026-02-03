// Mock data for MCP tools

export const mockPosts = [
  {
    id: 'post-1',
    title: 'Introduction to Machine Learning',
    content: 'Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed.',
    author: 'alice',
    tags: ['technology', 'ai', 'ml'],
    timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    score: 42
  },
  {
    id: 'post-2',
    title: 'The Future of Quantum Computing',
    content: 'Quantum computing leverages quantum mechanical phenomena to process information in ways that classical computers cannot.',
    author: 'bob',
    tags: ['technology', 'quantum', 'future'],
    timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    score: 28
  }
];

export const mockDetailedPost = {
  id: 'post-detailed-1',
  title: 'Detailed Analysis of Neural Networks',
  content: 'Neural networks are computing systems inspired by the human brain. They consist of interconnected nodes that process information in a manner similar to neurons...',
  author: 'charlie',
  tags: ['ai', 'neural-networks', 'deep-learning'],
  timestamp: new Date().toISOString(),
  score: 67,
  replies: [
    {
      id: 'reply-1',
      content: 'Great analysis! Could you elaborate on backpropagation?',
      author: 'diana',
      timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    }
  ]
};

export function getMockProfile(username: string) {
  return {
    username: username,
    displayName: username.charAt(0).toUpperCase() + username.slice(1),
    joinDate: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
    postCount: Math.floor(Math.random() * 100),
    reputation: Math.floor(Math.random() * 1000),
    badges: ['active_contributor', 'early_adopter']
  };
}
