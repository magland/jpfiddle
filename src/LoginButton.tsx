import React from 'react';

const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
const redirectUri = 'https://jpfiddle.vercel.app/api/auth';
export const loginUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo`;

const LoginButton: React.FC = () => (
  <a href={loginUrl}>Login with GitHub</a>
);

export default LoginButton;
