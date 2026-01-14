module.exports = {
  apps: [
    {
      name: 'privacyescrow-prod',
      script: 'api/api.js',
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};