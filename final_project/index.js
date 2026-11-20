const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const crypto = require('node:crypto');
const { authenticated: customer_routes, JWT_SECRET } = require('./router/auth_users.js');
const genl_routes = require('./router/general.js').general;
const app = express();

app.use(express.json());
app.use('/customer', session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 1000 }
}));

app.use('/customer/auth', (req, res, next) => {
  const authorization = req.session.authorization;
  if (!authorization) {
    return res.status(401).json({ message: 'You must be logged in to access this resource' });
  }
  try {
    const payload = jwt.verify(authorization.accessToken, JWT_SECRET, {
      algorithms: ['HS256']
    });
    if (payload.username !== authorization.username) {
      return res.status(401).json({ message: 'Invalid session' });
    }
    req.authenticatedUsername = payload.username;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
});

app.use('/customer', customer_routes);
app.use('/', genl_routes);

if (require.main === module) {
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => console.log(`Server is running on port ${port}`));
}

module.exports = app;
