module.exports = {
  apps: [{
    name: 'g-assistant',
    script: 'g_server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    cwd: '/home/user/webapp',
    env: {
      NODE_ENV: 'production',
      PORT: 5050
    },
    error_file: 'logs/g_err.log',
    out_file: 'logs/g_out.log',
    log_file: 'logs/g_combined.log',
    time: true
  }]
};