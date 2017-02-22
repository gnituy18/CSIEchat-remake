/* ============================ */
/* =====     Requires     ===== */
/* ============================ */
const koa = require('koa')()
const views = require('koa-views')
const serve = require('koa-static')
const router = require('koa-router')()
const session = require('koa-session')
const validate = require('koa-validate')
const mongo = require('koa-mongo')
const koaBody = require('koa-body')
const passwordHash = require('password-hash')
const path = require('path')
const socket = require('socket.io')
const http = require('http')
const server = http.createServer(koa.callback())
const io = socket.listen(server)

const KEYS = process.env.KEYS || 'key'
const PORT = process.env.PORT || 80
const DB_NAME = process.env.DB || 'app'
const DB_HOST = process.env.DB_HOST || 'localhost'
const DB_PORT = process.env.DB_PORT || 27017
const DB_USER = process.env.DB_USER || 'dbuser'
const DB_PASS = process.env.DB_PASS || 'dbpass'

const ASTEP = 10
const users = {}
const userMappingTable = {}

/* ============================ */
/* =====    Middlewares   ===== */
/* ============================ */
koa.keys = [KEYS]
koa.use(views(path.join(__dirname, '../views'), {'map': {'html': 'mustache'}}))
koa.use(serve(path.join(__dirname, '../public')))
koa.use(koaBody({
  'multipart': true,
  'formidable': {
    'keepExtensions': true,
    'uploadDir': path.join(__dirname, '../public/img/avatars')
  }
}))
koa.use(session(koa))
koa.use(mongo({
  'db': DB_NAME,
  'host': DB_HOST,
  'port': DB_PORT,
  'user': DB_USER,
  'pass': DB_PASS
}))
validate(koa)

/* ============================ */
/* =====      Routes      ===== */
/* ============================ */
router.get('/', function* () {
  if (this.session.user) {
    yield this.render('beach', this.session.user)
  } else {
    yield this.render('login')
  }
})

router.post('/', function* () {
  let username = this.request.body.username
  let password = this.request.body.password
  let user = yield this.mongo.db(DB_NAME).collection('users').find({'_id': username}).toArray()

  if (user.length === 1 && passwordHash.verify(password, user[0].password)) {
    this.session.user = {
      'username': username,
      'image': user[0].image
    }
    this.redirect('/')
  }
  this.body = '你的帳號密碼有誤。'
})

router.get('/logout', function* () {
  this.session.user = null
  this.redirect('/')
})

router.get('/create', function* () {
  yield this.render('create')
})

router.post('/create', function* (next) {
  // Validation
  this.checkBody('username')
  .len(1, 10, '你的名字必須介於1到20個字。')
  this.checkBody('password')
  .isAlphanumeric('你的密碼必須由英文與數字組成。')
  .eq(this.request.body.fields.repassword, '你輸入的兩組密碼並不相同。')
  this.checkFile('image')
  .notEmpty('你必須上傳圖片。')
  .isImageContentType('你上傳的檔案不是圖片。')

  if (this.errors) {
    this.body = this.errors[0][Object.keys(this.errors[0])]
    return
  }

  // Check if username exist
  let user = yield this.mongo.db(DB_NAME).collection('users').find({'_id': this.request.body.fields.username}).toArray()
  if (user.length > 0) {
    this.body = '你的暱稱已經存在。'
    return
  }

  // Create new user
  yield this.mongo.db(DB_NAME).collection('users')
  .insert({
    '_id': this.request.body.fields.username,
    'password': passwordHash.generate(this.request.body.fields.password),
    'image': path.basename(this.request.body.files.image.path)
  })

  // Redirect to home page
  this.status = 301
  this.redirect('/')
  this.body = '正在回主頁面...'

  yield next
})

koa.use(router.routes())
koa.use(router.allowedMethods())

/* ============================ */
/* =====     Websocket    ===== */
/* ============================ */
io.on('connection', function (socket) {
  socket.on('join', function (user) {
    if (typeof users[user.name] === 'undefined') {
      users[user.name] = {}
      users[user.name].avatarId = user.avatarId
      users[user.name].x = Math.random() * 1266 + 50
      users[user.name].y = Math.random() * 218 + 550
    }
    userMappingTable[socket.id] = user.name
    io.to(socket.id).emit('state', users)
    socket.broadcast.emit('user join', {
      'name': user.name,
      'info': users[user.name]
    })
  })

  socket.on('move', function (key) {
    const name = userMappingTable[socket.id]
    switch (key) {
      case 'ArrowUp':
        users[name].y = users[name].y - ASTEP < 550 ? 550 : users[name].y - ASTEP
        break
      case 'ArrowDown':
        users[name].y = users[name].y + ASTEP > 768 ? 768 : users[name].y + ASTEP
        break
      case 'ArrowLeft':
        users[name].x = users[name].x - ASTEP < 50 ? 50 : users[name].x - ASTEP
        break
      case 'ArrowRight':
        users[name].x = users[name].x + ASTEP > 1316 ? 1316 : users[name].x + ASTEP
        break
    }
    io.emit('user move', {
      'name': name,
      'x': users[name].x,
      'y': users[name].y
    })
  })

  socket.on('talk', function (msg) {
    io.emit('user talk', {
      'name': userMappingTable[socket.id],
      'msg': msg
    })
  })

  socket.on('disconnect', function () {
    const name = userMappingTable[socket.id]
    let connectionRemains = false

    delete userMappingTable[socket.id]

    for (let id in userMappingTable) {
      if (Object.prototype.hasOwnProperty.call(userMappingTable, id)) {
        if (userMappingTable[id] === name) {
          connectionRemains = true
          break
        }
      }
    }

    if (!connectionRemains) {
      delete users[name]
      console.log(users)
      console.log(userMappingTable)
      io.emit('user leave', name)
    }
  })
})

server.listen(PORT)
