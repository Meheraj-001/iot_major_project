function validateSensorData(req, res, next) {
  const { espId, sensorType, value } = req.body;
  
  if (!espId) {
    return res.status(400).json({ error: 'espId is required' });
  }
  
  if (!sensorType) {
    return res.status(400).json({ error: 'sensorType is required' });
  }
  
  if (value === undefined || isNaN(parseFloat(value))) {
    return res.status(400).json({ error: 'value must be a number' });
  }
  
  const validTypes = ['temperature', 'humidity', 'light'];
  if (!validTypes.includes(sensorType)) {
    return res.status(400).json({ 
      error: `sensorType must be one of: ${validTypes.join(', ')}` 
    });
  }
  
  next();
}

function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
}

export {
  validateSensorData,
  authenticate
};