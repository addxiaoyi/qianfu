import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const testApp = express();
testApp.use(express.json());

const TEST_JWT_SECRET = 'test-secret-key-for-testing';

const users: Array<{ id: string; username: string; email: string; password: string; createdAt: Date }> = [];
const servers: Array<{ id: string; name: string; description: string; ownerId: string; createdAt: Date; updatedAt: Date }> = [];

const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, TEST_JWT_SECRET) as { id: string; username: string };
    (req as express.Request & { user?: { id: string; username: string } }).user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const mockRegister = async (req: express.Request, res: express.Response) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = users.find((u) => u.username === username || u.email === email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: `user_${Date.now()}`,
      username,
      email,
      password: hashedPassword,
      createdAt: new Date(),
    };
    users.push(newUser);
    const token = jwt.sign({ id: newUser.id, username: newUser.username }, TEST_JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { token, user: { id: newUser.id, username: newUser.username, email: newUser.email } },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

const mockLogin = async (req: express.Request, res: express.Response) => {
  try {
    const { username, password } = req.body;
    const user = users.find((u) => u.username === username);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, TEST_JWT_SECRET, { expiresIn: '1h' });
    res.json({
      success: true,
      message: 'Login successful',
      data: { token, user: { id: user.id, username: user.username, email: user.email } },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

const mockGetProfile = (req: express.Request, res: express.Response) => {
  const authReq = req as express.Request & { user?: { id: string; username: string } };
  const user = users.find((u) => u.id === authReq.user?.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.json({ success: true, data: { id: user.id, username: user.username, email: user.email, createdAt: user.createdAt } });
};

testApp.post('/api/auth/register', mockRegister);
testApp.post('/api/auth/login', mockLogin);
testApp.get('/api/auth/profile', authMiddleware, mockGetProfile);

const mockGetAllServers = (req: express.Request, res: express.Response) => {
  const authReq = req as express.Request & { user?: { id: string } };
  const userId = authReq.user?.id;
  const userServers = servers.filter((s) => s.ownerId === userId);
  res.json({ success: true, data: userServers });
};

const mockGetServerById = (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const authReq = req as express.Request & { user?: { id: string } };
  const userId = authReq.user?.id;
  const server = servers.find((s) => s.id === id && s.ownerId === userId);
  if (!server) {
    return res.status(404).json({ success: false, message: 'Server not found' });
  }
  res.json({ success: true, data: server });
};

const mockCreateServer = (req: express.Request, res: express.Response) => {
  const { name, description } = req.body;
  const authReq = req as express.Request & { user?: { id: string } };
  const userId = authReq.user?.id;
  const newServer = {
    id: `server_${Date.now()}`,
    name,
    description: description || '',
    ownerId: userId!,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  servers.push(newServer);
  res.status(201).json({ success: true, message: 'Server created successfully', data: newServer });
};

const mockUpdateServer = (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const authReq = req as express.Request & { user?: { id: string } };
  const userId = authReq.user?.id;
  const serverIndex = servers.findIndex((s) => s.id === id && s.ownerId === userId);
  if (serverIndex === -1) {
    return res.status(404).json({ success: false, message: 'Server not found' });
  }
  servers[serverIndex] = {
    ...servers[serverIndex],
    name: name || servers[serverIndex].name,
    description: description || servers[serverIndex].description,
    updatedAt: new Date(),
  };
  res.json({ success: true, message: 'Server updated successfully', data: servers[serverIndex] });
};

const mockDeleteServer = (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const authReq = req as express.Request & { user?: { id: string } };
  const userId = authReq.user?.id;
  const serverIndex = servers.findIndex((s) => s.id === id && s.ownerId === userId);
  if (serverIndex === -1) {
    return res.status(404).json({ success: false, message: 'Server not found' });
  }
  servers.splice(serverIndex, 1);
  res.json({ success: true, message: 'Server deleted successfully' });
};

testApp.get('/api/servers', authMiddleware, mockGetAllServers);
testApp.get('/api/servers/:id', authMiddleware, mockGetServerById);
testApp.post('/api/servers', authMiddleware, mockCreateServer);
testApp.put('/api/servers/:id', authMiddleware, mockUpdateServer);
testApp.delete('/api/servers/:id', authMiddleware, mockDeleteServer);

describe('Auth API', () => {
  let authToken: string;

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(testApp)
        .post('/api/auth/register')
        .send({ username: 'testuser', email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('username', 'testuser');
    });

    it('should not register duplicate username', async () => {
      await request(testApp)
        .post('/api/auth/register')
        .send({ username: 'duplicate', email: 'first@example.com', password: 'password123' });

      const response = await request(testApp)
        .post('/api/auth/register')
        .send({ username: 'duplicate', email: 'second@example.com', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User already exists');
    });

    it('should not register duplicate email', async () => {
      await request(testApp)
        .post('/api/auth/register')
        .send({ username: 'user1', email: 'same@example.com', password: 'password123' });

      const response = await request(testApp)
        .post('/api/auth/register')
        .send({ username: 'user2', email: 'same@example.com', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      await request(testApp)
        .post('/api/auth/register')
        .send({ username: 'loginuser', email: 'login@example.com', password: 'password123' });
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({ username: 'loginuser', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      authToken = response.body.data.token;
    });

    it('should fail login with wrong password', async () => {
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({ username: 'loginuser', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should fail login with non-existent user', async () => {
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should get user profile with valid token', async () => {
      const response = await request(testApp)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('username', 'loginuser');
    });

    it('should fail without token', async () => {
      const response = await request(testApp)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid token', async () => {
      const response = await request(testApp)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
    });
  });
});

describe('Servers API', () => {
  let userToken: string;

  beforeAll(async () => {
    const response = await request(testApp)
      .post('/api/auth/register')
      .send({ username: 'serveruser', email: 'server@example.com', password: 'password123' });
    userToken = response.body.data.token;
  });

  beforeEach(() => {
    servers.length = 0;
  });

  describe('GET /api/servers', () => {
    it('should get empty servers list initially', async () => {
      const response = await request(testApp)
        .get('/api/servers')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should get servers for authenticated user', async () => {
      await request(testApp)
        .post('/api/servers')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'My Server', description: 'Test server' });

      const response = await request(testApp)
        .get('/api/servers')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('My Server');
    });

    it('should fail without authentication', async () => {
      const response = await request(testApp)
        .get('/api/servers');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/servers', () => {
    it('should create a new server', async () => {
      const response = await request(testApp)
        .post('/api/servers')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'New Server', description: 'Server description' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('New Server');
    });

    it('should create server without description', async () => {
      const response = await request(testApp)
        .post('/api/servers')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Minimal Server' });

      expect(response.status).toBe(201);
      expect(response.body.data.description).toBe('');
    });

    it('should fail without authentication', async () => {
      const response = await request(testApp)
        .post('/api/servers')
        .send({ name: 'Server', description: 'Test' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/servers/:id', () => {
    it('should get server by id', async () => {
      const createResponse = await request(testApp)
        .post('/api/servers')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Test Server', description: 'Test' });
      const serverId = createResponse.body.data.id;

      const response = await request(testApp)
        .get(`/api/servers/${serverId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(serverId);
    });

    it('should return 404 for non-existent server', async () => {
      const response = await request(testApp)
        .get('/api/servers/nonexistent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/servers/:id', () => {
    it('should update server name', async () => {
      const createResponse = await request(testApp)
        .post('/api/servers')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Original Name', description: 'Original desc' });
      const serverId = createResponse.body.data.id;

      const response = await request(testApp)
        .put(`/api/servers/${serverId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.description).toBe('Original desc');
    });

    it('should return 404 for non-existent server', async () => {
      const response = await request(testApp)
        .put('/api/servers/nonexistent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/servers/:id', () => {
    it('should delete server successfully', async () => {
      const createResponse = await request(testApp)
        .post('/api/servers')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'To Delete', description: 'Test' });
      const serverId = createResponse.body.data.id;

      const response = await request(testApp)
        .delete(`/api/servers/${serverId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const getResponse = await request(testApp)
        .get(`/api/servers/${serverId}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent server', async () => {
      const response = await request(testApp)
        .delete('/api/servers/nonexistent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });
});
