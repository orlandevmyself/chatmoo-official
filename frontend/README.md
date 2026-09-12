# ChatMoo Frontend

A simple React frontend for the ChatMoo matching and chat application.

## Features

- User registration with username, university, and gender preferences
- Real-time matching with other users
- Gender filtering for matches
- Real-time chat with WebSocket support
- Skip and end match functionality
- Responsive and clean UI

## Prerequisites

- Node.js (v16+)
- npm

## Installation

1. Install dependencies:
```bash
npm install --legacy-peer-deps
```

2. Start the development server:
```bash
npm start
```

The application will run on `http://localhost:3001`

## Usage

1. **Landing Page**: Enter your username, optional university, gender, and gender filter preferences
2. **Start Chatting**: Click "Start Chatting" to begin the matching process
3. **Matching**: The app will search for a match based on your preferences
4. **Chat**: Once matched, you can chat in real-time with your partner
5. **Controls**: Use "Skip" to find a new match or "End Chat" to end the conversation

## API Configuration

The frontend connects to the backend at `http://localhost:3000`. Make sure the backend is running before starting the frontend.

## WebSocket Connection

The app uses Socket.io for real-time communication:
- Message sending/receiving
- Partner skip notifications
- Partner end notifications
- Match status updates

## Project Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── LandingPage.js      # User registration form
│   │   ├── ChatPage.js         # Chat interface
│   │   ├── LandingPage.css     # Landing page styles
│   │   └── ChatPage.css        # Chat page styles
│   ├── App.js                  # Main app component
│   ├── App.css                 # Global styles
│   ├── index.js                # Entry point
│   └── index.css               # Base styles
├── package.json
└── README.md
```

## Features Breakdown

### Landing Page
- Username input (required)
- University input (optional) - used for university-based matching
- Gender selection (optional)
- Gender filter preference - choose who to match with
- Form validation

### Chat Page
- Real-time matching status
- Partner information display
- Message history
- Real-time message sending/receiving
- Skip match functionality
- End chat functionality
- Auto-scroll to latest messages

## Environment Variables

Currently hardcoded to:
- `API_URL`: http://localhost:3000
- `SOCKET_URL`: http://localhost:3000

For production, these should be moved to environment variables.

## Development

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Notes

- The frontend uses `--legacy-peer-deps` for npm installation due to dependency compatibility
- React 18 with Hooks for state management
- Socket.io client for WebSocket communication
- Axios for HTTP requests
- CSS modules for styling