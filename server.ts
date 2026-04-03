import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const PORT = 3000;

  // Store active ffmpeg processes
  const activeStreams = new Map<string, any>();

  io.on('connection', (socket) => {
    console.log('Client connected for streaming:', socket.id);

    let ffmpegProcess: any = null;
    let inputStream: PassThrough | null = null;

    socket.on('start-stream', ({ rtmpsUrl }: { rtmpsUrl: string }) => {
      if (!rtmpsUrl) {
        socket.emit('stream-status', { status: 'error', message: 'RTMPS URL is required' });
        return;
      }
      console.log(`Starting RTMPS stream to: ${rtmpsUrl}`);

      if (ffmpegProcess) {
        ffmpegProcess.kill();
      }

      inputStream = new PassThrough();

      ffmpegProcess = ffmpeg(inputStream)
        .inputFormat('webm')
        .audioCodec('aac')
        .audioBitrate('128k')
        .audioFrequency(44100)
        .audioChannels(2)
        .format('flv')
        .outputOptions([
          '-flvflags', 'no_duration_filesize',
          '-rtmp_live', 'live',
          '-rtmp_buffer', '1000',
          '-reconnect', '1',
          '-reconnect_at_eof', '1',
          '-reconnect_streamed', '1',
          '-reconnect_delay_max', '2',
          '-max_interleave_delta', '0'
        ])
        .output(rtmpsUrl)
        .on('start', (commandLine) => {
          console.log('FFmpeg started with command:', commandLine);
          socket.emit('stream-status', { status: 'started' });
        })
        .on('stderr', (stderrLine) => {
          console.log('FFmpeg stderr:', stderrLine);
        })
        .on('error', (err) => {
          // Ignore errors caused by killing the process intentionally
          if (err.message.includes('ffmpeg was killed with signal SIGKILL') || 
              err.message.includes('SIGTERM')) {
            console.log('FFmpeg process was stopped intentionally');
            return;
          }
          console.error('FFmpeg error:', err.message);
          socket.emit('stream-status', { status: 'error', message: err.message });
        })
        .on('end', () => {
          console.log('FFmpeg ended');
          socket.emit('stream-status', { status: 'ended' });
        });

      ffmpegProcess.run();
      activeStreams.set(socket.id, ffmpegProcess);
    });

    socket.on('stream-data', (data: Buffer) => {
      if (inputStream) {
        inputStream.write(data);
      }
    });

    socket.on('stop-stream', () => {
      if (ffmpegProcess) {
        if (inputStream) {
          inputStream.end();
        }
        // Give it a tiny bit of time to finish writing before killing
        setTimeout(() => {
          if (ffmpegProcess) {
            ffmpegProcess.kill();
            ffmpegProcess = null;
            inputStream = null;
            activeStreams.delete(socket.id);
            socket.emit('stream-status', { status: 'stopped' });
          }
        }, 500);
      }
    });

    socket.on('disconnect', () => {
      if (ffmpegProcess) {
        if (inputStream) {
          inputStream.end();
        }
        ffmpegProcess.kill();
        activeStreams.delete(socket.id);
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
