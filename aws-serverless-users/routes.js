const AWS = require('aws-sdk');
const express = require('express');
const uuid = require('uuid');

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

  router.get('/users', (req, res) => {
    const params = {
        TableName: USERS_TABLE
    };
    dynamoDb.scan(params, (error, result) => {
        if (error) {
            res.status(400).json({ error: 'Error fetching the users' });
        }
        res.json(result.Items);
    });
});

router.get('/users/:id', (req, res) => {
  const id = req.params.id;

  const params = {
    TableName: USERS_TABLE,
    Key: {
      id
    }
  };

  dynamoDb.get(params, (error, result) => {
    if (error) {
      res.status(400).json({ error: 'Error retrieving user'})
    }
    if (result.Item) {
      res.json(result.Item);
    } else {
      res.status(404).json({ error: `Employee with id: ${id} not found` });
    }
  });
});

router.post('/users', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const id = uuid.v4();

  const params = {
    TableName: USERS_TABLE,
    Item: {
      id,
      username,
      password
    },
  };

  dynamoDb.put(params, (error) => {
    if (error) {
      res.status(400).json({ error: 'Could not create user' });
    }
    res.json({
      id,
      username,
      password
    });
  });
});

router.delete('/users/:id', (req, res) => {
  const id = req.params.id;

  const params = {
    TableName: USERS_TABLE,
    Key: {
      id
    }
  };

  dynamoDb.delete(params, (error) => {
    if (error) {
      res.status(400).json({ error: 'Could not delete user' });
    }
    res.json({ success: true });
  });
});

router.put('/users', (req, res) => {
  const id = req.body.id;
  const username = req.body.username;
  const password = req.body.password;

  const params = {
    TableName: USERS_TABLE,
    Key: {
      id
    },
    UpdateExpression: 'set #username = :username',
    ExpressionAttributeNames: { '#username': 'username' },
    ExpressionAttributeValues: { ':username': username },
    ReturnValues: "ALL_NEW"
  }

  dynamoDb.update(params, (error, result) => {
    if (error) {
      res.status(400).json({ error: 'Could not update user' });
    }
    res.json(result.Attributes);
  });
});

module.exports = router;