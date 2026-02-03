import { LMTool } from '../types';
import { mockPosts, mockDetailedPost, getMockProfile } from './mock-data';

// Define MCP-style tools for the agent
export const mcpTools: LMTool[] = [
  {
    name: 'search_posts',
    description: 'Search for posts or content based on a query',
    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to filter by'
        }
      },
      required: ['query']
    },
    handler: async (params: { query: string; limit?: number; tags?: string[] }) => {
      console.log(`MCP Tool: Searching for posts with query: ${params.query}`);

      // Simulate an MCP call to search for posts
      // Using mock data
      return mockPosts.slice(0, params.limit || 5);
    }
  },
  {
    name: 'fetch_post',
    description: 'Fetch a specific post by its ID',
    schema: {
      type: 'object',
      properties: {
        postId: {
          type: 'string',
          description: 'The ID of the post to fetch'
        }
      },
      required: ['postId']
    },
    handler: async (params: { postId: string }) => {
      console.log(`MCP Tool: Fetching post with ID: ${params.postId}`);

      // Simulate an MCP call to fetch a specific post
      // Return detailed mock post but override ID to match request if needed, or just return it
      return {
        ...mockDetailedPost,
        id: params.postId
      };
    }
  },
  {
    name: 'create_post',
    description: 'Create a new post with the given content',
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title of the post'
        },
        content: {
          type: 'string',
          description: 'The content of the post'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to associate with the post'
        }
      },
      required: ['title', 'content']
    },
    handler: async (params: { title: string; content: string; tags?: string[] }) => {
      console.log(`MCP Tool: Creating post titled: ${params.title}`);

      // Simulate an MCP call to create a post
      return {
        success: true,
        postId: `post-${Date.now()}`,
        message: 'Post created successfully',
        timestamp: new Date().toISOString()
      };
    }
  },
  {
    name: 'reply_to_post',
    description: 'Reply to an existing post with the given content',
    schema: {
      type: 'object',
      properties: {
        postId: {
          type: 'string',
          description: 'The ID of the post to reply to'
        },
        content: {
          type: 'string',
          description: 'The content of the reply'
        }
      },
      required: ['postId', 'content']
    },
    handler: async (params: { postId: string; content: string }) => {
      console.log(`MCP Tool: Replying to post ${params.postId}`);

      // Simulate an MCP call to reply to a post
      return {
        success: true,
        replyId: `reply-${Date.now()}`,
        message: 'Reply created successfully',
        timestamp: new Date().toISOString()
      };
    }
  },
  {
    name: 'get_user_profile',
    description: 'Get information about a user',
    schema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'The username to fetch profile for'
        }
      },
      required: ['username']
    },
    handler: async (params: { username: string }) => {
      console.log(`MCP Tool: Fetching profile for user: ${params.username}`);

      // Simulate an MCP call to get user profile
      return getMockProfile(params.username);
    }
  }
];
