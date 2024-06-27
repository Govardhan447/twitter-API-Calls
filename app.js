const express = require('express')
const app = express()
app.use(express.json())

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const path = require('path')
const dbpath = path.join(__dirname, 'twitterClone.db')

let db = null

const initilizeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Runnning on http://localhost/3000/')
    })
  } catch (e) {
    console.log(`DB error:${e.meassage}`)
    process.exit(1)
  }
}

initilizeDBAndServer()

//POST Create user Account API 1

app.post('/register/', async (request, response) => {
  const requestBody = request.body

  const {username, password, name, gender} = requestBody
  let hashedPassword = await bcrypt.hash(password, 10)

  const searchUserName = `SELECT * FROM user WHERE username ='${username}';`
  const dbUser = await db.get(searchUserName)

  if (dbUser === undefined) {
    const creatUserQuery = `INSERT INTO
                user(username, password, name, gender)
              VALUES
                ('${username}','${hashedPassword}','${name}','${gender}');`
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const dbResponse = await db.run(creatUserQuery)

      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

//POST login user Account API 2

app.post('/login', async (request, response) => {
  const {username, password} = request.body

  const searchUserName = `SELECT * FROM user WHERE username ='${username}';`
  const dbUser = await db.get(searchUserName)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const compareUserPassword = await bcrypt.compare(password, dbUser.password)
    if (compareUserPassword === true) {
      const payload = {username: username}
      const jwtToken = await jwt.sign(payload, 'jwt-screate-token')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'jwt-screate-token', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

// API 3 user/twitter/feed/

app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  const getFeeds = `
  SELECT
      user.name,
      tweet.tweet,
      tweet.date_time
  FROM 
      tweet INNER JOIN  user ON 
      user.user_id = tweet.user_id 
  
  ORDER BY tweet.date_time ASC
  LIMIT 4;`
  const dbResponse = await db.all(getFeeds)
  response.send(dbResponse)
})

// API 4
app.get('/user/following/', authenticateToken, async (request, response) => {
  const getFeeds = `
  SELECT
      user.name
     
  FROM 
      follower INNER JOIN  user ON 
      user.user_id = follower.following_user_id;`
  const dbResponse = await db.all(getFeeds)
  response.send(dbResponse)
})

// API 5
app.get('/user/followers/', authenticateToken, async (request, response) => {
  const getFeeds = `
  SELECT
      user.name
  FROM 
      follower INNER JOIN  user ON 
      user.user_id = follower.follower_user_id;`
  const dbResponse = await db.all(getFeeds)
  response.send(dbResponse)
})

// API 6
app.get('/tweet/:tweetId/', authenticateToken, async (request, response) => {
  const {tweetId} = request.params
  const getFeeds = `
  SELECT
      tweet.tweet AS tweet,
      COUNT(like_id) AS likes,
      COUNT(reply_id) AS replies,
      tweet.date_time AS dateTime
  FROM 
      (tweet NATURAl JOIN  like)  
     AS 
      T NATURAl JOIN  reply 
      
  WHERE 
      tweet_id = ${tweetId};`
  const dbResponse = await db.all(getFeeds)

  if (dbResponse[0].tweet === null) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    response.send(dbResponse)
  }
})

// API 7
app.get(
  '/tweet/:tweetId/likes',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request.params
    const getFeeds = `
  SELECT
      user.name
  FROM 
      user NATURAl JOIN  like
  WHERE 
      tweet_id = ${tweetId};`
    const dbResponse = await db.all(getFeeds)

    if (dbResponse[0].name === null) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      response.send({likes: [`${dbResponse[0].name}`]})
    }
  },
)

// API 8
app.get(
  '/tweet/:tweetId/replies',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request.params
    const getFeeds = `
  SELECT
      user.name,
      reply.reply
  FROM 
      user NATURAl JOIN  reply
  WHERE 
      tweet_id = ${tweetId};`
    const dbResponse = await db.all(getFeeds)

    if (dbResponse === undefined) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      response.send({
        replies: [
          {name: `${dbResponse[0].name}`, reply: `${dbResponse[0].reply}`},
        ],
      })
    }
  },
)

// API 9
app.get('/user/tweets/', authenticateToken, async (request, response) => {
  const getFeeds = `
   SELECT
      tweet.tweet,
      COUNT(like_id),
      COUNT(reply_id),
      tweet.date_time
  FROM 
      (tweet NATURAl JOIN  like)  
     AS 
      T NATURAl JOIN  reply
 ;`
  const dbResponse = await db.all(getFeeds)

  if (dbResponse[0].tweet === null) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    response.send([
      {
        tweet: dbResponse[0].tweet,
        likes: dbResponse[0]['COUNT(like_id)'],
        replies: dbResponse[0]['COUNT(reply_id)'],
        dateTime: dbResponse[0].date_time,
      },
    ])
  }
})

// API 10
app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const {tweet} = request.body
  const getFeeds = `
  INSERT INTO
    tweet (tweet)
    VALUES(
      '${tweet}'
    );`
  const dbResponse = await db.run(getFeeds)

  if (dbResponse === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    response.send('Created a Tweet')
  }
})

// API 8
app.delete('/tweet/:tweetId/', authenticateToken, async (request, response) => {
  const {tweetId} = request.params
  const getFeeds = `
  SELECT
      *
  FROM 
      tweet
  WHERE 
      tweet_id = ${tweetId};`
  const dbResponse = await db.all(getFeeds)

  if (dbResponse === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    response.send('Tweet Removed')
  }
})

module.exports = app
