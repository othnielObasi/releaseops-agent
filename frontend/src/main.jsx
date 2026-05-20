import React from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function Root() {
  if (!clerkKey) {
    return (
      <main style={{ fontFamily: "system-ui, sans-serif", padding: 32 }}>
        <h1>ReleaseOps Agent</h1>
        <p>Missing VITE_CLERK_PUBLISHABLE_KEY. Configure Clerk before starting the app.</p>
      </main>
    );
  }
  return (
    <ClerkProvider publishableKey={clerkKey}>
      <App />
    </ClerkProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
