import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

export interface MCPConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export interface MCPResponse<T = any> {
  success: boolean;
  result: T;
  error?: string;
  rateLimited?: boolean;
}

export class MCPClient {
  private config: MCPConfig;
  private httpClient: AxiosInstance;

  constructor(config: MCPConfig) {
    this.config = {
      timeout: 30000, // 30 second default timeout
      ...config
    };

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Clawstr-Bot/1.0'
      }
    });

    // Add response interceptor to handle rate limiting
    this.httpClient.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response?.status === 429) {
          console.warn('[MCP CLIENT] Rate limited by server');
          return Promise.reject({ ...error, rateLimited: true });
        }
        return Promise.reject(error);
      }
    );
  }

  async searchPosts(params: { query: string; limit?: number; offset?: number }): Promise<MCPResponse> {
    try {
      const response = await this.httpClient.post('/api/search/posts', {
        query: params.query,
        limit: params.limit || 10,
        offset: params.offset || 0
      });

      return {
        success: true,
        result: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        result: null,
        error: error.message,
        rateLimited: error.rateLimited || error.response?.status === 429
      };
    }
  }

  async exploreCommunity(params: { topic: string; maxPosts?: number }): Promise<MCPResponse> {
    try {
      const response = await this.httpClient.post('/api/community/explore', {
        topic: params.topic,
        maxPosts: params.maxPosts || 5
      });

      return {
        success: true,
        result: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        result: null,
        error: error.message,
        rateLimited: error.rateLimited || error.response?.status === 429
      };
    }
  }

  async createContent(params: { 
    title: string; 
    content: string; 
    topic: string; 
    tags?: string[] 
  }): Promise<MCPResponse> {
    try {
      const response = await this.httpClient.post('/api/content/create', {
        title: params.title,
        content: params.content,
        topic: params.topic,
        tags: params.tags || []
      });

      return {
        success: true,
        result: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        result: null,
        error: error.message,
        rateLimited: error.rateLimited || error.response?.status === 429
      };
    }
  }

  async engageWithPost(params: { 
    postId: string; 
    engagementType: 'like' | 'reply' | 'share' | 'comment'; 
    content?: string 
  }): Promise<MCPResponse> {
    try {
      const response = await this.httpClient.post('/api/post/engage', {
        postId: params.postId,
        engagementType: params.engagementType,
        content: params.content
      });

      return {
        success: true,
        result: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        result: null,
        error: error.message,
        rateLimited: error.rateLimited || error.response?.status === 429
      };
    }
  }

  async getUserProfile(params: { userId: string }): Promise<MCPResponse> {
    try {
      const response = await this.httpClient.get(`/api/user/${params.userId}/profile`);

      return {
        success: true,
        result: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        result: null,
        error: error.message,
        rateLimited: error.rateLimited || error.response?.status === 429
      };
    }
  }

  async getCommunityInfo(params: { communityId: string }): Promise<MCPResponse> {
    try {
      const response = await this.httpClient.get(`/api/community/${params.communityId}/info`);

      return {
        success: true,
        result: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        result: null,
        error: error.message,
        rateLimited: error.rateLimited || error.response?.status === 429
      };
    }
  }

  async getRateLimits(): Promise<MCPResponse> {
    try {
      const response = await this.httpClient.get('/api/rate-limits');

      return {
        success: true,
        result: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        result: null,
        error: error.message,
        rateLimited: error.rateLimited || error.response?.status === 429
      };
    }
  }
}