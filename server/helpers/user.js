var passwordHash = require('password-hash')
var path = require('path')

module.exports.createUserObj = function (body) {
  return {
    '_id': body.fields.username,
    'password': passwordHash.generate(body.fields.password),
    'image': path.basename(body.files.image.path)
  }
}
