const net = require('net');
const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// Object to keep track of active TCP connections
const connections = {};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle 'create' event
  socket.on('create', ({ host, port }) => {
    console.log(`Connecting to ${host}:${port}`);
    const client = new net.Socket();

    client.connect(port, host, () => {
      console.log(`Connected to ${host}:${port}`);
      connections[socket.id] = client;
      socket.emit('status', 'connected');
    });

    client.on('data', (data) => {
      console.log('Received data from server:', data.toString());
      socket.emit('receive', data.toString('base64'));
    });

    client.on('close', () => {
      console.log(`Connection to ${host}:${port} closed`);
      delete connections[socket.id];
      socket.emit('status', 'disconnected');
    });

    client.on('error', (err) => {
      console.error('Connection error:', err.message);
      socket.emit('error', err.message);
    });
  });

  // Handle 'send' event
  socket.on('send', ({ content }) => {
    const client = connections[socket.id];
    if (client) {
      const buffer = Buffer.from(content, 'base64');
      client.write(buffer);
      console.log('Sent data to server:', buffer.toString());
    } else {
      socket.emit('error', 'No active connection');
    }
  });

  // Handle 'destroy' event
  socket.on('destroy', () => {
    const client = connections[socket.id];
    if (client) {
      client.destroy();
      delete connections[socket.id];
      console.log('Connection destroyed');
      socket.emit('status', 'disconnected');
    } else {
      socket.emit('error', 'No active connection');
    }
  });

  socket.on('disconnect', () => {
    const client = connections[socket.id];
    if (client) {
      client.destroy();
      delete connections[socket.id];
    }
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
