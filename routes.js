const AWS = require('aws-sdk');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('./middleware/auth');

const IS_OFFLINE = process.env.NODE_ENV !== 'production';
const USERS_TABLE = process.env.TABLE;

//if project adjusted to use local versions of AWS and DynamoDB, else is false when deployed
const dynamoDb = IS_OFFLINE === true ?
  new AWS.DynamoDB.DocumentClient({
    region: 'us-east-2',
    endpoint: 'http://127.0.0.1:8080',
  }) :
  new AWS.DynamoDB.DocumentClient();

const router = express.Router();

//create a session
router.post('/session', (req, res) => {
  const { username, password } = req.body
  const params = {
    TableName: USERS_TABLE,
    KeyConditionExpression: "username = :username",
    ExpressionAttributeValues: {
      ":username": username
    }
  };

  dynamoDb.query(params, (error, result) => {
    if (error) {
      res.json({ error: 'Error retrieving user', error})
    }
    if (result.Items) {
      const hash = result.Items[0].password_hash
      bcrypt.compare(password, hash)
      .then(compareResult => {
        if (!compareResult) return res.send('Unauthorized');

        // user authenticated, create / send token back
        const timestamp = new Date().getTime();
        const data = { ...result.Items[0] };
        data.password_hash = 'REDACTED';
        const userObj = { username: data.username, iat: timestamp };
        const token = jwt.sign(userObj, 'shh');
        res.json({ token: token, username: data.username })
      })
    } else {
      res.json({ error: `User not found` });
    }
  })
});

//create a new user
const saltRounds = 10;

router.post('/users', (req, res) => {
  const { username, password, email, firstName, lastName } = req.body;

  bcrypt.hash(password, saltRounds, (err, hash) => {
    const params = {
      TableName: USERS_TABLE,
      Item: {
        username,
        password_hash: hash,
        email,
        firstName,
        lastName
      },
    };

    dynamoDb.put(params, (error) => {
      if (error) {
        res.json({ error: 'Could not create user' });
      }
      res.json({
        username,
        email,
        firstName,
        lastName
      });
    });
  })
});

//get user data
router.get('/users/:id', authMiddleware, (req, res) => {
  const username = req.params.id;

  const params = {
    TableName: USERS_TABLE,
    Key: {
      username
    }
  };

  dynamoDb.get(params, (error, result) => {
    if (error) {
      res.json({ error: 'Error retrieving user'})
    }
    if (result.Item) {
      res.json({
        username: result.Item.username,
        email: result.Item.email,
        firstName: result.Item.firstName,
        lastName: result.Item.lastName
      });
    } else {
      res.json({ error: `User not found` });
    }
  });
});

router.delete('/users/:id', authMiddleware, (req, res) => {
  const username = req.params.id;

  const params = {
    TableName: USERS_TABLE,
    Key: {
      username
    }
  };

  dynamoDb.delete(params, (error) => {
    if (error) {
      res.json({ error: 'Could not delete user' });
    }
    res.json({ success: true });
  });
});

//update user info, can change anything except for username, which is primary key/id
router.put('/users', authMiddleware, (req, res) => {
  const { username, password, email, firstName, lastName } = req.body;

  bcrypt.hash(password, saltRounds, (err, hash) => {
    try {
      const params = {
        TableName: USERS_TABLE,
        Key: {
          username
        },
        UpdateExpression: 'set password_hash = :h, email = :e, firstName = :fn, lastName = :ln',
        ExpressionAttributeValues: { 
          ':h': hash,
          ':e': email,
          ':fn': firstName,
          ':ln': lastName
        },
        ReturnValues: "ALL_NEW"
      }

      dynamoDb.update(params, (error, result) => {
        if (error) {
          res.json({ error: 'Could not update user', error });
        } else {
          res.json({updated: result});
        }
      });
    } catch(e) {
      res.json({e});
    }
  })
});

module.exports = router;