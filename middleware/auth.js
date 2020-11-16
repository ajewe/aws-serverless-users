const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.header("token");

  try {
    const userObj = jwt.verify(token, 'shh');
    //token is good
    req.username = userObj.username
    next();
  } catch(e) {
    console.log(e)
    res.send('Unauthorized')
  }
  return
}

module.exports = {
  authMiddleware
}