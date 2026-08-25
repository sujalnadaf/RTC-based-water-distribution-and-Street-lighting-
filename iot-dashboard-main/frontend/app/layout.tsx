import type { Metadata } from 'next';
import './globals.css';

import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Water & Street Light Control | IoT Dashboard',
  description:
    'RTC-Based Water Distribution and Street Lighting System — live monitoring and operator control.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}

            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: '#121826',
                  color: '#fff',
                  border: '1px solid #232B3D',
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}