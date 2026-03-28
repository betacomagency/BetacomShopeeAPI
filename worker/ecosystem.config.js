module.exports = {
  apps: [{
    name: 'shopee-worker',
    script: './dist/index.js',
    node_args: '--max-old-space-size=256',
    max_memory_restart: '250M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/shopee-worker/error.log',
    out_file: '/var/log/shopee-worker/out.log',
    merge_logs: true,
    max_restarts: 10,
    restart_delay: 5000,
    env: {
      NODE_ENV: 'production'
    }
  }]
};
