const keys = require('./keys');

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());

const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
});

pgClient.on('error', () => console.log("Lost PG Connection"));

pgClient.on("connect", (client) => {
    client
      .query("CREATE TABLE IF NOT EXISTS values (number INT)")
      .catch((err) => console.error(err));
  });

  const redis = require('redis');

  const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
  });

  const redisPublisher = redisClient.duplicate();

  app.get('/', (request, response) =>{ 
      response.send('Hi');
  })

  app.get('/values/all', async (request,response) => {
    let values = null;
    try
    {
      values = await pgClient.query('SELECT * FROM values');
    }
    catch(error){

      console.error(`${new Date()}\t${error}`);
      response.sendStatus(500);
      return;
    }
    
    response.send(values?.rows);
  });

  app.get('/values/current', async(request,response) =>{
    redisClient.hgetall('values', (err, values) =>{
        response.send(values);
    });
  });

  app.post('/values', async (request,response)=>{
    const index = request.body.index;
    if(parseInt(index) > 40){
        return response.status(422).send('Index too high')
    }

    redisClient.hset('values', index, 'Nothing Yet!');
    redisPublisher.publish('insert',index);

    try {
      result = await pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);
    }
    catch(error) {
      console.error(`${new Date()}\t${error}`);
    }

    response.send({ working: true});
  });

  app.listen(5000, err => {
      console.log('Listening');
  })
