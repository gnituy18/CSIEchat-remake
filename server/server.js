/* ============================ */
/* =====     Requires     ===== */
/* ============================ */
var koa = require('koa')()
var views = require('koa-views')
var serve = require('koa-static')
var router = require('koa-router')()
var session = require('koa-session')
var validate = require('koa-validate')
var mongo = require('koa-mongo')
var koaBody = require('koa-body')
var passwordHash = require('password-hash')
var path = require('path')
var socket = require('socket.io')
var http = require('http')
var userHelper = require('./helpers/user')
var server = http.createServer(koa.callback())
var io = socket.listen(server)

var users = {}
var userMappingTable = {}
const aStep = 10

/* ============================ */
/* =====    Middlewares   ===== */
/* ============================ */
koa.keys = ['secret']
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
  'user': 'beach',
  'db': 'app'
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
  let user = yield this.mongo.db('app').collection('users').find({'_id': username}).toArray()

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
  let user = yield this.mongo.db('app').collection('users').find({'_id': this.request.body.fields.username}).toArray()
  if (user.length > 0) {
    this.body = '你的暱稱已經存在。'
    return
  }

  // Create new user
  yield this.mongo.db('app').collection('users').insert(userHelper.createUserObj(this.request.body))

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
        users[name].y = users[name].y - aStep < 550 ? 550 : users[name].y - aStep
        break
      case 'ArrowDown':
        users[name].y = users[name].y + aStep > 768 ? 768 : users[name].y + aStep
        break
      case 'ArrowLeft':
        users[name].x = users[name].x - aStep < 50 ? 50 : users[name].x - aStep
        break
      case 'ArrowRight':
        users[name].x = users[name].x + aStep > 1316 ? 1316 : users[name].x + aStep
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

server.listen(3000)
