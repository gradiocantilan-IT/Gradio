# We Play - Philippine Radio & Music Streaming

We Play is a modern, feature-rich web application for streaming Philippine FM/AM radio stations and local music. It features a sleek, Spotify-inspired interface, an AI-powered DJ, and live RTMPS broadcasting capabilities.

## 🚀 Features

- **Live Radio Streaming**: Access a wide range of Philippine radio stations (Manila, Provincial, News, Music).
- **Local Music Library**: Curated collection of local music, including tracks from artists like Tesha.
- **AI DJ (Puck)**: An intelligent AI DJ that provides energetic transitions between songs in Taglish, including personalized shoutouts.
- **Visualizer**: Real-time audio visualizer that reacts to music and the AI DJ's voice.
- **Favorites & History**: Save your favorite stations and keep track of what you've recently played.
- **Live Broadcasting**: Stream the audio directly to platforms like Facebook or YouTube via RTMPS.
- **Responsive Design**: Fully optimized for desktop and mobile devices.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion.
- **Audio Engine**: Howler.js.
- **Backend**: Express, Socket.io (for streaming).
- **AI**: Google Gemini API (@google/genai).
- **Streaming**: FFmpeg (via fluent-ffmpeg).

## 📦 Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables in a `.env` file:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## 🚀 Deployment

### Vercel Compatibility

This project is optimized for deployment on Vercel. However, please note:
- The **Frontend** (React SPA) is fully compatible and will work out of the box.
- The **RTMPS Streaming** feature requires a long-running server with FFmpeg installed. Since Vercel uses serverless functions, this specific feature will not work on Vercel's standard environment. For full functionality, consider deploying the backend to a platform that supports long-running processes (like Heroku, DigitalOcean, or Railway).

### Build Command
```bash
npm run build
```

### Output Directory
`dist`

## 📄 License

MIT
