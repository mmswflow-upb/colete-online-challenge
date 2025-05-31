import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import gameRoutes from './routes/games';
import { initSocket } from './sockets/sessions';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);


app.use(express.json());

app.use('/games', gameRoutes);

initSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
