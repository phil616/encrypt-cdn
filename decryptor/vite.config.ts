import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Use relative paths for assets to support deployment to subdirectories
  publicDir: 'public', // Serve public directory
  server: {
    open: '/index.html', // 自动打开 index.html
    proxy: {
      // Proxy OIDC discovery and token endpoints
      '/oidc': {
        target: 'https://api.dreamreflex.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/oidc/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Request to OIDC:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Response from OIDC:', proxyRes.statusCode, req.url);
          });
        }
      },
      // Proxy application key endpoint
      '/key': {
        target: 'https://api.dreamreflex.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/key/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Request to Key API:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Response from Key API:', proxyRes.statusCode, req.url);
          });
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
