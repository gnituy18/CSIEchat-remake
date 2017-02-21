const io = require('socket.io-client')()
const name = window.document.getElementById('username').innerHTML
const avatarId = window.document.getElementById('image').innerHTML
const msg = window.document.getElementById('msg')
const submit = window.document.getElementById('submit')
const renderer = PIXI.autoDetectRenderer(1366, 768)
const stage = new PIXI.Container()
const users = {}
const BODY_HEIGHT = 100
const BODY_WIDTH = 100
const AVATAR_HEIGHT = 60
const AVATAR_WIDTH = 60
const FONT_SIZE = 16
const WORD_WRAP_WIDTH = 180
const AVATARS_DIR = '/img/avatars/'
const BODY_FILE_PATH = '/img/body.png'
const BEACH_FILE_PATH = '/img/beach.jpg'

Promise.resolve()
.then(function () {
  io.on('state', function (usersInfo) {
    for (let name in usersInfo) {
      if (Object.prototype.hasOwnProperty.call(usersInfo, name)) {
        createNewUser(name, usersInfo[name])
      }
    }
  })

  io.on('user join', function (user) {
    createNewUser(user.name, user.info)
  })

  io.on('user move', function (user) {
    users[user.name].group.x = user.x
    users[user.name].group.y = user.y
    renderer.render(stage)
  })

  io.on('user talk', function (user) {
    if (typeof users[user.name].msgTimeoutID !== 'undefined') {
      clearTimeout(users[user.name].msgTimeoutID)
      removePreviousMsg(user.name)
    }
    users[user.name].msgGroup = createMsgGroup(user.name, user.msg)
    users[user.name].group.addChild(users[user.name].msgGroup)
    users[user.name].msgTimeoutID = setTimeout(function () {
      removePreviousMsg(user.name)
      renderer.render(stage)
    }, 4000)
    renderer.render(stage)
  })

  io.on('user leave', function (name) {
    stage.removeChild(users[name].group)
    delete users[name]
    renderer.render(stage)
  })
})
.then(function () {
  window.document.getElementById('beach').appendChild(renderer.view)
  PIXI.loader
  .add(BODY_FILE_PATH)
  .add(BEACH_FILE_PATH)
  .load(setup)
})
.then(function () {
  io.emit('join', {
    'name': name,
    'avatarId': avatarId
  })
})

function setup () {
  setupControl()
  setupRenderer()
}

function setupControl () {
  window.addEventListener('keydown', function (event) {
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        window.document.activeElement.blur()
        io.emit('move', event.key)
        break
    }
  })
  submit.onclick = function () {
    io.emit('talk', msg.value)
    msg.value = ''
  }
}

function setupRenderer () {
  var beach = new PIXI.Sprite(
    PIXI.loader.resources[BEACH_FILE_PATH].texture
  )

  stage.addChild(beach)
  renderer.render(stage)
}

function createNewUser (name, userInfo) {
  if (typeof PIXI.loader.resources[AVATARS_DIR + userInfo.avatarId] === 'undefined') {
    PIXI.loader
    .add(AVATARS_DIR + userInfo.avatarId)
    .load(function () {
      addUserGroup(name, userInfo)
    })
  } else {
    addUserGroup(name, userInfo)
  }
}
function addUserGroup (name, userInfo) {
  users[name] = {}
  users[name].group = createUserGroup(name, userInfo.avatarId)
  users[name].group.x = userInfo.x
  users[name].group.y = userInfo.y
  stage.addChild(users[name].group)
  renderer.render(stage)
}


function createMsgGroup (name, msg) {
  const msgGroup = new PIXI.Container()
  const msgBackgroundGraph = new PIXI.Graphics()
  const msgText = new PIXI.Text(msg, {
    'fontSize': 20,
    'wordWrap': true,
    'breakWords': true,
    'wordWrapWidth': WORD_WRAP_WIDTH
  })
  const PADDING = 5
  const GAP = 20

  msgBackgroundGraph.lineStyle(2, 0, 1)
  msgBackgroundGraph.beginFill(0xFFFFFF)
  msgBackgroundGraph.drawRoundedRect(0, 0, msgText.width + PADDING * 2, msgText.height + PADDING * 2, 5)
  msgBackgroundGraph.endFill()
  msgBackgroundGraph.x = -(msgText.width / 2)
  msgBackgroundGraph.y = -(AVATAR_HEIGHT + BODY_HEIGHT + FONT_SIZE + msgText.height + GAP)

  msgText.x = -(msgText.width / 2) + PADDING
  msgText.y = -(AVATAR_HEIGHT + BODY_HEIGHT + FONT_SIZE + msgText.height + GAP) + PADDING

  msgGroup.addChild(msgBackgroundGraph)
  msgGroup.addChild(msgText)
  return msgGroup
}

function removePreviousMsg (name) {
  if (typeof users[name] !== 'undefined') {
    users[name].group.removeChild(users[name].msgGroup)
    delete users[name].msgTimeoutID
    delete users[name].msgGroup
  }
}

function createUserGroup (name, avatarId) {
  const userGroup = new PIXI.Container()
  const avatarSprite = new PIXI.Sprite(PIXI.loader.resources[AVATARS_DIR + avatarId].texture)
  const bodySprite = new PIXI.Sprite(PIXI.loader.resources[BODY_FILE_PATH].texture)
  const nameText = new PIXI.Text(name, {'fontSize': FONT_SIZE})

  avatarSprite.height = AVATAR_HEIGHT
  avatarSprite.width = AVATAR_WIDTH
  avatarSprite.x = -(AVATAR_WIDTH / 2)
  avatarSprite.y = -(AVATAR_HEIGHT + BODY_HEIGHT + nameText.height)

  bodySprite.height = BODY_HEIGHT
  bodySprite.width = BODY_WIDTH
  bodySprite.x = -(BODY_WIDTH / 2)
  bodySprite.y = -(BODY_HEIGHT + nameText.height)

  userGroup.addChild(avatarSprite)
  userGroup.addChild(bodySprite)

  nameText.position.set(-nameText.width / 2, -nameText.height)
  userGroup.addChild(nameText)

  return userGroup
}
