const client = require('prom-client');

// Create a Registry to register metrics
const register = new client.Registry();

// Add default Node.js metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const socketIoConnections = new client.Gauge({
  name: 'socket_io_connected_clients',
  help: 'Number of connected Socket.IO clients'
});

const agentExecutions = new client.Counter({
  name: 'agent_executions_total',
  help: 'Total number of agent executions',
  labelNames: ['agent_type', 'status']
});

const databaseQueries = new client.Counter({
  name: 'database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'status']
});

const memoryOperations = new client.Counter({
  name: 'memory_operations_total',
  help: 'Total number of memory operations',
  labelNames: ['operation', 'type']
});

const integrationCalls = new client.Counter({
  name: 'integration_calls_total',
  help: 'Total number of external integration calls',
  labelNames: ['service', 'action', 'status']
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(socketIoConnections);
register.registerMetric(agentExecutions);
register.registerMetric(databaseQueries);
register.registerMetric(memoryOperations);
register.registerMetric(integrationCalls);

// Middleware to track HTTP requests
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
    
    httpRequestsTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });
  
  next();
};

// Metrics endpoint handler
const metricsHandler = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
};

module.exports = {
  register,
  metricsMiddleware,
  metricsHandler,
  metrics: {
    httpRequestDuration,
    httpRequestsTotal,
    socketIoConnections,
    agentExecutions,
    databaseQueries,
    memoryOperations,
    integrationCalls
  }
};