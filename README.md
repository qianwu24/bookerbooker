# Booker - Smart Scheduling App

A web-first scheduler application with Google OAuth authentication and intelligent priority-based invitation system.

## Features

- **Google OAuth Authentication** - Secure sign-in with Google accounts
- **Priority-Based Invitations** - Create events with ranked invitees (high to low priority)
- **Automatic Queue Management** - When someone declines, the next person automatically gets invited
- **Real-time Updates** - Live event status updates using Supabase
- **Event Dashboard** - View all events (organized, invited, or all)
- **Responsive Design** - Works seamlessly across desktop and mobile

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS v4 + Material-UI
- **Backend:** Supabase (Auth, Database, Edge Functions)
- **Authentication:** Google OAuth via Supabase Auth
- **Server:** Hono web server running on Supabase Edge Functions

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm, yarn, or pnpm
- Google Cloud Console project with OAuth 2.0 credentials
- Supabase account and project

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/booker.git
cd booker
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (or use existing)
3. Add authorized origins and redirect URIs:

**Authorized JavaScript origins:**
```
http://localhost:5173
https://YOUR_PROJECT_ID.supabase.co
```

**Authorized redirect URIs:**
```
https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
```

### 4. Configure Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication → Providers**
3. Enable **Google** provider
4. Enter your Client ID and Client Secret from Google Cloud Console
5. Navigate to **Authentication → URL Configuration**
6. Set **Site URL** to `http://localhost:5173` (for local development)

### 5. Update Supabase Credentials

Update the credentials in `/utils/supabase/info.tsx` with your project details:

```typescript
export const projectId = 'YOUR_PROJECT_ID';
export const publicAnonKey = 'YOUR_ANON_KEY';
```

### 6. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## How It Works

### Priority Queue System

1. **Create Event:** User creates an event and adds invitees with drag-and-drop priority ordering
2. **First Invite:** Person with priority 0 (highest) receives the invitation immediately
3. **Auto-Promotion:** If they decline, priority 1 automatically gets invited
4. **Continue Queue:** Process continues until someone accepts or all invitees decline

### Event Statuses

- **Invited** - Currently has an active invitation
- **Pending** - Waiting in the queue
- **Accepted** - Accepted the invitation
- **Declined** - Declined the invitation

## Project Structure

```
booker/
├── src/
│   ├── app/
│   │   ├── components/        # React components
│   │   └── App.tsx            # Main application
│   ├── styles/
│   │   ├── fonts.css
│   │   └── theme.css
│   └── index.tsx
├── supabase/
│   └── functions/
│       └── server/            # Edge functions (Hono server)
├── utils/
│   └── supabase/
│       └── info.tsx           # Supabase configuration
└── package.json
```

## API Routes

All server routes are prefixed with `/make-server-37f8437f`:

- `POST /make-server-37f8437f/events` - Create new event
- `GET /make-server-37f8437f/events` - Get user's events
- `POST /make-server-37f8437f/events/:id/respond` - Accept/decline invitation
- `GET /make-server-37f8437f/user` - Get current user info

## Testing Multi-User Flow

1. **Browser 1 (Normal):** Sign in with Google Account A
2. Create an event, add Account B's email as first invitee
3. **Browser 2 (Incognito):** Sign in with Google Account B
4. Account B sees the invitation and can accept/decline
5. If declined, the next person in queue gets invited

## Building for Production

```bash
npm run build
# or
yarn build
# or
pnpm build
```

The build output will be in the `dist/` directory.

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
