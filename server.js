import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();

app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: ["http://localhost:3000", "https://nextjs-starter-eight-opal.vercel.app"], // 允许本地和 Vercel 访问
        methods: ["GET", "POST"]
    }
});


const rooms = new Map();

io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    socket.on('join-room', (roomId) => {
        if (!rooms.has(roomId) && rooms.size >= 3) {
            socket.emit('room-limit-reached', { message: "房间数量已达上限，无法创建新房间。" });
            return;
        }

        const room = rooms.get(roomId) || { users: [] };
        room.users.push(socket.id);
        rooms.set(roomId, room);

        socket.join(roomId);
        socket.emit('room-joined', { roomId, users: room.users });
        socket.to(roomId).emit('user-joined', { userId: socket.id });

        console.log(`用户 ${socket.id} 加入房间 ${roomId}`);
    });

    socket.on("leave-room", ({ roomId }) => {
        if (rooms.has(roomId)) {
            const room = rooms.get(roomId);
            if (room) {
                room.users = room.users.filter(id => id !== socket.id);
                if (room.users.length === 0) {
                    rooms.delete(roomId);
                } else {
                    rooms.set(roomId, room);
                }
                socket.leave(roomId);
                socket.to(roomId).emit("user-left", { userId: socket.id });
                console.log(`用户 ${socket.id} 退出房间 ${roomId}`);
            }
        }
    });

    socket.on('offer', ({ roomId, offer }) => {
        socket.to(roomId).emit('offer', { from: socket.id, offer });
    });

    socket.on('answer', ({ roomId, answer }) => {
        socket.to(roomId).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
        socket.to(roomId).emit('ice-candidate', { from: socket.id, candidate });
    });

    socket.on('disconnecting', () => {
        const socketRooms = Array.from(socket.rooms.values());
        socketRooms.forEach(roomId => {
            if (roomId !== socket.id) {
                const room = rooms.get(roomId);
                if (room) {
                    room.users = room.users.filter(id => id !== socket.id);
                    if (room.users.length === 0) {
                        rooms.delete(roomId);
                    } else {
                        rooms.set(roomId, room);
                    }
                }
                socket.to(roomId).emit('user-left', { userId: socket.id });
            }
        });
    });
});

const PORT = process.env.PORT || 9090;
httpServer.listen(PORT, () => {
    console.log(`信令服务器运行在端口 ${PORT}`);
});
